import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * B4 · Форма ввода объёма.
 *
 * Цель — 2 тапа вместо 30 минут в WhatsApp, поэтому: клавиатура своя (не
 * системная), единица измерения берётся из процесса, «как вчера» подставляет
 * прошлый объём, а пересчёт процента виден до сохранения. Сохранение
 * блокируется тем, что нельзя восстановить задним числом: фото и зимним
 * методом при морозе.
 */
import { useEffect, useMemo, useState } from 'react';
import { color, radius, shadow } from '../../design/tokens';
import { Card, Chip, ProgressBar, Stepper, formatNumber, formatPct, tabular } from '../../design/primitives';
import { BackButton } from '../../design/primitives';
import { useQuery, useAction } from '../../api/hooks';
import { api } from '../../api/client';
import { formatElapsed, useApp } from '../../store/app';
import { ScreenBody } from '../../shell/PhoneFrame';
/** Ниже +5 °C метод зимнего бетонирования обязателен — это правило ППР, не подсказка. */
const WINTER_TEMP = 5;
const WINTER_METHODS = [
    'Термос',
    'Противоморозные добавки',
    'Электропрогрев',
    'Греющая опалубка',
    'Тепляк',
];
const PROBLEM_CHIPS = [
    'Нехватка материала',
    'Нет техники',
    'Погода',
    'Нет фронта работ',
    'Отсутствие людей',
    'Замечание по качеству',
];
/** Разделы, где температура смеси замеряется обязательно. */
function needsMixTemp(sectionName) {
    return sectionName === 'Монолит' || sectionName === 'Кладка' || sectionName === 'Стяжка';
}
export function FormScreen() {
    const params = useApp((s) => s.params);
    const go = useApp((s) => s.go);
    const back = useApp((s) => s.back);
    const notify = useApp((s) => s.notify);
    const formStartedAt = useApp((s) => s.formStartedAt);
    const { data: process } = useQuery(params.processStateId ? `/process/${params.processStateId}` : null);
    const [volume, setVolume] = useState('');
    const [workers, setWorkers] = useState(12);
    const [photos, setPhotos] = useState([]);
    const [problems, setProblems] = useState([]);
    const [tempAir, setTempAir] = useState('21');
    const [tempMix, setTempMix] = useState('');
    const [winterMethod, setWinterMethod] = useState(null);
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        const id = setInterval(() => setElapsed(formStartedAt ? Date.now() - formStartedAt : 0), 1000);
        return () => clearInterval(id);
    }, [formStartedAt]);
    const save = useAction(async (andNext) => {
        if (!process)
            return;
        const result = await api.post('/report/entry', {
            date: new Date().toISOString(),
            entry: {
                processStateId: process.id,
                volume: parsedVolume,
                unit: process.unit,
                workers,
                problems,
                tempAir: air,
                tempMix: tempMix ? Number(tempMix.replace(',', '.')) : undefined,
                winterMethod: winterMethod ?? undefined,
                photos,
            },
        });
        notify(`Сохранено · ${process.name}`);
        if (andNext)
            go('today');
        else
            go('preview', { reportId: result.reportId });
    });
    const parsedVolume = Number(volume.replace(',', '.')) || 0;
    const air = tempAir ? Number(tempAir.replace(',', '.')) : undefined;
    const cold = air !== undefined && air < WINTER_TEMP;
    const hot = air !== undefined && air > 30;
    const remaining = process ? Math.max(0, process.planQty - process.doneQty) : 0;
    const overPlan = process ? parsedVolume > remaining && remaining > 0 : false;
    const newPct = process && process.planQty > 0 ? ((process.doneQty + parsedVolume) / process.planQty) * 100 : 0;
    /** Что мешает сохранить — пишем текстом, а не гасим кнопку молча. */
    const blocker = useMemo(() => {
        if (!parsedVolume)
            return 'Введите объём за сегодня';
        if (photos.length === 0)
            return 'Минимум 1 фото — обязательно';
        if (cold && !winterMethod)
            return `При ${tempAir} °C укажите применённый метод`;
        return null;
    }, [parsedVolume, photos.length, cold, winterMethod, tempAir]);
    if (!process) {
        return _jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u2026" });
    }
    function press(key) {
        if (key === '⌫')
            setVolume((v) => v.slice(0, -1));
        else if (key === 'C')
            setVolume('');
        else if (volume.replace(/\D/g, '').length < 6)
            setVolume((v) => v + key);
    }
    function addPhoto() {
        // В приложении здесь камера; геометка и время — то, что подделать сложнее подписи.
        setPhotos((p) => [
            ...p,
            {
                url: `photo-${p.length + 1}.jpg`,
                takenAt: new Date().toISOString(),
                lat: 42.8746,
                lon: 74.5698,
            },
        ]);
    }
    return (_jsxs(ScreenBody, { children: [_jsxs("div", { style: { padding: '12px 20px 8px', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }, children: [_jsx(BackButton, { onClick: back }), _jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 17, fontWeight: 800, color: color.ink }, children: process.name }), _jsxs("div", { style: { fontSize: 13, color: color.muted }, children: [process.sectionName, " \u00B7 ", process.blockName, " \u00B7 ", process.floor, " \u044D\u0442."] })] }), _jsxs("div", { style: {
                            fontSize: 12,
                            fontWeight: 800,
                            color: '#fff',
                            background: color.ink,
                            borderRadius: radius.xxs,
                            padding: '5px 10px',
                            ...tabular,
                        }, children: ["\u23F1 ", formatElapsed(elapsed)] })] }), _jsxs("div", { style: {
                    margin: '2px 20px',
                    background: color.surface,
                    borderRadius: radius.lg,
                    padding: '14px 18px',
                    boxShadow: `0 0 0 2px ${color.primary}`,
                }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.muted }, children: "\u041E\u0411\u042A\u0401\u041C \u0417\u0410 \u0421\u0415\u0413\u041E\u0414\u041D\u042F" }), _jsxs("div", { style: { display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }, children: [_jsxs("div", { style: { fontSize: 40, fontWeight: 800, color: color.ink, minHeight: 52, ...tabular }, children: [volume || '0', _jsx("span", { style: {
                                            display: 'inline-block',
                                            width: 2,
                                            height: 32,
                                            background: color.primary,
                                            marginLeft: 2,
                                            verticalAlign: -3,
                                        } })] }), _jsx("div", { style: { fontSize: 19, fontWeight: 700, color: color.muted }, children: process.unit })] }), _jsxs("div", { style: { marginTop: 6, background: color.primaryBgSoft, borderRadius: radius.smAlt, padding: '8px 12px' }, children: [_jsxs("div", { style: { fontSize: 13.5, fontWeight: 700, color: color.ink, ...tabular }, children: ["\u0441\u0442\u0430\u043D\u0435\u0442 ", formatNumber(process.doneQty + parsedVolume, process.unit === 'т' ? 2 : 0), " \u0438\u0437", ' ', formatNumber(process.planQty, process.unit === 'т' ? 1 : 0), " ", process.unit] }), _jsxs("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.green, ...tabular }, children: [formatPct(process.pct), " \u2192 ", formatPct(newPct)] }), _jsx("div", { style: { display: 'flex', marginTop: 6 }, children: _jsx(ProgressBar, { pct: newPct, height: 7 }) })] }), overPlan ? (_jsxs("div", { style: {
                            marginTop: 6,
                            background: color.warnBg,
                            border: `1px solid ${color.warnBorder}`,
                            borderRadius: radius.xxs,
                            padding: '7px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            color: color.warnText,
                        }, children: ["\u26A0 \u0411\u043E\u043B\u044C\u0448\u0435, \u0447\u0435\u043C \u043E\u0441\u0442\u0430\u043B\u043E\u0441\u044C \u043F\u043E \u043F\u043B\u0430\u043D\u0443 (", formatNumber(remaining, 1), " ", process.unit, "). \u041F\u0440\u043E\u0432\u0435\u0440\u044C\u0442\u0435"] })) : null, process.history.length > 0 ? (_jsxs("div", { onClick: () => setVolume(String(process.history[0].volume).replace('.', ',')), style: {
                            cursor: 'pointer',
                            display: 'inline-flex',
                            marginTop: 8,
                            background: color.chip,
                            borderRadius: radius.xs,
                            padding: '7px 12px',
                            fontSize: 12.5,
                            fontWeight: 700,
                            color: color.primary,
                        }, children: ["\u21BA \u041A\u0430\u043A \u0432\u0447\u0435\u0440\u0430 \u00B7 ", formatNumber(process.history[0].volume, 2), " ", process.unit] })) : null] }), _jsxs(Card, { style: { margin: '8px 20px 0', borderRadius: radius.card, padding: '13px 16px' }, children: [_jsxs("div", { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.muted }, children: "\u0422\u0415\u041C\u041F\u0415\u0420\u0410\u0422\u0423\u0420\u0410" }), _jsx("div", { style: { fontSize: 10.5, color: color.faint }, children: "\u043F\u043E\u0440\u043E\u0433\u0438 \u2014 \u0438\u0437 \u041F\u041F\u0420, \u0437\u0430\u0432\u043E\u0434\u0438\u0442 \u041F\u0422\u041E" })] }), _jsx(TempRow, { label: "\u0412\u043E\u0437\u0434\u0443\u0445", value: tempAir, onChange: setTempAir, note: "\uD83C\uDF21 \u0438\u0437 \u043F\u043E\u0433\u043E\u0434\u044B, \u0438\u0441\u043F\u0440\u0430\u0432\u0438\u043C\u043E", noteColor: color.primary }), needsMixTemp(process.sectionName) ? (_jsx(TempRow, { label: process.sectionName === 'Монолит' ? 'Смесь' : 'Раствор', value: tempMix, onChange: setTempMix, note: "\u0437\u0430\u043C\u0435\u0440 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D", noteColor: color.warnText })) : null, cold ? (_jsxs("div", { style: {
                            marginTop: 9,
                            background: color.warnBg,
                            border: `1px solid ${color.warnBorderAlt}`,
                            borderRadius: radius.smAlt,
                            padding: '10px 12px',
                        }, children: [_jsxs("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.warnText, ...tabular }, children: [tempAir, " \u00B0C \u2014 \u043D\u0438\u0436\u0435 +5 \u00B0C, \u043E\u0431\u044B\u0447\u043D\u043E\u0435 \u0431\u0435\u0442\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u043D\u0435 \u0434\u043E\u043F\u0443\u0441\u043A\u0430\u0435\u0442\u0441\u044F"] }), _jsx("div", { style: { fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 6 }, children: "\u041F\u0440\u0438\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0439 \u043C\u0435\u0442\u043E\u0434 \u2014 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E:" }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }, children: WINTER_METHODS.map((m) => (_jsx(Chip, { active: winterMethod === m, onClick: () => setWinterMethod(m), style: { fontSize: 12, padding: '6px 10px' }, children: m }, m))) })] })) : null, hot ? (_jsxs("div", { style: {
                            marginTop: 9,
                            background: color.warnBg,
                            border: `1px solid ${color.warnBorderAlt}`,
                            borderRadius: radius.smAlt,
                            padding: '10px 12px',
                            fontSize: 12.5,
                            fontWeight: 800,
                            color: color.warnText,
                            ...tabular,
                        }, children: [tempAir, " \u00B0C \u2014 \u0436\u0430\u0440\u0430, \u043D\u0443\u0436\u0435\u043D \u0443\u0445\u043E\u0434 \u0437\u0430 \u0431\u0435\u0442\u043E\u043D\u043E\u043C \u0438 \u0437\u0430\u0449\u0438\u0442\u0430 \u043E\u0442 \u0438\u0441\u043F\u0430\u0440\u0435\u043D\u0438\u044F"] })) : null] }), _jsxs(Card, { style: {
                    margin: '8px 20px 0',
                    borderRadius: radius.card,
                    padding: '10px 16px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.muted }, children: "\u0420\u0410\u0411\u041E\u0427\u0418\u0415" }), _jsx(Stepper, { value: workers, onChange: setWorkers })] }), _jsxs("div", { style: { display: 'flex', gap: 8, padding: '8px 20px', alignItems: 'center', flexWrap: 'wrap' }, children: [_jsxs("div", { onClick: addPhoto, style: {
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
                        }, children: [_jsx("div", { style: { fontSize: 19 }, children: "\u25C9" }), _jsx("div", { style: { fontSize: 10, fontWeight: 700 }, children: "\u0424\u043E\u0442\u043E" })] }), photos.map((p, i) => (_jsx("div", { style: {
                            width: 64,
                            height: 64,
                            borderRadius: radius.sm,
                            flex: 'none',
                            position: 'relative',
                            background: 'repeating-linear-gradient(45deg,#D8DAE3 0 8px,#E7E9F0 8px 16px)',
                        }, children: _jsxs("div", { style: {
                                position: 'absolute',
                                bottom: 4,
                                left: 4,
                                background: 'rgba(20,22,31,0.75)',
                                color: '#fff',
                                fontSize: 8.5,
                                fontWeight: 700,
                                borderRadius: 6,
                                padding: '1px 5px',
                            }, children: ["\uD83D\uDCCD ", new Date(p.takenAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })] }) }, p.url))), photos.length === 0 ? (_jsxs("div", { style: { fontSize: 11.5, color: color.warnText, fontWeight: 700, lineHeight: 1.4 }, children: ["\u043C\u0438\u043D. 1 \u0444\u043E\u0442\u043E \u2014", _jsx("br", {}), "\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E"] })) : null] }), _jsx("div", { style: { display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 20px 4px' }, children: PROBLEM_CHIPS.map((p) => (_jsx(Chip, { tone: "dark", active: problems.includes(p), onClick: () => setProblems((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p])), style: { fontSize: 12, padding: '7px 11px' }, children: p }, p))) }), _jsxs("div", { style: {
                    marginTop: 'auto',
                    background: color.surface,
                    borderTop: `1px solid ${color.track}`,
                    padding: '10px 16px 6px',
                    flex: 'none',
                }, children: [_jsx("div", { style: { display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }, children: ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (_jsx("div", { onClick: () => press(k), style: {
                                cursor: 'pointer',
                                height: 46,
                                borderRadius: radius.smAlt,
                                background: color.screen,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 20,
                                fontWeight: 800,
                                color: color.ink,
                            }, children: k }, k))) }), blocker ? (_jsx("div", { style: { marginTop: 8, fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center' }, children: blocker })) : null, save.error ? (_jsx("div", { style: { marginTop: 8, fontSize: 12, fontWeight: 800, color: color.danger, textAlign: 'center' }, children: save.error })) : null, _jsxs("div", { style: { display: 'flex', gap: 8, padding: '10px 0 14px' }, children: [_jsx("div", { onClick: () => !blocker && !save.busy && save.run(true), style: {
                                    cursor: blocker ? 'default' : 'pointer',
                                    flex: 1,
                                    height: 50,
                                    borderRadius: radius.mdAlt,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 14.5,
                                    fontWeight: 800,
                                    background: blocker ? color.disabled : color.chip,
                                    color: blocker ? '#fff' : color.ink,
                                }, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C" }), _jsx("div", { onClick: () => !blocker && !save.busy && save.run(false), style: {
                                    cursor: blocker ? 'default' : 'pointer',
                                    flex: 1.1,
                                    height: 50,
                                    borderRadius: radius.mdAlt,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 14.5,
                                    fontWeight: 800,
                                    background: blocker ? color.disabled : color.primary,
                                    color: '#fff',
                                    boxShadow: blocker ? 'none' : shadow.primary,
                                }, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u0438 \u0434\u0430\u043B\u0435\u0435" })] })] })] }));
}
function TempRow({ label, value, onChange, note, noteColor, }) {
    return (_jsxs("div", { style: { display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }, children: [_jsx("div", { style: { flex: 1, fontSize: 13, color: color.ink }, children: label }), _jsx("input", { value: value, onChange: (e) => onChange(e.target.value), style: {
                    width: 72,
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    background: color.screen,
                    borderRadius: radius.xs,
                    padding: '10px 12px',
                    fontSize: 15,
                    fontWeight: 800,
                    color: color.ink,
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    fontVariantNumeric: 'tabular-nums',
                } }), _jsx("div", { style: { fontSize: 13, fontWeight: 700, color: color.ink, width: 22 }, children: "\u00B0C" }), _jsx("div", { style: { fontSize: 10.5, color: noteColor, fontWeight: 700, width: 74, lineHeight: 1.3 }, children: note })] }));
}
