/**
 * Типы переменных сборки.
 *
 * Обычно сюда пишут `/// <reference types="vite/client" />`, и тогда
 * проверка типов не пройдёт нигде, где пакет vite не установлен. На
 * площадке развёртывания это оказалось не гарантировано, а падение
 * выглядит как ошибка типов, хотя дело в недоустановленном дереве.
 *
 * Нам от vite/client нужны три поля. Объявляем их сами: проверка типов
 * перестаёт зависеть от наличия пакета, а сборка от этого не меняется —
 * значения подставляет vite на этапе сборки, как и раньше.
 */
interface ImportMetaEnv {
  /** Адрес API. Пусто — обращаемся к своему же адресу (см. vercel.json). */
  readonly VITE_API_BASE_URL?: string;
  readonly MODE: string;
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
