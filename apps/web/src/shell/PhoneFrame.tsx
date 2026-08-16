/**
 * Область экрана приложения.
 *
 * Раньше здесь был корпус телефона из макета — фиксированная ширина,
 * рамка, скругление и нарисованная строка состояния с временем и зарядом.
 * В макете это показывало, как приложение будет выглядеть на телефоне;
 * в работающем приложении такая рамка занимает место и врёт: время и
 * заряд рисует система, а не мы.
 */
import type { ReactNode } from 'react';
import { color, radius, shadow } from '../design/tokens';
import { IconAssistant } from '../design/icons';

export function PhoneFrame({
  children,
  onAssistant,
  toast,
}: {
  children: ReactNode;
  onAssistant?: () => void;
  toast?: string | null;
}) {
  return (
    <div
      style={{
        width: '100%',
        background: color.screen,
        display: 'flex',
        flexDirection: 'column',
        // Высоту задаёт внешний контейнер: экран заполняет доступное место,
        // а не выдуманные 800 px из макета.
        flex: 1,
        minHeight: 0,
        position: 'relative',
      }}
    >
      {onAssistant ? (
        <div
          onClick={onAssistant}
          title="Помощник"
          style={{
            cursor: 'pointer',
            position: 'absolute',
            right: 0,
            top: '46%',
            width: 44,
            height: 64,
            borderRadius: '18px 0 0 18px',
            background: `linear-gradient(160deg, ${color.primaryLight}, ${color.primary})`,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1,
            boxShadow: shadow.fab,
            border: '1.5px solid #fff',
            borderRight: 'none',
            zIndex: 6,
          }}
        >
          <IconAssistant />
          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '0.02em' }}>AI</div>
        </div>
      ) : null}

      {children}

      {toast ? (
        <div
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: 92,
            background: color.ink,
            color: '#fff',
            borderRadius: radius.sm,
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.4,
            boxShadow: shadow.phone,
            zIndex: 20,
          }}
        >
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/** Прокручиваемая часть экрана между шапкой и нижней навигацией. */
export function ScreenBody({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', ...style }}>
      {children}
    </div>
  );
}
