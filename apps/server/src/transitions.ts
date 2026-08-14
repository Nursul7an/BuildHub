/**
 * Статусные машины. ТЗ §5, критерий приёмки 3.
 *
 * Каждый переход — тройка «из состояния → в состояние → роль, имеющая право».
 * Недопустимый переход возвращает 409 с машиночитаемым кодом, и состояние
 * не меняется. Таблица лежит здесь, а не растекается по обработчикам:
 * иначе через полгода никто не ответит, какие переходы вообще существуют.
 */
import type { Role } from '@build-hub/shared';

export type Machine = 'process' | 'report' | 'materialRequest' | 'equipmentRequest' | 'inspection' | 'batch' | 'task';

export interface Transition {
  from: string;
  to: string;
  roles: Role[];
  /** Человеческое название перехода — попадает в аудит и в историю сущности. */
  label: string;
}

const ALL_FIELD: Role[] = ['prorab', 'master'];

export const MACHINES: Record<Machine, Transition[]> = {
  /** Процесс: не начат → в работе → предъявлен → принят, с веткой «заблокирован». */
  process: [
    { from: 'idle', to: 'active', roles: [...ALL_FIELD], label: 'Начата работа' },
    { from: 'active', to: 'presented', roles: ['prorab'], label: 'Предъявлен к освидетельствованию' },
    { from: 'presented', to: 'accepted', roles: ['pto'], label: 'Принят по АОСР' },
    { from: 'presented', to: 'active', roles: ['pto'], label: 'Возвращён с замечаниями' },
    { from: 'idle', to: 'blocked', roles: ['pto', 'gi'], label: 'Заблокирован' },
    { from: 'active', to: 'blocked', roles: ['pto', 'gi'], label: 'Заблокирован' },
    // Снять блокировку вручную может только главный инженер и только с обоснованием.
    { from: 'blocked', to: 'active', roles: ['gi'], label: 'Разблокирован главным инженером' },
    { from: 'blocked', to: 'idle', roles: ['gi'], label: 'Разблокирован главным инженером' },
  ],

  /** Дневной отчёт: черновик → отправлен → на согласовании → согласован / возвращён. */
  report: [
    { from: 'draft', to: 'atForeman', roles: ['master'], label: 'Отправлен прорабу' },
    { from: 'draft', to: 'atPto', roles: ['prorab'], label: 'Отправлен в ПТО' },
    { from: 'returned', to: 'atForeman', roles: ['master'], label: 'Отправлен повторно' },
    { from: 'returned', to: 'atPto', roles: ['prorab'], label: 'Отправлен повторно' },
    { from: 'atForeman', to: 'atPto', roles: ['prorab'], label: 'Подтверждён прорабом' },
    { from: 'atForeman', to: 'returned', roles: ['prorab'], label: 'Возвращён мастеру' },
    { from: 'atPto', to: 'accepted', roles: ['pto'], label: 'Согласован ПТО' },
    { from: 'atPto', to: 'adjusted', roles: ['pto'], label: 'Скорректирован ПТО' },
    { from: 'atPto', to: 'returned', roles: ['pto'], label: 'Возвращён с замечанием' },
    { from: 'adjusted', to: 'accepted', roles: ['pto'], label: 'Согласован после корректировки' },
  ],

  /** Заявка на материал. Согласование — только снабжение, приёмка — прораб или завсклад. */
  materialRequest: [
    { from: 'draft', to: 'atForeman', roles: ['master'], label: 'На согласование прорабу' },
    { from: 'atForeman', to: 'new', roles: ['prorab'], label: 'Согласована прорабом' },
    { from: 'atForeman', to: 'rejected', roles: ['prorab'], label: 'Отклонена прорабом' },
    { from: 'draft', to: 'new', roles: ['prorab'], label: 'Отправлена' },
    { from: 'new', to: 'normalizing', roles: ['snab'], label: 'Взята в работу снабжением' },
    { from: 'new', to: 'approved', roles: ['snab'], label: 'Согласована' },
    { from: 'normalizing', to: 'approved', roles: ['snab'], label: 'Позиция сопоставлена' },
    { from: 'normalizing', to: 'rejected', roles: ['snab'], label: 'Отклонена' },
    { from: 'approved', to: 'purchasing', roles: ['snab'], label: 'В закупке' },
    { from: 'purchasing', to: 'ordered', roles: ['snab'], label: 'Заказана у поставщика' },
    { from: 'ordered', to: 'inTransit', roles: ['snab'], label: 'В пути' },
    { from: 'inTransit', to: 'delivered', roles: ['snab', 'sklad'], label: 'Доставлена' },
    { from: 'inTransit', to: 'accepted', roles: ['prorab', 'sklad'], label: 'Принята на объекте' },
    { from: 'delivered', to: 'accepted', roles: ['prorab', 'sklad'], label: 'Принята на объекте' },
    { from: 'accepted', to: 'closed', roles: ['snab', 'sklad', 'prorab'], label: 'Закрыта' },
  ],

  /** Заявка на технику. Назначение блокируется без документов машины и допуска машиниста. */
  equipmentRequest: [
    { from: 'draft', to: 'new', roles: [...ALL_FIELD], label: 'Отправлена' },
    { from: 'new', to: 'assigned', roles: ['tech'], label: 'Назначена машина' },
    { from: 'assigned', to: 'confirmed', roles: ['tech'], label: 'Подтверждена' },
    { from: 'confirmed', to: 'inProgress', roles: ['tech'], label: 'Выполняется' },
    { from: 'inProgress', to: 'done', roles: ['tech'], label: 'Работа выполнена' },
    { from: 'done', to: 'closed', roles: ['tech'], label: 'Закрыта' },
    { from: 'new', to: 'rejected', roles: ['tech'], label: 'Отклонена' },
  ],

  /** Предъявление: дата осмотра не ранее 3 рабочих дней от извещения. */
  inspection: [
    { from: 'prepared', to: 'notified', roles: ['prorab'], label: 'Извещение отправлено' },
    { from: 'notified', to: 'scheduled', roles: ['pto'], label: 'Осмотр назначен' },
    { from: 'scheduled', to: 'accepted', roles: ['pto'], label: 'Принято' },
    { from: 'scheduled', to: 'remarks', roles: ['pto'], label: 'Замечания' },
    { from: 'remarks', to: 'prepared', roles: ['prorab'], label: 'Замечания устранены' },
  ],

  /** Партия материала: без паспорта расходовать нельзя. */
  batch: [
    { from: 'accepted', to: 'allowed', roles: ['pto'], label: 'Допущена' },
    { from: 'accepted', to: 'flagged', roles: ['prorab', 'sklad', 'pto'], label: 'Помечена без паспорта' },
    { from: 'flagged', to: 'allowed', roles: ['pto'], label: 'Паспорт получен, допущена' },
    { from: 'flagged', to: 'withdrawn', roles: ['pto', 'gi'], label: 'Изъята' },
  ],

  /** Задача руководителю. */
  task: [
    { from: 'open', to: 'inProgress', roles: ['dir', 'gi', 'prorab', 'pto', 'snab', 'tech', 'sklad'], label: 'В работе' },
    { from: 'inProgress', to: 'done', roles: ['dir', 'gi', 'prorab', 'pto', 'snab', 'tech', 'sklad'], label: 'Решена' },
    { from: 'open', to: 'done', roles: ['dir', 'gi', 'prorab', 'pto', 'snab', 'tech', 'sklad'], label: 'Решена' },
    { from: 'open', to: 'deferred', roles: ['dir', 'gi'], label: 'Отложена' },
    { from: 'open', to: 'escalated', roles: ['gi', 'pto', 'prorab'], label: 'Эскалирована' },
    { from: 'inProgress', to: 'escalated', roles: ['gi', 'pto', 'prorab'], label: 'Эскалирована' },
  ],
};

export type TransitionCheck =
  | { ok: true; transition: Transition }
  | { ok: false; code: 'unknown_transition' | 'role_not_allowed'; message: string; allowed: string[] };

/**
 * Разрешён ли переход. Различаем два отказа: перехода не существует вовсе
 * и переход есть, но не для этой роли — клиенту это разные сообщения.
 */
export function checkTransition(machine: Machine, from: string, to: string, role: Role): TransitionCheck {
  const table = MACHINES[machine];
  const candidates = table.filter((t) => t.from === from && t.to === to);

  if (candidates.length === 0) {
    return {
      ok: false,
      code: 'unknown_transition',
      message: `Переход «${from}» → «${to}» не предусмотрен`,
      allowed: table.filter((t) => t.from === from).map((t) => t.to),
    };
  }

  const permitted = candidates.find((t) => t.roles.includes(role));
  if (!permitted) {
    return {
      ok: false,
      code: 'role_not_allowed',
      message: `Этот переход выполняет другая роль: ${[...new Set(candidates.flatMap((c) => c.roles))].join(', ')}`,
      allowed: table.filter((t) => t.from === from && t.roles.includes(role)).map((t) => t.to),
    };
  }

  return { ok: true, transition: permitted };
}

/** Куда роль может увести сущность из текущего состояния — для кнопок клиента. */
export function availableTransitions(machine: Machine, from: string, role: Role): Transition[] {
  return MACHINES[machine].filter((t) => t.from === from && t.roles.includes(role));
}
