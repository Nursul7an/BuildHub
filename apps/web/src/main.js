import { jsx as _jsx } from "react/jsx-runtime";
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { useApp } from './store/app';
const style = document.createElement('style');
style.textContent = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #E9EAEE; font-family: Manrope, sans-serif; -webkit-font-smoothing: antialiased; }
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
    window.buildHub = useApp;
}
createRoot(document.getElementById('root')).render(_jsx(StrictMode, { children: _jsx(App, {}) }));
