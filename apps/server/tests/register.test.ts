/**
 * Регистрация первого руководителя.
 *
 * Обычные учётные записи заводит ПТО. Первого директора завести некому:
 * система приходит пустой. Поэтому вход открыт ровно до того момента,
 * пока руководителя нет, — и закрыт навсегда после. Иначе любой желающий
 * заведёт себе директорский доступ к бюджетам и платежам.
 */
import { after, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, DEMO_PASSWORD, api, closeAll, getApp, login, resetDatabase } from './helpers.js';
import { prisma } from '../src/db.js';

/** Пустая система: людей нет вообще. */
async function emptyDatabase() {
  await resetDatabase();
  await prisma.$transaction([
    prisma.session.deleteMany(),
    prisma.auditLog.deleteMany(),
  ]);
  // Роли снимаем, а не удаляем людей: на них висят отчёты и заявки,
  // а проверяем мы именно отсутствие действующего руководителя.
  await prisma.user.updateMany({ where: { role: 'dir' }, data: { active: false } });
}

const REGISTRATION = {
  fullName: 'Нурлан Токтоматов',
  login: 'n.director',
  phone: '+996 555 100 100',
  password: 'stroyka2026',
  repeatPassword: 'stroyka2026',
  client: 'mobile' as const,
};

describe('Регистрация закрыта, когда руководитель есть', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('признак закрытости виден до попытки', async () => {
    const res = await api(null, 'GET', '/api/auth/registration-open');
    assert.equal(res.status, 200);
    assert.equal(res.body.open, false, 'в засеянной базе директор уже есть');
  });

  it('попытка зарегистрироваться отклоняется и объясняет, к кому идти', async () => {
    const res = await api(null, 'POST', '/api/auth/register', REGISTRATION);
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'registration_closed');
    assert.match(res.body.message, /ПТО/, 'человеку нужно знать, куда обращаться');
  });

  it('второго директора в базе не появилось', async () => {
    await api(null, 'POST', '/api/auth/register', REGISTRATION);
    const created = await prisma.user.findUnique({ where: { login: 'n.director' } });
    assert.equal(created, null);
  });
});

describe('Регистрация в пустой системе', () => {
  beforeEach(emptyDatabase);
  after(closeAll);

  it('признак открытости виден до попытки', async () => {
    const res = await api(null, 'GET', '/api/auth/registration-open');
    assert.equal(res.body.open, true);
  });

  it('руководитель заводит себя сам и сразу оказывается внутри', async () => {
    const res = await api(null, 'POST', '/api/auth/register', REGISTRATION);

    assert.equal(res.status, 200);
    assert.ok(res.body.token, 'после регистрации человек уже в системе');
    assert.equal(res.body.user.role, 'dir');
    assert.equal(
      res.body.mustChangePassword,
      false,
      'пароль задан своей рукой — менять его не с чего',
    );

    // Токен действительно рабочий.
    const me = await api(res.body.token, 'GET', '/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.body.role, 'dir');
  });

  it('после регистрации вход по паролю работает', async () => {
    await api(null, 'POST', '/api/auth/register', REGISTRATION);

    const entered = await api(null, 'POST', '/api/auth/login', {
      login: 'n.director',
      password: 'stroyka2026',
      client: 'mobile',
    });
    assert.equal(entered.status, 200);
  });

  it('регистрация закрывается сразу после первой', async () => {
    await api(null, 'POST', '/api/auth/register', REGISTRATION);

    assert.equal((await api(null, 'GET', '/api/auth/registration-open')).body.open, false);

    const second = await api(null, 'POST', '/api/auth/register', {
      ...REGISTRATION,
      login: 'kto.to.esche',
    });
    assert.equal(second.status, 403, 'вторым директором себя не назначить');
  });

  it('две одновременные регистрации создают ровно одного руководителя', async () => {
    // Разошедшиеся на миллисекунды отправки формы обе увидели бы
    // «руководителя нет». Уникальность логина здесь не спасает —
    // логины у них разные.
    const app = await getApp();
    const attempt = (login: string) =>
      app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: { ...REGISTRATION, login },
      });

    const [a, b] = await Promise.all([attempt('pervy.dir'), attempt('vtoroy.dir')]);

    const codes = [a.statusCode, b.statusCode].sort();
    assert.deepEqual(codes, [200, 403], 'ровно одна попытка обязана пройти');

    const directors = await prisma.user.count({ where: { role: 'dir', active: true } });
    assert.equal(directors, 1);
  });

  it('слабый пароль не принимается', async () => {
    const res = await api(null, 'POST', '/api/auth/register', {
      ...REGISTRATION,
      password: '12345678',
      repeatPassword: '12345678',
    });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'weak_password');
  });

  it('несовпадающие пароли не принимаются', async () => {
    const res = await api(null, 'POST', '/api/auth/register', {
      ...REGISTRATION,
      repeatPassword: 'drugoyparol1',
    });
    assert.equal(res.status, 400);
    assert.match(res.body.message, /не совпадают/i);
  });

  it('занятый логин отклоняется отдельным ответом', async () => {
    // Прораб из фикстур остался — его логин занят.
    const res = await api(null, 'POST', '/api/auth/register', {
      ...REGISTRATION,
      login: ACCOUNTS.prorab,
    });
    assert.equal(res.status, 409);
    assert.equal(res.body.code, 'already_exists');
  });

  it('логин с пробелами и кириллицей не принимается', async () => {
    // Логин диктуют по телефону и набирают на морозе: латиница и цифры.
    for (const bad of ['нурлан', 'с пробелом', 'ab']) {
      const res = await api(null, 'POST', '/api/auth/register', { ...REGISTRATION, login: bad });
      assert.equal(res.status, 400, `«${bad}» не должен приниматься`);
    }
  });

  it('регистрация записывается в журнал действий', async () => {
    const res = await api(null, 'POST', '/api/auth/register', REGISTRATION);
    const entry = await prisma.auditLog.findFirst({
      where: { entityId: res.body.user.id, field: 'registration' },
    });
    assert.ok(entry, 'появление директора обязано быть видно в журнале (§12)');
  });

  it('роль в запросе не выбирается — только руководитель', async () => {
    const res = await api(null, 'POST', '/api/auth/register', {
      ...REGISTRATION,
      role: 'pto',
    } as never);
    assert.equal(res.status, 200);
    assert.equal(res.body.user.role, 'dir', 'подсказка роли из тела игнорируется');
  });
});

describe('Обычные учётные записи по-прежнему заводит ПТО', () => {
  beforeEach(resetDatabase);
  after(closeAll);

  it('прораб не может зарегистрироваться сам', async () => {
    const res = await api(null, 'POST', '/api/auth/register', {
      ...REGISTRATION,
      login: 'novy.prorab',
    });
    assert.equal(res.status, 403);
  });

  it('ПТО заводит человека как раньше', async () => {
    const pto = await login(ACCOUNTS.pto, DEMO_PASSWORD);
    const res = await api(pto, 'POST', '/api/users', {
      fullName: 'Проверочный Прораб',
      login: 'proverka.prorab',
      phone: '+996 555 200 200',
      role: 'prorab',
    });
    assert.equal(res.status, 201);
    assert.ok(res.body.temporaryPassword, 'временный пароль выдаётся ПТО');
  });
});
