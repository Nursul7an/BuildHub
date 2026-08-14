/**
 * Проект и версии листов. Критерий приёмки 7:
 * «Загрузка новой версии листа делает прежнюю недействительной
 * и уведомляет всех, кто её открывал».
 *
 * И главное следствие спринта 11: работа по устаревшему листу
 * невозможна незаметно.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, drain, login, resetDatabase, uploadPhoto } from './helpers.js';

async function findSheet(token: string, number: string) {
  const active = await api(token, 'GET', '/api/v1/sheets/active');
  return (active.body as any[]).find((s) => s.number === number);
}

describe('Реестр действующих листов', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('отдаёт только текущие версии — это замена бумажного реестра', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const active = await api(prorab, 'GET', '/api/v1/sheets/active');

    assert.equal(active.status, 200);
    const kj12 = (active.body as any[]).find((s) => s.number === 'КЖ-12');
    assert.ok(kj12, 'лист обязан быть в реестре');
    assert.equal(kj12.revision, 'изм. 4', 'в реестре действует последняя версия');

    // Заменённой ревизии в реестре нет.
    assert.ok(!(active.body as any[]).some((s) => s.revision === 'изм. 3'));
  });

  it('комплекты показывают, сколько листов пережили замену', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const sets = await api(prorab, 'GET', '/api/v1/doc-sets');
    const kj = (sets.body as any[]).find((s) => s.mark === 'КЖ');
    assert.equal(kj.revisedCount, 1, 'у КЖ один лист с историей изменений');
  });
});

describe('Открытие листа', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('фиксирует просмотр — иначе о замене некого извещать', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const pto = await login(ACCOUNTS.pto);
    const sheet = await findSheet(prorab, 'КЖ-12');

    await api(prorab, 'GET', `/api/v1/sheets/${sheet.id}`);

    const viewers = await api(pto, 'GET', `/api/v1/sheets/${sheet.id}/viewers`);
    assert.equal(viewers.status, 200);
    const viewer = (viewers.body as any[]).find((v) => v.role === 'prorab');
    assert.ok(viewer, 'просмотр обязан фиксироваться');
    assert.equal(viewer.revision, 'изм. 4');
  });

  it('открытая старая версия отвечает явным предупреждением', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const sheet = await findSheet(prorab, 'КЖ-12');

    const versions = await api(prorab, 'GET', `/api/v1/sheets/${sheet.id}/versions`);
    const old = (versions.body as any[]).find((v) => v.revision === 'изм. 3');
    assert.equal(old.superseded, true);

    const opened = await api(prorab, 'GET', `/api/v1/sheets/${sheet.id}?versionId=${old.id}`);
    assert.equal(opened.status, 200);
    assert.equal(opened.body.outdated, true, 'устаревший лист — это состояние, а не примечание');
    assert.match(opened.body.warning, /недействительна/);
    assert.equal(opened.body.currentVersion.revision, 'изм. 4', 'сразу сказано, что действует');
  });

  it('несёт метку времени для офлайн-кеша', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const sheet = await findSheet(prorab, 'КЖ-12');
    const opened = await api(prorab, 'GET', `/api/v1/sheets/${sheet.id}`);
    // ТЗ §8: при офлайн-открытии клиент показывает «версия на дату».
    assert.ok(opened.body.asOf, 'ответ обязан нести дату актуальности');
    assert.equal(opened.body.outdated, false);
  });
});

describe('Выпуск новой версии', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('делает прежнюю недействительной и извещает тех, кто её открывал', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const master = await login(ACCOUNTS.master);
    const pto = await login(ACCOUNTS.pto);
    const snab = await login(ACCOUNTS.snab);

    const sheet = await findSheet(prorab, 'КЖ-14');

    // Двое открывали лист, третий — нет.
    await api(prorab, 'GET', `/api/v1/sheets/${sheet.id}`);
    await api(master, 'GET', `/api/v1/sheets/${sheet.id}`);

    const released = await api(pto, 'POST', `/api/v1/sheets/${sheet.id}/versions`, {
      revision: 'изм. 3',
      changeSummary: 'Изменена раскладка верхней сетки в осях 4–6',
    });
    assert.equal(released.status, 201);
    assert.equal(released.body.supersededRevision, 'изм. 2');
    assert.ok(released.body.notifiedViewers >= 2);

    // Прежняя версия недействительна.
    const versions = await api(prorab, 'GET', `/api/v1/sheets/${sheet.id}/versions`);
    const previous = (versions.body as any[]).find((v) => v.revision === 'изм. 2');
    assert.equal(previous.superseded, true);
    assert.ok(previous.supersededAt);

    // В реестре действует новая.
    const nowActive = await findSheet(prorab, 'КЖ-14');
    assert.equal(nowActive.revision, 'изм. 3');

    await drain();

    // Извещены именно те, кто открывал.
    for (const [who, token] of [
      ['прораб', prorab],
      ['мастер', master],
    ] as const) {
      const inbox = await api(token, 'GET', '/api/notifications?unread=1');
      assert.ok(
        (inbox.body as any[]).some((n) => n.title.includes('КЖ-14')),
        `${who} открывал лист и обязан получить извещение`,
      );
    }

    // Снабжение лист не открывало — его не трогаем.
    const snabInbox = await api(snab, 'GET', '/api/notifications?unread=1');
    assert.ok(
      !(snabInbox.body as any[]).some((n) => n.title.includes('КЖ-14')),
      'извещение уходит открывавшим, а не всем подряд',
    );
  });

  it('требует описания изменения', async () => {
    const pto = await login(ACCOUNTS.pto);
    const sheet = await findSheet(pto, 'КЖ-14');

    const res = await api(pto, 'POST', `/api/v1/sheets/${sheet.id}/versions`, {
      revision: 'изм. 9',
      changeSummary: '',
    });
    assert.equal(res.status, 400, 'без описания прораб не поймёт, что поменялось');
  });

  it('не принимает повтор уже загруженной ревизии', async () => {
    const pto = await login(ACCOUNTS.pto);
    const sheet = await findSheet(pto, 'КЖ-12');

    const res = await api(pto, 'POST', `/api/v1/sheets/${sheet.id}/versions`, {
      revision: 'изм. 4',
      changeSummary: 'повторная загрузка',
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'revision_exists');
  });

  it('версии выпускает ПТО, а не площадка', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const sheet = await findSheet(prorab, 'КЖ-14');

    const res = await api(prorab, 'POST', `/api/v1/sheets/${sheet.id}/versions`, {
      revision: 'изм. 5',
      changeSummary: 'самовольная замена',
    });
    assert.equal(res.status, 403);
  });

  it('замена попадает в журнал аудита с обоснованием', async () => {
    const pto = await login(ACCOUNTS.pto);
    const sheet = await findSheet(pto, 'КЖ-14');

    await api(pto, 'POST', `/api/v1/sheets/${sheet.id}/versions`, {
      revision: 'изм. 3',
      changeSummary: 'Уточнены отметки в осях 2–3',
    });

    const log = await api(pto, 'GET', `/api/v1/audit?entity=drawingSheet&entityId=${sheet.id}`);
    const record = (log.body as any[]).find((r) => r.field === 'revision');
    assert.ok(record);
    assert.equal(record.oldValue, 'изм. 2');
    assert.equal(record.newValue, 'изм. 3');
    assert.match(record.reason, /отметки/);
  });

  it('файл версии отдаётся подписанной ссылкой и знает о своей устарелости', async () => {
    const pto = await login(ACCOUNTS.pto);
    const sheet = await findSheet(pto, 'КЖ-14');
    const file = await uploadPhoto(pto, { filename: 'kj-14.pdf', mime: 'application/pdf', purpose: 'sheet' });

    await api(pto, 'POST', `/api/v1/sheets/${sheet.id}/versions`, {
      revision: 'изм. 3',
      changeSummary: 'С файлом',
      fileId: file.fileId,
    });

    const link = await api(pto, 'GET', `/api/v1/sheets/${sheet.id}/file`);
    assert.equal(link.status, 200);
    assert.ok(link.body.url.includes('sig='), 'файл отдаётся только по подписанной ссылке');
    assert.equal(link.body.outdated, false);
    assert.equal(link.body.revision, 'изм. 3');
  });

  it('незагруженный файл версией не становится', async () => {
    const pto = await login(ACCOUNTS.pto);
    const sheet = await findSheet(pto, 'КЖ-14');
    const presigned = await api(pto, 'POST', '/api/v1/files/presign', {
      filename: 'draft.pdf',
      mime: 'application/pdf',
      purpose: 'sheet',
    });

    const res = await api(pto, 'POST', `/api/v1/sheets/${sheet.id}/versions`, {
      revision: 'изм. 7',
      changeSummary: 'Файл ещё не догрузился',
      fileId: presigned.body.fileId,
    });
    assert.equal(res.status, 409);
  });
});
