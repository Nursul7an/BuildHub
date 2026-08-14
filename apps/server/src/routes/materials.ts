/**
 * Модуль «Материалы»: один набор экранов на снабжение и завсклад,
 * роль определяет права и область (M1–M6).
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { parseJson, prisma } from '../db.js';
import { notify } from '../notify.js';

export async function materialRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/catalog', async (req) => {
    const query = z.object({ q: z.string().optional() }).parse(req.query ?? {});
    const items = await prisma.catalogItem.findMany({ orderBy: { name: 'asc' } });
    if (!query.q) {
      return items.map(serializeCatalogItem);
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

  app.get('/api/stock', async (req) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const objectId = query.objectId ?? me.objectId ?? undefined;

    const balances = await prisma.stockBalance.findMany({
      where: objectId ? { objectId } : {},
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
      return reply.code(404).send({ error: 'not_found', message: 'Позиции нет на складе объекта' });
    }
    if (balance.qty < body.qty) {
      return reply
        .code(409)
        .send({ error: 'not_enough', message: `На складе ${balance.qty} ${balance.unit} — меньше запрошенного` });
    }

    // Выдача сверх норматива требует причины: иначе перерасход всплывёт без объяснения.
    const overspend = balance.specRemainder !== null && body.qty > balance.specRemainder;
    if (overspend && !body.overspendReason) {
      return reply.code(422).send({
        error: 'no_reason',
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

    if (overspend) {
      const pct = balance.specRemainder
        ? Math.round(((body.qty - balance.specRemainder) / balance.specRemainder) * 100)
        : 0;
      await notify(
        'gi',
        'zayavka',
        `🟠 Перерасход по ВОР +${pct}%`,
        `${balance.catalogItem.name} · выдано ${body.qty} ${balance.unit} при нормативе ${balance.specRemainder} · причина: ${body.overspendReason}`,
      );
    }

    return { ok: true, overspend };
  });

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
