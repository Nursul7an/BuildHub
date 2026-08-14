/**
 * Экономика: ВОР, освоение, закрытие актами, импорт затрат. ТЗ §6, §10.
 *
 * Все ответы несут дату актуальности затрат — без неё финансовый экран
 * показывает число, за которое никто не отвечает (критерий приёмки 9).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail } from '../http.js';
import { actorOf, audit, emit } from '../audit.js';
import { econBreakdown, econSummary } from '../services/econ.js';
import { resolveObjectFilter } from '../scope.js';

export async function econRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Сводка по объекту: EV, AC, CPI, EAC, VAC, закрытие, дата актуальности. */
  app.get(
    '/api/v1/econ/summary',
    { preHandler: [app.requirePermission('finance.view')] },
    async (req, reply) => {
      const query = z.object({ facilityId: z.string().optional() }).parse(req.query ?? {});

      if (query.facilityId) {
        return econSummary(query.facilityId);
      }

      // Без указания объекта — по всем, куда роль имеет доступ.
      const scope = await resolveObjectFilter(req.currentUser.id, req.currentUser.role);
      if (scope.deny) return fail(reply, 403, 'forbidden', 'Объект вне вашей области');

      // Фильтр области приходит по полю objectId дочерних таблиц;
      // здесь запрашивается сама таблица объектов, поэтому это поле id.
      const objects = await prisma.constructionObject.findMany({
        where: scope.where.objectId ? { id: scope.where.objectId } : {},
        orderBy: { name: 'asc' },
      });
      return Promise.all(objects.map((o) => econSummary(o.id)));
    },
  );

  /** Разбор освоения по позициям ВОР — ответ на «почему столько». */
  app.get(
    '/api/v1/econ/breakdown',
    { preHandler: [app.requirePermission('finance.view')] },
    async (req) => {
      const query = z.object({ facilityId: z.string() }).parse(req.query);
      return econBreakdown(query.facilityId);
    },
  );

  /* ─────────────────────────── ВОР ─────────────────────────── */

  app.get('/api/v1/econ/boq', { preHandler: [app.requirePermission('finance.view')] }, async (req) => {
    const query = z.object({ facilityId: z.string() }).parse(req.query);
    const items = await prisma.boqItem.findMany({
      where: { objectId: query.facilityId },
      include: { section: true, processDef: true },
      orderBy: { code: 'asc' },
    });
    return items.map((i) => ({
      id: i.id,
      code: i.code,
      name: i.name,
      section: i.section?.name ?? null,
      processDefId: i.processDefId,
      processName: i.processDef?.name ?? null,
      unit: i.unit,
      qty: Number(i.qty),
      rate: Number(i.rate),
      amount: Number(i.qty) * Number(i.rate),
      source: i.source,
    }));
  });

  /**
   * Загрузка ВОР. Ведёт ПТО: смета — это его хозяйство,
   * а руководство только смотрит на итог.
   */
  app.post('/api/v1/econ/boq', { preHandler: [app.requirePermission('aosr.draft')] }, async (req, reply) => {
    const body = z
      .object({
        facilityId: z.string(),
        source: z.string().optional(),
        items: z
          .array(
            z.object({
              code: z.string().min(1),
              name: z.string().min(1),
              sectionId: z.string().optional(),
              processDefId: z.string().optional(),
              unit: z.string().min(1),
              qty: z.number().positive(),
              rate: z.number().nonnegative(),
            }),
          )
          .min(1),
      })
      .parse(req.body);

    const codes = body.items.map((i) => i.code);
    if (new Set(codes).size !== codes.length) {
      return fail(reply, 422, 'duplicate_code', 'В загрузке есть повторяющиеся шифры позиций');
    }

    let created = 0;
    let updated = 0;

    for (const item of body.items) {
      const existing = await prisma.boqItem.findUnique({
        where: { objectId_code: { objectId: body.facilityId, code: item.code } },
      });

      const data = {
        objectId: body.facilityId,
        code: item.code,
        name: item.name,
        sectionId: item.sectionId,
        processDefId: item.processDefId,
        unit: item.unit,
        qty: item.qty,
        rate: item.rate,
        source: body.source ?? 'ручная загрузка',
      };

      if (existing) {
        await prisma.boqItem.update({ where: { id: existing.id }, data });
        updated += 1;
      } else {
        await prisma.boqItem.create({ data });
        created += 1;
      }
    }

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    await audit(actorOf(req.currentUser, me.fullName), {
      entity: 'boq',
      entityId: body.facilityId,
      action: 'update',
      field: 'items',
      newValue: `загружено ${created + updated} позиций`,
      reason: body.source,
    });

    return { created, updated };
  });

  /* ─────────────────────────── Закрытие актами ─────────────────────────── */

  app.get('/api/v1/econ/acts', { preHandler: [app.requirePermission('finance.view')] }, async (req) => {
    const query = z.object({ facilityId: z.string().optional() }).parse(req.query ?? {});
    const acts = await prisma.contractAct.findMany({
      where: query.facilityId ? { objectId: query.facilityId } : {},
      include: { object: true },
      orderBy: { periodStart: 'desc' },
    });

    return acts.map((a) => ({
      id: a.id,
      objectId: a.objectId,
      objectName: a.object.name,
      number: a.number,
      periodStart: a.periodStart.toISOString(),
      periodEnd: a.periodEnd.toISOString(),
      completed: Number(a.amountCompleted),
      submitted: a.amountSubmitted === null ? null : Number(a.amountSubmitted),
      signed: a.amountSigned === null ? null : Number(a.amountSigned),
      paid: a.amountPaid === null ? null : Number(a.amountPaid),
      extraWorkUnformalized: Number(a.extraWorkUnformalized),
      status: a.status,
      /** Предъявлено меньше выполненного — остаток повисает на объекте. */
      unsubmitted: Number(a.amountCompleted) - Number(a.amountSubmitted ?? 0),
    }));
  });

  app.post('/api/v1/econ/acts', { preHandler: [app.requirePermission('finance.view')] }, async (req, reply) => {
    const body = z
      .object({
        facilityId: z.string(),
        number: z.string().min(1),
        periodStart: z.string(),
        periodEnd: z.string(),
        amountCompleted: z.number().nonnegative(),
        extraWorkUnformalized: z.number().nonnegative().default(0),
      })
      .parse(req.body);

    const duplicate = await prisma.contractAct.findUnique({
      where: { objectId_number: { objectId: body.facilityId, number: body.number } },
    });
    if (duplicate) return fail(reply, 409, 'act_exists', `Акт ${body.number} уже заведён`);

    const act = await prisma.contractAct.create({
      data: {
        objectId: body.facilityId,
        number: body.number,
        periodStart: new Date(body.periodStart),
        periodEnd: new Date(body.periodEnd),
        amountCompleted: body.amountCompleted,
        extraWorkUnformalized: body.extraWorkUnformalized,
      },
    });

    return { id: act.id, number: act.number, status: act.status };
  });

  /**
   * Движение акта: предъявлен → подписан → оплачен.
   * Суммы на каждом шаге свои: подписать могут меньше, чем предъявили.
   */
  app.post('/api/v1/econ/acts/:id/transition', { preHandler: [app.requirePermission('finance.view')] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        to: z.enum(['submitted', 'signed', 'paid', 'rejected']),
        amount: z.number().nonnegative().optional(),
        note: z.string().optional(),
      })
      .parse(req.body);

    const act = await prisma.contractAct.findUnique({ where: { id } });
    if (!act) return fail(reply, 404, 'not_found', 'Акт не найден');

    const ORDER: Record<string, string[]> = {
      draft: ['submitted', 'rejected'],
      submitted: ['signed', 'rejected'],
      signed: ['paid'],
      paid: [],
      rejected: ['submitted'],
    };
    if (!ORDER[act.status]!.includes(body.to)) {
      return fail(reply, 409, 'unknown_transition', `Переход «${act.status}» → «${body.to}» не предусмотрен`, {
        allowed: ORDER[act.status],
      });
    }

    if (body.to !== 'rejected' && body.amount === undefined) {
      return fail(reply, 422, 'amount_required', 'Укажите сумму: она отличается на каждом шаге');
    }

    // Подписать больше, чем предъявили, нельзя — иначе отчётность разъедется.
    if (body.to === 'signed' && body.amount! > Number(act.amountSubmitted ?? 0)) {
      return fail(reply, 422, 'above_submitted', 'Подписано не может превышать предъявленное');
    }
    if (body.to === 'paid' && body.amount! > Number(act.amountSigned ?? 0)) {
      return fail(reply, 422, 'above_signed', 'Оплачено не может превышать подписанное');
    }

    const now = new Date();
    const patch =
      body.to === 'submitted'
        ? { amountSubmitted: body.amount, submittedAt: now }
        : body.to === 'signed'
          ? { amountSigned: body.amount, signedAt: now }
          : body.to === 'paid'
            ? { amountPaid: body.amount, paidAt: now }
            : {};

    await prisma.contractAct.update({
      where: { id },
      data: { status: body.to, ...patch },
    });

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    await audit(actorOf(req.currentUser, me.fullName), {
      entity: 'contractAct',
      entityId: id,
      action: 'status',
      field: 'status',
      oldValue: act.status,
      newValue: body.to,
      reason: body.note,
    });

    return { ok: true, status: body.to };
  });

  /* ─────────────────────────── Импорт из 1С ─────────────────────────── */

  /**
   * Приём выгрузки затрат. ТЗ §10: раз в сутки, с датой актуальности.
   * Повторная выгрузка того же периода перезаписывает суммы, а не удваивает их.
   */
  app.post('/api/v1/integrations/1c/costs', { preHandler: [app.requirePermission('finance.view')] }, async (req, reply) => {
    const body = z
      .object({
        actualAsOf: z.string(),
        rows: z
          .array(
            z.object({
              facilityCode: z.string().optional(),
              facilityId: z.string().optional(),
              article: z.string().min(1),
              amount: z.number(),
              periodStart: z.string(),
              periodEnd: z.string(),
            }),
          )
          .min(1),
      })
      .parse(req.body);

    const run = await prisma.costImport.create({
      data: { actualAsOf: new Date(body.actualAsOf), rowsTotal: body.rows.length },
    });

    let imported = 0;
    const problems: string[] = [];

    for (const row of body.rows) {
      const object = row.facilityId
        ? await prisma.constructionObject.findUnique({ where: { id: row.facilityId } })
        : row.facilityCode
          ? await prisma.constructionObject.findUnique({ where: { code: row.facilityCode } })
          : null;

      if (!object) {
        problems.push(`Объект не найден: ${row.facilityCode ?? row.facilityId ?? '—'}`);
        continue;
      }

      const key = {
        objectId: object.id,
        article: row.article,
        periodStart: new Date(row.periodStart),
        periodEnd: new Date(row.periodEnd),
        source: '1C',
      };

      await prisma.costFact.upsert({
        where: {
          objectId_article_periodStart_periodEnd_source: key,
        },
        create: { ...key, amount: row.amount, actualAsOf: new Date(body.actualAsOf), importId: run.id },
        update: { amount: row.amount, actualAsOf: new Date(body.actualAsOf), importId: run.id },
      });
      imported += 1;
    }

    await prisma.costImport.update({
      where: { id: run.id },
      data: {
        status: problems.length === body.rows.length ? 'failed' : 'done',
        finishedAt: new Date(),
        rowsImported: imported,
        error: problems.length > 0 ? problems.slice(0, 20).join('; ') : null,
      },
    });

    await emit('CostsImported', 'costImport', run.id, {
      rows: imported,
      actualAsOf: body.actualAsOf,
      problems: problems.length,
    });

    if (problems.length === body.rows.length) {
      return fail(reply, 422, 'import_failed', 'Ни одна строка не сопоставлена с объектом', problems.slice(0, 20));
    }

    return { importId: run.id, imported, skipped: problems.length, problems: problems.slice(0, 20) };
  });

  /** Когда 1С выгружалась в последний раз — на это смотрят раньше, чем на цифры. */
  app.get('/api/v1/integrations/1c/status', { preHandler: [app.requirePermission('finance.view')] }, async () => {
    const last = await prisma.costImport.findFirst({ orderBy: { startedAt: 'desc' } });
    if (!last) {
      return { lastImport: null, actualAsOf: null, stale: true, message: 'Затраты ни разу не загружались' };
    }
    const hours = (Date.now() - last.actualAsOf.getTime()) / 3_600_000;
    return {
      lastImport: last.startedAt.toISOString(),
      finishedAt: last.finishedAt?.toISOString() ?? null,
      actualAsOf: last.actualAsOf.toISOString(),
      status: last.status,
      rowsImported: last.rowsImported,
      error: last.error,
      /** Данные старше полутора суток — предупреждаем прямо в ответе. */
      stale: hours > 36,
    };
  });
}
