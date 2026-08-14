/**
 * Нижняя навигация.
 *
 * Правила из ТЗ по навигации: везде ровно четыре таба; активное состояние
 * показано тремя признаками сразу — цветом, насыщенностью начертания и
 * полоской над иконкой; бейджи двух типов — счётчик для «требует действия»
 * и точка для «есть новое».
 */
import type { ReactNode } from 'react';
import { color } from '../design/tokens';
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
        padding: '8px 4px 16px',
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
