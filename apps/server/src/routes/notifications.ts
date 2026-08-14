/**
 * Уведомления и инбоксы отделов (E1, блоки «Новое из отделов» / «Новое с площадки»).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseJson, prisma } from '../db.js';

export async function notificationRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/notifications', async (req) => {
    const query = z.object({ unread: z.enum(['0', '1']).optional() }).parse(req.query ?? {});
    const notifications = await prisma.notification.findMany({
      where: {
        OR: [{ toUserId: req.currentUser.id }, { toRole: req.currentUser.role, toUserId: null }],
        ...(query.unread === '1' ? { read: false } : {}),
      },
      orderBy: { at: 'desc' },
      take: 100,
    });
    return notifications.map((n) => ({
      id: n.id,
      kind: n.kind,
      title: n.title,
      subtitle: n.subtitle,
      at: n.at.toISOString(),
      read: n.read,
      link: parseJson<{ screen: string; params?: Record<string, string> } | null>(n.link, null),
    }));
  });

  /** Карточка снимается тапом — «прочитано» и есть действие. */
  app.post('/api/notifications/:id/read', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await prisma.notification.update({ where: { id }, data: { read: true } });
    return { ok: true };
  });

  app.post('/api/notifications/read-all', async (req) => {
    await prisma.notification.updateMany({
      where: { OR: [{ toUserId: req.currentUser.id }, { toRole: req.currentUser.role, toUserId: null }] },
      data: { read: true },
    });
    return { ok: true };
  });

  /** Счётчики для бейджей нижней навигации. */
  app.get('/api/badges', async (req) => {
    const role = req.currentUser.role;
    const [notifications, zayavki, reports, presentations] = await Promise.all([
      prisma.notification.count({
        where: {
          OR: [{ toUserId: req.currentUser.id }, { toRole: role, toUserId: null }],
          read: false,
        },
      }),
      prisma.zayavka.count({
        where:
          role === 'snab'
            ? { kind: 'material', status: { in: ['new', 'normalizing'] } }
            : role === 'tech'
              ? { kind: 'tech', status: { in: ['new', 'approved'] } }
              : { authorId: req.currentUser.id, status: { in: ['new', 'normalizing', 'inTransit'] } },
      }),
      role === 'pto'
        ? prisma.dailyReport.count({ where: { status: 'atPto' } })
        : role === 'prorab'
          ? prisma.dailyReport.count({ where: { status: 'atForeman' } })
          : Promise.resolve(0),
      role === 'pto'
        ? prisma.processState.count({ where: { status: 'presented' } })
        : Promise.resolve(0),
    ]);

    return { notifications, zayavki, reports, presentations };
  });
}
