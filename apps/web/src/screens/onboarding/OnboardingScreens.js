import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Онбординг площадки.
 *
 * Основной путь — работы уже назначил ПТО, и человеку остаётся подтвердить,
 * что список верен. Самостоятельная разметка — запасной путь на случай, когда
 * назначения нет: четыре тапа, и число тапов не растёт с размером объекта.
 */
import { useMemo, useState } from 'react';
import { color, radius } from '../../design/tokens';
import { BottomSheet, Card, CheckSquare, Chip, GhostButton, PrimaryButton, tabular, } from '../../design/primitives';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
import { dueStyle, dueText } from '../field/TodayScreen';
/* ─────────────────────── Экран 1 · «Вот ваши работы» ─────────────────────── */
export function AssignedWorksScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const notify = useApp((s) => s.notify);
    const [wrongOpen, setWrongOpen] = useState(false);
    const { data, loading } = useQuery('/works?mine=1');
    const groups = useMemo(() => {
        const map = new Map();
        for (const p of data ?? []) {
            const key = `${p.blockName} · ${p.floor} этаж`;
            map.set(key, [...(map.get(key) ?? []), p]);
        }
        return [...map.entries()];
    }, [data]);
    if (loading)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    // Назначения нет — уводим на самостоятельную разметку, а не в пустой экран.
    if ((data ?? []).length === 0) {
        return (_jsxs(ScreenBody, { children: [_jsxs("div", { style: { padding: '36px 24px 0', textAlign: 'center' }, children: [_jsx("div", { style: { fontSize: 34 }, children: "\uD83C\uDFD7" }), _jsx("div", { style: { fontSize: 22, fontWeight: 800, color: color.ink, marginTop: 12 }, children: "\u041F\u0422\u041E \u043F\u043E\u043A\u0430 \u043D\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0438\u043B \u0432\u0430\u043C \u0440\u0430\u0431\u043E\u0442\u044B" }), _jsx("div", { style: { fontSize: 14.5, color: color.inkSoft, marginTop: 8, lineHeight: 1.55 }, children: "\u041C\u043E\u0436\u043D\u043E \u043E\u0442\u043C\u0435\u0442\u0438\u0442\u044C \u0441\u0430\u043C\u043E\u043C\u0443 \u2014 \u044D\u0442\u043E \u0437\u0430\u0439\u043C\u0451\u0442 \u043C\u0438\u043D\u0443\u0442\u0443. \u041A\u043E\u0433\u0434\u0430 \u041F\u0422\u041E \u043D\u0430\u0437\u043D\u0430\u0447\u0438\u0442, \u0441\u043F\u0438\u0441\u043E\u043A \u043E\u0431\u043D\u043E\u0432\u0438\u0442\u0441\u044F." })] }), _jsxs("div", { style: { marginTop: 'auto', padding: '16px 24px 26px', display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx(PrimaryButton, { onClick: () => go('onboarding-blocks'), children: "\u041E\u0442\u043C\u0435\u0442\u0438\u0442\u044C \u0441\u0430\u043C\u043E\u043C\u0443 \u00B7 1 \u043C\u0438\u043D\u0443\u0442\u0430" }), _jsx(GhostButton, { onClick: () => setWrongOpen(true), children: "\u041D\u0430\u043F\u0438\u0441\u0430\u0442\u044C \u0432 \u041F\u0422\u041E" })] }), wrongOpen ? _jsx(WrongSheet, { onClose: () => setWrongOpen(false) }) : null] }));
    }
    return (_jsxs(ScreenBody, { children: [_jsxs("div", { style: { padding: '20px 24px 0' }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }, children: _jsxs("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.muted }, children: ["\u0428\u0430\u0433 2 \u0438\u0437 3 \u00B7 ", me?.object?.name ?? '', " \u2014 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u043E\u043C"] }) }), _jsxs("div", { style: { display: 'flex', gap: 5, marginTop: 10 }, children: [_jsx("div", { style: { flex: 1, height: 4, borderRadius: 2, background: color.primary } }), _jsx("div", { style: { flex: 1, height: 4, borderRadius: 2, background: color.primary } }), _jsx("div", { style: { flex: 1, height: 4, borderRadius: 2, background: color.track } })] }), _jsx("div", { style: { fontSize: 25, fontWeight: 800, color: color.ink, marginTop: 16, lineHeight: 1.25 }, children: "\u0412\u043E\u0442 \u0432\u0430\u0448\u0438 \u0440\u0430\u0431\u043E\u0442\u044B" }), _jsx("div", { style: { fontSize: 14.5, color: color.inkSoft, marginTop: 6, lineHeight: 1.5 }, children: "\u0418\u0445 \u043D\u0430\u0437\u043D\u0430\u0447\u0438\u043B \u041F\u0422\u041E. \u041A\u0430\u0436\u0434\u044B\u0439 \u0434\u0435\u043D\u044C \u0432\u044B \u043E\u0442\u0447\u0438\u0442\u044B\u0432\u0430\u0435\u0442\u0435\u0441\u044C \u043F\u043E \u043D\u0438\u043C \u2014 \u044D\u0442\u043E \u0437\u0430\u0439\u043C\u0451\u0442 \u043E\u043A\u043E\u043B\u043E 5 \u043C\u0438\u043D\u0443\u0442." })] }), _jsx("div", { style: { padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 8 }, children: groups.map(([label, rows]) => (_jsxs("div", { style: { display: 'contents' }, children: [_jsx("div", { style: {
                                fontSize: 13,
                                fontWeight: 800,
                                letterSpacing: '0.05em',
                                color: color.muted,
                                marginTop: 4,
                            }, children: label.toUpperCase() }), rows.map((r) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: r.name }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }, children: [_jsx("span", { style: { fontSize: 11, color: color.faint }, children: "\u0441\u0440\u043E\u043A" }), _jsx("span", { style: { fontSize: 12.5, fontWeight: 800, ...dueStyle(r.dueDate), ...tabular }, children: r.dueDate ? new Date(r.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '—' })] })] }), r.status === 'blocked' ? (_jsx("div", { style: {
                                        display: 'inline-flex',
                                        marginTop: 6,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: color.warnText,
                                        background: color.warnBg,
                                        borderRadius: radius.tag,
                                        padding: '3px 8px',
                                    }, children: r.blockedReason })) : r.dueDate && new Date(r.dueDate) < new Date() ? (_jsx("div", { style: {
                                        display: 'inline-flex',
                                        marginTop: 6,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        color: color.warnText,
                                        background: color.warnBg,
                                        borderRadius: radius.tag,
                                        padding: '3px 8px',
                                    }, children: dueText(r.dueDate) })) : null] }, r.id)))] }, label))) }), _jsxs("div", { style: { marginTop: 'auto', padding: '16px 24px 26px', display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx(PrimaryButton, { onClick: () => {
                            notify('Готово · работы подтверждены');
                            go('today');
                        }, children: "\u0412\u0441\u0451 \u0432\u0435\u0440\u043D\u043E \u00B7 \u043D\u0430\u0447\u0430\u0442\u044C" }), _jsx(GhostButton, { onClick: () => setWrongOpen(true), children: "\u0427\u0442\u043E-\u0442\u043E \u043D\u0435 \u0442\u0430\u043A" })] }), wrongOpen ? _jsx(WrongSheet, { onClose: () => setWrongOpen(false) }) : null] }));
}
/* ─────────────────────── Экран 2 · «Что-то не так» ─────────────────────── */
const WRONG_CHIPS = [
    'Я веду ещё',
    'Это не мой участок',
    'Работы уже закрыты',
    'Не тот блок или этаж',
];
function WrongSheet({ onClose }) {
    const notify = useApp((s) => s.notify);
    const me = useApp((s) => s.me);
    const [picked, setPicked] = useState(WRONG_CHIPS[0]);
    const [text, setText] = useState('');
    const send = useAction(async () => {
        if (!me?.objectId)
            return;
        // Сообщение уходит в ПТО как запрос — назначение исправят там.
        await api.post('/rfi', {
            objectId: me.objectId,
            question: `Назначение работ: ${picked}. ${text}`.trim(),
        });
        notify('Сообщение ушло в ПТО — назначение исправят там');
        onClose();
    });
    return (_jsxs(BottomSheet, { onClose: onClose, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 800, color: color.ink, marginTop: 14 }, children: "\u0427\u0442\u043E \u043D\u0435 \u0442\u0430\u043A?" }), _jsx("div", { style: { fontSize: 13, color: color.inkMuted, marginTop: 3, lineHeight: 1.45 }, children: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u0443\u0439\u0434\u0451\u0442 \u0432 \u041F\u0422\u041E \u2014 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435 \u0438\u0441\u043F\u0440\u0430\u0432\u044F\u0442 \u0442\u0430\u043C." }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }, children: WRONG_CHIPS.map((c) => (_jsx(Chip, { tone: "dark", active: picked === c, onClick: () => setPicked(c), style: { fontSize: 12.5 }, children: c }, c))) }), _jsxs("div", { style: {
                    marginTop: 10,
                    background: color.screen,
                    border: `1.5px solid ${color.border}`,
                    borderRadius: radius.sm,
                    padding: '12px 14px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    minHeight: 56,
                }, children: [_jsx("input", { value: text, onChange: (e) => setText(e.target.value), placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0435\u0449\u0451 \u0432\u0435\u0434\u0443 \u0441\u0430\u043D\u0442\u0435\u0445\u043D\u0438\u043A\u0443 \u043D\u0430 4 \u044D\u0442\u0430\u0436\u0435 \u0411\u043B\u043E\u043A\u0430 \u0411", style: {
                            flex: 1,
                            border: 'none',
                            outline: 'none',
                            background: 'transparent',
                            fontSize: 14,
                            color: color.ink,
                            fontFamily: 'inherit',
                        } }), _jsx("div", { style: {
                            width: 40,
                            height: 40,
                            borderRadius: radius.sm,
                            background: color.primaryBg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 17,
                            flex: 'none',
                        }, children: "\uD83C\uDFA4" })] }), _jsx(PrimaryButton, { onClick: () => send.run(), disabled: send.busy, style: { marginTop: 14, height: 54 }, children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0432 \u041F\u0422\u041E" })] }));
}
/* ─────────────────────── Экраны 3–4 · Самостоятельная разметка ─────────────────────── */
export function OnboardingBlocksScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const { data: objects } = useQuery('/objects');
    const object = objects?.find((o) => o.id === me?.objectId);
    const [picked, setPicked] = useState(me?.blockId ? [me.blockId] : []);
    return (_jsxs(ScreenBody, { children: [_jsxs("div", { style: { padding: '20px 24px 0' }, children: [_jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.muted }, children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u00B7 \u0448\u0430\u0433 1 \u0438\u0437 2" }), _jsxs("div", { style: { display: 'flex', gap: 5, marginTop: 10 }, children: [_jsx("div", { style: { flex: 1, height: 4, borderRadius: 2, background: color.primary } }), _jsx("div", { style: { flex: 1, height: 4, borderRadius: 2, background: color.track } })] }), _jsx("div", { style: { fontSize: 25, fontWeight: 800, color: color.ink, marginTop: 16, lineHeight: 1.25 }, children: "\u0427\u0442\u043E \u0432\u044B \u0432\u0435\u0434\u0451\u0442\u0435?" }), _jsx("div", { style: { fontSize: 14.5, color: color.inkSoft, marginTop: 6, lineHeight: 1.5 }, children: "\u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u2014 \u0438 \u0433\u043B\u0430\u0432\u043D\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \u0441\u0440\u0430\u0437\u0443 \u0441\u0442\u0430\u043D\u0435\u0442 \u0440\u0430\u0431\u043E\u0447\u0438\u043C. \u042D\u0442\u043E \u0437\u0430\u0439\u043C\u0451\u0442 \u043C\u0438\u043D\u0443\u0442\u0443." }), _jsx("div", { style: { fontSize: 13, fontWeight: 800, color: color.ink, marginTop: 16 }, children: "\u0411\u043B\u043E\u043A \u00B7 \u043C\u043E\u0436\u043D\u043E \u043D\u0435\u0441\u043A\u043E\u043B\u044C\u043A\u043E" })] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 24px 0' }, children: (object?.blocks ?? []).map((b) => {
                    const on = picked.includes(b.id);
                    return (_jsxs("div", { onClick: () => setPicked((p) => (on ? p.filter((x) => x !== b.id) : [...p, b.id])), style: {
                            cursor: 'pointer',
                            background: color.surface,
                            borderRadius: radius.card,
                            padding: 16,
                            display: 'flex',
                            gap: 14,
                            alignItems: 'center',
                            boxShadow: '0 2px 8px rgba(20,22,31,0.06)',
                            ...(on ? { border: `2px solid ${color.primary}` } : null),
                        }, children: [_jsx(CheckSquare, { on: on }), _jsxs("div", { style: { flex: 1 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: color.ink }, children: b.name }), _jsxs("div", { style: { fontSize: 13, color: color.muted }, children: [b.floors, " \u044D\u0442\u0430\u0436\u0435\u0439"] })] })] }, b.id));
                }) }), _jsx("div", { style: { marginTop: 'auto', padding: '16px 24px 26px' }, children: _jsx(PrimaryButton, { onClick: () => go('onboarding-sections'), disabled: picked.length === 0, children: "\u0414\u0430\u043B\u044C\u0448\u0435" }) })] }));
}
export function OnboardingSectionsScreen() {
    const go = useApp((s) => s.go);
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const { data: sections } = useQuery('/sections');
    const [picked, setPicked] = useState(['mono', 'klad']);
    // Число работ считается сразу: разделы × активные этажи.
    const activeFloors = 4;
    const count = picked.length * activeFloors;
    return (_jsxs(ScreenBody, { children: [_jsxs("div", { style: { padding: '20px 24px 0' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.muted }, children: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u00B7 \u0448\u0430\u0433 2 \u0438\u0437 2" }), _jsx("div", { onClick: back, style: { cursor: 'pointer', fontSize: 13, fontWeight: 700, color: color.primary }, children: "\u2039 \u041D\u0430\u0437\u0430\u0434" })] }), _jsxs("div", { style: { display: 'flex', gap: 5, marginTop: 10 }, children: [_jsx("div", { style: { flex: 1, height: 4, borderRadius: 2, background: color.primary } }), _jsx("div", { style: { flex: 1, height: 4, borderRadius: 2, background: color.primary } })] }), _jsx("div", { style: { fontSize: 25, fontWeight: 800, color: color.ink, marginTop: 16, lineHeight: 1.25 }, children: "\u0420\u0430\u0437\u0434\u0435\u043B\u044B \u0440\u0430\u0431\u043E\u0442" })] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 24px 0' }, children: (sections ?? []).map((s) => (_jsx(Chip, { active: picked.includes(s.id), onClick: () => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id])), style: { fontSize: 13 }, children: s.name }, s.id))) }), _jsxs(Card, { style: {
                    margin: '14px 24px 0',
                    borderRadius: radius.sm,
                    padding: '13px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.muted }, children: "\u042D\u0422\u0410\u0416\u0418" }), _jsx("div", { style: { fontSize: 14, fontWeight: 700, color: color.ink, marginTop: 2 }, children: "\u0432\u0441\u0435 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0435 (5\u20138)" })] }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: color.primary }, children: "\u0423\u0442\u043E\u0447\u043D\u0438\u0442\u044C" })] }), _jsxs("div", { style: {
                    margin: '10px 24px 0',
                    background: color.primaryBg,
                    border: `1px solid ${color.primaryBorder}`,
                    borderRadius: radius.md,
                    padding: '14px 16px',
                }, children: [_jsxs("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, ...tabular }, children: ["\u0412\u0430\u0448\u0438 \u0440\u0430\u0431\u043E\u0442\u044B: ", count] }), _jsxs("div", { style: { fontSize: 13, color: color.primaryDark, marginTop: 3, lineHeight: 1.45 }, children: [picked.map((id) => sections?.find((s) => s.id === id)?.name).filter(Boolean).join(', '), " \u00B7", ' ', activeFloors, " \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u044D\u0442\u0430\u0436\u0430"] })] }), _jsx("div", { style: { margin: '10px 24px 0', fontSize: 12, color: color.faint, lineHeight: 1.5 }, children: "4 \u0442\u0430\u043F\u0430 \u0432\u043C\u0435\u0441\u0442\u043E 20+. \u041A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E \u0442\u0430\u043F\u043E\u0432 \u043D\u0435 \u0440\u0430\u0441\u0442\u0451\u0442 \u0441 \u0440\u0430\u0437\u043C\u0435\u0440\u043E\u043C \u043E\u0431\u044A\u0435\u043A\u0442\u0430 \u2014 \u0434\u0430\u0436\u0435 \u043F\u0440\u0438 2 \u0431\u043B\u043E\u043A\u0430\u0445 \u00D7 16 \u044D\u0442\u0430\u0436\u0435\u0439 \u00D7 8 \u0440\u0430\u0437\u0434\u0435\u043B\u043E\u0432." }), _jsx("div", { style: { marginTop: 'auto', padding: '16px 24px 26px' }, children: _jsx(PrimaryButton, { onClick: () => {
                        notify('Настроено · главный экран стал рабочим');
                        go('today');
                    }, disabled: picked.length === 0, children: "\u0413\u043E\u0442\u043E\u0432\u043E" }) })] }));
}
