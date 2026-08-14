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
};
export const shadow = {
    card: '0 2px 8px rgba(20,22,31,0.06)',
    row: '0 1px 4px rgba(20,22,31,0.05)',
    raised: '0 1px 4px rgba(20,22,31,0.08)',
    primary: '0 6px 16px rgba(61,79,222,0.35)',
    primarySoft: '0 10px 24px rgba(61,79,222,0.35)',
    fab: '-3px 6px 18px rgba(61,79,222,0.45)',
    phone: '0 24px 64px rgba(20,22,31,0.30)',
    sheet: '0 -12px 40px rgba(20,22,31,0.25)',
};
export const radius = {
    phone: 32,
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
};
export const font = {
    family: 'Manrope, sans-serif',
    /** Числа в интерфейсе всегда моноширинные — цифры не «прыгают» при пересчёте. */
    tabular: 'tabular-nums',
};
/** Минимальная площадь касания. Перчатки на объекте — 44 px это пол, а не цель. */
export const TOUCH_MIN = 44;
/** Ширина экрана телефона в макете. */
export const PHONE_WIDTH = 376;
export const PHONE_MIN_HEIGHT = 800;
export const layout = {
    /** Горизонтальные поля большинства экранов. */
    gutter: 20,
    /** Поля экранов онбординга и логина — шире. */
    gutterWide: 24,
};
