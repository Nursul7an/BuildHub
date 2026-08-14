/**
 * A4 · Карточка процесса и A6 · Комментарий с типом.
 *
 * Комментарий здесь никогда не «просто текст»: тип выбирается первым, и от
 * него зависит форма и то, что произойдёт дальше — заявка, запись о простое
 * с ценой, уведомление главному инженеру.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import {
  Badge,
  BottomSheet,
  Card,
  Chip,
  PlanFactBars,
  PrimaryButton,
  SectionLabel,
  Stepper,
  formatNumber,
  formatPct,
  tabular,
} from '../../design/primitives';
import { ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { ProcessDetail } from '../../api/types';
import { useApp } from '../../store/app';
import { dueStyle, dueText } from './TodayScreen';
import { STATUS_LABEL } from './WorksScreen';

type CommentKind = 'problem' | 'delay' | 'material' | 'quality' | 'safety' | 'other';

const COMMENT_TYPES: { key: CommentKind; label: string }[] = [
  { key: 'problem', label: '🔴 Проблема / простой' },
  { key: 'delay', label: '🟠 Задержка' },
  { key: 'material', label: '🟡 Нехватка материала' },
  { key: 'quality', label: '🔵 Качество' },
  { key: 'safety', label: '⚫ Охрана труда' },
  { key: 'other', label: '⚪ Прочее' },
];

export function ProcessScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const startTimer = useApp((s) => s.startTimer);
  const [commentOpen, setCommentOpen] = useState(false);

  const { data: process, reload } = useQuery<ProcessDetail>(
    params.processStateId ? `/process/${params.processStateId}` : null,
  );

  if (!process) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем процесс…</ScreenBody>;

  const canPresent = process.presentBlockedBy === null;

  return (
    <ScreenBody>
      <ScreenHeader
        title={process.name}
        subtitle={`${process.sectionName} · ${process.blockName} · ${process.floor} эт.`}
        onBack={back}
        right={
          process.requiresAosr ? (
            <Badge tone="primary" style={{ flexShrink: 0 }}>
              🔒 нужен АОСР
            </Badge>
          ) : undefined
        }
      />

      {/* Срок крупно: он определяет, что делать сегодня. */}
      <div
        style={{
          margin: '4px 20px',
          background: color.surface,
          borderRadius: radius.md,
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          boxShadow: '0 2px 8px rgba(20,22,31,0.06)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, ...dueStyle(process.dueDate) }}>
            {dueText(process.dueDate)}
          </div>
          {process.dueDate ? (
            <div style={{ fontSize: 12.5, fontWeight: 600, color: color.muted, marginTop: 2 }}>
              срок был {new Date(process.dueDate).toLocaleDateString('ru-RU')}
            </div>
          ) : null}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: color.primary, whiteSpace: 'nowrap' }}>
          Запросить перенос
        </div>
      </div>

      {process.status === 'blocked' ? (
        <div
          style={{
            margin: '0 20px 8px',
            background: color.warnBg,
            border: `1px solid ${color.warnBorder}`,
            borderRadius: radius.smAlt,
            padding: '10px 12px',
            fontSize: 12.5,
            fontWeight: 800,
            color: color.warnText,
            lineHeight: 1.45,
          }}
        >
          ⛔ {process.blockedReason}
        </div>
      ) : null}

      {process.strengthBlockedBy ? (
        <div
          style={{
            margin: '0 20px 8px',
            background: color.warnBg,
            border: `1px solid ${color.warnBorder}`,
            borderRadius: radius.smAlt,
            padding: '10px 12px',
            fontSize: 12.5,
            fontWeight: 800,
            color: color.warnText,
            lineHeight: 1.45,
          }}
        >
          🧪 {process.strengthBlockedBy}
        </div>
      ) : null}

      <Card style={{ margin: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: color.ink, ...tabular }}>
            {formatNumber(process.doneQty, process.unit === 'т' ? 2 : 0)}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: color.muted, ...tabular }}>
            из {formatNumber(process.planQty, process.unit === 'т' ? 1 : 0)} {process.unit}
          </div>
          <div style={{ marginLeft: 'auto', fontSize: 22, fontWeight: 800, color: color.primary, ...tabular }}>
            {formatPct(process.pct)}
          </div>
        </div>
        <PlanFactBars planPct={Math.min(100, process.pct + 8)} factPct={process.pct} />
        <div style={{ fontSize: 12, color: color.muted, marginTop: 8 }}>
          Статус: {STATUS_LABEL[process.status]} · план — из ведомости объёмов ПТО
        </div>
      </Card>

      {process.history.length > 0 ? (
        <>
          <SectionLabel style={{ padding: '12px 20px 4px' }}>ПОСЛЕДНИЕ ЗАПИСИ</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
            {process.history.slice(0, 4).map((h, i) => (
              <div
                key={`${h.date}-${i}`}
                style={{
                  background: color.surface,
                  borderRadius: radius.sm,
                  padding: '11px 14px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                }}
              >
                <div style={{ fontSize: 13.5, fontWeight: 700, color: color.ink }}>
                  {new Date(h.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </div>
                <div style={{ fontSize: 13.5, color: color.inkMuted, ...tabular }}>
                  +{formatNumber(h.volume, process.unit === 'т' ? 2 : 0)} {h.unit} · {h.workers} чел ·{' '}
                  {h.photos} фото
                </div>
                <Badge tone={h.status === 'returned' ? 'warn' : 'green'} style={{ fontSize: 11.5 }}>
                  {h.status === 'returned' ? '↩' : '✓'}
                </Badge>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {process.comments.length > 0 ? (
        <>
          <SectionLabel style={{ padding: '12px 20px 4px' }}>КОММЕНТАРИИ ПО ПРОЦЕССУ</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 20px' }}>
            {process.comments.slice(0, 3).map((c) => (
              <div
                key={c.id}
                style={{
                  background: color.surface,
                  borderRadius: radius.sm,
                  padding: '11px 14px',
                  boxShadow: '0 1px 4px rgba(20,22,31,0.05)',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 700, color: color.ink }}>
                  {COMMENT_TYPES.find((t) => t.key === c.kind)?.label ?? c.kind}
                </div>
                <div style={{ fontSize: 12.5, color: color.inkMuted, marginTop: 3, lineHeight: 1.45 }}>
                  {c.materialName ? `${c.materialName} · ${c.materialQty ?? ''}` : c.text}
                  {c.idleCost ? ` · ≈ ${c.idleCost.toLocaleString('ru-RU')} сом` : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div
        style={{
          marginTop: 'auto',
          padding: '16px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <PrimaryButton
          onClick={() => {
            startTimer();
            go('form', { processStateId: process.id });
          }}
          disabled={process.status === 'blocked'}
        >
          Внести выполнение
        </PrimaryButton>

        <div>
          <div
            onClick={canPresent ? () => go('present', { processStateId: process.id }) : undefined}
            style={{
              cursor: canPresent ? 'pointer' : 'default',
              height: 50,
              borderRadius: radius.md,
              background: canPresent ? color.chip : color.screen,
              color: canPresent ? color.ink : color.faint,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14.5,
              fontWeight: 800,
            }}
          >
            Предъявить к освидетельствованию
          </div>
          {/* Причина недоступности пишется под кнопкой, а не прячется. */}
          {process.presentBlockedBy ? (
            <div style={{ fontSize: 11.5, color: color.muted, textAlign: 'center', marginTop: 5 }}>
              {process.presentBlockedBy}
            </div>
          ) : null}
        </div>

        <div
          onClick={() => setCommentOpen(true)}
          style={{
            cursor: 'pointer',
            height: 48,
            borderRadius: radius.md,
            background: color.surface,
            border: `1px solid ${color.border}`,
            color: color.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14,
            fontWeight: 700,
          }}
        >
          Комментарий
        </div>
      </div>

      {commentOpen ? (
        <CommentSheet
          process={process}
          onClose={() => {
            setCommentOpen(false);
            reload();
          }}
        />
      ) : null}
    </ScreenBody>
  );
}

/* ───────────────────────────── A6 · Комментарий ───────────────────────────── */

function CommentSheet({ process, onClose }: { process: ProcessDetail; onClose: () => void }) {
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);
  const [kind, setKind] = useState<CommentKind>('material');
  const [text, setText] = useState('');
  const [materialName, setMaterialName] = useState('Арматура А500С Ø12');
  const [materialQty, setMaterialQty] = useState('4,2');
  const [idleWorkers, setIdleWorkers] = useState(24);
  const [idleSince, setIdleSince] = useState('17:20');

  const submit = useAction(async (createZayavka: boolean) => {
    const since = new Date();
    const [h, m] = idleSince.split(':').map(Number);
    since.setHours(h ?? 17, m ?? 20, 0, 0);

    const result = await api.post<{ id: string; idleCost: number | null }>(
      `/process/${process.id}/comment`,
      {
        kind,
        text,
        ...(kind === 'material'
          ? {
              materialName,
              materialQty: Number(materialQty.replace(',', '.')) || 0,
              materialUnit: 'т',
            }
          : {}),
        ...(kind === 'problem' ? { idleWorkers, idleSince: since.toISOString() } : {}),
      },
    );

    if (kind === 'problem') {
      notify(
        `Простой ушёл в ленту проблем руководства${result.idleCost ? ` · ≈ ${result.idleCost.toLocaleString('ru-RU')} сом` : ''}`,
      );
    } else if (kind === 'safety') {
      notify('Замечание по охране труда ушло главному инженеру');
    } else {
      notify('Комментарий сохранён в карточке процесса');
    }

    onClose();
    if (createZayavka) {
      go('zayavka-new', { processStateId: process.id });
    }
  });

  return (
    <BottomSheet onClose={onClose}>
      <div style={{ fontSize: 18, fontWeight: 800, color: color.ink, marginTop: 14 }}>Комментарий</div>
      <div style={{ fontSize: 13, color: color.inkMuted, marginTop: 3, lineHeight: 1.45 }}>
        Сначала тип — от него зависит, что произойдёт дальше.
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 12 }}>
        {COMMENT_TYPES.map((t) => (
          <Chip key={t.key} tone="dark" active={kind === t.key} onClick={() => setKind(t.key)}>
            {t.label}
          </Chip>
        ))}
      </div>

      {kind === 'material' ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SheetField label="МАТЕРИАЛ" value={materialName} onChange={setMaterialName} />
          <SheetField label="КОЛИЧЕСТВО, т" value={materialQty} onChange={setMaterialQty} />
        </div>
      ) : null}

      {kind === 'problem' ? (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              background: color.screen,
              borderRadius: radius.sm,
              padding: '10px 14px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700, color: color.ink }}>Сколько человек простаивает</div>
            <Stepper value={idleWorkers} onChange={setIdleWorkers} />
          </div>
          <SheetField label="С КАКОГО ВРЕМЕНИ" value={idleSince} onChange={setIdleSince} />
          <div
            style={{
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
            ⚠ Уйдёт в ленту проблем руководства с расчётной потерей по ставкам
          </div>
        </div>
      ) : null}

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
          placeholder="Что произошло"
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

      {submit.error ? (
        <div style={{ marginTop: 8, fontSize: 12.5, fontWeight: 800, color: color.danger }}>{submit.error}</div>
      ) : null}

      {/* Каждый тип предлагает конкретное действие, а не «сохранить и всё». */}
      {kind === 'material' ? (
        <PrimaryButton onClick={() => submit.run(true)} style={{ marginTop: 14, height: 54 }}>
          📦 Создать заявку по этому материалу
        </PrimaryButton>
      ) : null}

      <div
        onClick={() => submit.run(false)}
        style={{
          cursor: 'pointer',
          marginTop: 10,
          height: 50,
          borderRadius: radius.md,
          background: kind === 'material' ? color.chip : color.primary,
          color: kind === 'material' ? color.ink : '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 15,
          fontWeight: 800,
        }}
      >
        {kind === 'problem' ? 'Зафиксировать простой' : 'Сохранить комментарий'}
      </div>
    </BottomSheet>
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
