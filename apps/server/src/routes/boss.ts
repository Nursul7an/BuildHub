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
import { needsEscalation } from '../rules.js';
import { KPI } from '../../prisma/fixtures.js';

export async function bossRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Сводка: объекты с отклонением, проблемы с ценой, задачи. */
  app.get('/api/boss/digest', async (req) => {
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
          cpi: f && f.ac > 0 ? Number((f.ev / f.ac).toFixed(2)) : null,
          budget: f?.budget ?? null,
          eac: f && f.ev > 0 ? Number((f.budget / (f.ev / f.ac)).toFixed(0)) : null,
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
      finance: finance.map(serializeFinance),
    };
  });

  /** Финансы: закрытие актами, а не только освоение. */
  app.get('/api/boss/finance', { preHandler: [app.requirePermission('finance.view')] }, async () => {
    const [finance, articles, payments, limits] = await Promise.all([
      prisma.objectFinance.findMany({ include: { object: true } }),
      prisma.costArticle.findMany({ include: { object: true } }),
      prisma.payment.findMany({ include: { object: true }, orderBy: { dueDate: 'asc' } }),
      prisma.autonomyLimit.findMany(),
    ]);

    const total = articles.reduce((a, x) => a + x.amount, 0);

    return {
      objects: finance.map(serializeFinance),
      articles: articles.map((a) => ({
        name: a.name,
        amount: a.amount,
        pct: total > 0 ? Number(((a.amount / total) * 100).toFixed(1)) : 0,
        note: a.note,
      })),
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
    if (!payment) return reply.code(404).send({ error: 'not_found', message: 'Платёж не найден' });

    const escalate = await needsEscalation(req.currentUser.role, 'payment', payment.amount);
    if (escalate && req.currentUser.role !== 'dir') {
      await notify('dir', 'task', '💰 Платёж выше лимита автономности', `${payment.name} · ${payment.amount} млн сом`);
      return reply.code(409).send({
        error: 'above_limit',
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
      await notify(
        'prorab',
        'task',
        '🗓 Новая задача',
        `${body.text} · срок ${new Date(body.dueDate).toLocaleDateString('ru-RU')}`,
        undefined,
        body.assigneeId,
      );
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

  /** KPI сотрудников — пороги объявлены заранее, цвет считается из них. */
  app.get('/api/boss/kpi', { preHandler: [app.requirePermission('kpi.view')] }, async () => {
    return {
      departments: KPI.map((d) => ({
        key: d.key,
        label: d.label,
        metrics: d.metrics.map((m) => ({
          ...m,
          state:
            'goodAbove' in m && m.goodAbove !== undefined
              ? m.value >= m.goodAbove
                ? 'good'
                : m.value >= m.goodAbove * 0.9
                  ? 'warn'
                  : 'bad'
              : 'goodBelow' in m && m.goodBelow !== undefined
                ? m.value <= m.goodBelow
                  ? 'good'
                  : m.value <= m.goodBelow * 1.5
                    ? 'warn'
                    : 'bad'
                : 'neutral',
        })),
      })),
    };
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

function serializeFinance(f: {
  objectId: string;
  budget: number;
  ev: number;
  ac: number;
  closedByActs: number;
  receivable: number;
  object?: { name: string };
}) {
  const cpi = f.ac > 0 ? f.ev / f.ac : 1;
  const eac = cpi > 0 ? f.budget / cpi : f.budget;
  return {
    objectId: f.objectId,
    objectName: f.object?.name,
    budget: f.budget,
    ev: f.ev,
    ac: f.ac,
    cpi: Number(cpi.toFixed(2)),
    eac: Number(eac.toFixed(0)),
    /** Отклонение по завершении: плюс — экономия, минус — перерасход. */
    vac: Number((f.budget - eac).toFixed(0)),
    closedByActs: f.closedByActs,
    /** Освоено, но не закрыто актами — деньги, которые нельзя предъявить. */
    notClosed: Number((f.ev - f.closedByActs).toFixed(0)),
    receivable: f.receivable,
  };
}
