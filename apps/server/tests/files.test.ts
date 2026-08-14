/**
 * Файлы. ТЗ §6, §12: предподписанные ссылки на 15 минут, время и геометка
 * у каждого фото, запрет правки после согласования отчёта.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, getApp, login, photos, resetDatabase, uploadPhoto } from './helpers.js';
import { LINK_TTL_SECONDS, presignUpload, verifyLink } from '../src/storage.js';

describe('Подпись ссылок', () => {
  it('ссылка живёт ровно 15 минут', () => {
    const now = Date.parse('2026-08-14T12:00:00Z');
    const link = presignUpload('entry/2026-08/file.jpg', now);
    const expected = new Date(now + LINK_TTL_SECONDS * 1000).toISOString();
    assert.equal(link.expiresAt, expected);
  });

  it('просроченная и подделанная подпись отклоняются', () => {
    const now = Date.parse('2026-08-14T12:00:00Z');
    const key = 'entry/2026-08/file.jpg';
    const link = presignUpload(key, now);
    const url = new URL(`http://x${link.url}`);
    const exp = Number(url.searchParams.get('exp'));
    const sig = url.searchParams.get('sig')!;

    assert.equal(verifyLink(key, exp, sig, 'put', now).ok, true);

    // Через 16 минут ссылка мертва.
    const later = verifyLink(key, exp, sig, 'put', now + 16 * 60 * 1000);
    assert.equal(later.ok, false);
    assert.equal(later.ok === false && later.code, 'link_expired');

    // Подпись под другой ключ не подходит.
    const otherKey = verifyLink('entry/2026-08/other.jpg', exp, sig, 'put', now);
    assert.equal(otherKey.ok, false);
    assert.equal(otherKey.ok === false && otherKey.code, 'bad_signature');

    // Ссылка на загрузку не работает как ссылка на скачивание.
    assert.equal(verifyLink(key, exp, sig, 'get', now).ok, false);
  });
});

describe('Загрузка и отдача файлов', () => {
  before(resetDatabase);
  after(closeAll);

  it('проходит цикл: ссылка → загрузка → просмотр', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const file = await uploadPhoto(prorab);

    const meta = await api(prorab, 'GET', `/api/v1/files/${file.fileId}`);
    assert.equal(meta.status, 200);
    assert.equal(meta.body.status, 'uploaded');
    // Время съёмки и геометка обязаны сохраниться — ими фото и доказывает себя.
    assert.ok(meta.body.takenAt);
    assert.equal(meta.body.lat, 42.87);

    const link = await api(prorab, 'GET', `/api/v1/files/${file.fileId}/link`);
    assert.equal(link.status, 200);
    assert.ok(link.body.url.includes('sig='));

    const instance = await getApp();
    const content = await instance.inject({ method: 'GET', url: link.body.url });
    assert.equal(content.statusCode, 200);
    assert.equal(content.body, 'фото с объекта');
  });

  it('не принимает недопустимый тип и повторную загрузку', async () => {
    const prorab = await login(ACCOUNTS.prorab);

    const wrongType = await api(prorab, 'POST', '/api/v1/files/presign', {
      filename: 'virus.exe',
      mime: 'application/x-msdownload',
    });
    assert.equal(wrongType.status, 415);

    const presigned = await api(prorab, 'POST', '/api/v1/files/presign', {
      filename: 'a.jpg',
      mime: 'image/jpeg',
    });
    const instance = await getApp();
    const first = await instance.inject({
      method: 'PUT',
      url: presigned.body.uploadUrl,
      headers: { 'content-type': 'image/jpeg' },
      payload: Buffer.from('раз'),
    });
    assert.equal(first.statusCode, 200);

    const second = await instance.inject({
      method: 'PUT',
      url: presigned.body.uploadUrl,
      headers: { 'content-type': 'image/jpeg' },
      payload: Buffer.from('два'),
    });
    assert.equal(second.statusCode, 409);
    assert.equal(second.json().code, 'already_uploaded');
  });

  it('без подписи файл не отдаётся', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const file = await uploadPhoto(prorab);
    const instance = await getApp();

    const noSig = await instance.inject({
      method: 'GET',
      url: `/api/v1/files/content?key=${encodeURIComponent(file.key)}&exp=99999999999&sig=подделка`,
    });
    assert.equal(noSig.statusCode, 403);
  });

  it('запись выполнения не принимает недогруженное фото', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');

    // Ссылка выдана, но файл не загружен.
    const presigned = await api(prorab, 'POST', '/api/v1/files/presign', {
      filename: 'pending.jpg',
      mime: 'image/jpeg',
    });

    const res = await api(prorab, 'POST', '/api/report/entry', {
      date: new Date().toISOString(),
      entry: {
        processStateId: active.id,
        volume: 1,
        unit: 'т',
        workers: 5,
        photos: [{ fileId: presigned.body.fileId }],
      },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'photo_not_uploaded');
  });

  it('после согласования отчёта фото не удаляются', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);

    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');
    const uploaded = await uploadPhoto(prorab);

    const saved = await api(prorab, 'POST', '/api/report/entry', {
      date: new Date().toISOString(),
      entry: {
        processStateId: active.id,
        volume: 3,
        unit: 'т',
        workers: 9,
        photos: [{ fileId: uploaded.fileId }],
      },
    });
    const reportId = saved.body.reportId as string;

    // Пока отчёт черновик — своё фото удалить можно.
    const extra = await uploadPhoto(prorab);
    assert.equal((await api(prorab, 'DELETE', `/api/v1/files/${extra.fileId}`)).status, 200);

    await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 120 });
    await api(pto, 'POST', `/api/report/${reportId}/check`, { decision: 'accept' });

    const blocked = await api(prorab, 'DELETE', `/api/v1/files/${uploaded.fileId}`);
    assert.equal(blocked.status, 409);
    assert.equal(blocked.body.code, 'report_accepted');
  });

  it('согласованный отчёт нельзя переписать новой записью', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');

    const res = await api(prorab, 'POST', '/api/report/entry', {
      date: new Date().toISOString(),
      entry: {
        processStateId: active.id,
        volume: 99,
        unit: 'т',
        workers: 9,
        photos: await photos(prorab),
      },
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'report_accepted');
  });
});
