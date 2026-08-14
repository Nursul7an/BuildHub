/**
 * KPI по отделам. ТЗ §6: показатели сотрудников с порогами цвета.
 *
 * Пороги ведёт руководитель (§9) и меняет без выкатки. Период измерения —
 * тоже настройка: пока он идёт, показатель считается, но никого не судит.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail } from '../http.js';
import { actorOf, audit } from '../audit.js';
import { DEPARTMENTS, type Department, computeKpi } from '../services/kpi.js';

export async function kpiRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Показатели отдела. Без параметра — по всем отделам. */
  app.get('/api/v1/kpi', { preHandler: [app.requirePermission('kpi.view')] }, async (req) => {
    const query = z
      .object({
        department: z.enum(DEPARTMENTS as [Department, ...Department[]]).optional(),
        facilityId: z.string().optional(),
      })
      .parse(req.query ?? {});

    return computeKpi({ department: query.department, objectId: query.facilityId });
  });

  /** Пороги цвета — их читает и экран настройки. */
  app.get('/api/v1/kpi/targets', { preHandler: [app.requirePermission('kpi.view')] }, async () => {
    const targets = await prisma.kpiTarget.findMany({
      orderBy: [{ department: 'asc' }, { key: 'asc' }],
    });
    return targets.map((t) => ({
      id: t.id,
      key: t.key,
      department: t.department,
      label: t.label,
      unit: t.unit,
      scopeType: t.scopeType,
      scopeId: t.scopeId === '' ? null : t.scopeId,
      goodAbove: t.goodAbove === null ? null : Number(t.goodAbove),
      goodBelow: t.goodBelow === null ? null : Number(t.goodBelow),
      measuringUntil: t.measuringUntil?.toISOString() ?? null,
      source: t.source,
    }));
  });

  /**
   * Изменение порога. Ведёт руководитель: это управленческое решение,
   * а не техническая настройка.
   */
  app.put('/api/v1/kpi/targets', { preHandler: [app.requirePermission('limits.manage')] }, async (req, reply) => {
    const body = z
      .object({
        key: z.string().min(1),
        department: z.enum(DEPARTMENTS as [Department, ...Department[]]),
        label: z.string().min(1),
        unit: z.string(),
        scopeType: z.enum(['company', 'facility']).default('company'),
        scopeId: z.string().nullable().optional(),
        goodAbove: z.number().nullable().optional(),
        goodBelow: z.number().nullable().optional(),
        measuringUntil: z.string().nullable().optional(),
        source: z.string().optional(),
      })
      .parse(req.body);

    if (body.goodAbove !== undefined && body.goodAbove !== null && body.goodBelow !== undefined && body.goodBelow !== null) {
      return fail(
        reply,
        422,
        'ambiguous_target',
        'У показателя одно направление: либо «хорошо выше», либо «хорошо ниже»',
      );
    }
    if (body.scopeType === 'facility' && !body.scopeId) {
      return fail(reply, 422, 'scope_required', 'Для порога по объекту нужен идентификатор объекта');
    }

    const scopeId = body.scopeId ?? '';
    const previous = await prisma.kpiTarget.findUnique({
      where: { key_scopeType_scopeId: { key: body.key, scopeType: body.scopeType, scopeId } },
    });

    const data = {
      key: body.key,
      department: body.department,
      label: body.label,
      unit: body.unit,
      scopeType: body.scopeType,
      scopeId,
      goodAbove: body.goodAbove ?? null,
      goodBelow: body.goodBelow ?? null,
      measuringUntil: body.measuringUntil ? new Date(body.measuringUntil) : null,
      source: body.source,
    };

    const saved = await prisma.kpiTarget.upsert({
      where: { key_scopeType_scopeId: { key: body.key, scopeType: body.scopeType, scopeId } },
      create: data,
      update: data,
    });

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    await audit(actorOf(req.currentUser, me.fullName), {
      entity: 'kpiTarget',
      entityId: saved.id,
      action: previous ? 'update' : 'create',
      field: body.key,
      oldValue: previous
        ? `выше ${previous.goodAbove ?? '—'} / ниже ${previous.goodBelow ?? '—'}`
        : null,
      newValue: `выше ${body.goodAbove ?? '—'} / ниже ${body.goodBelow ?? '—'}`,
      reason: body.source,
    });

    return { id: saved.id, key: saved.key };
  });

  /**
   * Завершить период измерения по показателю. Отдельным действием,
   * а не полем в общей форме: включение вердикта — решение, которое
   * стоит принимать осознанно.
   */
  app.post('/api/v1/kpi/targets/:key/activate', { preHandler: [app.requirePermission('limits.manage')] }, async (req, reply) => {
    const { key } = z.object({ key: z.string() }).parse(req.params);

    const target = await prisma.kpiTarget.findFirst({ where: { key, scopeType: 'company' } });
    if (!target) return fail(reply, 404, 'not_found', 'Показатель не найден');
    if (target.goodAbove === null && target.goodBelow === null) {
      return fail(reply, 422, 'no_threshold', 'Сначала задайте порог — иначе вердикт выносить нечем');
    }

    await prisma.kpiTarget.update({ where: { id: target.id }, data: { measuringUntil: null } });

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    await audit(actorOf(req.currentUser, me.fullName), {
      entity: 'kpiTarget',
      entityId: target.id,
      action: 'update',
      field: 'measuringUntil',
      oldValue: target.measuringUntil?.toISOString() ?? null,
      newValue: 'период измерения завершён',
    });

    return { ok: true, key };
  });
}
