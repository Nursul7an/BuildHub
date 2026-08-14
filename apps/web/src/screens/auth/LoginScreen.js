import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
/** A1 · Вход. */
import { useState } from 'react';
import { color, radius, shadow } from '../../design/tokens';
import { Field, PrimaryButton } from '../../design/primitives';
import { useApp } from '../../store/app';
import { ApiError } from '../../api/client';
export function LoginScreen() {
    const login = useApp((s) => s.login);
    const [user, setUser] = useState('a.zhumabekov');
    const [pass, setPass] = useState('buildhub2026');
    const [show, setShow] = useState(false);
    const [error, setError] = useState(null);
    const [busy, setBusy] = useState(false);
    async function submit() {
        setBusy(true);
        setError(null);
        try {
            await login(user, pass);
        }
        catch (e) {
            setError(e instanceof ApiError ? e.message : 'Не удалось войти');
        }
        finally {
            setBusy(false);
        }
    }
    return (_jsxs("div", { style: { display: 'flex', flexDirection: 'column', flex: 1 }, children: [_jsx("div", { style: { display: 'flex', justifyContent: 'flex-end', padding: '12px 20px 0' }, children: _jsxs("div", { style: { display: 'flex', background: color.chip, borderRadius: radius.smAlt, padding: 3 }, children: [_jsx("div", { style: {
                                background: color.surface,
                                borderRadius: radius.xxs,
                                padding: '6px 14px',
                                fontSize: 13,
                                fontWeight: 800,
                                color: color.ink,
                                boxShadow: '0 1px 3px rgba(20,22,31,0.10)',
                            }, children: "RU" }), _jsx("div", { style: { padding: '6px 14px', fontSize: 13, fontWeight: 700, color: color.muted }, children: "KG" })] }) }), _jsxs("div", { style: { padding: '36px 28px 0', textAlign: 'center' }, children: [_jsx("div", { style: {
                            width: 76,
                            height: 76,
                            borderRadius: radius.xl,
                            background: color.primary,
                            margin: '0 auto',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#fff',
                            fontSize: 30,
                            fontWeight: 800,
                            boxShadow: shadow.primarySoft,
                        }, children: "BH" }), _jsx("div", { style: { fontSize: 26, fontWeight: 800, color: color.ink, marginTop: 16 }, children: "Build Hub" }), _jsx("div", { style: { fontSize: 14, color: color.muted, marginTop: 4 }, children: "\u0415\u0434\u0438\u043D\u0430\u044F \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u0430 \u0441\u0442\u0440\u043E\u0439\u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438" })] }), _jsxs("div", { style: { padding: '32px 24px 0', display: 'flex', flexDirection: 'column', gap: 12 }, children: [_jsx(Field, { label: "\u0422\u0415\u041B\u0415\u0424\u041E\u041D \u0418\u041B\u0418 \u041B\u041E\u0413\u0418\u041D", value: user, onChange: setUser, placeholder: "\u043B\u043E\u0433\u0438\u043D \u0438\u043B\u0438 +996\u2026" }), _jsxs("div", { style: {
                            background: color.surface,
                            border: `1.5px solid ${color.border}`,
                            borderRadius: radius.md,
                            padding: '12px 16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-end',
                            gap: 10,
                        }, children: [_jsxs("div", { style: { flex: 1, minWidth: 0 }, children: [_jsx("div", { style: { fontSize: 12, fontWeight: 700, color: color.muted }, children: "\u041F\u0410\u0420\u041E\u041B\u042C" }), _jsx("input", { value: pass, type: show ? 'text' : 'password', onChange: (e) => setPass(e.target.value), onKeyDown: (e) => {
                                            if (e.key === 'Enter')
                                                void submit();
                                        }, style: {
                                            width: '100%',
                                            boxSizing: 'border-box',
                                            border: 'none',
                                            outline: 'none',
                                            background: 'transparent',
                                            fontSize: 16,
                                            fontWeight: 700,
                                            color: color.ink,
                                            marginTop: 3,
                                            padding: '4px 0',
                                            fontFamily: 'inherit',
                                        } })] }), _jsx("div", { onClick: () => setShow((v) => !v), style: {
                                    cursor: 'pointer',
                                    minWidth: 44,
                                    height: 44,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 16,
                                    color: color.muted,
                                }, children: "\uD83D\uDC41" })] }), error ? (_jsx("div", { style: { fontSize: 12.5, fontWeight: 800, color: color.danger }, children: error })) : null, _jsx(PrimaryButton, { onClick: submit, disabled: busy || !user || !pass, children: busy ? 'Входим…' : 'Войти' }), _jsx("div", { style: {
                            textAlign: 'center',
                            fontSize: 14,
                            fontWeight: 700,
                            color: color.primary,
                            padding: 10,
                            minHeight: 44,
                            cursor: 'pointer',
                        }, children: "\u0417\u0430\u0431\u044B\u043B\u0438 \u043F\u0430\u0440\u043E\u043B\u044C?" })] }), _jsx("div", { style: {
                    marginTop: 'auto',
                    padding: '0 24px 28px',
                    textAlign: 'center',
                    fontSize: 12.5,
                    color: color.faint,
                    lineHeight: 1.5,
                }, children: "\u041D\u0435\u0442 \u0430\u043A\u043A\u0430\u0443\u043D\u0442\u0430? \u041E\u0431\u0440\u0430\u0442\u0438\u0442\u0435\u0441\u044C \u043A \u0430\u0434\u043C\u0438\u043D\u0438\u0441\u0442\u0440\u0430\u0442\u043E\u0440\u0443 \u0432\u0430\u0448\u0435\u0439 \u043A\u043E\u043C\u043F\u0430\u043D\u0438\u0438." })] }));
}
