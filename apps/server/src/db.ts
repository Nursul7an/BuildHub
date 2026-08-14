import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

/** SQLite не хранит списки — они лежат JSON-строками. */
export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
