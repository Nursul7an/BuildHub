/**
 * Офлайн-очередь. ТЗ §8, критерий приёмки 8:
 * повтор не создаёт дубль, конфликт помечается и уходит в разбор, а не перезаписывает.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drain, ACCOUNTS, api, closeAll, login, photos, resetDatabase, uploadPhoto } from './helpers.js';

const op = (clientOpId: string, type: string, payload: unknown, deviceTime = new Date().toISOString()) => ({
  clientOpId,
  deviceTime,
  type,
  payload,
});

describe('Офлайн-синхронизация', () => {
  before(resetDatabase);
  after(closeAll);

  it('применяет пачку операций в порядке очереди', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');
    const file = await uploadPhoto(prorab);

    const date = new Date().toISOString();
    const res = await api(prorab, 'POST', '/api/v1/sync/batch', {
      operations: [
        op('op-1', 'report.entry', {
          date,
          entry: {
            processStateId: active.id,
            volume: 4,
            unit: 'т',
            workers: 11,
            photos: [{ fileId: file.fileId }],
          },
        }),
        op('op-2', 'process.comment', {
          processStateId: active.id,
          kind: 'material',
          text: 'нехватка арматуры Ø12',
        }),
      ],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.applied, 2);
    assert.equal(res.body.conflicts, 0);
    assert.ok(res.body.serverTime, 'клиент подводит часы по серверному времени');

    // Запись действительно появилась.
    const process = await api(prorab, 'GET', `/api/process/${active.id}`);
    assert.ok((process.body.comments as any[]).some((c) => c.text.includes('арматуры')));
  });

  it('повтор той же операции не создаёт дубль', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');

    const payload = {
      processStateId: active.id,
      kind: 'quality' as const,
      text: 'скол на грани колонны',
    };

    const first = await api(prorab, 'POST', '/api/v1/sync/batch', {
      operations: [op('op-dup', 'process.comment', payload)],
    });
    const second = await api(prorab, 'POST', '/api/v1/sync/batch', {
      operations: [op('op-dup', 'process.comment', payload)],
    });

    assert.equal(first.body.operations[0].duplicate, false);
    assert.equal(second.body.operations[0].duplicate, true, 'повтор обязан опознаться');
    assert.deepEqual(
      second.body.operations[0].result,
      first.body.operations[0].result,
      'повтор возвращает прежний результат',
    );

    const process = await api(prorab, 'GET', `/api/process/${active.id}`);
    const matching = (process.body.comments as any[]).filter((c) => c.text === payload.text);
    assert.equal(matching.length, 1, 'комментарий должен появиться один раз');
  });

  it('расхождение помечается и уходит в разбор ПТО, а не перезаписывает', async () => {
    await resetDatabase();
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);

    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');
    const date = new Date().toISOString();

    // На сервере запись уже есть и отчёт отправлен.
    const saved = await api(prorab, 'POST', '/api/report/entry', {
      date,
      entry: {
        processStateId: active.id,
        volume: 7,
        unit: 'т',
        workers: 10,
        photos: await photos(prorab),
      },
    });
    await api(prorab, 'POST', `/api/report/${saved.body.reportId}/submit`, { fillSeconds: 100 });

    // Устройство было офлайн и несёт свой объём, снятый раньше.
    const file = await uploadPhoto(prorab);
    const stale = new Date(Date.now() - 3 * 3_600_000).toISOString();
    const res = await api(prorab, 'POST', '/api/v1/sync/batch', {
      operations: [
        op(
          'op-conflict',
          'report.entry',
          {
            date,
            entry: {
              processStateId: active.id,
              volume: 3,
              unit: 'т',
              workers: 10,
              photos: [{ fileId: file.fileId }],
            },
          },
          stale,
        ),
      ],
    });

    assert.equal(res.body.conflicts, 1);
    const outcome = res.body.operations[0];
    assert.equal(outcome.status, 'conflict');
    assert.match(outcome.conflictNote, /разошёлся/);
    assert.ok(outcome.conflictTaskId, 'конфликт обязан породить задачу на разбор');

    // Серверное значение осталось нетронутым.
    const report = await api(prorab, 'GET', `/api/report/${saved.body.reportId}`);
    assert.equal(report.body.entries[0].volume, 7, 'серверную запись перезаписывать нельзя');

    // ПТО видит расхождение в своём списке.
    const conflicts = await api(pto, 'GET', '/api/v1/sync/conflicts');
    assert.equal(conflicts.status, 200);
    assert.ok((conflicts.body as any[]).some((c) => c.clientOpId === 'op-conflict'));

    // И получает уведомление.
    await drain();
    const inbox = await api(pto, 'GET', '/api/notifications?unread=1');
    assert.ok((inbox.body as any[]).some((n) => n.title.includes('Расхождение')));
  });

  it('не применяет изменение к уже согласованному отчёту', async () => {
    await resetDatabase();
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);

    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');
    const date = new Date().toISOString();

    const saved = await api(prorab, 'POST', '/api/report/entry', {
      date,
      entry: {
        processStateId: active.id,
        volume: 5,
        unit: 'т',
        workers: 10,
        photos: await photos(prorab),
      },
    });
    await api(prorab, 'POST', `/api/report/${saved.body.reportId}/submit`, { fillSeconds: 80 });
    await api(pto, 'POST', `/api/report/${saved.body.reportId}/check`, { decision: 'accept' });

    const file = await uploadPhoto(prorab);
    const res = await api(prorab, 'POST', '/api/v1/sync/batch', {
      operations: [
        op('op-late', 'report.entry', {
          date,
          entry: {
            processStateId: active.id,
            volume: 5,
            unit: 'т',
            workers: 10,
            photos: [{ fileId: file.fileId }],
          },
        }),
      ],
    });

    const outcome = res.body.operations[0];
    assert.equal(outcome.status, 'conflict');
    assert.match(outcome.conflictNote, /согласован/);
  });

  it('отправка отчёта из очереди двигает факт один раз', async () => {
    await resetDatabase();
    const prorab = await login(ACCOUNTS.prorab);
    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');
    const before = await api(prorab, 'GET', `/api/process/${active.id}`);

    const file = await uploadPhoto(prorab);
    const date = new Date().toISOString();

    const batch = await api(prorab, 'POST', '/api/v1/sync/batch', {
      operations: [
        op('op-e1', 'report.entry', {
          date,
          entry: {
            processStateId: active.id,
            volume: 6,
            unit: 'т',
            workers: 12,
            photos: [{ fileId: file.fileId }],
          },
        }),
      ],
    });
    const reportId = batch.body.operations[0].result.reportId as string;

    // Отправка приходит отдельной операцией — и дублируется, как это бывает при обрыве.
    const submit = { reportId, fillSeconds: 240 };
    await api(prorab, 'POST', '/api/v1/sync/batch', {
      operations: [op('op-s1', 'report.submit', submit)],
    });
    await api(prorab, 'POST', '/api/v1/sync/batch', {
      operations: [op('op-s1', 'report.submit', submit)],
    });

    const after = await api(prorab, 'GET', `/api/process/${active.id}`);
    assert.equal(after.body.doneQty, before.body.doneQty + 6, 'факт вырос ровно на объём записи');
  });

  it('разбор расхождений закрыт от площадки', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    assert.equal((await api(prorab, 'GET', '/api/v1/sync/conflicts')).status, 403);
  });
});
