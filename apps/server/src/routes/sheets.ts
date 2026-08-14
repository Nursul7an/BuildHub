/**
 * Проект: комплекты, листы, версии. ТЗ §6, критерий приёмки 7.
 *
 * Главная функция раздела — не хранение, а контроль актуальности. Работа по
 * устаревшему листу должна быть невозможна незаметно, поэтому:
 *
 *  — выпуск новой версии сразу делает прежнюю недействительной;
 *  — извещение уходит именно тем, кто этот лист открывал;
 *  — открытие старой версии отвечает явным предупреждением, а не тихо отдаёт файл.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail, withETag } from '../http.js';
import { actorOf, audit, eventData } from '../audit.js';
import { presignDownload } from '../storage.js';

export async function sheetRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Комплекты по стадиям и маркам. Стадии разделяются обязательно. */
  app.get('/api/v1/doc-sets', async (req, reply) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const objectId = query.objectId ?? me.objectId ?? undefined;

    const sets = await prisma.drawingSet.findMany({
      where: objectId ? { objectId } : {},
      include: {
        sheets: {
          include: { currentVersion: true, versions: { orderBy: { issuedAt: 'desc' } } },
          orderBy: { number: 'asc' },
        },
      },
      orderBy: [{ stage: 'asc' }, { mark: 'asc' }],
    });

    const payload = sets.map((set) => ({
      id: set.id,
      stage: set.stage,
      mark: set.mark,
      name: set.name,
      revision: set.revision,
      issuedAt: set.issuedAt.toISOString(),
      sheetCount: set.sheets.length,
      /** Сколько листов пережили замену — на это смотрят первым делом. */
      revisedCount: set.sheets.filter((s) => s.versions.length > 1).length,
      sheets: set.sheets.map((s) => ({
        id: s.id,
        number: s.number,
        name: s.name,
        revision: s.currentVersion?.revision ?? null,
        issuedAt: s.currentVersion?.issuedAt.toISOString() ?? null,
        versionCount: s.versions.length,
      })),
    }));

    return withETag(reply, req, payload);
  });

  /**
   * Реестр действующих листов — цифровая замена бумажного.
   * Отдаются только текущие версии: именно по этому списку идут в работу.
   */
  app.get('/api/v1/sheets/active', async (req, reply) => {
    const query = z.object({ objectId: z.string().optional(), mark: z.string().optional() }).parse(
      req.query ?? {},
    );
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const objectId = query.objectId ?? me.objectId ?? undefined;

    const sheets = await prisma.drawingSheet.findMany({
      where: {
        ...(objectId ? { set: { objectId } } : {}),
        ...(query.mark ? { set: { mark: query.mark } } : {}),
        currentVersionId: { not: null },
      },
      include: { set: true, currentVersion: true },
      orderBy: [{ set: { mark: 'asc' } }, { number: 'asc' }],
    });

    const payload = sheets.map((s) => ({
      id: s.id,
      number: s.number,
      name: s.name,
      mark: s.set.mark,
      stage: s.set.stage,
      revision: s.currentVersion!.revision,
      issuedAt: s.currentVersion!.issuedAt.toISOString(),
      versionId: s.currentVersion!.id,
    }));

    return withETag(reply, req, payload);
  });

  /**
   * Лист. Открытие фиксируется: без этого при выпуске новой версии
   * извещать будет некого.
   */
  app.get('/api/v1/sheets/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const query = z.object({ versionId: z.string().optional() }).parse(req.query ?? {});

    const sheet = await prisma.drawingSheet.findUnique({
      where: { id },
      include: {
        set: true,
        currentVersion: true,
        versions: { orderBy: { issuedAt: 'desc' } },
        rfis: true,
      },
    });
    if (!sheet) return fail(reply, 404, 'not_found', 'Лист не найден');

    const requested = query.versionId
      ? sheet.versions.find((v) => v.id === query.versionId)
      : sheet.currentVersion;
    if (!requested) return fail(reply, 404, 'not_found', 'Версия листа не найдена');

    const outdated = requested.supersededAt !== null;

    await prisma.sheetView.upsert({
      where: { sheetId_userId: { sheetId: sheet.id, userId: req.currentUser.id } },
      create: {
        sheetId: sheet.id,
        userId: req.currentUser.id,
        versionId: requested.id,
        revision: requested.revision,
      },
      update: { versionId: requested.id, revision: requested.revision, viewedAt: new Date() },
    });

    return {
      id: sheet.id,
      number: sheet.number,
      name: sheet.name,
      mark: sheet.set.mark,
      stage: sheet.set.stage,
      version: {
        id: requested.id,
        revision: requested.revision,
        issuedAt: requested.issuedAt.toISOString(),
        changeSummary: requested.changeSummary,
        fileId: requested.fileId,
      },
      /** Открыт устаревший лист — это состояние, а не примечание мелким шрифтом. */
      outdated,
      supersededAt: requested.supersededAt?.toISOString() ?? null,
      currentVersion: sheet.currentVersion
        ? {
            id: sheet.currentVersion.id,
            revision: sheet.currentVersion.revision,
            issuedAt: sheet.currentVersion.issuedAt.toISOString(),
            changeSummary: sheet.currentVersion.changeSummary,
          }
        : null,
      warning: outdated
        ? `Версия ${requested.revision} недействительна. Действует ${sheet.currentVersion?.revision ?? '—'}`
        : null,
      /**
       * Метка для офлайна (ТЗ §8): клиент показывает «версия на дату,
       * проверьте актуальность», когда открывает лист из кеша.
       */
      asOf: new Date().toISOString(),
      history: sheet.versions.map((v) => ({
        id: v.id,
        revision: v.revision,
        issuedAt: v.issuedAt.toISOString(),
        changeSummary: v.changeSummary,
        superseded: v.supersededAt !== null,
      })),
      rfis: sheet.rfis.map((r) => ({ id: r.id, number: r.number, status: r.status })),
    };
  });

  /** Ссылка на файл версии — как и все файлы, на 15 минут. */
  app.get('/api/v1/sheets/:id/file', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const query = z.object({ versionId: z.string().optional() }).parse(req.query ?? {});

    const sheet = await prisma.drawingSheet.findUnique({
      where: { id },
      include: { currentVersion: true, versions: true },
    });
    if (!sheet) return fail(reply, 404, 'not_found', 'Лист не найден');

    const version = query.versionId
      ? sheet.versions.find((v) => v.id === query.versionId)
      : sheet.currentVersion;
    if (!version?.fileId) return fail(reply, 404, 'not_found', 'Файл версии не загружен');

    const file = await prisma.fileObject.findUnique({ where: { id: version.fileId } });
    if (!file || file.status !== 'uploaded') {
      return fail(reply, 409, 'not_uploaded', 'Файл ещё не загружен');
    }

    const link = presignDownload(file.key);
    return {
      url: link.url,
      expiresAt: link.expiresAt,
      revision: version.revision,
      outdated: version.supersededAt !== null,
    };
  });

  /**
   * Выпуск новой версии. Критерий приёмки 7: прежняя становится
   * недействительной, и извещение уходит всем, кто её открывал.
   */
  app.post(
    '/api/v1/sheets/:id/versions',
    { preHandler: [app.requirePermission('aosr.draft')] },
    async (req, reply) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const body = z
        .object({
          revision: z.string().min(1),
          issuedAt: z.string().optional(),
          changeSummary: z.string().min(1, 'Опишите, что изменилось'),
          fileId: z.string().optional(),
        })
        .parse(req.body);

      const sheet = await prisma.drawingSheet.findUnique({
        where: { id },
        include: { currentVersion: true, set: true },
      });
      if (!sheet) return fail(reply, 404, 'not_found', 'Лист не найден');

      const duplicate = await prisma.sheetVersion.findFirst({
        where: { sheetId: id, revision: body.revision },
      });
      if (duplicate) {
        return fail(reply, 409, 'revision_exists', `Версия ${body.revision} уже загружена`);
      }

      if (body.fileId) {
        const file = await prisma.fileObject.findUnique({ where: { id: body.fileId } });
        if (!file || file.status !== 'uploaded') {
          return fail(reply, 409, 'photo_not_uploaded', 'Файл листа ещё не загружен');
        }
      }

      const previous = sheet.currentVersion;
      const now = new Date();

      // Замена и извещение — одной транзакцией: лист не может стать
      // недействительным без события, и наоборот.
      const created = await prisma.$transaction(async (tx) => {
        const version = await tx.sheetVersion.create({
          data: {
            sheetId: id,
            revision: body.revision,
            issuedAt: body.issuedAt ? new Date(body.issuedAt) : now,
            changeSummary: body.changeSummary,
            fileId: body.fileId,
            uploadedById: req.currentUser.id,
          },
        });

        if (previous) {
          await tx.sheetVersion.update({
            where: { id: previous.id },
            data: { supersededAt: now, supersededByaId: version.id },
          });
        }

        await tx.drawingSheet.update({
          where: { id },
          data: { currentVersionId: version.id },
        });

        await tx.domainEvent.create({
          data: eventData('SheetSuperseded', 'drawingSheet', id, {
            sheetId: id,
            number: sheet.number,
            name: sheet.name,
            previousRevision: previous?.revision ?? null,
            newRevision: body.revision,
            changeSummary: body.changeSummary,
          }),
        });

        return version;
      });

      const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
      await audit(actorOf(req.currentUser, me.fullName), {
        entity: 'drawingSheet',
        entityId: id,
        action: 'update',
        field: 'revision',
        oldValue: previous?.revision ?? null,
        newValue: body.revision,
        reason: body.changeSummary,
      });

      const viewers = await prisma.sheetView.count({ where: { sheetId: id } });

      return reply.code(201).send({
        versionId: created.id,
        revision: created.revision,
        supersededRevision: previous?.revision ?? null,
        /** Сколько человек получат извещение — заказчик спрашивает именно это. */
        notifiedViewers: viewers,
      });
    },
  );

  app.get('/api/v1/sheets/:id/versions', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const versions = await prisma.sheetVersion.findMany({
      where: { sheetId: id },
      orderBy: { issuedAt: 'desc' },
    });
    if (versions.length === 0) return fail(reply, 404, 'not_found', 'Лист не найден');

    return versions.map((v) => ({
      id: v.id,
      revision: v.revision,
      issuedAt: v.issuedAt.toISOString(),
      changeSummary: v.changeSummary,
      superseded: v.supersededAt !== null,
      supersededAt: v.supersededAt?.toISOString() ?? null,
    }));
  });

  /** Кто открывал лист — ПТО видит, до кого дошла замена. */
  app.get(
    '/api/v1/sheets/:id/viewers',
    { preHandler: [app.requirePermission('aosr.draft')] },
    async (req) => {
      const { id } = z.object({ id: z.string() }).parse(req.params);
      const views = await prisma.sheetView.findMany({
        where: { sheetId: id },
        include: { user: true },
        orderBy: { viewedAt: 'desc' },
      });
      return views.map((v) => ({
        userId: v.userId,
        fullName: v.user.fullName,
        role: v.user.role,
        revision: v.revision,
        viewedAt: v.viewedAt.toISOString(),
      }));
    },
  );
}
