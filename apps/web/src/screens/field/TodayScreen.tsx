/**
 * B1 · «Сегодня» — главный экран площадки.
 *
 * Порядок блоков задан макетом и не случаен: сначала то, что горит, потом
 * возврат от ПТО, потом счётчик отчёта, и только затем список работ.
 * Прораб открывает экран, чтобы понять, что делать сейчас, а не изучать объект.
 */
import { color, font, radius, shadow } from '../../design/tokens';
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  PrimaryButton,
  ProgressBar,
  RowCard,
  SectionLabel,
  formatPct,
  initialsOf,
  tabular,
} from '../../design/primitives';
import { IconCrane } from '../../design/icons';
import { useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { TodayDto } from '../../api/types';
import { useApp } from '../../store/app';
import { ScreenState } from '../../design/DataState';
import { ScreenBody } from '../../shell/PhoneFrame';

const WEEKDAY = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
const MONTH = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function formatDay(iso: string): string {
  const d = new Date(iso);
  return `${WEEKDAY[d.getDay()]}, ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export function TodayScreen() {
  const { data, loading, reload, error } = useQuery<TodayDto>('/today');
  const me = useApp((s) => s.me);
  const go = useApp((s) => s.go);
  const startTimer = useApp((s) => s.startTimer);

  if (loading || error || !data || !me) {
    return (
      <ScreenState
        loading={loading}
        error={error}
        missing={!data || !me}
        missingText="Данных за день нет"
        onRetry={reload}
      />
    );
  }

  // Заблокированные уже стоят в «Горит» с причиной — второй раз их не показываем.
  const workable = data.processes.filter((p) => p.status !== 'blocked');
  const filled = data.report?.entries.length ?? 0;
  const total = workable.length;
  const ringComplete = total > 0 && filled >= total;
  const submitted = data.report?.status && data.report.status !== 'draft';

  function openForm(processStateId: string) {
    startTimer();
    go('form', { processStateId });
  }

  return (
    <ScreenBody>
      <div
        style={{
          padding: '16px 20px 8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: color.muted }}>{formatDay(data.date)}</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: color.ink }}>
            {me.role === 'master' && data.block ? `${data.block.name} · ${me.scopeLabel ?? ''}` : (data.object?.name ?? '—')}
          </div>
          <div style={{ fontSize: 12, color: color.muted, marginTop: 1 }}>
            {me.role === 'master'
              ? `мастер ${me.fullName} · захватка · отчёт прорабу`
              : `прораб ${me.fullName} · отчёт в ПТО`}
          </div>
        </div>
        <Avatar initials={initialsOf(me.fullName)} onClick={() => go('profile')} />
      </div>

      {/* Возврат от ПТО стоит выше всего остального: пока он не закрыт, день не закрыт. */}
      {data.returnedReport ? (
        <div
          onClick={() => go('returned', { reportId: data.returnedReport!.id })}
          style={{
            cursor: 'pointer',
            margin: '8px 20px',
            background: color.warnBg,
            border: `1px solid ${color.warnBorder}`,
            borderRadius: radius.md,
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <div style={{ fontSize: 18 }}>↩</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: color.warnText }}>
              Отчёт за {new Date(data.returnedReport.date).getDate()}{' '}
              {MONTH[new Date(data.returnedReport.date).getMonth()]} возвращён ПТО
            </div>
            <div style={{ fontSize: 13, color: color.warnText }}>«{data.returnedReport.returnComment}»</div>
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, color: color.warnDeep }}>Исправить</div>
        </div>
      ) : null}

      {data.notifications.length > 0 ? (
        <>
          <SectionLabel tone="green" style={{ padding: '8px 20px 0', fontSize: 12.5, fontWeight: 800 }}>
            🔔 НОВОЕ ИЗ ОТДЕЛОВ
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 20px 0' }}>
            {data.notifications.slice(0, 3).map((n) => (
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
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: color.ink, minWidth: 0 }}>{n.title}</div>
                  <div style={{ fontSize: 11.5, color: color.greenDeep, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {new Date(n.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: color.inkSoft, marginTop: 3, lineHeight: 1.45 }}>
                  {n.subtitle}
                </div>
                <div style={{ fontSize: 11, color: color.greenMuted, marginTop: 5 }}>тап — прочитано</div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {data.burning.length > 0 ? (
        <>
          <SectionLabel tone="danger" style={{ padding: '8px 20px 0', fontSize: 12.5, fontWeight: 800 }}>
            ГОРИТ
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '4px 20px 0' }}>
            {data.burning.map((b) => (
              <div
                key={`${b.kind}-${b.processStateId}`}
                onClick={() => go('process', { processStateId: b.processStateId })}
                style={{
                  cursor: 'pointer',
                  background: color.surface,
                  border: `1.5px solid ${b.kind === 'overdue' ? '#F0B4B0' : color.border}`,
                  borderRadius: radius.md,
                  padding: '12px 15px',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 800, color: color.ink }}>{b.title}</div>
                <div
                  style={{
                    fontSize: 12.5,
                    fontWeight: 700,
                    marginTop: 2,
                    color: b.kind === 'overdue' ? color.danger : color.warnText,
                  }}
                >
                  {b.kind === 'overdue' ? `⏱ ${b.note}` : `⛔ ${b.note}`}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {workable.length === 0 ? (
        <EmptyState
          icon={<IconCrane />}
          title="ПТО пока не назначил вам работы"
          text="Как только назначат — они появятся здесь и на «Сегодня»."
          action={{ label: 'Написать в ПТО', onClick: () => go('more') }}
        />
      ) : (
        <>
          <Card style={{ margin: '8px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                background: ringComplete
                  ? color.green
                  : `conic-gradient(${color.primary} ${total > 0 ? (filled / total) * 360 : 0}deg, ${color.track} 0deg)`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 'none',
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  background: color.surface,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: 15,
                  color: color.ink,
                  ...tabular,
                }}
              >
                {filled}/{total}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: color.ink }}>Отчёт за сегодня</div>
              <div style={{ fontSize: 13.5, color: color.muted }}>
                {submitted
                  ? 'отправлен · ждёт проверки'
                  : ringComplete
                    ? 'всё заполнено — можно отправлять'
                    : `осталось ${total - filled} из ${total}`}
              </div>
            </div>
          </Card>

          <SectionLabel style={{ padding: '10px 20px 4px' }}>
            АКТИВНЫЕ ПРОЦЕССЫ · {workable.length}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px' }}>
            {workable.map((p) => {
              const done = p.filledToday;
              const blocked = p.status === 'blocked';
              return (
                <Card
                  key={p.id}
                  onClick={() => (blocked ? go('process', { processStateId: p.id }) : openForm(p.id))}
                  style={done ? { border: `1.5px solid ${color.greenBorder}` } : undefined}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: color.ink, minWidth: 0 }}>{p.name}</div>
                    <Badge tone={blocked ? 'warn' : done ? 'green' : 'neutral'}>
                      {blocked ? '⛔ Заблокирован' : done ? '✓ Заполнено' : '○ Не заполнено'}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 13.5, color: color.muted, marginTop: 2 }}>
                    {p.sectionName} · {p.blockName} · {p.floor} этаж
                  </div>
                  {blocked ? (
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: color.danger, marginTop: 6 }}>
                      {p.blockedReason}
                    </div>
                  ) : (
                    <div style={{ fontSize: 12, fontWeight: 800, marginTop: 3, ...tabular, ...dueStyle(p.dueDate) }}>
                      {dueText(p.dueDate)}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                    <ProgressBar pct={p.pct} fill={done ? color.green : color.primary} />
                    <div style={{ fontSize: 14, fontWeight: 800, color: color.ink, ...tabular }}>
                      {formatPct(p.pct)}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {data.zayavki.length > 0 ? (
        <>
          <SectionLabel style={{ padding: '10px 20px 4px' }}>ЗАЯВКИ ТРЕБУЮТ ВНИМАНИЯ</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
            {data.zayavki.map((z) => (
              <RowCard key={z.id} onClick={() => go('zayavka', { zayavkaId: z.id })}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: color.primary, ...tabular }}>{z.number}</div>
                  <Badge tone={z.idleCost ? 'warn' : 'neutral'} style={{ fontSize: 11.5 }}>
                    {ZAYAVKA_STATUS[z.status] ?? z.status}
                  </Badge>
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: color.ink, marginTop: 3 }}>{z.what}</div>
                {z.idleCost ? (
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: color.warnStrong, marginTop: 2 }}>
                    ⚠ простой ≈ {z.idleCost.toLocaleString('ru-RU')} сом
                  </div>
                ) : null}
              </RowCard>
            ))}
          </div>
        </>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 8px' }}>
        {submitted ? (
          <PrimaryButton onClick={() => go('status', { reportId: data.report!.id })} style={{ background: color.ink, boxShadow: 'none' }}>
            Отчёт отправлен · открыть статус
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => go('preview')} disabled={filled === 0}>
            {filled === 0 ? 'Заполните хотя бы одну работу' : `Проверить и отправить · ${filled}`}
          </PrimaryButton>
        )}
      </div>
    </ScreenBody>
  );
}

export const ZAYAVKA_STATUS: Record<string, string> = {
  draft: 'черновик',
  atForeman: 'у прораба',
  new: 'отправлена',
  normalizing: 'на рассмотрении',
  approved: 'согласована',
  purchasing: 'в закупке',
  ordered: 'заказано',
  inTransit: 'в пути',
  delivered: 'на объекте',
  accepted: 'принято',
  closed: 'закрыта',
  rejected: 'отклонена',
};

/** Срок словами: «просрочено 2 дня» важнее даты. */
export function dueText(dueDate: string | null): string {
  if (!dueDate) return 'срок не назначен';
  const days = Math.round((new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return `⏱ просрочено ${plural(-days, 'день', 'дня', 'дней')}`;
  if (days === 0) return '⏱ срок сегодня';
  if (days === 1) return '⏱ срок завтра';
  return `⏱ осталось ${plural(days, 'день', 'дня', 'дней')}`;
}

export function dueStyle(dueDate: string | null): { color: string } {
  if (!dueDate) return { color: color.faint };
  const days = Math.round((new Date(dueDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)) / 86_400_000);
  if (days < 0) return { color: color.danger };
  if (days <= 1) return { color: color.warnStrong };
  return { color: color.muted };
}

export function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} ${one}`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} ${few}`;
  return `${n} ${many}`;
}
