/**
 * Заявки: материалы (Б1–Б6) и спецтехника (ТХ1–ТХ3), приёмка на объекте,
 * нормализация позиции снабжением.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseJson, prisma } from '../db.js';
import { checkFrontChecklist } from '../rules.js';
import { notify } from '../notify.js';

/** Номер вида ЗВ-АКО-26-0184: тип, код объекта, год, счётчик. */
async function nextNumber(kind: 'material' | 'tech', objectCode: string): Promise<string> {
  const prefix = kind === 'material' ? 'ЗВ' : 'ЗТ';
  const year = String(new Date().getFullYear()).slice(-2);
  const head = `${prefix}-${objectCode}-${year}-`;
  const last = await prisma.zayavka.findFirst({
    where: { number: { startsWith: head } },
    orderBy: { number: 'desc' },
  });
  const n = last ? Number(last.number.slice(head.length)) + 1 : 1;
  return head + String(n).padStart(4, '0');
}

export async function zayavkaRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/zayavki', async (req) => {
    const query = z
      .object({
        kind: z.enum(['material', 'tech']).optional(),
        scope: z.enum(['mine', 'department', 'all']).default('mine'),
      })
      .parse(req.query ?? {});

    const role = req.currentUser.role;
    const where =
      query.scope === 'mine'
        ? { authorId: req.currentUser.id }
        : query.scope === 'department'
          ? { holderId: req.currentUser.id }
          : {};

    const zayavki = await prisma.zayavka.findMany({
      where: { ...where, ...(query.kind ? { kind: query.kind } : {}) },
      include: {
        items: { include: { catalogItem: true } },
        events: { orderBy: { at: 'asc' }, include: { actor: true } },
        author: true,
        holder: true,
        object: true,
        block: true,
        techRequest: { include: { machine: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Снабжение и завсклад видят все материальные заявки своего направления.
    const visible =
      query.scope === 'department' && (role === 'snab' || role === 'sklad' || role === 'tech')
        ? await prisma.zayavka.findMany({
            where: { kind: role === 'tech' ? 'tech' : 'material' },
            include: {
              items: { include: { catalogItem: true } },
              events: { orderBy: { at: 'asc' }, include: { actor: true } },
              author: true,
              holder: true,
              object: true,
              block: true,
              techRequest: { include: { machine: true } },
            },
            orderBy: { createdAt: 'desc' },
          })
        : zayavki;

    return visible.map(serializeZayavka);
  });

  app.get('/api/zayavki/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const zayavka = await prisma.zayavka.findUnique({
      where: { id },
      include: {
        items: { include: { catalogItem: true } },
        events: { orderBy: { at: 'asc' }, include: { actor: true } },
        author: true,
        holder: true,
        object: true,
        block: true,
        techRequest: { include: { machine: true, report: true } },
        acceptances: { include: { acceptedBy: true } },
      },
    });
    if (!zayavka) return reply.code(404).send({ code: 'not_found', message: 'Заявка не найдена' });
    return serializeZayavka(zayavka);
  });

  app.post('/api/zayavki', { preHandler: [app.requirePermission('zayavka.create')] }, async (req, reply) => {
    const body = z
      .object({
        kind: z.enum(['material', 'tech']),
        objectId: z.string(),
        blockId: z.string().optional(),
        floor: z.number().optional(),
        processStateId: z.string().optional(),
        priority: z.enum(['norm', 'urgent']).default('norm'),
        deliveryBy: z.string().optional(),
        items: z
          .array(
            z.object({
              rawText: z.string().min(1),
              catalogItemId: z.string().nullable().optional(),
              qty: z.number().positive(),
              unit: z.string(),
              note: z.string().optional(),
              overspendReason: z.string().optional(),
            }),
          )
          .min(1),
        idleWorkers: z.number().optional(),
        idleSince: z.string().optional(),
        tech: z
          .object({
            machineType: z.string(),
            hours: z.number(),
            date: z.string(),
            timeFrom: z.string(),
            frontChecklist: z.array(
              z.object({ key: z.string(), label: z.string(), checked: z.boolean() }),
            ),
          })
          .optional(),
      })
      .parse(req.body);

    if (body.kind === 'tech') {
      if (!body.tech) {
        return reply.code(400).send({ code: 'bad_request', message: 'Нужны параметры техники' });
      }
      const failure = checkFrontChecklist(body.tech.frontChecklist);
      if (failure) return reply.code(422).send({ code: failure.code, message: failure.message });
    }

    const object = await prisma.constructionObject.findUniqueOrThrow({ where: { id: body.objectId } });
    const number = await nextNumber(body.kind, object.code);

    // Мастер не отправляет напрямую — заявка идёт через прораба.
    const isMaster = req.currentUser.role === 'master';
    const status = isMaster ? 'atForeman' : 'new';

    // Остаток по спецификации фиксируется на момент заявки — иначе сверка бессмысленна.
    const stock = await prisma.stockBalance.findMany({
      where: { objectId: body.objectId },
    });

    const zayavka = await prisma.zayavka.create({
      data: {
        number,
        kind: body.kind,
        status,
        objectId: body.objectId,
        blockId: body.blockId,
        floor: body.floor,
        processStateId: body.processStateId,
        authorId: req.currentUser.id,
        priority: body.priority,
        deliveryBy: body.deliveryBy ? new Date(body.deliveryBy) : null,
        idleWorkers: body.idleWorkers,
        idleSince: body.idleSince ? new Date(body.idleSince) : null,
        idleCost:
          body.idleWorkers && body.idleSince
            ? Math.round(
                body.idleWorkers *
                  175 *
                  Math.max(1, (Date.now() - new Date(body.idleSince).getTime()) / 3_600_000),
              )
            : null,
        items: {
          create: body.items.map((i) => ({
            rawText: i.rawText,
            catalogItemId: i.catalogItemId ?? null,
            qty: i.qty,
            unit: i.unit,
            note: i.note,
            overspendReason: i.overspendReason,
            specRemainder:
              stock.find((s) => s.catalogItemId === i.catalogItemId)?.specRemainder ?? null,
          })),
        },
        events: {
          create: [{ status, actorId: req.currentUser.id, note: 'Отправлена' }],
        },
      },
      include: { items: true },
    });

    if (body.kind === 'tech' && body.tech) {
      await prisma.techRequest.create({
        data: {
          zayavkaId: zayavka.id,
          machineType: body.tech.machineType,
          hours: body.tech.hours,
          date: new Date(body.tech.date),
          timeFrom: body.tech.timeFrom,
          frontChecklist: JSON.stringify(body.tech.frontChecklist),
        },
      });
    }

    const target = isMaster ? 'prorab' : body.kind === 'tech' ? 'tech' : 'snab';
    await notify(
      target,
      'zayavka',
      `📦 Заявка ${number}`,
      body.items.map((i) => `${i.rawText} · ${i.qty} ${i.unit}`).join(', ') +
        (body.priority === 'urgent' ? ' · СРОЧНО, люди стоят' : ''),
    );

    return { id: zayavka.id, number, status };
  });

  /** Согласование заявки мастера прорабом. */
  app.post('/api/zayavki/:id/approve', { preHandler: [app.requirePermission('zayavka.approve')] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const zayavka = await prisma.zayavka.update({
      where: { id },
      data: {
        status: 'new',
        events: { create: [{ status: 'new', actorId: req.currentUser.id, note: 'Согласована прорабом' }] },
      },
    });
    await notify('snab', 'zayavka', `📦 Заявка ${zayavka.number}`, 'Согласована прорабом');
    return { ok: true };
  });

  /**
   * Нормализация позиции снабжением. Формулировка прораба запоминается —
   * справочник растёт сам, и в следующий раз позиция опознаётся сразу.
   */
  app.post('/api/zayavki/:id/normalize', { preHandler: [app.requirePermission('zayavka.normalize')] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({ itemId: z.string(), catalogItemId: z.string(), rememberAlias: z.boolean().default(true) })
      .parse(req.body);

    const item = await prisma.zayavkaItem.findUnique({ where: { id: body.itemId } });
    if (!item || item.zayavkaId !== id) {
      return reply.code(404).send({ code: 'not_found', message: 'Позиция не найдена' });
    }

    await prisma.zayavkaItem.update({
      where: { id: body.itemId },
      data: { catalogItemId: body.catalogItemId },
    });

    if (body.rememberAlias) {
      const catalogItem = await prisma.catalogItem.findUniqueOrThrow({ where: { id: body.catalogItemId } });
      const aliases = parseJson<string[]>(catalogItem.aliases, []);
      const alias = item.rawText.trim().toLowerCase();
      if (alias && !aliases.includes(alias)) {
        await prisma.catalogItem.update({
          where: { id: body.catalogItemId },
          data: { aliases: JSON.stringify([...aliases, alias]) },
        });
      }
    }

    await prisma.zayavka.update({
      where: { id },
      data: {
        status: 'approved',
        events: { create: [{ status: 'approved', actorId: req.currentUser.id, note: 'Позиция сопоставлена' }] },
      },
    });

    return { ok: true };
  });

  /** Перевод заявки по статусам — движение видно в таймлайне карточки. */
  app.post('/api/zayavki/:id/status', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        status: z.enum([
          'approved',
          'purchasing',
          'ordered',
          'inTransit',
          'delivered',
          'accepted',
          'closed',
          'rejected',
        ]),
        note: z.string().optional(),
        deliveryBy: z.string().optional(),
      })
      .parse(req.body);

    const zayavka = await prisma.zayavka.update({
      where: { id },
      data: {
        status: body.status,
        deliveryBy: body.deliveryBy ? new Date(body.deliveryBy) : undefined,
        holderId: req.currentUser.id,
        events: { create: [{ status: body.status, actorId: req.currentUser.id, note: body.note }] },
      },
      include: { author: true },
    });

    await notify(
      zayavka.author.role as never,
      'zayavka',
      `📦 ${zayavka.number}`,
      body.note ?? `Статус: ${body.status}`,
      undefined,
      zayavka.authorId,
    );

    return { ok: true };
  });

  /**
   * Приёмка материала на объекте. Два шага: количество, затем паспорт.
   * Партия без паспорта помечается, работы с ней останавливаются.
   */
  app.post('/api/zayavki/:id/accept', { preHandler: [app.requirePermission('material.accept')] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        qtyAccepted: z.number().positive(),
        passportOk: z.boolean(),
        passportNumber: z.string().optional(),
        discrepancy: z.string().optional(),
        photos: z
          .array(z.object({ url: z.string(), takenAt: z.string(), lat: z.number().optional(), lon: z.number().optional() }))
          .default([]),
      })
      .parse(req.body);

    const zayavka = await prisma.zayavka.findUnique({
      where: { id },
      include: { items: { include: { catalogItem: true } } },
    });
    if (!zayavka) return reply.code(404).send({ code: 'not_found', message: 'Заявка не найдена' });
    if (zayavka.status !== 'inTransit' && zayavka.status !== 'delivered') {
      // «Принять материал» не должно быть доступно на грузе, который ещё едет.
      return reply
        .code(409)
        .send({ code: 'not_delivered', message: 'Материал ещё не на объекте — приёмка недоступна' });
    }
    if (body.photos.length === 0) {
      return reply.code(422).send({ code: 'no_photo', message: 'Фото приёмки обязательно' });
    }

    await prisma.materialAcceptance.create({
      data: {
        zayavkaId: id,
        acceptedById: req.currentUser.id,
        qtyAccepted: body.qtyAccepted,
        passportOk: body.passportOk,
        passportNumber: body.passportNumber,
        discrepancy: body.discrepancy,
        photos: JSON.stringify(body.photos),
      },
    });

    await prisma.zayavka.update({
      where: { id },
      data: {
        status: body.passportOk ? 'accepted' : 'delivered',
        events: {
          create: [
            {
              status: body.passportOk ? 'accepted' : 'delivered',
              actorId: req.currentUser.id,
              note: body.passportOk ? 'Принято' : 'Принято без паспорта — партия помечена',
            },
          ],
        },
      },
    });

    // Остаток на объекте растёт — форма следующей заявки его покажет.
    for (const item of zayavka.items) {
      if (!item.catalogItemId) continue;
      await prisma.stockBalance.upsert({
        where: { objectId_catalogItemId: { objectId: zayavka.objectId, catalogItemId: item.catalogItemId } },
        create: {
          objectId: zayavka.objectId,
          catalogItemId: item.catalogItemId,
          qty: body.qtyAccepted,
          unit: item.unit,
          hasPassport: body.passportOk,
        },
        update: { qty: { increment: body.qtyAccepted }, hasPassport: body.passportOk },
      });
    }

    if (!body.passportOk) {
      await notify(
        'pto',
        'noPassport',
        '🔴 Материал без паспорта · партия помечена',
        `${zayavka.number} · работы с этой партией приостановлены · извещены снабжение и заказчик`,
      );
      await notify('snab', 'noPassport', '🔴 Материал без паспорта', `${zayavka.number} · требуется паспорт качества`);
    } else {
      await notify('pto', 'acceptance', '📥 Приёмка материала', `${zayavka.number} · запись в Журнал входного контроля`);
    }

    return { ok: true };
  });

  /** Отчёт по технике после работы — без него смена не закрывается. */
  app.post('/api/tech/:id/report', { preHandler: [app.requirePermission('tech.dispatch')] }, async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        hoursPlanned: z.number(),
        hoursActual: z.number(),
        idleHours: z.number().default(0),
        idleReason: z.string().optional(),
        fuel: z.number().optional(),
        faults: z.string().optional(),
      })
      .parse(req.body);

    if (body.idleHours > 0 && !body.idleReason) {
      return reply.code(422).send({ code: 'no_reason', message: 'Укажите причину простоя техники' });
    }

    await prisma.techReport.create({
      data: {
        techRequestId: id,
        hoursPlanned: body.hoursPlanned,
        hoursActual: body.hoursActual,
        idleHours: body.idleHours,
        idleReason: body.idleReason,
        fuel: body.fuel,
        faults: body.faults,
        ratedById: req.currentUser.id,
      },
    });

    if (body.faults) {
      await notify('gi', 'safety', '🚜 Неисправность техники', body.faults);
    }

    return { ok: true };
  });

  app.get('/api/machines', async () => {
    const machines = await prisma.machine.findMany({ orderBy: { name: 'asc' } });
    const now = Date.now();
    return machines.map((m) => ({
      id: m.id,
      name: m.name,
      kind: m.kind,
      status: m.status,
      nextServiceAt: m.nextServiceAt?.toISOString() ?? null,
      permitUntil: m.permitUntil?.toISOString() ?? null,
      /** Система обязана предупреждать заранее, а не в день истечения. */
      serviceSoon: m.nextServiceAt ? m.nextServiceAt.getTime() - now < 14 * 86_400_000 : false,
      permitExpiring: m.permitUntil ? m.permitUntil.getTime() - now < 30 * 86_400_000 : false,
    }));
  });
}

type ZayavkaFull = Parameters<typeof serializeZayavkaImpl>[0];
function serializeZayavkaImpl(z: {
  id: string;
  number: string;
  kind: string;
  status: string;
  priority: string;
  createdAt: Date;
  deliveryBy: Date | null;
  idleWorkers: number | null;
  idleCost: number | null;
  idleSince: Date | null;
  floor: number | null;
  objectId: string;
  object?: { name: string };
  block?: { name: string } | null;
  author?: { id: string; fullName: string; role: string };
  holder?: { id: string; fullName: string; role: string } | null;
  items: {
    id: string;
    rawText: string;
    qty: number;
    unit: string;
    note: string | null;
    specRemainder: number | null;
    overspendReason: string | null;
    catalogItem?: { id: string; name: string } | null;
  }[];
  events?: { id: string; at: Date; status: string; note: string | null; actor?: { fullName: string } }[];
  techRequest?: {
    id: string;
    machineType: string;
    hours: number;
    date: Date;
    timeFrom: string;
    frontChecklist: string;
    machine?: { id: string; name: string } | null;
    report?: unknown;
  } | null;
  acceptances?: { id: string; at: Date; qtyAccepted: number; passportOk: boolean; acceptedBy?: { fullName: string } }[];
}) {
  return {
    id: z.id,
    number: z.number,
    kind: z.kind,
    status: z.status,
    priority: z.priority,
    createdAt: z.createdAt.toISOString(),
    deliveryBy: z.deliveryBy?.toISOString() ?? null,
    idleWorkers: z.idleWorkers,
    idleSince: z.idleSince?.toISOString() ?? null,
    idleCost: z.idleCost,
    objectId: z.objectId,
    objectName: z.object?.name,
    blockName: z.block?.name ?? null,
    floor: z.floor,
    author: z.author ? { id: z.author.id, fullName: z.author.fullName, role: z.author.role } : null,
    /** Кто держит заявку сейчас — на карточке это важнее номера. */
    holder: z.holder ? { id: z.holder.id, fullName: z.holder.fullName, role: z.holder.role } : null,
    items: z.items.map((i) => ({
      id: i.id,
      rawText: i.rawText,
      name: i.catalogItem?.name ?? null,
      matched: Boolean(i.catalogItem),
      qty: i.qty,
      unit: i.unit,
      note: i.note,
      specRemainder: i.specRemainder,
      overspendReason: i.overspendReason,
      /** Заявлено больше остатка по спецификации — повод указать причину. */
      overSpec: i.specRemainder !== null && i.qty > i.specRemainder,
    })),
    timeline:
      z.events?.map((e) => ({
        id: e.id,
        at: e.at.toISOString(),
        status: e.status,
        note: e.note,
        actor: e.actor?.fullName,
      })) ?? [],
    tech: z.techRequest
      ? {
          id: z.techRequest.id,
          machineType: z.techRequest.machineType,
          hours: z.techRequest.hours,
          date: z.techRequest.date.toISOString(),
          timeFrom: z.techRequest.timeFrom,
          frontChecklist: parseJson<{ key: string; label: string; checked: boolean }[]>(
            z.techRequest.frontChecklist,
            [],
          ),
          machine: z.techRequest.machine ?? null,
          hasReport: Boolean(z.techRequest.report),
        }
      : null,
    acceptances:
      z.acceptances?.map((a) => ({
        id: a.id,
        at: a.at.toISOString(),
        qtyAccepted: a.qtyAccepted,
        passportOk: a.passportOk,
        acceptedBy: a.acceptedBy?.fullName,
      })) ?? [],
  };
}

export const serializeZayavka = serializeZayavkaImpl as (z: ZayavkaFull) => ReturnType<typeof serializeZayavkaImpl>;
