/**
 * Токены дизайна. Значения взяты один-в-один из прототипа
 * `project/Прототип - всё приложение.dc.html` — менять их можно только вместе с макетом.
 */

export const color = {
  /* Синий — основное действие */
  primary: '#3D4FDE',
  primaryDark: '#2A3AB8',
  primaryLight: '#5B6BFF',
  primaryBg: '#EEF0FF',
  primaryBgSoft: '#F0F4FF',
  primaryBorder: '#B9C1F2',

  /* Текст */
  ink: '#14161F',
  inkSoft: '#3A3F4C',
  inkMuted: '#4A4F5C',
  muted: '#6B7080',
  faint: '#9AA0AE',

  /* Поверхности */
  page: '#E9EAEE',
  screen: '#F4F5F9',
  surface: '#FFFFFF',
  chip: '#EEF0F6',
  chipAlt: '#E7E9F0',
  track: '#E2E4EE',
  border: '#D8DAE3',
  borderSoft: '#F0F1F5',
  disabled: '#C9CCDA',
  dashed: '#B9BFCF',

  /* Опасность */
  danger: '#B3261E',

  /* Предупреждение */
  warnBg: '#FDEEDD',
  warnBorder: '#F0C489',
  warnBorderAlt: '#EFC894',
  warnText: '#8A5410',
  warnStrong: '#B7791F',
  warnDeep: '#B06A00',
  warnAccent: '#E8A23C',

  /* Успех */
  green: '#1E9E5A',
  greenDeep: '#166B3F',
  greenBg: '#E3F5EB',
  greenBorder: '#BFE5CF',
  greenMuted: '#6B8A78',
} as const;

export const shadow = {
  card: '0 2px 8px rgba(20,22,31,0.06)',
  row: '0 1px 4px rgba(20,22,31,0.05)',
  raised: '0 1px 4px rgba(20,22,31,0.08)',
  primary: '0 6px 16px rgba(61,79,222,0.35)',
  primarySoft: '0 10px 24px rgba(61,79,222,0.35)',
  fab: '-3px 6px 18px rgba(61,79,222,0.45)',
  phone: '0 24px 64px rgba(20,22,31,0.30)',
  sheet: '0 -12px 40px rgba(20,22,31,0.25)',
} as const;

export const radius = {
  sheet: 28,
  xl: 24,
  lg: 20,
  card: 18,
  cardAlt: 17,
  md: 16,
  mdAlt: 15,
  sm: 14,
  smAlt: 12,
  xs: 11,
  xxs: 10,
  pill: 9,
  tag: 8,
} as const;

export const font = {
  family: 'Manrope, sans-serif',
  /** Числа в интерфейсе всегда моноширинные — цифры не «прыгают» при пересчёте. */
  tabular: 'tabular-nums' as const,
} as const;

/**
 * Минимальная площадь касания. Перчатки на объекте — это пол, а не цель.
 * 48 px: нижняя граница Material и то же значение в --tap-min (см. main.tsx).
 */
export const TOUCH_MIN = 48;

/**
 * Брейкпоинты. Те же значения объявлены переменными в :root (см. main.tsx):
 * в CSS ими пользуются медиазапросы, здесь — переключение раскладки.
 */
export const BP_TABLET = 768;
export const BP_DESKTOP = 1024;

/** Ширина области содержимого и постоянной боковой навигации. */
export const CONTENT_MAX = 1280;
export const SIDEBAR_W = 240;
/** Свёрнутая боковая навигация: только иконки. */
export const SIDEBAR_ICON_W = 72;

export const layout = {
  /** Горизонтальные поля большинства экранов. */
  gutter: 20,
  /** Поля экранов онбординга и логина — шире. */
  gutterWide: 24,
} as const;
