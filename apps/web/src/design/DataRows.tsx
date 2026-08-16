/**
 * Список данных: карточки на телефоне, таблица на широком экране.
 *
 * Описание колонок одно на оба представления. Дублировать разметку под
 * телефон и под монитор нельзя: два дерева расходятся на первой же правке,
 * и через месяц ПТО видит в таблице не то, что прораб видит в карточке.
 *
 * Почему вообще два представления. Прорабу на этаже нужна одна запись за
 * раз, крупно и в одну колонку. ПТО за столом сравнивает строки между
 * собой — объём, дату, статус по десяти процессам сразу; карточки этот
 * сценарий ломают, потому что глазу негде выстроить столбец.
 */
import type { CSSProperties, ReactNode } from 'react';
import { color, radius } from './tokens';
import { Card } from './primitives';
import { useBreakpoint } from '../shell/useBreakpoint';

export interface Column<T> {
  key: string;
  /** Заголовок столбца в таблице и подпись значения в карточке. */
  title: string;
  cell: (row: T) => ReactNode;
  /**
   * Главное поле записи: в карточке уходит в заголовок без подписи,
   * в таблице остаётся первым столбцом.
   */
  primary?: boolean;
  /** Числа выравниваем по правому краю — так их сравнивают взглядом. */
  align?: 'right';
  /** Второстепенное: в карточке на телефоне не показываем. */
  desktopOnly?: boolean;
}

export function DataRows<T>({
  items,
  columns,
  keyOf,
  onRowClick,
  style,
}: {
  items: T[];
  columns: Column<T>[];
  keyOf: (row: T) => string;
  onRowClick?: (row: T) => void;
  style?: CSSProperties;
}) {
  const viewport = useBreakpoint();

  if (viewport === 'mobile') {
    const primary = columns.find((c) => c.primary) ?? columns[0]!;
    const rest = columns.filter((c) => c !== primary && !c.desktopOnly);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, ...style }}>
        {items.map((row) => (
          <Card
            key={keyOf(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={{ borderRadius: radius.md, padding: '14px 16px' }}
          >
            <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink }}>
              {primary.cell(row)}
            </div>
            {rest.length > 0 ? (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '4px 16px',
                  marginTop: 8,
                }}
              >
                {rest.map((c) => (
                  <div key={c.key} style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ fontSize: 11.5, color: color.faint }}>{c.title}</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: color.inkMuted }}>
                      {c.cell(row)}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    );
  }

  return (
    // Таблица шире экрана прокручивается сама, а не растягивает страницу.
    <div style={{ overflowX: 'auto', ...style }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: color.surface,
          borderRadius: radius.md,
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                style={{
                  textAlign: c.align === 'right' ? 'right' : 'left',
                  padding: '10px 16px',
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: color.faint,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  borderBottom: `1px solid ${color.track}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {c.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((row) => (
            <tr
              key={keyOf(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              style={{
                cursor: onRowClick ? 'pointer' : undefined,
                borderBottom: `1px solid ${color.track}`,
              }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    textAlign: c.align === 'right' ? 'right' : 'left',
                    padding: '12px 16px',
                    fontSize: 14,
                    color: color.ink,
                    verticalAlign: 'middle',
                  }}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
