/**
 * Данные прототипа, перенесённые один-в-один.
 *
 * Источник — `project/Прототип - всё приложение.dc.html` (объект `chainsCat`, `cfg`,
 * `bossObjs`, `finObjs`, `zdata`, `podrRows` и соседние) и ТЗ в `chats/chat1.md`.
 * Цепочки процессов — не декорация: порядок, единицы и признак АОСР определяют,
 * какой процесс кого блокирует.
 */

export type Unit = 'т' | 'кг' | 'м³' | 'м²' | 'пог. м' | 'шт' | 'точки' | 'партия' | 'сут' | '—';

export interface ProcessRow {
  name: string;
  unit: Unit;
  /** По завершении требуется АОСР — «замок» в интерфейсе. */
  aosr: boolean;
  subcycle?: string;
  /** ⚠️ в исходном названии: отступление несёт риск. */
  critical?: boolean;
}

export interface SectionFixture {
  id: string;
  name: string;
  sortOrder: number;
  entryCondition?: string;
  blockReason?: string;
  /** Номер процесса (с 1), который сейчас в работе. 0 — раздел не начат. */
  current: number;
  rows: ProcessRow[];
}

/* ─────────────────── Монолит · этаж (16 процессов, два подцикла) ─────────────────── */

const A = 'Подцикл А · Колонны и стены';
const B = 'Подцикл Б · Перекрытие';

export const SECTIONS: SectionFixture[] = [
  {
    id: 'mono',
    name: 'Монолит',
    sortOrder: 1,
    current: 2,
    rows: [
      { name: 'Геодезия: вынос осей и отметок', unit: '—', aosr: false, subcycle: A },
      { name: 'Армирование колонн и стен', unit: 'т', aosr: true, subcycle: A },
      { name: 'Монтаж опалубки колонн', unit: 'м²', aosr: false, subcycle: A },
      { name: 'Закладные, гильзы, проёмы (ЭОМ/ВК/ОВ)', unit: 'шт', aosr: true, subcycle: A, critical: true },
      { name: 'Бетонирование колонн и стен', unit: 'м³', aosr: false, subcycle: A },
      { name: 'Уход за бетоном', unit: 'сут', aosr: false, subcycle: A },
      { name: 'Распалубка колонн', unit: 'м²', aosr: false, subcycle: A },
      { name: 'Монтаж опалубки перекрытия', unit: 'м²', aosr: false, subcycle: B },
      { name: 'Армирование балок и ригелей', unit: 'т', aosr: true, subcycle: B },
      { name: 'Армирование плиты — нижняя сетка', unit: 'т', aosr: false, subcycle: B },
      { name: 'Закладные и гильзы в перекрытии', unit: 'шт', aosr: false, subcycle: B },
      { name: 'Армирование плиты — верхняя сетка', unit: 'т', aosr: true, subcycle: B },
      { name: 'Бетонирование перекрытия', unit: 'м³', aosr: false, subcycle: B },
      { name: 'Уход за бетоном', unit: 'сут', aosr: false, subcycle: B },
      { name: 'Распалубка перекрытия', unit: 'м²', aosr: false, subcycle: B },
      { name: 'Приёмка этажа (акт ответственных конструкций)', unit: '—', aosr: true, subcycle: B },
    ],
  },
  {
    id: 'klad',
    name: 'Кладка',
    sortOrder: 2,
    current: 6,
    rows: [
      { name: 'Разметка стен и проёмов на этаже', unit: '—', aosr: false },
      { name: 'Входной контроль: марка кирпича, марка раствора', unit: 'партия', aosr: false },
      { name: 'Устройство подмостей (выше 4 м — акт комиссии)', unit: 'м²', aosr: false },
      { name: 'Кладка яруса 1', unit: 'шт', aosr: false },
      { name: 'Сетчатое армирование — уровень 1', unit: 'м²', aosr: true },
      { name: 'Кладка яруса 2', unit: 'шт', aosr: false },
      { name: 'Сетчатое армирование — уровень 2', unit: 'м²', aosr: true },
      { name: 'Монолитные сердечники: армирование', unit: 'т', aosr: true },
      { name: 'Монолитные сердечники: бетонирование', unit: 'м³', aosr: false },
      { name: 'Установка перемычек', unit: 'шт', aosr: true },
      { name: 'Антисейсмический пояс: опалубка', unit: 'м²', aosr: false },
      { name: 'Антисейсмический пояс: армирование', unit: 'т', aosr: true },
      { name: 'Антисейсмический пояс: бетонирование непрерывно', unit: 'м³', aosr: false },
      { name: 'Приёмка кладки этажа', unit: '—', aosr: true },
    ],
  },
  {
    id: 'shtuk',
    name: 'Штукатурка',
    sortOrder: 3,
    current: 0,
    entryCondition:
      'Условие входа: контур закрыт, остекление есть, скрытая инженерка в стенах принята по АОСР',
    blockReason:
      '⛔ Штукатурка недоступна — не принята скрытая электрика в стенах (АОСР от 02.08 не подписан)',
    rows: [
      { name: 'Приёмка основания: замер влажности, ровность', unit: 'м²', aosr: false },
      { name: 'Заделка штраб после инженерки', unit: 'пог. м', aosr: false },
      { name: 'Уголки и сетка на стыках материалов', unit: 'пог. м', aosr: false },
      { name: 'Грунтование', unit: 'м²', aosr: false },
      { name: 'Установка маяков', unit: 'пог. м', aosr: false },
      { name: 'Нанесение штукатурного слоя', unit: 'м²', aosr: false },
      { name: 'Откосы, углы, примыкания', unit: 'пог. м', aosr: false },
      { name: 'Затирка и заглаживание', unit: 'м²', aosr: false },
      { name: 'Приёмка по ровности (правило 2 м)', unit: 'м²', aosr: false },
    ],
  },
  {
    id: 'styazh',
    name: 'Стяжка',
    sortOrder: 4,
    current: 0,
    blockReason: '⛔ Стяжка заблокирована — АОСР на гидроизоляцию влажных зон не подписан',
    rows: [
      { name: 'Приёмка основания, вынос отметок чистого пола', unit: 'м²', aosr: false },
      { name: 'Очистка и грунтование', unit: 'м²', aosr: false },
      { name: 'Гидроизоляция влажных зон с заведением на стены', unit: 'м²', aosr: true },
      { name: 'Скрытая разводка в полу (ВК/ЭОМ/отопление)', unit: 'пог. м', aosr: true },
      { name: 'Тепло- и звукоизоляция', unit: 'м²', aosr: true },
      { name: 'Демпферная лента по периметру', unit: 'пог. м', aosr: false },
      { name: 'Армирование стяжки', unit: 'м²', aosr: true },
      { name: 'Установка маяков', unit: 'пог. м', aosr: false },
      { name: 'Укладка стяжки', unit: 'м²', aosr: false },
      { name: 'Уход', unit: 'сут', aosr: false },
      { name: 'Нарезка деформационных швов', unit: 'пог. м', aosr: false },
      { name: 'Замер влажности перед покрытием', unit: '—', aosr: false },
      { name: 'Приёмка по ровности и отметкам', unit: 'м²', aosr: false },
    ],
  },
  {
    id: 'san',
    name: 'Сантехника',
    sortOrder: 5,
    current: 0,
    blockReason:
      '⛔ Сантехника заблокирована — скрытая разводка не освидетельствована (АОСР не подписан)',
    rows: [
      { name: 'Разметка трасс по проекту ВК', unit: 'пог. м', aosr: false },
      { name: 'Входной контроль труб и фитингов', unit: 'партия', aosr: false },
      { name: 'Гильзы в местах прохода через конструкции ⚠️', unit: 'шт', aosr: false, critical: true },
      { name: 'Штрабы и отверстия — только по КЖ ⚠️', unit: 'шт', aosr: false, critical: true },
      { name: 'Монтаж стояков ХВС, ГВС, канализации', unit: 'пог. м', aosr: false },
      { name: 'Разводка по этажу', unit: 'пог. м', aosr: false },
      { name: 'Проверка уклонов самотёчных линий', unit: 'пог. м', aosr: false },
      { name: 'Испытание давлением на прочность и герметичность', unit: '—', aosr: true },
      { name: 'Освидетельствование скрытой разводки до закрытия', unit: '—', aosr: true },
      { name: 'Изоляция трубопроводов', unit: 'пог. м', aosr: false },
      { name: 'Установка приборов и арматуры', unit: 'шт', aosr: false },
      { name: 'Промывка систем', unit: '—', aosr: true },
      { name: 'Индивидуальные испытания', unit: '—', aosr: true },
    ],
  },
  {
    id: 'el',
    name: 'Электрика',
    sortOrder: 6,
    current: 7,
    rows: [
      { name: 'Разметка трасс и мест установки по ЭОМ', unit: 'точки', aosr: false },
      { name: 'Входной контроль: сечения и марки кабеля', unit: 'партия', aosr: false },
      { name: 'Закладные, гильзы, трубы в монолите ⚠️', unit: 'шт', aosr: false, critical: true },
      { name: 'Штрабы и отверстия — только по КЖ ⚠️', unit: 'пог. м', aosr: false, critical: true },
      { name: 'Монтаж заземляющего контура', unit: 'пог. м', aosr: true },
      { name: 'Прокладка магистралей и стояков', unit: 'пог. м', aosr: false },
      { name: 'Разводка по этажу, подрозетники', unit: 'точки', aosr: false },
      { name: 'Монтаж щитов', unit: 'шт', aosr: false },
      { name: 'Освидетельствование скрытой проводки', unit: '—', aosr: true },
      { name: 'Замер сопротивления изоляции', unit: '—', aosr: true },
      { name: 'Замер петли фаза-нуль', unit: '—', aosr: true },
      { name: 'Установка приборов и светильников', unit: 'точки', aosr: false },
      { name: 'Индивидуальные испытания', unit: '—', aosr: true },
    ],
  },
  {
    id: 'vent',
    name: 'Вентиляция',
    sortOrder: 7,
    current: 4,
    rows: [
      { name: 'Разметка трасс по проекту ОВ', unit: 'пог. м', aosr: false },
      { name: 'Входной контроль воздуховодов и оборудования', unit: 'партия', aosr: false },
      { name: 'Отверстия и проёмы — только по КЖ ⚠️', unit: 'шт', aosr: false, critical: true },
      { name: 'Монтаж воздуховодов', unit: 'пог. м', aosr: false },
      { name: 'Крепления и подвесы', unit: 'шт', aosr: false },
      { name: 'Испытание на плотность', unit: '—', aosr: true },
      { name: 'Огнезащита и изоляция воздуховодов', unit: 'м²', aosr: false },
      { name: 'Освидетельствование до зашивки', unit: '—', aosr: true },
      { name: 'Монтаж оборудования', unit: 'шт', aosr: false },
      { name: 'Индивидуальные испытания', unit: '—', aosr: true },
      { name: 'Аэродинамические испытания и наладка', unit: '—', aosr: true },
      { name: 'Комплексное опробование', unit: '—', aosr: true },
    ],
  },
  {
    id: 'fasad',
    name: 'Фасад',
    sortOrder: 8,
    current: 5,
    rows: [
      { name: 'Приёмка основания, вынос отметок и вертикалей', unit: 'м²', aosr: false },
      { name: 'Монтаж лесов (выше 4 м — акт комиссии)', unit: 'м²', aosr: true },
      { name: 'Входной контроль утеплителя и крепежа', unit: 'партия', aosr: false },
      { name: 'Крепление кронштейнов / дюбелирование', unit: 'шт', aosr: true },
      { name: 'Монтаж утеплителя', unit: 'м²', aosr: true },
      { name: 'Мембрана или армирующий слой с сеткой', unit: 'м²', aosr: true },
      { name: 'Узлы: откосы, отливы, примыкания, швы', unit: 'пог. м', aosr: true },
      { name: 'Декоративный или облицовочный слой', unit: 'м²', aosr: false },
      { name: 'Приёмка захватки', unit: 'м²', aosr: false },
    ],
  },
  {
    id: 'krysha',
    name: 'Крыша',
    sortOrder: 9,
    current: 0,
    entryCondition: 'Раздел не начат · старт после приёмки монолита 16 этажа',
    rows: [
      { name: 'Приёмка основания: уклоны нивелиром, влажность', unit: 'м²', aosr: false },
      { name: 'Входной контроль материалов', unit: 'партия', aosr: false },
      { name: 'Пароизоляция с проклейкой стыков', unit: 'м²', aosr: true },
      { name: 'Утеплитель: марка, плотность, толщина', unit: 'м²', aosr: true },
      { name: 'Разуклонка / стяжка по утеплителю', unit: 'м²', aosr: false },
      { name: 'Гидроизоляция — слой 1', unit: 'м²', aosr: true },
      { name: 'Гидроизоляция — слой 2', unit: 'м²', aosr: true },
      { name: 'Узлы: примыкания, воронки, аэраторы, швы', unit: 'шт', aosr: true },
      { name: 'Парапетные отливы и фартуки', unit: 'пог. м', aosr: false },
      { name: 'Проверка герметичности (пролив водой)', unit: '—', aosr: true },
      { name: 'Молниезащита и заземление', unit: '—', aosr: true },
      { name: 'Приёмка кровли', unit: 'м²', aosr: true },
    ],
  },
];

/* ─────────────────────────────── Объекты ─────────────────────────────── */

export const OBJECTS = [
  {
    id: 'ak',
    code: 'АКО',
    name: 'ЖК «Ак-Орго»',
    address: 'ул. Ахунбаева, 121',
    city: 'Бишкек',
    blocks: [
      { name: 'Блок А', floors: 12 },
      { name: 'Блок Б', floors: 12 },
      { name: 'Блок В', floors: 12 },
    ],
    floorsTotal: 12,
    dueDate: '2026-11-30',
    pctPlan: 57,
    pctFact: 56.1,
    deltaDays: -1,
  },
  {
    id: 'bc',
    code: 'БЦ',
    name: 'ЖК «Бишкек Сити»',
    address: 'пр. Чуй, 210',
    city: 'Бишкек',
    blocks: [
      { name: 'Блок А', floors: 16 },
      { name: 'Блок Б', floors: 16 },
    ],
    floorsTotal: 16,
    dueDate: '2027-04-15',
    pctPlan: 47,
    pctFact: 44.1,
    deltaDays: -3,
  },
  {
    id: 'jal',
    code: 'ДЖР',
    name: 'Джал Резиденс',
    address: 'мкр. Джал, 23/1',
    city: 'Бишкек',
    blocks: [
      { name: 'Блок 1', floors: 9 },
      { name: 'Блок 2', floors: 9 },
      { name: 'Блок 3', floors: 9 },
      { name: 'Блок 4', floors: 9 },
    ],
    floorsTotal: 9,
    dueDate: '2026-02-28',
    pctPlan: 38,
    pctFact: 31.2,
    deltaDays: -9,
  },
  {
    id: 'sch',
    code: 'ШК94',
    name: 'Школа №94',
    address: 'ул. Ленина, 4',
    city: 'Ош',
    blocks: [{ name: 'Корпус', floors: 4 }],
    floorsTotal: 4,
    dueDate: '2026-08-20',
    pctPlan: 22,
    pctFact: 22,
    deltaDays: 0,
  },
] as const;

/* ─────────────────────────────── Люди ─────────────────────────────── */

export const USERS = [
  { login: 'a.zhumabekov', fullName: 'Азамат Жумабеков', phone: '+996 555 100 101', role: 'prorab', objectId: 'ak', blockName: 'Блок Б', scopeLabel: 'весь блок' },
  { login: 't.mamatov', fullName: 'Тилек Маматов', phone: '+996 555 100 102', role: 'master', objectId: 'ak', blockName: 'Блок Б', scopeLabel: '5 этаж — захватка' },
  { login: 'g.sadykova', fullName: 'Гульмира Садыкова', phone: '+996 555 100 103', role: 'pto', objectId: 'ak' },
  { login: 'n.toktomatov', fullName: 'Нурлан Токтоматов', phone: '+996 555 100 104', role: 'dir' },
  { login: 'n.tashiev', fullName: 'Нурлан Ташиев', phone: '+996 555 100 105', role: 'gi' },
  { login: 'e.bakirov', fullName: 'Эркин Бакиров', phone: '+996 555 100 106', role: 'snab' },
  { login: 'm.abdyldaev', fullName: 'Мирлан Абдылдаев', phone: '+996 555 100 107', role: 'sklad', objectId: 'ak' },
  { login: 'k.turgunov', fullName: 'Кубанычбек Тургунов', phone: '+996 555 100 108', role: 'tech' },
  { login: 'e.kasymov', fullName: 'Эрлан Касымов', phone: '+996 555 100 109', role: 'prorab', objectId: 'jal', blockName: 'Блок 2', scopeLabel: 'весь блок' },
  { login: 'b.usenov', fullName: 'Бакыт Усенов', phone: '+996 555 100 110', role: 'prorab', objectId: 'bc', blockName: 'Блок А', scopeLabel: 'весь блок' },
  { login: 'a.sultanov', fullName: 'Айбек Султанов', phone: '+996 555 100 111', role: 'master', objectId: 'bc', blockName: 'Блок А', scopeLabel: '3 этаж — захватка' },
] as const;

/* ─────────── Активные работы прораба Азамата (экран «Сегодня», три карточки) ─────────── */

export const ACTIVE_WORK = [
  {
    key: 'mono',
    sectionId: 'mono',
    processName: 'Армирование колонн и стен',
    blockName: 'Блок Б',
    floor: 7,
    unit: 'т',
    /** В прототипе план 7 100 и факт 4 830 кг; здесь та же величина в тоннах. */
    planQty: 7.1,
    doneQty: 4.83,
    yesterday: 0.85,
    dueDate: '2026-08-02',
    status: 'active' as const,
  },
  {
    key: 'klad',
    sectionId: 'klad',
    processName: 'Кладка яруса 2',
    blockName: 'Блок А',
    floor: 5,
    unit: 'шт',
    planQty: 24000,
    doneQty: 6000,
    yesterday: 2200,
    dueDate: '2026-08-05',
    status: 'active' as const,
  },
  {
    key: 'opal',
    sectionId: 'mono',
    processName: 'Монтаж опалубки перекрытия',
    blockName: 'Блок Б',
    floor: 6,
    unit: 'м²',
    planQty: 480,
    doneQty: 192,
    yesterday: 48,
    dueDate: '2026-08-08',
    status: 'active' as const,
  },
];

/* ─────────────────────────────── Заявки ─────────────────────────────── */

export const ZAYAVKI = [
  {
    number: 'ЗВ-АКО-26-0184',
    status: 'normalizing',
    material: 'Арматура А500С Ø12',
    rawText: 'арматура 12ка',
    qty: 4.2,
    unit: 'т',
    priority: 'urgent',
    createdAt: '2026-08-02T18:40:00',
    idleWorkers: 24,
    idleSince: '2026-08-02T17:20:00',
    idleCost: 84000,
    holderLogin: 'e.bakirov',
    timeline: [
      ['Отправлена', 'done', 'Азамат Ж. · 02.08, 18:40'],
      ['На рассмотрении', 'cur', 'Снабжение · Эркин Б. · ⏱ здесь 2 дня'],
    ],
  },
  {
    number: 'ЗВ-АКО-26-0179',
    status: 'inTransit',
    material: 'Цемент М400',
    rawText: 'цемент М400',
    qty: 12,
    unit: 'т',
    priority: 'norm',
    createdAt: '2026-07-28T09:00:00',
    deliveryBy: '2026-08-12',
    /** Придёт позже срока работ — это должно быть видно в карточке. */
    lateNote: '⚠ позже срока работ (08.08)',
  },
  {
    number: 'ЗВ-АКО-26-0181',
    status: 'purchasing',
    material: 'Опалубка щитовая',
    rawText: 'опалубка щитовая',
    qty: 120,
    unit: 'м²',
    priority: 'norm',
    createdAt: '2026-07-31T10:00:00',
  },
  {
    number: 'ЗВ-АКО-26-0177',
    status: 'ordered',
    material: 'Проволока вязальная',
    rawText: 'проволока вязальная',
    qty: 300,
    unit: 'кг',
    priority: 'norm',
    createdAt: '2026-07-29T10:00:00',
    deliveryBy: '2026-08-09',
  },
  {
    number: 'ЗВ-АКО-26-0175',
    status: 'inTransit',
    material: 'Электроды',
    rawText: 'электроды',
    qty: 40,
    unit: 'кг',
    priority: 'norm',
    createdAt: '2026-07-27T10:00:00',
    deliveryBy: '2026-08-07',
  },
  {
    number: 'ЗВ-АКО-26-0172',
    status: 'closed',
    material: 'Цемент М400',
    rawText: 'цемент М400',
    qty: 24,
    unit: 'т',
    priority: 'norm',
    createdAt: '2026-07-20T10:00:00',
    deliveryBy: '2026-07-28',
  },
  {
    number: 'ЗВ-АКО-26-0168',
    status: 'closed',
    material: 'Арматура А500С Ø8',
    rawText: 'арматура 8',
    qty: 2.1,
    unit: 'т',
    priority: 'norm',
    createdAt: '2026-07-18T10:00:00',
    deliveryBy: '2026-07-25',
  },
] as const;

/* ─────────────────── Справочник материалов (растёт из формулировок) ─────────────────── */

export const CATALOG = [
  { name: 'Арматура А500С Ø12', unit: 'т', aliases: ['арматура 12ка', 'арматура 12', 'ø12'] },
  { name: 'Арматура А500С Ø10', unit: 'т', aliases: ['арматура 10'] },
  { name: 'Арматура А500С Ø8', unit: 'т', aliases: ['арматура 8'] },
  { name: 'Цемент М400', unit: 'т', aliases: ['цемент', 'цемент 400'] },
  { name: 'Бетон М350', unit: 'м³', aliases: ['бетон 350'] },
  { name: 'Проволока вязальная', unit: 'кг', aliases: ['вязалка'] },
  { name: 'Опалубка щитовая', unit: 'м²', aliases: ['щиты'] },
  { name: 'Электроды', unit: 'кг', aliases: [] },
  { name: 'Кирпич керамический М150', unit: 'шт', aliases: ['кирпич'] },
] as const;

/** Остатки на объекте — форма заявки показывает их до отправки. */
export const STOCK = [
  { objectId: 'ak', item: 'Арматура А500С Ø12', qty: 0.4, unit: 'т', specRemainder: 2.3, hasPassport: true },
  { objectId: 'ak', item: 'Цемент М400', qty: 8, unit: 'т', specRemainder: 14, hasPassport: true },
  { objectId: 'ak', item: 'Проволока вязальная', qty: 45, unit: 'кг', specRemainder: 260, hasPassport: true },
  { objectId: 'ak', item: 'Кирпич керамический М150', qty: 12400, unit: 'шт', specRemainder: 18000, hasPassport: false },
] as const;

/* ─────────────────────────────── Подрядчики ─────────────────────────────── */

export const CONTRACTORS = [
  {
    name: 'ИП Асанов',
    scope: 'Кладка · Блок А',
    activeWorkers: 12,
    auto: { onTime: 2.4, rework: 2.6, safety: 1.8, docs: 3.4 },
    manual: { quality: 3, safety: 2, management: 3, culture: 3 },
    prescriptions: [
      {
        number: '№7',
        kind: 'safety',
        text: 'Работы приостановлены — нарушение ТБ: работа на высоте без страховочной системы',
        location: 'Блок А, 5 эт.',
        dueDays: 1,
        issuedAt: '2026-08-01',
      },
    ],
  },
  {
    name: 'ОсОО «МонолитСтрой»',
    scope: 'Монолит · Блок Б',
    activeWorkers: 18,
    auto: { onTime: 4.4, rework: 4.1, safety: 4.2, docs: 4.1 },
    manual: { quality: 4, safety: 4, management: 4, culture: 5 },
    prescriptions: [],
  },
  {
    name: 'ОсОО «ФасадПро»',
    scope: 'Фасад · Блок В',
    activeWorkers: 0,
    auto: { onTime: 4.8, rework: 4.6, safety: 4.7, docs: 4.7 },
    manual: { quality: 5, safety: 5, management: 4, culture: 5 },
    prescriptions: [],
  },
] as const;

/* ─────────────────────────────── Финансы ─────────────────────────────── */

export const FINANCE = [
  { objectId: 'bc', budget: 620, ev: 273, ac: 289, closedByActs: 244, receivable: 29 },
  { objectId: 'jal', budget: 350, ev: 109, ac: 121, closedByActs: 88, receivable: 21 },
  { objectId: 'ak', budget: 480, ev: 269, ac: 268, closedByActs: 252, receivable: 17 },
] as const;

export const COST_ARTICLES = [
  { name: 'Материалы', amount: 325, note: '+8% к плану' },
  { name: 'ФОТ', amount: 183 },
  { name: 'Субподряд', amount: 95 },
  { name: 'Техника', amount: 48 },
  { name: 'Накладные', amount: 27 },
] as const;

export const PAYMENTS = [
  { objectId: 'ak', name: 'Цемент «Кант»', amount: 4.2, dueDate: '2026-08-06', status: 'approved' },
  { objectId: 'bc', name: 'ФОТ бригады', amount: 6.8, dueDate: '2026-08-07', status: 'pending', aboveLimit: true },
  { objectId: 'bc', name: 'Субподряд «Электромонтаж»', amount: 3.1, dueDate: '2026-08-08', status: 'overdue' },
  { objectId: 'jal', name: 'Арматура', amount: 5.4, dueDate: '2026-08-11', status: 'draft' },
] as const;

/** Лимит автономности — до какой суммы решение принимается без директора. */
export const AUTONOMY_LIMITS = [
  { role: 'gi', scope: 'payment', limit: 5 },
  { role: 'gi', scope: 'zayavka', limit: 3 },
  { role: 'pto', scope: 'zayavka', limit: 1 },
  { role: 'snab', scope: 'zayavka', limit: 2 },
] as const;

/* ─────────────────────────────── Задачи и проблемы ─────────────────────────────── */

export const TASKS = [
  { text: 'Закрыть вопрос с опалубкой на Блоке 2', objectId: 'jal', assignee: 'e.kasymov', due: '2026-08-01', origin: 'inbox' },
  { text: 'Передать исполнительную по 5 этажу', objectId: 'ak', assignee: 'g.sadykova', due: '2026-08-03', origin: 'inbox' },
  { text: 'Проверить поставку бетона М350', objectId: 'ak', assignee: 'a.zhumabekov', due: '2026-08-04', origin: 'manual' },
  { text: 'Подготовить график работ на сентябрь', objectId: 'ak', assignee: 'g.sadykova', due: '2026-08-08', origin: 'manual' },
  { text: 'Согласовать субподряд по фасаду', objectId: 'jal', assignee: 'e.bakirov', due: '2026-08-08', origin: 'manual' },
] as const;

export const INCIDENTS = [
  {
    objectId: 'ak',
    kind: 'idle',
    title: 'Простой · 24 чел с 17:20',
    detail: 'Армирование колонн · Блок Б, 7 эт. · нет арматуры Ø12 · расчёт по ставкам',
    workersIdle: 24,
    cost: 84000,
  },
  {
    objectId: 'jal',
    kind: 'delay',
    title: 'Монолит отстаёт на 12 дней',
    detail: 'Критический путь · темп 22 м³/день против 30 по графику',
    cost: 1200000,
  },
  {
    objectId: 'ak',
    kind: 'safety',
    title: 'Нарушение ТБ · ИП Асанов',
    detail: 'Работа на высоте без страховки · Блок А, 5 эт. · работы приостановлены',
    cost: 0,
  },
] as const;

/* ─────────────────────────────── Спецтехника ─────────────────────────────── */

export const MACHINES = [
  { name: 'Кран КБ-408 №2', kind: 'Кран', status: 'busy', nextServiceAt: '2026-08-20', permitUntil: '2027-01-15' },
  { name: 'Экскаватор JCB 3CX', kind: 'Экскаватор', status: 'free', nextServiceAt: '2026-08-15', permitUntil: '2026-12-01' },
  { name: 'Автобетононасос Putzmeister', kind: 'Автобетононасос', status: 'free', nextServiceAt: '2026-09-02', permitUntil: '2027-03-10' },
  { name: 'Самосвал Howo №4', kind: 'Самосвал', status: 'repair', nextServiceAt: '2026-08-09', permitUntil: '2026-11-20' },
] as const;

/** Чек-лист готовности фронта — без него заявка на технику не уходит. */
export const FRONT_CHECKLIST = [
  { key: 'access', label: 'Подъезд свободен, площадка под опоры готова' },
  { key: 'people', label: 'Стропальщик с удостоверением на смене' },
  { key: 'front', label: 'Фронт работ размечен и освобождён' },
  { key: 'power', label: 'Питание / подключение обеспечено' },
  { key: 'safety', label: 'Опасная зона огорожена, схема согласована' },
] as const;

/* ─────────────────────────────── Проект и документы ─────────────────────────────── */

export const DRAWING_SETS = [
  {
    objectId: 'ak',
    stage: 'РД',
    mark: 'КЖ',
    name: 'Конструкции железобетонные',
    revision: 'изм. 4',
    issuedAt: '2026-07-28',
    sheets: [
      {
        number: 'КЖ-12',
        name: 'Армирование колонн и стен, 7 эт.',
        // Тот самый лист из прототипа: работали по изм. 3, пока не вышло изм. 4.
        history: [
          {
            revision: 'изм. 3',
            issuedAt: '2026-07-02',
            changeSummary: 'Исходная выдача рабочей документации',
            superseded: true,
            supersededAt: '2026-07-28',
          },
          {
            revision: 'изм. 4',
            issuedAt: '2026-07-28',
            changeSummary: 'Изменён шаг хомутов в колоннах К-3',
            superseded: false,
          },
        ],
      },
      {
        number: 'КЖ-14',
        name: 'Армирование перекрытия, отм. +21,000',
        history: [
          {
            revision: 'изм. 2',
            issuedAt: '2026-07-15',
            changeSummary: 'Уточнены отметки низа плиты',
            superseded: false,
          },
        ],
      },
    ],
  },
  {
    objectId: 'ak',
    stage: 'РД',
    mark: 'ЭОМ',
    name: 'Электрооборудование и освещение',
    revision: 'изм. 2',
    issuedAt: '2026-06-30',
    sheets: [
      {
        number: 'ЭОМ-5',
        name: 'План силовой разводки, 7 эт.',
        history: [
          {
            revision: 'изм. 2',
            issuedAt: '2026-06-30',
            changeSummary: 'Перенесены точки подключения',
            superseded: false,
          },
        ],
      },
    ],
  },
] as const;

export const RFIS = [
  {
    number: 'RFI-014',
    objectId: 'ak',
    authorLogin: 'a.zhumabekov',
    question:
      'КЖ-12.1 и ЭОМ-5 расходятся: гильза Ø100 в колонне К-3 попадает в зону хомутов. Как выполнять?',
    createdAt: '2026-08-01',
    dueAt: '2026-08-06',
    status: 'open',
  },
] as const;

export const DOCUMENTS = [
  { objectId: 'ak', kind: 'aosr', number: 'АОСР-31', name: 'Испытание давлением ХВС/ГВС, 5 эт.', status: 'signed', signedAt: '2026-08-02' },
  { objectId: 'ak', kind: 'aosr', number: 'АОСР-28', name: 'Геодезия: вынос осей 7 эт.', status: 'signed', signedAt: '2026-08-02' },
  { objectId: 'ak', kind: 'aosr', number: 'АОСР-33', name: 'Армирование колонн и стен, 7 эт.', status: 'draft' },
  { objectId: 'ak', kind: 'journal', number: 'ОЖР-1', name: 'Общий журнал работ', status: 'signed' },
] as const;

/** Протокол прочности бетона — шлюз: без него распалубка не открывается. */
export const STRENGTH_PROTOCOLS = [
  {
    objectId: 'ak',
    processName: 'Бетонирование колонн и стен',
    blockName: 'Блок Б',
    floor: 6,
    pouredAt: '2026-07-30',
    sampleAt: '2026-08-06',
    strengthPct: 62,
    requiredPct: 70,
    labName: 'Лаборатория «СтройТест»',
    status: 'awaiting',
  },
] as const;

/* ─────────────────────────────── KPI ─────────────────────────────── */

export const KPI = [
  {
    key: 'field',
    label: 'Площадка',
    metrics: [
      { key: 'reportsOnTime', label: 'Отчёты в срок', value: 92, unit: '%', goodAbove: 90 },
      { key: 'idleHours', label: 'Простои', value: 34, unit: 'ч/мес', goodBelow: 20 },
      { key: 'overspend', label: 'Перерасход к ВОР', value: 8, unit: '%', goodBelow: 5 },
    ],
  },
  {
    key: 'pto',
    label: 'ПТО',
    metrics: [
      { key: 'actsOnTime', label: 'Акты в срок', value: 78, unit: '%', goodAbove: 85 },
      { key: 'docsReady', label: 'Готовность исполнительной', value: 64, unit: '%', goodAbove: 80 },
      { key: 'returns', label: 'Возвраты отчётов', value: 11, unit: '%', goodBelow: 10 },
    ],
  },
  {
    key: 'mat',
    label: 'Материалы',
    metrics: [
      { key: 'leadTime', label: 'Заявка → поставка', value: 6.2, unit: 'дн', goodBelow: 5 },
      { key: 'stockDiff', label: 'Расхождение остатка', value: 3, unit: '%', goodBelow: 2 },
      { key: 'noPassport', label: 'Материал без паспорта', value: 2, unit: 'шт', goodBelow: 1 },
    ],
  },
  {
    key: 'tech',
    label: 'Техника',
    metrics: [
      { key: 'utilization', label: 'Коэффициент использования', value: 71, unit: '%', goodAbove: 75 },
      { key: 'downtime', label: 'Простой по неисправности', value: 18, unit: 'ч/мес', goodBelow: 12 },
    ],
  },
] as const;
