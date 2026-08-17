/**
 * A7 · Предъявление к освидетельствованию.
 *
 * Даты раньше чем через 3 рабочих дня недоступны: по норме извещение подаётся
 * не позднее этого срока. Они показаны зачёркнутыми, а не спрятаны — иначе
 * непонятно, почему ближайшая дата такая далёкая.
 */
import { useMemo, useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Card, CheckSquare, PrimaryButton, SectionLabel } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { ProcessDetail } from '../../api/types';
import { useApp } from '../../store/app';
import { ScreenState } from '../../design/DataState';

const CHECKLIST = [
  { key: 'complete', label: 'Работа завершена полностью на захватке' },
  { key: 'clean', label: 'Участок убран, доступен для осмотра' },
  { key: 'geometry', label: 'Геометрия проверена, исполнительная схема есть' },
  { key: 'passports', label: 'Материалы имеют паспорта и прошли входной контроль' },
  { key: 'prevAosr', label: 'Предыдущий АОСР подписан' },
  { key: 'remarks', label: 'Замечания прошлого раза устранены' },
];

const NOTIFY = ['ПТО · Гульмира С.', 'Технадзор · Бакыт О.', 'Авторский надзор'];

/** Ближайшие даты: рабочие дни, первые три недоступны по норме извещения. */
function nextDates(count = 6): { date: Date; allowed: boolean }[] {
  const result: { date: Date; allowed: boolean }[] = [];
  const cursor = new Date();
  let workdays = 0;
  while (result.length < count) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day === 0 || day === 6) continue;
    workdays += 1;
    result.push({ date: new Date(cursor), allowed: workdays >= 3 });
  }
  return result;
}

export function PresentScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);

  const { data: process, loading, error, reload } = useQuery<ProcessDetail>(
    params.processStateId ? `/process/${params.processStateId}` : null,
  );

  const dates = useMemo(() => nextDates(), []);
  const [checked, setChecked] = useState<Record<string, boolean>>({
    complete: true,
    clean: true,
    geometry: true,
    passports: false,
    prevAosr: true,
    remarks: true,
  });
  const [picked, setPicked] = useState<string>(
    dates.find((d) => d.allowed)?.date.toISOString() ?? new Date().toISOString(),
  );
  const [recipients, setRecipients] = useState<string[]>(NOTIFY);

  const submit = useAction(async () => {
    if (!process) return;
    await api.post(`/process/${process.id}/present`, {
      checklist: CHECKLIST.map((c) => ({ ...c, checked: Boolean(checked[c.key]) })),
      date: picked,
      notify: recipients,
    });
    notify('Ушло в ПТО и технадзору · извещение за 3 рабочих дня');
    go('chain', {
      sectionId: process.sectionId,
      blockId: process.blockId,
      floor: process.floor,
    });
  });

  if (loading || error || !process) {
    return (
      <ScreenState
        loading={loading}
        error={error}
        missing={!process}
        missingText="Процесс не найден"
        onRetry={reload}
      />
    );
  }

  const unchecked = CHECKLIST.filter((c) => !checked[c.key]);

  return (
    <ScreenBody>
      <ScreenHeader
        title="Предъявить к освидетельствованию"
        subtitle={`${process.name} · ${process.blockName} · ${process.floor} эт.`}
        onBack={back}
      />

      <SectionLabel style={{ padding: '4px 20px 6px' }}>ЧЕК-ЛИСТ ГОТОВНОСТИ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
        {CHECKLIST.map((c) => (
          <div
            key={c.key}
            onClick={() => setChecked((s) => ({ ...s, [c.key]: !s[c.key] }))}
            style={{
              cursor: 'pointer',
              background: color.surface,
              borderRadius: radius.sm,
              padding: '12px 14px',
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
            }}
          >
            <CheckSquare on={Boolean(checked[c.key])} size={24} />
            <div style={{ fontSize: 13.5, color: color.ink, lineHeight: 1.4 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {unchecked.length > 0 ? (
        <div
          style={{
            margin: '8px 20px 0',
            background: color.warnBg,
            border: `1px solid ${color.warnBorder}`,
            borderRadius: radius.smAlt,
            padding: '10px 12px',
            fontSize: 12.5,
            fontWeight: 700,
            color: color.warnText,
            lineHeight: 1.45,
          }}
        >
          Не отмечено: {unchecked.map((c) => c.label.toLowerCase()).join('; ')}. Технадзор проверит это на месте.
        </div>
      ) : null}

      <SectionLabel style={{ padding: '14px 20px 6px' }}>ДАТА ОСВИДЕТЕЛЬСТВОВАНИЯ</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 20px' }}>
        {dates.map((d) => {
          const iso = d.date.toISOString();
          const on = picked === iso;
          return (
            <div
              key={iso}
              onClick={d.allowed ? () => setPicked(iso) : undefined}
              style={{
                cursor: d.allowed ? 'pointer' : 'default',
                borderRadius: radius.smAlt,
                padding: '10px 13px',
                fontSize: 13,
                fontWeight: on ? 800 : 600,
                ...(d.allowed
                  ? on
                    ? { background: color.primary, color: '#fff' }
                    : { background: color.surface, color: color.ink, border: `1px solid ${color.border}` }
                  : {
                      background: color.screen,
                      color: color.disabled,
                      textDecoration: 'line-through',
                    }),
              }}
            >
              {d.date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '8px 20px 0', fontSize: 11.5, color: color.faint, lineHeight: 1.45 }}>
        по норме извещение — не позднее чем за 3 рабочих дня
      </div>

      <SectionLabel style={{ padding: '14px 20px 6px' }}>КОГО ИЗВЕЩАЕМ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
        {NOTIFY.map((n) => {
          const on = recipients.includes(n);
          return (
            <Card
              key={n}
              onClick={() =>
                setRecipients((list) => (list.includes(n) ? list.filter((x) => x !== n) : [...list, n]))
              }
              style={{
                borderRadius: radius.sm,
                padding: '12px 14px',
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
              }}
            >
              <CheckSquare on={on} size={24} />
              <div style={{ fontSize: 13.5, color: color.ink }}>{n}</div>
            </Card>
          );
        })}
      </div>

      {submit.error ? (
        <div style={{ margin: '10px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }}>
          {submit.error}
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        <PrimaryButton onClick={() => submit.run()} disabled={submit.busy || recipients.length === 0}>
          Предъявить
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}
