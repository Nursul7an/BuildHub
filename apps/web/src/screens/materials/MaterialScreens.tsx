/**
 * Модуль «Материалы» (M1–M6) и «Спецтехника» (СТ1–СТ4).
 *
 * Один модуль на снабжение и завсклад: экраны общие, роль задаёт права и
 * область. Всерьёз отличается только «Сегодня» — у снабжения это очередь
 * заявок, у завсклада — приёмка и выдача.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import {
  Badge,
  Card,
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
import type { CatalogItemDto, StockDto, UserDto, ZayavkaDto } from '../../api/types';
import { useApp } from '../../store/app';
import { ZAYAVKA_STATUS } from '../field/TodayScreen';

/* ───────────────────────────── M1 · Сегодня ───────────────────────────── */

export function MaterialsTodayScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const { data: zayavki } = useQuery<ZayavkaDto[]>('/zayavki?scope=department&kind=material');
  const { data: stock } = useQuery<StockDto[]>('/stock');

  const isSnab = me?.role === 'snab';
  const list = zayavki ?? [];

  const toNormalize = list.filter((z) => z.items.some((i) => !i.matched) && z.status !== 'closed');
  const stale = list.filter(
    (z) =>
      ['new', 'normalizing', 'approved'].includes(z.status) &&
      Date.now() - new Date(z.createdAt).getTime() > 2 * 86_400_000,
  );
  const arriving = list.filter((z) => z.status === 'inTransit' || z.status === 'delivered');
  const noPassport = (stock ?? []).filter((s) => !s.hasPassport);
  const overSpec = (stock ?? []).filter((s) => s.overSpec);

  return (
    <ScreenBody>
      <RootHeader
        title="Сегодня"
        subtitle={isSnab ? `${me?.fullName} · снабжение` : `${me?.fullName} · склад объекта`}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        {isSnab ? (
          <>
            <Tile
              title="Не опознанные позиции"
              count={toNormalize.length}
              hint="сопоставьте со справочником — формулировка запомнится"
              tone={toNormalize.length > 0 ? 'warn' : 'green'}
              onClick={() => go('mat-zayavki')}
            />
            <Tile
              title="Висят больше 2 дней"
              count={stale.length}
              hint={
                stale.some((z) => z.idleCost)
                  ? `в том числе с простоем ≈ ${formatNumber(
                      stale.reduce((a, z) => a + (z.idleCost ?? 0), 0),
                    )} сом`
                  : 'по ним ждут ответа'
              }
              tone={stale.length > 0 ? 'danger' : 'green'}
              onClick={() => go('mat-zayavki')}
            />
          </>
        ) : (
          <>
            <Tile
              title="Придут на объект"
              count={arriving.length}
              hint="приёмка в два шага: количество, затем паспорт"
              tone={arriving.length > 0 ? 'primary' : 'neutral'}
              onClick={() => go('mat-zayavki')}
            />
            <Tile
              title="Партии без паспорта"
              count={noPassport.length}
              hint="работы с ними приостановлены"
              tone={noPassport.length > 0 ? 'danger' : 'green'}
              onClick={() => go('mat-stock')}
            />
            <Tile
              title="Перерасход к спецификации"
              count={overSpec.length}
              hint="выдача сверх норматива требует причины"
              tone={overSpec.length > 0 ? 'warn' : 'green'}
              onClick={() => go('mat-stock')}
            />
          </>
        )}
      </div>
    </ScreenBody>
  );
}

function Tile({
  title,
  count,
  hint,
  tone,
  onClick,
}: {
  title: string;
  count: number;
  hint: string;
  tone: 'green' | 'warn' | 'danger' | 'primary' | 'neutral';
  onClick: () => void;
}) {
  const toneColor =
    tone === 'danger'
      ? color.danger
      : tone === 'warn'
        ? color.warnStrong
        : tone === 'green'
          ? color.greenDeep
          : tone === 'primary'
            ? color.primary
            : color.ink;
  return (
    <Card onClick={onClick} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>{title}</div>
        <div style={{ fontSize: 24, fontWeight: 800, color: toneColor, ...tabular }}>{count}</div>
      </div>
      <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3, lineHeight: 1.45 }}>{hint}</div>
    </Card>
  );
}

/* ───────────────────────────── M2 · Заявки отдела ───────────────────────────── */

export function MaterialsZayavkiScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const notify = useApp((s) => s.notify);
  const { data, reload } = useQuery<ZayavkaDto[]>('/zayavki?scope=department&kind=material');
  const { data: catalog } = useQuery<CatalogItemDto[]>('/catalog');
  const [normalizing, setNormalizing] = useState<{ zayavkaId: string; itemId: string; text: string } | null>(
    null,
  );

  const normalize = useAction(async (catalogItemId: string) => {
    if (!normalizing) return;
    await api.post(`/zayavki/${normalizing.zayavkaId}/normalize`, {
      itemId: normalizing.itemId,
      catalogItemId,
      rememberAlias: true,
    });
    notify(`Сопоставлено · формулировка «${normalizing.text}» запомнена`);
    setNormalizing(null);
    reload();
  });

  const advance = useAction(async (id: string, status: string, note: string) => {
    await api.post(`/zayavki/${id}/status`, { status, note });
    notify(note);
    reload();
  });

  const isSnab = me?.role === 'snab';

  return (
    <ScreenBody>
      <RootHeader title="Заявки" subtitle={`${data?.length ?? 0} всего`} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        {(data ?? []).map((z) => {
          const item = z.items[0];
          const unmatched = z.items.find((i) => !i.matched);
          const days = Math.floor((Date.now() - new Date(z.createdAt).getTime()) / 86_400_000);
          return (
            <Card key={z.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }}>
                  {item ? `${item.name ?? item.rawText} · ${formatNumber(item.qty, 1)} ${item.unit}` : z.number}
                </div>
                <Badge tone={z.idleCost ? 'warn' : 'neutral'} style={{ flexShrink: 0 }}>
                  {ZAYAVKA_STATUS[z.status] ?? z.status}
                </Badge>
              </div>
              <div style={{ fontSize: 12, color: color.muted, marginTop: 3, ...tabular }}>
                {z.number} · {z.objectName} · {days} дн. в работе
              </div>

              {z.idleCost ? (
                <div style={{ fontSize: 12, fontWeight: 700, color: color.warnStrong, marginTop: 4 }}>
                  ⚠ простой {z.idleWorkers} чел · ≈ {formatNumber(z.idleCost)} сом
                </div>
              ) : null}

              {unmatched ? (
                <div style={{ marginTop: 10 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: color.warnText }}>
                    Позиция «{unmatched.rawText}» не опознана
                  </div>
                  {normalizing?.itemId === unmatched.id ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                      {(catalog ?? []).slice(0, 8).map((c) => (
                        <Chip key={c.id} onClick={() => normalize.run(c.id)} style={{ fontSize: 11.5 }}>
                          {c.name}
                        </Chip>
                      ))}
                    </div>
                  ) : isSnab ? (
                    <div
                      onClick={() =>
                        setNormalizing({ zayavkaId: z.id, itemId: unmatched.id, text: unmatched.rawText })
                      }
                      style={{
                        cursor: 'pointer',
                        marginTop: 8,
                        height: 42,
                        borderRadius: radius.xs,
                        background: color.primaryBg,
                        color: color.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 13,
                        fontWeight: 800,
                      }}
                    >
                      Сопоставить со справочником
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {isSnab && ['approved', 'purchasing', 'ordered'].includes(z.status) ? (
                  <div
                    onClick={() =>
                      advance.run(
                        z.id,
                        z.status === 'approved' ? 'purchasing' : z.status === 'purchasing' ? 'ordered' : 'inTransit',
                        z.status === 'approved' ? 'В закупке' : z.status === 'purchasing' ? 'Заказано' : 'В пути',
                      )
                    }
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      textAlign: 'center',
                      background: color.primary,
                      color: '#fff',
                      borderRadius: radius.xs,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {z.status === 'approved' ? 'В закупку' : z.status === 'purchasing' ? 'Заказано' : 'Отгружено'}
                  </div>
                ) : null}
                {!isSnab && (z.status === 'inTransit' || z.status === 'delivered') ? (
                  <div
                    onClick={() => go('acceptance', { zayavkaId: z.id })}
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      textAlign: 'center',
                      background: color.primary,
                      color: '#fff',
                      borderRadius: radius.xs,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    Принять материал
                  </div>
                ) : null}
                <div
                  onClick={() => go('zayavka', { zayavkaId: z.id })}
                  style={{
                    cursor: 'pointer',
                    flex: 1,
                    textAlign: 'center',
                    background: color.chip,
                    color: color.ink,
                    borderRadius: radius.xs,
                    padding: '10px 0',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Открыть
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── M3 · Склад ───────────────────────────── */

export function StockScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const { data } = useQuery<StockDto[]>('/stock');

  return (
    <ScreenBody>
      <RootHeader title="Склад" subtitle={`${data?.length ?? 0} позиций на объекте`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        {(data ?? []).map((s) => (
          <Card
            key={s.id}
            onClick={me?.role === 'sklad' ? () => go('mat-issue', { objectId: s.objectId }) : undefined}
            style={{
              borderRadius: radius.md,
              padding: '14px 16px',
              ...(!s.hasPassport ? { border: '1.5px solid #F0B4B0' } : null),
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }}>{s.name}</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: color.ink, flexShrink: 0, ...tabular }}>
                {formatNumber(s.qty, s.qty % 1 ? 1 : 0)} {s.unit}
              </div>
            </div>
            {s.specRemainder !== null ? (
              <div style={{ fontSize: 12.5, color: s.overSpec ? color.warnStrong : color.muted, marginTop: 3, ...tabular }}>
                по спецификации осталось {formatNumber(s.specRemainder, 1)} {s.unit}
                {s.overSpec ? ' · перерасход' : ''}
              </div>
            ) : null}
            {!s.hasPassport ? (
              <div style={{ fontSize: 12.5, fontWeight: 800, color: color.danger, marginTop: 5 }}>
                🔴 Партия без паспорта — работы с ней приостановлены
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── M5 · Выдача под роспись ───────────────────────────── */

export function IssueScreen() {
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);

  const { data: stock } = useQuery<StockDto[]>('/stock');
  const { data: users } = useQuery<UserDto[]>('/users?role=prorab');

  const [itemId, setItemId] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [toUserId, setToUserId] = useState<string | null>(null);
  const [signature, setSignature] = useState('');
  const [reason, setReason] = useState<string | null>(null);

  const item = stock?.find((s) => s.catalogItemId === itemId);
  const qtyNum = Number(qty.replace(',', '.')) || 0;
  const overSpec = item?.specRemainder != null && qtyNum > item.specRemainder;

  const issue = useAction(async () => {
    if (!item) return;
    const res = await api.post<{ overspend: boolean }>('/stock/issue', {
      objectId: item.objectId,
      catalogItemId: item.catalogItemId,
      qty: qtyNum,
      toUserId,
      signature,
      overspendReason: overSpec ? (reason ?? undefined) : undefined,
    });
    notify(
      res.overspend
        ? 'Выдано под роспись · перерасход ушёл главному инженеру'
        : 'Выдано под роспись · остаток обновлён',
    );
    go('mat-stock');
  });

  const blocker =
    !itemId
      ? 'Выберите позицию'
      : qtyNum <= 0
        ? 'Укажите количество'
        : !toUserId
          ? 'Выберите, кому выдаёте'
          : !signature.trim()
            ? 'Без росписи выдача не оформляется'
            : overSpec && !reason
              ? 'Выдача сверх норматива — укажите причину'
              : null;

  return (
    <ScreenBody>
      <ScreenHeader title="Выдача под роспись" onBack={back} />

      <Card style={{ margin: '4px 20px' }}>
        <SectionLabel>ПОЗИЦИЯ</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {(stock ?? []).map((s) => (
            <Chip
              key={s.id}
              active={itemId === s.catalogItemId}
              onClick={() => setItemId(s.catalogItemId)}
              style={{ fontSize: 12 }}
            >
              {s.name}
            </Chip>
          ))}
        </div>

        {item ? (
          <>
            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 10, ...tabular }}>
              На складе {formatNumber(item.qty, 1)} {item.unit}
              {item.specRemainder != null ? ` · норматив ${formatNumber(item.specRemainder, 1)} ${item.unit}` : ''}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
              <input
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                placeholder="0"
                style={{
                  width: 110,
                  boxSizing: 'border-box',
                  border: 'none',
                  outline: 'none',
                  background: color.screen,
                  borderRadius: radius.xs,
                  padding: '12px',
                  fontSize: 19,
                  fontWeight: 800,
                  textAlign: 'center',
                  color: color.ink,
                  fontFamily: 'inherit',
                  ...tabular,
                }}
              />
              <div style={{ fontSize: 15, color: color.muted }}>{item.unit}</div>
            </div>
          </>
        ) : null}

        {overSpec ? (
          <div
            style={{
              marginTop: 10,
              background: color.warnBg,
              border: `1px solid ${color.warnBorder}`,
              borderRadius: radius.xs,
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: color.warnText }}>
              Выдача больше норматива по спецификации — причина обязательна
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {['отходы при резке', 'нахлёстки', 'перерасход', 'ошибка в объёмах'].map((r) => (
                <Chip key={r} tone="dark" active={reason === r} onClick={() => setReason(r)} style={{ fontSize: 11.5 }}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card style={{ margin: '8px 20px' }}>
        <SectionLabel>КОМУ</SectionLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {(users ?? []).map((u) => (
            <Chip key={u.id} active={toUserId === u.id} onClick={() => setToUserId(u.id)} style={{ fontSize: 12 }}>
              {u.fullName}
            </Chip>
          ))}
        </div>

        <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 12 }}>РОСПИСЬ</div>
        <input
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder="ФИО получателя или подпись"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: `1px dashed ${color.dashed}`,
            outline: 'none',
            background: color.screen,
            borderRadius: radius.xs,
            padding: '14px 12px',
            fontSize: 15,
            color: color.ink,
            marginTop: 6,
            fontFamily: 'inherit',
          }}
        />
      </Card>

      {issue.error ? (
        <div style={{ margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }}>
          {issue.error}
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        {blocker ? (
          <div style={{ fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center', marginBottom: 8 }}>
            {blocker}
          </div>
        ) : null}
        <PrimaryButton onClick={() => issue.run()} disabled={Boolean(blocker) || issue.busy}>
          Выдать под роспись
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── M4 / СТ4 · Ещё ───────────────────────────── */

export function DepartmentMoreScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);

  const items =
    me?.role === 'tech'
      ? [
          { label: '🚜 Парк и график', screen: 'tech-fleet' as const },
          { label: '🔔 Уведомления', screen: 'notifications' as const },
          { label: '👤 Профиль', screen: 'profile' as const },
        ]
      : [
          { label: '📦 Журнал выдачи', screen: 'mat-stock' as const },
          { label: '🔔 Уведомления', screen: 'notifications' as const },
          { label: '👤 Профиль', screen: 'profile' as const },
        ];

  return (
    <ScreenBody>
      <RootHeader title="Ещё" subtitle={me?.fullName} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        {items.map((i) => (
          <Card key={i.screen} onClick={() => go(i.screen)} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>{i.label}</div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── СТ1 · Спецтехника · Сегодня ───────────────────────────── */

export function TechTodayScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const { data: requests } = useQuery<ZayavkaDto[]>('/zayavki?scope=department&kind=tech');

  const list = requests ?? [];
  const today = new Date().toDateString();
  const todays = list.filter((z) => z.tech && new Date(z.tech.date).toDateString() === today);
  const pending = list.filter((z) => z.status === 'new' || z.status === 'approved');
  const needReport = list.filter((z) => z.tech && !z.tech.hasReport && new Date(z.tech.date) < new Date());

  return (
    <ScreenBody>
      <RootHeader title="Сегодня" subtitle={`${me?.fullName} · спецтехника`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        <Tile
          title="Смены сегодня"
          count={todays.length}
          hint="машина, машинист, объект"
          tone="primary"
          onClick={() => go('tech-queue')}
        />
        <Tile
          title="Ждут подбора машины"
          count={pending.length}
          hint="фронт у всех подтверждён при подаче"
          tone={pending.length > 0 ? 'warn' : 'green'}
          onClick={() => go('tech-queue')}
        />
        <Tile
          title="Смены без отчёта"
          count={needReport.length}
          hint="без отчёта нет моточасов и причины простоя"
          tone={needReport.length > 0 ? 'danger' : 'green'}
          onClick={() => go('tech-queue')}
        />
      </div>
    </ScreenBody>
  );
}

export function TechQueueScreen() {
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);
  const { data, reload } = useQuery<ZayavkaDto[]>('/zayavki?scope=department&kind=tech');
  const { data: machines } = useQuery<{ id: string; name: string; status: string }[]>('/machines');
  const [assigning, setAssigning] = useState<string | null>(null);

  const advance = useAction(async (id: string, status: string, note: string) => {
    await api.post(`/zayavki/${id}/status`, { status, note });
    notify(note);
    setAssigning(null);
    reload();
  });

  return (
    <ScreenBody>
      <RootHeader title="Заявки на технику" subtitle={`${data?.length ?? 0} всего`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        {(data ?? []).map((z) => (
          <Card key={z.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>
                {z.tech?.machineType ?? 'Техника'} · {z.tech?.hours ?? 0} ч
              </div>
              <Badge tone={z.status === 'approved' ? 'green' : 'neutral'} style={{ flexShrink: 0 }}>
                {ZAYAVKA_STATUS[z.status] ?? z.status}
              </Badge>
            </div>
            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }}>
              {z.number} · {z.objectName}
              {z.tech ? ` · ${new Date(z.tech.date).toLocaleDateString('ru-RU')} с ${z.tech.timeFrom}` : ''}
            </div>
            {z.tech?.machine ? (
              <div style={{ fontSize: 12.5, color: color.greenDeep, fontWeight: 700, marginTop: 4 }}>
                ✓ назначена {z.tech.machine.name}
              </div>
            ) : null}

            {assigning === z.id ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
                {(machines ?? [])
                  .filter((m) => m.status !== 'repair')
                  .map((m) => (
                    <Chip
                      key={m.id}
                      onClick={() => advance.run(z.id, 'approved', `Назначена ${m.name}`)}
                      style={{ fontSize: 12 }}
                    >
                      {m.name}
                    </Chip>
                  ))}
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                {!z.tech?.machine ? (
                  <div
                    onClick={() => setAssigning(z.id)}
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      textAlign: 'center',
                      background: color.primary,
                      color: '#fff',
                      borderRadius: radius.xs,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    Подобрать машину
                  </div>
                ) : !z.tech.hasReport ? (
                  <div
                    onClick={() => go('tech-report', { zayavkaId: z.id })}
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      textAlign: 'center',
                      background: color.primary,
                      color: '#fff',
                      borderRadius: radius.xs,
                      padding: '10px 0',
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    Отчёт по смене
                  </div>
                ) : null}
                <div
                  onClick={() => go('zayavka', { zayavkaId: z.id })}
                  style={{
                    cursor: 'pointer',
                    flex: 1,
                    textAlign: 'center',
                    background: color.chip,
                    color: color.ink,
                    borderRadius: radius.xs,
                    padding: '10px 0',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Открыть
                </div>
              </div>
            )}
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}
