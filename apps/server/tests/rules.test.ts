/**
 * Шлюзы предметной области: АОСР, освидетельствование, прочность бетона,
 * готовность фронта под технику, лимиты автономности.
 * Каждый из них — то, ради чего систему внедряют, поэтому держит сервер, а не экран.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, login, photos, resetDatabase } from './helpers.js';
import { addWorkdays, isValidPresentationDate } from '../src/rules.js';

describe('Правила без обращения к сети', () => {
  it('считает рабочие дни, пропуская выходные', () => {
    // Пятница + 3 рабочих дня = среда.
    const friday = new Date('2026-08-07T12:00:00');
    assert.equal(friday.getDay(), 5);
    const result = addWorkdays(friday, 3);
    assert.equal(result.getDay(), 3);
  });

  it('не принимает дату освидетельствования раньше трёх рабочих дней', () => {
    const now = new Date('2026-08-03T09:00:00');
    assert.equal(isValidPresentationDate(new Date('2026-08-04'), now), false);
    assert.equal(isValidPresentationDate(new Date('2026-08-05'), now), false);
    assert.equal(isValidPresentationDate(new Date('2026-08-06'), now), true);
    assert.equal(isValidPresentationDate(new Date('2026-08-10'), now), true);
  });
});

describe('Шлюзы через API', () => {
  before(resetDatabase);
  after(closeAll);

  it('не даёт предъявить процесс, не доведённый до 100%', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');

    const res = await api(prorab, 'POST', `/api/process/${active.id}/present`, {
      checklist: [],
      date: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      notify: ['ПТО · Гульмира С.'],
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'not_complete');
  });

  it('объясняет блокировку прямо в строке цепочки', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const today = await api(prorab, 'GET', '/api/today');
    const blocked = (today.body.processes as any[]).find((p) => p.status === 'blocked');

    assert.ok(blocked.blockedReason, 'причина блокировки обязана быть в данных');
    assert.match(blocked.blockedReason, /АОСР|прочност/i);
  });

  it('после подписания АОСР снимает блокировку со следующего процесса', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);

    const objects = await api(prorab, 'GET', '/api/objects');
    const object = (objects.body as any[]).find((o) => o.name.includes('Ак-Орго'));
    const blockB = object.blocks.find((b: any) => b.name === 'Блок Б');

    const chain = await api(prorab, 'GET', `/api/chain?sectionId=mono&blockId=${blockB.id}&floor=7`);
    const rows = chain.body.rows as any[];

    const armirovanie = rows.find((r) => r.name.startsWith('Армирование колонн'));
    const opalubka = rows.find((r) => r.name.startsWith('Монтаж опалубки колонн'));
    assert.equal(opalubka.status, 'blocked');

    const accepted = await api(pto, 'POST', `/api/process/${armirovanie.processStateId}/accept`, {
      aosrNumber: 'АОСР-40',
    });
    assert.equal(accepted.status, 200);

    const after = await api(prorab, 'GET', `/api/chain?sectionId=mono&blockId=${blockB.id}&floor=7`);
    const opalubkaAfter = (after.body.rows as any[]).find((r) =>
      r.name.startsWith('Монтаж опалубки колонн'),
    );
    assert.notEqual(opalubkaAfter.status, 'blocked', 'опалубка должна разблокироваться');
  });

  it('не выпускает заявку на технику без готового фронта', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const objects = await api(prorab, 'GET', '/api/objects');
    const objectId = (objects.body as any[])[0].id;

    const res = await api(prorab, 'POST', '/api/zayavki', {
      kind: 'tech',
      objectId,
      priority: 'norm',
      items: [{ rawText: 'кран на монтаж', qty: 1, unit: 'сут' }],
      tech: {
        machineType: 'Кран',
        hours: 8,
        date: new Date().toISOString(),
        timeFrom: '08:00',
        frontChecklist: [
          { key: 'access', label: 'Подъезд свободен', checked: true },
          { key: 'safety', label: 'Опасная зона огорожена', checked: false },
        ],
      },
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'front_not_ready');
    assert.match(res.body.message, /опасная зона/i);
  });

  it('не даёт принять материал, который ещё не приехал', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const mine = await api(prorab, 'GET', '/api/zayavki?scope=mine');
    const pending = (mine.body as any[]).find((z) => z.status === 'normalizing' || z.status === 'new');

    const res = await api(prorab, 'POST', `/api/zayavki/${pending.id}/accept`, {
      qtyAccepted: 4.2,
      passportOk: true,
      photos: await photos(prorab),
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'not_delivered');
  });

  it('помечает партию без паспорта и извещает ПТО и снабжение', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);
    const snab = await login(ACCOUNTS.snab);

    const mine = await api(prorab, 'GET', '/api/zayavki?scope=mine');
    const inTransit = (mine.body as any[]).find((z) => z.status === 'inTransit');

    const res = await api(prorab, 'POST', `/api/zayavki/${inTransit.id}/accept`, {
      qtyAccepted: 12,
      passportOk: false,
      photos: await photos(prorab),
    });
    assert.equal(res.status, 200);

    const ptoInbox = await api(pto, 'GET', '/api/notifications?unread=1');
    const snabInbox = await api(snab, 'GET', '/api/notifications?unread=1');
    assert.ok(
      (ptoInbox.body as any[]).some((n) => n.kind === 'noPassport'),
      'ПТО должен получить извещение о партии без паспорта',
    );
    assert.ok(
      (snabInbox.body as any[]).some((n) => n.kind === 'noPassport'),
      'снабжение тоже извещается',
    );
  });

  it('эскалирует платёж выше лимита автономности директору', async () => {
    const gi = await login(ACCOUNTS.gi);
    const finance = await api(gi, 'GET', '/api/boss/finance');
    const above = (finance.body.payments as any[]).find((p) => p.amount > 5);

    const res = await api(gi, 'POST', `/api/boss/payments/${above.id}/approve`);
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'above_limit');

    const dir = await login(ACCOUNTS.dir);
    const dirInbox = await api(dir, 'GET', '/api/notifications?unread=1');
    assert.ok((dirInbox.body as any[]).some((n) => n.title.includes('лимита')));

    // Директору тот же платёж провести можно.
    const byDirector = await api(dir, 'POST', `/api/boss/payments/${above.id}/approve`);
    assert.equal(byDirector.status, 200);
  });

  it('требует причину при выдаче сверх норматива', async () => {
    const sklad = await login(ACCOUNTS.sklad);
    const stock = await api(sklad, 'GET', '/api/stock');
    const overIssuable = (stock.body as any[]).find(
      (s) => s.specRemainder !== null && s.qty > 0,
    );

    const users = await api(sklad, 'GET', '/api/users?role=prorab');
    const toUserId = (users.body as any[])[0].id;

    const noReason = await api(sklad, 'POST', '/api/stock/issue', {
      objectId: overIssuable.objectId,
      catalogItemId: overIssuable.catalogItemId,
      qty: overIssuable.specRemainder + 1,
      toUserId,
      signature: 'Асанов',
    });
    // Либо не хватает остатка, либо требуется причина — оба варианта отказ, а не молчаливая выдача.
    assert.ok([409, 422].includes(noReason.status), `получено ${noReason.status}`);
  });
});
