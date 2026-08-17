/**
 * Состояния экрана со списком: загрузка, отказ, пусто.
 *
 * Состояния передаются пропсами, а не выводятся из «массив пустой».
 * Разница не косметическая: пустой массив и не пришедший ответ выглядят
 * в коде одинаково, а для человека это «работ нет» и «связь пропала» —
 * два разных сообщения и два разных следующих действия. Прораб, увидев
 * «нет работ» вместо «нет связи», пойдёт искать ПТО вместо того, чтобы
 * выйти из подвала.
 *
 * Офлайна здесь намеренно нет: очередь на клиенте не делаем.
 */
import type { ReactNode } from 'react';
import { color, radius } from './tokens';
import { ScreenBody } from '../shell/PhoneFrame';

export function Skeleton({ height = 64 }: { height?: number }) {
  return (
    <div
      style={{
        height,
        borderRadius: radius.md,
        background: color.chip,
        // Пульсация говорит «идёт загрузка» без текста и без счётчика.
        animation: 'bh-pulse 1.4s ease-in-out infinite',
      }}
    />
  );
}

export function DataState({
  loading,
  error,
  empty,
  emptyText,
  emptyNode,
  onRetry,
  skeletonRows = 4,
  children,
}: {
  loading: boolean;
  error: string | null;
  /** Считает вызывающий: только он знает, что для него «пусто». */
  empty: boolean;
  emptyText?: string;
  /** Своё пустое состояние — когда одной строки мало и нужна кнопка. */
  emptyNode?: ReactNode;
  onRetry?: () => void;
  skeletonRows?: number;
  children: ReactNode;
}) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: skeletonRows }, (_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          borderRadius: radius.md,
          border: `1px solid ${color.track}`,
          padding: '18px 16px',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, color: color.danger }}>
          Не удалось загрузить
        </div>
        <div style={{ fontSize: 13, color: color.muted, marginTop: 6, lineHeight: 1.5 }}>
          {error}
        </div>
        {onRetry ? (
          <div
            onClick={onRetry}
            style={{
              marginTop: 12,
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 800,
              color: color.primary,
            }}
          >
            Повторить
          </div>
        ) : null}
      </div>
    );
  }

  if (empty) {
    if (emptyNode) return <>{emptyNode}</>;
    return (
      <div
        style={{
          borderRadius: radius.md,
          border: `1px dashed ${color.dashed}`,
          padding: '22px 16px',
          textAlign: 'center',
          fontSize: 13.5,
          color: color.muted,
          lineHeight: 1.5,
        }}
      >
        {emptyText}
      </div>
    );
  }

  return <>{children}</>;
}

/**
 * Состояние экрана, показывающего одну запись, а не список.
 *
 * Заменяет `if (!data) return «Загружаем…»`. Тот приём не отличает «ещё
 * не пришло» от «пришло, но пусто» и от «не пришло совсем»: при отказе
 * сервера data остаётся null, и человек смотрит на «Загружаем…» столько,
 * сколько хватит терпения. Ровно так экономика объекта без заведённого
 * бюджета висела вечно.
 */
export function ScreenState({
  loading,
  error,
  missing,
  missingText = 'Запись не найдена',
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  /** Загрузка кончилась, а записи нет: удалили или не существует. */
  missing: boolean;
  missingText?: string;
  onRetry?: () => void;
}) {
  return (
    <ScreenBody style={{ padding: 20 }}>
      <DataState
        loading={loading}
        error={error}
        empty={missing}
        emptyText={missingText}
        onRetry={onRetry}
        skeletonRows={3}
      >
        {null}
      </DataState>
    </ScreenBody>
  );
}
