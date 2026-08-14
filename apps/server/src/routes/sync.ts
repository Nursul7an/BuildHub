/**
 * Офлайн-очередь. ТЗ §8, критерий приёмки 8.
 *
 * Связь на этаже пропадает даже при нормальном покрытии, поэтому клиент копит
 * операции локально и отправляет пачкой. Три правила, вокруг которых всё:
 *
 *  1. Повтор с тем же client_op_id возвращает прежний результат и ничего не делает
 *     заново — иначе один потерянный ответ превращается в два объёма в отчёте.
 *  2. Операции применяются в порядке очереди: отправка отчёта после записей,
 *     а не наоборот.
 *  3. Конфликт по одной сущности не перезаписывается молча. Побеждает последняя
 *     запись по серверному времени, расхождение помечается и уходит в разбор ПТО.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail } from '../http.js';
import { applyReportEntry } from '../services/report-entry.js';
import { actorOf, audit, emit } from '../audit.js';
import { notify } from '../notify.js';

const photoRef = z.object({ fileId: z.string() });

const operationSchema = z.object({
  clientOpId: z.string().min(1),
  /** Логическое время устройства: по нему видно, что операция старше серверной записи. */
  deviceTime: z.string(),
  type: z.enum(['report.entry', 'report.submit', 'process.comment']),
  payload: z.record(z.unknown()),
});

const batchSchema = z.object({
  operations: z.array(operationSchema).min(1).max(100),
});

interface OpOutcome {
  status: 'applied' | 'conflict' | 'failed' | 'skipped';
  result?: Record<string, unknown>;
  conflictNote?: string;
  error?: { code: string; message: string };
}

export async function syncRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.post('/api/v1/sync/batch', async (req, reply) => {
    const parsed = batchSchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(reply, 400, 'bad_request', 'Некорректная пачка операций', parsed.error.issues);
    }

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const results: Record<string, unknown>[] = [];

    // Строго по очереди: порядок операций несёт смысл.
    for (const op of parsed.data.operations) {
      const already = await prisma.syncOperation.findUnique({
        where: { clientOpId_userId: { clientOpId: op.clientOpId, userId: me.id } },
      });

      if (already) {
        // Повтор — отдаём прежний результат, ничего не выполняя.
        results.push({
          clientOpId: op.clientOpId,
          status: already.status,
          duplicate: true,
          result: already.result ?? null,
          conflictNote: already.conflictNote ?? null,
        });
        continue;
      }

      const outcome = await applyOperation(op, me, req.currentUser);

      let conflictTaskId: string | null = null;
      if (outcome.status === 'conflict') {
        // Разбор конфликта — задача ПТО, а не тихая перезапись.
        const task = await prisma.task.create({
          data: {
            text: `Разобрать расхождение синхронизации: ${outcome.conflictNote ?? op.type}`,
            objectId: me.objectId ?? (await firstObjectId()),
            assigneeId: await ptoUserId(),
            authorId: me.id,
            dueDate: new Date(Date.now() + 86_400_000),
            origin: 'inbox',
            sourceRef: op.clientOpId,
          },
        });
        conflictTaskId = task.id;
        await notify(
          'pto',
          'report',
          '⚠️ Расхождение при синхронизации',
          outcome.conflictNote ?? 'Операция с устройства разошлась с данными на сервере',
        );
      }

      const saved = await prisma.syncOperation.create({
        data: {
          clientOpId: op.clientOpId,
          userId: me.id,
          deviceTime: new Date(op.deviceTime),
          type: op.type,
          payload: op.payload as never,
          status: outcome.status,
          result: (outcome.result ?? outcome.error ?? null) as never,
          conflictNote: outcome.conflictNote,
          conflictTaskId,
        },
      });

      results.push({
        clientOpId: op.clientOpId,
        status: saved.status,
        duplicate: false,
        result: outcome.result ?? null,
        error: outcome.error ?? null,
        conflictNote: outcome.conflictNote ?? null,
        conflictTaskId,
      });
    }

    return {
      applied: results.filter((r) => r.status === 'applied').length,
      conflicts: results.filter((r) => r.status === 'conflict').length,
      failed: results.filter((r) => r.status === 'failed').length,
      /** Серверное время — клиент по нему подводит часы устройства. */
      serverTime: new Date().toISOString(),
      operations: results,
    };
  });

  /** Что осталось в разборе — экран ПТО «расхождения». */
  app.get('/api/v1/sync/conflicts', { preHandler: [app.requirePermission('report.check')] }, async () => {
    const rows = await prisma.syncOperation.findMany({
      where: { status: 'conflict' },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.id,
      clientOpId: r.clientOpId,
      author: r.user.fullName,
      type: r.type,
      deviceTime: r.deviceTime.toISOString(),
      createdAt: r.createdAt.toISOString(),
      note: r.conflictNote,
      taskId: r.conflictTaskId,
      payload: r.payload,
    }));
  });
}

async function firstObjectId(): Promise<string> {
  const object = await prisma.constructionObject.findFirstOrThrow({ orderBy: { name: 'asc' } });
  return object.id;
}

async function ptoUserId(): Promise<string | null> {
  const pto = await prisma.user.findFirst({ where: { role: 'pto', active: true } });
  return pto?.id ?? null;
}

async function applyOperation(
  op: z.infer<typeof operationSchema>,
  me: { id: string; objectId: string | null; fullName: string },
  currentUser: { id: string; role: string },
): Promise<OpOutcome> {
  const deviceTime = new Date(op.deviceTime);

  if (op.type === 'report.entry') {
    const payload = z
      .object({
        date: z.string(),
        entry: z.object({
          processStateId: z.string(),
          volume: z.number(),
          unit: z.string(),
          workers: z.number().int().min(0),
          problems: z.array(z.string()).optional(),
          tempAir: z.number().optional(),
          tempMix: z.number().optional(),
          winterMethod: z.string().optional(),
          comment: z.string().optional(),
          photos: z.array(photoRef).default([]),
        }),
      })
      .safeParse(op.payload);
    if (!payload.success) {
      return { status: 'failed', error: { code: 'bad_payload', message: 'Некорректные данные операции' } };
    }

    // Конфликт: пока устройство было офлайн, эту же запись успели изменить на сервере.
    const day = new Date(payload.data.date);
    day.setHours(0, 0, 0, 0);
    const report = await prisma.dailyReport.findFirst({
      where: { authorId: me.id, date: day },
      include: { entries: true },
    });
    const existing = report?.entries.find((e) => e.processStateId === payload.data.entry.processStateId);

    if (existing && report) {
      const serverTouched = report.submittedAt ?? report.date;
      const differs = Number(existing.volume) !== payload.data.entry.volume;
      if (differs && serverTouched > deviceTime) {
        // Побеждает серверная запись; расхождение помечаем и отдаём в разбор.
        return {
          status: 'conflict',
          conflictNote:
            `Объём с устройства (${payload.data.entry.volume}) разошёлся с записью на сервере ` +
            `(${Number(existing.volume)}); серверная запись новее`,
          result: { entryId: existing.id, kept: 'server' },
        };
      }
      if (report.status === 'accepted') {
        return {
          status: 'conflict',
          conflictNote: 'Отчёт уже согласован ПТО, изменение с устройства не применено',
          result: { reportId: report.id, kept: 'server' },
        };
      }
    }

    const applied = await applyReportEntry(me.id, payload.data.date, payload.data.entry);
    if (!applied.ok) {
      return { status: 'failed', error: applied.failure };
    }
    return { status: 'applied', result: { reportId: applied.reportId, entryId: applied.entryId } };
  }

  if (op.type === 'report.submit') {
    const payload = z
      .object({ reportId: z.string(), fillSeconds: z.number().int().min(0) })
      .safeParse(op.payload);
    if (!payload.success) {
      return { status: 'failed', error: { code: 'bad_payload', message: 'Некорректные данные операции' } };
    }

    const report = await prisma.dailyReport.findUnique({
      where: { id: payload.data.reportId },
      include: { entries: true },
    });
    if (!report) {
      return { status: 'failed', error: { code: 'not_found', message: 'Отчёт не найден' } };
    }
    if (report.authorId !== me.id) {
      return { status: 'failed', error: { code: 'forbidden', message: 'Это не ваш отчёт' } };
    }
    if (report.status === 'atPto' || report.status === 'atForeman' || report.status === 'accepted') {
      return {
        status: 'skipped',
        result: { reportId: report.id, status: report.status },
        conflictNote: undefined,
      };
    }
    if (report.entries.length === 0) {
      return { status: 'failed', error: { code: 'empty', message: 'Заполните хотя бы одну работу' } };
    }

    const status = currentUser.role === 'master' ? 'atForeman' : 'atPto';

    await prisma.$transaction([
      prisma.dailyReport.update({
        where: { id: report.id },
        data: { status, submittedAt: new Date(), fillSeconds: payload.data.fillSeconds },
      }),
      ...report.entries.flatMap((entry) => {
        const delta = Number(entry.volume) - Number(entry.appliedVolume);
        if (delta === 0) return [];
        return [
          prisma.processState.update({
            where: { id: entry.processStateId },
            data: { doneQty: { increment: delta }, status: 'active' },
          }),
          prisma.reportEntry.update({
            where: { id: entry.id },
            data: { appliedVolume: entry.volume },
          }),
        ];
      }),
    ]);

    await audit(actorOf(currentUser, me.fullName), {
      entity: 'dailyReport',
      entityId: report.id,
      action: 'status',
      field: 'status',
      oldValue: report.status,
      newValue: status,
      reason: 'офлайн-синхронизация',
    });
    await emit('ReportSubmitted', 'dailyReport', report.id, { authorId: me.id, status, offline: true });
    await notify(
      currentUser.role === 'master' ? 'prorab' : 'pto',
      'report',
      '📤 Дневной отчёт (офлайн)',
      'Отчёт получен после восстановления связи',
    );

    return { status: 'applied', result: { reportId: report.id, status } };
  }

  // process.comment
  const payload = z
    .object({
      processStateId: z.string(),
      kind: z.enum(['problem', 'delay', 'material', 'quality', 'safety', 'other']),
      text: z.string().default(''),
    })
    .safeParse(op.payload);
  if (!payload.success) {
    return { status: 'failed', error: { code: 'bad_payload', message: 'Некорректные данные операции' } };
  }

  const comment = await prisma.processComment.create({
    data: {
      processStateId: payload.data.processStateId,
      kind: payload.data.kind,
      text: payload.data.text,
      authorId: me.id,
      createdAt: deviceTime,
    },
  });
  return { status: 'applied', result: { commentId: comment.id } };
}
