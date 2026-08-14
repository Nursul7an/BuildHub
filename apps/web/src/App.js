import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect } from 'react';
import { color } from './design/tokens';
import { PhoneFrame, ScreenBody } from './shell/PhoneFrame';
import { BottomNav, showsNav, tabsFor } from './shell/navigation';
import { DemoPanel } from './shell/DemoPanel';
import { useApp, roleGroup } from './store/app';
import { onAuthEvent } from './api/client';
import { useQuery } from './api/hooks';
import { renderScreen } from './screens/registry';
import { ErrorBoundary } from './shell/ErrorBoundary';
export default function App() {
    const { me, loading, screen, params, toast, init, go, back, logout } = useApp();
    useEffect(() => {
        void init();
        return onAuthEvent((event) => {
            if (event === 'unauthorized')
                logout();
            if (event === 'password_required')
                useApp.getState().replace('password');
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    const { data: badges, reload: reloadBadges } = useQuery(me ? '/badges' : null, [screen]);
    useEffect(() => {
        reloadBadges();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [screen]);
    const authScreen = screen === 'login' || screen === 'password';
    const tabs = me && !authScreen ? tabsFor(me.role, roleGroup(me.role)) : [];
    const showNav = showsNav(screen);
    const clock = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return (_jsxs("div", { style: {
            minHeight: '100vh',
            display: 'flex',
            gap: 40,
            alignItems: 'flex-start',
            justifyContent: 'center',
            padding: '36px 24px',
            background: color.page,
            fontFamily: 'Manrope, sans-serif',
        }, children: [_jsx(DemoPanel, {}), _jsxs(PhoneFrame, { clock: clock, toast: toast, onAssistant: me && !authScreen ? () => go('assistant') : undefined, children: [loading ? (_jsx(ScreenBody, { style: { padding: 20, color: color.muted }, children: "\u0417\u0430\u0433\u0440\u0443\u0436\u0430\u0435\u043C\u2026" })) : (_jsx(ErrorBoundary, { resetKey: screen, onBack: back, children: renderScreen(screen, params) })), showNav && me ? (_jsx(BottomNav, { tabs: tabs, current: screen, badges: badges ?? {}, onNavigate: (s) => go(s) })) : null] })] }));
}
