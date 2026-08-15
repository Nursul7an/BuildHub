/**
 * Руководство: директор и главный инженер.
 *
 * Одна структура, разное наполнение. Четвёртый таб — предметная область роли:
 * у директора «Финансы», у главного инженера «Качество». Профиль, KPI, лимиты
 * и планёрка открываются из шапки, а не занимают таб.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import {
  Avatar,
  Badge,
  Card,
  Chip,
  PrimaryButton,
  ProgressBar,
  SectionLabel,
  Segmented,
  formatNumber,
  initialsOf,
  tabular,
} from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type {
  DigestDto,
  FinanceDto,
  KpiDto,
  ObjectDto,
  QualityDto,
  SectionDto,
  TaskDto,
  UserDto,
} from '../../api/types';
import { useApp } from '../../store/app';

/** Крупные суммы — в миллионах сомов, как их называют вслух. */
/**
 * Деньги приходят с сервера в сомах — единица одна на весь API.
 * Руководство читает миллионами, поэтому перевод живёт здесь, а не в данных.
 */
function mln(value: number | null): string {
  if (value === null) return '—';
  const millions = value / 1_000_000;
  return `${formatNumber(millions, Math.abs(millions) < 100 ? 1 : 0)} млн`;
}

/** CPI без затрат не существует: показываем прочерк, а не ноль. */
function cpiLabel(cpi: number | null): string {
  return cpi === null ? '—' : cpi.toFixed(2).replace('.', ',');
}

function deltaColor(days: number): string {
  if (days <= -5) return color.danger;
  if (days < 0) return color.warnStrong;
  return color.greenDeep;
}

/** Кнопка «Ещё» есть в шапке каждого экрана руководства, а не только на сводке. */
function BossHeaderRight() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const [open, setOpen] = useState(false);

  const items: { label: string; screen: Parameters<typeof go>[0] }[] = [
    { label: '📊 KPI сотрудников', screen: 'boss-kpi' },
    ...(me?.role === 'gi'
      ? ([
          { label: '🏗 Объекты компании', screen: 'boss-company-objects' },
          { label: '🗓 Задачи и сроки прорабам', screen: 'boss-assign' },
          { label: '👥 Пользователи и доступы', screen: 'pto-users' },
        ] as const)
      : ([
          { label: '⚖ Лимиты автономности', screen: 'boss-limits' },
          { label: '🖥 Режим планёрки', screen: 'boss-planerka' },
        ] as const)),
    { label: '👤 Профиль', screen: 'profile' },
  ];

  return (
    <div style={{ position: 'relative', flex: 'none' }}>
      <div onClick={() => setOpen((v) => !v)} style={{ cursor: 'pointer' }}>
        <Avatar initials={me ? initialsOf(me.fullName) : '—'} />
      </div>
      {open ? (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 15 }}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 50,
              width: 236,
              background: color.surface,
              borderRadius: radius.md,
              boxShadow: '0 12px 32px rgba(20,22,31,0.20)',
              padding: 6,
              zIndex: 16,
            }}
          >
            {items.map((i) => (
              <div
                key={i.label}
                onClick={() => {
                  setOpen(false);
                  go(i.screen);
                }}
                style={{
                  cursor: 'pointer',
                  padding: '11px 12px',
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: color.ink,
                  borderRadius: radius.xs,
                }}
              >
                {i.label}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* ───────────────────────────── Сводка ───────────────────────────── */

export function BossDigestScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const { data } = useQuery<DigestDto>('/boss/digest');

  if (!data) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем сводку…</ScreenBody>;

  const isGi = me?.role === 'gi';
  const worst = [...data.objects].sort((a, b) => a.deltaDays - b.deltaDays)[0];
  const totalIdle = data.incidents.reduce((a, i) => a + (i.cost ?? 0), 0);

  return (
    <ScreenBody>
      <RootHeader
        title="Сводка"
        subtitle={new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
        right={<BossHeaderRight />}
      />

      {/* Главное — одним абзацем: что именно требует внимания сегодня. */}
      <Card style={{ margin: '4px 20px' }}>
        <SectionLabel>ГЛАВНОЕ</SectionLabel>
        <div style={{ fontSize: 14.5, color: color.ink, marginTop: 8, lineHeight: 1.55 }}>
          {worst && worst.deltaDays < 0 ? (
            <>
              <b>{worst.name}</b> отстаёт на {Math.abs(worst.deltaDays)} дн.
              {worst.cpi !== null && worst.cpi < 1
                ? ` и тратит быстрее, чем зарабатывает (CPI ${worst.cpi.toFixed(2).replace('.', ',')}).`
                : '.'}{' '}
            </>
          ) : (
            'Объекты идут по графику. '
          )}
          {totalIdle > 0 ? (
            <>
              Открытых проблем на <b>{formatNumber(totalIdle)} сом</b>.
            </>
          ) : null}
        </div>
      </Card>

      <SectionLabel style={{ padding: '14px 20px 6px' }}>ПО ОБЪЕКТАМ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
        {data.objects.map((o) => (
          <Card
            key={o.id}
            onClick={() => go('boss-object', { objectId: o.id })}
            style={{ borderRadius: radius.md, padding: '14px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink, minWidth: 0 }}>{o.name}</div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: deltaColor(o.deltaDays), ...tabular }}>
                {o.deltaDays === 0 ? 'по графику' : `${o.deltaDays} дн.`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <ProgressBar
                pct={o.pctFact}
                fill={o.deltaDays < 0 ? color.warnStrong : color.primary}
              />
              <div style={{ fontSize: 13, fontWeight: 800, color: color.ink, ...tabular }}>
                {o.pctFact.toFixed(1).replace('.', ',')}%
              </div>
            </div>
            <div style={{ fontSize: 12, color: color.muted, marginTop: 4, ...tabular }}>
              план {o.pctPlan}%{o.responsible ? ` · ${o.responsible}` : ''}
              {!isGi && o.cpi !== null ? ` · CPI ${cpiLabel(o.cpi)}` : ''}
            </div>
          </Card>
        ))}
      </div>

      <SectionLabel
        tone="danger"
        style={{ padding: '14px 20px 6px', fontSize: 12.5, fontWeight: 800 }}
      >
        {isGi ? 'БЕЗОПАСНОСТЬ И КАЧЕСТВО' : 'ТРЕБУЕТ ВАС'} · {data.incidents.length}
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
        {data.incidents.slice(0, 4).map((i) => (
          <Card
            key={i.id}
            onClick={() => go('boss-inbox', { incidentId: i.id })}
            style={{ borderRadius: radius.md, padding: '14px 16px', border: '1.5px solid #F0B4B0' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }}>{i.title}</div>
              {/* У каждой проблемы своя цена — иначе их не с чем сравнивать. */}
              {i.cost ? (
                <div style={{ fontSize: 13, fontWeight: 800, color: color.danger, flexShrink: 0, ...tabular }}>
                  {formatNumber(i.cost)} сом
                </div>
              ) : null}
            </div>
            <div style={{ fontSize: 12.5, color: color.inkMuted, marginTop: 4, lineHeight: 1.45 }}>
              {i.objectName} · {i.detail}
            </div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── Задачи ───────────────────────────── */

export function BossInboxScreen() {
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);
  const [tab, setTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [due, setDue] = useState(() => new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10));

  const { data, reload } = useQuery<DigestDto>('/boss/digest');
  const { data: tasks, reload: reloadTasks } = useQuery<TaskDto[]>('/boss/tasks');
  const { data: users } = useQuery<UserDto[]>('/users?role=prorab');

  const assign = useAction(async (incidentId: string, text: string, objectId: string) => {
    await api.post('/boss/tasks', {
      text,
      objectId,
      assigneeId,
      dueDate: due,
      incidentId,
      origin: 'inbox',
    });
    notify('Поручено · задача в реестре и в карточке объекта');
    setAssigning(null);
    setAssigneeId(null);
    reload();
    reloadTasks();
  });

  const incidents = data?.incidents ?? [];
  const issued = (tasks ?? []).filter((t) => t.status !== 'done');

  return (
    <ScreenBody>
      <RootHeader title="Задачи" right={<BossHeaderRight />} />

      <div style={{ padding: '0 20px 8px' }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'incoming', label: `Требуют меня · ${incidents.length}` },
            { value: 'outgoing', label: `Я поручил · ${issued.length}` },
          ]}
        />
      </div>

      {tab === 'incoming' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
          {incidents.map((i) => (
            <Card key={i.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }}>{i.title}</div>
                {i.cost ? (
                  <div style={{ fontSize: 13, fontWeight: 800, color: color.danger, flexShrink: 0, ...tabular }}>
                    {formatNumber(i.cost)} сом
                  </div>
                ) : null}
              </div>
              <div style={{ fontSize: 12.5, color: color.inkMuted, marginTop: 4, lineHeight: 1.45 }}>
                {i.objectName} · {i.detail}
              </div>

              {assigning === i.id ? (
                <div style={{ marginTop: 12, background: color.screen, borderRadius: radius.xs, padding: '10px 12px' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted }}>КОМУ</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {(users ?? []).map((u) => (
                      <Chip
                        key={u.id}
                        active={assigneeId === u.id}
                        onClick={() => setAssigneeId(u.id)}
                        style={{ fontSize: 12 }}
                      >
                        {u.fullName}
                      </Chip>
                    ))}
                  </div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 10 }}>СРОК</div>
                  <input
                    type="date"
                    value={due}
                    onChange={(e) => setDue(e.target.value)}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      border: 'none',
                      outline: 'none',
                      background: color.surface,
                      borderRadius: radius.xs,
                      padding: '10px 12px',
                      fontSize: 14,
                      fontWeight: 700,
                      color: color.ink,
                      marginTop: 6,
                      fontFamily: 'inherit',
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <div
                      onClick={() => setAssigning(null)}
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
                      onClick={() => assigneeId && assign.run(i.id, `Разобраться: ${i.title}`, i.objectId)}
                      style={{
                        cursor: 'pointer',
                        flex: 1.2,
                        textAlign: 'center',
                        background: assigneeId ? color.primary : color.disabled,
                        color: '#fff',
                        borderRadius: radius.xs,
                        padding: '10px 0',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      Поручить
                    </div>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setAssigning(i.id)}
                  style={{
                    cursor: 'pointer',
                    marginTop: 10,
                    height: 44,
                    borderRadius: radius.xs,
                    background: color.primaryBg,
                    color: color.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 13.5,
                    fontWeight: 800,
                  }}
                >
                  Поставить задачу
                </div>
              )}
            </Card>
          ))}

          {incidents.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: color.muted, fontSize: 13.5 }}>
              Нерешённых вопросов нет
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
          {issued.map((t) => (
            <Card key={t.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink, minWidth: 0 }}>{t.text}</div>
                <Badge tone={t.overdue ? 'warn' : 'neutral'} style={{ flexShrink: 0 }}>
                  {t.overdue ? 'просрочено' : new Date(t.dueDate).toLocaleDateString('ru-RU')}
                </Badge>
              </div>
              <div style={{ fontSize: 12.5, color: color.muted, marginTop: 4 }}>
                {t.assignee ?? 'исполнитель не назначен'} · {t.objectName}
              </div>
              <div
                onClick={async () => {
                  await api.post(`/boss/tasks/${t.id}/done`);
                  reloadTasks();
                }}
                style={{ cursor: 'pointer', fontSize: 12.5, fontWeight: 700, color: color.primary, marginTop: 8 }}
              >
                Отметить выполненной
              </div>
            </Card>
          ))}
        </div>
      )}
    </ScreenBody>
  );
}

/* ───────────────────────────── Объекты ───────────────────────────── */

export function BossObjectsScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const { data } = useQuery<DigestDto>('/boss/digest');

  return (
    <ScreenBody>
      <RootHeader title="Объекты" right={<BossHeaderRight />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        {(data?.objects ?? []).map((o) => (
          <Card
            key={o.id}
            onClick={() => go('boss-object', { objectId: o.id })}
            style={{ borderRadius: radius.md, padding: '14px 16px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink }}>{o.name}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: deltaColor(o.deltaDays), ...tabular }}>
                {o.deltaDays === 0 ? 'по графику' : `${o.deltaDays} дн.`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
              <ProgressBar pct={o.pctFact} />
              <div style={{ fontSize: 13, fontWeight: 800, color: color.ink, ...tabular }}>
                {o.pctFact.toFixed(1).replace('.', ',')}%
              </div>
            </div>
            {/* Вторая строка метрик разная: директору деньги, ГИ — документация. */}
            <div style={{ fontSize: 12, color: color.muted, marginTop: 5, ...tabular }}>
              {me?.role === 'gi'
                ? `${o.responsible ?? 'ответственный не назначен'}`
                : o.cpi !== null
                  ? `CPI ${cpiLabel(o.cpi)} · прогноз ${mln(o.eac)} из ${mln(o.budget)}`
                  : 'финансы не заведены'}
            </div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

export function BossObjectScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const me = useApp((s) => s.me);
  const { data } = useQuery<DigestDto>('/boss/digest');
  const { data: tasks } = useQuery<TaskDto[]>(
    params.objectId ? `/boss/tasks?objectId=${params.objectId}` : null,
  );

  const object = data?.objects.find((o) => o.id === params.objectId);
  const finance = data?.finance.find((f) => f.objectId === params.objectId);
  const incidents = (data?.incidents ?? []).filter((i) => i.objectId === params.objectId);

  if (!object) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  return (
    <ScreenBody>
      <ScreenHeader title={object.name} subtitle={object.responsible ?? ''} onBack={back} />

      <Card style={{ margin: '4px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: color.ink, ...tabular }}>
            {object.pctFact.toFixed(1).replace('.', ',')}%
          </div>
          <div style={{ fontSize: 14, color: color.muted, ...tabular }}>факт · план {object.pctPlan}%</div>
          <div
            style={{
              marginLeft: 'auto',
              fontSize: 15,
              fontWeight: 800,
              color: deltaColor(object.deltaDays),
              ...tabular,
            }}
          >
            {object.deltaDays === 0 ? 'по графику' : `${object.deltaDays} дн.`}
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 10 }}>
          <ProgressBar pct={object.pctFact} height={10} />
        </div>
      </Card>

      {me?.role !== 'gi' && finance ? (
        <Card style={{ margin: '8px 20px' }}>
          <SectionLabel>ДЕНЬГИ</SectionLabel>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <Fact label="Бюджет" value={mln(finance.budget)} />
            <Fact label="Освоено" value={mln(finance.ev)} />
            <Fact label="Потрачено" value={mln(finance.ac)} />
            <Fact label="Закрыто актами" value={mln(finance.closedByActs)} />
            <Fact
              label="Не закрыто"
              value={mln(finance.notClosed)}
              tone={finance.notClosed > 20_000_000 ? color.warnStrong : undefined}
            />
            <Fact
              label="Прогноз (EAC)"
              value={mln(finance.eac)}
              tone={(finance.vac ?? 0) < 0 ? color.danger : color.greenDeep}
            />
          </div>
        </Card>
      ) : null}

      {incidents.length > 0 ? (
        <>
          <SectionLabel tone="danger" style={{ padding: '12px 20px 6px' }}>
            ПРОБЛЕМЫ · {incidents.length}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
            {incidents.map((i) => (
              <Card key={i.id} style={{ borderRadius: radius.sm, padding: '12px 14px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: color.ink }}>{i.title}</div>
                <div style={{ fontSize: 12, color: color.muted, marginTop: 3 }}>{i.detail}</div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {(tasks ?? []).length > 0 ? (
        <>
          <SectionLabel style={{ padding: '12px 20px 6px' }}>ЗАДАЧИ ПО ОБЪЕКТУ</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px 20px' }}>
            {tasks!.map((t) => (
              <Card key={t.id} style={{ borderRadius: radius.sm, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: color.ink, minWidth: 0 }}>{t.text}</div>
                  <Badge tone={t.overdue ? 'warn' : 'neutral'} style={{ flexShrink: 0 }}>
                    {new Date(t.dueDate).toLocaleDateString('ru-RU')}
                  </Badge>
                </div>
                <div style={{ fontSize: 12, color: color.muted, marginTop: 3 }}>{t.assignee ?? '—'}</div>
              </Card>
            ))}
          </div>
        </>
      ) : null}
    </ScreenBody>
  );
}

function Fact({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div style={{ fontSize: 11.5, color: color.muted }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 800, color: tone ?? color.ink, marginTop: 2, ...tabular }}>
        {value}
      </div>
    </div>
  );
}

/* ───────────────────────────── Финансы ───────────────────────────── */

export function BossFinanceScreen() {
  const go = useApp((s) => s.go);
  const { data } = useQuery<FinanceDto>('/boss/finance');

  if (!data) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем финансы…</ScreenBody>;

  const totals = data.objects.reduce(
    (a, o) => ({
      budget: a.budget + o.budget,
      ev: a.ev + o.ev,
      ac: a.ac + o.ac,
      closed: a.closed + o.closedByActs,
      notClosed: a.notClosed + o.notClosed,
    }),
    { budget: 0, ev: 0, ac: 0, closed: 0, notClosed: 0 },
  );

  return (
    <ScreenBody>
      <RootHeader title="Финансы" right={<BossHeaderRight />} />

      {/* Четыре плитки: главное — разрыв между «выполнено» и «закрыто актами». */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '4px 20px 0' }}>
        <Tile label="Выполнено" value={mln(totals.ev)} />
        <Tile label="Потрачено" value={mln(totals.ac)} tone={totals.ac > totals.ev ? color.warnStrong : undefined} />
        <Tile label="Закрыто актами" value={mln(totals.closed)} />
        <Tile
          label="Не закрыто"
          value={mln(totals.notClosed)}
          tone={color.danger}
          hint="выполнено, но не предъявлено заказчику"
        />
      </div>

      <SectionLabel style={{ padding: '14px 20px 6px' }}>ОБЪЕКТЫ · по величине отклонения</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
        {[...data.objects]
          .sort((a, b) => (a.vac ?? 0) - (b.vac ?? 0))
          .map((o) => (
            <Card
              key={o.objectId}
              onClick={() => go('boss-finance-object', { objectId: o.objectId })}
              style={{ borderRadius: radius.md, padding: '14px 16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>{o.objectName}</div>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    color: (o.vac ?? 0) < 0 ? color.danger : color.greenDeep,
                    ...tabular,
                  }}
                >
                  {(o.vac ?? 0) < 0 ? '' : '+'}
                  {mln(o.vac)}
                </div>
              </div>
              <div style={{ fontSize: 12, color: color.muted, marginTop: 4, ...tabular }}>
                CPI {cpiLabel(o.cpi)} · прогноз {mln(o.eac)} при бюджете {mln(o.budget)}
              </div>
            </Card>
          ))}
      </div>

      <SectionLabel style={{ padding: '14px 20px 6px' }}>РАСХОД ПО СТАТЬЯМ</SectionLabel>
      <div style={{ padding: '0 20px' }}>
        <Card>
          {data.articles.map((a) => (
            <div key={a.name} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: color.ink }}>{a.name}</div>
                <div style={{ fontSize: 13.5, fontWeight: 800, color: color.ink, ...tabular }}>
                  {mln(a.amount)} · {a.pct.toFixed(0)}%
                </div>
              </div>
              <div style={{ display: 'flex', marginTop: 5 }}>
                <ProgressBar pct={a.pct} height={6} fill={a.note ? color.warnStrong : color.primary} />
              </div>
              {a.note ? (
                <div style={{ fontSize: 11.5, color: color.warnText, fontWeight: 700, marginTop: 3 }}>
                  {a.note}
                </div>
              ) : null}
            </div>
          ))}
        </Card>
      </div>

      <div style={{ padding: '14px 20px 20px' }}>
        <div
          onClick={() => go('boss-week')}
          style={{
            cursor: 'pointer',
            height: 52,
            borderRadius: radius.md,
            background: color.surface,
            border: `1px solid ${color.border}`,
            color: color.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14.5,
            fontWeight: 800,
          }}
        >
          💰 Деньги на неделю · {data.payments.length} платежей
        </div>
      </div>
    </ScreenBody>
  );
}

function Tile({ label, value, tone, hint }: { label: string; value: string; tone?: string; hint?: string }) {
  return (
    <Card style={{ padding: '14px 16px', borderRadius: radius.md }}>
      <div style={{ fontSize: 11.5, color: color.muted }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: tone ?? color.ink, marginTop: 3, ...tabular }}>
        {value}
      </div>
      {hint ? <div style={{ fontSize: 10.5, color: color.faint, marginTop: 3, lineHeight: 1.35 }}>{hint}</div> : null}
    </Card>
  );
}

export function BossFinanceObjectScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const { data, loading } = useQuery<FinanceDto>('/boss/finance');
  const o = data?.objects.find((x) => x.objectId === params.objectId);

  if (loading) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  // Данные пришли, а объекта в них нет: бюджет по нему ещё не заведён.
  // Показывать «Загружаем…» вечно нельзя — от зависшего экрана это
  // неотличимо, и человек ждёт того, чего не будет.
  if (!o) {
    return (
      <ScreenBody style={{ padding: 20 }}>
        <ScreenHeader title="Экономика объекта" onBack={back} />
        <div style={{ padding: '20px 0', fontSize: 14, color: color.muted, lineHeight: 1.6 }}>
          По этому объекту бюджет ещё не заведён. Экономику считать не из чего:
          нужна ведомость объёмов и договорная цена.
        </div>
      </ScreenBody>
    );
  }

  return (
    <ScreenBody>
      <ScreenHeader title={o.objectName ?? 'Объект'} subtitle="финансы объекта" onBack={back} />
      <Card style={{ margin: '4px 20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Fact label="Бюджет" value={mln(o.budget)} />
          <Fact label="Выполнено" value={mln(o.ev)} />
          <Fact label="Потрачено" value={mln(o.ac)} />
          <Fact label="Закрыто актами" value={mln(o.closedByActs)} />
          <Fact label="Не закрыто" value={mln(o.notClosed)} tone={color.warnStrong} />
          <Fact label="Дебиторка" value={mln(o.receivable)} />
        </div>
      </Card>

      <Card style={{ margin: '8px 20px' }}>
        <SectionLabel>ИНДЕКСЫ</SectionLabel>
        <div style={{ display: 'flex', gap: 20, marginTop: 10 }}>
          <div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: o.cpi !== null && o.cpi < 1 ? color.danger : color.greenDeep,
                ...tabular,
              }}
            >
              {cpiLabel(o.cpi)}
            </div>
            <div style={{ fontSize: 11.5, color: color.muted }}>CPI · освоено / потрачено</div>
          </div>
          <div>
            <div
              style={{
                fontSize: 28,
                fontWeight: 800,
                color: (o.vac ?? 0) < 0 ? color.danger : color.greenDeep,
                ...tabular,
              }}
            >
              {(o.vac ?? 0) < 0 ? '' : '+'}
              {formatNumber((o.vac ?? 0) / 1_000_000, 1)}
            </div>
            <div style={{ fontSize: 11.5, color: color.muted }}>млн · отклонение по завершении</div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: color.muted, marginTop: 12, lineHeight: 1.5 }}>
          CPI ниже 1 означает, что на каждый освоенный сом тратится больше сома. Прогноз по завершении —{' '}
          {mln(o.eac)} при бюджете {mln(o.budget)}.
        </div>
      </Card>
    </ScreenBody>
  );
}

export function BossWeekScreen() {
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);
  const { data, reload } = useQuery<FinanceDto>('/boss/finance');

  const approve = useAction(async (id: string) => {
    await api.post(`/boss/payments/${id}/approve`);
    notify('Платёж согласован');
    reload();
  });

  return (
    <ScreenBody>
      <ScreenHeader title="Деньги на неделю" subtitle="платежи по срокам" onBack={back} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
        {(data?.payments ?? []).map((p) => (
          <Card key={p.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }}>{p.name}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, flexShrink: 0, ...tabular }}>
                {mln(p.amount)}
              </div>
            </div>
            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }}>
              {p.objectName} · {new Date(p.dueDate).toLocaleDateString('ru-RU')}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
              <Badge
                tone={
                  p.status === 'overdue' ? 'danger' : p.status === 'approved' ? 'green' : p.aboveLimit ? 'warn' : 'neutral'
                }
              >
                {p.status === 'overdue'
                  ? 'просрочен'
                  : p.status === 'approved'
                    ? 'согласован'
                    : p.aboveLimit
                      ? 'выше лимита'
                      : 'к согласованию'}
              </Badge>
              {p.status !== 'approved' && p.status !== 'paid' ? (
                <div
                  onClick={() => approve.run(p.id)}
                  style={{
                    cursor: 'pointer',
                    background: color.primary,
                    color: '#fff',
                    borderRadius: radius.xs,
                    padding: '9px 14px',
                    fontSize: 13,
                    fontWeight: 800,
                  }}
                >
                  Согласовать
                </div>
              ) : null}
            </div>
          </Card>
        ))}
        {approve.error ? (
          <div style={{ fontSize: 12.5, fontWeight: 800, color: color.warnText, lineHeight: 1.45 }}>
            {approve.error}
          </div>
        ) : null}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── Качество (ГИ) ───────────────────────────── */

export function BossQualityScreen() {
  const notify = useApp((s) => s.notify);
  const { data } = useQuery<QualityDto>('/boss/quality');
  const { data: digest } = useQuery<DigestDto>('/boss/digest');
  const [stopping, setStopping] = useState(false);
  const [reason, setReason] = useState('');
  const [objectId, setObjectId] = useState<string | null>(null);

  const stop = useAction(async () => {
    await api.post('/boss/stop-work', { objectId, reason });
    notify('Работы остановлены · уведомлены площадка и директор');
    setStopping(false);
    setReason('');
  });

  if (!data) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  return (
    <ScreenBody>
      <RootHeader title="Качество" right={<BossHeaderRight />} />

      <SectionLabel tone="danger" style={{ padding: '4px 20px 6px' }}>
        ПРЕДПИСАНИЯ · {data.prescriptions.length}
      </SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px' }}>
        {data.prescriptions.map((p) => (
          <Card
            key={p.id}
            style={{
              borderRadius: radius.md,
              padding: '14px 16px',
              ...(p.overdue ? { border: '1.5px solid #F0B4B0' } : null),
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink }}>
                {p.number} · {p.contractor}
              </div>
              <Badge tone={p.overdue ? 'warn' : 'neutral'} style={{ flexShrink: 0 }}>
                {p.overdue ? 'просрочено' : `${p.dueDays} дн.`}
              </Badge>
            </div>
            <div style={{ fontSize: 12.5, color: color.inkMuted, marginTop: 4, lineHeight: 1.45 }}>
              {p.text} · {p.location}
            </div>
            <div style={{ fontSize: 11.5, color: color.faint, marginTop: 4 }}>
              выдал {p.issuedBy} · {new Date(p.issuedAt).toLocaleDateString('ru-RU')}
            </div>
          </Card>
        ))}
      </div>

      {data.blockedProcesses.length > 0 ? (
        <>
          <SectionLabel style={{ padding: '14px 20px 6px' }}>
            ЧТО ДЕРЖИТ РАБОТУ · {data.blockedProcesses.length}
          </SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
            {data.blockedProcesses.map((b) => (
              <Card key={b.id} style={{ borderRadius: radius.sm, padding: '12px 14px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: color.ink }}>{b.title}</div>
                <div style={{ fontSize: 12, color: color.danger, marginTop: 3, fontWeight: 700 }}>
                  {b.reason}
                </div>
                <div style={{ fontSize: 11.5, color: color.faint, marginTop: 2 }}>{b.objectName}</div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      {data.strengthPending.length > 0 ? (
        <>
          <SectionLabel style={{ padding: '14px 20px 6px' }}>ПРОЧНОСТЬ НЕ НАБРАНА</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
            {data.strengthPending.map((p) => (
              <Card key={p.id} style={{ borderRadius: radius.sm, padding: '12px 14px' }}>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: color.ink }}>{p.process}</div>
                <div style={{ fontSize: 12, color: color.warnText, marginTop: 3, fontWeight: 700, ...tabular }}>
                  {p.strengthPct}% из {p.requiredPct}% · {p.objectName}
                </div>
              </Card>
            ))}
          </div>
        </>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        {stopping ? (
          <Card>
            <SectionLabel>ОСТАНОВИТЬ РАБОТЫ</SectionLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {(digest?.objects ?? []).map((o) => (
                <Chip key={o.id} active={objectId === o.id} onClick={() => setObjectId(o.id)} style={{ fontSize: 12 }}>
                  {o.name}
                </Chip>
              ))}
            </div>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Основание — его увидят на площадке"
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
                marginTop: 10,
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div
                onClick={() => setStopping(false)}
                style={{
                  cursor: 'pointer',
                  flex: 1,
                  textAlign: 'center',
                  background: color.chip,
                  borderRadius: radius.xs,
                  padding: '11px 0',
                  fontSize: 13,
                  fontWeight: 700,
                  color: color.ink,
                }}
              >
                Отмена
              </div>
              <div
                onClick={() => objectId && reason.trim() && stop.run()}
                style={{
                  cursor: 'pointer',
                  flex: 1.2,
                  textAlign: 'center',
                  background: objectId && reason.trim() ? color.danger : color.disabled,
                  color: '#fff',
                  borderRadius: radius.xs,
                  padding: '11px 0',
                  fontSize: 13,
                  fontWeight: 800,
                }}
              >
                Остановить
              </div>
            </div>
          </Card>
        ) : (
          <div
            onClick={() => setStopping(true)}
            style={{
              cursor: 'pointer',
              height: 52,
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
            ⛔ Остановить работы
          </div>
        )}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── KPI, лимиты, объекты, назначение ───────────────────────────── */

export function BossKpiScreen() {
  const back = useApp((s) => s.back);
  const { data } = useQuery<KpiDto>('/boss/kpi');
  const [tab, setTab] = useState(0);

  const dept = data?.departments[tab];

  return (
    <ScreenBody>
      <ScreenHeader title="KPI сотрудников" subtitle="пороги объявлены заранее" onBack={back} />

      <div style={{ display: 'flex', gap: 6, padding: '4px 20px 0', flexWrap: 'wrap' }}>
        {(data?.departments ?? []).map((d, i) => (
          <Chip key={d.key} active={tab === i} onClick={() => setTab(i)} style={{ fontSize: 12.5 }}>
            {d.label}
          </Chip>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '14px 20px 20px' }}>
        {(dept?.metrics ?? []).map((m) => (
          <Card key={m.key} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: color.ink }}>{m.label}</div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 800,
                  ...tabular,
                  color:
                    m.state === 'good'
                      ? color.greenDeep
                      : m.state === 'warn'
                        ? color.warnStrong
                        : m.state === 'bad'
                          ? color.danger
                          : color.ink,
                }}
              >
                {m.value === null
                  ? '—'
                  : `${formatNumber(m.value, m.value % 1 ? 1 : 0)} ${m.unit}`}
              </div>
            </div>

            {/*
              Показатель без значения — обычное состояние, а не сбой:
              ТЗ §9 отводит первый квартал на измерение, и по двум отчётам
              процент не считают. Пишем причину, иначе пустая строка
              читается как поломка.
            */}
            {m.note ? (
              <div style={{ fontSize: 11.5, color: color.warnText, marginTop: 4, fontWeight: 700 }}>
                {m.state === 'measuring' ? '⏳ ' : ''}
                {m.note}
              </div>
            ) : null}

            {m.basis ? (
              <div style={{ fontSize: 11.5, color: color.faint, marginTop: 4 }}>
                {m.basis.note}
              </div>
            ) : null}

            <div style={{ fontSize: 11.5, color: color.faint, marginTop: 4 }}>
              {m.goodAbove !== null
                ? `норма — не ниже ${m.goodAbove} ${m.unit}`
                : m.goodBelow !== null
                  ? `норма — не выше ${m.goodBelow} ${m.unit}`
                  : ''}
            </div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

export function BossLimitsScreen() {
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);
  const { data, reload } = useQuery<{ id: string; role: string; scope: string; limit: number }[]>(
    '/boss/limits',
  );
  const [edits, setEdits] = useState<Record<string, string>>({});

  const save = useAction(async (role: string, scope: string, limit: number) => {
    await api.put('/boss/limits', { role, scope, limit });
    notify('Лимит сохранён');
    reload();
  });

  const SCOPE_LABEL: Record<string, string> = {
    payment: 'платежи',
    zayavka: 'заявки',
    contractor: 'подрядчики',
  };

  return (
    <ScreenBody>
      <ScreenHeader title="Лимиты автономности" subtitle="до какой суммы решают без вас" onBack={back} />
      <div style={{ padding: '4px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }}>
        Всё, что выше лимита, приходит вам на согласование. Ниже — решается на месте и попадает только в
        отчёт.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 20px' }}>
        {(data ?? []).map((l) => {
          const key = `${l.role}:${l.scope}`;
          const value = edits[key] ?? String(l.limit);
          return (
            <Card key={l.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink }}>
                {l.role === 'gi' ? 'Главный инженер' : l.role === 'pto' ? 'ПТО' : 'Снабжение'} ·{' '}
                {SCOPE_LABEL[l.scope] ?? l.scope}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10 }}>
                <input
                  value={value}
                  onChange={(e) => setEdits((s) => ({ ...s, [key]: e.target.value }))}
                  style={{
                    width: 92,
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
                <div style={{ fontSize: 14, color: color.muted }}>млн сом</div>
                <div
                  onClick={() => save.run(l.role, l.scope, Number(value.replace(',', '.')) || 0)}
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
                  Сохранить
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </ScreenBody>
  );
}

export function BossCompanyObjectsScreen() {
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);
  const { data, reload } = useQuery<ObjectDto[]>('/objects');
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ code: '', name: '', address: '', city: 'Бишкек', floors: '9', due: '' });

  const create = useAction(async () => {
    await api.post('/boss/objects', {
      code: form.code,
      name: form.name,
      address: form.address,
      city: form.city,
      floorsTotal: Number(form.floors) || 1,
      dueDate: form.due || new Date(Date.now() + 365 * 86_400_000).toISOString(),
      blocks: [{ name: 'Блок А', floors: Number(form.floors) || 1 }],
    });
    notify('Объект создан · цепочки процессов заводит ПТО по ППР');
    setCreating(false);
    reload();
  });

  return (
    <ScreenBody>
      <ScreenHeader
        title="Объекты компании"
        subtitle={`${data?.length ?? 0} объектов`}
        onBack={back}
        right={
          <div
            onClick={() => setCreating((v) => !v)}
            style={{
              cursor: 'pointer',
              background: color.primary,
              color: '#fff',
              borderRadius: radius.smAlt,
              padding: '10px 14px',
              fontSize: 13,
              fontWeight: 800,
              flex: 'none',
            }}
          >
            {creating ? 'Отмена' : '+ Объект'}
          </div>
        }
      />

      {creating ? (
        <Card style={{ margin: '4px 20px' }}>
          <SectionLabel>НОВЫЙ ОБЪЕКТ</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
            <MiniField label="НАЗВАНИЕ" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
            <MiniField label="КОД" value={form.code} onChange={(v) => setForm({ ...form, code: v })} />
            <MiniField label="АДРЕС" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
            <MiniField label="ЭТАЖЕЙ" value={form.floors} onChange={(v) => setForm({ ...form, floors: v })} />
            <MiniField label="СРОК СДАЧИ" value={form.due} onChange={(v) => setForm({ ...form, due: v })} type="date" />
          </div>
          <div style={{ fontSize: 11.5, color: color.faint, marginTop: 10, lineHeight: 1.45 }}>
            Цепочки процессов по разделам заводит ПТО по ППР этого объекта.
          </div>
          <PrimaryButton
            onClick={() => create.run()}
            disabled={!form.name || !form.code || create.busy}
            style={{ marginTop: 12, height: 50 }}
          >
            Создать объект
          </PrimaryButton>
        </Card>
      ) : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 20px' }}>
        {(data ?? []).map((o) => (
          <Card key={o.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>{o.name}</div>
              <Badge tone={o.status === 'active' ? 'green' : 'warn'}>
                {o.status === 'active' ? 'в работе' : o.status === 'paused' ? 'остановлен' : 'сдан'}
              </Badge>
            </div>
            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
              {o.address} · {o.blocks.length} блоков · {o.floorsTotal} этажей
            </div>
            <div style={{ fontSize: 12, color: color.faint, marginTop: 3 }}>
              срок {new Date(o.dueDate).toLocaleDateString('ru-RU')} ·{' '}
              {o.responsible?.fullName ?? 'ответственный не назначен'}
            </div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

/** Назначение работ прорабу: объект → блок → этаж → раздел → кому → срок. */
export function BossAssignScreen() {
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);

  const { data: objects } = useQuery<ObjectDto[]>('/objects');
  const { data: sections } = useQuery<SectionDto[]>('/sections');
  const { data: users } = useQuery<UserDto[]>('/users');

  const [objectId, setObjectId] = useState<string | null>(null);
  const [blockId, setBlockId] = useState<string | null>(null);
  const [floor, setFloor] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const [due, setDue] = useState(() => new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10));

  const object = objects?.find((o) => o.id === objectId);
  const block = object?.blocks.find((b) => b.id === blockId);
  const candidates = (users ?? []).filter(
    (u) => ['prorab', 'master'].includes(u.role) && (!objectId || u.objectId === objectId),
  );

  const assign = useAction(async () => {
    const res = await api.post<{ processesCreated: number }>('/admin/assign-work', {
      objectId,
      blockId,
      floor,
      sectionId,
      assigneeId,
      dueDate: due,
    });
    notify(`Назначено · заведено ${res.processesCreated} процессов, исполнитель уведомлён`);
    setSectionId(null);
  });

  const ready = objectId && blockId && floor !== null && sectionId && assigneeId;

  return (
    <ScreenBody>
      <ScreenHeader title="Задачи и сроки прорабам" subtitle="назначение работ" onBack={back} />

      <div style={{ padding: '4px 20px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Step label="1 · ОБЪЕКТ">
          {(objects ?? []).map((o) => (
            <Chip
              key={o.id}
              active={objectId === o.id}
              onClick={() => {
                setObjectId(o.id);
                setBlockId(null);
                setFloor(null);
                setAssigneeId(null);
              }}
              style={{ fontSize: 12.5 }}
            >
              {o.name}
            </Chip>
          ))}
        </Step>

        {object ? (
          <Step label="2 · БЛОК">
            {object.blocks.map((b) => (
              <Chip
                key={b.id}
                active={blockId === b.id}
                onClick={() => {
                  setBlockId(b.id);
                  setFloor(null);
                }}
                style={{ fontSize: 12.5 }}
              >
                {b.name}
              </Chip>
            ))}
          </Step>
        ) : null}

        {block ? (
          <Step label="3 · ЭТАЖ">
            {Array.from({ length: block.floors }, (_, i) => i + 1).map((f) => (
              <Chip key={f} active={floor === f} onClick={() => setFloor(f)} style={{ fontSize: 12.5 }}>
                {f}
              </Chip>
            ))}
          </Step>
        ) : null}

        {floor !== null ? (
          <Step label="4 · РАЗДЕЛ РАБОТ">
            {(sections ?? []).map((s) => (
              <Chip key={s.id} active={sectionId === s.id} onClick={() => setSectionId(s.id)} style={{ fontSize: 12.5 }}>
                {s.name}
              </Chip>
            ))}
          </Step>
        ) : null}

        {sectionId ? (
          <Step label="5 · КОМУ">
            {candidates.length > 0 ? (
              candidates.map((u) => (
                <Chip key={u.id} active={assigneeId === u.id} onClick={() => setAssigneeId(u.id)} style={{ fontSize: 12.5 }}>
                  {u.fullName}
                </Chip>
              ))
            ) : (
              <div style={{ fontSize: 12.5, color: color.warnText, fontWeight: 700 }}>
                На объекте нет прорабов — сначала заведите их в «Пользователи и доступы»
              </div>
            )}
          </Step>
        ) : null}

        {assigneeId ? (
          <Step label="6 · СРОК">
            <input
              type="date"
              value={due}
              onChange={(e) => setDue(e.target.value)}
              style={{
                boxSizing: 'border-box',
                border: 'none',
                outline: 'none',
                background: color.surface,
                borderRadius: radius.xs,
                padding: '10px 12px',
                fontSize: 14,
                fontWeight: 700,
                color: color.ink,
                fontFamily: 'inherit',
              }}
            />
          </Step>
        ) : null}
      </div>

      {ready ? (
        <Card style={{ margin: '14px 20px 0' }}>
          <div style={{ fontSize: 13, color: color.muted }}>Будет назначено</div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink, marginTop: 4 }}>
            {object?.name} · {block?.name} · {floor} этаж ·{' '}
            {sections?.find((s) => s.id === sectionId)?.name}
          </div>
          <div style={{ fontSize: 13, color: color.inkMuted, marginTop: 3 }}>
            {candidates.find((u) => u.id === assigneeId)?.fullName} · срок{' '}
            {new Date(due).toLocaleDateString('ru-RU')}
          </div>
        </Card>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        <PrimaryButton onClick={() => assign.run()} disabled={!ready || assign.busy}>
          Назначить и уведомить
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

function Step({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <SectionLabel style={{ fontSize: 12 }}>{label}</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>{children}</div>
    </div>
  );
}

function MiniField({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div style={{ background: color.screen, borderRadius: radius.xs, padding: '9px 12px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: color.muted }}>{label}</div>
      <input
        value={value}
        type={type}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          boxSizing: 'border-box',
          border: 'none',
          outline: 'none',
          background: 'transparent',
          fontSize: 14.5,
          fontWeight: 700,
          color: color.ink,
          marginTop: 2,
          fontFamily: 'inherit',
        }}
      />
    </div>
  );
}

/* ───────────────────────────── Режим планёрки (desktop) ───────────────────────────── */

export function PlanerkaScreen() {
  const back = useApp((s) => s.back);
  const { data } = useQuery<DigestDto>('/boss/digest');

  return (
    <ScreenBody>
      <ScreenHeader title="Режим планёрки" subtitle="крупно, для проектора" onBack={back} />
      <div style={{ padding: '4px 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(data?.objects ?? []).map((o) => (
          <Card key={o.id} style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <div style={{ fontSize: 19, fontWeight: 800, color: color.ink }}>{o.name}</div>
              <div style={{ fontSize: 19, fontWeight: 800, color: deltaColor(o.deltaDays), ...tabular }}>
                {o.deltaDays === 0 ? 'по графику' : `${o.deltaDays} дн.`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
              <ProgressBar pct={o.pctFact} height={12} />
              <div style={{ fontSize: 18, fontWeight: 800, color: color.ink, ...tabular }}>
                {o.pctFact.toFixed(1).replace('.', ',')}%
              </div>
            </div>
            <div style={{ fontSize: 13, color: color.muted, marginTop: 6, ...tabular }}>
              план {o.pctPlan}% · {o.responsible ?? '—'}
              {o.cpi !== null ? ` · CPI ${o.cpi.toFixed(2).replace('.', ',')}` : ''}
            </div>
          </Card>
        ))}

        <SectionLabel tone="danger" style={{ marginTop: 8, fontSize: 14 }}>
          ТРЕБУЕТ РЕШЕНИЯ
        </SectionLabel>
        {(data?.incidents ?? []).map((i) => (
          <Card key={i.id} style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: color.ink }}>{i.title}</div>
              {i.cost ? (
                <div style={{ fontSize: 16, fontWeight: 800, color: color.danger, ...tabular }}>
                  {formatNumber(i.cost)} сом
                </div>
              ) : null}
            </div>
            <div style={{ fontSize: 13.5, color: color.inkMuted, marginTop: 4 }}>
              {i.objectName} · {i.detail}
            </div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}
