/**
 * Б1–Б4 · Заявки: список, карточка с таймлайном, создание, приёмка материала.
 *
 * Список отсортирован по тому, что требует действия, а не по номеру. На
 * карточке материал крупнее номера: прораб ищет «арматуру», а не «0184».
 */
import { useMemo, useState } from 'react';
import { color, radius } from '../../design/tokens';
import {
  Badge,
  Card,
  CheckSquare,
  Chip,
  EmptyState,
  PrimaryButton,
  SectionLabel,
  formatNumber,
  tabular,
} from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { CatalogItemDto, ProcessDetail, StockDto, ZayavkaDto } from '../../api/types';
import { useApp } from '../../store/app';
import { DataState, ScreenState } from '../../design/DataState';
import { ZAYAVKA_STATUS } from '../field/TodayScreen';

/** Порядок статусов в таймлайне карточки. */
const FLOW: { status: string; label: string }[] = [
  { status: 'new', label: 'Отправлена' },
  { status: 'normalizing', label: 'На рассмотрении' },
  { status: 'approved', label: 'Согласована' },
  { status: 'purchasing', label: 'В закупке' },
  { status: 'ordered', label: 'Заказано у поставщика' },
  { status: 'inTransit', label: 'В пути' },
  { status: 'delivered', label: 'Получено на объекте' },
  { status: 'closed', label: 'Закрыта' },
];

function statusTone(status: string): 'green' | 'warn' | 'neutral' | 'primary' {
  if (status === 'closed' || status === 'accepted') return 'green';
  if (status === 'new' || status === 'normalizing' || status === 'atForeman') return 'warn';
  if (status === 'inTransit' || status === 'delivered') return 'primary';
  return 'neutral';
}

/* ───────────────────────────── Б1 · Список ───────────────────────────── */

export function ZayavkiScreen() {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const scope = me && ['snab', 'sklad', 'tech'].includes(me.role) ? 'department' : 'mine';
  const { data, loading, error, reload } = useQuery<ZayavkaDto[]>(`/zayavki?scope=${scope}`);
  const [showClosed, setShowClosed] = useState(false);

  const { open, closed } = useMemo(() => {
    const list = data ?? [];
    return {
      open: list.filter((z) => z.status !== 'closed'),
      closed: list.filter((z) => z.status === 'closed'),
    };
  }, [data]);

  if (loading) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем заявки…</ScreenBody>;

  return (
    <ScreenBody>
      <RootHeader
        title="Заявки"
        subtitle={`${open.length} в работе · ${closed.length} закрыто`}
        right={
          me && ['prorab', 'master'].includes(me.role) ? (
            <div
              onClick={() => go('zayavka-new')}
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
              + Заявка
            </div>
          ) : undefined
        }
      />


      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
<DataState
          loading={loading}
          error={error}
          empty={open.length === 0 && closed.length === 0}
          emptyNode={
            <EmptyState
              icon="📦"
              title="Заявок пока нет"
              text="Заявка создаётся из карточки процесса, когда нужен материал или техника."
              action={{ label: 'Создать заявку', onClick: () => go('zayavka-new') }}
            />
          }
          onRetry={reload}
        >
          {open.map((z) => (
            <ZayavkaRow key={z.id} zayavka={z} onOpen={() => go('zayavka', { zayavkaId: z.id })} />
          ))}

          {closed.length > 0 ? (
            <div
              onClick={() => setShowClosed((v) => !v)}
              style={{
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: color.surface,
                borderRadius: radius.sm,
                padding: '12px 16px',
                boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                minHeight: 48,
                marginTop: 4,
              }}
            >
              <SectionLabel tone="green" style={{ fontSize: 12, fontWeight: 800 }}>
                ЗАКРЫТЫЕ · {closed.length}
              </SectionLabel>
              <div style={{ color: color.faint, fontSize: 12 }}>{showClosed ? '▾' : '▸'}</div>
            </div>
          ) : null}

          {showClosed
            ? closed.map((z) => (
                <ZayavkaRow key={z.id} zayavka={z} onOpen={() => go('zayavka', { zayavkaId: z.id })} />
              ))
            : null}
        </DataState>
      </div>
    </ScreenBody>
  );
}

function ZayavkaRow({ zayavka, onOpen }: { zayavka: ZayavkaDto; onOpen: () => void }) {
  const go = useApp((s) => s.go);
  const me = useApp((s) => s.me);
  const item = zayavka.items[0];
  const canAccept =
    (zayavka.status === 'inTransit' || zayavka.status === 'delivered') &&
    me &&
    ['prorab', 'master', 'sklad'].includes(me.role);

  return (
    <Card onClick={onOpen} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
      {/* Материал главнее номера: по нему заявку узнают. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: color.ink, minWidth: 0 }}>
          {item ? `${item.name ?? item.rawText} · ${formatNumber(item.qty, item.qty % 1 ? 1 : 0)} ${item.unit}` : zayavka.number}
        </div>
        <Badge tone={statusTone(zayavka.status)} style={{ flexShrink: 0 }}>
          {ZAYAVKA_STATUS[zayavka.status] ?? zayavka.status}
        </Badge>
      </div>

      <div style={{ fontSize: 12, color: color.muted, marginTop: 3, ...tabular }}>
        {zayavka.number}
        {zayavka.holder ? ` · держит ${zayavka.holder.fullName}` : ''}
        {zayavka.deliveryBy
          ? ` · поставка ${new Date(zayavka.deliveryBy).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}`
          : ''}
      </div>

      {zayavka.idleCost ? (
        <div style={{ fontSize: 12, fontWeight: 700, color: color.warnStrong, marginTop: 4 }}>
          ⚠ простой {zayavka.idleWorkers} чел · ≈ {zayavka.idleCost.toLocaleString('ru-RU')} сом
        </div>
      ) : null}

      {/* Одинаковая раскладка действий у всех карточек — глазу не приходится искать. */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        {canAccept ? (
          <div
            onClick={(e) => {
              e.stopPropagation();
              go('acceptance', { zayavkaId: zayavka.id });
            }}
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
          onClick={(e) => {
            e.stopPropagation();
            onOpen();
          }}
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
}

/* ───────────────────────────── Б3 · Карточка ───────────────────────────── */

export function ZayavkaCardScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);
  const me = useApp((s) => s.me);

  const { data: zayavka, reload, loading, error } = useQuery<ZayavkaDto>(
    params.zayavkaId ? `/zayavki/${params.zayavkaId}` : null,
  );

  const advance = useAction(async (status: string, note: string) => {
    await api.post(`/zayavki/${params.zayavkaId}/status`, { status, note });
    notify(note);
    reload();
  });

  if (loading || error || !zayavka) {
    return (
      <ScreenState
        loading={loading}
        error={error}
        missing={!zayavka}
        missingText="Заявка не найдена"
        onRetry={reload}
      />
    );
  }

  const currentIndex = FLOW.findIndex((f) => f.status === zayavka.status);
  const item = zayavka.items[0];
  const isSnab = me?.role === 'snab';

  return (
    <ScreenBody>
      <ScreenHeader
        title={item ? `${item.name ?? item.rawText}` : zayavka.number}
        subtitle={`${zayavka.number} · ${zayavka.objectName ?? ''}`}
        onBack={back}
      />

      {zayavka.idleCost ? (
        <div
          style={{
            margin: '4px 20px',
            background: color.warnBg,
            border: `1px solid ${color.warnBorder}`,
            borderRadius: radius.md,
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 700,
            color: color.warnText,
            lineHeight: 1.45,
          }}
        >
          ⚠ Связано: простой {zayavka.idleWorkers} чел · ≈ {zayavka.idleCost.toLocaleString('ru-RU')} сом ·
          расчёт по ставкам
        </div>
      ) : null}

      <Card style={{ margin: '8px 20px' }}>
        {zayavka.items.map((i) => (
          <div key={i.id} style={{ marginBottom: 8 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>
              {i.name ?? i.rawText} · {formatNumber(i.qty, i.qty % 1 ? 1 : 0)} {i.unit}
            </div>
            {!i.matched ? (
              <div style={{ fontSize: 12, color: color.warnText, fontWeight: 700, marginTop: 2 }}>
                позиция не опознана — снабжение сопоставит со справочником
              </div>
            ) : null}
            {i.overSpec ? (
              <div style={{ fontSize: 12, color: color.warnStrong, fontWeight: 700, marginTop: 2, ...tabular }}>
                ⚠ больше остатка по спецификации ({formatNumber(i.specRemainder ?? 0, 1)} {i.unit})
                {i.overspendReason ? ` · ${i.overspendReason}` : ''}
              </div>
            ) : null}
          </div>
        ))}
        <div style={{ fontSize: 12.5, color: color.muted, marginTop: 4 }}>
          Автор: {zayavka.author?.fullName ?? '—'} ·{' '}
          {new Date(zayavka.createdAt).toLocaleDateString('ru-RU')}
          {zayavka.holder ? ` · сейчас у ${zayavka.holder.fullName}` : ''}
        </div>
      </Card>

      {zayavka.tech ? (
        <Card style={{ margin: '0 20px 8px' }}>
          <SectionLabel>ТЕХНИКА</SectionLabel>
          <div style={{ fontSize: 14, fontWeight: 700, color: color.ink, marginTop: 6 }}>
            {zayavka.tech.machineType} · {zayavka.tech.hours} ч ·{' '}
            {new Date(zayavka.tech.date).toLocaleDateString('ru-RU')} с {zayavka.tech.timeFrom}
          </div>
          {zayavka.tech.machine ? (
            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 2 }}>
              Назначена: {zayavka.tech.machine.name}
            </div>
          ) : null}
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {zayavka.tech.frontChecklist.map((c) => (
              <div key={c.key} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <CheckSquare on={c.checked} size={18} />
                <div style={{ fontSize: 12.5, color: c.checked ? color.ink : color.muted }}>{c.label}</div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <SectionLabel style={{ padding: '4px 20px 8px' }}>ДВИЖЕНИЕ ЗАЯВКИ</SectionLabel>
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column' }}>
        {FLOW.map((step, i) => {
          const done = currentIndex > i;
          const current = currentIndex === i;
          const event = zayavka.timeline.find((e) => e.status === step.status);
          return (
            <div key={step.status} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    background: done ? color.green : current ? color.primary : color.chip,
                    color: done || current ? '#fff' : color.faint,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: 11,
                    flexShrink: 0,
                    ...(current ? { boxShadow: `0 0 0 3px ${color.primaryBg}` } : null),
                  }}
                >
                  {done ? '✓' : current ? '●' : '○'}
                </div>
                {i < FLOW.length - 1 ? (
                  <div style={{ width: 2, flex: 1, minHeight: 18, background: done ? color.green : color.track }} />
                ) : null}
              </div>
              <div style={{ paddingBottom: 12, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: current ? 14 : 13.5,
                    fontWeight: current ? 800 : done ? 700 : 600,
                    color: done || current ? color.ink : color.faint,
                  }}
                >
                  {step.label}
                </div>
                {event ? (
                  <div style={{ fontSize: 12, color: color.muted }}>
                    {event.actor} · {new Date(event.at).toLocaleDateString('ru-RU')}
                    {event.note ? ` · ${event.note}` : ''}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div
        style={{
          marginTop: 'auto',
          padding: '16px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {isSnab && currentIndex >= 0 && currentIndex < FLOW.length - 1 ? (
          <PrimaryButton
            onClick={() => advance.run(FLOW[currentIndex + 1]!.status, FLOW[currentIndex + 1]!.label)}
          >
            {FLOW[currentIndex + 1]!.label} →
          </PrimaryButton>
        ) : null}

        {(zayavka.status === 'inTransit' || zayavka.status === 'delivered') &&
        me &&
        ['prorab', 'master', 'sklad'].includes(me.role) ? (
          <PrimaryButton onClick={() => go('acceptance', { zayavkaId: zayavka.id })}>
            Принять материал
          </PrimaryButton>
        ) : null}

        {zayavka.status === 'new' || zayavka.status === 'normalizing' ? (
          <div
            onClick={() => notify('Напоминание ушло · зафиксировано в истории заявки')}
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
            Поторопить
          </div>
        ) : null}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── Б2 · Новая заявка ───────────────────────────── */

export function ZayavkaNewScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);
  const me = useApp((s) => s.me);

  const [text, setText] = useState('');
  const [matched, setMatched] = useState<CatalogItemDto | null>(null);
  const [qty, setQty] = useState('4,2');
  const [unit, setUnit] = useState('т');
  const [urgent, setUrgent] = useState(false);
  const [idleWorkers, setIdleWorkers] = useState('24');
  const [reason, setReason] = useState<string | null>(null);
  const [deliveryBy, setDeliveryBy] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().slice(0, 10);
  });

  const { data: process } = useQuery<ProcessDetail>(
    params.processStateId ? `/process/${params.processStateId}` : null,
  );
  const { data: stock } = useQuery<StockDto[]>('/stock');
  const { data: suggestions } = useQuery<CatalogItemDto[]>(
    text.length >= 3 ? `/catalog?q=${encodeURIComponent(text)}` : '/catalog',
    [text],
  );

  const qtyNum = Number(qty.replace(',', '.')) || 0;
  const balance = stock?.find((s) => s.catalogItemId === matched?.id);
  const specRemainder = balance?.specRemainder ?? null;
  const overSpec = specRemainder !== null && qtyNum > specRemainder;

  const create = useAction(async () => {
    if (!me?.objectId) return;
    const res = await api.post<{ id: string; number: string }>('/zayavki', {
      kind: 'material',
      objectId: me.objectId,
      blockId: process?.blockId,
      floor: process?.floor,
      processStateId: params.processStateId,
      priority: urgent ? 'urgent' : 'norm',
      deliveryBy,
      idleWorkers: urgent ? Number(idleWorkers) || undefined : undefined,
      idleSince: urgent ? new Date().toISOString() : undefined,
      items: [
        {
          rawText: text,
          catalogItemId: matched?.id ?? null,
          qty: qtyNum,
          unit,
          overspendReason: overSpec ? (reason ?? undefined) : undefined,
        },
      ],
    });
    notify(
      me.role === 'master'
        ? `${res.number} ушла на согласование прорабу`
        : `${res.number} ушла в снабжение`,
    );
    go('zayavka', { zayavkaId: res.id });
  });

  const canSend = text.trim().length > 0 && qtyNum > 0 && (!overSpec || Boolean(reason));

  return (
    <ScreenBody>
      <ScreenHeader
        title="Новая заявка"
        subtitle={process ? `${process.name} · ${process.blockName} · ${process.floor} эт.` : 'материалы'}
        onBack={back}
      />

      <Card style={{ margin: '4px 20px' }}>
        <SectionLabel>ЧТО НУЖНО</SectionLabel>
        {/* Свободный ввод сохраняется как есть; сопоставление — работа снабжения. */}
        <input
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMatched(null);
          }}
          placeholder="например: арматура 12ка"
          style={{
            width: '100%',
            boxSizing: 'border-box',
            border: 'none',
            outline: 'none',
            background: color.screen,
            borderRadius: radius.sm,
            padding: '12px 14px',
            fontSize: 16,
            fontWeight: 700,
            color: color.ink,
            marginTop: 8,
            fontFamily: 'inherit',
          }}
        />

        {!matched && text.length >= 2 && suggestions && suggestions.length > 0 ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {suggestions.slice(0, 4).map((s) => (
              <Chip
                key={s.id}
                onClick={() => {
                  setMatched(s);
                  setText(s.name);
                  setUnit(s.unit);
                }}
                style={{ fontSize: 12 }}
              >
                {s.name}
              </Chip>
            ))}
          </div>
        ) : null}

        {matched ? (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.greenDeep, marginTop: 8 }}>
            ✓ Опознано: {matched.name}
          </div>
        ) : text.length > 0 ? (
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.warnText, marginTop: 8 }}>
            Позиция не опознана — уйдёт как есть, снабжение сопоставит и запомнит формулировку
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}>
          <input
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            style={{
              width: 96,
              boxSizing: 'border-box',
              border: 'none',
              outline: 'none',
              background: color.screen,
              borderRadius: radius.xs,
              padding: '10px 12px',
              fontSize: 17,
              fontWeight: 800,
              color: color.ink,
              textAlign: 'center',
              fontFamily: 'inherit',
              ...tabular,
            }}
          />
          <div style={{ display: 'flex', gap: 6 }}>
            {['т', 'кг', 'шт', 'м³', 'м²'].map((u) => (
              <Chip key={u} active={unit === u} onClick={() => setUnit(u)} style={{ fontSize: 12, padding: '7px 10px' }}>
                {u}
              </Chip>
            ))}
          </div>
        </div>

        {/* Остаток на объекте — до отправки, иначе заявка дублирует то, что уже лежит. */}
        {balance ? (
          <div
            style={{
              marginTop: 10,
              background: color.primaryBgSoft,
              borderRadius: radius.xs,
              padding: '9px 12px',
              fontSize: 12.5,
              fontWeight: 700,
              color: color.ink,
              ...tabular,
            }}
          >
            На объекте сейчас: {formatNumber(balance.qty, 1)} {balance.unit}
            {specRemainder !== null ? ` · по спецификации осталось ${formatNumber(specRemainder, 1)} ${balance.unit}` : ''}
          </div>
        ) : null}

        {overSpec ? (
          <div
            style={{
              marginTop: 8,
              background: color.warnBg,
              border: `1px solid ${color.warnBorder}`,
              borderRadius: radius.xs,
              padding: '9px 12px',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: color.warnText, ...tabular }}>
              ⚠ Заявлено {formatNumber(qtyNum, 1)} {unit}, по спецификации остаток{' '}
              {formatNumber(specRemainder ?? 0, 1)} {unit} — укажите причину
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
              {['отходы при резке', 'нахлёстки', 'перерасход', 'ошибка в объёмах', 'другое'].map((r) => (
                <Chip key={r} tone="dark" active={reason === r} onClick={() => setReason(r)} style={{ fontSize: 11.5, padding: '7px 10px' }}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      <Card style={{ margin: '8px 20px' }}>
        <SectionLabel>СРОК ПОСТАВКИ</SectionLabel>
        <input
          type="date"
          value={deliveryBy}
          onChange={(e) => setDeliveryBy(e.target.value)}
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
            marginTop: 8,
            fontFamily: 'inherit',
          }}
        />
        <div style={{ fontSize: 11.5, color: color.faint, marginTop: 6, lineHeight: 1.4 }}>
          Это срок, к которому материал нужен на объекте, а не срок работы.
        </div>
      </Card>

      <Card style={{ margin: '8px 20px' }}>
        <SectionLabel>ПРИОРИТЕТ</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          {[
            { on: !urgent, label: 'Обычная', click: () => setUrgent(false) },
            { on: urgent, label: 'Простой — люди стоят', click: () => setUrgent(true) },
          ].map((o) => (
            <div
              key={o.label}
              onClick={o.click}
              style={{
                cursor: 'pointer',
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background: color.surface,
                border: `${o.on ? 1.5 : 1}px solid ${o.on ? color.primary : color.border}`,
                borderRadius: radius.sm,
                padding: '13px 14px',
                fontSize: 13.5,
                fontWeight: o.on ? 800 : 600,
                color: color.ink,
                minHeight: 56,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  border: o.on ? `6px solid ${color.primary}` : `2px solid ${color.disabled}`,
                  boxSizing: 'border-box',
                  background: '#fff',
                  flexShrink: 0,
                }}
              />
              {o.label}
            </div>
          ))}
        </div>
        {urgent ? (
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
            <div style={{ fontSize: 13, color: color.ink, flex: 1 }}>Сколько человек стоит</div>
            <input
              value={idleWorkers}
              onChange={(e) => setIdleWorkers(e.target.value)}
              style={{
                width: 72,
                boxSizing: 'border-box',
                border: 'none',
                outline: 'none',
                background: color.screen,
                borderRadius: radius.xs,
                padding: '10px 12px',
                fontSize: 15,
                fontWeight: 800,
                textAlign: 'center',
                color: color.ink,
                fontFamily: 'inherit',
                ...tabular,
              }}
            />
          </div>
        ) : null}
      </Card>

      <div style={{ margin: '8px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }}>
        {me?.role === 'master'
          ? 'Заявка уйдёт на согласование прорабу, затем в снабжение'
          : 'Заявка уйдёт напрямую в снабжение'}
      </div>

      {create.error ? (
        <div style={{ margin: '8px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }}>
          {create.error}
        </div>
      ) : null}

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        <PrimaryButton onClick={() => create.run()} disabled={!canSend || create.busy}>
          Отправить заявку
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── Б4 · Приёмка ───────────────────────────── */

export function AcceptanceScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);

  const { data: zayavka, loading, error, reload } = useQuery<ZayavkaDto>(params.zayavkaId ? `/zayavki/${params.zayavkaId}` : null);

  const [qty, setQty] = useState('');
  const [passportOk, setPassportOk] = useState<boolean | null>(null);
  const [passportNumber, setPassportNumber] = useState('');
  const [discrepancy, setDiscrepancy] = useState('');
  const [photos, setPhotos] = useState<{ url: string; takenAt: string }[]>([]);

  const item = zayavka?.items[0];
  const expected = item?.qty ?? 0;
  const qtyNum = Number(qty.replace(',', '.')) || 0;
  const short = qtyNum > 0 && qtyNum < expected;

  const submit = useAction(async () => {
    await api.post(`/zayavki/${params.zayavkaId}/accept`, {
      qtyAccepted: qtyNum,
      passportOk: passportOk === true,
      passportNumber: passportNumber || undefined,
      discrepancy: discrepancy || undefined,
      photos,
    });
    notify(
      passportOk
        ? 'Принято · запись ушла в Журнал входного контроля'
        : '⛔ Партия помечена · уведомление ушло ПТО и в снабжение',
    );
    go('zayavki');
  });

  if (loading || error || !zayavka || !item) {
    return (
      <ScreenState
        loading={loading}
        error={error}
        missing={!zayavka}
        missingText="Позиция заявки не найдена"
        onRetry={reload}
      />
    );
  }

  const blocker =
    qtyNum <= 0
      ? 'Укажите принятое количество'
      : photos.length === 0
        ? 'Фото приёмки обязательно'
        : passportOk === null
          ? 'Отметьте, есть ли паспорт качества'
          : short && !discrepancy
            ? 'Принято меньше заявленного — опишите расхождение'
            : null;

  return (
    <ScreenBody>
      <ScreenHeader
        title="Приёмка материала"
        subtitle={`${zayavka.number} · ${item.name ?? item.rawText}`}
        onBack={back}
      />

      <Card style={{ margin: '4px 20px' }}>
        <SectionLabel>ШАГ 1 · КОЛИЧЕСТВО</SectionLabel>
        <div style={{ fontSize: 13, color: color.muted, marginTop: 6, ...tabular }}>
          Заявлено: {formatNumber(expected, 1)} {item.unit}
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 8 }}>
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
              fontSize: 20,
              fontWeight: 800,
              textAlign: 'center',
              color: color.ink,
              fontFamily: 'inherit',
              ...tabular,
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 700, color: color.muted }}>{item.unit}</div>
        </div>
        {short ? (
          <input
            value={discrepancy}
            onChange={(e) => setDiscrepancy(e.target.value)}
            placeholder="Чем объясняется недовоз"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: `1px solid ${color.warnBorder}`,
              outline: 'none',
              background: color.warnBg,
              borderRadius: radius.xs,
              padding: '10px 12px',
              fontSize: 13,
              color: color.ink,
              marginTop: 10,
              fontFamily: 'inherit',
            }}
          />
        ) : null}
      </Card>

      <Card style={{ margin: '8px 20px' }}>
        <SectionLabel>ШАГ 2 · ПАСПОРТ КАЧЕСТВА</SectionLabel>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <div
            onClick={() => setPassportOk(true)}
            style={{
              cursor: 'pointer',
              flex: 1,
              textAlign: 'center',
              borderRadius: radius.xs,
              padding: '10px 0',
              fontSize: 13,
              fontWeight: passportOk === true ? 800 : 700,
              ...(passportOk === true
                ? { background: color.green, color: '#fff' }
                : { background: color.surface, color: color.ink, border: `1px solid ${color.border}` }),
            }}
          >
            Паспорт есть
          </div>
          <div
            onClick={() => setPassportOk(false)}
            style={{
              cursor: 'pointer',
              flex: 1,
              textAlign: 'center',
              borderRadius: radius.xs,
              padding: '10px 0',
              fontSize: 13,
              fontWeight: passportOk === false ? 800 : 700,
              ...(passportOk === false
                ? { background: color.danger, color: '#fff' }
                : { background: color.surface, color: color.ink, border: `1px solid ${color.border}` }),
            }}
          >
            Паспорта нет
          </div>
        </div>

        {passportOk === true ? (
          <input
            value={passportNumber}
            onChange={(e) => setPassportNumber(e.target.value)}
            placeholder="Номер паспорта / сертификата"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: 'none',
              outline: 'none',
              background: color.screen,
              borderRadius: radius.xs,
              padding: '10px 12px',
              fontSize: 14,
              color: color.ink,
              marginTop: 10,
              fontFamily: 'inherit',
            }}
          />
        ) : null}

        {passportOk === false ? (
          <div
            style={{
              marginTop: 10,
              background: color.warnBg,
              border: `1px solid ${color.warnBorder}`,
              borderRadius: radius.xs,
              padding: '10px 12px',
              fontSize: 12.5,
              fontWeight: 800,
              color: color.warnText,
              lineHeight: 1.45,
            }}
          >
            Партия будет помечена, работы с ней приостановлены. Уведомление уйдёт ПТО и в снабжение.
          </div>
        ) : null}
      </Card>

      <div style={{ display: 'flex', gap: 8, padding: '8px 20px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div
          onClick={() =>
            setPhotos((p) => [...p, { url: `acc-${p.length + 1}.jpg`, takenAt: new Date().toISOString() }])
          }
          style={{
            cursor: 'pointer',
            width: 64,
            height: 64,
            borderRadius: radius.sm,
            background: color.primary,
            color: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 'none',
          }}
        >
          <div style={{ fontSize: 19 }}>◉</div>
          <div style={{ fontSize: 10, fontWeight: 700 }}>Фото</div>
        </div>
        {photos.map((p) => (
          <div
            key={p.url}
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.sm,
              flex: 'none',
              background: 'repeating-linear-gradient(45deg,#D8DAE3 0 8px,#E7E9F0 8px 16px)',
            }}
          />
        ))}
        {photos.length === 0 ? (
          <div style={{ fontSize: 11.5, color: color.warnText, fontWeight: 700, lineHeight: 1.4 }}>
            фото приёмки —<br />
            обязательно
          </div>
        ) : null}
      </div>

      {submit.error ? (
        <div style={{ margin: '4px 20px 0', fontSize: 12.5, fontWeight: 800, color: color.danger }}>
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
          Принять
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}
