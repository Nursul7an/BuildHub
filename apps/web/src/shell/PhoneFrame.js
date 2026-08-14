import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { PHONE_MIN_HEIGHT, PHONE_WIDTH, color, radius, shadow } from '../design/tokens';
import { IconAssistant } from '../design/icons';
export function PhoneFrame({ children, clock, onAssistant, toast, }) {
    return (_jsxs("div", { style: {
            width: PHONE_WIDTH,
            background: color.screen,
            borderRadius: radius.phone,
            border: `8px solid ${color.ink}`,
            overflow: 'hidden',
            boxShadow: shadow.phone,
            display: 'flex',
            flexDirection: 'column',
            minHeight: PHONE_MIN_HEIGHT,
            maxHeight: '92vh',
            position: 'relative',
            flex: 'none',
        }, children: [_jsxs("div", { style: {
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 22px 0',
                    fontSize: 12,
                    fontWeight: 700,
                    color: color.ink,
                    fontVariantNumeric: 'tabular-nums',
                    flex: 'none',
                }, children: [_jsx("span", { children: clock }), _jsx("span", { children: "\u25AE\u25AE\u25AE 78%" })] }), onAssistant ? (_jsxs("div", { onClick: onAssistant, title: "\u041F\u043E\u043C\u043E\u0449\u043D\u0438\u043A", style: {
                    cursor: 'pointer',
                    position: 'absolute',
                    right: 0,
                    top: '46%',
                    width: 44,
                    height: 64,
                    borderRadius: '18px 0 0 18px',
                    background: `linear-gradient(160deg, ${color.primaryLight}, ${color.primary})`,
                    color: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 1,
                    boxShadow: shadow.fab,
                    border: '1.5px solid #fff',
                    borderRight: 'none',
                    zIndex: 6,
                }, children: [_jsx(IconAssistant, {}), _jsx("div", { style: { fontSize: 8, fontWeight: 800, letterSpacing: '0.02em' }, children: "AI" })] })) : null, children, toast ? (_jsx("div", { style: {
                    position: 'absolute',
                    left: 16,
                    right: 16,
                    bottom: 92,
                    background: color.ink,
                    color: '#fff',
                    borderRadius: radius.sm,
                    padding: '12px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    lineHeight: 1.4,
                    boxShadow: shadow.phone,
                    zIndex: 20,
                }, children: toast })) : null] }));
}
/** Прокручиваемая часть экрана между шапкой и нижней навигацией. */
export function ScreenBody({ children, style }) {
    return (_jsx("div", { style: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', ...style }, children: children }));
}
