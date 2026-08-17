/**
 * B4 · Форма ввода объёма.
 *
 * Цель — 2 тапа вместо 30 минут в WhatsApp, поэтому: клавиатура своя (не
 * системная), единица измерения берётся из процесса, «как вчера» подставляет
 * прошлый объём, а пересчёт процента виден до сохранения. Сохранение
 * блокируется тем, что нельзя восстановить задним числом: фото и зимним
 * методом при морозе.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { color, radius, shadow } from '../../design/tokens';
import { Card, Chip, ProgressBar, Stepper, formatNumber, formatPct, tabular } from '../../design/primitives';
import { BackButton } from '../../design/primitives';
import { useQuery, useAction } from '../../api/hooks';
import { ApiError, api } from '../../api/client';
import { type UploadedPhoto, currentPosition, uploadPhoto } from '../../api/uploads';
import type { ProcessDetail } from '../../api/types';
import { formatElapsed, useApp } from '../../store/app';
import { ScreenState } from '../../design/DataState';
import { ScreenBody } from '../../shell/PhoneFrame';

/** Ниже +5 °C метод зимнего бетонирования обязателен — это правило ППР, не подсказка. */
const WINTER_TEMP = 5;

const WINTER_METHODS = [
  'Термос',
  'Противоморозные добавки',
  'Электропрогрев',
  'Греющая опалубка',
  'Тепляк',
];

const PROBLEM_CHIPS = [
  'Нехватка материала',
  'Нет техники',
  'Погода',
  'Нет фронта работ',
  'Отсутствие людей',
  'Замечание по качеству',
];

/** Разделы, где температура смеси замеряется обязательно. */
function needsMixTemp(sectionName: string | undefined): boolean {
  return sectionName === 'Монолит' || sectionName === 'Кладка' || sectionName === 'Стяжка';
}

export function FormScreen() {
  const params = useApp((s) => s.params);
  const go = useApp((s) => s.go);
  const back = useApp((s) => s.back);
  const notify = useApp((s) => s.notify);
  const formStartedAt = useApp((s) => s.formStartedAt);

  const { data: process, loading, error, reload } = useQuery<ProcessDetail>(
    params.processStateId ? `/process/${params.processStateId}` : null,
  );

  const [volume, setVolume] = useState('');
  const [workers, setWorkers] = useState(12);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(0);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  /**
   * Координаты запрашиваем при открытии формы, а не в момент съёмки.
   * Определение занимает секунды, и ждать их после нажатия на затвор
   * значит держать человека перед пустым экраном — пока он набирает
   * объём, метка успевает приехать сама.
   */
  const geo = useRef<{ lat: number; lon: number } | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [tempAir, setTempAir] = useState('21');
  const [tempMix, setTempMix] = useState('');
  const [winterMethod, setWinterMethod] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setElapsed(formStartedAt ? Date.now() - formStartedAt : 0), 1000);
    return () => clearInterval(id);
  }, [formStartedAt]);

  useEffect(() => {
    let alive = true;
    void currentPosition().then((pos) => {
      if (alive) geo.current = pos;
    });
    return () => {
      alive = false;
    };
  }, []);

  const save = useAction(async (andNext: boolean) => {
    if (!process) return;
    const result = await api.post<{ reportId: string }>('/report/entry', {
      date: new Date().toISOString(),
      entry: {
        processStateId: process.id,
        volume: parsedVolume,
        unit: process.unit,
        workers,
        problems,
        tempAir: air,
        tempMix: tempMix ? Number(tempMix.replace(',', '.')) : undefined,
        winterMethod: winterMethod ?? undefined,
        // В отчёт уходит только ссылка: само фото уже лежит в хранилище
        // вместе с геометкой и временем съёмки.
        photos: photos.map((p) => ({ fileId: p.fileId })),
      },
    });
    notify(`Сохранено · ${process.name}`);
    if (andNext) go('today');
    else go('preview', { reportId: result.reportId });
  });

  const parsedVolume = Number(volume.replace(',', '.')) || 0;
  const air = tempAir ? Number(tempAir.replace(',', '.')) : undefined;
  const cold = air !== undefined && air < WINTER_TEMP;
  const hot = air !== undefined && air > 30;

  const remaining = process ? Math.max(0, process.planQty - process.doneQty) : 0;
  const overPlan = process ? parsedVolume > remaining && remaining > 0 : false;
  const newPct = process && process.planQty > 0 ? ((process.doneQty + parsedVolume) / process.planQty) * 100 : 0;

  /** Что мешает сохранить — пишем текстом, а не гасим кнопку молча. */
  const blocker = useMemo(() => {
    if (!parsedVolume) return 'Введите объём за сегодня';
    if (photos.length === 0) return 'Минимум 1 фото — обязательно';
    // Отправить, пока фото ещё грузится, значит потерять его из отчёта.
    if (uploading > 0) return 'Фото ещё загружается';
    if (cold && !winterMethod) return `При ${tempAir} °C укажите применённый метод`;
    return null;
  }, [parsedVolume, photos.length, uploading, cold, winterMethod, tempAir]);

  if (loading || error || !process) {
    return (
      <ScreenState
        loading={loading}
        error={error}
        missing={!process}
        missingText="Процесс не найден"
        onRetry={reload}
      />
    );
  }

  function press(key: string) {
    if (key === '⌫') setVolume((v) => v.slice(0, -1));
    else if (key === 'C') setVolume('');
    else if (volume.replace(/\D/g, '').length < 6) setVolume((v) => v + key);
  }

  /**
   * Съёмка. Фото уходит в хранилище сразу, а в отчёт попадает ссылкой:
   * отправлять двадцать файлов вместе с отчётом по связи, которая рвётся
   * посреди этажа, — значит не отправить его никогда.
   */
  async function onPickPhotos(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = [...(event.target.files ?? [])];
    // Значение сбрасываем сразу: иначе повторный выбор того же файла
    // не вызовет событие, и кнопка будет выглядеть залипшей.
    event.target.value = '';
    if (picked.length === 0) return;

    setPhotoError(null);
    setUploading((n) => n + picked.length);

    for (const file of picked) {
      try {
        // Метки может ещё не быть — это не повод задерживать загрузку.
        // Фото без геометки лучше несданного отчёта, и ПТО увидит, что её нет.
        const photo = await uploadPhoto(file, geo.current);
        setPhotos((p) => [...p, photo]);
      } catch (e: unknown) {
        setPhotoError(e instanceof ApiError ? e.message : 'Не удалось загрузить фото');
      } finally {
        setUploading((n) => Math.max(0, n - 1));
      }
    }
  }

  function removePhoto(fileId: string) {
    setPhotos((p) => p.filter((x) => x.fileId !== fileId));
  }

  return (
    <ScreenBody>
      <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', gap: 12, flex: 'none' }}>
        <BackButton onClick={back} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, color: color.ink }}>{process.name}</div>
          <div style={{ fontSize: 13, color: color.muted }}>
            {process.sectionName} · {process.blockName} · {process.floor} эт.
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            fontWeight: 800,
            color: '#fff',
            background: color.ink,
            borderRadius: radius.xxs,
            padding: '5px 10px',
            ...tabular,
          }}
        >
          ⏱ {formatElapsed(elapsed)}
        </div>
      </div>

      <div
        style={{
          margin: '2px 20px',
          background: color.surface,
          borderRadius: radius.lg,
          padding: '14px 18px',
          boxShadow: `0 0 0 2px ${color.primary}`,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: color.muted }}>ОБЪЁМ ЗА СЕГОДНЯ</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 2 }}>
          <div style={{ fontSize: 40, fontWeight: 800, color: color.ink, minHeight: 52, ...tabular }}>
            {volume || '0'}
            <span
              style={{
                display: 'inline-block',
                width: 2,
                height: 32,
                background: color.primary,
                marginLeft: 2,
                verticalAlign: -3,
              }}
            />
          </div>
          <div style={{ fontSize: 19, fontWeight: 700, color: color.muted }}>{process.unit}</div>
        </div>

        <div style={{ marginTop: 6, background: color.primaryBgSoft, borderRadius: radius.smAlt, padding: '8px 12px' }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: color.ink, ...tabular }}>
            станет {formatNumber(process.doneQty + parsedVolume, process.unit === 'т' ? 2 : 0)} из{' '}
            {formatNumber(process.planQty, process.unit === 'т' ? 1 : 0)} {process.unit}
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: color.green, ...tabular }}>
            {formatPct(process.pct)} → {formatPct(newPct)}
          </div>
          <div style={{ display: 'flex', marginTop: 6 }}>
            <ProgressBar pct={newPct} height={7} />
          </div>
        </div>

        {overPlan ? (
          <div
            style={{
              marginTop: 6,
              background: color.warnBg,
              border: `1px solid ${color.warnBorder}`,
              borderRadius: radius.xxs,
              padding: '7px 10px',
              fontSize: 12,
              fontWeight: 700,
              color: color.warnText,
            }}
          >
            ⚠ Больше, чем осталось по плану ({formatNumber(remaining, 1)} {process.unit}). Проверьте
          </div>
        ) : null}

        {process.history.length > 0 ? (
          <div
            onClick={() => setVolume(String(process.history[0]!.volume).replace('.', ','))}
            style={{
              cursor: 'pointer',
              display: 'inline-flex',
              marginTop: 8,
              background: color.chip,
              borderRadius: radius.xs,
              padding: '7px 12px',
              fontSize: 12.5,
              fontWeight: 700,
              color: color.primary,
            }}
          >
            ↺ Как вчера · {formatNumber(process.history[0]!.volume, 2)} {process.unit}
          </div>
        ) : null}
      </div>

      {/* Температура: воздух — всегда, смесь — там, где важна по ППР. */}
      <Card style={{ margin: '8px 20px 0', borderRadius: radius.card, padding: '13px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: color.muted }}>ТЕМПЕРАТУРА</div>
          <div style={{ fontSize: 10.5, color: color.faint }}>пороги — из ППР, заводит ПТО</div>
        </div>
        <TempRow
          label="Воздух"
          value={tempAir}
          onChange={setTempAir}
          note="🌡 из погоды, исправимо"
          noteColor={color.primary}
        />
        {needsMixTemp(process.sectionName) ? (
          <TempRow
            label={process.sectionName === 'Монолит' ? 'Смесь' : 'Раствор'}
            value={tempMix}
            onChange={setTempMix}
            note="замер обязателен"
            noteColor={color.warnText}
          />
        ) : null}

        {cold ? (
          <div
            style={{
              marginTop: 9,
              background: color.warnBg,
              border: `1px solid ${color.warnBorderAlt}`,
              borderRadius: radius.smAlt,
              padding: '10px 12px',
            }}
          >
            <div style={{ fontSize: 12.5, fontWeight: 800, color: color.warnText, ...tabular }}>
              {tempAir} °C — ниже +5 °C, обычное бетонирование не допускается
            </div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: color.muted, marginTop: 6 }}>
              Применённый метод — обязательно:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
              {WINTER_METHODS.map((m) => (
                <Chip
                  key={m}
                  active={winterMethod === m}
                  onClick={() => setWinterMethod(m)}
                  style={{ fontSize: 12, padding: '6px 10px' }}
                >
                  {m}
                </Chip>
              ))}
            </div>
          </div>
        ) : null}

        {hot ? (
          <div
            style={{
              marginTop: 9,
              background: color.warnBg,
              border: `1px solid ${color.warnBorderAlt}`,
              borderRadius: radius.smAlt,
              padding: '10px 12px',
              fontSize: 12.5,
              fontWeight: 800,
              color: color.warnText,
              ...tabular,
            }}
          >
            {tempAir} °C — жара, нужен уход за бетоном и защита от испарения
          </div>
        ) : null}
      </Card>

      <Card
        style={{
          margin: '8px 20px 0',
          borderRadius: radius.card,
          padding: '10px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: color.muted }}>РАБОЧИЕ</div>
        <Stepper value={workers} onChange={setWorkers} />
      </Card>

      <div style={{ display: 'flex', gap: 8, padding: '8px 20px', alignItems: 'center', flexWrap: 'wrap' }}>
        {/*
          capture="environment" открывает на телефоне сразу заднюю камеру,
          а на настольном браузере — обычный выбор файла. Отдельная кнопка
          «снять» и «выбрать» прорабу в перчатках не нужна.
        */}
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          multiple
          onChange={onPickPhotos}
          style={{ display: 'none' }}
          data-testid="photo-input"
        />
        <div
          onClick={() => fileInput.current?.click()}
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
            key={p.fileId}
            onClick={() => removePhoto(p.fileId)}
            title="Убрать фото"
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.sm,
              flex: 'none',
              position: 'relative',
              cursor: 'pointer',
              overflow: 'hidden',
              background: 'repeating-linear-gradient(45deg,#D8DAE3 0 8px,#E7E9F0 8px 16px)',
            }}
          >
            <img
              src={p.previewUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 4,
                left: 4,
                background: 'rgba(20,22,31,0.75)',
                color: '#fff',
                fontSize: 8.5,
                fontWeight: 700,
                borderRadius: 6,
                padding: '1px 5px',
              }}
            >
              {/* Метки нет — так и показываем: ПТО должно это видеть. */}
              {p.lat === undefined ? '⌖' : '📍'}{' '}
              {new Date(p.takenAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}

        {uploading > 0 ? (
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: radius.sm,
              flex: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: color.chip,
              fontSize: 10.5,
              fontWeight: 700,
              color: color.muted,
              textAlign: 'center',
            }}
          >
            грузим…
          </div>
        ) : null}
        {photos.length === 0 && uploading === 0 ? (
          <div style={{ fontSize: 11.5, color: color.warnText, fontWeight: 700, lineHeight: 1.4 }}>
            мин. 1 фото —<br />
            обязательно
          </div>
        ) : null}
      </div>

      {photoError ? (
        <div style={{ padding: '0 20px 6px', fontSize: 12, fontWeight: 700, color: color.danger }}>
          {photoError}
        </div>
      ) : null}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, padding: '0 20px 4px' }}>
        {PROBLEM_CHIPS.map((p) => (
          <Chip
            key={p}
            tone="dark"
            active={problems.includes(p)}
            onClick={() =>
              setProblems((list) => (list.includes(p) ? list.filter((x) => x !== p) : [...list, p]))
            }
            style={{ fontSize: 12, padding: '7px 11px' }}
          >
            {p}
          </Chip>
        ))}
      </div>

      <div
        style={{
          marginTop: 'auto',
          background: color.surface,
          borderTop: `1px solid ${color.track}`,
          padding: '10px 16px 6px',
          flex: 'none',
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 6 }}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'].map((k) => (
            <div
              key={k}
              onClick={() => press(k)}
              style={{
                cursor: 'pointer',
                height: 46,
                borderRadius: radius.smAlt,
                background: color.screen,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                fontWeight: 800,
                color: color.ink,
              }}
            >
              {k}
            </div>
          ))}
        </div>

        {blocker ? (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: color.warnText, textAlign: 'center' }}>
            {blocker}
          </div>
        ) : null}
        {save.error ? (
          <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: color.danger, textAlign: 'center' }}>
            {save.error}
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: 8, padding: '10px 0 14px' }}>
          <div
            onClick={() => !blocker && !save.busy && save.run(true)}
            style={{
              cursor: blocker ? 'default' : 'pointer',
              flex: 1,
              height: 50,
              borderRadius: radius.mdAlt,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14.5,
              fontWeight: 800,
              background: blocker ? color.disabled : color.chip,
              color: blocker ? '#fff' : color.ink,
            }}
          >
            Сохранить
          </div>
          <div
            onClick={() => !blocker && !save.busy && save.run(false)}
            style={{
              cursor: blocker ? 'default' : 'pointer',
              flex: 1.1,
              height: 50,
              borderRadius: radius.mdAlt,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14.5,
              fontWeight: 800,
              background: blocker ? color.disabled : color.primary,
              color: '#fff',
              boxShadow: blocker ? 'none' : shadow.primary,
            }}
          >
            Сохранить и далее
          </div>
        </div>
      </div>
    </ScreenBody>
  );
}

function TempRow({
  label,
  value,
  onChange,
  note,
  noteColor,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  note: string;
  noteColor: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
      <div style={{ flex: 1, fontSize: 13, color: color.ink }}>{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
          color: color.ink,
          textAlign: 'center',
          fontFamily: 'inherit',
          fontVariantNumeric: 'tabular-nums',
        }}
      />
      <div style={{ fontSize: 13, fontWeight: 700, color: color.ink, width: 22 }}>°C</div>
      <div style={{ fontSize: 10.5, color: noteColor, fontWeight: 700, width: 74, lineHeight: 1.3 }}>{note}</div>
    </div>
  );
}
