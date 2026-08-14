import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * ТХ1 · Заявка на спецтехнику и ТХ3 · Отчёт по технике.
 *
 * Заявка не уходит, пока фронт не готов: техника, приехавшая на неготовую
 * площадку, — это простой, за который платит компания. Отчёт после смены
 * обязателен: без него нет ни моточасов, ни причины простоя.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Card, CheckSquare, Chip, PrimaryButton, SectionLabel, tabular } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
const MACHINE_TYPES = ['Кран', 'Экскаватор', 'Автобетононасос', 'Самосвал', 'Погрузчик'];
const FRONT_CHECKLIST = [
    { key: 'access', label: 'Подъезд свободен, площадка под опоры готова' },
    { key: 'people', label: 'Стропальщик с удостоверением на смене' },
    { key: 'front', label: 'Фронт работ размечен и освобождён' },
    { key: 'power', label: 'Питание / подключение обеспечено' },
    { key: 'safety', label: 'Опасная зона огорожена, схема согласована' },
];
export function TechZayavkaScreen() {
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const me = useApp((s) => s.me);
    const [machineType, setMachineType] = useState(MACHINE_TYPES[0]);
    const [hours, setHours] = useState('8');
    const [date, setDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 2);
        return d.toISOString().slice(0, 10);
    });
    const [timeFrom, setTimeFrom] = useState('08:00');
    const [checked, setChecked] = useState({});
    const ready = FRONT_CHECKLIST.every((c) => checked[c.key]);
    const create = useAction(async () => {
        if (!me?.objectId)
            return;
        const res = await api.post('/zayavki', {
            kind: 'tech',
            objectId: me.objectId,
            priority: 'norm',
            items: [{ rawText: `${machineType} · ${hours} ч`, qty: Number(hours) || 1, unit: 'сут' }],
            tech: {
                machineType,
                hours: Number(hours) || 1,
                date,
                timeFrom,
                frontChecklist: FRONT_CHECKLIST.map((c) => ({ ...c, checked: Boolean(checked[c.key]) })),
            },
        });
        notify(`${res.number} ушла координатору техники`);
        go('zayavka', { zayavkaId: res.id });
    });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0417\u0430\u044F\u0432\u043A\u0430 \u043D\u0430 \u0442\u0435\u0445\u043D\u0438\u043A\u0443", subtitle: "\u0441\u043F\u0435\u0446\u0442\u0435\u0445\u043D\u0438\u043A\u0430", onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx(SectionLabel, { children: "\u0427\u0422\u041E \u041D\u0423\u0416\u041D\u041E" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }, children: MACHINE_TYPES.map((t) => (_jsx(Chip, { active: machineType === t, onClick: () => setMachineType(t), style: { fontSize: 12 }, children: t }, t))) }), _jsxs("div", { style: { display: 'flex', gap: 10, marginTop: 12 }, children: [_jsx(LabeledInput, { label: "\u0414\u0410\u0422\u0410", type: "date", value: date, onChange: setDate }), _jsx(LabeledInput, { label: "\u0421", type: "time", value: timeFrom, onChange: setTimeFrom, width: 100 }), _jsx(LabeledInput, { label: "\u0427\u0410\u0421\u041E\u0412", value: hours, onChange: setHours, width: 80 })] })] }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u0413\u041E\u0422\u041E\u0412\u041D\u041E\u0421\u0422\u042C \u0424\u0420\u041E\u041D\u0422\u0410" }), _jsx("div", { style: { fontSize: 12, color: color.muted, marginTop: 4, lineHeight: 1.45 }, children: "\u0422\u0435\u0445\u043D\u0438\u043A\u0430, \u043F\u0440\u0438\u0435\u0445\u0430\u0432\u0448\u0430\u044F \u043D\u0430 \u043D\u0435\u0433\u043E\u0442\u043E\u0432\u0443\u044E \u043F\u043B\u043E\u0449\u0430\u0434\u043A\u0443, \u2014 \u044D\u0442\u043E \u043F\u0440\u043E\u0441\u0442\u043E\u0439, \u0437\u0430 \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u043F\u043B\u0430\u0442\u0438\u0442 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u044F." }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }, children: FRONT_CHECKLIST.map((c) => (_jsxs("div", { onClick: () => setChecked((s) => ({ ...s, [c.key]: !s[c.key] })), style: {
                                cursor: 'pointer',
                                background: color.screen,
                                borderRadius: radius.xs,
                                padding: '11px 12px',
                                display: 'flex',
                                gap: 10,
                                alignItems: 'center',
                            }, children: [_jsx(CheckSquare, { on: Boolean(checked[c.key]), size: 22 }), _jsx("div", { style: { fontSize: 13, color: color.ink, lineHeight: 1.4 }, children: c.label })] }, c.key))) })] }), create.error ? (_jsx("div", { style: { margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }, children: create.error })) : null, _jsxs("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: [!ready ? (_jsx("div", { style: { fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center', marginBottom: 8 }, children: "\u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0432\u0441\u044E \u0433\u043E\u0442\u043E\u0432\u043D\u043E\u0441\u0442\u044C \u0444\u0440\u043E\u043D\u0442\u0430 \u2014 \u0438\u043D\u0430\u0447\u0435 \u0437\u0430\u044F\u0432\u043A\u0430 \u043D\u0435 \u0443\u0439\u0434\u0451\u0442" })) : null, _jsx(PrimaryButton, { onClick: () => create.run(), disabled: !ready || create.busy, children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443" })] })] }));
}
/* ───────────────────────────── ТХ3 · Отчёт по технике ───────────────────────────── */
export function TechReportScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const { data: zayavka } = useQuery(params.zayavkaId ? `/zayavki/${params.zayavkaId}` : null);
    const [actual, setActual] = useState('');
    const [idle, setIdle] = useState('0');
    const [idleReason, setIdleReason] = useState(null);
    const [fuel, setFuel] = useState('');
    const [faults, setFaults] = useState('');
    const idleNum = Number(idle.replace(',', '.')) || 0;
    const submit = useAction(async () => {
        if (!zayavka?.tech)
            return;
        await api.post(`/tech/${zayavka.tech.id}/report`, {
            hoursPlanned: zayavka.tech.hours,
            hoursActual: Number(actual.replace(',', '.')) || 0,
            idleHours: idleNum,
            idleReason: idleReason ?? undefined,
            fuel: fuel ? Number(fuel.replace(',', '.')) : undefined,
            faults: faults || undefined,
        });
        notify('Смена закрыта · моточасы и простой учтены');
        go('tech-queue');
    });
    if (!zayavka?.tech)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    const blocker = !actual
        ? 'Укажите фактические часы'
        : idleNum > 0 && !idleReason
            ? 'Укажите причину простоя'
            : null;
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041E\u0442\u0447\u0451\u0442 \u043F\u043E \u0442\u0435\u0445\u043D\u0438\u043A\u0435", subtitle: `${zayavka.tech.machineType} · ${zayavka.number}`, onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsxs("div", { style: { fontSize: 13, color: color.muted, ...tabular }, children: ["\u041F\u043B\u0430\u043D: ", zayavka.tech.hours, " \u0447 \u00B7 ", new Date(zayavka.tech.date).toLocaleDateString('ru-RU'), " \u0441", ' ', zayavka.tech.timeFrom] }), _jsxs("div", { style: { display: 'flex', gap: 10, marginTop: 10 }, children: [_jsx(LabeledInput, { label: "\u0424\u0410\u041A\u0422, \u0427", value: actual, onChange: setActual, width: 100 }), _jsx(LabeledInput, { label: "\u041F\u0420\u041E\u0421\u0422\u041E\u0419, \u0427", value: idle, onChange: setIdle, width: 110 }), _jsx(LabeledInput, { label: "\u0422\u041E\u041F\u041B\u0418\u0412\u041E, \u041B", value: fuel, onChange: setFuel, width: 110 })] }), idleNum > 0 ? (_jsxs("div", { style: { marginTop: 12 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.muted }, children: "\u041F\u0420\u0418\u0427\u0418\u041D\u0410 \u041F\u0420\u041E\u0421\u0422\u041E\u042F" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }, children: ['фронт не готов', 'нет материала', 'погода', 'неисправность', 'нет людей'].map((r) => (_jsx(Chip, { tone: "dark", active: idleReason === r, onClick: () => setIdleReason(r), style: { fontSize: 12 }, children: r }, r))) })] })) : null] }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u041D\u0415\u0418\u0421\u041F\u0420\u0410\u0412\u041D\u041E\u0421\u0422\u0418" }), _jsx("input", { value: faults, onChange: (e) => setFaults(e.target.value), placeholder: "\u0435\u0441\u043B\u0438 \u0435\u0441\u0442\u044C \u2014 \u0443\u0439\u0434\u0451\u0442 \u0433\u043B\u0430\u0432\u043D\u043E\u043C\u0443 \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u0443", style: {
                            width: '100%',
                            boxSizing: 'border-box',
                            border: 'none',
                            outline: 'none',
                            background: color.screen,
                            borderRadius: radius.xs,
                            padding: '11px 12px',
                            fontSize: 14,
                            color: color.ink,
                            marginTop: 8,
                            fontFamily: 'inherit',
                        } })] }), submit.error ? (_jsx("div", { style: { margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }, children: submit.error })) : null, _jsxs("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: [blocker ? (_jsx("div", { style: { fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center', marginBottom: 8 }, children: blocker })) : null, _jsx(PrimaryButton, { onClick: () => submit.run(), disabled: Boolean(blocker) || submit.busy, children: "\u0417\u0430\u043A\u0440\u044B\u0442\u044C \u0441\u043C\u0435\u043D\u0443" })] })] }));
}
/* ───────────────────────────── СТ3 · Парк и график ───────────────────────────── */
export function FleetScreen() {
    const { data } = useQuery('/machines');
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041F\u0430\u0440\u043A \u0442\u0435\u0445\u043D\u0438\u043A\u0438", subtitle: `${data?.length ?? 0} единиц`, padding: "16px 20px 8px" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: (data ?? []).map((m) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: m.name }), _jsx("div", { style: {
                                        fontSize: 12,
                                        fontWeight: 800,
                                        borderRadius: radius.tag,
                                        padding: '3px 8px',
                                        whiteSpace: 'nowrap',
                                        ...(m.status === 'free'
                                            ? { color: color.greenDeep, background: color.greenBg }
                                            : m.status === 'busy'
                                                ? { color: color.primary, background: color.primaryBg }
                                                : { color: color.warnText, background: color.warnBg }),
                                    }, children: m.status === 'free' ? 'свободна' : m.status === 'busy' ? 'занята' : 'в ремонте' })] }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: m.kind }), m.serviceSoon ? (_jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: color.warnText, marginTop: 6 }, children: ["\uD83D\uDD27 \u0422\u041E ", new Date(m.nextServiceAt).toLocaleDateString('ru-RU'), " \u2014 \u043C\u0435\u043D\u044C\u0448\u0435 \u0434\u0432\u0443\u0445 \u043D\u0435\u0434\u0435\u043B\u044C"] })) : null, m.permitExpiring ? (_jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: color.danger, marginTop: 4 }, children: ["\uD83D\uDCC4 \u0414\u043E\u043F\u0443\u0441\u043A \u0434\u043E ", new Date(m.permitUntil).toLocaleDateString('ru-RU'), " \u2014 \u0438\u0441\u0442\u0435\u043A\u0430\u0435\u0442"] })) : null] }, m.id))) })] }));
}
function LabeledInput({ label, value, onChange, type = 'text', width, }) {
    return (_jsxs("div", { style: { flex: width ? 'none' : 1, width }, children: [_jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted }, children: label }), _jsx("input", { value: value, type: type, onChange: (e) => onChange(e.target.value), style: {
                    width: '100%',
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    background: color.screen,
                    borderRadius: radius.xs,
                    padding: '10px 12px',
                    fontSize: 15,
                    fontWeight: 700,
                    color: color.ink,
                    marginTop: 4,
                    fontFamily: 'inherit',
                    fontVariantNumeric: 'tabular-nums',
                } })] }));
}
