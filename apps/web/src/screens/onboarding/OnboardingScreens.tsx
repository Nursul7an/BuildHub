/**
 * Онбординг площадки.
 *
 * Основной путь — работы уже назначил ПТО, и человеку остаётся подтвердить,
 * что список верен. Самостоятельная разметка — запасной путь на случай, когда
 * назначения нет: четыре тапа, и число тапов не растёт с размером объекта.
 */
import { useMemo, useState } from 'react';
import { color, radius } from '../../design/tokens';
import {
  BottomSheet,
  Card,
  CheckSquare,
  Chip,
  GhostButton,
  PrimaryButton,
  tabular,
} from '../../design/primitives';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { ObjectDto, ProcessSummary, SectionDto } from '../../api/types';
import { useApp } from '../../store/app';
import { ScreenState } from '../../design/DataState';
import { dueStyle, dueText } from '../field/TodayScreen';

/* ─────────────────────── Экран 1 · «Вот ваши работы» ─────────────────────── */

export function AssignedWorksScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const notify = useApp((s) => s.notify);
  const [wrongOpen, setWrongOpen] = useState(false);

  const { data, loading, error, reload } = useQuery<ProcessSummary[]>('/works?mine=1');

  const groups = useMemo(() => {
    const map = new Map<string, ProcessSummary[]>();
    for (const p of data ?? []) {
      const key = `${p.blockName} · ${p.floor} этаж`;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return [...map.entries()];
  }, [data]);

  // Отказ не равен «назначений нет»: во втором случае прораб размечает
  // работы сам, в первом — ждёт связи.
  if (loading || error) {
    return <ScreenState loading={loading} error={error} missing={false} onRetry={reload} />;
  }

  // Назначения нет — уводим на самостоятельную разметку, а не в пустой экран.
  if ((data ?? []).length === 0) {
    return (
      <ScreenBody>
        <div style={{ padding: '36px 24px 0', textAlign: 'center' }}>
          <div style={{ fontSize: 34 }}>🏗</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: color.ink, marginTop: 12 }}>
            ПТО пока не назначил вам работы
          </div>
          <div style={{ fontSize: 14.5, color: color.inkSoft, marginTop: 8, lineHeight: 1.55 }}>
            Можно отметить самому — это займёт минуту. Когда ПТО назначит, список обновится.
          </div>
        </div>
        <div style={{ marginTop: 'auto', padding: '16px 24px 26px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <PrimaryButton onClick={() => go('onboarding-blocks')}>Отметить самому · 1 минута</PrimaryButton>
          <GhostButton onClick={() => setWrongOpen(true)}>Написать в ПТО</GhostButton>
        </div>
        {wrongOpen ? <WrongSheet onClose={() => setWrongOpen(false)} /> : null}
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.muted }}>
            Шаг 2 из 3 · {me?.object?.name ?? ''} — назначен администратором
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: color.primary }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: color.primary }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: color.track }} />
        </div>
        <div style={{ fontSize: 25, fontWeight: 800, color: color.ink, marginTop: 16, lineHeight: 1.25 }}>
          Вот ваши работы
        </div>
        <div style={{ fontSize: 14.5, color: color.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
          Их назначил ПТО. Каждый день вы отчитываетесь по ним — это займёт около 5 минут.
        </div>
      </div>

      <div style={{ padding: '16px 24px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {groups.map(([label, rows]) => (
          <div key={label} style={{ display: 'contents' }}>
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.05em',
                color: color.muted,
                marginTop: 4,
              }}
            >
              {label.toUpperCase()}
            </div>
            {rows.map((r) => (
              <Card key={r.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }}>{r.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexShrink: 0 }}>
                    <span style={{ fontSize: 11, color: color.faint }}>срок</span>
                    <span style={{ fontSize: 12.5, fontWeight: 800, ...dueStyle(r.dueDate), ...tabular }}>
                      {r.dueDate ? new Date(r.dueDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) : '—'}
                    </span>
                  </div>
                </div>
                {r.status === 'blocked' ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      marginTop: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: color.warnText,
                      background: color.warnBg,
                      borderRadius: radius.tag,
                      padding: '3px 8px',
                    }}
                  >
                    {r.blockedReason}
                  </div>
                ) : r.dueDate && new Date(r.dueDate) < new Date() ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      marginTop: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      color: color.warnText,
                      background: color.warnBg,
                      borderRadius: radius.tag,
                      padding: '3px 8px',
                    }}
                  >
                    {dueText(r.dueDate)}
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 24px 26px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <PrimaryButton
          onClick={() => {
            notify('Готово · работы подтверждены');
            go('today');
          }}
        >
          Всё верно · начать
        </PrimaryButton>
        <GhostButton onClick={() => setWrongOpen(true)}>Что-то не так</GhostButton>
      </div>

      {wrongOpen ? <WrongSheet onClose={() => setWrongOpen(false)} /> : null}
    </ScreenBody>
  );
}

/* ─────────────────────── Экран 2 · «Что-то не так» ─────────────────────── */

const WRONG_CHIPS = [
  'Я веду ещё',
  'Это не мой участок',
  'Работы уже закрыты',
  'Не тот блок или этаж',
];

function WrongSheet({ onClose }: { onClose: () => void }) {
  const notify = useApp((s) => s.notify);
  const me = useApp((s) => s.me);
  const [picked, setPicked] = useState(WRONG_CHIPS[0]!);
  const [text, setText] = useState('');

  const send = useAction(async () => {
    if (!me?.objectId) return;
    // Сообщение уходит в ПТО как запрос — назначение исправят там.
    await api.post('/rfi', {
      objectId: me.objectId,
      question: `Назначение работ: ${picked}. ${text}`.trim(),
    });
    notify('Сообщение ушло в ПТО — назначение исправят там');
    onClose();
  });

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color.ink, marginTop: 14 }}>Что не так?</div>
      <div style={{ fontSize: 13, color: color.inkMuted, marginTop: 3, lineHeight: 1.45 }}>
        Сообщение уйдёт в ПТО — назначение исправят там.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
        {WRONG_CHIPS.map((c) => (
          <Chip key={c} tone="dark" active={picked === c} onClick={() => setPicked(c)} style={{ fontSize: 12.5 }}>
            {c}
          </Chip>
        ))}
      </div>

      <div
        style={{
          marginTop: 10,
          background: color.screen,
          border: `1.5px solid ${color.border}`,
          borderRadius: radius.sm,
          padding: '12px 14px',
          display: 'flex',
          gap: 10,
          alignItems: 'center',
          minHeight: 56,
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Например: ещё веду сантехнику на 4 этаже Блока Б"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            fontSize: 14,
            color: color.ink,
            fontFamily: 'inherit',
          }}
        />
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.sm,
            background: color.primaryBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 17,
            flex: 'none',
          }}
        >
          🎤
        </div>
      </div>

      <PrimaryButton onClick={() => send.run()} disabled={send.busy} style={{ marginTop: 14, height: 54 }}>
        Отправить в ПТО
      </PrimaryButton>
    </BottomSheet>
  );
}

/* ─────────────────────── Экраны 3–4 · Самостоятельная разметка ─────────────────────── */

export function OnboardingBlocksScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const { data: objects } = useQuery<ObjectDto[]>('/objects');
  const object = objects?.find((o) => o.id === me?.objectId);
  const [picked, setPicked] = useState<string[]>(me?.blockId ? [me.blockId] : []);

  return (
    <ScreenBody>
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: color.muted }}>Настройка · шаг 1 из 2</div>
        <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: color.primary }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: color.track }} />
        </div>
        <div style={{ fontSize: 25, fontWeight: 800, color: color.ink, marginTop: 16, lineHeight: 1.25 }}>
          Что вы ведёте?
        </div>
        <div style={{ fontSize: 14.5, color: color.inkSoft, marginTop: 6, lineHeight: 1.5 }}>
          Отметьте — и главный экран сразу станет рабочим. Это займёт минуту.
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: color.ink, marginTop: 16 }}>
          Блок · можно несколько
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 24px 0' }}>
        {(object?.blocks ?? []).map((b) => {
          const on = picked.includes(b.id);
          return (
            <div
              key={b.id}
              onClick={() => setPicked((p) => (on ? p.filter((x) => x !== b.id) : [...p, b.id]))}
              style={{
                cursor: 'pointer',
                background: color.surface,
                borderRadius: radius.card,
                padding: 16,
                display: 'flex',
                gap: 14,
                alignItems: 'center',
                boxShadow: '0 2px 8px rgba(20,22,31,0.06)',
                ...(on ? { border: `2px solid ${color.primary}` } : null),
              }}
            >
              <CheckSquare on={on} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: color.ink }}>{b.name}</div>
                <div style={{ fontSize: 13, color: color.muted }}>{b.floors} этажей</div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 24px 26px' }}>
        <PrimaryButton onClick={() => go('onboarding-sections')} disabled={picked.length === 0}>
          Дальше
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

export function OnboardingSectionsScreen() {
  const go = useApp((s) => s.go);
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);
  const { data: sections } = useQuery<SectionDto[]>('/sections');
  const [picked, setPicked] = useState<string[]>(['mono', 'klad']);

  // Число работ считается сразу: разделы × активные этажи.
  const activeFloors = 4;
  const count = picked.length * activeFloors;

  return (
    <ScreenBody>
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.muted }}>Настройка · шаг 2 из 2</div>
          <div
            onClick={back}
            style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: color.primary }}
          >
            ‹ Назад
          </div>
        </div>
        <div style={{ display: 'flex', gap: 5, marginTop: 10 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: color.primary }} />
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: color.primary }} />
        </div>
        <div style={{ fontSize: 25, fontWeight: 800, color: color.ink, marginTop: 16, lineHeight: 1.25 }}>
          Разделы работ
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '14px 24px 0' }}>
        {(sections ?? []).map((s) => (
          <Chip
            key={s.id}
            active={picked.includes(s.id)}
            onClick={() =>
              setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))
            }
            style={{ fontSize: 13 }}
          >
            {s.name}
          </Chip>
        ))}
      </div>

      <Card
        style={{
          margin: '14px 24px 0',
          borderRadius: radius.sm,
          padding: '13px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: color.muted }}>ЭТАЖИ</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: color.ink, marginTop: 2 }}>
            все активные (5–8)
          </div>
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: color.primary }}>Уточнить</div>
      </Card>

      <div
        style={{
          margin: '10px 24px 0',
          background: color.primaryBg,
          border: `1px solid ${color.primaryBorder}`,
          borderRadius: radius.md,
          padding: '14px 16px',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, ...tabular }}>
          Ваши работы: {count}
        </div>
        <div style={{ fontSize: 13, color: color.primaryDark, marginTop: 3, lineHeight: 1.45 }}>
          {picked.map((id) => sections?.find((s) => s.id === id)?.name).filter(Boolean).join(', ')} ·{' '}
          {activeFloors} активных этажа
        </div>
      </div>

      <div style={{ margin: '10px 24px 0', fontSize: 12, color: color.faint, lineHeight: 1.5 }}>
        4 тапа вместо 20+. Количество тапов не растёт с размером объекта — даже при 2 блоках × 16 этажей ×
        8 разделов.
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 24px 26px' }}>
        <PrimaryButton
          onClick={() => {
            notify('Настроено · главный экран стал рабочим');
            go('today');
          }}
          disabled={picked.length === 0}
        >
          Готово
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}
