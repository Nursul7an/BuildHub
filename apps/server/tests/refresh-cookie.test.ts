/**
 * Refresh-токен в httpOnly cookie.
 *
 * Смысл не в том, что заголовок Set-Cookie присутствует, а в том, что
 * страница не может прочитать токен: при XSS из localStorage его уносят,
 * из httpOnly cookie — нет.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, DEMO_PASSWORD, closeAll, getApp, resetDatabase } from './helpers.js';
import { REFRESH_COOKIE } from '../src/config.js';

/** Вход из браузера: тела с токеном быть не должно, cookie — должна. */
async function loginWeb(login = ACCOUNTS.prorab, password = DEMO_PASSWORD) {
  const app = await getApp();
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { login, password },
  });
  return res;
}

function cookieOf(res: { cookies: Array<Record<string, unknown>> }) {
  return res.cookies.find((c) => c.name === REFRESH_COOKIE);
}

describe('Refresh в httpOnly cookie', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('вход из браузера не возвращает refresh в теле', async () => {
    const res = await loginWeb();
    assert.equal(res.statusCode, 200);

    const body = res.json();
    assert.ok(body.token, 'access выдаётся как прежде');
    assert.equal(body.refreshToken, undefined, 'того, чего нет в теле, не положить в localStorage');
    assert.ok(body.refreshExpiresAt, 'срок клиенту нужен — по нему он решает, когда обновляться');
  });

  it('cookie закрыта от скриптов и сужена по пути', async () => {
    const cookie = cookieOf(await loginWeb() as never);

    assert.ok(cookie, 'refresh обязан приехать cookie');
    assert.equal(cookie!.httpOnly, true, 'иначе XSS уносит токен так же, как из localStorage');
    // Cookie не должна ездить с каждым запросом за отчётами и фотографиями:
    // меньше мест, где токен можно случайно записать в журнал.
    assert.equal(cookie!.path, '/api/auth');
    assert.equal(cookie!.sameSite, 'Lax');
  });

  it('обновление идёт по cookie, без токена в теле', async () => {
    const app = await getApp();
    const first = await loginWeb();
    const jar = first.cookies.find((c) => c.name === REFRESH_COOKIE)!;

    const refreshed = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: jar.value as string },
      payload: {},
    });

    assert.equal(refreshed.statusCode, 200);
    assert.ok(refreshed.json().token, 'новый access выдан');
    assert.equal(refreshed.json().refreshToken, undefined, 'токен остаётся в cookie');

    // Ротация продолжает работать: cookie обязана смениться.
    const next = refreshed.cookies.find((c) => c.name === REFRESH_COOKIE);
    assert.ok(next, 'новая cookie обязана прийти');
    assert.notEqual(next!.value, jar.value, 'refresh одноразовый');
  });

  it('повторное предъявление cookie гасит сессию и стирает саму cookie', async () => {
    const app = await getApp();
    const first = await loginWeb();
    const stolen = first.cookies.find((c) => c.name === REFRESH_COOKIE)!.value as string;

    await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: stolen },
      payload: {},
    });

    const reused = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: stolen },
      payload: {},
    });

    assert.equal(reused.statusCode, 401);
    assert.equal(reused.json().code, 'reused');

    // Негодную cookie убираем, иначе браузер шлёт её снова и снова,
    // и вход выглядит зациклившимся.
    const cleared = reused.cookies.find((c) => c.name === REFRESH_COOKIE);
    assert.ok(cleared, 'сервер обязан погасить cookie');
    assert.equal(cleared!.value, '');
  });

  it('выход стирает cookie', async () => {
    const app = await getApp();
    const session = await loginWeb();

    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      headers: { authorization: `Bearer ${session.json().token}` },
    });

    assert.equal(out.statusCode, 200);
    const cleared = out.cookies.find((c) => c.name === REFRESH_COOKIE);
    assert.ok(cleared);
    assert.equal(cleared!.value, '');
  });

  it('мобильный клиент по-прежнему получает токен в теле и не получает cookie', async () => {
    // В приложении нет чужого JavaScript, зато есть хранилище ключей,
    // а cookie между запусками переживают не все клиенты.
    const app = await getApp();
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: ACCOUNTS.prorab, password: DEMO_PASSWORD, client: 'mobile' },
    });

    assert.ok(res.json().refreshToken, 'мобильному токен нужен в теле');
    assert.equal(res.cookies.find((c) => c.name === REFRESH_COOKIE), undefined);
  });

  it('cookie важнее тела: браузеру нельзя вынести токен, назвавшись мобильным', async () => {
    const app = await getApp();
    const web = await loginWeb();
    const jar = web.cookies.find((c) => c.name === REFRESH_COOKIE)!;

    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { [REFRESH_COOKIE]: jar.value as string },
      // Клиент утверждает, что он мобильный, — и если ему поверить,
      // токен уедет в тело ответа и выйдет из-под httpOnly.
      payload: { client: 'mobile' },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().refreshToken, undefined, 'слово клиента не отменяет httpOnly');
  });

  it('смена пароля обновляет cookie, а не выдаёт токен в тело', async () => {
    const app = await getApp();
    // Учётная запись с временным паролем: смена обязательна.
    const pto = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { login: ACCOUNTS.pto, password: DEMO_PASSWORD },
    });
    const token = pto.json().token;

    const changed = await app.inject({
      method: 'POST',
      url: '/api/auth/password',
      headers: { authorization: `Bearer ${token}` },
      cookies: { [REFRESH_COOKIE]: pto.cookies.find((c) => c.name === REFRESH_COOKIE)!.value as string },
      payload: { newPassword: 'novyparol1', repeatPassword: 'novyparol1' },
    });

    assert.equal(changed.statusCode, 200);
    assert.equal(changed.json().refreshToken, undefined);
    assert.ok(changed.cookies.find((c) => c.name === REFRESH_COOKIE), 'новая cookie обязана прийти');
  });

  it('без cookie и без токена — отказ, а не пятисотая', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'POST', url: '/api/auth/refresh', payload: {} });
    assert.equal(res.statusCode, 401);
  });
});

describe('Проверка, что cookie доходит', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('cookie вернулась — продление заработает', async () => {
    const app = await getApp();
    const session = await loginWeb();
    const jar = session.cookies.find((c) => c.name === REFRESH_COOKIE)!;

    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/cookie-check',
      cookies: { [REFRESH_COOKIE]: jar.value as string },
    });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().cookiePresent, true);
  });

  it('cookie не пришла — это видно сразу, а не через 15 минут', async () => {
    // Так выглядит браузер, который выбросил cookie: вход прошёл,
    // а на следующем запросе её нет. Без этой проверки отказ всплывает
    // только когда истечёт access — посреди сдачи отчёта.
    const app = await getApp();
    await loginWeb();

    const res = await app.inject({ method: 'GET', url: '/api/auth/cookie-check' });

    assert.equal(res.statusCode, 200);
    assert.equal(res.json().cookiePresent, false);
    assert.equal(res.json().sameSite, 'lax', 'клиенту видно, какое правило действует');
  });

  it('проверка не требует входа: её зовут до того, как станет ясно, что сессии нет', async () => {
    const app = await getApp();
    const res = await app.inject({ method: 'GET', url: '/api/auth/cookie-check' });
    assert.equal(res.statusCode, 200);
  });
});
