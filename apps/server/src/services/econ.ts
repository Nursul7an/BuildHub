/**
 * Экономика объекта. ТЗ §3.2, §6, критерий приёмки 9.
 *
 * Правило одно: каждая цифра выводится из данных системы и сходится
 * арифметически, а рядом с ней стоит дата актуальности затрат. Показатель
 * без даты — повод для спора, а не основание для решения.
 *
 * Считаем в Decimal: на сотне позиций ВОР копеечная погрешность превращается
 * в расхождение, которое потом ищут вручную.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../db.js';

const D = Prisma.Decimal;
type Dec = Prisma.Decimal;

const ZERO = new D(0);

function sum(values: Dec[]): Dec {
  return values.reduce((a, b) => a.add(b), ZERO);
}

/** Округление до копеек — там, где число уходит наружу. */
function money(value: Dec): number {
  return Number(value.toDecimalPlaces(2));
}

function ratio(numerator: Dec, denominator: Dec): number | null {
  if (denominator.isZero()) return null;
  return Number(numerator.div(denominator).toDecimalPlaces(3));
}

export interface EconSummary {
  objectId: string;
  objectName: string;
  /** Дата актуальности затрат. ТЗ §10: показывается на каждом финансовом экране. */
  costsAsOf: string | null;
  costsStale: boolean;

  /** Бюджет по завершении: сумма ВОР. */
  bac: number;
  /** Освоено: выполненный объём в расценках ВОР. */
  ev: number;
  /** Потрачено: факт из 1С. */
  ac: number;
  /** Плановое освоение на сегодня — по срокам процессов. */
  pv: number;

  cpi: number | null;
  spi: number | null;
  /** Прогноз по завершении и отклонение от бюджета. */
  eac: number | null;
  vac: number | null;

  closure: {
    completed: number;
    submitted: number;
    signed: number;
    paid: number;
    extraWorkUnformalized: number;
    /** Разрыв «выполнено — подписано»: освоение есть, денег нет. */
    gapEarnedToSigned: number;
    receivable: number;
  };

  articles: { article: string; amount: number; pct: number }[];

  /** Слагаемые, по которым читатель может пересчитать итог сам. */
  checks: {
    evEqualsSumOfLines: boolean;
    acEqualsSumOfFacts: boolean;
    vacEqualsBacMinusEac: boolean;
  };
}

/** Данные считаются несвежими, если 1С не выгружалась дольше суток. */
const STALE_AFTER_HOURS = 36;

export async function econSummary(objectId: string, now = new Date()): Promise<EconSummary> {
  const object = await prisma.constructionObject.findUniqueOrThrow({ where: { id: objectId } });

  const [boq, facts, acts] = await Promise.all([
    prisma.boqItem.findMany({
      where: { objectId },
      include: { processDef: { include: { states: { where: { objectId } } } } },
    }),
    prisma.costFact.findMany({ where: { objectId } }),
    prisma.contractAct.findMany({ where: { objectId } }),
  ]);

  /* ── Бюджет и освоение ── */
  const lineAmounts = boq.map((item) => new D(item.qty).mul(new D(item.rate)));
  const bac = sum(lineAmounts);

  // Освоение по каждой позиции: доля выполнения процесса × стоимость позиции.
  // Если позиция ни к чему не привязана, освоения по ней нет — приписывать
  // проценты «на глаз» здесь нельзя, на этом и держится доверие к цифре.
  const earnedLines = boq.map((item, index) => {
    const states = item.processDef?.states ?? [];
    if (states.length === 0) return ZERO;

    const planned = sum(states.map((s) => new D(s.planQty)));
    const done = sum(states.map((s) => new D(s.doneQty)));
    if (planned.isZero()) return ZERO;

    const share = D.min(done.div(planned), new D(1));
    return lineAmounts[index]!.mul(share);
  });
  const ev = sum(earnedLines);

  /* ── Плановое освоение на сегодня ── */
  // Позиция считается плановой, если срок её процесса уже наступил.
  const plannedLines = boq.map((item, index) => {
    const states = item.processDef?.states ?? [];
    if (states.length === 0) return ZERO;
    const due = states.filter((s) => s.dueDate !== null && s.dueDate <= now);
    if (due.length === 0) return ZERO;
    const share = new D(due.length).div(new D(states.length));
    return lineAmounts[index]!.mul(share);
  });
  const pv = sum(plannedLines);

  /* ── Фактические затраты ── */
  const ac = sum(facts.map((f) => new D(f.amount)));
  const costsAsOf = facts.reduce<Date | null>(
    (latest, f) => (latest === null || f.actualAsOf > latest ? f.actualAsOf : latest),
    null,
  );

  const byArticle = new Map<string, Dec>();
  for (const fact of facts) {
    byArticle.set(fact.article, (byArticle.get(fact.article) ?? ZERO).add(new D(fact.amount)));
  }

  /* ── Индексы и прогноз ── */
  const cpi = ratio(ev, ac);
  const spi = ratio(ev, pv);
  // EAC = BAC / CPI: при текущей эффективности столько будет стоить всё.
  const eacDec = cpi !== null && cpi > 0 ? bac.div(new D(cpi)) : null;
  const vacDec = eacDec ? bac.sub(eacDec) : null;

  /* ── Закрытие актами ── */
  const completed = sum(acts.map((a) => new D(a.amountCompleted)));
  const submitted = sum(acts.map((a) => new D(a.amountSubmitted ?? 0)));
  const signed = sum(acts.map((a) => new D(a.amountSigned ?? 0)));
  const paid = sum(acts.map((a) => new D(a.amountPaid ?? 0)));
  const extra = sum(acts.map((a) => new D(a.extraWorkUnformalized)));

  return {
    objectId,
    objectName: object.name,
    costsAsOf: costsAsOf?.toISOString() ?? null,
    costsStale:
      costsAsOf === null || now.getTime() - costsAsOf.getTime() > STALE_AFTER_HOURS * 3_600_000,

    bac: money(bac),
    ev: money(ev),
    ac: money(ac),
    pv: money(pv),

    cpi,
    spi,
    eac: eacDec ? money(eacDec) : null,
    vac: vacDec ? money(vacDec) : null,

    closure: {
      completed: money(completed),
      submitted: money(submitted),
      signed: money(signed),
      paid: money(paid),
      extraWorkUnformalized: money(extra),
      // Освоено, но не подписано: работа сделана, предъявить нечем.
      gapEarnedToSigned: money(ev.sub(signed)),
      receivable: money(signed.sub(paid)),
    },

    articles: [...byArticle.entries()]
      .map(([article, amount]) => ({
        article,
        amount: money(amount),
        pct: ac.isZero() ? 0 : Number(amount.div(ac).mul(100).toDecimalPlaces(1)),
      }))
      .sort((a, b) => b.amount - a.amount),

    // Проверки, которые читатель может повторить на бумаге.
    checks: {
      evEqualsSumOfLines: money(ev) === money(sum(earnedLines)),
      acEqualsSumOfFacts: money(ac) === money(sum(facts.map((f) => new D(f.amount)))),
      vacEqualsBacMinusEac:
        vacDec === null || money(vacDec) === money(bac.sub(eacDec!)),
    },
  };
}

/** Разбор освоения по позициям — чтобы «почему столько» имело ответ. */
export async function econBreakdown(objectId: string) {
  const boq = await prisma.boqItem.findMany({
    where: { objectId },
    include: {
      section: true,
      processDef: { include: { states: { where: { objectId } } } },
    },
    orderBy: { code: 'asc' },
  });

  return boq.map((item) => {
    const amount = new D(item.qty).mul(new D(item.rate));
    const states = item.processDef?.states ?? [];
    const planned = sum(states.map((s) => new D(s.planQty)));
    const done = sum(states.map((s) => new D(s.doneQty)));
    const share = planned.isZero() ? ZERO : D.min(done.div(planned), new D(1));

    return {
      id: item.id,
      code: item.code,
      name: item.name,
      section: item.section?.name ?? null,
      unit: item.unit,
      qty: Number(item.qty),
      rate: money(new D(item.rate)),
      amount: money(amount),
      donePct: Number(share.mul(100).toDecimalPlaces(1)),
      earned: money(amount.mul(share)),
      /** Позиция ни к чему не привязана — освоение по ней не считается. */
      unlinked: states.length === 0,
    };
  });
}
