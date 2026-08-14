/**
 * Область видимости. Роль решает не только «что можно делать»,
 * но и «что вообще видно» — подстановка чужого objectId не должна работать.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, login, resetDatabase } from './helpers.js';

let prorab: string;
let dir: string;
let pto: string;
let ownObjectId: string;
let foreignObjectId: string;

describe('Область видимости по объектам', () => {
  before(async () => {
    await resetDatabase();
    prorab = await login(ACCOUNTS.prorab);
    dir = await login(ACCOUNTS.dir);
    pto = await login(ACCOUNTS.pto);

    const me = await api(prorab, 'GET', '/api/auth/me');
    ownObjectId = me.body.object.id;

    const objects = await api(dir, 'GET', '/api/objects');
    foreignObjectId = (objects.body as any[]).find((o) => o.id !== ownObjectId).id;
  });
  after(closeAll);

  it('сводка руководства закрыта от площадки', async () => {
    // Здесь бюджеты, CPI и прогноз по завершении — это не данные прораба.
    assert.equal((await api(prorab, 'GET', '/api/boss/digest')).status, 403);
    assert.equal((await api(pto, 'GET', '/api/boss/digest')).status, 403);
    assert.equal((await api(dir, 'GET', '/api/boss/digest')).status, 200);
  });

  it('прораб не читает работы чужого объекта по подставленному id', async () => {
    const own = await api(prorab, 'GET', `/api/works?objectId=${ownObjectId}`);
    assert.equal(own.status, 200);

    const foreign = await api(prorab, 'GET', `/api/works?objectId=${foreignObjectId}`);
    assert.equal(foreign.status, 403, 'чужой объект должен отклоняться, а не отдавать пустой список');
  });

  it('прораб не читает остатки чужого объекта', async () => {
    const foreign = await api(prorab, 'GET', `/api/stock?objectId=${foreignObjectId}`);
    assert.equal(foreign.status, 403);
  });

  it('без указания объекта прораб видит только свой', async () => {
    const stock = await api(prorab, 'GET', '/api/stock');
    assert.equal(stock.status, 200);
    for (const row of stock.body as any[]) {
      assert.equal(row.objectId, ownObjectId, 'в выдаче не должно быть чужих объектов');
    }
  });

  it('роли компании видят все объекты', async () => {
    // Снабжение и руководство работают по всей компании, ограничение к ним не применяется.
    const snab = await login(ACCOUNTS.snab);
    assert.equal((await api(snab, 'GET', `/api/stock?objectId=${foreignObjectId}`)).status, 200);
    assert.equal((await api(dir, 'GET', `/api/works?objectId=${foreignObjectId}`)).status, 200);
  });
});
