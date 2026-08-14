/**
 * Настройка системы без развёртывания новой версии. ТЗ §9, критерий приёмки 12.
 *
 * Пороги, лимиты и шлюзы — данные. Если для смены распалубочной прочности
 * на втором объекте нужен релиз, система на втором объекте не работает.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { audit, actorOf, emit } from '../audit.js';
import { fail, withETag } from '../http.js';
import { getThreshold, listThresholds, setThreshold, type ThresholdKey } from '../thresholds.js';
import { MACHINES, availableTransitions, type Machine } from '../transitions.js';
import { notify } from '../notify.js';

const THRESHOLD_KEYS = [
  'winterTempC',
  'presentLeadWorkdays',
  'strippingStrengthPct',
  'autonomyLimit',
  'idleHourlyRate',
] as const;

export async function adminConfigRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Действующие пороги — их читает и клиент, чтобы показывать нормы, а не зашивать. */
  app.get('/api/v1/thresholds', async (req, reply) => {
    const query = z.object({ key: z.enum(THRESHOLD_KEYS).optional() }).parse(req.query ?? {});
    return withETag(reply, req, await listThresholds(query.key));
  });

  /** Значение с учётом области — «какая норма действует здесь и сейчас». */
  app.get('/api/v1/thresholds/resolve', async (req) => {
    const query = z
      .object({
        key: z.enum(THRESHOLD_KEYS),
        facilityId: z.string().optional(),
        processId: z.string().optional(),
        roleKey: z.string().optional(),
        at: z.string().optional(),
      })
      .parse(req.query);

    const value = await getThreshold({
      key: query.key,
      facilityId: query.facilityId,
      processId: query.processId,
      roleKey: query.roleKey,
      at: query.at ? new Date(query.at) : undefined,
    });
    return { key: query.key, value };
  });

  /**
   * Изменение порога. Температуры и прочность ведёт ПТО (ППР), лимиты — руководитель.
   * Прежнее значение закрывается периодом, а не переписывается.
   */
  app.put('/api/v1/thresholds', async (req, reply) => {
    const body = z
      .object({
        key: z.enum(THRESHOLD_KEYS),
        scopeType: z.enum(['company', 'facility', 'process']),
        scopeId: z.string().nullable().optional(),
        roleKey: z.string().nullable().optional(),
        value: z.number(),
        unit: z.string().optional(),
        source: z.string().optional(),
      })
      .parse(req.body);

    // Кто чем распоряжается — из ТЗ §9, столбец «кто ведёт».
    const owner: Record<string, string[]> = {
      winterTempC: ['pto'],
      presentLeadWorkdays: ['pto'],
      strippingStrengthPct: ['pto'],
      autonomyLimit: ['dir'],
      idleHourlyRate: ['dir'],
    };
    if (!owner[body.key]!.includes(req.currentUser.role)) {
      return fail(
        reply,
        403,
        'forbidden',
        `Этот порог ведёт другая роль: ${owner[body.key]!.join(', ')}`,
      );
    }

    const previous = await getThreshold({
      key: body.key as ThresholdKey,
      facilityId: body.scopeType === 'facility' ? body.scopeId : undefined,
      processId: body.scopeType === 'process' ? body.scopeId : undefined,
      roleKey: body.roleKey ?? undefined,
    });

    const created = await setThreshold({
      key: body.key as ThresholdKey,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      roleKey: body.roleKey,
      value: body.value,
      unit: body.unit,
      source: body.source,
      createdBy: req.currentUser.id,
    });

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    await audit(actorOf(req.currentUser, me.fullName), {
      entity: 'threshold',
      entityId: created.id,
      action: 'update',
      field: body.key,
      oldValue: previous,
      newValue: body.value,
      reason: body.source,
    });

    return { id: created.id, key: created.key, value: Number(created.value), version: created.version };
  });

  /** Журнал аудита по сущности. Только чтение — записи не правятся. */
  app.get('/api/v1/audit', async (req, reply) => {
    // Журнал видят те, кто отвечает за достоверность: ПТО и руководство.
    if (!['pto', 'gi', 'dir'].includes(req.currentUser.role)) {
      return fail(reply, 403, 'forbidden', 'Журнал аудита доступен ПТО и руководству');
    }
    const query = z
      .object({
        entity: z.string().optional(),
        entityId: z.string().optional(),
        limit: z.coerce.number().min(1).max(200).default(50),
      })
      .parse(req.query ?? {});

    const rows = await prisma.auditLog.findMany({
      where: {
        ...(query.entity ? { entity: query.entity } : {}),
        ...(query.entityId ? { entityId: query.entityId } : {}),
      },
      orderBy: { at: 'desc' },
      take: query.limit,
    });

    return rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      actor: r.actorLabel,
      actorRole: r.actorRole,
      entity: r.entity,
      entityId: r.entityId,
      action: r.action,
      field: r.field,
      oldValue: r.oldValue,
      newValue: r.newValue,
      reason: r.reason,
    }));
  });

  /** Какие переходы доступны роли из текущего состояния — чтобы клиент не гадал. */
  app.get('/api/v1/transitions/:machine', async (req) => {
    const params = z
      .object({
        machine: z.enum(['process', 'report', 'materialRequest', 'equipmentRequest', 'inspection', 'batch', 'task']),
      })
      .parse(req.params);
    const query = z.object({ from: z.string().optional() }).parse(req.query ?? {});

    if (!query.from) {
      return MACHINES[params.machine as Machine].map((t) => ({
        from: t.from,
        to: t.to,
        roles: t.roles,
        label: t.label,
      }));
    }

    return availableTransitions(params.machine as Machine, query.from, req.currentUser.role).map((t) => ({
      to: t.to,
      label: t.label,
    }));
  });

  /** Открытые шлюзы процесса — что именно его держит. */
  app.get('/api/v1/gates', async (req) => {
    const query = z.object({ processStateId: z.string().optional() }).parse(req.query ?? {});
    const gates = await prisma.gate.findMany({
      where: { ...(query.processStateId ? { processStateId: query.processStateId } : {}), status: 'open' },
      orderBy: { createdAt: 'desc' },
    });
    return gates.map((g) => ({
      id: g.id,
      processStateId: g.processStateId,
      kind: g.kind,
      reason: g.reason,
      createdAt: g.createdAt.toISOString(),
    }));
  });

  /**
   * Снятие блокировки вручную. Критерий приёмки 4: только главный инженер
   * и только с обоснованием — оно и объясняет потом, почему поехали дальше.
   */
  app.post('/api/v1/gates/:id/release', { preHandler: [app.requirePermission('quality.stopWork')] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({ justification: z.string().min(10, 'Обоснование должно быть содержательным') })
      .parse(req.body);

    const gate = await prisma.gate.findUnique({ where: { id } });
    if (!gate) return fail(reply, 404, 'not_found', 'Шлюз не найден');
    if (gate.status === 'released') {
      return fail(reply, 409, 'already_released', 'Шлюз уже снят');
    }

    const state = await prisma.processState.findUnique({
      where: { id: gate.processStateId },
      include: { processDef: true },
    });

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });

    await prisma.$transaction([
      prisma.gate.update({
        where: { id },
        data: {
          status: 'released',
          releasedById: req.currentUser.id,
          releasedAt: new Date(),
          justification: body.justification,
        },
      }),
      prisma.processState.update({
        where: { id: gate.processStateId },
        data: { status: (state?.doneQty ?? 0) > 0 ? 'active' : 'idle', blockedReason: null },
      }),
      prisma.auditLog.create({
        data: {
          actorId: req.currentUser.id,
          actorLabel: me.fullName,
          actorRole: req.currentUser.role,
          entity: 'gate',
          entityId: id,
          action: 'status',
          field: 'status',
          oldValue: 'open',
          newValue: 'released',
          reason: body.justification,
        },
      }),
    ]);

    await emit('GateReleased', 'gate', id, {
      processStateId: gate.processStateId,
      kind: gate.kind,
      justification: body.justification,
      releasedBy: me.fullName,
    });

    await notify(
      'pto',
      'document',
      '🔓 Блокировка снята главным инженером',
      `${state?.processDef.name ?? 'процесс'} · обоснование: ${body.justification}`,
    );

    return { ok: true };
  });
}
