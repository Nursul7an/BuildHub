import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Руководство: директор и главный инженер.
 *
 * Одна структура, разное наполнение. Четвёртый таб — предметная область роли:
 * у директора «Финансы», у главного инженера «Качество». Профиль, KPI, лимиты
 * и планёрка открываются из шапки, а не занимают таб.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Avatar, Badge, Card, Chip, PrimaryButton, ProgressBar, SectionLabel, Segmented, formatNumber, initialsOf, tabular, } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
/** Крупные суммы — в миллионах сомов, как их называют вслух. */
function mln(value) {
    return `${formatNumber(value, value % 1 ? 1 : 0)} млн`;
}
function deltaColor(days) {
    if (days <= -5)
        return color.danger;
    if (days < 0)
        return color.warnStrong;
    return color.greenDeep;
}
/** Кнопка «Ещё» есть в шапке каждого экрана руководства, а не только на сводке. */
function BossHeaderRight() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const [open, setOpen] = useState(false);
    const items = [
        { label: '📊 KPI сотрудников', screen: 'boss-kpi' },
        ...(me?.role === 'gi'
            ? [
                { label: '🏗 Объекты компании', screen: 'boss-company-objects' },
                { label: '🗓 Задачи и сроки прорабам', screen: 'boss-assign' },
                { label: '👥 Пользователи и доступы', screen: 'pto-users' },
            ]
            : [
                { label: '⚖ Лимиты автономности', screen: 'boss-limits' },
                { label: '🖥 Режим планёрки', screen: 'boss-planerka' },
            ]),
        { label: '👤 Профиль', screen: 'profile' },
    ];
    return (_jsxs("div", { style: { position: 'relative', flex: 'none' }, children: [_jsx("div", { onClick: () => setOpen((v) => !v), style: { cursor: 'pointer' }, children: _jsx(Avatar, { initials: me ? initialsOf(me.fullName) : '—' }) }), open ? (_jsxs(_Fragment, { children: [_jsx("div", { onClick: () => setOpen(false), style: { position: 'fixed', inset: 0, zIndex: 15 } }), _jsx("div", { style: {
                            position: 'absolute',
                            right: 0,
                            top: 50,
                            width: 236,
                            background: color.surface,
                            borderRadius: radius.md,
                            boxShadow: '0 12px 32px rgba(20,22,31,0.20)',
                            padding: 6,
                            zIndex: 16,
                        }, children: items.map((i) => (_jsx("div", { onClick: () => {
                                setOpen(false);
                                go(i.screen);
                            }, style: {
                                cursor: 'pointer',
                                padding: '11px 12px',
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: color.ink,
                                borderRadius: radius.xs,
                            }, children: i.label }, i.label))) })] })) : null] }));
}
/* ───────────────────────────── Сводка ───────────────────────────── */
export function BossDigestScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const { data } = useQuery('/boss/digest');
    if (!data)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0441\u0432\u043E\u0434\u043A\u0443\u2026" });
    const isGi = me?.role === 'gi';
    const worst = [...data.objects].sort((a, b) => a.deltaDays - b.deltaDays)[0];
    const totalIdle = data.incidents.reduce((a, i) => a + (i.cost ?? 0), 0);
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0421\u0432\u043E\u0434\u043A\u0430", subtitle: new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }), right: _jsx(BossHeaderRight, {}) }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx(SectionLabel, { children: "\u0413\u041B\u0410\u0412\u041D\u041E\u0415" }), _jsxs("div", { style: { fontSize: 14.5, color: color.ink, marginTop: 8, lineHeight: 1.55 }, children: [worst && worst.deltaDays < 0 ? (_jsxs(_Fragment, { children: [_jsx("b", { children: worst.name }), " \u043E\u0442\u0441\u0442\u0430\u0451\u0442 \u043D\u0430 ", Math.abs(worst.deltaDays), " \u0434\u043D.", worst.cpi !== null && worst.cpi < 1
                                        ? ` и тратит быстрее, чем зарабатывает (CPI ${worst.cpi.toFixed(2).replace('.', ',')}).`
                                        : '.', ' '] })) : ('Объекты идут по графику. '), totalIdle > 0 ? (_jsxs(_Fragment, { children: ["\u041E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 \u043F\u0440\u043E\u0431\u043B\u0435\u043C \u043D\u0430 ", _jsxs("b", { children: [formatNumber(totalIdle), " \u0441\u043E\u043C"] }), "."] })) : null] })] }), _jsx(SectionLabel, { style: { padding: '14px 20px 6px' }, children: "\u041F\u041E \u041E\u0411\u042A\u0415\u041A\u0422\u0410\u041C" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }, children: data.objects.map((o) => (_jsxs(Card, { onClick: () => go('boss-object', { objectId: o.id }), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink, minWidth: 0 }, children: o.name }), _jsx("div", { style: { fontSize: 13.5, fontWeight: 800, color: deltaColor(o.deltaDays), ...tabular }, children: o.deltaDays === 0 ? 'по графику' : `${o.deltaDays} дн.` })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }, children: [_jsx(ProgressBar, { pct: o.pctFact, fill: o.deltaDays < 0 ? color.warnStrong : color.primary }), _jsxs("div", { style: { fontSize: 13, fontWeight: 800, color: color.ink, ...tabular }, children: [o.pctFact.toFixed(1).replace('.', ','), "%"] })] }), _jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 4, ...tabular }, children: ["\u043F\u043B\u0430\u043D ", o.pctPlan, "%", o.responsible ? ` · ${o.responsible}` : '', !isGi && o.cpi !== null ? ` · CPI ${o.cpi.toFixed(2).replace('.', ',')}` : ''] })] }, o.id))) }), _jsxs(SectionLabel, { tone: "danger", style: { padding: '14px 20px 6px', fontSize: 12.5, fontWeight: 800 }, children: [isGi ? 'БЕЗОПАСНОСТЬ И КАЧЕСТВО' : 'ТРЕБУЕТ ВАС', " \u00B7 ", data.incidents.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }, children: data.incidents.slice(0, 4).map((i) => (_jsxs(Card, { onClick: () => go('boss-inbox', { incidentId: i.id }), style: { borderRadius: radius.md, padding: '14px 16px', border: '1.5px solid #F0B4B0' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }, children: i.title }), i.cost ? (_jsxs("div", { style: { fontSize: 13, fontWeight: 800, color: color.danger, flexShrink: 0, ...tabular }, children: [formatNumber(i.cost), " \u0441\u043E\u043C"] })) : null] }), _jsxs("div", { style: { fontSize: 12.5, color: color.inkMuted, marginTop: 4, lineHeight: 1.45 }, children: [i.objectName, " \u00B7 ", i.detail] })] }, i.id))) })] }));
}
/* ───────────────────────────── Задачи ───────────────────────────── */
export function BossInboxScreen() {
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const [tab, setTab] = useState('incoming');
    const [assigning, setAssigning] = useState(null);
    const [assigneeId, setAssigneeId] = useState(null);
    const [due, setDue] = useState(() => new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));
    const { data, reload } = useQuery('/boss/digest');
    const { data: tasks, reload: reloadTasks } = useQuery('/boss/tasks');
    const { data: users } = useQuery('/users?role=prorab');
    const assign = useAction(async (incidentId, text, objectId) => {
        await api.post('/boss/tasks', {
            text,
            objectId,
            assigneeId,
            dueDate: due,
            incidentId,
            origin: 'inbox',
        });
        notify('Поручено · задача в реестре и в карточке объекта');
        setAssigning(null);
        setAssigneeId(null);
        reload();
        reloadTasks();
    });
    const incidents = data?.incidents ?? [];
    const issued = (tasks ?? []).filter((t) => t.status !== 'done');
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0417\u0430\u0434\u0430\u0447\u0438", right: _jsx(BossHeaderRight, {}) }), _jsx("div", { style: { padding: '0 20px 8px' }, children: _jsx(Segmented, { value: tab, onChange: setTab, options: [
                        { value: 'incoming', label: `Требуют меня · ${incidents.length}` },
                        { value: 'outgoing', label: `Я поручил · ${issued.length}` },
                    ] }) }), tab === 'incoming' ? (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: [incidents.map((i) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }, children: i.title }), i.cost ? (_jsxs("div", { style: { fontSize: 13, fontWeight: 800, color: color.danger, flexShrink: 0, ...tabular }, children: [formatNumber(i.cost), " \u0441\u043E\u043C"] })) : null] }), _jsxs("div", { style: { fontSize: 12.5, color: color.inkMuted, marginTop: 4, lineHeight: 1.45 }, children: [i.objectName, " \u00B7 ", i.detail] }), assigning === i.id ? (_jsxs("div", { style: { marginTop: 12, background: color.screen, borderRadius: radius.xs, padding: '10px 12px' }, children: [_jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted }, children: "\u041A\u041E\u041C\u0423" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }, children: (users ?? []).map((u) => (_jsx(Chip, { active: assigneeId === u.id, onClick: () => setAssigneeId(u.id), style: { fontSize: 12 }, children: u.fullName }, u.id))) }), _jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 10 }, children: "\u0421\u0420\u041E\u041A" }), _jsx("input", { type: "date", value: due, onChange: (e) => setDue(e.target.value), style: {
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            border: 'none',
                                            outline: 'none',
                                            background: color.surface,
                                            borderRadius: radius.xs,
                                            padding: '10px 12px',
                                            fontSize: 14,
                                            fontWeight: 700,
                                            color: color.ink,
                                            marginTop: 6,
                                            fontFamily: 'inherit',
                                        } }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 10 }, children: [_jsx("div", { onClick: () => setAssigning(null), style: {
                                                    cursor: 'pointer',
                                                    flex: 1,
                                                    textAlign: 'center',
                                                    background: color.chip,
                                                    borderRadius: radius.xs,
                                                    padding: '10px 0',
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    color: color.ink,
                                                }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("div", { onClick: () => assigneeId && assign.run(i.id, `Разобраться: ${i.title}`, i.objectId), style: {
                                                    cursor: 'pointer',
                                                    flex: 1.2,
                                                    textAlign: 'center',
                                                    background: assigneeId ? color.primary : color.disabled,
                                                    color: '#fff',
                                                    borderRadius: radius.xs,
                                                    padding: '10px 0',
                                                    fontSize: 13,
                                                    fontWeight: 800,
                                                }, children: "\u041F\u043E\u0440\u0443\u0447\u0438\u0442\u044C" })] })] })) : (_jsx("div", { onClick: () => setAssigning(i.id), style: {
                                    cursor: 'pointer',
                                    marginTop: 10,
                                    height: 44,
                                    borderRadius: radius.xs,
                                    background: color.primaryBg,
                                    color: color.primary,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 13.5,
                                    fontWeight: 800,
                                }, children: "\u041F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u0434\u0430\u0447\u0443" }))] }, i.id))), incidents.length === 0 ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: color.muted, fontSize: 13.5 }, children: "\u041D\u0435\u0440\u0435\u0448\u0451\u043D\u043D\u044B\u0445 \u0432\u043E\u043F\u0440\u043E\u0441\u043E\u0432 \u043D\u0435\u0442" })) : null] })) : (_jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: issued.map((t) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }, children: t.text }), _jsx(Badge, { tone: t.overdue ? 'warn' : 'neutral', style: { flexShrink: 0 }, children: t.overdue ? 'просрочено' : new Date(t.dueDate).toLocaleDateString('ru-RU') })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 4 }, children: [t.assignee ?? 'исполнитель не назначен', " \u00B7 ", t.objectName] }), _jsx("div", { onClick: async () => {
                                await api.post(`/boss/tasks/${t.id}/done`);
                                reloadTasks();
                            }, style: { cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: color.primary, marginTop: 8 }, children: "\u041E\u0442\u043C\u0435\u0442\u0438\u0442\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0439" })] }, t.id))) }))] }));
}
/* ───────────────────────────── Объекты ───────────────────────────── */
export function BossObjectsScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const { data } = useQuery('/boss/digest');
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u041E\u0431\u044A\u0435\u043A\u0442\u044B", right: _jsx(BossHeaderRight, {}) }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: (data?.objects ?? []).map((o) => (_jsxs(Card, { onClick: () => go('boss-object', { objectId: o.id }), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink }, children: o.name }), _jsx("div", { style: { fontSize: 13, fontWeight: 800, color: deltaColor(o.deltaDays), ...tabular }, children: o.deltaDays === 0 ? 'по графику' : `${o.deltaDays} дн.` })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }, children: [_jsx(ProgressBar, { pct: o.pctFact }), _jsxs("div", { style: { fontSize: 13, fontWeight: 800, color: color.ink, ...tabular }, children: [o.pctFact.toFixed(1).replace('.', ','), "%"] })] }), _jsx("div", { style: { fontSize: 12, color: color.muted, marginTop: 5, ...tabular }, children: me?.role === 'gi'
                                ? `${o.responsible ?? 'ответственный не назначен'}`
                                : o.cpi !== null
                                    ? `CPI ${o.cpi.toFixed(2).replace('.', ',')} · прогноз ${o.eac} млн из ${o.budget} млн`
                                    : 'финансы не заведены' })] }, o.id))) })] }));
}
export function BossObjectScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const me = useApp((s) => s.me);
    const { data } = useQuery('/boss/digest');
    const { data: tasks } = useQuery(params.objectId ? `/boss/tasks?objectId=${params.objectId}` : null);
    const object = data?.objects.find((o) => o.id === params.objectId);
    const finance = data?.finance.find((f) => f.objectId === params.objectId);
    const incidents = (data?.incidents ?? []).filter((i) => i.objectId === params.objectId);
    if (!object)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: object.name, subtitle: object.responsible ?? '', onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8 }, children: [_jsxs("div", { style: { fontSize: 32, fontWeight: 800, color: color.ink, ...tabular }, children: [object.pctFact.toFixed(1).replace('.', ','), "%"] }), _jsxs("div", { style: { fontSize: 14, color: color.muted, ...tabular }, children: ["\u0444\u0430\u043A\u0442 \u00B7 \u043F\u043B\u0430\u043D ", object.pctPlan, "%"] }), _jsx("div", { style: {
                                    marginLeft: 'auto',
                                    fontSize: 15,
                                    fontWeight: 800,
                                    color: deltaColor(object.deltaDays),
                                    ...tabular,
                                }, children: object.deltaDays === 0 ? 'по графику' : `${object.deltaDays} дн.` })] }), _jsx("div", { style: { display: 'flex', marginTop: 10 }, children: _jsx(ProgressBar, { pct: object.pctFact, height: 10 }) })] }), me?.role !== 'gi' && finance ? (_jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u0414\u0415\u041D\u042C\u0413\u0418" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }, children: [_jsx(Fact, { label: "\u0411\u044E\u0434\u0436\u0435\u0442", value: mln(finance.budget) }), _jsx(Fact, { label: "\u041E\u0441\u0432\u043E\u0435\u043D\u043E", value: mln(finance.ev) }), _jsx(Fact, { label: "\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E", value: mln(finance.ac) }), _jsx(Fact, { label: "\u0417\u0430\u043A\u0440\u044B\u0442\u043E \u0430\u043A\u0442\u0430\u043C\u0438", value: mln(finance.closedByActs) }), _jsx(Fact, { label: "\u041D\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u043E", value: mln(finance.notClosed), tone: finance.notClosed > 20 ? color.warnStrong : undefined }), _jsx(Fact, { label: "\u041F\u0440\u043E\u0433\u043D\u043E\u0437 (EAC)", value: mln(finance.eac), tone: finance.vac < 0 ? color.danger : color.greenDeep })] })] })) : null, incidents.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs(SectionLabel, { tone: "danger", style: { padding: '12px 20px 6px' }, children: ["\u041F\u0420\u041E\u0411\u041B\u0415\u041C\u042B \u00B7 ", incidents.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: incidents.map((i) => (_jsxs(Card, { style: { borderRadius: radius.sm, padding: '12px 14px' }, children: [_jsx("div", { style: { fontSize: 13.5, fontWeight: 800, color: color.ink }, children: i.title }), _jsx("div", { style: { fontSize: 12, color: color.muted, marginTop: 3 }, children: i.detail })] }, i.id))) })] })) : null, (tasks ?? []).length > 0 ? (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { style: { padding: '12px 20px 6px' }, children: "\u0417\u0410\u0414\u0410\u0427\u0418 \u041F\u041E \u041E\u0411\u042A\u0415\u041A\u0422\u0423" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px 20px' }, children: tasks.map((t) => (_jsxs(Card, { style: { borderRadius: radius.sm, padding: '12px 14px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 8 }, children: [_jsx("div", { style: { fontSize: 13.5, fontWeight: 700, color: color.ink, minWidth: 0 }, children: t.text }), _jsx(Badge, { tone: t.overdue ? 'warn' : 'neutral', style: { flexShrink: 0 }, children: new Date(t.dueDate).toLocaleDateString('ru-RU') })] }), _jsx("div", { style: { fontSize: 12, color: color.muted, marginTop: 3 }, children: t.assignee ?? '—' })] }, t.id))) })] })) : null] }));
}
function Fact({ label, value, tone }) {
    return (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 11.5, color: color.muted }, children: label }), _jsx("div", { style: { fontSize: 17, fontWeight: 800, color: tone ?? color.ink, marginTop: 2, ...tabular }, children: value })] }));
}
/* ───────────────────────────── Финансы ───────────────────────────── */
export function BossFinanceScreen() {
    const go = useApp((s) => s.go);
    const { data } = useQuery('/boss/finance');
    if (!data)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0444\u0438\u043D\u0430\u043D\u0441\u044B\u2026" });
    const totals = data.objects.reduce((a, o) => ({
        budget: a.budget + o.budget,
        ev: a.ev + o.ev,
        ac: a.ac + o.ac,
        closed: a.closed + o.closedByActs,
        notClosed: a.notClosed + o.notClosed,
    }), { budget: 0, ev: 0, ac: 0, closed: 0, notClosed: 0 });
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0424\u0438\u043D\u0430\u043D\u0441\u044B", right: _jsx(BossHeaderRight, {}) }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '4px 20px 0' }, children: [_jsx(Tile, { label: "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E", value: mln(totals.ev) }), _jsx(Tile, { label: "\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E", value: mln(totals.ac), tone: totals.ac > totals.ev ? color.warnStrong : undefined }), _jsx(Tile, { label: "\u0417\u0430\u043A\u0440\u044B\u0442\u043E \u0430\u043A\u0442\u0430\u043C\u0438", value: mln(totals.closed) }), _jsx(Tile, { label: "\u041D\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u043E", value: mln(totals.notClosed), tone: color.danger, hint: "\u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E, \u043D\u043E \u043D\u0435 \u043F\u0440\u0435\u0434\u044A\u044F\u0432\u043B\u0435\u043D\u043E \u0437\u0430\u043A\u0430\u0437\u0447\u0438\u043A\u0443" })] }), _jsx(SectionLabel, { style: { padding: '14px 20px 6px' }, children: "\u041E\u0411\u042A\u0415\u041A\u0422\u042B \u00B7 \u043F\u043E \u0432\u0435\u043B\u0438\u0447\u0438\u043D\u0435 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u044F" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }, children: [...data.objects]
                    .sort((a, b) => a.vac - b.vac)
                    .map((o) => (_jsxs(Card, { onClick: () => go('boss-finance-object', { objectId: o.objectId }), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: o.objectName }), _jsxs("div", { style: {
                                        fontSize: 14,
                                        fontWeight: 800,
                                        color: o.vac < 0 ? color.danger : color.greenDeep,
                                        ...tabular,
                                    }, children: [o.vac < 0 ? '' : '+', mln(o.vac)] })] }), _jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 4, ...tabular }, children: ["CPI ", o.cpi.toFixed(2).replace('.', ','), " \u00B7 \u043F\u0440\u043E\u0433\u043D\u043E\u0437 ", mln(o.eac), " \u043F\u0440\u0438 \u0431\u044E\u0434\u0436\u0435\u0442\u0435 ", mln(o.budget)] })] }, o.objectId))) }), _jsx(SectionLabel, { style: { padding: '14px 20px 6px' }, children: "\u0420\u0410\u0421\u0425\u041E\u0414 \u041F\u041E \u0421\u0422\u0410\u0422\u042C\u042F\u041C" }), _jsx("div", { style: { padding: '0 20px' }, children: _jsx(Card, { children: data.articles.map((a) => (_jsxs("div", { style: { marginBottom: 10 }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 8 }, children: [_jsx("div", { style: { fontSize: 13.5, fontWeight: 700, color: color.ink }, children: a.name }), _jsxs("div", { style: { fontSize: 13.5, fontWeight: 800, color: color.ink, ...tabular }, children: [mln(a.amount), " \u00B7 ", a.pct.toFixed(0), "%"] })] }), _jsx("div", { style: { display: 'flex', marginTop: 5 }, children: _jsx(ProgressBar, { pct: a.pct, height: 6, fill: a.note ? color.warnStrong : color.primary }) }), a.note ? (_jsx("div", { style: { fontSize: 11.5, color: color.warnText, fontWeight: 700, marginTop: 3 }, children: a.note })) : null] }, a.name))) }) }), _jsx("div", { style: { padding: '14px 20px 20px' }, children: _jsxs("div", { onClick: () => go('boss-week'), style: {
                        cursor: 'pointer',
                        height: 52,
                        borderRadius: radius.md,
                        background: color.surface,
                        border: `1px solid ${color.border}`,
                        color: color.ink,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14.5,
                        fontWeight: 800,
                    }, children: ["\uD83D\uDCB0 \u0414\u0435\u043D\u044C\u0433\u0438 \u043D\u0430 \u043D\u0435\u0434\u0435\u043B\u044E \u00B7 ", data.payments.length, " \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439"] }) })] }));
}
function Tile({ label, value, tone, hint }) {
    return (_jsxs(Card, { style: { padding: '14px 16px', borderRadius: radius.md }, children: [_jsx("div", { style: { fontSize: 11.5, color: color.muted }, children: label }), _jsx("div", { style: { fontSize: 21, fontWeight: 800, color: tone ?? color.ink, marginTop: 3, ...tabular }, children: value }), hint ? _jsx("div", { style: { fontSize: 10.5, color: color.faint, marginTop: 3, lineHeight: 1.35 }, children: hint }) : null] }));
}
export function BossFinanceObjectScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const { data } = useQuery('/boss/finance');
    const o = data?.objects.find((x) => x.objectId === params.objectId);
    if (!o)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: o.objectName ?? 'Объект', subtitle: "\u0444\u0438\u043D\u0430\u043D\u0441\u044B \u043E\u0431\u044A\u0435\u043A\u0442\u0430", onBack: back }), _jsx(Card, { style: { margin: '4px 20px' }, children: _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }, children: [_jsx(Fact, { label: "\u0411\u044E\u0434\u0436\u0435\u0442", value: mln(o.budget) }), _jsx(Fact, { label: "\u0412\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043E", value: mln(o.ev) }), _jsx(Fact, { label: "\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E", value: mln(o.ac) }), _jsx(Fact, { label: "\u0417\u0430\u043A\u0440\u044B\u0442\u043E \u0430\u043A\u0442\u0430\u043C\u0438", value: mln(o.closedByActs) }), _jsx(Fact, { label: "\u041D\u0435 \u0437\u0430\u043A\u0440\u044B\u0442\u043E", value: mln(o.notClosed), tone: color.warnStrong }), _jsx(Fact, { label: "\u0414\u0435\u0431\u0438\u0442\u043E\u0440\u043A\u0430", value: mln(o.receivable) })] }) }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u0418\u041D\u0414\u0415\u041A\u0421\u042B" }), _jsxs("div", { style: { display: 'flex', gap: 20, marginTop: 10 }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 28, fontWeight: 800, color: o.cpi < 1 ? color.danger : color.greenDeep, ...tabular }, children: o.cpi.toFixed(2).replace('.', ',') }), _jsx("div", { style: { fontSize: 11.5, color: color.muted }, children: "CPI \u00B7 \u043E\u0441\u0432\u043E\u0435\u043D\u043E / \u043F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E" })] }), _jsxs("div", { children: [_jsxs("div", { style: { fontSize: 28, fontWeight: 800, color: o.vac < 0 ? color.danger : color.greenDeep, ...tabular }, children: [o.vac < 0 ? '' : '+', formatNumber(o.vac)] }), _jsx("div", { style: { fontSize: 11.5, color: color.muted }, children: "\u043C\u043B\u043D \u00B7 \u043E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u0438\u0435 \u043F\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0438" })] })] }), _jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 12, lineHeight: 1.5 }, children: ["CPI \u043D\u0438\u0436\u0435 1 \u043E\u0437\u043D\u0430\u0447\u0430\u0435\u0442, \u0447\u0442\u043E \u043D\u0430 \u043A\u0430\u0436\u0434\u044B\u0439 \u043E\u0441\u0432\u043E\u0435\u043D\u043D\u044B\u0439 \u0441\u043E\u043C \u0442\u0440\u0430\u0442\u0438\u0442\u0441\u044F \u0431\u043E\u043B\u044C\u0448\u0435 \u0441\u043E\u043C\u0430. \u041F\u0440\u043E\u0433\u043D\u043E\u0437 \u043F\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0438 \u2014", ' ', mln(o.eac), " \u043F\u0440\u0438 \u0431\u044E\u0434\u0436\u0435\u0442\u0435 ", mln(o.budget), "."] })] })] }));
}
export function BossWeekScreen() {
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const { data, reload } = useQuery('/boss/finance');
    const approve = useAction(async (id) => {
        await api.post(`/boss/payments/${id}/approve`);
        notify('Платёж согласован');
        reload();
    });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0414\u0435\u043D\u044C\u0433\u0438 \u043D\u0430 \u043D\u0435\u0434\u0435\u043B\u044E", subtitle: "\u043F\u043B\u0430\u0442\u0435\u0436\u0438 \u043F\u043E \u0441\u0440\u043E\u043A\u0430\u043C", onBack: back }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: [(data?.payments ?? []).map((p) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: p.name }), _jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, flexShrink: 0, ...tabular }, children: mln(p.amount) })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }, children: [p.objectName, " \u00B7 ", new Date(p.dueDate).toLocaleDateString('ru-RU')] }), _jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }, children: [_jsx(Badge, { tone: p.status === 'overdue' ? 'danger' : p.status === 'approved' ? 'green' : p.aboveLimit ? 'warn' : 'neutral', children: p.status === 'overdue'
                                            ? 'просрочен'
                                            : p.status === 'approved'
                                                ? 'согласован'
                                                : p.aboveLimit
                                                    ? 'выше лимита'
                                                    : 'к согласованию' }), p.status !== 'approved' && p.status !== 'paid' ? (_jsx("div", { onClick: () => approve.run(p.id), style: {
                                            cursor: 'pointer',
                                            background: color.primary,
                                            color: '#fff',
                                            borderRadius: radius.xs,
                                            padding: '9px 14px',
                                            fontSize: 13,
                                            fontWeight: 800,
                                        }, children: "\u0421\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u0442\u044C" })) : null] })] }, p.id))), approve.error ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.warnText, lineHeight: 1.45 }, children: approve.error })) : null] })] }));
}
/* ───────────────────────────── Качество (ГИ) ───────────────────────────── */
export function BossQualityScreen() {
    const notify = useApp((s) => s.notify);
    const { data } = useQuery('/boss/quality');
    const { data: digest } = useQuery('/boss/digest');
    const [stopping, setStopping] = useState(false);
    const [reason, setReason] = useState('');
    const [objectId, setObjectId] = useState(null);
    const stop = useAction(async () => {
        await api.post('/boss/stop-work', { objectId, reason });
        notify('Работы остановлены · уведомлены площадка и директор');
        setStopping(false);
        setReason('');
    });
    if (!data)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u041A\u0430\u0447\u0435\u0441\u0442\u0432\u043E", right: _jsx(BossHeaderRight, {}) }), _jsxs(SectionLabel, { tone: "danger", style: { padding: '4px 20px 6px' }, children: ["\u041F\u0420\u0415\u0414\u041F\u0418\u0421\u0410\u041D\u0418\u042F \u00B7 ", data.prescriptions.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }, children: data.prescriptions.map((p) => (_jsxs(Card, { style: {
                        borderRadius: radius.md,
                        padding: '14px 16px',
                        ...(p.overdue ? { border: '1.5px solid #F0B4B0' } : null),
                    }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsxs("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink }, children: [p.number, " \u00B7 ", p.contractor] }), _jsx(Badge, { tone: p.overdue ? 'warn' : 'neutral', style: { flexShrink: 0 }, children: p.overdue ? 'просрочено' : `${p.dueDays} дн.` })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.inkMuted, marginTop: 4, lineHeight: 1.45 }, children: [p.text, " \u00B7 ", p.location] }), _jsxs("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 4 }, children: ["\u0432\u044B\u0434\u0430\u043B ", p.issuedBy, " \u00B7 ", new Date(p.issuedAt).toLocaleDateString('ru-RU')] })] }, p.id))) }), data.blockedProcesses.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs(SectionLabel, { style: { padding: '14px 20px 6px' }, children: ["\u0427\u0422\u041E \u0414\u0415\u0420\u0416\u0418\u0422 \u0420\u0410\u0411\u041E\u0422\u0423 \u00B7 ", data.blockedProcesses.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: data.blockedProcesses.map((b) => (_jsxs(Card, { style: { borderRadius: radius.sm, padding: '12px 14px' }, children: [_jsx("div", { style: { fontSize: 13.5, fontWeight: 700, color: color.ink }, children: b.title }), _jsx("div", { style: { fontSize: 12, color: color.danger, marginTop: 3, fontWeight: 700 }, children: b.reason }), _jsx("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 2 }, children: b.objectName })] }, b.id))) })] })) : null, data.strengthPending.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { style: { padding: '14px 20px 6px' }, children: "\u041F\u0420\u041E\u0427\u041D\u041E\u0421\u0422\u042C \u041D\u0415 \u041D\u0410\u0411\u0420\u0410\u041D\u0410" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: data.strengthPending.map((p) => (_jsxs(Card, { style: { borderRadius: radius.sm, padding: '12px 14px' }, children: [_jsx("div", { style: { fontSize: 13.5, fontWeight: 700, color: color.ink }, children: p.process }), _jsxs("div", { style: { fontSize: 12, color: color.warnText, marginTop: 3, fontWeight: 700, ...tabular }, children: [p.strengthPct, "% \u0438\u0437 ", p.requiredPct, "% \u00B7 ", p.objectName] })] }, p.id))) })] })) : null, _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: stopping ? (_jsxs(Card, { children: [_jsx(SectionLabel, { children: "\u041E\u0421\u0422\u0410\u041D\u041E\u0412\u0418\u0422\u042C \u0420\u0410\u0411\u041E\u0422\u042B" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: (digest?.objects ?? []).map((o) => (_jsx(Chip, { active: objectId === o.id, onClick: () => setObjectId(o.id), style: { fontSize: 12 }, children: o.name }, o.id))) }), _jsx("input", { value: reason, onChange: (e) => setReason(e.target.value), placeholder: "\u041E\u0441\u043D\u043E\u0432\u0430\u043D\u0438\u0435 \u2014 \u0435\u0433\u043E \u0443\u0432\u0438\u0434\u044F\u0442 \u043D\u0430 \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0435", style: {
                                width: '100%',
                                boxSizing: 'border-box',
                                border: 'none',
                                outline: 'none',
                                background: color.screen,
                                borderRadius: radius.xs,
                                padding: '11px 12px',
                                fontSize: 14,
                                color: color.ink,
                                marginTop: 10,
                                fontFamily: 'inherit',
                            } }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 10 }, children: [_jsx("div", { onClick: () => setStopping(false), style: {
                                        cursor: 'pointer',
                                        flex: 1,
                                        textAlign: 'center',
                                        background: color.chip,
                                        borderRadius: radius.xs,
                                        padding: '11px 0',
                                        fontSize: 13,
                                        fontWeight: 700,
                                        color: color.ink,
                                    }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("div", { onClick: () => objectId && reason.trim() && stop.run(), style: {
                                        cursor: 'pointer',
                                        flex: 1.2,
                                        textAlign: 'center',
                                        background: objectId && reason.trim() ? color.danger : color.disabled,
                                        color: '#fff',
                                        borderRadius: radius.xs,
                                        padding: '11px 0',
                                        fontSize: 13,
                                        fontWeight: 800,
                                    }, children: "\u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C" })] })] })) : (_jsx("div", { onClick: () => setStopping(true), style: {
                        cursor: 'pointer',
                        height: 52,
                        borderRadius: radius.md,
                        background: color.warnBg,
                        border: `1px solid ${color.warnBorder}`,
                        color: color.warnText,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 14.5,
                        fontWeight: 800,
                    }, children: "\u26D4 \u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u044B" })) })] }));
}
/* ───────────────────────────── KPI, лимиты, объекты, назначение ───────────────────────────── */
export function BossKpiScreen() {
    const back = useApp((s) => s.back);
    const { data } = useQuery('/boss/kpi');
    const [tab, setTab] = useState(0);
    const dept = data?.departments[tab];
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "KPI \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432", subtitle: "\u043F\u043E\u0440\u043E\u0433\u0438 \u043E\u0431\u044A\u044F\u0432\u043B\u0435\u043D\u044B \u0437\u0430\u0440\u0430\u043D\u0435\u0435", onBack: back }), _jsx("div", { style: { display: 'flex', gap: 6, padding: '4px 20px 0', flexWrap: 'wrap' }, children: (data?.departments ?? []).map((d, i) => (_jsx(Chip, { active: tab === i, onClick: () => setTab(i), style: { fontSize: 12.5 }, children: d.label }, d.key))) }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 20px 20px' }, children: (dept?.metrics ?? []).map((m) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 700, color: color.ink }, children: m.label }), _jsxs("div", { style: {
                                        fontSize: 20,
                                        fontWeight: 800,
                                        ...tabular,
                                        color: m.state === 'good'
                                            ? color.greenDeep
                                            : m.state === 'warn'
                                                ? color.warnStrong
                                                : m.state === 'bad'
                                                    ? color.danger
                                                    : color.ink,
                                    }, children: [formatNumber(m.value, m.value % 1 ? 1 : 0), " ", m.unit] })] }), _jsx("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 4 }, children: m.goodAbove !== undefined
                                ? `норма — не ниже ${m.goodAbove} ${m.unit}`
                                : m.goodBelow !== undefined
                                    ? `норма — не выше ${m.goodBelow} ${m.unit}`
                                    : '' })] }, m.key))) })] }));
}
export function BossLimitsScreen() {
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const { data, reload } = useQuery('/boss/limits');
    const [edits, setEdits] = useState({});
    const save = useAction(async (role, scope, limit) => {
        await api.put('/boss/limits', { role, scope, limit });
        notify('Лимит сохранён');
        reload();
    });
    const SCOPE_LABEL = {
        payment: 'платежи',
        zayavka: 'заявки',
        contractor: 'подрядчики',
    };
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041B\u0438\u043C\u0438\u0442\u044B \u0430\u0432\u0442\u043E\u043D\u043E\u043C\u043D\u043E\u0441\u0442\u0438", subtitle: "\u0434\u043E \u043A\u0430\u043A\u043E\u0439 \u0441\u0443\u043C\u043C\u044B \u0440\u0435\u0448\u0430\u044E\u0442 \u0431\u0435\u0437 \u0432\u0430\u0441", onBack: back }), _jsx("div", { style: { padding: '4px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }, children: "\u0412\u0441\u0451, \u0447\u0442\u043E \u0432\u044B\u0448\u0435 \u043B\u0438\u043C\u0438\u0442\u0430, \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442 \u0432\u0430\u043C \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435. \u041D\u0438\u0436\u0435 \u2014 \u0440\u0435\u0448\u0430\u0435\u0442\u0441\u044F \u043D\u0430 \u043C\u0435\u0441\u0442\u0435 \u0438 \u043F\u043E\u043F\u0430\u0434\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u043E\u0442\u0447\u0451\u0442." }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 20px' }, children: (data ?? []).map((l) => {
                    const key = `${l.role}:${l.scope}`;
                    const value = edits[key] ?? String(l.limit);
                    return (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink }, children: [l.role === 'gi' ? 'Главный инженер' : l.role === 'pto' ? 'ПТО' : 'Снабжение', " \u00B7", ' ', SCOPE_LABEL[l.scope] ?? l.scope] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }, children: [_jsx("input", { value: value, onChange: (e) => setEdits((s) => ({ ...s, [key]: e.target.value })), style: {
                                            width: 92,
                                            boxSizing: 'border-box',
                                            border: 'none',
                                            outline: 'none',
                                            background: color.screen,
                                            borderRadius: radius.xs,
                                            padding: '10px 12px',
                                            fontSize: 16,
                                            fontWeight: 800,
                                            textAlign: 'center',
                                            color: color.ink,
                                            fontFamily: 'inherit',
                                            ...tabular,
                                        } }), _jsx("div", { style: { fontSize: 14, color: color.muted }, children: "\u043C\u043B\u043D \u0441\u043E\u043C" }), _jsx("div", { onClick: () => save.run(l.role, l.scope, Number(value.replace(',', '.')) || 0), style: {
                                            cursor: 'pointer',
                                            marginLeft: 'auto',
                                            background: color.primary,
                                            color: '#fff',
                                            borderRadius: radius.xs,
                                            padding: '10px 14px',
                                            fontSize: 13,
                                            fontWeight: 800,
                                        }, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" })] })] }, l.id));
                }) })] }));
}
export function BossCompanyObjectsScreen() {
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const { data, reload } = useQuery('/objects');
    const [creating, setCreating] = useState(false);
    const [form, setForm] = useState({ code: '', name: '', address: '', city: 'Бишкек', floors: '9', due: '' });
    const create = useAction(async () => {
        await api.post('/boss/objects', {
            code: form.code,
            name: form.name,
            address: form.address,
            city: form.city,
            floorsTotal: Number(form.floors) || 1,
            dueDate: form.due || new Date(Date.now() + 365 * 86_400_000).toISOString(),
            blocks: [{ name: 'Блок А', floors: Number(form.floors) || 1 }],
        });
        notify('Объект создан · цепочки процессов заводит ПТО по ППР');
        setCreating(false);
        reload();
    });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041E\u0431\u044A\u0435\u043A\u0442\u044B \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438", subtitle: `${data?.length ?? 0} объектов`, onBack: back, right: _jsx("div", { onClick: () => setCreating((v) => !v), style: {
                        cursor: 'pointer',
                        background: color.primary,
                        color: '#fff',
                        borderRadius: radius.smAlt,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 800,
                        flex: 'none',
                    }, children: creating ? 'Отмена' : '+ Объект' }) }), creating ? (_jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx(SectionLabel, { children: "\u041D\u041E\u0412\u042B\u0419 \u041E\u0411\u042A\u0415\u041A\u0422" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }, children: [_jsx(MiniField, { label: "\u041D\u0410\u0417\u0412\u0410\u041D\u0418\u0415", value: form.name, onChange: (v) => setForm({ ...form, name: v }) }), _jsx(MiniField, { label: "\u041A\u041E\u0414", value: form.code, onChange: (v) => setForm({ ...form, code: v }) }), _jsx(MiniField, { label: "\u0410\u0414\u0420\u0415\u0421", value: form.address, onChange: (v) => setForm({ ...form, address: v }) }), _jsx(MiniField, { label: "\u042D\u0422\u0410\u0416\u0415\u0419", value: form.floors, onChange: (v) => setForm({ ...form, floors: v }) }), _jsx(MiniField, { label: "\u0421\u0420\u041E\u041A \u0421\u0414\u0410\u0427\u0418", value: form.due, onChange: (v) => setForm({ ...form, due: v }), type: "date" })] }), _jsx("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 10, lineHeight: 1.45 }, children: "\u0426\u0435\u043F\u043E\u0447\u043A\u0438 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0432 \u043F\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C \u0437\u0430\u0432\u043E\u0434\u0438\u0442 \u041F\u0422\u041E \u043F\u043E \u041F\u041F\u0420 \u044D\u0442\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430." }), _jsx(PrimaryButton, { onClick: () => create.run(), disabled: !form.name || !form.code || create.busy, style: { marginTop: 12, height: 50 }, children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043E\u0431\u044A\u0435\u043A\u0442" })] })) : null, _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 20px' }, children: (data ?? []).map((o) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: o.name }), _jsx(Badge, { tone: o.status === 'active' ? 'green' : 'warn', children: o.status === 'active' ? 'в работе' : o.status === 'paused' ? 'остановлен' : 'сдан' })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: [o.address, " \u00B7 ", o.blocks.length, " \u0431\u043B\u043E\u043A\u043E\u0432 \u00B7 ", o.floorsTotal, " \u044D\u0442\u0430\u0436\u0435\u0439"] }), _jsxs("div", { style: { fontSize: 12, color: color.faint, marginTop: 3 }, children: ["\u0441\u0440\u043E\u043A ", new Date(o.dueDate).toLocaleDateString('ru-RU'), " \u00B7", ' ', o.responsible?.fullName ?? 'ответственный не назначен'] })] }, o.id))) })] }));
}
/** Назначение работ прорабу: объект → блок → этаж → раздел → кому → срок. */
export function BossAssignScreen() {
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const { data: objects } = useQuery('/objects');
    const { data: sections } = useQuery('/sections');
    const { data: users } = useQuery('/users');
    const [objectId, setObjectId] = useState(null);
    const [blockId, setBlockId] = useState(null);
    const [floor, setFloor] = useState(null);
    const [sectionId, setSectionId] = useState(null);
    const [assigneeId, setAssigneeId] = useState(null);
    const [due, setDue] = useState(() => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));
    const object = objects?.find((o) => o.id === objectId);
    const block = object?.blocks.find((b) => b.id === blockId);
    const candidates = (users ?? []).filter((u) => ['prorab', 'master'].includes(u.role) && (!objectId || u.objectId === objectId));
    const assign = useAction(async () => {
        const res = await api.post('/admin/assign-work', {
            objectId,
            blockId,
            floor,
            sectionId,
            assigneeId,
            dueDate: due,
        });
        notify(`Назначено · заведено ${res.processesCreated} процессов, исполнитель уведомлён`);
        setSectionId(null);
    });
    const ready = objectId && blockId && floor !== null && sectionId && assigneeId;
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0417\u0430\u0434\u0430\u0447\u0438 \u0438 \u0441\u0440\u043E\u043A\u0438 \u043F\u0440\u043E\u0440\u0430\u0431\u0430\u043C", subtitle: "\u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0440\u0430\u0431\u043E\u0442", onBack: back }), _jsxs("div", { style: { padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx(Step, { label: "1 \u00B7 \u041E\u0411\u042A\u0415\u041A\u0422", children: (objects ?? []).map((o) => (_jsx(Chip, { active: objectId === o.id, onClick: () => {
                                setObjectId(o.id);
                                setBlockId(null);
                                setFloor(null);
                                setAssigneeId(null);
                            }, style: { fontSize: 12.5 }, children: o.name }, o.id))) }), object ? (_jsx(Step, { label: "2 \u00B7 \u0411\u041B\u041E\u041A", children: object.blocks.map((b) => (_jsx(Chip, { active: blockId === b.id, onClick: () => {
                                setBlockId(b.id);
                                setFloor(null);
                            }, style: { fontSize: 12.5 }, children: b.name }, b.id))) })) : null, block ? (_jsx(Step, { label: "3 \u00B7 \u042D\u0422\u0410\u0416", children: Array.from({ length: block.floors }, (_, i) => i + 1).map((f) => (_jsx(Chip, { active: floor === f, onClick: () => setFloor(f), style: { fontSize: 12.5 }, children: f }, f))) })) : null, floor !== null ? (_jsx(Step, { label: "4 \u00B7 \u0420\u0410\u0417\u0414\u0415\u041B \u0420\u0410\u0411\u041E\u0422", children: (sections ?? []).map((s) => (_jsx(Chip, { active: sectionId === s.id, onClick: () => setSectionId(s.id), style: { fontSize: 12.5 }, children: s.name }, s.id))) })) : null, sectionId ? (_jsx(Step, { label: "5 \u00B7 \u041A\u041E\u041C\u0423", children: candidates.length > 0 ? (candidates.map((u) => (_jsx(Chip, { active: assigneeId === u.id, onClick: () => setAssigneeId(u.id), style: { fontSize: 12.5 }, children: u.fullName }, u.id)))) : (_jsx("div", { style: { fontSize: 12.5, color: color.warnText, fontWeight: 700 }, children: "\u041D\u0430 \u043E\u0431\u044A\u0435\u043A\u0442\u0435 \u043D\u0435\u0442 \u043F\u0440\u043E\u0440\u0430\u0431\u043E\u0432 \u2014 \u0441\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u0445 \u0432 \u00AB\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438 \u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u044B\u00BB" })) })) : null, assigneeId ? (_jsx(Step, { label: "6 \u00B7 \u0421\u0420\u041E\u041A", children: _jsx("input", { type: "date", value: due, onChange: (e) => setDue(e.target.value), style: {
                                boxSizing: 'border-box',
                                border: 'none',
                                outline: 'none',
                                background: color.surface,
                                borderRadius: radius.xs,
                                padding: '10px 12px',
                                fontSize: 14,
                                fontWeight: 700,
                                color: color.ink,
                                fontFamily: 'inherit',
                            } }) })) : null] }), ready ? (_jsxs(Card, { style: { margin: '14px 20px 0' }, children: [_jsx("div", { style: { fontSize: 13, color: color.muted }, children: "\u0411\u0443\u0434\u0435\u0442 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043E" }), _jsxs("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink, marginTop: 4 }, children: [object?.name, " \u00B7 ", block?.name, " \u00B7 ", floor, " \u044D\u0442\u0430\u0436 \u00B7", ' ', sections?.find((s) => s.id === sectionId)?.name] }), _jsxs("div", { style: { fontSize: 13, color: color.inkMuted, marginTop: 3 }, children: [candidates.find((u) => u.id === assigneeId)?.fullName, " \u00B7 \u0441\u0440\u043E\u043A", ' ', new Date(due).toLocaleDateString('ru-RU')] })] })) : null, _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(PrimaryButton, { onClick: () => assign.run(), disabled: !ready || assign.busy, children: "\u041D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C \u0438 \u0443\u0432\u0435\u0434\u043E\u043C\u0438\u0442\u044C" }) })] }));
}
function Step({ label, children }) {
    return (_jsxs("div", { children: [_jsx(SectionLabel, { style: { fontSize: 12 }, children: label }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }, children: children })] }));
}
function MiniField({ label, value, onChange, type = 'text', }) {
    return (_jsxs("div", { style: { background: color.screen, borderRadius: radius.xs, padding: '9px 12px' }, children: [_jsx("div", { style: { fontSize: 11, fontWeight: 700, color: color.muted }, children: label }), _jsx("input", { value: value, type: type, onChange: (e) => onChange(e.target.value), style: {
                    width: '100%',
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: color.ink,
                    marginTop: 2,
                    fontFamily: 'inherit',
                } })] }));
}
/* ───────────────────────────── Режим планёрки (desktop) ───────────────────────────── */
export function PlanerkaScreen() {
    const back = useApp((s) => s.back);
    const { data } = useQuery('/boss/digest');
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0420\u0435\u0436\u0438\u043C \u043F\u043B\u0430\u043D\u0451\u0440\u043A\u0438", subtitle: "\u043A\u0440\u0443\u043F\u043D\u043E, \u0434\u043B\u044F \u043F\u0440\u043E\u0435\u043A\u0442\u043E\u0440\u0430", onBack: back }), _jsxs("div", { style: { padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }, children: [(data?.objects ?? []).map((o) => (_jsxs(Card, { style: { padding: '16px 18px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }, children: [_jsx("div", { style: { fontSize: 19, fontWeight: 800, color: color.ink }, children: o.name }), _jsx("div", { style: { fontSize: 19, fontWeight: 800, color: deltaColor(o.deltaDays), ...tabular }, children: o.deltaDays === 0 ? 'по графику' : `${o.deltaDays} дн.` })] }), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }, children: [_jsx(ProgressBar, { pct: o.pctFact, height: 12 }), _jsxs("div", { style: { fontSize: 18, fontWeight: 800, color: color.ink, ...tabular }, children: [o.pctFact.toFixed(1).replace('.', ','), "%"] })] }), _jsxs("div", { style: { fontSize: 13, color: color.muted, marginTop: 6, ...tabular }, children: ["\u043F\u043B\u0430\u043D ", o.pctPlan, "% \u00B7 ", o.responsible ?? '—', o.cpi !== null ? ` · CPI ${o.cpi.toFixed(2).replace('.', ',')}` : ''] })] }, o.id))), _jsx(SectionLabel, { tone: "danger", style: { marginTop: 8, fontSize: 14 }, children: "\u0422\u0420\u0415\u0411\u0423\u0415\u0422 \u0420\u0415\u0428\u0415\u041D\u0418\u042F" }), (data?.incidents ?? []).map((i) => (_jsxs(Card, { style: { padding: '14px 18px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 10 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: color.ink }, children: i.title }), i.cost ? (_jsxs("div", { style: { fontSize: 16, fontWeight: 800, color: color.danger, ...tabular }, children: [formatNumber(i.cost), " \u0441\u043E\u043C"] })) : null] }), _jsxs("div", { style: { fontSize: 13.5, color: color.inkMuted, marginTop: 4 }, children: [i.objectName, " \u00B7 ", i.detail] })] }, i.id)))] })] }));
}
