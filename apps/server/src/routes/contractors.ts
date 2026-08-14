/**
 * Подрядчики и рейтинг (В1–В3).
 *
 * Рейтинг складывается из автоматической части (данные системы) и субъективной
 * (оценка прораба). Разложение показывается по тапу на цифру — поэтому обе части
 * возвращаются отдельно, а не одним числом.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notify } from '../notify.js';
import { emit } from '../audit.js';

/** Автоматическая часть весит больше субъективной: её труднее подкрутить. */
const AUTO_WEIGHT = 0.6;
const MANUAL_WEIGHT = 0.4;

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export async function contractorRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/contractors', async () => {
    const contractors = await prisma.contractor.findMany({
      include: { ratings: true, prescriptions: true },
      orderBy: { name: 'asc' },
    });

    return contractors.map((c) => {
      const auto = average([c.autoOnTime, c.autoRework, c.autoSafety, c.autoDocs]);
      const manual = average(
        c.ratings.flatMap((r) => [r.quality, r.safety, r.management, r.culture]),
      );
      const open = c.prescriptions.filter((p) => !p.resolvedAt);
      const stopped = open.some((p) => p.kind === 'safety' && p.dueDays <= 1);

      return {
        id: c.id,
        name: c.name,
        scope: c.scope,
        activeWorkers: c.activeWorkers,
        rating: Number((auto * AUTO_WEIGHT + manual * MANUAL_WEIGHT).toFixed(1)),
        breakdown: {
          auto: {
            onTime: c.autoOnTime,
            rework: c.autoRework,
            safety: c.autoSafety,
            docs: c.autoDocs,
            weight: AUTO_WEIGHT,
          },
          manual: {
            quality: average(c.ratings.map((r) => r.quality)),
            safety: average(c.ratings.map((r) => r.safety)),
            management: average(c.ratings.map((r) => r.management)),
            culture: average(c.ratings.map((r) => r.culture)),
            weight: MANUAL_WEIGHT,
            count: c.ratings.length,
          },
        },
        prescriptionsOpen: open.length,
        prescriptionsTotal: c.prescriptions.length,
        /** Работы приостановлены — это состояние карточки, а не подпись. */
        stopped,
        stopReason: stopped ? open.find((p) => p.kind === 'safety')?.text ?? null : null,
      };
    });
  });

  app.post('/api/contractors/:id/rate', { preHandler: [app.requirePermission('contractor.rate')] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        quality: z.number().int().min(1).max(5),
        safety: z.number().int().min(1).max(5),
        management: z.number().int().min(1).max(5),
        culture: z.number().int().min(1).max(5),
        comment: z.string().optional(),
      })
      .parse(req.body);

    await prisma.contractorRating.create({
      data: { contractorId: id, authorId: req.currentUser.id, ...body },
    });

    return { ok: true };
  });

  /**
   * Предписание. Мастер только фиксирует нарушение — выдаёт прораб,
   * копия уходит главному инженеру.
   */
  app.post('/api/contractors/:id/prescription', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        kind: z.enum(['safety', 'quality', 'project']),
        text: z.string().min(1),
        location: z.string().min(1),
        dueDays: z.number().int().min(1),
        /** Фото нарушения — ссылки на загруженные файлы. */
        photos: z.array(z.object({ fileId: z.string() })).default([]),
      })
      .parse(req.body);

    const contractor = await prisma.contractor.findUnique({ where: { id } });
    if (!contractor) return reply.code(404).send({ code: 'not_found', message: 'Подрядчик не найден' });

    if (req.currentUser.role === 'master') {
      // Мастер фиксирует — предписание выдаёт прораб.
      await emit('ViolationReportedByMaster', 'contractor', id, {
        contractor: contractor.name,
        location: body.location,
      });
      return { ok: true, issued: false };
    }

    const count = await prisma.prescription.count({ where: { contractorId: id } });
    const prescription = await prisma.prescription.create({
      data: {
        number: `№${count + 1}`,
        contractorId: id,
        issuedById: req.currentUser.id,
        kind: body.kind,
        text: body.text,
        location: body.location,
        dueDays: body.dueDays,
        photos: JSON.stringify(body.photos),
      },
    });

    await emit('PrescriptionIssued', 'contractor', id, {
      number: prescription.number,
      contractor: contractor.name,
      text: body.text,
      location: body.location,
      dueDays: body.dueDays,
    });

    return { ok: true, issued: true, number: prescription.number };
  });

  app.post('/api/prescriptions/:id/resolve', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await prisma.prescription.update({ where: { id }, data: { resolvedAt: new Date() } });
    return { ok: true };
  });
}
