import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Левая колонка прототипа: быстрая смена роли и подсказка по сценарию.
 * Это витрина для демонстрации, а не часть продукта — в приложении на телефоне
 * её нет, роль определяется учётной записью.
 */
import { useState } from 'react';
import { color, radius } from '../design/tokens';
import { ROLE_TITLE } from '@build-hub/shared';
import { useApp, homeScreen } from '../store/app';
import { api, setToken } from '../api/client';
const DEMO_USERS = [
    { login: 'a.zhumabekov', role: 'prorab', label: '👷 Прораб · Азамат Ж.' },
    { login: 't.mamatov', role: 'master', label: '👷 Мастер · Тилек М.' },
    { login: 'g.sadykova', role: 'pto', label: '📋 Инженер ПТО · Гульмира С.' },
    { login: 'n.toktomatov', role: 'dir', label: '📊 Директор · Нурлан Т.' },
    { login: 'n.tashiev', role: 'gi', label: '📊 Гл. инженер · Нурлан Т.' },
    { login: 'e.bakirov', role: 'snab', label: '📦 Снабжение · Эркин Б.' },
    { login: 'm.abdyldaev', role: 'sklad', label: '📦 Завсклад · Мирлан А.' },
    { login: 'k.turgunov', role: 'tech', label: '🚜 Спецтехника · Кубанычбек Т.' },
];
const DEMO_PASSWORD = 'buildhub2026';
export function DemoPanel() {
    const me = useApp((s) => s.me);
    const [busy, setBusy] = useState(null);
    async function switchTo(login) {
        setBusy(login);
        try {
            const res = await api.post('/auth/login', { login, password: DEMO_PASSWORD });
            setToken(res.token);
            const next = await api.get('/auth/me');
            useApp.setState({ me: next, screen: homeScreen(next.role), params: {}, history: [], toast: null });
        }
        finally {
            setBusy(null);
        }
    }
    return (_jsxs("div", { style: {
            width: 270,
            paddingTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
            position: 'sticky',
            top: 36,
            flex: 'none',
        }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: color.muted }, children: "BUILD HUB \u00B7 \u0414\u0415\u041C\u041E\u041D\u0421\u0422\u0420\u0410\u0426\u0418\u042F" }), _jsx("div", { style: { fontSize: 21, fontWeight: 800, color: color.ink, lineHeight: 1.25 }, children: "\u0412\u0441\u0435 \u044D\u043A\u0440\u0430\u043D\u044B \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F, \u043D\u0430 \u0436\u0438\u0432\u044B\u0445 \u0434\u0430\u043D\u043D\u044B\u0445" }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: color.muted }, children: "\u0420\u041E\u041B\u042C" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: DEMO_USERS.map((u) => {
                    const on = me?.login === u.login;
                    return (_jsx("div", { onClick: () => !on && switchTo(u.login), style: {
                            cursor: on ? 'default' : 'pointer',
                            borderRadius: radius.smAlt,
                            padding: '11px 14px',
                            fontSize: 13.5,
                            fontWeight: 700,
                            opacity: busy === u.login ? 0.6 : 1,
                            ...(on
                                ? { background: color.primary, color: '#fff', border: `1px solid ${color.primary}` }
                                : { background: color.surface, color: color.ink, border: `1px solid ${color.border}` }),
                        }, children: u.label }, u.login));
                }) }), _jsxs("div", { style: {
                    background: color.surface,
                    border: `1px solid ${color.border}`,
                    borderRadius: radius.sm,
                    padding: '14px 16px',
                    fontSize: 12.5,
                    color: color.inkMuted,
                    lineHeight: 1.6,
                }, children: [_jsx("b", { style: { color: color.ink }, children: "\u0413\u043B\u0430\u0432\u043D\u044B\u0439 \u043F\u0443\u0442\u044C \u043F\u0440\u043E\u0440\u0430\u0431\u0430:" }), " \u0421\u0435\u0433\u043E\u0434\u043D\u044F \u2192 \u00AB\u0413\u043E\u0440\u0438\u0442\u00BB \u2192 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0430 \u2192 \u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439 \u2192 \u00AB\u041D\u0435\u0445\u0432\u0430\u0442\u043A\u0430 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430\u00BB \u2192 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u2192 \u0437\u0430\u044F\u0432\u043A\u0430 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435. \u041F\u043B\u044E\u0441: \u0420\u0430\u0431\u043E\u0442\u044B \u2192 \u041C\u043E\u043D\u043E\u043B\u0438\u0442 \u2192 \u0446\u0435\u043F\u043E\u0447\u043A\u0430 16 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0432.", _jsx("br", {}), _jsx("br", {}), _jsx("b", { style: { color: color.ink }, children: "\u041F\u0422\u041E:" }), " \u043E\u0447\u0435\u0440\u0435\u0434\u044C \u2192 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0430 \u2192 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C / \u0441\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C / \u0432\u0435\u0440\u043D\u0443\u0442\u044C.", _jsx("br", {}), _jsx("br", {}), _jsx("b", { style: { color: color.ink }, children: "\u0420\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u043E:" }), " \u0441\u0432\u043E\u0434\u043A\u0430 \u2192 \u00AB\u0422\u0440\u0435\u0431\u0443\u0435\u0442 \u0440\u0435\u0448\u0435\u043D\u0438\u044F\u00BB \u2192 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0430 \u043F\u0440\u043E\u0441\u0442\u043E\u044F \u2192 \u043F\u043E\u0440\u0443\u0447\u0438\u0442\u044C \u2192 \u0437\u0430\u0434\u0430\u0447\u0430 \u0432 \u0440\u0435\u0435\u0441\u0442\u0440\u0435."] }), me ? (_jsxs("div", { style: { fontSize: 12, color: color.faint, lineHeight: 1.5 }, children: ["\u0412\u043E\u0448\u043B\u0438: ", me.fullName, " \u00B7 ", ROLE_TITLE[me.role], _jsx("br", {}), "\u0414\u0430\u043D\u043D\u044B\u0435 \u2014 \u0438\u0437 \u0431\u0430\u0437\u044B, \u043D\u0435 \u0438\u0437 \u043C\u0430\u043A\u0435\u0442\u0430: \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F \u043E\u0434\u043D\u043E\u0439 \u0440\u043E\u043B\u0438 \u0432\u0438\u0434\u043D\u044B \u0434\u0440\u0443\u0433\u043E\u0439."] })) : null] }));
}
