import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * PR1–PR6 · Проект и DC1–DC5 · Документы.
 *
 * Прораб здесь потребитель, а не архивариус: главная функция — понять, по
 * действующему ли листу он работает, и какой документ держит работу.
 * Заменённый лист помечается явно, а не «просто лежит рядом».
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, Card, PrimaryButton, SectionLabel, tabular } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import { useApp } from '../../store/app';
/* ───────────────────────────── PR1 · Марки комплектов ───────────────────────────── */
export function ProjectScreen() {
    const go = useApp((s) => s.go);
    const { data } = useQuery('/project/sets');
    // Стадии разделяются обязательно: П, РД и ИД — разные документы с разной силой.
    const byStage = new Map();
    for (const set of data ?? []) {
        byStage.set(set.stage, [...(byStage.get(set.stage) ?? []), set]);
    }
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u041F\u0440\u043E\u0435\u043A\u0442", subtitle: "\u043A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u044B \u0440\u0430\u0431\u043E\u0447\u0435\u0439 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u0430\u0446\u0438\u0438" }), _jsx("div", { onClick: () => go('project-current'), style: {
                    cursor: 'pointer',
                    margin: '4px 20px 0',
                    background: color.primaryBg,
                    border: `1px solid ${color.primaryBorder}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: color.primaryDark,
                }, children: "\uD83D\uDCD0 \u0414\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u043B\u0438\u0441\u0442\u044B \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0430\u043A\u0442\u0443\u0430\u043B\u044C\u043D\u044B\u0435 \u0440\u0435\u0432\u0438\u0437\u0438\u0438 \u203A" }), _jsx("div", { style: { padding: '12px 20px 20px' }, children: [...byStage.entries()].map(([stage, sets]) => (_jsxs("div", { children: [_jsxs(SectionLabel, { style: { marginTop: 8, marginBottom: 6 }, children: ["\u0421\u0422\u0410\u0414\u0418\u042F ", stage, stage === 'РД' ? ' · рабочая документация' : stage === 'П' ? ' · проектная' : ' · исполнительная'] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8 }, children: sets.map((set) => (_jsxs(Card, { onClick: () => go('project-set', { setId: set.id }), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsxs("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: [set.mark, " \u00B7 ", set.name] }), _jsx("div", { style: { color: color.faint, fontSize: 16 }, children: "\u203A" })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }, children: [set.revision, " \u043E\u0442 ", new Date(set.issuedAt).toLocaleDateString('ru-RU'), " \u00B7 ", set.sheetCount, ' ', "\u043B\u0438\u0441\u0442\u043E\u0432"] }), set.supersededCount > 0 ? (_jsxs("div", { style: { fontSize: 12, fontWeight: 700, color: color.warnText, marginTop: 4 }, children: ["\uD83D\uDD34 \u0437\u0430\u043C\u0435\u043D\u0435\u043D\u043E \u043B\u0438\u0441\u0442\u043E\u0432: ", set.supersededCount] })) : null] }, set.id))) })] }, stage))) })] }));
}
/* ───────────────────────────── PR2 · Листы комплекта ───────────────────────────── */
export function ProjectSetScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const { data } = useQuery('/project/sets');
    const set = data?.find((s) => s.id === params.setId);
    if (!set)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: `${set.mark} · ${set.name}`, subtitle: `${set.revision} · ${set.sheetCount} листов`, onBack: back }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: set.sheets.map((sheet) => (_jsx(SheetRow, { sheet: sheet, onOpen: () => go('project-sheet', { sheetId: sheet.id }) }, sheet.id))) })] }));
}
export function CurrentSheetsScreen() {
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const { data } = useQuery('/project/current-sheets');
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0414\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u043B\u0438\u0441\u0442\u044B", subtitle: "\u043F\u043E \u043D\u0438\u043C \u043C\u043E\u0436\u043D\u043E \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u0441\u0435\u0433\u043E\u0434\u043D\u044F", onBack: back }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: (data ?? []).map((sheet) => (_jsx(SheetRow, { sheet: sheet, onOpen: () => go('project-sheet', { sheetId: sheet.id }) }, sheet.id))) })] }));
}
function SheetRow({ sheet, onOpen }) {
    return (_jsxs(Card, { onClick: onOpen, style: {
            borderRadius: radius.md,
            padding: '14px 16px',
            ...(sheet.isCurrent ? null : { border: `1.5px solid ${color.warnBorder}` }),
        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsxs("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: [sheet.mark ? `${sheet.mark}-` : '', sheet.number] }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 2 }, children: sheet.name })] }), _jsx(Badge, { tone: sheet.isCurrent ? 'green' : 'warn', style: { flexShrink: 0 }, children: sheet.isCurrent ? 'действующий' : 'заменён' })] }), _jsx("div", { style: { fontSize: 12, color: color.muted, marginTop: 5, ...tabular }, children: sheet.revision }), !sheet.isCurrent && sheet.supersededBy ? (_jsxs("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.danger, marginTop: 5 }, children: ["\uD83D\uDD34 \u0417\u0430\u043C\u0435\u043D\u0451\u043D \u043D\u0430 ", sheet.supersededBy, " \u2014 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u043F\u043E \u043D\u0435\u043C\u0443 \u043D\u0435\u043B\u044C\u0437\u044F"] })) : null, sheet.changeSummary && sheet.isCurrent ? (_jsxs("div", { style: { fontSize: 12, color: color.warnText, fontWeight: 700, marginTop: 5 }, children: ["\u270E ", sheet.changeSummary] })) : null] }));
}
/* ───────────────────────────── PR3 · Просмотр листа ───────────────────────────── */
export function SheetScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const { data: sheet } = useQuery(params.sheetId ? `/project/sheets/${params.sheetId}` : null);
    if (!sheet)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043B\u0438\u0441\u0442\u2026" });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: sheet.number, subtitle: sheet.name, onBack: back }), !sheet.isCurrent ? (_jsxs("div", { style: {
                    margin: '4px 20px',
                    background: color.warnBg,
                    border: `1px solid ${color.warnBorder}`,
                    borderRadius: radius.md,
                    padding: '12px 14px',
                    fontSize: 13,
                    fontWeight: 800,
                    color: color.warnText,
                    lineHeight: 1.45,
                }, children: ["\uD83D\uDD34 \u042D\u0442\u043E \u0441\u0442\u0430\u0440\u0430\u044F \u0432\u0435\u0440\u0441\u0438\u044F (", sheet.revision, ").", ' ', sheet.replacement ? `Действующий лист — ${sheet.replacement.number}, ${sheet.replacement.revision}.` : ''] })) : null, _jsxs("div", { style: {
                    margin: '8px 20px',
                    height: 300,
                    borderRadius: radius.md,
                    background: 'repeating-linear-gradient(45deg,#EEF0F6 0 12px,#F4F5F9 12px 24px)',
                    border: `1px solid ${color.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: color.faint,
                    fontSize: 13,
                }, children: ["\u041F\u0440\u043E\u0441\u043C\u043E\u0442\u0440 \u043B\u0438\u0441\u0442\u0430 \u00B7 ", sheet.revision] }), _jsxs(Card, { style: { margin: '0 20px' }, children: [_jsx("div", { style: { fontSize: 13, color: color.inkMuted, ...tabular }, children: sheet.revision }), sheet.changeSummary ? (_jsxs("div", { style: { fontSize: 12.5, color: color.warnText, fontWeight: 700, marginTop: 6 }, children: ["\u270E \u0427\u0442\u043E \u0438\u0437\u043C\u0435\u043D\u0438\u043B\u043E\u0441\u044C: ", sheet.changeSummary] })) : null, sheet.rfis.length > 0 ? (_jsxs("div", { style: { fontSize: 12.5, color: color.primary, fontWeight: 700, marginTop: 6 }, children: ["\uD83D\uDCD0 \u041F\u043E \u043B\u0438\u0441\u0442\u0443 \u0435\u0441\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441\u044B: ", sheet.rfis.map((r) => r.number).join(', ')] })) : null] }), _jsxs("div", { style: { marginTop: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }, children: [sheet.replacement ? (_jsx(PrimaryButton, { onClick: () => go('project-sheet', { sheetId: sheet.replacement.id }), children: "\u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0439 \u043B\u0438\u0441\u0442" })) : null, _jsx("div", { onClick: () => go('rfi', { sheetId: sheet.id }), style: {
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
                        }, children: "\u0417\u0430\u043F\u0440\u043E\u0441 \u043F\u0440\u043E\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0449\u0438\u043A\u0443" })] })] }));
}
/* ───────────────────────────── PR6 · RFI ───────────────────────────── */
export function RfiScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const me = useApp((s) => s.me);
    const [question, setQuestion] = useState('');
    const { data, reload } = useQuery('/rfi');
    const create = useAction(async () => {
        if (!me?.objectId)
            return;
        const res = await api.post('/rfi', {
            objectId: me.objectId,
            sheetId: params.sheetId,
            question,
            dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
        });
        notify(`${res.number} ушёл проектировщику · срок ответа 5 дней`);
        setQuestion('');
        reload();
    });
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0417\u0430\u043F\u0440\u043E\u0441\u044B \u043F\u0440\u043E\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0449\u0438\u043A\u0443", subtitle: "RFI", onBack: back }), _jsxs(Card, { style: { margin: '4px 20px' }, children: [_jsx(SectionLabel, { children: "\u041D\u041E\u0412\u042B\u0419 \u0417\u0410\u041F\u0420\u041E\u0421" }), _jsx("textarea", { value: question, onChange: (e) => setQuestion(e.target.value), placeholder: "\u041E\u043F\u0438\u0448\u0438\u0442\u0435 \u043A\u043E\u043B\u043B\u0438\u0437\u0438\u044E: \u043A\u0430\u043A\u0438\u0435 \u043B\u0438\u0441\u0442\u044B \u0440\u0430\u0441\u0445\u043E\u0434\u044F\u0442\u0441\u044F \u0438 \u0447\u0442\u043E \u043C\u0435\u0448\u0430\u0435\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C", rows: 4, style: {
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
                            resize: 'vertical',
                        } }), _jsx(PrimaryButton, { onClick: () => create.run(), disabled: question.trim().length < 10 || create.busy, style: { marginTop: 10, height: 50 }, children: "\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441" })] }), _jsx(SectionLabel, { style: { padding: '12px 20px 6px' }, children: "\u041E\u0422\u041A\u0420\u042B\u0422\u042B\u0415 \u0417\u0410\u041F\u0420\u041E\u0421\u042B" }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }, children: (data ?? []).map((r) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 14, fontWeight: 800, color: color.primary, ...tabular }, children: r.number }), _jsx(Badge, { tone: r.overdue ? 'warn' : r.status === 'answered' ? 'green' : 'neutral', children: r.overdue ? 'просрочен ответ' : r.status === 'answered' ? 'есть ответ' : 'ждём ответ' })] }), _jsx("div", { style: { fontSize: 13, color: color.ink, marginTop: 5, lineHeight: 1.45 }, children: r.question }), r.answer ? (_jsx("div", { style: {
                                marginTop: 8,
                                background: color.greenBg,
                                borderRadius: radius.xs,
                                padding: '9px 11px',
                                fontSize: 12.5,
                                color: color.greenDeep,
                                lineHeight: 1.45,
                            }, children: r.answer })) : null, _jsxs("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 6 }, children: [r.author, " \u00B7 ", new Date(r.createdAt).toLocaleDateString('ru-RU'), r.dueAt ? ` · ответ до ${new Date(r.dueAt).toLocaleDateString('ru-RU')}` : ''] })] }, r.id))) })] }));
}
/* ───────────────────────────── DC1 · Документы ───────────────────────────── */
export function DocumentsScreen() {
    const go = useApp((s) => s.go);
    const { data: docs } = useQuery('/documents');
    const { data: protocols } = useQuery('/strength-protocols');
    const acts = (docs ?? []).filter((d) => d.kind === 'aosr');
    const pending = acts.filter((d) => d.status !== 'signed');
    const blocking = (protocols ?? []).filter((p) => p.blocksStripping);
    return (_jsxs(ScreenBody, { children: [_jsx(RootHeader, { title: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B", subtitle: "\u0442\u043E, \u0447\u0442\u043E \u0434\u0435\u0440\u0436\u0438\u0442 \u0438\u043B\u0438 \u043E\u0442\u043A\u0440\u044B\u0432\u0430\u0435\u0442 \u0440\u0430\u0431\u043E\u0442\u0443" }), _jsxs("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }, children: [_jsxs(Card, { onClick: () => go('documents-acts'), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: "\u041C\u043E\u0438 \u0430\u043A\u0442\u044B" }), _jsx(Badge, { tone: pending.length > 0 ? 'warn' : 'green', children: pending.length > 0 ? `${pending.length} не подписано` : 'все подписаны' })] }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: ["\u0410\u041E\u0421\u0420 \u043F\u043E \u0432\u0430\u0448\u0438\u043C \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0430\u043C \u00B7 \u0432\u0441\u0435\u0433\u043E ", acts.length] })] }), _jsxs(Card, { onClick: () => go('documents-strength'), style: {
                            borderRadius: radius.md,
                            padding: '14px 16px',
                            ...(blocking.length > 0 ? { border: `1.5px solid ${color.warnBorder}` } : null),
                        }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: "\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u044B \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u0438" }), _jsx(Badge, { tone: blocking.length > 0 ? 'warn' : 'green', children: blocking.length > 0 ? `${blocking.length} держит распалубку` : 'нет ограничений' })] }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: "\u041F\u043E\u043A\u0430 \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u043D\u0430\u0431\u0440\u0430\u043D\u0430, \u0440\u0430\u0441\u043F\u0430\u043B\u0443\u0431\u043A\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0430" })] }), _jsxs(Card, { onClick: () => go('documents-object'), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u043E\u0431\u044A\u0435\u043A\u0442\u0430" }), _jsxs("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: ["\u0416\u0443\u0440\u043D\u0430\u043B\u044B, \u043F\u0430\u0441\u043F\u043E\u0440\u0442\u0430, \u043E\u0431\u0449\u0438\u0435 \u0434\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u00B7 ", docs?.length ?? 0] })] }), _jsxs(Card, { onClick: () => go('project'), style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: "\u041F\u0440\u043E\u0435\u043A\u0442" }), _jsx("div", { style: { fontSize: 12.5, color: color.muted, marginTop: 3 }, children: "\u041A\u043E\u043C\u043F\u043B\u0435\u043A\u0442\u044B, \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u044E\u0449\u0438\u0435 \u043B\u0438\u0441\u0442\u044B, \u0437\u0430\u043F\u0440\u043E\u0441\u044B \u043F\u0440\u043E\u0435\u043A\u0442\u0438\u0440\u043E\u0432\u0449\u0438\u043A\u0443" })] })] })] }));
}
export function ActsScreen() {
    const back = useApp((s) => s.back);
    const { data } = useQuery('/documents?kind=aosr');
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041C\u043E\u0438 \u0430\u043A\u0442\u044B", subtitle: "\u0410\u041E\u0421\u0420 \u043F\u043E \u0432\u0430\u0448\u0438\u043C \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0430\u043C", onBack: back }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: (data ?? []).map((d) => (_jsxs(Card, { style: { borderRadius: radius.md, padding: '14px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink, ...tabular }, children: d.number }), _jsx(Badge, { tone: d.status === 'signed' ? 'green' : d.status === 'pending' ? 'primary' : 'warn', children: d.status === 'signed' ? 'подписан' : d.status === 'pending' ? 'на подписи' : 'черновик' })] }), _jsx("div", { style: { fontSize: 13, color: color.inkMuted, marginTop: 4 }, children: d.name }), d.signedAt ? (_jsxs("div", { style: { fontSize: 11.5, color: color.faint, marginTop: 4 }, children: ["\u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D ", new Date(d.signedAt).toLocaleDateString('ru-RU')] })) : null] }, d.id))) })] }));
}
/** DC4 · Протокол прочности — шлюз распалубки. */
export function StrengthScreen() {
    const back = useApp((s) => s.back);
    const { data } = useQuery('/strength-protocols');
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u041F\u0440\u043E\u0442\u043E\u043A\u043E\u043B\u044B \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u0438", subtitle: "\u0431\u0435\u0442\u043E\u043D \u00B7 \u043B\u0430\u0431\u043E\u0440\u0430\u0442\u043E\u0440\u0438\u044F", onBack: back }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }, children: (data ?? []).map((p) => (_jsxs(Card, { style: {
                        borderRadius: radius.md,
                        padding: '14px 16px',
                        ...(p.blocksStripping ? { border: `1.5px solid ${color.warnBorder}` } : null),
                    }, children: [_jsx("div", { style: { fontSize: 15, fontWeight: 800, color: color.ink }, children: p.process }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }, children: [_jsxs("div", { style: {
                                        fontSize: 30,
                                        fontWeight: 800,
                                        color: p.status === 'passed' ? color.greenDeep : color.warnStrong,
                                        ...tabular,
                                    }, children: [p.strengthPct, "%"] }), _jsxs("div", { style: { fontSize: 14, color: color.muted, ...tabular }, children: ["\u0438\u0437 \u0442\u0440\u0435\u0431\u0443\u0435\u043C\u044B\u0445 ", p.requiredPct, "%"] })] }), _jsx("div", { style: { height: 8, borderRadius: 4, background: color.track, marginTop: 8 }, children: _jsx("div", { style: {
                                    width: `${Math.min(100, (p.strengthPct / p.requiredPct) * 100)}%`,
                                    height: 8,
                                    borderRadius: 4,
                                    background: p.status === 'passed' ? color.green : color.warnAccent,
                                } }) }), _jsxs("div", { style: { fontSize: 12, color: color.muted, marginTop: 8, ...tabular }, children: ["\u0437\u0430\u043B\u0438\u0442\u043E ", new Date(p.pouredAt).toLocaleDateString('ru-RU'), " \u00B7 \u043F\u0440\u043E\u0431\u0430", ' ', new Date(p.sampleAt).toLocaleDateString('ru-RU'), " \u00B7 ", p.labName] }), p.blocksStripping ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.warnText, marginTop: 6, lineHeight: 1.45 }, children: "\u26D4 \u0420\u0430\u0441\u043F\u0430\u043B\u0443\u0431\u043A\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0430, \u043F\u043E\u043A\u0430 \u043F\u0440\u043E\u0447\u043D\u043E\u0441\u0442\u044C \u043D\u0435 \u043D\u0430\u0431\u0440\u0430\u043D\u0430" })) : null] }, p.id))) })] }));
}
export function ObjectDocumentsScreen() {
    const back = useApp((s) => s.back);
    const { data } = useQuery('/documents');
    const byKind = new Map();
    for (const d of data ?? [])
        byKind.set(d.kind, [...(byKind.get(d.kind) ?? []), d]);
    const KIND_LABEL = {
        aosr: 'Акты освидетельствования',
        aook: 'Акты ответственных конструкций',
        concreteStrength: 'Протоколы прочности',
        passport: 'Паспорта и сертификаты',
        journal: 'Журналы',
        other: 'Прочее',
    };
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: "\u0414\u043E\u043A\u0443\u043C\u0435\u043D\u0442\u044B \u043E\u0431\u044A\u0435\u043A\u0442\u0430", onBack: back }), _jsx("div", { style: { padding: '4px 20px 20px' }, children: [...byKind.entries()].map(([kind, docs]) => (_jsxs("div", { children: [_jsxs(SectionLabel, { style: { marginTop: 10, marginBottom: 6 }, children: [(KIND_LABEL[kind] ?? kind).toUpperCase(), " \u00B7 ", docs.length] }), _jsx("div", { style: { display: 'flex', flexDirection: 'column', gap: 6 }, children: docs.map((d) => (_jsxs("div", { style: {
                                    background: color.surface,
                                    borderRadius: radius.sm,
                                    padding: '11px 14px',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: 8,
                                    boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                                }, children: [_jsxs("div", { style: { minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 13.5, fontWeight: 700, color: color.ink, ...tabular }, children: d.number }), _jsx("div", { style: { fontSize: 12, color: color.muted }, children: d.name })] }), _jsx(Badge, { tone: d.status === 'signed' ? 'green' : 'neutral', style: { flexShrink: 0 }, children: d.status === 'signed' ? '✓' : d.status })] }, d.id))) })] }, kind))) })] }));
}
