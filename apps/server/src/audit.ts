/**
 * Журнал аудита. ТЗ §12, критерий приёмки 11.
 *
 * Пишем автора, время, прежнее и новое значение. Записи только добавляются:
 * журнал, который можно поправить задним числом, не доказывает ничего.
 * Подпись автора сохраняем текстом — учётку могут переименовать или отключить,
 * а читать журнал придётся через годы.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';

export interface Actor {
  id: string;
  label: string;
  role: string;
}

export interface AuditRecord {
  entity: string;
  entityId: string;
  action: 'create' | 'update' | 'status' | 'delete';
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string;
}

function asText(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/** Одна запись. Вызывается внутри транзакции, когда важна атомарность. */
export function auditData(actor: Actor, record: AuditRecord): Prisma.AuditLogCreateInput {
  return {
    actorId: actor.id,
    actorLabel: actor.label,
    actorRole: actor.role,
    entity: record.entity,
    entityId: record.entityId,
    action: record.action,
    field: record.field,
    oldValue: asText(record.oldValue),
    newValue: asText(record.newValue),
    reason: record.reason,
  };
}

export async function audit(actor: Actor, record: AuditRecord) {
  return prisma.auditLog.create({ data: auditData(actor, record) });
}

/** Несколько полей одной сущности — по записи на поле, чтобы «что именно менялось» читалось. */
export async function auditChanges(
  actor: Actor,
  entity: string,
  entityId: string,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  reason?: string,
) {
  const rows = Object.keys(after)
    .filter((field) => asText(before[field]) !== asText(after[field]))
    .map((field) =>
      auditData(actor, {
        entity,
        entityId,
        action: field === 'status' ? 'status' : 'update',
        field,
        oldValue: before[field],
        newValue: after[field],
        reason,
      }),
    );
  if (rows.length === 0) return [];
  await prisma.auditLog.createMany({ data: rows as Prisma.AuditLogCreateManyInput[] });
  return rows;
}

/** Актор из запроса. */
export function actorOf(user: { id: string; role: string }, label?: string): Actor {
  return { id: user.id, label: label ?? user.id, role: user.role };
}

/**
 * Событие в outbox. Пишется в той же транзакции, что и сам переход,
 * поэтому уведомление не может «потеряться» из-за сбоя доставки. ТЗ §3.3.
 */
export function eventData(
  type: string,
  aggregate: string,
  aggregateId: string,
  payload: Record<string, unknown>,
): Prisma.DomainEventCreateInput {
  return { type, aggregate, aggregateId, payload: payload as Prisma.InputJsonValue };
}

export async function emit(
  type: string,
  aggregate: string,
  aggregateId: string,
  payload: Record<string, unknown>,
) {
  return prisma.domainEvent.create({ data: eventData(type, aggregate, aggregateId, payload) });
}
