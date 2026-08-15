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
import { fileStorageDir } from '../config.js';
import { resolve } from 'node:path';

/** Куда пишутся файлы и подключён ли под них отдельный том. */
function storageState() {
  const dir = resolve(fileStorageDir());
  return {
    dir,
    // Путь внутри дерева приложения на контейнерном хостинге почти всегда
    // означает временный диск: том монтируют отдельным путём.
    persistent: !dir.startsWith(resolve(process.cwd())) || Boolean(process.env.FILE_STORAGE_DIR),
  };
}

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
  app.get('/api/health/ready', async (_req, reply) => {
    const started = Date.now();
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      // Код ответа обязателен: балансировщик судит по нему, а не по телу.
      // Ответ 200 со словом «unavailable» внутри оставит сломанный
      // экземпляр в ротации — то есть проверка готовности не сработает.
      return reply.code(503).send({ ok: false, database: 'unavailable', storage: storageState() });
    }
    return {
      ok: true,
      database: 'ok',
      latencyMs: Date.now() - started,
      // Каталог загрузок виден снаружи: на контейнерном хостинге том
      // забывают подключить, и потеря фотографий обнаруживается
      // только после перезапуска.
      storage: storageState(),
    };
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
