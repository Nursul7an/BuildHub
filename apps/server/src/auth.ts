import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import { z } from 'zod';
import { prisma } from './db.js';
import { type Permission, type Role, can } from '@build-hub/shared';
import {
  checkPasswordStrength,
  generatePassword,
  hashPassword,
  needsRehash,
  verifyPassword,
} from './password.js';
import {
  ACCESS_TTL,
  ACCESS_TTL_SECONDS,
  createSession,
  listSessions,
  revokeAllSessions,
  revokeSession,
  rotateSession,
} from './sessions.js';
import { fail } from './http.js';
import { actorOf, audit } from './audit.js';

export { generatePassword };

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'build-hub-dev-secret-change-me',
    // Короткий access: отозванный доступ гаснет сам, без похода в базу
    // на каждый запрос (ТЗ §3.1).
    sign: { expiresIn: ACCESS_TTL },
  });

  app.decorateRequest('currentUser', null as never);

  /**
   * Аутентификация. Пока пароль не сменён, пускаем только на смену пароля —
   * иначе временный пароль остаётся рабочим сколько угодно долго.
   */
  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch (error) {
      const expired = String((error as { code?: string }).code ?? '').includes('EXPIRED');
      return fail(
        reply,
        401,
        expired ? 'token_expired' : 'unauthorized',
        expired ? 'Срок действия токена истёк — обновите его' : 'Нужен вход в систему',
      );
    }

    const user = await prisma.user.findUnique({ where: { id: req.user.sub } });
    if (!user || !user.active) {
      // Блокировка закрывает доступ, но история действий сохраняется (§12).
      return fail(reply, 401, 'unauthorized', 'Учётная запись отключена');
    }

    req.currentUser = {
      id: user.id,
      role: user.role as Role,
      login: user.login,
      mustChangePassword: user.mustChangePassword,
    };

    const isPasswordRoute = req.url.startsWith('/api/auth/password');
    if (user.mustChangePassword && !isPasswordRoute) {
      return fail(reply, 403, 'password_change_required', 'Сначала смените пароль');
    }
    return undefined;
  });

  /** Проверка права из матрицы ролей. */
  app.decorate('requirePermission', (permission: Permission) => {
    return async (req: FastifyRequest, reply: FastifyReply) => {
      if (!can(req.currentUser.role, permission)) {
        return fail(reply, 403, 'forbidden', 'Роль не имеет права на это действие');
      }
      return undefined;
    };
  });
}

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  deviceName: z.string().optional(),
  deviceId: z.string().optional(),
});

const passwordSchema = z
  .object({
    newPassword: z.string(),
    repeatPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.repeatPassword, {
    message: 'Пароли не совпадают',
    path: ['repeatPassword'],
  });

function deviceOf(req: FastifyRequest, body?: { deviceName?: string; deviceId?: string }) {
  return {
    deviceName: body?.deviceName,
    deviceId: body?.deviceId,
    ip: req.ip,
    userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
  };
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, 'bad_request', 'Заполните логин и пароль');
    }

    // Логин или телефон — на объекте помнят телефон, а не логин.
    const value = parsed.data.login.trim();
    const user = await prisma.user.findFirst({
      where: { OR: [{ login: value }, { phone: value }], active: true },
    });

    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
      return fail(reply, 401, 'bad_credentials', 'Неверный логин или пароль');
    }

    // Прозрачная миграция: старый bcrypt-хеш заменяется argon2id при входе.
    if (needsRehash(user.passwordHash)) {
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(parsed.data.password) },
      });
    }

    const session = await createSession(user.id, deviceOf(req, parsed.data));
    const token = app.jwt.sign({ sub: user.id, role: user.role as Role, sid: session.sessionId });

    return {
      token,
      expiresIn: ACCESS_TTL_SECONDS,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.expiresAt.toISOString(),
      mustChangePassword: user.mustChangePassword,
      user: publicUser(user),
    };
  });

  /**
   * Обновление доступа. Refresh одноразовый: повторное предъявление —
   * признак того, что токен утёк, и тогда гаснет вся цепочка устройства.
   */
  app.post('/api/auth/refresh', async (req, reply) => {
    const parsed = z.object({ refreshToken: z.string().min(1) }).safeParse(req.body);
    if (!parsed.success) return fail(reply, 400, 'bad_request', 'Нужен refresh-токен');

    const outcome = await rotateSession(parsed.data.refreshToken, deviceOf(req));
    if (!outcome.ok) {
      const message =
        outcome.code === 'reused'
          ? 'Токен уже был использован — все сессии устройства закрыты'
          : outcome.code === 'expired'
            ? 'Срок сессии истёк — войдите заново'
            : 'Сессия не найдена';
      return fail(reply, 401, outcome.code, message);
    }

    const user = await prisma.user.findUnique({ where: { id: outcome.userId } });
    if (!user || !user.active) {
      return fail(reply, 401, 'unauthorized', 'Учётная запись отключена');
    }

    const token = app.jwt.sign({
      sub: user.id,
      role: user.role as Role,
      sid: outcome.session.sessionId,
    });

    return {
      token,
      expiresIn: ACCESS_TTL_SECONDS,
      refreshToken: outcome.session.refreshToken,
      refreshExpiresAt: outcome.session.expiresAt.toISOString(),
      mustChangePassword: user.mustChangePassword,
    };
  });

  app.post('/api/auth/logout', { preHandler: [app.authenticate] }, async (req) => {
    const sid = (req.user as { sid?: string }).sid;
    if (sid) await revokeSession(sid, 'logout');
    return { ok: true };
  });

  /** Смена пароля закрывает прежние сессии (ТЗ §6). */
  app.post('/api/auth/password', { preHandler: [app.authenticate] }, async (req, reply) => {
    const parsed = passwordSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, 'bad_request', parsed.error.issues[0]?.message ?? 'Проверьте пароль');
    }

    const strength = checkPasswordStrength(parsed.data.newPassword);
    if (!strength.ok) {
      return fail(reply, 400, 'weak_password', strength.message);
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    await prisma.user.update({
      where: { id: req.currentUser.id },
      data: { passwordHash, mustChangePassword: false },
    });

    // Прежний пароль перестаёт работать, и все выданные ранее сессии тоже.
    await revokeAllSessions(req.currentUser.id, 'password_change');

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    await audit(actorOf(req.currentUser, me.fullName), {
      entity: 'user',
      entityId: req.currentUser.id,
      action: 'update',
      field: 'password',
      // Значения паролей в журнал не попадают — только факт смены.
      newValue: 'изменён',
    });

    // Клиент остаётся в системе на текущем устройстве: выдаём новую пару.
    const session = await createSession(req.currentUser.id, deviceOf(req));
    const token = app.jwt.sign({
      sub: req.currentUser.id,
      role: req.currentUser.role,
      sid: session.sessionId,
    });

    return {
      ok: true,
      token,
      expiresIn: ACCESS_TTL_SECONDS,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.expiresAt.toISOString(),
    };
  });

  /** Список устройств и отзыв — человек должен видеть, откуда он вошёл. */
  app.get('/api/auth/sessions', { preHandler: [app.authenticate] }, async (req) => {
    const current = (req.user as { sid?: string }).sid;
    const sessions = await listSessions(req.currentUser.id);
    return sessions.map((s) => ({ ...s, current: s.id === current }));
  });

  app.delete('/api/auth/sessions/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session || session.userId !== req.currentUser.id) {
      return fail(reply, 404, 'not_found', 'Сессия не найдена');
    }
    await revokeSession(id, 'manual');
    return { ok: true };
  });

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
