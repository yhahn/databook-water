#!/usr/bin/env node
// FAQ.md, the book's questions and their answers (SPEC B9). Reads the
// questions from .import/faq.md (written by hand, only added to), works out
// each answer from USGS's files as fetched, never from the book, and writes
// FAQ.md at the book's root: a record a question, its answer, and the pages
// where a reader finds it, each checked to exist.
//
//   node .import/faq.js        (reads every daily series once: about 4G)
//
// Reads ~/.cache/proper/water/raw/ (or $WATER_RAW): the monitoring
// locations, the annual peaks, the field measurements and every daily
// series, with readers of its own: nothing of the importer is borrowed, so
// where FAQ.md and a page disagree one of them is wrong. A question in
// faq.md with no answer here, or an answer here with no question, stops it.

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const REPO = path.dirname(__dirname);
const RAW = process.env.WATER_RAW || path.join(os.homedir(), '.cache/proper/water/raw');
const json = (f) => JSON.parse(fs.readFileSync(path.join(RAW, f), 'utf8'));

// --- the questions ---------------------------------------------------------------

const KEYS = ['Tier', 'Ask', 'Type', 'Tolerance', 'Rules', 'How', 'Look in'];

function parse(text) {
  return text.split(/\n(?=### Question: )/).slice(1).map((b) => {
    const id = /^### Question: (\S+)\s*$/m.exec(b)[1];
    const q = { id };
    for (const k of KEYS) {
      const m = new RegExp(`^- ${k}:[ \\t]*(.*)$`, 'm').exec(b);
      if (!m) throw new Error(`faq.md, ${id}: no ${k}`);
      q[k] = m[1].trim();
    }
    return q;
  });
}

// --- USGS's files ------------------------------------------------------------------

const once = (f) => { let v; return () => (v ??= f()); };

// Every monitoring location in New York of a surface-water kind, by id.
const TYPES = ['ST', 'ST-TS', 'ST-CA', 'ST-DCH', 'LK', 'ES'];
const locations = once(() => {
  const by = new Map();
  for (const t of TYPES) for (const f of json(`loc-${t}.json`).features) {
    by.set(f.properties.id, { ...f.properties, lat: f.geometry?.coordinates[1], lon: f.geometry?.coordinates[0] });
  }
  return by;
});
const site = (id) => { const l = locations().get(id); if (!l) throw new Error(`no location ${id}`); return l; };

const peaks = once(() => ['00060', '00065'].flatMap((p) => json(`peaks-${p}.json`).features.map((f) => f.properties)));
const field = once(() => json('field-00060.json').features.map((f) => f.properties));
const dailyFiles = once(() => fs.readdirSync(path.join(RAW, 'daily')));

// A site's daily means of a parameter: the series with the most days (a
// site with two series of one parameter keeps the other apart).
function daily(id, p = '00060') {
  const files = dailyFiles().filter((f) => f.startsWith(`${id}-${p}-`));
  if (!files.length) return null;
  const all = files.map((f) => json(path.join('daily', f)).features.map((x) => x.properties));
  return all.sort((a, b) => b.length - a.length)[0];
}

// The book's sites: a New York location with a daily series or a peak.
const inBook = once(() => {
  const ids = new Set([...dailyFiles().map((f) => f.split('-').slice(0, 2).join('-')), ...peaks().map((p) => p.monitoring_location_id)]);
  return [...locations().values()].filter((l) => ids.has(l.id));
});

const waterYear = (day) => Number(day.slice(0, 4)) + (Number(day.slice(5, 7)) >= 10 ? 1 : 0);
const num = (v) => (v == null || v === '' ? null : Number(v));
const sig3 = (x) => Number(x.toPrecision(3)); // as the book (and USGS) round a statistic
const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (x) => Math.round(x * 10) / 10;

// Every daily discharge series, read once: per site, its days counted,
// its first day, and each full water year's mean (every day of the year
// with a value).
const scan = once(() => {
  const out = new Map();
  for (const f of dailyFiles()) {
    const [ag, number, p] = f.split('-');
    const id = `${ag}-${number}`;
    const rows = json(path.join('daily', f)).features.map((x) => x.properties);
    const s = out.get(id) || { id, days: new Set(), first: null, discharge: null };
    for (const r of rows) { s.days.add(r.time); if (!s.first || r.time < s.first) s.first = r.time; }
    if (!rows.length) continue; // a series fetched with no days: no record
    if (p === '00060' && (!s.discharge || rows.length > s.discharge.n)) {
      const wy = new Map();
      for (const r of rows) { const v = num(r.value); if (v == null) continue; const y = waterYear(r.time); (wy.get(y) || wy.set(y, []).get(y)).push(v); }
      const full = new Map();
      for (const [y, v] of wy) {
        const len = (Date.parse(`${y}-10-01`) - Date.parse(`${y - 1}-10-01`)) / 86400000;
        if (v.length === len) full.set(y, v.reduce((a, b) => a + b, 0) / v.length);
      }
      s.discharge = { n: rows.length, full };
    }
    out.set(id, s);
  }
  return out;
});

const PRATTSVILLE = 'USGS-01350000';
const dayOf = (rows, day) => { const r = rows.find((x) => x.time === day); if (!r) throw new Error(`no day ${day}`); return r; };
const peaksOf = (id, p = '00060') => peaks().filter((r) => r.monitoring_location_id === id && r.parameter_code === p && r.value != null);
const miles = (a, b) => {
  const R = 3958.8, rad = Math.PI / 180;
  const dl = (b.lat - a.lat) * rad, dn = (b.lon - a.lon) * rad;
  const h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dn / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
};
const MONTHS = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];

// --- the answers -----------------------------------------------------------------
// Each: the answer as the bench grades it (answer), the same in words for
// FAQ.md (text), and how it was found in USGS's files (note). A Gap
// question's answer is null.

const ANSWERS = {
  // Lookup
  'wa-lookup-1': () => {
    const r = dayOf(daily(PRATTSVILLE), '2011-08-28');
    return { answer: num(r.value), note: `daily ${PRATTSVILLE} 00060, 2011-08-28: ${r.value} ft³/s, ${r.approval_status}${r.qualifier ? `, ${r.qualifier.join(', ')}` : ''} (the day Irene's rain reached the Catskills).` };
  },
  'wa-lookup-2': () => {
    const r = dayOf(daily('USGS-01362500'), '2023-12-18');
    return { answer: num(r.value), note: `daily USGS-01362500 00060, 2023-12-18: ${r.value} ft³/s, ${r.approval_status}.` };
  },
  'wa-lookup-3': () => {
    const top = peaksOf(PRATTSVILLE).sort((a, b) => num(b.value) - num(a.value))[0];
    return { answer: num(top.value), text: `${top.value} ft³/s, on ${top.time}`, note: `peaks-00060, ${PRATTSVILLE}, the greatest: ${top.time}, ${top.value}${top.qualifier ? ` (${top.qualifier.join(', ')})` : ''}.` };
  },
  'wa-lookup-4': () => {
    const l = site('USGS-01358000');
    return { answer: num(l.drainage_area), note: `loc-ST.json, USGS-01358000 ${l.monitoring_location_name}: drainage_area ${l.drainage_area} square miles.` };
  },

  // Page
  'wa-page-1': () => {
    const l = inBook().find((x) => x.monitoring_location_name === 'SAW MILL RIVER AT YONKERS NY');
    return { answer: [l.county_name], note: `loc-ST.json, ${l.id}: county_name ${l.county_name} (county_code ${l.county_code}).` };
  },
  'wa-page-2': () => {
    const rows = daily('USGS-04275500').filter((r) => waterYear(r.time) === 2020 && num(r.value) != null).map((r) => num(r.value));
    const m = rows.reduce((a, b) => a + b, 0) / rows.length;
    return { answer: sig3(m), note: `daily USGS-04275500 00060, water year 2020 (2019-10-01 to 2020-09-30): ${rows.length} days, mean ${Math.round(m * 1000) / 1000} ft³/s, to three figures ${sig3(m)}.` };
  },
  'wa-page-3': () => {
    const n = inBook().filter((l) => l.county_name === 'Greene County');
    return { answer: n.length, note: `Locations in Greene County with a daily series or an annual peak: ${n.length}.` };
  },

  // Across
  'wa-across-1': () => {
    const on = inBook().filter((l) => /^ESOPUS (CREEK|CR) /.test(l.monitoring_location_name)).sort((a, b) => num(a.drainage_area) - num(b.drainage_area));
    return { answer: on.map((l) => l.id), text: on.map((l) => `${l.monitoring_location_name} (${l.id})`).join('; '),
      note: `Locations named for Esopus Creek, from the source (smallest drainage first): ${on.map((l) => `${l.id} ${l.drainage_area} sq mi`).join(', ')}.` };
  },
  'wa-across-2': () => {
    const c = new Map();
    for (const s of scan().values()) { const cn = site(s.id).county_name; c.set(cn, (c.get(cn) || 0) + s.days.size); }
    const top = [...c].sort((a, b) => b[1] - a[1]);
    return { answer: [top[0][0]], text: `${top[0][0]}: ${top[0][1]} days, about ${Math.round(top[0][1] / 365.25)} years of daily record`,
      note: `Every daily series, the days with a daily mean (discharge or gage height) summed by the site's county: ${top.slice(0, 3).map(([k, v]) => `${k} ${v}`).join(', ')}.` };
  },
  'wa-across-3': () => {
    const all = [...scan().values()].filter((x) => x.first);
    const first = all.map((x) => x.first).sort()[0];
    const at = all.filter((x) => x.first === first).map((x) => x.id).sort();
    return { answer: at, text: `${at.map((id) => `${site(id).monitoring_location_name} (${id})`).join(' and ')}, both from ${first}`,
      note: `The earliest day of every daily series: ${first}, at ${at.length} sites (${at.map((id) => site(id).county_name).join(', ')}).` };
  },
  'wa-across-4': () => {
    const top = peaks().filter((r) => r.parameter_code === '00060' && r.value != null).sort((a, b) => num(b.value) - num(a.value))[0];
    const l = site(top.monitoring_location_id);
    return { answer: [top.monitoring_location_id, num(top.value)], text: `${l.monitoring_location_name} (${l.id}), ${top.value} ft³/s on ${top.time}, coded ${(top.qualifier || []).join(', ')}: the highest daily mean, given by another agency, on a regulated river`,
      note: `peaks-00060, the greatest of every site's: ${l.id}, ${top.time}, ${top.value}, ${(top.qualifier || []).join(', ')}.` };
  },

  // Join
  'wa-join-1': () => {
    const top = peaksOf(PRATTSVILLE).sort((a, b) => num(b.value) - num(a.value))[0];
    const d = dayOf(daily(PRATTSVILLE), top.time);
    return { answer: [num(top.value), num(d.value)], text: `${top.value} ft³/s at the peak on ${top.time}; ${d.value} ft³/s the day's mean`,
      note: `peaks-00060 and daily 00060, ${PRATTSVILLE}, ${top.time}.` };
  },
  'wa-join-2': () => {
    const id = 'USGS-01362500';
    const m = field().filter((r) => r.monitoring_location_id === id && r.reading_type === 'Discharge' && r.value != null).sort((a, b) => num(b.value) - num(a.value))[0];
    const d = daily(id).find((r) => r.time === m.time);
    return { answer: [num(m.value), m.time, d ? num(d.value) : null], text: `${m.value} ft³/s, on ${m.time} (${m.observing_procedure}); that day's mean ${d ? d.value : 'not given'} ft³/s`,
      note: `field-00060, ${id}, Discharge readings, the largest; the daily mean (daily 00060) of the same day beside it.` };
  },

  // Change
  'wa-change-1': () => {
    const id = 'USGS-01325000';
    const years = [...new Set(peaksOf(id, '00065').filter((r) => (r.qualifier || []).includes('DATUMCHANGE')).map((r) => r.water_year))].sort();
    return { answer: years, text: `water year${years.length > 1 ? 's' : ''} ${years.join(', ')}: gage heights before and after are from different datums, and cannot be compared without the offset, which the book does not give`,
      note: `peaks-00065, ${id}, gage height peaks coded DATUMCHANGE: ${years.join(', ')}.` };
  },
  'wa-change-2': () => {
    const rows = daily(PRATTSVILLE).filter((r) => waterYear(r.time) === 2026).sort((a, b) => a.time.localeCompare(b.time));
    const prov = rows.filter((r) => r.approval_status === 'Provisional');
    return { answer: prov.length, text: `${prov.length} of ${rows.length} days, ${prov[0]?.time} to ${prov[prov.length - 1]?.time}: provisional values, which USGS may yet revise`,
      note: `daily ${PRATTSVILLE} 00060, water year 2026, approval_status Provisional.` };
  },

  // Gap
  'wa-gap-1': () => {
    const first = daily(PRATTSVILLE).map((r) => r.time).sort()[0];
    if (first <= '1902-10-15') throw new Error('Prattsville has 1902-10-15: wa-gap-1 is not a Gap');
    return { answer: null, note: `daily ${PRATTSVILLE} 00060 begins ${first}.` };
  },
  'wa-gap-2': () => ({ answer: null, note: 'The book holds discharge (00060) and gage height (00065) only; USGS\'s water temperature (00010) was not fetched.' }),
  'wa-gap-3': () => ({ answer: null, note: 'The book holds daily means and annual peaks; the 15-minute record (USGS\'s continuous values) was not fetched.' }),
  'wa-gap-4': () => {
    if (locations().has('USGS-01463500')) throw new Error('USGS-01463500 among the locations: wa-gap-4 is not a Gap');
    return { answer: null, note: 'Every location fetched is in New York (state_code 36); the Delaware at Trenton (USGS-01463500) is in New Jersey.' };
  },

  // Nearby
  'wa-nearby-1': () => {
    const p = site(PRATTSVILLE);
    const near = inBook().filter((l) => l.id !== p.id && l.lat != null && scan().get(l.id)?.discharge).map((l) => ({ l, d: miles(p, l) })).sort((a, b) => a.d - b.d)[0];
    return { answer: [near.l.id], text: `${near.l.monitoring_location_name} (${near.l.id}), ${r1(near.d)} miles away`, note: `Every site with daily discharge, by distance from ${p.lat}, ${p.lon} (great circle): the nearest ${near.l.id} at ${near.l.lat}, ${near.l.lon}.` };
  },
  'wa-nearby-2': () => {
    const p = site(PRATTSVILLE);
    const next = inBook().filter((l) => /^SCHOHARIE CREEK /.test(l.monitoring_location_name) && num(l.drainage_area) > num(p.drainage_area)).sort((a, b) => num(a.drainage_area) - num(b.drainage_area))[0];
    return { answer: [next.id], text: `${next.monitoring_location_name} (${next.id}), draining ${next.drainage_area} square miles to Prattsville's ${p.drainage_area}`,
      note: `Locations named for Schoharie Creek, by drainage area: the least above Prattsville's (${p.drainage_area}).` };
  },

  // Analysis
  'wa-analysis-1': () => {
    const cnt = new Map(); let n = 0;
    for (const s of scan().values()) {
      const full = s.discharge?.full;
      if (!full || full.size < 30) continue;
      n++;
      const best = [...full].sort((a, b) => b[1] - a[1])[0][0];
      cnt.set(best, (cnt.get(best) || 0) + 1);
    }
    const top = [...cnt].sort((a, b) => b[1] - a[1]);
    return { answer: top[0][0], text: `water year ${top[0][0]}: the wettest year at ${top[0][1]} of ${n} gauges with thirty full years or more; next ${top[1][0]} (${top[1][1]}), ${top[2][0]} (${top[2][1]})`,
      note: `Every daily discharge series, each full water year's mean (every day with a value); for each site with thirty such years or more, the year of the highest; counted by year.` };
  },
  'wa-analysis-2': () => {
    const by = MONTHS.map(() => []);
    for (const r of daily(PRATTSVILLE)) { const v = num(r.value); if (v != null) by[(Number(r.time.slice(5, 7)) + 2) % 12].push(v); }
    const m = by.map((v) => median(v));
    return { answer: m, text: MONTHS.map((k, i) => `${k} ${m[i]}`).join(', '),
      note: `daily ${PRATTSVILLE} 00060, every day of the record by its month, the median (ft³/s). The site page's card gives the mean of each month's means, not the median: ${MONTHS.map((k, i) => `${k} ${sig3(by[i].reduce((a, b) => a + b, 0) / by[i].length)}`).join(', ')} as plain means of the days.` };
  },
  'wa-analysis-3': () => {
    const pk = peaksOf(PRATTSVILLE);
    const span = (a, b) => pk.filter((r) => r.water_year >= a && r.water_year <= b).map((r) => num(r.value));
    const x = span(1951, 1980), y = span(1996, 2025);
    return { answer: [median(x), median(y)], text: `median annual peak ${median(x)} ft³/s in water years 1951-1980 (${x.length} peaks), ${median(y)} in 1996-2025 (${y.length}): ${r1(100 * (median(y) / median(x) - 1))}%`,
      note: `peaks-00060, ${PRATTSVILLE}, by water year.` };
  },
};

function compute(ids) {
  const out = {};
  for (const id of ids) {
    if (!ANSWERS[id]) throw new Error(`${id}: a question with no answer in faq.js`);
    out[id] = ANSWERS[id]();
  }
  return out;
}

// --- FAQ.md -----------------------------------------------------------------------

const NOT_SAID = 'The book does not say.';

function words(q, a) {
  if (q.Type === 'none') {
    if (a.answer !== null) throw new Error(`${q.id}: a Gap question with an answer`);
    return NOT_SAID;
  }
  const t = a.text ?? (Array.isArray(a.answer) ? a.answer.join(', ') : String(a.answer ?? ''));
  if (!t.trim() || a.answer == null) throw new Error(`${q.id}: no answer`);
  return t;
}

const href = (p) => './' + p.split('/').map((s) => encodeURIComponent(s).replace(/%2C/g, ',')).join('/');

function lookIn(q) {
  const pages = q['Look in'].split(/;\s*/).filter(Boolean);
  if (!pages.length && q.Type !== 'none') throw new Error(`${q.id}: no Look in`);
  for (const p of pages) if (!fs.existsSync(path.join(REPO, p))) throw new Error(`${q.id}: Look in ${p}: no such page`);
  return pages.map((p) => `[${p.replace(/\.md$/, '')}](${href(p)})`).join(', ');
}

function record(q, a) {
  const key = (k, v) => (v === '' ? `- ${k}:` : `- ${k}: ${v}`);
  return [`### Question: ${q.id}`, '',
    key('Tier', q.Tier), key('Ask', q.Ask), key('Answer', words(q, a)), key('Type', q.Type),
    key('Tolerance', q.Tolerance), key('Look in', lookIn(q)), '', a.note, ''].join('\n');
}

function page(questions, answers) {
  const n = questions.length;
  return [`# Questions and answers`, '',
    `${n} questions a careful reader of this book can answer, a paddler's, an angler's or a town planner's, from the ` +
    'plainest (one river, one day) to the hardest (which year was wettest, and how floods have changed), each with ' +
    'its answer and the page to look in. Read a question, open the page, and find the answer yourself; or put the ' +
    'questions to a reader or an agent with this page hidden, and mark what comes back. Where the book cannot answer, ' +
    "the right answer is to say so. The answers are worked out afresh from USGS's own files at every release, not " +
    'copied from the pages: where the two disagree, one is wrong.', '',
    ...questions.map((q) => record(q, answers[q.id]))].join('\n');
}

function main() {
  const questions = parse(fs.readFileSync(path.join(__dirname, 'faq.md'), 'utf8'));
  const ids = questions.map((q) => q.id);
  if (new Set(ids).size !== ids.length) throw new Error('faq.md: an id given twice');
  const extra = Object.keys(ANSWERS).filter((k) => !ids.includes(k));
  if (extra.length) throw new Error(`faq.js: answers with no question in faq.md: ${extra}`);
  const answers = compute(ids);
  fs.writeFileSync(path.join(REPO, 'FAQ.md'), page(questions, answers));
  console.log(`FAQ.md: ${questions.length} questions, ${questions.filter((q) => q.Type === 'none').length} the book does not answer`);
}

module.exports = { parse, compute, record, words, NOT_SAID };
if (require.main === module) main();
