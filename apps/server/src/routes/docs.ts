/**
 * Проект (PR1–PR6) и Документы (DC1–DC5).
 *
 * Прораб здесь потребитель, а не архивариус: главное — понять, актуален ли лист,
 * и не закрыть работу, которую держит документ.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { notify } from '../notify.js';

export async function docRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Марки комплектов, сгруппированные по стадии — стадии разделяются обязательно. */
  app.get('/api/project/sets', async (req) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const objectId = query.objectId ?? me.objectId ?? undefined;

    const sets = await prisma.drawingSet.findMany({
      where: objectId ? { objectId } : {},
      include: { sheets: { orderBy: { number: 'asc' } } },
      orderBy: [{ stage: 'asc' }, { mark: 'asc' }],
    });

    return sets.map((s) => ({
      id: s.id,
      stage: s.stage,
      mark: s.mark,
      name: s.name,
      revision: s.revision,
      issuedAt: s.issuedAt.toISOString(),
      sheetCount: s.sheets.length,
      /** Сколько листов заменено — на это прораб смотрит в первую очередь. */
      supersededCount: s.sheets.filter((x) => !x.isCurrent).length,
      sheets: s.sheets.map(serializeSheet),
    }));
  });

  /** Действующие листы: только актуальные ревизии, по всем комплектам. */
  app.get('/api/project/current-sheets', async (req) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const objectId = query.objectId ?? me.objectId ?? undefined;

    const sheets = await prisma.drawingSheet.findMany({
      where: { isCurrent: true, ...(objectId ? { set: { objectId } } : {}) },
      include: { set: true },
      orderBy: [{ set: { mark: 'asc' } }, { number: 'asc' }],
    });

    return sheets.map((s) => ({ ...serializeSheet(s), mark: s.set.mark, stage: s.set.stage }));
  });

  app.get('/api/project/sheets/:id', async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const sheet = await prisma.drawingSheet.findUnique({
      where: { id },
      include: { set: true, rfis: true },
    });
    if (!sheet) return reply.code(404).send({ code: 'not_found', message: 'Лист не найден' });

    // Если лист заменён — показываем, чем именно, чтобы не работали по старому.
    const replacement = sheet.supersededBy
      ? await prisma.drawingSheet.findFirst({
          where: { setId: sheet.setId, number: sheet.supersededBy },
        })
      : null;

    return {
      ...serializeSheet(sheet),
      mark: sheet.set.mark,
      stage: sheet.set.stage,
      replacement: replacement ? serializeSheet(replacement) : null,
      rfis: sheet.rfis.map((r) => ({ id: r.id, number: r.number, status: r.status })),
    };
  });

  /** Запрос проектировщику. */
  app.post('/api/rfi', async (req) => {
    const body = z
      .object({
        objectId: z.string(),
        sheetId: z.string().optional(),
        question: z.string().min(1),
        dueAt: z.string().optional(),
      })
      .parse(req.body);

    const count = await prisma.rfi.count({ where: { objectId: body.objectId } });
    const rfi = await prisma.rfi.create({
      data: {
        number: `RFI-${String(count + 1).padStart(3, '0')}`,
        objectId: body.objectId,
        authorId: req.currentUser.id,
        sheetId: body.sheetId,
        question: body.question,
        dueAt: body.dueAt ? new Date(body.dueAt) : null,
      },
    });

    await notify('pto', 'rfi', `📐 ${rfi.number} · запрос проектировщику`, body.question.slice(0, 120));

    return { id: rfi.id, number: rfi.number };
  });

  app.get('/api/rfi', async (req) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});
    const rfis = await prisma.rfi.findMany({
      where: query.objectId ? { objectId: query.objectId } : {},
      include: { author: true, sheet: true },
      orderBy: { createdAt: 'desc' },
    });
    return rfis.map((r) => ({
      id: r.id,
      number: r.number,
      question: r.question,
      answer: r.answer,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
      dueAt: r.dueAt?.toISOString() ?? null,
      author: r.author.fullName,
      sheet: r.sheet ? `${r.sheet.number} · ${r.sheet.name}` : null,
      /** Просрочен ответ — это состояние строки, не текст. */
      overdue: r.status === 'open' && r.dueAt !== null && r.dueAt.getTime() < Date.now(),
    }));
  });

  app.post('/api/rfi/:id/answer', async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ answer: z.string().min(1) }).parse(req.body);
    const rfi = await prisma.rfi.update({
      where: { id },
      data: { answer: body.answer, answeredAt: new Date(), status: 'answered' },
    });
    await notify('prorab', 'rfi', `📐 Ответ на ${rfi.number}`, body.answer.slice(0, 120), undefined, rfi.authorId);
    return { ok: true };
  });

  /** Документы объекта и мои акты. */
  app.get('/api/documents', async (req) => {
    const query = z
      .object({ objectId: z.string().optional(), kind: z.string().optional() })
      .parse(req.query ?? {});
    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const objectId = query.objectId ?? me.objectId ?? undefined;

    const docs = await prisma.siteDocument.findMany({
      where: { ...(objectId ? { objectId } : {}), ...(query.kind ? { kind: query.kind } : {}) },
      include: { processState: { include: { processDef: true, block: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return docs.map((d) => ({
      id: d.id,
      kind: d.kind,
      number: d.number,
      name: d.name,
      status: d.status,
      createdAt: d.createdAt.toISOString(),
      signedAt: d.signedAt?.toISOString() ?? null,
      process: d.processState
        ? `${d.processState.processDef.name} · ${d.processState.block.name} · ${d.processState.floor} эт.`
        : null,
    }));
  });

  /** Черновик АОСР с автозаполнением из процесса. */
  app.post('/api/documents/aosr-draft', { preHandler: [app.requirePermission('aosr.draft')] }, async (req, reply) => {
    const body = z.object({ processStateId: z.string() }).parse(req.body);

    const state = await prisma.processState.findUnique({
      where: { id: body.processStateId },
      include: { processDef: { include: { section: true } }, block: true, object: true },
    });
    if (!state) return reply.code(404).send({ code: 'not_found', message: 'Процесс не найден' });
    if (!state.processDef.requiresAosr) {
      return reply.code(409).send({ code: 'no_aosr', message: 'Этот процесс не требует АОСР' });
    }

    const count = await prisma.siteDocument.count({ where: { objectId: state.objectId, kind: 'aosr' } });
    const doc = await prisma.siteDocument.create({
      data: {
        objectId: state.objectId,
        kind: 'aosr',
        number: `АОСР-${count + 1}`,
        name: `${state.processDef.name} · ${state.block.name} · ${state.floor} эт.`,
        status: 'draft',
        processStateId: state.id,
      },
    });

    return { id: doc.id, number: doc.number, name: doc.name };
  });

  app.post('/api/documents/:id/sign', { preHandler: [app.requirePermission('aosr.draft')] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const doc = await prisma.siteDocument.update({
      where: { id },
      data: { status: 'signed', signedAt: new Date() },
    });
    await notify('prorab', 'document', `✅ ${doc.number} подписан`, doc.name);
    return { ok: true };
  });

  /** Протоколы прочности — шлюз распалубки. */
  app.get('/api/strength-protocols', async (req) => {
    const query = z.object({ objectId: z.string().optional() }).parse(req.query ?? {});
    const protocols = await prisma.concreteStrengthProtocol.findMany({
      where: query.objectId ? { objectId: query.objectId } : {},
      include: { processState: { include: { processDef: true, block: true } } },
      orderBy: { sampleAt: 'desc' },
    });
    return protocols.map((p) => ({
      id: p.id,
      pouredAt: p.pouredAt.toISOString(),
      sampleAt: p.sampleAt.toISOString(),
      strengthPct: p.strengthPct,
      requiredPct: p.requiredPct,
      labName: p.labName,
      status: p.status,
      process: `${p.processState.processDef.name} · ${p.processState.block.name} · ${p.processState.floor} эт.`,
      /** Пока не набрана — распалубка держится. */
      blocksStripping: p.status !== 'passed',
    }));
  });

  app.post('/api/strength-protocols/:id', { preHandler: [app.requirePermission('aosr.draft')] }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ strengthPct: z.number() }).parse(req.body);

    const protocol = await prisma.concreteStrengthProtocol.findUniqueOrThrow({ where: { id } });
    const status = body.strengthPct >= protocol.requiredPct ? 'passed' : 'failed';

    await prisma.concreteStrengthProtocol.update({
      where: { id },
      data: { strengthPct: body.strengthPct, status },
    });

    if (status === 'passed') {
      // Шлюз открылся — снимаем блокировку с распалубки на этом этаже.
      const state = await prisma.processState.findUnique({
        where: { id: protocol.processStateId },
        include: { processDef: true },
      });
      if (state) {
        await prisma.processState.updateMany({
          where: {
            objectId: state.objectId,
            blockId: state.blockId,
            floor: state.floor,
            status: 'blocked',
            blockedReason: { contains: 'протокол прочности' },
          },
          data: { status: 'idle', blockedReason: null },
        });
      }
      await notify('prorab', 'document', '✅ Протокол прочности получен', 'Распалубка разблокирована');
    }

    return { status };
  });
}

function serializeSheet(sheet: {
  id: string;
  number: string;
  name: string;
  revision: string;
  isCurrent: boolean;
  supersededBy: string | null;
  changedAt: Date | null;
  changeSummary: string | null;
  fileUrl: string | null;
}) {
  return {
    id: sheet.id,
    number: sheet.number,
    name: sheet.name,
    revision: sheet.revision,
    isCurrent: sheet.isCurrent,
    supersededBy: sheet.supersededBy,
    changedAt: sheet.changedAt?.toISOString() ?? null,
    changeSummary: sheet.changeSummary,
    fileUrl: sheet.fileUrl,
  };
}
