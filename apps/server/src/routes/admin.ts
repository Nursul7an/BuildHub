/**
 * Админка: ПТО и главный инженер заводят пользователей (ADM1–ADM3).
 * Пароль показывается ровно один раз — повторно его посмотреть нельзя, только сбросить.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '../db.js';
import { generatePassword, publicUser } from '../auth.js';
import { ROLES } from '@build-hub/shared';
import { notify } from '../notify.js';

export async function adminRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/users', async (req) => {
    const query = z.object({ objectId: z.string().optional(), role: z.string().optional() }).parse(req.query ?? {});
    const users = await prisma.user.findMany({
      where: {
        ...(query.objectId ? { objectId: query.objectId } : {}),
        ...(query.role ? { role: query.role } : {}),
      },
      include: { object: true, block: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
    return users.map((u) => ({
      ...publicUser(u),
      objectName: u.object?.name ?? null,
      blockName: u.block?.name ?? null,
    }));
  });

  app.post('/api/users', { preHandler: [app.requirePermission('users.manage')] }, async (req, reply) => {
    const body = z
      .object({
        fullName: z.string().min(1),
        phone: z.string().min(1),
        role: z.enum(ROLES),
        objectId: z.string().optional(),
        blockId: z.string().optional(),
        scopeLabel: z.string().optional(),
      })
      .parse(req.body);

    // Логин из фамилии и инициала: i.familia.
    const parts = body.fullName.trim().split(/\s+/);
    const base = translit(`${(parts[1] ?? parts[0] ?? 'user')[0]}.${parts[0]}`).toLowerCase();
    let login = base;
    let n = 1;
    while (await prisma.user.findUnique({ where: { login } })) {
      n += 1;
      login = `${base}${n}`;
    }

    const temporaryPassword = generatePassword();
    const user = await prisma.user.create({
      data: {
        fullName: body.fullName,
        login,
        phone: body.phone,
        role: body.role,
        objectId: body.objectId,
        blockId: body.blockId,
        scopeLabel: body.scopeLabel,
        passwordHash: await bcrypt.hash(temporaryPassword, 10),
        mustChangePassword: true,
      },
    });

    return reply.code(201).send({
      user: publicUser(user),
      // Показывается ровно один раз — дальше только сброс.
      temporaryPassword,
    });
  });

  app.post('/api/users/:id/reset-password', { preHandler: [app.requirePermission('users.manage')] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const temporaryPassword = generatePassword();
    await prisma.user.update({
      where: { id },
      data: { passwordHash: await bcrypt.hash(temporaryPassword, 10), mustChangePassword: true },
    });
    return { temporaryPassword };
  });

  app.patch('/api/users/:id', { preHandler: [app.requirePermission('users.manage')] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z
      .object({
        fullName: z.string().optional(),
        phone: z.string().optional(),
        role: z.enum(ROLES).optional(),
        objectId: z.string().nullable().optional(),
        blockId: z.string().nullable().optional(),
        scopeLabel: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(req.body);

    const user = await prisma.user.update({ where: { id }, data: body });
    return publicUser(user);
  });

  /** Назначение работ и сроков прорабу: объект → блок → этаж → раздел → кому → срок. */
  app.post('/api/admin/assign-work', { preHandler: [app.requirePermission('tasks.assign')] }, async (req, reply) => {
    const body = z
      .object({
        objectId: z.string(),
        blockId: z.string(),
        floor: z.number().int(),
        sectionId: z.string(),
        assigneeId: z.string(),
        dueDate: z.string(),
      })
      .parse(req.body);

    const [section, block, assignee] = await Promise.all([
      prisma.sectionDef.findUnique({ where: { id: body.sectionId }, include: { processes: true } }),
      prisma.block.findUnique({ where: { id: body.blockId } }),
      prisma.user.findUnique({ where: { id: body.assigneeId } }),
    ]);
    if (!section || !block || !assignee) {
      return reply.code(404).send({ error: 'not_found', message: 'Проверьте объект, блок и исполнителя' });
    }

    // Цепочка процессов заводится по справочнику раздела — её состав задаёт ПТО по ППР.
    for (const def of section.processes) {
      await prisma.processState.upsert({
        where: { processDefId_blockId_floor: { processDefId: def.id, blockId: body.blockId, floor: body.floor } },
        create: {
          processDefId: def.id,
          objectId: body.objectId,
          blockId: body.blockId,
          floor: body.floor,
          assigneeUserId: body.assigneeId,
          dueDate: new Date(body.dueDate),
        },
        update: { assigneeUserId: body.assigneeId, dueDate: new Date(body.dueDate) },
      });
    }

    await prisma.task.create({
      data: {
        text: `${section.name} · ${block.name} · ${body.floor} эт.`,
        objectId: body.objectId,
        blockId: body.blockId,
        floor: body.floor,
        sectionId: body.sectionId,
        assigneeId: body.assigneeId,
        authorId: req.currentUser.id,
        dueDate: new Date(body.dueDate),
        origin: 'schedule',
      },
    });

    await notify(
      assignee.role as never,
      'task',
      '🗓 Новая работа назначена',
      `${section.name} · ${block.name} · ${body.floor} эт. · срок ${new Date(body.dueDate).toLocaleDateString('ru-RU')}`,
      undefined,
      body.assigneeId,
    );

    return { ok: true, processesCreated: section.processes.length };
  });

  /** Настройка цепочки процессов раздела — только ПТО. */
  app.post('/api/admin/chain/:sectionId', { preHandler: [app.requirePermission('process.chainEdit')] }, async (req) => {
    const { sectionId } = z.object({ sectionId: z.string() }).parse(req.params);
    const body = z
      .object({
        rows: z.array(
          z.object({
            id: z.string().optional(),
            name: z.string().min(1),
            unit: z.string(),
            requiresAosr: z.boolean(),
            subcycle: z.string().nullable().optional(),
          }),
        ),
      })
      .parse(req.body);

    const existing = await prisma.processDef.findMany({ where: { sectionId } });
    const keepIds = new Set(body.rows.map((r) => r.id).filter(Boolean) as string[]);

    // Удаляем только те процессы, по которым ещё нет фактических данных.
    for (const def of existing) {
      if (keepIds.has(def.id)) continue;
      const used = await prisma.processState.count({ where: { processDefId: def.id, doneQty: { gt: 0 } } });
      if (used === 0) await prisma.processDef.deleteMany({ where: { id: def.id } });
    }

    // Порядок переписываем в два прохода: уникальный индекс (sectionId, order).
    for (const [i, row] of body.rows.entries()) {
      if (!row.id) continue;
      await prisma.processDef.update({ where: { id: row.id }, data: { order: -(i + 1) } });
    }
    for (const [i, row] of body.rows.entries()) {
      if (row.id) {
        await prisma.processDef.update({
          where: { id: row.id },
          data: {
            order: i + 1,
            name: row.name,
            unit: row.unit,
            requiresAosr: row.requiresAosr,
            subcycle: row.subcycle ?? null,
          },
        });
      } else {
        await prisma.processDef.create({
          data: {
            sectionId,
            order: i + 1,
            name: row.name,
            unit: row.unit,
            requiresAosr: row.requiresAosr,
            subcycle: row.subcycle ?? null,
          },
        });
      }
    }

    return { ok: true };
  });
}

const TRANSLIT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'i',
  к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f',
  х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

function translit(value: string): string {
  return value
    .toLowerCase()
    .split('')
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9.]/g, '');
}
