const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync(require.resolve('../app.js'), 'utf8').replace(/\ninitApp\(\);\s*$/, '');
function app() {
  const elements = new Map();
  const storage = new Map();
  const context = vm.createContext({
    structuredClone, console, Date, AbortSignal, setInterval, clearInterval,
    localStorage: { getItem: k => storage.get(k), setItem: (k,v) => storage.set(k,v), removeItem: k => storage.delete(k) },
    document: {
      querySelectorAll: () => [], querySelector: () => null, addEventListener() {},
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, { value: '', textContent: '', innerHTML: '', dataset: {}, style: {},
          classList: { add() {}, remove() {}, toggle() {} }, addEventListener() {} });
        return elements.get(id);
      }
    },
    fetch: async () => { throw new Error('Unexpected network request in isolated test'); }
  });
  vm.runInContext(source, context);
  return { context, run: code => vm.runInContext(code, context) };
}
const hour = (hour24, extra = {}) => ({ dateStr: '2030-06-01', hour24, tempF: 60, rain: 0, precipMm: 0,
  windSpeedMph: 5, windSpeedLabel: '5 mph', shortForecast: 'Clear Sky', humidity: 60, ...extra });
function load(hours) {
  const a = app();
  a.context.hoursFixture = hours;
  a.run('weatherState.hours = hoursFixture; weatherState.loading = false; weatherState.alertStatus = "clear"');
  return a;
}

test('lookup requires exact date and hour; missing values are not zero', () => {
  const a = load([hour(6)]);
  assert.equal(a.run('getHourData(6,"2030-06-01").tempF'), 60);
  assert.equal(a.run('getHourData(6,"2030-06-02").tempF'), null);
  assert.equal(a.run('getHourData(7,"2030-06-01").rain'), null);
  assert.equal(a.run('formatPrecipIntensity(null, 0).label'), 'Amount unavailable');
});

test('run coverage includes boundary crossings and excludes exact finish hour', () => {
  const a = load([hour(6), hour(7, { shortForecast: 'Thunderstorm' })]);
  assert.equal(a.run('evaluateRunWindow(390,30,"2030-06-01").level'), 'clear');
  assert.equal(a.run('evaluateRunWindow(390,31,"2030-06-01").level'), 'danger');
  assert.equal(a.run('getRunWindow(390,31,"2030-06-01").length'), 2);
});

for (const [name, extra, level] of [
  ['heat', { tempF: 96 }, 'danger'], ['cold', { tempF: 8 }, 'danger'],
  ['rain chance', { rain: 70 }, 'danger'], ['rain amount', { precipMm: 6 }, 'danger'],
  ['wind', { windSpeedMph: 30 }, 'danger'], ['fog', { shortForecast: 'Foggy' }, 'caution'],
  ['freezing rain', { shortForecast: 'Freezing rain' }, 'danger']
]) test(`later-hour ${name} changes whole-run readiness`, () => {
  const a = load([hour(6), hour(7, extra)]);
  assert.equal(a.run('evaluateRunWindow(390,60,"2030-06-01").level'), level);
});

test('midnight and month rollover use the next date, including missing next-day coverage', () => {
  const a = load([hour(23), hour(0, { dateStr: '2030-06-02', rain: 80 })]);
  assert.equal(a.run('evaluateRunWindow(1410,60,"2030-06-01").level'), 'danger');
  assert.equal(a.run('dateAtOffset("2030-12-31", 1470)'), '2031-01-01');
  assert.equal(a.run('evaluateRunWindow(1410,60,"2030-06-02").complete'), false);
  assert.equal(a.run('deadlineMinutes(30, 1410)'), 1470);
});

test('missing hours or measurements never yield a good window', () => {
  const a = load([hour(6), hour(7, { rain: null, precipMm: null })]);
  assert.equal(a.run('evaluateRunWindow(390,60,"2030-06-01").badgeText'), 'Partial data');
  assert.equal(a.run('evaluateRunWindow(390,60,"2040-01-01").badgeText'), 'Unavailable');
});

test('known storms still warn when temperature is missing; WMO freezing rain is recognized', () => {
  const a = load([hour(6, { tempF: null, shortForecast: 'Thunderstorm' })]);
  assert.equal(a.run('evaluateRunWindow(360,30,"2030-06-01").level'), 'danger');
  assert.match(a.run('wmoCodeToText(66)'), /Freezing Rain/);
});

test('active, checking, failed and unsupported alerts prevent an unqualified good window', () => {
  const a = load([hour(6)]);
  for (const status of ['active', 'checking', 'failed', 'unsupported']) {
    a.context.alertFixture = status;
    assert.equal(a.run('weatherState.alertStatus = alertFixture; evaluateRunWindow(360,30,"2030-06-01").level'), 'caution');
  }
});

function omResponse(temp = 60) {
  return { ok: true, json: async () => ({ hourly: { time: ['2030-06-01T06:00'], temperature_2m: [temp] } }) };
}
test('Open-Meteo absent fields remain null and unsupported/malformed alerts stay unverified', async () => {
  const a = app();
  a.context.fetch = async url => url.includes('open-meteo') ? omResponse() : { ok: false, status: 404 };
  await a.run('fetchLiveWeatherForLocation(41,-87)');
  assert.equal(a.run('weatherState.alertStatus'), 'unsupported');
  assert.equal(a.run('weatherState.hours[0].rain'), null);
  assert.equal(a.run('weatherState.hours[0].humidity'), null);
  a.context.fetch = async url => url.includes('open-meteo') ? omResponse() : { ok: true, json: async () => ({}) };
  await a.run('fetchLiveWeatherForLocation(41,-87)');
  assert.equal(a.run('weatherState.alertStatus'), 'failed');
});

test('location fetches clear old data and late responses cannot overwrite the current location', async () => {
  const a = load([hour(6)]);
  let resolveOld;
  a.context.fetch = async url => {
    if (url.includes('weather.gov/alerts')) return { ok: true, json: async () => ({ features: [] }) };
    if (url.includes('latitude=10.0000')) return new Promise(resolve => { resolveOld = resolve; });
    return omResponse(75);
  };
  const old = a.run('fetchLiveWeatherForLocation(10,10)');
  assert.equal(a.run('weatherState.hours.length'), 0);
  await a.run('fetchLiveWeatherForLocation(20,20)');
  resolveOld(omResponse(30));
  await old;
  assert.match(a.run('weatherState.source'), /20\.0000, 20\.0000/);
  assert.equal(a.run('weatherState.hours[0].tempF'), 75);
});

test('NWS fallback preserves forecast timezone, maximum wind and unavailable precipitation amount', async () => {
  const a = app();
  a.context.fetch = async url => {
    if (url.includes('open-meteo')) return { ok: false };
    if (url.includes('/alerts')) return { ok: true, json: async () => ({ features: [] }) };
    if (url.includes('/points')) return { ok: true, json: async () => ({ properties: { forecastHourly: 'https://fixture/hourly' } }) };
    return { ok: true, json: async () => ({ properties: { periods: [{ startTime: '2030-06-02T00:00:00+09:00', temperature: 20,
      temperatureUnit: 'C', windSpeed: '15 to 30 mph', shortForecast: 'Rain', probabilityOfPrecipitation: { value: 70 } }] } }) };
  };
  await a.run('fetchLiveWeatherForLocation(41,-87)');
  assert.equal(a.run('weatherState.hours[0].dateStr'), '2030-06-02');
  assert.equal(a.run('weatherState.hours[0].hour24'), 0);
  assert.equal(a.run('weatherState.hours[0].windSpeedMph'), 30);
  assert.equal(a.run('weatherState.hours[0].tempF'), 68);
  assert.equal(a.run('weatherState.hours[0].precipMm'), null);
});

test('total failure leaves no stale forecast', async () => {
  const a = load([hour(6)]);
  a.context.fetch = async () => { throw new Error('offline'); };
  await a.run('fetchLiveWeatherForLocation(41,-87)');
  assert.equal(a.run('weatherState.hours.length'), 0);
  assert.equal(a.run('weatherState.alertStatus'), 'failed');
  assert.match(a.run('weatherState.source'), /unavailable/);
});
