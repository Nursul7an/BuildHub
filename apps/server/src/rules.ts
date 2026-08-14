/**
 * Правила предметной области.
 *
 * Это не подсказки интерфейса, а ограничения: прототип рисует замок и причину
 * блокировки, но держать их должен сервер — иначе шлюз обходится любым клиентом.
 */
import { prisma } from './db.js';
import { FALLBACK, getThreshold } from './thresholds.js';

/**
 * Значения по умолчанию. Рабочие берутся из справочника порогов (ТЗ §9):
 * на разных объектах ППР задаёт разные нормы, и хранить их в коде нельзя.
 */
export const WINTER_TEMP_C = FALLBACK.winterTempC;
export const PRESENT_LEAD_WORKDAYS = FALLBACK.presentLeadWorkdays;

export function addWorkdays(from: Date, days: number): Date {
  const d = new Date(from);
  let left = days;
  while (left > 0) {
    d.setDate(d.getDate() + 1);
    const day = d.getDay();
    if (day !== 0 && day !== 6) left -= 1;
  }
  return d;
}

export function isValidPresentationDate(
  scheduledFor: Date,
  now = new Date(),
  leadWorkdays = PRESENT_LEAD_WORKDAYS,
): boolean {
  const earliest = addWorkdays(now, leadWorkdays);
  earliest.setHours(0, 0, 0, 0);
  const target = new Date(scheduledFor);
  target.setHours(0, 0, 0, 0);
  return target.getTime() >= earliest.getTime();
}

export interface RuleFailure {
  code: string;
  message: string;
}

/**
 * Можно ли предъявлять процесс к освидетельствованию.
 * Кнопка в макете неактивна до 100% — здесь то же самое, но обязательно.
 */
export async function checkCanPresent(processStateId: string): Promise<RuleFailure | null> {
  const state = await prisma.processState.findUnique({
    where: { id: processStateId },
    include: { processDef: true },
  });
  if (!state) return { code: 'not_found', message: 'Процесс не найден' };
  if (state.status === 'blocked') {
    return { code: 'blocked', message: state.blockedReason ?? 'Процесс заблокирован' };
  }
  if (state.status === 'presented') {
    return { code: 'already_presented', message: 'Уже предъявлен — ждём технадзор' };
  }
  if (state.status === 'accepted') {
    return { code: 'already_accepted', message: 'Процесс уже принят' };
  }
  if (state.planQty > 0 && state.doneQty < state.planQty) {
    return {
      code: 'not_complete',
      message: 'Предъявление доступно при 100% выполнения',
    };
  }
  return null;
}

/**
 * Пересчёт блокировок цепочки: процесс, следующий за требующим АОСР,
 * стоит, пока акт не подписан. Причина пишется в строку, а не прячется в диалог.
 */
export async function recomputeChainBlocks(objectId: string, blockId: string, floor: number, sectionId: string) {
  const states = await prisma.processState.findMany({
    where: { objectId, blockId, floor, processDef: { sectionId } },
    include: { processDef: true },
    orderBy: { processDef: { order: 'asc' } },
  });

  for (const [i, state] of states.entries()) {
    if (state.status === 'accepted' || state.status === 'presented') continue;

    const blocker = states
      .slice(0, i)
      .reverse()
      .find((prev) => prev.processDef.requiresAosr && prev.status !== 'accepted');

    if (blocker) {
      if (state.status !== 'blocked' || state.blockedReason === null) {
        await prisma.processState.update({
          where: { id: state.id },
          data: {
            status: 'blocked',
            blockedReason: `заблокирован — нет АОСР на «${blocker.processDef.name}»`,
          },
        });
      }
    } else if (state.status === 'blocked' && state.blockedReason?.startsWith('заблокирован — нет АОСР')) {
      await prisma.processState.update({
        where: { id: state.id },
        data: { status: state.doneQty > 0 ? 'active' : 'idle', blockedReason: null },
      });
    }
  }
}

/**
 * Шлюз распалубки: пока протокол прочности не набран, процесс держится.
 * В прототипе это отдельный экран DC4; правило живёт здесь.
 */
export async function checkStrengthGate(processStateId: string): Promise<RuleFailure | null> {
  const state = await prisma.processState.findUnique({
    where: { id: processStateId },
    include: { processDef: true },
  });
  if (!state) return null;
  if (!/распалубк/i.test(state.processDef.name)) return null;

  const protocol = await prisma.concreteStrengthProtocol.findFirst({
    where: { processStateId: { not: processStateId }, objectId: state.objectId, status: { not: 'passed' } },
    orderBy: { sampleAt: 'desc' },
  });
  if (protocol) {
    return {
      code: 'strength_gate',
      message: `Распалубка закрыта — прочность ${protocol.strengthPct}% из требуемых ${protocol.requiredPct}%`,
    };
  }
  return null;
}

/** Запись в отчёт: минимум одно фото и зимний метод при низкой температуре. */
export function checkReportEntry(
  entry: {
    photos: unknown[];
    tempAir?: number | null;
    winterMethod?: string | null;
    volume: number;
  },
  winterTempC: number = WINTER_TEMP_C,
): RuleFailure | null {
  if (!(entry.volume > 0)) {
    return { code: 'no_volume', message: 'Введите объём за сегодня' };
  }
  if (entry.photos.length === 0) {
    return { code: 'no_photo', message: 'Минимум 1 фото — обязательно' };
  }
  if (
    entry.tempAir !== undefined &&
    entry.tempAir !== null &&
    entry.tempAir < winterTempC &&
    !entry.winterMethod
  ) {
    return {
      code: 'no_winter_method',
      message: `При ${entry.tempAir} °C укажите применённый метод зимнего бетонирования`,
    };
  }
  return null;
}

/** Заявка на технику не уходит, пока фронт не готов целиком. */
export function checkFrontChecklist(
  checklist: { key: string; label: string; checked: boolean }[],
): RuleFailure | null {
  const missing = checklist.filter((c) => !c.checked);
  if (missing.length > 0) {
    return {
      code: 'front_not_ready',
      message: `Фронт не готов: ${missing.map((m) => m.label.toLowerCase()).join('; ')}`,
    };
  }
  return null;
}

/** Сумма выше лимита автономности уходит директору, а не проводится ролью. */
export async function needsEscalation(role: string, scope: string, amount: number): Promise<boolean> {
  const limit = await prisma.autonomyLimit.findUnique({ where: { role_scope: { role, scope } } });
  if (!limit) return true;
  return amount > limit.limit;
}
