/**
 * Права. Матрица ролей — фильтр на сервере: клиент может прятать кнопки,
 * но отказывать обязан сервер.
 */
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, login, resetDatabase } from './helpers.js';

const tokens: Record<string, string> = {};

describe('Права ролей', () => {
  before(async () => {
    await resetDatabase();
    for (const [role, account] of Object.entries(ACCOUNTS)) {
      tokens[role] = await login(account);
    }
  });
  after(closeAll);

  it('очередь проверки отчётов — только ПТО', async () => {
    assert.equal((await api(tokens.pto, 'GET', '/api/reports/queue')).status, 200);
    for (const role of ['prorab', 'master', 'snab', 'tech', 'sklad']) {
      assert.equal(
        (await api(tokens[role], 'GET', '/api/reports/queue')).status,
        403,
        `${role} не должен видеть очередь ПТО`,
      );
    }
  });

  it('остановка работ — только главный инженер', async () => {
    const objects = await api(tokens.gi, 'GET', '/api/objects');
    const objectId = (objects.body as any[])[0].id;

    for (const role of ['dir', 'pto', 'prorab', 'snab']) {
      assert.equal(
        (await api(tokens[role], 'POST', '/api/boss/stop-work', { objectId, reason: 'тест' })).status,
        403,
        `${role} не должен останавливать работы`,
      );
    }
    assert.equal(
      (await api(tokens.gi, 'POST', '/api/boss/stop-work', { objectId, reason: 'нарушение ТБ' })).status,
      200,
    );
  });

  it('лимиты автономности меняет только директор', async () => {
    const payload = { role: 'gi', scope: 'payment', limit: 9 };
    for (const role of ['gi', 'pto', 'prorab']) {
      assert.equal((await api(tokens[role], 'PUT', '/api/boss/limits', payload)).status, 403);
    }
    assert.equal((await api(tokens.dir, 'PUT', '/api/boss/limits', payload)).status, 200);
  });

  it('пользователей заводят ПТО и главный инженер, но не прораб', async () => {
    const payload = { fullName: 'Новый Мастер', phone: '+996 555 111 222', role: 'master' };
    assert.equal((await api(tokens.prorab, 'POST', '/api/users', payload)).status, 403);
    assert.equal((await api(tokens.snab, 'POST', '/api/users', payload)).status, 403);
    assert.equal((await api(tokens.pto, 'POST', '/api/users', payload)).status, 201);
    assert.equal(
      (await api(tokens.gi, 'POST', '/api/users', { ...payload, phone: '+996 555 111 223' })).status,
      201,
    );
  });

  it('нормализацию позиции делает снабжение, а не прораб', async () => {
    const mine = await api(tokens.prorab, 'GET', '/api/zayavki?scope=mine');
    const target = (mine.body as any[])[0];
    const catalog = await api(tokens.snab, 'GET', '/api/catalog');
    const payload = {
      itemId: target.items[0].id,
      catalogItemId: (catalog.body as any[])[0].id,
      rememberAlias: true,
    };
    assert.equal((await api(tokens.prorab, 'POST', `/api/zayavki/${target.id}/normalize`, payload)).status, 403);
    assert.equal((await api(tokens.snab, 'POST', `/api/zayavki/${target.id}/normalize`, payload)).status, 200);
  });

  it('мастер только фиксирует нарушение, предписание выдаёт прораб', async () => {
    const contractors = await api(tokens.prorab, 'GET', '/api/contractors');
    const contractorId = (contractors.body as any[])[0].id;
    const payload = {
      kind: 'safety',
      text: 'Работа на высоте без страховки',
      location: 'Блок А, 5 эт.',
      dueDays: 3,
    };

    const byMaster = await api(tokens.master, 'POST', `/api/contractors/${contractorId}/prescription`, payload);
    assert.equal(byMaster.status, 200);
    assert.equal(byMaster.body.issued, false, 'мастер фиксирует, но не выдаёт предписание');

    const byProrab = await api(tokens.prorab, 'POST', `/api/contractors/${contractorId}/prescription`, payload);
    assert.equal(byProrab.status, 200);
    assert.equal(byProrab.body.issued, true);
    assert.ok(byProrab.body.number);
  });

  it('AI-помощник фильтрует данные по роли до ответа, а не после', async () => {
    const prorabSuggestions = await api(tokens.prorab, 'GET', '/api/assistant/suggestions');
    const keys = (prorabSuggestions.body as any[]).map((s) => s.key);
    assert.ok(!keys.includes('money-loss'), 'прорабу не предлагают вопросы про деньги компании');

    // Прямой вызов ключа чужой роли тоже не проходит.
    const direct = await api(tokens.prorab, 'POST', '/api/assistant/ask', { key: 'money-loss' });
    assert.equal(direct.body.answered, false);

    const forDirector = await api(tokens.dir, 'POST', '/api/assistant/ask', { key: 'money-loss' });
    assert.equal(forDirector.body.answered, true);
    assert.ok(forDirector.body.source, 'ответ обязан ссылаться на источник');
  });

  it('на вопрос вне шаблонов отвечает честным отказом, а не выдумкой', async () => {
    const res = await api(tokens.prorab, 'POST', '/api/assistant/ask', {
      text: 'какая маржа у объекта и сколько зарабатывает директор',
    });
    assert.equal(res.body.answered, false);
    assert.match(res.body.text, /не могу ответить/i);
    assert.ok(Array.isArray(res.body.suggestions));
  });
});
