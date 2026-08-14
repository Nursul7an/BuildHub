import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Модуль «Материалы» (M1–M6) и «Спецтехника» (СТ1–СТ4).
 *
 * Один модуль на снабжение и завсклад: экраны общие, роль задаёт права и
 * область. Всерьёз отличается только «Сегодня» — у снабжения это очередь
 * заявок, у завсклада — приёмка и выдача.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, Card, Chip, PrimaryButton, SectionLabel, formatNumber, tabular, } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
import { ZAYAVKA_STATUS } from '../field/TodayScreen';
/* ───────────────────────────── M1 · Сегодня ───────────────────────────── */
export function MaterialsTodayScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const { data: zayavki } = useQuery('/zayavki?scope=department&kind=material');
    const { data: stock } = useQuery('/stock');
    const isSnab = me?.role === 'snab';
    const list = zayavki ?? [];
    const toNormalize = list.filter((z) => z.items.some((i) => !i.matched) && z.status !== 'closed');
    const stale = list.filter((z) => ['new', 'normalizing', 'approved'].includes(z.status) &&
        Date.now() - new Date(z.createdAt).getTime() > 2 * 86_400_000);
    const arriving = list.filter((z) => z.status === 'inTransit' || z.status === 'delivered');
    const noPassport = (stock ?? []).filter((s) => !s.hasPassport);
    const overSpec = (stock ?? []).filter((s) => s.overSpec);
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0421\u0435\u0433\u043E\u0434\u043D\u044F", subtitle: isSnab ? `${me?.fullName} · снабжение` : `${me?.fullName} · склад объекта` }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: isSnab ? (_jsxs(_Fragment, { children: [_jsx(Tile, { title: "\u041D\u0435 \u043E\u043F\u043E\u0437\u043D\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u0437\u0438\u0446\u0438\u0438", count: toNormalize.length, hint: "\u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u044C\u0442\u0435 \u0441\u043E \u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u0438\u043A\u043E\u043C \u2014 \u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u043E\u0432\u043A\u0430 \u0437\u0430\u043F\u043E\u043C\u043D\u0438\u0442\u0441\u044F", tone: toNormalize.length > 0 ? 'warn' : 'green', onClick: () => go('mat-zayavki') }), _jsx(Tile, { title: "\u0412\u0438\u0441\u044F\u0442 \u0431\u043E\u043B\u044C\u0448\u0435 2 \u0434\u043D\u0435\u0439", count: stale.length, hint: stale.some((z) => z.idleCost)
                                ? `в том числе с простоем ≈ ${formatNumber(stale.reduce((a, z) => a + (z.idleCost ?? 0), 0))} сом`
                                : 'по ним ждут ответа', tone: stale.length > 0 ? 'danger' : 'green', onClick: () => go('mat-zayavki') })] })) : (_jsxs(_Fragment, { children: [_jsx(Tile, { title: "\u041F\u0440\u0438\u0434\u0443\u0442 \u043D\u0430 \u043E\u0431\u044A\u0435\u043A\u0442", count: arriving.length, hint: "\u043F\u0440\u0438\u0451\u043C\u043A\u0430 \u0432 \u0434\u0432\u0430 \u0448\u0430\u0433\u0430: \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u043E, \u0437\u0430\u0442\u0435\u043C \u043F\u0430\u0441\u043F\u043E\u0440\u0442", tone: arriving.length > 0 ? 'primary' : 'neutral', onClick: () => go('mat-zayavki') }), _jsx(Tile, { title: "\u041F\u0430\u0440\u0442\u0438\u0438 \u0431\u0435\u0437 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430", count: noPassport.length, hint: "\u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u043D\u0438\u043C\u0438 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B", tone: noPassport.length > 0 ? 'danger' : 'green', onClick: () => go('mat-stock') }), _jsx(Tile, { title: "\u041F\u0435\u0440\u0435\u0440\u0430\u0441\u0445\u043E\u0434 \u043A \u0441\u043F\u0435\u0446\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438", count: overSpec.length, hint: "\u0432\u044B\u0434\u0430\u0447\u0430 \u0441\u0432\u0435\u0440\u0445 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u0430 \u0442\u0440\u0435\u0431\u0443\u0435\u0442 \u043F\u0440\u0438\u0447\u0438\u043D\u044B", tone: overSpec.length > 0 ? 'warn' : 'green', onClick: () => go('mat-stock') })] })) })] }));
}
function Tile({ title, count, hint, tone, onClick, }) {
    const toneColor = tone === 'danger'
        ? color.danger
        : tone === 'warn'
            ? color.warnStrong
            : tone === 'green'
                ? color.greenDeep
                : tone === 'primary'
                    ? color.primary
                    : color.ink;
    return (_jsxs(Card, { onClick: onClick, style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: title }), _jsx("div", { style: { fontSize: 24, fontWeight: 800, color: toneColor, ...tabular }, children: count })] }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3, lineHeight: 1.45 }, children: hint })] }));
}
/* ───────────────────────────── M2 · Заявки отдела ───────────────────────────── */
export function MaterialsZayavkiScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const notify = useApp((s) => s.notify);
    const { data, reload } = useQuery('/zayavki?scope=department&kind=material');
    const { data: catalog } = useQuery('/catalog');
    const [normalizing, setNormalizing] = useState(null);
    const normalize = useAction(async (catalogItemId) => {
        if (!normalizing)
            return;
        await api.post(`/zayavki/${normalizing.zayavkaId}/normalize`, {
            itemId: normalizing.itemId,
            catalogItemId,
            rememberAlias: true,
        });
        notify(`Сопоставлено · формулировка «${normalizing.text}» запомнена`);
        setNormalizing(null);
        reload();
    });
    const advance = useAction(async (id, status, note) => {
        await api.post(`/zayavki/${id}/status`, { status, note });
        notify(note);
        reload();
    });
    const isSnab = me?.role === 'snab';
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0417\u0430\u044F\u0432\u043A\u0438", subtitle: `${data?.length ?? 0} всего` }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: (data ?? []).map((z) => {
                    const item = z.items[0];
                    const unmatched = z.items.find((i) => !i.matched);
                    const days = Math.floor((Date.now() - new Date(z.createdAt).getTime()) / 86_400_000);
                    return (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: item ? `${item.name ?? item.rawText} · ${formatNumber(item.qty, 1)} ${item.unit}` : z.number }), _jsx(Badge, { tone: z.idleCost ? 'warn' : 'neutral', style: { flexShrink: 0 }, children: ZAYAVKA_STATUS[z.status] ?? z.status })] }), _jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 3, ...tabular }, children: [z.number, " \u00B7 ", z.objectName, " \u00B7 ", days, " \u0434\u043D. \u0432 \u0440\u0430\u0431\u043E\u0442\u0435"] }), z.idleCost ? (_jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: color.warnStrong, marginTop: 4 }, children: ["\u26A0 \u043F\u0440\u043E\u0441\u0442\u043E\u0439 ", z.idleWorkers, " \u0447\u0435\u043B \u00B7 \u2248 ", formatNumber(z.idleCost), " \u0441\u043E\u043C"] })) : null, unmatched ? (_jsxs("div", { style: { marginTop: 10 }, children: [_jsxs("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.warnText }, children: ["\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u00AB", unmatched.rawText, "\u00BB \u043D\u0435 \u043E\u043F\u043E\u0437\u043D\u0430\u043D\u0430"] }), normalizing?.itemId === unmatched.id ? (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: (catalog ?? []).slice(0, 8).map((c) => (_jsx(Chip, { onClick: () => normalize.run(c.id), style: { fontSize: 11.5 }, children: c.name }, c.id))) })) : isSnab ? (_jsx("div", { onClick: () => setNormalizing({ zayavkaId: z.id, itemId: unmatched.id, text: unmatched.rawText }), style: {
                                            cursor: 'pointer',
                                            marginTop: 8,
                                            height: 42,
                                            borderRadius: radius.xs,
                                            background: color.primaryBg,
                                            color: color.primary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontSize: 13,
                                            fontWeight: 800,
                                        }, children: "\u0421\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u0441\u043E \u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u0438\u043A\u043E\u043C" })) : null] })) : null, _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 10 }, children: [isSnab && ['approved', 'purchasing', 'ordered'].includes(z.status) ? (_jsx("div", { onClick: () => advance.run(z.id, z.status === 'approved' ? 'purchasing' : z.status === 'purchasing' ? 'ordered' : 'inTransit', z.status === 'approved' ? 'В закупке' : z.status === 'purchasing' ? 'Заказано' : 'В пути'), style: {
                                            cursor: 'pointer',
                                            flex: 1,
                                            textAlign: 'center',
                                            background: color.primary,
                                            color: '#fff',
                                            borderRadius: radius.xs,
                                            padding: '10px 0',
                                            fontSize: 13,
                                            fontWeight: 800,
                                        }, children: z.status === 'approved' ? 'В закупку' : z.status === 'purchasing' ? 'Заказано' : 'Отгружено' })) : null, !isSnab && (z.status === 'inTransit' || z.status === 'delivered') ? (_jsx("div", { onClick: () => go('acceptance', { zayavkaId: z.id }), style: {
                                            cursor: 'pointer',
                                            flex: 1,
                                            textAlign: 'center',
                                            background: color.primary,
                                            color: '#fff',
                                            borderRadius: radius.xs,
                                            padding: '10px 0',
                                            fontSize: 13,
                                            fontWeight: 800,
                                        }, children: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" })) : null, _jsx("div", { onClick: () => go('zayavka', { zayavkaId: z.id }), style: {
                                            cursor: 'pointer',
                                            flex: 1,
                                            textAlign: 'center',
                                            background: color.chip,
                                            color: color.ink,
                                            borderRadius: radius.xs,
                                            padding: '10px 0',
                                            fontSize: 13,
                                            fontWeight: 700,
                                        }, children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C" })] })] }, z.id));
                }) })] }));
}
/* ───────────────────────────── M3 · Склад ───────────────────────────── */
export function StockScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const { data } = useQuery('/stock');
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0421\u043A\u043B\u0430\u0434", subtitle: `${data?.length ?? 0} позиций на объекте` }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: (data ?? []).map((s) => (_jsxs(Card, { onClick: me?.role === 'sklad' ? () => go('mat-issue', { objectId: s.objectId }) : undefined, style: {
                        borderRadius: radius.md,
                        padding: '14px 16px',
                        ...(!s.hasPassport ? { border: '1.5px solid #F0B4B0' } : null),
                    }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: s.name }), _jsxs("div", { style: { fontSize: 16, fontWeight: 800, color: color.ink, flexShrink: 0, ...tabular }, children: [formatNumber(s.qty, s.qty % 1 ? 1 : 0), " ", s.unit] })] }), s.specRemainder !== null ? (_jsxs("div", { style: { fontSize: 12.5, color: s.overSpec ? color.warnStrong : color.muted, marginTop: 3, ...tabular }, children: ["\u043F\u043E \u0441\u043F\u0435\u0446\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ", formatNumber(s.specRemainder, 1), " ", s.unit, s.overSpec ? ' · перерасход' : ''] })) : null, !s.hasPassport ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.danger, marginTop: 5 }, children: "\uD83D\uDD34 \u041F\u0430\u0440\u0442\u0438\u044F \u0431\u0435\u0437 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u2014 \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u043D\u0435\u0439 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B" })) : null] }, s.id))) })] }));
}
/* ───────────────────────────── M5 · Выдача под роспись ───────────────────────────── */
export function IssueScreen() {
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const { data: stock } = useQuery('/stock');
    const { data: users } = useQuery('/users?role=prorab');
    const [itemId, setItemId] = useState(null);
    const [qty, setQty] = useState('');
    const [toUserId, setToUserId] = useState(null);
    const [signature, setSignature] = useState('');
    const [reason, setReason] = useState(null);
    const item = stock?.find((s) => s.catalogItemId === itemId);
    const qtyNum = Number(qty.replace(',', '.')) || 0;
    const overSpec = item?.specRemainder != null && qtyNum > item.specRemainder;
    const issue = useAction(async () => {
        if (!item)
            return;
        const res = await api.post('/stock/issue', {
            objectId: item.objectId,
            catalogItemId: item.catalogItemId,
            qty: qtyNum,
            toUserId,
            signature,
            overspendReason: overSpec ? (reason ?? undefined) : undefined,
        });
        notify(res.overspend
            ? 'Выдано под роспись · перерасход ушёл главному инженеру'
            : 'Выдано под роспись · остаток обновлён');
        go('mat-stock');
    });
    const blocker = !itemId
        ? 'Выберите позицию'
        : qtyNum <= 0
            ? 'Укажите количество'
            : !toUserId
                ? 'Выберите, кому выдаёте'
                : !signature.trim()
                    ? 'Без росписи выдача не оформляется'
                    : overSpec && !reason
                        ? 'Выдача сверх норматива — укажите причину'
                        : null;
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0412\u044B\u0434\u0430\u0447\u0430 \u043F\u043E\u0434 \u0440\u043E\u0441\u043F\u0438\u0441\u044C", onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx(SectionLabel, { children: "\u041F\u041E\u0417\u0418\u0426\u0418\u042F" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: (stock ?? []).map((s) => (_jsx(Chip, { active: itemId === s.catalogItemId, onClick: () => setItemId(s.catalogItemId), style: { fontSize: 12 }, children: s.name }, s.id))) }), item ? (_jsxs(_Fragment, { children: [_jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 10, ...tabular }, children: ["\u041D\u0430 \u0441\u043A\u043B\u0430\u0434\u0435 ", formatNumber(item.qty, 1), " ", item.unit, item.specRemainder != null ? ` · норматив ${formatNumber(item.specRemainder, 1)} ${item.unit}` : ''] }), _jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }, children: [_jsx("input", { value: qty, onChange: (e) => setQty(e.target.value), placeholder: "0", style: {
                                            width: 110,
                                            boxSizing: 'border-box',
                                            border: 'none',
                                            outline: 'none',
                                            background: color.screen,
                                            borderRadius: radius.xs,
                                            padding: '12px',
                                            fontSize: 19,
                                            fontWeight: 800,
                                            textAlign: 'center',
                                            color: color.ink,
                                            fontFamily: 'inherit',
                                            ...tabular,
                                        } }), _jsx("div", { style: { fontSize: 15, color: color.muted }, children: item.unit })] })] })) : null, overSpec ? (_jsxs("div", { style: {
                            marginTop: 10,
                            background: color.warnBg,
                            border: `1px solid ${color.warnBorder}`,
                            borderRadius: radius.xs,
                            padding: '10px 12px',
                        }, children: [_jsx("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.warnText }, children: "\u0412\u044B\u0434\u0430\u0447\u0430 \u0431\u043E\u043B\u044C\u0448\u0435 \u043D\u043E\u0440\u043C\u0430\u0442\u0438\u0432\u0430 \u043F\u043E \u0441\u043F\u0435\u0446\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u2014 \u043F\u0440\u0438\u0447\u0438\u043D\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u0430" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: ['отходы при резке', 'нахлёстки', 'перерасход', 'ошибка в объёмах'].map((r) => (_jsx(Chip, { tone: "dark", active: reason === r, onClick: () => setReason(r), style: { fontSize: 11.5 }, children: r }, r))) })] })) : null] }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u041A\u041E\u041C\u0423" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: (users ?? []).map((u) => (_jsx(Chip, { active: toUserId === u.id, onClick: () => setToUserId(u.id), style: { fontSize: 12 }, children: u.fullName }, u.id))) }), _jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 12 }, children: "\u0420\u041E\u0421\u041F\u0418\u0421\u042C" }), _jsx("input", { value: signature, onChange: (e) => setSignature(e.target.value), placeholder: "\u0424\u0418\u041E \u043F\u043E\u043B\u0443\u0447\u0430\u0442\u0435\u043B\u044F \u0438\u043B\u0438 \u043F\u043E\u0434\u043F\u0438\u0441\u044C", style: {
                            width: '100%',
                            boxSizing: 'border-box',
                            border: `1px dashed ${color.dashed}`,
                            outline: 'none',
                            background: color.screen,
                            borderRadius: radius.xs,
                            padding: '14px 12px',
                            fontSize: 15,
                            color: color.ink,
                            marginTop: 6,
                            fontFamily: 'inherit',
                        } })] }), issue.error ? (_jsx("div", { style: { margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }, children: issue.error })) : null, _jsxs("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: [blocker ? (_jsx("div", { style: { fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center', marginBottom: 8 }, children: blocker })) : null, _jsx(PrimaryButton, { onClick: () => issue.run(), disabled: Boolean(blocker) || issue.busy, children: "\u0412\u044B\u0434\u0430\u0442\u044C \u043F\u043E\u0434 \u0440\u043E\u0441\u043F\u0438\u0441\u044C" })] })] }));
}
/* ───────────────────────────── M4 / СТ4 · Ещё ───────────────────────────── */
export function DepartmentMoreScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const items = me?.role === 'tech'
        ? [
            { label: '🚜 Парк и график', screen: 'tech-fleet' },
            { label: '🔔 Уведомления', screen: 'notifications' },
            { label: '👤 Профиль', screen: 'profile' },
        ]
        : [
            { label: '📦 Журнал выдачи', screen: 'mat-stock' },
            { label: '🔔 Уведомления', screen: 'notifications' },
            { label: '👤 Профиль', screen: 'profile' },
        ];
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0415\u0449\u0451", subtitle: me?.fullName }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: items.map((i) => (_jsx(Card, { onClick: () => go(i.screen), style: { borderRadius: radius.md, padding: '14px 16px' }, children: _jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: i.label }) }, i.screen))) })] }));
}
/* ───────────────────────────── СТ1 · Спецтехника · Сегодня ───────────────────────────── */
export function TechTodayScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const { data: requests } = useQuery('/zayavki?scope=department&kind=tech');
    const list = requests ?? [];
    const today = new Date().toDateString();
    const todays = list.filter((z) => z.tech && new Date(z.tech.date).toDateString() === today);
    const pending = list.filter((z) => z.status === 'new' || z.status === 'approved');
    const needReport = list.filter((z) => z.tech && !z.tech.hasReport && new Date(z.tech.date) < new Date());
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0421\u0435\u0433\u043E\u0434\u043D\u044F", subtitle: `${me?.fullName} · спецтехника` }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: [_jsx(Tile, { title: "\u0421\u043C\u0435\u043D\u044B \u0441\u0435\u0433\u043E\u0434\u043D\u044F", count: todays.length, hint: "\u043C\u0430\u0448\u0438\u043D\u0430, \u043C\u0430\u0448\u0438\u043D\u0438\u0441\u0442, \u043E\u0431\u044A\u0435\u043A\u0442", tone: "primary", onClick: () => go('tech-queue') }), _jsx(Tile, { title: "\u0416\u0434\u0443\u0442 \u043F\u043E\u0434\u0431\u043E\u0440\u0430 \u043C\u0430\u0448\u0438\u043D\u044B", count: pending.length, hint: "\u0444\u0440\u043E\u043D\u0442 \u0443 \u0432\u0441\u0435\u0445 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u043F\u0440\u0438 \u043F\u043E\u0434\u0430\u0447\u0435", tone: pending.length > 0 ? 'warn' : 'green', onClick: () => go('tech-queue') }), _jsx(Tile, { title: "\u0421\u043C\u0435\u043D\u044B \u0431\u0435\u0437 \u043E\u0442\u0447\u0451\u0442\u0430", count: needReport.length, hint: "\u0431\u0435\u0437 \u043E\u0442\u0447\u0451\u0442\u0430 \u043D\u0435\u0442 \u043C\u043E\u0442\u043E\u0447\u0430\u0441\u043E\u0432 \u0438 \u043F\u0440\u0438\u0447\u0438\u043D\u044B \u043F\u0440\u043E\u0441\u0442\u043E\u044F", tone: needReport.length > 0 ? 'danger' : 'green', onClick: () => go('tech-queue') })] })] }));
}
export function TechQueueScreen() {
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const { data, reload } = useQuery('/zayavki?scope=department&kind=tech');
    const { data: machines } = useQuery('/machines');
    const [assigning, setAssigning] = useState(null);
    const advance = useAction(async (id, status, note) => {
        await api.post(`/zayavki/${id}/status`, { status, note });
        notify(note);
        setAssigning(null);
        reload();
    });
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0417\u0430\u044F\u0432\u043A\u0438 \u043D\u0430 \u0442\u0435\u0445\u043D\u0438\u043A\u0443", subtitle: `${data?.length ?? 0} всего` }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: (data ?? []).map((z) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsxs("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: [z.tech?.machineType ?? 'Техника', " \u00B7 ", z.tech?.hours ?? 0, " \u0447"] }), _jsx(Badge, { tone: z.status === 'approved' ? 'green' : 'neutral', style: { flexShrink: 0 }, children: ZAYAVKA_STATUS[z.status] ?? z.status })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }, children: [z.number, " \u00B7 ", z.objectName, z.tech ? ` · ${new Date(z.tech.date).toLocaleDateString('ru-RU')} с ${z.tech.timeFrom}` : ''] }), z.tech?.machine ? (_jsxs("div", { style: { fontSize: 12.5, color: color.greenDeep, fontWeight: 700, marginTop: 4 }, children: ["\u2713 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0430 ", z.tech.machine.name] })) : null, assigning === z.id ? (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }, children: (machines ?? [])
                                .filter((m) => m.status !== 'repair')
                                .map((m) => (_jsx(Chip, { onClick: () => advance.run(z.id, 'approved', `Назначена ${m.name}`), style: { fontSize: 12 }, children: m.name }, m.id))) })) : (_jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 10 }, children: [!z.tech?.machine ? (_jsx("div", { onClick: () => setAssigning(z.id), style: {
                                        cursor: 'pointer',
                                        flex: 1,
                                        textAlign: 'center',
                                        background: color.primary,
                                        color: '#fff',
                                        borderRadius: radius.xs,
                                        padding: '10px 0',
                                        fontSize: 13,
                                        fontWeight: 800,
                                    }, children: "\u041F\u043E\u0434\u043E\u0431\u0440\u0430\u0442\u044C \u043C\u0430\u0448\u0438\u043D\u0443" })) : !z.tech.hasReport ? (_jsx("div", { onClick: () => go('tech-report', { zayavkaId: z.id }), style: {
                                        cursor: 'pointer',
                                        flex: 1,
                                        textAlign: 'center',
                                        background: color.primary,
                                        color: '#fff',
                                        borderRadius: radius.xs,
                                        padding: '10px 0',
                                        fontSize: 13,
                                        fontWeight: 800,
                                    }, children: "\u041E\u0442\u0447\u0451\u0442 \u043F\u043E \u0441\u043C\u0435\u043D\u0435" })) : null, _jsx("div", { onClick: () => go('zayavka', { zayavkaId: z.id }), style: {
                                        cursor: 'pointer',
                                        flex: 1,
                                        textAlign: 'center',
                                        background: color.chip,
                                        color: color.ink,
                                        borderRadius: radius.xs,
                                        padding: '10px 0',
                                        fontSize: 13,
                                        fontWeight: 700,
                                    }, children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C" })] }))] }, z.id))) })] }));
}
