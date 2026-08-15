/**
 * Загрузка фотографий. ТЗ §12 и критерий приёмки по файлам.
 *
 * Фото не уходит внутри отчёта. Сначала оно регистрируется и кладётся
 * в хранилище по подписанной ссылке, и только потом отчёт ссылается на
 * него идентификатором. Иначе отправка отчёта означала бы передачу
 * двадцати файлов по 3 МБ одним запросом — на связи, которая рвётся
 * посреди этажа, это не доходит никогда.
 *
 * Геометка и время съёмки прикладываются при регистрации: их подделать
 * труднее, чем подпись под актом, и именно они делают фото доказательством.
 */
import { ApiError, api } from './client';

const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');

export interface UploadedPhoto {
  fileId: string;
  /** Локальный URL для показа до отправки — сервер за ним не ходит. */
  previewUrl: string;
  takenAt: string;
  lat?: number;
  lon?: number;
}

interface PresignResponse {
  fileId: string;
  key: string;
  uploadUrl: string;
  expiresAt: string;
  method: string;
}

/**
 * Координаты. Отказ в доступе — не ошибка: фото без геометки всё равно
 * лучше, чем несданный отчёт. ПТО увидит, что метки нет.
 */
export async function currentPosition(timeoutMs = 5000): Promise<{ lat: number; lon: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => resolve(null),
      { timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/**
 * Регистрация файла, загрузка содержимого, возврат ссылки для отчёта.
 *
 * Ссылка подписана и живёт 15 минут, поэтому получать её заранее пачкой
 * нельзя: пока прораб заполняет форму, она протухнет.
 */
export async function uploadPhoto(
  file: File,
  geo: { lat: number; lon: number } | null,
): Promise<UploadedPhoto> {
  const takenAt = new Date(file.lastModified || Date.now()).toISOString();

  const presigned = await api.post<PresignResponse>('/v1/files/presign', {
    filename: file.name || 'photo.jpg',
    mime: file.type || 'image/jpeg',
    size: file.size,
    purpose: 'entry',
    takenAt,
    ...(geo ?? {}),
  });

  const res = await fetch(`${API_BASE}${presigned.uploadUrl}`, {
    method: 'PUT',
    // Тип берём от файла: сервер проверяет его ещё при регистрации.
    headers: { 'content-type': file.type || 'image/jpeg' },
    body: file,
  });

  if (!res.ok) {
    let message = 'Не удалось загрузить фото';
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      /* тело не JSON — оставляем общее сообщение */
    }
    throw new ApiError(res.status, 'upload_failed', message);
  }

  return {
    fileId: presigned.fileId,
    previewUrl: URL.createObjectURL(file),
    takenAt,
    ...(geo ?? {}),
  };
}
