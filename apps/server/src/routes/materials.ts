/**
 * Модуль «Материалы»: один набор экранов на снабжение и завсклад,
 * роль определяет права и область (M1–M6).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseJson, prisma } from '../db.js';
import { notify } from '../notify.js';
import { resolveObjectFilter } from '../scope.js';
import { actorOf, auditChanges, emit } from '../audit.js';
import { fail } from '../http.js';
import { withETag } from '../http.js';

export async function materialRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/catalog', async (req, reply) => {
    const query = z.object({ q: z.string().optional() }).parse(req.query ?? {});
    const items = await prisma.catalogItem.findMany({ orderBy: { name: 'asc' } });
    if (!query.q) {
      return withETag(reply, req, items.map(serializeCatalogItem));
    }
    // Поиск идёт и по названию, и по накопленным формулировкам прорабов.
    const needle = query.q.trim().toLowerCase();
    return items
      .filter(
        (i) =>
          i.name.toLowerCase().includes(needle) ||
          parseJson<string[]>(i.aliases, []).some((a) => a.includes(needle) || needle.includes(a)),
      )
      .map(serializeCatalogItem);
  });

  app.get('/api/stock', async (req, reply) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});

    const scope = await resolveObjectFilter(req.currentUser.id, req.currentUser.role, query.objectId);
    if (scope.deny) {
      return reply.code(403).send({ code: 'forbidden', message: 'Объект вне вашей области' });
    }

    const balances = await prisma.stockBalance.findMany({
      where: scope.where,
      include: { catalogItem: true, object: true },
      orderBy: { catalogItem: { name: 'asc' } },
    });

    return balances.map((b) => ({
      id: b.id,
      objectId: b.objectId,
      objectName: b.object.name,
      catalogItemId: b.catalogItemId,
      name: b.catalogItem.name,
      qty: b.qty,
      unit: b.unit,
      specRemainder: b.specRemainder,
      hasPassport: b.hasPassport,
      /** Расход против норматива — перерасход виден до выдачи, а не в конце месяца. */
      overSpec: b.specRemainder !== null && b.qty > b.specRemainder,
    }));
  });

  /** Выдача под роспись. Без подписи выдачи не происходит. */
  app.post('/api/stock/issue', { preHandler: [app.requirePermission('material.issue')] }, async (req, reply) => {
    const body = z
      .object({
        objectId: z.string(),
        catalogItemId: z.string(),
        qty: z.number().positive(),
        toUserId: z.string(),
        signature: z.string().min(1),
        overspendReason: z.string().optional(),
      })
      .parse(req.body);

    const balance = await prisma.stockBalance.findUnique({
      where: { objectId_catalogItemId: { objectId: body.objectId, catalogItemId: body.catalogItemId } },
      include: { catalogItem: true },
    });
    if (!balance) {
      return reply.code(404).send({ code: 'not_found', message: 'Позиции нет на складе объекта' });
    }
    if (balance.qty < body.qty) {
      return reply
        .code(409)
        .send({ code: 'not_enough', message: `На складе ${balance.qty} ${balance.unit} — меньше запрошенного` });
    }

    // Выдача сверх норматива требует причины: иначе перерасход всплывёт без объяснения.
    const overspend = balance.specRemainder !== null && body.qty > balance.specRemainder;
    if (overspend && !body.overspendReason) {
      return reply.code(422).send({ code: 'no_reason',
        message: `Выдача больше норматива по спецификации (${balance.specRemainder} ${balance.unit}) — укажите причину`,
      });
    }

    await prisma.materialIssue.create({
      data: {
        objectId: body.objectId,
        catalogItemId: body.catalogItemId,
        qty: body.qty,
        toUserId: body.toUserId,
        signature: body.signature,
      },
    });

    await prisma.stockBalance.update({
      where: { id: balance.id },
      data: { qty: { decrement: body.qty } },
    });

    // Изменение остатка — в журнал: критерий приёмки 11 требует прежнее и новое значение.
    const issuer = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    await auditChanges(
      actorOf(req.currentUser, issuer.fullName),
      'stockBalance',
      balance.id,
      { qty: Number(balance.qty) },
      { qty: Number(balance.qty) - body.qty },
      body.overspendReason,
    );
    await emit('MaterialIssued', 'stockBalance', balance.id, {
      catalogItemId: body.catalogItemId,
      qty: body.qty,
      toUserId: body.toUserId,
      overspend,
    });

    if (overspend) {
      const pct = balance.specRemainder
        ? Math.round(((body.qty - balance.specRemainder) / balance.specRemainder) * 100)
        : 0;
      await emit('OverspendDetected', 'stockBalance', balance.id, {
        pct,
        material: balance.catalogItem.name,
        reason: body.overspendReason,
      });
    }

    return { ok: true, overspend };
  });

  /**
   * Коррекция остатка по инвентаризации.
   *
   * Остатки ведутся в этой системе, а не в 1С, значит расхождение с
   * реальным складом исправлять некому, кроме завсклада. Без такой ручки
   * ошибка приёмки или выдачи остаётся в числе навсегда, и через месяц
   * остаткам перестают верить — а тогда и заявки перестают опираться
   * на них.
   *
   * Причина обязательна и попадает в журнал вместе с прежним и новым
   * значением: правка остатка задним числом должна быть объяснима, иначе
   * она ничем не отличается от подгонки под факт.
   */
  app.post(
    '/api/stock/adjust',
    { preHandler: [app.requirePermission('material.adjust')] },
    async (req, reply) => {
      const body = z
        .object({
          objectId: z.string(),
          catalogItemId: z.string(),
          /** Пересчитанное количество, а не поправка: так считают на складе. */
          qty: z.number().min(0),
          reason: z.string().trim().min(5),
          hasPassport: z.boolean().optional(),
        })
        .parse(req.body);

      const balance = await prisma.stockBalance.findUnique({
        where: {
          objectId_catalogItemId: { objectId: body.objectId, catalogItemId: body.catalogItemId },
        },
        include: { catalogItem: true },
      });
      if (!balance) {
        return fail(reply, 404, 'not_found', 'Позиции нет на складе объекта');
      }

      const before = Number(balance.qty);
      if (before === body.qty && body.hasPassport === undefined) {
        return fail(reply, 422, 'no_change', 'Количество не изменилось — коррекция не нужна');
      }

      await prisma.stockBalance.update({
        where: { id: balance.id },
        data: {
          qty: body.qty,
          ...(body.hasPassport === undefined ? {} : { hasPassport: body.hasPassport }),
        },
      });

      const actor = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
      await auditChanges(
        actorOf(req.currentUser, actor.fullName),
        'stockBalance',
        balance.id,
        { qty: before, hasPassport: balance.hasPassport },
        { qty: body.qty, hasPassport: body.hasPassport ?? balance.hasPassport },
        body.reason,
      );

      // Событие отдельное от выдачи: расход и пересчёт — разные причины
      // изменения остатка, и в отчётах их нельзя складывать.
      await emit('StockAdjusted', 'stockBalance', balance.id, {
        catalogItemId: body.catalogItemId,
        material: balance.catalogItem.name,
        before,
        after: body.qty,
        delta: Number((body.qty - before).toFixed(3)),
        reason: body.reason,
      });

      return { ok: true, before, after: body.qty };
    },
  );

  app.get('/api/issues', async (req) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});
    const issues = await prisma.materialIssue.findMany({
      where: query.objectId ? { objectId: query.objectId } : {},
      include: { catalogItem: true, toUser: true },
      orderBy: { at: 'desc' },
      take: 50,
    });
    return issues.map((i) => ({
      id: i.id,
      at: i.at.toISOString(),
      name: i.catalogItem.name,
      qty: i.qty,
      unit: i.catalogItem.unit,
      to: i.toUser.fullName,
      signature: i.signature,
    }));
  });
}

function serializeCatalogItem(item: { id: string; name: string; unit: string; aliases: string }) {
  return {
    id: item.id,
    name: item.name,
    unit: item.unit,
    aliases: parseJson<string[]>(item.aliases, []),
  };
}
