/**
 * Роль ПТО: T1 «Сегодня», T2 очередь приёмки, C2/C3 проверка и корректировка,
 * T6/T7 объекты, Г4 настройка цепочки, ADM1–ADM3 пользователи.
 *
 * ПТО — единственная роль, которая может изменить чужие данные, поэтому у
 * корректировки обязательна причина: прораб увидит её в своём отчёте.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import {
  Badge,
  Card,
  CheckSquare,
  Chip,
  PrimaryButton,
  SectionLabel,
  formatNumber,
  tabular,
} from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type {
  DocumentDto,
  NotificationDto,
  ObjectDto,
  ProtocolDto,
  ReportDto,
  SectionDto,
  UserDto,
} from '../../api/types';
import { ROLE_TITLE, ROLES, type Role } from '@build-hub/shared';
import { useApp } from '../../store/app';
import { DataState, ScreenState } from '../../design/DataState';
import { DataRows, type Column } from '../../design/DataRows';

/* ───────────────────────────── T1 · Сегодня ───────────────────────────── */

export function PtoTodayScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const { data: queue } = useQuery<ReportDto[]>('/reports/queue');
  const { data: notifications, reload } = useQuery<NotificationDto[]>('/notifications?unread=1');
  const { data: protocols } = useQuery<ProtocolDto[]>('/strength-protocols');

  const blocking = (protocols ?? []).filter((p) => p.blocksStripping);

  return (
    <ScreenBody>
      <RootHeader
        title="Сегодня"
        subtitle={`${me?.fullName ?? ''} · инженер ПТО`}
      />

      {(notifications ?? []).length > 0 ? (
        <>
          <SectionLabel tone="green" style={{ padding: '4px 20px 0', fontSize: 12.5, fontWeight: 800 }}>
            🔔 НОВОЕ С ПЛОЩАДКИ · {notifications!.length}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '6px 20px 0' }}>
            {notifications!.slice(0, 4).map((n) => (
              <div
                key={n.id}
                onClick={async () => {
                  await api.post(`/notifications/${n.id}/read`);
                  reload();
                }}
                style={{
                  cursor: 'pointer',
                  background: color.greenBg,
                  border: `1px solid ${color.greenBorder}`,
                  borderRadius: radius.md,
                  padding: '12px 15px',
                }}
              >
                <div style={{ fontSize: 14, fontWeight: 800, color: color.ink }}>{n.title}</div>
                <div style={{ fontSize: 12.5, color: color.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
                  {n.subtitle}
                </div>
                <div style={{ fontSize: 11, color: color.greenMuted, marginTop: 5 }}>тап — прочитано</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 20px' }}>
        <Card
          onClick={() => go('pto-queue')}
          style={{
            borderRadius: radius.md,
            padding: '14px 16px',
            ...((queue ?? []).length > 0 ? { border: `1.5px solid ${color.primaryBorder}` } : null),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink }}>Отчёты на проверку</div>
            <Badge tone={(queue ?? []).length > 0 ? 'primary' : 'green'}>
              {(queue ?? []).length > 0 ? `${queue!.length} ждут` : 'очередь пуста'}
            </Badge>
          </div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
            Подтвердить · скорректировать · вернуть
          </div>
        </Card>

        <Card onClick={() => go('pto-objects')} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink }}>Объекты и цепочки</div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
            Состав процессов по разделам, ведомость объёмов
          </div>
        </Card>

        <Card
          onClick={() => go('pto-lab')}
          style={{
            borderRadius: radius.md,
            padding: '14px 16px',
            ...(blocking.length > 0 ? { border: `1.5px solid ${color.warnBorder}` } : null),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink }}>Лаборатория</div>
            <Badge tone={blocking.length > 0 ? 'warn' : 'green'}>
              {blocking.length > 0 ? `${blocking.length} держит работу` : 'нет ограничений'}
            </Badge>
          </div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
            Протоколы прочности бетона — шлюз распалубки
          </div>
        </Card>

        <Card onClick={() => go('pto-users')} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
          <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink }}>Пользователи и доступы</div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
            Завести прораба или мастера, сбросить пароль
          </div>
        </Card>
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── T2 · Очередь ───────────────────────────── */

export function PtoQueueScreen() {
  const go = useApp((s) => s.go);
  const { data: queue, loading, error, reload } = useQuery<ReportDto[]>('/reports/queue');
  const reports = queue ?? [];

  /**
   * Очередь приёмки — тот самый случай, ради которого таблица и нужна:
   * ПТО сравнивает отчёты между собой, а не читает каждый по отдельности.
   */
  const columns: Column<ReportDto>[] = [
    { key: 'author', title: 'Прораб', primary: true, cell: (r) => r.authorName },
    { key: 'object', title: 'Объект', cell: (r) => r.objectName },
    {
      key: 'date',
      title: 'Дата',
      align: 'right',
      cell: (r) => <span style={{ ...tabular }}>{new Date(r.date).toLocaleDateString('ru-RU')}</span>,
    },
    {
      key: 'entries',
      title: 'Записей',
      align: 'right',
      cell: (r) => <span style={{ ...tabular }}>{r.entries.length}</span>,
    },
    {
      key: 'photos',
      title: 'Фото',
      align: 'right',
      cell: (r) => (
        <span style={{ ...tabular }}>{r.entries.reduce((n, e) => n + e.photos.length, 0)}</span>
      ),
    },
    {
      key: 'fill',
      title: 'Заполнял',
      align: 'right',
      desktopOnly: true,
      cell: (r) => (
        <span style={{ ...tabular }}>{r.fillSeconds ? `${Math.round(r.fillSeconds / 60)} мин` : '—'}</span>
      ),
    },
  ];

  return (
    <ScreenBody>
      <RootHeader title="Приёмка" subtitle={`${reports.length} отчётов ждут проверки`} />

      <div style={{ padding: '8px 20px 20px' }}>
        <DataState
          loading={loading}
          error={error}
          empty={reports.length === 0}
          emptyText="Очередь пуста — все отчёты проверены"
          onRetry={reload}
        >
          <DataRows
            items={reports}
            columns={columns}
            keyOf={(r) => r.id}
            onRowClick={(r) => go('pto-check', { reportId: r.id })}
          />
        </DataState>
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────── C2/C3 · Проверка и корректировка ───────────────────────── */

export function PtoCheckScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);

  const { data: report, loading, error, reload } = useQuery<ReportDto>(params.reportId ? `/report/${params.reportId}` : null);

  const [adjusting, setAdjusting] = useState<string | null>(null);
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');
  const [returnComment, setReturnComment] = useState('');
  const [returning, setReturning] = useState(false);
  const [disputed, setDisputed] = useState<string[]>([]);

  const decide = useAction(async (body: Record<string, unknown>) => {
    await api.post(`/report/${params.reportId}/check`, body);
    notify(
      body.decision === 'accept'
        ? 'Отчёт подтверждён · данные ушли руководству'
        : body.decision === 'adjust'
          ? 'Корректировка сохранена · прораб увидит причину'
          : 'Отчёт возвращён прорабу',
    );
    go('pto-queue');
  });

  if (loading || error || !report) {
    return (
      <ScreenState
        loading={loading}
        error={error}
        missing={!report}
        missingText="Отчёт не найден"
        onRetry={reload}
      />
    );
  }

  return (
    <ScreenBody>
      <ScreenHeader
        title={`Отчёт ${report.authorName ?? ''}`}
        subtitle={`${new Date(report.date).toLocaleDateString('ru-RU')} · ${report.objectName ?? ''}`}
        onBack={back}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 0' }}>
        {report.entries.map((e) => (
          <Card key={e.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }}>{e.title}</div>
              {returning ? (
                <div
                  onClick={() =>
                    setDisputed((d) => (d.includes(e.id) ? d.filter((x) => x !== e.id) : [...d, e.id]))
                  }
                  style={{ cursor: 'pointer', flexShrink: 0 }}
                >
                  <CheckSquare on={disputed.includes(e.id)} size={22} />
                </div>
              ) : null}
            </div>

            <div style={{ fontSize: 14, color: color.inkMuted, marginTop: 6, ...tabular }}>
              <b style={{ color: color.ink }}>
                +{formatNumber(e.volume, e.unit === 'т' ? 2 : 0)} {e.unit}
              </b>{' '}
              · {e.workers} чел · {e.photos.length} фото
            </div>

            {e.tempAir !== null ? (
              <div style={{ fontSize: 12, color: color.muted, marginTop: 3, ...tabular }}>
                🌡 воздух {e.tempAir} °C
                {e.tempMix !== null ? ` · смесь ${e.tempMix} °C` : ''}
                {e.winterMethod ? ` · ${e.winterMethod}` : ''}
              </div>
            ) : null}

            {e.problems.length > 0 ? (
              <div style={{ fontSize: 12, color: color.warnStrong, fontWeight: 700, marginTop: 3 }}>
                ⚠ {e.problems.join(', ')}
              </div>
            ) : null}

            {e.photos.length > 0 ? (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                {e.photos.map((p) => (
                  <div
                    key={p.id}
                    title={`${new Date(p.takenAt).toLocaleString('ru-RU')}${p.lat ? ` · ${p.lat.toFixed(4)}, ${p.lon?.toFixed(4)}` : ''}`}
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: radius.xs,
                      background: 'repeating-linear-gradient(45deg,#D8DAE3 0 8px,#E7E9F0 8px 16px)',
                    }}
                  />
                ))}
                <div style={{ fontSize: 11, color: color.faint, alignSelf: 'flex-end' }}>
                  📍 с геометкой и временем
                </div>
              </div>
            ) : null}

            {adjusting === e.id ? (
              <div
                style={{
                  marginTop: 10,
                  background: color.screen,
                  borderRadius: radius.xs,
                  padding: '10px 12px',
                }}
              >
                <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted }}>НОВОЕ ЗНАЧЕНИЕ</div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <input
                    value={newValue}
                    onChange={(ev) => setNewValue(ev.target.value)}
                    style={{
                      width: 96,
                      boxSizing: 'border-box',
                      border: 'none',
                      outline: 'none',
                      background: color.surface,
                      borderRadius: radius.xs,
                      padding: '10px 12px',
                      fontSize: 16,
                      fontWeight: 800,
                      textAlign: 'center',
                      color: color.ink,
                      fontFamily: 'inherit',
                      ...tabular,
                    }}
                  />
                  <div style={{ fontSize: 14, color: color.muted }}>{e.unit}</div>
                </div>
                {/* Причина обязательна: прораб увидит именно её, а не «исправлено». */}
                <input
                  value={reason}
                  onChange={(ev) => setReason(ev.target.value)}
                  placeholder="Причина корректировки — её увидит прораб"
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    background: color.surface,
                    borderRadius: radius.xs,
                    padding: '10px 12px',
                    fontSize: 13,
                    color: color.ink,
                    marginTop: 8,
                    fontFamily: 'inherit',
                  }}
                />
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <div
                    onClick={() => setAdjusting(null)}
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      textAlign: 'center',
                      background: color.chip,
                      borderRadius: radius.xs,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 700,
                      color: color.ink,
                    }}
                  >
                    Отмена
                  </div>
                  <div
                    onClick={() =>
                      Number(newValue.replace(',', '.')) > 0 &&
                      reason.trim() &&
                      decide.run({
                        decision: 'adjust',
                        adjustment: {
                          entryId: e.id,
                          to: Number(newValue.replace(',', '.')),
                          reason: reason.trim(),
                        },
                      })
                    }
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      textAlign: 'center',
                      background: reason.trim() && Number(newValue.replace(',', '.')) > 0 ? color.primary : color.disabled,
                      color: '#fff',
                      borderRadius: radius.xs,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    Сохранить
                  </div>
                </div>
              </div>
            ) : (
              <div
                onClick={() => {
                  setAdjusting(e.id);
                  setNewValue(String(e.volume));
                  setReason('');
                }}
                style={{
                  cursor: 'pointer',
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: color.primary,
                  marginTop: 8,
                }}
              >
                ✎ Скорректировать объём
              </div>
            )}
          </Card>
        ))}
      </div>

      {returning ? (
        <Card style={{ margin: '10px 20px 0' }}>
          <SectionLabel>ЗАМЕЧАНИЕ ПРОРАБУ</SectionLabel>
          <input
            value={returnComment}
            onChange={(e) => setReturnComment(e.target.value)}
            placeholder="Что проверить — прораб увидит текст"
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
          <div style={{ fontSize: 11.5, color: color.faint, marginTop: 6 }}>
            Отметьте галочками спорные записи выше — они подсветятся у прораба.
          </div>
        </Card>
      ) : null}

      <div
        style={{
          marginTop: 'auto',
          padding: '16px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {returning ? (
          <>
            <PrimaryButton
              onClick={() =>
                decide.run({ decision: 'return', comment: returnComment, returnedFields: disputed })
              }
              disabled={returnComment.trim().length < 5}
              style={{ background: color.warnAccent, boxShadow: 'none' }}
            >
              Вернуть прорабу
            </PrimaryButton>
            <div
              onClick={() => setReturning(false)}
              style={{
                cursor: 'pointer',
                height: 48,
                borderRadius: radius.md,
                background: color.chip,
                color: color.ink,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              Отмена
            </div>
          </>
        ) : (
          <>
            <PrimaryButton onClick={() => decide.run({ decision: 'accept' })} disabled={decide.busy}>
              Подтвердить
            </PrimaryButton>
            <div
              onClick={() => setReturning(true)}
              style={{
                cursor: 'pointer',
                height: 50,
                borderRadius: radius.md,
                background: color.warnBg,
                border: `1px solid ${color.warnBorder}`,
                color: color.warnText,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14.5,
                fontWeight: 800,
              }}
            >
              Вернуть с замечанием
            </div>
          </>
        )}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── T6/T7 · Объекты и цепочки ───────────────────────────── */

export function PtoObjectsScreen() {
  const go = useApp((s) => s.go);
  const { data, loading, error, reload } = useQuery<ObjectDto[]>('/objects');
  const objects = data ?? [];

  const columns: Column<ObjectDto>[] = [
    { key: 'name', title: 'Объект', primary: true, cell: (o) => o.name },
    {
      key: 'delta',
      title: 'График',
      align: 'right',
      cell: (o) => (
        <span
          style={{
            fontWeight: 800,
            ...tabular,
            color: o.deltaDays < -5 ? color.danger : o.deltaDays < 0 ? color.warnStrong : color.greenDeep,
          }}
        >
          {o.deltaDays === 0 ? 'по графику' : `${o.deltaDays} дн.`}
        </span>
      ),
    },
    {
      key: 'pct',
      title: 'План / факт',
      align: 'right',
      cell: (o) => (
        <span style={{ ...tabular }}>
          {o.pctPlan}% / {o.pctFact.toFixed(1).replace('.', ',')}%
        </span>
      ),
    },
    {
      key: 'size',
      title: 'Состав',
      desktopOnly: true,
      cell: (o) => <span style={{ ...tabular }}>{o.blocks.length} бл. · {o.floorsTotal} эт.</span>,
    },
    {
      key: 'resp',
      title: 'Ответственный',
      desktopOnly: true,
      cell: (o) => o.responsible?.fullName ?? '—',
    },
  ];

  return (
    <ScreenBody>
      <RootHeader title="Объекты" subtitle={`${objects.length} объектов компании`} />
      <div style={{ padding: '8px 20px 20px' }}>
        <DataState
          loading={loading}
          error={error}
          empty={objects.length === 0}
          emptyText="Объектов пока нет"
          onRetry={reload}
        >
          <DataRows
            items={objects}
            columns={columns}
            keyOf={(o) => o.id}
            onRowClick={(o) => go('pto-object', { objectId: o.id })}
          />
        </DataState>
      </div>
    </ScreenBody>
  );
}

export function PtoObjectScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const { data: objects } = useQuery<ObjectDto[]>('/objects');
  const { data: sections } = useQuery<SectionDto[]>('/sections');
  const object = objects?.find((o) => o.id === params.objectId);

  if (!object) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  return (
    <ScreenBody>
      <ScreenHeader title={object.name} subtitle={`${object.address} · ${object.city}`} onBack={back} />

      <Card style={{ margin: '4px 20px' }}>
        <div style={{ fontSize: 13, color: color.inkMuted, ...tabular }}>
          План {object.pctPlan}% · факт {object.pctFact.toFixed(1).replace('.', ',')}% · срок сдачи{' '}
          {new Date(object.dueDate).toLocaleDateString('ru-RU')}
        </div>
        <div style={{ fontSize: 12.5, color: color.muted, marginTop: 4 }}>
          {object.blocks.map((b) => `${b.name} (${b.floors} эт.)`).join(' · ')}
        </div>
      </Card>

      <SectionLabel style={{ padding: '12px 20px 6px' }}>ЦЕПОЧКИ ПРОЦЕССОВ ПО РАЗДЕЛАМ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
        {(sections ?? []).map((s) => (
          <Card
            key={s.id}
            onClick={() => go('pto-chain-setup', { sectionId: s.id })}
            style={{ borderRadius: radius.md, padding: '14px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>{s.name}</div>
              <div style={{ color: color.faint, fontSize: 16 }}>›</div>
            </div>
            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }}>
              {s.processes.length} процессов · {s.actsCount} требуют АОСР
            </div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── Г4 · Настройка цепочки ───────────────────────────── */

const UNITS = ['т', 'кг', 'м³', 'м²', 'пог. м', 'шт', 'точки', 'партия', 'сут', '—'];

export function PtoChainSetupScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);

  const { data: sections, reload } = useQuery<SectionDto[]>('/sections');
  const section = sections?.find((s) => s.id === params.sectionId);

  const [rows, setRows] = useState<SectionDto['processes'] | null>(null);
  const current = rows ?? section?.processes ?? [];
  const [unitPicker, setUnitPicker] = useState<string | null>(null);

  const save = useAction(async () => {
    await api.post(`/admin/chain/${params.sectionId}`, {
      rows: current.map((r) => ({
        id: r.id,
        name: r.name,
        unit: r.unit,
        requiresAosr: r.requiresAosr,
        subcycle: r.subcycle,
      })),
    });
    notify('Цепочка сохранена · она применится к новым назначениям');
    setRows(null);
    reload();
  });

  if (!section) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  function update(id: string, patch: Partial<SectionDto['processes'][number]>) {
    setRows(current.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  return (
    <ScreenBody>
      <ScreenHeader
        title={`Цепочка · ${section.name}`}
        subtitle={`${current.length} процессов · ${current.filter((r) => r.requiresAosr).length} актов`}
        onBack={back}
      />

      <div style={{ padding: '4px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }}>
        Состав цепочки заводится по ППР этого объекта. Процесс с АОСР блокирует следующий, пока акт не
        подписан.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 20px 20px' }}>
        {current.map((r) => (
          <Card key={r.id} style={{ borderRadius: radius.sm, padding: '12px 14px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: color.faint, width: 22, ...tabular }}>
                {r.order}.
              </div>
              <input
                value={r.name}
                onChange={(e) => update(r.id, { name: e.target.value })}
                style={{
                  flex: 1,
                  minWidth: 0,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: color.ink,
                  fontFamily: 'inherit',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div
                onClick={() => setUnitPicker(unitPicker === r.id ? null : r.id)}
                style={{
                  cursor: 'pointer',
                  background: color.screen,
                  borderRadius: radius.pill,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 700,
                  color: color.ink,
                }}
              >
                {r.unit} ▾
              </div>
              <div
                onClick={() => update(r.id, { requiresAosr: !r.requiresAosr })}
                style={{
                  cursor: 'pointer',
                  borderRadius: radius.pill,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 800,
                  ...(r.requiresAosr
                    ? { background: color.primaryBg, color: color.primary, border: `1px solid ${color.primaryBorder}` }
                    : { background: color.screen, color: color.muted }),
                }}
              >
                🔒 требует АОСР
              </div>
              {r.subcycle ? (
                <div style={{ fontSize: 11.5, color: color.faint }}>{r.subcycle}</div>
              ) : null}
            </div>

            {unitPicker === r.id ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {UNITS.map((u) => (
                  <Chip
                    key={u}
                    active={r.unit === u}
                    onClick={() => {
                      update(r.id, { unit: u });
                      setUnitPicker(null);
                    }}
                    style={{ fontSize: 11.5, padding: '6px 9px' }}
                  >
                    {u}
                  </Chip>
                ))}
              </div>
            ) : null}
          </Card>
        ))}

        <div
          onClick={() =>
            setRows([
              ...current,
              {
                id: `new-${Date.now()}`,
                order: current.length + 1,
                name: 'Новый процесс',
                unit: '—',
                requiresAosr: false,
                subcycle: null,
                critical: false,
              },
            ])
          }
          style={{
            cursor: 'pointer',
            background: color.surface,
            border: `1px dashed ${color.dashed}`,
            borderRadius: radius.sm,
            padding: '13px 14px',
            fontSize: 13.5,
            fontWeight: 700,
            color: color.primary,
            textAlign: 'center',
          }}
        >
          + Добавить процесс
        </div>
      </div>

      {rows ? (
        <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
          <PrimaryButton onClick={() => save.run()} disabled={save.busy}>
            Сохранить цепочку
          </PrimaryButton>
        </div>
      ) : null}
    </ScreenBody>
  );
}

/* ───────────────────────────── ADM1–ADM3 · Пользователи ───────────────────────────── */

export function PtoUsersScreen() {
  const go = useApp((s) => s.go);
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);
  const { data, loading, error, reload } = useQuery<UserDto[]>('/users');
  const users = data ?? [];

  /** ПТО ведёт доступы списком: кто, какая роль, сменил ли пароль. */
  const columns: Column<UserDto>[] = [
    { key: 'name', title: 'Сотрудник', primary: true, cell: (u) => u.fullName },
    { key: 'role', title: 'Роль', cell: (u) => <Badge tone={u.active ? 'neutral' : 'warn'}>{ROLE_TITLE[u.role]}</Badge> },
    { key: 'login', title: 'Логин', cell: (u) => <span style={{ ...tabular }}>{u.login}</span> },
    { key: 'phone', title: 'Телефон', desktopOnly: true, cell: (u) => <span style={{ ...tabular }}>{u.phone}</span> },
    {
      key: 'scope',
      title: 'Объект',
      desktopOnly: true,
      cell: (u) => [u.objectName, u.blockName, u.scopeLabel].filter(Boolean).join(' · ') || '—',
    },
    {
      key: 'pwd',
      title: 'Пароль',
      cell: (u) =>
        u.mustChangePassword ? (
          <span style={{ color: color.warnText, fontWeight: 700 }}>⏳ временный</span>
        ) : (
          <span style={{ color: color.faint }}>свой</span>
        ),
    },
    {
      key: 'reset',
      title: '',
      align: 'right',
      cell: (u) => (
        <span
          onClick={(e) => {
            e.stopPropagation();
            void reset.run(u.id);
          }}
          style={{ cursor: 'pointer', fontWeight: 700, color: color.primary, whiteSpace: 'nowrap' }}
        >
          Сбросить пароль
        </span>
      ),
    },
  ];

  const reset = useAction(async (id: string) => {
    const res = await api.post<{ temporaryPassword: string }>(`/users/${id}/reset-password`);
    useApp.setState({ params: { userId: id } });
    notify(`Новый пароль: ${res.temporaryPassword} — покажите его один раз`);
    reload();
  });

  return (
    <ScreenBody>
      <ScreenHeader
        title="Пользователи и доступы"
        subtitle={`${users.length} учётных записей`}
        onBack={back}
        right={
          <div
            onClick={() => go('pto-user-new')}
            style={{
              cursor: 'pointer',
              background: color.primary,
              color: '#fff',
              borderRadius: radius.smAlt,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 800,
              whiteSpace: 'nowrap',
              flex: 'none',
            }}
          >
            + Человек
          </div>
        }
      />

      <div style={{ padding: '4px 20px 20px' }}>
        <DataState
          loading={loading}
          error={error}
          empty={users.length === 0}
          emptyText="Учётных записей пока нет"
          onRetry={reload}
        >
          <DataRows items={users} columns={columns} keyOf={(u) => u.id} />
        </DataState>
      </div>
    </ScreenBody>
  );
}

export function PtoUserNewScreen() {
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+996 ');
  const [role, setRole] = useState<Role>('master');
  const [objectId, setObjectId] = useState<string | undefined>();
  const [blockId, setBlockId] = useState<string | undefined>();
  const [scopeLabel, setScopeLabel] = useState('');
  const [password, setPassword] = useState<string | null>(null);

  const { data: objects } = useQuery<ObjectDto[]>('/objects');
  const object = objects?.find((o) => o.id === objectId);

  const create = useAction(async () => {
    const res = await api.post<{ temporaryPassword: string; user: UserDto }>('/users', {
      fullName,
      phone,
      role,
      objectId,
      blockId,
      scopeLabel: scopeLabel || undefined,
    });
    setPassword(res.temporaryPassword);
  });

  if (password) {
    // Пароль показывается ровно один раз — дальше только сброс.
    return (
      <ScreenBody>
        <ScreenHeader title="Пароль создан" subtitle={fullName} onBack={() => go('pto-users')} />
        <Card style={{ margin: '4px 20px' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: color.muted }}>ВРЕМЕННЫЙ ПАРОЛЬ</div>
          <div
            style={{
              fontSize: 30,
              fontWeight: 800,
              color: color.ink,
              marginTop: 6,
              letterSpacing: '0.06em',
              ...tabular,
            }}
          >
            {password}
          </div>
          <div
            style={{
              marginTop: 12,
              background: color.warnBg,
              border: `1px solid ${color.warnBorder}`,
              borderRadius: radius.xs,
              padding: '10px 12px',
              fontSize: 12.5,
              fontWeight: 700,
              color: color.warnText,
              lineHeight: 1.45,
            }}
          >
            Пароль показывается один раз. Передайте его лично — посмотреть повторно нельзя, только
            сбросить.
          </div>
        </Card>
        <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
          <PrimaryButton onClick={() => go('pto-users')}>Записал, дальше</PrimaryButton>
        </div>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <ScreenHeader title="Новый пользователь" onBack={back} />

      <Card style={{ margin: '4px 20px' }}>
        <SheetField label="ФАМИЛИЯ И ИМЯ" value={fullName} onChange={setFullName} />
        <div style={{ height: 8 }} />
        <SheetField label="ТЕЛЕФОН" value={phone} onChange={setPhone} />

        <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 12 }}>РОЛЬ</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {ROLES.map((r) => (
            <Chip key={r} active={role === r} onClick={() => setRole(r)} style={{ fontSize: 12 }}>
              {ROLE_TITLE[r]}
            </Chip>
          ))}
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 12 }}>ОБЪЕКТ</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
          {(objects ?? []).map((o) => (
            <Chip
              key={o.id}
              active={objectId === o.id}
              onClick={() => {
                setObjectId(o.id);
                setBlockId(undefined);
              }}
              style={{ fontSize: 12 }}
            >
              {o.name}
            </Chip>
          ))}
        </div>

        {object ? (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 12 }}>БЛОК</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {object.blocks.map((b) => (
                <Chip key={b.id} active={blockId === b.id} onClick={() => setBlockId(b.id)} style={{ fontSize: 12 }}>
                  {b.name}
                </Chip>
              ))}
            </div>
            <div style={{ height: 12 }} />
            <SheetField label="УЧАСТОК" value={scopeLabel} onChange={setScopeLabel} />
          </>
        ) : null}
      </Card>

      {create.error ? (
        <div style={{ margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }}>
          {create.error}
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        <PrimaryButton
          onClick={() => create.run()}
          disabled={fullName.trim().length < 3 || phone.trim().length < 6 || create.busy}
        >
          Создать и выдать пароль
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

export function PtoLabScreen() {
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);
  const { data, loading, error, reload } = useQuery<ProtocolDto[]>('/strength-protocols');
  const protocols = data ?? [];
  const [values, setValues] = useState<Record<string, string>>({});

  const submit = useAction(async (id: string) => {
    const res = await api.post<{ status: string }>(`/strength-protocols/${id}`, {
      strengthPct: Number((values[id] ?? '').replace(',', '.')) || 0,
    });
    notify(
      res.status === 'passed'
        ? 'Прочность набрана · распалубка разблокирована'
        : 'Прочность не набрана · распалубка остаётся закрытой',
    );
    reload();
  });

  return (
    <ScreenBody>
      <ScreenHeader title="Лаборатория" subtitle="протоколы прочности бетона" onBack={back} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
        <DataState
          loading={loading}
          error={error}
          empty={protocols.length === 0}
          emptyText="Протоколов прочности пока нет"
          onRetry={reload}
        >
  {(data ?? []).map((p) => (
            <Card key={p.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink }}>{p.process}</div>
              <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }}>
                залито {new Date(p.pouredAt).toLocaleDateString('ru-RU')} · требуется {p.requiredPct}% ·{' '}
                {p.labName}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <input
                  value={values[p.id] ?? String(p.strengthPct)}
                  onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                  style={{
                    width: 84,
                    boxSizing: 'border-box',
                    border: 'none',
                    outline: 'none',
                    background: color.screen,
                    borderRadius: radius.xs,
                    padding: '10px 12px',
                    fontSize: 16,
                    fontWeight: 800,
                    textAlign: 'center',
                    color: color.ink,
                    fontFamily: 'inherit',
                    ...tabular,
                  }}
                />
                <div style={{ fontSize: 14, color: color.muted }}>%</div>
                <div
                  onClick={() => submit.run(p.id)}
                  style={{
                    cursor: 'pointer',
                    marginLeft: 'auto',
                    background: color.primary,
                    color: '#fff',
                    borderRadius: radius.xs,
                    padding: '10px 14px',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Внести
                </div>
              </div>
            </Card>
          ))}
        </DataState>
      </div>
    </ScreenBody>
  );
}

function SheetField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ background: color.screen, borderRadius: radius.sm, padding: '10px 14px' }}>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 15,
          fontWeight: 700,
          color: color.ink,
          marginTop: 2,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}
