/**
 * A2 · «Мои работы».
 *
 * Три уровня: этаж → раздел → процессы. Раскрытие внутри карточки, а не
 * переход — прораб сравнивает разделы между собой, и уводить его с экрана
 * ради трёх строк незачем. Процент раздела считается по его собственному
 * плану, а не усреднением процентов процессов.
 */
import { useMemo, useState } from 'react';
import { color, radius } from '../../design/tokens';
import {
  Badge,
  Card,
  PlanFactBars,
  Segmented,
  formatNumber,
  formatPct,
  tabular,
} from '../../design/primitives';
import { IconSearch } from '../../design/icons';
import { RootHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useQuery } from '../../api/hooks';
import type { ProcessSummary } from '../../api/types';
import { useApp } from '../../store/app';
import { dueStyle, dueText } from './TodayScreen';

type Grouping = 'floor' | 'section';

interface Group {
  key: string;
  label: string;
  /** Раздел × этаж — карточка. */
  cards: {
    key: string;
    sectionId: string;
    sectionName: string;
    blockId: string;
    blockName: string;
    floor: number;
    processes: ProcessSummary[];
  }[];
}

export function WorksScreen() {
  const go = useApp((s) => s.go);
  const [grouping, setGrouping] = useState<Grouping>('floor');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const { data, loading } = useQuery<ProcessSummary[]>('/works?mine=1');

  const groups = useMemo<Group[]>(() => {
    if (!data) return [];
    const cards = new Map<string, Group['cards'][number]>();
    for (const p of data) {
      const key = `${p.blockId}:${p.floor}:${p.sectionId}`;
      const card = cards.get(key) ?? {
        key,
        sectionId: p.sectionId,
        sectionName: p.sectionName ?? '',
        blockId: p.blockId,
        blockName: p.blockName,
        floor: p.floor,
        processes: [],
      };
      card.processes.push(p);
      cards.set(key, card);
    }
    const all = [...cards.values()].map((c) => ({
      ...c,
      processes: c.processes.sort((a, b) => a.order - b.order),
    }));

    const byKey = new Map<string, Group>();
    for (const card of all) {
      const key = grouping === 'floor' ? `${card.blockId}:${card.floor}` : card.sectionId;
      const label = grouping === 'floor' ? `${card.blockName} · ${card.floor} этаж` : card.sectionName;
      const group = byKey.get(key) ?? { key, label, cards: [] };
      group.cards.push(card);
      byKey.set(key, group);
    }
    return [...byKey.values()].sort((a, b) => a.label.localeCompare(b.label, 'ru'));
  }, [data, grouping]);

  if (loading) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем работы…</ScreenBody>;

  const count = data?.length ?? 0;

  return (
    <ScreenBody>
      <RootHeader
        title="Мои работы"
        subtitle={`${groups.length} групп · ${count} процессов`}
        right={
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: radius.mdAlt,
              background: color.surface,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 4px rgba(20,22,31,0.08)',
              flex: 'none',
            }}
          >
            <IconSearch />
          </div>
        }
      />

      <div style={{ padding: '4px 20px 0' }}>
        <Segmented
          value={grouping}
          onChange={setGrouping}
          options={[
            { value: 'floor', label: 'По этажам' },
            { value: 'section', label: 'По видам работ' },
          ]}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 20px' }}>
        {groups.map((group) => (
          <div key={group.key} style={{ display: 'contents' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: color.muted,
                marginTop: 4,
              }}
            >
              {group.label.toUpperCase()}
            </div>
            {group.cards.map((card) => {
              const plan = card.processes.reduce((a, p) => a + p.planQty, 0);
              const fact = card.processes.reduce((a, p) => a + p.doneQty, 0);
              // Процент раздела — от суммы планов, а не среднее по процессам:
              // иначе один короткий процесс весит столько же, сколько весь монолит.
              const factPct = plan > 0 ? (fact / plan) * 100 : 0;
              const planPct = Math.min(100, factPct + 6);
              const blocked = card.processes.find((p) => p.status === 'blocked');
              const active = card.processes.find((p) => p.status === 'active');
              const open = expanded[card.key];
              const acts = card.processes.filter((p) => p.requiresAosr).length;

              return (
                <Card key={card.key} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink }}>
                        {grouping === 'floor' ? card.sectionName : `${card.blockName} · ${card.floor} этаж`}
                      </div>
                      <div style={{ fontSize: 12, color: color.muted, marginTop: 1 }}>
                        {card.processes.length} процессов · {acts} актов
                      </div>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: color.ink, flexShrink: 0, ...tabular }}>
                      {formatPct(factPct)}
                    </div>
                  </div>

                  {active ? (
                    <div style={{ fontSize: 13, color: color.muted, marginTop: 1, ...tabular }}>
                      {formatNumber(active.doneQty, active.unit === 'т' ? 2 : 0)} из{' '}
                      {formatNumber(active.planQty, active.unit === 'т' ? 1 : 0)} {active.unit} · {active.name}
                    </div>
                  ) : null}

                  <PlanFactBars planPct={planPct} factPct={factPct} />

                  {active?.dueDate ? (
                    <div style={{ fontSize: 12.5, fontWeight: 800, marginTop: 6, ...dueStyle(active.dueDate) }}>
                      {dueText(active.dueDate)}
                    </div>
                  ) : null}

                  {blocked ? (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: color.danger, marginTop: 6 }}>
                      ⛔ {blocked.blockedReason}
                    </div>
                  ) : null}

                  <div
                    onClick={() => setExpanded((e) => ({ ...e, [card.key]: !e[card.key] }))}
                    style={{
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 700,
                      color: color.primary,
                      marginTop: 5,
                      minHeight: 24,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    {open ? '▾ скрыть процессы' : `▸ показать процессы · ${card.processes.length}`}
                  </div>

                  {open ? (
                    <>
                      {card.processes.slice(0, 4).map((p) => (
                        <div
                          key={p.id}
                          onClick={() => go('process', { processStateId: p.id })}
                          style={{
                            cursor: 'pointer',
                            display: 'flex',
                            gap: 8,
                            padding: '7px 0 7px 4px',
                            borderTop: `1px dashed ${color.borderSoft}`,
                            marginTop: 4,
                          }}
                        >
                          <div style={{ fontSize: 12, flexShrink: 0 }}>{STATUS_ICON[p.status]}</div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12.5, fontWeight: 700, color: color.ink }}>{p.name}</div>
                            <div style={{ fontSize: 11.5, color: color.muted, ...tabular }}>
                              {p.planQty > 0
                                ? `${formatNumber(p.doneQty, p.unit === 'т' ? 2 : 0)} из ${formatNumber(p.planQty, p.unit === 'т' ? 1 : 0)} ${p.unit} · ${formatPct(p.pct)}`
                                : STATUS_LABEL[p.status]}
                            </div>
                            {p.blockedReason ? (
                              <div style={{ fontSize: 11, fontWeight: 800, color: color.danger, marginTop: 1 }}>
                                {p.blockedReason}
                              </div>
                            ) : null}
                          </div>
                          {p.requiresAosr ? (
                            <div style={{ fontSize: 11, flexShrink: 0 }} title="по завершении требуется АОСР">
                              🔒
                            </div>
                          ) : null}
                        </div>
                      ))}
                      <div
                        onClick={() =>
                          go('chain', { sectionId: card.sectionId, blockId: card.blockId, floor: card.floor })
                        }
                        style={{
                          cursor: 'pointer',
                          padding: '8px 0 2px 4px',
                          fontSize: 12.5,
                          fontWeight: 700,
                          color: color.primary,
                          borderTop: `1px dashed ${color.borderSoft}`,
                          marginTop: 4,
                        }}
                      >
                        Вся цепочка раздела · {card.processes.length} процессов ›
                      </div>
                    </>
                  ) : null}
                </Card>
              );
            })}
          </div>
        ))}

        {groups.length === 0 ? (
          <Card style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink }}>
              ПТО пока не назначил вам работы
            </div>
            <div style={{ fontSize: 13, color: color.muted, marginTop: 6 }}>
              Как только назначат — они появятся здесь и на «Сегодня».
            </div>
          </Card>
        ) : null}
      </div>
    </ScreenBody>
  );
}

export const STATUS_ICON: Record<ProcessSummary['status'], string> = {
  idle: '⚪',
  active: '🔵',
  presented: '🟣',
  accepted: '✅',
  blocked: '⛔',
};

export const STATUS_LABEL: Record<ProcessSummary['status'], string> = {
  idle: 'не начат',
  active: 'в работе',
  presented: 'предъявлен · ждём технадзор',
  accepted: 'принят',
  blocked: 'заблокирован',
};

export const STATUS_BADGE: Record<ProcessSummary['status'], 'neutral' | 'primary' | 'green' | 'warn'> = {
  idle: 'neutral',
  active: 'primary',
  presented: 'primary',
  accepted: 'green',
  blocked: 'warn',
};

export { Badge };
