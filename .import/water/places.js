// The locality at each point (a city, village or hamlet as people name
// it), from placescope's maps kept on this computer (proper-sources'
// placescope source: `proper sources set placescope keep
// us/ny`, then `proper sources catch-up placescope`). Asked of the build of
// its extension that proper pinned and copied, by DuckDB's own CLI.
//
//   localities([{ key, lat, lon }], 'us/ny')
//     -> { release, at: Map(key -> { name, id }), beyond }
//
// Only a point within the state's box is asked (its box as placescope's
// bounds give it); one beyond (a pelagic hotspot far at sea) is not, and
// is counted in `beyond`. Within it, a point in a state not kept fails the
// whole ask, naming the state: the book is written with every locality
// or not at all. A point the release names none for (on water) is null, written
// blank. The id (us/ny/ithaca) stays when a later release betters a name.
// geocontext_at gives id and name in one ask: half the time of two.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');

const FOLDER = path.join(os.homedir(), '.cache/proper/placescope');
const SOURCE = path.join(os.homedir(), 'Projects/proper-sources/sources/placescope/source.json');
const BOUNDS = path.join(os.homedir(), 'Projects/proper-sources/sources/placescope/bounds-1.0.0.json');

function box(state) {
  const s = JSON.parse(fs.readFileSync(BOUNDS, 'utf8')).states.find((e) => e.state === state);
  if (!s) throw new Error(`placescope's bounds know no ${state}`);
  const [west, south, east, north] = s.bbox;
  return (p) => p.lat >= south && p.lat <= north && p.lon >= west && p.lon <= east;
}

// The build proper copied, checked by the sha256 the catalog pins.
function extension() {
  const { name, version, builds } = JSON.parse(fs.readFileSync(SOURCE, 'utf8')).extension;
  const platform = 'linux-x86_64';
  const file = path.join(FOLDER, 'extensions', `${name}-${version}-${platform}`, `${name}.duckdb_extension`);
  if (!fs.existsSync(file)) throw new Error(`no ${name} ${version} at ${file}: turn the source on and ask a query of it in proper once`);
  const sum = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (sum !== builds[platform].sha256) throw new Error(`${file} is not the build the catalog pins`);
  return file;
}

function localities(all, state) {
  const inside = box(state);
  const points = all.filter(inside);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'places-'));
  const csv = path.join(tmp, 'points.csv');
  fs.writeFileSync(csv, 'key,lat,lon\n' + points.map((p) => `${JSON.stringify(String(p.key))},${p.lat},${p.lon}`).join('\n') + '\n');
  const sql = [
    `load '${extension()}';`,
    `select release from placescope_tiles('${FOLDER}') where state = '${state}';`,
    `select key, g.locality_name as name, g.locality_id as id from (select key, geocontext_at(lat, lon) as g from read_csv('${csv}', header = true, columns = {'key': 'varchar', 'lat': 'double', 'lon': 'double'}));`,
  ].join('\n');
  let out;
  try {
    out = execFileSync('duckdb', ['-unsigned', '-jsonlines', '-c', sql], { encoding: 'utf8', maxBuffer: 1 << 28 });
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const rows = out.trim().split('\n').map((l) => JSON.parse(l));
  const release = rows.shift().release;
  const at = new Map(rows.map((r) => [r.key, { name: r.name, id: r.id }]));
  if (at.size !== new Set(points.map((p) => String(p.key))).size) throw new Error(`placescope answered ${at.size} of ${points.length} points`);
  return { release, at, beyond: all.filter((p) => !inside(p)).map((p) => p.key) };
}

module.exports = { localities };
