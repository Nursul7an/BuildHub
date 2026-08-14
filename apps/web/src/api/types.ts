/** Формы ответов сервера — то, что реально возвращают маршруты в apps/server. */
import type { Role } from '@build-hub/shared';

export interface Me {
  id: string;
  fullName: string;
  login: string;
  phone: string;
  role: Role;
  objectId?: string;
  blockId?: string;
  scopeLabel?: string;
  active: boolean;
  mustChangePassword: boolean;
  object: { id: string; name: string } | null;
  block: { id: string; name: string } | null;
}

export interface ProcessSummary {
  id: string;
  processDefId: string;
  sectionId: string;
  sectionName?: string;
  name: string;
  unit: string;
  requiresAosr: boolean;
  subcycle: string | null;
  critical: boolean;
  order: number;
  objectId: string;
  blockId: string;
  blockName: string;
  floor: number;
  status: 'idle' | 'active' | 'presented' | 'accepted' | 'blocked';
  planQty: number;
  doneQty: number;
  pct: number;
  blockedReason: string | null;
  dueDate: string | null;
  aosrNumber: string | null;
  acceptedAt: string | null;
  presentedAt: string | null;
  presentedOfDays: number | null;
  filledToday?: boolean;
}

export interface ProcessDetail extends ProcessSummary {
  objectName: string;
  sectionName: string;
  history: { date: string; volume: number; unit: string; workers: number; photos: number; status: string }[];
  comments: {
    id: string;
    kind: string;
    text: string;
    createdAt: string;
    materialName: string | null;
    materialQty: number | null;
    idleWorkers: number | null;
    idleCost: number | null;
    zayavkaId: string | null;
  }[];
  documents: { id: string; number: string; name: string; status: string }[];
  strengthProtocols: { id: string; strengthPct: number; requiredPct: number; status: string; sampleAt: string }[];
  presentBlockedBy: string | null;
  strengthBlockedBy: string | null;
}

export interface ReportEntryDto {
  id: string;
  processStateId: string;
  title?: string;
  volume: number;
  unit: string;
  workers: number;
  problems: string[];
  tempAir: number | null;
  tempMix: number | null;
  winterMethod: string | null;
  comment: string | null;
  photos: { id: string; url: string; takenAt: string; lat: number | null; lon: number | null }[];
}

export interface ReportDto {
  id: string;
  date: string;
  status: string;
  submittedAt: string | null;
  fillSeconds: number | null;
  returnComment: string | null;
  returnedFields: string[];
  authorId: string;
  authorName?: string;
  authorRole?: string;
  objectName?: string;
  entries: ReportEntryDto[];
  checks?: {
    id: string;
    decision: string;
    comment: string | null;
    adjustFrom: number | null;
    adjustTo: number | null;
    createdAt: string;
  }[];
}

export interface TodayDto {
  date: string;
  object: { id: string; name: string } | null;
  block: { id: string; name: string } | null;
  scopeLabel: string | null;
  processes: ProcessSummary[];
  report: ReportDto | null;
  returnedReport: ReportDto | null;
  burning: { kind: 'overdue' | 'blocked'; processStateId: string; title: string; note: string }[];
  incidents: { id: string; kind: string; title: string; detail: string; cost: number | null }[];
  zayavki: { id: string; number: string; status: string; what: string; idleCost: number | null }[];
  notifications: { id: string; kind: string; title: string; subtitle: string; at: string }[];
}

export interface ObjectDto {
  id: string;
  code: string;
  name: string;
  address: string;
  city: string;
  floorsTotal: number;
  dueDate: string;
  status: string;
  pctPlan: number;
  pctFact: number;
  deltaDays: number;
  responsible: { id: string; fullName: string } | null;
  blocks: { id: string; name: string; floors: number }[];
}

export interface SectionDto {
  id: string;
  name: string;
  entryCondition: string | null;
  blockReason: string | null;
  actsCount: number;
  processes: {
    id: string;
    order: number;
    name: string;
    unit: string;
    requiresAosr: boolean;
    subcycle: string | null;
    critical: boolean;
  }[];
}

export interface ChainDto {
  section: { id: string; name: string; entryCondition: string | null; blockReason: string | null };
  processCount: number;
  actsCount: number;
  rows: {
    order: number;
    processDefId: string;
    processStateId: string | null;
    name: string;
    unit: string;
    requiresAosr: boolean;
    subcycle: string | null;
    critical: boolean;
    status: ProcessSummary['status'];
    planQty: number;
    doneQty: number;
    blockedReason: string | null;
    dueDate: string | null;
    aosrNumber: string | null;
    acceptedAt: string | null;
    presentedAt: string | null;
    presentedOfDays: number | null;
  }[];
}

export interface ZayavkaItemDto {
  id: string;
  rawText: string;
  name: string | null;
  matched: boolean;
  qty: number;
  unit: string;
  note: string | null;
  specRemainder: number | null;
  overspendReason: string | null;
  overSpec: boolean;
}

export interface ZayavkaDto {
  id: string;
  number: string;
  kind: 'material' | 'tech';
  status: string;
  priority: 'norm' | 'urgent';
  createdAt: string;
  deliveryBy: string | null;
  idleWorkers: number | null;
  idleSince: string | null;
  idleCost: number | null;
  objectId: string;
  objectName?: string;
  blockName: string | null;
  floor: number | null;
  author: { id: string; fullName: string; role: string } | null;
  holder: { id: string; fullName: string; role: string } | null;
  items: ZayavkaItemDto[];
  timeline: { id: string; at: string; status: string; note: string | null; actor?: string }[];
  tech: {
    id: string;
    machineType: string;
    hours: number;
    date: string;
    timeFrom: string;
    frontChecklist: { key: string; label: string; checked: boolean }[];
    machine: { id: string; name: string } | null;
    hasReport: boolean;
  } | null;
  acceptances: { id: string; at: string; qtyAccepted: number; passportOk: boolean; acceptedBy?: string }[];
}

export interface StockDto {
  id: string;
  objectId: string;
  objectName: string;
  catalogItemId: string;
  name: string;
  qty: number;
  unit: string;
  specRemainder: number | null;
  hasPassport: boolean;
  overSpec: boolean;
}

export interface CatalogItemDto {
  id: string;
  name: string;
  unit: string;
  aliases: string[];
}

export interface ContractorDto {
  id: string;
  name: string;
  scope: string;
  activeWorkers: number;
  rating: number;
  breakdown: {
    auto: { onTime: number; rework: number; safety: number; docs: number; weight: number };
    manual: { quality: number; safety: number; management: number; culture: number; weight: number; count: number };
  };
  prescriptionsOpen: number;
  prescriptionsTotal: number;
  stopped: boolean;
  stopReason: string | null;
}

export interface DigestDto {
  objects: {
    id: string;
    name: string;
    status: string;
    responsible: string | null;
    pctPlan: number;
    pctFact: number;
    deltaDays: number;
    cpi: number | null;
    budget: number | null;
    eac: number | null;
  }[];
  incidents: {
    id: string;
    objectId: string;
    objectName: string;
    kind: string;
    title: string;
    detail: string;
    cost: number | null;
    workersIdle: number | null;
    at: string;
    status: string;
  }[];
  tasks: {
    id: string;
    text: string;
    objectName: string;
    assignee: string | null;
    dueDate: string;
    overdue: boolean;
    origin: string;
  }[];
  finance: FinanceObjectDto[];
}

export interface FinanceObjectDto {
  objectId: string;
  objectName?: string;
  /** Суммы приходят в сомах: единица одна на весь API, млн — дело показа. */
  budget: number;
  ev: number;
  ac: number;
  /** null, пока по объекту нет затрат: делить на ноль нельзя. */
  cpi: number | null;
  eac: number | null;
  vac: number | null;
  closedByActs: number;
  notClosed: number;
  receivable: number;
  /** Дата актуальности затрат — показывается рядом с цифрой. */
  costsAsOf?: string | null;
  costsStale?: boolean;
}

export interface FinanceDto {
  objects: FinanceObjectDto[];
  /** Самая старая дата актуальности по объектам — по ней и судят о свежести. */
  costsAsOf?: string | null;
  articles: { name: string; amount: number; pct: number; note: string | null }[];
  payments: {
    id: string;
    objectName: string;
    name: string;
    amount: number;
    dueDate: string;
    status: string;
    aboveLimit: boolean;
  }[];
  limits: { role: string; scope: string; limit: number }[];
}

export interface QualityDto {
  prescriptions: {
    id: string;
    number: string;
    contractor: string;
    kind: string;
    text: string;
    location: string;
    issuedAt: string;
    dueDays: number;
    overdue: boolean;
    issuedBy: string;
  }[];
  strengthPending: { id: string; objectName: string; process: string; strengthPct: number; requiredPct: number }[];
  blockedProcesses: { id: string; objectName: string; title: string; reason: string | null }[];
  openRfis: { id: string; number: string; objectName: string; question: string; overdue: boolean }[];
}

export interface TaskDto {
  id: string;
  text: string;
  objectName: string;
  blockName: string | null;
  floor: number | null;
  sectionName: string | null;
  assignee: string | null;
  assigneeId: string | null;
  author: string;
  dueDate: string;
  status: string;
  overdue: boolean;
  origin: string;
}

export interface KpiDto {
  departments: {
    key: string;
    label: string;
    metrics: {
      key: string;
      label: string;
      value: number;
      unit: string;
      goodAbove?: number;
      goodBelow?: number;
      state: 'good' | 'warn' | 'bad' | 'neutral';
    }[];
  }[];
}

export interface NotificationDto {
  id: string;
  kind: string;
  title: string;
  subtitle: string;
  at: string;
  read: boolean;
  link: { screen: string; params?: Record<string, string> } | null;
}

export interface BadgesDto {
  notifications: number;
  zayavki: number;
  reports: number;
  presentations: number;
}

export interface UserDto {
  id: string;
  fullName: string;
  login: string;
  phone: string;
  role: Role;
  objectId?: string;
  blockId?: string;
  scopeLabel?: string;
  objectName: string | null;
  blockName: string | null;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export interface DrawingSetDto {
  id: string;
  stage: string;
  mark: string;
  name: string;
  revision: string;
  issuedAt: string;
  sheetCount: number;
  /** Сколько листов пережили замену — на это смотрят первым делом. */
  revisedCount: number;
  sheets: SheetDto[];
}

export interface SheetDto {
  id: string;
  number: string;
  name: string;
  /** Ревизия действующей версии. */
  revision: string | null;
  issuedAt: string | null;
  versionCount?: number;
  versionId?: string;
  mark?: string;
  stage?: string;
}

export interface SheetVersionDto {
  id: string;
  revision: string;
  issuedAt: string;
  changeSummary: string | null;
  superseded: boolean;
  supersededAt?: string | null;
}

/** Карточка листа: какую версию открыли и действует ли она. */
export interface SheetDetailDto {
  id: string;
  number: string;
  name: string;
  mark: string;
  stage: string;
  version: {
    id: string;
    revision: string;
    issuedAt: string;
    changeSummary: string | null;
    fileId: string | null;
  };
  outdated: boolean;
  supersededAt: string | null;
  currentVersion: { id: string; revision: string; issuedAt: string; changeSummary: string | null } | null;
  warning: string | null;
  /** Дата, на которую отдан ответ — для офлайн-метки «проверьте актуальность». */
  asOf: string;
  history: SheetVersionDto[];
  rfis: { id: string; number: string; status: string }[];
}

export interface RfiDto {
  id: string;
  number: string;
  question: string;
  answer: string | null;
  status: string;
  createdAt: string;
  dueAt: string | null;
  author: string;
  sheet: string | null;
  overdue: boolean;
}

export interface DocumentDto {
  id: string;
  kind: string;
  number: string;
  name: string;
  status: string;
  createdAt: string;
  signedAt: string | null;
  process: string | null;
}

export interface ProtocolDto {
  id: string;
  pouredAt: string;
  sampleAt: string;
  strengthPct: number;
  requiredPct: number;
  labName: string;
  status: string;
  process: string;
  blocksStripping: boolean;
}

export interface MachineDto {
  id: string;
  name: string;
  kind: string;
  status: string;
  nextServiceAt: string | null;
  permitUntil: string | null;
  serviceSoon: boolean;
  permitExpiring: boolean;
}

export interface AssistantAnswer {
  answered: boolean;
  question?: string;
  text: string;
  source: string | null;
  actions: { label: string; screen: string; params?: Record<string, string> }[];
  suggestions: { key: string; question: string }[];
}
