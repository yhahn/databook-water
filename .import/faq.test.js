// faq.js, held by five questions, one of each Type, their answers worked
// out from USGS's files and their records frozen (SPEC B9, V2). A change
// here is a change in what FAQ.md says: say why in DECISIONS.md.
//   node --test .import/faq.test.js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const faq = require('./faq');

const questions = faq.parse(fs.readFileSync(path.join(__dirname, 'faq.md'), 'utf8'));
const q = (id) => questions.find((x) => x.id === id);
const FIVE = ['wa-lookup-1', 'wa-page-1', 'wa-join-1', 'wa-gap-1', 'wa-change-1'];
const A = faq.compute(FIVE);

test('faq.md: 24 questions, ids unique, every one with the same keys', () => {
  assert.strictEqual(questions.length, 24);
  assert.strictEqual(new Set(questions.map((x) => x.id)).size, 24);
  for (const x of questions) assert.deepStrictEqual(Object.keys(x), ['id', 'Tier', 'Ask', 'Type', 'Tolerance', 'Rules', 'How', 'Look in']);
});

test('every rung of the ladder, at least two Gap and two Analysis', () => {
  const n = (t) => questions.filter((x) => x.Tier === t).length;
  for (const t of ['Lookup', 'Page', 'Across', 'Join', 'Change', 'Nearby']) assert.ok(n(t) >= 1, t);
  assert.ok(n('Gap') >= 2 && n('Analysis') >= 2);
});

test('one of each Type', () => {
  assert.deepStrictEqual(FIVE.map((id) => q(id).Type), ['number', 'set', 'list', 'none', 'judge']);
});

test('the answers, from the source', () => {
  assert.strictEqual(A['wa-lookup-1'].answer, 40000);
  assert.deepStrictEqual(A['wa-page-1'].answer, ['Westchester County']);
  assert.deepStrictEqual(A['wa-join-1'].answer, [120000, 40000]);
  assert.strictEqual(A['wa-gap-1'].answer, null);
  assert.deepStrictEqual(A['wa-change-1'].answer, [1911, 1933, 1953]);
});

const RECORDS = {
  "wa-lookup-1": `### Question: wa-lookup-1

- Tier: Lookup
- Ask: What was the daily mean discharge of Schoharie Creek at Prattsville on 2011-08-28?
- Answer: 40000
- Type: number
- Tolerance: 0
- Look in: [New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY/2011](./New%20York/Greene%20County/SCHOHARIE%20CREEK%20AT%20PRATTSVILLE%20NY/2011.md)

daily USGS-01350000 00060, 2011-08-28: 40000 ft³/s, Approved, ESTIMATED (the day Irene's rain reached the Catskills).
`,
  "wa-page-1": `### Question: wa-page-1

- Tier: Page
- Ask: In which county is the gauge on the Saw Mill River at Yonkers?
- Answer: Westchester County
- Type: set
- Tolerance:
- Look in: [New York/Westchester County](./New%20York/Westchester%20County.md), [New York/Westchester County/SAW MILL RIVER AT YONKERS NY](./New%20York/Westchester%20County/SAW%20MILL%20RIVER%20AT%20YONKERS%20NY.md)

loc-ST.json, USGS-01376500: county_name Westchester County (county_code 119).
`,
  "wa-join-1": `### Question: wa-join-1

- Tier: Join
- Ask: At Schoharie Creek at Prattsville, how did the peak of its greatest flood compare with that day's mean discharge?
- Answer: 120000 ft³/s at the peak on 2011-08-28; 40000 ft³/s the day's mean
- Type: list
- Tolerance: 0
- Look in: [New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY](./New%20York/Greene%20County/SCHOHARIE%20CREEK%20AT%20PRATTSVILLE%20NY.md), [New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY/2011](./New%20York/Greene%20County/SCHOHARIE%20CREEK%20AT%20PRATTSVILLE%20NY/2011.md)

peaks-00060 and daily 00060, USGS-01350000, 2011-08-28.
`,
  "wa-gap-1": `### Question: wa-gap-1

- Tier: Gap
- Ask: What was the discharge of Schoharie Creek at Prattsville on 1902-10-15?
- Answer: The book does not say.
- Type: none
- Tolerance:
- Look in:

daily USGS-01350000 00060 begins 1902-11-09.
`,
  "wa-change-1": `### Question: wa-change-1

- Tier: Change
- Ask: Can the gage heights of the Sacandaga River at Stewarts Bridge near Hadley be compared across its whole record? In which water years did its gauge's datum change?
- Answer: water years 1911, 1933, 1953: gage heights before and after are from different datums, and cannot be compared without the offset, which the book does not give
- Type: judge
- Tolerance:
- Look in: [Changes](./Changes.md), [New York/Saratoga County/SACANDAGA RIVER AT STEWARTS BRIDGE NR HADLEY NY](./New%20York/Saratoga%20County/SACANDAGA%20RIVER%20AT%20STEWARTS%20BRIDGE%20NR%20HADLEY%20NY.md)

peaks-00065, USGS-01325000, gage height peaks coded DATUMCHANGE: 1911, 1933, 1953.
`,
};

for (const id of FIVE) {
  test(`the record of ${id}, as FAQ.md writes it`, () => {
    assert.strictEqual(faq.record(q(id), A[id]), RECORDS[id]);
  });
}

test('a Look in that leads nowhere is refused', () => {
  assert.throws(() => faq.record({ ...q('wa-lookup-1'), 'Look in': 'New York/Nowhere.md' }, A['wa-lookup-1']), /Nowhere/);
});

test('a Gap question with no Look in is let be; any other is refused', () => {
  assert.throws(() => faq.record({ ...q('wa-lookup-1'), 'Look in': '' }, A['wa-lookup-1']), /Look in/);
});

test('a Gap question given an answer is refused', () => {
  assert.throws(() => faq.record(q('wa-gap-1'), { answer: 1, note: '' }), /Gap/);
});
