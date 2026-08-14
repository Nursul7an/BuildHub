/**
 * Ограничение частоты. ТЗ §3.1 и §11.
 *
 * Проверяем и то, что лимит держит перебор, и то, что он не мешает
 * честной работе: пик сдачи отчётов 19:00–20:30 обязан проходить целиком.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { FastifyInstance } from 'fastify';
import { ACCOUNTS, api, buildLimitedApp, closeAll, DEMO_PASSWORD, login, resetDatabase } from './helpers.js';
import { prisma } from '../src/db.js';
import {
  LOGIN_MAX_PER_ACCOUNT,
  LOGIN_MAX_PER_IP,
  USER_LIMIT_PER_MINUTE,
  checkLoginThrottle,
  clearLoginAttempts,
  pruneLoginAttempts,
  recordFailedLogin,
} from '../src/ratelimit.js';

describe('Придерживание перебора паролей', () => {
  beforeEach(async () => {
    await resetDatabase();
    await prisma.loginAttempt.deleteMany();
  });
  after(closeAll);

  it('после серии неудач с одного адреса вход придерживается', async () => {
    const ip = '10.0.0.7';
    for (let i = 0; i < LOGIN_MAX_PER_IP; i += 1) {
      await recordFailedLogin(`подбор${i}`, ip);
    }

    const throttle = await checkLoginThrottle('a.zhumabekov', ip);
    assert.equal(throttle.blocked, true);
    assert.equal(throttle.reason, 'ip');
    assert.ok(throttle.retryAfterSeconds > 0, 'клиенту сообщается, когда повторить');
  });

  it('перебор одного логина придерживается мягче', async () => {
    const login = 'a.zhumabekov';
    for (let i = 0; i < LOGIN_MAX_PER_ACCOUNT; i += 1) {
      // Разные адреса: атака распределённая, но логин один.
      await recordFailedLogin(login, `10.0.1.${i}`);
    }

    const throttle = await checkLoginThrottle(login, '10.0.9.9');
    assert.equal(throttle.blocked, true);
    assert.equal(throttle.reason, 'account');
  });

  it('учётная запись не блокируется навсегда — иначе прораба выключат перед сдачей', async () => {
    const value = 'a.zhumabekov';
    for (let i = 0; i < LOGIN_MAX_PER_ACCOUNT + 5; i += 1) {
      await recordFailedLogin(value, `10.0.2.${i}`);
    }

    // Придержали, но это окно, а не блокировка: записи стареют.
    const blocked = await checkLoginThrottle(value, '10.0.3.1');
    assert.equal(blocked.blocked, true);

    // Через окно попытки перестают учитываться.
    const later = new Date(Date.now() + 16 * 60_000);
    const after = await checkLoginThrottle(value, '10.0.3.1', later);
    assert.equal(after.blocked, false, 'окно проходит, человек снова может войти');

    // Сама учётка при этом активна.
    const user = await prisma.user.findFirstOrThrow({ where: { login: value } });
    assert.equal(user.active, true);
  });

  it('удачный вход снимает счётчик', async () => {
    const value = 'a.zhumabekov';
    const ip = '10.0.4.4';
    for (let i = 0; i < 5; i += 1) await recordFailedLogin(value, ip);

    assert.equal((await checkLoginThrottle(value, ip)).attempts, 5);
    await clearLoginAttempts(value, ip);
    assert.equal((await checkLoginThrottle(value, ip)).attempts, 0);
  });

  it('через API: неверный пароль копит попытки, верный — обнуляет', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await api(null, 'POST', '/api/auth/login', {
        login: ACCOUNTS.prorab,
        password: 'неверный',
      });
      assert.equal(res.status, 401);
    }
    assert.equal(await prisma.loginAttempt.count(), 3);

    const ok = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
    });
    assert.equal(ok.status, 200);
    assert.equal(await prisma.loginAttempt.count(), 0, 'человек вспомнил пароль — инцидента нет');
  });

  it('несуществующий логин и неверный пароль отвечают одинаково', async () => {
    const wrongPassword = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: 'неверный',
    });
    const noSuchUser = await api(null, 'POST', '/api/auth/login', {
      login: 'нет.такого.человека',
      password: 'неверный',
    });

    // Иначе перебором собирают список действующих учёток.
    assert.equal(wrongPassword.status, noSuchUser.status);
    assert.equal(wrongPassword.body.code, noSuchUser.body.code);
    assert.equal(wrongPassword.body.message, noSuchUser.body.message);
  });

  it('придержанный вход отвечает 429 и говорит, когда повторить', async () => {
    for (let i = 0; i < LOGIN_MAX_PER_ACCOUNT; i += 1) {
      await recordFailedLogin(ACCOUNTS.prorab, '127.0.0.1');
    }

    const res = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
    });
    assert.equal(res.status, 429);
    assert.equal(res.body.code, 'login_throttled');
    assert.ok(res.body.details.retryAfterSeconds > 0);
    // Подсказка про сброс пароля — чтобы человек знал, что делать дальше.
    assert.match(res.body.message, /ПТО|позже/);
  });

  it('старые попытки убираются', async () => {
    await prisma.loginAttempt.create({
      data: { loginValue: 'старое', ip: '10.0.0.1', at: new Date(Date.now() - 30 * 3_600_000) },
    });
    await recordFailedLogin('свежее', '10.0.0.2');

    const removed = await pruneLoginAttempts();
    assert.equal(removed, 1);
    assert.equal(await prisma.loginAttempt.count(), 1, 'свежая запись остаётся');
  });
});

describe('Общий лимит запросов', () => {
  let limited: FastifyInstance;

  beforeEach(async () => {
    await resetDatabase();
    limited = await buildLimitedApp();
  });
  after(async () => {
    await limited?.close();
    await closeAll();
  });

  it('пропускает вечерний пик сдачи отчётов', async () => {
    // §11: пик 19:00–20:30, до 40 запросов в секунду на всю систему.
    // Лимит на человека обязан быть заметно выше его личного темпа.
    assert.ok(
      USER_LIMIT_PER_MINUTE >= 120,
      'лимит, срабатывающий на честной сдаче отчёта, хуже, чем его отсутствие',
    );

    const token = await login(ACCOUNTS.prorab);
    // Полсотни запросов подряд — больше, чем даёт живая работа с экраном.
    for (let i = 0; i < 50; i += 1) {
      const res = await limited.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      assert.equal(res.statusCode, 200, `запрос ${i + 1} не должен упираться в лимит`);
    }
  });

  it('считает по пользователю, а не по адресу', async () => {
    // На объекте несколько человек сидят за одним Wi-Fi: общий счётчик
    // по IP наказал бы всю бригаду за активность одного.
    const prorab = await login(ACCOUNTS.prorab);
    const master = await login(ACCOUNTS.master);

    const first = await limited.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${prorab}` },
    });
    const second = await limited.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { authorization: `Bearer ${master}` },
    });

    assert.equal(first.statusCode, 200);
    assert.equal(second.statusCode, 200);
    // У разных пользователей счётчики свои — заголовки это показывают.
    assert.equal(first.headers['x-ratelimit-remaining'], second.headers['x-ratelimit-remaining']);
  });

  it('превышение отвечает единым форматом ошибки', async () => {
    const token = await login(ACCOUNTS.snab);
    let limitedResponse: Awaited<ReturnType<typeof limited.inject>> | null = null;

    for (let i = 0; i < USER_LIMIT_PER_MINUTE + 5; i += 1) {
      const res = await limited.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      if (res.statusCode === 429) {
        limitedResponse = res;
        break;
      }
    }

    assert.ok(limitedResponse, 'лимит обязан срабатывать при явном переборе');
    const body = limitedResponse!.json();
    assert.equal(body.code, 'rate_limited', 'формат ошибки — тот же, что во всём API (§6)');
    assert.ok(body.details.retryAfterSeconds > 0);
  });

  it('отдача файлов и проверка живости лимитом не режутся', async () => {
    // Фото качаются отдельным потоком с докачкой (§8), а health опрашивает
    // балансировщик — обоим общий лимит только мешает.
    const health = await limited.inject({ method: 'GET', url: '/api/health' });
    assert.equal(health.statusCode, 200);
    assert.equal(health.headers['x-ratelimit-limit'], undefined);
  });
});
