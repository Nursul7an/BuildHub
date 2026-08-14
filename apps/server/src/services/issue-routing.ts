/**
 * Маршрутизация решений. ТЗ §2.
 *
 * «Технические, качественные вопросы и охрана труда — главному инженеру;
 * деньги сверх лимита, сроки контракта и отношения с заказчиком —
 * руководителю. Правило кодируется в таблице issue_routing, а не в клиенте.»
 *
 * Отсюда два следствия. Клиент не решает, кому нести вопрос: он говорит,
 * какого вопрос рода, а адресата называет сервер. И на другом объекте
 * маршрут меняется настройкой, а не выкаткой новой версии.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import type { Role } from '@build-hub/shared';

export const ISSUE_KINDS = [
  'technical',
  'quality',
  'safety',
  'money',
  'schedule',
  'customer',
  'staffing',
] as const;

export type IssueKind = (typeof ISSUE_KINDS)[number];

export const ISSUE_KIND_LABEL: Record<IssueKind, string> = {
  technical: 'Технический вопрос',
  quality: 'Качество',
  safety: 'Охрана труда',
  money: 'Деньги',
  schedule: 'Сроки по договору',
  customer: 'Отношения с заказчиком',
  staffing: 'Люди и ресурсы',
};

/**
 * Значения по умолчанию — прямо из §2. Живут в коде только как страховка
 * на пустой базе: рабочие правила читаются из таблицы.
 */
export const DEFAULT_ROUTING: {
  issueKind: IssueKind;
  toRole: Role;
  escalateAbove?: number;
  escalateToRole?: Role;
  source: string;
}[] = [
  { issueKind: 'technical', toRole: 'gi', source: 'ТЗ §2' },
  { issueKind: 'quality', toRole: 'gi', source: 'ТЗ §2' },
  { issueKind: 'safety', toRole: 'gi', source: 'ТЗ §2' },
  { issueKind: 'staffing', toRole: 'gi', source: 'ТЗ §2' },
  // Деньги: до порога решает главный инженер, выше — руководитель.
  { issueKind: 'money', toRole: 'gi', escalateAbove: 5_000_000, escalateToRole: 'dir', source: 'ТЗ §2' },
  { issueKind: 'schedule', toRole: 'dir', source: 'ТЗ §2' },
  { issueKind: 'customer', toRole: 'dir', source: 'ТЗ §2' },
];

export interface RoutingDecision {
  issueKind: IssueKind;
  /** Кто решает по факту, с учётом суммы вопроса. */
  toRole: Role;
  createsTask: boolean;
  /** Сработал ли порог эскалации. */
  escalated: boolean;
  escalateAbove: number | null;
  /** Роль, которая решала бы, будь сумма ниже порога. */
  wouldBeRole: Role | null;
  source: string | null;
  /** Откуда взято правило: настройка объекта, компании или значение по умолчанию. */
  origin: 'facility' | 'company' | 'default';
}

/**
 * Кому нести вопрос. Более узкая область побеждает: правило объекта
 * важнее общего по компании.
 */
export async function routeIssue(params: {
  issueKind: IssueKind;
  facilityId?: string | null;
  /** Цена вопроса — по ней срабатывает порог эскалации. */
  amount?: number | null;
}): Promise<RoutingDecision> {
  const rows = await prisma.issueRouting.findMany({
    where: {
      issueKind: params.issueKind,
      OR: [
        { scopeType: 'company', scopeId: '' },
        ...(params.facilityId ? [{ scopeType: 'facility', scopeId: params.facilityId }] : []),
      ],
    },
  });

  const facilityRule = rows.find((r) => r.scopeType === 'facility');
  const companyRule = rows.find((r) => r.scopeType === 'company');
  const rule = facilityRule ?? companyRule;

  if (!rule) {
    const fallback = DEFAULT_ROUTING.find((r) => r.issueKind === params.issueKind);
    if (!fallback) {
      // Неизвестный род вопроса безопаснее отдать главному инженеру,
      // чем потерять: он разберётся и передаст дальше.
      return {
        issueKind: params.issueKind,
        toRole: 'gi',
        createsTask: true,
        escalated: false,
        escalateAbove: null,
        wouldBeRole: null,
        source: null,
        origin: 'default',
      };
    }
    const escalated =
      fallback.escalateAbove !== undefined &&
      params.amount !== null &&
      params.amount !== undefined &&
      params.amount > fallback.escalateAbove;

    return {
      issueKind: params.issueKind,
      toRole: escalated ? fallback.escalateToRole! : fallback.toRole,
      createsTask: true,
      escalated,
      escalateAbove: fallback.escalateAbove ?? null,
      wouldBeRole: escalated ? fallback.toRole : null,
      source: fallback.source,
      origin: 'default',
    };
  }

  const threshold = rule.escalateAbove === null ? null : Number(rule.escalateAbove);
  const escalated =
    threshold !== null &&
    params.amount !== null &&
    params.amount !== undefined &&
    params.amount > threshold &&
    rule.escalateToRole !== null;

  return {
    issueKind: params.issueKind,
    toRole: (escalated ? rule.escalateToRole! : rule.toRole) as Role,
    createsTask: rule.createsTask,
    escalated,
    escalateAbove: threshold,
    wouldBeRole: escalated ? (rule.toRole as Role) : null,
    source: rule.source,
    origin: facilityRule ? 'facility' : 'company',
  };
}

/** Полная таблица маршрутов — экран настройки и проверка перед внедрением. */
export async function listRouting() {
  const rows = await prisma.issueRouting.findMany({
    orderBy: [{ issueKind: 'asc' }, { scopeType: 'asc' }],
  });
  return rows.map((r) => ({
    id: r.id,
    issueKind: r.issueKind,
    label: ISSUE_KIND_LABEL[r.issueKind as IssueKind] ?? r.issueKind,
    scopeType: r.scopeType,
    scopeId: r.scopeId === '' ? null : r.scopeId,
    toRole: r.toRole,
    createsTask: r.createsTask,
    escalateAbove: r.escalateAbove === null ? null : Number(r.escalateAbove),
    escalateToRole: r.escalateToRole,
    source: r.source,
  }));
}

export async function upsertRouting(params: {
  issueKind: IssueKind;
  scopeType: 'company' | 'facility';
  scopeId?: string | null;
  toRole: Role;
  createsTask?: boolean;
  escalateAbove?: number | null;
  escalateToRole?: Role | null;
  source?: string;
}) {
  const data = {
    issueKind: params.issueKind,
    scopeType: params.scopeType,
    scopeId: params.scopeId ?? '',
    toRole: params.toRole,
    createsTask: params.createsTask ?? true,
    escalateAbove:
      params.escalateAbove === null || params.escalateAbove === undefined
        ? null
        : new Prisma.Decimal(params.escalateAbove),
    escalateToRole: params.escalateToRole ?? null,
    source: params.source,
  };

  return prisma.issueRouting.upsert({
    where: {
      issueKind_scopeType_scopeId: {
        issueKind: params.issueKind,
        scopeType: params.scopeType,
        scopeId: params.scopeId ?? '',
      },
    },
    create: data,
    update: data,
  });
}
