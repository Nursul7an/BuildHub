/**
 * PR1–PR6 · Проект и DC1–DC5 · Документы.
 *
 * Прораб здесь потребитель, а не архивариус: главная функция — понять, по
 * действующему ли листу он работает, и какой документ держит работу.
 * Заменённый лист помечается явно, а не «просто лежит рядом».
 */
import { useState } from 'react';
import { color, radius } from '../../design/tokens';
import { Badge, Card, PrimaryButton, SectionLabel, tabular } from '../../design/primitives';
import { RootHeader, ScreenHeader } from '../../shell/ScreenHeader';
import { ScreenBody } from '../../shell/PhoneFrame';
import { useAction, useQuery } from '../../api/hooks';
import { api } from '../../api/client';
import type { DocumentDto, DrawingSetDto, ProtocolDto, RfiDto, SheetDetailDto, SheetDto } from '../../api/types';
import { useApp } from '../../store/app';
import { DataState } from '../../design/DataState';
import { DataRows, type Column } from '../../design/DataRows';

/* ───────────────────────────── PR1 · Марки комплектов ───────────────────────────── */

export function ProjectScreen() {
  const go = useApp((s) => s.go);
  const { data } = useQuery<DrawingSetDto[]>('/v1/doc-sets');

  // Стадии разделяются обязательно: П, РД и ИД — разные документы с разной силой.
  const byStage = new Map<string, DrawingSetDto[]>();
  for (const set of data ?? []) {
    byStage.set(set.stage, [...(byStage.get(set.stage) ?? []), set]);
  }

  return (
    <ScreenBody>
      <RootHeader title="Проект" subtitle="комплекты рабочей документации" />

      <div
        onClick={() => go('project-current')}
        style={{
          cursor: 'pointer',
          margin: '4px 20px 0',
          background: color.primaryBg,
          border: `1px solid ${color.primaryBorder}`,
          borderRadius: radius.md,
          padding: '12px 14px',
          fontSize: 13.5,
          fontWeight: 800,
          color: color.primaryDark,
        }}
      >
        📐 Действующие листы — только актуальные ревизии ›
      </div>

      <div style={{ padding: '12px 20px 20px' }}>
        {[...byStage.entries()].map(([stage, sets]) => (
          <div key={stage}>
            <SectionLabel style={{ marginTop: 8, marginBottom: 6 }}>
              СТАДИЯ {stage}
              {stage === 'РД' ? ' · рабочая документация' : stage === 'П' ? ' · проектная' : ' · исполнительная'}
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {sets.map((set) => (
                <Card
                  key={set.id}
                  onClick={() => go('project-set', { setId: set.id })}
                  style={{ borderRadius: radius.md, padding: '14px 16px' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>
                      {set.mark} · {set.name}
                    </div>
                    <div style={{ color: color.faint, fontSize: 16 }}>›</div>
                  </div>
                  <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3, ...tabular }}>
                    {set.revision} от {new Date(set.issuedAt).toLocaleDateString('ru-RU')} · {set.sheetCount}{' '}
                    листов
                  </div>
                  {set.revisedCount > 0 ? (
                    <div style={{ fontSize: 12, fontWeight: 700, color: color.warnText, marginTop: 4 }}>
                      🔴 листов с изменениями: {set.revisedCount}
                    </div>
                  ) : null}
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── PR2 · Листы комплекта ───────────────────────────── */

export function ProjectSetScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const { data } = useQuery<DrawingSetDto[]>('/v1/doc-sets');
  const set = data?.find((s) => s.id === params.setId);

  if (!set) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем…</ScreenBody>;

  return (
    <ScreenBody>
      <ScreenHeader
        title={`${set.mark} · ${set.name}`}
        subtitle={`${set.revision} · ${set.sheetCount} листов`}
        onBack={back}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
        {set.sheets.map((sheet) => (
          <SheetRow key={sheet.id} sheet={sheet} onOpen={() => go('project-sheet', { sheetId: sheet.id })} />
        ))}
      </div>
    </ScreenBody>
  );
}

export function CurrentSheetsScreen() {
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const { data } = useQuery<SheetDto[]>('/v1/sheets/active');

  return (
    <ScreenBody>
      <ScreenHeader
        title="Действующие листы"
        subtitle="по ним можно работать сегодня"
        onBack={back}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
        {(data ?? []).map((sheet) => (
          <SheetRow key={sheet.id} sheet={sheet} onOpen={() => go('project-sheet', { sheetId: sheet.id })} />
        ))}
      </div>
    </ScreenBody>
  );
}

function SheetRow({ sheet, onOpen }: { sheet: SheetDto; onOpen: () => void }) {
  return (
    <Card onClick={onOpen} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>{sheet.number}</div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 2 }}>{sheet.name}</div>
        </div>
        {/* В реестре по определению только действующие листы. */}
        <Badge tone="green" style={{ flexShrink: 0 }}>
          действующий
        </Badge>
      </div>
      <div style={{ fontSize: 12, color: color.muted, marginTop: 5, ...tabular }}>
        {sheet.revision ?? '—'}
        {sheet.versionCount && sheet.versionCount > 1 ? ` · изменений: ${sheet.versionCount - 1}` : ''}
      </div>
    </Card>
  );
}

/* ───────────────────────────── PR3 · Просмотр листа ───────────────────────────── */

export function SheetScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const go = useApp((s) => s.go);
  const { data: sheet } = useQuery<SheetDetailDto>(
    params.sheetId ? `/v1/sheets/${params.sheetId}` : null,
  );

  if (!sheet) return <ScreenBody style={{ padding: 20, color: color.muted }}>Загружаем лист…</ScreenBody>;

  return (
    <ScreenBody>
      <ScreenHeader title={sheet.number} subtitle={sheet.name} onBack={back} />

      {/* Предупреждение об устаревшей версии — поверх листа, а не сбоку от него. */}
      {sheet.outdated ? (
        <div
          style={{
            margin: '4px 20px',
            background: color.warnBg,
            border: `1px solid ${color.warnBorder}`,
            borderRadius: radius.md,
            padding: '12px 14px',
            fontSize: 13,
            fontWeight: 800,
            color: color.warnText,
            lineHeight: 1.45,
          }}
        >
          🔴 {sheet.warning}
        </div>
      ) : null}

      <div
        style={{
          margin: '8px 20px',
          height: 300,
          borderRadius: radius.md,
          background: 'repeating-linear-gradient(45deg,#EEF0F6 0 12px,#F4F5F9 12px 24px)',
          border: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: color.faint,
          fontSize: 13,
        }}
      >
        Просмотр листа · {sheet.version.revision}
      </div>

      <Card style={{ margin: '0 20px' }}>
        <div style={{ fontSize: 13, color: color.inkMuted, ...tabular }}>
          {sheet.version.revision} от {new Date(sheet.version.issuedAt).toLocaleDateString('ru-RU')}
        </div>
        {sheet.version.changeSummary ? (
          <div style={{ fontSize: 12.5, color: color.warnText, fontWeight: 700, marginTop: 6 }}>
            ✎ Что изменилось: {sheet.version.changeSummary}
          </div>
        ) : null}
        {sheet.history.length > 1 ? (
          <div style={{ fontSize: 12, color: color.muted, marginTop: 6 }}>
            История: {sheet.history.map((v) => v.revision).join(' → ')}
          </div>
        ) : null}
        {sheet.rfis.length > 0 ? (
          <div style={{ fontSize: 12.5, color: color.primary, fontWeight: 700, marginTop: 6 }}>
            📐 По листу есть запросы: {sheet.rfis.map((r) => r.number).join(', ')}
          </div>
        ) : null}
      </Card>

      <div style={{ marginTop: 'auto', padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sheet.outdated && sheet.currentVersion ? (
          <PrimaryButton
            onClick={() => go('project-sheet', { sheetId: sheet.id })}
          >
            Открыть действующую версию · {sheet.currentVersion.revision}
          </PrimaryButton>
        ) : null}
        <div
          onClick={() => go('rfi', { sheetId: sheet.id })}
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
          Запрос проектировщику
        </div>
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── PR6 · RFI ───────────────────────────── */

export function RfiScreen() {
  const params = useApp((s) => s.params);
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);
  const me = useApp((s) => s.me);
  const [question, setQuestion] = useState('');

  const { data, reload } = useQuery<RfiDto[]>('/rfi');

  const create = useAction(async () => {
    if (!me?.objectId) return;
    const res = await api.post<{ number: string }>('/rfi', {
      objectId: me.objectId,
      sheetId: params.sheetId,
      question,
      dueAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    });
    notify(`${res.number} ушёл проектировщику · срок ответа 5 дней`);
    setQuestion('');
    reload();
  });

  return (
    <ScreenBody>
      <ScreenHeader title="Запросы проектировщику" subtitle="RFI" onBack={back} />

      <Card style={{ margin: '4px 20px' }}>
        <SectionLabel>НОВЫЙ ЗАПРОС</SectionLabel>
        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Опишите коллизию: какие листы расходятся и что мешает работать"
          rows={4}
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
            resize: 'vertical',
          }}
        />
        <PrimaryButton
          onClick={() => create.run()}
          disabled={question.trim().length < 10 || create.busy}
          style={{ marginTop: 10, height: 50 }}
        >
          Отправить запрос
        </PrimaryButton>
      </Card>

      <SectionLabel style={{ padding: '12px 20px 6px' }}>ОТКРЫТЫЕ ЗАПРОСЫ</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 20px 20px' }}>
        {(data ?? []).map((r) => (
          <Card key={r.id} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: color.primary, ...tabular }}>{r.number}</div>
              <Badge tone={r.overdue ? 'warn' : r.status === 'answered' ? 'green' : 'neutral'}>
                {r.overdue ? 'просрочен ответ' : r.status === 'answered' ? 'есть ответ' : 'ждём ответ'}
              </Badge>
            </div>
            <div style={{ fontSize: 13, color: color.ink, marginTop: 5, lineHeight: 1.45 }}>{r.question}</div>
            {r.answer ? (
              <div
                style={{
                  marginTop: 8,
                  background: color.greenBg,
                  borderRadius: radius.xs,
                  padding: '9px 11px',
                  fontSize: 12.5,
                  color: color.greenDeep,
                  lineHeight: 1.45,
                }}
              >
                {r.answer}
              </div>
            ) : null}
            <div style={{ fontSize: 11.5, color: color.faint, marginTop: 6 }}>
              {r.author} · {new Date(r.createdAt).toLocaleDateString('ru-RU')}
              {r.dueAt ? ` · ответ до ${new Date(r.dueAt).toLocaleDateString('ru-RU')}` : ''}
            </div>
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

/* ───────────────────────────── DC1 · Документы ───────────────────────────── */

export function DocumentsScreen() {
  const go = useApp((s) => s.go);
  const { data: docs } = useQuery<DocumentDto[]>('/documents');
  const { data: protocols } = useQuery<ProtocolDto[]>('/strength-protocols');

  const acts = (docs ?? []).filter((d) => d.kind === 'aosr');
  const pending = acts.filter((d) => d.status !== 'signed');
  const blocking = (protocols ?? []).filter((p) => p.blocksStripping);

  return (
    <ScreenBody>
      <RootHeader title="Документы" subtitle="то, что держит или открывает работу" />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 20px 20px' }}>
        <Card onClick={() => go('documents-acts')} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>Мои акты</div>
            <Badge tone={pending.length > 0 ? 'warn' : 'green'}>
              {pending.length > 0 ? `${pending.length} не подписано` : 'все подписаны'}
            </Badge>
          </div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
            АОСР по вашим процессам · всего {acts.length}
          </div>
        </Card>

        <Card
          onClick={() => go('documents-strength')}
          style={{
            borderRadius: radius.md,
            padding: '14px 16px',
            ...(blocking.length > 0 ? { border: `1.5px solid ${color.warnBorder}` } : null),
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>Протоколы прочности</div>
            <Badge tone={blocking.length > 0 ? 'warn' : 'green'}>
              {blocking.length > 0 ? `${blocking.length} держит распалубку` : 'нет ограничений'}
            </Badge>
          </div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
            Пока прочность не набрана, распалубка закрыта
          </div>
        </Card>

        <Card onClick={() => go('documents-object')} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>Документы объекта</div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
            Журналы, паспорта, общие документы · {docs?.length ?? 0}
          </div>
        </Card>

        <Card onClick={() => go('project')} style={{ borderRadius: radius.md, padding: '14px 16px' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>Проект</div>
          <div style={{ fontSize: 12.5, color: color.muted, marginTop: 3 }}>
            Комплекты, действующие листы, запросы проектировщику
          </div>
        </Card>
      </div>
    </ScreenBody>
  );
}

export function ActsScreen() {
  const back = useApp((s) => s.back);
  const { data, loading, error, reload } = useQuery<DocumentDto[]>('/documents?kind=aosr');
  const acts = data ?? [];

  const columns: Column<DocumentDto>[] = [
    {
      key: 'number',
      title: 'Номер',
      primary: true,
      cell: (d) => <span style={{ ...tabular }}>{d.number}</span>,
    },
    { key: 'name', title: 'Работы', cell: (d) => d.name },
    {
      key: 'status',
      title: 'Статус',
      cell: (d) => (
        <Badge tone={d.status === 'signed' ? 'green' : d.status === 'pending' ? 'primary' : 'warn'}>
          {d.status === 'signed' ? 'подписан' : d.status === 'pending' ? 'на подписи' : 'черновик'}
        </Badge>
      ),
    },
    {
      key: 'signedAt',
      title: 'Подписан',
      align: 'right',
      cell: (d) => (
        <span style={{ ...tabular }}>
          {d.signedAt ? new Date(d.signedAt).toLocaleDateString('ru-RU') : '—'}
        </span>
      ),
    },
  ];

  return (
    <ScreenBody>
      <ScreenHeader title="Мои акты" subtitle="АОСР по вашим процессам" onBack={back} />
      <div style={{ padding: '4px 20px 20px' }}>
        <DataState
          loading={loading}
          error={error}
          empty={acts.length === 0}
          emptyText="Актов пока нет. Они появляются после приёмки скрытых работ."
          onRetry={reload}
        >
          <DataRows items={acts} columns={columns} keyOf={(d) => d.id} />
        </DataState>
      </div>
    </ScreenBody>
  );
}

/** DC4 · Протокол прочности — шлюз распалубки. */
export function StrengthScreen() {
  const back = useApp((s) => s.back);
  const { data } = useQuery<ProtocolDto[]>('/strength-protocols');

  return (
    <ScreenBody>
      <ScreenHeader title="Протоколы прочности" subtitle="бетон · лаборатория" onBack={back} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '4px 20px 20px' }}>
        {(data ?? []).map((p) => (
          <Card
            key={p.id}
            style={{
              borderRadius: radius.md,
              padding: '14px 16px',
              ...(p.blocksStripping ? { border: `1.5px solid ${color.warnBorder}` } : null),
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: color.ink }}>{p.process}</div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 800,
                  color: p.status === 'passed' ? color.greenDeep : color.warnStrong,
                  ...tabular,
                }}
              >
                {p.strengthPct}%
              </div>
              <div style={{ fontSize: 14, color: color.muted, ...tabular }}>из требуемых {p.requiredPct}%</div>
            </div>
            <div style={{ height: 8, borderRadius: 4, background: color.track, marginTop: 8 }}>
              <div
                style={{
                  width: `${Math.min(100, (p.strengthPct / p.requiredPct) * 100)}%`,
                  height: 8,
                  borderRadius: 4,
                  background: p.status === 'passed' ? color.green : color.warnAccent,
                }}
              />
            </div>
            <div style={{ fontSize: 12, color: color.muted, marginTop: 8, ...tabular }}>
              залито {new Date(p.pouredAt).toLocaleDateString('ru-RU')} · проба{' '}
              {new Date(p.sampleAt).toLocaleDateString('ru-RU')} · {p.labName}
            </div>
            {p.blocksStripping ? (
              <div style={{ fontSize: 12.5, fontWeight: 800, color: color.warnText, marginTop: 6, lineHeight: 1.45 }}>
                ⛔ Распалубка закрыта, пока прочность не набрана
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </ScreenBody>
  );
}

export function ObjectDocumentsScreen() {
  const back = useApp((s) => s.back);
  const { data } = useQuery<DocumentDto[]>('/documents');

  const byKind = new Map<string, DocumentDto[]>();
  for (const d of data ?? []) byKind.set(d.kind, [...(byKind.get(d.kind) ?? []), d]);

  const KIND_LABEL: Record<string, string> = {
    aosr: 'Акты освидетельствования',
    aook: 'Акты ответственных конструкций',
    concreteStrength: 'Протоколы прочности',
    passport: 'Паспорта и сертификаты',
    journal: 'Журналы',
    other: 'Прочее',
  };

  return (
    <ScreenBody>
      <ScreenHeader title="Документы объекта" onBack={back} />
      <div style={{ padding: '4px 20px 20px' }}>
        {[...byKind.entries()].map(([kind, docs]) => (
          <div key={kind}>
            <SectionLabel style={{ marginTop: 10, marginBottom: 6 }}>
              {(KIND_LABEL[kind] ?? kind).toUpperCase()} · {docs.length}
            </SectionLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {docs.map((d) => (
                <div
                  key={d.id}
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
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: color.ink, ...tabular }}>{d.number}</div>
                    <div style={{ fontSize: 12, color: color.muted }}>{d.name}</div>
                  </div>
                  <Badge tone={d.status === 'signed' ? 'green' : 'neutral'} style={{ flexShrink: 0 }}>
                    {d.status === 'signed' ? '✓' : d.status}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </ScreenBody>
  );
}
