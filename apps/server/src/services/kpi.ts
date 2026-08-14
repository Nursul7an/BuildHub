/**
 * KPI отделов. ТЗ §6 и §9.
 *
 * Два правила определяют здесь всё.
 *
 * Первое: показатель считается из данных системы. Цифра, которую нельзя
 * проследить до записей, на планёрке превращается в спор о цифре, а не
 * о работе — поэтому каждый показатель отдаёт числитель, знаменатель
 * и период, по которым его можно пересчитать вручную.
 *
 * Второе, из §9: «первый квартал — только измерение». Пока идёт этот
 * период, вердикт не выносится. Метрику сначала проверяют на своих
 * данных, и лишь потом по ней судят людей.
 */
import { prisma } from '../db.js';

export type Department = 'field' | 'pto' | 'mat' | 'tech';

export const DEPARTMENTS: Department[] = ['field', 'pto', 'mat', 'tech'];

export const DEPARTMENT_LABEL: Record<Department, string> = {
  field: 'Площадка',
  pto: 'ПТО',
  mat: 'Материалы',
  tech: 'Техника',
};

/** Вердикт по показателю. `measuring` — период измерения, цвет не выносится. */
export type MetricState = 'good' | 'warn' | 'bad' | 'measuring' | 'no_data';

export interface Metric {
  key: string;
  department: Department;
  label: string;
  unit: string;
  /** null — данных не хватает; показывать ноль было бы враньём. */
  value: number | null;
  state: MetricState;
  goodAbove: number | null;
  goodBelow: number | null;
  /** Слагаемые, по которым показатель пересчитывается вручную. */
  basis: { numerator: number; denominator: number; note: string } | null;
  /** Почему вердикта нет. */
  note: string | null;
  measuringUntil: string | null;
  source: string | null;
}

/** Пороги по умолчанию — засеваются в справочник и дальше живут в нём. */
export const DEFAULT_TARGETS: {
  key: string;
  department: Department;
  label: string;
  unit: string;
  goodAbove?: number;
  goodBelow?: number;
  source: string;
}[] = [
  { key: 'reportsOnTime', department: 'field', label: 'Отчёты в срок', unit: '%', goodAbove: 90, source: 'регламент отчётности' },
  { key: 'reportReturns', department: 'field', label: 'Возвраты отчётов', unit: '%', goodBelow: 10, source: 'регламент отчётности' },
  { key: 'idleHours', department: 'field', label: 'Простои', unit: 'ч/мес', goodBelow: 20, source: 'приказ по производству' },
  { key: 'checkLatency', department: 'pto', label: 'Проверка отчёта', unit: 'ч', goodBelow: 16, source: 'регламент ПТО' },
  { key: 'aosrReady', department: 'pto', label: 'Готовность исполнительной', unit: '%', goodAbove: 80, source: 'СНиП КР 12-02' },
  { key: 'inspectionsOnTime', department: 'pto', label: 'Освидетельствования в срок', unit: '%', goodAbove: 85, source: 'регламент ПТО' },
  { key: 'leadTime', department: 'mat', label: 'Заявка → поставка', unit: 'дн', goodBelow: 5, source: 'договоры поставки' },
  { key: 'staleRequests', department: 'mat', label: 'Заявки без движения', unit: '%', goodBelow: 10, source: 'регламент снабжения' },
  { key: 'noPassport', department: 'mat', label: 'Приёмки без паспорта', unit: 'шт', goodBelow: 1, source: 'входной контроль' },
  { key: 'techUtilization', department: 'tech', label: 'Использование техники', unit: '%', goodAbove: 75, source: 'приказ по механизации' },
  { key: 'techDowntime', department: 'tech', label: 'Простой техники', unit: 'ч/мес', goodBelow: 12, source: 'приказ по механизации' },
];

/** Минимум наблюдений, ниже которого показатель ничего не значит. */
const MIN_OBSERVATIONS = 3;

function pct(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : Number(((numerator / denominator) * 100).toFixed(1));
}

/**
 * Вердикт. Жёлтая зона — десятая часть от порога: резкая граница между
 * «хорошо» и «плохо» провоцирует подгонку под цифру.
 */
function verdict(
  value: number,
  goodAbove: number | null,
  goodBelow: number | null,
): MetricState {
  if (goodAbove !== null) {
    if (value >= goodAbove) return 'good';
    return value >= goodAbove * 0.9 ? 'warn' : 'bad';
  }
  if (goodBelow !== null) {
    if (value <= goodBelow) return 'good';
    return value <= goodBelow * 1.5 ? 'warn' : 'bad';
  }
  return 'measuring';
}

interface Computed {
  value: number | null;
  basis: { numerator: number; denominator: number; note: string } | null;
  note: string | null;
}

const NO_DATA = (note: string): Computed => ({ value: null, basis: null, note });

/** Окно наблюдения — календарный месяц назад от сегодняшнего дня. */
function monthAgo(now: Date): Date {
  const from = new Date(now);
  from.setMonth(from.getMonth() - 1);
  return from;
}

async function computeMetric(key: string, from: Date, now: Date, objectId?: string): Promise<Computed> {
  const scope = objectId ? { objectId } : {};

  switch (key) {
    /* ── Площадка ── */
    case 'reportsOnTime': {
      // Отчёт считается сданным в срок, если ушёл до 20:00 своего дня.
      const reports = await prisma.dailyReport.findMany({
        where: { ...scope, submittedAt: { not: null, gte: from } },
      });
      if (reports.length < MIN_OBSERVATIONS) {
        return NO_DATA(`Отчётов за период: ${reports.length}, нужно не меньше ${MIN_OBSERVATIONS}`);
      }
      const onTime = reports.filter((r) => {
        const deadline = new Date(r.date);
        deadline.setHours(20, 0, 0, 0);
        return r.submittedAt! <= deadline;
      }).length;
      return {
        value: pct(onTime, reports.length),
        basis: { numerator: onTime, denominator: reports.length, note: 'отправлено до 20:00 своего дня' },
        note: null,
      };
    }

    case 'reportReturns': {
      const reports = await prisma.dailyReport.findMany({
        where: { ...scope, submittedAt: { not: null, gte: from } },
        include: { checks: true },
      });
      if (reports.length < MIN_OBSERVATIONS) {
        return NO_DATA(`Отчётов за период: ${reports.length}`);
      }
      const returned = reports.filter((r) => r.checks.some((c) => c.decision === 'return')).length;
      return {
        value: pct(returned, reports.length),
        basis: { numerator: returned, denominator: reports.length, note: 'отчёты, возвращённые ПТО' },
        note: null,
      };
    }

    case 'idleHours': {
      const comments = await prisma.processComment.findMany({
        where: { kind: 'problem', idleSince: { not: null }, createdAt: { gte: from } },
      });
      if (comments.length === 0) {
        return { value: 0, basis: { numerator: 0, denominator: 0, note: 'простоев не зафиксировано' }, note: null };
      }
      // Час простоя на человека — то, что реально стоит денег.
      const hours = comments.reduce((sum, c) => {
        const span = (c.createdAt.getTime() - c.idleSince!.getTime()) / 3_600_000;
        return sum + Math.max(0, span) * (c.idleWorkers ?? 1);
      }, 0);
      return {
        value: Number(hours.toFixed(1)),
        basis: { numerator: comments.length, denominator: 1, note: 'человеко-часы простоя по зафиксированным случаям' },
        note: null,
      };
    }

    /* ── ПТО ── */
    case 'checkLatency': {
      const checks = await prisma.reportCheck.findMany({
        where: { createdAt: { gte: from } },
        include: { report: true },
      });
      const measured = checks.filter((c) => c.report.submittedAt !== null);
      if (measured.length < MIN_OBSERVATIONS) {
        return NO_DATA(`Проверок за период: ${measured.length}`);
      }
      const hours =
        measured.reduce(
          (sum, c) => sum + (c.createdAt.getTime() - c.report.submittedAt!.getTime()) / 3_600_000,
          0,
        ) / measured.length;
      return {
        value: Number(hours.toFixed(1)),
        basis: { numerator: measured.length, denominator: 1, note: 'среднее от отправки до решения ПТО' },
        note: null,
      };
    }

    case 'aosrReady': {
      // Процессы, требующие АОСР и уже завершённые: у скольких есть подписанный акт.
      const states = await prisma.processState.findMany({
        where: { ...scope, status: { in: ['presented', 'accepted'] }, processDef: { requiresAosr: true } },
        include: { documents: true },
      });
      if (states.length < MIN_OBSERVATIONS) {
        return NO_DATA(`Процессов с АОСР: ${states.length}`);
      }
      const withSigned = states.filter(
        (s) => s.aosrNumber !== null || s.documents.some((d) => d.kind === 'aosr' && d.status === 'signed'),
      ).length;
      return {
        value: pct(withSigned, states.length),
        basis: { numerator: withSigned, denominator: states.length, note: 'процессы с подписанным АОСР' },
        note: null,
      };
    }

    case 'inspectionsOnTime': {
      const presentations = await prisma.presentation.findMany({
        where: { createdAt: { gte: from } },
      });
      if (presentations.length < MIN_OBSERVATIONS) {
        return NO_DATA(`Предъявлений за период: ${presentations.length}`);
      }
      const onTime = presentations.filter((p) => p.status !== 'pending' || p.scheduledFor >= now).length;
      return {
        value: pct(onTime, presentations.length),
        basis: { numerator: onTime, denominator: presentations.length, note: 'осмотр состоялся или срок не наступил' },
        note: null,
      };
    }

    /* ── Материалы ── */
    case 'leadTime': {
      const acceptances = await prisma.materialAcceptance.findMany({
        where: { at: { gte: from } },
        include: { zayavka: true },
      });
      if (acceptances.length < MIN_OBSERVATIONS) {
        return NO_DATA(`Приёмок за период: ${acceptances.length}`);
      }
      const days =
        acceptances.reduce(
          (sum, a) => sum + (a.at.getTime() - a.zayavka.createdAt.getTime()) / 86_400_000,
          0,
        ) / acceptances.length;
      return {
        value: Number(days.toFixed(1)),
        basis: { numerator: acceptances.length, denominator: 1, note: 'среднее от заявки до приёмки' },
        note: null,
      };
    }

    case 'staleRequests': {
      const open = await prisma.zayavka.findMany({
        where: { ...scope, kind: 'material', status: { in: ['new', 'normalizing', 'approved'] } },
      });
      if (open.length === 0) {
        return { value: 0, basis: { numerator: 0, denominator: 0, note: 'открытых заявок нет' }, note: null };
      }
      const stale = open.filter((z) => now.getTime() - z.createdAt.getTime() > 2 * 86_400_000).length;
      return {
        value: pct(stale, open.length),
        basis: { numerator: stale, denominator: open.length, note: 'открытые заявки старше двух дней' },
        note: null,
      };
    }

    case 'noPassport': {
      const count = await prisma.materialAcceptance.count({
        where: { passportOk: false, at: { gte: from } },
      });
      return {
        value: count,
        basis: { numerator: count, denominator: 1, note: 'приёмки, помеченные без паспорта' },
        note: null,
      };
    }

    /* ── Техника ── */
    case 'techUtilization': {
      const reports = await prisma.techReport.findMany({ where: { createdAt: { gte: from } } });
      if (reports.length < MIN_OBSERVATIONS) {
        return NO_DATA(`Отчётов по технике: ${reports.length}`);
      }
      const planned = reports.reduce((s, r) => s + r.hoursPlanned, 0);
      const actual = reports.reduce((s, r) => s + r.hoursActual, 0);
      if (planned === 0) return NO_DATA('Плановые часы не заданы');
      return {
        value: pct(actual, planned),
        basis: { numerator: actual, denominator: planned, note: 'фактические часы к плановым' },
        note: null,
      };
    }

    case 'techDowntime': {
      const reports = await prisma.techReport.findMany({ where: { createdAt: { gte: from } } });
      if (reports.length === 0) {
        return NO_DATA('Отчётов по технике за период нет');
      }
      const idle = reports.reduce((s, r) => s + r.idleHours, 0);
      return {
        value: Number(idle.toFixed(1)),
        basis: { numerator: idle, denominator: reports.length, note: 'часы простоя по отчётам смен' },
        note: null,
      };
    }

    default:
      return NO_DATA('Показатель не реализован');
  }
}

export interface DepartmentKpi {
  key: Department;
  label: string;
  metrics: Metric[];
}

export async function computeKpi(options: {
  department?: Department;
  objectId?: string;
  now?: Date;
} = {}): Promise<{ departments: DepartmentKpi[]; period: { from: string; to: string }; measuring: boolean }> {
  const now = options.now ?? new Date();
  const from = monthAgo(now);

  const targets = await prisma.kpiTarget.findMany({
    where: {
      ...(options.department ? { department: options.department } : {}),
      OR: [
        { scopeType: 'company', scopeId: '' },
        ...(options.objectId ? [{ scopeType: 'facility', scopeId: options.objectId }] : []),
      ],
    },
  });

  // Правило объекта важнее общего по компании.
  const byKey = new Map<string, (typeof targets)[number]>();
  for (const t of targets) {
    const existing = byKey.get(t.key);
    if (!existing || t.scopeType === 'facility') byKey.set(t.key, t);
  }

  const metrics: Metric[] = [];

  for (const target of byKey.values()) {
    const computed = await computeMetric(target.key, from, now, options.objectId);
    const goodAbove = target.goodAbove === null ? null : Number(target.goodAbove);
    const goodBelow = target.goodBelow === null ? null : Number(target.goodBelow);

    // §9: пока идёт период измерения, вердикт не выносится.
    const measuring = target.measuringUntil !== null && target.measuringUntil > now;

    const state: MetricState =
      computed.value === null
        ? 'no_data'
        : measuring
          ? 'measuring'
          : verdict(computed.value, goodAbove, goodBelow);

    metrics.push({
      key: target.key,
      department: target.department as Department,
      label: target.label,
      unit: target.unit,
      value: computed.value,
      state,
      goodAbove,
      goodBelow,
      basis: computed.basis,
      note:
        computed.note ??
        (measuring ? 'Период измерения: показатель считается, вердикт не выносится' : null),
      measuringUntil: target.measuringUntil?.toISOString() ?? null,
      source: target.source,
    });
  }

  const departments = DEPARTMENTS.filter((d) => !options.department || d === options.department).map(
    (d) => ({
      key: d,
      label: DEPARTMENT_LABEL[d],
      metrics: metrics.filter((m) => m.department === d),
    }),
  );

  return {
    departments: departments.filter((d) => d.metrics.length > 0),
    period: { from: from.toISOString(), to: now.toISOString() },
    /** Хотя бы один показатель ещё в периоде измерения. */
    measuring: metrics.some((m) => m.state === 'measuring'),
  };
}
