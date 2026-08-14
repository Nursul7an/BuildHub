import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * B5 «Предпросмотр», B6 «Статус», B7 «Возвращён».
 *
 * После отправки отчёт сразу виден руководству со статусом «не подтверждён» —
 * это обещание интерфейса, поэтому цепочка согласования показана целиком,
 * с именами и временем, а не абстрактным «на согласовании».
 */
import { color, radius } from '../../design/tokens';
import { Badge, Card, GhostButton, PrimaryButton, SectionLabel, formatNumber, tabular, } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { formatElapsed, useApp } from '../../store/app';
const MONTH_FULL = [
    'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
    'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
function dateTitle(iso) {
    const d = new Date(iso);
    return `Отчёт за ${d.getDate()} ${MONTH_FULL[d.getMonth()]}`;
}
/* ───────────────────────────── B5 · Предпросмотр ───────────────────────────── */
export function PreviewScreen() {
    const go = useApp((s) => s.go);
    const back = useApp((s) => s.back);
    const me = useApp((s) => s.me);
    const stopTimer = useApp((s) => s.stopTimer);
    const formStartedAt = useApp((s) => s.formStartedAt);
    const notify = useApp((s) => s.notify);
    const { data } = useQuery('/today');
    const report = data?.report ?? null;
    const send = useAction(async () => {
        if (!report)
            return;
        const seconds = formStartedAt ? Math.round((Date.now() - formStartedAt) / 1000) : 0;
        await api.post(`/report/${report.id}/submit`, { fillSeconds: seconds });
        stopTimer();
        notify(me?.role === 'master' ? 'Отчёт ушёл прорабу' : 'Отчёт ушёл в ПТО');
        go('status', { reportId: report.id });
    });
    if (!data)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    const entries = report?.entries ?? [];
    const notFilled = data.processes.filter((p) => p.status !== 'blocked' && !entries.some((e) => e.processStateId === p.id));
    const workers = entries.reduce((a, e) => a + e.workers, 0);
    const photos = entries.reduce((a, e) => a + e.photos.length, 0);
    const problems = entries.reduce((a, e) => a + e.problems.length, 0);
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: dateTitle(data.date), subtitle: `${data.object?.name ?? ''} · ${me?.fullName ?? ''}`, onBack: back }), _jsxs(Card, { style: { margin: '6px 20px' }, children: [_jsx(SectionLabel, { children: "\u0418\u0422\u041E\u0413\u0418 \u0414\u041D\u042F" }), _jsxs("div", { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }, children: [_jsx(Metric, { value: entries.length, label: "\u0440\u0430\u0431\u043E\u0442\u044B" }), _jsx(Metric, { value: workers, label: "\u0440\u0430\u0431\u043E\u0447\u0438\u0445" }), _jsx(Metric, { value: photos, label: "\u0444\u043E\u0442\u043E" }), _jsx(Metric, { value: problems, label: "\u043F\u0440\u043E\u0431\u043B\u0435\u043C", tone: problems > 0 ? color.warnStrong : undefined })] })] }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 20px' }, children: [entries.map((e) => (_jsxs(Card, { style: { borderRadius: radius.card, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: e.title }), _jsx("div", { onClick: () => go('form', { processStateId: e.processStateId }), style: { cursor: 'pointer', fontSize: 13, fontWeight: 700, color: color.primary, flexShrink: 0 }, children: "\u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C" })] }), _jsxs("div", { style: { fontSize: 13.5, color: color.inkMuted, marginTop: 4, ...tabular }, children: ["+", formatNumber(e.volume, e.unit === 'т' ? 2 : 0), " ", e.unit, " \u00B7 ", e.workers, " \u0447\u0435\u043B \u00B7", ' ', e.photos.length, " \u0444\u043E\u0442\u043E", e.problems.length > 0 ? ` · ⚠ ${e.problems.join(', ').toLowerCase()}` : ''] }), e.winterMethod ? (_jsxs("div", { style: { fontSize: 12, color: color.warnText, marginTop: 3, fontWeight: 700 }, children: ["\u2744 ", e.tempAir, " \u00B0C \u00B7 ", e.winterMethod] })) : null] }, e.id))), notFilled.map((p) => (_jsxs("div", { style: {
                            background: color.chip,
                            border: `1px dashed ${color.dashed}`,
                            borderRadius: radius.card,
                            padding: '14px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 8,
                        }, children: [_jsxs("div", { style: { fontSize: 14, fontWeight: 700, color: color.muted, minWidth: 0 }, children: [p.name, " \u00B7 ", p.blockName, " \u00B7 ", p.floor, " \u044D\u0442"] }), _jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.muted, flexShrink: 0 }, children: "\u043D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E \u2014 \u043F\u0440\u043E\u043F\u0443\u0441\u0442\u0438\u0442\u044C" })] }, p.id)))] }), _jsx("div", { style: { margin: '10px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }, children: "\u041F\u043E\u0441\u043B\u0435 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438 \u043E\u0442\u0447\u0451\u0442 \u0441\u0440\u0430\u0437\u0443 \u0432\u0438\u0434\u0435\u043D \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u0443 \u0441\u043E \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u043C \u00AB\u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u00BB." }), send.error ? (_jsx("div", { style: { margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }, children: send.error })) : null, _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(PrimaryButton, { onClick: () => send.run(), disabled: entries.length === 0 || send.busy, children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043D\u0430 \u0441\u043E\u0433\u043B\u0430\u0441\u043E\u0432\u0430\u043D\u0438\u0435" }) })] }));
}
function Metric({ value, label, tone }) {
    return (_jsxs("div", { children: [_jsx("div", { style: { fontSize: 20, fontWeight: 800, color: tone ?? color.ink, ...tabular }, children: value }), _jsx("div", { style: { fontSize: 12.5, color: color.muted }, children: label })] }));
}
/* ───────────────────────────── B6 · Статус ───────────────────────────── */
export function StatusScreen() {
    const params = useApp((s) => s.params);
    const go = useApp((s) => s.go);
    const me = useApp((s) => s.me);
    const formStartedAt = useApp((s) => s.formStartedAt);
    const formFinishedAt = useApp((s) => s.formFinishedAt);
    const { data: report } = useQuery(params.reportId ? `/report/${params.reportId}` : null);
    if (!report)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    const isMaster = me?.role === 'master';
    const elapsed = report.fillSeconds !== null
        ? formatElapsed(report.fillSeconds * 1000)
        : formStartedAt && formFinishedAt
            ? formatElapsed(formFinishedAt - formStartedAt)
            : null;
    const adjust = report.checks?.find((c) => c.decision === 'adjust');
    const ptoDone = report.status === 'accepted' || report.status === 'adjusted';
    const chain = [
        ...(isMaster
            ? [{ title: 'Мастер · ' + (report.authorName ?? ''), sub: `отправил в ${time(report.submittedAt)}`, done: true }]
            : []),
        {
            title: 'Прораб · ' + (isMaster ? 'Азамат Жумабеков' : (report.authorName ?? '')),
            sub: isMaster ? 'принимает отчёт мастера · передаёт в ПТО' : `отправил в ${time(report.submittedAt)}`,
            done: true,
        },
        {
            title: 'Инженер ПТО · Гульмира Садыкова',
            sub: ptoDone
                ? report.status === 'adjusted'
                    ? 'скорректировал и подтвердил'
                    : 'подтвердил'
                : 'проверяет · обычно до 21:00',
            done: ptoDone,
            current: !ptoDone,
        },
        { title: 'Главный инженер · Нурлан Ташиев', sub: 'после ПТО', done: false },
    ];
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: dateTitle(report.date), subtitle: report.submittedAt ? `отправлен в ${time(report.submittedAt)}` : 'черновик', onBack: () => go('today') }), elapsed ? (_jsxs("div", { style: {
                    margin: '4px 20px',
                    background: color.greenBg,
                    border: `1px solid ${color.greenBorder}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    fontSize: 14,
                    color: color.greenDeep,
                    fontWeight: 800,
                    ...tabular,
                }, children: ["\u23F1 \u0417\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u0438\u0435 \u0437\u0430\u043D\u044F\u043B\u043E ", elapsed, " \u2014 \u0446\u0435\u043B\u044C \u2264 5 \u043C\u0438\u043D\u0443\u0442"] })) : null, _jsxs("div", { style: {
                    margin: '8px 20px',
                    background: color.primaryBg,
                    border: `1px solid ${color.primaryBorder}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    fontSize: 13.5,
                    color: color.primaryDark,
                    fontWeight: 600,
                    lineHeight: 1.45,
                }, children: [isMaster ? '📤 Отчёт уходит прорабу, затем в ПТО' : '📤 Отчёт уходит в ПТО', " \u00B7 \u0434\u0430\u043D\u043D\u044B\u0435 \u0443\u0436\u0435 \u0432\u0438\u0434\u043D\u044B \u0440\u0443\u043A\u043E\u0432\u043E\u0434\u0441\u0442\u0432\u0443 \u0441\u043E \u0441\u0442\u0430\u0442\u0443\u0441\u043E\u043C \u00AB\u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D\u00BB"] }), _jsx(Card, { style: { margin: '8px 20px', padding: 20 }, children: _jsxs("div", { style: { display: 'flex', gap: 14 }, children: [_jsx("div", { style: { display: 'flex', flexDirection: 'column', alignItems: 'center' }, children: chain.map((node, i) => (_jsxs("div", { style: { display: 'contents' }, children: [_jsx("div", { style: {
                                            width: 36,
                                            height: 36,
                                            borderRadius: 18,
                                            background: node.done ? color.green : node.current ? color.primary : color.chip,
                                            color: node.done || node.current ? '#fff' : color.faint,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontWeight: 800,
                                            fontSize: 15,
                                            flex: 'none',
                                        }, children: node.done ? '✓' : node.current ? '●' : '•' }), i < chain.length - 1 ? (_jsx("div", { style: {
                                            width: 3,
                                            flex: 1,
                                            background: node.done ? color.green : color.track,
                                            minHeight: 26,
                                        } })) : null] }, node.title))) }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 2 }, children: chain.map((node) => (_jsxs("div", { children: [_jsx("div", { style: {
                                            fontSize: 15,
                                            fontWeight: 800,
                                            color: node.done || node.current ? color.ink : color.faint,
                                        }, children: node.title }), _jsx("div", { style: {
                                            fontSize: 13,
                                            color: node.current ? color.primary : node.done ? color.muted : color.faint,
                                            fontWeight: node.current ? 700 : 400,
                                        }, children: node.sub })] }, node.title))) })] }) }), adjust ? (_jsxs("div", { style: {
                    margin: '0 20px',
                    background: color.primaryBg,
                    border: `1px solid ${color.primaryBorder}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    fontSize: 13,
                    color: color.primaryDark,
                    fontWeight: 600,
                    lineHeight: 1.5,
                }, children: ["\u270E \u041F\u0422\u041E \u0441\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043B: ", adjust.adjustFrom, " \u2192 ", adjust.adjustTo, " \u00B7 \u00AB", adjust.comment, "\u00BB"] })) : null, _jsx("div", { style: { marginTop: 'auto', padding: '16px 20px 24px' }, children: _jsx(GhostButton, { onClick: () => go('today'), children: "\u0412\u0435\u0440\u043D\u0443\u0442\u044C\u0441\u044F \u043D\u0430 \u00AB\u0421\u0435\u0433\u043E\u0434\u043D\u044F\u00BB" }) })] }));
}
function time(iso) {
    if (!iso)
        return '—';
    return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
/* ───────────────────────────── B7 · Возвращён ───────────────────────────── */
export function ReturnedScreen() {
    const params = useApp((s) => s.params);
    const go = useApp((s) => s.go);
    const back = useApp((s) => s.back);
    const startTimer = useApp((s) => s.startTimer);
    const { data: report } = useQuery(params.reportId ? `/report/${params.reportId}` : null);
    if (!report)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    const disputed = new Set(report.returnedFields);
    const firstDisputed = report.entries.find((e) => disputed.has(e.id)) ?? report.entries[0];
    return (_jsxs(ScreenBody, { children: [_jsxs("div", { style: { padding: '14px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx("div", { onClick: back, style: {
                            cursor: 'pointer',
                            width: 40,
                            height: 40,
                            borderRadius: radius.sm,
                            background: color.surface,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 18,
                            color: color.ink,
                            boxShadow: '0 1px 4px rgba(20,22,31,0.08)',
                            flex: 'none',
                        }, children: "\u2039" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 17, fontWeight: 800, color: color.ink }, children: dateTitle(report.date) }), _jsx(Badge, { tone: "warn", style: { marginTop: 3, fontSize: 12.5 }, children: "\u21A9 \u0412\u043E\u0437\u0432\u0440\u0430\u0449\u0451\u043D \u041F\u0422\u041E" })] })] }), _jsxs(Card, { style: { margin: '8px 20px', padding: 18, border: `1.5px solid ${color.warnBorder}` }, children: [_jsxs("div", { style: { display: 'flex', gap: 12, alignItems: 'center' }, children: [_jsx("div", { style: {
                                    width: 40,
                                    height: 40,
                                    borderRadius: 20,
                                    background: color.chip,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 800,
                                    fontSize: 14,
                                    color: color.ink,
                                }, children: "\u0413\u0421" }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: color.ink }, children: "\u0413\u0443\u043B\u044C\u043C\u0438\u0440\u0430 \u0421\u0430\u0434\u044B\u043A\u043E\u0432\u0430 \u00B7 \u0438\u043D\u0436\u0435\u043D\u0435\u0440 \u041F\u0422\u041E" }), _jsx("div", { style: { fontSize: 12.5, color: color.muted }, children: "\u0432\u0447\u0435\u0440\u0430, 21:14" })] })] }), _jsxs("div", { style: { fontSize: 16, fontWeight: 600, color: color.ink, marginTop: 12, lineHeight: 1.5 }, children: ["\u00AB", report.returnComment, "\u00BB"] })] }), _jsx(SectionLabel, { style: { padding: '8px 20px 4px' }, children: "\u0421\u041F\u041E\u0420\u041D\u042B\u0415 \u041F\u041E\u041B\u042F" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }, children: report.entries.map((e) => {
                    const bad = disputed.has(e.id);
                    return (_jsxs(Card, { style: {
                            borderRadius: radius.card,
                            padding: '14px 16px',
                            ...(bad ? { border: `2px solid ${color.warnAccent}` } : { opacity: 0.75 }),
                        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }, children: e.title }), _jsx(Badge, { tone: bad ? 'warn' : 'green', children: bad ? '⚠ проверить' : '✓ без замечаний' })] }), _jsxs("div", { style: { fontSize: 14, color: color.inkMuted, marginTop: 6, ...tabular }, children: ["\u041E\u0431\u044A\u0451\u043C \u0437\u0430 \u0434\u0435\u043D\u044C:", ' ', _jsxs("span", { style: { fontWeight: 800, color: bad ? color.warnStrong : color.ink }, children: [formatNumber(e.volume, e.unit === 'т' ? 2 : 0), " ", e.unit] }), ' ', "\u00B7 ", e.workers, " \u0447\u0435\u043B \u00B7 ", e.photos.length, " \u0444\u043E\u0442\u043E"] })] }, e.id));
                }) }), _jsxs("div", { style: { marginTop: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx(PrimaryButton, { onClick: () => {
                            if (!firstDisputed)
                                return;
                            startTimer();
                            go('form', { processStateId: firstDisputed.processStateId });
                        }, children: "\u0418\u0441\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u043E\u0431\u044A\u0451\u043C \u2192" }), _jsx("div", { style: {
                            height: 48,
                            borderRadius: radius.md,
                            background: color.chip,
                            color: color.ink,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                            cursor: 'pointer',
                        }, children: "\u041E\u0441\u0442\u0430\u0432\u0438\u0442\u044C \u043A\u0430\u043A \u0435\u0441\u0442\u044C \u0438 \u043E\u0442\u0432\u0435\u0442\u0438\u0442\u044C" })] })] }));
}
