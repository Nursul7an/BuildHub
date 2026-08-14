import type { Role } from './roles.js';
import type {
  AppNotification,
  AutonomyLimit,
  CatalogItem,
  ConcreteStrengthProtocol,
  ConstructionObject,
  Contractor,
  CostArticle,
  DailyReport,
  DrawingSet,
  Incident,
  KpiDepartment,
  MaterialAcceptance,
  MaterialIssue,
  ObjectFinance,
  Payment,
  Prescription,
  ProcessDef,
  ProcessState,
  ReportEntry,
  Rfi,
  SectionDef,
  SiteDocument,
  StockBalance,
  Task,
  TechReport,
  TechRequest,
  User,
  Zayavka,
} from './domain.js';

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  user: User;
  /** Прежний пароль перестаёт работать после смены. */
  mustChangePassword: boolean;
}

export interface ChangePasswordRequest {
  newPassword: string;
  repeatPassword: string;
}

export interface CreateUserRequest {
  fullName: string;
  phone: string;
  role: Role;
  objectId?: string;
  blockId?: string;
  scopeLabel?: string;
}

export interface CreateUserResponse {
  user: User;
  /** Показывается ровно один раз. */
  temporaryPassword: string;
}

/** Всё, что нужно экрану «Сегодня», одним запросом. */
export interface TodayResponse {
  date: string;
  object: ConstructionObject | null;
  processes: ProcessState[];
  processDefs: ProcessDef[];
  report: DailyReport | null;
  returnedReport: DailyReport | null;
  burning: Incident[];
  zayavki: Zayavka[];
  notifications: AppNotification[];
}

export interface SubmitReportRequest {
  date: string;
  objectId: string;
  entries: Omit<ReportEntry, 'id'>[];
  fillSeconds: number;
}

export interface CheckReportRequest {
  decision: 'accept' | 'adjust' | 'return';
  comment?: string;
  adjustment?: { entryId: string; to: number; reason: string };
  returnedFields?: string[];
}

export interface CreateZayavkaRequest {
  kind: 'material' | 'tech';
  objectId: string;
  blockId?: string;
  floor?: number;
  processStateId?: string;
  priority: 'norm' | 'urgent';
  deliveryBy?: string;
  items: {
    rawText: string;
    catalogItemId?: string | null;
    qty: number;
    unit: string;
    note?: string;
    overspendReason?: string;
  }[];
  idleWorkers?: number;
  idleSince?: string;
  tech?: Omit<TechRequest, 'id' | 'zayavkaId'>;
}

export interface NormalizeZayavkaRequest {
  itemId: string;
  catalogItemId: string;
  /** Формулировка запоминается — справочник растёт сам. */
  rememberAlias: boolean;
}

export interface PresentProcessRequest {
  processStateId: string;
  checklist: { key: string; checked: boolean }[];
  /** Не раньше чем через 3 рабочих дня. */
  date: string;
  notify: string[];
}

export interface WorksResponse {
  sections: SectionDef[];
  processDefs: ProcessDef[];
  processes: ProcessState[];
}

export interface BossDigestResponse {
  objects: (ConstructionObject & { pctPlan: number; pctFact: number; deltaDays: number })[];
  incidents: Incident[];
  tasks: Task[];
  finance: ObjectFinance[];
}

export interface FinanceResponse {
  objects: ObjectFinance[];
  articles: CostArticle[];
  payments: Payment[];
  limits: AutonomyLimit[];
}

export interface MaterialsTodayResponse {
  zayavki: Zayavka[];
  stock: StockBalance[];
  acceptances: MaterialAcceptance[];
  issues: MaterialIssue[];
  catalog: CatalogItem[];
}

export interface TechTodayResponse {
  requests: (TechRequest & { zayavka: Zayavka })[];
  reports: TechReport[];
}

export interface DocsResponse {
  documents: SiteDocument[];
  protocols: ConcreteStrengthProtocol[];
  sets: DrawingSet[];
  rfis: Rfi[];
}

export interface ContractorsResponse {
  contractors: Contractor[];
  prescriptions: Prescription[];
}

export interface KpiResponse {
  departments: KpiDepartment[];
}

export interface ApiError {
  error: string;
  message: string;
  details?: unknown;
}
