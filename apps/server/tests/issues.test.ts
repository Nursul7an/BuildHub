/**
 * Маршрутизация решений. ТЗ §2: правило кодируется в таблице issue_routing,
 * а не в клиенте. Проверяем, что адресата называет сервер, что порог по
 * деньгам работает, и что правило объекта побеждает общее по компании.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, drain, login, resetDatabase } from './helpers.js';
import { prisma } from '../src/db.js';
import { routeIssue } from '../src/services/issue-routing.js';

async function facility(code: string): Promise<string> {
  const o = await prisma.constructionObject.findFirstOrThrow({ where: { code } });
  return o.id;
}

describe('Правила из §2', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('техника, качество и охрана труда идут главному инженеру', async () => {
    for (const kind of ['technical', 'quality', 'safety'] as const) {
      const decision = await routeIssue({ issueKind: kind });
      assert.equal(decision.toRole, 'gi', `${kind} — вопрос главного инженера`);
      assert.equal(decision.origin, 'company');
    }
  });

  it('сроки договора и заказчик идут руководителю', async () => {
    for (const kind of ['schedule', 'customer'] as const) {
      const decision = await routeIssue({ issueKind: kind });
      assert.equal(decision.toRole, 'dir');
    }
  });

  it('деньги до порога решает ГИ, выше — руководитель', async () => {
    const below = await routeIssue({ issueKind: 'money', amount: 900_000 });
    assert.equal(below.toRole, 'gi');
    assert.equal(below.escalated, false);

    const above = await routeIssue({ issueKind: 'money', amount: 7_400_000 });
    assert.equal(above.toRole, 'dir');
    assert.equal(above.escalated, true);
    assert.equal(above.wouldBeRole, 'gi', 'видно, кто решал бы при меньшей сумме');
    assert.equal(above.escalateAbove, 5_000_000);
  });

  it('без суммы порог не срабатывает', async () => {
    const decision = await routeIssue({ issueKind: 'money' });
    assert.equal(decision.toRole, 'gi');
    assert.equal(decision.escalated, false);
  });

  it('правило объекта побеждает общее по компании', async () => {
    const jal = await facility('ДЖР');
    const ak = await facility('АКО');

    // По компании заказчик — забота руководителя.
    assert.equal((await routeIssue({ issueKind: 'customer', facilityId: ak })).toRole, 'dir');
    // На Джале — главного инженера, по приказу об объекте.
    const overridden = await routeIssue({ issueKind: 'customer', facilityId: jal });
    assert.equal(overridden.toRole, 'gi');
    assert.equal(overridden.origin, 'facility');
  });
});

describe('Постановка вопроса', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('клиент не выбирает адресата — его называет сервер', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const ak = await facility('АКО');

    // Клиент может заранее спросить, кто будет решать.
    const preview = await api(
      prorab,
      'GET',
      `/api/v1/issues/route?issueKind=safety&facilityId=${ak}`,
    );
    assert.equal(preview.status, 200);
    assert.equal(preview.body.toRole, 'gi');
    assert.ok(preview.body.assignee, 'подсказываем имя, но адресат — роль');

    const raised = await api(prorab, 'POST', '/api/v1/issues', {
      issueKind: 'safety',
      facilityId: ak,
      title: 'Работа на высоте без страховки, Блок А',
      detail: 'Бригада ИП Асанов, 5 этаж',
    });
    assert.equal(raised.status, 201);
    assert.equal(raised.body.routedTo, 'gi');
    assert.ok(raised.body.taskId, 'вопрос обязан стать задачей');
  });

  it('денежный вопрос выше порога уходит директору и это видно в ответе', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const dir = await login(ACCOUNTS.dir);
    const ak = await facility('АКО');

    const raised = await api(prorab, 'POST', '/api/v1/issues', {
      issueKind: 'money',
      facilityId: ak,
      title: 'Срочная закупка бетона сверх лимита',
      amount: 6_200_000,
    });

    assert.equal(raised.body.routedTo, 'dir');
    assert.equal(raised.body.escalated, true);

    await drain();
    const inbox = await api(dir, 'GET', '/api/notifications?unread=1');
    const hit = (inbox.body as any[]).find((n) => n.title.includes('выше лимита'));
    assert.ok(hit, 'директор получает вопрос с пометкой об эскалации');
    assert.match(hit.subtitle, /бетона/);
  });

  it('тот же вопрос ниже порога директора не беспокоит', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const dir = await login(ACCOUNTS.dir);
    const gi = await login(ACCOUNTS.gi);
    const ak = await facility('АКО');

    await api(prorab, 'POST', '/api/v1/issues', {
      issueKind: 'money',
      facilityId: ak,
      title: 'Докупить вязальную проволоку',
      amount: 120_000,
    });

    await drain();
    const dirInbox = await api(dir, 'GET', '/api/notifications?unread=1');
    const giInbox = await api(gi, 'GET', '/api/notifications?unread=1');

    assert.ok(
      !(dirInbox.body as any[]).some((n) => n.subtitle?.includes('проволоку')),
      'мелкие решения не доходят до руководителя — ради этого лимит и существует',
    );
    assert.ok((giInbox.body as any[]).some((n) => n.subtitle?.includes('проволоку')));
  });

  it('неизвестный объект отклоняется', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const res = await api(prorab, 'POST', '/api/v1/issues', {
      issueKind: 'technical',
      facilityId: 'нет-такого',
      title: 'Вопрос',
    });
    assert.equal(res.status, 404);
  });
});

describe('Настройка маршрутов', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('маршрут меняется без выкатки новой версии', async () => {
    const dir = await login(ACCOUNTS.dir);
    const ak = await facility('АКО');

    // Было: качество — к главному инженеру.
    assert.equal((await routeIssue({ issueKind: 'quality', facilityId: ak })).toRole, 'gi');

    const changed = await api(dir, 'PUT', '/api/v1/issues/routing', {
      issueKind: 'quality',
      scopeType: 'facility',
      scopeId: ak,
      toRole: 'pto',
      source: 'приказ №14 по объекту',
    });
    assert.equal(changed.status, 200);

    // Стало: на этом объекте качество ведёт ПТО. Кода никто не трогал.
    const after = await routeIssue({ issueKind: 'quality', facilityId: ak });
    assert.equal(after.toRole, 'pto');
    assert.equal(after.origin, 'facility');

    // На других объектах правило прежнее.
    const other = await routeIssue({ issueKind: 'quality', facilityId: await facility('БЦ') });
    assert.equal(other.toRole, 'gi');
  });

  it('маршруты ведёт руководитель, а не площадка', async () => {
    const payload = {
      issueKind: 'safety',
      scopeType: 'company',
      toRole: 'prorab',
      source: 'самовольная правка',
    };
    for (const account of [ACCOUNTS.prorab, ACCOUNTS.pto, ACCOUNTS.gi] as const) {
      const token = await login(account);
      assert.equal((await api(token, 'PUT', '/api/v1/issues/routing', payload)).status, 403, account);
    }
    const dir = await login(ACCOUNTS.dir);
    assert.equal((await api(dir, 'PUT', '/api/v1/issues/routing', payload)).status, 200);
  });

  it('порог без адресата не принимается', async () => {
    const dir = await login(ACCOUNTS.dir);
    const res = await api(dir, 'PUT', '/api/v1/issues/routing', {
      issueKind: 'money',
      scopeType: 'company',
      toRole: 'gi',
      escalateAbove: 1_000_000,
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'escalate_role_required');
  });

  it('правило по объекту требует указания объекта', async () => {
    const dir = await login(ACCOUNTS.dir);
    const res = await api(dir, 'PUT', '/api/v1/issues/routing', {
      issueKind: 'technical',
      scopeType: 'facility',
      toRole: 'pto',
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'scope_required');
  });

  it('смена маршрута попадает в журнал аудита', async () => {
    const dir = await login(ACCOUNTS.dir);
    const pto = await login(ACCOUNTS.pto);

    await api(dir, 'PUT', '/api/v1/issues/routing', {
      issueKind: 'schedule',
      scopeType: 'company',
      toRole: 'gi',
      source: 'новая оргструктура',
    });

    const log = await api(pto, 'GET', '/api/v1/audit?entity=issueRouting');
    const record = (log.body as any[])[0];
    assert.ok(record);
    assert.equal(record.oldValue, 'dir');
    assert.equal(record.newValue, 'gi');
    assert.equal(record.reason, 'новая оргструктура');
  });

  it('таблица маршрутов читается целиком', async () => {
    const dir = await login(ACCOUNTS.dir);
    const routing = await api(dir, 'GET', '/api/v1/issues/routing');
    assert.equal(routing.status, 200);

    const kinds = new Set((routing.body as any[]).map((r) => r.issueKind));
    for (const kind of ['technical', 'quality', 'safety', 'money', 'schedule', 'customer']) {
      assert.ok(kinds.has(kind), `${kind} обязан быть в таблице`);
    }

    const money = (routing.body as any[]).find((r) => r.issueKind === 'money');
    assert.equal(money.escalateAbove, 5_000_000);
    assert.equal(money.escalateToRole, 'dir');
  });
});
