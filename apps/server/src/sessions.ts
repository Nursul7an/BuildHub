/**
 * Сессии устройств. ТЗ §3.1: access 15 минут, refresh 30 дней.
 *
 * Короткий access означает, что отозванный доступ гаснет сам, без похода в базу
 * на каждый запрос. Refresh хранится хешем: база, попавшая в чужие руки,
 * не должна давать вход.
 *
 * Ротация с обнаружением повтора: refresh одноразовый, и предъявление уже
 * использованного токена трактуется как кража — вся цепочка сессии гасится.
 */
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from './db.js';

export const ACCESS_TTL = '15m';
export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 30;

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function newRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface DeviceInfo {
  deviceName?: string;
  deviceId?: string;
  ip?: string;
  userAgent?: string;
}

export interface IssuedSession {
  sessionId: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function createSession(userId: string, device: DeviceInfo): Promise<IssuedSession> {
  const refreshToken = newRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);

  const session = await prisma.session.create({
    data: {
      userId,
      refreshHash: hashToken(refreshToken),
      deviceName: device.deviceName?.slice(0, 120),
      deviceId: device.deviceId?.slice(0, 120),
      ip: device.ip?.slice(0, 64),
      userAgent: device.userAgent?.slice(0, 250),
      expiresAt,
    },
  });

  return { sessionId: session.id, refreshToken, expiresAt };
}

export type RefreshOutcome =
  | { ok: true; userId: string; session: IssuedSession }
  | { ok: false; code: 'unknown' | 'expired' | 'revoked' | 'reused' };

/**
 * Обмен refresh на новую пару. Старый токен гасится сразу же:
 * если его предъявят второй раз, это уже не клиент, а копия.
 */
export async function rotateSession(refreshToken: string, device: DeviceInfo): Promise<RefreshOutcome> {
  const hash = hashToken(refreshToken);
  const session = await prisma.session.findUnique({ where: { refreshHash: hash } });

  if (!session) return { ok: false, code: 'unknown' };

  if (session.revokedAt) {
    // Отозванный токен предъявлен снова — гасим всю цепочку устройства.
    await revokeChain(session.id, 'reuse_detected');
    return { ok: false, code: 'reused' };
  }

  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'expired' },
    });
    return { ok: false, code: 'expired' };
  }

  const next = newRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);

  const created = await prisma.$transaction(async (tx) => {
    await tx.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date(), revokedReason: 'rotated' },
    });
    return tx.session.create({
      data: {
        userId: session.userId,
        refreshHash: hashToken(next),
        deviceName: device.deviceName?.slice(0, 120) ?? session.deviceName,
        deviceId: device.deviceId?.slice(0, 120) ?? session.deviceId,
        ip: device.ip?.slice(0, 64) ?? session.ip,
        userAgent: device.userAgent?.slice(0, 250) ?? session.userAgent,
        expiresAt,
        rotatedFromId: session.id,
        lastSeenAt: new Date(),
      },
    });
  });

  return {
    ok: true,
    userId: session.userId,
    session: { sessionId: created.id, refreshToken: next, expiresAt },
  };
}

/** Гасит цепочку ротаций целиком — от найденной сессии вверх и вниз. */
async function revokeChain(sessionId: string, reason: string) {
  const seen = new Set<string>();
  let cursor: string | null = sessionId;

  // Вверх по цепочке: откуда эта сессия выросла.
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const current: { rotatedFromId: string | null } | null = await prisma.session.findUnique({
      where: { id: cursor },
      select: { rotatedFromId: true },
    });
    cursor = current?.rotatedFromId ?? null;
  }

  // Вниз: всё, что выросло из этих сессий.
  let frontier = [...seen];
  while (frontier.length > 0) {
    const children = await prisma.session.findMany({
      where: { rotatedFromId: { in: frontier } },
      select: { id: true },
    });
    frontier = children.map((c) => c.id).filter((id) => !seen.has(id));
    for (const id of frontier) seen.add(id);
  }

  // Условие только по id: `revokedReason != 'reuse_detected'` в SQL не совпадает
  // со строками, где причина NULL, — а это как раз действующая сессия,
  // ради которой цепочка и гасится.
  await prisma.session.updateMany({
    where: { id: { in: [...seen] } },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

/** Закрыть все сессии пользователя: смена пароля, сброс, блокировка. */
export async function revokeAllSessions(userId: string, reason: string) {
  return prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

export async function revokeSession(sessionId: string, reason = 'logout') {
  return prisma.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason },
  });
}

/** Активна ли сессия — проверяется при обновлении токена и в списке устройств. */
export async function isSessionActive(sessionId: string): Promise<boolean> {
  const session = await prisma.session.findUnique({ where: { id: sessionId } });
  if (!session) return false;
  return session.revokedAt === null && session.expiresAt.getTime() > Date.now();
}

export async function listSessions(userId: string) {
  const sessions = await prisma.session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: 'desc' },
  });
  return sessions.map((s) => ({
    id: s.id,
    deviceName: s.deviceName,
    ip: s.ip,
    createdAt: s.createdAt.toISOString(),
    lastSeenAt: s.lastSeenAt.toISOString(),
    expiresAt: s.expiresAt.toISOString(),
  }));
}
