import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/**
 * A1б · Смена пароля.
 * Временный пароль выдаётся один раз; пока он не сменён, других экранов нет.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Field, PrimaryButton } from '../../design/primitives';
import { BackButton } from '../../design/primitives';
import { api, ApiError } from '../../api/client';
import { useApp, homeScreen } from '../../store/app';
const MIN_LENGTH = 8;
export function PasswordScreen() {
    const [a, setA] = useState('');
    const [b, setB] = useState('');
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    const logout = useApp((s) => s.logout);
    const refreshMe = useApp((s) => s.refreshMe);
    const replace = useApp((s) => s.replace);
    const tooShort = a.length > 0 && a.length < MIN_LENGTH;
    const mismatch = b.length > 0 && a !== b;
    const match = a.length >= MIN_LENGTH && a === b;
    async function save() {
        if (!match)
            return;
        setBusy(true);
        setError(null);
        try {
            await api.post('/auth/password', { newPassword: a, repeatPassword: b });
            await refreshMe();
            const me = useApp.getState().me;
            if (me)
                replace(homeScreen(me.role));
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : 'Не удалось сохранить пароль');
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsxs("div", { style: { padding: '18px 24px 0', display: 'flex', alignItems: 'center', gap: 12 }, children: [_jsx(BackButton, { onClick: logout }), _jsxs("div", { children: [_jsx("div", { style: { fontSize: 20, fontWeight: 800, color: color.ink }, children: "\u041F\u0440\u0438\u0434\u0443\u043C\u0430\u0439\u0442\u0435 \u043F\u0430\u0440\u043E\u043B\u044C" }), _jsx("div", { style: { fontSize: 12.5, color: color.inkMuted, marginTop: 2, lineHeight: 1.45 }, children: "\u0412\u0440\u0435\u043C\u0435\u043D\u043D\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u0435\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u043F\u043E\u0441\u043B\u0435 \u0441\u043C\u0435\u043D\u044B" })] })] }), _jsxs("div", { style: { padding: '20px 24px 0', display: 'flex', flexDirection: 'column', gap: 10 }, children: [_jsx(Field, { label: "\u041D\u041E\u0412\u042B\u0419 \u041F\u0410\u0420\u041E\u041B\u042C", value: a, onChange: setA, placeholder: "\u043C\u0438\u043D\u0438\u043C\u0443\u043C 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432", type: "password" }), _jsx(Field, { label: "\u041F\u041E\u0412\u0422\u041E\u0420\u0418\u0422\u0415", value: b, onChange: setB, placeholder: "\u0435\u0449\u0451 \u0440\u0430\u0437", type: "password" }), tooShort ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 700, color: color.warnText }, children: "\u041F\u0430\u0440\u043E\u043B\u044C \u043A\u043E\u0440\u043E\u0447\u0435 8 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432 \u2014 \u043D\u0435 \u043F\u043E\u0434\u043E\u0439\u0434\u0451\u0442" })) : null, mismatch ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.danger }, children: "\u041F\u0430\u0440\u043E\u043B\u0438 \u043D\u0435 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442" })) : null, match ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.greenDeep }, children: "\u2713 \u041F\u0430\u0440\u043E\u043B\u0438 \u0441\u043E\u0432\u043F\u0430\u0434\u0430\u044E\u0442" })) : null, error ? _jsx("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.danger }, children: error }) : null] }), _jsxs("div", { style: { marginTop: 'auto', padding: '16px 24px 28px' }, children: [_jsx(PrimaryButton, { onClick: save, disabled: !match || busy, style: { borderRadius: radius.card }, children: "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C \u043F\u0430\u0440\u043E\u043B\u044C" }), _jsx("div", { style: {
                            textAlign: 'center',
                            fontSize: 11.5,
                            color: color.faint,
                            marginTop: 8,
                            lineHeight: 1.5,
                        }, children: "\u041F\u0440\u0435\u0436\u043D\u0438\u0439 \u043F\u0430\u0440\u043E\u043B\u044C \u043F\u0435\u0440\u0435\u0441\u0442\u0430\u043D\u0435\u0442 \u0440\u0430\u0431\u043E\u0442\u0430\u0442\u044C \u00B7 \u043F\u043E\u0441\u043C\u043E\u0442\u0440\u0435\u0442\u044C \u0435\u0433\u043E \u043F\u043E\u0432\u0442\u043E\u0440\u043D\u043E \u043D\u0435\u043B\u044C\u0437\u044F, \u0442\u043E\u043B\u044C\u043A\u043E \u0441\u0431\u0440\u043E\u0441\u0438\u0442\u044C \u0443 \u0433\u043B\u0430\u0432\u043D\u043E\u0433\u043E \u0438\u043D\u0436\u0435\u043D\u0435\u0440\u0430" })] })] }));
}
