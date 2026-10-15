# Notes: databook-water, the first migration (a deputy, 10-13)

## What was asked

New York's USGS stream sites as a databook: a page a site, its daily
discharge and gage height as cards, annual peaks and field measurements
as tables, codes spelled out, Changes where USGS marks them; held to SPEC
from the start; a live source (`.source/`, A5 as data) over
latest-continuous, checked, added and caught up; a README with a query
joining the reading now to the daily history; every check held.

## What was made (branch `import`)

- **The size, weighed first:** 914 sites (708 with daily means, 300 still
  reporting; 841 with peaks), 722 daily series (690 discharge, 32 gage
  height), about 9 million site-days, 53,960 peaks, 483,775 field
  measurements. By the trial (1.06 M days wrote 64 MB and 3,380 pages):
  near 550 MB and 26,000 pages whole, under the brief's 100,000 pages and
  1 GB, so the whole, not active sites only.
- **The shape (B7):** `New York.md` lists counties; `New York/<County>.md`
  its sites; `New York/<County>/<Site>.md` a site (keys, a by-month card
  over every year, its years linked, its peaks, its field measurements);
  `New York/<County>/<Site>/<water year>.md` a year's days, a row a day,
  with a by-month card. `Changes.md`: 19 records (gage datum changes,
  from USGS's DATUMCHANGE code), their sites a table.
- **Written so far: 511 of 914 sites** (307 of 722 daily series: 300
  sites with daily means, 3,368,285 days, 9,557 water years, 14,270 peak
  rows, 195,201 field measurements, 54 Changes over 78 site-years; 10,128
  pages, 199 MB). No daily gage-height series is fetched yet (they come
  late in the fetch's order). USGS allows 1,000 asks an hour
  with no key, shared by everything on this machine; after about 130 asks
  it answered 429 with Retry-After of 15-35 minutes, and the machine
  slept for five hours mid-wait. `import.js --fetched` writes only sites
  whose series are all in and counts the rest as waiting; the README says
  "Not yet whole". `node .import/fetch.js` resumes (a file fetched is
  kept), then `sh .import/build.sh` without `--fetched`.
- **Counts, written against gathered** (target.sql, every check held):
  see the commit's counts.json; each of days, discharge days, peaks by
  parameter, field measurements, series and pages matches what proper
  gathered, and peaks and field measurements add up to every row fetched
  (with those of sites waiting or not in the book).
- **Cold gather:** 52.6 s and 2.2 GB (the build's peak) for 511 sites,
  3.37 M days (10,128 pages, 199 MB); at 310 sites, 23.8 s and 1.05 GB.
  Whole, by that line, near 140 s and 5-6 GB: the phone's worry
  (LIVE.md) more than ever.
- **The live source:** `.source/` (source.json with `hosts`, api.json, three
  cases from a real answer and a real 429). `proper-sources check`: fit to
  add, 3 cases played in Node and QuickJS alike. Added and caught up on a
  scratch host (XDG_DATA_HOME and PROPER_SOURCES in scratch): 810 rows in
  1 call, 805 held, 2.3 s; `source_usgs_water.latest` queried, value a
  DOUBLE, codes a VARCHAR[], times the person's local time; the README's
  "now against the past" query answered with 15 rows (West Branch Croton
  at Richardsville at 5.9 times its usual for 13 October). **Not added on
  the person's own proper:** `proper sources add` asks the person "Add
  USGS water, New York? y or n"; that yes is theirs.

## Decisions (.import/DECISIONS.md)

The whole, by county; water years; one row a day with both measures, a
site's second series of a measure kept apart; values and codes as USGS
writes them, meanings in the README; statistics computed, three
significant figures; a Change a water year for datum changes, DIFFDATUM a
mark; peaks merged by moment; field measurements a row a reading; the
live source over latest-continuous; the book written in part while the
limit holds; other agencies' sites keyed by their code.

## Learnings, with evidence

For proper-sources (A5), what it could not say:
1. **Paging by a next link.** OGC APIs give `links[rel=next].href`, a whole
   URL with a cursor in it. A5's `page` wants a token put back as a query
   parameter, and a value path cannot pick an item of a list by its `rel`.
   latest-continuous fits in one page of 50,000; `continuous` would not.
2. **A since that is an interval.** `continuous?datetime=<instant>/..`
   (or `last_modified=<instant>/..`): A5's `changedSince` gives the bare
   instant. A template (`"as": "{}/.."`) would do; durations (`P1D/..`)
   the API refuses.
3. **A named zone.** `day` is "where it happened" (A6); A5 has the
   offset written (UTC here, so a reading at 00:00 UTC files under the
   wrong day) or the device's. The site's zone is America/New_York
   whatever the device; USGS's own site record says `EST`,
   `uses_daylight_savings: N` for Esopus Creek, which is wrong too.
4. **Retry-After.** The 429 is a minutes-long wait by header; A5 reads no
   header (already on the sources seat's list).
5. **A list of words read whole** (`codes`: a field path gives the
   array) works; a number from a string (`"417"`) is cast by the host to
   DOUBLE: worth saying in A5, the checker does not check it.
6. Five rows of 810 shared a key (site, parameter, start): two series of
   one measure at a site. The store kept one ("4 changed"). The key wants
   the series: `time_series_id` is a property latest-continuous returns;
   a version 2 of the stream should add it.

For proper:
7. **K2 again:** `Number` (`01362500`), `County code` (`025`) and `HUC`
   (`020200050503`) are gathered as BIGINT, zeros gone (ASKS.md's ask; a
   third databook's evidence). The key, `USGS-01362500`, survives.
8. **Cold gather at size:** 1.06 M rows in 3,380 files: 23.8 s, 1.05 GB.
9. A README at the root is gathered (`codes` from its table). Harmless
   here; B6 and B2 between them leave it so.
10. `.proper/README.md` is proper's own settings page; turning a source
    on in a worktree means writing it (gitignored), which the add's words
    ("in a repo's .proper/README.md") say.

For the catalog and SPEC:
11. **The upstream's limit is the size.** Predicted "paging and pace are
    the work"; the work was waiting: 722 asks at an unkeyed 1,000 an hour
    shared with the machine. A key (a sign-up, the person's) or USGS's
    STAC daily parquet (a file a site, whole) would make it one sitting.
    SPEC has no word on a fetch that takes days: V1/V4 assume a release
    is read whole; a rule for a book written in part (`--fetched`,
    counted as waiting, said in the README) belongs there if it recurs.
12. **V1 earned its keep:** the rebuild stopped on a daily code not seen
    (UNAVAIL), and two more were waiting (SEASONAL, ZEROFLOW); each is a
    meaning added to the codes, not passed by.
13. **USGS's own changes:** its docs show `offset=` paging; the API
    answers with `cursor=`. `monitoring_location_name` is a queryable of
    latest-continuous but not a property it will return (400). Code
    descriptions "not currently available" (migration guide).

## What I was unsure of

- The codes' meanings: read from their names and USGS's older tables, not
  given by the API; said so in the README.
- DATUMCHANGE as a Change (D5) and DIFFDATUM as a mark (D8): my reading.
- Renumbered or moved sites: the API does not say; none guessed. The
  site's Revisions note (USGS's prose) sometimes does.

## Against the Predicted

Predicted 60 minutes, paging and pace the work, the live source fitting
A5 and installing. The importer, vectors, checks and live source took
about 50 minutes and went as predicted; the live source fit A5 (for
latest-continuous only) and installed. The fetch did not: USGS's limit
and the machine's sleep made it hours, and the book is a little over half written.
Ice, equipment, estimated, revised and provisional codes all came, as
predicted; renumbered sites did not (the API cannot say).

## What the brief lacked

The unkeyed limit (1,000 an hour, shared by the machine) and whether a
key is the person's to get; whether the add's yes may be given for them.

**In a line:** the importer, its checks and the live source are whole and
held; the book is 511 of 914 sites until USGS's limit lets the rest be
fetched (`node .import/fetch.js`, then `sh .import/build.sh`).

# Notes: FAQ.md (deputy, 10-15)

Asked: an FAQ.md by SPEC B9, as HUD's; the README's opening for a
stranger. Made: `.import/faq.md` (24 questions), `.import/faq.js`,
`.import/faq.test.js` (12 tests), four B9 checks in target.sql, build.sh
and the README (readme.js). Every answer agrees with its page.

For the seat:
- **A whole gather needs a bigger Node heap.** `proper query` on the
  whole book died at Node's 2 GB default ("JavaScript heap out of
  memory", 35 s in) under `crew run 6G`; with
  `NODE_OPTIONS=--max-old-space-size=6000` under `crew run 7G` it
  gathered in 59 s. For proper (engine): its gather holds more in the JS
  heap than Node's default allows at 24,000 pages.
- **What may mislead a reader:** the site page's "Discharge by month"
  card is the mean of each month's means; a reader after a typical
  August at Prattsville reads 159 ft³/s where the median day is 48. The
  Years table's `Water year` is gathered as its link
  (`[2020](./.../2020.md)`), so `where "Water year" = 2020` finds
  nothing in `Site_Years`. The greatest "peak" in the book (St. Lawrence
  at Cornwall, 378,000) is another agency's highest daily mean, as its
  codes say.
- **Checks:** every target.sql check holds, with the four B9 checks. Two
  missed on the first run: Pages (FAQ.md is a page more; the check now
  leaves it out) and README query 5, because the repo's own folder had no
  `.proper/` (the last build ran in the worktree, whose local settings
  turn usgs_water on). I turned it on in the folder's gitignored
  `.proper/README.md` as the worktree had it; the source was already
  added on this machine. Build 2m under crew (the gather 56 s).
