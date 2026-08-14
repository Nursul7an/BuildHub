import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * BOSS 6 · Реестр поручений.
 *
 * Отдельный экран нужен, чтобы видеть все поручения разом — по объектам и
 * срокам. Просроченные идут первыми: их читают, а не ищут.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, Card, SectionLabel, Segmented, tabular } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
export function BossTasksScreen() {
    const back = useApp((s) => s.back);
    const [filter, setFilter] = useState('open');
    const { data, reload } = useQuery('/boss/tasks');
    const list = (data ?? []).filter((t) => (filter === 'open' ? t.status !== 'done' : t.status === 'done'));
    const overdue = list.filter((t) => t.overdue);
    const rest = list.filter((t) => !t.overdue);
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0420\u0435\u0435\u0441\u0442\u0440 \u043F\u043E\u0440\u0443\u0447\u0435\u043D\u0438\u0439", subtitle: `${list.length} записей`, onBack: back }), _jsx("div", { style: { padding: '0 20px 8px' }, children: _jsx(Segmented, { value: filter, onChange: setFilter, options: [
                        { value: 'open', label: 'В работе' },
                        { value: 'done', label: 'Выполнено' },
                    ] }) }), overdue.length > 0 ? (_jsxs(_Fragment, { children: [_jsxs(SectionLabel, { tone: "danger", style: { padding: '8px 20px 6px' }, children: ["\u041F\u0420\u041E\u0421\u0420\u041E\u0427\u0415\u041D\u041E \u00B7 ", overdue.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }, children: overdue.map((t) => (_jsx(TaskRow, { task: t, onDone: reload }, t.id))) })] })) : null, _jsxs(SectionLabel, { style: { padding: '14px 20px 6px' }, children: ["\u041E\u0421\u0422\u0410\u041B\u042C\u041D\u042B\u0415 \u00B7 ", rest.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }, children: rest.map((t) => (_jsx(TaskRow, { task: t, onDone: reload }, t.id))) })] }));
}
function TaskRow({ task, onDone }) {
    return (_jsxs(Card, { style: {
            borderRadius: radius.md,
            padding: '14px 16px',
            ...(task.overdue ? { border: '1.5px solid #F0B4B0' } : null),
            ...(task.status === 'done' ? { opacity: 0.65 } : null),
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }, children: task.text }), _jsx(Badge, { tone: task.overdue ? 'warn' : task.status === 'done' ? 'green' : 'neutral', style: { flexShrink: 0 }, children: task.status === 'done'
                            ? 'выполнено'
                            : task.overdue
                                ? 'просрочено'
                                : new Date(task.dueDate).toLocaleDateString('ru-RU') })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 4, ...tabular }, children: [task.assignee ?? 'исполнитель не назначен', " \u00B7 ", task.objectName, task.sectionName ? ` · ${task.sectionName}` : '', task.floor ? ` · ${task.floor} эт.` : ''] }), _jsxs("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 3 }, children: ["\u043F\u043E\u0441\u0442\u0430\u0432\u0438\u043B ", task.author, " \u00B7", ' ', task.origin === 'inbox' ? 'из ленты проблем' : task.origin === 'schedule' ? 'по графику' : 'вручную'] }), task.status !== 'done' ? (_jsx("div", { onClick: async () => {
                    await api.post(`/boss/tasks/${task.id}/done`);
                    onDone();
                }, style: { cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: color.primary, marginTop: 8 }, children: "\u041E\u0442\u043C\u0435\u0442\u0438\u0442\u044C \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u043E\u0439" })) : null] }));
}
