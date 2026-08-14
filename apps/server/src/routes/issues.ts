/**
 * Постановка вопроса на решение. ТЗ §2.
 *
 * Клиент не выбирает адресата — он говорит, какого вопрос рода и сколько
 * стоит, а кому нести, решает таблица маршрутизации. Поэтому здесь нет
 * ни одной строчки вида «если охрана труда, то главному инженеру».
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { fail } from '../http.js';
import { actorOf, audit, emit } from '../audit.js';
import {
  ISSUE_KINDS,
  ISSUE_KIND_LABEL,
  type IssueKind,
  listRouting,
  routeIssue,
  upsertRouting,
} from '../services/issue-routing.js';
import type { Role } from '@build-hub/shared';

export async function issueRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Кто решает по такому вопросу — клиент спрашивает до отправки. */
  app.get('/api/v1/issues/route', async (req) => {
    const query = z
      .object({
        issueKind: z.enum(ISSUE_KINDS),
        facilityId: z.string().optional(),
        amount: z.coerce.number().optional(),
      })
      .parse(req.query);

    const decision = await routeIssue({
      issueKind: query.issueKind,
      facilityId: query.facilityId,
      amount: query.amount,
    });

    const person = await prisma.user.findFirst({
      where: { role: decision.toRole, active: true },
      select: { id: true, fullName: true },
    });

    return {
      ...decision,
      label: ISSUE_KIND_LABEL[query.issueKind],
      /** Имя показываем для понятности, но адресат — роль, а не человек. */
      assignee: person ? { id: person.id, fullName: person.fullName } : null,
    };
  });

  /**
   * Поставить вопрос. Задача заводится на роль, которую назвала таблица;
   * если сработал порог, в тексте видно, что вопрос ушёл выше и почему.
   */
  app.post('/api/v1/issues', async (req, reply) => {
    const body = z
      .object({
        issueKind: z.enum(ISSUE_KINDS),
        facilityId: z.string(),
        title: z.string().min(1),
        detail: z.string().optional(),
        /** Цена вопроса: по ней срабатывает порог эскалации. */
        amount: z.number().nonnegative().optional(),
        dueDate: z.string().optional(),
      })
      .parse(req.body);

    const object = await prisma.constructionObject.findUnique({ where: { id: body.facilityId } });
    if (!object) return fail(reply, 404, 'not_found', 'Объект не найден');

    const decision = await routeIssue({
      issueKind: body.issueKind,
      facilityId: body.facilityId,
      amount: body.amount ?? null,
    });

    const assignee = await prisma.user.findFirst({
      where: { role: decision.toRole, active: true },
      orderBy: { createdAt: 'asc' },
    });

    const due = body.dueDate ? new Date(body.dueDate) : new Date(Date.now() + 2 * 86_400_000);

    const task = decision.createsTask
      ? await prisma.task.create({
          data: {
            text: body.title,
            objectId: body.facilityId,
            assigneeId: assignee?.id ?? null,
            authorId: req.currentUser.id,
            dueDate: due,
            origin: 'inbox',
            sourceRef: `issue:${body.issueKind}`,
          },
        })
      : null;

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });

    await emit('IssueRaised', 'issue', task?.id ?? body.facilityId, {
      // Адресат уже вычислен — маршрутизация уведомлений его не пересматривает.
      toRole: decision.toRole,
      issueKind: body.issueKind,
      title: body.title,
      detail: body.detail,
      amount: body.amount ?? null,
      escalated: decision.escalated,
      facilityName: object.name,
      authorId: assignee?.id ?? null,
      taskId: task?.id ?? null,
    });

    await audit(actorOf(req.currentUser, me.fullName), {
      entity: 'issue',
      entityId: task?.id ?? body.facilityId,
      action: 'create',
      field: 'toRole',
      newValue: decision.toRole,
      reason: decision.escalated
        ? `выше порога ${decision.escalateAbove}: с ${decision.wouldBeRole} на ${decision.toRole}`
        : (decision.source ?? undefined),
    });

    return reply.code(201).send({
      taskId: task?.id ?? null,
      routedTo: decision.toRole,
      escalated: decision.escalated,
      escalateAbove: decision.escalateAbove,
      origin: decision.origin,
      assignee: assignee ? { id: assignee.id, fullName: assignee.fullName } : null,
    });
  });

  /** Таблица маршрутов целиком — её же читает экран настройки. */
  app.get('/api/v1/issues/routing', async () => listRouting());

  /**
   * Изменение маршрута. Ведёт руководитель: это вопрос оргструктуры,
   * а не техники, и меняется он без выкатки новой версии (ТЗ §9).
   */
  app.put('/api/v1/issues/routing', { preHandler: [app.requirePermission('limits.manage')] }, async (req, reply) => {
    const body = z
      .object({
        issueKind: z.enum(ISSUE_KINDS),
        scopeType: z.enum(['company', 'facility']),
        scopeId: z.string().nullable().optional(),
        toRole: z.string(),
        createsTask: z.boolean().optional(),
        escalateAbove: z.number().nullable().optional(),
        escalateToRole: z.string().nullable().optional(),
        source: z.string().optional(),
      })
      .parse(req.body);

    if (body.scopeType === 'facility' && !body.scopeId) {
      return fail(reply, 422, 'scope_required', 'Для правила по объекту нужен идентификатор объекта');
    }
    if (body.escalateAbove !== null && body.escalateAbove !== undefined && !body.escalateToRole) {
      return fail(reply, 422, 'escalate_role_required', 'Укажите, кому вопрос уходит выше порога');
    }

    const previous = await routeIssue({
      issueKind: body.issueKind as IssueKind,
      facilityId: body.scopeId,
    });

    const saved = await upsertRouting({
      issueKind: body.issueKind as IssueKind,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      toRole: body.toRole as Role,
      createsTask: body.createsTask,
      escalateAbove: body.escalateAbove,
      escalateToRole: body.escalateToRole as Role | null,
      source: body.source,
    });

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    await audit(actorOf(req.currentUser, me.fullName), {
      entity: 'issueRouting',
      entityId: saved.id,
      action: 'update',
      field: body.issueKind,
      oldValue: previous.toRole,
      newValue: body.toRole,
      reason: body.source,
    });

    return { id: saved.id, issueKind: saved.issueKind, toRole: saved.toRole };
  });
}
