import type { Role } from './roles.js';

/* ────────────────────────────── Объекты и иерархия ───────────────────────────── */

export interface ConstructionObject {
  id: string;
  name: string; // ЖК «Ак-Орго»
  address: string;
  city: string;
  blocks: Block[];
  floorsTotal: number;
  dueDate: string; // ISO
  status: 'active' | 'paused' | 'done';
  responsibleUserId: string | null;
}

export interface Block {
  id: string;
  objectId: string;
  name: string; // Блок Б
  floors: number;
}

/**
 * Раздел работ. Один из восьми: Монолит, Кладка, Штукатурка, Стяжка,
 * Сантехника, Электрика, Вентиляция, Фасад, Крыша.
 */
export interface SectionDef {
  id: string;
  name: string;
  /** Условие входа в раздел, показывается вверху цепочки. */
  entryCondition?: string;
}

/* ────────────────────────────── Цепочка процессов ────────────────────────────── */

/**
 * Пять статусов процесса — визуальный код задан в ТЗ (A3):
 * не начат / в работе / предъявлен / принят / заблокирован.
 */
export type ProcessStatus = 'idle' | 'active' | 'presented' | 'accepted' | 'blocked';

export const PROCESS_STATUS_LABEL: Record<ProcessStatus, string> = {
  idle: 'не начат',
  active: 'в работе',
  presented: 'предъявлен к освидетельствованию',
  accepted: 'принят',
  blocked: 'заблокирован',
};

export type Unit = 'т' | 'кг' | 'м³' | 'м²' | 'пог. м' | 'шт' | 'точки' | 'партия' | 'сут' | '—';

export interface ProcessDef {
  id: string;
  sectionId: string;
  /** Порядковый номер в цепочке, с 1. */
  order: number;
  name: string;
  unit: Unit;
  /** Требуется АОСР по завершении — «замок» в интерфейсе. */
  requiresAosr: boolean;
  /** Подцикл: у монолита «Колонны и стены» / «Перекрытие». */
  subcycle?: string;
  /** Помечает процесс, отступление от которого несёт риск (⚠️ в названии). */
  critical?: boolean;
}

export interface ProcessState {
  id: string;
  processDefId: string;
  objectId: string;
  blockId: string;
  floor: number;
  status: ProcessStatus;
  planQty: number;
  doneQty: number;
  /** Причина блокировки — обязана быть видна в строке, а не в диалоге. */
  blockedReason?: string;
  /** Срок по графику, ISO. */
  dueDate?: string;
  /** Для предъявленных: дата предъявления и сколько дней ждём технадзор. */
  presentedAt?: string;
  presentedDay?: number;
  presentedOfDays?: number;
  /** Для принятых: номер и дата акта. */
  aosrNumber?: string;
  acceptedAt?: string;
  assigneeUserId?: string | null;
}

/* ────────────────────────────── Дневной отчёт ────────────────────────────── */

export type ReportStatus =
  | 'draft'
  | 'submitted' // отправлен, «не подтверждён»
  | 'atForeman' // отчёт мастера ждёт прораба
  | 'atPto'
  | 'adjusted' // ПТО скорректировал
  | 'returned'
  | 'accepted';

export interface ReportEntry {
  id: string;
  processStateId: string;
  volume: number;
  unit: Unit;
  workers: number;
  photos: ReportPhoto[];
  /** Чипы проблем, выбранные в форме. */
  problems: string[];
  /** Температура: воздух обязателен, смесь — по разделу. */
  tempAir?: number;
  tempMix?: number;
  /** Применённый зимний метод — обязателен при t < +5 °C. */
  winterMethod?: string;
  comment?: string;
}

export interface ReportPhoto {
  id: string;
  url: string;
  /** Геометка и время съёмки — их подделать сложнее, чем подпись. */
  takenAt: string;
  lat?: number;
  lon?: number;
}

export interface DailyReport {
  id: string;
  date: string; // ISO date
  authorId: string;
  authorRole: Role;
  objectId: string;
  status: ReportStatus;
  entries: ReportEntry[];
  submittedAt?: string;
  /** Сколько заняло заполнение — цель ≤ 5 минут. */
  fillSeconds?: number;
  /** Замечание ПТО при возврате. */
  returnComment?: string;
  returnedFields?: string[];
  /** Корректировка ПТО. */
  adjustment?: { entryId: string; from: number; to: number; reason: string };
}

/* ────────────────────────────── Заявки ────────────────────────────── */

export type ZayavkaKind = 'material' | 'tech';

export type ZayavkaStatus =
  | 'draft'
  | 'atForeman' // согласование прорабом (для мастера)
  | 'new'
  | 'normalizing' // снабжение сопоставляет позицию
  | 'approved'
  | 'purchasing'
  | 'ordered'
  | 'inTransit'
  | 'delivered'
  | 'accepted'
  | 'closed'
  | 'rejected';

export interface ZayavkaItem {
  id: string;
  /** Как написал прораб — свободный ввод сохраняется всегда. */
  rawText: string;
  /** Позиция справочника, если опознана. */
  catalogItemId?: string | null;
  qty: number;
  unit: Unit;
  note?: string;
  /** Расхождение с остатком по спецификации. */
  specRemainder?: number;
  overspendReason?: string;
}

export interface Zayavka {
  id: string;
  number: string; // ЗВ-АКО-26-0184
  kind: ZayavkaKind;
  status: ZayavkaStatus;
  objectId: string;
  blockId?: string;
  floor?: number;
  processStateId?: string;
  authorId: string;
  holderId?: string; // кто держит заявку сейчас
  items: ZayavkaItem[];
  priority: 'norm' | 'urgent';
  /** Срок поставки, а не срок работы. */
  deliveryBy?: string;
  createdAt: string;
  timeline: ZayavkaEvent[];
  /** Расчётная стоимость простоя, сом. */
  idleCost?: number;
  idleWorkers?: number;
  idleSince?: string;
}

export interface ZayavkaEvent {
  at: string;
  status: ZayavkaStatus;
  actorId: string;
  note?: string;
}

/** Заявка на спецтехнику — своя форма. */
export interface TechRequest {
  id: string;
  zayavkaId: string;
  machineType: string;
  hours: number;
  date: string;
  timeFrom: string;
  /** Чек-лист готовности фронта — без него заявка не уходит. */
  frontChecklist: { key: string; label: string; checked: boolean }[];
  machineId?: string;
  operatorId?: string;
}

export interface TechReport {
  id: string;
  techRequestId: string;
  hoursPlanned: number;
  hoursActual: number;
  idleHours: number;
  idleReason?: string;
  fuel?: number;
  faults?: string;
  ratedBy: string;
}

/* ────────────────────────────── Материалы и склад ────────────────────────────── */

export interface CatalogItem {
  id: string;
  name: string; // Арматура А500С Ø12
  unit: Unit;
  /** Формулировки прорабов, сопоставленные снабжением. Справочник растёт сам. */
  aliases: string[];
}

export interface StockBalance {
  objectId: string;
  catalogItemId: string;
  qty: number;
  unit: Unit;
  /** Норматив по спецификации на оставшийся объём. */
  specRemainder?: number;
  hasPassport: boolean;
}

export interface MaterialAcceptance {
  id: string;
  zayavkaId: string;
  acceptedById: string;
  at: string;
  qtyAccepted: number;
  /** Приёмка в два шага: количество, затем качество/паспорт. */
  passportOk: boolean;
  passportNumber?: string;
  photos: ReportPhoto[];
  discrepancy?: string;
}

export interface MaterialIssue {
  id: string;
  objectId: string;
  catalogItemId: string;
  qty: number;
  toUserId: string;
  at: string;
  /** Выдача под роспись. */
  signature: string;
}

/* ────────────────────────────── Подрядчики ────────────────────────────── */

export interface Contractor {
  id: string;
  name: string;
  scope: string;
  /** Итоговый рейтинг 0–5. */
  rating: number;
  /** Автоматическая часть — из данных системы. */
  autoScore: { onTime: number; rework: number; safety: number; docs: number };
  /** Субъективная часть — от прораба. */
  manualScore: { quality: number; safety: number; management: number; culture: number };
  activeWorkers: number;
  prescriptions: Prescription[];
}

export interface Prescription {
  id: string;
  number: string;
  contractorId: string;
  issuedById: string;
  kind: 'safety' | 'quality' | 'project';
  text: string;
  location: string;
  dueDays: number;
  issuedAt: string;
  resolvedAt?: string;
  photos: ReportPhoto[];
}

/* ────────────────────────────── Проект и документы ────────────────────────────── */

export type DrawingStage = 'П' | 'РД' | 'ИД';
export type DrawingMark = 'АР' | 'КЖ' | 'КМ' | 'ЭОМ' | 'ОВ' | 'ВК' | 'ГП' | 'ПОС';

export interface DrawingSet {
  id: string;
  objectId: string;
  stage: DrawingStage;
  mark: DrawingMark;
  name: string;
  revision: string;
  issuedAt: string;
  sheets: DrawingSheet[];
}

export interface DrawingSheet {
  id: string;
  setId: string;
  number: string;
  name: string;
  revision: string;
  /** Главная функция раздела — контроль актуальности листа. */
  isCurrent: boolean;
  supersededBy?: string;
  changedAt?: string;
  changeSummary?: string;
  fileUrl?: string;
}

export interface Rfi {
  id: string;
  number: string;
  objectId: string;
  authorId: string;
  sheetId?: string;
  question: string;
  createdAt: string;
  dueAt?: string;
  answer?: string;
  answeredAt?: string;
  status: 'open' | 'answered' | 'closed';
}

export type DocKind = 'aosr' | 'aook' | 'concreteStrength' | 'passport' | 'journal' | 'other';

export interface SiteDocument {
  id: string;
  objectId: string;
  kind: DocKind;
  number: string;
  name: string;
  createdAt: string;
  signedAt?: string;
  status: 'draft' | 'pending' | 'signed' | 'rejected';
  processStateId?: string;
  fileUrl?: string;
}

/** Протокол прочности бетона — шлюз, блокирующий распалубку. */
export interface ConcreteStrengthProtocol {
  id: string;
  objectId: string;
  processStateId: string;
  pouredAt: string;
  sampleAt: string;
  strengthPct: number;
  requiredPct: number;
  labName: string;
  status: 'awaiting' | 'passed' | 'failed';
}

/* ────────────────────────────── Финансы ────────────────────────────── */

export interface ObjectFinance {
  objectId: string;
  /** Бюджет, млн сом. */
  budget: number;
  /** Освоено (earned value) и потрачено (actual cost). */
  ev: number;
  ac: number;
  /** Индексы: CPI = EV/AC, SPI = план/факт по срокам. */
  cpi: number;
  spi: number;
  /** Прогноз по завершении. */
  eac: number;
  /** Отклонение по завершении, млн. */
  vac: number;
  /** Закрыто актами — не только освоение. */
  closedByActs: number;
  receivable: number;
}

export interface CostArticle {
  name: string;
  amount: number;
  pct: number;
  note?: string;
}

export interface Payment {
  id: string;
  objectId: string;
  name: string;
  amount: number;
  dueDate: string;
  status: 'draft' | 'pending' | 'approved' | 'paid' | 'overdue';
  approvedById?: string;
  /** Превышение лимита автономности требует эскалации. */
  aboveLimit?: boolean;
}

/** Лимит автономности — до какой суммы решение принимается без директора. */
export interface AutonomyLimit {
  role: Role;
  scope: 'payment' | 'zayavka' | 'contractor';
  limit: number;
}

/* ────────────────────────────── Задачи и поручения ────────────────────────────── */

export interface Task {
  id: string;
  text: string;
  objectId: string;
  blockId?: string;
  floor?: number;
  sectionId?: string;
  assigneeId: string | null;
  authorId: string;
  dueDate: string;
  status: 'open' | 'done' | 'overdue';
  /** Источник: поручение из инбокса руководства или срок от ГИ. */
  origin: 'inbox' | 'schedule' | 'manual';
  sourceRef?: string;
  createdAt: string;
}

/* ────────────────────────────── Инбокс и уведомления ────────────────────────────── */

export type NotificationKind =
  | 'report'
  | 'presentation'
  | 'acceptance'
  | 'noPassport'
  | 'rfi'
  | 'document'
  | 'prescription'
  | 'task'
  | 'zayavka'
  | 'idle'
  | 'safety';

export interface AppNotification {
  id: string;
  toRole: Role;
  toUserId?: string;
  kind: NotificationKind;
  title: string;
  subtitle: string;
  at: string;
  read: boolean;
  /** Куда ведёт тап. */
  link?: { screen: string; params?: Record<string, string> };
}

/* ────────────────────────────── Простои и решения ────────────────────────────── */

export interface Incident {
  id: string;
  objectId: string;
  kind: 'idle' | 'safety' | 'quality' | 'delay';
  title: string;
  detail: string;
  at: string;
  workersIdle?: number;
  /** Цена проблемы — в ленте руководства каждая проблема имеет цену. */
  cost?: number;
  status: 'open' | 'assigned' | 'resolved';
  taskId?: string;
}

/* ────────────────────────────── KPI ────────────────────────────── */

export interface KpiMetric {
  key: string;
  label: string;
  value: number;
  unit: string;
  /** Пороги объявлены заранее — цвет из них, а не «на глаз». */
  goodBelow?: number;
  goodAbove?: number;
  trend?: number;
}

export interface KpiDepartment {
  key: 'field' | 'pto' | 'mat' | 'tech';
  label: string;
  metrics: KpiMetric[];
}

/* ────────────────────────────── Пользователи ────────────────────────────── */

export interface User {
  id: string;
  fullName: string;
  login: string;
  phone: string;
  role: Role;
  /** Область: объект / блок / участок. */
  objectId?: string;
  blockId?: string;
  scopeLabel?: string;
  active: boolean;
  /** Пароль выдаётся один раз и повторно не показывается. */
  mustChangePassword: boolean;
  createdAt: string;
}
