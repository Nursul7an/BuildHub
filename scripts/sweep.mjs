/**
 * Проверка: открыть каждый экран под подходящей ролью и убедиться, что он
 * рисуется, а не падает в границу ошибок.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = process.env.SHOT_DIR || new URL('../.verify/sweep', import.meta.url).pathname;
fs.mkdirSync(OUT, { recursive: true });

const PLAN = [
  {
    login: 'a.zhumabekov',
    screens: [
      ['today'], ['works'], ['zayavki'], ['more'], ['profile'], ['notifications'],
      ['assigned-works'], ['onboarding-blocks'], ['onboarding-sections'],
      ['contractors'], ['project'], ['project-current'], ['rfi'],
      ['documents'], ['documents-acts'], ['documents-strength'], ['documents-object'],
      ['zayavka-new'], ['zayavka-tech'], ['assistant'], ['preview'],
      ['process', 'firstProcess'], ['form', 'firstProcess'], ['present', 'firstProcess'],
      ['chain', 'firstChain'], ['zayavka', 'firstZayavka'], ['acceptance', 'firstTransit'],
      ['returned', 'returnedReport'], ['contractor', 'firstContractor'],
      ['contractor-rate', 'firstContractor'], ['project-set', 'firstSet'], ['project-sheet', 'firstSheet'],
    ],
  },
  {
    login: 'g.sadykova',
    screens: [
      ['pto-today'], ['pto-queue'], ['pto-objects'], ['pto-lab'], ['pto-users'], ['pto-user-new'], ['pto-more'],
      ['pto-object', 'firstObject'], ['pto-chain-setup', 'firstSection'],
    ],
  },
  {
    login: 'n.toktomatov',
    screens: [
      ['boss-digest'], ['boss-inbox'], ['boss-tasks'], ['boss-objects'], ['boss-finance'],
      ['boss-week'], ['boss-kpi'], ['boss-limits'], ['boss-planerka'],
      ['boss-object', 'firstObject'], ['boss-finance-object', 'firstObject'],
    ],
  },
  {
    login: 'n.tashiev',
    screens: [['boss-quality'], ['boss-company-objects'], ['boss-assign']],
  },
  { login: 'e.bakirov', screens: [['mat-today'], ['mat-zayavki'], ['mat-more']] },
  { login: 'm.abdyldaev', screens: [['mat-stock'], ['mat-issue']] },
  { login: 'k.turgunov', screens: [['tech-today'], ['tech-queue'], ['tech-fleet'], ['tech-more']] },
];

const browser = await chromium.launch({ ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
const page = await browser.newPage({ viewport: { width: 780, height: 1010 } });

const failures = [];
let currentScreen = '';
page.on('pageerror', (e) => failures.push(`${currentScreen}: ${String(e).slice(0, 160)}`));

await page.goto('http://127.0.0.1:5173/', { waitUntil: 'networkidle' });

async function loginAs(login) {
  const token = await page.evaluate(async (l) => {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ login: l, password: 'buildhub2026' }),
    });
    const d = await r.json();
    localStorage.setItem('build-hub.token', d.token);
    return d.token;
  }, login);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  return token;
}

/** Реальные идентификаторы берём из API — экраны без параметров бессмысленны. */
async function resolveParams(kind) {
  return page.evaluate(async (k) => {
    const t = localStorage.getItem('build-hub.token');
    const get = async (p) => (await fetch(p, { headers: { authorization: `Bearer ${t}` } })).json();
    switch (k) {
      case 'firstProcess': {
        const d = await get('/api/today');
        const p = d.processes.find((x) => x.status !== 'blocked') ?? d.processes[0];
        return p ? { processStateId: p.id } : {};
      }
      case 'firstChain': {
        const d = await get('/api/works?mine=1');
        const p = d[0];
        return p ? { sectionId: p.sectionId, blockId: p.blockId, floor: p.floor } : {};
      }
      case 'firstZayavka': {
        const d = await get('/api/zayavki?scope=mine');
        return d[0] ? { zayavkaId: d[0].id } : {};
      }
      case 'firstTransit': {
        const d = await get('/api/zayavki?scope=mine');
        const z = d.find((x) => x.status === 'inTransit') ?? d[0];
        return z ? { zayavkaId: z.id } : {};
      }
      case 'returnedReport': {
        const d = await get('/api/today');
        return d.returnedReport ? { reportId: d.returnedReport.id } : {};
      }
      case 'firstContractor': {
        const d = await get('/api/contractors');
        return d[0] ? { contractorId: d[0].id } : {};
      }
      case 'firstSet': {
        const d = await get('/api/project/sets');
        return d[0] ? { setId: d[0].id } : {};
      }
      case 'firstSheet': {
        const d = await get('/api/project/current-sheets');
        return d[0] ? { sheetId: d[0].id } : {};
      }
      case 'firstObject': {
        const d = await get('/api/objects');
        return d[0] ? { objectId: d[0].id } : {};
      }
      case 'firstSection': {
        const d = await get('/api/sections');
        return d[0] ? { sectionId: d[0].id } : {};
      }
      default:
        return {};
    }
  }, kind);
}

let ok = 0;
for (const group of PLAN) {
  await loginAs(group.login);
  console.log(`\n=== ${group.login} ===`);
  for (const [screen, paramKind] of group.screens) {
    currentScreen = `${group.login}/${screen}`;
    const params = paramKind ? await resolveParams(paramKind) : {};
    await page.evaluate(
      ({ s, p }) => window.buildHub.setState({ screen: s, params: p, history: [] }),
      { s: screen, p: params },
    );
    await page.waitForTimeout(420);

    const broken = await page.getByText('Экран не открылся').count();
    const missing = await page.getByText('Экран ещё не собран').count();
    const empty = (await page.locator('#root').innerText()).trim().length < 40;

    if (broken || missing || empty) {
      failures.push(`${currentScreen}: ${broken ? 'упал' : missing ? 'не собран' : 'пусто'}`);
      await page.screenshot({ path: `${OUT}/FAIL-${screen}.png` });
      console.log(`  ✗ ${screen}`);
    } else {
      ok += 1;
      console.log(`  ✓ ${screen}`);
    }
  }
}

console.log(`\nОткрылось: ${ok}, проблем: ${failures.length}`);
for (const f of failures) console.log('  !', f);
await browser.close();
process.exit(failures.length > 0 ? 1 : 0);
