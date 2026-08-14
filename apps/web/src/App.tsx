import { useEffect } from 'react';
import { color } from './design/tokens';
import { PhoneFrame, ScreenBody } from './shell/PhoneFrame';
import { BottomNav, tabsFor } from './shell/navigation';
import { DemoPanel } from './shell/DemoPanel';
import { useApp, roleGroup } from './store/app';
import { onAuthEvent } from './api/client';
import { useQuery } from './api/hooks';
import type { BadgesDto } from './api/types';
import { renderScreen } from './screens/registry';
import { ErrorBoundary } from './shell/ErrorBoundary';

export default function App() {
  const { me, loading, screen, params, toast, init, go, back, logout } = useApp();

  useEffect(() => {
    void init();
    return onAuthEvent((event) => {
      if (event === 'unauthorized') logout();
      if (event === 'password_required') useApp.getState().replace('password');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: badges, reload: reloadBadges } = useQuery<BadgesDto>(me ? '/badges' : null, [screen]);

  useEffect(() => {
    reloadBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  const authScreen = screen === 'login' || screen === 'password';
  const tabs = me && !authScreen ? tabsFor(me.role, roleGroup(me.role)) : [];
  const showNav = tabs.some((t) => t.owns.includes(screen));

  const clock = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        gap: 40,
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '36px 24px',
        background: color.page,
        fontFamily: 'Manrope, sans-serif',
      }}
    >
      <DemoPanel />

      <PhoneFrame
        clock={clock}
        toast={toast}
        onAssistant={me && !authScreen ? () => go('assistant') : undefined}
      >
        {loading ? (
          <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>
        ) : (
          <ErrorBoundary resetKey={screen} onBack={back}>
            {renderScreen(screen, params)}
          </ErrorBoundary>
        )}

        {showNav && me ? (
          <BottomNav
            tabs={tabs}
            current={screen}
            badges={(badges as unknown as Record<string, number>) ?? {}}
            onNavigate={(s) => go(s)}
          />
        ) : null}
      </PhoneFrame>
    </div>
  );
}
