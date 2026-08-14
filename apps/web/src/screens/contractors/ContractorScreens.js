import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * В1–В3 · Подрядчики, разложение рейтинга, оценка.
 *
 * Рейтинг — это не одна цифра: автоматическая часть считается из данных
 * системы, субъективная приходит от прораба. Разложение открывается по тапу
 * на цифру, иначе оценке не верят.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Card, Chip, PrimaryButton, SectionLabel, tabular } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
function ratingColor(rating) {
    if (rating >= 4)
        return color.greenDeep;
    if (rating >= 3)
        return color.warnStrong;
    return color.danger;
}
function ratingLabel(rating) {
    if (rating >= 4)
        return 'надёжный';
    if (rating >= 3)
        return 'под вопросом';
    return 'проблемный';
}
export function ContractorsScreen() {
    const go = useApp((s) => s.go);
    const { data } = useQuery('/contractors');
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u041F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A\u0438", subtitle: `${data?.length ?? 0} на объекте` }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: (data ?? []).map((c) => (_jsxs(Card, { onClick: () => go('contractor', { contractorId: c.id }), style: {
                        borderRadius: radius.md,
                        padding: '14px 16px',
                        ...(c.stopped ? { border: '1.5px solid #F0B4B0' } : null),
                    }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink }, children: c.name }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 2 }, children: c.scope })] }), _jsxs("div", { style: { textAlign: 'right', flexShrink: 0 }, children: [_jsxs("div", { style: { fontSize: 17, fontWeight: 800, color: ratingColor(c.rating), ...tabular }, children: [c.rating.toFixed(1).replace('.', ','), " / 5"] }), _jsx("div", { style: { fontSize: 11, fontWeight: 800, color: ratingColor(c.rating) }, children: ratingLabel(c.rating) })] })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 6, ...tabular }, children: [c.activeWorkers, " \u0447\u0435\u043B \u0441\u0435\u0433\u043E\u0434\u043D\u044F \u00B7 \u043F\u0440\u0435\u0434\u043F\u0438\u0441\u0430\u043D\u0438\u044F: \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 ", c.prescriptionsOpen, " \u00B7 \u0432\u0441\u0435\u0433\u043E", ' ', c.prescriptionsTotal] }), c.stopped ? (_jsxs("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.danger, marginTop: 6, lineHeight: 1.4 }, children: ["\u26D4 \u0420\u0430\u0431\u043E\u0442\u044B \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B \u00B7 ", c.stopReason] })) : null] }, c.id))) })] }));
}
export function ContractorCardScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const me = useApp((s) => s.me);
    const [showBreakdown, setShowBreakdown] = useState(false);
    const { data } = useQuery('/contractors');
    const contractor = data?.find((c) => c.id === params.contractorId);
    const prescribe = useAction(async () => {
        await api.post(`/contractors/${params.contractorId}/prescription`, {
            kind: 'safety',
            text: 'Нарушение ТБ — работа на высоте без страховочной системы',
            location: 'Блок А, 5 эт.',
            dueDays: 3,
            photos: [],
        });
        notify(me?.role === 'master'
            ? 'Зафиксировано · ушло прорабу — предписание выдаёт он'
            : 'Предписание выдано · копия главному инженеру');
    });
    if (!contractor)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    const auto = contractor.breakdown.auto;
    const manual = contractor.breakdown.manual;
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: contractor.name, subtitle: contractor.scope, onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, onClick: () => setShowBreakdown((v) => !v), children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 10 }, children: [_jsx("div", { style: { fontSize: 38, fontWeight: 800, color: ratingColor(contractor.rating), ...tabular }, children: contractor.rating.toFixed(1).replace('.', ',') }), _jsx("div", { style: { fontSize: 17, fontWeight: 700, color: color.muted }, children: "\u0438\u0437 5" }), _jsx("div", { style: { marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: color.primary }, children: showBreakdown ? 'свернуть' : 'как посчитано ›' })] }), showBreakdown ? (_jsxs("div", { style: { marginTop: 12 }, children: [_jsxs(SectionLabel, { style: { fontSize: 12 }, children: ["\u0418\u0417 \u0414\u0410\u041D\u041D\u042B\u0425 \u0421\u0418\u0421\u0422\u0415\u041C\u042B \u00B7 \u0432\u0435\u0441 ", Math.round(auto.weight * 100), "%"] }), _jsx(ScoreRow, { label: "\u0421\u0440\u043E\u043A\u0438 \u044D\u0442\u0430\u043F\u043E\u0432", value: auto.onTime }), _jsx(ScoreRow, { label: "\u041F\u0435\u0440\u0435\u0434\u0435\u043B\u043A\u0438", value: auto.rework }), _jsx(ScoreRow, { label: "\u041D\u0430\u0440\u0443\u0448\u0435\u043D\u0438\u044F \u0422\u0411", value: auto.safety }), _jsx(ScoreRow, { label: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u0432\u043E\u0432\u0440\u0435\u043C\u044F", value: auto.docs }), _jsxs(SectionLabel, { style: { fontSize: 12, marginTop: 12 }, children: ["\u041E\u0426\u0415\u041D\u041A\u0410 \u041F\u0420\u041E\u0420\u0410\u0411\u0410 \u00B7 \u0432\u0435\u0441 ", Math.round(manual.weight * 100), "% \u00B7 ", manual.count, " \u043E\u0446\u0435\u043D\u043E\u043A"] }), _jsx(ScoreRow, { label: "\u041A\u0430\u0447\u0435\u0441\u0442\u0432\u043E", value: manual.quality }), _jsx(ScoreRow, { label: "\u041E\u0445\u0440\u0430\u043D\u0430 \u0442\u0440\u0443\u0434\u0430", value: manual.safety }), _jsx(ScoreRow, { label: "\u0423\u043F\u0440\u0430\u0432\u043B\u044F\u0435\u043C\u043E\u0441\u0442\u044C", value: manual.management }), _jsx(ScoreRow, { label: "\u041A\u0443\u043B\u044C\u0442\u0443\u0440\u0430 \u043F\u0440\u043E\u0438\u0437\u0432\u043E\u0434\u0441\u0442\u0432\u0430", value: manual.culture })] })) : null] }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsxs("div", { style: { fontSize: 13.5, color: color.inkMuted, ...tabular }, children: [contractor.activeWorkers, " \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u043D\u0430 \u043E\u0431\u044A\u0435\u043A\u0442\u0435 \u0441\u0435\u0433\u043E\u0434\u043D\u044F"] }), _jsxs("div", { style: { fontSize: 13.5, color: color.inkMuted, marginTop: 4, ...tabular }, children: ["\u041F\u0440\u0435\u0434\u043F\u0438\u0441\u0430\u043D\u0438\u044F: \u043E\u0442\u043A\u0440\u044B\u0442\u044B\u0445 ", contractor.prescriptionsOpen, " \u0438\u0437 ", contractor.prescriptionsTotal] }), contractor.stopped ? (_jsxs("div", { style: {
                            marginTop: 10,
                            background: color.warnBg,
                            border: `1px solid ${color.warnBorder}`,
                            borderRadius: radius.xs,
                            padding: '10px 12px',
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: color.warnText,
                            lineHeight: 1.45,
                        }, children: ["\u26D4 ", contractor.stopReason] })) : null] }), _jsxs("div", { style: {
                    marginTop: 'auto',
                    padding: '16px 20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }, children: [_jsx(PrimaryButton, { onClick: () => go('contractor-rate', { contractorId: contractor.id }), children: "\u041E\u0446\u0435\u043D\u0438\u0442\u044C \u044D\u0442\u0430\u043F" }), _jsx("div", { onClick: () => prescribe.run(), style: {
                            cursor: 'pointer',
                            height: 50,
                            borderRadius: radius.md,
                            background: color.chip,
                            color: color.ink,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14.5,
                            fontWeight: 800,
                        }, children: me?.role === 'master' ? 'Зафиксировать нарушение' : 'Выдать предписание' })] })] }));
}
function ScoreRow({ label, value }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }, children: [_jsx("div", { style: { flex: 1, fontSize: 13, color: color.ink }, children: label }), _jsx("div", { style: { width: 90, height: 6, borderRadius: 3, background: color.track }, children: _jsx("div", { style: {
                        width: `${(value / 5) * 100}%`,
                        height: 6,
                        borderRadius: 3,
                        background: ratingColor(value),
                    } }) }), _jsx("div", { style: { width: 30, fontSize: 12.5, fontWeight: 800, color: color.ink, textAlign: 'right', ...tabular }, children: value.toFixed(1).replace('.', ',') })] }));
}
/* ───────────────────────────── В3 · Оценка ───────────────────────────── */
const CRITERIA = [
    { key: 'quality', label: 'Качество работ', hint: 'переделки, замечания технадзора' },
    { key: 'safety', label: 'Охрана труда', hint: 'каски, страховка, ограждения' },
    { key: 'management', label: 'Управляемость', hint: 'реагирует на замечания, держит слово' },
    { key: 'culture', label: 'Культура производства', hint: 'убирает за собой, не мешает смежникам' },
];
export function ContractorRateScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const [values, setValues] = useState({});
    const [comment, setComment] = useState('');
    const { data } = useQuery('/contractors');
    const contractor = data?.find((c) => c.id === params.contractorId);
    const submit = useAction(async () => {
        await api.post(`/contractors/${params.contractorId}/rate`, {
            quality: values.quality ?? 3,
            safety: values.safety ?? 3,
            management: values.management ?? 3,
            culture: values.culture ?? 3,
            comment: comment || undefined,
        });
        notify('Оценка сохранена · войдёт в рейтинг подрядчика');
        go('contractor', { contractorId: params.contractorId });
    });
    const complete = CRITERIA.every((c) => values[c.key]);
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041E\u0446\u0435\u043D\u043A\u0430 \u043F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A\u0430", subtitle: contractor?.name ?? '', onBack: back }), _jsx("div", { style: { padding: '4px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }, children: "\u041E\u0446\u0435\u043D\u043A\u0430 \u0441\u0443\u0431\u044A\u0435\u043A\u0442\u0438\u0432\u043D\u0430\u044F \u0438 \u0432\u0435\u0441\u0438\u0442 \u043C\u0435\u043D\u044C\u0448\u0435 \u0434\u0430\u043D\u043D\u044B\u0445 \u0441\u0438\u0441\u0442\u0435\u043C\u044B. \u041F\u043E\u0434\u0440\u044F\u0434\u0447\u0438\u043A \u0432\u0438\u0434\u0438\u0442 \u0438\u0442\u043E\u0433, \u043D\u043E \u043D\u0435 \u0432\u0430\u0448\u0443 \u0447\u0430\u0441\u0442\u044C \u043E\u0442\u0434\u0435\u043B\u044C\u043D\u043E." }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 0' }, children: CRITERIA.map((c) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink }, children: c.label }), _jsx("div", { style: { fontSize: 12, color: color.muted, marginTop: 2 }, children: c.hint }), _jsx("div", { style: { display: 'flex', gap: 6, marginTop: 10 }, children: [1, 2, 3, 4, 5].map((n) => {
                                const on = values[c.key] === n;
                                return (_jsx("div", { onClick: () => setValues((v) => ({ ...v, [c.key]: n })), style: {
                                        cursor: 'pointer',
                                        flex: 1,
                                        height: 44,
                                        borderRadius: radius.xs,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontSize: 16,
                                        fontWeight: 800,
                                        ...(on
                                            ? { background: color.primary, color: '#fff' }
                                            : { background: color.screen, color: color.ink }),
                                    }, children: n }, n));
                            }) })] }, c.key))) }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u041A\u041E\u041C\u041C\u0415\u041D\u0422\u0410\u0420\u0418\u0419" }), _jsx("input", { value: comment, onChange: (e) => setComment(e.target.value), placeholder: "\u0447\u0442\u043E \u0441\u0442\u043E\u0438\u0442 \u0443\u0447\u0435\u0441\u0442\u044C \u0432 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439 \u0440\u0430\u0437", style: {
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
                        } })] }), _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(PrimaryButton, { onClick: () => submit.run(), disabled: !complete || submit.busy, children: complete ? 'Сохранить оценку' : 'Оцените все четыре критерия' }) })] }));
}
export { Chip };
