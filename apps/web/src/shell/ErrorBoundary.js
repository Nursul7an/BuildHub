import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * Экран не должен уносить всё приложение. На объекте белый экран означает,
 * что отчёт не сдан вовсе, поэтому падение локализуется до одного экрана,
 * а пользователю остаётся путь назад.
 */
import { Component } from 'react';
import { color, radius } from '../design/tokens';
export class ErrorBoundary extends Component {
    state = { error: null };
    static getDerivedStateFromError(error) {
        return { error };
    }
    componentDidUpdate(previous) {
        if (previous.resetKey !== this.props.resetKey && this.state.error) {
            this.setState({ error: null });
        }
    }
    componentDidCatch(error, info) {
        console.error('Экран упал:', error, info.componentStack);
    }
    render() {
        if (!this.state.error)
            return this.props.children;
        return (_jsxs("div", { style: { flex: 1, padding: 24, display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx("div", { style: { fontSize: 17, fontWeight: 800, color: color.ink }, children: "\u042D\u043A\u0440\u0430\u043D \u043D\u0435 \u043E\u0442\u043A\u0440\u044B\u043B\u0441\u044F" }), _jsx("div", { style: { fontSize: 13.5, color: color.muted, lineHeight: 1.5 }, children: "\u0414\u0430\u043D\u043D\u044B\u0435 \u043F\u0440\u0438\u0448\u043B\u0438 \u043D\u0435 \u0432 \u0442\u043E\u043C \u0432\u0438\u0434\u0435, \u043A\u043E\u0442\u043E\u0440\u044B\u0439 \u044D\u043A\u0440\u0430\u043D \u043E\u0436\u0438\u0434\u0430\u0435\u0442. \u041E\u0441\u0442\u0430\u043B\u044C\u043D\u043E\u0435 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0435 \u0440\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u2014 \u0432\u0435\u0440\u043D\u0438\u0442\u0435\u0441\u044C \u043D\u0430\u0437\u0430\u0434 \u0438 \u043F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0435\u0449\u0451 \u0440\u0430\u0437." }), _jsx("div", { style: {
                        fontSize: 12,
                        color: color.faint,
                        background: color.screen,
                        borderRadius: radius.xs,
                        padding: '10px 12px',
                        fontFamily: 'ui-monospace, monospace',
                        wordBreak: 'break-word',
                    }, children: this.state.error.message }), _jsx("div", { onClick: this.props.onBack, style: {
                        cursor: 'pointer',
                        marginTop: 'auto',
                        height: 52,
                        borderRadius: radius.md,
                        background: color.primary,
                        color: '#fff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 15,
                        fontWeight: 800,
                    }, children: "\u041D\u0430\u0437\u0430\u0434" })] }));
    }
}
