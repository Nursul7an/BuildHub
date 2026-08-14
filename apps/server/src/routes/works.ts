/**
 * Объекты, разделы, цепочки процессов, карточка процесса.
 * Экраны A2 «Мои работы», A3 «Цепочка», A4 «Карточка процесса», A7 «Предъявление».
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseJson, prisma } from '../db.js';
import { checkCanPresent, checkStrengthGate, isValidPresentationDate, recomputeChainBlocks } from '../rules.js';
import { notify } from '../notify.js';

export async function worksRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/objects', async () => {
    const objects = await prisma.constructionObject.findMany({
      include: { blocks: true, finance: true, responsible: true },
      orderBy: { name: 'asc' },
    });
    return objects.map((o) => ({
      id: o.id,
      code: o.code,
      name: o.name,
      address: o.address,
      city: o.city,
      floorsTotal: o.floorsTotal,
      dueDate: o.dueDate.toISOString(),
      status: o.status,
      pctPlan: o.pctPlan,
      pctFact: o.pctFact,
      deltaDays: o.deltaDays,
      responsible: o.responsible ? { id: o.responsible.id, fullName: o.responsible.fullName } : null,
      blocks: o.blocks.map((b) => ({ id: b.id, name: b.name, floors: b.floors })),
    }));
  });

  app.get('/api/sections', async () => {
    const sections = await prisma.sectionDef.findMany({
      include: { processes: { orderBy: { order: 'asc' } } },
      orderBy: { sortOrder: 'asc' },
    });
    return sections.map((s) => ({
      id: s.id,
      name: s.name,
      entryCondition: s.entryCondition,
      blockReason: s.blockReason,
      /** Счётчик актов в шапке цепочки — сколько процессов требуют АОСР. */
      actsCount: s.processes.filter((p) => p.requiresAosr).length,
      processes: s.processes.map((p) => ({
        id: p.id,
        order: p.order,
        name: p.name,
        unit: p.unit,
        requiresAosr: p.requiresAosr,
        subcycle: p.subcycle,
        critical: p.critical,
      })),
    }));
  });

  /** Мои работы: процессы, назначенные текущему пользователю (или все на объекте). */
  app.get('/api/works', async (req) => {
    const query = z
      .object({ objectId: z.string().optional(), mine: z.enum(['0', '1']).optional() })
      .parse(req.query ?? {});

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const objectId = query.objectId ?? me.objectId ?? undefined;

    const states = await prisma.processState.findMany({
      where: {
        objectId,
        ...(query.mine === '1' ? { assigneeUserId: req.currentUser.id } : {}),
      },
      include: { processDef: { include: { section: true } }, block: true },
      orderBy: [{ floor: 'desc' }, { processDef: { order: 'asc' } }],
    });

    return states.map(serializeState);
  });

  /** Цепочка процессов раздела на конкретном этаже. */
  app.get('/api/chain', async (req) => {
    const query = z
      .object({
        sectionId: z.string(),
        blockId: z.string(),
        floor: z.coerce.number(),
      })
      .parse(req.query);

    const section = await prisma.sectionDef.findUniqueOrThrow({
      where: { id: query.sectionId },
      include: { processes: { orderBy: { order: 'asc' } } },
    });

    const states = await prisma.processState.findMany({
      where: { blockId: query.blockId, floor: query.floor, processDef: { sectionId: query.sectionId } },
      include: { processDef: { include: { section: true } }, block: true },
    });
    const byDef = new Map(states.map((s) => [s.processDefId, s]));

    return {
      section: {
        id: section.id,
        name: section.name,
        entryCondition: section.entryCondition,
        blockReason: section.blockReason,
      },
      processCount: section.processes.length,
      actsCount: section.processes.filter((p) => p.requiresAosr).length,
      rows: section.processes.map((def) => {
        const state = byDef.get(def.id);
        return {
          order: def.order,
          processDefId: def.id,
          processStateId: state?.id ?? null,
          name: def.name,
          unit: def.unit,
          requiresAosr: def.requiresAosr,
          subcycle: def.subcycle,
          critical: def.critical,
          status: state?.status ?? 'idle',
          planQty: state?.planQty ?? 0,
          doneQty: state?.doneQty ?? 0,
          blockedReason: state?.blockedReason ?? null,
          dueDate: state?.dueDate?.toISOString() ?? null,
          aosrNumber: state?.aosrNumber ?? null,
          acceptedAt: state?.acceptedAt?.toISOString() ?? null,
          presentedAt: state?.presentedAt?.toISOString() ?? null,
          presentedOfDays: state?.presentedOfDays ?? null,
        };
      }),
    };
  });

  /** Карточка процесса: прогресс, история записей, комментарии, что его держит. */
  app.get('/api/process/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const state = await prisma.processState.findUnique({
      where: { id },
      include: {
        processDef: { include: { section: true } },
        block: true,
        object: true,
        comments: { orderBy: { createdAt: 'desc' } },
        entries: {
          include: { report: true, photos: true },
          orderBy: { report: { date: 'desc' } },
          take: 10,
        },
        documents: true,
        protocols: true,
      },
    });
    if (!state) return reply.code(404).send({ error: 'not_found', message: 'Процесс не найден' });

    const presentBlock = await checkCanPresent(state.id);
    const strengthBlock = await checkStrengthGate(state.id);

    return {
      ...serializeState(state),
      objectName: state.object.name,
      sectionName: state.processDef.section.name,
      history: state.entries.map((e) => ({
        date: e.report.date.toISOString(),
        volume: e.volume,
        unit: e.unit,
        workers: e.workers,
        photos: e.photos.length,
        status: e.report.status,
      })),
      comments: state.comments.map((c) => ({
        id: c.id,
        kind: c.kind,
        text: c.text,
        createdAt: c.createdAt.toISOString(),
        materialName: c.materialName,
        materialQty: c.materialQty,
        idleWorkers: c.idleWorkers,
        idleCost: c.idleCost,
        zayavkaId: c.zayavkaId,
      })),
      documents: state.documents.map((d) => ({ id: d.id, number: d.number, name: d.name, status: d.status })),
      strengthProtocols: state.protocols.map((p) => ({
        id: p.id,
        strengthPct: p.strengthPct,
        requiredPct: p.requiredPct,
        status: p.status,
        sampleAt: p.sampleAt.toISOString(),
      })),
      /** Почему кнопка «Предъявить» недоступна — текст показывается под ней. */
      presentBlockedBy: presentBlock?.message ?? null,
      strengthBlockedBy: strengthBlock?.message ?? null,
    };
  });

  /** Комментарий с типом. Каждый тип запускает действие, а не остаётся текстом. */
  app.post('/api/process/:id/comment', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        kind: z.enum(['problem', 'delay', 'material', 'quality', 'safety', 'other']),
        text: z.string().default(''),
        materialName: z.string().optional(),
        materialQty: z.number().optional(),
        materialUnit: z.string().optional(),
        neededBy: z.string().optional(),
        idleWorkers: z.number().optional(),
        idleSince: z.string().optional(),
      })
      .parse(req.body);

    const state = await prisma.processState.findUnique({
      where: { id },
      include: { processDef: true, block: true, object: true },
    });
    if (!state) return reply.code(404).send({ error: 'not_found', message: 'Процесс не найден' });

    // Расчётная потеря простоя — по ставкам, а не «на глаз».
    const HOURLY_RATE = 175; // сом/час на человека
    const idleCost =
      body.kind === 'problem' && body.idleWorkers && body.idleSince
        ? Math.round(
            body.idleWorkers *
              HOURLY_RATE *
              Math.max(1, (Date.now() - new Date(body.idleSince).getTime()) / 3_600_000),
          )
        : null;

    const comment = await prisma.processComment.create({
      data: {
        processStateId: id,
        kind: body.kind,
        text: body.text,
        authorId: req.currentUser.id,
        materialName: body.materialName,
        materialQty: body.materialQty,
        materialUnit: body.materialUnit,
        neededBy: body.neededBy ? new Date(body.neededBy) : null,
        idleWorkers: body.idleWorkers,
        idleSince: body.idleSince ? new Date(body.idleSince) : null,
        idleCost,
      },
    });

    // Простой уходит в ленту проблем руководства — с ценой.
    if (body.kind === 'problem' && idleCost) {
      await prisma.incident.create({
        data: {
          objectId: state.objectId,
          kind: 'idle',
          title: `Простой · ${body.idleWorkers} чел`,
          detail: `${state.processDef.name} · ${state.block.name}, ${state.floor} эт. · ≈ ${idleCost.toLocaleString('ru-RU')} сом`,
          workersIdle: body.idleWorkers,
          cost: idleCost,
        },
      });
      await notify('gi', 'idle', `🔴 Простой · ${body.idleWorkers} чел`, `${state.processDef.name} · ≈ ${idleCost.toLocaleString('ru-RU')} сом`);
    }

    if (body.kind === 'safety') {
      await notify('gi', 'safety', '⚫ Охрана труда', `${state.processDef.name} · ${state.block.name}, ${state.floor} эт.`);
    }

    return { id: comment.id, idleCost };
  });

  /** Предъявление к освидетельствованию. */
  app.post('/api/process/:id/present', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        checklist: z.array(z.object({ key: z.string(), label: z.string(), checked: z.boolean() })),
        date: z.string(),
        notify: z.array(z.string()),
      })
      .parse(req.body);

    const failure = await checkCanPresent(id);
    if (failure) return reply.code(409).send({ error: failure.code, message: failure.message });

    if (!isValidPresentationDate(new Date(body.date))) {
      return reply.code(409).send({
        error: 'too_soon',
        message: 'По норме извещение — не позднее чем за 3 рабочих дня',
      });
    }

    const state = await prisma.processState.findUniqueOrThrow({
      where: { id },
      include: { processDef: true, block: true },
    });

    await prisma.presentation.create({
      data: {
        processStateId: id,
        scheduledFor: new Date(body.date),
        checklist: JSON.stringify(body.checklist),
        notified: JSON.stringify(body.notify),
        authorId: req.currentUser.id,
      },
    });

    await prisma.processState.update({
      where: { id },
      data: { status: 'presented', presentedAt: new Date(), presentedOfDays: 3 },
    });

    await notify(
      'pto',
      'presentation',
      '🔔 Предъявлено к освидетельствованию',
      `${state.processDef.name} · ${state.block.name} · ${state.floor} эт. · извещение технадзору за 3 раб. дня`,
    );

    return { ok: true };
  });

  /** Приёмка процесса — подписан АОСР, следующий процесс разблокируется. */
  app.post('/api/process/:id/accept', { preHandler: [app.requirePermission('aosr.draft')] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ aosrNumber: z.string() }).parse(req.body);

    const state = await prisma.processState.findUnique({
      where: { id },
      include: { processDef: true },
    });
    if (!state) return reply.code(404).send({ error: 'not_found', message: 'Процесс не найден' });

    await prisma.processState.update({
      where: { id },
      data: { status: 'accepted', aosrNumber: body.aosrNumber, acceptedAt: new Date() },
    });

    await recomputeChainBlocks(state.objectId, state.blockId, state.floor, state.processDef.sectionId);

    await notify(
      'prorab',
      'document',
      `✅ АОСР ${body.aosrNumber} подписан`,
      `${state.processDef.name} · следующий процесс разблокирован`,
    );

    return { ok: true };
  });
}

export function serializeState(state: {
  id: string;
  status: string;
  planQty: number;
  doneQty: number;
  blockedReason: string | null;
  dueDate: Date | null;
  aosrNumber: string | null;
  acceptedAt: Date | null;
  presentedAt: Date | null;
  presentedOfDays: number | null;
  floor: number;
  objectId: string;
  blockId: string;
  block: { name: string };
  processDef: { id: string; name: string; unit: string; requiresAosr: boolean; order: number; subcycle: string | null; critical: boolean; sectionId: string; section?: { name: string } };
}) {
  return {
    id: state.id,
    processDefId: state.processDef.id,
    sectionId: state.processDef.sectionId,
    sectionName: state.processDef.section?.name,
    name: state.processDef.name,
    unit: state.processDef.unit,
    requiresAosr: state.processDef.requiresAosr,
    subcycle: state.processDef.subcycle,
    critical: state.processDef.critical,
    order: state.processDef.order,
    objectId: state.objectId,
    blockId: state.blockId,
    blockName: state.block.name,
    floor: state.floor,
    status: state.status,
    planQty: state.planQty,
    doneQty: state.doneQty,
    /** Процент считается от плана процесса, а не от «среднего по разделу». */
    pct: state.planQty > 0 ? Math.min(100, (state.doneQty / state.planQty) * 100) : 0,
    blockedReason: state.blockedReason,
    dueDate: state.dueDate?.toISOString() ?? null,
    aosrNumber: state.aosrNumber,
    acceptedAt: state.acceptedAt?.toISOString() ?? null,
    presentedAt: state.presentedAt?.toISOString() ?? null,
    presentedOfDays: state.presentedOfDays,
  };
}

export { parseJson };
