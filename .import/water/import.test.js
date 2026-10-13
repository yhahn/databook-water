// The importer's tests: every vector in vectors/ (V2, a few of USGS's rows
// in, the exact pages out), and the shape check (V1).
//
//   node --test .import/water/import.test.js

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { build, checkShape, checkDaily, ShapeError, waterYear, safe, link } = require('./import');

const dir = path.join(__dirname, 'vectors');
const vectors = fs.readdirSync(dir).filter(f => f.endsWith('.json')).sort();
test('there are vectors', () => assert.ok(vectors.length > 0));
for (const f of vectors) {
  const v = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  test(`${f} (${v.rule}): ${v.about.slice(0, 120)}…`, () => {
    const { pages } = build(v.input);
    assert.deepStrictEqual(Object.keys(pages).sort(), Object.keys(v.output).sort());
    for (const [k, t] of Object.entries(v.output)) assert.strictEqual(pages[k], t, k);
  });
}

// V1: a source unlike the last stops the import, saying what changed.
const shape = JSON.parse(fs.readFileSync(path.join(__dirname, 'shape.json'), 'utf8'));
const { input } = JSON.parse(fs.readFileSync(path.join(dir, 'sites.json'), 'utf8'));
const small = { ...shape, rows: { locations: [3, 3], peaks: [input.peaks.length, input.peaks.length], 'field measurements': [input.field.length, input.field.length] } };
const throwsShape = (fn, re) => assert.throws(fn, e => e instanceof ShapeError && re.test(e.message));
test('V1: the vector\'s rows pass', () => checkShape(input, small));
test('V1: a key gone stops it', () => throwsShape(
  () => checkShape({ ...input, peaks: input.peaks.map(({ peak_since, ...r }) => r) }, small), /peaks: gone: peak_since/));
test('V1: a new key stops it', () => throwsShape(
  () => checkShape({ ...input, field: input.field.map(r => ({ ...r, depth: 1 })) }, small), /field measurements: new: depth/));
test('V1: a code not seen before stops it (a new code may be a new meaning)', () => throwsShape(
  () => checkShape({ ...input, peaks: [{ ...input.peaks[0], qualifier: ['TIDAL'] }, ...input.peaks.slice(1)] }, small), /codes not seen before: TIDAL/));
test('V1: a site keyed otherwise stops it (K2: the number a string, as USGS writes it)', () => throwsShape(
  () => checkShape({ ...input, locations: [{ ...input.locations[0], id: 'USGS-1414000' }, ...input.locations.slice(1)] }, small), /keyed otherwise: USGS-1414000/));
test('V1: rows not as last read stop it', () => throwsShape(() => checkShape(input, shape), /3 locations, not 14000 to 15500/));
const day = { time: '2026-01-01', value: '12.5', approval_status: 'Provisional', qualifier: ['ICE'], last_modified: 'x', time_series_id: 'x', statistic_id: '00003' };
test('V1: a day passes', () => checkDaily([day], 's', shape));
test('V1: a day twice stops it', () => throwsShape(() => checkDaily([day, day], 's', shape), /2026-01-01 twice/));
test('V1: an approval not seen stops it', () => throwsShape(() => checkDaily([{ ...day, approval_status: 'Working' }], 's', shape), /approval not seen before: Working/));
test('V1: a value not a number stops it', () => throwsShape(() => checkDaily([{ ...day, value: 'Ice' }], 's', shape), /not a number: Ice/));

// The water year, and names made safe.
test('a water year begins in October', () => {
  assert.strictEqual(waterYear('2025-09-30'), 2025);
  assert.strictEqual(waterYear('2025-10-01'), 2026);
});
test('B7: a name made safe, its link read back with a comma bare', () => {
  assert.strictEqual(safe('HUDSON RIVER AT N. CREEK/RIVERSIDE NY.'), 'HUDSON RIVER AT N. CREEK-RIVERSIDE NY');
  assert.strictEqual(link('A, B', './x/A, B.md'), '[A, B](./x/A,%20B.md)');
});
