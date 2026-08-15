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
    // pto-user-new и pto-lab — экраны ввода: без заполнения полей
    // их главная кнопка недостижима.
    screens: ['pto-today', 'pto-queue', 'pto-objects', 'pto-lab', 'pto-users', 'pto-user-new', 'pto-more'],
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
  {
    login: 'a.zhumabekov',
    title: 'Прораб · формы',
    // Экраны ввода прораба: заявка, техника, вопрос проектировщику,
    // подрядчики. Дневной отчёт проверяется отдельно в flow.mjs —
    // там своя клавиатура и настоящая загрузка фото.
    screens: ['zayavka-new', 'zayavka-tech', 'rfi', 'contractors', 'assistant'],
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

/**
 * Правдоподобное значение по подписи поля.
 *
 * Заполнять всё подряд строкой «тест» бессмысленно: сервер отвергнет её
 * по типу, и обход соберёт кучу ложных отказов вместо настоящих. Значение
 * подбираем по тому, что у поля написано — телефон телефоном, объём
 * числом, причина фразой.
 */
function valueFor(hint, type, stamp) {
  const h = hint.toLowerCase();

  if (type === 'date') {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  }
  if (type === 'time') return '09:00';

  if (/телефон|тел\.|phone/.test(h)) return `+996 555 ${String(stamp).slice(-6, -3)} ${String(stamp).slice(-3)}`;
  if (/логин|login/.test(h)) return `probe.${stamp}`;
  if (/фамили|фио|имя|сотрудник|человек/.test(h)) return 'Тестов Тест Тестович';
  if (/причин|коммент|примечан|описан|замечан|текст|вопрос|задач/.test(h)) {
    return 'Проверка обходом: причина указана для контроля правил.';
  }
  if (/должност|роль/.test(h)) return 'прораб';
  if (/марк|модель|номер|госномер|партия|паспорт|серт/.test(h)) return `ПР-${stamp}`;
  if (/лимит|сумма|цена|стоим|бюджет/.test(h)) return '15000';
  if (/объём|объем|количест|кол-во|masse|вес|штук|часов|часы|моточас|смен/.test(h)) return '12';
  if (/процент|%/.test(h)) return '80';
  if (/температур/.test(h)) return '18';
  if (/прочност/.test(h)) return '75';
  if (type === 'number') return '10';

  return `Проверка ${stamp}`;
}

/**
 * Заполнение всех полей на экране.
 *
 * Возвращает, сколько полей заполнено: если ноль, форму отправлять
 * незачем — экран не про ввод.
 */
async function fillFields(stamp) {
  return page.evaluate(
    ({ sel, stamp, source }) => {
      // Функцию подбора значения передаём текстом: страница и скрипт
      // живут в разных мирах, общей области видимости у них нет.
      const valueFor = new Function(`return ${source}`)();

      const root = document.querySelector(sel);
      if (!root) return 0;

      /** React слушает событие input, а не присваивание value. */
      function setNative(el, value) {
        const proto = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
        setter?.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      let filled = 0;

      for (const el of root.querySelectorAll('input, textarea')) {
        if (el.type === 'file' || el.disabled || el.readOnly) continue;
        if (el.type === 'checkbox' || el.type === 'radio') {
          if (!el.checked) {
            el.click();
            filled += 1;
          }
          continue;
        }
        const label = `${el.placeholder || ''} ${el.closest('div')?.textContent || ''}`.slice(0, 120);
        const existing = (el.value || '').trim();

        if (existing !== '') {
          // Поле с готовым значением — например, действующий лимит.
          // Пропустить его значит не отправить форму вовсе: сохранять
          // то же самое приложение обычно не даёт. Меняем число, чтобы
          // отправка была осмысленной.
          const asNumber = Number(existing.replace(/\s/g, '').replace(',', '.'));
          if (!Number.isFinite(asNumber)) continue;
          setNative(el, String(Math.round(asNumber) + 1));
          filled += 1;
          continue;
        }

        // Подпись ищем рядом: у Field она лежит соседним узлом.
        setNative(el, valueFor(label, el.type, stamp));
        filled += 1;
      }

      for (const el of root.querySelectorAll('select')) {
        if (el.disabled || el.options.length === 0) continue;
        // Первый пункт обычно «выберите» — берём следующий.
        const index = el.options.length > 1 ? 1 : 0;
        if (el.selectedIndex === index) continue;
        el.selectedIndex = index;
        el.dispatchEvent(new Event('change', { bubbles: true }));
        filled += 1;
      }

      return filled;
    },
    { sel: FRAME, stamp, source: valueFor.toString() },
  );
}

/**
 * Главное действие экрана — большая кнопка внизу (PrimaryButton).
 * Отличается ростом 56 и скруглением 18; так её видно без завязки
 * на подпись, которая на каждом экране своя.
 */
async function primaryActions() {
  const big = await page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return [];
    const out = [];
    for (const el of root.querySelectorAll('div')) {
      const s = el.getAttribute('style') || '';
      if (!s.includes('height: 56px') || !s.includes('cursor: pointer')) continue;
      const t = (el.textContent || '').trim();
      if (t && t.length <= 40 && !out.includes(t)) out.push(t);
    }
    return out;
  }, FRAME);

  if (big.length > 0) return big;

  // Не на каждом экране отправка — большая кнопка внизу. Тогда ищем
  // по глаголу: подписи в этом интерфейсе говорят, что произойдёт.
  return (await actionsOn()).filter((t) => SUBMIT_VERB.test(t));
}

/** Подписи, за которыми стоит отправка формы. */
const SUBMIT_VERB = /^(отправить|сохранить|создать|внести|выдать|назначить|согласовать|подтвердить|добавить|записать|провести|заказать|принять)/i;

/** Подписи, за которыми форма открывается. */
const OPENS_FORM = /^(\+|внести|добавить|создать|нов[аыо]|заявка|поставить задачу|выдать|назначить|записать)/i;

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

    // Третий проход: заполнить поля и отправить. До него не доходили
    // экраны, где всё интересное спрятано за формой, — заведение
    // человека, изменение лимита, назначение техники.
    let filled = 0;
    let submitted = 0;

    /** Заполнить то, что сейчас на экране, и нажать отправку. */
    async function fillAndSubmit(context) {
      const stamp = Date.now() % 1_000_000;
      const count = await fillFields(stamp);
      if (count === 0) return 0;
      filled += count;

      for (const label of await primaryActions()) {
        where = `${role.login}/${screen}${context}: форма → «${label}»`;
        try {
          const button = inFrame(label);
          if ((await button.count()) === 0) continue;
          await button.click({ timeout: 3000 });
          await page.waitForTimeout(1200);
          submitted += 1;
          return count;
        } catch {
          /* кнопка недоступна */
        }
      }
      return count;
    }

    await goTo(screen);
    await fillAndSubmit('');

    // Формы, которые открываются кнопкой: «+ Человек», «Внести»,
    // «Поставить задачу». Без этого шага они остаются непроверенными —
    // именно там заводят людей, лимиты и назначают технику.
    await goTo(screen);
    for (const label of (await actionsOn()).filter((t) => OPENS_FORM.test(t)).slice(0, 4)) {
      try {
        await goTo(screen);
        const opener = inFrame(label);
        if ((await opener.count()) === 0) continue;
        await opener.click({ timeout: 3000 });
        await page.waitForTimeout(900);
        await fillAndSubmit(` → «${label}»`);
      } catch {
        /* форма не открылась */
      }
    }

    console.log(
      `  ${screen}: действий ${clicked}/${actions.length}` +
        `, карточек ${opened}` +
        `, полей ${filled}` +
        `, отправок ${submitted}`,
    );
  }
}

where = '';
await browser.close();

console.log(`\nНайдено проблем: ${problems.length}`);
for (const p of problems) {
  console.log(`  ! ${p.where}\n      ${p.kind}: ${p.detail}`);
}

process.exit(problems.length > 0 ? 1 : 0);
