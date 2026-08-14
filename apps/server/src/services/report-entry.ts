/**
 * Запись выполнения. Общая для онлайн-запроса и офлайн-очереди:
 * правила обязаны совпадать, иначе синхронизация станет дырой в контроле.
 */
import { prisma } from '../db.js';
import { checkReportEntry, type RuleFailure } from '../rules.js';
import { getThreshold } from '../thresholds.js';
import { MAX_PHOTOS_PER_ENTRY } from '../storage.js';

export interface EntryPhotoRef {
  fileId: string;
}

export interface EntryInput {
  processStateId: string;
  volume: number;
  unit: string;
  workers: number;
  problems?: string[];
  tempAir?: number;
  tempMix?: number;
  winterMethod?: string;
  comment?: string;
  photos: EntryPhotoRef[];
}

export type EntryResult =
  | { ok: true; reportId: string; entryId: string }
  | { ok: false; status: number; failure: RuleFailure };

function dayStart(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Сохранение записи. Порядок проверок повторяет порядок отказов на экране:
 * сначала «куда пишем», потом «что пишем», потом «чем подтверждаем».
 */
export async function applyReportEntry(
  authorId: string,
  date: string,
  input: EntryInput,
): Promise<EntryResult> {
  const day = dayStart(date);

  const state = await prisma.processState.findUnique({
    where: { id: input.processStateId },
    include: { processDef: true },
  });
  if (!state) {
    return { ok: false, status: 404, failure: { code: 'not_found', message: 'Процесс не найден' } };
  }
  if (state.status === 'blocked') {
    return {
      ok: false,
      status: 409,
      failure: { code: 'blocked', message: state.blockedReason ?? 'Процесс заблокирован' },
    };
  }

  if (input.photos.length > MAX_PHOTOS_PER_ENTRY) {
    return {
      ok: false,
      status: 422,
      failure: {
        code: 'too_many_photos',
        message: `Не больше ${MAX_PHOTOS_PER_ENTRY} фото на запись`,
      },
    };
  }

  // Запись считается неполной, пока хотя бы один файл не подтверждён загруженным (ТЗ §8).
  const files = input.photos.length
    ? await prisma.fileObject.findMany({ where: { id: { in: input.photos.map((p) => p.fileId) } } })
    : [];
  const uploaded = files.filter((f) => f.status === 'uploaded');

  if (input.photos.length > 0 && uploaded.length !== input.photos.length) {
    return {
      ok: false,
      status: 409,
      failure: {
        code: 'photo_not_uploaded',
        message: 'Фото ещё не догрузилось — запись сохранится, когда загрузка завершится',
      },
    };
  }

  const winterTempC = await getThreshold({
    key: 'winterTempC',
    facilityId: state.objectId,
    processId: state.processDefId,
  });

  const failure = checkReportEntry({ ...input, photos: uploaded }, winterTempC);
  if (failure) return { ok: false, status: 422, failure };

  const report = await prisma.dailyReport.upsert({
    where: { date_authorId: { date: day, authorId } },
    create: { date: day, authorId, objectId: state.objectId, status: 'draft' },
    update: {},
  });

  // Согласованный отчёт не правится: фото после согласования неприкосновенны (ТЗ §12).
  if (report.status === 'accepted') {
    return {
      ok: false,
      status: 409,
      failure: { code: 'report_accepted', message: 'Отчёт согласован — изменить его нельзя' },
    };
  }

  const existing = await prisma.reportEntry.findFirst({
    where: { reportId: report.id, processStateId: input.processStateId },
  });

  const data = {
    reportId: report.id,
    processStateId: input.processStateId,
    volume: input.volume,
    unit: input.unit,
    workers: input.workers,
    problems: JSON.stringify(input.problems ?? []),
    tempAir: input.tempAir,
    tempMix: input.tempMix,
    winterMethod: input.winterMethod,
    comment: input.comment,
  };

  const entry = existing
    ? await prisma.reportEntry.update({ where: { id: existing.id }, data })
    : await prisma.reportEntry.create({ data });

  await prisma.reportPhoto.deleteMany({ where: { entryId: entry.id } });
  if (uploaded.length > 0) {
    await prisma.reportPhoto.createMany({
      data: uploaded.map((f) => ({
        entryId: entry.id,
        fileId: f.id,
        url: f.key,
        takenAt: f.takenAt ?? f.uploadedAt ?? new Date(),
        lat: f.lat,
        lon: f.lon,
      })),
    });
  }

  return { ok: true, reportId: report.id, entryId: entry.id };
}
