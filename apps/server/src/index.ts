import { buildApp } from './app.js';
import { prisma } from './db.js';
import { startOutboxWorker, stopOutboxWorker } from './events/worker.js';
import { pruneLoginAttempts } from './ratelimit.js';

const app = await buildApp();

const port = Number(process.env.PORT ?? 4000);
await app.listen({ port, host: '0.0.0.0' });

// Разбор outbox. В проде это очередь BullMQ (ТЗ §3.1), контракт тот же.
startOutboxWorker(5000, (r) =>
  app.log.info({ outbox: r }, 'разобраны события'),
);

// Попытки входа старше суток не нужны: таблица не должна расти вечно.
const pruneTimer = setInterval(
  () => void pruneLoginAttempts().catch(() => undefined),
  3_600_000,
);
pruneTimer.unref();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    stopOutboxWorker();
    await app.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
