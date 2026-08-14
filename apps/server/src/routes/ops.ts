/**
 * Эксплуатационные ручки. ТЗ §3.1: метрики и алерты по SLA.
 *
 * Отдельно от прикладного API: их читают Prometheus и дежурный,
 * а не мобильный клиент.
 */
import type { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { fail } from '../http.js';
import { prometheus, report, slaSummary } from '../observability.js';
import { poisonedEvents } from '../events/worker.js';

export async function opsRoutes(app: FastifyInstance) {
  /**
   * Выгрузка метрик. Закрыта простым токеном: наружу торчать не должна,
   * а внутри её забирает Prometheus, у которого сессии нет.
   */
  app.get('/metrics', async (req, reply) => {
    const expected = process.env.METRICS_TOKEN;
    if (expected) {
      const provided = req.headers['authorization'];
      if (provided !== `Bearer ${expected}`) {
        return fail(reply, 401, 'unauthorized', 'Нужен токен доступа к метрикам');
      }
    }
    reply.header('content-type', 'text/plain; version=0.0.4; charset=utf-8');
    return prometheus();
  });

  /**
   * Готовность к работе. Отличается от /api/health: тот отвечает, что
   * процесс жив, а этот — что система способна обслуживать запросы.
   * Балансировщику нужны оба ответа, и они разные.
   */
  app.get('/api/health/ready', async (reply) => {
    const started = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      return { ok: false, database: 'unavailable' };
    }
    return { ok: true, database: 'ok', latencyMs: Date.now() - started };
  });

  /** Соблюдение SLA из §11 — то, о чём спрашивают на приёмке. */
  app.get(
    '/api/v1/ops/sla',
    { preHandler: [app.authenticate, app.requirePermission('users.manage')] },
    async () => {
      const sla = slaSummary();
      const stuck = await poisonedEvents();
      const pending = await prisma.domainEvent.count({ where: { publishedAt: null } });

      return {
        ...sla,
        /** Очередь событий — часть здоровья системы, а не отдельная тема. */
        outbox: { pending, poisoned: stuck.length },
      };
    },
  );

  /** Разбор по маршрутам: где именно медленно. */
  app.get(
    '/api/v1/ops/routes',
    { preHandler: [app.authenticate, app.requirePermission('users.manage')] },
    async () => report(),
  );
}
