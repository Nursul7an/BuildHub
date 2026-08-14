/**
 * Дневной отчёт: экраны B1 «Сегодня», B4 «Форма», B5 «Предпросмотр»,
 * B6 «Статус», B7 «Возвращён», C2 «Проверка ПТО», C3 «Корректировка».
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseJson, prisma } from '../db.js';
import { checkReportEntry } from '../rules.js';
import { notify } from '../notify.js';
import { serializeState } from './works.js';

const photoSchema = z.object({
  url: z.string(),
  takenAt: z.string(),
  lat: z.number().optional(),
  lon: z.number().optional(),
});

const entrySchema = z.object({
  processStateId: z.string(),
  volume: z.number(),
  unit: z.string(),
  workers: z.number().int().min(0),
  problems: z.array(z.string()).default([]),
  tempAir: z.number().optional(),
  tempMix: z.number().optional(),
  winterMethod: z.string().optional(),
  comment: z.string().optional(),
  photos: z.array(photoSchema).default([]),
});

function dayStart(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Всё, что нужно экрану «Сегодня», одним запросом. */
  app.get('/api/today', async (req) => {
    const query = z.object({ date: z.string().optional() }).parse(req.query ?? {});
    const date = dayStart(query.date ?? new Date().toISOString());

    const me = await prisma.user.findUniqueOrThrow({
      where: { id: req.currentUser.id },
      include: { object: true, block: true },
    });

    const objectId = me.objectId ?? undefined;

    const [processes, report, returnedReport, incidents, zayavki, notifications] = await Promise.all([
      prisma.processState.findMany({
        where: { assigneeUserId: me.id, status: { in: ['active', 'blocked', 'presented'] } },
        include: { processDef: { include: { section: true } }, block: true },
        orderBy: [{ dueDate: 'asc' }],
      }),
      prisma.dailyReport.findFirst({
        where: { authorId: me.id, date },
        include: { entries: { include: { photos: true } } },
      }),
      prisma.dailyReport.findFirst({
        where: { authorId: me.id, status: 'returned' },
        include: { entries: { include: { photos: true } } },
        orderBy: { date: 'desc' },
      }),
      objectId
        ? prisma.incident.findMany({ where: { objectId, status: 'open' }, orderBy: { at: 'desc' } })
        : Promise.resolve([]),
      prisma.zayavka.findMany({
        where: { authorId: me.id, status: { notIn: ['closed', 'rejected'] } },
        include: { items: { include: { catalogItem: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      prisma.notification.findMany({
        where: { OR: [{ toUserId: me.id }, { toRole: me.role, toUserId: null }], read: false },
        orderBy: { at: 'desc' },
      }),
    ]);

    const filledIds = new Set(report?.entries.map((e) => e.processStateId) ?? []);

    return {
      date: date.toISOString(),
      object: me.object ? { id: me.object.id, name: me.object.name } : null,
      block: me.block ? { id: me.block.id, name: me.block.name } : null,
      scopeLabel: me.scopeLabel,
      processes: processes.map((p) => ({ ...serializeState(p), filledToday: filledIds.has(p.id) })),
      report: report ? serializeReport(report) : null,
      returnedReport: returnedReport ? serializeReport(returnedReport) : null,
      /** «Горит» — просроченные и заблокированные, они идут первыми. */
      burning: [
        ...processes
          .filter((p) => p.dueDate && p.dueDate < date && p.status !== 'accepted')
          .map((p) => ({
            kind: 'overdue' as const,
            processStateId: p.id,
            title: `${p.processDef.name} · ${p.block.name} · ${p.floor} эт.`,
            note: `просрочено ${Math.ceil((date.getTime() - p.dueDate!.getTime()) / 86_400_000)} дня`,
          })),
        ...processes
          .filter((p) => p.status === 'blocked')
          .map((p) => ({
            kind: 'blocked' as const,
            processStateId: p.id,
            title: `${p.processDef.name} · ${p.block.name} · ${p.floor} эт.`,
            note: p.blockedReason ?? 'заблокирован',
          })),
      ],
      incidents: incidents.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        detail: i.detail,
        cost: i.cost,
      })),
      zayavki: zayavki.map((z) => ({
        id: z.id,
        number: z.number,
        status: z.status,
        what: z.items.map((i) => `${i.catalogItem?.name ?? i.rawText} · ${i.qty} ${i.unit}`).join(', '),
        idleCost: z.idleCost,
      })),
      notifications: notifications.map((n) => ({
        id: n.id,
        kind: n.kind,
        title: n.title,
        subtitle: n.subtitle,
        at: n.at.toISOString(),
      })),
    };
  });

  /** Сохранение одной записи — форма сохраняется по работе, а не целиком. */
  app.post('/api/report/entry', async (req, reply) => {
    const body = z.object({ date: z.string(), entry: entrySchema }).parse(req.body);
    const date = dayStart(body.date);

    const failure = checkReportEntry(body.entry);
    if (failure) return reply.code(422).send({ error: failure.code, message: failure.message });

    const state = await prisma.processState.findUnique({
      where: { id: body.entry.processStateId },
      include: { processDef: true },
    });
    if (!state) return reply.code(404).send({ error: 'not_found', message: 'Процесс не найден' });
    if (state.status === 'blocked') {
      return reply.code(409).send({ error: 'blocked', message: state.blockedReason ?? 'Процесс заблокирован' });
    }

    const report = await prisma.dailyReport.upsert({
      where: { date_authorId: { date, authorId: req.currentUser.id } },
      create: {
        date,
        authorId: req.currentUser.id,
        objectId: state.objectId,
        status: 'draft',
      },
      update: {},
    });

    const existing = await prisma.reportEntry.findFirst({
      where: { reportId: report.id, processStateId: body.entry.processStateId },
    });

    const data = {
      reportId: report.id,
      processStateId: body.entry.processStateId,
      volume: body.entry.volume,
      unit: body.entry.unit,
      workers: body.entry.workers,
      problems: JSON.stringify(body.entry.problems),
      tempAir: body.entry.tempAir,
      tempMix: body.entry.tempMix,
      winterMethod: body.entry.winterMethod,
      comment: body.entry.comment,
    };

    const entry = existing
      ? await prisma.reportEntry.update({ where: { id: existing.id }, data })
      : await prisma.reportEntry.create({ data });

    await prisma.reportPhoto.deleteMany({ where: { entryId: entry.id } });
    await prisma.reportPhoto.createMany({
      data: body.entry.photos.map((p) => ({
        entryId: entry.id,
        url: p.url,
        takenAt: new Date(p.takenAt),
        lat: p.lat,
        lon: p.lon,
      })),
    });

    return { reportId: report.id, entryId: entry.id };
  });

  /** Отправка отчёта. Мастер отправляет прорабу, прораб — в ПТО. */
  app.post('/api/report/:id/submit', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ fillSeconds: z.number().int().min(0) }).parse(req.body);

    const report = await prisma.dailyReport.findUnique({
      where: { id },
      include: { entries: { include: { photos: true } } },
    });
    if (!report) return reply.code(404).send({ error: 'not_found', message: 'Отчёт не найден' });
    if (report.authorId !== req.currentUser.id) {
      return reply.code(403).send({ error: 'forbidden', message: 'Это не ваш отчёт' });
    }
    if (report.entries.length === 0) {
      return reply.code(422).send({ error: 'empty', message: 'Заполните хотя бы одну работу' });
    }

    const isMaster = req.currentUser.role === 'master';
    const status = isMaster ? 'atForeman' : 'atPto';

    await prisma.dailyReport.update({
      where: { id },
      data: { status, submittedAt: new Date(), fillSeconds: body.fillSeconds },
    });

    // Факт по процессам растёт сразу — данные видны руководству со статусом «не подтверждён».
    for (const entry of report.entries) {
      await prisma.processState.update({
        where: { id: entry.processStateId },
        data: { doneQty: { increment: entry.volume }, status: 'active' },
      });
    }

    await notify(
      isMaster ? 'prorab' : 'pto',
      'report',
      '📤 Дневной отчёт',
      isMaster ? 'Отчёт мастера ждёт вашего подтверждения' : 'Отчёт с площадки — на проверку',
    );

    return { status, fillSeconds: body.fillSeconds };
  });

  /** Очередь ПТО: что ждёт проверки. */
  app.get('/api/reports/queue', { preHandler: [app.requirePermission('report.check')] }, async () => {
    const reports = await prisma.dailyReport.findMany({
      where: { status: { in: ['atPto', 'submitted'] } },
      include: {
        author: true,
        object: true,
        entries: {
          include: { photos: true, processState: { include: { processDef: true, block: true } } },
        },
      },
      orderBy: { submittedAt: 'asc' },
    });
    return reports.map(serializeReport);
  });

  /** Решение ПТО: подтвердить, скорректировать, вернуть. */
  app.post('/api/report/:id/check', { preHandler: [app.requirePermission('report.check')] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        decision: z.enum(['accept', 'adjust', 'return']),
        comment: z.string().optional(),
        adjustment: z.object({ entryId: z.string(), to: z.number(), reason: z.string() }).optional(),
        returnedFields: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const report = await prisma.dailyReport.findUnique({ where: { id }, include: { entries: true } });
    if (!report) return reply.code(404).send({ error: 'not_found', message: 'Отчёт не найден' });

    if (body.decision === 'adjust') {
      if (!body.adjustment) {
        return reply.code(400).send({ error: 'bad_request', message: 'Нужны новое значение и причина' });
      }
      const entry = report.entries.find((e) => e.id === body.adjustment!.entryId);
      if (!entry) return reply.code(404).send({ error: 'not_found', message: 'Запись не найдена' });

      const delta = body.adjustment.to - entry.volume;
      await prisma.reportEntry.update({
        where: { id: entry.id },
        data: { volume: body.adjustment.to },
      });
      await prisma.processState.update({
        where: { id: entry.processStateId },
        data: { doneQty: { increment: delta } },
      });
      await prisma.reportCheck.create({
        data: {
          reportId: id,
          actorId: req.currentUser.id,
          decision: 'adjust',
          comment: body.adjustment.reason,
          entryId: entry.id,
          adjustFrom: entry.volume,
          adjustTo: body.adjustment.to,
        },
      });
      await prisma.dailyReport.update({ where: { id }, data: { status: 'adjusted' } });
      await notify(
        'prorab',
        'report',
        '✎ ПТО скорректировал отчёт',
        `${entry.volume} → ${body.adjustment.to} ${entry.unit} · «${body.adjustment.reason}»`,
        undefined,
        report.authorId,
      );
      return { status: 'adjusted' };
    }

    if (body.decision === 'return') {
      await prisma.dailyReport.update({
        where: { id },
        data: {
          status: 'returned',
          returnComment: body.comment,
          returnedFields: JSON.stringify(body.returnedFields ?? []),
        },
      });
      await prisma.reportCheck.create({
        data: { reportId: id, actorId: req.currentUser.id, decision: 'return', comment: body.comment },
      });
      await notify(
        'prorab',
        'report',
        '↩ Отчёт возвращён ПТО',
        body.comment ?? 'Проверьте данные',
        undefined,
        report.authorId,
      );
      return { status: 'returned' };
    }

    await prisma.dailyReport.update({ where: { id }, data: { status: 'accepted' } });
    await prisma.reportCheck.create({
      data: { reportId: id, actorId: req.currentUser.id, decision: 'accept', comment: body.comment },
    });
    await notify('prorab', 'report', '✓ Отчёт подтверждён ПТО', 'Данные ушли руководству', undefined, report.authorId);
    return { status: 'accepted' };
  });

  app.get('/api/report/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const report = await prisma.dailyReport.findUnique({
      where: { id },
      include: {
        author: true,
        object: true,
        entries: {
          include: { photos: true, processState: { include: { processDef: true, block: true } } },
        },
        checks: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!report) return reply.code(404).send({ error: 'not_found', message: 'Отчёт не найден' });
    return serializeReport(report);
  });
}

type ReportWithEntries = {
  id: string;
  date: Date;
  status: string;
  submittedAt: Date | null;
  fillSeconds: number | null;
  returnComment: string | null;
  returnedFields: string | null;
  authorId: string;
  objectId: string;
  author?: { fullName: string; role: string };
  object?: { name: string };
  entries: {
    id: string;
    processStateId: string;
    volume: number;
    unit: string;
    workers: number;
    problems: string;
    tempAir: number | null;
    tempMix: number | null;
    winterMethod: string | null;
    comment: string | null;
    photos: { id: string; url: string; takenAt: Date; lat: number | null; lon: number | null }[];
    processState?: { processDef: { name: string }; block: { name: string }; floor: number };
  }[];
  checks?: { id: string; decision: string; comment: string | null; adjustFrom: number | null; adjustTo: number | null; createdAt: Date }[];
};

function serializeReport(report: ReportWithEntries) {
  return {
    id: report.id,
    date: report.date.toISOString(),
    status: report.status,
    submittedAt: report.submittedAt?.toISOString() ?? null,
    fillSeconds: report.fillSeconds,
    returnComment: report.returnComment,
    returnedFields: parseJson<string[]>(report.returnedFields, []),
    authorId: report.authorId,
    authorName: report.author?.fullName,
    authorRole: report.author?.role,
    objectName: report.object?.name,
    entries: report.entries.map((e) => ({
      id: e.id,
      processStateId: e.processStateId,
      title: e.processState
        ? `${e.processState.processDef.name} · ${e.processState.block.name} · ${e.processState.floor} эт.`
        : undefined,
      volume: e.volume,
      unit: e.unit,
      workers: e.workers,
      problems: parseJson<string[]>(e.problems, []),
      tempAir: e.tempAir,
      tempMix: e.tempMix,
      winterMethod: e.winterMethod,
      comment: e.comment,
      photos: e.photos.map((p) => ({
        id: p.id,
        url: p.url,
        takenAt: p.takenAt.toISOString(),
        lat: p.lat,
        lon: p.lon,
      })),
    })),
    checks: report.checks?.map((c) => ({
      id: c.id,
      decision: c.decision,
      comment: c.comment,
      adjustFrom: c.adjustFrom,
      adjustTo: c.adjustTo,
      createdAt: c.createdAt.toISOString(),
    })),
  };
}
