/**
 * Нижняя навигация.
 *
 * Правила из ТЗ по навигации: везде ровно четыре таба; активное состояние
 * показано тремя признаками сразу — цветом, насыщенностью начертания и
 * полоской над иконкой; бейджи двух типов — счётчик для «требует действия»
 * и точка для «есть новое».
 */
import type { ReactNode } from 'react';
import { SIDEBAR_ICON_W, SIDEBAR_W, TOUCH_MIN, color, radius } from '../design/tokens';
import { CountBadge } from '../design/primitives';
import {
  IconBuilding,
  IconChart,
  IconMachine,
  IconMoney,
  IconMore,
  IconPallet,
  IconQuality,
  IconQueue,
  IconToday,
  IconWorks,
  IconZayavki,
} from '../design/icons';
import type { Screen } from '../store/app';
import type { Role, RoleGroup } from '@build-hub/shared';

export interface Tab {
  key: string;
  label: string;
  screen: Screen;
  icon: (props: { size?: number; color?: string }) => ReactNode;
  /** Экраны, при которых таб считается активным. */
  owns: Screen[];
  badge?: 'notifications' | 'zayavki' | 'reports' | 'presentations';
}

const FIELD_TABS: Tab[] = [
  {
    key: 'today',
    label: 'Сегодня',
    screen: 'today',
    icon: IconToday,
    owns: ['today', 'form', 'preview', 'status', 'returned'],
  },
  {
    key: 'works',
    label: 'Работы',
    screen: 'works',
    icon: IconWorks,
    owns: ['works', 'chain', 'process', 'present'],
  },
  {
    key: 'zayavki',
    label: 'Заявки',
    screen: 'zayavki',
    icon: IconZayavki,
    owns: ['zayavki', 'zayavka', 'zayavka-new', 'zayavka-tech', 'acceptance'],
    badge: 'zayavki',
  },
  {
    key: 'more',
    label: 'Ещё',
    screen: 'more',
    icon: IconMore,
    owns: [
      'more',
      'profile',
      'notifications',
      'contractors',
      'contractor',
      'contractor-rate',
      'project',
      'project-set',
      'project-sheet',
      'project-current',
      'rfi',
      'documents',
      'documents-acts',
      'documents-strength',
      'documents-object',
    ],
    badge: 'notifications',
  },
];

const PTO_TABS: Tab[] = [
  { key: 'today', label: 'Сегодня', screen: 'pto-today', icon: IconToday, owns: ['pto-today'], badge: 'notifications' },
  {
    key: 'queue',
    label: 'Приёмка',
    screen: 'pto-queue',
    icon: IconQueue,
    owns: ['pto-queue', 'pto-check', 'pto-presentations'],
    badge: 'reports',
  },
  {
    key: 'objects',
    label: 'Объекты',
    screen: 'pto-objects',
    icon: IconBuilding,
    owns: ['pto-objects', 'pto-object', 'pto-chain-setup'],
  },
  {
    key: 'more',
    label: 'Ещё',
    screen: 'pto-more',
    icon: IconMore,
    owns: ['pto-more', 'pto-users', 'pto-user-new', 'pto-lab', 'profile', 'documents', 'project', 'rfi'],
  },
];

/**
 * Четвёртый таб руководства — его главная предметная область, а не «Ещё»:
 * настройки открываются раз в квартал, финансы и качество — ежедневно.
 */
function bossTabs(role: Role): Tab[] {
  const fourth: Tab =
    role === 'gi'
      ? { key: 'quality', label: 'Качество', screen: 'boss-quality', icon: IconQuality, owns: ['boss-quality'] }
      : {
          key: 'finance',
          label: 'Финансы',
          screen: 'boss-finance',
          icon: IconMoney,
          owns: ['boss-finance', 'boss-finance-object', 'boss-week'],
        };
  return [
    { key: 'digest', label: 'Сводка', screen: 'boss-digest', icon: IconChart, owns: ['boss-digest'] },
    {
      key: 'tasks',
      label: 'Задачи',
      screen: 'boss-inbox',
      icon: IconQueue,
      owns: ['boss-inbox', 'boss-tasks'],
      badge: 'notifications',
    },
    {
      key: 'objects',
      label: 'Объекты',
      screen: 'boss-objects',
      icon: IconBuilding,
      owns: ['boss-objects', 'boss-object', 'boss-company-objects', 'boss-assign'],
    },
    fourth,
  ];
}

const MAT_TABS: Tab[] = [
  { key: 'today', label: 'Сегодня', screen: 'mat-today', icon: IconToday, owns: ['mat-today'], badge: 'notifications' },
  {
    key: 'zayavki',
    label: 'Заявки',
    screen: 'mat-zayavki',
    icon: IconZayavki,
    owns: ['mat-zayavki', 'zayavka'],
    badge: 'zayavki',
  },
  { key: 'stock', label: 'Склад', screen: 'mat-stock', icon: IconPallet, owns: ['mat-stock', 'mat-issue'] },
  { key: 'more', label: 'Ещё', screen: 'mat-more', icon: IconMore, owns: ['mat-more', 'profile'] },
];

const TECH_TABS: Tab[] = [
  { key: 'today', label: 'Сегодня', screen: 'tech-today', icon: IconToday, owns: ['tech-today'], badge: 'notifications' },
  {
    key: 'queue',
    label: 'Заявки',
    screen: 'tech-queue',
    icon: IconZayavki,
    owns: ['tech-queue', 'zayavka', 'tech-report'],
    badge: 'zayavki',
  },
  { key: 'fleet', label: 'Парк', screen: 'tech-fleet', icon: IconMachine, owns: ['tech-fleet'] },
  { key: 'more', label: 'Ещё', screen: 'tech-more', icon: IconMore, owns: ['tech-more', 'profile'] },
];

/**
 * Экраны, на которых нижняя навигация видна: корни табов и списки, до которых
 * доходят одним тапом. На сфокусированных экранах — форме ввода, карточке,
 * предъявлении — её нет: там одно действие, и уводить с него нечем.
 */
const NAV_SCREENS = new Set<Screen>([
  'today',
  'works',
  'zayavki',
  'more',
  'profile',
  'notifications',
  'contractors',
  'project',
  'documents',
  'pto-today',
  'pto-queue',
  'pto-objects',
  'pto-more',
  'pto-users',
  'boss-digest',
  'boss-inbox',
  'boss-tasks',
  'boss-objects',
  'boss-finance',
  'boss-quality',
  'mat-today',
  'mat-zayavki',
  'mat-stock',
  'mat-more',
  'tech-today',
  'tech-queue',
  'tech-fleet',
  'tech-more',
]);

export function showsNav(screen: Screen): boolean {
  return NAV_SCREENS.has(screen);
}

export function tabsFor(role: Role, group: RoleGroup): Tab[] {
  switch (group) {
    case 'field':
      return FIELD_TABS;
    case 'pto':
      return PTO_TABS;
    case 'boss':
      return bossTabs(role);
    case 'mat':
      return MAT_TABS;
    case 'tech':
      return TECH_TABS;
    default:
      return FIELD_TABS;
  }
}

export function BottomNav({
  tabs,
  current,
  badges,
  onNavigate,
}: {
  tabs: Tab[];
  current: Screen;
  badges: Record<string, number>;
  onNavigate: (screen: Screen) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        borderTop: `1px solid ${color.track}`,
        background: color.surface,
        // Нижний отступ учитывает вырез под экраном: без него последняя
        // строка вкладок попадает под системную полосу жестов.
        padding: '8px 4px calc(16px + env(safe-area-inset-bottom))',
        flex: 'none',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.owns.includes(current);
        const count = tab.badge ? (badges[tab.badge] ?? 0) : 0;
        return (
          <div
            key={tab.key}
            onClick={() => onNavigate(tab.screen)}
            style={{
              cursor: 'pointer',
              flex: 1,
              // Палец в перчатке: 48 px — пол, а не цель.
              minHeight: TOUCH_MIN,
              textAlign: 'center',
              // Три признака активности сразу: цвет, вес и полоска.
              color: active ? color.primary : color.muted,
              fontWeight: active ? 800 : 500,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              justifyContent: 'flex-end',
            }}
          >
            <div
              style={
                active
                  ? { width: 34, height: 4, borderRadius: 2, background: color.primary, marginBottom: 2 }
                  : { height: 4, marginBottom: 2 }
              }
            />
            <div style={{ position: 'relative' }}>
              {tab.icon({ size: 24, color: 'currentColor' })}
              <CountBadge count={count} />
            </div>
            <div style={{ fontSize: 11 }}>{tab.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Боковая навигация для планшета и настольного экрана.
 *
 * Те же вкладки и те же признаки активности, что внизу на телефоне, —
 * набор берётся из того же tabsFor(). На планшете подписи скрыты: место
 * дороже, а иконки к этому моменту уже знакомы по телефону.
 */
export function SideNav({
  tabs,
  current,
  badges,
  onNavigate,
  collapsed,
}: {
  tabs: Tab[];
  current: Screen;
  badges: Record<string, number>;
  onNavigate: (screen: Screen) => void;
  collapsed: boolean;
}) {
  return (
    <nav
      style={{
        width: collapsed ? SIDEBAR_ICON_W : SIDEBAR_W,
        flex: 'none',
        background: color.surface,
        borderRight: `1px solid ${color.track}`,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '16px 8px',
        position: 'sticky',
        top: 0,
        alignSelf: 'flex-start',
        height: '100dvh',
        overflowY: 'auto',
      }}
    >
      {tabs.map((tab) => {
        const active = tab.owns.includes(current);
        const count = tab.badge ? (badges[tab.badge] ?? 0) : 0;
        return (
          <div
            key={tab.key}
            onClick={() => onNavigate(tab.screen)}
            title={collapsed ? tab.label : undefined}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              // Та же нижняя граница касания, что и на телефоне.
              minHeight: TOUCH_MIN,
              padding: collapsed ? '10px 0' : '10px 12px',
              justifyContent: collapsed ? 'center' : 'flex-start',
              borderRadius: radius.sm,
              background: active ? color.chip : 'transparent',
              color: active ? color.primary : color.muted,
              fontWeight: active ? 800 : 500,
              fontSize: 14,
            }}
          >
            <div style={{ position: 'relative', display: 'flex' }}>
              {tab.icon({ size: 24, color: 'currentColor' })}
              <CountBadge count={count} />
            </div>
            {collapsed ? null : <div>{tab.label}</div>}
          </div>
        );
      })}
    </nav>
  );
}
