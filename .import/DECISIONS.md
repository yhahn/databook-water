# Decisions

Small things decided in making databook-water, each with why and how to
undo it. The seat's catalog record is "USGS water: New York's streams".

## The size and the shape (B7), 10-13

- **What:** every New York site (surface water: stream, canal, tidal
  stream, ditch, lake, estuary) with a series of daily means of discharge
  (00060) or gage height (00065), or annual peaks: 914 sites. The whole,
  not active sites only: 708 sites with daily means, 300 still reporting;
  about 9 million site-days spanned by their series, near 550 MB of
  markdown and 26,000 pages by the trial's measure (105 series wrote 60 MB
  and 3,178 pages), under the brief's 100,000 pages and 1 GB.
- **Shape:** a page a site in a folder a county (`New York/<County>/`),
  beside it a folder of its water years, a page each, a row a day. A
  county's page lists its sites; the state's, its counties. A site's
  page is ten thousand lines or more if its days are on it; a water year
  is 365 rows, a page that passes reason.
- **Why county, not watershed:** a reader finds a river by where it is;
  the HUC is on every site, so a watershed is a query.
- **Undo:** `buildSite` in .import/water/import.js; a page a decade or a
  site would be a change to the year loop alone.

## Water years, not calendar years, 10-13

- **What:** a year's page is USGS's water year, October to September
  (2026 is 2025-10-01 to 2026-09-30), and its cards run October first.
- **Why:** USGS keeps its books so: annual peaks are by water year, and a
  winter's floods fall in one year, not two.
- **Undo:** `waterYear` and `MONTHS` in import.js.

## One row a day, discharge and gage height side by side, 10-13

- **What:** a day's row has both, each with its approval and codes; a
  site with one leaves the other blank (B4: the same columns everywhere).
  A site's main series of a measure is its longest; any other (one site,
  USGS-04279000, "Total Mean Discharge" beside "River channel only") is a
  table of its own on the year's page, `## Other series`, never merged.
- **Why:** K5: a day is one daily mean of a series; two series of one
  measure are two meanings.
- **Undo:** `seriesOfSite`.

## Values and codes as USGS writes them, 10-13

- **What:** a value as its string ("23.0" stays 23.0 in the page); codes
  as USGS's words (ICE, EQUIP, ESTIMATED), joined by ", "; times of peaks
  and measurements as given, in UTC (`17:00:00+00:00`); approval as
  Approved or Provisional. The codes' meanings are in the README, read from
  their names and USGS's older tables: the API gives none ("not currently
  available").
- **Why:** K2 and D8: marked beside the value, never split.
- **Undo:** `CODES` in import.js.

## Statistics computed, 10-13

- **What:** a year's and a month's mean, lowest and highest are computed
  by the importer from USGS's daily means, rounded to three significant
  figures, as USGS rounds its own; the pages say so.
- **Why:** the cards want them; USGS's statistics API is another source.
- **Undo:** `stats` and `sig`.

## Changes (D5), 10-13

- **What:** a Change record a water year for gage datum changes, from the
  peaks USGS codes DATUMCHANGE, its sites a table. DIFFDATUM (a peak's
  gage height at another site or datum) is a mark on the value (D8), not a
  Change. Moves and renumberings are not in the API: none is guessed (K3).
  USGS's prose notes on a site's history are written whole as Revisions.
- **Undo:** `datum` in buildSite, `buildListings`.

## Peaks: one row a moment, 10-13

- **What:** a discharge peak and a gage-height peak with the same water
  year, date and time of day are one row; otherwise a row each.
- **Why:** USGS gives them as two series; the reader wants the flood.
- **Undo:** the `pk` map in buildSite.

## Field measurements: a row a reading, 10-13

- **What:** every reading of a visit is a row (Discharge, MeanGageHeight,
  ReferencePrimary), the visit's id beside it; agency and control written
  as USGS writes them ("usgs" and "USGS" both; "Unspecifed").
- **Undo:** `fieldRows` in buildSite.

## The live source, 10-13

- **What:** `usgs_water.latest`, latest-continuous for New York's
  discharge and gage height, one page of ~800 readings, keyed by site,
  parameter and start; the day by the device's offset.
- **Why:** latest-continuous fits A5 with fixed values; continuous since a
  cursor does not (its datetime wants an interval, `<instant>/..`, and A5
  gives an instant), nor does its paging (a next link's href).
- **Undo:** `.source/api.json`.

## Fetching, 10-13

- **What:** one ask a daily series, three at a time; peaks and field
  measurements by state, paged by the next link; a 429 waited out by its
  Retry-After, every worker together, six and the run stops. No key.
- **Why:** the API allows 1,000 asks an hour with no key; a key is a
  sign-up, the person's.

## A book written in part, while USGS's limit holds the rest, 10-13

- **What:** `import.js --fetched` writes only the sites whose daily series
  are all fetched, and counts the rest as waiting (`counts.json`
  `waiting`); the README says "Not yet whole" while any wait. The first
  commit of pages held 310 of 914 sites (106 of 722 series), the second
  511 (307).
- **Why:** with no key the API allowed about 130 asks in the first hour,
  then a 429 with a Retry-After of 15 to 35 minutes, one ask let through
  each time (the 1,000 an hour is shared by whatever else on this machine
  asks it). A site written with half its series would be a site misread.
- **Undo:** run `node .import/fetch.js` until it says done, then
  `sh .import/build.sh` without `--fetched`; the flag goes when no run
  needs it.

## Sites of other agencies, 10-13

- **What:** USGS's list of New York's sites holds other agencies' too
  (`USNOS-85194830`): a site is keyed `<agency>-<number>` as USGS keys it;
  only USGS's own are held to eight to fifteen digits.
