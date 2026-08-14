/**
 * Дымовой прогон по ключевым правилам предметной области.
 * Не заменяет тесты — показывает, что шлюзы действительно держат.
 */
const BASE = process.env.BASE ?? 'http://localhost:4000';
const PASSWORD = 'buildhub2026';

let pass = 0;
let fail = 0;

function check(name, ok, detail = '') {
  if (ok) {
    pass += 1;
    console.log(`  ✓ ${name}`);
  } else {
    fail += 1;
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

async function api(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* пустой ответ */
  }
  return { status: res.status, body: json };
}

async function login(loginName) {
  const res = await api(null, 'POST', '/api/auth/login', { login: loginName, password: PASSWORD });
  if (res.status !== 200) throw new Error(`Вход ${loginName} не удался: ${JSON.stringify(res.body)}`);
  return res.token ?? res.body.token;
}

const photo = () => [{ url: 'photo://test.jpg', takenAt: new Date().toISOString(), lat: 42.87, lon: 74.6 }];

const run = async () => {
  console.log('\nАутентификация');
  const bad = await api(null, 'POST', '/api/auth/login', { login: 'a.zhumabekov', password: 'wrong' });
  check('неверный пароль отклонён', bad.status === 401);
  const noAuth = await api(null, 'GET', '/api/today');
  check('без токена доступа нет', noAuth.status === 401);

  const prorab = await login('a.zhumabekov');
  const pto = await login('g.sadykova');
  const dir = await login('n.toktomatov');
  const gi = await login('n.tashiev');
  const snab = await login('e.bakirov');
  check('вход по логину работает', Boolean(prorab && pto && dir));

  const byPhone = await api(null, 'POST', '/api/auth/login', {
    login: '+996 555 100 101',
    password: PASSWORD,
  });
  check('вход по телефону работает', byPhone.status === 200);

  console.log('\nПрава ролей');
  const prorabTriesCheck = await api(prorab, 'GET', '/api/reports/queue');
  check('прораб не видит очередь проверки ПТО', prorabTriesCheck.status === 403, `получено ${prorabTriesCheck.status}`);
  const prorabTriesLimits = await api(prorab, 'PUT', '/api/boss/limits', {
    role: 'gi',
    scope: 'payment',
    limit: 999,
  });
  check('прораб не меняет лимиты автономности', prorabTriesLimits.status === 403, `получено ${prorabTriesLimits.status}`);
  const giStops = await api(gi, 'POST', '/api/boss/stop-work', { objectId: 'x', reason: 'тест' });
  check('остановка работ доступна только ГИ (не 403)', giStops.status !== 403, `получено ${giStops.status}`);
  const dirStops = await api(dir, 'POST', '/api/boss/stop-work', { objectId: 'x', reason: 'тест' });
  check('директор не останавливает работы', dirStops.status === 403, `получено ${dirStops.status}`);

  console.log('\nЭкран «Сегодня»');
  const today = await api(prorab, 'GET', '/api/today');
  check('сводка отдаётся', today.status === 200, JSON.stringify(today.body).slice(0, 120));
  const processes = today.body?.processes ?? [];
  check('活 работы прораба есть', processes.length > 0, `получено ${processes.length}`);
  check('возвращённый отчёт виден', Boolean(today.body?.returnedReport));

  const active = processes.find((p) => p.status === 'active');
  const blocked = processes.find((p) => p.status === 'blocked');
  check('есть заблокированный процесс с причиной', Boolean(blocked?.blockedReason), blocked?.blockedReason ?? 'нет');

  console.log('\nПравила дневного отчёта');
  const date = new Date().toISOString();
  const noPhoto = await api(prorab, 'POST', '/api/report/entry', {
    date,
    entry: { processStateId: active.id, volume: 1, unit: active.unit, workers: 5, photos: [] },
  });
  check('запись без фото отклонена', noPhoto.status === 422, `получено ${noPhoto.status}`);

  const noVolume = await api(prorab, 'POST', '/api/report/entry', {
    date,
    entry: { processStateId: active.id, volume: 0, unit: active.unit, workers: 5, photos: photo() },
  });
  check('запись без объёма отклонена', noVolume.status === 422, `получено ${noVolume.status}`);

  const cold = await api(prorab, 'POST', '/api/report/entry', {
    date,
    entry: {
      processStateId: active.id,
      volume: 1,
      unit: active.unit,
      workers: 5,
      photos: photo(),
      tempAir: -3,
    },
  });
  check('мороз без зимнего метода отклонён', cold.status === 422, `получено ${cold.status}`);

  const coldOk = await api(prorab, 'POST', '/api/report/entry', {
    date,
    entry: {
      processStateId: active.id,
      volume: 1,
      unit: active.unit,
      workers: 5,
      photos: photo(),
      tempAir: -3,
      winterMethod: 'противоморозные добавки',
    },
  });
  check('мороз с указанным методом принят', coldOk.status === 200, `получено ${coldOk.status}`);

  const intoBlocked = blocked
    ? await api(prorab, 'POST', '/api/report/entry', {
        date,
        entry: { processStateId: blocked.id, volume: 1, unit: blocked.unit, workers: 5, photos: photo() },
      })
    : { status: 409 };
  check('в заблокированный процесс писать нельзя', intoBlocked.status === 409, `получено ${intoBlocked.status}`);

  console.log('\nДвойной учёт при повторной отправке');
  const before = await api(prorab, 'GET', `/api/process/${active.id}`);
  const reportId = coldOk.body?.reportId;
  const submit1 = await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 200 });
  const afterFirst = await api(prorab, 'GET', `/api/process/${active.id}`);
  const submit2 = await api(prorab, 'POST', `/api/report/${reportId}/submit`, { fillSeconds: 200 });
  const afterSecond = await api(prorab, 'GET', `/api/process/${active.id}`);
  check('первая отправка принята', submit1.status === 200, `получено ${submit1.status}`);
  check(
    'повторная отправка не удваивает факт',
    afterFirst.body.doneQty === afterSecond.body.doneQty,
    `было ${before.body.doneQty} → ${afterFirst.body.doneQty} → ${afterSecond.body.doneQty}`,
  );

  console.log('\nПредъявление к освидетельствованию');
  const notDone = await api(prorab, 'POST', `/api/process/${active.id}/present`, {
    checklist: [],
    date: new Date(Date.now() + 10 * 86400000).toISOString(),
    notify: ['ПТО'],
  });
  check('предъявление до 100% отклонено', notDone.status === 409, `получено ${notDone.status}`);

  console.log('\nЗаявки');
  const objects = await api(prorab, 'GET', '/api/objects');
  const objectId = objects.body?.[0]?.id;
  const tooSoon = await api(prorab, 'POST', '/api/zayavki', {
    kind: 'tech',
    objectId,
    priority: 'norm',
    items: [{ rawText: 'кран', qty: 1, unit: 'сут' }],
    tech: {
      machineType: 'Кран',
      hours: 8,
      date: new Date().toISOString(),
      timeFrom: '08:00',
      frontChecklist: [{ key: 'access', label: 'Подъезд свободен', checked: false }],
    },
  });
  check('заявка на технику без готового фронта отклонена', tooSoon.status === 422, `получено ${tooSoon.status}`);

  const created = await api(prorab, 'POST', '/api/zayavki', {
    kind: 'material',
    objectId,
    priority: 'urgent',
    items: [{ rawText: 'арматура 12ка', qty: 4.2, unit: 'т' }],
    idleWorkers: 24,
    idleSince: new Date(Date.now() - 3600000).toISOString(),
  });
  check('заявка создана с номером', Boolean(created.body?.number), JSON.stringify(created.body).slice(0, 100));
  check('цена простоя посчитана', created.status === 200);

  const zList = await api(snab, 'GET', '/api/zayavki?scope=department');
  check('снабжение видит заявки отдела', zList.status === 200 && (zList.body?.length ?? 0) > 0, `получено ${zList.body?.length}`);

  const fresh = zList.body?.find((z) => z.number === created.body?.number);
  const unmatched = fresh?.items?.[0];
  check('сырая формулировка сохранена', unmatched?.rawText === 'арматура 12ка');

  const catalog = await api(snab, 'GET', '/api/catalog?q=арматура 12ка');
  check('поиск по формулировке находит позицию', (catalog.body?.length ?? 0) > 0, `найдено ${catalog.body?.length}`);

  if (fresh && catalog.body?.[0]) {
    const norm = await api(snab, 'POST', `/api/zayavki/${fresh.id}/normalize`, {
      itemId: unmatched.id,
      catalogItemId: catalog.body[0].id,
      rememberAlias: true,
    });
    check('нормализация позиции проходит', norm.status === 200, `получено ${norm.status}`);
  }

  console.log('\nПриёмка материала');
  const all = await api(prorab, 'GET', '/api/zayavki?scope=mine');
  const notDelivered = all.body?.find((z) => z.status === 'new' || z.status === 'approved');
  if (notDelivered) {
    const early = await api(prorab, 'POST', `/api/zayavki/${notDelivered.id}/accept`, {
      qtyAccepted: 1,
      passportOk: true,
      photos: photo(),
    });
    check('приёмка не пришедшего груза отклонена', early.status === 409, `получено ${early.status}`);
  }

  console.log('\nAI-помощник и фильтр по ролям');
  const sugProrab = await api(prorab, 'GET', '/api/assistant/suggestions');
  const sugDir = await api(dir, 'GET', '/api/assistant/suggestions');
  const prorabKeys = new Set((sugProrab.body ?? []).map((s) => s.key));
  const dirKeys = new Set((sugDir.body ?? []).map((s) => s.key));
  check('у прораба свои подсказки', prorabKeys.size > 0);
  check('прорабу не предлагают вопросы про деньги', !prorabKeys.has('money-loss'));
  check('директору предлагают вопросы про деньги', dirKeys.has('money-loss'));

  const forbidden = await api(prorab, 'POST', '/api/assistant/ask', { key: 'money-loss' });
  check(
    'прораб не получает ответ про деньги даже по ключу',
    forbidden.body?.answered === false,
    `answered=${forbidden.body?.answered}`,
  );

  const factual = await api(prorab, 'POST', '/api/assistant/ask', { key: 'stock-left' });
  check('фактический вопрос отвечен с источником', factual.body?.answered === true && Boolean(factual.body?.source));

  const nonsense = await api(prorab, 'POST', '/api/assistant/ask', { text: 'какая маржа объекта' });
  check('на непокрытый вопрос честное «не могу»', nonsense.body?.answered === false);

  console.log('\nСмена пароля');
  const created2 = await api(pto, 'POST', '/api/users', {
    fullName: 'Тест Тестов',
    phone: '+996 555 000 001',
    role: 'master',
  });
  check('ПТО заводит пользователя', created2.status === 201, `получено ${created2.status}`);
  const tempPwd = created2.body?.temporaryPassword;
  check('временный пароль выдан', Boolean(tempPwd));
  if (tempPwd) {
    const newLogin = await api(null, 'POST', '/api/auth/login', {
      login: created2.body.user.login,
      password: tempPwd,
    });
    check('вход по временному паролю', newLogin.status === 200);
    check('флаг смены пароля выставлен', newLogin.body?.mustChangePassword === true);
    const blockedUntilChange = await api(newLogin.body.token, 'GET', '/api/today');
    check(
      'до смены пароля доступ закрыт',
      blockedUntilChange.status === 403,
      `получено ${blockedUntilChange.status}`,
    );
    const changed = await api(newLogin.body.token, 'POST', '/api/auth/password', {
      newPassword: 'novyparol123',
      repeatPassword: 'novyparol123',
    });
    check('смена пароля проходит', changed.status === 200, `получено ${changed.status}`);
    const oldPwd = await api(null, 'POST', '/api/auth/login', {
      login: created2.body.user.login,
      password: tempPwd,
    });
    check('старый пароль перестал работать', oldPwd.status === 401, `получено ${oldPwd.status}`);
  }

  console.log(`\nИтог: ${pass} пройдено, ${fail} провалено\n`);
  process.exit(fail > 0 ? 1 : 0);
};

run().catch((e) => {
  console.error('Прогон упал:', e.message);
  process.exit(2);
});
