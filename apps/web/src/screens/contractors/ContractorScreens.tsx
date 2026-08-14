/**
 * В1–В3 · Подрядчики, разложение рейтинга, оценка.
 *
 * Рейтинг — это не одна цифра: автоматическая часть считается из данных
 * системы, субъективная приходит от прораба. Разложение открывается по тапу
 * на цифру, иначе оценке не верят.
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Card, Chip, PrimaryButton, SectionLabel, tabular } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { ContractorDto } from '../../api/types';
import { useApp } from '../../store/app';

function ratingColor(rating: number): string {
  if (rating >= 4) return color.greenDeep;
  if (rating >= 3) return color.warnStrong;
  return color.danger;
}

function ratingLabel(rating: number): string {
  if (rating >= 4) return 'надёжный';
  if (rating >= 3) return 'под вопросом';
  return 'проблемный';
}

export function ContractorsScreen() {
  const go = useApp((s) => s.go);
  const { data } = useQuery<ContractorDto[]>('/contractors');

  return (
    <ScreenBody>
      <RootHeader title="Подрядчики" subtitle={`${data?.length ?? 0} на объекте`} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        {(data ?? []).map((c) => (
          <Card
            key={c.id}
            onClick={() => go('contractor', { contractorId: c.id })}
            style={{
              borderRadius: radius.md,
              padding: '14px 16px',
              ...(c.stopped ? { border: '1.5px solid #F0B4B0' } : null),
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15.5, fontWeight: 800, color: color.ink }}>{c.name}</div>
                <div style={{ fontSize: 12.5, color: color.muted, marginTop: 2 }}>{c.scope}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800, color: ratingColor(c.rating), ...tabular }}>
                  {c.rating.toFixed(1).replace('.', ',')} / 5
                </div>
                <div style={{ fontSize: 11, fontWeight: 800, color: ratingColor(c.rating) }}>
                  {ratingLabel(c.rating)}
                </div>
              </div>
            </div>

            <div style={{ fontSize: 12.5, color: color.muted, marginTop: 6, ...tabular }}>
              {c.activeWorkers} чел сегодня · предписания: открытых {c.prescriptionsOpen} · всего{' '}
              {c.prescriptionsTotal}
            </div>

            {c.stopped ? (
              <div style={{ fontSize: 12.5, fontWeight: 800, color: color.danger, marginTop: 6, lineHeight: 1.4 }}>
                ⛔ Работы приостановлены · {c.stopReason}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

export function ContractorCardScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);
  const me = useApp((s) => s.me);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const { data } = useQuery<ContractorDto[]>('/contractors');
  const contractor = data?.find((c) => c.id === params.contractorId);

  const prescribe = useAction(async () => {
    await api.post(`/contractors/${params.contractorId}/prescription`, {
      kind: 'safety',
      text: 'Нарушение ТБ — работа на высоте без страховочной системы',
      location: 'Блок А, 5 эт.',
      dueDays: 3,
      photos: [],
    });
    notify(
      me?.role === 'master'
        ? 'Зафиксировано · ушло прорабу — предписание выдаёт он'
        : 'Предписание выдано · копия главному инженеру',
    );
  });

  if (!contractor) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  const auto = contractor.breakdown.auto;
  const manual = contractor.breakdown.manual;

  return (
    <ScreenBody>
      <ScreenHeader title={contractor.name} subtitle={contractor.scope} onBack={back} />

      <Card style={{ margin: '4px 20px' }} onClick={() => setShowBreakdown((v) => !v)}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 38, fontWeight: 800, color: ratingColor(contractor.rating), ...tabular }}>
            {contractor.rating.toFixed(1).replace('.', ',')}
          </div>
          <div style={{ fontSize: 17, fontWeight: 700, color: color.muted }}>из 5</div>
          <div style={{ marginLeft: 'auto', fontSize: 12.5, fontWeight: 700, color: color.primary }}>
            {showBreakdown ? 'свернуть' : 'как посчитано ›'}
          </div>
        </div>

        {showBreakdown ? (
          <div style={{ marginTop: 12 }}>
            <SectionLabel style={{ fontSize: 12 }}>
              ИЗ ДАННЫХ СИСТЕМЫ · вес {Math.round(auto.weight * 100)}%
            </SectionLabel>
            <ScoreRow label="Сроки этапов" value={auto.onTime} />
            <ScoreRow label="Переделки" value={auto.rework} />
            <ScoreRow label="Нарушения ТБ" value={auto.safety} />
            <ScoreRow label="Документы вовремя" value={auto.docs} />

            <SectionLabel style={{ fontSize: 12, marginTop: 12 }}>
              ОЦЕНКА ПРОРАБА · вес {Math.round(manual.weight * 100)}% · {manual.count} оценок
            </SectionLabel>
            <ScoreRow label="Качество" value={manual.quality} />
            <ScoreRow label="Охрана труда" value={manual.safety} />
            <ScoreRow label="Управляемость" value={manual.management} />
            <ScoreRow label="Культура производства" value={manual.culture} />
          </div>
        ) : null}
      </Card>

      <Card style={{ margin: '8px 20px' }}>
        <div style={{ fontSize: 13.5, color: color.inkMuted, ...tabular }}>
          {contractor.activeWorkers} человек на объекте сегодня
        </div>
        <div style={{ fontSize: 13.5, color: color.inkMuted, marginTop: 4, ...tabular }}>
          Предписания: открытых {contractor.prescriptionsOpen} из {contractor.prescriptionsTotal}
        </div>
        {contractor.stopped ? (
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
            ⛔ {contractor.stopReason}
          </div>
        ) : null}
      </Card>

      <div
        style={{
          marginTop: 'auto',
          padding: '16px 20px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <PrimaryButton onClick={() => go('contractor-rate', { contractorId: contractor.id })}>
          Оценить этап
        </PrimaryButton>
        <div
          onClick={() => prescribe.run()}
          style={{
            cursor: 'pointer',
            height: 50,
            borderRadius: radius.md,
            background: color.chip,
            color: color.ink,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 14.5,
            fontWeight: 800,
          }}
        >
          {me?.role === 'master' ? 'Зафиксировать нарушение' : 'Выдать предписание'}
        </div>
      </div>
    </ScreenBody>
  );
}

function ScoreRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
      <div style={{ flex: 1, fontSize: 13, color: color.ink }}>{label}</div>
      <div style={{ width: 90, height: 6, borderRadius: 3, background: color.track }}>
        <div
          style={{
            width: `${(value / 5) * 100}%`,
            height: 6,
            borderRadius: 3,
            background: ratingColor(value),
          }}
        />
      </div>
      <div style={{ width: 30, fontSize: 12.5, fontWeight: 800, color: color.ink, textAlign: 'right', ...tabular }}>
        {value.toFixed(1).replace('.', ',')}
      </div>
    </div>
  );
}

/* ───────────────────────────── В3 · Оценка ───────────────────────────── */

const CRITERIA: { key: 'quality' | 'safety' | 'management' | 'culture'; label: string; hint: string }[] = [
  { key: 'quality', label: 'Качество работ', hint: 'переделки, замечания технадзора' },
  { key: 'safety', label: 'Охрана труда', hint: 'каски, страховка, ограждения' },
  { key: 'management', label: 'Управляемость', hint: 'реагирует на замечания, держит слово' },
  { key: 'culture', label: 'Культура производства', hint: 'убирает за собой, не мешает смежникам' },
];

export function ContractorRateScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const notify = useApp((s) => s.notify);

  const [values, setValues] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');

  const { data } = useQuery<ContractorDto[]>('/contractors');
  const contractor = data?.find((c) => c.id === params.contractorId);

  const submit = useAction(async () => {
    await api.post(`/contractors/${params.contractorId}/rate`, {
      quality: values.quality ?? 3,
      safety: values.safety ?? 3,
      management: values.management ?? 3,
      culture: values.culture ?? 3,
      comment: comment || undefined,
    });
    notify('Оценка сохранена · войдёт в рейтинг подрядчика');
    go('contractor', { contractorId: params.contractorId });
  });

  const complete = CRITERIA.every((c) => values[c.key]);

  return (
    <ScreenBody>
      <ScreenHeader title="Оценка подрядчика" subtitle={contractor?.name ?? ''} onBack={back} />

      <div style={{ padding: '4px 20px 0', fontSize: 12.5, color: color.muted, lineHeight: 1.5 }}>
        Оценка субъективная и весит меньше данных системы. Подрядчик видит итог, но не вашу часть отдельно.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 20px 0' }}>
        {CRITERIA.map((c) => (
          <Card key={c.key} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ fontSize: 14.5, fontWeight: 800, color: color.ink }}>{c.label}</div>
            <div style={{ fontSize: 12, color: color.muted, marginTop: 2 }}>{c.hint}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
              {[1, 2, 3, 4, 5].map((n) => {
                const on = values[c.key] === n;
                return (
                  <div
                    key={n}
                    onClick={() => setValues((v) => ({ ...v, [c.key]: n }))}
                    style={{
                      cursor: 'pointer',
                      flex: 1,
                      height: 44,
                      borderRadius: radius.xs,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 16,
                      fontWeight: 800,
                      ...(on
                        ? { background: color.primary, color: '#fff' }
                        : { background: color.screen, color: color.ink }),
                    }}
                  >
                    {n}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>

      <Card style={{ margin: '8px 20px' }}>
        <SectionLabel>КОММЕНТАРИЙ</SectionLabel>
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="что стоит учесть в следующий раз"
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

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px' }}>
        <PrimaryButton onClick={() => submit.run()} disabled={!complete || submit.busy}>
          {complete ? 'Сохранить оценку' : 'Оцените все четыре критерия'}
        </PrimaryButton>
      </div>
    </ScreenBody>
  );
}

export { Chip };
