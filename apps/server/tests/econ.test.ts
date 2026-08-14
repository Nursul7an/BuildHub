/**
 * Экономика. Критерий приёмки 9: «Все финансовые показатели сходятся
 * арифметически и содержат дату актуальности затрат».
 *
 * Проверяется не «отдаёт ли ручка JSON», а сходятся ли числа: сумма
 * позиций равна итогу, EAC выводится из CPI, разрыв «освоено — подписано»
 * равен разнице своих слагаемых.
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, login, resetDatabase } from './helpers.js';
import { prisma } from '../src/db.js';
import { econSummary } from '../src/services/econ.js';

async function akId(): Promise<string> {
  const ak = await prisma.constructionObject.findFirstOrThrow({ where: { code: 'АКО' } });
  return ak.id;
}

/** Деньги сравниваем с точностью до копейки, а не по строгому равенству float. */
function close(actual: number, expected: number, tolerance = 0.02) {
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} должно совпадать с ${expected} (допуск ${tolerance})`,
  );
}

describe('Критерий 9 · показатели сходятся арифметически', () => {
  before(resetDatabase);
  after(closeAll);

  it('EV равен сумме освоения по позициям ВОР', async () => {
    const id = await akId();
    const dir = await login(ACCOUNTS.dir);

    const summary = await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`);
    const breakdown = await api(dir, 'GET', `/api/v1/econ/breakdown?facilityId=${id}`);

    const sumOfLines = (breakdown.body as any[]).reduce((a, b) => a + b.earned, 0);
    close(summary.body.ev, sumOfLines);
    assert.equal(summary.body.checks.evEqualsSumOfLines, true);
  });

  it('BAC равен сумме позиций ВОР по расценкам', async () => {
    const id = await akId();
    const dir = await login(ACCOUNTS.dir);

    const boq = await api(dir, 'GET', `/api/v1/econ/boq?facilityId=${id}`);
    const summary = await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`);

    const total = (boq.body as any[]).reduce((a, i) => a + i.qty * i.rate, 0);
    close(summary.body.bac, total);
  });

  it('AC равен сумме строк затрат, а разбивка по статьям — самому AC', async () => {
    const id = await akId();
    const dir = await login(ACCOUNTS.dir);
    const summary = await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`);

    const facts = await prisma.costFact.findMany({ where: { objectId: id } });
    const total = facts.reduce((a, f) => a + Number(f.amount), 0);
    close(summary.body.ac, total);

    const byArticle = (summary.body.articles as any[]).reduce((a, x) => a + x.amount, 0);
    close(byArticle, summary.body.ac);

    // Доли по статьям складываются в сотню.
    const pct = (summary.body.articles as any[]).reduce((a, x) => a + x.pct, 0);
    close(pct, 100, 0.3);
  });

  it('CPI, EAC и VAC выводятся друг из друга', async () => {
    const id = await akId();
    const dir = await login(ACCOUNTS.dir);
    const s = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).body;

    // CPI = EV / AC
    close(s.cpi, s.ev / s.ac, 0.001);
    // EAC = BAC / CPI
    close(s.eac, s.bac / s.cpi, 1);
    // VAC = BAC − EAC
    close(s.vac, s.bac - s.eac, 1);
    assert.equal(s.checks.vacEqualsBacMinusEac, true);
  });

  it('разрыв «освоено — подписано» равен разнице слагаемых', async () => {
    const id = await akId();
    const dir = await login(ACCOUNTS.dir);
    const s = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).body;

    close(s.closure.gapEarnedToSigned, s.ev - s.closure.signed);
    close(s.closure.receivable, s.closure.signed - s.closure.paid);
  });

  it('показывает перерасход, когда тратим быстрее, чем осваиваем', async () => {
    const id = await akId();
    const dir = await login(ACCOUNTS.dir);
    const s = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).body;

    // Ради этого разговора модуль и существует: прогноз выходит за бюджет.
    assert.ok(s.cpi < 1, 'CPI ниже единицы');
    assert.ok(s.eac > s.bac, 'прогноз по завершении выше бюджета');
    assert.ok(s.vac < 0, 'отклонение отрицательное — это перерасход');
  });
});

describe('Критерий 9 · дата актуальности затрат', () => {
  before(resetDatabase);
  after(closeAll);

  it('сводка несёт дату актуальности', async () => {
    const dir = await login(ACCOUNTS.dir);
    const s = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${await akId()}`)).body;

    assert.ok(s.costsAsOf, 'без даты актуальности цифра ничего не значит');
    assert.equal(typeof s.costsStale, 'boolean');
  });

  it('помечает данные несвежими, если 1С давно не выгружалась', async () => {
    const id = await akId();
    // Отодвигаем актуальность на неделю назад.
    await prisma.costFact.updateMany({
      where: { objectId: id },
      data: { actualAsOf: new Date(Date.now() - 7 * 86_400_000) },
    });

    const summary = await econSummary(id);
    assert.equal(summary.costsStale, true, 'недельные данные обязаны помечаться устаревшими');
  });

  it('объект без затрат не притворяется посчитанным', async () => {
    const other = await prisma.constructionObject.findFirstOrThrow({ where: { code: 'ШК94' } });
    const summary = await econSummary(other.id);

    assert.equal(summary.costsAsOf, null);
    assert.equal(summary.costsStale, true);
    assert.equal(summary.ac, 0);
    assert.equal(summary.cpi, null, 'делить на ноль нельзя — возвращаем null, а не бесконечность');
    assert.equal(summary.eac, null);
  });
});

describe('Импорт затрат из 1С', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('принимает выгрузку и проставляет дату актуальности', async () => {
    const dir = await login(ACCOUNTS.dir);
    const asOf = new Date().toISOString();

    const res = await api(dir, 'POST', '/api/v1/integrations/1c/costs', {
      actualAsOf: asOf,
      rows: [
        {
          facilityCode: 'АКО',
          article: 'Материалы',
          amount: 100_000,
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
        },
      ],
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.imported, 1);

    const status = await api(dir, 'GET', '/api/v1/integrations/1c/status');
    assert.equal(status.body.status, 'done');
    assert.equal(status.body.stale, false);
  });

  it('повторная выгрузка того же периода не удваивает затраты', async () => {
    const dir = await login(ACCOUNTS.dir);
    const id = await akId();
    const before = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).body.ac;

    const row = {
      facilityCode: 'АКО',
      article: 'Материалы',
      amount: 50_000,
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    };
    const payload = { actualAsOf: new Date().toISOString(), rows: [row] };

    await api(dir, 'POST', '/api/v1/integrations/1c/costs', payload);
    const afterFirst = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).body.ac;
    close(afterFirst, before + 50_000);

    // 1С выгружается раз в сутки и может прислать тот же период снова.
    await api(dir, 'POST', '/api/v1/integrations/1c/costs', payload);
    const afterSecond = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).body.ac;
    close(afterSecond, afterFirst, 0.02);
  });

  it('уточнённая сумма за тот же период заменяет прежнюю', async () => {
    const dir = await login(ACCOUNTS.dir);
    const id = await akId();
    const before = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).body.ac;

    const base = {
      facilityCode: 'АКО',
      article: 'Техника',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
    };
    await api(dir, 'POST', '/api/v1/integrations/1c/costs', {
      actualAsOf: new Date().toISOString(),
      rows: [{ ...base, amount: 10_000 }],
    });
    await api(dir, 'POST', '/api/v1/integrations/1c/costs', {
      actualAsOf: new Date().toISOString(),
      rows: [{ ...base, amount: 12_500 }],
    });

    const after = (await api(dir, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).body.ac;
    close(after, before + 12_500);
  });

  it('строки с неизвестным объектом не молчат', async () => {
    const dir = await login(ACCOUNTS.dir);
    const res = await api(dir, 'POST', '/api/v1/integrations/1c/costs', {
      actualAsOf: new Date().toISOString(),
      rows: [
        {
          facilityCode: 'НЕТ-ТАКОГО',
          article: 'Материалы',
          amount: 1,
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
        },
      ],
    });
    assert.equal(res.status, 422);
    assert.equal(res.body.code, 'import_failed');
  });
});

describe('Закрытие актами', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('ведёт акт по шагам и не даёт подписать больше предъявленного', async () => {
    const dir = await login(ACCOUNTS.dir);
    const id = await akId();

    const created = await api(dir, 'POST', '/api/v1/econ/acts', {
      facilityId: id,
      number: 'КС-2 №9',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      amountCompleted: 300_000,
    });
    assert.equal(created.status, 200);

    // Из черновика сразу в подписанный — нельзя.
    const skipped = await api(dir, 'POST', `/api/v1/econ/acts/${created.body.id}/transition`, {
      to: 'signed',
      amount: 300_000,
    });
    assert.equal(skipped.status, 409);

    await api(dir, 'POST', `/api/v1/econ/acts/${created.body.id}/transition`, {
      to: 'submitted',
      amount: 280_000,
    });

    // Подписать больше предъявленного — отчётность разъедется.
    const tooMuch = await api(dir, 'POST', `/api/v1/econ/acts/${created.body.id}/transition`, {
      to: 'signed',
      amount: 300_000,
    });
    assert.equal(tooMuch.status, 422);
    assert.equal(tooMuch.body.code, 'above_submitted');

    const signed = await api(dir, 'POST', `/api/v1/econ/acts/${created.body.id}/transition`, {
      to: 'signed',
      amount: 265_000,
    });
    assert.equal(signed.status, 200);

    const overpaid = await api(dir, 'POST', `/api/v1/econ/acts/${created.body.id}/transition`, {
      to: 'paid',
      amount: 300_000,
    });
    assert.equal(overpaid.status, 422);
    assert.equal(overpaid.body.code, 'above_signed');
  });

  it('показывает непредъявленный остаток и допработы без оформления', async () => {
    const dir = await login(ACCOUNTS.dir);
    const acts = await api(dir, 'GET', `/api/v1/econ/acts?facilityId=${await akId()}`);

    const draft = (acts.body as any[]).find((a) => a.status === 'draft');
    assert.equal(draft.unsubmitted, draft.completed, 'ничего не предъявлено — весь объём висит');
    assert.ok(draft.extraWorkUnformalized > 0, 'допработы без оформления видны отдельно');
  });

  it('дубль номера акта отклоняется', async () => {
    const dir = await login(ACCOUNTS.dir);
    const res = await api(dir, 'POST', '/api/v1/econ/acts', {
      facilityId: await akId(),
      number: 'КС-2 №7',
      periodStart: '2026-07-01',
      periodEnd: '2026-07-31',
      amountCompleted: 1,
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'act_exists');
  });
});

describe('Доступ к экономике', () => {
  before(resetDatabase);
  after(closeAll);

  it('закрыта от площадки и снабжения', async () => {
    const id = await akId();
    for (const account of [ACCOUNTS.prorab, ACCOUNTS.master, ACCOUNTS.snab, ACCOUNTS.pto] as const) {
      const token = await login(account);
      const res = await api(token, 'GET', `/api/v1/econ/summary?facilityId=${id}`);
      assert.equal(res.status, 403, `${account} не должен видеть экономику объекта`);
    }

    for (const account of [ACCOUNTS.dir, ACCOUNTS.gi] as const) {
      const token = await login(account);
      assert.equal((await api(token, 'GET', `/api/v1/econ/summary?facilityId=${id}`)).status, 200);
    }
  });

  it('ВОР загружает ПТО, а не руководство', async () => {
    const id = await akId();
    const dir = await login(ACCOUNTS.dir);
    const pto = await login(ACCOUNTS.pto);
    const payload = {
      facilityId: id,
      source: 'смета, доп. 1',
      items: [{ code: 'КЖ-99', name: 'Дополнительная позиция', unit: 'м³', qty: 10, rate: 5_000 }],
    };

    assert.equal((await api(dir, 'POST', '/api/v1/econ/boq', payload)).status, 403);
    const loaded = await api(pto, 'POST', '/api/v1/econ/boq', payload);
    assert.equal(loaded.status, 200);
    assert.equal(loaded.body.created, 1);
  });
});
