import { jsx as _jsx, Fragment as _Fragment, jsxs as _jsxs } from "react/jsx-runtime";
function svg(size, children, stroke, strokeWidth) {
    return (_jsx("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: stroke, strokeWidth: strokeWidth, strokeLinecap: "round", strokeLinejoin: "round", children: children }));
}
/** «Сегодня» — календарь с галочкой: день закрыт, когда отчёт отправлен. */
export function IconToday({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("rect", { x: "3", y: "5", width: "18", height: "16", rx: "2" }), _jsx("path", { d: "M3 9h18M8 3v4M16 3v4M9 14.5l2 2 4-4" })] }), color, strokeWidth);
}
/** «Работы» — этажи объекта, наложенные друг на друга. */
export function IconWorks({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("rect", { x: "4", y: "4", width: "16", height: "4.4", rx: "1" }), _jsx("rect", { x: "4", y: "10", width: "16", height: "4.4", rx: "1" }), _jsx("rect", { x: "4", y: "16", width: "16", height: "4.4", rx: "1" })] }), color, strokeWidth);
}
/** «Заявки» — короб поставки. */
export function IconZayavki({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M12 3l9 4.5v9L12 21l-9-4.5v-9L12 3z" }), _jsx("path", { d: "M3 7.5L12 12l9-4.5M12 12v9" })] }), color, strokeWidth);
}
export function IconMore({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return (_jsxs("svg", { width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: color, strokeWidth: strokeWidth, children: [_jsx("circle", { cx: "5", cy: "12", r: "1.6" }), _jsx("circle", { cx: "12", cy: "12", r: "1.6" }), _jsx("circle", { cx: "19", cy: "12", r: "1.6" })] }));
}
export function IconSearch({ size = 20, color = '#14161F', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("circle", { cx: "11", cy: "11", r: "7" }), _jsx("path", { d: "M20 20l-3.5-3.5" })] }), color, strokeWidth);
}
/** Кран — пустое состояние «пока не настроено». */
export function IconCrane({ size = 40, color = '#3D4FDE', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M4 21h7M7.5 21V6M3 6h18M17 6v4M7.5 11l5-5" }), _jsx("circle", { cx: "17", cy: "11.8", r: "1.5" })] }), color, strokeWidth);
}
/** Помощник — вызывается боковой вкладкой, не перекрывая основное действие. */
export function IconAssistant({ size = 22, color = '#fff', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("rect", { x: "4", y: "7", width: "16", height: "12", rx: "3" }), _jsx("path", { d: "M12 3v4M9 12.5h.01M15 12.5h.01M9.5 16h5" })] }), color, strokeWidth);
}
/** Каска — раздел «Подрядчики» и охрана труда. */
export function IconHelmet({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M3 17h18M4.5 17v-2a7.5 7.5 0 0 1 15 0v2" }), _jsx("path", { d: "M10 7.6V4.5h4v3.1" })] }), color, strokeWidth);
}
/** Документ с печатью — исполнительная документация. */
export function IconDoc({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M6 3h8l4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" }), _jsx("path", { d: "M14 3v4h4M8 12h6M8 16h4" })] }), color, strokeWidth);
}
/** Чертёж — раздел «Проект». */
export function IconDrawing({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("rect", { x: "3", y: "4", width: "18", height: "16", rx: "2" }), _jsx("path", { d: "M3 9h18M9 9v11M13 13h5M13 16.5h3" })] }), color, strokeWidth);
}
/** Экскаватор — раздел «Спецтехника». */
export function IconMachine({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M3 19h18" }), _jsx("rect", { x: "4", y: "13", width: "8", height: "4", rx: "1" }), _jsx("path", { d: "M12 13V9h4l4 4" }), _jsx("circle", { cx: "7", cy: "19", r: "1.6" }), _jsx("circle", { cx: "16", cy: "19", r: "1.6" })] }), color, strokeWidth);
}
/** Паллета — модуль «Материалы». */
export function IconPallet({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("rect", { x: "3", y: "15", width: "18", height: "4", rx: "1" }), _jsx("rect", { x: "6", y: "6", width: "12", height: "9", rx: "1" }), _jsx("path", { d: "M12 6v9" })] }), color, strokeWidth);
}
/** Диаграмма — сводка руководства. */
export function IconChart({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsx(_Fragment, { children: _jsx("path", { d: "M4 20V10M10 20V4M16 20v-7M22 20H2" }) }), color, strokeWidth);
}
/** Монета — финансы. */
export function IconMoney({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "8" }), _jsx("path", { d: "M12 7v10M9.5 9.5h3.2a2 2 0 1 1 0 4H9.5" })] }), color, strokeWidth);
}
/** Восклицание в круге — «Требует решения». */
export function IconAlert({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("circle", { cx: "12", cy: "12", r: "9" }), _jsx("path", { d: "M12 7.5v5M12 16.2h.01" })] }), color, strokeWidth);
}
/** Галочка в щите — качество и приёмка. */
export function IconQuality({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M12 3l7 3v6c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6l7-3z" }), _jsx("path", { d: "M8.8 12.2l2.2 2.2 4.2-4.4" })] }), color, strokeWidth);
}
/** Список с галочками — очередь проверки ПТО. */
export function IconQueue({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M9 6h11M9 12h11M9 18h11" }), _jsx("path", { d: "M4 5.5l1.2 1.2L7.4 4.5M4 11.5l1.2 1.2 2.2-2.2M4 17.5l1.2 1.2 2.2-2.2" })] }), color, strokeWidth);
}
/** Здание — объекты. */
export function IconBuilding({ size = 24, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M4 21V6l8-3 8 3v15" }), _jsx("path", { d: "M4 21h16M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10.5 21v-3h3v3" })] }), color, strokeWidth);
}
export function IconMic({ size = 20, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("rect", { x: "9", y: "3", width: "6", height: "11", rx: "3" }), _jsx("path", { d: "M5 11a7 7 0 0 0 14 0M12 18v3" })] }), color, strokeWidth);
}
export function IconCamera({ size = 20, color = 'currentColor', strokeWidth = 2 }) {
    return svg(size, _jsxs(_Fragment, { children: [_jsx("path", { d: "M3 8.5A1.5 1.5 0 0 1 4.5 7h2.2l1.2-2h8.2l1.2 2h2.2A1.5 1.5 0 0 1 21 8.5v9A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-9z" }), _jsx("circle", { cx: "12", cy: "12.6", r: "3.4" })] }), color, strokeWidth);
}
