/**
 * Область видимости по объектам.
 *
 * Роль определяет не только права, но и что человек вообще видит. Прораб работает
 * на своём объекте: чужой объект ему не показывают, даже если он подставит его id
 * в запрос. Полагаться на то, что «там всё равно пусто», нельзя — сегодня пусто,
 * завтра нет.
 */
import type { Role } from '@build-hub/shared';
import { prisma } from './db.js';

/** Роли, работающие по всей компании, а не по одному объекту. */
const COMPANY_WIDE: Role[] = ['dir', 'gi', 'pto', 'snab', 'tech'];

export function isCompanyWide(role: Role): boolean {
  return COMPANY_WIDE.includes(role);
}

/**
 * Какие объекты доступны пользователю.
 * `null` — ограничений нет (роль видит всю компанию).
 */
export async function allowedObjectIds(userId: string, role: Role): Promise<string[] | null> {
  if (isCompanyWide(role)) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { objectId: true },
  });
  return user?.objectId ? [user.objectId] : [];
}

/**
 * Приводит запрошенный objectId к области пользователя.
 * Возвращает `deny`, если объект запрошен явно и он вне области.
 */
export async function resolveObjectFilter(
  userId: string,
  role: Role,
  requestedObjectId?: string,
): Promise<{ deny: true } | { deny: false; where: { objectId?: string | { in: string[] } } }> {
  const allowed = await allowedObjectIds(userId, role);

  if (allowed === null) {
    return { deny: false, where: requestedObjectId ? { objectId: requestedObjectId } : {} };
  }

  if (requestedObjectId) {
    if (!allowed.includes(requestedObjectId)) return { deny: true };
    return { deny: false, where: { objectId: requestedObjectId } };
  }

  return { deny: false, where: { objectId: { in: allowed } } };
}
