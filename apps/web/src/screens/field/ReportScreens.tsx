/**
 * B5 «Предпросмотр», B6 «Статус», B7 «Возвращён».
 *
 * После отправки отчёт сразу виден руководству со статусом «не подтверждён» —
 * это обещание интерфейса, поэтому цепочка согласования показана целиком,
 * с именами и временем, а не абстрактным «на согласовании».
 */
import { color, radius } from '../../design/tokens';
import {
  Badge,
  Card,
  GhostButton,
  PrimaryButton,
  SectionLabel,
  formatNumber,
  tabular,
} from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { ReportDto, TodayDto } from '../../api/types';
import { formatElapsed, useApp } from '../../store/app';

const MONTH_FULL = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function dateTitle(iso: string): string {
  const d = new Date(iso);
  return `Отчёт за ${d.getDate()} ${MONTH_FULL[d.getMonth()]}`;
}

/* ───────────────────────────── B5 · Предпросмотр ───────────────────────────── */

export function PreviewScreen() {
  const go = useApp((s) => s.go);
  const back = useApp((s) => s.back);
  const me = useApp((s) => s.me);
  const stopTimer = useApp((s) => s.stopTimer);
  const formStartedAt = useApp((s) => s.formStartedAt);
  const notify = useApp((s) => s.notify);

  const { data } = useQuery<TodayDto>('/today');
  const report = data?.report ?? null;

  const send = useAction(async () => {
    if (!report) return;
    const seconds = formStartedAt ? Math.round((Date.now() - formStartedAt) / 1000) : 0;
    await api.post(`/report/${report.id}/submit`, { fillSeconds: seconds });
    stopTimer();
    notify(me?.role === 'master' ? 'Отчёт ушёл прорабу' : 'Отчёт ушёл в ПТО');
    go('status', { reportId: report.id });
  });

  if (!data) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  const entries = report?.entries ?? [];
  const notFilled = data.processes.filter(
    (p) => p.status !== 'blocked' && !entries.some((e) => e.processStateId === p.id),
  );
  const workers = entries.reduce((a, e) => a + e.workers, 0);
  const photos = entries.reduce((a, e) => a + e.photos.length, 0);
  const problems = entries.reduce((a, e) => a + e.problems.length, 0);

  return (
    <ScreenBody>
      <ScreenHeader
        title={dateTitle(data.date)}
        subtitle={`${data.object?.name ?? ''} · ${me?.fullName ?? ''}`}
        onBack={back}
      />

      <Card style={{ margin: '6px 20px' }}>
        <SectionLabel>ИТОГИ ДНЯ</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <Metric value={entries.length} label="работы" />
          <Metric value={workers} label="рабочих" />
          <Metric value={photos} label="фото" />
          <Metric value={problems} label="проблем" tone={problems > 0 ? color.warnStrong : undefined} />
        </div>
      </Card>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '2px 20px' }}>
        {entries.map((e) => (
          <Card key={e.id} style={{ borderRadius: radius.card, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }}>{e.title}</div>
              <div
                onClick={() => go('form', { processStateId: e.processStateId })}
                style={{ cursor: 'pointer', fontSize: 13, fontWeight: 700, color: color.primary, flexShrink: 0 }}
              >
                изменить
              </div>
            </div>
            <div style={{ fontSize: 13.5, color: color.inkMuted, marginTop: 4, ...tabular }}>
              +{formatNumber(e.volume, e.unit === 'т' ? 2 : 0)} {e.unit} · {e.workers} чел ·{' '}
              {e.photos.length} фото
              {e.problems.length > 0 ? ` · ⚠ ${e.problems.join(', ').toLowerCase()}` : ''}
            </div>
            {e.winterMethod ? (
              <div style={{ fontSize: 12, color: color.warnText, marginTop: 3, fontWeight: 700 }}>
                ❄ {e.tempAir} °C · {e.winterMethod}
              </div>
            ) : null}
          </Card>
        ))}

        {notFilled.map((p) => (
          <div
            key={p.id}
            style={{
              background: color.chip,
              border: `1px dashed ${color.dashed}`,
              borderRadius: radius.card,
              padding: '14px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: color.muted, minWidth: 0 }}>
              {p.name} · {p.blockName} · {p.floor} эт
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: color.muted, flexShrink: 0 }}>
              не заполнено — пропустить
            </div>
          </div>
        ))}
      </div>

      <div style={{ margin: '10px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }}>
        После отправки отчёт сразу виден руководству со статусом «не подтверждён».
      </div>

      {send.error ? (
        <div style={{ margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }}>
          {send.error}
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        <PrimaryButton onClick={() => send.run()} disabled={entries.length === 0 || send.busy}>
          Отправить на согласование
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

function Metric({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div>
      <div style={{ fontSize: 20, fontWeight: 800, color: tone ?? color.ink, ...tabular }}>{value}</div>
      <div style={{ fontSize: 12.5, color: color.muted }}>{label}</div>
    </div>
  );
}

/* ───────────────────────────── B6 · Статус ───────────────────────────── */

export function StatusScreen() {
  const params = useApp((s) => s.params);
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const formStartedAt = useApp((s) => s.formStartedAt);
  const formFinishedAt = useApp((s) => s.formFinishedAt);

  const { data: report } = useQuery<ReportDto>(params.reportId ? `/report/${params.reportId}` : null);

  if (!report) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  const isMaster = me?.role === 'master';
  const elapsed =
    report.fillSeconds !== null
      ? formatElapsed(report.fillSeconds * 1000)
      : formStartedAt && formFinishedAt
        ? formatElapsed(formFinishedAt - formStartedAt)
        : null;

  const adjust = report.checks?.find((c) => c.decision === 'adjust');
  const ptoDone = report.status === 'accepted' || report.status === 'adjusted';

  const chain = [
    ...(isMaster
      ? [{ title: 'Мастер · ' + (report.authorName ?? ''), sub: `отправил в ${time(report.submittedAt)}`, done: true }]
      : []),
    {
      title: 'Прораб · ' + (isMaster ? 'Азамат Жумабеков' : (report.authorName ?? '')),
      sub: isMaster ? 'принимает отчёт мастера · передаёт в ПТО' : `отправил в ${time(report.submittedAt)}`,
      done: true,
    },
    {
      title: 'Инженер ПТО · Гульмира Садыкова',
      sub: ptoDone
        ? report.status === 'adjusted'
          ? 'скорректировал и подтвердил'
          : 'подтвердил'
        : 'проверяет · обычно до 21:00',
      done: ptoDone,
      current: !ptoDone,
    },
    { title: 'Главный инженер · Нурлан Ташиев', sub: 'после ПТО', done: false },
  ];

  return (
    <ScreenBody>
      <ScreenHeader
        title={dateTitle(report.date)}
        subtitle={report.submittedAt ? `отправлен в ${time(report.submittedAt)}` : 'черновик'}
        onBack={() => go('today')}
      />

      {elapsed ? (
        <div
          style={{
            margin: '4px 20px',
            background: color.greenBg,
            border: `1px solid ${color.greenBorder}`,
            borderRadius: radius.md,
            padding: '12px 14px',
            fontSize: 14,
            color: color.greenDeep,
            fontWeight: 800,
            ...tabular,
          }}
        >
          ⏱ Заполнение заняло {elapsed} — цель ≤ 5 минут
        </div>
      ) : null}

      <div
        style={{
          margin: '8px 20px',
          background: color.primaryBg,
          border: `1px solid ${color.primaryBorder}`,
          borderRadius: radius.md,
          padding: '12px 14px',
          fontSize: 13.5,
          color: color.primaryDark,
          fontWeight: 600,
          lineHeight: 1.45,
        }}
      >
        {isMaster ? '📤 Отчёт уходит прорабу, затем в ПТО' : '📤 Отчёт уходит в ПТО'} · данные уже видны
        руководству со статусом «не подтверждён»
      </div>

      <Card style={{ margin: '8px 20px', padding: 20 }}>
        <div style={{ display: 'flex', gap: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {chain.map((node, i) => (
              <div key={node.title} style={{ display: 'contents' }}>
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 18,
                    background: node.done ? color.green : node.current ? color.primary : color.chip,
                    color: node.done || node.current ? '#fff' : color.faint,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 15,
                    flex: 'none',
                  }}
                >
                  {node.done ? '✓' : node.current ? '●' : '•'}
                </div>
                {i < chain.length - 1 ? (
                  <div
                    style={{
                      width: 3,
                      flex: 1,
                      background: node.done ? color.green : color.track,
                      minHeight: 26,
                    }}
                  />
                ) : null}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24, paddingTop: 2 }}>
            {chain.map((node) => (
              <div key={node.title}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 800,
                    color: node.done || node.current ? color.ink : color.faint,
                  }}
                >
                  {node.title}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: node.current ? color.primary : node.done ? color.muted : color.faint,
                    fontWeight: node.current ? 700 : 400,
                  }}
                >
                  {node.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {adjust ? (
        <div
          style={{
            margin: '0 20px',
            background: color.primaryBg,
            border: `1px solid ${color.primaryBorder}`,
            borderRadius: radius.md,
            padding: '12px 14px',
            fontSize: 13,
            color: color.primaryDark,
            fontWeight: 600,
            lineHeight: 1.5,
          }}
        >
          ✎ ПТО скорректировал: {adjust.adjustFrom} → {adjust.adjustTo} · «{adjust.comment}»
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        <GhostButton onClick={() => go('today')}>Вернуться на «Сегодня»</GhostButton>
      </div>
    </ScreenBody>
  );
}

function time(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

/* ───────────────────────────── B7 · Возвращён ───────────────────────────── */

export function ReturnedScreen() {
  const params = useApp((s) => s.params);
  const go = useApp((s) => s.go);
  const back = useApp((s) => s.back);
  const startTimer = useApp((s) => s.startTimer);

  const { data: report } = useQuery<ReportDto>(params.reportId ? `/report/${params.reportId}` : null);

  if (!report) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  const disputed = new Set(report.returnedFields);
  const firstDisputed = report.entries.find((e) => disputed.has(e.id)) ?? report.entries[0];

  return (
    <ScreenBody>
      <div style={{ padding: '14px 20px 8px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          onClick={back}
          style={{
            cursor: 'pointer',
            width: 40,
            height: 40,
            borderRadius: radius.sm,
            background: color.surface,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            color: color.ink,
            boxShadow: '0 1px 4px rgba(20,22,31,0.08)',
            flex: 'none',
          }}
        >
          ‹
        </div>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: color.ink }}>{dateTitle(report.date)}</div>
          <Badge tone="warn" style={{ marginTop: 3, fontSize: 12.5 }}>
            ↩ Возвращён ПТО
          </Badge>
        </div>
      </div>

      <Card style={{ margin: '8px 20px', padding: 18, border: `1.5px solid ${color.warnBorder}` }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              background: color.chip,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: 14,
              color: color.ink,
            }}
          >
            ГС
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: color.ink }}>
              Гульмира Садыкова · инженер ПТО
            </div>
            <div style={{ fontSize: 12.5, color: color.muted }}>вчера, 21:14</div>
          </div>
        </div>
        <div style={{ fontSize: 16, fontWeight: 600, color: color.ink, marginTop: 12, lineHeight: 1.5 }}>
          «{report.returnComment}»
        </div>
      </Card>

      <SectionLabel style={{ padding: '8px 20px 4px' }}>СПОРНЫЕ ПОЛЯ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
        {report.entries.map((e) => {
          const bad = disputed.has(e.id);
          return (
            <Card
              key={e.id}
              style={{
                borderRadius: radius.card,
                padding: '14px 16px',
                ...(bad ? { border: `2px solid ${color.warnAccent}` } : { opacity: 0.75 }),
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }}>{e.title}</div>
                <Badge tone={bad ? 'warn' : 'green'}>{bad ? '⚠ проверить' : '✓ без замечаний'}</Badge>
              </div>
              <div style={{ fontSize: 14, color: color.inkMuted, marginTop: 6, ...tabular }}>
                Объём за день:{' '}
                <span style={{ fontWeight: 800, color: bad ? color.warnStrong : color.ink }}>
                  {formatNumber(e.volume, e.unit === 'т' ? 2 : 0)} {e.unit}
                </span>{' '}
                · {e.workers} чел · {e.photos.length} фото
              </div>
            </Card>
          );
        })}
      </div>

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <PrimaryButton
          onClick={() => {
            if (!firstDisputed) return;
            startTimer();
            go('form', { processStateId: firstDisputed.processStateId });
          }}
        >
          Исправить объём →
        </PrimaryButton>
        <div
          style={{
            height: 48,
            borderRadius: radius.md,
            background: color.chip,
            color: color.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
          }}
        >
          Оставить как есть и ответить
        </div>
      </div>
    </ScreenBody>
  );
}
