/**
 * Аутентификация по ТЗ §3.1 и §12: Argon2id, access 15 минут,
 * refresh 30 дней, сессии устройств, сброс и блокировка.
 */
import { after, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, api, closeAll, DEMO_PASSWORD, login, resetDatabase } from './helpers.js';
import { prisma } from '../src/db.js';
import { checkPasswordStrength, generatePassword, hashPassword, needsRehash, verifyPassword } from '../src/password.js';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_DAYS } from '../src/sessions.js';
import { maskPhone } from '../src/sms.js';

describe('Хеширование паролей', () => {
  it('использует argon2id', async () => {
    const hash = await hashPassword('пароль-проверка');
    assert.match(hash, /^\$argon2id\$/, 'ТЗ §12 требует именно argon2id');
    assert.equal(await verifyPassword(hash, 'пароль-проверка'), true);
    assert.equal(await verifyPassword(hash, 'другой'), false);
  });

  it('продолжает проверять старые bcrypt-хеши и помечает их к перехешированию', async () => {
    // Оставшиеся с прошлой версии хеши не должны выкидывать людей из системы.
    const bcryptHash = '$2b$10$N9qo8uLOickgx2ZMRZoMy.MH/rBiFRMEbSHc0oIMhcz5Kh9Vv0oNi';
    assert.equal(needsRehash(bcryptHash), true);
    assert.equal(needsRehash(await hashPassword('x12345678')), false);
  });

  it('не принимает слабый пароль', () => {
    assert.equal(checkPasswordStrength('korotko').ok, false);
    assert.equal(checkPasswordStrength('12345678').ok, false, 'только цифры — слишком просто');
    assert.equal(checkPasswordStrength('normalny1').ok, true);
  });

  it('временный пароль читается вслух: без похожих символов', () => {
    const password = generatePassword(40);
    assert.equal(password.length, 40);
    assert.ok(!/[lo01]/.test(password), 'l, o, 0 и 1 путаются при диктовке по телефону');
  });

  it('телефон в журналах маскируется', () => {
    assert.ok(!maskPhone('+996 555 100 101').includes('100 10'));
  });
});

describe('Access и refresh', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('вход выдаёт короткий access и длинный refresh', async () => {
    const res = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Redmi Note 12',
    });

    assert.equal(res.status, 200);
    assert.equal(res.body.expiresIn, ACCESS_TTL_SECONDS, 'access живёт 15 минут');
    assert.ok(res.body.refreshToken, 'refresh обязан выдаваться');

    const days = (new Date(res.body.refreshExpiresAt).getTime() - Date.now()) / 86_400_000;
    assert.ok(Math.abs(days - REFRESH_TTL_DAYS) < 1, 'refresh живёт 30 дней');
  });

  it('refresh обменивается на новую пару и становится одноразовым', async () => {
    const session = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
    });
    const first = session.body.refreshToken as string;

    const refreshed = await api(null, 'POST', '/api/auth/refresh', { refreshToken: first });
    assert.equal(refreshed.status, 200);
    assert.notEqual(refreshed.body.refreshToken, first, 'токен обязан меняться при обмене');

    // Новый access работает.
    const me = await api(refreshed.body.token, 'GET', '/api/auth/me');
    assert.equal(me.status, 200);

    // Старый refresh больше не годится.
    const reused = await api(null, 'POST', '/api/auth/refresh', { refreshToken: first });
    assert.equal(reused.status, 401);
    assert.equal(reused.body.code, 'reused');
  });

  it('повторное предъявление гасит всю цепочку устройства', async () => {
    const session = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
    });
    const first = session.body.refreshToken as string;

    const second = await api(null, 'POST', '/api/auth/refresh', { refreshToken: first });
    const third = await api(null, 'POST', '/api/auth/refresh', {
      refreshToken: second.body.refreshToken,
    });
    assert.equal(third.status, 200);

    // Кто-то предъявляет украденный первый токен.
    await api(null, 'POST', '/api/auth/refresh', { refreshToken: first });

    // Актуальный токен тоже погашен: цепочка скомпрометирована целиком.
    const afterTheft = await api(null, 'POST', '/api/auth/refresh', {
      refreshToken: third.body.refreshToken,
    });
    assert.equal(afterTheft.status, 401);
  });

  it('несуществующий refresh отклоняется', async () => {
    const res = await api(null, 'POST', '/api/auth/refresh', { refreshToken: 'выдуманный' });
    assert.equal(res.status, 401);
    assert.equal(res.body.code, 'unknown');
  });
});

describe('Сессии устройств', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('показывает список устройств и помечает текущее', async () => {
    const phone = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Redmi Note 12',
    });
    await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Планшет на объекте',
    });

    const sessions = await api(phone.body.token, 'GET', '/api/auth/sessions');
    assert.equal(sessions.status, 200);
    assert.equal((sessions.body as any[]).length, 2);

    const current = (sessions.body as any[]).find((s) => s.current);
    assert.equal(current.deviceName, 'Redmi Note 12');
  });

  it('отзыв сессии закрывает доступ именно с того устройства', async () => {
    const phone = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Телефон',
    });
    const tablet = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Планшет',
    });

    const sessions = await api(phone.body.token, 'GET', '/api/auth/sessions');
    const tabletSession = (sessions.body as any[]).find((s) => s.deviceName === 'Планшет');

    const revoked = await api(phone.body.token, 'DELETE', `/api/auth/sessions/${tabletSession.id}`);
    assert.equal(revoked.status, 200);

    // Планшет больше не обновит токен.
    const refresh = await api(null, 'POST', '/api/auth/refresh', {
      refreshToken: tablet.body.refreshToken,
    });
    assert.equal(refresh.status, 401);

    // Телефон продолжает работать.
    assert.equal((await api(phone.body.token, 'GET', '/api/auth/me')).status, 200);
  });

  it('чужую сессию отозвать нельзя', async () => {
    const prorab = await login(ACCOUNTS.prorab);
    const ptoSession = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.pto,
      password: DEMO_PASSWORD,
    });
    const ptoSessions = await api(ptoSession.body.token, 'GET', '/api/auth/sessions');
    const target = (ptoSessions.body as any[])[0];

    const res = await api(prorab, 'DELETE', `/api/auth/sessions/${target.id}`);
    assert.equal(res.status, 404, 'чужая сессия не должна даже подтверждаться существованием');
  });

  it('выход закрывает только текущую сессию', async () => {
    const first = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Первое',
    });
    const second = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Второе',
    });

    assert.equal((await api(first.body.token, 'POST', '/api/auth/logout')).status, 200);

    assert.equal(
      (await api(null, 'POST', '/api/auth/refresh', { refreshToken: first.body.refreshToken })).status,
      401,
    );
    assert.equal(
      (await api(null, 'POST', '/api/auth/refresh', { refreshToken: second.body.refreshToken })).status,
      200,
    );
  });
});

describe('Смена, сброс и блокировка', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('смена пароля закрывает прежние сессии', async () => {
    const oldPhone = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Старое устройство',
    });
    const current = await api(null, 'POST', '/api/auth/login', {
      login: ACCOUNTS.prorab,
      password: DEMO_PASSWORD,
      deviceName: 'Текущее',
    });

    const changed = await api(current.body.token, 'POST', '/api/auth/password', {
      newPassword: 'novyparol123',
      repeatPassword: 'novyparol123',
    });
    assert.equal(changed.status, 200);
    assert.ok(changed.body.refreshToken, 'текущее устройство остаётся в системе');

    // Прежняя сессия закрыта.
    const old = await api(null, 'POST', '/api/auth/refresh', {
      refreshToken: oldPhone.body.refreshToken,
    });
    assert.equal(old.status, 401);

    // Новая пара работает.
    assert.equal((await api(changed.body.token, 'GET', '/api/auth/me')).status, 200);
  });

  it('пароль хранится argon2id и в журнал не попадает', async () => {
    const token = await login(ACCOUNTS.prorab);
    await api(token, 'POST', '/api/auth/password', {
      newPassword: 'novyparol123',
      repeatPassword: 'novyparol123',
    });

    const user = await prisma.user.findFirstOrThrow({ where: { login: ACCOUNTS.prorab } });
    assert.match(user.passwordHash, /^\$argon2id\$/);

    const pto = await login(ACCOUNTS.pto);
    const log = await api(pto, 'GET', `/api/v1/audit?entity=user&entityId=${user.id}`);
    const record = (log.body as any[]).find((r) => r.field === 'password');
    assert.ok(record, 'факт смены фиксируется');
    assert.equal(record.newValue, 'изменён');
    assert.ok(!JSON.stringify(log.body).includes('novyparol123'), 'пароль не должен попадать в журнал');
  });

  it('сброс администратором немедленно закрывает сессии пользователя', async () => {
    const pto = await login(ACCOUNTS.pto);
    const created = await api(pto, 'POST', '/api/users', {
      fullName: 'Новый Мастер',
      phone: '+996 555 777 888',
      role: 'master',
    });

    const session = await api(null, 'POST', '/api/auth/login', {
      login: created.body.user.login,
      password: created.body.temporaryPassword,
    });
    assert.equal(session.status, 200);

    const reset = await api(pto, 'POST', `/api/users/${created.body.user.id}/reset-password`);
    assert.equal(reset.status, 200);
    assert.notEqual(reset.body.temporaryPassword, created.body.temporaryPassword);

    // Устройство с прежним входом выбрасывается сразу.
    const stale = await api(null, 'POST', '/api/auth/refresh', {
      refreshToken: session.body.refreshToken,
    });
    assert.equal(stale.status, 401);

    // Прежний временный пароль тоже не работает.
    const oldPassword = await api(null, 'POST', '/api/auth/login', {
      login: created.body.user.login,
      password: created.body.temporaryPassword,
    });
    assert.equal(oldPassword.status, 401);
  });

  it('блокировка закрывает доступ, но история остаётся', async () => {
    const pto = await login(ACCOUNTS.pto);
    const created = await api(pto, 'POST', '/api/users', {
      fullName: 'Временный Прораб',
      phone: '+996 555 777 999',
      role: 'prorab',
    });
    const session = await api(null, 'POST', '/api/auth/login', {
      login: created.body.user.login,
      password: created.body.temporaryPassword,
    });

    await api(pto, 'PATCH', `/api/users/${created.body.user.id}`, { active: false });

    assert.equal((await api(session.body.token, 'GET', '/api/auth/me')).status, 401);
    assert.equal(
      (await api(null, 'POST', '/api/auth/refresh', { refreshToken: session.body.refreshToken })).status,
      401,
    );

    // Учётка сохранена — история действий не теряется.
    const user = await prisma.user.findUnique({ where: { id: created.body.user.id } });
    assert.ok(user, 'запись пользователя обязана остаться');
    assert.equal(user?.active, false);
  });

  it('действующий пароль посмотреть нельзя никому', async () => {
    const pto = await login(ACCOUNTS.pto);
    const users = await api(pto, 'GET', '/api/users');
    const serialized = JSON.stringify(users.body);
    assert.ok(!serialized.includes('passwordHash'), 'хеш не отдаётся наружу');
    assert.ok(!serialized.includes('temporaryPassword'), 'пароль показывается только при выдаче');
  });
});
