/**
 * KPI. ТЗ §6 и §9.
 *
 * Проверяем три вещи: показатель считается из записей и его можно
 * пересчитать по слагаемым; при нехватке данных он честно молчит,
 * а не показывает ноль; и пока идёт период измерения, вердикт
 * не выносится, сколько бы ни было наблюдений.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, login, resetDatabase } from './helpers.js';
import { prisma } from '../src/db.js';
import { computeKpi } from '../src/services/kpi.js';

/** Отчёты за прошедшие дни: часть в срок, часть после 20:00. */
async function seedReports(onTime: number, late: number) {
  const author = await prisma.user.findFirstOrThrow({ where: { login: ACCOUNTS.prorab } });
  const object = await prisma.constructionObject.findFirstOrThrow({ where: { code: 'АКО' } });

  let day = 1;
  for (let i = 0; i < onTime + late; i += 1) {
    const date = new Date();
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    day += 1;

    const submitted = new Date(date);
    // В срок — до 20:00, с опозданием — после.
    submitted.setHours(i < onTime ? 18 : 22, 30, 0, 0);

    await prisma.dailyReport.create({
      data: {
        date,
        authorId: author.id,
        objectId: object.id,
        status: 'accepted',
        submittedAt: submitted,
      },
    });
  }
}

function metric(result: Awaited<ReturnType<typeof computeKpi>>, key: string) {
  return result.departments.flatMap((d) => d.metrics).find((m) => m.key === key)!;
}

describe('Показатель считается из записей', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('«отчёты в срок» — доля отправленных до 20:00, с проверяемыми слагаемыми', async () => {
    await prisma.dailyReport.deleteMany();
    await seedReports(7, 3);

    const kpi = await computeKpi();
    const m = metric(kpi, 'reportsOnTime');

    assert.equal(m.value, 70, '7 из 10 — это 70%');
    assert.equal(m.basis?.numerator, 7);
    assert.equal(m.basis?.denominator, 10);
    // Показатель можно пересчитать вручную — иначе на планёрке спорят о цифре.
    assert.equal(Math.round((m.basis!.numerator / m.basis!.denominator) * 100), m.value);
  });

  it('вердикт выносится по порогу: 70% против цели 90% — это плохо', async () => {
    await prisma.dailyReport.deleteMany();
    await seedReports(7, 3);

    const kpi = await computeKpi();
    const m = metric(kpi, 'reportsOnTime');
    assert.equal(m.goodAbove, 90);
    assert.equal(m.state, 'bad');
  });

  it('жёлтая зона отделяет «чуть недотянули» от «плохо»', async () => {
    await prisma.dailyReport.deleteMany();
    // 17 из 20 — 85%, это в пределах десятой части от цели 90%.
    await seedReports(17, 3);

    const kpi = await computeKpi();
    const m = metric(kpi, 'reportsOnTime');
    assert.equal(m.value, 85);
    assert.equal(m.state, 'warn', 'резкая граница провоцировала бы подгонку под цифру');
  });

  it('«возвраты отчётов» считает долю возвращённых ПТО', async () => {
    await prisma.dailyReport.deleteMany();
    await seedReports(6, 0);

    const reports = await prisma.dailyReport.findMany({ take: 2 });
    const pto = await prisma.user.findFirstOrThrow({ where: { login: ACCOUNTS.pto } });
    for (const r of reports) {
      await prisma.reportCheck.create({
        data: { reportId: r.id, actorId: pto.id, decision: 'return', comment: 'объём не сходится' },
      });
    }

    const m = metric(await computeKpi(), 'reportReturns');
    assert.equal(m.value, 33.3, '2 из 6');
    assert.equal(m.goodBelow, 10);
    assert.equal(m.state, 'bad');
  });
});

describe('Нехватка данных', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('показатель молчит, а не показывает ноль', async () => {
    await prisma.dailyReport.deleteMany();
    await seedReports(1, 0);

    const m = metric(await computeKpi(), 'reportsOnTime');
    assert.equal(m.value, null, 'по одному отчёту процент ничего не значит');
    assert.equal(m.state, 'no_data');
    assert.match(m.note!, /нужно не меньше|Отчётов за период/);
  });

  it('ноль остаётся нулём там, где он осмыслен', async () => {
    // Простоев не было — это настоящий ноль, а не отсутствие данных.
    const m = metric(await computeKpi(), 'idleHours');
    assert.equal(m.value, 0);
    assert.notEqual(m.state, 'no_data');
  });
});

describe('§9 · первый квартал только измеряет', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('в период измерения вердикт не выносится, даже если данных достаточно', async () => {
    const kpi = await computeKpi();
    const m = metric(kpi, 'staleRequests');

    assert.ok(m.value !== null, 'показатель считается');
    assert.equal(m.state, 'measuring', 'но цветом никого не судит');
    assert.match(m.note!, /Период измерения/);
    assert.ok(m.measuringUntil, 'видно, до какой даты идёт измерение');
    assert.equal(kpi.measuring, true);
  });

  it('показатель с завершённым измерением судит нормально', async () => {
    await prisma.dailyReport.deleteMany();
    await seedReports(9, 1);

    const m = metric(await computeKpi(), 'reportsOnTime');
    assert.equal(m.measuringUntil, null);
    assert.equal(m.state, 'good', '90% при цели 90% — это норма');
  });

  it('руководитель завершает измерение отдельным действием', async () => {
    const dir = await login(ACCOUNTS.dir);

    const before = metric(await computeKpi(), 'techDowntime');
    assert.equal(before.state === 'measuring' || before.state === 'no_data', true);

    const activated = await api(dir, 'POST', '/api/v1/kpi/targets/techDowntime/activate');
    assert.equal(activated.status, 200);

    const target = await prisma.kpiTarget.findFirstOrThrow({ where: { key: 'techDowntime' } });
    assert.equal(target.measuringUntil, null);
  });

  it('нельзя включить вердикт по показателю без порога', async () => {
    const dir = await login(ACCOUNTS.dir);

    await api(dir, 'PUT', '/api/v1/kpi/targets', {
      key: 'reworkRate',
      department: 'field',
      label: 'Переделки',
      unit: '%',
      source: 'новый показатель',
    });

    const res = await api(dir, 'POST', '/api/v1/kpi/targets/reworkRate/activate');
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'no_threshold');
  });
});

describe('Пороги как настройка', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('изменение порога сразу меняет вердикт — без выкатки', async () => {
    await prisma.dailyReport.deleteMany();
    await seedReports(7, 3);
    const dir = await login(ACCOUNTS.dir);

    assert.equal(metric(await computeKpi(), 'reportsOnTime').state, 'bad');

    // Руководитель опускает планку: на пилоте 65% — уже достижение.
    await api(dir, 'PUT', '/api/v1/kpi/targets', {
      key: 'reportsOnTime',
      department: 'field',
      label: 'Отчёты в срок',
      unit: '%',
      goodAbove: 65,
      source: 'решение по пилоту',
    });

    assert.equal(metric(await computeKpi(), 'reportsOnTime').state, 'good');
  });

  it('у показателя одно направление: либо выше, либо ниже', async () => {
    const dir = await login(ACCOUNTS.dir);
    const res = await api(dir, 'PUT', '/api/v1/kpi/targets', {
      key: 'reportsOnTime',
      department: 'field',
      label: 'Отчёты в срок',
      unit: '%',
      goodAbove: 90,
      goodBelow: 10,
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'ambiguous_target');
  });

  it('пороги ведёт руководитель, а не отделы', async () => {
    const payload = {
      key: 'reportsOnTime',
      department: 'field',
      label: 'Отчёты в срок',
      unit: '%',
      goodAbove: 10,
    };
    for (const account of [ACCOUNTS.pto, ACCOUNTS.gi, ACCOUNTS.prorab] as const) {
      const token = await login(account);
      assert.equal((await api(token, 'PUT', '/api/v1/kpi/targets', payload)).status, 403, account);
    }
    const dir = await login(ACCOUNTS.dir);
    assert.equal((await api(dir, 'PUT', '/api/v1/kpi/targets', payload)).status, 200);
  });

  it('смена порога попадает в журнал аудита', async () => {
    const dir = await login(ACCOUNTS.dir);
    const pto = await login(ACCOUNTS.pto);

    await api(dir, 'PUT', '/api/v1/kpi/targets', {
      key: 'leadTime',
      department: 'mat',
      label: 'Заявка → поставка',
      unit: 'дн',
      goodBelow: 4,
      source: 'новые договоры поставки',
    });

    const log = await api(pto, 'GET', '/api/v1/audit?entity=kpiTarget');
    const record = (log.body as any[])[0];
    assert.ok(record);
    assert.match(record.newValue, /ниже 4/);
    assert.equal(record.reason, 'новые договоры поставки');
  });
});

describe('Доступ к KPI', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('показатели видит руководство, не площадка', async () => {
    for (const account of [ACCOUNTS.prorab, ACCOUNTS.master, ACCOUNTS.snab] as const) {
      const token = await login(account);
      assert.equal((await api(token, 'GET', '/api/v1/kpi')).status, 403, account);
    }
    for (const account of [ACCOUNTS.dir, ACCOUNTS.gi] as const) {
      const token = await login(account);
      assert.equal((await api(token, 'GET', '/api/v1/kpi')).status, 200);
    }
  });

  it('фильтр по отделу отдаёт только его показатели', async () => {
    const dir = await login(ACCOUNTS.dir);
    const res = await api(dir, 'GET', '/api/v1/kpi?department=mat');
    assert.equal(res.status, 200);
    assert.equal((res.body.departments as any[]).length, 1);
    assert.equal(res.body.departments[0].key, 'mat');
  });

  it('старая ручка руководства считает тем же модулем', async () => {
    const dir = await login(ACCOUNTS.dir);
    const legacy = await api(dir, 'GET', '/api/boss/kpi');
    const current = await api(dir, 'GET', '/api/v1/kpi');
    // Два разных расчёта одного показателя — гарантированный спор на планёрке.
    assert.deepEqual(
      (legacy.body.departments as any[]).map((d) => d.key),
      (current.body.departments as any[]).map((d) => d.key),
    );
  });
});
