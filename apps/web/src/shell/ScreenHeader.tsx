import type { ReactNode } from 'react';
import { color } from '../design/tokens';
import { BackButton } from '../design/primitives';

/** Шапка внутреннего экрана: назад, заголовок, подпись, действие справа. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  right,
  padding = '14px 20px 8px',
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  onBack?: () => void;
  right?: ReactNode;
  padding?: string;
}) {
  return (
    <div style={{ padding, display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
      {onBack ? <BackButton onClick={onBack} /> : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: color.ink }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 13, color: color.muted }}>{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}

/** Шапка корневого экрана таба — крупный заголовок без кнопки «назад». */
export function RootHeader({
  title,
  subtitle,
  right,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <div
      style={{
        padding: '16px 20px 8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        flex: 'none',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: color.ink }}>{title}</div>
        {subtitle ? <div style={{ fontSize: 13, color: color.muted, marginTop: 3 }}>{subtitle}</div> : null}
      </div>
      {right}
    </div>
  );
}
