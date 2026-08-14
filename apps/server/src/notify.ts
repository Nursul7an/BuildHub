import { prisma } from './db.js';
import type { Role } from '@build-hub/shared';

/**
 * Уведомление в отдел. В прототипе это блок «🔔 Новое из отделов» —
 * карточка снимается тапом, поэтому read хранится, а не выводится.
 */
export async function notify(
  toRole: Role,
  kind: string,
  title: string,
  subtitle: string,
  link?: { screen: string; params?: Record<string, string> },
  toUserId?: string,
) {
  return prisma.notification.create({
    data: {
      toRole,
      toUserId: toUserId ?? null,
      kind,
      title,
      subtitle,
      link: link ? JSON.stringify(link) : null,
    },
  });
}
