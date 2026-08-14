import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, DEMO_PASSWORD, login, resetDatabase } from './helpers.js';

describe('Вход и пароли', () => {
  before(resetDatabase);
  after(closeAll);

  it('отклоняет неверный пароль', async () => {
    const res = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: 'wrong',
    });
    assert.equal(res.status, 401);
  });

  it('не пускает без токена', async () => {
    const res = await api(null, 'GET', '/api/today');
    assert.equal(res.status, 401);
  });

  it('пускает по логину и по телефону — на объекте помнят телефон', async () => {
    const byLogin = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
    });
    assert.equal(byLogin.status, 200);

    const byPhone = await api(null, 'POST', '/api/auth/login', {
      login: '+996 555 100 101',
      password: DEMO_PASSWORD,
    });
    assert.equal(byPhone.status, 200);
    assert.equal(byPhone.body.user.id, byLogin.body.user.id);
  });

  it('держит нового пользователя на экране смены пароля, пока он временный', async () => {
    const pto = await login(ACCOUNTS.pto);
    const created = await api(pto, 'POST', '/api/users', {
      fullName: 'Тест Тестов',
      phone: '+996 555 000 001',
      role: 'master',
    });
    assert.equal(created.status, 201);

    const temporary = created.body.temporaryPassword as string;
    assert.ok(temporary, 'временный пароль должен выдаваться при создании');

    const session = await api(null, 'POST', '/api/auth/login', {
      login: created.body.user.login,
      password: temporary,
    });
    assert.equal(session.status, 200);
    assert.equal(session.body.mustChangePassword, true);

    // До смены пароля любой другой экран закрыт.
    const blocked = await api(session.body.token, 'GET', '/api/today');
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.code, 'password_change_required');

    const tooShort = await api(session.body.token, 'POST', '/api/auth/password', {
      newPassword: 'korotko',
      repeatPassword: 'korotko',
    });
    assert.equal(tooShort.status, 400);

    const mismatch = await api(session.body.token, 'POST', '/api/auth/password', {
      newPassword: 'novyparol123',
      repeatPassword: 'drugoiparol123',
    });
    assert.equal(mismatch.status, 400);

    const changed = await api(session.body.token, 'POST', '/api/auth/password', {
      newPassword: 'novyparol123',
      repeatPassword: 'novyparol123',
    });
    assert.equal(changed.status, 200);

    // Прежний пароль обязан перестать работать.
    const oldPassword = await api(null, 'POST', '/api/auth/login', {
      login: created.body.user.login,
      password: temporary,
    });
    assert.equal(oldPassword.status, 401);

    const newPassword = await api(null, 'POST', '/api/auth/login', {
      login: created.body.user.login,
      password: 'novyparol123',
    });
    assert.equal(newPassword.status, 200);
    assert.equal(newPassword.body.mustChangePassword, false);
  });

  it('закрывает доступ отключённой учётке', async () => {
    const pto = await login(ACCOUNTS.pto);
    const created = await api(pto, 'POST', '/api/users', {
      fullName: 'Уволенный Сотрудник',
      phone: '+996 555 000 002',
      role: 'prorab',
    });
    const temporary = created.body.temporaryPassword as string;
    const session = await api(null, 'POST', '/api/auth/login', {
      login: created.body.user.login,
      password: temporary,
    });
    assert.equal(session.status, 200);

    await api(pto, 'PATCH', `/api/users/${created.body.user.id}`, { active: false });

    const afterDisable = await api(session.body.token, 'GET', '/api/auth/me');
    assert.equal(afterDisable.status, 401);
  });
});
