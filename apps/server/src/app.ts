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
import { adminConfigRoutes } from './routes/admin-config.js';
import { fileRoutes } from './routes/files.js';
import { syncRoutes } from './routes/sync.js';
import { sheetRoutes } from './routes/sheets.js';
import { econRoutes } from './routes/econ.js';
import { issueRoutes } from './routes/issues.js';
import { kpiRoutes } from './routes/kpi.js';
import { registerIdempotency } from './http.js';
import { registerRateLimit } from './ratelimit.js';
import { registerObservability, requestIdOf } from './observability.js';
import { opsRoutes } from './routes/ops.js';

/**
 * Сборка приложения отдельно от запуска — чтобы тесты поднимали его в процессе
 * через app.inject(), без портов и ожиданий.
 */
export async function buildApp(
  options: { logger?: boolean; rateLimit?: boolean } = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger === false ? false : { level: process.env.LOG_LEVEL ?? 'info' },
  });

  // Формат ошибки один на весь API: {code, message, details}. ТЗ §6.
  app.setErrorHandler((error: unknown, req, reply) => {
    const err = error as {
      validation?: unknown;
      name?: string;
      issues?: unknown;
      statusCode?: number;
      code?: string;
      message?: string;
      details?: unknown;
    };

    if (err.validation || err.name === 'ZodError') {
      return reply.code(400).send({
        code: 'bad_request',
        message: 'Проверьте переданные данные',
        details: err.issues ?? err.validation,
      });
    }

    // Ошибка, которая сама знает свой код ответа, — это осознанный отказ
    // плагина (например, превышение частоты), а не сбой сервера. Код может
    // лежать и на самой ошибке, и уже быть выставлен на ответе.
    // Превращать такой отказ в 500 значит врать клиенту о причине.
    const declared =
      typeof err.statusCode === 'number'
        ? err.statusCode
        : reply.statusCode >= 400 && reply.statusCode < 500
          ? reply.statusCode
          : null;

    if (declared !== null && declared >= 400 && declared < 500) {
      return reply.code(declared).send({
        code: err.code ?? 'request_rejected',
        message: err.message ?? 'Запрос отклонён',
        ...(err.details === undefined ? {} : { details: err.details }),
      });
    }

    // На жалобу «у меня не сохранилось» нужен след в журнале,
    // поэтому идентификатор запроса возвращается клиенту.
    const requestId = requestIdOf(req);
    app.log.error({ err: error, requestId }, 'необработанная ошибка');
    return reply.code(500).send({
      code: 'internal',
      message: 'Внутренняя ошибка сервера',
      ...(requestId ? { details: { requestId } } : {}),
    });
  });

  // Замеры включаются раньше всего: считать нужно и то, что упало.
  registerObservability(app);

  await app.register(cors, { origin: true });
  await registerAuth(app);
  // Частоту режет и шлюз (ТЗ §3.1), но он не знает, кто именно пришёл.
  if (options.rateLimit !== false) {
    await registerRateLimit(app);
  }
  // Повтор изменяющего запроса не должен создавать дубль: связь на этаже рвётся.
  registerIdempotency(app);

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
  await app.register(adminConfigRoutes);
  await app.register(fileRoutes);
  await app.register(syncRoutes);
  await app.register(sheetRoutes);
  await app.register(econRoutes);
  await app.register(issueRoutes);
  await app.register(kpiRoutes);
  await app.register(opsRoutes);

  app.get('/api/health', async () => ({ ok: true }));

  return app;
}
