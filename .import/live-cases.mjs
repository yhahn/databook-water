// Writes .source/cases/ from a real answer of latest-continuous, recorded in
// ~/.cache/proper/water/live/ (V2 for the live source): six of its readings,
// each as USGS gave it, cut from the ~800; the catch made by proper-sources'
// own interpreter (lib/api/run.js), checked by eye, then frozen. Rerun only
// to record a new answer:
//
//   node .import/live-cases.mjs ~/.cache/proper/water/live/latest-<when>.json

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const SRC = path.join(HERE, '..', '.source');
const PS = path.join(os.homedir(), 'Projects/proper-sources');
const { apiDriver } = await import(path.join(PS, 'lib/api/run.js'));
const { play } = await import(path.join(PS, 'lib/driver/play.js'));

const file = process.argv[2];
if (!file) { console.error('usage: node .import/live-cases.mjs <recorded answer>'); process.exit(2); }
const answer = JSON.parse(fs.readFileSync(file, 'utf8'));
const when = /latest-(\d{4})(\d\d)(\d\d)T(\d\d)(\d\d)/.exec(path.basename(file));
const now = `${when[1]}-${when[2]}-${when[3]}T${when[4]}:${when[5]}:00Z`;
const api = JSON.parse(fs.readFileSync(path.join(SRC, 'api.json'), 'utf8'));
const url = `${api.base}${api.list.path}?${api.list.query.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`;

// The readings kept, each for what it shows.
const F = answer.features;
const want = [
  ['a discharge, provisional, now', f => f.properties.parameter_code === '00060' && f.properties.approval_status === 'Provisional' && !f.properties.qualifier],
  ['a gage height, provisional, now', f => f.properties.parameter_code === '00065' && f.properties.approval_status === 'Provisional' && !f.properties.qualifier],
  ['a series discontinued, its last reading years old', f => (f.properties.qualifier || []).includes('DISCONTINUED')],
  ['an estimate, approved', f => (f.properties.qualifier || []).includes('ESTIMATED') && f.properties.approval_status === 'Approved'],
  ['a value withheld (null), the rating deviating', f => (f.properties.qualifier || []).includes('RATINGDEV')],
  ['a reading at 00:00 UTC, the day before in New York', f => /T0[0-3]:/.test(f.properties.time)],
];
const kept = want.map(([why, p]) => { const f = F.find(p); if (!f) throw new Error(`no reading for: ${why}`); return f; });
const body = { ...answer, features: kept, numberReturned: kept.length };

const write = async (name, kase) => {
  const { got } = await play(apiDriver(api), kase);
  const out = { ...kase, catch: got };
  fs.writeFileSync(path.join(SRC, 'cases', name), JSON.stringify(out, null, 2) + '\n');
  console.log(name, JSON.stringify(got).slice(0, 200));
};

fs.mkdirSync(path.join(SRC, 'cases'), { recursive: true });
await write('first.json', {
  about: `The first catch-up: USGS's real answer of ${now}, cut to six of its ${F.length} readings (${want.map(w => w[0]).join('; ')}). The device in New York (offset -240, daylight time), so a reading at 00:00 UTC is the day before. A value USGS withholds is null; its codes are a list of words as USGS writes them. Recorded, cut by .import/live-cases.mjs, checked by eye, frozen.`,
  given: { now, offset: -240, cursor: null, http: [{ url, body }] },
});
await write('later.json', {
  about: 'A later catch-up asks the same: latest-continuous has no "since" a host can say (its datetime takes an interval, A5 gives an instant), so each pass takes every series\' newest reading again and the key (site, parameter, start) keeps one row of each. The same real answer, cut to two.',
  given: { now: new Date(Date.parse(now) + 3600000).toISOString().replace(/\.\d+Z$/, 'Z'), offset: -240, cursor: now, http: [{ url, body: { ...body, features: kept.slice(0, 2), numberReturned: 2 } }] },
});
await write('limited.json', {
  about: 'Past the hourly limit (1,000 an hour for no key, by X-RateLimit-Limit): USGS answers 429, with a Retry-After of minutes, which A5 does not read. Failed, not denied: there is no key to paste, and a later pass goes on. The body as USGS gave it, 10-13.',
  given: { now, offset: -240, cursor: now, http: [{ url, status: 429, body: { error: { code: 'OVER_RATE_LIMIT', message: 'You have exceeded your rate limit. Make sure you provided your API key from https://api.waterdata.usgs.gov/signup/, then either try again later or contact us at https://waterdata.usgs.gov/questions-comments/?referrerUrl=https://api.waterdata.usgs.gov for assistance.' } } }] },
});
