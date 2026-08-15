/**
 * Настройки развёртывания.
 *
 * Проверяем не «функция вернула строку», а то, ради чего она написана:
 * развёрнутая система не должна подняться с секретом, который лежит
 * в открытом репозитории.
 */
import { afterEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, assertDeployable, fileSigningSecret, jwtSecret } from '../src/config.js';

const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
});

describe('Секрет подписи токенов', () => {
  it('в разработке подставляется отладочный — иначе не поднять локально', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    assert.equal(jwtSecret(), 'build-hub-dev-secret-change-me');
  });

  it('в проде без секрета — отказ, а не молчаливое согласие', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.JWT_SECRET;
    assert.throws(() => jwtSecret(), /JWT_SECRET/);
  });

  it('в проде отладочный секрет запрещён', () => {
    // Он напечатан в исходниках: с ним токен директора подделает любой,
    // кто открывал репозиторий.
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'build-hub-dev-secret-change-me';
    assert.throws(() => jwtSecret(), /отладочным значением/);
  });

  it('в проде короткий секрет запрещён', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'qwerty123';
    assert.throws(() => jwtSecret(), /32/);
  });

  it('нормальный секрет принимается', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'a'.repeat(64);
    assert.equal(jwtSecret(), 'a'.repeat(64));
  });
});

describe('Секрет подписи ссылок на файлы', () => {
  it('по умолчанию берётся токенный — ссылки работают без лишней настройки', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'b'.repeat(64);
    delete process.env.FILE_SIGNING_SECRET;
    assert.equal(fileSigningSecret(), 'b'.repeat(64));
  });

  it('отдельный секрет имеет приоритет: утечка одного не отдаёт другое', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'b'.repeat(64);
    process.env.FILE_SIGNING_SECRET = 'c'.repeat(64);
    assert.equal(fileSigningSecret(), 'c'.repeat(64));
  });
});

describe('Разрешённые адреса фронтенда', () => {
  it('без переменной разрешён любой источник — прежнее поведение', () => {
    delete process.env.WEB_ORIGIN;
    assert.equal(allowedOrigins(), true);
  });

  it('список разбирается по запятой, хвостовой слэш не мешает', () => {
    // Адрес из настроек хостинга копируют вместе со слэшем,
    // и несовпадение по одному символу выглядит как поломка CORS.
    process.env.WEB_ORIGIN = 'https://a.vercel.app/, https://b.example.com';
    assert.deepEqual(allowedOrigins(), ['https://a.vercel.app', 'https://b.example.com']);
  });

  it('пустая строка не превращается в список из пустого адреса', () => {
    process.env.WEB_ORIGIN = '  ,  ';
    assert.equal(allowedOrigins(), true);
  });
});

describe('Проверка перед запуском', () => {
  it('в проде без DATABASE_URL — отказ на старте, а не в первом запросе', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'd'.repeat(64);
    delete process.env.DATABASE_URL;
    assert.throws(() => assertDeployable(), /DATABASE_URL/);
  });

  it('при полном наборе настроек проходит', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'e'.repeat(64);
    process.env.DATABASE_URL = 'postgresql://localhost:5432/x';
    assert.doesNotThrow(() => assertDeployable());
  });
});
