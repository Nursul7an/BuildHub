/**
 * Пароли. ТЗ §12.
 *
 * Argon2id: подбор по хешу должен упираться в память, а не только в процессор.
 * Прежние bcrypt-хеши продолжают проверяться, и при первом удачном входе
 * пароль перехешируется — миграция идёт сама, без сброса паролей у всех сразу.
 */
import { Algorithm, hash as argonHash, verify as argonVerify } from '@node-rs/argon2';
import bcrypt from 'bcryptjs';

/**
 * Параметры подобраны так, чтобы проверка занимала десятки миллисекунд
 * на сервере из §11 и оставалась незаметной на фоне сетевой задержки.
 */
const ARGON_OPTIONS = {
  algorithm: Algorithm.Argon2id,
  memoryCost: 19_456, // 19 МиБ — рекомендация OWASP
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashPassword(plain: string): Promise<string> {
  return argonHash(plain, ARGON_OPTIONS);
}

/** Хеш bcrypt узнаётся по префиксу: $2a$, $2b$, $2y$. */
function isBcrypt(hash: string): boolean {
  return /^\$2[aby]?\$/.test(hash);
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    if (isBcrypt(hash)) return await bcrypt.compare(plain, hash);
    return await argonVerify(hash, plain);
  } catch {
    return false;
  }
}

/** Хеш устарел — перехешировать при следующем удачном входе. */
export function needsRehash(hash: string): boolean {
  return isBcrypt(hash);
}

/**
 * Временный пароль. Показывается один раз и больше нигде не хранится
 * в открытом виде — посмотреть действующий пароль не может никто,
 * включая администратора (§12).
 *
 * Алфавит без похожих символов: пароль диктуют по телефону.
 */
const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

export function generatePassword(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = '';
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}

/** Минимальные требования к паролю, который человек задаёт себе сам. */
export function checkPasswordStrength(plain: string): { ok: true } | { ok: false; message: string } {
  if (plain.length < 8) {
    return { ok: false, message: 'Пароль короче 8 символов — не подойдёт' };
  }
  if (/^\d+$/.test(plain)) {
    return { ok: false, message: 'Только цифры — слишком просто, добавьте буквы' };
  }
  return { ok: true };
}
