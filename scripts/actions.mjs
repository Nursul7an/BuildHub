/**
 * Проверка действий, а не только отрисовки.
 *
 * Обход экранов (sweep.mjs) ловит падения при открытии. Он не ловит того,
 * что нашлось на пути прораба: экран рисуется, а нажатие на кнопку уходит
 * в 400, потому что клиент и сервер разошлись в договорённости о полях.
 *
 * Здесь на каждом экране нажимается каждое действие — по одному, с
 * возвратом на исходный экран, — и записывается всё, что сервер ответил
 * кодом 4xx или 5xx без осознанного отказа.
 *
 * Отказ по правилу (403 «роль не имеет права», 409 «переход запрещён») —
 * это не дефект, а работа системы. Дефект — это 500 и 400 «проверьте
 * переданные данные»: второе означает, что клиент отправил не то, что
 * сервер просит, и ни один пользователь этого не обойдёт.
 */
import { chromium } from 'playwright';

const BASE = process.env.WEB_URL || 'http://127.0.0.1:5173';

/** Что нажимать по ролям. Экраны те же, что в sweep.mjs. */
const PLAN = [
  {
    login: 'g.sadykova',
    title: 'ПТО',
    screens: ['pto-today', 'pto-queue', 'pto-objects', 'pto-lab', 'pto-users', 'pto-more'],
  },
  {
    login: 'e.bakirov',
    title: 'Снабжение',
    screens: ['mat-today', 'mat-zayavki', 'mat-more'],
  },
  {
    login: 'm.abdyldaev',
    title: 'Завсклад',
    screens: ['mat-stock', 'mat-issue'],
  },
  {
    login: 'k.turgunov',
    title: 'Спецтехника',
    screens: ['tech-today', 'tech-queue', 'tech-fleet', 'tech-more'],
  },
  {
    login: 'n.toktomatov',
    title: 'Директор',
    screens: ['boss-digest', 'boss-inbox', 'boss-tasks', 'boss-objects', 'boss-finance', 'boss-week', 'boss-kpi', 'boss-limits', 'boss-planerka'],
  },
  {
    login: 'n.tashiev',
    title: 'Главный инженер',
    screens: ['boss-quality', 'boss-company-objects', 'boss-assign'],
  },
  {
    login: 't.mamatov',
    title: 'Мастер',
    screens: ['today', 'works', 'zayavki', 'more'],
  },
];

/** Сколько действий пробуем на экране: иначе обход не заканчивается. */
const MAX_ACTIONS = 12;

/**
 * Всё ищем внутри рамки телефона. Слева на демонстрационном стенде стоит
 * переключатель ролей, и он тоже кликабелен: обход без этого ограничения
 * нажимает «войти другой ролью» вместо действий приложения и
 * заканчивается бодрым «проблем нет».
 */
const FRAME = '#root > div > div:last-child';

const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}),
});
const page = await browser.newPage({ viewport: { width: 780, height: 1010 } });

const problems = [];
let where = '';

page.on('pageerror', (e) => {
  problems.push({ where, kind: 'падение экрана', detail: String(e).slice(0, 200) });
});

page.on('response', async (res) => {
  const url = res.url();
  if (!url.includes('/api/') || res.status() < 400) return;

  let body = '';
  try {
    body = (await res.text()).slice(0, 220);
  } catch {
    /* тело уже недоступно */
  }

  const path = url.replace(/^https?:\/\/[^/]+/, '');
  const status = res.status();

  // Осознанные отказы пропускаем: они и должны так отвечать.
  const expected =
    status === 401 ||
    status === 403 ||
    status === 404 ||
    (status === 409 && !/internal/.test(body));
  if (expected) return;

  problems.push({ where, kind: `HTTP ${status}`, detail: `${path} → ${body}` });
});

await page.goto(BASE, { waitUntil: 'networkidle' });

async function loginAs(login) {
  await page.evaluate(async (l) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: l, password: 'buildhub2026' }),
    });
    const d = await r.json();
    localStorage.setItem('build-hub.token', d.token);
  }, login);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
}

async function goTo(screen) {
  await page.evaluate((s) => window.buildHub.getState().go(s), screen);
  await page.waitForTimeout(700);
}

/**
 * Что на экране можно нажать. Берём подписи кликабельных элементов:
 * кнопки и фишки в этом интерфейсе — это div с cursor: pointer.
 */
async function clickableIn(frame) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return [];
    const seen = new Set();
    const out = [];
    for (const el of root.querySelectorAll('div,button')) {
      const style = el.getAttribute('style') || '';
      if (!style.includes('cursor: pointer') && el.tagName !== 'BUTTON') continue;
      const text = (el.textContent || '').trim();
      if (!text || text.length > 60 || seen.has(text)) continue;
      seen.add(text);
      out.push(text);
    }
    return out;
  }, frame);
}

/** Действия — короткие подписи; карточки списка — длинные. */
async function actionsOn() {
  return (await clickableIn(FRAME)).filter((t) => t.length <= 40);
}

async function cardsOn() {
  return (await clickableIn(FRAME)).filter((t) => t.length > 40);
}

function inFrame(label) {
  return page.locator(FRAME).getByText(label, { exact: true }).first();
}

async function currentScreen() {
  return page.evaluate(() => window.buildHub.getState().screen);
}

for (const role of PLAN) {
  console.log(`\n=== ${role.title} (${role.login}) ===`);
  await loginAs(role.login);

  for (const screen of role.screens) {
    await goTo(screen);
    const actions = (await actionsOn()).slice(0, MAX_ACTIONS);
    let clicked = 0;

    for (const label of actions) {
      where = `${role.login}/${screen}: «${label}»`;
      try {
        // Возвращаемся на экран перед каждым нажатием: иначе первое же
        // действие уводит навигацию и остальные проверяются не там.
        await goTo(screen);
        const target = inFrame(label);
        if ((await target.count()) === 0) continue;
        await target.click({ timeout: 3000 });
        await page.waitForTimeout(700);
        clicked += 1;
      } catch {
        // Некликабельно или перекрыто — не дефект приложения.
      }
    }

    // Второй уровень: открыть карточку из списка и нажать всё на ней.
    // Именно там живут настоящие действия — приёмка отчёта, обработка
    // заявки, выдача материала.
    await goTo(screen);
    const cards = (await cardsOn()).slice(0, 3);
    let opened = 0;

    for (const card of cards) {
      try {
        await goTo(screen);
        const target = inFrame(card);
        if ((await target.count()) === 0) continue;
        await target.click({ timeout: 3000 });
        await page.waitForTimeout(900);

        const detail = await currentScreen();
        if (detail === screen) continue;
        opened += 1;

        const detailActions = (await actionsOn()).slice(0, MAX_ACTIONS);
        for (const label of detailActions) {
          where = `${role.login}/${screen} → ${detail}: «${label}»`;
          try {
            const button = inFrame(label);
            if ((await button.count()) === 0) continue;
            await button.click({ timeout: 3000 });
            await page.waitForTimeout(700);
            // Если действие увело с карточки — возвращаемся к ней.
            if ((await currentScreen()) !== detail) break;
          } catch {
            /* перекрыто — пропускаем */
          }
        }
      } catch {
        /* карточка не открылась */
      }
    }

    console.log(`  ${screen}: действий ${clicked}/${actions.length}, карточек открыто ${opened}`);
  }
}

where = '';
await browser.close();

console.log(`\nНайдено проблем: ${problems.length}`);
for (const p of problems) {
  console.log(`  ! ${p.where}\n      ${p.kind}: ${p.detail}`);
}

process.exit(problems.length > 0 ? 1 : 0);
