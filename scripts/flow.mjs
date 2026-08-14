/**
 * Главный путь прораба, прокликанный в интерфейсе:
 * Сегодня → «Горит» → карточка процесса → Комментарий → «Нехватка материала»
 * → Создать заявку → отправить → заявка в реестре.
 * Затем: форма → объём → фото → сохранить → предпросмотр → отправить →
 * ПТО видит отчёт в очереди.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = new URL('../.verify/flow', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 780, height: 1010 }, deviceScaleFactor: 2 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));

let step = 0;
async function shot(name) {
  step += 1;
  await page.waitForTimeout(400);
  const frame = await page.$('#root > div > div:last-child');
  await (frame || page).screenshot({ path: `${OUT}/${String(step).padStart(2, '0')}-${name}.png` });
}

async function click(text, { exact = false, nth = 0 } = {}) {
  await page.getByText(text, { exact }).nth(nth).click({ timeout: 8000 });
  await page.waitForTimeout(500);
}

function check(label, ok) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) errors.push(`проверка не прошла: ${label}`);
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });

console.log('Прораб · путь «нехватка материала → заявка»');
await click('Войти', { exact: true });
await page.waitForTimeout(1200);
await shot('today');

// «Горит» ведёт в карточку процесса с причиной задержки.
await click('Армирование колонн и стен', { nth: 0 });
await shot('process');
check('в карточке виден просроченный срок', (await page.getByText('просрочено').count()) > 0);
check(
  'кнопка предъявления объясняет, почему недоступна',
  (await page.getByText('Предъявление доступно при 100%').count()) > 0,
);

await click('Комментарий', { exact: true });
await shot('comment-sheet');
await click('Нехватка материала');
await page.waitForTimeout(300);
await shot('comment-material');

await click('Создать заявку по этому материалу');
await page.waitForTimeout(900);
await shot('zayavka-new');

// Свободный ввод: позиция не опознана, но заявка всё равно уходит.
await page.locator('input[placeholder="например: арматура 12ка"]').fill('арматура 12ка');
await page.waitForTimeout(700);
await shot('zayavka-typed');
check(
  'неопознанная позиция помечена, а не отвергнута',
  (await page.getByText('Позиция не опознана').count()) > 0,
);

await click('Отправить заявку');
await page.waitForTimeout(1200);
await shot('zayavka-card');
check('заявка открылась карточкой с таймлайном', (await page.getByText('ДВИЖЕНИЕ ЗАЯВКИ').count()) > 0);

// Заявка попала в реестр.
await page.evaluate(() => window.buildHub.getState().go('zayavki'));
await page.waitForTimeout(900);
await shot('zayavki-list');
check('заявка видна в реестре', (await page.getByText('арматура 12ка').count()) > 0);

console.log('Прораб · дневной отчёт');
await page.evaluate(() => window.buildHub.getState().go('today'));
await page.waitForTimeout(900);
await click('Армирование колонн и стен', { nth: 1 });
await page.waitForTimeout(700);
await shot('form-empty');
check('сохранение заблокировано без объёма', (await page.getByText('Введите объём за сегодня').count()) > 0);

for (const key of ['2', '8', '0']) await click(key, { exact: true });
await page.waitForTimeout(300);
check('сохранение требует фото', (await page.getByText('Минимум 1 фото').count()) > 0);
await shot('form-no-photo');

await click('Фото');
await page.waitForTimeout(400);
await shot('form-ready');

await click('Сохранить и далее');
await page.waitForTimeout(1200);
await shot('preview');
check('предпросмотр показывает итоги дня', (await page.getByText('ИТОГИ ДНЯ').count()) > 0);

await click('Отправить на согласование');
await page.waitForTimeout(1400);
await shot('status');
check('после отправки видна цепочка согласования', (await page.getByText('Инженер ПТО').count()) > 0);
check('показано время заполнения', (await page.getByText('Заполнение заняло').count()) > 0);

console.log('ПТО · проверка отчёта');
await click('Инженер ПТО · Гульмира С.');
await page.waitForTimeout(1400);
await page.evaluate(() => window.buildHub.getState().go('pto-queue'));
await page.waitForTimeout(900);
await shot('pto-queue');
check('отчёт прораба пришёл в очередь ПТО', (await page.getByText('Азамат Жумабеков').count()) > 0);

await click('Азамат Жумабеков');
await page.waitForTimeout(800);
await shot('pto-check');
check('видны фото с геометкой', (await page.getByText('с геометкой и временем').count()) > 0);

await click('Скорректировать объём');
await page.waitForTimeout(400);
await shot('pto-adjust');
check(
  'корректировка требует причины',
  (await page.getByPlaceholder('Причина корректировки — её увидит прораб').count()) > 0,
);

console.log('Руководство · простой с ценой');
await click('Директор · Нурлан Т.');
await page.waitForTimeout(1400);
await shot('boss-digest');
check('простой попал в ленту руководства с ценой', (await page.getByText('сом').count()) > 0);

console.log(errors.length === 0 ? '\nВсе проверки прошли' : `\nПроблемы: ${errors.length}`);
for (const e of [...new Set(errors)]) console.log('  !', e);
await browser.close();
process.exit(errors.length > 0 ? 1 : 0);
