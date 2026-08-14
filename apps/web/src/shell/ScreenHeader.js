import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { color } from '../design/tokens';
import { BackButton } from '../design/primitives';
/** Шапка внутреннего экрана: назад, заголовок, подпись, действие справа. */
export function ScreenHeader({ title, subtitle, onBack, right, padding = '14px 20px 8px', }) {
    return (_jsxs("div", { style: { padding, display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }, children: [onBack ? _jsx(BackButton, { onClick: onBack }) : null, _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 17, fontWeight: 800, color: color.ink }, children: title }), subtitle ? _jsx("div", { style: { fontSize: 13, color: color.muted }, children: subtitle }) : null] }), right] }));
}
/** Шапка корневого экрана таба — крупный заголовок без кнопки «назад». */
export function RootHeader({ title, subtitle, right, }) {
    return (_jsxs("div", { style: {
            padding: '16px 20px 8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 12,
            flex: 'none',
        }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 22, fontWeight: 800, color: color.ink }, children: title }), subtitle ? _jsx("div", { style: { fontSize: 13, color: color.muted, marginTop: 3 }, children: subtitle }) : null] }), right] }));
}
