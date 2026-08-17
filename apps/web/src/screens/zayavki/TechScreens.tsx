/**
 * ТХ1 · Заявка на спецтехнику и ТХ3 · Отчёт по технике.
 *
 * Заявка не уходит, пока фронт не готов: техника, приехавшая на неготовую
 * площадку, — это простой, за который платит компания. Отчёт после смены
 * обязателен: без него нет ни моточасов, ни причины простоя.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Card, CheckSquare, Chip, PrimaryButton, SectionLabel, tabular } from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { MachineDto, ZayavkaDto } from '../../api/types';
import { useApp } from '../../store/app';
import { DataState } from '../../design/DataState';
import { DataRows, type Column } from '../../design/DataRows';

const MACHINE_TYPES = ['Кран', 'Экскаватор', 'Автобетононасос', 'Самосвал', 'Погрузчик'];

const FRONT_CHECKLIST = [
  { key: 'access', label: 'Подъезд свободен, площадка под опоры готова' },
  { key: 'people', label: 'Стропальщик с удостоверением на смене' },
  { key: 'front', label: 'Фронт работ размечен и освобождён' },
  { key: 'power', label: 'Питание / подключение обеспечено' },
  { key: 'safety', label: 'Опасная зона огорожена, схема согласована' },
];

export function TechZayavkaScreen() {
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);
  const me = useApp((s) => s.me);

  const [machineType, setMachineType] = useState(MACHINE_TYPES[0]!);
  const [hours, setHours] = useState('8');
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().slice(0, 10);
  });
  const [timeFrom, setTimeFrom] = useState('08:00');
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  const ready = FRONT_CHECKLIST.every((c) => checked[c.key]);

  const create = useAction(async () => {
    if (!me?.objectId) return;
    const res = await api.post<{ id: string; number: string }>('/zayavki', {
      kind: 'tech',
      objectId: me.objectId,
      priority: 'norm',
      items: [{ rawText: `${machineType} · ${hours} ч`, qty: Number(hours) || 1, unit: 'сут' }],
      tech: {
        machineType,
        hours: Number(hours) || 1,
        date,
        timeFrom,
        frontChecklist: FRONT_CHECKLIST.map((c) => ({ ...c, checked: Boolean(checked[c.key]) })),
      },
    });
    notify(`${res.number} ушла координатору техники`);
    go('zayavka', { zayavkaId: res.id });
  });

  return (
    <ScreenBody>
      <ScreenHeader title="Заявка на технику" subtitle="спецтехника" onBack={back} />

      <Card style={{ margin: '4px 20px' }}>
        <SectionLabel>ЧТО НУЖНО</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 8 }}>
          {MACHINE_TYPES.map((t) => (
            <Chip key={t} active={machineType === t} onClick={() => setMachineType(t)} style={{ fontSize: 12 }}>
              {t}
            </Chip>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <LabeledInput label="ДАТА" type="date" value={date} onChange={setDate} />
          <LabeledInput label="С" type="time" value={timeFrom} onChange={setTimeFrom} width={100} />
          <LabeledInput label="ЧАСОВ" value={hours} onChange={setHours} width={80} />
        </div>
      </Card>

      {/* Чек-лист готовности фронта: пока не отмечено всё, заявка не уходит. */}
      <Card style={{ margin: '8px 20px' }}>
        <SectionLabel>ГОТОВНОСТЬ ФРОНТА</SectionLabel>
        <div style={{ fontSize: 12, color: color.muted, marginTop: 4, lineHeight: 1.45 }}>
          Техника, приехавшая на неготовую площадку, — это простой, за который платит компания.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
          {FRONT_CHECKLIST.map((c) => (
            <div
              key={c.key}
              onClick={() => setChecked((s) => ({ ...s, [c.key]: !s[c.key] }))}
              style={{
                cursor: 'pointer',
                background: color.screen,
                borderRadius: radius.xs,
                padding: '11px 12px',
                display: 'flex',
                gap: 10,
                alignItems: 'center',
              }}
            >
              <CheckSquare on={Boolean(checked[c.key])} size={22} />
              <div style={{ fontSize: 13, color: color.ink, lineHeight: 1.4 }}>{c.label}</div>
            </div>
          ))}
        </div>
      </Card>

      {create.error ? (
        <div style={{ margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }}>
          {create.error}
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        {!ready ? (
          <div style={{ fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center', marginBottom: 8 }}>
            Отметьте всю готовность фронта — иначе заявка не уйдёт
          </div>
        ) : null}
        <PrimaryButton onClick={() => create.run()} disabled={!ready || create.busy}>
          Отправить заявку
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── ТХ3 · Отчёт по технике ───────────────────────────── */

export function TechReportScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);

  const { data: zayavka } = useQuery<ZayavkaDto>(params.zayavkaId ? `/zayavki/${params.zayavkaId}` : null);

  const [actual, setActual] = useState('');
  const [idle, setIdle] = useState('0');
  const [idleReason, setIdleReason] = useState<string | null>(null);
  const [fuel, setFuel] = useState('');
  const [faults, setFaults] = useState('');

  const idleNum = Number(idle.replace(',', '.')) || 0;

  const submit = useAction(async () => {
    if (!zayavka?.tech) return;
    await api.post(`/tech/${zayavka.tech.id}/report`, {
      hoursPlanned: zayavka.tech.hours,
      hoursActual: Number(actual.replace(',', '.')) || 0,
      idleHours: idleNum,
      idleReason: idleReason ?? undefined,
      fuel: fuel ? Number(fuel.replace(',', '.')) : undefined,
      faults: faults || undefined,
    });
    notify('Смена закрыта · моточасы и простой учтены');
    go('tech-queue');
  });

  if (!zayavka?.tech) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  const blocker =
    !actual
      ? 'Укажите фактические часы'
      : idleNum > 0 && !idleReason
        ? 'Укажите причину простоя'
        : null;

  return (
    <ScreenBody>
      <ScreenHeader
        title="Отчёт по технике"
        subtitle={`${zayavka.tech.machineType} · ${zayavka.number}`}
        onBack={back}
      />

      <Card style={{ margin: '4px 20px' }}>
        <div style={{ fontSize: 13, color: color.muted, ...tabular }}>
          План: {zayavka.tech.hours} ч · {new Date(zayavka.tech.date).toLocaleDateString('ru-RU')} с{' '}
          {zayavka.tech.timeFrom}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
          <LabeledInput label="ФАКТ, Ч" value={actual} onChange={setActual} width={100} />
          <LabeledInput label="ПРОСТОЙ, Ч" value={idle} onChange={setIdle} width={110} />
          <LabeledInput label="ТОПЛИВО, Л" value={fuel} onChange={setFuel} width={110} />
        </div>

        {idleNum > 0 ? (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: color.muted }}>ПРИЧИНА ПРОСТОЯ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {['фронт не готов', 'нет материала', 'погода', 'неисправность', 'нет людей'].map((r) => (
                <Chip key={r} tone="dark" active={idleReason === r} onClick={() => setIdleReason(r)} style={{ fontSize: 12 }}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card style={{ margin: '8px 20px' }}>
        <SectionLabel>НЕИСПРАВНОСТИ</SectionLabel>
        <input
          value={faults}
          onChange={(e) => setFaults(e.target.value)}
          placeholder="если есть — уйдёт главному инженеру"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: 'none',
            outline: 'none',
            background: color.screen,
            borderRadius: radius.xs,
            padding: '11px 12px',
            fontSize: 14,
            color: color.ink,
            marginTop: 8,
            fontFamily: 'inherit',
          }}
        />
      </Card>

      {submit.error ? (
        <div style={{ margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }}>
          {submit.error}
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        {blocker ? (
          <div style={{ fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center', marginBottom: 8 }}>
            {blocker}
          </div>
        ) : null}
        <PrimaryButton onClick={() => submit.run()} disabled={Boolean(blocker) || submit.busy}>
          Закрыть смену
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── СТ3 · Парк и график ───────────────────────────── */

export function FleetScreen() {
  const { data, loading, error, reload } = useQuery<MachineDto[]>('/machines');
  const machines = data ?? [];

  /** Диспетчер выбирает машину, сравнивая занятость, ТО и допуск построчно. */
  const columns: Column<MachineDto>[] = [
    { key: 'name', title: 'Машина', primary: true, cell: (m) => m.name },
    { key: 'kind', title: 'Тип', cell: (m) => m.kind },
    {
      key: 'status',
      title: 'Состояние',
      cell: (m) => (
        <span
          style={{
            fontWeight: 800,
            ...(m.status === 'free'
              ? { color: color.greenDeep }
              : m.status === 'busy'
                ? { color: color.primary }
                : { color: color.warnText }),
          }}
        >
          {m.status === 'free' ? 'свободна' : m.status === 'busy' ? 'занята' : 'в ремонте'}
        </span>
      ),
    },
    {
      key: 'service',
      title: 'ТО',
      align: 'right',
      cell: (m) =>
        m.nextServiceAt ? (
          <span style={{ color: m.serviceSoon ? color.warnText : color.muted, ...tabular }}>
            {new Date(m.nextServiceAt).toLocaleDateString('ru-RU')}
          </span>
        ) : (
          '—'
        ),
    },
    {
      key: 'permit',
      title: 'Допуск до',
      align: 'right',
      cell: (m) =>
        m.permitUntil ? (
          <span style={{ color: m.permitExpiring ? color.danger : color.muted, ...tabular }}>
            {new Date(m.permitUntil).toLocaleDateString('ru-RU')}
          </span>
        ) : (
          '—'
        ),
    },
  ];

  return (
    <ScreenBody>
      <ScreenHeader title="Парк техники" subtitle={`${machines.length} единиц`} padding="16px 20px 8px" />
      <div style={{ padding: '4px 20px 20px' }}>
        <DataState
          loading={loading}
          error={error}
          empty={machines.length === 0}
          emptyText="Машин в парке пока нет"
          onRetry={reload}
        >
          <DataRows items={machines} columns={columns} keyOf={(m) => m.id} />
        </DataState>
      </div>
    </ScreenBody>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  width,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  width?: number;
}) {
  return (
    <div style={{ flex: width ? 'none' : 1, width }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted }}>{label}</div>
      <input
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: 'none',
          outline: 'none',
          background: color.screen,
          borderRadius: radius.xs,
          padding: '10px 12px',
          fontSize: 15,
          fontWeight: 700,
          color: color.ink,
          marginTop: 4,
          fontFamily: 'inherit',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
    </div>
  );
}
