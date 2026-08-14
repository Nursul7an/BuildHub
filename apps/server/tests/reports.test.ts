/**
 * Дневной отчёт — сердце системы. Здесь проверяется то, из-за чего
 * прораб перестаёт верить цифрам: двойной учёт, фото, зимний метод, возвраты.
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drain, ACCOUNTS, api, closeAll, login, photos, resetDatabase } from './helpers.js';

let prorab: string;
let pto: string;
let activeProcessId: string;
let blockedProcessId: string;

async function loadContext() {
  prorab = await login(ACCOUNTS.prorab);
  pto = await login(ACCOUNTS.pto);
  const today = await api(prorab, 'GET', '/api/today');
  const processes = today.body.processes as any[];
  activeProcessId = processes.find((p) => p.status === 'active').id;
  blockedProcessId = processes.find((p) => p.status === 'blocked').id;
}

const date = () => new Date().toISOString();

/** Фото загружается по-настоящему, поэтому фабрика асинхронная. */
const entry = async (overrides: Record<string, unknown> = {}) => ({
  processStateId: activeProcessId,
  volume: 1,
  unit: 'т',
  workers: 12,
  photos: await photos(prorab),
  ...overrides,
});

describe('Дневной отчёт', () => {
  before(async () => {
    await resetDatabase();
    await loadContext();
  });
  after(closeAll);

  describe('правила записи', () => {
    beforeEach(async () => {
      await resetDatabase();
      await loadContext();
    });

    it('требует объём', async () => {
      const res = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ volume: 0 }),
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.code, 'no_volume');
    });

    it('требует хотя бы одно фото', async () => {
      const res = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ photos: [] }),
      });
      assert.equal(res.status, 422);
      assert.equal(res.body.code, 'no_photo');
    });

    it('ниже +5 °C требует зимний метод', async () => {
      const without = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ tempAir: -3 }),
      });
      assert.equal(without.status, 422);
      assert.equal(without.body.code, 'no_winter_method');

      const withMethod = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ tempAir: -3, winterMethod: 'противоморозные добавки' }),
      });
      assert.equal(withMethod.status, 200);
    });

    it('не принимает объём в заблокированный процесс', async () => {
      const res = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ processStateId: blockedProcessId }),
      });
      assert.equal(res.status, 409);
      assert.equal(res.body.code, 'blocked');
    });
  });

  describe('учёт факта', () => {
    beforeEach(async () => {
      await resetDatabase();
      await loadContext();
    });

    it('прибавляет объём к процессу один раз, сколько бы раз ни отправляли', async () => {
      const before = await api(prorab, 'GET', `/api/process/${activeProcessId}`);
      const saved = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ volume: 2 }),
      });
      const reportId = saved.body.reportId as string;

      const first = await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 180 });
      assert.equal(first.status, 200);

      const afterFirst = await api(prorab, 'GET', `/api/process/${activeProcessId}`);
      assert.equal(afterFirst.body.doneQty, before.body.doneQty + 2);

      // Повторная отправка отклоняется, факт не растёт.
      const second = await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 180 });
      assert.equal(second.status, 409);
      assert.equal(second.body.code, 'already_submitted');

      const afterSecond = await api(prorab, 'GET', `/api/process/${activeProcessId}`);
      assert.equal(afterSecond.body.doneQty, afterFirst.body.doneQty);
    });

    it('после возврата и исправления двигает факт на разницу, а не заново', async () => {
      const before = await api(prorab, 'GET', `/api/process/${activeProcessId}`);
      const saved = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ volume: 5 }),
      });
      const reportId = saved.body.reportId as string;
      await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 100 });

      const returned = await api(pto, 'POST', `/api/report/${reportId}/check`, {
        decision: 'return',
        comment: 'Объём не сходится с фото',
      });
      assert.equal(returned.status, 200);

      // Прораб исправляет 5 → 3 и отправляет снова.
      await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ volume: 3 }),
      });
      const resubmit = await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 60 });
      assert.equal(resubmit.status, 200);

      const after = await api(prorab, 'GET', `/api/process/${activeProcessId}`);
      assert.equal(after.body.doneQty, before.body.doneQty + 3, 'в факте должно остаться 3, а не 5 и не 8');
    });

    it('корректировка ПТО меняет факт на разницу и не откатывается следующей отправкой', async () => {
      const before = await api(prorab, 'GET', `/api/process/${activeProcessId}`);
      const saved = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry({ volume: 10 }),
      });
      const reportId = saved.body.reportId as string;
      await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 100 });

      const report = await api(pto, 'GET', `/api/report/${reportId}`);
      const entryId = report.body.entries[0].id as string;

      const adjusted = await api(pto, 'POST', `/api/report/${reportId}/check`, {
        decision: 'adjust',
        adjustment: { entryId, to: 6, reason: 'по фото меньше' },
      });
      assert.equal(adjusted.status, 200);

      const after = await api(prorab, 'GET', `/api/process/${activeProcessId}`);
      assert.equal(after.body.doneQty, before.body.doneQty + 6);
    });

    it('не даёт отправить пустой отчёт', async () => {
      const saved = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry(),
      });
      const reportId = saved.body.reportId as string;
      await api(pto, 'GET', `/api/report/${reportId}`);
      // Отчёт с записями отправляется, а вот чужой — нет.
      const master = await login(ACCOUNTS.master);
      const foreign = await api(master, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 10 });
      assert.equal(foreign.status, 403);
    });
  });

  describe('проверка ПТО', () => {
    beforeEach(async () => {
      await resetDatabase();
      await loadContext();
    });

    it('очередь видна только роли с правом проверки', async () => {
      const forbidden = await api(prorab, 'GET', '/api/reports/queue');
      assert.equal(forbidden.status, 403);

      const allowed = await api(pto, 'GET', '/api/reports/queue');
      assert.equal(allowed.status, 200);
    });

    it('возврат доносит замечание до автора', async () => {
      const saved = await api(prorab, 'POST', '/api/report/entry', {
        date: date(),
        entry: await entry(),
      });
      const reportId = saved.body.reportId as string;
      await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 100 });

      await api(pto, 'POST', `/api/report/${reportId}/check`, {
        decision: 'return',
        comment: 'Проверьте объём кладки',
      });

      await drain();
      const notifications = await api(prorab, 'GET', '/api/notifications?unread=1');
      const returned = (notifications.body as any[]).find((n) => n.title.includes('возвращён'));
      assert.ok(returned, 'автор должен увидеть возврат в уведомлениях');
      assert.match(returned.subtitle, /кладки/);
    });
  });
});
