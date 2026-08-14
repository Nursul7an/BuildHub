/**
 * Наблюдаемость. ТЗ §3.1 и §11.
 *
 * Смысл не в том, чтобы отдать JSON с числами, а в том, чтобы мерить
 * ровно то, что записано в требовании: p95 ≤ 400 мс на чтение,
 * ≤ 800 мс на запись, загрузка файлов отдельно.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, getApp, login, resetDatabase } from './helpers.js';
import {
  SLA_READ_P95_MS,
  SLA_WRITE_P95_MS,
  record,
  report,
  prometheus,
  reset,
  slaSummary,
} from '../src/observability.js';

describe('Подсчёт квантилей', () => {
  beforeEach(reset);

  it('p95 берёт девяносто пятый процентиль, а не среднее', () => {
    // Девяносто быстрых ответов и десять медленных: среднее соврало бы.
    for (let i = 0; i < 90; i += 1) record('GET', '/api/works', 200, 50);
    for (let i = 0; i < 10; i += 1) record('GET', '/api/works', 200, 2000);

    const row = report().find((r) => r.route === '/api/works')!;
    assert.equal(row.count, 100);
    assert.ok(row.avgMs > 200 && row.avgMs < 300, 'среднее размывает хвост');
    assert.equal(row.p95Ms, 2000, 'p95 показывает хвост, из-за которого и жалуются');
  });

  it('чтение и запись судятся по разным целям из §11', () => {
    record('GET', '/api/today', 200, 500);
    record('POST', '/api/report/entry', 200, 500);

    const rows = report();
    const read = rows.find((r) => r.method === 'GET')!;
    const write = rows.find((r) => r.method === 'POST')!;

    assert.equal(read.kind, 'read');
    assert.equal(read.targetMs, SLA_READ_P95_MS);
    assert.equal(read.withinSla, false, '500 мс на чтение — выше цели 400');

    assert.equal(write.kind, 'write');
    assert.equal(write.targetMs, SLA_WRITE_P95_MS);
    assert.equal(write.withinSla, true, '500 мс на запись — в пределах цели 800');
  });

  it('загрузка файлов из SLA исключена, как сказано в §11', () => {
    record('PUT', '/api/v1/files/content', 200, 9000);
    const row = report().find((r) => r.route === '/api/v1/files/content')!;

    assert.equal(row.kind, 'file');
    assert.equal(row.targetMs, null);
    assert.equal(row.withinSla, null, 'фото в 5 МБ не обязано укладываться в 800 мс');
  });

  it('5xx и 4xx считаются раздельно', () => {
    record('POST', '/api/zayavki', 500, 10);
    record('POST', '/api/zayavki', 422, 10);
    record('POST', '/api/zayavki', 200, 10);

    const row = report().find((r) => r.route === '/api/zayavki')!;
    assert.equal(row.errors, 1, 'сбой сервера');
    assert.equal(row.rejected, 1, 'осознанный отказ — это не сбой');
    assert.equal(row.count, 3);
  });
});

describe('Сводка по SLA', () => {
  beforeEach(reset);

  it('маршрут с малой выборкой в сводку не попадает', () => {
    // По трём запросам p95 ничего не значит — поднимать тревогу рано.
    for (let i = 0; i < 3; i += 1) record('GET', '/api/works', 200, 5000);
    assert.equal(slaSummary().measured, 0);
    assert.equal(slaSummary().ok, true);
  });

  it('превышение попадает в сводку с величиной отставания', () => {
    for (let i = 0; i < 40; i += 1) record('GET', '/api/today', 200, 900);

    const sla = slaSummary();
    assert.equal(sla.ok, false);
    const breach = sla.breaching.find((b) => b.route === 'GET /api/today')!;
    assert.ok(breach, 'нарушение обязано называть маршрут');
    assert.equal(breach.targetMs, SLA_READ_P95_MS);
    assert.equal(breach.overBy, 900 - SLA_READ_P95_MS, 'видно, насколько именно медленнее');
  });

  it('целевые значения возвращаются вместе со сводкой', () => {
    const sla = slaSummary();
    assert.equal(sla.targets.readP95Ms, 400);
    assert.equal(sla.targets.writeP95Ms, 800);
  });
});

describe('Выгрузка для Prometheus', () => {
  beforeEach(reset);

  it('отдаёт счётчики и квантили в текстовом формате', () => {
    for (let i = 0; i < 25; i += 1) record('GET', '/api/works', 200, 120);
    const text = prometheus();

    assert.match(text, /# TYPE buildhub_requests_total counter/);
    assert.match(text, /buildhub_requests_total\{method="GET",route="\/api\/works",kind="read"\} 25/);
    assert.match(text, /buildhub_request_duration_ms\{[^}]*quantile="0.95"\}/);
    assert.match(text, /buildhub_sla_breaching_routes \d+/, 'метрика под алерт по SLA (§3.1)');
  });

  it('нарушение SLA видно отдельной метрикой — по ней и настраивается алерт', () => {
    for (let i = 0; i < 40; i += 1) record('GET', '/api/today', 200, 1500);
    const text = prometheus();
    assert.match(text, /buildhub_sla_breaching_routes 1/);
  });
});

describe('Эксплуатационные ручки', () => {
  beforeEach(async () => {
    await resetDatabase();
    reset();
  });
  after(closeAll);

  it('готовность отличается от живости', async () => {
    const app = await getApp();

    const alive = await app.inject({ method: 'GET', url: '/api/health' });
    assert.equal(alive.statusCode, 200);
    assert.deepEqual(alive.json(), { ok: true });

    // Готовность проверяет, что база отвечает: процесс может быть жив
    // и при этом не способен обслужить ни одного запроса.
    const ready = await app.inject({ method: 'GET', url: '/api/health/ready' });
    assert.equal(ready.statusCode, 200);
    assert.equal(ready.json().database, 'ok');
    assert.equal(typeof ready.json().latencyMs, 'number');
  });

  it('каждый ответ несёт идентификатор запроса', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    assert.ok(res.headers['x-request-id'], 'без него на жалобу нечего искать в журнале');
  });

  it('переданный идентификатор сохраняется сквозь запрос', async () => {
    const app = await getApp();
    const res = await app.inject({
      method: 'GET',
      url: '/api/health',
      headers: { 'x-request-id': 'mobile-42-a7f3' },
    });
    // Клиент передаёт свой идентификатор — так связывается след
    // от нажатия на экране до записи в журнале сервера.
    assert.equal(res.headers['x-request-id'], 'mobile-42-a7f3');
  });

  it('небезопасный идентификатор заменяется своим, а не роняет заголовок', async () => {
    const app = await getApp();
    for (const bad of ['мобильный-клиент', 'x'.repeat(200), 'has space', 'inject\nheader']) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/health',
        headers: { 'x-request-id': bad },
      });
      const id = res.headers['x-request-id'] as string;
      assert.ok(id, `заголовок обязан вернуться даже при «${bad.slice(0, 20)}»`);
      assert.notEqual(id, bad);
      assert.match(id, /^[A-Za-z0-9-]{36}$/, 'подставляется собственный UUID');
    }
  });

  it('SLA и разбор по маршрутам доступны ответственной роли', async () => {
    const pto = await login(ACCOUNTS.pto);
    const prorab = await login(ACCOUNTS.prorab);

    assert.equal((await api(prorab, 'GET', '/api/v1/ops/sla')).status, 403);

    const sla = await api(pto, 'GET', '/api/v1/ops/sla');
    assert.equal(sla.status, 200);
    assert.equal(sla.body.targets.readP95Ms, 400);
    // Очередь событий — часть здоровья системы, а не отдельная тема.
    assert.equal(typeof sla.body.outbox.pending, 'number');

    const routes = await api(pto, 'GET', '/api/v1/ops/routes');
    assert.equal(routes.status, 200);
    assert.ok(Array.isArray(routes.body));
  });

  it('метрики отдаются в формате Prometheus', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'GET', url: '/metrics' });

    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] as string, /text\/plain/);
    assert.match(res.body, /buildhub_requests_total/);
  });

  it('живые запросы попадают в замеры', async () => {
    const token = await login(ACCOUNTS.prorab);
    await api(token, 'GET', '/api/today');

    const measured = report().find((r) => r.route === '/api/today');
    assert.ok(measured, 'обращение к экрану «Сегодня» обязано измеряться');
    assert.ok(measured!.count >= 1);
    assert.ok(measured!.p95Ms >= 0);
  });

  it('маршрут в метрике не разваливается на идентификаторы', async () => {
    const token = await login(ACCOUNTS.prorab);
    const today = await api(token, 'GET', '/api/today');
    const process = (today.body.processes as any[])[0];

    await api(token, 'GET', `/api/process/${process.id}`);
    await api(token, 'GET', `/api/process/${process.id}`);

    // Иначе каждый идентификатор в URL порождает свою метрику,
    // и наблюдаемость превращается в шум.
    const rows = report().filter((r) => r.route.startsWith('/api/process'));
    assert.equal(rows.length, 1, 'один маршрут, а не по строке на объект');
    assert.equal(rows[0]!.route, '/api/process/:id');
    assert.equal(rows[0]!.count, 2);
  });
});
