/**
 * A3 · Цепочка процессов раздела.
 *
 * Ключевой экран: он объясняет, что кого держит. Заблокированный процесс
 * показывает причину прямо в строке — прораб должен понимать, что именно его
 * останавливает, не открывая диалог. Замок 🔒 — предупреждение «по завершении
 * нужен АОСР», а не блокировка.
 */
import { color, radius } from '../../design/tokens';
import { Badge, formatNumber, formatPct, tabular } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useQuery } from '../../api/hooks';
import type { ChainDto } from '../../api/types';
import { useApp } from '../../store/app';

const STATUS_STYLE: Record<
  ChainDto['rows'][number]['status'],
  { dot: string; background: string; border?: string; opacity?: number }
> = {
  idle: { dot: color.faint, background: color.surface, opacity: 0.72 },
  active: { dot: color.primary, background: color.surface, border: color.primary },
  presented: { dot: '#8B5CF6', background: '#F4F0FF', border: '#C9B8F7' },
  accepted: { dot: color.green, background: color.greenBg },
  blocked: { dot: color.faint, background: color.chip },
};

export function ChainScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);

  const path =
    params.sectionId && params.blockId && params.floor !== undefined
      ? `/chain?sectionId=${params.sectionId}&blockId=${params.blockId}&floor=${params.floor}`
      : null;
  const { data } = useQuery<ChainDto>(path);

  if (!data) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем цепочку…</ScreenBody>;

  let lastSubcycle: string | null | undefined;

  return (
    <ScreenBody>
      <ScreenHeader
        title={data.section.name}
        subtitle={`${data.processCount} процессов · ${data.actsCount} актов`}
        onBack={back}
      />

      {/* Условие входа в раздел — до списка, иначе прораб пойдёт по процессам зря. */}
      {data.section.entryCondition ? (
        <div
          style={{
            margin: '4px 20px 0',
            background: color.primaryBg,
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: radius.smAlt,
            padding: '10px 12px',
            fontSize: 12.5,
            color: color.primaryDark,
            fontWeight: 600,
            lineHeight: 1.45,
          }}
        >
          {data.section.entryCondition}
        </div>
      ) : null}

      {data.section.blockReason ? (
        <div
          style={{
            margin: '8px 20px 0',
            background: color.warnBg,
            border: `1px solid ${color.warnBorder}`,
            borderRadius: radius.smAlt,
            padding: '10px 12px',
            fontSize: 12.5,
            color: color.warnText,
            fontWeight: 800,
            lineHeight: 1.45,
          }}
        >
          {data.section.blockReason}
        </div>
      ) : null}

      <div style={{ padding: '10px 20px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {data.rows.map((row, i) => {
          const style = STATUS_STYLE[row.status];
          const showSubcycle = row.subcycle && row.subcycle !== lastSubcycle;
          lastSubcycle = row.subcycle;
          const pct = row.planQty > 0 ? (row.doneQty / row.planQty) * 100 : 0;

          return (
            <div key={row.processDefId} style={{ display: 'contents' }}>
              {showSubcycle ? (
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.06em',
                    color: color.muted,
                    marginTop: i === 0 ? 0 : 10,
                    marginBottom: 2,
                  }}
                >
                  {row.subcycle?.toUpperCase()}
                </div>
              ) : null}

              <div
                onClick={row.processStateId ? () => go('process', { processStateId: row.processStateId! }) : undefined}
                style={{
                  cursor: row.processStateId ? 'pointer' : 'default',
                  display: 'flex',
                  gap: 10,
                  alignItems: 'flex-start',
                  padding: '10px 12px',
                  borderRadius: radius.smAlt,
                  background: style.background,
                  opacity: style.opacity,
                  ...(style.border ? { border: `1.5px solid ${style.border}` } : null),
                }}
              >
                <div
                  style={{
                    width: 22,
                    fontSize: 11.5,
                    fontWeight: 800,
                    color: color.faint,
                    flexShrink: 0,
                    paddingTop: 2,
                    ...tabular,
                  }}
                >
                  {row.order}.
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: color.ink, lineHeight: 1.35 }}>
                    {row.name}
                    {row.requiresAosr ? <span title="по завершении требуется АОСР"> 🔒</span> : null}
                  </div>

                  {row.status === 'accepted' ? (
                    <div style={{ fontSize: 12, color: color.greenDeep, fontWeight: 700, marginTop: 2 }}>
                      принят{row.aosrNumber ? ` · ${row.aosrNumber}` : ''}
                      {row.acceptedAt ? ` · ${new Date(row.acceptedAt).toLocaleDateString('ru-RU')}` : ''}
                    </div>
                  ) : row.status === 'presented' ? (
                    <div style={{ fontSize: 12, color: '#6D28D9', fontWeight: 700, marginTop: 2 }}>
                      ждём технадзор · день {daysSince(row.presentedAt)} из {row.presentedOfDays ?? 3}
                    </div>
                  ) : row.status === 'blocked' ? (
                    <div style={{ fontSize: 12, color: color.danger, fontWeight: 700, marginTop: 2, lineHeight: 1.4 }}>
                      {row.blockedReason}
                    </div>
                  ) : row.status === 'active' ? (
                    <div style={{ fontSize: 12, color: color.primary, fontWeight: 700, marginTop: 2, ...tabular }}>
                      {formatNumber(row.doneQty, row.unit === 'т' ? 2 : 0)} из{' '}
                      {formatNumber(row.planQty, row.unit === 'т' ? 1 : 0)} {row.unit} · {formatPct(pct)}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, color: color.faint, marginTop: 2 }}>
                      не начат{row.unit !== '—' ? ` · ${row.unit}` : ''}
                    </div>
                  )}

                  {row.status === 'active' ? (
                    <div style={{ height: 5, borderRadius: 3, background: color.track, marginTop: 6 }}>
                      <div
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          height: 5,
                          borderRadius: 3,
                          background: color.primary,
                        }}
                      />
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: style.dot,
                    flexShrink: 0,
                    marginTop: 4,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ScreenBody>
  );
}

function daysSince(iso: string | null): number {
  if (!iso) return 1;
  return Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000) + 1);
}

export { Badge };
