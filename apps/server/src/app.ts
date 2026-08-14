import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { authRoutes, registerAuth } from './auth.js';
import { worksRoutes } from './routes/works.js';
import { reportRoutes } from './routes/reports.js';
import { zayavkaRoutes } from './routes/zayavki.js';
import { materialRoutes } from './routes/materials.js';
import { contractorRoutes } from './routes/contractors.js';
import { docRoutes } from './routes/docs.js';
import { bossRoutes } from './routes/boss.js';
import { adminRoutes } from './routes/admin.js';
import { notificationRoutes } from './routes/notifications.js';
import { assistantRoutes } from './routes/assistant.js';

/**
 * Сборка приложения отдельно от запуска — чтобы тесты поднимали его в процессе
 * через app.inject(), без портов и ожиданий.
 */
export async function buildApp(options: { logger?: boolean } = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { level: process.env.LOG_LEVEL ?? 'info' },
  });

  await app.register(cors, { origin: true });
  await registerAuth(app);

  await app.register(authRoutes);
  await app.register(worksRoutes);
  await app.register(reportRoutes);
  await app.register(zayavkaRoutes);
  await app.register(materialRoutes);
  await app.register(contractorRoutes);
  await app.register(docRoutes);
  await app.register(bossRoutes);
  await app.register(adminRoutes);
  await app.register(notificationRoutes);
  await app.register(assistantRoutes);

  app.get('/api/health', async () => ({ ok: true }));

  app.setErrorHandler((error: unknown, _req, reply) => {
    const err = error as { validation?: unknown; name?: string };
    if (err.validation || err.name === 'ZodError') {
      return reply.code(400).send({ error: 'bad_request', message: 'Проверьте переданные данные' });
    }
    app.log.error(error);
    return reply.code(500).send({ error: 'internal', message: 'Внутренняя ошибка сервера' });
  });

  return app;
}
