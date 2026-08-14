import { buildApp } from './app.js';
import { prisma } from './db.js';
import { startOutboxWorker, stopOutboxWorker } from './events/worker.js';

const app = await buildApp();

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });

// Разбор outbox. В проде это очередь BullMQ (ТЗ §3.1), контракт тот же.
startOutboxWorker(5000, (r) =>
  app.log.info({ outbox: r }, 'разобраны события'),
);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    stopOutboxWorker();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
