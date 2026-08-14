import Fastify from 'fastify';
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
import { prisma } from './db.js';

const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

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

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
