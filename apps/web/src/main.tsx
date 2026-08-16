import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useApp } from './store/app';

const style = document.createElement('style');
style.textContent = `
  /*
    Размеры раскладки одним списком. Те же значения продублированы
    константами в design/tokens.ts — оттуда их берут инлайновые стили,
    отсюда медиазапросы. Менять нужно в обоих местах.
  */
  :root {
    --bp-tablet: 768px;
    --bp-desktop: 1024px;
    --content-max: 1280px;
    --sidebar-w: 240px;
    --tap-min: 48px;
  }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0; background: #E9EAEE; font-family: Manrope, sans-serif; -webkit-font-smoothing: antialiased; }
  #root { min-height: 100dvh; }
  a { color: #3D4FDE; text-decoration: none; }
  a:hover { color: #2A3AB8; }
  input, textarea, button { font-family: inherit; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-thumb { background: #D8DAE3; border-radius: 3px; }
`;
document.head.appendChild(style);

// В разработке хранилище доступно из консоли: удобно открыть любой экран
// напрямую и проверить его без прохода по всему сценарию.
if (import.meta.env.DEV) {
  (window as unknown as { buildHub: typeof useApp }).buildHub = useApp;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
