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
    app = await buildApp({ logger: false });
    await app.ready();
  }
  return app;
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

export const photo = () => [
  { url: 'photo://test.jpg', takenAt: new Date().toISOString(), lat: 42.87, lon: 74.6 },
];

export { DEMO_PASSWORD };
