/**
 * Коррекция остатка по инвентаризации.
 *
 * Остатки ведутся в этой системе, а не в 1С. Значит расхождение с реальным
 * складом исправлять некому, кроме завсклада, — но правка остатка задним
 * числом обязана быть объяснима, иначе она ничем не отличается от подгонки
 * под факт.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, login, resetDatabase } from './helpers.js';
import { prisma } from '../src/db.js';

async function firstBalance() {
  const b = await prisma.stockBalance.findFirstOrThrow({ include: { catalogItem: true } });
  return b;
}

describe('Коррекция остатка', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('завсклад пересчитал и внёс новое число', async () => {
    const sklad = await login(ACCOUNTS.sklad);
    const b = await firstBalance();

    const res = await api(sklad, 'POST', '/api/stock/adjust', {
      objectId: b.objectId,
      catalogItemId: b.catalogItemId,
      qty: 3.5,
      reason: 'Пересчёт при инвентаризации 15 августа',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.before, Number(b.qty));
    assert.equal(res.body.after, 3.5);

    const after = await prisma.stockBalance.findUniqueOrThrow({ where: { id: b.id } });
    assert.equal(Number(after.qty), 3.5);
  });

  it('коррекция вверх тоже возможна: приёмку могли не отметить', async () => {
    const sklad = await login(ACCOUNTS.sklad);
    const b = await firstBalance();

    const res = await api(sklad, 'POST', '/api/stock/adjust', {
      objectId: b.objectId,
      catalogItemId: b.catalogItemId,
      qty: Number(b.qty) + 10,
      reason: 'Поступление от 12 августа не было отмечено',
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.after, Number(b.qty) + 10);
  });

  it('без причины не принимается', async () => {
    // Иначе через месяц никто не объяснит, почему остаток изменился,
    // и остаткам перестанут верить.
    const sklad = await login(ACCOUNTS.sklad);
    const b = await firstBalance();

    for (const reason of [undefined, '', 'ок']) {
      const res = await api(sklad, 'POST', '/api/stock/adjust', {
        objectId: b.objectId,
        catalogItemId: b.catalogItemId,
        qty: 1,
        ...(reason === undefined ? {} : { reason }),
      });
      assert.equal(res.status, 400, `причина «${reason ?? 'нет'}» не должна проходить`);
    }
  });

  it('прежнее и новое значение попадают в журнал вместе с причиной', async () => {
    const sklad = await login(ACCOUNTS.sklad);
    const b = await firstBalance();
    const before = Number(b.qty);

    // Прибавляем, а не убавляем: у первой позиции остаток может быть
    // меньше единицы, и отрицательное количество сервер отвергнет по праву.
    const corrected = before + 2;
    await api(sklad, 'POST', '/api/stock/adjust', {
      objectId: b.objectId,
      catalogItemId: b.catalogItemId,
      qty: corrected,
      reason: 'Недостача выявлена при пересчёте',
    });

    const entry = await prisma.auditLog.findFirst({
      where: { entity: 'stockBalance', entityId: b.id, field: 'qty' },
      orderBy: { at: 'desc' },
    });
    assert.ok(entry, 'критерий приёмки 11 требует прежнее и новое значение');
    assert.equal(entry!.oldValue, String(before));
    assert.equal(entry!.newValue, String(corrected));
    assert.match(entry!.reason ?? '', /Недостача/);
  });

  it('прораб остаток менять не может', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const b = await firstBalance();

    const res = await api(prorab, 'POST', '/api/stock/adjust', {
      objectId: b.objectId,
      catalogItemId: b.catalogItemId,
      qty: 999,
      reason: 'Хочу больше материала на объекте',
    });
    assert.equal(res.status, 403);
  });

  it('снабжение остаток тоже не меняет: считает тот, кто стоит на складе', async () => {
    const snab = await login(ACCOUNTS.snab);
    const b = await firstBalance();

    const res = await api(snab, 'POST', '/api/stock/adjust', {
      objectId: b.objectId,
      catalogItemId: b.catalogItemId,
      qty: 5,
      reason: 'Пересчёт по документам поставщика',
    });
    assert.equal(res.status, 403);
  });

  it('то же значение отклоняется: пустая запись в журнале не нужна', async () => {
    const sklad = await login(ACCOUNTS.sklad);
    const b = await firstBalance();

    const res = await api(sklad, 'POST', '/api/stock/adjust', {
      objectId: b.objectId,
      catalogItemId: b.catalogItemId,
      qty: Number(b.qty),
      reason: 'Пересчёт совпал с учётным количеством',
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'no_change');
  });

  it('несуществующая позиция — отказ, а не создание из воздуха', async () => {
    const sklad = await login(ACCOUNTS.sklad);
    const b = await firstBalance();

    const res = await api(sklad, 'POST', '/api/stock/adjust', {
      objectId: b.objectId,
      catalogItemId: 'нет-такой-позиции',
      qty: 5,
      reason: 'Проверка отсутствующей позиции',
    });
    assert.equal(res.status, 404);
  });

  it('паспорт партии можно отметить вместе с пересчётом', async () => {
    // Партия без паспорта останавливает работы — снимать эту метку
    // вправе тот же человек, что стоит на складе.
    const sklad = await login(ACCOUNTS.sklad);
    const b = await prisma.stockBalance.findFirstOrThrow({ where: { hasPassport: false } });

    const res = await api(sklad, 'POST', '/api/stock/adjust', {
      objectId: b.objectId,
      catalogItemId: b.catalogItemId,
      qty: Number(b.qty),
      hasPassport: true,
      reason: 'Паспорт получен от поставщика 15 августа',
    });

    assert.equal(res.status, 200);
    const after = await prisma.stockBalance.findUniqueOrThrow({ where: { id: b.id } });
    assert.equal(after.hasPassport, true);
  });
});
