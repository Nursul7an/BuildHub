import { useEffect } from 'react';
import { color } from './design/tokens';
import { PhoneFrame, ScreenBody } from './shell/PhoneFrame';
import { BottomNav, SideNav, showsNav, tabsFor } from './shell/navigation';
import { useBreakpoint } from './shell/useBreakpoint';
import { CONTENT_MAX } from './design/tokens';
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

  const authScreen = screen === 'login' || screen === 'password' || screen === 'register';
  const tabs = me && !authScreen ? tabsFor(me.role, roleGroup(me.role)) : [];
  const showNav = showsNav(screen);

  const viewport = useBreakpoint();
  /**
   * Ниже планшета навигация внизу — там её достаёт большой палец.
   * От планшета и выше она уходит вбок: на широком экране нижняя полоса
   * отъезжает от глаз и от курсора, а место по краям есть.
   */
  const sideNav = viewport !== 'mobile' && showNav && me;
  const bottomNav = viewport === 'mobile' && showNav && me;

  return (
    <div
      style={{
        // dvh, а не vh: на телефоне адресная строка скрывается и появляется,
        // и вычисленные из vh 100 % оказываются выше видимой области.
        minHeight: '100dvh',
        width: '100%',
        display: 'flex',
        background: color.page,
        fontFamily: 'Manrope, sans-serif',
      }}
    >
      {sideNav ? (
        <SideNav
          tabs={tabs}
          current={screen}
          badges={(badges as unknown as Record<string, number>) ?? {}}
          onNavigate={(s) => go(s)}
          collapsed={viewport === 'tablet'}
        />
      ) : null}

      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          // Содержимое не растягиваем на всю ширину монитора: строка
          // длиннее ~1280 px читается хуже, чем короче.
          maxWidth: CONTENT_MAX,
          width: '100%',
          margin: '0 auto',
          minHeight: '100dvh',
        }}
      >
        <PhoneFrame
          toast={toast}
          bottomNav={Boolean(bottomNav)}
          onAssistant={me && !authScreen ? () => go('assistant') : undefined}
        >
          {loading ? (
            <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>
          ) : (
            <ErrorBoundary resetKey={screen} onBack={back}>
              {renderScreen(screen, params)}
            </ErrorBoundary>
          )}

          {bottomNav ? (
            <BottomNav
              tabs={tabs}
              current={screen}
              badges={(badges as unknown as Record<string, number>) ?? {}}
              onNavigate={(s) => go(s)}
            />
          ) : null}
        </PhoneFrame>
      </div>
    </div>
  );
}
