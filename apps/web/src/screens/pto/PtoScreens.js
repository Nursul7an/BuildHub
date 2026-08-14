import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * Роль ПТО: T1 «Сегодня», T2 очередь приёмки, C2/C3 проверка и корректировка,
 * T6/T7 объекты, Г4 настройка цепочки, ADM1–ADM3 пользователи.
 *
 * ПТО — единственная роль, которая может изменить чужие данные, поэтому у
 * корректировки обязательна причина: прораб увидит её в своём отчёте.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, Card, CheckSquare, Chip, PrimaryButton, SectionLabel, formatNumber, tabular, } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { ROLE_TITLE, ROLES } from '@build-hub/shared';
import { useApp } from '../../store/app';
/* ───────────────────────────── T1 · Сегодня ───────────────────────────── */
export function PtoTodayScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const { data: queue } = useQuery('/reports/queue');
    const { data: notifications, reload } = useQuery('/notifications?unread=1');
    const { data: protocols } = useQuery('/strength-protocols');
    const blocking = (protocols ?? []).filter((p) => p.blocksStripping);
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0421\u0435\u0433\u043E\u0434\u043D\u044F", subtitle: `${me?.fullName ?? ''} · инженер ПТО` }), (notifications ?? []).length > 0 ? (_jsxs(_Fragment, { children: [_jsxs(SectionLabel, { tone: "green", style: { padding: '4px 20px 0', fontSize: 12.5, fontWeight: 800 }, children: ["\uD83D\uDD14 \u041D\u041E\u0412\u041E\u0415 \u0421 \u041F\u041B\u041E\u0429\u0410\u0414\u041A\u0418 \u00B7 ", notifications.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 20px 0' }, children: notifications.slice(0, 4).map((n) => (_jsxs("div", { onClick: async () => {
                                await api.post(`/notifications/${n.id}/read`);
                                reload();
                            }, style: {
                                cursor: 'pointer',
                                background: color.greenBg,
                                border: `1px solid ${color.greenBorder}`,
                                borderRadius: radius.md,
                                padding: '12px 15px',
                            }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: color.ink }, children: n.title }), _jsx("div", { style: { fontSize: 12.5, color: color.inkSoft, marginTop: 3, lineHeight: 1.45 }, children: n.subtitle }), _jsx("div", { style: { fontSize: 11, color: color.greenMuted, marginTop: 5 }, children: "\u0442\u0430\u043F \u2014 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E" })] }, n.id))) })] })) : null, _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 20px' }, children: [_jsxs(Card, { onClick: () => go('pto-queue'), style: {
                            borderRadius: radius.md,
                            padding: '14px 16px',
                            ...((queue ?? []).length > 0 ? { border: `1.5px solid ${color.primaryBorder}` } : null),
                        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink }, children: "\u041E\u0442\u0447\u0451\u0442\u044B \u043D\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0443" }), _jsx(Badge, { tone: (queue ?? []).length > 0 ? 'primary' : 'green', children: (queue ?? []).length > 0 ? `${queue.length} ждут` : 'очередь пуста' })] }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C \u00B7 \u0441\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u00B7 \u0432\u0435\u0440\u043D\u0443\u0442\u044C" })] }), _jsxs(Card, { onClick: () => go('pto-objects'), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink }, children: "\u041E\u0431\u044A\u0435\u043A\u0442\u044B \u0438 \u0446\u0435\u043F\u043E\u0447\u043A\u0438" }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: "\u0421\u043E\u0441\u0442\u0430\u0432 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0432 \u043F\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430\u043C, \u0432\u0435\u0434\u043E\u043C\u043E\u0441\u0442\u044C \u043E\u0431\u044A\u0451\u043C\u043E\u0432" })] }), _jsxs(Card, { onClick: () => go('pto-lab'), style: {
                            borderRadius: radius.md,
                            padding: '14px 16px',
                            ...(blocking.length > 0 ? { border: `1.5px solid ${color.warnBorder}` } : null),
                        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink }, children: "\u041B\u0430\u0431\u043E\u0440\u0430\u0442\u043E\u0440\u0438\u044F" }), _jsx(Badge, { tone: blocking.length > 0 ? 'warn' : 'green', children: blocking.length > 0 ? `${blocking.length} держит работу` : 'нет ограничений' })] }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: "\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u044B \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u0438 \u0431\u0435\u0442\u043E\u043D\u0430 \u2014 \u0448\u043B\u044E\u0437 \u0440\u0430\u0441\u043F\u0430\u043B\u0443\u0431\u043A\u0438" })] }), _jsxs(Card, { onClick: () => go('pto-users'), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink }, children: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438 \u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u044B" }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: "\u0417\u0430\u0432\u0435\u0441\u0442\u0438 \u043F\u0440\u043E\u0440\u0430\u0431\u0430 \u0438\u043B\u0438 \u043C\u0430\u0441\u0442\u0435\u0440\u0430, \u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C" })] })] })] }));
}
/* ───────────────────────────── T2 · Очередь ───────────────────────────── */
export function PtoQueueScreen() {
    const go = useApp((s) => s.go);
    const { data: queue, loading } = useQuery('/reports/queue');
    if (loading)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043E\u0447\u0435\u0440\u0435\u0434\u044C\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u041F\u0440\u0438\u0451\u043C\u043A\u0430", subtitle: `${(queue ?? []).length} отчётов ждут проверки` }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: [(queue ?? []).map((r) => (_jsxs(Card, { onClick: () => go('pto-check', { reportId: r.id }), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: r.authorName }), _jsx("div", { style: { fontSize: 12, color: color.muted, ...tabular }, children: new Date(r.date).toLocaleDateString('ru-RU') })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: [r.objectName, " \u00B7 ", r.entries.length, " \u0437\u0430\u043F\u0438\u0441\u0435\u0439", r.fillSeconds ? ` · заполнял ${Math.round(r.fillSeconds / 60)} мин` : ''] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }, children: r.entries.slice(0, 3).map((e) => (_jsxs("div", { style: { fontSize: 12.5, color: color.inkMuted, ...tabular }, children: [e.title, " \u00B7 +", formatNumber(e.volume, e.unit === 'т' ? 2 : 0), " ", e.unit, " \u00B7 ", e.photos.length, " \u0444\u043E\u0442\u043E"] }, e.id))) })] }, r.id))), (queue ?? []).length === 0 ? (_jsx("div", { style: { padding: 24, textAlign: 'center', color: color.muted, fontSize: 13.5 }, children: "\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u043F\u0443\u0441\u0442\u0430 \u2014 \u0432\u0441\u0435 \u043E\u0442\u0447\u0451\u0442\u044B \u043F\u0440\u043E\u0432\u0435\u0440\u0435\u043D\u044B" })) : null] })] }));
}
/* ───────────────────────── C2/C3 · Проверка и корректировка ───────────────────────── */
export function PtoCheckScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const { data: report } = useQuery(params.reportId ? `/report/${params.reportId}` : null);
    const [adjusting, setAdjusting] = useState(null);
    const [newValue, setNewValue] = useState('');
    const [reason, setReason] = useState('');
    const [returnComment, setReturnComment] = useState('');
    const [returning, setReturning] = useState(false);
    const [disputed, setDisputed] = useState([]);
    const decide = useAction(async (body) => {
        await api.post(`/report/${params.reportId}/check`, body);
        notify(body.decision === 'accept'
            ? 'Отчёт подтверждён · данные ушли руководству'
            : body.decision === 'adjust'
                ? 'Корректировка сохранена · прораб увидит причину'
                : 'Отчёт возвращён прорабу');
        go('pto-queue');
    });
    if (!report)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043E\u0442\u0447\u0451\u0442\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: `Отчёт ${report.authorName ?? ''}`, subtitle: `${new Date(report.date).toLocaleDateString('ru-RU')} · ${report.objectName ?? ''}`, onBack: back }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 0' }, children: report.entries.map((e) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }, children: e.title }), returning ? (_jsx("div", { onClick: () => setDisputed((d) => (d.includes(e.id) ? d.filter((x) => x !== e.id) : [...d, e.id])), style: { cursor: 'pointer', flexShrink: 0 }, children: _jsx(CheckSquare, { on: disputed.includes(e.id), size: 22 }) })) : null] }), _jsxs("div", { style: { fontSize: 14, color: color.inkMuted, marginTop: 6, ...tabular }, children: [_jsxs("b", { style: { color: color.ink }, children: ["+", formatNumber(e.volume, e.unit === 'т' ? 2 : 0), " ", e.unit] }), ' ', "\u00B7 ", e.workers, " \u0447\u0435\u043B \u00B7 ", e.photos.length, " \u0444\u043E\u0442\u043E"] }), e.tempAir !== null ? (_jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 3, ...tabular }, children: ["\uD83C\uDF21 \u0432\u043E\u0437\u0434\u0443\u0445 ", e.tempAir, " \u00B0C", e.tempMix !== null ? ` · смесь ${e.tempMix} °C` : '', e.winterMethod ? ` · ${e.winterMethod}` : ''] })) : null, e.problems.length > 0 ? (_jsxs("div", { style: { fontSize: 12, color: color.warnStrong, fontWeight: 700, marginTop: 3 }, children: ["\u26A0 ", e.problems.join(', ')] })) : null, e.photos.length > 0 ? (_jsxs("div", { style: { display: 'flex', gap: 6, marginTop: 8 }, children: [e.photos.map((p) => (_jsx("div", { title: `${new Date(p.takenAt).toLocaleString('ru-RU')}${p.lat ? ` · ${p.lat.toFixed(4)}, ${p.lon?.toFixed(4)}` : ''}`, style: {
                                        width: 54,
                                        height: 54,
                                        borderRadius: radius.xs,
                                        background: 'repeating-linear-gradient(45deg,#D8DAE3 0 8px,#E7E9F0 8px 16px)',
                                    } }, p.id))), _jsx("div", { style: { fontSize: 11, color: color.faint, alignSelf: 'flex-end' }, children: "\uD83D\uDCCD \u0441 \u0433\u0435\u043E\u043C\u0435\u0442\u043A\u043E\u0439 \u0438 \u0432\u0440\u0435\u043C\u0435\u043D\u0435\u043C" })] })) : null, adjusting === e.id ? (_jsxs("div", { style: {
                                marginTop: 10,
                                background: color.screen,
                                borderRadius: radius.xs,
                                padding: '10px 12px',
                            }, children: [_jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted }, children: "\u041D\u041E\u0412\u041E\u0415 \u0417\u041D\u0410\u0427\u0415\u041D\u0418\u0415" }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }, children: [_jsx("input", { value: newValue, onChange: (ev) => setNewValue(ev.target.value), style: {
                                                width: 96,
                                                boxSizing: 'border-box',
                                                border: 'none',
                                                outline: 'none',
                                                background: color.surface,
                                                borderRadius: radius.xs,
                                                padding: '10px 12px',
                                                fontSize: 16,
                                                fontWeight: 800,
                                                textAlign: 'center',
                                                color: color.ink,
                                                fontFamily: 'inherit',
                                                ...tabular,
                                            } }), _jsx("div", { style: { fontSize: 14, color: color.muted }, children: e.unit })] }), _jsx("input", { value: reason, onChange: (ev) => setReason(ev.target.value), placeholder: "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u043A\u0438 \u2014 \u0435\u0451 \u0443\u0432\u0438\u0434\u0438\u0442 \u043F\u0440\u043E\u0440\u0430\u0431", style: {
                                        width: '100%',
                                        boxSizing: 'border-box',
                                        border: 'none',
                                        outline: 'none',
                                        background: color.surface,
                                        borderRadius: radius.xs,
                                        padding: '10px 12px',
                                        fontSize: 13,
                                        color: color.ink,
                                        marginTop: 8,
                                        fontFamily: 'inherit',
                                    } }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 10 }, children: [_jsx("div", { onClick: () => setAdjusting(null), style: {
                                                cursor: 'pointer',
                                                flex: 1,
                                                textAlign: 'center',
                                                background: color.chip,
                                                borderRadius: radius.xs,
                                                padding: '10px 0',
                                                fontSize: 13,
                                                fontWeight: 700,
                                                color: color.ink,
                                            }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" }), _jsx("div", { onClick: () => Number(newValue.replace(',', '.')) > 0 &&
                                                reason.trim() &&
                                                decide.run({
                                                    decision: 'adjust',
                                                    adjustment: {
                                                        entryId: e.id,
                                                        to: Number(newValue.replace(',', '.')),
                                                        reason: reason.trim(),
                                                    },
                                                }), style: {
                                                cursor: 'pointer',
                                                flex: 1,
                                                textAlign: 'center',
                                                background: reason.trim() && Number(newValue.replace(',', '.')) > 0 ? color.primary : color.disabled,
                                                color: '#fff',
                                                borderRadius: radius.xs,
                                                padding: '10px 0',
                                                fontSize: 13,
                                                fontWeight: 800,
                                            }, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" })] })] })) : (_jsx("div", { onClick: () => {
                                setAdjusting(e.id);
                                setNewValue(String(e.volume));
                                setReason('');
                            }, style: {
                                cursor: 'pointer',
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: color.primary,
                                marginTop: 8,
                            }, children: "\u270E \u0421\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043E\u0431\u044A\u0451\u043C" }))] }, e.id))) }), returning ? (_jsxs(Card, { style: { margin: '10px 20px 0' }, children: [_jsx(SectionLabel, { children: "\u0417\u0410\u041C\u0415\u0427\u0410\u041D\u0418\u0415 \u041F\u0420\u041E\u0420\u0410\u0411\u0423" }), _jsx("input", { value: returnComment, onChange: (e) => setReturnComment(e.target.value), placeholder: "\u0427\u0442\u043E \u043F\u0440\u043E\u0432\u0435\u0440\u0438\u0442\u044C \u2014 \u043F\u0440\u043E\u0440\u0430\u0431 \u0443\u0432\u0438\u0434\u0438\u0442 \u0442\u0435\u043A\u0441\u0442", style: {
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
                        } }), _jsx("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 6 }, children: "\u041E\u0442\u043C\u0435\u0442\u044C\u0442\u0435 \u0433\u0430\u043B\u043E\u0447\u043A\u0430\u043C\u0438 \u0441\u043F\u043E\u0440\u043D\u044B\u0435 \u0437\u0430\u043F\u0438\u0441\u0438 \u0432\u044B\u0448\u0435 \u2014 \u043E\u043D\u0438 \u043F\u043E\u0434\u0441\u0432\u0435\u0442\u044F\u0442\u0441\u044F \u0443 \u043F\u0440\u043E\u0440\u0430\u0431\u0430." })] })) : null, _jsx("div", { style: {
                    marginTop: 'auto',
                    padding: '16px 20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }, children: returning ? (_jsxs(_Fragment, { children: [_jsx(PrimaryButton, { onClick: () => decide.run({ decision: 'return', comment: returnComment, returnedFields: disputed }), disabled: returnComment.trim().length < 5, style: { background: color.warnAccent, boxShadow: 'none' }, children: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043F\u0440\u043E\u0440\u0430\u0431\u0443" }), _jsx("div", { onClick: () => setReturning(false), style: {
                                cursor: 'pointer',
                                height: 48,
                                borderRadius: radius.md,
                                background: color.chip,
                                color: color.ink,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14,
                                fontWeight: 700,
                            }, children: "\u041E\u0442\u043C\u0435\u043D\u0430" })] })) : (_jsxs(_Fragment, { children: [_jsx(PrimaryButton, { onClick: () => decide.run({ decision: 'accept' }), disabled: decide.busy, children: "\u041F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C" }), _jsx("div", { onClick: () => setReturning(true), style: {
                                cursor: 'pointer',
                                height: 50,
                                borderRadius: radius.md,
                                background: color.warnBg,
                                border: `1px solid ${color.warnBorder}`,
                                color: color.warnText,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14.5,
                                fontWeight: 800,
                            }, children: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0441 \u0437\u0430\u043C\u0435\u0447\u0430\u043D\u0438\u0435\u043C" })] })) })] }));
}
/* ───────────────────────────── T6/T7 · Объекты и цепочки ───────────────────────────── */
export function PtoObjectsScreen() {
    const go = useApp((s) => s.go);
    const { data } = useQuery('/objects');
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u041E\u0431\u044A\u0435\u043A\u0442\u044B", subtitle: `${data?.length ?? 0} объектов компании` }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: (data ?? []).map((o) => (_jsxs(Card, { onClick: () => go('pto-object', { objectId: o.id }), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15.5, fontWeight: 800, color: color.ink }, children: o.name }), _jsx("div", { style: {
                                        fontSize: 13,
                                        fontWeight: 800,
                                        ...tabular,
                                        color: o.deltaDays < -5 ? color.danger : o.deltaDays < 0 ? color.warnStrong : color.greenDeep,
                                    }, children: o.deltaDays === 0 ? 'по графику' : `${o.deltaDays} дн.` })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }, children: [o.blocks.length, " \u0431\u043B\u043E\u043A\u043E\u0432 \u00B7 ", o.floorsTotal, " \u044D\u0442\u0430\u0436\u0435\u0439 \u00B7 \u043F\u043B\u0430\u043D ", o.pctPlan, "% / \u0444\u0430\u043A\u0442", ' ', o.pctFact.toFixed(1).replace('.', ','), "%"] }), o.responsible ? (_jsxs("div", { style: { fontSize: 12, color: color.faint, marginTop: 3 }, children: ["\u043E\u0442\u0432\u0435\u0442\u0441\u0442\u0432\u0435\u043D\u043D\u044B\u0439: ", o.responsible.fullName] })) : null] }, o.id))) })] }));
}
export function PtoObjectScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const { data: objects } = useQuery('/objects');
    const { data: sections } = useQuery('/sections');
    const object = objects?.find((o) => o.id === params.objectId);
    if (!object)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: object.name, subtitle: `${object.address} · ${object.city}`, onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsxs("div", { style: { fontSize: 13, color: color.inkMuted, ...tabular }, children: ["\u041F\u043B\u0430\u043D ", object.pctPlan, "% \u00B7 \u0444\u0430\u043A\u0442 ", object.pctFact.toFixed(1).replace('.', ','), "% \u00B7 \u0441\u0440\u043E\u043A \u0441\u0434\u0430\u0447\u0438", ' ', new Date(object.dueDate).toLocaleDateString('ru-RU')] }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 4 }, children: object.blocks.map((b) => `${b.name} (${b.floors} эт.)`).join(' · ') })] }), _jsx(SectionLabel, { style: { padding: '12px 20px 6px' }, children: "\u0426\u0415\u041F\u041E\u0427\u041A\u0418 \u041F\u0420\u041E\u0426\u0415\u0421\u0421\u041E\u0412 \u041F\u041E \u0420\u0410\u0417\u0414\u0415\u041B\u0410\u041C" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }, children: (sections ?? []).map((s) => (_jsxs(Card, { onClick: () => go('pto-chain-setup', { sectionId: s.id }), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: s.name }), _jsx("div", { style: { color: color.faint, fontSize: 16 }, children: "\u203A" })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }, children: [s.processes.length, " \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u043E\u0432 \u00B7 ", s.actsCount, " \u0442\u0440\u0435\u0431\u0443\u044E\u0442 \u0410\u041E\u0421\u0420"] })] }, s.id))) })] }));
}
/* ───────────────────────────── Г4 · Настройка цепочки ───────────────────────────── */
const UNITS = ['т', 'кг', 'м³', 'м²', 'пог. м', 'шт', 'точки', 'партия', 'сут', '—'];
export function PtoChainSetupScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const { data: sections, reload } = useQuery('/sections');
    const section = sections?.find((s) => s.id === params.sectionId);
    const [rows, setRows] = useState(null);
    const current = rows ?? section?.processes ?? [];
    const [unitPicker, setUnitPicker] = useState(null);
    const save = useAction(async () => {
        await api.post(`/admin/chain/${params.sectionId}`, {
            rows: current.map((r) => ({
                id: r.id,
                name: r.name,
                unit: r.unit,
                requiresAosr: r.requiresAosr,
                subcycle: r.subcycle,
            })),
        });
        notify('Цепочка сохранена · она применится к новым назначениям');
        setRows(null);
        reload();
    });
    if (!section)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    function update(id, patch) {
        setRows(current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    }
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: `Цепочка · ${section.name}`, subtitle: `${current.length} процессов · ${current.filter((r) => r.requiresAosr).length} актов`, onBack: back }), _jsx("div", { style: { padding: '4px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }, children: "\u0421\u043E\u0441\u0442\u0430\u0432 \u0446\u0435\u043F\u043E\u0447\u043A\u0438 \u0437\u0430\u0432\u043E\u0434\u0438\u0442\u0441\u044F \u043F\u043E \u041F\u041F\u0420 \u044D\u0442\u043E\u0433\u043E \u043E\u0431\u044A\u0435\u043A\u0442\u0430. \u041F\u0440\u043E\u0446\u0435\u0441\u0441 \u0441 \u0410\u041E\u0421\u0420 \u0431\u043B\u043E\u043A\u0438\u0440\u0443\u0435\u0442 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0438\u0439, \u043F\u043E\u043A\u0430 \u0430\u043A\u0442 \u043D\u0435 \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D." }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 20px 20px' }, children: [current.map((r) => (_jsxs(Card, { style: { borderRadius: radius.sm, padding: '12px 14px' }, children: [_jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'flex-start' }, children: [_jsxs("div", { style: { fontSize: 12, fontWeight: 800, color: color.faint, width: 22, ...tabular }, children: [r.order, "."] }), _jsx("input", { value: r.name, onChange: (e) => update(r.id, { name: e.target.value }), style: {
                                            flex: 1,
                                            minWidth: 0,
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            fontSize: 13.5,
                                            fontWeight: 700,
                                            color: color.ink,
                                            fontFamily: 'inherit',
                                        } })] }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }, children: [_jsxs("div", { onClick: () => setUnitPicker(unitPicker === r.id ? null : r.id), style: {
                                            cursor: 'pointer',
                                            background: color.screen,
                                            borderRadius: radius.pill,
                                            padding: '6px 10px',
                                            fontSize: 12,
                                            fontWeight: 700,
                                            color: color.ink,
                                        }, children: [r.unit, " \u25BE"] }), _jsx("div", { onClick: () => update(r.id, { requiresAosr: !r.requiresAosr }), style: {
                                            cursor: 'pointer',
                                            borderRadius: radius.pill,
                                            padding: '6px 10px',
                                            fontSize: 12,
                                            fontWeight: 800,
                                            ...(r.requiresAosr
                                                ? { background: color.primaryBg, color: color.primary, border: `1px solid ${color.primaryBorder}` }
                                                : { background: color.screen, color: color.muted }),
                                        }, children: "\uD83D\uDD12 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u0410\u041E\u0421\u0420" }), r.subcycle ? (_jsx("div", { style: { fontSize: 11.5, color: color.faint }, children: r.subcycle })) : null] }), unitPicker === r.id ? (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: UNITS.map((u) => (_jsx(Chip, { active: r.unit === u, onClick: () => {
                                        update(r.id, { unit: u });
                                        setUnitPicker(null);
                                    }, style: { fontSize: 11.5, padding: '6px 9px' }, children: u }, u))) })) : null] }, r.id))), _jsx("div", { onClick: () => setRows([
                            ...current,
                            {
                                id: `new-${Date.now()}`,
                                order: current.length + 1,
                                name: 'Новый процесс',
                                unit: '—',
                                requiresAosr: false,
                                subcycle: null,
                                critical: false,
                            },
                        ]), style: {
                            cursor: 'pointer',
                            background: color.surface,
                            border: `1px dashed ${color.dashed}`,
                            borderRadius: radius.sm,
                            padding: '13px 14px',
                            fontSize: 13.5,
                            fontWeight: 700,
                            color: color.primary,
                            textAlign: 'center',
                        }, children: "+ \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u043F\u0440\u043E\u0446\u0435\u0441\u0441" })] }), rows ? (_jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(PrimaryButton, { onClick: () => save.run(), disabled: save.busy, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0446\u0435\u043F\u043E\u0447\u043A\u0443" }) })) : null] }));
}
/* ───────────────────────────── ADM1–ADM3 · Пользователи ───────────────────────────── */
export function PtoUsersScreen() {
    const go = useApp((s) => s.go);
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const { data, reload } = useQuery('/users');
    const reset = useAction(async (id) => {
        const res = await api.post(`/users/${id}/reset-password`);
        useApp.setState({ params: { userId: id } });
        notify(`Новый пароль: ${res.temporaryPassword} — покажите его один раз`);
        reload();
    });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0438 \u0438 \u0434\u043E\u0441\u0442\u0443\u043F\u044B", subtitle: `${data?.length ?? 0} учётных записей`, onBack: back, right: _jsx("div", { onClick: () => go('pto-user-new'), style: {
                        cursor: 'pointer',
                        background: color.primary,
                        color: '#fff',
                        borderRadius: radius.smAlt,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        flex: 'none',
                    }, children: "+ \u0427\u0435\u043B\u043E\u0432\u0435\u043A" }) }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: (data ?? []).map((u) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: u.fullName }), _jsx(Badge, { tone: u.active ? 'neutral' : 'warn', style: { flexShrink: 0 }, children: ROLE_TITLE[u.role] })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }, children: [u.login, " \u00B7 ", u.phone] }), u.objectName ? (_jsx("div", { style: { fontSize: 12, color: color.faint, marginTop: 2 }, children: [u.objectName, u.blockName, u.scopeLabel].filter(Boolean).join(' · ') })) : null, u.mustChangePassword ? (_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.warnText, marginTop: 4 }, children: "\u23F3 \u0435\u0449\u0451 \u043D\u0435 \u0441\u043C\u0435\u043D\u0438\u043B \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C" })) : null, _jsx("div", { onClick: () => reset.run(u.id), style: { cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: color.primary, marginTop: 8 }, children: "\u0421\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C" })] }, u.id))) })] }));
}
export function PtoUserNewScreen() {
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('+996 ');
    const [role, setRole] = useState('master');
    const [objectId, setObjectId] = useState();
    const [blockId, setBlockId] = useState();
    const [scopeLabel, setScopeLabel] = useState('');
    const [password, setPassword] = useState(null);
    const { data: objects } = useQuery('/objects');
    const object = objects?.find((o) => o.id === objectId);
    const create = useAction(async () => {
        const res = await api.post('/users', {
            fullName,
            phone,
            role,
            objectId,
            blockId,
            scopeLabel: scopeLabel || undefined,
        });
        setPassword(res.temporaryPassword);
    });
    if (password) {
        // Пароль показывается ровно один раз — дальше только сброс.
        return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041F\u0430\u0440\u043E\u043B\u044C \u0441\u043E\u0437\u0434\u0430\u043D", subtitle: fullName, onBack: () => go('pto-users') }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.muted }, children: "\u0412\u0420\u0415\u041C\u0415\u041D\u041D\u042B\u0419 \u041F\u0410\u0420\u041E\u041B\u042C" }), _jsx("div", { style: {
                                fontSize: 30,
                                fontWeight: 800,
                                color: color.ink,
                                marginTop: 6,
                                letterSpacing: '0.06em',
                                ...tabular,
                            }, children: password }), _jsx("div", { style: {
                                marginTop: 12,
                                background: color.warnBg,
                                border: `1px solid ${color.warnBorder}`,
                                borderRadius: radius.xs,
                                padding: '10px 12px',
                                fontSize: 12.5,
                                fontWeight: 700,
                                color: color.warnText,
                                lineHeight: 1.45,
                            }, children: "\u041F\u0430\u0440\u043E\u043B\u044C \u043F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0435\u0442\u0441\u044F \u043E\u0434\u0438\u043D \u0440\u0430\u0437. \u041F\u0435\u0440\u0435\u0434\u0430\u0439\u0442\u0435 \u0435\u0433\u043E \u043B\u0438\u0447\u043D\u043E \u2014 \u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043D\u0435\u043B\u044C\u0437\u044F, \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C." })] }), _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(PrimaryButton, { onClick: () => go('pto-users'), children: "\u0417\u0430\u043F\u0438\u0441\u0430\u043B, \u0434\u0430\u043B\u044C\u0448\u0435" }) })] }));
    }
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041D\u043E\u0432\u044B\u0439 \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C", onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx(SheetField, { label: "\u0424\u0410\u041C\u0418\u041B\u0418\u042F \u0418 \u0418\u041C\u042F", value: fullName, onChange: setFullName }), _jsx("div", { style: { height: 8 } }), _jsx(SheetField, { label: "\u0422\u0415\u041B\u0415\u0424\u041E\u041D", value: phone, onChange: setPhone }), _jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 12 }, children: "\u0420\u041E\u041B\u042C" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }, children: ROLES.map((r) => (_jsx(Chip, { active: role === r, onClick: () => setRole(r), style: { fontSize: 12 }, children: ROLE_TITLE[r] }, r))) }), _jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 12 }, children: "\u041E\u0411\u042A\u0415\u041A\u0422" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }, children: (objects ?? []).map((o) => (_jsx(Chip, { active: objectId === o.id, onClick: () => {
                                setObjectId(o.id);
                                setBlockId(undefined);
                            }, style: { fontSize: 12 }, children: o.name }, o.id))) }), object ? (_jsxs(_Fragment, { children: [_jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 12 }, children: "\u0411\u041B\u041E\u041A" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }, children: object.blocks.map((b) => (_jsx(Chip, { active: blockId === b.id, onClick: () => setBlockId(b.id), style: { fontSize: 12 }, children: b.name }, b.id))) }), _jsx("div", { style: { height: 12 } }), _jsx(SheetField, { label: "\u0423\u0427\u0410\u0421\u0422\u041E\u041A", value: scopeLabel, onChange: setScopeLabel })] })) : null] }), create.error ? (_jsx("div", { style: { margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }, children: create.error })) : null, _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(PrimaryButton, { onClick: () => create.run(), disabled: fullName.trim().length < 3 || phone.trim().length < 6 || create.busy, children: "\u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0438 \u0432\u044B\u0434\u0430\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C" }) })] }));
}
export function PtoLabScreen() {
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const { data, reload } = useQuery('/strength-protocols');
    const [values, setValues] = useState({});
    const submit = useAction(async (id) => {
        const res = await api.post(`/strength-protocols/${id}`, {
            strengthPct: Number((values[id] ?? '').replace(',', '.')) || 0,
        });
        notify(res.status === 'passed'
            ? 'Прочность набрана · распалубка разблокирована'
            : 'Прочность не набрана · распалубка остаётся закрытой');
        reload();
    });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041B\u0430\u0431\u043E\u0440\u0430\u0442\u043E\u0440\u0438\u044F", subtitle: "\u043F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u044B \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u0438 \u0431\u0435\u0442\u043E\u043D\u0430", onBack: back }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: (data ?? []).map((p) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsx("div", { style: { fontSize: 14.5, fontWeight: 800, color: color.ink }, children: p.process }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }, children: ["\u0437\u0430\u043B\u0438\u0442\u043E ", new Date(p.pouredAt).toLocaleDateString('ru-RU'), " \u00B7 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F ", p.requiredPct, "% \u00B7", ' ', p.labName] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }, children: [_jsx("input", { value: values[p.id] ?? String(p.strengthPct), onChange: (e) => setValues((v) => ({ ...v, [p.id]: e.target.value })), style: {
                                        width: 84,
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
                                    } }), _jsx("div", { style: { fontSize: 14, color: color.muted }, children: "%" }), _jsx("div", { onClick: () => submit.run(p.id), style: {
                                        cursor: 'pointer',
                                        marginLeft: 'auto',
                                        background: color.primary,
                                        color: '#fff',
                                        borderRadius: radius.xs,
                                        padding: '10px 14px',
                                        fontSize: 13,
                                        fontWeight: 800,
                                    }, children: "\u0412\u043D\u0435\u0441\u0442\u0438" })] })] }, p.id))) })] }));
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
