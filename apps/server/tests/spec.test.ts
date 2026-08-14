/**
 * Критерии приёмки из ТЗ: 3 (запрещённые переходы), 4 (разблокировка ГИ),
 * 8 (идемпотентность), 11 (журнал аудита), 12 (справочники без деплоя).
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, login, photo, resetDatabase } from './helpers.js';
import { checkTransition } from '../src/transitions.js';
import { getThreshold } from '../src/thresholds.js';

describe('Критерий 3 · запрещённый переход не выполняется', () => {
  it('таблица переходов различает «нет такого перехода» и «не ваша роль»', () => {
    const unknown = checkTransition('report', 'draft', 'accepted', 'pto');
    assert.equal(unknown.ok, false);
    assert.equal(unknown.ok === false && unknown.code, 'unknown_transition');

    const wrongRole = checkTransition('report', 'atPto', 'accepted', 'prorab');
    assert.equal(wrongRole.ok, false);
    assert.equal(wrongRole.ok === false && wrongRole.code, 'role_not_allowed');

    const fine = checkTransition('report', 'atPto', 'accepted', 'pto');
    assert.equal(fine.ok, true);
  });

  it('согласовать заявку может только снабжение, приёмку — прораб или завсклад', () => {
    assert.equal(checkTransition('materialRequest', 'new', 'approved', 'prorab').ok, false);
    assert.equal(checkTransition('materialRequest', 'new', 'approved', 'snab').ok, true);
    assert.equal(checkTransition('materialRequest', 'inTransit', 'accepted', 'snab').ok, false);
    assert.equal(checkTransition('materialRequest', 'inTransit', 'accepted', 'prorab').ok, true);
    assert.equal(checkTransition('materialRequest', 'inTransit', 'accepted', 'sklad').ok, true);
  });

  it('разблокировать процесс вручную может только главный инженер', () => {
    for (const role of ['pto', 'prorab', 'dir'] as const) {
      assert.equal(checkTransition('process', 'blocked', 'active', role).ok, false, role);
    }
    assert.equal(checkTransition('process', 'blocked', 'active', 'gi').ok, true);
  });

  describe('через API', () => {
    before(resetDatabase);
    after(closeAll);

    it('повторная отправка отчёта возвращает 409 и не меняет состояние', async () => {
      const prorab = await login(ACCOUNTS.prorab);
      const today = await api(prorab, 'GET', '/api/today');
      const active = (today.body.processes as any[]).find((p) => p.status === 'active');

      const saved = await api(prorab, 'POST', '/api/report/entry', {
        date: new Date().toISOString(),
        entry: { processStateId: active.id, volume: 1, unit: 'т', workers: 10, photos: photo() },
      });
      const reportId = saved.body.reportId as string;

      await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 60 });
      const repeat = await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 60 });

      assert.equal(repeat.status, 409);
      // Формат ошибки по ТЗ §6: машиночитаемый код.
      assert.ok(repeat.body.code, 'ошибка обязана нести код');
      assert.equal(repeat.body.code, 'already_submitted');

      const after = await api(prorab, 'GET', `/api/report/${reportId}`);
      assert.equal(after.body.status, 'atPto', 'состояние не должно меняться при отказе');
    });
  });
});

describe('Критерий 11 · журнал аудита', () => {
  before(resetDatabase);
  after(closeAll);

  it('пишет прежнее и новое значение при корректировке объёма', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);

    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');

    const saved = await api(prorab, 'POST', '/api/report/entry', {
      date: new Date().toISOString(),
      entry: { processStateId: active.id, volume: 10, unit: 'т', workers: 12, photos: photo() },
    });
    const reportId = saved.body.reportId as string;
    await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 90 });

    const report = await api(pto, 'GET', `/api/report/${reportId}`);
    const entryId = report.body.entries[0].id as string;

    await api(pto, 'POST', `/api/report/${reportId}/check`, {
      decision: 'adjust',
      adjustment: { entryId, to: 6, reason: 'по фото меньше' },
    });

    const log = await api(pto, 'GET', `/api/v1/audit?entity=reportEntry&entityId=${entryId}`);
    assert.equal(log.status, 200);
    const volumeChange = (log.body as any[]).find((r) => r.field === 'volume');
    assert.ok(volumeChange, 'изменение объёма должно попасть в журнал');
    assert.equal(volumeChange.oldValue, '10');
    assert.equal(volumeChange.newValue, '6');
    assert.equal(volumeChange.reason, 'по фото меньше');
    assert.ok(volumeChange.actor, 'автор изменения обязан быть указан');
  });

  it('журнал закрыт от площадки и доступен ПТО и руководству', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const gi = await login(ACCOUNTS.gi);
    assert.equal((await api(prorab, 'GET', '/api/v1/audit')).status, 403);
    assert.equal((await api(gi, 'GET', '/api/v1/audit')).status, 200);
  });

  it('фиксирует смену статуса отчёта с причиной возврата', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);

    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');
    const saved = await api(prorab, 'POST', '/api/report/entry', {
      date: new Date(Date.now() - 86_400_000).toISOString(),
      entry: { processStateId: active.id, volume: 2, unit: 'т', workers: 8, photos: photo() },
    });
    const reportId = saved.body.reportId as string;
    await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 45 });
    await api(pto, 'POST', `/api/report/${reportId}/check`, {
      decision: 'return',
      comment: 'Объём не сходится с фото',
    });

    const log = await api(pto, 'GET', `/api/v1/audit?entity=dailyReport&entityId=${reportId}`);
    const returned = (log.body as any[]).find((r) => r.newValue === 'returned');
    assert.ok(returned);
    assert.equal(returned.reason, 'Объём не сходится с фото');
  });
});

describe('Критерий 12 · пороги меняются без деплоя', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('норма объекта побеждает норму компании', async () => {
    const objects = await api(await login(ACCOUNTS.dir), 'GET', '/api/objects');
    const ak = (objects.body as any[]).find((o) => o.name.includes('Ак-Орго'));
    const other = (objects.body as any[]).find((o) => !o.name.includes('Ак-Орго'));

    // По компании 70%, по ППР Ак-Орго — 80%.
    assert.equal(await getThreshold({ key: 'strippingStrengthPct' }), 70);
    assert.equal(await getThreshold({ key: 'strippingStrengthPct', facilityId: ak.id }), 80);
    assert.equal(await getThreshold({ key: 'strippingStrengthPct', facilityId: other.id }), 70);
  });

  it('ПТО меняет температурный порог, и правило отчёта сразу идёт по новому', async () => {
    const pto = await login(ACCOUNTS.pto);
    const prorab = await login(ACCOUNTS.prorab);

    const me = await api(prorab, 'GET', '/api/auth/me');
    const facilityId = me.body.object.id;

    // При −3 °C и пороге +5 зимний метод обязателен.
    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');
    const before = await api(prorab, 'POST', '/api/report/entry', {
      date: new Date().toISOString(),
      entry: { processStateId: active.id, volume: 1, unit: 'т', workers: 5, photos: photo(), tempAir: -3 },
    });
    assert.equal(before.status, 422);
    assert.equal(before.body.code, 'no_winter_method');

    // ПТО опускает порог по объекту до −10 °C: по ППР так.
    const changed = await api(pto, 'PUT', '/api/v1/thresholds', {
      key: 'winterTempC',
      scopeType: 'facility',
      scopeId: facilityId,
      value: -10,
      unit: '°C',
      source: 'ППР, п. 4.2',
    });
    assert.equal(changed.status, 200);

    // Та же запись теперь проходит — без перезапуска и без правки кода.
    const after = await api(prorab, 'POST', '/api/report/entry', {
      date: new Date().toISOString(),
      entry: { processStateId: active.id, volume: 1, unit: 'т', workers: 5, photos: photo(), tempAir: -3 },
    });
    assert.equal(after.status, 200);
  });

  it('порог ведёт назначенная роль, а не любая', async () => {
    const dir = await login(ACCOUNTS.dir);
    const pto = await login(ACCOUNTS.pto);

    // Температуру ведёт ПТО, лимиты — руководитель.
    const dirTriesTemp = await api(dir, 'PUT', '/api/v1/thresholds', {
      key: 'winterTempC',
      scopeType: 'company',
      value: 0,
    });
    assert.equal(dirTriesTemp.status, 403);

    const ptoTriesLimit = await api(pto, 'PUT', '/api/v1/thresholds', {
      key: 'autonomyLimit',
      scopeType: 'company',
      roleKey: 'gi',
      value: 99,
    });
    assert.equal(ptoTriesLimit.status, 403);

    assert.equal(
      (await api(dir, 'PUT', '/api/v1/thresholds', {
        key: 'autonomyLimit',
        scopeType: 'company',
        roleKey: 'gi',
        value: 9,
      })).status,
      200,
    );
  });

  it('прежнее значение не переписывается, а закрывается периодом', async () => {
    const pto = await login(ACCOUNTS.pto);
    await api(pto, 'PUT', '/api/v1/thresholds', {
      key: 'strippingStrengthPct',
      scopeType: 'company',
      value: 75,
      source: 'новые общие данные КЖ',
    });

    const resolved = await api(pto, 'GET', '/api/v1/thresholds/resolve?key=strippingStrengthPct');
    assert.equal(resolved.body.value, 75);

    // Норма на прошлую дату осталась прежней — старый отчёт читается по ней.
    const past = new Date(Date.now() - 86_400_000).toISOString();
    assert.equal(await getThreshold({ key: 'strippingStrengthPct', at: new Date(past) }), 70);
  });
});

describe('Критерий 4 · разблокировка только главным инженером с обоснованием', () => {
  before(resetDatabase);
  after(closeAll);

  it('шлюз снимается ГИ и требует содержательного обоснования', async () => {
    const gi = await login(ACCOUNTS.gi);
    const pto = await login(ACCOUNTS.pto);

    const gates = await api(gi, 'GET', '/api/v1/gates');
    assert.ok((gates.body as any[]).length > 0, 'на объекте должны быть открытые шлюзы');
    const gate = (gates.body as any[])[0];

    // ПТО не может снять блокировку.
    assert.equal(
      (await api(pto, 'POST', `/api/v1/gates/${gate.id}/release`, { justification: 'нужно ехать дальше' })).status,
      403,
    );

    // Пустое обоснование не проходит.
    assert.equal(
      (await api(gi, 'POST', `/api/v1/gates/${gate.id}/release`, { justification: 'ок' })).status,
      400,
    );

    const released = await api(gi, 'POST', `/api/v1/gates/${gate.id}/release`, {
      justification: 'Арматура принята по факту, АОСР оформляется задним числом, риск принят',
    });
    assert.equal(released.status, 200);

    // Обоснование попало в журнал.
    const log = await api(pto, 'GET', `/api/v1/audit?entity=gate&entityId=${gate.id}`);
    const record = (log.body as any[])[0];
    assert.equal(record.newValue, 'released');
    assert.match(record.reason, /риск принят/);

    // Повторное снятие — 409.
    assert.equal(
      (await api(gi, 'POST', `/api/v1/gates/${gate.id}/release`, { justification: 'ещё раз, на всякий случай' })).status,
      409,
    );
  });
});

describe('Критерий 8 · повтор операции не создаёт дубль', () => {
  before(resetDatabase);
  after(closeAll);

  it('тот же Idempotency-Key возвращает прежний результат', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const objects = await api(prorab, 'GET', '/api/objects');
    const objectId = (objects.body as any[])[0].id;

    const payload = {
      kind: 'material',
      objectId,
      priority: 'norm',
      items: [{ rawText: 'арматура 12ка', qty: 1.5, unit: 'т' }],
    };

    const app = (await import('./helpers.js')).getApp;
    const instance = await app();
    const headers = { authorization: `Bearer ${prorab}`, 'idempotency-key': 'op-0001' };

    const first = await instance.inject({ method: 'POST', url: '/api/zayavki', headers, payload });
    const second = await instance.inject({ method: 'POST', url: '/api/zayavki', headers, payload });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    assert.deepEqual(second.json(), first.json(), 'повтор обязан вернуть прежний результат');

    const list = await api(prorab, 'GET', '/api/zayavki?scope=mine');
    const created = (list.body as any[]).filter((z) => z.number === first.json().number);
    assert.equal(created.length, 1, 'заявка должна быть создана один раз');
  });

  it('тот же ключ с другими данными — ошибка клиента, а не тихий повтор', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const objects = await api(prorab, 'GET', '/api/objects');
    const objectId = (objects.body as any[])[0].id;
    const instance = await (await import('./helpers.js')).getApp();
    const headers = { authorization: `Bearer ${prorab}`, 'idempotency-key': 'op-0002' };

    await instance.inject({
      method: 'POST',
      url: '/api/zayavki',
      headers,
      payload: { kind: 'material', objectId, priority: 'norm', items: [{ rawText: 'цемент', qty: 1, unit: 'т' }] },
    });

    const different = await instance.inject({
      method: 'POST',
      url: '/api/zayavki',
      headers,
      payload: { kind: 'material', objectId, priority: 'norm', items: [{ rawText: 'цемент', qty: 99, unit: 'т' }] },
    });

    assert.equal(different.statusCode, 422);
    assert.equal(different.json().code, 'idempotency_key_reuse');
  });
});
