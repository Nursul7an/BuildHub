/**
 * Файлы: выдача предподписанных ссылок, загрузка, отдача. ТЗ §6, §12.
 *
 * Фото обязано нести время съёмки и геометку — по ним видно, что снимок сделан
 * на объекте и в тот день, а не взят из галереи. Поэтому метаданные требуются
 * при выдаче ссылки, а не «когда-нибудь потом».
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail } from '../http.js';
import {
  MAX_FILE_BYTES,
  buildKey,
  getObject,
  isAllowedMime,
  objectSize,
  presignDownload,
  presignUpload,
  putObject,
  verifyLink,
} from '../storage.js';

export async function fileRoutes(app: FastifyInstance) {
  // Бинарное тело принимаем как есть.
  app.addContentTypeParser(
    ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/octet-stream'],
    { parseAs: 'buffer' },
    (_req, body, done) => done(null, body),
  );

  /** Ссылка на загрузку. Живёт 15 минут. */
  app.post('/api/v1/files/presign', { preHandler: [app.authenticate] }, async (req, reply) => {
    const body = z
      .object({
        filename: z.string().min(1),
        mime: z.string().min(1),
        size: z.number().int().positive().optional(),
        purpose: z.enum(['entry', 'acceptance', 'prescription', 'document', 'sheet']).default('entry'),
        takenAt: z.string().optional(),
        lat: z.number().optional(),
        lon: z.number().optional(),
      })
      .parse(req.body);

    if (!isAllowedMime(body.mime)) {
      return fail(reply, 415, 'unsupported_media_type', `Тип ${body.mime} не принимается`);
    }
    if (body.size && body.size > MAX_FILE_BYTES) {
      return fail(reply, 413, 'file_too_large', 'Файл больше допустимого размера — сожмите на клиенте');
    }

    const key = buildKey(body.purpose, body.filename);
    const link = presignUpload(key);

    const file = await prisma.fileObject.create({
      data: {
        key,
        mime: body.mime,
        size: body.size,
        status: 'pending',
        takenAt: body.takenAt ? new Date(body.takenAt) : null,
        lat: body.lat,
        lon: body.lon,
        uploadedById: req.currentUser.id,
      },
    });

    return {
      fileId: file.id,
      key,
      uploadUrl: link.url,
      expiresAt: link.expiresAt,
      method: 'PUT',
    };
  });

  /**
   * Загрузка и отдача по подписанной ссылке.
   * Подпись проверяется вместо сессии: ссылка сама по себе и есть пропуск,
   * но живёт 15 минут и привязана к конкретному ключу и операции.
   */
  app.put('/api/v1/files/content', async (req, reply) => {
    const query = z
      .object({ key: z.string(), exp: z.coerce.number(), sig: z.string() })
      .parse(req.query);

    const check = verifyLink(query.key, query.exp, query.sig, 'put');
    if (!check.ok) {
      return fail(
        reply,
        403,
        check.code,
        check.code === 'link_expired' ? 'Ссылка истекла — запросите новую' : 'Подпись ссылки неверна',
      );
    }

    const file = await prisma.fileObject.findUnique({ where: { key: query.key } });
    if (!file) return fail(reply, 404, 'not_found', 'Файл не зарегистрирован');
    if (file.status === 'uploaded') {
      return fail(reply, 409, 'already_uploaded', 'Файл уже загружен');
    }

    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) {
      return fail(reply, 400, 'empty_body', 'Тело запроса пустое');
    }
    if (body.length > MAX_FILE_BYTES) {
      return fail(reply, 413, 'file_too_large', 'Файл больше допустимого размера');
    }

    await putObject(query.key, body);
    await prisma.fileObject.update({
      where: { id: file.id },
      data: { status: 'uploaded', size: body.length, uploadedAt: new Date() },
    });

    return { ok: true, size: body.length };
  });

  app.get('/api/v1/files/content', async (req, reply) => {
    const query = z
      .object({ key: z.string(), exp: z.coerce.number(), sig: z.string() })
      .parse(req.query);

    const check = verifyLink(query.key, query.exp, query.sig, 'get');
    if (!check.ok) {
      return fail(
        reply,
        403,
        check.code,
        check.code === 'link_expired' ? 'Ссылка истекла — запросите новую' : 'Подпись ссылки неверна',
      );
    }

    const file = await prisma.fileObject.findUnique({ where: { key: query.key } });
    if (!file || file.status !== 'uploaded') {
      return fail(reply, 404, 'not_found', 'Файл не найден');
    }

    const content = await getObject(query.key).catch(() => null);
    if (!content) return fail(reply, 404, 'not_found', 'Файл не найден в хранилище');

    return reply.type(file.mime).send(content);
  });

  /** Ссылка на просмотр — тоже на 15 минут, выдаётся по требованию. */
  app.get('/api/v1/files/:id/link', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const file = await prisma.fileObject.findUnique({ where: { id } });
    if (!file) return fail(reply, 404, 'not_found', 'Файл не найден');
    if (file.status !== 'uploaded') {
      return fail(reply, 409, 'not_uploaded', 'Файл ещё не загружен');
    }

    const link = presignDownload(file.key);
    return {
      fileId: file.id,
      url: link.url,
      expiresAt: link.expiresAt,
      mime: file.mime,
      takenAt: file.takenAt?.toISOString() ?? null,
      lat: file.lat,
      lon: file.lon,
    };
  });

  /**
   * Удаление файла. После согласования отчёта фото неприкосновенны (ТЗ §12):
   * иначе подтверждённый объём можно «переподтвердить» другим снимком.
   */
  app.delete('/api/v1/files/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const file = await prisma.fileObject.findUnique({
      where: { id },
      include: { photos: { include: { entry: { include: { report: true } } } } },
    });
    if (!file) return fail(reply, 404, 'not_found', 'Файл не найден');

    const locked = file.photos.find((p) =>
      ['accepted', 'adjusted'].includes(p.entry.report.status),
    );
    if (locked) {
      return fail(
        reply,
        409,
        'report_accepted',
        'Отчёт согласован — фото изменить или удалить нельзя',
      );
    }
    if (file.uploadedById !== req.currentUser.id) {
      return fail(reply, 403, 'forbidden', 'Файл загрузил другой пользователь');
    }

    await prisma.reportPhoto.deleteMany({ where: { fileId: id } });
    await prisma.fileObject.delete({ where: { id } });
    return { ok: true };
  });

  app.get('/api/v1/files/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const file = await prisma.fileObject.findUnique({ where: { id } });
    if (!file) return fail(reply, 404, 'not_found', 'Файл не найден');
    return {
      id: file.id,
      key: file.key,
      mime: file.mime,
      size: file.size ?? (await objectSize(file.key)),
      status: file.status,
      takenAt: file.takenAt?.toISOString() ?? null,
      lat: file.lat,
      lon: file.lon,
      uploadedAt: file.uploadedAt?.toISOString() ?? null,
    };
  });
}
