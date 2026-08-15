/**
 * Файловое хранилище. ТЗ §3.1 (S3-совместимое, MinIO), §6, §12.
 *
 * Наружу отдаётся только предподписанная ссылка со сроком жизни 15 минут:
 * прямых постоянных URL у файлов нет, иначе ссылка на паспорт материала
 * живёт вечно и уходит куда угодно.
 *
 * Драйвер локального диска повторяет контракт S3 (подпись + срок), чтобы
 * переключение на MinIO было заменой драйвера, а не переписыванием вызовов.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileSigningSecret, fileStorageDir } from './config.js';

/** Срок жизни ссылки. ТЗ §12: 15 минут. */
export const LINK_TTL_SECONDS = 15 * 60;

/** ТЗ §11: до 20 фото на отчёт, 2–5 МБ каждое; клиент сжимает. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PHOTOS_PER_ENTRY = 20;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);

export function isAllowedMime(mime: string): boolean {
  return ALLOWED_MIME.has(mime);
}

const ROOT = resolve(fileStorageDir());

function secret(): string {
  return fileSigningSecret();
}

function sign(key: string, expiresAt: number, op: 'put' | 'get'): string {
  return createHmac('sha256', secret()).update(`${op}:${key}:${expiresAt}`).digest('hex');
}

function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export interface PresignedLink {
  key: string;
  url: string;
  expiresAt: string;
}

/** Ключ раскладывается по датам — так каталог не превращается в один плоский список. */
export function buildKey(prefix: string, filename: string): string {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-64);
  return `${prefix}/${yyyy}-${mm}/${randomUUID()}-${safe}`;
}

export function presignUpload(key: string, now = Date.now()): PresignedLink {
  const expiresAt = Math.floor(now / 1000) + LINK_TTL_SECONDS;
  const signature = sign(key, expiresAt, 'put');
  return {
    key,
    url: `/api/v1/files/content?key=${encodeURIComponent(key)}&exp=${expiresAt}&sig=${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export function presignDownload(key: string, now = Date.now()): PresignedLink {
  const expiresAt = Math.floor(now / 1000) + LINK_TTL_SECONDS;
  const signature = sign(key, expiresAt, 'get');
  return {
    key,
    url: `/api/v1/files/content?key=${encodeURIComponent(key)}&exp=${expiresAt}&sig=${signature}`,
    expiresAt: new Date(expiresAt * 1000).toISOString(),
  };
}

export type LinkCheck = { ok: true } | { ok: false; code: 'link_expired' | 'bad_signature' };

export function verifyLink(
  key: string,
  expiresAt: number,
  signature: string,
  op: 'put' | 'get',
  now = Date.now(),
): LinkCheck {
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 < now) {
    return { ok: false, code: 'link_expired' };
  }
  if (!signaturesMatch(sign(key, expiresAt, op), signature)) {
    return { ok: false, code: 'bad_signature' };
  }
  return { ok: true };
}

/** Ключ не должен выводить за пределы каталога хранилища. */
function pathFor(key: string): string {
  const full = resolve(join(ROOT, key));
  if (!full.startsWith(ROOT)) throw new Error('Некорректный ключ файла');
  return full;
}

export async function putObject(key: string, body: Buffer): Promise<void> {
  const path = pathFor(key);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body);
}

export async function getObject(key: string): Promise<Buffer> {
  return readFile(pathFor(key));
}

export async function objectSize(key: string): Promise<number | null> {
  try {
    const info = await stat(pathFor(key));
    return info.size;
  } catch {
    return null;
  }
}
