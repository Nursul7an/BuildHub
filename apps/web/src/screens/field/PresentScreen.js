import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * A7 · Предъявление к освидетельствованию.
 *
 * Даты раньше чем через 3 рабочих дня недоступны: по норме извещение подаётся
 * не позднее этого срока. Они показаны зачёркнутыми, а не спрятаны — иначе
 * непонятно, почему ближайшая дата такая далёкая.
 */
import { useMemo, useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Card, CheckSquare, PrimaryButton, SectionLabel } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
const CHECKLIST = [
    { key: 'complete', label: 'Работа завершена полностью на захватке' },
    { key: 'clean', label: 'Участок убран, доступен для осмотра' },
    { key: 'geometry', label: 'Геометрия проверена, исполнительная схема есть' },
    { key: 'passports', label: 'Материалы имеют паспорта и прошли входной контроль' },
    { key: 'prevAosr', label: 'Предыдущий АОСР подписан' },
    { key: 'remarks', label: 'Замечания прошлого раза устранены' },
];
const NOTIFY = ['ПТО · Гульмира С.', 'Технадзор · Бакыт О.', 'Авторский надзор'];
/** Ближайшие даты: рабочие дни, первые три недоступны по норме извещения. */
function nextDates(count = 6) {
    const result = [];
    const cursor = new Date();
    let workdays = 0;
    while (result.length < count) {
        cursor.setDate(cursor.getDate() + 1);
        const day = cursor.getDay();
        if (day === 0 || day === 6)
            continue;
        workdays += 1;
        result.push({ date: new Date(cursor), allowed: workdays >= 3 });
    }
    return result;
}
export function PresentScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const { data: process } = useQuery(params.processStateId ? `/process/${params.processStateId}` : null);
    const dates = useMemo(() => nextDates(), []);
    const [checked, setChecked] = useState({
        complete: true,
        clean: true,
        geometry: true,
        passports: false,
        prevAosr: true,
        remarks: true,
    });
    const [picked, setPicked] = useState(dates.find((d) => d.allowed)?.date.toISOString() ?? new Date().toISOString());
    const [recipients, setRecipients] = useState(NOTIFY);
    const submit = useAction(async () => {
        if (!process)
            return;
        await api.post(`/process/${process.id}/present`, {
            checklist: CHECKLIST.map((c) => ({ ...c, checked: Boolean(checked[c.key]) })),
            date: picked,
            notify: recipients,
        });
        notify('Ушло в ПТО и технадзору · извещение за 3 рабочих дня');
        go('chain', {
            sectionId: process.sectionId,
            blockId: process.blockId,
            floor: process.floor,
        });
    });
    if (!process)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    const unchecked = CHECKLIST.filter((c) => !checked[c.key]);
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041F\u0440\u0435\u0434\u044A\u044F\u0432\u0438\u0442\u044C \u043A \u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u044E", subtitle: `${process.name} · ${process.blockName} · ${process.floor} эт.`, onBack: back }), _jsx(SectionLabel, { style: { padding: '4px 20px 6px' }, children: "\u0427\u0415\u041A-\u041B\u0418\u0421\u0422 \u0413\u041E\u0422\u041E\u0412\u041D\u041E\u0421\u0422\u0418" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: CHECKLIST.map((c) => (_jsxs("div", { onClick: () => setChecked((s) => ({ ...s, [c.key]: !s[c.key] })), style: {
                        cursor: 'pointer',
                        background: color.surface,
                        borderRadius: radius.sm,
                        padding: '12px 14px',
                        display: 'flex',
                        gap: 12,
                        alignItems: 'center',
                        boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                    }, children: [_jsx(CheckSquare, { on: Boolean(checked[c.key]), size: 24 }), _jsx("div", { style: { fontSize: 13.5, color: color.ink, lineHeight: 1.4 }, children: c.label })] }, c.key))) }), unchecked.length > 0 ? (_jsxs("div", { style: {
                    margin: '8px 20px 0',
                    background: color.warnBg,
                    border: `1px solid ${color.warnBorder}`,
                    borderRadius: radius.smAlt,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: color.warnText,
                    lineHeight: 1.45,
                }, children: ["\u041D\u0435 \u043E\u0442\u043C\u0435\u0447\u0435\u043D\u043E: ", unchecked.map((c) => c.label.toLowerCase()).join('; '), ". \u0422\u0435\u0445\u043D\u0430\u0434\u0437\u043E\u0440 \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442 \u044D\u0442\u043E \u043D\u0430 \u043C\u0435\u0441\u0442\u0435."] })) : null, _jsx(SectionLabel, { style: { padding: '14px 20px 6px' }, children: "\u0414\u0410\u0422\u0410 \u041E\u0421\u0412\u0418\u0414\u0415\u0422\u0415\u041B\u042C\u0421\u0422\u0412\u041E\u0412\u0410\u041D\u0418\u042F" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 20px' }, children: dates.map((d) => {
                    const iso = d.date.toISOString();
                    const on = picked === iso;
                    return (_jsx("div", { onClick: d.allowed ? () => setPicked(iso) : undefined, style: {
                            cursor: d.allowed ? 'pointer' : 'default',
                            borderRadius: radius.smAlt,
                            padding: '10px 13px',
                            fontSize: 13,
                            fontWeight: on ? 800 : 600,
                            ...(d.allowed
                                ? on
                                    ? { background: color.primary, color: '#fff' }
                                    : { background: color.surface, color: color.ink, border: `1px solid ${color.border}` }
                                : {
                                    background: color.screen,
                                    color: color.disabled,
                                    textDecoration: 'line-through',
                                }),
                        }, children: d.date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) }, iso));
                }) }), _jsx("div", { style: { padding: '8px 20px 0', fontSize: 11.5, color: color.faint, lineHeight: 1.45 }, children: "\u043F\u043E \u043D\u043E\u0440\u043C\u0435 \u0438\u0437\u0432\u0435\u0449\u0435\u043D\u0438\u0435 \u2014 \u043D\u0435 \u043F\u043E\u0437\u0434\u043D\u0435\u0435 \u0447\u0435\u043C \u0437\u0430 3 \u0440\u0430\u0431\u043E\u0447\u0438\u0445 \u0434\u043D\u044F" }), _jsx(SectionLabel, { style: { padding: '14px 20px 6px' }, children: "\u041A\u041E\u0413\u041E \u0418\u0417\u0412\u0415\u0429\u0410\u0415\u041C" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: NOTIFY.map((n) => {
                    const on = recipients.includes(n);
                    return (_jsxs(Card, { onClick: () => setRecipients((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n])), style: {
                            borderRadius: radius.sm,
                            padding: '12px 14px',
                            display: 'flex',
                            gap: 12,
                            alignItems: 'center',
                            boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                        }, children: [_jsx(CheckSquare, { on: on, size: 24 }), _jsx("div", { style: { fontSize: 13.5, color: color.ink }, children: n })] }, n));
                }) }), submit.error ? (_jsx("div", { style: { margin: '10px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }, children: submit.error })) : null, _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(PrimaryButton, { onClick: () => submit.run(), disabled: submit.busy || recipients.length === 0, children: "\u041F\u0440\u0435\u0434\u044A\u044F\u0432\u0438\u0442\u044C" }) })] }));
}
