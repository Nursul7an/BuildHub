import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * A3 · Цепочка процессов раздела.
 *
 * Ключевой экран: он объясняет, что кого держит. Заблокированный процесс
 * показывает причину прямо в строке — прораб должен понимать, что именно его
 * останавливает, не открывая диалог. Замок 🔒 — предупреждение «по завершении
 * нужен АОСР», а не блокировка.
 */
import { color, radius } from '../../design/tokens';
import { Badge, formatNumber, formatPct, tabular } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useQuery } from '../../api/hooks';
import { useApp } from '../../store/app';
const STATUS_STYLE = {
    idle: { dot: color.faint, background: color.surface, opacity: 0.72 },
    active: { dot: color.primary, background: color.surface, border: color.primary },
    presented: { dot: '#8B5CF6', background: '#F4F0FF', border: '#C9B8F7' },
    accepted: { dot: color.green, background: color.greenBg },
    blocked: { dot: color.faint, background: color.chip },
};
export function ChainScreen() {
    const params = useApp((s) => s.params);
    const back = useApp((s) => s.back);
    const go = useApp((s) => s.go);
    const path = params.sectionId && params.blockId && params.floor !== undefined
        ? `/chain?sectionId=${params.sectionId}&blockId=${params.blockId}&floor=${params.floor}`
        : null;
    const { data } = useQuery(path);
    if (!data)
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u0446\u0435\u043F\u043E\u0447\u043A\u0443\u2026" });
    let lastSubcycle;
    return (_jsxs(ScreenBody, { children: [_jsx(ScreenHeader, { title: data.section.name, subtitle: `${data.processCount} процессов · ${data.actsCount} актов`, onBack: back }), data.section.entryCondition ? (_jsx("div", { style: {
                    margin: '4px 20px 0',
                    background: color.primaryBg,
                    border: `1px solid ${color.primaryBorder}`,
                    borderRadius: radius.smAlt,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    color: color.primaryDark,
                    fontWeight: 600,
                    lineHeight: 1.45,
                }, children: data.section.entryCondition })) : null, data.section.blockReason ? (_jsx("div", { style: {
                    margin: '8px 20px 0',
                    background: color.warnBg,
                    border: `1px solid ${color.warnBorder}`,
                    borderRadius: radius.smAlt,
                    padding: '10px 12px',
                    fontSize: 12.5,
                    color: color.warnText,
                    fontWeight: 800,
                    lineHeight: 1.45,
                }, children: data.section.blockReason })) : null, _jsx("div", { style: { padding: '10px 20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }, children: data.rows.map((row, i) => {
                    const style = STATUS_STYLE[row.status];
                    const showSubcycle = row.subcycle && row.subcycle !== lastSubcycle;
                    lastSubcycle = row.subcycle;
                    const pct = row.planQty > 0 ? (row.doneQty / row.planQty) * 100 : 0;
                    return (_jsxs("div", { style: { display: 'contents' }, children: [showSubcycle ? (_jsx("div", { style: {
                                    fontSize: 12,
                                    fontWeight: 800,
                                    letterSpacing: '0.06em',
                                    color: color.muted,
                                    marginTop: i === 0 ? 0 : 10,
                                    marginBottom: 2,
                                }, children: row.subcycle?.toUpperCase() })) : null, _jsxs("div", { onClick: row.processStateId ? () => go('process', { processStateId: row.processStateId }) : undefined, style: {
                                    cursor: row.processStateId ? 'pointer' : 'default',
                                    display: 'flex',
                                    gap: 10,
                                    alignItems: 'flex-start',
                                    padding: '10px 12px',
                                    borderRadius: radius.smAlt,
                                    background: style.background,
                                    opacity: style.opacity,
                                    ...(style.border ? { border: `1.5px solid ${style.border}` } : null),
                                }, children: [_jsxs("div", { style: {
                                            width: 22,
                                            fontSize: 11.5,
                                            fontWeight: 800,
                                            color: color.faint,
                                            flexShrink: 0,
                                            paddingTop: 2,
                                            ...tabular,
                                        }, children: [row.order, "."] }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsxs("div", { style: { fontSize: 13.5, fontWeight: 700, color: color.ink, lineHeight: 1.35 }, children: [row.name, row.requiresAosr ? _jsx("span", { title: "\u043F\u043E \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0438\u0438 \u0442\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0410\u041E\u0421\u0420", children: " \uD83D\uDD12" }) : null] }), row.status === 'accepted' ? (_jsxs("div", { style: { fontSize: 12, color: color.greenDeep, fontWeight: 700, marginTop: 2 }, children: ["\u043F\u0440\u0438\u043D\u044F\u0442", row.aosrNumber ? ` · ${row.aosrNumber}` : '', row.acceptedAt ? ` · ${new Date(row.acceptedAt).toLocaleDateString('ru-RU')}` : ''] })) : row.status === 'presented' ? (_jsxs("div", { style: { fontSize: 12, color: '#6D28D9', fontWeight: 700, marginTop: 2 }, children: ["\u0436\u0434\u0451\u043C \u0442\u0435\u0445\u043D\u0430\u0434\u0437\u043E\u0440 \u00B7 \u0434\u0435\u043D\u044C ", daysSince(row.presentedAt), " \u0438\u0437 ", row.presentedOfDays ?? 3] })) : row.status === 'blocked' ? (_jsx("div", { style: { fontSize: 12, color: color.danger, fontWeight: 700, marginTop: 2, lineHeight: 1.4 }, children: row.blockedReason })) : row.status === 'active' ? (_jsxs("div", { style: { fontSize: 12, color: color.primary, fontWeight: 700, marginTop: 2, ...tabular }, children: [formatNumber(row.doneQty, row.unit === 'т' ? 2 : 0), " \u0438\u0437", ' ', formatNumber(row.planQty, row.unit === 'т' ? 1 : 0), " ", row.unit, " \u00B7 ", formatPct(pct)] })) : (_jsxs("div", { style: { fontSize: 12, color: color.faint, marginTop: 2 }, children: ["\u043D\u0435 \u043D\u0430\u0447\u0430\u0442", row.unit !== '—' ? ` · ${row.unit}` : ''] })), row.status === 'active' ? (_jsx("div", { style: { height: 5, borderRadius: 3, background: color.track, marginTop: 6 }, children: _jsx("div", { style: {
                                                        width: `${Math.min(100, pct)}%`,
                                                        height: 5,
                                                        borderRadius: 3,
                                                        background: color.primary,
                                                    } }) })) : null] }), _jsx("div", { style: {
                                            width: 10,
                                            height: 10,
                                            borderRadius: 5,
                                            background: style.dot,
                                            flexShrink: 0,
                                            marginTop: 4,
                                        } })] })] }, row.processDefId));
                }) })] }));
}
function daysSince(iso) {
    if (!iso)
        return 1;
    return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) + 1);
}
export { Badge };
