# New York's streams

Every stream gauge USGS keeps in New York that has daily means of its
discharge or gage height, or annual peaks: 511 sites in 58
counties, 300 of them with daily means (3,368,285 days, the
first 1887-10-01), 14,270 annual peaks (the floods), and
195,201 field measurements (the visits that check a gauge). Today's
readings come from the same API as a live source (below), so a river's
flow now can be laid beside every day it has flowed before.

**Not yet whole.** 401 more sites (415 daily series)
wait on USGS's limit of 1,000 asks an hour for a program with no key;
their pages come with the next run of the importer, once fetched. The
counts here are of what is written.

Written by its importer (`.import/`, `sh .import/build.sh`) from USGS's
Water Data API as it stood on 2026-10-14; nothing here is edited by hand.
A databook (~/Projects/databooks): printable as a book, queryable as tables.

## How it is laid out

- `New York.md`: the counties, each linked.
- `New York/<County>.md`: the county's sites, each linked.
- `New York/<County>/<Site>.md`: a site (`# Site:`): where it is, what it
  drains, its years in a table (each linked), its months as a card, its
  annual peaks, and its field measurements.
- `New York/<County>/<Site>/<water year>.md`: a water year (`# Water Year:`,
  October to September, as USGS keeps its books): a row a day, with the
  months as a card.
- `Changes.md`: what USGS marks as changed in what its numbers mean.

A site is keyed as USGS keys it: `Site ID`, `USGS-` and its number, the
number's leading zeros kept (`USGS-01362500`). Join on `Site ID`, never
on `Number`, `County code` or `HUC`: proper reads an all-digit code as
a number today and drops its leading zeros. Discharge is in cubic feet a
second, gage height in feet above the gauge's own datum. Every value is as
USGS gives it, Approved (final) or Provisional (may yet be revised), with
its codes beside it. A page's day table is joined to its page by the file:
`join "Water Year" w using (_file)`.

| Table | A row is |
|---|---|
| `Site` | a site |
| `Water Year` | a site's water year |
| `Water_Year_Days` | a day: Discharge, Gage height, each with its approval and codes |
| `Water_Year_Other_series` | a day of a second series of the same measure at a site, kept apart |
| `Site_Years` | a water year's mean, lowest and highest day, and its codes, counted |
| `Site_Peaks` | an annual peak: discharge and gage height at that moment |
| `Site_Field_measurements` | a reading on a visit: discharge, mean gage height, or a reference reading |
| `County`, `State` | the listings |
| `Change` | a change USGS marks, a record a year |

## Queries

The sites of a county, the largest first:

```sql
select name, "Site ID", "Drainage area", "Daily from", "Daily to"
from Site where County = 'Chemung County'
order by "Drainage area" desc nulls last
```

The greatest floods in the record:

```sql
select s.name, p."Water year", p.Date, p.Discharge, p."Discharge codes"
from Site_Peaks p join Site s using (_file)
where p.Discharge is not null
order by p.Discharge desc limit 10
```

CHEMUNG RIVER AT CHEMUNG NY (the longest record still reporting, since 1903-09-07) on this day, every year it was gauged:

```sql
select d.Day, d.Discharge, d."Discharge approval", d."Discharge codes"
from Water_Year_Days d join "Water Year" w using (_file)
where w."Site ID" = 'USGS-01531000'
  and month(d.Day) = month(today()) and day(d.Day) = day(today())
order by d.Day desc
```

Ice: the winters with the most days a gauge read under ice, statewide:

```sql
select w."Water year", count(*) as "Ice days", count(distinct w."Site ID") as sites
from Water_Year_Days d join "Water Year" w using (_file)
where d."Discharge codes" like '%ICE%'
group by 1 order by 2 desc limit 10
```

**Now against the past.** Each river's flow now (the live source) beside
every year's flow on the same day (the book), wettest first:

```sql
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
```

## The live source

`.source/` is a source as data (proper-sources SPEC A5): `usgs_water.latest`,
each New York gauge's newest reading of discharge and gage height, from
USGS's latest-continuous, about 800 series in one ask, no key. Installed
from this repo at its commit, caught up, and turned on:

```
proper sources add ~/Projects/databook-water/.source
proper sources catch-up usgs_water
```

and in `.proper/README.md`, `# Sources` with `- usgs_water: on`; then it
is `source_usgs_water.latest` (site, parameter, day, start, value, unit,
approval, codes), keyed by site, parameter and start, so each catch-up adds
the readings newer than the last. A live reading is provisional; the book
holds the daily means, approved in time, and is the importer run again.

## Codes

As USGS writes them, on a day, a peak or a reading. USGS's API gives no
description of them yet ("not currently available"); these are read from
their names and USGS's older code tables.

| Code | Means |
|---|---|
| APPROVED | approved: reviewed and final |
| BACKWATER | affected by backwater |
| BLWMIN | below the minimum the gauge records |
| DAMFAILURE | a dam failed |
| DATUMCHANGE | the gauge's datum changed this year |
| DAYUNKNOWN | day not known |
| DIFFDATUM | gage height at another site or datum than now |
| DISCONTINUED | the series discontinued |
| EQUIP | equipment malfunction |
| ESTIMATED | estimated |
| EVENT | a peak from an event: snowmelt, a hurricane, an ice jam or a debris dam breaking |
| FORCEINTERPOLATION | interpolated across a gap |
| GHNOTASSCPKQ | gage height not at the peak discharge |
| GREATERTHAN | greater than the value given |
| HISTORIC | a historic peak, outside the gauged years |
| ICE | affected by ice |
| LESSTHAN | less than the value given |
| MAINT | the gauge under maintenance |
| MAXDAILYMEAN | the peak is the highest daily mean, not the instant |
| MONTHUNKNOWN | month not known |
| NOTMAXGH | not the year's highest gage height |
| OPPORTUNISTIC | measured by chance, not by the gauge's routine |
| OTHERAGENCY | given by another agency |
| REGULATED | affected by regulation or diversion |
| REVISED | revised after it was first published |
| SEASONAL | a seasonal record: the gauge runs part of the year |
| UNAVAIL | the value unavailable |
| UNKNOWNREGULATION | affected to an unknown degree by regulation or diversion |
| URBAN | affected by urbanization, mining, farming or channel changes |
| YEARUNKNOWN | year not known |
| ZEROFLOW | no flow |

## Changes

A change USGS marks in what a number means is a record in `Changes.md`
(54 records, 78 datum changes in all): the gauge's
datum moved in a year, so gage heights before and after are not alike.
Nothing is split or adjusted; the peak is marked, as USGS marks it.
The years: 1911 (1 site); 1921 (1 site); 1925 (1 site); 1933 (1 site); 1937 (1 site); 1938 (1 site); 1939 (3 sites); 1940 (3 sites); 1941 (1 site); 1942 (1 site); 1943 (1 site); 1944 (1 site); 1947 (1 site); 1953 (1 site); 1954 (1 site); 1955 (2 sites); 1956 (2 sites); 1958 (1 site); 1959 (1 site); 1963 (3 sites); 1964 (3 sites); 1965 (1 site); 1967 (1 site); 1970 (1 site); 1971 (1 site); 1972 (3 sites); 1973 (1 site); 1974 (5 sites); 1975 (2 sites); 1977 (2 sites); 1979 (1 site); 1980 (1 site); 1981 (1 site); 1986 (1 site); 1987 (1 site); 1991 (1 site); 1994 (1 site); 1996 (3 sites); 1997 (2 sites); 1999 (1 site); 2001 (1 site); 2002 (1 site); 2003 (1 site); 2004 (2 sites); 2005 (3 sites); 2007 (1 site); 2009 (1 site); 2011 (1 site); 2012 (1 site); 2013 (1 site); 2017 (1 site); 2018 (1 site); 2024 (1 site); 2025 (1 site).

USGS's notes on a site's published history (a datum revised, a record
revised, a drainage area changed) are on each site's page as `Revisions`,
as USGS wrote them. USGS's API does not say where a site moved or was
renumbered; none is guessed.

## What is left out

- Sites with only field measurements, or no discharge or gage height:
  27,640 field measurements of sites not in the book.
- 27 peaks of sites USGS lists as in New York's peaks
  but not among its surface-water sites (wells, springs and the like).
- The 15-minute record (USGS's continuous values): the live source holds
  the newest reading; the record itself is a later book's.

## Source

U.S. Geological Survey, Water Data for the Nation: the Water Data APIs
(https://api.waterdata.usgs.gov/ogcapi/v1): monitoring-locations,
time-series-metadata, daily, peaks, field-measurements, latest-continuous.
USGS data are in the public domain (USGS Government Work; the daily
collection's license is CC0-1.0). USGS: provisional data are subject to
revision; recent data have not been reviewed and may be changed or removed.
