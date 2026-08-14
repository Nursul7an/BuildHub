/**
 * Роли системы. Соответствуют переключателю ролей в прототипе
 * («Прототип - всё приложение.dc.html», левая колонка).
 */
export const ROLES = ['prorab', 'master', 'pto', 'dir', 'gi', 'snab', 'sklad', 'tech'] as const;
export type Role = (typeof ROLES)[number];

/** Группа ролей — определяет набор табов нижней навигации. */
export const ROLE_GROUPS = ['field', 'pto', 'boss', 'mat', 'tech'] as const;
export type RoleGroup = (typeof ROLE_GROUPS)[number];

export const ROLE_GROUP_OF: Record<Role, RoleGroup> = {
  prorab: 'field',
  master: 'field',
  pto: 'pto',
  dir: 'boss',
  gi: 'boss',
  snab: 'mat',
  sklad: 'mat',
  tech: 'tech',
};

export const ROLE_TITLE: Record<Role, string> = {
  prorab: 'Прораб',
  master: 'Мастер',
  pto: 'Инженер ПТО',
  dir: 'Директор',
  gi: 'Главный инженер',
  snab: 'Снабжение',
  sklad: 'Завскладом',
  tech: 'Спецтехника',
};

/**
 * Права. Матрица из ТЗ «единый модуль Материалы» и «Руководитель и Главный инженер»:
 * роль = права и область, экраны общие.
 */
export type Permission =
  | 'report.create' // вносить объём за день
  | 'report.approveFromMaster' // прораб принимает отчёт мастера
  | 'report.check' // ПТО проверяет / корректирует / возвращает
  | 'zayavka.create'
  | 'zayavka.approve' // прораб согласует заявку мастера
  | 'zayavka.normalize' // снабжение сопоставляет позицию со справочником
  | 'zayavka.purchase'
  | 'material.accept' // приёмка на объекте
  | 'material.issue' // выдача под роспись (завсклад)
  | 'contractor.rate'
  | 'contractor.prescription' // выдать предписание (прораб; мастер только фиксирует)
  | 'process.present' // предъявить к освидетельствованию
  | 'process.chainEdit' // ПТО настраивает цепочку
  | 'aosr.draft'
  | 'users.manage' // ПТО / ГИ — админка
  | 'objects.manage' // ГИ — создание и изменение объектов
  | 'tasks.assign' // ГИ — сроки прорабам
  | 'tasks.issue' // руководство — поручения
  | 'finance.view'
  | 'finance.approvePayment'
  | 'limits.manage' // директор — лимиты автономности
  | 'quality.stopWork' // только ГИ
  | 'kpi.view'
  | 'tech.dispatch';

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  master: ['report.create', 'zayavka.create', 'material.accept', 'process.present'],
  prorab: [
    'report.create',
    'report.approveFromMaster',
    'zayavka.create',
    'zayavka.approve',
    'material.accept',
    'process.present',
    'contractor.rate',
    'contractor.prescription',
  ],
  pto: ['report.check', 'process.chainEdit', 'aosr.draft', 'users.manage', 'objects.manage'],
  dir: ['finance.view', 'finance.approvePayment', 'limits.manage', 'tasks.issue', 'kpi.view'],
  gi: [
    'finance.view',
    // Проводит платежи в пределах своего лимита автономности; выше — уходит директору.
    // Без этого права лимит из настроек директора не может сработать ни разу.
    'finance.approvePayment',
    'tasks.issue',
    'tasks.assign',
    'objects.manage',
    'users.manage',
    'quality.stopWork',
    'kpi.view',
  ],
  snab: ['zayavka.normalize', 'zayavka.purchase'],
  sklad: ['material.accept', 'material.issue'],
  tech: ['tech.dispatch'],
};

export function can(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
