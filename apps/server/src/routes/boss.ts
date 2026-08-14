/**
 * Руководство: сводка, «Требует решения», объекты, финансы, задачи,
 * KPI, лимиты автономности, качество (BOSS1–7, F1–F4, GI).
 *
 * Директор и главный инженер — не «почти одинаковые» роли: у них одна структура
 * и разное наполнение, поэтому фильтрация идёт по роли, а не по флажку в клиенте.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notify } from '../notify.js';
import { emit } from '../audit.js';
import { needsEscalation } from '../rules.js';
import { econSummary } from '../services/econ.js';
import { computeKpi } from '../services/kpi.js';

export async function bossRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /**
   * Сводка: объекты с отклонением, проблемы с ценой, задачи.
   * Отдаёт бюджеты и CPI по всем объектам — поэтому закрыта правом на финансы,
   * иначе любой авторизованный видит маржу компании обычным GET-запросом.
   */
  app.get('/api/boss/digest', { preHandler: [app.requirePermission('finance.view')] }, async (req) => {
    const [objects, incidents, tasks, finance] = await Promise.all([
      prisma.constructionObject.findMany({
        include: { finance: true, responsible: true, processes: true },
        orderBy: { name: 'asc' },
      }),
      prisma.incident.findMany({ where: { status: 'open' }, include: { object: true }, orderBy: { cost: 'desc' } }),
      prisma.task.findMany({
        where: { status: { in: ['open', 'overdue'] } },
        include: { assignee: true, object: true },
        orderBy: { dueDate: 'asc' },
      }),
      prisma.objectFinance.findMany({ include: { object: true } }),
    ]);

    const econ = await Promise.all(objects.map((o) => econSummary(o.id)));
    const econById = new Map(econ.map((e) => [e.objectId, e]));

    const now = Date.now();

    return {
      objects: objects.map((o) => {
        const f = o.finance;
        return {
          id: o.id,
          name: o.name,
          status: o.status,
          responsible: o.responsible?.fullName ?? null,
          // Готовность — из графика ПТО; отклонение в днях важнее самих процентов.
          pctPlan: o.pctPlan,
          pctFact: o.pctFact,
          deltaDays: o.deltaDays,
          /** CPI = освоено / потрачено. Ниже 1 — тратим быстрее, чем зарабатываем. */
          cpi: econById.get(o.id)?.cpi ?? null,
          budget: econById.get(o.id)?.bac ?? f?.budget ?? null,
          eac: econById.get(o.id)?.eac ?? null,
          costsAsOf: econById.get(o.id)?.costsAsOf ?? null,
        };
      }),
      /** Лента «Требует решения»: каждая проблема с ценой. */
      incidents: incidents.map((i) => ({
        id: i.id,
        objectId: i.objectId,
        objectName: i.object.name,
        kind: i.kind,
        title: i.title,
        detail: i.detail,
        cost: i.cost,
        workersIdle: i.workersIdle,
        at: i.at.toISOString(),
        status: i.status,
      })),
      tasks: tasks.map((t) => ({
        id: t.id,
        text: t.text,
        objectName: t.object.name,
        assignee: t.assignee?.fullName ?? null,
        dueDate: t.dueDate.toISOString(),
        overdue: t.dueDate.getTime() < now,
        origin: t.origin,
      })),
      finance: econ.filter((e) => e.bac > 0 || e.ac > 0),
    };
  });

  /**
   * Финансы: закрытие актами, а не только освоение.
   *
   * Считает тот же модуль econ, что и карточку объекта. Два источника
   * финансовой правды — прямой путь к тому, что на планёрке сверяют
   * экраны вместо работы.
   */
  app.get('/api/boss/finance', { preHandler: [app.requirePermission('finance.view')] }, async () => {
    const [objects, payments, limits] = await Promise.all([
      prisma.constructionObject.findMany({ orderBy: { name: 'asc' } }),
      prisma.payment.findMany({ include: { object: true }, orderBy: { dueDate: 'asc' } }),
      prisma.autonomyLimit.findMany(),
    ]);

    const summaries = await Promise.all(objects.map((o) => econSummary(o.id)));
    const withEconomy = summaries.filter((s) => s.bac > 0 || s.ac > 0);

    // Статьи затрат складываются по всем объектам компании.
    const byArticle = new Map<string, number>();
    for (const summary of withEconomy) {
      for (const article of summary.articles) {
        byArticle.set(article.article, (byArticle.get(article.article) ?? 0) + article.amount);
      }
    }
    const total = [...byArticle.values()].reduce((a, b) => a + b, 0);

    return {
      objects: withEconomy.map((s) => ({
        objectId: s.objectId,
        objectName: s.objectName,
        budget: s.bac,
        ev: s.ev,
        ac: s.ac,
        cpi: s.cpi,
        eac: s.eac,
        vac: s.vac,
        closedByActs: s.closure.signed,
        notClosed: s.closure.gapEarnedToSigned,
        receivable: s.closure.receivable,
        /** Дата актуальности идёт вместе с цифрой, а не отдельной подписью. */
        costsAsOf: s.costsAsOf,
        costsStale: s.costsStale,
      })),
      articles: [...byArticle.entries()]
        .map(([name, amount]) => ({
          name,
          amount,
          pct: total > 0 ? Number(((amount / total) * 100).toFixed(1)) : 0,
          note: null as string | null,
        }))
        .sort((a, b) => b.amount - a.amount),
      /** Общая дата актуальности: самая старая из объектов — по ней и судят. */
      costsAsOf: withEconomy.reduce<string | null>(
        (oldest, s) => (s.costsAsOf && (oldest === null || s.costsAsOf < oldest) ? s.costsAsOf : oldest),
        null,
      ),
      /** Деньги на неделю — платежи с их статусом. */
      payments: payments.map((p) => ({
        id: p.id,
        objectName: p.object.name,
        name: p.name,
        amount: p.amount,
        dueDate: p.dueDate.toISOString(),
        status: p.status,
        aboveLimit: p.aboveLimit,
      })),
      limits: limits.map((l) => ({ role: l.role, scope: l.scope, limit: l.limit })),
    };
  });

  app.post('/api/boss/payments/:id/approve', { preHandler: [app.requirePermission('finance.approvePayment')] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const payment = await prisma.payment.findUnique({ where: { id } });
    if (!payment) return reply.code(404).send({ code: 'not_found', message: 'Платёж не найден' });

    const escalate = await needsEscalation(req.currentUser.role, 'payment', payment.amount);
    if (escalate && req.currentUser.role !== 'dir') {
      await emit('LimitExceeded', 'payment', payment.id, {
        what: payment.name,
        amount: Number(payment.amount),
      });
      return reply.code(409).send({ code: 'above_limit',
        message: 'Сумма выше вашего лимита автономности — ушла директору',
      });
    }

    await prisma.payment.update({
      where: { id },
      data: { status: 'approved', approvedById: req.currentUser.id },
    });
    return { ok: true };
  });

  /** Лимиты автономности настраивает директор. */
  app.get('/api/boss/limits', async () => {
    const limits = await prisma.autonomyLimit.findMany();
    return limits.map((l) => ({ id: l.id, role: l.role, scope: l.scope, limit: l.limit }));
  });

  app.put('/api/boss/limits', { preHandler: [app.requirePermission('limits.manage')] }, async (req) => {
    const body = z
      .object({ role: z.string(), scope: z.enum(['payment', 'zayavka', 'contractor']), limit: z.number().min(0) })
      .parse(req.body);
    const limit = await prisma.autonomyLimit.upsert({
      where: { role_scope: { role: body.role, scope: body.scope } },
      create: body,
      update: { limit: body.limit },
    });
    return { id: limit.id };
  });

  /** Поручение из карточки проблемы: «Поставить задачу» → «Поручить». */
  app.post('/api/boss/tasks', { preHandler: [app.requirePermission('tasks.issue')] }, async (req) => {
    const body = z
      .object({
        text: z.string().min(1),
        objectId: z.string(),
        blockId: z.string().optional(),
        floor: z.number().optional(),
        sectionId: z.string().optional(),
        assigneeId: z.string().nullable(),
        dueDate: z.string(),
        incidentId: z.string().optional(),
        origin: z.enum(['inbox', 'schedule', 'manual']).default('manual'),
      })
      .parse(req.body);

    const task = await prisma.task.create({
      data: {
        text: body.text,
        objectId: body.objectId,
        blockId: body.blockId,
        floor: body.floor,
        sectionId: body.sectionId,
        assigneeId: body.assigneeId,
        authorId: req.currentUser.id,
        dueDate: new Date(body.dueDate),
        origin: body.origin,
        sourceRef: body.incidentId,
      },
    });

    if (body.incidentId) {
      await prisma.incident.update({
        where: { id: body.incidentId },
        data: { status: 'assigned', taskId: task.id },
      });
    }

    if (body.assigneeId) {
      await emit('TaskAssigned', 'task', task.id, {
        authorId: body.assigneeId,
        text: body.text,
        dueDate: new Date(body.dueDate).toLocaleDateString('ru-RU'),
      });
    }

    return { id: task.id };
  });

  app.get('/api/boss/tasks', async (req) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});
    const tasks = await prisma.task.findMany({
      where: query.objectId ? { objectId: query.objectId } : {},
      include: { assignee: true, object: true, block: true, section: true, author: true },
      orderBy: { dueDate: 'asc' },
    });
    const now = Date.now();
    return tasks.map((t) => ({
      id: t.id,
      text: t.text,
      objectName: t.object.name,
      blockName: t.block?.name ?? null,
      floor: t.floor,
      sectionName: t.section?.name ?? null,
      assignee: t.assignee?.fullName ?? null,
      assigneeId: t.assigneeId,
      author: t.author.fullName,
      dueDate: t.dueDate.toISOString(),
      status: t.status,
      overdue: t.status !== 'done' && t.dueDate.getTime() < now,
      origin: t.origin,
    }));
  });

  app.post('/api/boss/tasks/:id/done', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await prisma.task.update({ where: { id }, data: { status: 'done' } });
    return { ok: true };
  });

  /** Качество — таб главного инженера. */
  app.get('/api/boss/quality', async () => {
    const [prescriptions, protocols, blocked, rfis] = await Promise.all([
      prisma.prescription.findMany({
        where: { resolvedAt: null },
        include: { contractor: true, issuedBy: true },
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.concreteStrengthProtocol.findMany({
        where: { status: { not: 'passed' } },
        include: { object: true, processState: { include: { processDef: true } } },
      }),
      prisma.processState.findMany({
        where: { status: 'blocked' },
        include: { processDef: true, block: true, object: true },
      }),
      prisma.rfi.findMany({ where: { status: 'open' }, include: { object: true } }),
    ]);

    return {
      prescriptions: prescriptions.map((p) => ({
        id: p.id,
        number: p.number,
        contractor: p.contractor.name,
        kind: p.kind,
        text: p.text,
        location: p.location,
        issuedAt: p.issuedAt.toISOString(),
        dueDays: p.dueDays,
        overdue: Date.now() - p.issuedAt.getTime() > p.dueDays * 86_400_000,
        issuedBy: p.issuedBy.fullName,
      })),
      strengthPending: protocols.map((p) => ({
        id: p.id,
        objectName: p.object.name,
        process: p.processState.processDef.name,
        strengthPct: p.strengthPct,
        requiredPct: p.requiredPct,
      })),
      blockedProcesses: blocked.map((b) => ({
        id: b.id,
        objectName: b.object.name,
        title: `${b.processDef.name} · ${b.block.name} · ${b.floor} эт.`,
        reason: b.blockedReason,
      })),
      openRfis: rfis.map((r) => ({
        id: r.id,
        number: r.number,
        objectName: r.object.name,
        question: r.question,
        overdue: r.dueAt !== null && r.dueAt.getTime() < Date.now(),
      })),
    };
  });

  /** Остановка работ — действие, доступное только главному инженеру. */
  app.post('/api/boss/stop-work', { preHandler: [app.requirePermission('quality.stopWork')] }, async (req) => {
    const body = z.object({ objectId: z.string(), reason: z.string().min(1) }).parse(req.body);
    await prisma.constructionObject.update({ where: { id: body.objectId }, data: { status: 'paused' } });
    await prisma.incident.create({
      data: {
        objectId: body.objectId,
        kind: 'safety',
        title: '⛔ Работы остановлены главным инженером',
        detail: body.reason,
      },
    });
    await notify('prorab', 'safety', '⛔ Работы остановлены', body.reason);
    await notify('dir', 'safety', '⛔ Работы остановлены главным инженером', body.reason);
    return { ok: true };
  });

  /**
   * KPI сотрудников. Считает тот же модуль, что и /api/v1/kpi:
   * два разных расчёта одного показателя — гарантированный спор на планёрке.
   */
  app.get('/api/boss/kpi', { preHandler: [app.requirePermission('kpi.view')] }, async () => {
    return computeKpi();
  });

  /** Объекты компании: создание и изменение — у главного инженера. */
  app.post('/api/boss/objects', { preHandler: [app.requirePermission('objects.manage')] }, async (req) => {
    const body = z
      .object({
        code: z.string().min(1),
        name: z.string().min(1),
        address: z.string(),
        city: z.string(),
        floorsTotal: z.number().int().min(1),
        dueDate: z.string(),
        blocks: z.array(z.object({ name: z.string(), floors: z.number().int().min(1) })).min(1),
        responsibleUserId: z.string().optional(),
      })
      .parse(req.body);

    const object = await prisma.constructionObject.create({
      data: {
        code: body.code,
        name: body.name,
        address: body.address,
        city: body.city,
        floorsTotal: body.floorsTotal,
        dueDate: new Date(body.dueDate),
        responsibleUserId: body.responsibleUserId,
        blocks: { create: body.blocks },
      },
    });
    return { id: object.id };
  });

  app.patch('/api/boss/objects/:id', { preHandler: [app.requirePermission('objects.manage')] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        name: z.string().optional(),
        address: z.string().optional(),
        floorsTotal: z.number().int().optional(),
        dueDate: z.string().optional(),
        status: z.enum(['active', 'paused', 'done']).optional(),
        responsibleUserId: z.string().nullable().optional(),
      })
      .parse(req.body);

    await prisma.constructionObject.update({
      where: { id },
      data: {
        ...body,
        dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      },
    });
    return { ok: true };
  });
}
