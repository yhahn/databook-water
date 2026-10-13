// Makes a vector (SPEC V2) from USGS's own rows: a few sites, each cut to a
// few days, peaks and field measurements chosen for what they show; the
// pages out written by the importer, then checked by eye against the
// source and frozen. Rerun only to make a new vector:
//
//   node .import/water/make-vectors.js <name> <rule> <about> <site> [<site> ...]

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { build, withPlace } = require('./import');

const RAW = path.join(os.homedir(), '.cache/proper/water/raw');
const [name, rule, about, ...sites] = process.argv.slice(2);
const read = f => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));
const want = new Set(sites);

const locations = [];
for (const t of ['ST', 'ST-TS', 'ST-CA', 'ST-DCH', 'LK', 'ES']) for (const l of withPlace(read(`loc-${t}.json`).features)) if (want.has(l.id)) locations.push(l);
const series = [];
for (const p of ['00060', '00065']) for (const f of read(`tsm-${p}.json`).features) {
  const x = f.properties;
  if (want.has(x.monitoring_location_id) && x.computation_period_identifier === 'Daily' && x.computation_identifier === 'Mean') { const { thresholds, ...rest } = x; series.push(rest); }
}
const daily = {};
const files = fs.readdirSync(path.join(RAW, 'daily'));
for (const s of series) {
  const f = files.find(n => n.endsWith(`-${s.id}.json`));
  const rows = read(`daily/${f}`).features.map(x => x.properties).sort((a, b) => a.time.localeCompare(b.time));
  const keep = new Set();
  // The turn of a water year, the first of each code, the first provisional days.
  const turn = rows.findIndex(r => r.time.endsWith('-09-29'));
  if (turn >= 0) for (let i = turn; i < turn + 4 && i < rows.length; i++) keep.add(i);
  const codes = new Set();
  rows.forEach((r, i) => { for (const c of r.qualifier || []) if (!codes.has(c)) { codes.add(c); keep.add(i); } });
  rows.forEach((r, i) => { if (r.value == null && keep.size < 40) keep.add(i); });
  const prov = rows.map((r, i) => [r, i]).filter(([r]) => r.approval_status === 'Provisional').slice(0, 2);
  for (const [, i] of prov) keep.add(i);
  daily[s.id] = [...keep].sort((a, b) => a - b).map(i => rows[i]);
}
const peaks = [];
for (const p of ['00060', '00065']) {
  const rows = read(`peaks-${p}.json`).features.map(f => f.properties).filter(r => want.has(r.monitoring_location_id)).sort((a, b) => a.time.localeCompare(b.time));
  const pick = new Set();
  rows.forEach((r, i) => { if ((r.qualifier || []).length && pick.size < 3) pick.add(i); });
  rows.forEach((r, i) => { if ((r.qualifier || []).includes('DATUMCHANGE')) pick.add(i); });
  if (rows.length) pick.add(rows.length - 1);
  for (const i of [...pick].sort((a, b) => a - b)) peaks.push(rows[i]);
}
// The gage-height peak on the same day as each discharge peak kept, so the
// merge of the two is shown.
for (const r of read('peaks-00065.json').features.map(f => f.properties)) {
  if (want.has(r.monitoring_location_id) && peaks.some(q => q.parameter_code === '00060' && q.monitoring_location_id === r.monitoring_location_id && q.time === r.time) && !peaks.includes(r)) peaks.push(r);
}
const field = [];
for (const p of ['00060', '00065']) {
  const rows = read(`field-${p}.json`).features.map(f => f.properties).filter(r => want.has(r.monitoring_location_id)).sort((a, b) => a.time.localeCompare(b.time));
  const types = new Set();
  rows.forEach(r => { if (!types.has(r.reading_type)) { types.add(r.reading_type); field.push(r); } });
}
const input = { locations, series, daily, peaks, field };
const { pages } = build(input);
const out = path.join(__dirname, 'vectors', `${name}.json`);
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ rule, about, input, output: pages }, null, 1) + '\n');
console.log(out, Object.keys(pages));
