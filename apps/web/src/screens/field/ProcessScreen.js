import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * A4 · Карточка процесса и A6 · Комментарий с типом.
 *
 * Комментарий здесь никогда не «просто текст»: тип выбирается первым, и от
 * него зависит форма и то, что произойдёт дальше — заявка, запись о простое
 * с ценой, уведомление главному инженеру.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, BottomSheet, Card, Chip, PlanFactBars, PrimaryButton, SectionLabel, Stepper, formatNumber, formatPct, tabular, } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
import { dueStyle, dueText } from './TodayScreen';
import { STATUS_LABEL } from './WorksScreen';
const COMMENT_TYPES = [
    { key: 'problem', label: '🔴 Проблема / простой' },
    { key: 'delay', label: '🟠 Задержка' },
    { key: 'material', label: '🟡 Нехватка материала' },
    { key: 'quality', label: '🔵 Качество' },
    { key: 'safety', label: '⚫ Охрана труда' },
    { key: 'other', label: '⚪ Прочее' },
];
export function ProcessScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const startTimer = useApp((s) => s.startTimer);
    const [commentOpen, setCommentOpen] = useState(false);
    const { data: process, reload } = useQuery(params.processStateId ? `/process/${params.processStateId}` : null);
    if (!process)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u2026" });
    const canPresent = process.presentBlockedBy === null;
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: process.name, subtitle: `${process.sectionName} · ${process.blockName} · ${process.floor} эт.`, onBack: back, right: process.requiresAosr ? (_jsx(Badge, { tone: "primary", style: { flexShrink: 0 }, children: "\uD83D\uDD12 \u043D\u0443\u0436\u0435\u043D \u0410\u041E\u0421\u0420" })) : undefined }), _jsxs("div", { style: {
                    margin: '4px 20px',
                    background: color.surface,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 10,
                    boxShadow: '0 2px 8px rgba(20,22,31,0.06)',
                }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, ...dueStyle(process.dueDate) }, children: dueText(process.dueDate) }), process.dueDate ? (_jsxs("div", { style: { fontSize: 12.5, fontWeight: 600, color: color.muted, marginTop: 2 }, children: ["\u0441\u0440\u043E\u043A \u0431\u044B\u043B ", new Date(process.dueDate).toLocaleDateString('ru-RU')] })) : null] }), _jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.primary, whiteSpace: 'nowrap' }, children: "\u0417\u0430\u043F\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0435\u0440\u0435\u043D\u043E\u0441" })] }), process.status === 'blocked' ? (_jsxs("div", { style: {
                    margin: '0 20px 8px',
                    background: color.warnBg,
                    border: `1px solid ${color.warnBorder}`,
                    borderRadius: radius.smAlt,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: color.warnText,
                    lineHeight: 1.45,
                }, children: ["\u26D4 ", process.blockedReason] })) : null, process.strengthBlockedBy ? (_jsxs("div", { style: {
                    margin: '0 20px 8px',
                    background: color.warnBg,
                    border: `1px solid ${color.warnBorder}`,
                    borderRadius: radius.smAlt,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    fontWeight: 800,
                    color: color.warnText,
                    lineHeight: 1.45,
                }, children: ["\uD83E\uDDEA ", process.strengthBlockedBy] })) : null, _jsxs(Card, { style: { margin: '0 20px' }, children: [_jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8 }, children: [_jsx("div", { style: { fontSize: 32, fontWeight: 800, color: color.ink, ...tabular }, children: formatNumber(process.doneQty, process.unit === 'т' ? 2 : 0) }), _jsxs("div", { style: { fontSize: 17, fontWeight: 700, color: color.muted, ...tabular }, children: ["\u0438\u0437 ", formatNumber(process.planQty, process.unit === 'т' ? 1 : 0), " ", process.unit] }), _jsx("div", { style: { marginLeft: 'auto', fontSize: 22, fontWeight: 800, color: color.primary, ...tabular }, children: formatPct(process.pct) })] }), _jsx(PlanFactBars, { planPct: Math.min(100, process.pct + 8), factPct: process.pct }), _jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 8 }, children: ["\u0421\u0442\u0430\u0442\u0443\u0441: ", STATUS_LABEL[process.status], " \u00B7 \u043F\u043B\u0430\u043D \u2014 \u0438\u0437 \u0432\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u0438 \u043E\u0431\u044A\u0451\u043C\u043E\u0432 \u041F\u0422\u041E"] })] }), process.history.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { style: { padding: '12px 20px 4px' }, children: "\u041F\u041E\u0421\u041B\u0415\u0414\u041D\u0418\u0415 \u0417\u0410\u041F\u0418\u0421\u0418" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: process.history.slice(0, 4).map((h, i) => (_jsxs("div", { style: {
                                background: color.surface,
                                borderRadius: radius.sm,
                                padding: '11px 14px',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                gap: 8,
                                boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                            }, children: [_jsx("div", { style: { fontSize: 13.5, fontWeight: 700, color: color.ink }, children: new Date(h.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) }), _jsxs("div", { style: { fontSize: 13.5, color: color.inkMuted, ...tabular }, children: ["+", formatNumber(h.volume, process.unit === 'т' ? 2 : 0), " ", h.unit, " \u00B7 ", h.workers, " \u0447\u0435\u043B \u00B7", ' ', h.photos, " \u0444\u043E\u0442\u043E"] }), _jsx(Badge, { tone: h.status === 'returned' ? 'warn' : 'green', style: { fontSize: 11.5 }, children: h.status === 'returned' ? '↩' : '✓' })] }, `${h.date}-${i}`))) })] })) : null, process.comments.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { style: { padding: '12px 20px 4px' }, children: "\u041A\u041E\u041C\u041C\u0415\u041D\u0422\u0410\u0420\u0418\u0418 \u041F\u041E \u041F\u0420\u041E\u0426\u0415\u0421\u0421\u0423" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: process.comments.slice(0, 3).map((c) => (_jsxs("div", { style: {
                                background: color.surface,
                                borderRadius: radius.sm,
                                padding: '11px 14px',
                                boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                            }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: color.ink }, children: COMMENT_TYPES.find((t) => t.key === c.kind)?.label ?? c.kind }), _jsxs("div", { style: { fontSize: 12.5, color: color.inkMuted, marginTop: 3, lineHeight: 1.45 }, children: [c.materialName ? `${c.materialName} · ${c.materialQty ?? ''}` : c.text, c.idleCost ? ` · ≈ ${c.idleCost.toLocaleString('ru-RU')} сом` : ''] })] }, c.id))) })] })) : null, _jsxs("div", { style: {
                    marginTop: 'auto',
                    padding: '16px 20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                }, children: [_jsx(PrimaryButton, { onClick: () => {
                            startTimer();
                            go('form', { processStateId: process.id });
                        }, disabled: process.status === 'blocked', children: "\u0412\u043D\u0435\u0441\u0442\u0438 \u0432\u044B\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435" }), _jsxs("div", { children: [_jsx("div", { onClick: canPresent ? () => go('present', { processStateId: process.id }) : undefined, style: {
                                    cursor: canPresent ? 'pointer' : 'default',
                                    height: 50,
                                    borderRadius: radius.md,
                                    background: canPresent ? color.chip : color.screen,
                                    color: canPresent ? color.ink : color.faint,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 14.5,
                                    fontWeight: 800,
                                }, children: "\u041F\u0440\u0435\u0434\u044A\u044F\u0432\u0438\u0442\u044C \u043A \u043E\u0441\u0432\u0438\u0434\u0435\u0442\u0435\u043B\u044C\u0441\u0442\u0432\u043E\u0432\u0430\u043D\u0438\u044E" }), process.presentBlockedBy ? (_jsx("div", { style: { fontSize: 11.5, color: color.muted, textAlign: 'center', marginTop: 5 }, children: process.presentBlockedBy })) : null] }), _jsx("div", { onClick: () => setCommentOpen(true), style: {
                            cursor: 'pointer',
                            height: 48,
                            borderRadius: radius.md,
                            background: color.surface,
                            border: `1px solid ${color.border}`,
                            color: color.ink,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                        }, children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" })] }), commentOpen ? (_jsx(CommentSheet, { process: process, onClose: () => {
                    setCommentOpen(false);
                    reload();
                } })) : null] }));
}
/* ───────────────────────────── A6 · Комментарий ───────────────────────────── */
function CommentSheet({ process, onClose }) {
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const [kind, setKind] = useState('material');
    const [text, setText] = useState('');
    const [materialName, setMaterialName] = useState('Арматура А500С Ø12');
    const [materialQty, setMaterialQty] = useState('4,2');
    const [idleWorkers, setIdleWorkers] = useState(24);
    const [idleSince, setIdleSince] = useState('17:20');
    const submit = useAction(async (createZayavka) => {
        const since = new Date();
        const [h, m] = idleSince.split(':').map(Number);
        since.setHours(h ?? 17, m ?? 20, 0, 0);
        const result = await api.post(`/process/${process.id}/comment`, {
            kind,
            text,
            ...(kind === 'material'
                ? {
                    materialName,
                    materialQty: Number(materialQty.replace(',', '.')) || 0,
                    materialUnit: 'т',
                }
                : {}),
            ...(kind === 'problem' ? { idleWorkers, idleSince: since.toISOString() } : {}),
        });
        if (kind === 'problem') {
            notify(`Простой ушёл в ленту проблем руководства${result.idleCost ? ` · ≈ ${result.idleCost.toLocaleString('ru-RU')} сом` : ''}`);
        }
        else if (kind === 'safety') {
            notify('Замечание по охране труда ушло главному инженеру');
        }
        else {
            notify('Комментарий сохранён в карточке процесса');
        }
        onClose();
        if (createZayavka) {
            go('zayavka-new', { processStateId: process.id });
        }
    });
    return (_jsxs(BottomSheet, { onClose: onClose, children: [_jsx("div", { style: { fontSize: 18, fontWeight: 800, color: color.ink, marginTop: 14 }, children: "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439" }), _jsx("div", { style: { fontSize: 13, color: color.inkMuted, marginTop: 3, lineHeight: 1.45 }, children: "\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0442\u0438\u043F \u2014 \u043E\u0442 \u043D\u0435\u0433\u043E \u0437\u0430\u0432\u0438\u0441\u0438\u0442, \u0447\u0442\u043E \u043F\u0440\u043E\u0438\u0437\u043E\u0439\u0434\u0451\u0442 \u0434\u0430\u043B\u044C\u0448\u0435." }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }, children: COMMENT_TYPES.map((t) => (_jsx(Chip, { tone: "dark", active: kind === t.key, onClick: () => setKind(t.key), children: t.label }, t.key))) }), kind === 'material' ? (_jsxs("div", { style: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }, children: [_jsx(SheetField, { label: "\u041C\u0410\u0422\u0415\u0420\u0418\u0410\u041B", value: materialName, onChange: setMaterialName }), _jsx(SheetField, { label: "\u041A\u041E\u041B\u0418\u0427\u0415\u0421\u0422\u0412\u041E, \u0442", value: materialQty, onChange: setMaterialQty })] })) : null, kind === 'problem' ? (_jsxs("div", { style: { marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsxs("div", { style: {
                            background: color.screen,
                            borderRadius: radius.sm,
                            padding: '10px 14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }, children: [_jsx("div", { style: { fontSize: 13, fontWeight: 700, color: color.ink }, children: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u043F\u0440\u043E\u0441\u0442\u0430\u0438\u0432\u0430\u0435\u0442" }), _jsx(Stepper, { value: idleWorkers, onChange: setIdleWorkers })] }), _jsx(SheetField, { label: "\u0421 \u041A\u0410\u041A\u041E\u0413\u041E \u0412\u0420\u0415\u041C\u0415\u041D\u0418", value: idleSince, onChange: setIdleSince }), _jsx("div", { style: {
                            background: color.warnBg,
                            border: `1px solid ${color.warnBorder}`,
                            borderRadius: radius.smAlt,
                            padding: '10px 12px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: color.warnText,
                            lineHeight: 1.45,
                        }, children: "\u26A0 \u0423\u0439\u0434\u0451\u0442 \u0432 \u043B\u0435\u043D\u0442\u0443 \u043F\u0440\u043E\u0431\u043B\u0435\u043C \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u0430 \u0441 \u0440\u0430\u0441\u0447\u0451\u0442\u043D\u043E\u0439 \u043F\u043E\u0442\u0435\u0440\u0435\u0439 \u043F\u043E \u0441\u0442\u0430\u0432\u043A\u0430\u043C" })] })) : null, _jsxs("div", { style: {
                    marginTop: 10,
                    background: color.screen,
                    border: `1.5px solid ${color.border}`,
                    borderRadius: radius.sm,
                    padding: '12px 14px',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'center',
                    minHeight: 56,
                }, children: [_jsx("input", { value: text, onChange: (e) => setText(e.target.value), placeholder: "\u0427\u0442\u043E \u043F\u0440\u043E\u0438\u0437\u043E\u0448\u043B\u043E", style: {
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
                        }, children: "\uD83C\uDFA4" })] }), submit.error ? (_jsx("div", { style: { marginTop: 8, fontSize: 12.5, fontWeight: 800, color: color.danger }, children: submit.error })) : null, kind === 'material' ? (_jsx(PrimaryButton, { onClick: () => submit.run(true), style: { marginTop: 14, height: 54 }, children: "\uD83D\uDCE6 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u043F\u043E \u044D\u0442\u043E\u043C\u0443 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0443" })) : null, _jsx("div", { onClick: () => submit.run(false), style: {
                    cursor: 'pointer',
                    marginTop: 10,
                    height: 50,
                    borderRadius: radius.md,
                    background: kind === 'material' ? color.chip : color.primary,
                    color: kind === 'material' ? color.ink : '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 15,
                    fontWeight: 800,
                }, children: kind === 'problem' ? 'Зафиксировать простой' : 'Сохранить комментарий' })] }));
}
function SheetField({ label, value, onChange, }) {
    return (_jsxs("div", { style: { background: color.screen, borderRadius: radius.sm, padding: '10px 14px' }, children: [_jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted }, children: label }), _jsx("input", { value: value, onChange: (e) => onChange(e.target.value), style: {
                    width: '100%',
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    fontSize: 15,
                    fontWeight: 700,
                    color: color.ink,
                    marginTop: 2,
                    fontFamily: 'inherit',
                } })] }));
}
