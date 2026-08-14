import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * A2 · «Мои работы».
 *
 * Три уровня: этаж → раздел → процессы. Раскрытие внутри карточки, а не
 * переход — прораб сравнивает разделы между собой, и уводить его с экрана
 * ради трёх строк незачем. Процент раздела считается по его собственному
 * плану, а не усреднением процентов процессов.
 */
import { useMemo, useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, Card, PlanFactBars, Segmented, formatNumber, formatPct, tabular, } from '../../design/primitives';
import { IconSearch } from '../../design/icons';
import { RootHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useQuery } from '../../api/hooks';
import { useApp } from '../../store/app';
import { dueStyle, dueText } from './TodayScreen';
export function WorksScreen() {
    const go = useApp((s) => s.go);
    const [grouping, setGrouping] = useState('floor');
    const [expanded, setExpanded] = useState({});
    const { data, loading } = useQuery('/works?mine=1');
    const groups = useMemo(() => {
        if (!data)
            return [];
        const cards = new Map();
        for (const p of data) {
            const key = `${p.blockId}:${p.floor}:${p.sectionId}`;
            const card = cards.get(key) ?? {
                key,
                sectionId: p.sectionId,
                sectionName: p.sectionName ?? '',
                blockId: p.blockId,
                blockName: p.blockName,
                floor: p.floor,
                processes: [],
            };
            card.processes.push(p);
            cards.set(key, card);
        }
        const all = [...cards.values()].map((c) => ({
            ...c,
            processes: c.processes.sort((a, b) => a.order - b.order),
        }));
        const byKey = new Map();
        for (const card of all) {
            const key = grouping === 'floor' ? `${card.blockId}:${card.floor}` : card.sectionId;
            const label = grouping === 'floor' ? `${card.blockName} · ${card.floor} этаж` : card.sectionName;
            const group = byKey.get(key) ?? { key, label, cards: [] };
            group.cards.push(card);
            byKey.set(key, group);
        }
        return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
    }, [data, grouping]);
    if (loading)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0440\u0430\u0431\u043E\u0442\u044B\u2026" });
    const count = data?.length ?? 0;
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u041C\u043E\u0438 \u0440\u0430\u0431\u043E\u0442\u044B", subtitle: `${groups.length} групп · ${count} процессов`, right: _jsx("div", { style: {
                        width: 44,
                        height: 44,
                        borderRadius: radius.mdAlt,
                        background: color.surface,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 1px 4px rgba(20,22,31,0.08)',
                        flex: 'none',
                    }, children: _jsx(IconSearch, {}) }) }), _jsx("div", { style: { padding: '4px 20px 0' }, children: _jsx(Segmented, { value: grouping, onChange: setGrouping, options: [
                        { value: 'floor', label: 'По этажам' },
                        { value: 'section', label: 'По видам работ' },
                    ] }) }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 20px' }, children: [groups.map((group) => (_jsxs("div", { style: { display: 'contents' }, children: [_jsx("div", { style: {
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    color: color.muted,
                                    marginTop: 4,
                                }, children: group.label.toUpperCase() }), group.cards.map((card) => {
                                const plan = card.processes.reduce((a, p) => a + p.planQty, 0);
                                const fact = card.processes.reduce((a, p) => a + p.doneQty, 0);
                                // Процент раздела — от суммы планов, а не среднее по процессам:
                                // иначе один короткий процесс весит столько же, сколько весь монолит.
                                const factPct = plan > 0 ? (fact / plan) * 100 : 0;
                                const planPct = Math.min(100, factPct + 6);
                                const blocked = card.processes.find((p) => p.status === 'blocked');
                                const active = card.processes.find((p) => p.status === 'active');
                                const open = expanded[card.key];
                                const acts = card.processes.filter((p) => p.requiresAosr).length;
                                return (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink }, children: grouping === 'floor' ? card.sectionName : `${card.blockName} · ${card.floor} этаж` }), _jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 1 }, children: [card.processes.length, " \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0432 \u00B7 ", acts, " \u0430\u043A\u0442\u043E\u0432"] })] }), _jsx("div", { style: { fontSize: 16, fontWeight: 800, color: color.ink, flexShrink: 0, ...tabular }, children: formatPct(factPct) })] }), active ? (_jsxs("div", { style: { fontSize: 13, color: color.muted, marginTop: 1, ...tabular }, children: [formatNumber(active.doneQty, active.unit === 'т' ? 2 : 0), " \u0438\u0437", ' ', formatNumber(active.planQty, active.unit === 'т' ? 1 : 0), " ", active.unit, " \u00B7 ", active.name] })) : null, _jsx(PlanFactBars, { planPct: planPct, factPct: factPct }), active?.dueDate ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 800, marginTop: 6, ...dueStyle(active.dueDate) }, children: dueText(active.dueDate) })) : null, blocked ? (_jsxs("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.danger, marginTop: 6 }, children: ["\u26D4 ", blocked.blockedReason] })) : null, _jsx("div", { onClick: () => setExpanded((e) => ({ ...e, [card.key]: !e[card.key] })), style: {
                                                cursor: 'pointer',
                                                fontSize: 12,
                                                fontWeight: 700,
                                                color: color.primary,
                                                marginTop: 5,
                                                minHeight: 24,
                                                display: 'flex',
                                                alignItems: 'center',
                                            }, children: open ? '▾ скрыть процессы' : `▸ показать процессы · ${card.processes.length}` }), open ? (_jsxs(_Fragment, { children: [card.processes.slice(0, 4).map((p) => (_jsxs("div", { onClick: () => go('process', { processStateId: p.id }), style: {
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        gap: 8,
                                                        padding: '7px 0 7px 4px',
                                                        borderTop: `1px dashed ${color.borderSoft}`,
                                                        marginTop: 4,
                                                    }, children: [_jsx("div", { style: { fontSize: 12, flexShrink: 0 }, children: STATUS_ICON[p.status] }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.ink }, children: p.name }), _jsx("div", { style: { fontSize: 11.5, color: color.muted, ...tabular }, children: p.planQty > 0
                                                                        ? `${formatNumber(p.doneQty, p.unit === 'т' ? 2 : 0)} из ${formatNumber(p.planQty, p.unit === 'т' ? 1 : 0)} ${p.unit} · ${formatPct(p.pct)}`
                                                                        : STATUS_LABEL[p.status] }), p.blockedReason ? (_jsx("div", { style: { fontSize: 11, fontWeight: 800, color: color.danger, marginTop: 1 }, children: p.blockedReason })) : null] }), p.requiresAosr ? (_jsx("div", { style: { fontSize: 11, flexShrink: 0 }, title: "\u043F\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0438 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0410\u041E\u0421\u0420", children: "\uD83D\uDD12" })) : null] }, p.id))), _jsxs("div", { onClick: () => go('chain', { sectionId: card.sectionId, blockId: card.blockId, floor: card.floor }), style: {
                                                        cursor: 'pointer',
                                                        padding: '8px 0 2px 4px',
                                                        fontSize: 12.5,
                                                        fontWeight: 700,
                                                        color: color.primary,
                                                        borderTop: `1px dashed ${color.borderSoft}`,
                                                        marginTop: 4,
                                                    }, children: ["\u0412\u0441\u044F \u0446\u0435\u043F\u043E\u0447\u043A\u0430 \u0440\u0430\u0437\u0434\u0435\u043B\u0430 \u00B7 ", card.processes.length, " \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0432 \u203A"] })] })) : null] }, card.key));
                            })] }, group.key))), groups.length === 0 ? (_jsxs(Card, { style: { textAlign: 'center', padding: 24 }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink }, children: "\u041F\u0422\u041E \u043F\u043E\u043A\u0430 \u043D\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0438\u043B \u0432\u0430\u043C \u0440\u0430\u0431\u043E\u0442\u044B" }), _jsx("div", { style: { fontSize: 13, color: color.muted, marginTop: 6 }, children: "\u041A\u0430\u043A \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0442 \u2014 \u043E\u043D\u0438 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u0438 \u043D\u0430 \u00AB\u0421\u0435\u0433\u043E\u0434\u043D\u044F\u00BB." })] })) : null] })] }));
}
export const STATUS_ICON = {
    idle: '⚪',
    active: '🔵',
    presented: '🟣',
    accepted: '✅',
    blocked: '⛔',
};
export const STATUS_LABEL = {
    idle: 'не начат',
    active: 'в работе',
    presented: 'предъявлен · ждём технадзор',
    accepted: 'принят',
    blocked: 'заблокирован',
};
export const STATUS_BADGE = {
    idle: 'neutral',
    active: 'primary',
    presented: 'primary',
    accepted: 'green',
    blocked: 'warn',
};
export { Badge };
