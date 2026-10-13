// Fetches the source, as it stands today, into ~/.cache/proper/water/raw/:
// USGS's Water Data OGC API (api.waterdata.usgs.gov/ogcapi/v1), no key.
//
//   node .import/fetch.js            (what is missing; a file fetched is kept)
//   node .import/fetch.js --again    (everything, a new release)
//
// What: New York's surface-water monitoring locations (stream, canal,
// tidal stream, ditch, lake, estuary); the time-series metadata of
// discharge (00060) and gage height (00065) in New York's box; each New York
// series of daily means of either, whole; the annual peaks of both; the
// field measurements of both. Paged by the API's own next link (a cursor);
// at most 50,000 records a page (the API's limit). A 429 is waited out by
// its Retry-After and never gone round; all wait, and the run stops after forty.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const BASE = 'https://api.waterdata.usgs.gov/ogcapi/v1/collections';
const RAW = path.join(os.homedir(), '.cache/proper/water/raw');
const AGAIN = process.argv.includes('--again');
const TYPES = ['ST', 'ST-TS', 'ST-CA', 'ST-DCH', 'LK', 'ES'];
const BOX = '-79.8,40.45,-71.8,45.05'; // New York and a margin; sites outside are dropped by state
const NY = 'state_name=New%20York';
const PARAMS = ['00060', '00065'];
const WORKERS = 1;

const sleep = ms => new Promise(r => setTimeout(r, ms));
let refusals = 0;
let asks = 0;

// One pause for every worker: a 429's Retry-After is waited out by all,
// never gone round. Forty refusals and the run stops, saying so: a run without a key waits out the hourly limit, many times over.
let pausedUntil = 0;
async function get(url) {
  for (;;) {
    while (Date.now() < pausedUntil) await sleep(pausedUntil - Date.now());
    asks++;
    const r = await fetch(url, { headers: { 'User-Agent': 'databook-water (a personal databook)' } });
    if (r.status === 429) {
      if (++refusals > 40) throw new Error(`429 forty times; stopped. Last: ${url}`);
      const wait = Number(r.headers.get('retry-after') || 600);
      pausedUntil = Math.max(pausedUntil, Date.now() + wait * 1000 + 5000);
      console.error(`429 (limit ${r.headers.get('x-ratelimit-limit')}), all waiting ${wait}s as asked`);
      continue;
    }
    if (!r.ok) throw new Error(`${r.status} for ${url}: ${(await r.text()).slice(0, 300)}`);
    return r.json();
  }
}

// Every page of a query, by its next link, as one FeatureCollection.
async function all(url) {
  const features = [];
  let next = url;
  let pages = 0;
  while (next) {
    const p = await get(next);
    features.push(...p.features);
    pages++;
    const n = (p.links || []).find(l => l.rel === 'next');
    next = n && p.features.length ? n.href : null;
    if (next && !next.startsWith(BASE)) throw new Error(`a next link off the API: ${next}`);
  }
  return { type: 'FeatureCollection', fetched: new Date().toISOString(), url, pages, features };
}

async function save(name, url) {
  const file = path.join(RAW, name);
  if (!AGAIN && fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  const c = await all(url);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file + '.part', JSON.stringify(c));
  fs.renameSync(file + '.part', file);
  console.log(`${name}: ${c.features.length} in ${c.pages} page(s)`);
  return c;
}

async function main() {
  fs.mkdirSync(RAW, { recursive: true });
  const sites = new Set();
  for (const t of TYPES) {
    const c = await save(`loc-${t}.json`, `${BASE}/monitoring-locations/items?f=json&${NY}&site_type_code=${t}&limit=50000`);
    for (const f of c.features) sites.add(f.id);
  }
  const series = [];
  for (const p of PARAMS) {
    const c = await save(`tsm-${p}.json`, `${BASE}/time-series-metadata/items?f=json&parameter_code=${p}&bbox=${BOX}&limit=50000`);
    for (const f of c.features) {
      const x = f.properties;
      if (sites.has(x.monitoring_location_id) && x.computation_period_identifier === 'Daily' && x.computation_identifier === 'Mean') series.push(x);
    }
  }
  for (const p of PARAMS) {
    await save(`peaks-${p}.json`, `${BASE}/peaks/items?f=json&${NY}&parameter_code=${p}&limit=50000&skipGeometry=true`);
    await save(`field-${p}.json`, `${BASE}/field-measurements/items?f=json&${NY}&parameter_code=${p}&limit=50000&skipGeometry=true`);
  }
  // Each series of daily means, whole: one ask a series (most are one page).
  const props = 'time,value,approval_status,qualifier,last_modified,time_series_id,statistic_id';
  let i = 0;
  const work = async () => {
    while (i < series.length) {
      const x = series[i++];
      await save(`daily/${x.monitoring_location_id}-${x.parameter_code}-${x.id}.json`,
        `${BASE}/daily/items?f=json&time_series_id=${x.id}&limit=50000&skipGeometry=true&properties=${props}`);
    }
  };
  await Promise.all(Array.from({ length: WORKERS }, work));
  console.log(`done: ${series.length} daily series, ${asks} asks, ${refusals} refusals`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
