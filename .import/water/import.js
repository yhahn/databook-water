// databook-water's importer: USGS's Water Data API, as fetched by
// .import/fetch.js into ~/.cache/proper/water/raw/, written as pages.
//
//   node .import/water/import.js          (checks the source's shape first, V1)
//
// The grain (K5): a site is a USGS monitoring location in New York, keyed
// as USGS keys it (USGS-<number>, the number a string, leading zeros kept,
// K2); it is in the book when USGS keeps daily means of its discharge
// (00060) or gage height (00065), or annual peaks of either. A day is one
// daily mean of the site's main series of each (its longest; any other
// series of the same parameter is a table of its own, never merged). A peak
// is a row of USGS's annual peaks: a discharge peak and a gage-height peak
// on the same date and time are one row. A field measurement is one
// reading (a visit gives several: discharge, mean gage height, a reference
// gage reading). Every value, code and time is written as USGS writes it.
//
// Pages (SPEC B7): New York.md lists the counties; New York/<County>.md the
// county's sites; New York/<County>/<Site>.md a site, its years, peaks and
// field measurements; New York/<County>/<Site>/<water year>.md its days.
// Changes.md: the changes USGS marks (D5).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const RAW = process.env.WATER_RAW || path.join(os.homedir(), '.cache/proper/water/raw');
const REPO = path.join(__dirname, '..', '..');
const TYPES = ['ST', 'ST-TS', 'ST-CA', 'ST-DCH', 'LK', 'ES'];
const PARAMS = { '00060': 'Discharge', '00065': 'Gage height' };
const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const STATE = 'New York';

class ShapeError extends Error {}

// ---------------------------------------------------------------- reading

// What USGS's codes mean. USGS's API gives no description of them
// (qualifierDescription "not currently available", its migration guide);
// these are from their names and USGS's older code tables. A code not here
// stops the import (V1): a new code may be a new meaning.
const CODES = {
  APPROVED: 'approved: reviewed and final',
  BACKWATER: 'affected by backwater',
  BLWMIN: 'below the minimum the gauge records',
  DAMFAILURE: 'a dam failed',
  DATUMCHANGE: 'the gauge\'s datum changed this year',
  DAYUNKNOWN: 'day not known',
  DIFFDATUM: 'gage height at another site or datum than now',
  DISCONTINUED: 'the series discontinued',
  EQUIP: 'equipment malfunction',
  ESTIMATED: 'estimated',
  EVENT: 'a peak from an event: snowmelt, a hurricane, an ice jam or a debris dam breaking',
  FORCEINTERPOLATION: 'interpolated across a gap',
  GHNOTASSCPKQ: 'gage height not at the peak discharge',
  GREATERTHAN: 'greater than the value given',
  HISTORIC: 'a historic peak, outside the gauged years',
  ICE: 'affected by ice',
  LESSTHAN: 'less than the value given',
  MAINT: 'the gauge under maintenance',
  MAXDAILYMEAN: 'the peak is the highest daily mean, not the instant',
  MONTHUNKNOWN: 'month not known',
  NOTMAXGH: 'not the year\'s highest gage height',
  OPPORTUNISTIC: 'measured by chance, not by the gauge\'s routine',
  OTHERAGENCY: 'given by another agency',
  REGULATED: 'affected by regulation or diversion',
  REVISED: 'revised after it was first published',
  UNKNOWNREGULATION: 'affected to an unknown degree by regulation or diversion',
  URBAN: 'affected by urbanization, mining, farming or channel changes',
  YEARUNKNOWN: 'year not known',
};

const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));

// Everything the importer reads, from the raw folder. Daily series are read
// one site at a time (dailyOf), as the whole is millions of rows.
function load(raw = RAW) {
  const locations = [];
  for (const t of TYPES) for (const l of withPlace(readJSON(path.join(raw, `loc-${t}.json`)).features)) locations.push(l);
  const series = [];
  for (const p of Object.keys(PARAMS)) for (const f of readJSON(path.join(raw, `tsm-${p}.json`)).features) series.push(f.properties);
  const peaks = [];
  const field = [];
  for (const p of Object.keys(PARAMS)) {
    for (const f of readJSON(path.join(raw, `peaks-${p}.json`)).features) peaks.push(f.properties);
    for (const f of readJSON(path.join(raw, `field-${p}.json`)).features) field.push(f.properties);
  }
  const files = fs.readdirSync(path.join(raw, 'daily'));
  const dailyFile = id => { const f = files.find(n => n.endsWith(`-${id}.json`)); return f && path.join(raw, 'daily', f); };
  const dailyOf = id => { const f = dailyFile(id); return f ? readJSON(f).features.map(x => x.properties) : null; };
  return { locations, series, peaks, field, dailyOf, dailyFiles: files.length };
}

// V1: the source's shape, checked before anything is written.
function checkShape(input, shape) {
  const bad = why => { throw new ShapeError(`the source is not as last read: ${why}`); };
  const keysOf = (rows, want, what) => {
    const seen = new Set();
    for (const r of rows) for (const k of Object.keys(r)) seen.add(k);
    const gone = want.filter(k => !seen.has(k));
    const added = [...seen].filter(k => !want.includes(k));
    if (gone.length) bad(`${what}: gone: ${gone.join(', ')}`);
    if (added.length) bad(`${what}: new: ${added.join(', ')}`);
  };
  keysOf(input.locations, shape.keys.locations, 'monitoring locations');
  keysOf(input.peaks, shape.keys.peaks, 'peaks');
  keysOf(input.field, shape.keys.field, 'field measurements');
  for (const l of input.locations) {
    if (!/^USGS-\d{8,15}$/.test(l.id) || l.id !== `USGS-${l.monitoring_location_number}`) bad(`a site keyed otherwise: ${l.id}`);
    if (l.state_name !== STATE) bad(`a site not in ${STATE}: ${l.id}`);
  }
  if (new Set(input.locations.map(l => l.id)).size !== input.locations.length) bad('a site listed twice');
  const codes = rows => rows.flatMap(r => r.qualifier || []);
  const unknown = [...new Set([...codes(input.peaks), ...codes(input.field)])].filter(c => !CODES[c] && !shape.fieldCodes.includes(c));
  if (unknown.length) bad(`codes not seen before: ${unknown.join(', ')}`);
  for (const r of input.field) if (!shape.readings.includes(r.reading_type)) bad(`a field reading not seen before: ${r.reading_type}`);
  for (const [what, rows] of [['locations', input.locations.length], ['peaks', input.peaks.length], ['field measurements', input.field.length]]) {
    const [lo, hi] = shape.rows[what];
    if (rows < lo || rows > hi) bad(`${rows} ${what}, not ${lo} to ${hi}`);
  }
}

// V1 for one daily series, as it is read.
function checkDaily(rows, id, shape) {
  const bad = why => { throw new ShapeError(`daily series ${id}: ${why}`); };
  const seen = new Set();
  for (const r of rows) {
    const extra = Object.keys(r).filter(k => !shape.keys.daily.includes(k));
    if (extra.length) bad(`new: ${extra.join(', ')}`);
    if (!/^\d{4}-\d\d-\d\d$/.test(r.time)) bad(`a day written otherwise: ${r.time}`);
    if (seen.has(r.time)) bad(`${r.time} twice`);
    seen.add(r.time);
    if (r.value != null && !/^-?\d+(\.\d+)?$/.test(r.value)) bad(`a value not a number: ${r.value}`);
    if (!['Approved', 'Provisional'].includes(r.approval_status)) bad(`an approval not seen before: ${r.approval_status}`);
    for (const c of r.qualifier || []) if (!CODES[c]) bad(`a code not seen before: ${c}`);
  }
}

// ---------------------------------------------------------------- writing

const waterYear = day => Number(day.slice(0, 4)) + (Number(day.slice(5, 7)) >= 10 ? 1 : 0);
const cell = v => (v == null ? '' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '));
const row = cells => `| ${cells.map(cell).join(' | ')} |`;
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n');
const codes = q => (q && q.length ? q.join(', ') : '');
// Three significant figures, as USGS rounds its own statistics.
const sig = x => (x == null || !Number.isFinite(x) ? '' : String(Number(x.toPrecision(3))));
const safe = name => name.replace(/[\/\\]/g, '-').replace(/[:*?"<>|#]/g, '').replace(/\s+/g, ' ').trim().replace(/\.+$/, '');
const link = (text, to) => `[${text}](${to.split('/').map(p => encodeURIComponent(p).replace(/%2C/g, ',')).join('/')})`;
const plain = s => (s == null ? null : String(s).replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim());
const num = v => (v == null || v === '' ? null : Number(v));

function stats(values) {
  const v = values.filter(x => x != null);
  if (!v.length) return { mean: null, min: null, max: null };
  let s = 0, lo = Infinity, hi = -Infinity;
  for (const x of v) { s += x; if (x < lo) lo = x; if (x > hi) hi = x; }
  return { mean: s / v.length, min: lo, max: hi };
}

// A wide card by month (October first, as a water year runs): mean as the
// line, lowest and highest as its band.
function monthCard(title, label, byMonth) {
  const s = MONTHS.map((_, i) => stats(byMonth[i] || []));
  if (s.every(x => x.mean == null)) return null;
  return [
    `> [!CARD:line] ${title}`,
    ...table(['', 'stat', ...MONTHS], [
      [label, 'line', ...s.map(x => sig(x.mean))],
      [label, 'low', ...s.map(x => sig(x.min))],
      [label, 'high', ...s.map(x => sig(x.max))],
    ]).split('\n').map(l => `> ${l}`),
  ].join('\n');
}
const monthIndex = day => (Number(day.slice(5, 7)) + 2) % 12;

// The site's daily series: for each parameter, its main (the longest) and
// any others.
function seriesOfSite(all) {
  const out = {};
  for (const p of Object.keys(PARAMS)) {
    const s = all.filter(x => x.parameter_code === p).sort((a, b) => (Date.parse(b.end) - Date.parse(b.begin)) - (Date.parse(a.end) - Date.parse(a.begin)) || a.id.localeCompare(b.id));
    out[p] = { main: s[0] || null, others: s.slice(1) };
  }
  return out;
}

// One site: its page and its years' pages, and what was written.
// site: a location's properties; series: its daily-mean series' metadata;
// daily: { seriesId: rows }; peaks, field: its rows.
function buildSite(site, series, daily, peaks, field, at) {
  const pages = {};
  const name = site.monitoring_location_name;
  const S = seriesOfSite(series);
  const days = new Map(); // day -> { q, gh }
  const others = [];
  const counted = { days: 0, discharge: 0, gageHeight: 0, other: 0 };
  for (const p of Object.keys(PARAMS)) {
    const main = S[p].main;
    if (main) for (const r of daily[main.id] || []) {
      const d = days.get(r.time) || {};
      d[p] = r;
      days.set(r.time, d);
    }
    for (const o of S[p].others) for (const r of daily[o.id] || []) others.push({ p, s: o, r });
  }
  const dayList = [...days.keys()].sort();
  const years = new Map();
  for (const d of dayList) { const y = waterYear(d); if (!years.has(y)) years.set(y, []); years.get(y).push(d); }
  const otherYears = new Map();
  for (const o of others) { const y = waterYear(o.r.time); if (!otherYears.has(y)) otherYears.set(y, []); otherYears.get(y).push(o); }
  for (const y of otherYears.keys()) if (!years.has(y)) years.set(y, []);

  const sitePath = `${at}/${safe(name)}`;
  const yearRows = [];
  const allByMonth = { '00060': [], '00065': [] };
  for (const y of [...years.keys()].sort((a, b) => a - b)) {
    const list = years.get(y);
    const rows = [];
    const byMonth = { '00060': [], '00065': [] };
    const tally = {};
    let provisional = 0;
    const n = { '00060': 0, '00065': 0 };
    for (const d of list) {
      const x = days.get(d);
      const q = x['00060'], g = x['00065'];
      rows.push([d, q?.value, q?.approval_status, codes(q?.qualifier), g?.value, g?.approval_status, codes(g?.qualifier)]);
      for (const [p, r] of [['00060', q], ['00065', g]]) {
        if (!r) continue;
        n[p]++;
        if (r.approval_status === 'Provisional') provisional++;
        for (const c of r.qualifier || []) tally[c] = (tally[c] || 0) + 1;
        const v = num(r.value);
        if (v != null) { (byMonth[p][monthIndex(d)] ||= []).push(v); }
      }
    }
    for (const p of Object.keys(byMonth)) byMonth[p].forEach((v, i) => { if (v) { const m = stats(v); if (m.mean != null) (allByMonth[p][i] ||= []).push(m.mean); } });
    counted.days += rows.length;
    counted.discharge += n['00060'];
    counted.gageHeight += n['00065'];
    const qs = stats(list.map(d => num(days.get(d)['00060']?.value)));
    const gs = stats(list.map(d => num(days.get(d)['00065']?.value)));
    const tallyWords = Object.entries(tally).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, k]) => `${c} ${k}`).join(', ');
    yearRows.push([link(String(y), `./${safe(name)}/${y}.md`), rows.length, sig(qs.mean), sig(qs.min), sig(qs.max), sig(gs.mean), sig(gs.min), sig(gs.max), provisional, tallyWords]);

    const oy = (otherYears.get(y) || []).sort((a, b) => a.r.time.localeCompare(b.r.time) || a.s.id.localeCompare(b.s.id));
    counted.other += oy.length;
    const page = [
      `# Water Year: ${name}, ${y}`,
      '',
      `- Site ID: ${site.id}`,
      `- Site: ${link(name, `../${safe(name)}.md`)}`,
      `- Water year: ${y}`,
      `- From: ${list[0] || ''}`,
      `- To: ${list[list.length - 1] || ''}`,
      `- Days: ${rows.length}`,
      `- Discharge days: ${n['00060']}`,
      `- Gage height days: ${n['00065']}`,
      `- Provisional: ${provisional}`,
      '',
      `${name} (${site.id}), water year ${y} (${y - 1}-10-01 to ${y}-09-30): a row a day, the day's mean discharge in cubic feet a second and mean gage height in feet, each Approved or Provisional, and its codes, as USGS gives them. A provisional value may be revised. The card is the months, the line their mean of the daily means, the band their lowest and highest day.`,
    ];
    const qc = monthCard(`${name}, discharge, water year ${y}, ft³/s`, 'Discharge', byMonth['00060']);
    if (qc) page.push('', '## Discharge by month', '', qc);
    const gc = monthCard(`${name}, gage height, water year ${y}, ft`, 'Gage height', byMonth['00065']);
    if (gc) page.push('', '## Gage height by month', '', gc);
    page.push('', '## Days', '', table(['Day', 'Discharge', 'Discharge approval', 'Discharge codes', 'Gage height', 'Gage height approval', 'Gage height codes'], rows));
    if (oy.length) {
      page.push('', '## Other series', '', `Another daily series of the same measure at this site, kept apart and never merged with the main one: ${[...new Set(oy.map(o => `${o.s.id} (${o.s.web_description || PARAMS[o.p]})`))].join('; ')}.`, '',
        table(['Day', 'Parameter', 'Series', 'Description', 'Value', 'Approval', 'Codes'], oy.map(o => [o.r.time, o.p, o.s.id, o.s.web_description, o.r.value, o.r.approval_status, codes(o.r.qualifier)])));
    }
    pages[`${sitePath}/${y}.md`] = page.join('\n') + '\n';
  }

  // Peaks: a discharge peak and a gage-height peak at the same moment, one row.
  const pk = new Map();
  for (const r of peaks) {
    const k = `${r.water_year}|${r.time}|${r.time_of_day || ''}`;
    const e = pk.get(k) || { wy: r.water_year, time: r.time, tod: r.time_of_day };
    if (e[r.parameter_code]) { // a second at the same moment: a row of its own
      pk.set(`${k}|${r.id || pk.size}`, { wy: r.water_year, time: r.time, tod: r.time_of_day, [r.parameter_code]: r });
      continue;
    }
    e[r.parameter_code] = r;
    pk.set(k, e);
  }
  const peakRows = [...pk.values()].sort((a, b) => a.wy - b.wy || a.time.localeCompare(b.time) || (a.tod || '').localeCompare(b.tod || ''))
    .map(e => [e.wy, e.time, e.tod, e['00060']?.value, codes(e['00060']?.qualifier), e['00060']?.peak_since ?? e['00065']?.peak_since, e['00065']?.value, codes(e['00065']?.qualifier)]);

  const fieldRows = [...field].sort((a, b) => a.time.localeCompare(b.time) || (a.time_of_day || '').localeCompare(b.time_of_day || '') || a.reading_type.localeCompare(b.reading_type) || String(a.id || '').localeCompare(String(b.id || '')))
    .map(r => [r.time, r.time_of_day, r.reading_type, r.value, r.unit_of_measure, r.observing_procedure, r.control_condition, r.measurement_rated, r.approval_status, codes(r.qualifier), r.measuring_agency, r.field_visit_id]);

  const q = S['00060'].main, g = S['00065'].main;
  const first = dayList[0] || '', last = dayList[dayList.length - 1] || '';
  const peakYears = peakRows.map(r => r[0]);
  const summary = {
    id: site.id, number: site.monitoring_location_number, name, page: `${safe(name)}.md`, type: site.site_type,
    drainage: site.drainage_area, first, last, days: counted.days, peaks: peakRows.length, field: fieldRows.length,
  };
  const page = [
    `# Site: ${name}`,
    '',
    `- Site ID: ${site.id}`,
    `- Number: ${site.monitoring_location_number}`,
    `- Agency: ${site.agency_code}`,
    `- Type: ${site.site_type}`,
    `- County: ${site.county_name || ''}`,
    `- County code: ${site.county_code || ''}`,
    `- State: ${site.state_name}`,
    `- HUC: ${site.hydrologic_unit_code || ''}`,
    `- Latitude: ${site.lat ?? ''}`,
    `- Longitude: ${site.lon ?? ''}`,
    `- Drainage area: ${site.drainage_area ?? ''}`,
    `- Contributing area: ${site.contributing_drainage_area ?? ''}`,
    `- Altitude: ${site.altitude ?? ''}`,
    `- Altitude datum: ${site.vertical_datum || ''}`,
    `- Time zone: ${site.time_zone_abbreviation || ''}`,
    `- Daily from: ${first}`,
    `- Daily to: ${last}`,
    `- Discharge days: ${counted.discharge}`,
    `- Gage height days: ${counted.gageHeight}`,
    `- Discharge series: ${q ? q.id : ''}`,
    `- Gage height series: ${g ? g.id : ''}`,
    `- Peaks: ${peakRows.length}`,
    `- Peaks from: ${peakYears.length ? Math.min(...peakYears) : ''}`,
    `- Peaks to: ${peakYears.length ? Math.max(...peakYears) : ''}`,
    `- Field measurements: ${fieldRows.length}`,
    `- Revisions: ${plain(site.revision_note) || ''}`,
    '',
    `${name}, USGS site ${site.monitoring_location_number} (${site.id}), ${site.site_type.toLowerCase()} in ${site.county_name || 'a county not given'}, New York${site.drainage_area != null ? `, draining ${site.drainage_area} square miles` : ''}. ${first ? `Daily means from ${first} to ${last}, a page a water year (October to September), linked below.` : 'No daily means: its peaks and measurements only.'} Discharge in cubic feet a second, gage height in feet above the gauge's datum. Its annual peaks are its floods; its field measurements are the visits that check the gauge. Revisions are USGS's own notes of the site's published history, as written.`,
  ];
  const ac = monthCard(`${name}, discharge by month, every year, ft³/s`, 'Discharge', allByMonth['00060']);
  if (ac) page.push('', '## Discharge by month', '', ac.replace('> [!CARD:line]', '> [!CARD:line]'), '', 'Each month\'s mean of its daily means, taken over every year: the line their mean, the band the driest and wettest of those months.');
  page.push('', '## Years', '', yearRows.length ? table(['Water year', 'Days', 'Discharge mean', 'Discharge min', 'Discharge max', 'Gage height mean', 'Gage height min', 'Gage height max', 'Provisional', 'Codes'], yearRows) : 'None.');
  page.push('', '## Peaks', '', peakRows.length ? table(['Water year', 'Date', 'Time', 'Discharge', 'Discharge codes', 'Peak since', 'Gage height', 'Gage height codes'], peakRows) : 'None.');
  page.push('', '## Field measurements', '', fieldRows.length ? table(['Date', 'Time', 'Reading', 'Value', 'Unit', 'Method', 'Control', 'Rated', 'Approval', 'Codes', 'Agency', 'Visit'], fieldRows) : 'None.');
  pages[`${sitePath}.md`] = page.join('\n') + '\n';
  const datum = peaks.filter(r => (r.qualifier || []).includes('DATUMCHANGE')).map(r => ({ wy: r.water_year, time: r.time, site }));
  counted.otherSeries = S['00060'].others.length + S['00065'].others.length;
  return { pages, summary, counted: { ...counted, peaks: peakRows.length, field: fieldRows.length, years: years.size }, datum };
}

// The listings: the state's page, each county's, and the changes.
function buildListings(sites, datum) {
  const pages = {};
  const counties = new Map();
  for (const s of sites) {
    const c = s.county || 'County not given';
    if (!counties.has(c)) counties.set(c, { name: c, code: s.countyCode || '', sites: [] });
    counties.get(c).sites.push(s);
  }
  const cs = [...counties.values()].sort((a, b) => a.name.localeCompare(b.name));
  pages[`${STATE}.md`] = [
    `# State: ${STATE}`, '',
    `- State code: 36`,
    `- Counties: ${cs.length}`,
    `- Sites: ${sites.length}`, '',
    `New York's streams as USGS gauges them: every site in New York with daily means of discharge or gage height, or annual peaks, by county, a page each.`, '',
    '## Counties', '',
    table(['County', 'County code', 'Sites', 'With daily', 'Daily to'], cs.map(c => [link(c.name, `./${STATE}/${safe(c.name)}.md`), c.code, c.sites.length, c.sites.filter(s => s.days).length, c.sites.map(s => s.last).sort().pop() || ''])),
  ].join('\n') + '\n';
  for (const c of cs) {
    const list = c.sites.sort((a, b) => a.name.localeCompare(b.name));
    pages[`${STATE}/${safe(c.name)}.md`] = [
      `# County: ${c.name}`, '',
      `- County code: ${c.code}`,
      `- State: ${STATE}`,
      `- Sites: ${list.length}`, '',
      `The USGS sites of ${c.name}, New York, with daily means or annual peaks, a page each.`, '',
      '## Sites', '',
      table(['Site', 'Site ID', 'Number', 'Type', 'Drainage area', 'Daily from', 'Daily to', 'Days', 'Peaks', 'Field measurements'],
        list.map(s => [link(s.name, `./${safe(c.name)}/${s.page}`), s.id, s.number, s.type, s.drainage, s.first, s.last, s.days, s.peaks, s.field])),
    ].join('\n') + '\n';
  }
  // D5: a change made to many places in one year is one record.
  const byYear = new Map();
  for (const d of datum) { if (!byYear.has(d.wy)) byYear.set(d.wy, []); byYear.get(d.wy).push(d); }
  const changes = [...byYear.keys()].sort((a, b) => a - b).map(y => {
    const list = byYear.get(y).sort((a, b) => a.site.id.localeCompare(b.site.id));
    return [
      `### Change: gage datum, ${y}`, '',
      `- What: gage datum`,
      `- Year: ${y}`,
      `- Boundary: water year ${y}`,
      `- Was: gage height above the datum before`,
      `- Now: gage height above the new datum`,
      `- Crosswalk: none`,
      `- Places: ${list.length}`,
      `- Source: USGS annual peaks, gage height coded DATUMCHANGE`, '',
      `The gauge's zero moved during water year ${y} at ${list.length === 1 ? 'this site' : `these ${list.length} sites`}: gage heights before and after are measured from different datums, and USGS gives no offset between them here (its site notes, under Revisions on a site's page, sometimes do). Discharge is not affected. Nothing is split or adjusted (D4, D6): the peak is marked, as USGS marks it.`, '',
      '#### Places', '',
      table(['Site', 'Site ID', 'Peak date'], list.map(d => [d.site.monitoring_location_name, d.site.id, d.time])),
    ].join('\n');
  });
  pages['Changes.md'] = [
    '# Changes', '',
    'What USGS marks as changed in what its numbers mean, a record a year (SPEC D5). Its codes on each value mark the rest: approval (Provisional, later Approved and perhaps revised), ice, equipment, estimates, backwater, regulation; they are written beside the value, never split (D8).', '',
    ...(changes.length ? changes.flatMap(c => [c, '']) : ['None.', '']),
  ].join('\n');
  return pages;
}

// The whole book from an input held in memory (the vectors): { locations,
// series, peaks, field, daily: { id: rows } }.
function build(input, shape) {
  const run = assemble(input, id => input.daily[id] || null, shape);
  return run;
}

// The sites in the book, and each built.
function assemble(input, dailyOf, shape, onSite) {
  const loc = new Map(input.locations.map(l => [l.id, l]));
  const series = new Map();
  for (const s of input.series) {
    if (!loc.has(s.monitoring_location_id) || s.computation_period_identifier !== 'Daily' || s.computation_identifier !== 'Mean' || !PARAMS[s.parameter_code]) continue;
    if (!series.has(s.monitoring_location_id)) series.set(s.monitoring_location_id, []);
    series.get(s.monitoring_location_id).push(s);
  }
  const by = (rows, k) => { const m = new Map(); for (const r of rows) { if (!m.has(r[k])) m.set(r[k], []); m.get(r[k]).push(r); } return m; };
  const peaks = by(input.peaks, 'monitoring_location_id');
  const field = by(input.field, 'monitoring_location_id');
  const ids = [...new Set([...series.keys(), ...[...peaks.keys()].filter(id => loc.has(id))])].sort();
  const inBook = new Set(ids);
  const left = {
    peaksNoSite: input.peaks.filter(r => !loc.has(r.monitoring_location_id)).length,
    fieldNotInBook: input.field.filter(r => !inBook.has(r.monitoring_location_id)).length,
  };
  const pages = {};
  const sites = [];
  const datum = [];
  const counts = { dailyRead: 0, peaksQ: 0, peaksGH: 0, sites: 0, days: 0, discharge: 0, gageHeight: 0, other: 0, otherSeries: 0, peaks: 0, peakRows: 0, field: 0, years: 0, series: 0 };
  // Pages named alike in a county take the site's number (B7).
  const names = new Map();
  for (const id of ids) { const l = loc.get(id); const k = `${l.county_name}|${safe(l.monitoring_location_name).toLowerCase()}`; names.set(k, (names.get(k) || 0) + 1); }
  for (const id of ids) {
    const l0 = loc.get(id);
    const k = `${l0.county_name}|${safe(l0.monitoring_location_name).toLowerCase()}`;
    const l = names.get(k) > 1 ? { ...l0, monitoring_location_name: `${l0.monitoring_location_name} ${l0.monitoring_location_number}` } : l0;
    const ss = series.get(id) || [];
    const daily = {};
    for (const s of ss) {
      const rows = dailyOf(s.id);
      if (rows == null) throw new ShapeError(`daily series ${s.id} of ${id} not fetched: run .import/fetch.js`);
      if (shape) checkDaily(rows, s.id, shape);
      daily[s.id] = rows;
      counts.series++;
      counts.dailyRead += rows.length;
    }
    const at = `${STATE}/${safe(l.county_name || 'County not given')}`;
    const r = buildSite(l, ss, daily, peaks.get(id) || [], field.get(id) || [], at);
    if (onSite) onSite(r.pages); else Object.assign(pages, r.pages);
    sites.push({ ...r.summary, county: l.county_name, countyCode: l.county_code });
    for (const d of r.datum) datum.push(d);
    counts.sites++;
    counts.days += r.counted.days;
    counts.discharge += r.counted.discharge;
    counts.gageHeight += r.counted.gageHeight;
    counts.other += r.counted.other;
    counts.otherSeries += r.counted.otherSeries;
    counts.peakRows += r.counted.peaks;
    counts.peaks += (peaks.get(id) || []).length;
    for (const r of peaks.get(id) || []) if (r.parameter_code === '00060') counts.peaksQ++; else counts.peaksGH++;
    counts.field += r.counted.field;
    counts.years += r.counted.years;
  }
  const listings = buildListings(sites, datum);
  if (onSite) onSite(listings); else Object.assign(pages, listings);
  counts.counties = new Set(sites.map(s => s.county || 'County not given')).size;
  counts.changes = new Set(datum.map(d => d.wy)).size;
  counts.datumSites = datum.length;
  counts.withDaily = sites.filter(s => s.days).length;
  counts.firstDay = sites.map(s => s.first).filter(Boolean).sort()[0] || '';
  return { pages, counts, left };
}

// Coordinates from the GeoJSON, put on the properties (the API gives them
// as geometry; the vectors carry them so).
function withPlace(features) {
  return features.map(f => ({ ...f.properties, lat: f.geometry ? f.geometry.coordinates[1] : null, lon: f.geometry ? f.geometry.coordinates[0] : null }));
}

function main() {
  const t0 = Date.now();
  const shape = readJSON(path.join(__dirname, 'shape.json'));
  const input = load();
  checkShape(input, shape);
  // The old pages go: a new release is the importer run again (B1).
  for (const p of [STATE, `${STATE}.md`, 'Changes.md']) fs.rmSync(path.join(REPO, p), { recursive: true, force: true });
  let written = 0, bytes = 0;
  const write = pages => {
    for (const [p, text] of Object.entries(pages)) {
      const f = path.join(REPO, p);
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, text);
      written++;
      bytes += Buffer.byteLength(text);
    }
  };
  const { counts, left } = assemble(input, input.dailyOf, shape, write);
  // What the source holds, to count against (V3).
  const fetched = { dailyFiles: input.dailyFiles, peaks: input.peaks.length, field: input.field.length, locations: input.locations.length };
  const newest = fs.readdirSync(RAW).map(f => fs.statSync(path.join(RAW, f)).mtimeMs).reduce((a, b) => Math.max(a, b), 0);
  const fetchedOn = new Date(newest).toISOString().slice(0, 10);
  const out = { ...counts, pages: written, bytes, left, fetched, fetchedOn };
  fs.writeFileSync(path.join(__dirname, 'counts.json'), JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out), `${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

module.exports = { load, build, assemble, buildSite, buildListings, checkShape, checkDaily, ShapeError, CODES, waterYear, safe, link, withPlace };
if (require.main === module) {
  try { main(); } catch (e) { if (e instanceof ShapeError) { console.error(e.message); process.exit(1); } throw e; }
}
