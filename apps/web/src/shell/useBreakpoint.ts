/**
 * Текущий класс устройства.
 *
 * Стили в этом приложении заданы прямо в разметке, а медиазапрос в
 * инлайновом стиле невозможен. Отрисовывать обе навигации сразу и прятать
 * одну через CSS — значит держать в дереве лишнее и дублировать разметку.
 * Поэтому переключаем раскладку по matchMedia: подписка одна на всё
 * приложение, компоненты остаются в одном экземпляре.
 *
 * Значения совпадают с переменными --bp-tablet и --bp-desktop в :root.
 */
import { useEffect, useState } from 'react';
import { BP_DESKTOP, BP_TABLET } from '../design/tokens';

export type Viewport = 'mobile' | 'tablet' | 'desktop';

function current(): Viewport {
  if (typeof window === 'undefined') return 'mobile';
  if (window.matchMedia(`(min-width: ${BP_DESKTOP}px)`).matches) return 'desktop';
  if (window.matchMedia(`(min-width: ${BP_TABLET}px)`).matches) return 'tablet';
  return 'mobile';
}

export function useBreakpoint(): Viewport {
  const [viewport, setViewport] = useState<Viewport>(current);

  useEffect(() => {
    const tablet = window.matchMedia(`(min-width: ${BP_TABLET}px)`);
    const desktop = window.matchMedia(`(min-width: ${BP_DESKTOP}px)`);
    const update = () => setViewport(current());

    tablet.addEventListener('change', update);
    desktop.addEventListener('change', update);
    // Поворот телефона меняет класс без пересечения брейкпоинта не всегда,
    // но подписка на сами запросы это уже покрывает.
    return () => {
      tablet.removeEventListener('change', update);
      desktop.removeEventListener('change', update);
    };
  }, []);

  return viewport;
}
