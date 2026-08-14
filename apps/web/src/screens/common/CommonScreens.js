import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * E1–E3 · «Ещё», профиль, уведомления, а также экран помощника.
 *
 * Меню «Ещё» разное у ролей — это единственное место, где роли расходятся
 * по составу пунктов, а не по данным.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Avatar, Badge, Card, SectionLabel, initialsOf, tabular } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { ROLE_TITLE } from '@build-hub/shared';
import { useApp } from '../../store/app';
const MENU = [
    { label: '🔔 Уведомления', hint: 'что пришло из отделов', screen: 'notifications' },
    { label: '🏗 Подрядчики', hint: 'рейтинг, предписания, оценка этапа', screen: 'contractors', roles: ['prorab', 'master'] },
    { label: '📐 Проект', hint: 'комплекты, действующие листы, RFI', screen: 'project' },
    { label: '📄 Документы', hint: 'акты, протоколы, журналы', screen: 'documents' },
    { label: '🚜 Заявка на технику', hint: 'кран, насос, самосвал', screen: 'zayavka-tech', roles: ['prorab', 'master'] },
    { label: '👤 Профиль', hint: 'данные, зона ответственности, выход', screen: 'profile' },
];
export function MoreScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    if (!me)
        return null;
    const items = MENU.filter((m) => !m.roles || m.roles.includes(me.role));
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0415\u0449\u0451", subtitle: `${me.fullName} · ${ROLE_TITLE[me.role]}` }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: items.map((m) => (_jsx(Card, { onClick: () => go(m.screen), style: { borderRadius: radius.md, padding: '14px 16px' }, children: _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: m.label }), m.hint ? (_jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 2 }, children: m.hint })) : null] }), _jsx("div", { style: { color: color.faint, fontSize: 16, flexShrink: 0 }, children: "\u203A" })] }) }, m.screen))) })] }));
}
/* ───────────────────────────── E2 · Профиль ───────────────────────────── */
export function ProfileScreen() {
    const back = useApp((s) => s.back);
    const logout = useApp((s) => s.logout);
    const me = useApp((s) => s.me);
    if (!me)
        return null;
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041F\u0440\u043E\u0444\u0438\u043B\u044C", onBack: back }), _jsxs(Card, { style: { margin: '4px 20px', display: 'flex', gap: 14, alignItems: 'center' }, children: [_jsx(Avatar, { initials: initialsOf(me.fullName), size: 56 }), _jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 17, fontWeight: 800, color: color.ink }, children: me.fullName }), _jsx("div", { style: { fontSize: 13, color: color.muted, marginTop: 2 }, children: ROLE_TITLE[me.role] })] })] }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(InfoRow, { label: "\u041B\u041E\u0413\u0418\u041D", value: me.login }), _jsx(InfoRow, { label: "\u0422\u0415\u041B\u0415\u0424\u041E\u041D", value: me.phone }), _jsx(InfoRow, { label: "\u0417\u041E\u041D\u0410 \u041E\u0422\u0412\u0415\u0422\u0421\u0422\u0412\u0415\u041D\u041D\u041E\u0421\u0422\u0418", value: [me.object?.name, me.block?.name, me.scopeLabel].filter(Boolean).join(' · ') || 'вся компания' })] }), _jsx("div", { onClick: logout, style: {
                    cursor: 'pointer',
                    margin: '8px 20px',
                    height: 52,
                    borderRadius: radius.md,
                    background: color.surface,
                    border: `1px solid ${color.border}`,
                    color: color.danger,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14.5,
                    fontWeight: 800,
                }, children: "\u0412\u044B\u0439\u0442\u0438" })] }));
}
function InfoRow({ label, value }) {
    return (_jsxs("div", { style: { padding: '8px 0', borderBottom: `1px solid ${color.borderSoft}` }, children: [_jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted }, children: label }), _jsx("div", { style: { fontSize: 14.5, fontWeight: 700, color: color.ink, marginTop: 2 }, children: value })] }));
}
/* ───────────────────────────── E1 · Уведомления ───────────────────────────── */
export function NotificationsScreen() {
    const back = useApp((s) => s.back);
    const { data, reload } = useQuery('/notifications');
    const markAll = useAction(async () => {
        await api.post('/notifications/read-all');
        reload();
    });
    const unread = (data ?? []).filter((n) => !n.read);
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F", subtitle: unread.length > 0 ? `${unread.length} непрочитанных` : 'всё прочитано', onBack: back, right: unread.length > 0 ? (_jsx("div", { onClick: () => markAll.run(), style: { cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: color.primary, flexShrink: 0 }, children: "\u043F\u0440\u043E\u0447\u0438\u0442\u0430\u0442\u044C \u0432\u0441\u0451" })) : undefined }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: [(data ?? []).map((n) => (_jsxs(Card, { onClick: async () => {
                            if (!n.read) {
                                await api.post(`/notifications/${n.id}/read`);
                                reload();
                            }
                        }, style: {
                            borderRadius: radius.md,
                            padding: '14px 16px',
                            ...(n.read ? { opacity: 0.65 } : { border: `1px solid ${color.primaryBorder}` }),
                        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: color.ink, minWidth: 0 }, children: n.title }), _jsx("div", { style: { fontSize: 11.5, color: color.faint, whiteSpace: 'nowrap', flexShrink: 0 }, children: new Date(n.at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) })] }), _jsx("div", { style: { fontSize: 12.5, color: color.inkSoft, marginTop: 3, lineHeight: 1.45 }, children: n.subtitle })] }, n.id))), (data ?? []).length === 0 ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: color.muted, fontSize: 13.5 }, children: "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 \u043D\u0435\u0442" })) : null] })] }));
}
/* ───────────────────────────── AI · Помощник ───────────────────────────── */
export function AssistantScreen() {
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const [text, setText] = useState('');
    const [answer, setAnswer] = useState(null);
    const { data: suggestions } = useQuery('/assistant/suggestions');
    const ask = useAction(async (payload) => {
        const res = await api.post('/assistant/ask', payload);
        setAnswer(res);
        setText('');
    });
    const list = answer?.suggestions ?? suggestions ?? [];
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041F\u043E\u043C\u043E\u0449\u043D\u0438\u043A", subtitle: "\u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u043F\u043E \u0434\u0430\u043D\u043D\u044B\u043C \u0441\u0438\u0441\u0442\u0435\u043C\u044B", onBack: back }), answer ? (_jsxs(Card, { style: { margin: '4px 20px' }, children: [answer.question ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.muted }, children: answer.question })) : null, _jsx("div", { style: {
                            fontSize: 14.5,
                            color: color.ink,
                            marginTop: 6,
                            lineHeight: 1.55,
                            whiteSpace: 'pre-wrap',
                            ...tabular,
                        }, children: answer.text }), answer.source ? (_jsxs("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 8 }, children: ["\u0418\u0441\u0442\u043E\u0447\u043D\u0438\u043A: ", answer.source] })) : null, answer.actions.length > 0 ? (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }, children: answer.actions.map((a) => (_jsx("div", { onClick: () => go(a.screen), style: {
                                cursor: 'pointer',
                                background: color.primaryBg,
                                color: color.primary,
                                border: `1px solid ${color.primaryBorder}`,
                                borderRadius: radius.xs,
                                padding: '9px 12px',
                                fontSize: 12.5,
                                fontWeight: 800,
                            }, children: a.label }, a.label))) })) : null] })) : (_jsx("div", { style: {
                    margin: '4px 20px',
                    background: color.primaryBg,
                    border: `1px solid ${color.primaryBorder}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    fontSize: 13,
                    color: color.primaryDark,
                    lineHeight: 1.5,
                }, children: "\u041E\u0442\u0432\u0435\u0447\u0430\u044E \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E \u0442\u0435\u043C \u0434\u0430\u043D\u043D\u044B\u043C, \u043A \u043A\u043E\u0442\u043E\u0440\u044B\u043C \u0443 \u0432\u0430\u0441 \u0435\u0441\u0442\u044C \u0434\u043E\u0441\u0442\u0443\u043F. \u0427\u0438\u0441\u043B\u0430 \u0431\u0435\u0440\u0443 \u0438\u0437 \u0431\u0430\u0437\u044B, \u043A \u043A\u0430\u0436\u0434\u043E\u043C\u0443 \u043E\u0442\u0432\u0435\u0442\u0443 \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u044E \u0438\u0441\u0442\u043E\u0447\u043D\u0438\u043A. \u0415\u0441\u043B\u0438 \u043E\u0442\u0432\u0435\u0442\u0430 \u043D\u0435\u0442 \u2014 \u0442\u0430\u043A \u0438 \u0441\u043A\u0430\u0436\u0443." })), _jsx(SectionLabel, { style: { padding: '14px 20px 6px' }, children: "\u0427\u0422\u041E \u041C\u041E\u0416\u041D\u041E \u0421\u041F\u0420\u041E\u0421\u0418\u0422\u042C" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: list.map((s) => (_jsx("div", { onClick: () => ask.run({ key: s.key }), style: {
                        cursor: 'pointer',
                        background: color.surface,
                        borderRadius: radius.sm,
                        padding: '12px 14px',
                        fontSize: 13.5,
                        color: color.ink,
                        boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                    }, children: s.question }, s.key))) }), _jsxs("div", { style: {
                    marginTop: 'auto',
                    padding: '12px 20px 24px',
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                }, children: [_jsx("input", { value: text, onChange: (e) => setText(e.target.value), onKeyDown: (e) => {
                            if (e.key === 'Enter' && text.trim())
                                ask.run({ text });
                        }, placeholder: "\u0421\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u0441\u0432\u043E\u0438\u043C\u0438 \u0441\u043B\u043E\u0432\u0430\u043C\u0438", style: {
                            flex: 1,
                            boxSizing: 'border-box',
                            border: `1px solid ${color.border}`,
                            outline: 'none',
                            background: color.surface,
                            borderRadius: radius.sm,
                            padding: '13px 14px',
                            fontSize: 14,
                            color: color.ink,
                            fontFamily: 'inherit',
                        } }), _jsx("div", { style: {
                            width: 48,
                            height: 48,
                            borderRadius: radius.sm,
                            background: color.primaryBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            flex: 'none',
                        }, children: "\uD83C\uDFA4" })] })] }));
}
export { Badge };
