// V3: plays .import/vectors/target.sql against what proper gathers, and runs
// every ```sql block of the README (each must answer, with rows; a block
// that reads the live source may answer with none). Run from the repo,
// after the importer:
//
//   node .import/target.js
//
// Says each check, held or not, and exits 1 if any is not.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const counts = JSON.parse(fs.readFileSync(path.join(__dirname, 'water', 'counts.json'), 'utf8'));
const fill = text => text.replace(/\{([\w.]+)\}/g, (_, k) => {
  const v = k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), counts);
  if (v === undefined) throw new Error(`counts.json has no ${k}`);
  return String(v);
});

function query(sql) {
  const p = spawnSync('proper', ['query', sql], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 << 20 });
  const out = (p.stdout || '') + (p.stderr || '');
  const rows = out.split('\n').filter(l => l.startsWith('|'));
  if (p.status || rows.length < 2) return { rows: null, out: out.trim() };
  return { rows: rows.slice(2), out };
}

let failed = 0;
const sql = fs.readFileSync(path.join(__dirname, 'vectors', 'target.sql'), 'utf8');
for (const block of sql.split(/\n(?=-- name: )/).filter(b => b.startsWith('-- name: '))) {
  const name = /^-- name: (.*)$/m.exec(block)[1];
  const want = fill(/^-- want: (.*)$/m.exec(block)[1]);
  const q = fill(block.split('\n').filter(l => !l.startsWith('--')).join('\n').trim());
  const { rows, out } = query(q);
  const got = rows && rows[0] ? rows[0].replace(/^\|\s*|\s*\|$/g, '').trim() : `(no answer) ${out.slice(0, 300)}`;
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? 'held' : 'NOT HELD'}: ${name}${ok ? '' : `\n  want: ${want}\n  got:  ${got}`}`);
}

const readme = fs.readFileSync(path.join(REPO, 'README.md'), 'utf8');
const blocks = [...readme.matchAll(/```sql\n([\s\S]*?)```/g)].map(m => m[1]);
blocks.forEach((b, i) => {
  const live = /usgs_water/.test(b);
  const { rows, out } = query(b);
  const ok = rows && (rows.length > 0 || live);
  if (!ok) failed++;
  console.log(`${ok ? 'held' : 'NOT HELD'}: README query ${i + 1} answers${live ? ' (the live source; rows if caught up today)' : ', with rows'}${rows ? ` (${rows.length})` : `\n  ${out.slice(0, 400)}`}`);
});
console.log(failed ? `${failed} not held` : 'every check held');
process.exit(failed ? 1 : 0);
