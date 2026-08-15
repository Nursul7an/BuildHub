/**
 * Ошибки базы в ответах API. ТЗ §6.
 *
 * Нарушение ограничения — отказ по данным, а не сбой. Пока оно отвечало
 * пятисотой, главный инженер видел «Внутренняя ошибка сервера» на попытку
 * завести объект с занятым кодом и не знал, что исправлять.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, login, resetDatabase } from './helpers.js';
import { prismaFailure } from '../src/prisma-errors.js';

describe('Перевод ошибок Prisma', () => {
  it('занятое уникальное значение — это 409, а не сбой', () => {
    const mapped = prismaFailure({ code: 'P2002', meta: { target: ['code'] } });
    assert.equal(mapped?.status, 409);
    assert.equal(mapped?.code, 'already_exists');
    assert.match(mapped!.message, /код/, 'поле называется по-человечески, а не «code»');
  });

  it('пропавшая запись — 404', () => {
    assert.equal(prismaFailure({ code: 'P2025' })?.status, 404);
  });

  it('битая ссылка — 409 с понятным действием', () => {
    const mapped = prismaFailure({ code: 'P2003' });
    assert.equal(mapped?.status, 409);
    assert.match(mapped!.message, /обновите список/i);
  });

  it('остальные коды остаются сбоем', () => {
    // Иначе настоящая авария притворится отказом по данным
    // и не попадёт в журнал как ошибка.
    assert.equal(prismaFailure({ code: 'P1001' }), null);
    assert.equal(prismaFailure(new Error('обычная ошибка')), null);
    assert.equal(prismaFailure({ code: 'not_found' }), null);
  });
});

describe('Создание объекта с занятым кодом', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  const objectBody = (code: string) => ({
    code,
    name: 'ЖК «Проверка»',
    address: 'ул. Проверочная, 1',
    city: 'Бишкек',
    floorsTotal: 9,
    dueDate: new Date(Date.now() + 90 * 86_400_000).toISOString(),
    blocks: [{ name: 'Блок А', floors: 9 }],
  });

  it('первый объект создаётся', async () => {
    const gi = await login(ACCOUNTS.gi);
    const res = await api(gi, 'POST', '/api/boss/objects', objectBody('ПРВ-1'));
    assert.equal(res.status, 200);
    assert.ok(res.body.id);
  });

  it('повтор кода отвечает отказом и называет занявший объект', async () => {
    const gi = await login(ACCOUNTS.gi);
    await api(gi, 'POST', '/api/boss/objects', objectBody('ПРВ-2'));

    const again = await api(gi, 'POST', '/api/boss/objects', objectBody('ПРВ-2'));
    assert.equal(again.status, 409, 'занятый код — это не «Внутренняя ошибка сервера»');
    assert.equal(again.body.code, 'already_exists');
    assert.match(again.body.message, /ПРВ-2/, 'в сообщении виден сам код');
    assert.deepEqual(again.body.details.fields, ['code']);
  });

  it('существующий код объекта из фикстур тоже не роняет сервер', async () => {
    const gi = await login(ACCOUNTS.gi);
    const objects = await api(gi, 'GET', '/api/objects');
    const existing = (objects.body as { code: string }[])[0]!;

    const res = await api(gi, 'POST', '/api/boss/objects', objectBody(existing.code));
    assert.equal(res.status, 409);
  });
});
