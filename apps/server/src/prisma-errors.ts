/**
 * Ошибки базы, переведённые в ответы API. ТЗ §6.
 *
 * Нарушение ограничения — это отказ по данным, а не сбой: код объекта
 * занят, запись уже удалили, ссылка ведёт в никуда. Ответ «Внутренняя
 * ошибка сервера» на такое врёт дважды — пользователь не понимает, что
 * исправить, а дежурный идёт разбирать аварию, которой нет.
 *
 * Разбор общий на весь API: иначе каждый новый маршрут пришлось бы
 * помнить обернуть, и однажды его забудут.
 */

export interface PrismaFailure {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

/** Человеческие названия полей: «code» в сообщении прорабу ни о чём. */
const FIELD_NAMES: Record<string, string> = {
  code: 'код',
  login: 'логин',
  phone: 'телефон',
  key: 'ключ файла',
  name: 'название',
  number: 'номер',
  clientOpId: 'идентификатор операции',
  refreshHash: 'сессия',
};

function readable(fields: string[]): string {
  if (fields.length === 0) return 'значение';
  return fields.map((f) => FIELD_NAMES[f] ?? f).join(', ');
}

function targetOf(meta: unknown): string[] {
  const target = (meta as { target?: unknown } | undefined)?.target;
  if (Array.isArray(target)) return target.filter((t): t is string => typeof t === 'string');
  if (typeof target === 'string') return [target];
  return [];
}

/**
 * Опознаём по коду и форме, а не по instanceof: у Prisma классы ошибок
 * приходят из своего пакета, и при двух копиях в дереве зависимостей
 * проверка типом тихо перестаёт срабатывать.
 */
export function prismaFailure(error: unknown): PrismaFailure | null {
  const err = error as { code?: unknown; meta?: unknown; name?: unknown };
  if (typeof err?.code !== 'string' || !/^P\d{4}$/.test(err.code)) return null;

  switch (err.code) {
    case 'P2002': {
      const fields = targetOf(err.meta);
      return {
        status: 409,
        code: 'already_exists',
        message: `Такое значение уже занято: ${readable(fields)}`,
        details: fields.length > 0 ? { fields } : undefined,
      };
    }

    case 'P2025':
      // Обновление или удаление того, чего уже нет.
      return {
        status: 404,
        code: 'not_found',
        message: 'Запись не найдена — возможно, её уже изменили',
      };

    case 'P2003':
      // Ссылка на несуществующую запись: выбрали объект, который удалили.
      return {
        status: 409,
        code: 'reference_missing',
        message: 'Связанная запись не найдена — обновите список и повторите',
      };

    case 'P2000':
      return {
        status: 400,
        code: 'value_too_long',
        message: 'Значение слишком длинное для этого поля',
      };

    default:
      // Остальные коды — это действительно сбой: пусть идут в журнал
      // как пятисотые, а не маскируются под отказ по данным.
      return null;
  }
}
