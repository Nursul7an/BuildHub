/**
 * Сопоставление экрана и компонента. Навигация плоская — часть «экранов»
 * в макете это шторки поверх текущего, и маршрутизатор здесь мешал бы.
 */
import type { ReactNode } from 'react';
import { color } from '../design/tokens';
import { ScreenBody } from '../shell/PhoneFrame';
import type { Screen, ScreenParams } from '../store/app';

import { LoginScreen } from './auth/LoginScreen';
import { PasswordScreen } from './auth/PasswordScreen';

import { TodayScreen } from './field/TodayScreen';
import { FormScreen } from './field/FormScreen';
import { PreviewScreen, ReturnedScreen, StatusScreen } from './field/ReportScreens';
import { WorksScreen } from './field/WorksScreen';
import { ChainScreen } from './field/ChainScreen';
import { ProcessScreen } from './field/ProcessScreen';
import { PresentScreen } from './field/PresentScreen';

import {
  AcceptanceScreen,
  ZayavkaCardScreen,
  ZayavkaNewScreen,
  ZayavkiScreen,
} from './zayavki/ZayavkiScreens';
import { FleetScreen, TechReportScreen, TechZayavkaScreen } from './zayavki/TechScreens';

import {
  ContractorCardScreen,
  ContractorRateScreen,
  ContractorsScreen,
} from './contractors/ContractorScreens';

import {
  ActsScreen,
  CurrentSheetsScreen,
  DocumentsScreen,
  ObjectDocumentsScreen,
  ProjectScreen,
  ProjectSetScreen,
  RfiScreen,
  SheetScreen,
  StrengthScreen,
} from './docs/ProjectScreens';

import {
  AssistantScreen,
  MoreScreen,
  NotificationsScreen,
  ProfileScreen,
} from './common/CommonScreens';

import {
  PtoChainSetupScreen,
  PtoCheckScreen,
  PtoLabScreen,
  PtoObjectScreen,
  PtoObjectsScreen,
  PtoQueueScreen,
  PtoTodayScreen,
  PtoUserNewScreen,
  PtoUsersScreen,
} from './pto/PtoScreens';

import {
  BossAssignScreen,
  BossCompanyObjectsScreen,
  BossDigestScreen,
  BossFinanceObjectScreen,
  BossFinanceScreen,
  BossInboxScreen,
  BossKpiScreen,
  BossLimitsScreen,
  BossObjectScreen,
  BossObjectsScreen,
  BossQualityScreen,
  BossWeekScreen,
  PlanerkaScreen,
} from './boss/BossScreens';

import {
  DepartmentMoreScreen,
  IssueScreen,
  MaterialsTodayScreen,
  MaterialsZayavkiScreen,
  StockScreen,
  TechQueueScreen,
  TechTodayScreen,
} from './materials/MaterialScreens';

const SCREENS: Partial<Record<Screen, () => ReactNode>> = {
  // вход
  login: LoginScreen,
  password: PasswordScreen,

  // площадка
  today: TodayScreen,
  form: FormScreen,
  preview: PreviewScreen,
  status: StatusScreen,
  returned: ReturnedScreen,
  works: WorksScreen,
  chain: ChainScreen,
  process: ProcessScreen,
  present: PresentScreen,

  // заявки
  zayavki: ZayavkiScreen,
  zayavka: ZayavkaCardScreen,
  'zayavka-new': ZayavkaNewScreen,
  'zayavka-tech': TechZayavkaScreen,
  acceptance: AcceptanceScreen,
  'tech-report': TechReportScreen,

  // подрядчики
  contractors: ContractorsScreen,
  contractor: ContractorCardScreen,
  'contractor-rate': ContractorRateScreen,

  // проект и документы
  project: ProjectScreen,
  'project-set': ProjectSetScreen,
  'project-sheet': SheetScreen,
  'project-current': CurrentSheetsScreen,
  rfi: RfiScreen,
  documents: DocumentsScreen,
  'documents-acts': ActsScreen,
  'documents-strength': StrengthScreen,
  'documents-object': ObjectDocumentsScreen,

  // общее
  more: MoreScreen,
  profile: ProfileScreen,
  notifications: NotificationsScreen,
  assistant: AssistantScreen,

  // ПТО
  'pto-today': PtoTodayScreen,
  'pto-queue': PtoQueueScreen,
  'pto-check': PtoCheckScreen,
  'pto-objects': PtoObjectsScreen,
  'pto-object': PtoObjectScreen,
  'pto-chain-setup': PtoChainSetupScreen,
  'pto-users': PtoUsersScreen,
  'pto-user-new': PtoUserNewScreen,
  'pto-more': MoreScreen,
  'pto-lab': PtoLabScreen,

  // руководство
  'boss-digest': BossDigestScreen,
  'boss-inbox': BossInboxScreen,
  'boss-objects': BossObjectsScreen,
  'boss-object': BossObjectScreen,
  'boss-finance': BossFinanceScreen,
  'boss-finance-object': BossFinanceObjectScreen,
  'boss-week': BossWeekScreen,
  'boss-quality': BossQualityScreen,
  'boss-kpi': BossKpiScreen,
  'boss-limits': BossLimitsScreen,
  'boss-company-objects': BossCompanyObjectsScreen,
  'boss-assign': BossAssignScreen,
  'boss-planerka': PlanerkaScreen,

  // материалы
  'mat-today': MaterialsTodayScreen,
  'mat-zayavki': MaterialsZayavkiScreen,
  'mat-stock': StockScreen,
  'mat-issue': IssueScreen,
  'mat-more': DepartmentMoreScreen,

  // спецтехника
  'tech-today': TechTodayScreen,
  'tech-queue': TechQueueScreen,
  'tech-fleet': FleetScreen,
  'tech-more': DepartmentMoreScreen,
};

export function renderScreen(screen: Screen, _params: ScreenParams): ReactNode {
  const Component = SCREENS[screen];
  if (!Component) return <NotBuilt screen={screen} />;
  return <Component />;
}

function NotBuilt({ screen }: { screen: Screen }) {
  return (
    <ScreenBody style={{ padding: 24, color: color.muted, gap: 8 }}>
      <div style={{ fontSize: 16, fontWeight: 800, color: color.ink }}>Экран ещё не собран</div>
      <div style={{ fontSize: 13 }}>{screen}</div>
    </ScreenBody>
  );
}
