/**
 * Маршрутизация уведомлений. ТЗ §7.
 *
 * Таблица «событие → адресат → срочность» лежит здесь целиком. Смысл в том,
 * что новый адресат подключается правкой этой таблицы, а не бизнес-логики:
 * место, где меняется объём работ, не должно знать, кого об этом извещают.
 *
 * Адресат — роль в области, а не человек. Прораба на объекте заменят,
 * а адресация и история обязаны сохраниться.
 */
import type { Role } from '@build-hub/shared';

/** Кому уходит событие. */
export type Recipient =
  | { kind: 'role'; role: Role }
  /** Автор сущности — тот, кто отправил отчёт или заявку. */
  | { kind: 'author' }
  /** Ответственный за объект. */
  | { kind: 'facilityOwner' }
  /** Все, кто открывал этот лист проекта. */
  | { kind: 'sheetViewers' };

/**
 * Срочность.
 *  immediate — сразу;
 *  digest    — в дайджест до 20:00;
 *  morning   — утром (погодные события: чек-лист хранения);
 *  conditional — сразу при простое, иначе в дайджест.
 */
export type Urgency = 'immediate' | 'digest' | 'morning' | 'conditional';

export interface RouteRule {
  /** Тип доменного события. */
  type: string;
  recipients: Recipient[];
  urgency: Urgency;
  /**
   * Критическое событие. Настройки пользователя определяют канал,
   * но отключить такое событие нельзя (ТЗ §7).
   */
  critical?: boolean;
  /** Вид уведомления — по нему клиент выбирает иконку и экран. */
  kind: string;
  title: (payload: Record<string, any>) => string;
  subtitle: (payload: Record<string, any>) => string;
  link?: (payload: Record<string, any>) => { screen: string; params?: Record<string, string> };
}

const money = (value: unknown) =>
  typeof value === 'number' ? `${new Intl.NumberFormat('ru-RU').format(value)} сом` : '';

export const ROUTES: RouteRule[] = [
  {
    type: 'ReportSubmitted',
    recipients: [{ kind: 'role', role: 'pto' }],
    // Отчёты сдают вечером пачкой: дёргать ПТО на каждый — шум.
    urgency: 'digest',
    kind: 'report',
    title: () => '📤 Дневной отчёт',
    subtitle: (p) => `${p.authorName ?? 'Площадка'} · записей: ${p.entries ?? '—'}`,
    link: (p) => ({ screen: 'pto-queue', params: { reportId: String(p.reportId ?? '') } }),
  },
  {
    type: 'ReportSubmittedToForeman',
    recipients: [{ kind: 'role', role: 'prorab' }],
    urgency: 'immediate',
    kind: 'report',
    title: () => '📤 Отчёт мастера',
    subtitle: (p) => `${p.authorName ?? 'Мастер'} · ждёт вашего подтверждения`,
  },
  {
    type: 'ReportReturned',
    recipients: [{ kind: 'author' }],
    urgency: 'immediate',
    kind: 'report',
    title: () => '↩ Отчёт возвращён ПТО',
    subtitle: (p) => p.reason ?? 'Проверьте данные',
  },
  {
    type: 'ReportAccepted',
    recipients: [{ kind: 'author' }],
    urgency: 'immediate',
    kind: 'report',
    title: () => '✓ Отчёт подтверждён ПТО',
    subtitle: () => 'Данные ушли руководству',
  },
  {
    type: 'ReportAdjusted',
    recipients: [{ kind: 'author' }],
    urgency: 'immediate',
    kind: 'report',
    title: () => '✎ ПТО скорректировал отчёт',
    subtitle: (p) => `${p.from} → ${p.to} · «${p.reason ?? ''}»`,
  },
  {
    type: 'RequestCreated',
    recipients: [{ kind: 'role', role: 'snab' }],
    // Сразу, если люди стоят; иначе в дайджест.
    urgency: 'conditional',
    kind: 'zayavka',
    title: (p) => `📦 Заявка ${p.number ?? ''}`,
    subtitle: (p) =>
      `${p.what ?? ''}${p.idleCost ? ` · простой ≈ ${money(p.idleCost)}` : ''}`,
    link: (p) => ({ screen: 'zayavka', params: { id: String(p.zayavkaId ?? '') } }),
  },
  {
    type: 'RequestNeedsForeman',
    recipients: [{ kind: 'role', role: 'prorab' }],
    urgency: 'immediate',
    kind: 'zayavka',
    title: (p) => `📦 Заявка ${p.number ?? ''} на согласование`,
    subtitle: (p) => String(p.what ?? ''),
  },
  {
    type: 'RequestStatusChanged',
    recipients: [{ kind: 'author' }],
    urgency: 'immediate',
    kind: 'zayavka',
    title: (p) => `📦 ${p.number ?? 'Заявка'}`,
    subtitle: (p) => p.note ?? `Статус: ${p.status ?? ''}`,
  },
  {
    type: 'RequestNudged',
    recipients: [{ kind: 'role', role: 'snab' }],
    urgency: 'immediate',
    kind: 'zayavka',
    title: (p) => `⏰ Напоминание по ${p.number ?? 'заявке'}`,
    subtitle: (p) => `${p.what ?? ''}${p.idleCost ? ` · простой ≈ ${money(p.idleCost)}` : ''}`,
  },
  {
    type: 'MaterialWithoutPassport',
    // Партия без паспорта останавливает работы — знать должны все трое.
    recipients: [
      { kind: 'role', role: 'pto' },
      { kind: 'role', role: 'snab' },
      { kind: 'role', role: 'gi' },
    ],
    urgency: 'immediate',
    critical: true,
    kind: 'noPassport',
    title: () => '🔴 Материал без паспорта · партия помечена',
    subtitle: (p) => `${p.number ?? ''} · работы с этой партией приостановлены`,
  },
  {
    type: 'InspectionRequested',
    recipients: [
      { kind: 'role', role: 'pto' },
      { kind: 'role', role: 'gi' },
    ],
    urgency: 'immediate',
    kind: 'presentation',
    title: () => '🔔 Предъявлено к освидетельствованию',
    subtitle: (p) => `${p.process ?? ''} · извещение технадзору за 3 раб. дня`,
  },
  {
    type: 'SheetSuperseded',
    // Именно те, кто открывал лист: они могли уйти работать по старой версии.
    recipients: [{ kind: 'sheetViewers' }],
    urgency: 'immediate',
    critical: true,
    kind: 'document',
    title: (p) => `📐 Лист ${p.number ?? ''} заменён`,
    subtitle: (p) => `Действует ${p.newRevision ?? 'новая версия'} · старая недействительна`,
    link: (p) => ({ screen: 'sheet', params: { id: String(p.sheetId ?? '') } }),
  },
  {
    type: 'IdleReported',
    recipients: [
      { kind: 'role', role: 'gi' },
      { kind: 'role', role: 'dir' },
    ],
    urgency: 'immediate',
    critical: true,
    kind: 'idle',
    title: (p) => `🔴 Простой · ${p.workers ?? ''} чел`,
    subtitle: (p) => `${p.process ?? ''} · ≈ ${money(p.cost)}`,
  },
  {
    type: 'SafetyViolation',
    recipients: [
      { kind: 'role', role: 'gi' },
      { kind: 'role', role: 'dir' },
    ],
    urgency: 'immediate',
    critical: true,
    kind: 'safety',
    title: () => '⚫ Нарушение охраны труда',
    subtitle: (p) => `${p.detail ?? ''} · ${p.location ?? ''}`,
  },
  {
    type: 'PrescriptionIssued',
    recipients: [{ kind: 'role', role: 'gi' }],
    urgency: 'immediate',
    kind: 'prescription',
    title: (p) => `🔔 Предписание ${p.number ?? ''} · ${p.contractor ?? ''}`,
    subtitle: (p) => `${p.text ?? ''} · срок ${p.dueDays ?? '—'} дн.`,
  },
  {
    type: 'ViolationReportedByMaster',
    recipients: [{ kind: 'role', role: 'prorab' }],
    urgency: 'immediate',
    kind: 'prescription',
    title: () => '🔔 Нарушение от мастера',
    subtitle: (p) => `${p.contractor ?? ''} · ${p.location ?? ''} · предписание выдаёте вы`,
  },
  {
    type: 'LimitExceeded',
    // Решение выше лимита автономности — сразу и с ценой вопроса.
    recipients: [{ kind: 'role', role: 'dir' }],
    urgency: 'immediate',
    critical: true,
    kind: 'task',
    title: () => '💰 Решение выше лимита автономности',
    subtitle: (p) => `${p.what ?? ''} · ${p.amount ?? ''} млн сом`,
  },
  {
    type: 'OverspendDetected',
    recipients: [{ kind: 'role', role: 'gi' }],
    urgency: 'digest',
    kind: 'zayavka',
    title: (p) => `🟠 Перерасход по ВОР +${p.pct ?? ''}%`,
    subtitle: (p) => `${p.material ?? ''} · причина: ${p.reason ?? 'не указана'}`,
  },
  {
    type: 'StrengthProtocolReady',
    recipients: [
      { kind: 'role', role: 'prorab' },
      { kind: 'role', role: 'pto' },
    ],
    urgency: 'immediate',
    kind: 'document',
    title: () => '✅ Протокол прочности получен',
    subtitle: (p) => `${p.strengthPct ?? ''}% из ${p.requiredPct ?? ''}% · распалубка разблокирована`,
  },
  {
    type: 'AosrSigned',
    recipients: [{ kind: 'role', role: 'prorab' }],
    urgency: 'immediate',
    kind: 'document',
    title: (p) => `✅ АОСР ${p.number ?? ''} подписан`,
    subtitle: () => 'Следующий процесс разблокирован',
  },
  {
    type: 'GateReleased',
    recipients: [
      { kind: 'role', role: 'pto' },
      { kind: 'role', role: 'prorab' },
    ],
    urgency: 'immediate',
    critical: true,
    kind: 'document',
    title: () => '🔓 Блокировка снята главным инженером',
    subtitle: (p) => `${p.process ?? ''} · обоснование: ${p.justification ?? ''}`,
  },
  {
    type: 'SyncConflict',
    recipients: [{ kind: 'role', role: 'pto' }],
    urgency: 'immediate',
    kind: 'report',
    title: () => '⚠️ Расхождение при синхронизации',
    subtitle: (p) => String(p.note ?? 'Операция с устройства разошлась с данными на сервере'),
  },
  {
    type: 'TaskAssigned',
    recipients: [{ kind: 'author' }],
    urgency: 'immediate',
    kind: 'task',
    title: () => '🗓 Новая задача',
    subtitle: (p) => `${p.text ?? ''} · срок ${p.dueDate ?? ''}`,
  },
  {
    type: 'PrecipitationExpected',
    recipients: [{ kind: 'role', role: 'sklad' }],
    // Утром: чек-лист хранения нужен до начала смены, а не ночью.
    urgency: 'morning',
    kind: 'task',
    title: () => '🌧 Ожидаются осадки',
    subtitle: (p) => `${p.facility ?? ''} · проверьте хранение материалов`,
  },
];

const BY_TYPE = new Map(ROUTES.map((r) => [r.type, r]));

export function routeFor(type: string): RouteRule | undefined {
  return BY_TYPE.get(type);
}

/** Событие критическое — доставляется независимо от настроек пользователя. */
export function isCritical(type: string): boolean {
  return routeFor(type)?.critical === true;
}
