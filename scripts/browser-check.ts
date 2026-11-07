// Automated browser checks using the locally installed Microsoft Edge (playwright-core, no downloads).
// Usage: npm run build && npx vite preview --port 4173 (in another shell) && npx tsx scripts/browser-check.ts [baseUrl]
import { chromium, type Page, type BrowserContext } from 'playwright-core';
import { readFileSync, mkdirSync } from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4173/';
const OUT = '.verify/shots';
mkdirSync(OUT, { recursive: true });
const SAVE_KEY = 'gripEmpire.save';
const results: { name: string; ok: boolean; info?: string }[] = [];
const check = (name: string, ok: boolean, info?: string) => {
  results.push({ name, ok, info });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? ' — ' + info : ''}`);
};

async function newPage(ctx: BrowserContext, errors: string[]) {
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
  return page;
}

const state = (page: Page) => page.evaluate(() => (window as any).__grip.state);

async function navTo(page: Page, label: string) {
  await page.locator('nav.nav button', { hasText: label }).first().click();
  await page.waitForTimeout(250);
}

async function main() {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true });

  // ---------- 1. Fresh game, desktop ----------
  {
    const errors: string[] = [];
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const page = await newPage(ctx, errors);
    await page.goto(BASE);
    await page.waitForSelector('.serve');
    await page.screenshot({ path: `${OUT}/01-fresh-shop.png` });
    const s0 = await state(page);
    check('fresh game starts with bushings Lv1 and $0', s0.run.products.bushings === 1 && s0.run.cash === 0);
    // Hold space for 3 seconds
    await page.locator('body').click({ position: { x: 5, y: 300 } });
    await page.keyboard.down('Space');
    await page.waitForTimeout(3000);
    await page.keyboard.up('Space');
    const s1 = await state(page);
    check('hold Space serves at a capped rate', s1.run.stats.serves >= 10 && s1.run.stats.serves <= 17, `${s1.run.stats.serves} serves in 3s`);
    // Rapid clicking cannot exceed the cap
    const before = (await state(page)).run.stats.serves;
    const btn = page.locator('.serve');
    const t0 = Date.now();
    for (let i = 0; i < 60; i++) await btn.click({ delay: 0 });
    const elapsed = (Date.now() - t0) / 1000;
    const after = (await state(page)).run.stats.serves;
    check('mash-clicking is capped at 5 serves/s', after - before <= Math.ceil(elapsed * 5) + 2, `${after - before} serves in ${elapsed.toFixed(1)}s of clicking`);
    // Buy bushing levels via UI
    const cashBefore = (await state(page)).run.cash;
    await page.locator('.item', { hasText: 'Bushings' }).locator('button.primary').first().click();
    const s2 = await state(page);
    check('buying a product level spends cash and raises level', s2.run.products.bushings > 1 && s2.run.cash < cashBefore, `Lv ${s2.run.products.bushings}`);
    // Upgrades tab: hire staff when affordable
    await page.evaluate(() => ((window as any).__grip.state.run.cash += 100));
    await page.getByRole('button', { name: 'Shop Upgrades' }).click();
    await page.locator('.item', { hasText: 'Staff & Automation' }).locator('button.primary').click();
    const s3 = await state(page);
    check('hiring staff turns on passive income', s3.run.tracks.staff === 1);
    await page.screenshot({ path: `${OUT}/02-shop-upgrades.png` });
    // Reload preserves progress
    await page.waitForTimeout(800);
    await page.reload();
    await page.waitForSelector('.serve');
    const s4 = await state(page);
    check('reload keeps progress', s4.run.tracks.staff === 1 && s4.run.products.bushings === s3.run.products.bushings);
    // District view
    await navTo(page, 'District');
    await page.screenshot({ path: `${OUT}/03-district.png` });
    check('no console errors (fresh flow)', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ---------- 2. Saves at progression points: visit every location ----------
  const saves = ['run1-10min', 'run1-35min', 'L1', 'L2', 'L3', 'L4', 'L5'];
  for (const name of saves) {
    const errors: string[] = [];
    const json = readFileSync(`.verify/${name}.json`, 'utf8');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript(([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k, v);
        sessionStorage.setItem('seeded', '1');
      }
    }, [SAVE_KEY, json.replace(/"lastTick":\d+/, `"lastTick":${Date.now()}`)] as const);
    const page = await newPage(ctx, errors);
    await page.goto(BASE);
    await page.waitForSelector('.serve');
    const labels = await page.locator('nav.nav button').allInnerTexts();
    for (const raw of labels) {
      const label = raw.replace(/[^\w ]/g, '').trim();
      if (!label) continue;
      await page.locator('nav.nav button', { hasText: label }).first().click();
      await page.waitForTimeout(200);
      if (['Shop', 'Team', 'Spot', 'Venue', 'Brand', 'Park', 'Distro', 'Factory', 'HQ', 'Legacy', 'District'].includes(label) && (name === 'L5' || name === 'run1-35min' || label === 'Legacy'))
        await page.screenshot({ path: `${OUT}/${name}-${label}.png`, fullPage: false });
    }
    const s = await state(page);
    check(`${name}: loads (legacy ${s.meta.legacyCount}) and every nav location renders without errors`, errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ---------- 2b. Film a Line in the real page ----------
  {
    const errors: string[] = [];
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    await ctx.addInitScript(([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k, v);
        sessionStorage.setItem('seeded', '1');
      }
    }, [SAVE_KEY, readFileSync('.verify/run1-10min.json', 'utf8').replace(/"lastTick":\d+/, `"lastTick":${Date.now()}`)] as const);
    const page = await newPage(ctx, errors);
    await page.goto(BASE);
    await page.waitForSelector('.serve');
    await navTo(page, 'Spot');
    const s0 = await state(page);
    if (!s0.run.film) {
      await page.locator('.item', { hasText: 'Phone Clip' }).locator('button.primary').click().catch(() => {});
    }
    await page.getByRole('button', { name: /Film a Line/ }).first().click();
    await page.getByRole('button', { name: /Drop in/ }).click();
    await page.screenshot({ path: `${OUT}/line-play.png` });
    // In-page autopilot: dispatches real key events at the right moments.
    await page.addScriptTag({
      content: `(function(){
        var key = function(code){ window.dispatchEvent(new KeyboardEvent('keydown', { code: code, bubbles: true })); };
        var popped = new Set();
        function loop(){
          var l = window.__line;
          if (l && l.phase !== 'done') {
            if (l.phase === 'roll') {
              var o = l.obs.find(function(x){ return !x.done; });
              if (o && Math.abs(l.x - (o.x - 70)) < 12 && !popped.has(o)) { popped.add(o); key('KeyX'); }
            } else if (l.phase === 'air' && l.air && !l.air.landPressed && l.t >= l.air.start + l.air.dur - 0.02) key('Space');
            else if (l.phase === 'choice') key('KeyH');
          }
          requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);
      })();`,
    });
    const cashBefore = (await state(page)).run.cash;
    await page.waitForSelector('text=Film another line', { timeout: 60000 });
    await page.screenshot({ path: `${OUT}/line-result.png` });
    const s1 = await state(page);
    const grade = await page.locator('.modal .sticker').first().innerText();
    check('Film a Line: autopilot run completes with a good grade', ['S', 'A', 'B'].includes(grade.trim()), `grade ${grade}, best ${s1.meta.stats.bestLineScore}`);
    check('Film a Line: reward applied (cash up, footage added)', s1.run.cash > cashBefore && (s1.run.film ? s1.run.film.footage > 0 || s1.run.film.bestGrade > 0 : true));
    await page.waitForTimeout(1500);
    const s2 = await state(page);
    check('Film a Line: reward not applied twice on re-render', s2.meta.stats.minigameRuns === s1.meta.stats.minigameRuns);
    // Replay, no input → bails, still finishes with a result
    // Disable the autopilot by making __line unreadable to it.
    await page.addScriptTag({ content: "Object.defineProperty(window, '__line', { configurable: true, get: function(){ return null; }, set: function(){} });" });
    await page.getByRole('button', { name: 'Film another line' }).click();
    await page.waitForSelector('text=Film another line', { timeout: 90000 });
    const bailText = await page.locator('.modal').innerText();
    check('Film a Line: no-input run bails out and shows a result (replay works)', /bail/i.test(bailText));
    check('Film a Line: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ---------- 2c. Offline summary + invalid import ----------
  {
    const errors: string[] = [];
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const threeHoursAgo = Date.now() - 3 * 3600 * 1000;
    await ctx.addInitScript(([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k, v);
        sessionStorage.setItem('seeded', '1');
      }
    }, [SAVE_KEY, readFileSync('.verify/run1-35min.json', 'utf8').replace(/"lastTick":\d+/, `"lastTick":${threeHoursAgo}`)] as const);
    const page = await newPage(ctx, errors);
    await page.goto(BASE);
    await page.waitForSelector('text=While you were away', { timeout: 15000 });
    await page.screenshot({ path: `${OUT}/offline-summary.png` });
    const txt = await page.locator('.modal').innerText();
    check('offline: return summary shows time away and earnings', /3h/.test(txt) && /Earned/.test(txt), txt.split(String.fromCharCode(10)).slice(0, 3).join(' / '));
    await page.getByRole('button', { name: 'Back to the shop' }).click();
    const cash = (await state(page)).run.cash;
    await page.getByRole('button', { name: 'Settings and saves' }).click();
    await page.getByLabel('Save to import').fill('GRIPEMPIRE1:not-a-real-save');
    await page.getByRole('button', { name: 'Check save' }).click();
    const err = await page.locator('.modal .bad').first().innerText();
    const cash2 = (await state(page)).run.cash;
    check('import: invalid save is rejected with a message and the game is unchanged', /damaged|not/.test(err) && cash2 >= cash, err);
    await page.screenshot({ path: `${OUT}/settings.png` });
    // Background-tab throttling: a 2-minute gap between ticks is processed as normal online time.
    const r1 = await page.evaluate(() => {
      const g = (window as any).__grip;
      const before = g.state.run.stats.passiveEarned;
      const passive = g.derived().passive;
      g.state.lastTick -= 120_000;
      return { before, passive };
    });
    await page.waitForTimeout(400);
    const after1 = (await state(page)).run.stats.passiveEarned;
    const gained = after1 - r1.before;
    check('throttled tab: a 120s tick gap earns ~120s of automated income', gained > r1.passive * 110 && gained < r1.passive * 140 + 1e-9 + r1.passive * 5, `gained ${(gained / Math.max(1e-9, r1.passive)).toFixed(1)}s worth`);
    // Clock moved backwards: no negative time, no corruption.
    await page.evaluate(() => ((window as any).__grip.state.lastTick = Date.now() + 3_600_000));
    await page.waitForTimeout(400);
    const sBack = await state(page);
    check('clock moved backwards: state stays valid and keeps running', Number.isFinite(sBack.run.cash) && sBack.run.cash >= 0 && sBack.lastTick <= Date.now() + 1000);
    check('offline/import: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ---------- 3. Mobile layout ----------
  {
    const errors: string[] = [];
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await ctx.addInitScript(([k, v]) => {
      if (!sessionStorage.getItem('seeded')) {
        localStorage.setItem(k, v);
        sessionStorage.setItem('seeded', '1');
      }
    }, [SAVE_KEY, readFileSync('.verify/L2.json', 'utf8').replace(/"lastTick":\d+/, `"lastTick":${Date.now()}`)] as const);
    const page = await newPage(ctx, errors);
    await page.goto(BASE);
    await page.waitForSelector('.serve');
    await page.screenshot({ path: `${OUT}/m-shop.png` });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    check('mobile: no horizontal page scroll (shop)', overflow <= 1, `overflow ${overflow}px`);
    for (const label of ['Team', 'Spot', 'Venue', 'Brand', 'Park', 'Legacy']) {
      await page.locator('nav.nav button', { hasText: label }).first().click();
      await page.waitForTimeout(250);
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (ov > 1) check(`mobile: no horizontal scroll (${label})`, false, `${ov}px`);
      await page.screenshot({ path: `${OUT}/m-${label}.png` });
    }
    check('mobile: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  // ---------- 4. Multiple tabs ----------
  {
    const errors: string[] = [];
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
    const a = await newPage(ctx, errors);
    await a.goto(BASE);
    await a.waitForSelector('.serve');
    const b = await newPage(ctx, errors);
    await b.goto(BASE);
    await b.waitForTimeout(800);
    const blocked = await b.locator('.blocked').count();
    check('second tab is paused while the first is active', blocked === 1);
    await b.getByRole('button', { name: /Play in this tab/ }).click();
    await b.waitForTimeout(1500);
    const aBlocked = await a.locator('.blocked').count();
    const bBlocked = await b.locator('.blocked').count();
    check('taking over pauses the other tab', aBlocked === 1 && bBlocked === 0);
    check('multi-tab: no console errors', errors.length === 0, errors.slice(0, 3).join(' | '));
    await ctx.close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} browser checks passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
