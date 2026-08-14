/**
 * Общие контракты HTTP. ТЗ §6.
 *
 * Формат ошибки один на весь API: {code, message, details}. Код машиночитаемый —
 * клиент решает по нему, а не по тексту, который завтра переведут на кыргызский.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { createHash } from 'node:crypto';
import { prisma } from './db.js';

export const API_PREFIX = '/api/v1';

interface IdempotencyMeta {
  key: string;
  bodyHash: string;
  userId: string;
}

export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export function fail(reply: FastifyReply, status: number, code: string, message: string, details?: unknown) {
  return reply.code(status).send({ code, message, ...(details === undefined ? {} : { details }) });
}

/** Запрещённый переход статуса — всегда 409 и всегда с причиной. ТЗ §5. */
export function failTransition(reply: FastifyReply, code: string, message: string, details?: unknown) {
  return fail(reply, 409, code, message, details);
}

/**
 * Идемпотентность изменяющих запросов. ТЗ §6, критерий приёмки 8.
 *
 * Повтор с тем же ключом возвращает прежний результат, а не выполняет операцию
 * второй раз: связь на этаже рвётся посреди запроса, и клиент обязан иметь право
 * повторить отправку, не создавая дубль.
 */
export function registerIdempotency(app: FastifyInstance) {
  /**
   * Владельца ключа определяем по токену, а не по req.currentUser: этот хук
   * висит на корне и выполняется раньше аутентификации внутри плагинов.
   * Ключи разных пользователей не должны пересекаться.
   */
  const ownerOf = (req: FastifyRequest): string | null => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) return null;
    try {
      const payload = app.jwt.verify<{ sub: string }>(header.slice(7));
      return payload.sub;
    } catch {
      return null;
    }
  };

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const key = req.headers['idempotency-key'];
    if (typeof key !== 'string' || key.length === 0) return;
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) return;
    const userId = ownerOf(req);
    if (!userId) return;

    const bodyHash = createHash('sha256')
      .update(JSON.stringify(req.body ?? null))
      .digest('hex');

    const existing = await prisma.idempotencyKey.findUnique({
      where: { key_userId: { key, userId } },
    });

    if (existing) {
      if (existing.bodyHash !== bodyHash) {
        // Тот же ключ с другим телом — это ошибка клиента, а не повтор.
        return fail(
          reply,
          422,
          'idempotency_key_reuse',
          'Этот ключ идемпотентности уже использован с другими данными',
        );
      }
      return reply.code(existing.status).send(existing.responseBody as never);
    }

    // Ответ сохраняем после обработки — там уже известен и статус, и тело.
    (req as FastifyRequest & { idempotency?: IdempotencyMeta }).idempotency = { key, bodyHash, userId };
    return;
  });

  app.addHook('onSend', async (req, reply, payload) => {
    const meta = (req as FastifyRequest & { idempotency?: IdempotencyMeta }).idempotency;
    if (!meta) return payload;
    // Сохраняем только успешные ответы: повторять неудачу смысла нет.
    if (reply.statusCode >= 400) return payload;

    let parsed: unknown = null;
    try {
      parsed = typeof payload === 'string' ? JSON.parse(payload) : null;
    } catch {
      return payload;
    }

    await prisma.idempotencyKey
      .create({
        data: {
          key: meta.key,
          userId: meta.userId,
          method: req.method,
          path: req.url,
          bodyHash: meta.bodyHash,
          status: reply.statusCode,
          responseBody: parsed as never,
        },
      })
      .catch(() => undefined); // гонка двух одновременных повторов — второй просто не пишет

    return payload;
  });
}

/**
 * Курсорная пагинация. ТЗ §6: постраничная по offset на растущих журналах
 * начинает пропускать и дублировать записи, поэтому курсор.
 */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export function paginate<T extends { id: string }>(rows: T[], limit: number): CursorPage<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? (items[items.length - 1]?.id ?? null) : null };
}

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;
