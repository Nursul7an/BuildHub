/**
 * Ограничение частоты запросов. ТЗ §3.1 и §11.
 *
 * В целевой схеме частоту режет шлюз (Nginx / Traefik). Это не отменяет
 * лимитов в приложении: шлюз не знает, кто именно пришёл, и не отличает
 * подбор пароля от обычной нагрузки.
 *
 * Главное ограничение задаёт §11: пик 19:00–20:30, когда сдают отчёты, —
 * до 40 запросов в секунду. Лимит обязан пропускать этот пик целиком.
 * Ограничение, которое срабатывает на честной вечерней сдаче, хуже,
 * чем его отсутствие: прораб решит, что система сломалась, и вернётся
 * к бумаге.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { prisma } from './db.js';
import { fail } from './http.js';

/**
 * Общий лимит на пользователя. 300 запросов в минуту — это пять в секунду
 * от одного человека: заведомо больше, чем даёт живая работа с экраном,
 * и заведомо меньше, чем перебор.
 */
export const USER_LIMIT_PER_MINUTE = Number(process.env.RATE_LIMIT_PER_MINUTE ?? 300);

/** Окно и порог для попыток входа. */
export const LOGIN_WINDOW_MINUTES = 15;
/** Подряд с одного адреса — вероятнее перебор, чем забытый пароль. */
export const LOGIN_MAX_PER_IP = 20;
/** По одному логину порог мягче: человек честно путает пароль. */
export const LOGIN_MAX_PER_ACCOUNT = 10;

function windowStart(now: Date): Date {
  return new Date(now.getTime() - LOGIN_WINDOW_MINUTES * 60_000);
}

export interface LoginThrottle {
  blocked: boolean;
  retryAfterSeconds: number;
  reason: 'ip' | 'account' | null;
  attempts: number;
}

/**
 * Проверка перед попыткой входа.
 *
 * Учётную запись не блокируем: иначе любой, кто знает логин прораба,
 * закроет ему вход перед самой сдачей отчёта. Придерживаем адрес,
 * с которого идёт перебор, и мягко тормозим по логину.
 */
export async function checkLoginThrottle(
  loginValue: string,
  ip: string,
  now = new Date(),
): Promise<LoginThrottle> {
  const since = windowStart(now);

  const [byIp, byAccount] = await Promise.all([
    prisma.loginAttempt.count({ where: { ip, at: { gte: since } } }),
    prisma.loginAttempt.count({ where: { loginValue: loginValue.toLowerCase(), at: { gte: since } } }),
  ]);

  if (byIp >= LOGIN_MAX_PER_IP) {
    return {
      blocked: true,
      retryAfterSeconds: LOGIN_WINDOW_MINUTES * 60,
      reason: 'ip',
      attempts: byIp,
    };
  }
  if (byAccount >= LOGIN_MAX_PER_ACCOUNT) {
    return {
      blocked: true,
      retryAfterSeconds: LOGIN_WINDOW_MINUTES * 60,
      reason: 'account',
      attempts: byAccount,
    };
  }

  return { blocked: false, retryAfterSeconds: 0, reason: null, attempts: Math.max(byIp, byAccount) };
}

export async function recordFailedLogin(loginValue: string, ip: string) {
  await prisma.loginAttempt.create({
    data: { loginValue: loginValue.toLowerCase(), ip },
  });
}

/** Удачный вход снимает счётчик: человек вспомнил пароль — инцидента нет. */
export async function clearLoginAttempts(loginValue: string, ip: string) {
  await prisma.loginAttempt.deleteMany({
    where: { OR: [{ loginValue: loginValue.toLowerCase() }, { ip }] },
  });
}

/** Уборка старых записей — таблица не должна расти вечно. */
export async function pruneLoginAttempts(now = new Date()) {
  const { count } = await prisma.loginAttempt.deleteMany({
    where: { at: { lt: new Date(now.getTime() - 24 * 3_600_000) } },
  });
  return count;
}

export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: true,
    max: USER_LIMIT_PER_MINUTE,
    timeWindow: '1 minute',

    /**
     * Считаем по пользователю, когда он известен: на объекте несколько
     * человек сидят за одним Wi-Fi, и общий счётчик по IP наказал бы
     * всю бригаду за активность одного.
     */
    keyGenerator: (req: FastifyRequest) => {
      const header = req.headers.authorization;
      if (header?.startsWith('Bearer ')) {
        try {
          const payload = app.jwt.verify<{ sub: string }>(header.slice(7));
          return `user:${payload.sub}`;
        } catch {
          /* токен просрочен или испорчен — считаем по адресу */
        }
      }
      return `ip:${req.ip}`;
    },

    // Загрузка файла и пакетная синхронизация идут отдельными потоками
    // и по своим правилам: после дня без связи очередь может быть длинной.
    allowList: (req: FastifyRequest) =>
      req.url.startsWith('/api/v1/files/content') || req.url === '/api/health',

    errorResponseBuilder: (_req, context) => ({
      // Код ответа кладём и в саму ошибку: обработчик не должен догадываться.
      statusCode: 429,
      code: 'rate_limited',
      message: `Слишком много запросов. Повторите через ${Math.ceil(context.ttl / 1000)} с`,
      details: { limit: context.max, retryAfterSeconds: Math.ceil(context.ttl / 1000) },
    }),
  });
}

/** Ответ на превышение лимита входов. */
export function failLoginThrottled(reply: FastifyReply, throttle: LoginThrottle) {
  reply.header('Retry-After', String(throttle.retryAfterSeconds));
  return fail(
    reply,
    429,
    'login_throttled',
    throttle.reason === 'ip'
      ? 'Слишком много попыток входа с этого устройства. Попробуйте позже'
      : 'Слишком много неудачных попыток. Попробуйте позже или обратитесь к ПТО за сбросом пароля',
    { retryAfterSeconds: throttle.retryAfterSeconds },
  );
}
