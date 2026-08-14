/**
 * Пороги как справочник. ТЗ §9, критерий приёмки 12.
 *
 * «Зашивание значений в код делает систему неприменимой на втором объекте» —
 * поэтому температурный порог, распалубочная прочность, срок извещения и лимиты
 * автономности читаются из базы, а не из констант. Область сужается:
 * компания → объект. Более узкая побеждает.
 *
 * Значения по умолчанию остаются в коде только как страховка на случай пустого
 * справочника: система обязана работать на новом стенде до первой настройки.
 */
import { prisma } from './db.js';

export type ThresholdKey =
  | 'winterTempC'
  | 'presentLeadWorkdays'
  | 'strippingStrengthPct'
  | 'autonomyLimit'
  | 'idleHourlyRate';

/** Значения по умолчанию — из СНиП и практики, ими же засевается справочник. */
export const FALLBACK: Record<ThresholdKey, number> = {
  /// Ниже +5 °C нужен зимний метод.
  winterTempC: 5,
  /// Извещение о освидетельствовании — не позднее чем за 3 рабочих дня.
  presentLeadWorkdays: 3,
  /// Распалубочная прочность в процентах от проектной.
  strippingStrengthPct: 70,
  /// Лимит автономности по умолчанию, млн сом.
  autonomyLimit: 1,
  /// Ставка простоя, сом за человеко-час.
  idleHourlyRate: 175,
};

export interface ThresholdLookup {
  key: ThresholdKey;
  facilityId?: string | null;
  processId?: string | null;
  roleKey?: string | null;
  /** На какую дату действовала норма. По умолчанию — сейчас. */
  at?: Date;
}

/**
 * Значение порога с учётом области и периода действия.
 * Порядок: процесс → объект → компания → запасное значение.
 */
export async function getThreshold(lookup: ThresholdLookup): Promise<number> {
  const at = lookup.at ?? new Date();

  const rows = await prisma.threshold.findMany({
    where: {
      key: lookup.key,
      ...(lookup.roleKey ? { roleKey: lookup.roleKey } : {}),
      validFrom: { lte: at },
      OR: [{ validTo: null }, { validTo: { gt: at } }],
    },
    orderBy: [{ validFrom: 'desc' }],
  });

  const byScope = (scopeType: string, scopeId?: string | null) =>
    rows.find((r) => r.scopeType === scopeType && (scopeId ? r.scopeId === scopeId : r.scopeId === null));

  const found =
    (lookup.processId ? byScope('process', lookup.processId) : undefined) ??
    (lookup.facilityId ? byScope('facility', lookup.facilityId) : undefined) ??
    byScope('company');

  return found ? Number(found.value) : FALLBACK[lookup.key];
}

/**
 * Новое значение порога. Прежнее не переписываем — закрываем периодом,
 * чтобы отчёт прошлого месяца читался по норме, что действовала тогда.
 */
export async function setThreshold(params: {
  key: ThresholdKey;
  scopeType: 'company' | 'facility' | 'process';
  scopeId?: string | null;
  roleKey?: string | null;
  value: number;
  unit?: string;
  source?: string;
  createdBy: string;
}) {
  const now = new Date();

  const current = await prisma.threshold.findFirst({
    where: {
      key: params.key,
      scopeType: params.scopeType,
      scopeId: params.scopeId ?? null,
      roleKey: params.roleKey ?? null,
      validTo: null,
    },
    orderBy: { validFrom: 'desc' },
  });

  return prisma.$transaction(async (tx) => {
    if (current) {
      await tx.threshold.update({ where: { id: current.id }, data: { validTo: now } });
    }
    return tx.threshold.create({
      data: {
        key: params.key,
        scopeType: params.scopeType,
        scopeId: params.scopeId ?? null,
        roleKey: params.roleKey ?? null,
        value: params.value,
        unit: params.unit,
        source: params.source,
        validFrom: now,
        version: (current?.version ?? 0) + 1,
        createdBy: params.createdBy,
      },
    });
  });
}

export async function listThresholds(key?: ThresholdKey) {
  const rows = await prisma.threshold.findMany({
    where: { ...(key ? { key } : {}), validTo: null },
    orderBy: [{ key: 'asc' }, { scopeType: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    scopeType: r.scopeType,
    scopeId: r.scopeId,
    roleKey: r.roleKey,
    value: Number(r.value),
    unit: r.unit,
    source: r.source,
    version: r.version,
    validFrom: r.validFrom.toISOString(),
  }));
}
