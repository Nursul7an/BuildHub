/**
 * Общая обвязка тестов: своя база, свежий сев, приложение в процессе.
 * Порты не занимаем — запросы идут через app.inject().
 */
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { prisma } from '../src/db.js';
import { DEMO_PASSWORD, seedDatabase } from '../prisma/seed.js';

let app: FastifyInstance | null = null;

export async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    // Ограничение частоты выключено: тесты стучат подряд и упёрлись бы
    // в лимит. Само ограничение проверяется отдельным приложением.
    app = await buildApp({ logger: false, rateLimit: false });
    await app.ready();
  }
  return app;
}

/** Приложение с включённым ограничением частоты — только для его же тестов. */
export async function buildLimitedApp(): Promise<FastifyInstance> {
  const limited = await buildApp({ logger: false, rateLimit: true });
  await limited.ready();
  return limited;
}

/** Возврат к известному состоянию — каждый файл тестов стартует с него. */
export async function resetDatabase() {
  await seedDatabase({ quiet: true });
}

export async function closeAll() {
  if (app) await app.close();
  app = null;
  await prisma.$disconnect();
}

export interface ApiResult<T = any> {
  status: number;
  body: T;
}

export async function api<T = any>(
  token: string | null,
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  payload?: unknown,
): Promise<ApiResult<T>> {
  const instance = await getApp();
  const res = await instance.inject({
    method,
    url: path,
    headers: token ? { authorization: `Bearer ${token}` } : {},
    payload: payload as never,
  });
  let body: T;
  try {
    body = res.json() as T;
  } catch {
    body = null as T;
  }
  return { status: res.statusCode, body };
}

export async function login(loginName: string, password: string = DEMO_PASSWORD): Promise<string> {
  const res = await api(null, 'POST', '/api/auth/login', { login: loginName, password });
  if (res.status !== 200) {
    throw new Error(`Вход ${loginName} не удался: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return res.body.token as string;
}

/**
 * Разбор outbox вручную. Уведомления создаются воркером, а не бизнес-логикой,
 * поэтому тест, который проверяет инбокс, сначала прогоняет очередь.
 */
export async function drain(now?: Date) {
  const { drainOutbox } = await import('../src/events/worker.js');
  return drainOutbox({ now });
}

/** Учётки из сева — по ролям, чтобы тесты читались. */
export const ACCOUNTS = {
  prorab: 'a.zhumabekov',
  master: 't.mamatov',
  pto: 'g.sadykova',
  dir: 'n.toktomatov',
  gi: 'n.tashiev',
  snab: 'e.bakirov',
  sklad: 'm.abdyldaev',
  tech: 'k.turgunov',
} as const;

/**
 * Настоящий цикл загрузки: ссылка → PUT содержимого → ссылка на файл.
 * Запись выполнения не примет фото, которое не догрузилось, поэтому в тестах
 * идём тем же путём, что и клиент.
 */
export async function uploadPhoto(token: string, overrides: Record<string, unknown> = {}) {
  const instance = await getApp();
  const presigned = await api(token, 'POST', '/api/v1/files/presign', {
    filename: 'work.jpg',
    mime: 'image/jpeg',
    purpose: 'entry',
    takenAt: new Date().toISOString(),
    lat: 42.87,
    lon: 74.6,
    ...overrides,
  });
  if (presigned.status !== 200) {
    throw new Error(`Ссылка не выдана: ${presigned.status} ${JSON.stringify(presigned.body)}`);
  }
  const put = await instance.inject({
    method: 'PUT',
    url: presigned.body.uploadUrl,
    headers: { 'content-type': 'image/jpeg' },
    payload: Buffer.from('фото с объекта'),
  });
  if (put.statusCode !== 200) {
    throw new Error(`Загрузка не прошла: ${put.statusCode} ${put.body}`);
  }
  return { fileId: presigned.body.fileId as string, key: presigned.body.key as string };
}

/** Одно загруженное фото — самый частый случай в тестах. */
export async function photos(token: string) {
  const file = await uploadPhoto(token);
  return [{ fileId: file.fileId }];
}

export { DEMO_PASSWORD };
