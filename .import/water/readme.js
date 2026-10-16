// Writes the README (SPEC B6): what the data is, how it is keyed, queries
// that run, the source and its notice, and the changes, from what the
// importer wrote (counts.json) and the pages (Changes.md).
//
//   node .import/water/readme.js

const fs = require('node:fs');
const path = require('node:path');
const { CODES } = require('./import');

const REPO = path.join(__dirname, '..', '..');
const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'counts.json'), 'utf8'));
const n = x => Number(x).toLocaleString('en-US');
const changes = [...fs.readFileSync(path.join(REPO, 'Changes.md'), 'utf8').matchAll(/^### Change: (.*)$\n[\s\S]*?^- Places: (\d+)$/gm)].map(m => `${m[1]} (${m[2]} ${m[2] === '1' ? 'site' : 'sites'})`);

const sql = s => '```sql\n' + s.trim() + '\n```';
const faqN = (fs.readFileSync(path.join(__dirname, '..', 'faq.md'), 'utf8').match(/^### Question: /gm) || []).length;
const text = `# New York's streams

Every stream gauge USGS keeps in New York that has daily means of its
discharge or gage height, or annual peaks: ${n(c.sites)} sites in ${c.counties}
counties, ${n(c.withDaily)} of them with daily means (${n(c.days)} days, the
first ${c.firstDay}), ${n(c.peakRows)} annual peaks (the floods), and
${n(c.field)} field measurements (the visits that check a gauge). Today's
readings come from the same API as a live source (below), so a river's
flow now can be laid beside every day it has flowed before.

${c.waiting.sites ? `**Not yet whole.** ${n(c.waiting.sites)} more sites (${n(c.waiting.series)} daily series)
wait on USGS's limit of 1,000 asks an hour for a program with no key;
their pages come with the next run of the importer, once fetched. The
counts here are of what is written.

` : ''}Read it as a book, county by county and gauge by gauge, a page a
gauge and a page for each of its water years; or gather it with
[proper.md](https://github.com/proper-md/proper.md) and ask it in SQL.

It is a *databook*: a repo of data only, written whole by its importer
(\`.import/\`) from USGS's Water Data API as it stood on ${c.fetchedOn},
never edited by hand, and made again, the same, by running the importer
again.

[Questions and answers](./FAQ.md): ${faqN} questions a reader of this book can answer, from one river's flow on one day to which year was New York's wettest, each with its answer and the page to look in.

## Its source and its terms

U.S. Geological Survey, Water Data for the Nation: the Water Data APIs
(https://api.waterdata.usgs.gov/ogcapi/v1): monitoring-locations,
time-series-metadata, daily, peaks, field-measurements, latest-continuous.
USGS data are in the public domain (USGS Government Work; the daily
collection's license is CC0-1.0). USGS: provisional data are subject to
revision; recent data have not been reviewed and may be changed or removed.

Each site's locality is placescope's, from its maps of New York (release
${c.placescope}).

## Licence

This book, its pages and its importer, is given to the public domain
under CC0 1.0 ([LICENSE](LICENSE)): copy it, change it and use it as you
like, without asking. Its sources are free of copyright too, as above;
citing them is still the courteous thing.

## Making it again

\`\`\`sh
node .import/fetch.js   # USGS's files, fetched again (--again for a new release)
sh .import/build.sh     # every page, the README and FAQ.md written; the tests; what proper gathers checked
\`\`\`

USGS allows a program without a key 1,000 asks an hour, so a whole fetch
takes some hours. The importer checks the files against their shape as
last read before it writes a page, and stops on a field, a code or a
reading it has not seen. Gathered whole, the book wants about 6 GB, and
proper's Node a heap to match (\`NODE_OPTIONS=--max-old-space-size=6000\`).
FAQ.md's answers are worked out again from USGS's files at every release,
never copied from the pages.

## How it is laid out

- \`New York.md\`: the counties, each linked.
- \`New York/<County>.md\`: the county's sites, each linked.
- \`New York/<County>/<Site>.md\`: a site (\`# Site:\`): where it is, what it
  drains, its years in a table (each linked), its months as a card, its
  annual peaks, and its field measurements.
- \`New York/<County>/<Site>/<water year>.md\`: a water year (\`# Water Year:\`,
  October to September, as USGS keeps its books): a row a day, with the
  months as a card.
- \`Changes.md\`: what USGS marks as changed in what its numbers mean.

A site is keyed as USGS keys it: \`Site ID\`, \`USGS-\` and its number, the
number's leading zeros kept (\`USGS-01362500\`). Join on \`Site ID\`, never
on \`Number\`, \`County code\` or \`HUC\`: proper reads an all-digit code as
a number today and drops its leading zeros. Discharge is in cubic feet a
second, gage height in feet above the gauge's own datum. Every value is as
USGS gives it, Approved (final) or Provisional (may yet be revised), with
its codes beside it. A page's day table is joined to its page by the file:
\`join "Water Year" w using (_file)\`.

A site's \`Locality\` is the place it stands in, a city, village or hamlet
as people name it ('Margaretville, NY'), not New York's civil town; its
\`Locality ID\` (\`us/ny/margaretville\`) is placescope's, from its maps
(release ${c.placescope}) at the site's point: ${c.localities} localities,
blank for ${c.sitesNoLocality} sites on water the maps name none for${c.sitesBeyond ? `, and for ${c.sitesBeyond} beyond the state's maps, not asked` : ''}.
Join on the id, never the name: \`locality_at(lat, lon, 'id')\` answers the
same id in proper, so a gauge joins a hotspot, a photo or a sighting by
place.

| Table | A row is |
|---|---|
| \`Site\` | a site |
| \`Water Year\` | a site's water year |
| \`Water_Year_Days\` | a day: Discharge, Gage height, each with its approval and codes |
| \`Water_Year_Other_series\` | a day of a second series of the same measure at a site, kept apart |
| \`Site_Years\` | a water year's mean, lowest and highest day, and its codes, counted |
| \`Site_Peaks\` | an annual peak: discharge and gage height at that moment |
| \`Site_Field_measurements\` | a reading on a visit: discharge, mean gage height, or a reference reading |
| \`County\`, \`State\` | the listings |
| \`Change\` | a change USGS marks, a record a year |

## Queries

The sites of a county, the largest first:

${sql(`
select name, "Site ID", "Drainage area", "Daily from", "Daily to"
from Site where County = '${c.example.county}'
order by "Drainage area" desc nulls last
`)}

The greatest floods in the record:

${sql(`
select s.name, p."Water year", p.Date, p.Discharge, p."Discharge codes"
from Site_Peaks p join Site s using (_file)
where p.Discharge is not null
order by p.Discharge desc limit 10
`)}

${c.example.name} (the longest record still reporting, since ${c.example.first}) on this day, every year it was gauged:

${sql(`
select d.Day, d.Discharge, d."Discharge approval", d."Discharge codes"
from Water_Year_Days d join "Water Year" w using (_file)
where w."Site ID" = '${c.example.id}'
  and month(d.Day) = month(today()) and day(d.Day) = day(today())
order by d.Day desc
`)}

Ice: the winters with the most days a gauge read under ice, statewide:

${sql(`
select w."Water year", count(*) as "Ice days", count(distinct w."Site ID") as sites
from Water_Year_Days d join "Water Year" w using (_file)
where d."Discharge codes" like '%ICE%'
group by 1 order by 2 desc limit 10
`)}

**Now against the past.** Each river's flow now (the live source) beside
every year's flow on the same day (the book), wettest first:

${sql(`
with now as (
  select site, value, start from source_usgs_water.latest
  where parameter = '00060' and day >= today() - 1 and value is not null
  qualify row_number() over (partition by site order by start desc) = 1),
past as (
  select w."Site ID" as site, count(*) as years, min(d.Discharge) as low,
    median(d.Discharge) as median, max(d.Discharge) as high
  from Water_Year_Days d join "Water Year" w using (_file)
  where month(d.Day) = month(today()) and day(d.Day) = day(today())
    and d.Discharge is not null
  group by 1)
select s.name, now.start, now.value as now, past.median, past.low, past.high,
  past.years, round(now.value / nullif(past.median, 0), 2) as "times usual"
from now join past using (site) join Site s on s."Site ID" = now.site
order by "times usual" desc limit 15
`)}

## The live source

\`.source/\` is a source as data (proper-sources SPEC A5): \`usgs_water.latest\`,
each New York gauge's newest reading of discharge and gage height, from
USGS's latest-continuous, about 800 series in one ask, no key. Installed
from this repo at its commit, caught up, and turned on:

\`\`\`
proper sources add <this repo>/.source
proper sources catch-up usgs_water
\`\`\`

and in \`.proper/README.md\`, \`# Sources\` with \`- usgs_water: on\`; then it
is \`source_usgs_water.latest\` (site, parameter, day, start, value, unit,
approval, codes), keyed by site, parameter and start, so each catch-up adds
the readings newer than the last. A live reading is provisional; the book
holds the daily means, approved in time, and is the importer run again.

## Codes

As USGS writes them, on a day, a peak or a reading. USGS's API gives no
description of them yet ("not currently available"); these are read from
their names and USGS's older code tables.

| Code | Means |
|---|---|
${Object.entries(CODES).sort().map(([k, v]) => `| ${k} | ${v} |`).join('\n')}

## Changes

A change USGS marks in what a number means is a record in \`Changes.md\`
(${c.changes} records, ${c.datumSites} datum changes in all): the gauge's
datum moved in a year, so gage heights before and after are not alike.
Nothing is split or adjusted; the peak is marked, as USGS marks it.
${changes.length > 12 ? `The years: ${changes.map(x => x.replace(/^gage datum, /, '')).join('; ')}.` : changes.map(x => `- ${x}`).join('\n')}

USGS's notes on a site's published history (a datum revised, a record
revised, a drainage area changed) are on each site's page as \`Revisions\`,
as USGS wrote them. USGS's API does not say where a site moved or was
renumbered; none is guessed.

## What is left out

- Sites with only field measurements, or no discharge or gage height:
  ${n(c.left.fieldNotInBook)} field measurements of sites not in the book.
- ${n(c.left.peaksNoSite)} peaks of sites USGS lists as in New York's peaks
  but not among its surface-water sites (wells, springs and the like).
- The 15-minute record (USGS's continuous values): the live source holds
  the newest reading; the record itself is a later book's.
`;
fs.writeFileSync(path.join(REPO, 'README.md'), text);
console.log('README.md', text.length);
