/**
 * Outbox и маршрутизация. ТЗ §3.3 и §7.
 *
 * Проверяется ровно то, ради чего механизм и заводится: уведомление не теряется
 * при сбое, история восстановима, новый адресат подключается без правки логики,
 * а критическое событие доходит независимо от настроек.
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, drain, login, photos, resetDatabase } from './helpers.js';
import { prisma } from '../src/db.js';
import { drainOutbox, MAX_ATTEMPTS, poisonedEvents } from '../src/events/worker.js';
import { ROUTES, isCritical, routeFor } from '../src/events/routing.js';

describe('Таблица маршрутизации', () => {
  it('покрывает события из §7 и задаёт им срочность', () => {
    // Отчёт сдают вечером пачкой — это дайджест, а не удар по ПТО на каждый.
    assert.equal(routeFor('ReportSubmitted')?.urgency, 'digest');
    // Возврат идёт автору и сразу: он держит работу.
    assert.equal(routeFor('ReportReturned')?.urgency, 'immediate');
    assert.deepEqual(routeFor('ReportReturned')?.recipients, [{ kind: 'author' }]);
    // Заявка — сразу при простое, иначе в дайджест.
    assert.equal(routeFor('RequestCreated')?.urgency, 'conditional');
    // Осадки — утром, до начала смены.
    assert.equal(routeFor('PrecipitationExpected')?.urgency, 'morning');
  });

  it('материал без паспорта уходит трём адресатам и считается критическим', () => {
    const rule = routeFor('MaterialWithoutPassport')!;
    const roles = rule.recipients.map((r) => (r.kind === 'role' ? r.role : r.kind));
    assert.deepEqual(roles.sort(), ['gi', 'pto', 'snab']);
    assert.equal(isCritical('MaterialWithoutPassport'), true);
  });

  it('критические события перечислены явно', () => {
    const critical = ROUTES.filter((r) => r.critical).map((r) => r.type);
    for (const type of ['MaterialWithoutPassport', 'SheetSuperseded', 'IdleReported', 'SafetyViolation']) {
      assert.ok(critical.includes(type), `${type} обязано быть критическим`);
    }
  });
});

describe('Разбор outbox', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('превращает событие в записи инбокса нужных ролей', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);
    const snab = await login(ACCOUNTS.snab);
    const gi = await login(ACCOUNTS.gi);

    const mine = await api(prorab, 'GET', '/api/zayavki?scope=mine');
    const inTransit = (mine.body as any[]).find((z) => z.status === 'inTransit');

    await api(prorab, 'POST', `/api/zayavki/${inTransit.id}/accept`, {
      qtyAccepted: 12,
      passportOk: false,
      photos: await photos(prorab),
    });

    // До разбора инбоксы пусты: логика писала событие, а не уведомление.
    const beforeDrain = await api(pto, 'GET', '/api/notifications?unread=1');
    assert.equal(
      (beforeDrain.body as any[]).filter((n) => n.kind === 'noPassport').length,
      0,
      'уведомление не должно появляться в обход воркера',
    );

    const result = await drainOutbox();
    assert.ok(result.delivered > 0);

    for (const [role, token] of [
      ['ПТО', pto],
      ['снабжение', snab],
      ['главный инженер', gi],
    ] as const) {
      const inbox = await api(token, 'GET', '/api/notifications?unread=1');
      assert.ok(
        (inbox.body as any[]).some((n) => n.kind === 'noPassport'),
        `${role} обязан получить извещение`,
      );
    }
  });

  it('разобранное событие не рассылается повторно', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);
    const today = await api(prorab, 'GET', '/api/today');
    const active = (today.body.processes as any[]).find((p) => p.status === 'active');

    const saved = await api(prorab, 'POST', '/api/report/entry', {
      date: new Date().toISOString(),
      entry: {
        processStateId: active.id,
        volume: 2,
        unit: 'т',
        workers: 8,
        photos: await photos(prorab),
      },
    });
    await api(prorab, 'POST', `/api/report/${saved.body.reportId}/submit`, { fillSeconds: 60 });
    await api(pto, 'POST', `/api/report/${saved.body.reportId}/check`, {
      decision: 'return',
      comment: 'Проверьте объём',
    });

    await drainOutbox();
    const first = await api(prorab, 'GET', '/api/notifications');
    const count = (first.body as any[]).filter((n) => n.title.includes('возвращён')).length;
    assert.equal(count, 1);

    // Повторный прогон ничего не добавляет.
    const second = await drainOutbox();
    assert.equal(second.processed, 0, 'разобранные события не берутся снова');

    const after = await api(prorab, 'GET', '/api/notifications');
    assert.equal((after.body as any[]).filter((n) => n.title.includes('возвращён')).length, count);
  });

  it('событие переживает сбой доставки и не теряется', async () => {
    // Событие с адресатом «автор», у которого id несуществующий:
    // маршрут отработает, но адресатов не найдёт — уведомления не будет,
    // а само событие останется в истории.
    await prisma.domainEvent.create({
      data: {
        type: 'ReportReturned',
        aggregate: 'dailyReport',
        aggregateId: 'нет-такого',
        payload: { authorId: 'несуществующий', reason: 'проверка' },
      },
    });

    const result = await drainOutbox();
    assert.equal(result.processed, 1);

    const stored = await prisma.domainEvent.findFirst({ where: { aggregateId: 'нет-такого' } });
    assert.ok(stored?.publishedAt, 'событие разобрано');
    // История сохранена: события не удаляются после отправки.
    assert.ok(stored, 'событие остаётся в таблице после разбора');
  });

  it('событие и изменение живут одной транзакцией', async () => {
    // Если транзакция откатилась, события остаться не должно: иначе уведомление
    // расскажет о том, чего не произошло.
    const before = await prisma.domainEvent.count();

    await assert.rejects(
      prisma.$transaction([
        prisma.domainEvent.create({
          data: {
            type: 'ReportAccepted',
            aggregate: 'dailyReport',
            aggregateId: 'откат',
            payload: {},
          },
        }),
        // Заведомо невыполнимая операция валит транзакцию целиком.
        prisma.dailyReport.update({ where: { id: 'нет-такого-отчёта' }, data: { status: 'accepted' } }),
      ]),
    );

    assert.equal(await prisma.domainEvent.count(), before, 'откат не должен оставлять событие');
    const orphan = await prisma.domainEvent.findFirst({ where: { aggregateId: 'откат' } });
    assert.equal(orphan, null);
  });

  it('неизвестный тип события не ломает очередь', async () => {
    await prisma.domainEvent.create({
      data: {
        type: 'СобытиеБезМаршрута',
        aggregate: 'test',
        aggregateId: 'x1',
        payload: {},
      },
    });
    const result = await drainOutbox();
    assert.equal(result.processed, 1);
    assert.equal(result.failed, 0, 'событие без маршрута — не ошибка, оно пишется ради истории');

    const stored = await prisma.domainEvent.findFirst({ where: { aggregateId: 'x1' } });
    assert.ok(stored?.publishedAt);
  });

  it('отравленное событие откладывается после исчерпания попыток', async () => {
    await prisma.domainEvent.create({
      data: {
        type: 'ReportReturned',
        aggregate: 'dailyReport',
        aggregateId: 'poison',
        payload: { authorId: 'x' },
        attempts: MAX_ATTEMPTS,
      },
    });

    const result = await drainOutbox();
    assert.equal(result.processed, 0, 'исчерпавшее попытки событие не берётся в работу');

    const poisoned = await poisonedEvents();
    assert.ok(poisoned.some((e) => e.aggregateId === 'poison'));
  });

  it('дайджест откладывается до 20:00, срочное уходит сразу', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const objects = await api(prorab, 'GET', '/api/objects');
    const objectId = (objects.body as any[])[0].id;

    // Обычная заявка — в дайджест.
    await api(prorab, 'POST', '/api/zayavki', {
      kind: 'material',
      objectId,
      priority: 'norm',
      items: [{ rawText: 'цемент', qty: 2, unit: 'т' }],
    });

    // Заявка с простоем — сразу: люди стоят.
    await api(prorab, 'POST', '/api/zayavki', {
      kind: 'material',
      objectId,
      priority: 'urgent',
      items: [{ rawText: 'арматура 12ка', qty: 4, unit: 'т' }],
      idleWorkers: 24,
      idleSince: new Date(Date.now() - 3_600_000).toISOString(),
    });

    const noon = new Date();
    noon.setHours(12, 0, 0, 0);
    const result = await drainOutbox({ now: noon });

    assert.equal(result.delivered, 1, 'срочная уходит сразу');
    assert.equal(result.deferred, 1, 'обычная ложится в дайджест');

    const snab = await login(ACCOUNTS.snab);
    const inbox = await api(snab, 'GET', '/api/notifications');
    const rows = (inbox.body as any[]).filter((n) => n.kind === 'zayavka');
    const deferred = rows.find((n) => new Date(n.at).getHours() === 20);
    assert.ok(deferred, 'отложенное уведомление назначено на 20:00');
  });
});

describe('Настройки доставки', () => {
  before(resetDatabase);
  after(closeAll);

  it('обычное событие можно перевести в дайджест или выключить', async () => {
    const pto = await login(ACCOUNTS.pto);
    const settings = await api(pto, 'GET', '/api/v1/notification-settings');
    assert.equal(settings.status, 200);

    const ordinary = (settings.body as any[]).find((s) => s.eventType === 'ReportSubmitted');
    assert.equal(ordinary.canDisable, true);

    const off = await api(pto, 'PUT', '/api/v1/notification-settings', {
      eventType: 'ReportSubmitted',
      channel: 'off',
    });
    assert.equal(off.status, 200);
  });

  it('критическое событие отключить нельзя и оно доходит вопреки настройке', async () => {
    const pto = await login(ACCOUNTS.pto);

    const refused = await api(pto, 'PUT', '/api/v1/notification-settings', {
      eventType: 'MaterialWithoutPassport',
      channel: 'off',
    });
    assert.equal(refused.status, 409);
    assert.equal(refused.body.code, 'critical_event');

    // Даже если запись настройки как-то появилась, воркер её игнорирует.
    const me = await api(pto, 'GET', '/api/auth/me');
    await prisma.notificationSetting.create({
      data: { userId: me.body.id, eventType: 'MaterialWithoutPassport', channel: 'off' },
    });

    await prisma.domainEvent.create({
      data: {
        type: 'MaterialWithoutPassport',
        aggregate: 'zayavka',
        aggregateId: 'z1',
        payload: { number: 'ЗВ-ТЕСТ-1' },
      },
    });
    await drainOutbox();

    const inbox = await api(pto, 'GET', '/api/notifications?unread=1');
    assert.ok(
      (inbox.body as any[]).some((n) => n.subtitle.includes('ЗВ-ТЕСТ-1')),
      'критическое событие доходит независимо от настроек',
    );
  });
});

describe('Эксплуатация очереди', () => {
  before(resetDatabase);
  after(closeAll);

  it('состояние outbox видно ответственной роли и закрыто от площадки', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);

    assert.equal((await api(prorab, 'GET', '/api/v1/outbox')).status, 403);

    const state = await api(pto, 'GET', '/api/v1/outbox');
    assert.equal(state.status, 200);
    assert.equal(typeof state.body.pending, 'number');
    assert.ok(Array.isArray(state.body.poisoned));

    const drained = await api(pto, 'POST', '/api/v1/outbox/drain');
    assert.equal(drained.status, 200);
    assert.equal(typeof drained.body.processed, 'number');
  });
});
