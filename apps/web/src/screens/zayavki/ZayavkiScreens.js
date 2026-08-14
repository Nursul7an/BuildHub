import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Б1–Б4 · Заявки: список, карточка с таймлайном, создание, приёмка материала.
 *
 * Список отсортирован по тому, что требует действия, а не по номеру. На
 * карточке материал крупнее номера: прораб ищет «арматуру», а не «0184».
 */
import { useMemo, useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, Card, CheckSquare, Chip, EmptyState, PrimaryButton, SectionLabel, formatNumber, tabular, } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
import { ZAYAVKA_STATUS } from '../field/TodayScreen';
/** Порядок статусов в таймлайне карточки. */
const FLOW = [
    { status: 'new', label: 'Отправлена' },
    { status: 'normalizing', label: 'На рассмотрении' },
    { status: 'approved', label: 'Согласована' },
    { status: 'purchasing', label: 'В закупке' },
    { status: 'ordered', label: 'Заказано у поставщика' },
    { status: 'inTransit', label: 'В пути' },
    { status: 'delivered', label: 'Получено на объекте' },
    { status: 'closed', label: 'Закрыта' },
];
function statusTone(status) {
    if (status === 'closed' || status === 'accepted')
        return 'green';
    if (status === 'new' || status === 'normalizing' || status === 'atForeman')
        return 'warn';
    if (status === 'inTransit' || status === 'delivered')
        return 'primary';
    return 'neutral';
}
/* ───────────────────────────── Б1 · Список ───────────────────────────── */
export function ZayavkiScreen() {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const scope = me && ['snab', 'sklad', 'tech'].includes(me.role) ? 'department' : 'mine';
    const { data, loading } = useQuery(`/zayavki?scope=${scope}`);
    const [showClosed, setShowClosed] = useState(false);
    const { open, closed } = useMemo(() => {
        const list = data ?? [];
        return {
            open: list.filter((z) => z.status !== 'closed'),
            closed: list.filter((z) => z.status === 'closed'),
        };
    }, [data]);
    if (loading)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0437\u0430\u044F\u0432\u043A\u0438\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0417\u0430\u044F\u0432\u043A\u0438", subtitle: `${open.length} в работе · ${closed.length} закрыто`, right: me && ['prorab', 'master'].includes(me.role) ? (_jsx("div", { onClick: () => go('zayavka-new'), style: {
                        cursor: 'pointer',
                        background: color.primary,
                        color: '#fff',
                        borderRadius: radius.smAlt,
                        padding: '10px 14px',
                        fontSize: 13,
                        fontWeight: 800,
                        whiteSpace: 'nowrap',
                        flex: 'none',
                    }, children: "+ \u0417\u0430\u044F\u0432\u043A\u0430" })) : undefined }), open.length === 0 && closed.length === 0 ? (_jsx(EmptyState, { icon: "\uD83D\uDCE6", title: "\u0417\u0430\u044F\u0432\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442", text: "\u0417\u0430\u044F\u0432\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u0451\u0442\u0441\u044F \u0438\u0437 \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0430, \u043A\u043E\u0433\u0434\u0430 \u043D\u0443\u0436\u0435\u043D \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B \u0438\u043B\u0438 \u0442\u0435\u0445\u043D\u0438\u043A\u0430.", action: { label: 'Создать заявку', onClick: () => go('zayavka-new') } })) : null, _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: [open.map((z) => (_jsx(ZayavkaRow, { zayavka: z, onOpen: () => go('zayavka', { zayavkaId: z.id }) }, z.id))), closed.length > 0 ? (_jsxs("div", { onClick: () => setShowClosed((v) => !v), style: {
                            cursor: 'pointer',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            background: color.surface,
                            borderRadius: radius.sm,
                            padding: '12px 16px',
                            boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                            minHeight: 48,
                            marginTop: 4,
                        }, children: [_jsxs(SectionLabel, { tone: "green", style: { fontSize: 12, fontWeight: 800 }, children: ["\u0417\u0410\u041A\u0420\u042B\u0422\u042B\u0415 \u00B7 ", closed.length] }), _jsx("div", { style: { color: color.faint, fontSize: 12 }, children: showClosed ? '▾' : '▸' })] })) : null, showClosed
                        ? closed.map((z) => (_jsx(ZayavkaRow, { zayavka: z, onOpen: () => go('zayavka', { zayavkaId: z.id }) }, z.id)))
                        : null] })] }));
}
function ZayavkaRow({ zayavka, onOpen }) {
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const item = zayavka.items[0];
    const canAccept = (zayavka.status === 'inTransit' || zayavka.status === 'delivered') &&
        me &&
        ['prorab', 'master', 'sklad'].includes(me.role);
    return (_jsxs(Card, { onClick: onOpen, style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: item ? `${item.name ?? item.rawText} · ${formatNumber(item.qty, item.qty % 1 ? 1 : 0)} ${item.unit}` : zayavka.number }), _jsx(Badge, { tone: statusTone(zayavka.status), style: { flexShrink: 0 }, children: ZAYAVKA_STATUS[zayavka.status] ?? zayavka.status })] }), _jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 3, ...tabular }, children: [zayavka.number, zayavka.holder ? ` · держит ${zayavka.holder.fullName}` : '', zayavka.deliveryBy
                        ? ` · поставка ${new Date(zayavka.deliveryBy).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
                        : ''] }), zayavka.idleCost ? (_jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: color.warnStrong, marginTop: 4 }, children: ["\u26A0 \u043F\u0440\u043E\u0441\u0442\u043E\u0439 ", zayavka.idleWorkers, " \u0447\u0435\u043B \u00B7 \u2248 ", zayavka.idleCost.toLocaleString('ru-RU'), " \u0441\u043E\u043C"] })) : null, _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 10 }, children: [canAccept ? (_jsx("div", { onClick: (e) => {
                            e.stopPropagation();
                            go('acceptance', { zayavkaId: zayavka.id });
                        }, style: {
                            cursor: 'pointer',
                            flex: 1,
                            textAlign: 'center',
                            background: color.primary,
                            color: '#fff',
                            borderRadius: radius.xs,
                            padding: '10px 0',
                            fontSize: 13,
                            fontWeight: 800,
                        }, children: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" })) : null, _jsx("div", { onClick: (e) => {
                            e.stopPropagation();
                            onOpen();
                        }, style: {
                            cursor: 'pointer',
                            flex: 1,
                            textAlign: 'center',
                            background: color.chip,
                            color: color.ink,
                            borderRadius: radius.xs,
                            padding: '10px 0',
                            fontSize: 13,
                            fontWeight: 700,
                        }, children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C" })] })] }));
}
/* ───────────────────────────── Б3 · Карточка ───────────────────────────── */
export function ZayavkaCardScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const me = useApp((s) => s.me);
    const { data: zayavka, reload } = useQuery(params.zayavkaId ? `/zayavki/${params.zayavkaId}` : null);
    const advance = useAction(async (status, note) => {
        await api.post(`/zayavki/${params.zayavkaId}/status`, { status, note });
        notify(note);
        reload();
    });
    if (!zayavka)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    const currentIndex = FLOW.findIndex((f) => f.status === zayavka.status);
    const item = zayavka.items[0];
    const isSnab = me?.role === 'snab';
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: item ? `${item.name ?? item.rawText}` : zayavka.number, subtitle: `${zayavka.number} · ${zayavka.objectName ?? ''}`, onBack: back }), zayavka.idleCost ? (_jsxs("div", { style: {
                    margin: '4px 20px',
                    background: color.warnBg,
                    border: `1px solid ${color.warnBorder}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    color: color.warnText,
                    lineHeight: 1.45,
                }, children: ["\u26A0 \u0421\u0432\u044F\u0437\u0430\u043D\u043E: \u043F\u0440\u043E\u0441\u0442\u043E\u0439 ", zayavka.idleWorkers, " \u0447\u0435\u043B \u00B7 \u2248 ", zayavka.idleCost.toLocaleString('ru-RU'), " \u0441\u043E\u043C \u00B7 \u0440\u0430\u0441\u0447\u0451\u0442 \u043F\u043E \u0441\u0442\u0430\u0432\u043A\u0430\u043C"] })) : null, _jsxs(Card, { style: { margin: '8px 20px' }, children: [zayavka.items.map((i) => (_jsxs("div", { style: { marginBottom: 8 }, children: [_jsxs("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: [i.name ?? i.rawText, " \u00B7 ", formatNumber(i.qty, i.qty % 1 ? 1 : 0), " ", i.unit] }), !i.matched ? (_jsx("div", { style: { fontSize: 12, color: color.warnText, fontWeight: 700, marginTop: 2 }, children: "\u043F\u043E\u0437\u0438\u0446\u0438\u044F \u043D\u0435 \u043E\u043F\u043E\u0437\u043D\u0430\u043D\u0430 \u2014 \u0441\u043D\u0430\u0431\u0436\u0435\u043D\u0438\u0435 \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442 \u0441\u043E \u0441\u043F\u0440\u0430\u0432\u043E\u0447\u043D\u0438\u043A\u043E\u043C" })) : null, i.overSpec ? (_jsxs("div", { style: { fontSize: 12, color: color.warnStrong, fontWeight: 700, marginTop: 2, ...tabular }, children: ["\u26A0 \u0431\u043E\u043B\u044C\u0448\u0435 \u043E\u0441\u0442\u0430\u0442\u043A\u0430 \u043F\u043E \u0441\u043F\u0435\u0446\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 (", formatNumber(i.specRemainder ?? 0, 1), " ", i.unit, ")", i.overspendReason ? ` · ${i.overspendReason}` : ''] })) : null] }, i.id))), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 4 }, children: ["\u0410\u0432\u0442\u043E\u0440: ", zayavka.author?.fullName ?? '—', " \u00B7", ' ', new Date(zayavka.createdAt).toLocaleDateString('ru-RU'), zayavka.holder ? ` · сейчас у ${zayavka.holder.fullName}` : ''] })] }), zayavka.tech ? (_jsxs(Card, { style: { margin: '0 20px 8px' }, children: [_jsx(SectionLabel, { children: "\u0422\u0415\u0425\u041D\u0418\u041A\u0410" }), _jsxs("div", { style: { fontSize: 14, fontWeight: 700, color: color.ink, marginTop: 6 }, children: [zayavka.tech.machineType, " \u00B7 ", zayavka.tech.hours, " \u0447 \u00B7", ' ', new Date(zayavka.tech.date).toLocaleDateString('ru-RU'), " \u0441 ", zayavka.tech.timeFrom] }), zayavka.tech.machine ? (_jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 2 }, children: ["\u041D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0430: ", zayavka.tech.machine.name] })) : null, _jsx("div", { style: { marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }, children: zayavka.tech.frontChecklist.map((c) => (_jsxs("div", { style: { display: 'flex', gap: 8, alignItems: 'center' }, children: [_jsx(CheckSquare, { on: c.checked, size: 18 }), _jsx("div", { style: { fontSize: 12.5, color: c.checked ? color.ink : color.muted }, children: c.label })] }, c.key))) })] })) : null, _jsx(SectionLabel, { style: { padding: '4px 20px 8px' }, children: "\u0414\u0412\u0418\u0416\u0415\u041D\u0418\u0415 \u0417\u0410\u042F\u0412\u041A\u0418" }), _jsx("div", { style: { padding: '0 20px', display: 'flex', flexDirection: 'column' }, children: FLOW.map((step, i) => {
                    const done = currentIndex > i;
                    const current = currentIndex === i;
                    const event = zayavka.timeline.find((e) => e.status === step.status);
                    return (_jsxs("div", { style: { display: 'flex', gap: 12 }, children: [_jsxs("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' }, children: [_jsx("div", { style: {
                                            width: 24,
                                            height: 24,
                                            borderRadius: 12,
                                            background: done ? color.green : current ? color.primary : color.chip,
                                            color: done || current ? '#fff' : color.faint,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 800,
                                            fontSize: 11,
                                            flexShrink: 0,
                                            ...(current ? { boxShadow: `0 0 0 3px ${color.primaryBg}` } : null),
                                        }, children: done ? '✓' : current ? '●' : '○' }), i < FLOW.length - 1 ? (_jsx("div", { style: { width: 2, flex: 1, minHeight: 18, background: done ? color.green : color.track } })) : null] }), _jsxs("div", { style: { paddingBottom: 12, minWidth: 0 }, children: [_jsx("div", { style: {
                                            fontSize: current ? 14 : 13.5,
                                            fontWeight: current ? 800 : done ? 700 : 600,
                                            color: done || current ? color.ink : color.faint,
                                        }, children: step.label }), event ? (_jsxs("div", { style: { fontSize: 12, color: color.muted }, children: [event.actor, " \u00B7 ", new Date(event.at).toLocaleDateString('ru-RU'), event.note ? ` · ${event.note}` : ''] })) : null] })] }, step.status));
                }) }), _jsxs("div", { style: {
                    marginTop: 'auto',
                    padding: '16px 20px 24px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                }, children: [isSnab && currentIndex >= 0 && currentIndex < FLOW.length - 1 ? (_jsxs(PrimaryButton, { onClick: () => advance.run(FLOW[currentIndex + 1].status, FLOW[currentIndex + 1].label), children: [FLOW[currentIndex + 1].label, " \u2192"] })) : null, (zayavka.status === 'inTransit' || zayavka.status === 'delivered') &&
                        me &&
                        ['prorab', 'master', 'sklad'].includes(me.role) ? (_jsx(PrimaryButton, { onClick: () => go('acceptance', { zayavkaId: zayavka.id }), children: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B" })) : null, zayavka.status === 'new' || zayavka.status === 'normalizing' ? (_jsx("div", { onClick: () => notify('Напоминание ушло · зафиксировано в истории заявки'), style: {
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
                        }, children: "\u041F\u043E\u0442\u043E\u0440\u043E\u043F\u0438\u0442\u044C" })) : null] })] }));
}
/* ───────────────────────────── Б2 · Новая заявка ───────────────────────────── */
export function ZayavkaNewScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const me = useApp((s) => s.me);
    const [text, setText] = useState('');
    const [matched, setMatched] = useState(null);
    const [qty, setQty] = useState('4,2');
    const [unit, setUnit] = useState('т');
    const [urgent, setUrgent] = useState(false);
    const [idleWorkers, setIdleWorkers] = useState('24');
    const [reason, setReason] = useState(null);
    const [deliveryBy, setDeliveryBy] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 4);
        return d.toISOString().slice(0, 10);
    });
    const { data: process } = useQuery(params.processStateId ? `/process/${params.processStateId}` : null);
    const { data: stock } = useQuery('/stock');
    const { data: suggestions } = useQuery(text.length >= 3 ? `/catalog?q=${encodeURIComponent(text)}` : '/catalog', [text]);
    const qtyNum = Number(qty.replace(',', '.')) || 0;
    const balance = stock?.find((s) => s.catalogItemId === matched?.id);
    const specRemainder = balance?.specRemainder ?? null;
    const overSpec = specRemainder !== null && qtyNum > specRemainder;
    const create = useAction(async () => {
        if (!me?.objectId)
            return;
        const res = await api.post('/zayavki', {
            kind: 'material',
            objectId: me.objectId,
            blockId: process?.blockId,
            floor: process?.floor,
            processStateId: params.processStateId,
            priority: urgent ? 'urgent' : 'norm',
            deliveryBy,
            idleWorkers: urgent ? Number(idleWorkers) || undefined : undefined,
            idleSince: urgent ? new Date().toISOString() : undefined,
            items: [
                {
                    rawText: text,
                    catalogItemId: matched?.id ?? null,
                    qty: qtyNum,
                    unit,
                    overspendReason: overSpec ? (reason ?? undefined) : undefined,
                },
            ],
        });
        notify(me.role === 'master'
            ? `${res.number} ушла на согласование прорабу`
            : `${res.number} ушла в снабжение`);
        go('zayavka', { zayavkaId: res.id });
    });
    const canSend = text.trim().length > 0 && qtyNum > 0 && (!overSpec || Boolean(reason));
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430", subtitle: process ? `${process.name} · ${process.blockName} · ${process.floor} эт.` : 'материалы', onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx(SectionLabel, { children: "\u0427\u0422\u041E \u041D\u0423\u0416\u041D\u041E" }), _jsx("input", { value: text, onChange: (e) => {
                            setText(e.target.value);
                            setMatched(null);
                        }, placeholder: "\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0430\u0440\u043C\u0430\u0442\u0443\u0440\u0430 12\u043A\u0430", style: {
                            width: '100%',
                            boxSizing: 'border-box',
                            border: 'none',
                            outline: 'none',
                            background: color.screen,
                            borderRadius: radius.sm,
                            padding: '12px 14px',
                            fontSize: 16,
                            fontWeight: 700,
                            color: color.ink,
                            marginTop: 8,
                            fontFamily: 'inherit',
                        } }), !matched && text.length >= 2 && suggestions && suggestions.length > 0 ? (_jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: suggestions.slice(0, 4).map((s) => (_jsx(Chip, { onClick: () => {
                                setMatched(s);
                                setText(s.name);
                                setUnit(s.unit);
                            }, style: { fontSize: 12 }, children: s.name }, s.id))) })) : null, matched ? (_jsxs("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.greenDeep, marginTop: 8 }, children: ["\u2713 \u041E\u043F\u043E\u0437\u043D\u0430\u043D\u043E: ", matched.name] })) : text.length > 0 ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.warnText, marginTop: 8 }, children: "\u041F\u043E\u0437\u0438\u0446\u0438\u044F \u043D\u0435 \u043E\u043F\u043E\u0437\u043D\u0430\u043D\u0430 \u2014 \u0443\u0439\u0434\u0451\u0442 \u043A\u0430\u043A \u0435\u0441\u0442\u044C, \u0441\u043D\u0430\u0431\u0436\u0435\u043D\u0438\u0435 \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u0438\u0442 \u0438 \u0437\u0430\u043F\u043E\u043C\u043D\u0438\u0442 \u0444\u043E\u0440\u043C\u0443\u043B\u0438\u0440\u043E\u0432\u043A\u0443" })) : null, _jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }, children: [_jsx("input", { value: qty, onChange: (e) => setQty(e.target.value), style: {
                                    width: 96,
                                    boxSizing: 'border-box',
                                    border: 'none',
                                    outline: 'none',
                                    background: color.screen,
                                    borderRadius: radius.xs,
                                    padding: '10px 12px',
                                    fontSize: 17,
                                    fontWeight: 800,
                                    color: color.ink,
                                    textAlign: 'center',
                                    fontFamily: 'inherit',
                                    ...tabular,
                                } }), _jsx("div", { style: { display: 'flex', gap: 6 }, children: ['т', 'кг', 'шт', 'м³', 'м²'].map((u) => (_jsx(Chip, { active: unit === u, onClick: () => setUnit(u), style: { fontSize: 12, padding: '7px 10px' }, children: u }, u))) })] }), balance ? (_jsxs("div", { style: {
                            marginTop: 10,
                            background: color.primaryBgSoft,
                            borderRadius: radius.xs,
                            padding: '9px 12px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: color.ink,
                            ...tabular,
                        }, children: ["\u041D\u0430 \u043E\u0431\u044A\u0435\u043A\u0442\u0435 \u0441\u0435\u0439\u0447\u0430\u0441: ", formatNumber(balance.qty, 1), " ", balance.unit, specRemainder !== null ? ` · по спецификации осталось ${formatNumber(specRemainder, 1)} ${balance.unit}` : ''] })) : null, overSpec ? (_jsxs("div", { style: {
                            marginTop: 8,
                            background: color.warnBg,
                            border: `1px solid ${color.warnBorder}`,
                            borderRadius: radius.xs,
                            padding: '9px 12px',
                        }, children: [_jsxs("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.warnText, ...tabular }, children: ["\u26A0 \u0417\u0430\u044F\u0432\u043B\u0435\u043D\u043E ", formatNumber(qtyNum, 1), " ", unit, ", \u043F\u043E \u0441\u043F\u0435\u0446\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u043E\u0441\u0442\u0430\u0442\u043E\u043A", ' ', formatNumber(specRemainder ?? 0, 1), " ", unit, " \u2014 \u0443\u043A\u0430\u0436\u0438\u0442\u0435 \u043F\u0440\u0438\u0447\u0438\u043D\u0443"] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }, children: ['отходы при резке', 'нахлёстки', 'перерасход', 'ошибка в объёмах', 'другое'].map((r) => (_jsx(Chip, { tone: "dark", active: reason === r, onClick: () => setReason(r), style: { fontSize: 11.5, padding: '7px 10px' }, children: r }, r))) })] })) : null] }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u0421\u0420\u041E\u041A \u041F\u041E\u0421\u0422\u0410\u0412\u041A\u0418" }), _jsx("input", { type: "date", value: deliveryBy, onChange: (e) => setDeliveryBy(e.target.value), style: {
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
                            marginTop: 8,
                            fontFamily: 'inherit',
                        } }), _jsx("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 6, lineHeight: 1.4 }, children: "\u042D\u0442\u043E \u0441\u0440\u043E\u043A, \u043A \u043A\u043E\u0442\u043E\u0440\u043E\u043C\u0443 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B \u043D\u0443\u0436\u0435\u043D \u043D\u0430 \u043E\u0431\u044A\u0435\u043A\u0442\u0435, \u0430 \u043D\u0435 \u0441\u0440\u043E\u043A \u0440\u0430\u0431\u043E\u0442\u044B." })] }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u041F\u0420\u0418\u041E\u0420\u0418\u0422\u0415\u0422" }), _jsx("div", { style: { display: 'flex', gap: 8, marginTop: 8 }, children: [
                            { on: !urgent, label: 'Обычная', click: () => setUrgent(false) },
                            { on: urgent, label: 'Простой — люди стоят', click: () => setUrgent(true) },
                        ].map((o) => (_jsxs("div", { onClick: o.click, style: {
                                cursor: 'pointer',
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                background: color.surface,
                                border: `${o.on ? 1.5 : 1}px solid ${o.on ? color.primary : color.border}`,
                                borderRadius: radius.sm,
                                padding: '13px 14px',
                                fontSize: 13.5,
                                fontWeight: o.on ? 800 : 600,
                                color: color.ink,
                                minHeight: 56,
                                boxSizing: 'border-box',
                            }, children: [_jsx("div", { style: {
                                        width: 20,
                                        height: 20,
                                        borderRadius: 10,
                                        border: o.on ? `6px solid ${color.primary}` : `2px solid ${color.disabled}`,
                                        boxSizing: 'border-box',
                                        background: '#fff',
                                        flexShrink: 0,
                                    } }), o.label] }, o.label))) }), urgent ? (_jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }, children: [_jsx("div", { style: { fontSize: 13, color: color.ink, flex: 1 }, children: "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0447\u0435\u043B\u043E\u0432\u0435\u043A \u0441\u0442\u043E\u0438\u0442" }), _jsx("input", { value: idleWorkers, onChange: (e) => setIdleWorkers(e.target.value), style: {
                                    width: 72,
                                    boxSizing: 'border-box',
                                    border: 'none',
                                    outline: 'none',
                                    background: color.screen,
                                    borderRadius: radius.xs,
                                    padding: '10px 12px',
                                    fontSize: 15,
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    color: color.ink,
                                    fontFamily: 'inherit',
                                    ...tabular,
                                } })] })) : null] }), _jsx("div", { style: { margin: '8px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }, children: me?.role === 'master'
                    ? 'Заявка уйдёт на согласование прорабу, затем в снабжение'
                    : 'Заявка уйдёт напрямую в снабжение' }), create.error ? (_jsx("div", { style: { margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }, children: create.error })) : null, _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(PrimaryButton, { onClick: () => create.run(), disabled: !canSend || create.busy, children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443" }) })] }));
}
/* ───────────────────────────── Б4 · Приёмка ───────────────────────────── */
export function AcceptanceScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const notify = useApp((s) => s.notify);
    const { data: zayavka } = useQuery(params.zayavkaId ? `/zayavki/${params.zayavkaId}` : null);
    const [qty, setQty] = useState('');
    const [passportOk, setPassportOk] = useState(null);
    const [passportNumber, setPassportNumber] = useState('');
    const [discrepancy, setDiscrepancy] = useState('');
    const [photos, setPhotos] = useState([]);
    const item = zayavka?.items[0];
    const expected = item?.qty ?? 0;
    const qtyNum = Number(qty.replace(',', '.')) || 0;
    const short = qtyNum > 0 && qtyNum < expected;
    const submit = useAction(async () => {
        await api.post(`/zayavki/${params.zayavkaId}/accept`, {
            qtyAccepted: qtyNum,
            passportOk: passportOk === true,
            passportNumber: passportNumber || undefined,
            discrepancy: discrepancy || undefined,
            photos,
        });
        notify(passportOk
            ? 'Принято · запись ушла в Журнал входного контроля'
            : '⛔ Партия помечена · уведомление ушло ПТО и в снабжение');
        go('zayavki');
    });
    if (!zayavka || !item)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    const blocker = qtyNum <= 0
        ? 'Укажите принятое количество'
        : photos.length === 0
            ? 'Фото приёмки обязательно'
            : passportOk === null
                ? 'Отметьте, есть ли паспорт качества'
                : short && !discrepancy
                    ? 'Принято меньше заявленного — опишите расхождение'
                    : null;
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041F\u0440\u0438\u0451\u043C\u043A\u0430 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u0430", subtitle: `${zayavka.number} · ${item.name ?? item.rawText}`, onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx(SectionLabel, { children: "\u0428\u0410\u0413 1 \u00B7 \u041A\u041E\u041B\u0418\u0427\u0415\u0421\u0422\u0412\u041E" }), _jsxs("div", { style: { fontSize: 13, color: color.muted, marginTop: 6, ...tabular }, children: ["\u0417\u0430\u044F\u0432\u043B\u0435\u043D\u043E: ", formatNumber(expected, 1), " ", item.unit] }), _jsxs("div", { style: { display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }, children: [_jsx("input", { value: qty, onChange: (e) => setQty(e.target.value), placeholder: "0", style: {
                                    width: 110,
                                    boxSizing: 'border-box',
                                    border: 'none',
                                    outline: 'none',
                                    background: color.screen,
                                    borderRadius: radius.xs,
                                    padding: '12px',
                                    fontSize: 20,
                                    fontWeight: 800,
                                    textAlign: 'center',
                                    color: color.ink,
                                    fontFamily: 'inherit',
                                    ...tabular,
                                } }), _jsx("div", { style: { fontSize: 16, fontWeight: 700, color: color.muted }, children: item.unit })] }), short ? (_jsx("input", { value: discrepancy, onChange: (e) => setDiscrepancy(e.target.value), placeholder: "\u0427\u0435\u043C \u043E\u0431\u044A\u044F\u0441\u043D\u044F\u0435\u0442\u0441\u044F \u043D\u0435\u0434\u043E\u0432\u043E\u0437", style: {
                            width: '100%',
                            boxSizing: 'border-box',
                            border: `1px solid ${color.warnBorder}`,
                            outline: 'none',
                            background: color.warnBg,
                            borderRadius: radius.xs,
                            padding: '10px 12px',
                            fontSize: 13,
                            color: color.ink,
                            marginTop: 10,
                            fontFamily: 'inherit',
                        } })) : null] }), _jsxs(Card, { style: { margin: '8px 20px' }, children: [_jsx(SectionLabel, { children: "\u0428\u0410\u0413 2 \u00B7 \u041F\u0410\u0421\u041F\u041E\u0420\u0422 \u041A\u0410\u0427\u0415\u0421\u0422\u0412\u0410" }), _jsxs("div", { style: { display: 'flex', gap: 8, marginTop: 8 }, children: [_jsx("div", { onClick: () => setPassportOk(true), style: {
                                    cursor: 'pointer',
                                    flex: 1,
                                    textAlign: 'center',
                                    borderRadius: radius.xs,
                                    padding: '10px 0',
                                    fontSize: 13,
                                    fontWeight: passportOk === true ? 800 : 700,
                                    ...(passportOk === true
                                        ? { background: color.green, color: '#fff' }
                                        : { background: color.surface, color: color.ink, border: `1px solid ${color.border}` }),
                                }, children: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442 \u0435\u0441\u0442\u044C" }), _jsx("div", { onClick: () => setPassportOk(false), style: {
                                    cursor: 'pointer',
                                    flex: 1,
                                    textAlign: 'center',
                                    borderRadius: radius.xs,
                                    padding: '10px 0',
                                    fontSize: 13,
                                    fontWeight: passportOk === false ? 800 : 700,
                                    ...(passportOk === false
                                        ? { background: color.danger, color: '#fff' }
                                        : { background: color.surface, color: color.ink, border: `1px solid ${color.border}` }),
                                }, children: "\u041F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 \u043D\u0435\u0442" })] }), passportOk === true ? (_jsx("input", { value: passportNumber, onChange: (e) => setPassportNumber(e.target.value), placeholder: "\u041D\u043E\u043C\u0435\u0440 \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430 / \u0441\u0435\u0440\u0442\u0438\u0444\u0438\u043A\u0430\u0442\u0430", style: {
                            width: '100%',
                            boxSizing: 'border-box',
                            border: 'none',
                            outline: 'none',
                            background: color.screen,
                            borderRadius: radius.xs,
                            padding: '10px 12px',
                            fontSize: 14,
                            color: color.ink,
                            marginTop: 10,
                            fontFamily: 'inherit',
                        } })) : null, passportOk === false ? (_jsx("div", { style: {
                            marginTop: 10,
                            background: color.warnBg,
                            border: `1px solid ${color.warnBorder}`,
                            borderRadius: radius.xs,
                            padding: '10px 12px',
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: color.warnText,
                            lineHeight: 1.45,
                        }, children: "\u041F\u0430\u0440\u0442\u0438\u044F \u0431\u0443\u0434\u0435\u0442 \u043F\u043E\u043C\u0435\u0447\u0435\u043D\u0430, \u0440\u0430\u0431\u043E\u0442\u044B \u0441 \u043D\u0435\u0439 \u043F\u0440\u0438\u043E\u0441\u0442\u0430\u043D\u043E\u0432\u043B\u0435\u043D\u044B. \u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0435 \u0443\u0439\u0434\u0451\u0442 \u041F\u0422\u041E \u0438 \u0432 \u0441\u043D\u0430\u0431\u0436\u0435\u043D\u0438\u0435." })) : null] }), _jsxs("div", { style: { display: 'flex', gap: 8, padding: '8px 20px', alignItems: 'center', flexWrap: 'wrap' }, children: [_jsxs("div", { onClick: () => setPhotos((p) => [...p, { url: `acc-${p.length + 1}.jpg`, takenAt: new Date().toISOString() }]), style: {
                            cursor: 'pointer',
                            width: 64,
                            height: 64,
                            borderRadius: radius.sm,
                            background: color.primary,
                            color: '#fff',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: 'none',
                        }, children: [_jsx("div", { style: { fontSize: 19 }, children: "\u25C9" }), _jsx("div", { style: { fontSize: 10, fontWeight: 700 }, children: "\u0424\u043E\u0442\u043E" })] }), photos.map((p) => (_jsx("div", { style: {
                            width: 64,
                            height: 64,
                            borderRadius: radius.sm,
                            flex: 'none',
                            background: 'repeating-linear-gradient(45deg,#D8DAE3 0 8px,#E7E9F0 8px 16px)',
                        } }, p.url))), photos.length === 0 ? (_jsxs("div", { style: { fontSize: 11.5, color: color.warnText, fontWeight: 700, lineHeight: 1.4 }, children: ["\u0444\u043E\u0442\u043E \u043F\u0440\u0438\u0451\u043C\u043A\u0438 \u2014", _jsx("br", {}), "\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E"] })) : null] }), submit.error ? (_jsx("div", { style: { margin: '4px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }, children: submit.error })) : null, _jsxs("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: [blocker ? (_jsx("div", { style: { fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center', marginBottom: 8 }, children: blocker })) : null, _jsx(PrimaryButton, { onClick: () => submit.run(), disabled: Boolean(blocker) || submit.busy, children: "\u041F\u0440\u0438\u043D\u044F\u0442\u044C" })] })] }));
}
