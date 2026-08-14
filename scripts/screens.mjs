import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.env.SHOT_DIR || new URL('../.verify/screens', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 780, height: 1010 }, deviceScaleFactor: 2 });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('CERT')) errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

const phone = () => page.locator('div').filter({ hasText: /^/ }).first();

async function shot(name) {
  await page.waitForTimeout(500);
  const frame = await page.$('#root > div > div:last-child');
  await (frame || page).screenshot({ path: `${OUT}/${name}.png` });
  console.log('  shot', name);
}

async function tapNav(label) {
  await page.locator('div', { hasText: new RegExp(`^${label}$`) }).last().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function tapText(text, nth = 0) {
  const t = page.getByText(text, { exact: false }).nth(nth);
  await t.click({ timeout: 5000 }).catch((e) => console.log('    miss:', text));
  await page.waitForTimeout(600);
}

async function switchRole(label) {
  await page.getByText(label, { exact: false }).first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
}

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });

console.log('прораб');
await shot('01-login');
await page.getByText('Войти', { exact: true }).click();
await page.waitForTimeout(1400);
await shot('02-today');

await tapNav('Работы');
await shot('03-works');
await tapText('показать процессы');
await tapText('Вся цепочка раздела');
await shot('04-chain');

await tapNav('Сегодня');
await tapText('Армирование колонн и стен', 1);
await shot('05-process');

await tapNav('Заявки');
await shot('06-zayavki');
await tapText('+ Заявка');
await page.waitForTimeout(400);
await shot('07-zayavka-new');

await tapNav('Ещё');
await shot('08-more');
await tapText('Подрядчики');
await shot('09-contractors');

console.log('ПТО');
await switchRole('Инженер ПТО');
await shot('10-pto-today');
await tapNav('Приёмка');
await shot('11-pto-queue');
await tapNav('Объекты');
await shot('12-pto-objects');

console.log('директор');
await switchRole('Директор');
await shot('13-boss-digest');
await tapNav('Задачи');
await shot('14-boss-inbox');
await tapNav('Финансы');
await shot('15-boss-finance');

console.log('главный инженер');
await switchRole('Гл. инженер');
await tapNav('Качество');
await shot('16-gi-quality');

console.log('снабжение');
await switchRole('Снабжение');
await shot('17-mat-today');
await tapNav('Заявки');
await shot('18-mat-zayavki');

console.log('завсклад');
await switchRole('Завсклад');
await shot('19-sklad-today');
await tapNav('Склад');
await shot('20-stock');

console.log('спецтехника');
await switchRole('Спецтехника');
await shot('21-tech-today');
await tapNav('Парк');
await shot('22-fleet');

if (errors.length) {
  console.log('--- console errors ---');
  for (const e of [...new Set(errors)].slice(0, 12)) console.log(e.slice(0, 240));
} else {
  console.log('--- нет ошибок в консоли ---');
}
await browser.close();
