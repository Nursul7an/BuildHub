/**
 * Настройки развёртывания.
 *
 * Значения по умолчанию удобны в разработке и опасны в проде. Секрет
 * подписи лежит в открытом репозитории: если он останется в развёрнутой
 * системе, любой, кто видел исходники, подделает токен директора. Поэтому
 * в проде отсутствие секрета — это отказ запуститься, а не предупреждение
 * в журнале, которое никто не прочитает.
 */

/** Секрет для разработки и тестов. В проде запрещён явной проверкой ниже. */
const DEV_SECRET = 'build-hub-dev-secret-change-me';

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Секрет подписи токенов.
 *
 * Длину проверяем тоже: короткий секрет подбирается, а HMAC-SHA256
 * не становится крепче от того, что ключ выглядит как пароль.
 */
export function jwtSecret(): string {
  const value = process.env.JWT_SECRET;

  if (!isProduction()) return value ?? DEV_SECRET;

  if (!value || value === DEV_SECRET) {
    throw new Error(
      'JWT_SECRET не задан или совпадает с отладочным значением из репозитория. ' +
        'Задайте случайный секрет: openssl rand -hex 32',
    );
  }
  if (value.length < 32) {
    throw new Error('JWT_SECRET короче 32 символов — задайте: openssl rand -hex 32');
  }
  return value;
}

/**
 * Секрет подписи ссылок на файлы. Отдельный от токенного: утечка одного
 * не должна отдавать другое. По умолчанию берём токенный — так ссылки
 * работают сразу, а разделение остаётся возможным.
 */
export function fileSigningSecret(): string {
  const value = process.env.FILE_SIGNING_SECRET;

  if (!isProduction()) return value ?? process.env.JWT_SECRET ?? DEV_SECRET;

  if (value === DEV_SECRET) {
    throw new Error('FILE_SIGNING_SECRET совпадает с отладочным значением из репозитория');
  }
  // Пустой допустим: тогда действует проверенный выше JWT_SECRET.
  return value || jwtSecret();
}

/**
 * Каталог файлов. На контейнерном хостинге диск по умолчанию временный:
 * без подключённого тома фотографии исчезнут при первом же перезапуске.
 * Проверить это за пользователя нельзя, поэтому путь виден в проверке
 * готовности — см. /api/health/ready.
 */
export function fileStorageDir(): string {
  return process.env.FILE_STORAGE_DIR ?? 'var/uploads';
}

/**
 * Разрешённые адреса фронтенда для CORS.
 *
 * В разработке отражаем любой источник: фронтенд ходит с localhost и с
 * телефона в той же сети. В проде — только перечисленные в WEB_ORIGIN,
 * иначе любая сторонняя страница сможет обращаться к API от имени
 * открытой сессии.
 *
 * Если список не задан, остаётся прежнее поведение: запретить всё —
 * значит молча сломать уже работающий фронтенд, а этого от переменной
 * окружения не ждут.
 */
export function allowedOrigins(): true | string[] {
  const raw = process.env.WEB_ORIGIN?.trim();
  if (!raw) return true;
  const list = raw
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return list.length > 0 ? list : true;
}

/** Проверка настроек на старте — чтобы отказ был при запуске, а не в первом запросе. */
export function assertDeployable() {
  jwtSecret();
  fileSigningSecret();

  if (isProduction() && !process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL не задан');
  }
}
