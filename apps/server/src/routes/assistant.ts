/**
 * AI-помощник.
 *
 * Архитектурное требование из ТЗ: фильтр по правам роли ставится **на уровне данных**,
 * до того, как ответ формируется, а не инструкцией модели. Поэтому здесь нет модели:
 * набор структурных запросов, числа берутся из базы, к каждому ответу — источник
 * и действия. Свободный чат по ТЗ открывается только после накопления данных,
 * а пока честное «не могу ответить» вместо уверенной выдумки.
 */
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import type { Role } from '@build-hub/shared';

interface AnswerAction {
  label: string;
  screen: string;
  params?: Record<string, string>;
}

interface Answer {
  text: string;
  /** Источник — прораб должен иметь возможность проверить. */
  source: string;
  actions: AnswerAction[];
}

type Handler = (ctx: { userId: string; role: Role; objectId?: string }) => Promise<Answer>;

interface Template {
  key: string;
  question: string;
  roles: Role[];
  /**
   * Различающие основы слов для распознавания свободного вопроса.
   * Намеренно без «сколько», «какой», «где» — они не различают ничего.
   */
  keywords: string[];
  run: Handler;
}

/** Меньше двух совпадений — отказ, а не догадка. */
const MIN_KEYWORD_MATCHES = 2;

const nf = new Intl.NumberFormat('ru-RU');
const df = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' });

const TEMPLATES: Template[] = [
  {
    key: 'arrivals',
    question: 'Какой материал пришёл на прошлой неделе?',
    roles: ['prorab', 'master', 'sklad', 'snab'],
    keywords: ['пришёл', 'пришло', 'поступил', 'привезл', 'приёмк', 'приемк', 'материал', 'недел'],
    run: async ({ objectId }) => {
      const since = new Date(Date.now() - 7 * 86_400_000);
      const acceptances = await prisma.materialAcceptance.findMany({
        where: { at: { gte: since }, zayavka: objectId ? { objectId } : {} },
        include: { zayavka: { include: { items: { include: { catalogItem: true } } } } },
        orderBy: { at: 'desc' },
      });
      if (acceptances.length === 0) {
        return {
          text: 'За последнюю неделю приёмок не зарегистрировано.',
          source: 'Журнал входного контроля',
          actions: [{ label: 'Открыть заявки', screen: 'zayavki' }],
        };
      }
      const lines = acceptances.map((a) => {
        const item = a.zayavka.items[0];
        return `${item?.catalogItem?.name ?? item?.rawText ?? a.zayavka.number} — ${nf.format(a.qtyAccepted)} ${item?.unit ?? ''} (${df.format(a.at)})`;
      });
      return {
        text: `На прошлой неделе поступило:\n${lines.join('\n')}`,
        source: `По приёмкам ${acceptances.map((a) => a.zayavka.number).join(', ')}`,
        actions: [
          { label: 'Открыть приёмки', screen: 'zayavki' },
          { label: 'Посмотреть остатки', screen: 'stock' },
          { label: 'Создать заявку', screen: 'zayavka-new' },
        ],
      };
    },
  },
  {
    key: 'stock-left',
    question: 'Сколько осталось арматуры?',
    roles: ['prorab', 'master', 'sklad'],
    keywords: ['остат', 'осталось', 'склад', 'армат', 'запас'],
    run: async ({ objectId }) => {
      const balances = await prisma.stockBalance.findMany({
        where: { ...(objectId ? { objectId } : {}), catalogItem: { name: { contains: 'рматур' } } },
        include: { catalogItem: true },
      });
      if (balances.length === 0) {
        return {
          text: 'Арматуры на остатке нет.',
          source: 'Остатки на объекте',
          actions: [{ label: 'Создать заявку', screen: 'zayavka-new' }],
        };
      }
      return {
        text: balances
          .map(
            (b) =>
              `${b.catalogItem.name} — ${nf.format(b.qty)} ${b.unit}` +
              (b.specRemainder !== null ? ` · по спецификации осталось ${nf.format(b.specRemainder)} ${b.unit}` : ''),
          )
          .join('\n'),
        source: 'Остатки на объекте · журнал выдачи',
        actions: [
          { label: 'Посмотреть остатки', screen: 'stock' },
          { label: 'Создать заявку', screen: 'zayavka-new' },
        ],
      };
    },
  },
  {
    key: 'delivery-eta',
    question: 'Когда придёт материал по моим заявкам?',
    roles: ['prorab', 'master', 'snab'],
    keywords: ['придёт', 'придет', 'постав', 'привезут', 'срок', 'заявк', 'достав'],
    run: async ({ userId }) => {
      const zayavki = await prisma.zayavka.findMany({
        where: { authorId: userId, status: { in: ['ordered', 'inTransit', 'purchasing', 'approved'] } },
        include: { items: { include: { catalogItem: true } } },
        orderBy: { deliveryBy: 'asc' },
      });
      if (zayavki.length === 0) {
        return { text: 'Активных поставок нет.', source: 'Реестр заявок', actions: [{ label: 'Заявки', screen: 'zayavki' }] };
      }
      return {
        text: zayavki
          .map((z) => {
            const item = z.items[0];
            const eta = z.deliveryBy ? df.format(z.deliveryBy) : 'срок не назначен';
            return `${item?.catalogItem?.name ?? item?.rawText} · ${z.number} — ${eta}`;
          })
          .join('\n'),
        source: `По заявкам ${zayavki.map((z) => z.number).join(', ')}`,
        actions: [{ label: 'Открыть заявки', screen: 'zayavki' }],
      };
    },
  },
  {
    key: 'unsigned-acts',
    question: 'Какие акты не подписаны по моему блоку?',
    roles: ['prorab', 'master', 'pto'],
    keywords: ['акт', 'подпис', 'аоср', 'освидетельств', 'блок'],
    run: async ({ objectId }) => {
      const docs = await prisma.siteDocument.findMany({
        where: { kind: 'aosr', status: { not: 'signed' }, ...(objectId ? { objectId } : {}) },
      });
      const presented = await prisma.processState.findMany({
        where: { status: 'presented', ...(objectId ? { objectId } : {}) },
        include: { processDef: true, block: true },
      });
      if (docs.length === 0 && presented.length === 0) {
        return { text: 'Неподписанных актов нет.', source: 'Реестр АОСР', actions: [] };
      }
      const lines = [
        ...docs.map((d) => `${d.number} · ${d.name} — черновик`),
        ...presented.map(
          (p) => `${p.processDef.name} · ${p.block.name} ${p.floor} эт. — предъявлен, ждём технадзор`,
        ),
      ];
      return {
        text: lines.join('\n'),
        source: 'Реестр АОСР и очередь освидетельствования',
        actions: [
          { label: 'Открыть акты', screen: 'documents' },
          { label: 'Предъявить', screen: 'works' },
        ],
      };
    },
  },
  {
    key: 'overdue-acts',
    question: 'Какие акты просрочены?',
    roles: ['pto', 'gi'],
    keywords: ['акт', 'просроч', 'аоср', 'освидетельств'],
    run: async () => {
      const presented = await prisma.processState.findMany({
        where: { status: 'presented' },
        include: { processDef: true, block: true, object: true },
      });
      const overdue = presented.filter(
        (p) => p.presentedAt && Date.now() - p.presentedAt.getTime() > (p.presentedOfDays ?? 3) * 86_400_000,
      );
      if (overdue.length === 0) {
        return { text: 'Просроченных освидетельствований нет.', source: 'Очередь освидетельствования', actions: [] };
      }
      return {
        text: overdue
          .map((p) => {
            const days = Math.floor((Date.now() - p.presentedAt!.getTime()) / 86_400_000);
            return `${p.processDef.name} · ${p.object.name} · ${p.block.name} ${p.floor} эт. — просрочено ${days} дн.`;
          })
          .join('\n'),
        source: 'Очередь освидетельствования',
        actions: [
          { label: 'Назначить дату', screen: 'pto-queue' },
          { label: 'Вернуть с замечаниями', screen: 'pto-queue' },
        ],
      };
    },
  },
  {
    key: 'stale-zayavki',
    question: 'Какие заявки висят больше 2 дней?',
    roles: ['snab', 'gi', 'dir'],
    keywords: ['заявк', 'вис', 'дня', 'дней', 'задержив', 'зависл'],
    run: async () => {
      const cutoff = new Date(Date.now() - 2 * 86_400_000);
      const zayavki = await prisma.zayavka.findMany({
        where: { status: { in: ['new', 'normalizing', 'approved'] }, createdAt: { lt: cutoff } },
        include: { items: { include: { catalogItem: true } }, object: true },
        orderBy: { createdAt: 'asc' },
      });
      if (zayavki.length === 0) {
        return { text: 'Зависших заявок нет.', source: 'Реестр заявок', actions: [] };
      }
      return {
        text: zayavki
          .map((z) => {
            const days = Math.floor((Date.now() - z.createdAt.getTime()) / 86_400_000);
            const idle = z.idleCost ? ` · простой ≈ ${nf.format(z.idleCost)} сом` : '';
            return `${z.number} · ${z.items[0]?.catalogItem?.name ?? z.items[0]?.rawText} · ${z.object.name} — ${days} дн.${idle}`;
          })
          .join('\n'),
        source: `По заявкам ${zayavki.map((z) => z.number).join(', ')}`,
        actions: [{ label: 'Открыть заявки', screen: 'zayavki' }],
      };
    },
  },
  {
    key: 'overspend',
    question: 'Где перерасход за месяц?',
    roles: ['sklad', 'gi', 'dir'],
    keywords: ['перерасход', 'вор', 'норматив', 'выдач', 'спецификац', 'месяц'],
    run: async () => {
      const balances = await prisma.stockBalance.findMany({
        where: { specRemainder: { not: null } },
        include: { catalogItem: true, object: true },
      });
      const over = balances.filter((b) => b.specRemainder !== null && b.qty > b.specRemainder);
      if (over.length === 0) {
        return { text: 'Перерасхода против спецификации не зафиксировано.', source: 'Журнал выдачи против ВОР', actions: [] };
      }
      return {
        text: over
          .map((b) => {
            const pct = Math.round(((b.qty - b.specRemainder!) / b.specRemainder!) * 100);
            return `${b.catalogItem.name} · ${b.object.name} — +${pct}% (${nf.format(b.qty)} при ${nf.format(b.specRemainder!)} ${b.unit})`;
          })
          .join('\n'),
        source: 'Журнал выдачи против ВОР',
        actions: [
          { label: 'Указать причину', screen: 'stock' },
          { label: 'Открыть выдачу', screen: 'issues' },
        ],
      };
    },
  },
  {
    key: 'tech-idle',
    question: 'Какая техника простаивала и почему?',
    roles: ['tech', 'gi', 'dir'],
    keywords: ['техник', 'простаив', 'простой', 'машин', 'моточас', 'кран', 'экскаватор'],
    run: async () => {
      const reports = await prisma.techReport.findMany({
        where: { idleHours: { gt: 0 } },
        include: { techRequest: { include: { machine: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      if (reports.length === 0) {
        return { text: 'Простоев техники не зафиксировано.', source: 'Отчёты по технике', actions: [] };
      }
      return {
        text: reports
          .map(
            (r) =>
              `${r.techRequest.machine?.name ?? r.techRequest.machineType} — ${r.idleHours} ч · ${r.idleReason ?? 'причина не указана'}`,
          )
          .join('\n'),
        source: 'Отчёты по технике после смены',
        actions: [{ label: 'Открыть парк', screen: 'machines' }],
      };
    },
  },
  {
    key: 'money-loss',
    question: 'Где мы теряем деньги?',
    roles: ['dir', 'gi'],
    keywords: ['деньг', 'теря', 'убыт', 'перерасход', 'маржа', 'cpi', 'финанс'],
    run: async () => {
      const [incidents, finance] = await Promise.all([
        prisma.incident.findMany({ where: { status: 'open', cost: { gt: 0 } }, include: { object: true }, orderBy: { cost: 'desc' } }),
        prisma.objectFinance.findMany({ include: { object: true } }),
      ]);
      const worst = finance
        .map((f) => ({ name: f.object.name, cpi: f.ac > 0 ? f.ev / f.ac : 1, over: f.ac - f.ev }))
        .filter((f) => f.cpi < 1)
        .sort((a, b) => a.cpi - b.cpi);

      const lines = [
        ...worst.map((f) => `${f.name} — CPI ${f.cpi.toFixed(2)}, перерасход ${f.over.toFixed(0)} млн сом`),
        ...incidents.map((i) => `${i.object.name} · ${i.title} — ≈ ${nf.format(i.cost!)} сом`),
      ];
      if (lines.length === 0) {
        return { text: 'Отклонений по деньгам не зафиксировано.', source: 'Финансы объектов', actions: [] };
      }
      return {
        text: lines.join('\n'),
        source: 'Финансы объектов · лента проблем',
        actions: [
          { label: 'Открыть финансы', screen: 'finance' },
          { label: 'Требует решения', screen: 'inbox' },
        ],
      };
    },
  },
  {
    key: 'overdue-prescriptions',
    question: 'Какие предписания просрочены?',
    roles: ['gi', 'prorab'],
    keywords: ['предписан', 'просроч', 'нарушен', 'тб'],
    run: async () => {
      const list = await prisma.prescription.findMany({
        where: { resolvedAt: null },
        include: { contractor: true },
      });
      const overdue = list.filter((p) => Date.now() - p.issuedAt.getTime() > p.dueDays * 86_400_000);
      if (overdue.length === 0) {
        return { text: 'Просроченных предписаний нет.', source: 'Реестр предписаний', actions: [] };
      }
      return {
        text: overdue
          .map((p) => `${p.number} · ${p.contractor.name} · ${p.location} — ${p.text}`)
          .join('\n'),
        source: 'Реестр предписаний',
        actions: [{ label: 'Открыть подрядчиков', screen: 'contractors' }],
      };
    },
  },
];

export async function assistantRoutes(app: FastifyInstance) {
  app.addHook('preHandler', app.authenticate);

  /** Подсказки по роли: свободное поле пугает, готовые вопросы показывают, что бот умеет. */
  app.get('/api/assistant/suggestions', async (req) => {
    return TEMPLATES.filter((t) => t.roles.includes(req.currentUser.role)).map((t) => ({
      key: t.key,
      question: t.question,
    }));
  });

  app.post('/api/assistant/ask', async (req) => {
    const body = z.object({ key: z.string().optional(), text: z.string().optional() }).parse(req.body ?? {});

    const me = await prisma.user.findUniqueOrThrow({ where: { id: req.currentUser.id } });
    const ctx = { userId: me.id, role: me.role as Role, objectId: me.objectId ?? undefined };

    const allowed = TEMPLATES.filter((t) => t.roles.includes(ctx.role));

    let template = body.key ? allowed.find((t) => t.key === body.key) : undefined;

    if (!template && body.text) {
      // Сопоставление только по различающим словам и только среди разрешённых роли шаблонов.
      //
      // Одного совпадения мало: вопросительные слова («сколько», «какие») есть почти
      // в каждом шаблоне, и по ним «сколько зарабатывает директор» уезжало в ответ
      // про остаток арматуры. Уверенный ответ не на тот вопрос хуже отказа,
      // поэтому нужно не меньше двух различающих совпадений.
      const needle = body.text.toLowerCase();
      const scored = allowed
        .map((t) => ({
          template: t,
          score: t.keywords.filter((stem) => needle.includes(stem)).length,
        }))
        .filter((x) => x.score >= MIN_KEYWORD_MATCHES)
        .sort((a, b) => b.score - a.score);

      // Ничья между шаблонами — тоже повод отказаться, а не гадать.
      if (scored.length > 0 && (scored.length === 1 || scored[0]!.score > scored[1]!.score)) {
        template = scored[0]!.template;
      }
    }

    if (!template) {
      // Честное «не могу ответить»: уверенный неправильный ответ дороже отсутствия ответа.
      return {
        answered: false,
        text: 'Не могу ответить на этот вопрос по данным системы. Свободные вопросы откроются, когда накопится история — пока выберите из подсказок.',
        source: null,
        actions: [],
        suggestions: allowed.map((t) => ({ key: t.key, question: t.question })),
      };
    }

    const answer = await template.run(ctx);
    return {
      answered: true,
      question: template.question,
      ...answer,
      suggestions: allowed.filter((t) => t.key !== template!.key).map((t) => ({ key: t.key, question: t.question })),
    };
  });
}
