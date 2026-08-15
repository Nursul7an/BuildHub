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
import {
  checkLoginThrottle,
  clearLoginAttempts,
  failLoginThrottled,
  recordFailedLogin,
} from './ratelimit.js';
import { actorOf, audit } from './audit.js';
import {
  REFRESH_COOKIE,
  jwtSecret,
  refreshCookieOptions,
  refreshNeedsCsrfHeader,
} from './config.js';

export { generatePassword };

export async function registerAuth(app: FastifyInstance) {
  await app.register(fastifyJwt, {
    secret: jwtSecret(),
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

/**
 * Чем клиент забирает refresh-токен.
 *
 * Браузер — cookie: httpOnly недоступна скриптам, поэтому XSS не уносит
 * токен, как унёс бы из localStorage. Мобильное приложение — тело ответа:
 * там нет чужого JavaScript, зато есть хранилище ключей, а cookie между
 * запусками приложения переживают не все клиенты.
 *
 * Тип клиента спрашиваем прямо, а не угадываем по User-Agent: угадывание
 * ошибается молча, и ошибка выглядит как «вход слетает сам по себе».
 */
const clientKind = z.enum(['web', 'mobile']).default('web');

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  deviceName: z.string().optional(),
  deviceId: z.string().optional(),
  client: clientKind,
});

/**
 * Регистрация открыта, пока в системе нет действующего руководителя.
 *
 * Отключённый директор не считается: если единственного руководителя
 * заблокировали, войти станет некому, и запереть систему навсегда —
 * худший из возможных исходов.
 */
async function registrationOpen(): Promise<boolean> {
  return (await prisma.user.count({ where: { role: 'dir', active: true } })) === 0;
}

const registerSchema = z.object({
  fullName: z.string().trim().min(3, 'Укажите фамилию, имя и отчество'),
  login: z
    .string()
    .trim()
    .min(3, 'Логин короче трёх символов')
    .regex(/^[a-zA-Z0-9._-]+$/, 'Логин — латиница, цифры, точка, дефис'),
  phone: z.string().trim().min(6, 'Укажите телефон'),
  password: z.string(),
  repeatPassword: z.string(),
  deviceName: z.string().optional(),
  deviceId: z.string().optional(),
  client: clientKind,
}).refine((v) => v.password === v.repeatPassword, {
  message: 'Пароли не совпадают',
  path: ['repeatPassword'],
});

const passwordSchema = z
  .object({
    newPassword: z.string(),
    repeatPassword: z.string(),
    client: clientKind,
  })
  .refine((v) => v.newPassword === v.repeatPassword, {
    message: 'Пароли не совпадают',
    path: ['repeatPassword'],
  });

/**
 * Отдаёт refresh-токен тем способом, который просил клиент.
 *
 * Веб получает cookie и не видит токен в теле: то, чего нет в ответе,
 * нельзя случайно положить в localStorage.
 */
function issueRefresh(
  reply: FastifyReply,
  session: { refreshToken: string; expiresAt: Date },
  client: 'web' | 'mobile',
): { refreshToken?: string; refreshExpiresAt: string } {
  if (client === 'mobile') {
    return {
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.expiresAt.toISOString(),
    };
  }

  reply.setCookie(REFRESH_COOKIE, session.refreshToken, {
    ...refreshCookieOptions(),
    expires: session.expiresAt,
  });
  // Срок отдаём и вебу: по нему клиент решает, когда пора обновляться,
  // а саму cookie он прочитать не может — в этом и смысл.
  return { refreshExpiresAt: session.expiresAt.toISOString() };
}

function clearRefresh(reply: FastifyReply) {
  reply.clearCookie(REFRESH_COOKIE, refreshCookieOptions());
}

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

    // Придерживаем перебор до проверки пароля: считать хеш на каждую
    // попытку злоумышленника — самому оплачивать чужую атаку.
    const throttle = await checkLoginThrottle(value, req.ip);
    if (throttle.blocked) return failLoginThrottled(reply, throttle);

    const user = await prisma.user.findFirst({
      where: { OR: [{ login: value }, { phone: value }], active: true },
    });

    if (!user || !(await verifyPassword(user.passwordHash, parsed.data.password))) {
      await recordFailedLogin(value, req.ip);
      // Ответ одинаков для несуществующего логина и неверного пароля:
      // иначе перебором собирают список действующих учёток.
      return fail(reply, 401, 'bad_credentials', 'Неверный логин или пароль');
    }

    await clearLoginAttempts(value, req.ip);

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
      ...issueRefresh(reply, session, parsed.data.client),
      mustChangePassword: user.mustChangePassword,
      user: publicUser(user),
    };
  });

  /**
   * Открыта ли регистрация.
   *
   * Экран входа спрашивает это, чтобы не показывать ссылку, которая
   * всё равно ответит отказом. Ответ намеренно скупой — «да» или «нет»,
   * без числа заведённых людей: незачем сообщать постороннему, обжита
   * система или пуста.
   */
  app.get('/api/auth/registration-open', async () => ({ open: await registrationOpen() }));

  /**
   * Регистрация первого руководителя.
   *
   * Обычные учётные записи заводит ПТО, но первого директора завести
   * некому: система приходит пустой. Пока руководителя нет, вход в неё
   * открыт; как только он появился — закрыт навсегда, иначе любой
   * желающий заведёт себе директорский доступ к бюджетам и платежам.
   */
  app.post('/api/auth/register', async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, 'bad_request', parsed.error.issues[0]?.message ?? 'Проверьте данные');
    }

    const strength = checkPasswordStrength(parsed.data.password);
    if (!strength.ok) return fail(reply, 400, 'weak_password', strength.message);

    if (!(await registrationOpen())) {
      return fail(
        reply,
        403,
        'registration_closed',
        'Руководитель уже зарегистрирован. Учётную запись выдаёт ПТО',
      );
    }

    const login = parsed.data.login.trim().toLowerCase();
    const taken = await prisma.user.findUnique({ where: { login } });
    if (taken) return fail(reply, 409, 'already_exists', 'Такой логин уже занят');

    const passwordHash = await hashPassword(parsed.data.password);

    let user: { id: string; role: string; fullName: string } | null = null;
    try {
      /**
       * Проверка и создание — в одной сериализуемой транзакции.
       *
       * Иначе две отправки формы, разошедшиеся на миллисекунды, обе
       * увидят «руководителя нет» и заведут по директору. Уникальность
       * логина от этого не спасает: логины у них разные.
       */
      user = await prisma.$transaction(
        async (tx) => {
          const existing = await tx.user.count({ where: { role: 'dir', active: true } });
          if (existing > 0) return null;

          return tx.user.create({
            data: {
              fullName: parsed.data.fullName.trim(),
              login,
              phone: parsed.data.phone.trim(),
              role: 'dir',
              passwordHash,
              // Пароль человек задал сам — менять его не с чего.
              mustChangePassword: false,
            },
            select: { id: true, role: true, fullName: true },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch {
      // Столкновение сериализуемых транзакций: второй регистрирующийся
      // опоздал. Для него это то же самое, что закрытая регистрация.
      return fail(reply, 403, 'registration_closed', 'Руководитель уже зарегистрирован');
    }

    if (!user) {
      return fail(reply, 403, 'registration_closed', 'Руководитель уже зарегистрирован');
    }

    await audit(
      actorOf({ id: user.id, role: user.role }, user.fullName),
      {
        entity: 'user',
        entityId: user.id,
        action: 'create',
        field: 'registration',
        newValue: 'первый руководитель зарегистрирован самостоятельно',
      },
    );

    const session = await createSession(user.id, deviceOf(req, parsed.data));
    const token = app.jwt.sign({ sub: user.id, role: user.role as Role, sid: session.sessionId });

    return {
      token,
      expiresIn: ACCESS_TTL_SECONDS,
      ...issueRefresh(reply, session, parsed.data.client),
      mustChangePassword: false,
      user: publicUser(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })),
    };
  });

  /**
   * Обновление доступа. Refresh одноразовый: повторное предъявление —
   * признак того, что токен утёк, и тогда гаснет вся цепочка устройства.
   */
  app.post('/api/auth/refresh', async (req, reply) => {
    const fromCookie = req.cookies[REFRESH_COOKIE];
    const body = z
      .object({ refreshToken: z.string().min(1).optional(), client: clientKind })
      .safeParse(req.body ?? {});
    if (!body.success) return fail(reply, 400, 'bad_request', 'Нужен refresh-токен');

    // Cookie важнее тела: если браузер её прислал, это и есть сессия.
    const presented = fromCookie ?? body.data.refreshToken;
    if (!presented) return fail(reply, 401, 'unauthorized', 'Нужен refresh-токен');

    // Клиент определяем по тому, откуда пришёл токен, а не по слову в теле:
    // иначе запрос из браузера с client=mobile увёл бы токен в тело ответа
    // и вынес его из-под httpOnly.
    const client: 'web' | 'mobile' = fromCookie ? 'web' : 'mobile';

    // Cookie при sameSite=none уходит и со стороннего сайта. Заголовок,
    // который нельзя выставить из простой формы, вынуждает предварительный
    // запрос CORS — а тот упрётся в список разрешённых адресов.
    if (client === 'web' && refreshNeedsCsrfHeader() && req.headers['x-build-hub-client'] !== 'web') {
      return fail(reply, 403, 'csrf_required', 'Не хватает заголовка x-build-hub-client');
    }

    const outcome = await rotateSession(presented, deviceOf(req));
    if (!outcome.ok) {
      const message =
        outcome.code === 'reused'
          ? 'Токен уже был использован — все сессии устройства закрыты'
          : outcome.code === 'expired'
            ? 'Срок сессии истёк — войдите заново'
            : 'Сессия не найдена';
      // Негодную cookie убираем, иначе браузер шлёт её снова и снова
      // и вход выглядит зациклившимся.
      if (client === 'web') clearRefresh(reply);
      return fail(reply, 401, outcome.code, message);
    }

    const user = await prisma.user.findUnique({ where: { id: outcome.userId } });
    if (!user || !user.active) {
      if (client === 'web') clearRefresh(reply);
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
      ...issueRefresh(reply, outcome.session, client),
      mustChangePassword: user.mustChangePassword,
    };
  });

  app.post('/api/auth/logout', { preHandler: [app.authenticate] }, async (req, reply) => {
    const sid = (req.user as { sid?: string }).sid;
    if (sid) await revokeSession(sid, 'logout');
    // Cookie гасим всегда: сессия в базе закрыта, и держать в браузере
    // недействительный токен незачем.
    clearRefresh(reply);
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
      // Тем же способом, каким клиент вошёл: браузер входил по cookie,
      // и после смены пароля она же обновляется.
      ...issueRefresh(reply, session, req.cookies[REFRESH_COOKIE] ? 'web' : parsed.data.client),
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
