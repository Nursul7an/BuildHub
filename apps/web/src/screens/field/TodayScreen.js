import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * B1 · «Сегодня» — главный экран площадки.
 *
 * Порядок блоков задан макетом и не случаен: сначала то, что горит, потом
 * возврат от ПТО, потом счётчик отчёта, и только затем список работ.
 * Прораб открывает экран, чтобы понять, что делать сейчас, а не изучать объект.
 */
import { color, radius } from '../../design/tokens';
import { Avatar, Badge, Card, EmptyState, PrimaryButton, ProgressBar, RowCard, SectionLabel, formatPct, initialsOf, tabular, } from '../../design/primitives';
import { IconCrane } from '../../design/icons';
import { useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
import { ScreenBody } from '../../shell/PhoneFrame';
const WEEKDAY = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTH = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export function formatDay(iso) {
    const d = new Date(iso);
    return `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
}
export function TodayScreen() {
    const { data, loading, reload } = useQuery('/today');
    const me = useApp((s) => s.me);
    const go = useApp((s) => s.go);
    const startTimer = useApp((s) => s.startTimer);
    if (loading || !data || !me) {
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0434\u0435\u043D\u044C\u2026" });
    }
    // Заблокированные уже стоят в «Горит» с причиной — второй раз их не показываем.
    const workable = data.processes.filter((p) => p.status !== 'blocked');
    const filled = data.report?.entries.length ?? 0;
    const total = workable.length;
    const ringComplete = total > 0 && filled >= total;
    const submitted = data.report?.status && data.report.status !== 'draft';
    function openForm(processStateId) {
        startTimer();
        go('form', { processStateId });
    }
    return (_jsxs(ScreenBody, { children: [_jsxs("div", { style: {
                    padding: '16px 20px 8px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }, children: [_jsxs("div", { children: [_jsx("div", { style: { fontSize: 13, fontWeight: 600, color: color.muted }, children: formatDay(data.date) }), _jsx("div", { style: { fontSize: 22, fontWeight: 800, color: color.ink }, children: me.role === 'master' && data.block ? `${data.block.name} · ${me.scopeLabel ?? ''}` : (data.object?.name ?? '—') }), _jsx("div", { style: { fontSize: 12, color: color.muted, marginTop: 1 }, children: me.role === 'master'
                                    ? `мастер ${me.fullName} · захватка · отчёт прорабу`
                                    : `прораб ${me.fullName} · отчёт в ПТО` })] }), _jsx(Avatar, { initials: initialsOf(me.fullName), onClick: () => go('profile') })] }), data.returnedReport ? (_jsxs("div", { onClick: () => go('returned', { reportId: data.returnedReport.id }), style: {
                    cursor: 'pointer',
                    margin: '8px 20px',
                    background: color.warnBg,
                    border: `1px solid ${color.warnBorder}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                }, children: [_jsx("div", { style: { fontSize: 18 }, children: "\u21A9" }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { fontSize: 14, fontWeight: 700, color: color.warnText }, children: ["\u041E\u0442\u0447\u0451\u0442 \u0437\u0430 ", new Date(data.returnedReport.date).getDate(), ' ', MONTH[new Date(data.returnedReport.date).getMonth()], " \u0432\u043E\u0437\u0432\u0440\u0430\u0449\u0451\u043D \u041F\u0422\u041E"] }), _jsxs("div", { style: { fontSize: 13, color: color.warnText }, children: ["\u00AB", data.returnedReport.returnComment, "\u00BB"] })] }), _jsx("div", { style: { fontSize: 14, fontWeight: 700, color: color.warnDeep }, children: "\u0418\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C" })] })) : null, data.notifications.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { tone: "green", style: { padding: '8px 20px 0', fontSize: 12.5, fontWeight: 800 }, children: "\uD83D\uDD14 \u041D\u041E\u0412\u041E\u0415 \u0418\u0417 \u041E\u0422\u0414\u0415\u041B\u041E\u0412" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 20px 0' }, children: data.notifications.slice(0, 3).map((n) => (_jsxs("div", { onClick: async () => {
                                await api.post(`/notifications/${n.id}/read`);
                                reload();
                            }, style: {
                                cursor: 'pointer',
                                background: color.greenBg,
                                border: `1px solid ${color.greenBorder}`,
                                borderRadius: radius.md,
                                padding: '12px 15px',
                            }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: color.ink, minWidth: 0 }, children: n.title }), _jsx("div", { style: { fontSize: 11.5, color: color.greenDeep, whiteSpace: 'nowrap', flexShrink: 0 }, children: new Date(n.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }) })] }), _jsx("div", { style: { fontSize: 12.5, color: color.inkSoft, marginTop: 3, lineHeight: 1.45 }, children: n.subtitle }), _jsx("div", { style: { fontSize: 11, color: color.greenMuted, marginTop: 5 }, children: "\u0442\u0430\u043F \u2014 \u043F\u0440\u043E\u0447\u0438\u0442\u0430\u043D\u043E" })] }, n.id))) })] })) : null, data.burning.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { tone: "danger", style: { padding: '8px 20px 0', fontSize: 12.5, fontWeight: 800 }, children: "\u0413\u041E\u0420\u0418\u0422" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 20px 0' }, children: data.burning.map((b) => (_jsxs("div", { onClick: () => go('process', { processStateId: b.processStateId }), style: {
                                cursor: 'pointer',
                                background: color.surface,
                                border: `1.5px solid ${b.kind === 'overdue' ? '#F0B4B0' : color.border}`,
                                borderRadius: radius.md,
                                padding: '12px 15px',
                            }, children: [_jsx("div", { style: { fontSize: 13.5, fontWeight: 800, color: color.ink }, children: b.title }), _jsx("div", { style: {
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        marginTop: 2,
                                        color: b.kind === 'overdue' ? color.danger : color.warnText,
                                    }, children: b.kind === 'overdue' ? `⏱ ${b.note}` : `⛔ ${b.note}` })] }, `${b.kind}-${b.processStateId}`))) })] })) : null, workable.length === 0 ? (_jsx(EmptyState, { icon: _jsx(IconCrane, {}), title: "\u041F\u0422\u041E \u043F\u043E\u043A\u0430 \u043D\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0438\u043B \u0432\u0430\u043C \u0440\u0430\u0431\u043E\u0442\u044B", text: "\u041A\u0430\u043A \u0442\u043E\u043B\u044C\u043A\u043E \u043D\u0430\u0437\u043D\u0430\u0447\u0430\u0442 \u2014 \u043E\u043D\u0438 \u043F\u043E\u044F\u0432\u044F\u0442\u0441\u044F \u0437\u0434\u0435\u0441\u044C \u0438 \u043D\u0430 \u00AB\u0421\u0435\u0433\u043E\u0434\u043D\u044F\u00BB.", action: { label: 'Написать в ПТО', onClick: () => go('more') } })) : (_jsxs(_Fragment, { children: [_jsxs(Card, { style: { margin: '8px 20px', display: 'flex', alignItems: 'center', gap: 16 }, children: [_jsx("div", { style: {
                                    width: 64,
                                    height: 64,
                                    borderRadius: 32,
                                    background: ringComplete
                                        ? color.green
                                        : `conic-gradient(${color.primary} ${total > 0 ? (filled / total) * 360 : 0}deg, ${color.track} 0deg)`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flex: 'none',
                                }, children: _jsxs("div", { style: {
                                        width: 50,
                                        height: 50,
                                        borderRadius: 25,
                                        background: color.surface,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        fontWeight: 800,
                                        fontSize: 15,
                                        color: color.ink,
                                        ...tabular,
                                    }, children: [filled, "/", total] }) }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: color.ink }, children: "\u041E\u0442\u0447\u0451\u0442 \u0437\u0430 \u0441\u0435\u0433\u043E\u0434\u043D\u044F" }), _jsx("div", { style: { fontSize: 13.5, color: color.muted }, children: submitted
                                            ? 'отправлен · ждёт проверки'
                                            : ringComplete
                                                ? 'всё заполнено — можно отправлять'
                                                : `осталось ${total - filled} из ${total}` })] })] }), _jsxs(SectionLabel, { style: { padding: '10px 20px 4px' }, children: ["\u0410\u041A\u0422\u0418\u0412\u041D\u042B\u0415 \u041F\u0420\u041E\u0426\u0415\u0421\u0421\u042B \u00B7 ", workable.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }, children: workable.map((p) => {
                            const done = p.filledToday;
                            const blocked = p.status === 'blocked';
                            return (_jsxs(Card, { onClick: () => (blocked ? go('process', { processStateId: p.id }) : openForm(p.id)), style: done ? { border: `1.5px solid ${color.greenBorder}` } : undefined, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 16, fontWeight: 800, color: color.ink, minWidth: 0 }, children: p.name }), _jsx(Badge, { tone: blocked ? 'warn' : done ? 'green' : 'neutral', children: blocked ? '⛔ Заблокирован' : done ? '✓ Заполнено' : '○ Не заполнено' })] }), _jsxs("div", { style: { fontSize: 13.5, color: color.muted, marginTop: 2 }, children: [p.sectionName, " \u00B7 ", p.blockName, " \u00B7 ", p.floor, " \u044D\u0442\u0430\u0436"] }), blocked ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.danger, marginTop: 6 }, children: p.blockedReason })) : (_jsx("div", { style: { fontSize: 12, fontWeight: 800, marginTop: 3, ...tabular, ...dueStyle(p.dueDate) }, children: dueText(p.dueDate) })), _jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }, children: [_jsx(ProgressBar, { pct: p.pct, fill: done ? color.green : color.primary }), _jsx("div", { style: { fontSize: 14, fontWeight: 800, color: color.ink, ...tabular }, children: formatPct(p.pct) })] })] }, p.id));
                        }) })] })), data.zayavki.length > 0 ? (_jsxs(_Fragment, { children: [_jsx(SectionLabel, { style: { padding: '10px 20px 4px' }, children: "\u0417\u0410\u042F\u0412\u041A\u0418 \u0422\u0420\u0415\u0411\u0423\u042E\u0422 \u0412\u041D\u0418\u041C\u0410\u041D\u0418\u042F" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }, children: data.zayavki.map((z) => (_jsxs(RowCard, { onClick: () => go('zayavka', { zayavkaId: z.id }), children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 800, color: color.primary, ...tabular }, children: z.number }), _jsx(Badge, { tone: z.idleCost ? 'warn' : 'neutral', style: { fontSize: 11.5 }, children: ZAYAVKA_STATUS[z.status] ?? z.status })] }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: color.ink, marginTop: 3 }, children: z.what }), z.idleCost ? (_jsxs("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.warnStrong, marginTop: 2 }, children: ["\u26A0 \u043F\u0440\u043E\u0441\u0442\u043E\u0439 \u2248 ", z.idleCost.toLocaleString('ru-RU'), " \u0441\u043E\u043C"] })) : null] }, z.id))) })] })) : null, _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 8px' }, children: submitted ? (_jsx(PrimaryButton, { onClick: () => go('status', { reportId: data.report.id }), style: { background: color.ink, boxShadow: 'none' }, children: "\u041E\u0442\u0447\u0451\u0442 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D \u00B7 \u043E\u0442\u043A\u0440\u044B\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441" })) : (_jsx(PrimaryButton, { onClick: () => go('preview'), disabled: filled === 0, children: filled === 0 ? 'Заполните хотя бы одну работу' : `Проверить и отправить · ${filled}` })) })] }));
}
export const ZAYAVKA_STATUS = {
    draft: 'черновик',
    atForeman: 'у прораба',
    new: 'отправлена',
    normalizing: 'на рассмотрении',
    approved: 'согласована',
    purchasing: 'в закупке',
    ordered: 'заказано',
    inTransit: 'в пути',
    delivered: 'на объекте',
    accepted: 'принято',
    closed: 'закрыта',
    rejected: 'отклонена',
};
/** Срок словами: «просрочено 2 дня» важнее даты. */
export function dueText(dueDate) {
    if (!dueDate)
        return 'срок не назначен';
    const days = Math.round((new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
    if (days < 0)
        return `⏱ просрочено ${plural(-days, 'день', 'дня', 'дней')}`;
    if (days === 0)
        return '⏱ срок сегодня';
    if (days === 1)
        return '⏱ срок завтра';
    return `⏱ осталось ${plural(days, 'день', 'дня', 'дней')}`;
}
export function dueStyle(dueDate) {
    if (!dueDate)
        return { color: color.faint };
    const days = Math.round((new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
    if (days < 0)
        return { color: color.danger };
    if (days <= 1)
        return { color: color.warnStrong };
    return { color: color.muted };
}
export function plural(n, one, few, many) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11)
        return `${n} ${one}`;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14))
        return `${n} ${few}`;
    return `${n} ${many}`;
}
