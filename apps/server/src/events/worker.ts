/**
 * Разбор outbox. ТЗ §3.3.
 *
 * Переход статуса пишет событие в domain_events в той же транзакции, что и само
 * изменение. Воркер разбирает таблицу и создаёт записи инбоксов. Отсюда три
 * следствия, ради которых это и делается:
 *
 *  — уведомление не теряется при сбое доставки: событие лежит в базе, пока
 *    не разобрано, и переживает перезапуск;
 *  — история действий восстановима: события не удаляются после отправки;
 *  — новый адресат подключается правкой таблицы маршрутизации, а не бизнес-логики.
 */
import { prisma } from '../db.js';
import { type RouteRule, type Urgency, routeFor } from './routing.js';

/** Сколько раз пробуем разобрать событие, прежде чем отложить его в сторону. */
export const MAX_ATTEMPTS = 5;

/** До какого часа копится дайджест (часовой пояс объекта, ТЗ §7). */
export const DIGEST_HOUR = 20;

export interface DrainResult {
  processed: number;
  delivered: number;
  deferred: number;
  failed: number;
}

interface Target {
  toRole: string;
  toUserId: string | null;
}

/** Кому именно уходит событие: роль в области, автор или те, кто открывал лист. */
async function resolveTargets(rule: RouteRule, payload: Record<string, any>): Promise<Target[]> {
  const targets: Target[] = [];

  for (const recipient of rule.recipients) {
    if (recipient.kind === 'role') {
      targets.push({ toRole: recipient.role, toUserId: null });
      continue;
    }

    if (recipient.kind === 'author') {
      const authorId = payload.authorId ?? payload.assigneeId ?? payload.userId;
      if (!authorId) continue;
      const author = await prisma.user.findUnique({ where: { id: String(authorId) } });
      if (author) targets.push({ toRole: author.role, toUserId: author.id });
      continue;
    }

    if (recipient.kind === 'facilityOwner') {
      if (!payload.facilityId) continue;
      const facility = await prisma.constructionObject.findUnique({
        where: { id: String(payload.facilityId) },
        include: { responsible: true },
      });
      if (facility?.responsible) {
        targets.push({ toRole: facility.responsible.role, toUserId: facility.responsible.id });
      }
      continue;
    }

    if (recipient.kind === 'sheetViewers') {
      if (!payload.sheetId) continue;
      const views = await prisma.sheetView.findMany({
        where: { sheetId: String(payload.sheetId) },
        include: { user: true },
      });
      for (const view of views) {
        targets.push({ toRole: view.user.role, toUserId: view.user.id });
      }
    }
  }

  // Один человек не должен получить одно событие дважды.
  const seen = new Set<string>();
  return targets.filter((t) => {
    const key = `${t.toRole}:${t.toUserId ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Когда доставлять. Дайджест копится до 20:00, утренние — до начала смены.
 * «Сразу при простое, иначе дайджест» решается по самому событию: если у него
 * есть цена простоя, значит люди стоят.
 */
function deliverAt(urgency: Urgency, payload: Record<string, any>, now: Date): Date | null {
  if (urgency === 'immediate') return null;

  if (urgency === 'conditional') {
    const urgent = Boolean(payload.idleCost) || payload.priority === 'urgent';
    if (urgent) return null;
  }

  const at = new Date(now);
  if (urgency === 'morning') {
    at.setHours(7, 0, 0, 0);
    if (at <= now) at.setDate(at.getDate() + 1);
    return at;
  }

  at.setHours(DIGEST_HOUR, 0, 0, 0);
  if (at <= now) at.setDate(at.getDate() + 1);
  return at;
}

/**
 * Разбор пачки событий. Возвращает статистику — её же печатает планировщик.
 * Вызывается и по расписанию, и вручную из тестов: детерминированность важнее удобства.
 */
export async function drainOutbox(options: { batchSize?: number; now?: Date } = {}): Promise<DrainResult> {
  const now = options.now ?? new Date();
  const batchSize = options.batchSize ?? 100;

  const events = await prisma.domainEvent.findMany({
    where: { publishedAt: null, attempts: { lt: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  });

  const result: DrainResult = { processed: 0, delivered: 0, deferred: 0, failed: 0 };

  for (const event of events) {
    result.processed += 1;
    const payload = (event.payload ?? {}) as Record<string, any>;

    try {
      const rule = routeFor(event.type);

      if (!rule) {
        // Событие без маршрута — не ошибка: его пишут ради истории и аудита.
        await prisma.domainEvent.update({
          where: { id: event.id },
          data: { publishedAt: now },
        });
        continue;
      }

      const targets = await resolveTargets(rule, payload);
      const scheduledFor = deliverAt(rule.urgency, payload, now);
      const link = rule.link ? JSON.stringify(rule.link(payload)) : null;

      for (const target of targets) {
        // Настройки определяют канал, но критическое событие отключить нельзя.
        if (target.toUserId && !rule.critical) {
          const setting = await prisma.notificationSetting.findUnique({
            where: { userId_eventType: { userId: target.toUserId, eventType: event.type } },
          });
          if (setting?.channel === 'off') continue;
        }

        await prisma.notification.create({
          data: {
            toRole: target.toRole,
            toUserId: target.toUserId,
            kind: rule.kind,
            title: rule.title(payload),
            subtitle: rule.subtitle(payload),
            // Отложенные лежат непрочитанными до своего часа; время доставки — в at.
            at: scheduledFor ?? now,
            link,
          },
        });
      }

      await prisma.domainEvent.update({
        where: { id: event.id },
        data: { publishedAt: now },
      });

      if (scheduledFor) result.deferred += 1;
      else result.delivered += 1;
    } catch (error) {
      // Событие не теряется: счётчик попыток растёт, причина сохраняется.
      const attempts = event.attempts + 1;
      await prisma.domainEvent.update({
        where: { id: event.id },
        data: {
          attempts,
          lastError: error instanceof Error ? error.message.slice(0, 500) : String(error),
        },
      });
      result.failed += 1;
    }
  }

  return result;
}

/** События, которые воркер отложил после исчерпания попыток. */
export async function poisonedEvents() {
  return prisma.domainEvent.findMany({
    where: { publishedAt: null, attempts: { gte: MAX_ATTEMPTS } },
    orderBy: { createdAt: 'asc' },
  });
}

let timer: NodeJS.Timeout | null = null;

/** Периодический разбор. В проде это BullMQ (ТЗ §3.1); здесь — тот же контракт. */
export function startOutboxWorker(intervalMs = 5000, log?: (r: DrainResult) => void) {
  if (timer) return;
  timer = setInterval(() => {
    void drainOutbox()
      .then((r) => {
        if (log && r.processed > 0) log(r);
      })
      .catch(() => undefined);
  }, intervalMs);
  timer.unref?.();
}

export function stopOutboxWorker() {
  if (timer) clearInterval(timer);
  timer = null;
}
