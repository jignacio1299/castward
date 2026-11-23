const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

let server, browser, base;
before(async () => {
  server = http.createServer((req,res) => {
    const name = new URL(req.url, 'http://localhost').pathname;
    const files = { '/': 'index.html', '/app.js': 'app.js', '/style.css': 'style.css' };
    if (!files[name]) { res.writeHead(404).end(); return; }
    res.setHeader('Content-Type', name.endsWith('.js') ? 'application/javascript' : name.endsWith('.css') ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(path.join(__dirname, '..', files[name])));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ channel: process.env.CASTWARD_BROWSER || 'chrome', headless: true });
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

function fixture() {
  const hourly = Object.fromEntries(['time','temperature_2m','relative_humidity_2m','precipitation_probability',
    'precipitation','weather_code','wind_speed_10m','wind_direction_10m'].map(k => [k,[]]));
  for (let i=0; i<72; i++) {
    hourly.time.push(new Date(Date.UTC(2030,5,1,i)).toISOString().slice(0,16));
    hourly.temperature_2m.push(60); hourly.relative_humidity_2m.push(60);
    hourly.precipitation_probability.push(i === 7 ? 80 : 0); hourly.precipitation.push(i === 7 ? 6 : 0);
    hourly.weather_code.push(i === 7 ? 95 : 0); hourly.wind_speed_10m.push(5); hourly.wind_direction_10m.push(90);
  }
  return { hourly };
}
async function setup(viewport) {
  const context = await browser.newContext({ viewport, timezoneId: 'America/Los_Angeles' });
  const page = await context.newPage();
  page.setDefaultTimeout(5000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.route('https://api.open-meteo.com/**', r => r.fulfill({ json: fixture() }));
  await page.route('https://api.weather.gov/**', r => r.fulfill({ json: { features: [] } }));
  await page.goto(base);
  await page.waitForFunction(() => !weatherState.loading);
  await plan(page, '06:30', '30');
  return { context, page, errors };
}
async function plan(page, start, duration, date = '2030-06-01', homeBy = '') {
  await page.evaluate(() => showScreen('screen-plan'));
  await page.locator('#run-date-input').fill(date);
  await page.locator('#start-time-input').fill(start);
  await page.locator('#duration-input').fill(duration);
  await page.locator('#home-by-input').fill(homeBy);
}
const text = (page, id) => page.locator(`#${id}`).textContent();

for (const viewport of [{ width:1280, height:900 }, { width:375, height:812 }]) {
  test(`study journeys and overflow at ${viewport.width}x${viewport.height}`, async () => {
    const { context, page, errors } = await setup(viewport);
    try {
      await plan(page, '06:30', '60', '2030-06-01', '07:15');
      assert.equal(await text(page,'expected-finish'), '7:30 a.m.');
      assert.match(await text(page,'late-return-text'), /15 minutes/);
      assert.match(await text(page,'window-status-title'), /Reconsider/);
      assert.match(await text(page,'window-status-desc'), /80%/);
      await page.getByRole('button', { name:'See conditions', exact:true }).click();
      await page.locator('#window-primary-btn').click();
      assert.equal(await page.locator('#screen-plan').isVisible(), true);
      await page.getByRole('button', { name:'See conditions', exact:true }).click();
      await page.locator('#window-secondary-btn').click();
      assert.equal(await page.locator('#screen-compare').isVisible(), true);
      assert.match(await text(page,'compare-slot1-desc'), /80%/);
      await page.locator('#btn-use-slot2').click();
      assert.equal(await page.locator('#start-time-input').inputValue(), '07:30');
      await plan(page, '23:30','60','2030-06-01','00:45');
      assert.match(await text(page,'expected-finish'), /12:30 a.m. \(next day\)/);
      assert.equal(await page.locator('#late-return-box').evaluate(el => el.classList.contains('hidden')), true);
      await page.evaluate(() => showScreen('screen-compare'));
      assert.match(await text(page,'compare-slot2-title'), /next day/);
      assert.match(await text(page,'compare-slot2-deadline'), /45 min after/);
      await page.locator('#btn-use-slot2').click();
      assert.equal(await page.locator('#run-date-input').inputValue(), '2030-06-02');
      assert.equal(await page.locator('#start-time-input').inputValue(), '00:30');

      await plan(page,'06:30','30');
      await page.evaluate(() => showScreen('screen-hourly'));
      assert.equal(await page.locator('.hour-card').count(),24);
      assert.match(await page.locator('.hour-card').first().textContent(),/60°F/);
      await page.evaluate(() => showScreen('screen-clothing'));
      await page.locator('[data-activity="running"]').click();
      await page.locator('[data-pref="cooler"]').click();
      const cool = await text(page,'gear-base-title');
      await page.locator('[data-pref="warmer"]').click();
      assert.notEqual(await text(page,'gear-base-title'), cool);
      await page.locator('[data-pref="usual"]').click();
      await page.locator('[data-activity="run-walk"]').click();
      assert.match(await text(page,'clothing-reason-text'),/walking intervals/);
      await page.locator('#gear-base').uncheck();
      await page.locator('#gear-shell').check();
      await page.locator('#btn-save-clothing').click();
      assert.match(await text(page,'saved-gear-list'),/Water\/wind-resistant/);
      assert.doesNotMatch(await text(page,'saved-gear-list'),/Breathable short-sleeve/);
      await page.locator('#annotation-tags .tag-pill').last().click();
      const tag = await page.locator('#annotation-tags .active').getAttribute('data-tag');
      await page.locator('#session-note-input').fill('Automated regression note - not a study record');
      await page.locator('#btn-add-annotation').click();
      await page.reload();
      await page.waitForFunction(() => !weatherState.loading);
      await page.locator('.nav-item[data-target="screen-saved"]').click();
      assert.match(await text(page,'annotations-history'),/Automated regression note/);
      assert.equal(await page.locator('#annotation-tags .active').getAttribute('data-tag'),tag);
      await page.locator('.delete-note-btn').click();
      await page.reload();
      await page.waitForFunction(() => !weatherState.loading);
      assert.match(await text(page,'annotations-history'),/No session notes/);
      assert.equal(await page.locator('#gear-shell').isChecked(),true);
      assert.equal(await page.locator('#gear-base').isChecked(),false);

      await plan(page,'06:30','30');
      await page.evaluate(() => showScreen('screen-indoor'));
      await page.locator('#btn-confirm-indoor').click();
      assert.match(await text(page,'saved-session-status'), /Indoor session/);
      await page.evaluate(() => showScreen('screen-plan'));
      await page.locator('#btn-save-session').click();
      assert.match(await text(page,'saved-session-summary'),/30 min/);
      await page.evaluate(() => showScreen('screen-plan'));
      await page.locator('#btn-start-run').click();
      assert.equal(await page.locator('#active-run-panel').isVisible(),true);
      await page.locator('#btn-finish-run').click();
      assert.equal(await text(page,'active-run-title'),'Run complete');

      await page.locator('.nav-item[data-target="screen-preferences"]').click();
      await page.locator('#unit-c').click();
      assert.equal(await text(page,'win-temp'),'16°C');
      await page.reload();
      await page.waitForFunction(() => !weatherState.loading);
      assert.equal(await page.locator('#unit-c').evaluate(el => el.classList.contains('active')),true);
      await page.evaluate(() => showScreen('screen-location'));
      await page.locator('#quick-locations [data-name="New York, NY"]').click();
      await page.waitForFunction(() => !weatherState.loading);
      assert.match(await text(page,'pref-weather-source'),/New York.*40\.7128, -74\.0060/);
      await page.locator('.nav-item[data-target="screen-preferences"]').click();
      await page.locator('#btn-clear-data').click();
      await page.waitForFunction(() => !weatherState.loading);
      assert.match(await text(page,'pref-weather-source'),/Chicago.*41\.8818, -87\.6232/);
      assert.equal(await page.locator('#unit-f').evaluate(el => el.classList.contains('active')),true);
      assert.equal(await page.locator('#active-run-panel').isVisible(),false);
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem(STORAGE_KEY)).location.name),'Chicago, IL');

      await plan(page,'06:30','30','2040-01-01');
      assert.equal(await text(page,'window-status-title'),'Forecast unavailable');
      assert.match(await text(page,'clothing-reason-text'),/unavailable/);
      assert.doesNotMatch(await text(page,'hourly-cards-grid'),/null%|0%|Dry/);
      for (const screen of await page.locator('.screen').evaluateAll(els => els.map(e=>e.id))) {
        await page.evaluate(id => showScreen(id),screen);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        assert.equal(overflow,false,`Overflow on ${screen}`);
      }
      fs.mkdirSync('test-results',{ recursive:true });
      await page.evaluate(() => showScreen('screen-preferences'));
      await page.screenshot({ path:`test-results/preferences-${viewport.width}.png`, fullPage:true, animations:'disabled' });
      assert.deepEqual(errors,[],'No page exceptions or console errors');
    } finally { await context.close(); }
  });
}
