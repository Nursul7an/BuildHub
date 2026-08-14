import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { prisma } from './db.js';
import { type Permission, type Role, can } from '@build-hub/shared';

/** Пароль выдаётся один раз и повторно не показывается — только сброс у ПТО / ГИ. */
export function generatePassword(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 10; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'build-hub-dev-secret-change-me',
    sign: { expiresIn: '30d' },
  });

  app.decorateRequest('currentUser', null as never);

  /**
   * Аутентификация. Пока пароль не сменён, пускаем только на смену пароля —
   * иначе временный пароль остаётся рабочим сколько угодно долго.
   */
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      return reply.code(401).send({ error: 'unauthorized', message: 'Нужен вход в систему' });
    }
    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || !user.active) {
      return reply.code(401).send({ error: 'unauthorized', message: 'Учётная запись отключена' });
    }
    req.currentUser = {
      id: user.id,
      role: user.role as Role,
      login: user.login,
      mustChangePassword: user.mustChangePassword,
    };
    const isPasswordRoute = req.url.startsWith('/api/auth/password');
    if (user.mustChangePassword && !isPasswordRoute) {
      return reply
        .code(403)
        .send({ error: 'password_change_required', message: 'Сначала смените пароль' });
    }
    return undefined;
  });

  /** Проверка права из матрицы ролей. */
  app.decorate('requirePermission', (permission: Permission) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      if (!can(req.currentUser.role, permission)) {
        return reply
          .code(403)
          .send({ error: 'forbidden', message: 'Роль не имеет права на это действие' });
      }
      return undefined;
    };
  });
}

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
});

const passwordSchema = z
  .object({
    newPassword: z.string().min(8, 'Пароль короче 8 символов — не подойдёт'),
    repeatPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.repeatPassword, {
    message: 'Пароли не совпадают',
    path: ['repeatPassword'],
  });

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'bad_request', message: 'Заполните логин и пароль' });
    }
    // Логин или телефон — на объекте помнят телефон, а не логин.
    const value = parsed.data.login.trim();
    const user = await prisma.user.findFirst({
      where: { OR: [{ login: value }, { phone: value }], active: true },
    });
    if (!user || !(await bcrypt.compare(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'bad_credentials', message: 'Неверный логин или пароль' });
    }
    const token = app.jwt.sign({ sub: user.id, role: user.role as Role });
    return {
      token,
      mustChangePassword: user.mustChangePassword,
      user: publicUser(user),
    };
  });

  app.post(
    '/api/auth/password',
    { preHandler: [app.authenticate] },
    async (req, reply) => {
      const parsed = passwordSchema.safeParse(req.body);
      if (!parsed.success) {
        return reply.code(400).send({
          error: 'bad_request',
          message: parsed.error.issues[0]?.message ?? 'Проверьте пароль',
        });
      }
      const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
      // Прежний пароль перестаёт работать — посмотреть его повторно нельзя.
      await prisma.user.update({
        where: { id: req.currentUser.id },
        data: { passwordHash, mustChangePassword: false },
      });
      return { ok: true };
    },
  );

  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (req) => {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.currentUser.id },
      include: { object: true, block: true },
    });
    return {
      ...publicUser(user),
      object: user.object ? { id: user.object.id, name: user.object.name } : null,
      block: user.block ? { id: user.block.id, name: user.block.name } : null,
    };
  });
}

export function publicUser(user: {
  id: string;
  fullName: string;
  login: string;
  phone: string;
  role: string;
  objectId: string | null;
  blockId: string | null;
  scopeLabel: string | null;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: Date;
}) {
  return {
    id: user.id,
    fullName: user.fullName,
    login: user.login,
    phone: user.phone,
    role: user.role as Role,
    objectId: user.objectId ?? undefined,
    blockId: user.blockId ?? undefined,
    scopeLabel: user.scopeLabel ?? undefined,
    active: user.active,
    mustChangePassword: user.mustChangePassword,
    createdAt: user.createdAt.toISOString(),
  };
}
