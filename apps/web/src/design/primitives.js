import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { TOUCH_MIN, color, font, radius, shadow } from './tokens';
/* ─────────────────────────────── Поверхности ─────────────────────────────── */
export function Card({ children, style, onClick }) {
    return (_jsx("div", { onClick: onClick, style: {
            background: color.surface,
            borderRadius: radius.lg,
            padding: 16,
            boxShadow: shadow.card,
            ...(onClick ? { cursor: 'pointer' } : null),
            ...style,
        }, children: children }));
}
/** Плотная строка списка — заявки, история, документы. */
export function RowCard({ children, style, onClick }) {
    return (_jsx("div", { onClick: onClick, style: {
            background: color.surface,
            borderRadius: radius.sm,
            padding: '11px 14px',
            boxShadow: shadow.row,
            ...(onClick ? { cursor: 'pointer' } : null),
            ...style,
        }, children: children }));
}
/** Заголовок группы: «АКТИВНЫЕ ПРОЦЕССЫ · 3». */
export function SectionLabel({ children, style, tone }) {
    return (_jsx("div", { style: {
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.06em',
            color: tone === 'danger' ? color.danger : tone === 'green' ? color.greenDeep : color.muted,
            ...style,
        }, children: children }));
}
/* ─────────────────────────────── Кнопки ─────────────────────────────── */
export function PrimaryButton({ children, onClick, disabled, style, }) {
    return (_jsx("div", { onClick: disabled ? undefined : onClick, style: {
            cursor: disabled ? 'default' : 'pointer',
            height: 56,
            borderRadius: 18,
            background: disabled ? color.disabled : color.primary,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16,
            fontWeight: 800,
            boxShadow: disabled ? 'none' : shadow.primary,
            ...style,
        }, children: children }));
}
export function GhostButton({ children, onClick, style }) {
    return (_jsx("div", { onClick: onClick, style: {
            cursor: 'pointer',
            minHeight: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14.5,
            fontWeight: 700,
            color: color.primary,
            ...style,
        }, children: children }));
}
export function DarkButton({ children, onClick, style }) {
    return (_jsx("div", { onClick: onClick, style: {
            cursor: 'pointer',
            height: 56,
            borderRadius: 18,
            background: color.ink,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 15,
            fontWeight: 800,
            ...style,
        }, children: children }));
}
/** Кнопка «назад» в шапке экрана. */
export function BackButton({ onClick }) {
    return (_jsx("div", { onClick: onClick, style: {
            cursor: 'pointer',
            width: 40,
            height: 40,
            borderRadius: radius.sm,
            background: color.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: color.ink,
            boxShadow: shadow.raised,
            flex: 'none',
        }, children: "\u2039" }));
}
/* ─────────────────────────────── Чипы и бейджи ─────────────────────────────── */
export function Chip({ children, active, onClick, tone = 'primary', style, }) {
    const on = Boolean(active);
    return (_jsx("div", { onClick: onClick, style: {
            cursor: onClick ? 'pointer' : 'default',
            borderRadius: radius.smAlt,
            padding: '9px 12px',
            fontSize: 12.5,
            fontWeight: on ? 800 : 600,
            ...(on
                ? tone === 'dark'
                    ? { background: color.ink, color: '#fff' }
                    : { background: color.primary, color: '#fff' }
                : { background: color.screen, color: color.ink, border: `1px solid ${color.border}` }),
            ...style,
        }, children: children }));
}
const BADGE_TONE = {
    green: { color: color.greenDeep, background: color.greenBg },
    warn: { color: color.warnText, background: color.warnBg },
    danger: { color: '#fff', background: color.danger },
    neutral: { color: color.muted, background: color.chip },
    primary: { color: color.primary, background: color.primaryBg },
};
export function Badge({ children, tone = 'neutral', style }) {
    return (_jsx("span", { style: {
            display: 'inline-flex',
            alignItems: 'center',
            fontSize: 12,
            fontWeight: 700,
            borderRadius: radius.tag,
            padding: '3px 8px',
            whiteSpace: 'nowrap',
            ...BADGE_TONE[tone],
            ...style,
        }, children: children }));
}
/** Счётчик на иконке нижней навигации. */
export function CountBadge({ count }) {
    if (count <= 0)
        return null;
    return (_jsx("div", { style: {
            position: 'absolute',
            top: -5,
            left: 16,
            background: color.danger,
            color: '#fff',
            fontSize: 9.5,
            fontWeight: 800,
            borderRadius: radius.tag,
            padding: '1px 5px',
        }, children: count }));
}
/* ─────────────────────────────── Прогресс ─────────────────────────────── */
export function ProgressBar({ pct, height = 8, fill = color.primary, track = color.track, }) {
    return (_jsx("div", { style: { flex: 1, height, borderRadius: height / 2, background: track }, children: _jsx("div", { style: {
                width: `${Math.max(0, Math.min(100, pct))}%`,
                height,
                borderRadius: height / 2,
                background: fill,
            } }) }));
}
/** Две полосы, план и факт: разрыв между ними и есть отставание. */
export function PlanFactBars({ planPct, factPct }) {
    const behind = factPct < planPct - 1;
    return (_jsxs(_Fragment, { children: [_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }, children: [_jsx("div", { style: { width: 30, fontSize: 10, color: color.faint }, children: "\u043F\u043B\u0430\u043D" }), _jsx(ProgressBar, { pct: planPct, height: 6, fill: color.faint }), _jsx("div", { style: { width: 38, fontSize: 11, color: color.muted, textAlign: 'right', fontVariantNumeric: font.tabular }, children: formatPct(planPct) })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }, children: [_jsx("div", { style: { width: 30, fontSize: 10, color: color.faint }, children: "\u0444\u0430\u043A\u0442" }), _jsx(ProgressBar, { pct: factPct, height: 6, fill: behind ? color.warnStrong : color.primary }), _jsx("div", { style: { width: 38, fontSize: 11, color: color.muted, textAlign: 'right', fontVariantNumeric: font.tabular }, children: formatPct(factPct) })] })] }));
}
/* ─────────────────────────────── Переключатели ─────────────────────────────── */
export function Segmented({ options, value, onChange, style, }) {
    return (_jsx("div", { style: { display: 'flex', background: color.chipAlt, borderRadius: radius.xs, padding: 3, ...style }, children: options.map((o) => {
            const on = o.value === value;
            return (_jsx("div", { onClick: () => onChange(o.value), style: {
                    cursor: 'pointer',
                    flex: 1,
                    textAlign: 'center',
                    padding: '7px 0',
                    fontSize: 11.5,
                    fontWeight: on ? 800 : 700,
                    ...(on ? { background: color.ink, color: '#fff', borderRadius: radius.xxs } : { color: color.muted }),
                }, children: o.label }, o.value));
        }) }));
}
/** Степпер «Рабочие»: цель касания 44 px — на объекте работают в перчатках. */
export function Stepper({ value, onChange, min = 0, max = 999, }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("div", { onClick: () => onChange(Math.max(min, value - 1)), style: {
                    cursor: 'pointer',
                    width: TOUCH_MIN,
                    height: TOUCH_MIN,
                    borderRadius: radius.sm,
                    background: color.chip,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 800,
                    color: color.ink,
                }, children: "\u2212" }), _jsx("div", { style: {
                    fontSize: 23,
                    fontWeight: 800,
                    color: color.ink,
                    minWidth: 34,
                    textAlign: 'center',
                    fontVariantNumeric: font.tabular,
                }, children: value }), _jsx("div", { onClick: () => onChange(Math.min(max, value + 1)), style: {
                    cursor: 'pointer',
                    width: TOUCH_MIN,
                    height: TOUCH_MIN,
                    borderRadius: radius.sm,
                    background: color.primary,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 20,
                    fontWeight: 800,
                }, children: "+" })] }));
}
/** Чекбокс-квадрат из экранов онбординга и чек-листов. */
export function CheckSquare({ on, size = 26 }) {
    return on ? (_jsx("div", { style: {
            width: size,
            height: size,
            borderRadius: size / 3,
            background: color.primary,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: size / 2,
            flexShrink: 0,
        }, children: "\u2713" })) : (_jsx("div", { style: {
            width: size,
            height: size,
            borderRadius: size / 3,
            border: `2px solid ${color.disabled}`,
            flexShrink: 0,
            boxSizing: 'border-box',
        } }));
}
/* ─────────────────────────────── Поля ─────────────────────────────── */
export function Field({ label, value, onChange, placeholder, type = 'text', hint, }) {
    return (_jsxs("div", { style: {
            background: color.surface,
            border: `1.5px solid ${color.border}`,
            borderRadius: radius.md,
            padding: '12px 16px',
        }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.muted }, children: label }), _jsx("input", { value: value, type: type, placeholder: placeholder, onChange: (e) => onChange(e.target.value), style: {
                    width: '100%',
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 16,
                    fontWeight: 700,
                    color: color.ink,
                    marginTop: 3,
                    padding: '4px 0',
                    fontFamily: 'inherit',
                } }), hint] }));
}
/* ─────────────────────────────── Шторка ─────────────────────────────── */
export function BottomSheet({ children, onClose, style, }) {
    return (_jsxs(_Fragment, { children: [_jsx("div", { onClick: onClose, style: {
                    position: 'absolute',
                    inset: 0,
                    background: 'rgba(20,22,31,0.45)',
                    cursor: 'pointer',
                    zIndex: 10,
                } }), _jsxs("div", { style: {
                    position: 'absolute',
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: color.surface,
                    borderRadius: `${radius.sheet}px ${radius.sheet}px 0 0`,
                    padding: '12px 20px 24px',
                    boxShadow: shadow.sheet,
                    zIndex: 11,
                    maxHeight: '85%',
                    overflowY: 'auto',
                    ...style,
                }, children: [_jsx("div", { style: { width: 44, height: 5, borderRadius: 3, background: color.border, margin: '0 auto' } }), children] })] }));
}
/* ─────────────────────────────── Служебное ─────────────────────────────── */
/** Проценты в русской записи: 68,0%. */
export function formatPct(value) {
    return `${value.toFixed(1).replace('.', ',')}%`;
}
export function formatNumber(value, digits = 0) {
    return value.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
/** «4,83 из 7,1 т» — числа моноширинные, чтобы не прыгали при пересчёте. */
export const tabular = { fontVariantNumeric: font.tabular };
export function Avatar({ initials, size = 44, onClick }) {
    return (_jsx("div", { onClick: onClick, style: {
            cursor: onClick ? 'pointer' : 'default',
            width: size,
            height: size,
            borderRadius: size / 2,
            background: color.primary,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 800,
            fontSize: size / 2.75,
            flex: 'none',
        }, children: initials }));
}
export function initialsOf(fullName) {
    return fullName
        .split(/\s+/)
        .slice(0, 2)
        .map((w) => w[0]?.toUpperCase() ?? '')
        .join('');
}
/** Пустое состояние — их в макете столько же, сколько наполненных экранов. */
export function EmptyState({ icon, title, text, action, secondary, }) {
    return (_jsxs("div", { style: {
            margin: '32px 24px 0',
            background: color.surface,
            borderRadius: radius.xl,
            padding: '30px 24px',
            textAlign: 'center',
            boxShadow: shadow.card,
        }, children: [_jsx("div", { style: { fontSize: 34 }, children: icon }), _jsx("div", { style: { fontSize: 18, fontWeight: 800, color: color.ink, marginTop: 10 }, children: title }), _jsx("div", { style: { fontSize: 14, color: color.inkSoft, marginTop: 6, lineHeight: 1.5 }, children: text }), action ? (_jsx("div", { onClick: action.onClick, style: {
                    cursor: 'pointer',
                    marginTop: 16,
                    height: 52,
                    borderRadius: radius.md,
                    background: color.primary,
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14.5,
                    fontWeight: 800,
                }, children: action.label })) : null, secondary ? (_jsx("div", { onClick: secondary.onClick, style: {
                    cursor: 'pointer',
                    marginTop: 8,
                    minHeight: TOUCH_MIN,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: color.primary,
                }, children: secondary.label })) : null] }));
}
