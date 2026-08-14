/**
 * Наполнение базы данными прототипа.
 *
 * Сценарий, который должен воспроизводиться после сева, описан в прототипе:
 * прораб Азамат видит «Горит» → армирование колонн просрочено 2 дня → заявка ЗВ-0184
 * висит у снабжения 2 дня → 24 человека стоят с 17:20 → это же попадает в ленту
 * проблем руководства с ценой. Все звенья должны существовать в базе, а не рисоваться.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import {
  ACTIVE_WORK,
  AUTONOMY_LIMITS,
  CATALOG,
  CONTRACTORS,
  COST_ARTICLES,
  DOCUMENTS,
  DRAWING_SETS,
  FINANCE,
  FRONT_CHECKLIST,
  INCIDENTS,
  MACHINES,
  OBJECTS,
  PAYMENTS,
  RFIS,
  SECTIONS,
  STOCK,
  STRENGTH_PROTOCOLS,
  TASKS,
  USERS,
  ZAYAVKI,
} from './fixtures.js';

const prisma = new PrismaClient();

/** Пароль по умолчанию для демо-входа. В проде выдаётся одноразовый и меняется при первом входе. */
const DEMO_PASSWORD = 'buildhub2026';

/**
 * Прототип разыгрывает сценарий на понедельник 4 августа: армирование просрочено
 * на 2 дня, заявка висит у снабжения 2 дня, отчёт за 3 августа возвращён.
 * Чтобы сценарий читался в тот день, когда базу засеяли, все даты сдвигаются так,
 * что 4 августа приходится на сегодня.
 */
const SCENARIO_TODAY = new Date('2026-08-04T00:00:00');
const SHIFT_MS = (() => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today.getTime() - SCENARIO_TODAY.getTime();
})();

/** Дата из фикстуры, сдвинутая в текущую неделю. */
function d(iso: string): Date {
  return new Date(new Date(iso).getTime() + SHIFT_MS);
}

async function reset() {
  // Порядок важен: сначала зависимые записи.
  await prisma.$transaction([
    prisma.notification.deleteMany(),
    prisma.incident.deleteMany(),
    prisma.task.deleteMany(),
    prisma.autonomyLimit.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.costArticle.deleteMany(),
    prisma.objectFinance.deleteMany(),
    prisma.concreteStrengthProtocol.deleteMany(),
    prisma.siteDocument.deleteMany(),
    prisma.rfi.deleteMany(),
    prisma.drawingSheet.deleteMany(),
    prisma.drawingSet.deleteMany(),
    prisma.contractorRating.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.contractor.deleteMany(),
    prisma.materialIssue.deleteMany(),
    prisma.materialAcceptance.deleteMany(),
    prisma.stockBalance.deleteMany(),
    prisma.techReport.deleteMany(),
    prisma.techRequest.deleteMany(),
    prisma.machine.deleteMany(),
    prisma.zayavkaEvent.deleteMany(),
    prisma.zayavkaItem.deleteMany(),
    prisma.zayavka.deleteMany(),
    prisma.catalogItem.deleteMany(),
    prisma.reportPhoto.deleteMany(),
    prisma.reportCheck.deleteMany(),
    prisma.reportEntry.deleteMany(),
    prisma.dailyReport.deleteMany(),
    prisma.presentation.deleteMany(),
    prisma.processComment.deleteMany(),
    prisma.processState.deleteMany(),
    prisma.processDef.deleteMany(),
    prisma.sectionDef.deleteMany(),
    prisma.block.deleteMany(),
    prisma.user.deleteMany(),
    prisma.constructionObject.deleteMany(),
  ]);
}

async function main() {
  await reset();

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  /* ── Объекты и блоки ── */
  const objectIds = new Map<string, string>();
  const blockIds = new Map<string, string>(); // `${objectKey}:${blockName}`

  for (const o of OBJECTS) {
    const created = await prisma.constructionObject.create({
      data: {
        code: o.code,
        name: o.name,
        address: o.address,
        city: o.city,
        floorsTotal: o.floorsTotal,
        dueDate: d(o.dueDate),
        status: 'active',
        pctPlan: o.pctPlan,
        pctFact: o.pctFact,
        deltaDays: o.deltaDays,
        blocks: { create: o.blocks.map((b) => ({ name: b.name, floors: b.floors })) },
      },
      include: { blocks: true },
    });
    objectIds.set(o.id, created.id);
    for (const b of created.blocks) blockIds.set(`${o.id}:${b.name}`, b.id);
  }

  /* ── Люди ── */
  const userIds = new Map<string, string>();
  for (const u of USERS) {
    const created = await prisma.user.create({
      data: {
        fullName: u.fullName,
        login: u.login,
        phone: u.phone,
        role: u.role,
        passwordHash,
        // Демо-учётки уже «прожили» первый вход.
        mustChangePassword: false,
        objectId: 'objectId' in u && u.objectId ? objectIds.get(u.objectId) : null,
        blockId:
          'blockName' in u && u.blockName && 'objectId' in u && u.objectId
            ? blockIds.get(`${u.objectId}:${u.blockName}`)
            : null,
        scopeLabel: 'scopeLabel' in u ? u.scopeLabel : null,
      },
    });
    userIds.set(u.login, created.id);
  }

  // Ответственные за объекты.
  await prisma.constructionObject.update({
    where: { id: objectIds.get('ak')! },
    data: { responsibleUserId: userIds.get('a.zhumabekov')! },
  });
  await prisma.constructionObject.update({
    where: { id: objectIds.get('jal')! },
    data: { responsibleUserId: userIds.get('e.kasymov')! },
  });
  await prisma.constructionObject.update({
    where: { id: objectIds.get('bc')! },
    data: { responsibleUserId: userIds.get('b.usenov')! },
  });

  /* ── Разделы и цепочки процессов ── */
  const processDefIds = new Map<string, string>(); // `${sectionId}:${order}`
  for (const s of SECTIONS) {
    await prisma.sectionDef.create({
      data: {
        id: s.id,
        name: s.name,
        entryCondition: s.entryCondition ?? null,
        blockReason: s.blockReason ?? null,
        sortOrder: s.sortOrder,
      },
    });
    for (const [i, row] of s.rows.entries()) {
      const def = await prisma.processDef.create({
        data: {
          sectionId: s.id,
          order: i + 1,
          name: row.name,
          unit: row.unit,
          requiresAosr: row.aosr,
          subcycle: row.subcycle ?? null,
          critical: row.critical ?? false,
        },
      });
      processDefIds.set(`${s.id}:${i + 1}`, def.id);
    }
  }

  /* ── Состояния процессов на Ак-Орго, Блок Б, 7 этаж (цепочка монолита) ──
     Это та самая цепочка, которую прораб открывает с экрана «Работы». */
  const ak = objectIds.get('ak')!;
  const akB = blockIds.get('ak:Блок Б')!;
  const akA = blockIds.get('ak:Блок А')!;
  const azamat = userIds.get('a.zhumabekov')!;

  const monoStates = new Map<number, string>();
  for (const [i, row] of SECTIONS[0]!.rows.entries()) {
    const order = i + 1;
    // Статусы 7 этажа берём из прототипа: 1 принят, 2 в работе и просрочен,
    // 3 заблокирован отсутствием АОСР на второй, остальные не начаты.
    let status: string = 'idle';
    let blockedReason: string | null = null;
    let planQty = 0;
    let doneQty = 0;
    let aosrNumber: string | null = null;
    let acceptedAt: Date | null = null;
    let dueDate: Date | null = null;

    if (order === 1) {
      status = 'accepted';
      aosrNumber = 'акт №14';
      acceptedAt = d('2026-08-02');
    } else if (order === 2) {
      status = 'active';
      planQty = 7.1;
      doneQty = 4.83;
      dueDate = d('2026-08-02');
    } else if (order === 3) {
      status = 'blocked';
      blockedReason = 'заблокирован — нет АОСР на «Армирование колонн»';
      planQty = 320;
    } else if (row.unit !== '—') {
      planQty = 100;
    }

    const st = await prisma.processState.create({
      data: {
        processDefId: processDefIds.get(`mono:${order}`)!,
        objectId: ak,
        blockId: akB,
        floor: 7,
        status,
        planQty,
        doneQty,
        blockedReason,
        dueDate,
        aosrNumber,
        acceptedAt,
        assigneeUserId: azamat,
      },
    });
    monoStates.set(order, st.id);
  }

  /* ── Ещё две активные работы прораба: кладка на Блоке А, 5 эт. и опалубка на 6 эт. ── */
  const kladOrder = SECTIONS[1]!.rows.findIndex((r) => r.name === 'Кладка яруса 2') + 1;
  const kladState = await prisma.processState.create({
    data: {
      processDefId: processDefIds.get(`klad:${kladOrder}`)!,
      objectId: ak,
      blockId: akA,
      floor: 5,
      status: 'active',
      planQty: 24000,
      doneQty: 6000,
      dueDate: d('2026-08-05'),
      assigneeUserId: azamat,
    },
  });

  const opalOrder = SECTIONS[0]!.rows.findIndex((r) => r.name === 'Монтаж опалубки перекрытия') + 1;
  const opalState = await prisma.processState.create({
    data: {
      processDefId: processDefIds.get(`mono:${opalOrder}`)!,
      objectId: ak,
      blockId: akB,
      floor: 6,
      status: 'active',
      planQty: 480,
      doneQty: 192,
      dueDate: d('2026-08-08'),
      assigneeUserId: azamat,
    },
  });

  // Бетонирование 6 этажа — под него заведён протокол прочности (шлюз распалубки).
  const betonOrder = SECTIONS[0]!.rows.findIndex((r) => r.name === 'Бетонирование колонн и стен') + 1;
  const betonState = await prisma.processState.create({
    data: {
      processDefId: processDefIds.get(`mono:${betonOrder}`)!,
      objectId: ak,
      blockId: akB,
      floor: 6,
      status: 'accepted',
      planQty: 96,
      doneQty: 96,
      acceptedAt: d('2026-07-30'),
      assigneeUserId: azamat,
    },
  });

  const raspOrder = SECTIONS[0]!.rows.findIndex((r) => r.name === 'Распалубка колонн') + 1;
  await prisma.processState.create({
    data: {
      processDefId: processDefIds.get(`mono:${raspOrder}`)!,
      objectId: ak,
      blockId: akB,
      floor: 6,
      status: 'blocked',
      planQty: 320,
      blockedReason: 'заблокирован — протокол прочности бетона не получен (62% из 70%)',
      assigneeUserId: azamat,
    },
  });

  /* ── Справочник материалов ── */
  const catalogIds = new Map<string, string>();
  for (const c of CATALOG) {
    const created = await prisma.catalogItem.create({
      data: { name: c.name, unit: c.unit, aliases: JSON.stringify(c.aliases) },
    });
    catalogIds.set(c.name, created.id);
  }

  for (const s of STOCK) {
    await prisma.stockBalance.create({
      data: {
        objectId: objectIds.get(s.objectId)!,
        catalogItemId: catalogIds.get(s.item)!,
        qty: s.qty,
        unit: s.unit,
        specRemainder: s.specRemainder,
        hasPassport: s.hasPassport,
      },
    });
  }

  /* ── Заявки ── */
  for (const z of ZAYAVKI) {
    const zayavka = await prisma.zayavka.create({
      data: {
        number: z.number,
        kind: 'material',
        status: z.status,
        objectId: ak,
        blockId: akB,
        floor: 7,
        processStateId: z.number === 'ЗВ-АКО-26-0184' ? monoStates.get(2)! : null,
        authorId: azamat,
        holderId: 'holderLogin' in z && z.holderLogin ? userIds.get(z.holderLogin)! : null,
        priority: z.priority,
        deliveryBy: 'deliveryBy' in z && z.deliveryBy ? d(z.deliveryBy) : null,
        createdAt: d(z.createdAt),
        idleWorkers: 'idleWorkers' in z ? z.idleWorkers : null,
        idleSince: 'idleSince' in z && z.idleSince ? d(z.idleSince) : null,
        idleCost: 'idleCost' in z ? z.idleCost : null,
        items: {
          create: [
            {
              rawText: z.rawText,
              catalogItemId: catalogIds.get(z.material) ?? null,
              qty: z.qty,
              unit: z.unit,
              specRemainder: z.material === 'Арматура А500С Ø12' ? 2.3 : null,
            },
          ],
        },
      },
    });

    await prisma.zayavkaEvent.create({
      data: {
        zayavkaId: zayavka.id,
        at: d(z.createdAt),
        status: 'new',
        actorId: azamat,
        note: 'Отправлена',
      },
    });
  }

  /* ── Подрядчики и предписания ── */
  for (const c of CONTRACTORS) {
    const contractor = await prisma.contractor.create({
      data: {
        name: c.name,
        scope: c.scope,
        activeWorkers: c.activeWorkers,
        autoOnTime: c.auto.onTime,
        autoRework: c.auto.rework,
        autoSafety: c.auto.safety,
        autoDocs: c.auto.docs,
        ratings: {
          create: [
            {
              authorId: azamat,
              quality: c.manual.quality,
              safety: c.manual.safety,
              management: c.manual.management,
              culture: c.manual.culture,
            },
          ],
        },
      },
    });
    for (const p of c.prescriptions) {
      await prisma.prescription.create({
        data: {
          number: p.number,
          contractorId: contractor.id,
          issuedById: azamat,
          kind: p.kind,
          text: p.text,
          location: p.location,
          dueDays: p.dueDays,
          issuedAt: d(p.issuedAt),
        },
      });
    }
  }

  /* ── Техника ── */
  const machineIds = new Map<string, string>();
  for (const m of MACHINES) {
    const created = await prisma.machine.create({
      data: {
        name: m.name,
        kind: m.kind,
        status: m.status,
        nextServiceAt: d(m.nextServiceAt),
        permitUntil: d(m.permitUntil),
      },
    });
    machineIds.set(m.name, created.id);
  }

  // Заявка на кран с заполненным чек-листом готовности фронта.
  const techZayavka = await prisma.zayavka.create({
    data: {
      number: 'ЗТ-АКО-26-0042',
      kind: 'tech',
      status: 'approved',
      objectId: ak,
      blockId: akB,
      floor: 7,
      authorId: azamat,
      holderId: userIds.get('k.turgunov')!,
      priority: 'norm',
      items: { create: [{ rawText: 'Автобетононасос на бетонирование 7 эт.', qty: 6, unit: 'сут' }] },
    },
  });
  await prisma.techRequest.create({
    data: {
      zayavkaId: techZayavka.id,
      machineType: 'Автобетононасос',
      hours: 6,
      date: d('2026-08-07'),
      timeFrom: '08:00',
      frontChecklist: JSON.stringify(
        FRONT_CHECKLIST.map((c) => ({ ...c, checked: c.key !== 'safety' })),
      ),
      machineId: machineIds.get('Автобетононасос Putzmeister')!,
    },
  });

  /* ── Проект: комплекты и листы ── */
  for (const set of DRAWING_SETS) {
    await prisma.drawingSet.create({
      data: {
        objectId: objectIds.get(set.objectId)!,
        stage: set.stage,
        mark: set.mark,
        name: set.name,
        revision: set.revision,
        issuedAt: d(set.issuedAt),
        sheets: {
          create: set.sheets.map((s) => ({
            number: s.number,
            name: s.name,
            revision: s.revision,
            isCurrent: s.isCurrent,
            supersededBy: 'supersededBy' in s ? s.supersededBy : null,
            changedAt: 'changedAt' in s && s.changedAt ? d(s.changedAt) : null,
            changeSummary: 'changeSummary' in s ? s.changeSummary : null,
          })),
        },
      },
    });
  }

  for (const r of RFIS) {
    await prisma.rfi.create({
      data: {
        number: r.number,
        objectId: objectIds.get(r.objectId)!,
        authorId: userIds.get(r.authorLogin)!,
        question: r.question,
        createdAt: d(r.createdAt),
        dueAt: d(r.dueAt),
        status: r.status,
      },
    });
  }

  for (const doc of DOCUMENTS) {
    await prisma.siteDocument.create({
      data: {
        objectId: objectIds.get(doc.objectId)!,
        kind: doc.kind,
        number: doc.number,
        name: doc.name,
        status: doc.status,
        signedAt: 'signedAt' in doc && doc.signedAt ? d(doc.signedAt) : null,
        processStateId: doc.number === 'АОСР-33' ? monoStates.get(2)! : null,
      },
    });
  }

  for (const p of STRENGTH_PROTOCOLS) {
    await prisma.concreteStrengthProtocol.create({
      data: {
        objectId: objectIds.get(p.objectId)!,
        processStateId: betonState.id,
        pouredAt: d(p.pouredAt),
        sampleAt: d(p.sampleAt),
        strengthPct: p.strengthPct,
        requiredPct: p.requiredPct,
        labName: p.labName,
        status: p.status,
      },
    });
  }

  /* ── Финансы ── */
  for (const f of FINANCE) {
    await prisma.objectFinance.create({
      data: {
        objectId: objectIds.get(f.objectId)!,
        budget: f.budget,
        ev: f.ev,
        ac: f.ac,
        closedByActs: f.closedByActs,
        receivable: f.receivable,
      },
    });
  }

  for (const a of COST_ARTICLES) {
    await prisma.costArticle.create({
      data: {
        objectId: ak,
        name: a.name,
        amount: a.amount,
        note: 'note' in a ? a.note : null,
      },
    });
  }

  for (const p of PAYMENTS) {
    await prisma.payment.create({
      data: {
        objectId: objectIds.get(p.objectId)!,
        name: p.name,
        amount: p.amount,
        dueDate: d(p.dueDate),
        status: p.status,
        aboveLimit: 'aboveLimit' in p ? p.aboveLimit : false,
      },
    });
  }

  for (const l of AUTONOMY_LIMITS) {
    await prisma.autonomyLimit.create({
      data: { role: l.role, scope: l.scope, limit: l.limit },
    });
  }

  /* ── Задачи и проблемы ── */
  const nurlanGi = userIds.get('n.tashiev')!;
  const taskIds: string[] = [];
  for (const t of TASKS) {
    const created = await prisma.task.create({
      data: {
        text: t.text,
        objectId: objectIds.get(t.objectId)!,
        assigneeId: userIds.get(t.assignee) ?? null,
        authorId: nurlanGi,
        dueDate: d(t.due),
        status: d(t.due) < d('2026-08-04') ? 'overdue' : 'open',
        origin: t.origin,
      },
    });
    taskIds.push(created.id);
  }

  for (const i of INCIDENTS) {
    await prisma.incident.create({
      data: {
        objectId: objectIds.get(i.objectId)!,
        kind: i.kind,
        title: i.title,
        detail: i.detail,
        workersIdle: 'workersIdle' in i ? i.workersIdle : null,
        cost: i.cost,
        status: 'open',
      },
    });
  }

  /* ── Вчерашний отчёт, возвращённый ПТО ── */
  const returned = await prisma.dailyReport.create({
    data: {
      date: d('2026-08-03'),
      authorId: azamat,
      objectId: ak,
      status: 'returned',
      submittedAt: d('2026-08-03T18:45:00'),
      fillSeconds: 254,
      returnComment: 'Объём кладки за день не сходится с фото. Указано 950 шт, по фото — меньше',
      entries: {
        create: [
          {
            processStateId: kladState.id,
            volume: 950,
            unit: 'шт',
            workers: 12,
            problems: '[]',
            tempAir: 21,
          },
          {
            processStateId: monoStates.get(2)!,
            volume: 0.28,
            unit: 'т',
            workers: 14,
            problems: '[]',
            tempAir: 21,
          },
        ],
      },
    },
    include: { entries: true },
  });

  await prisma.dailyReport.update({
    where: { id: returned.id },
    data: { returnedFields: JSON.stringify([returned.entries[0]!.id]) },
  });

  await prisma.reportCheck.create({
    data: {
      reportId: returned.id,
      actorId: userIds.get('g.sadykova')!,
      decision: 'return',
      comment: 'Объём кладки за день не сходится с фото',
    },
  });

  /* ── Уведомления, которые прототип показывает при старте ── */
  await prisma.notification.createMany({
    data: [
      {
        toRole: 'prorab',
        toUserId: azamat,
        kind: 'report',
        title: '↩ Отчёт за 3 авг возвращён ПТО',
        subtitle: '«Проверьте объём кладки»',
        at: d('2026-08-03T21:14:00'),
      },
      {
        toRole: 'pto',
        kind: 'zayavka',
        title: '🔔 Заявка ЗВ-АКО-26-0184 висит 2 дня',
        subtitle: 'Простой 24 чел с 17:20 · ≈ 84 000 сом',
        at: d('2026-08-04T09:00:00'),
      },
      {
        toRole: 'gi',
        kind: 'safety',
        title: '🔴 Нарушение ТБ · ИП Асанов',
        subtitle: 'Работа на высоте без страховки · Блок А, 5 эт.',
        at: d('2026-08-04T10:20:00'),
      },
    ],
  });

  const counts = {
    объектов: await prisma.constructionObject.count(),
    пользователей: await prisma.user.count(),
    разделов: await prisma.sectionDef.count(),
    'процессов в справочнике': await prisma.processDef.count(),
    'процессов на объекте': await prisma.processState.count(),
    заявок: await prisma.zayavka.count(),
    подрядчиков: await prisma.contractor.count(),
  };
  console.log('Сев завершён:', counts);
  console.log(`Пароль всех демо-учёток: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
