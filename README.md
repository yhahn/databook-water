# New York's streams

Every stream gauge USGS keeps in New York that has daily means of its
discharge or gage height, or annual peaks: 912 sites in 60
counties, 696 of them with daily means (8,058,679 days, the
first 1887-10-01), 29,700 annual peaks (the floods), and
456,135 field measurements (the visits that check a gauge). Today's
readings come from the same API as a live source (below), so a river's
flow now can be laid beside every day it has flowed before.

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

A site's `Locality` is the place it stands in, a city, village or hamlet
as people name it ('Margaretville, NY'), not New York's civil town; its
`Locality ID` (`us/ny/margaretville`) is placescope's, from its maps
(release edb7a35d80cb6499) at the site's point: 501 localities,
blank for 2 sites on water the maps name none for.
Join on the id, never the name: `locality_at(lat, lon, 'id')` answers the
same id in proper, so a gauge joins a hotspot, a photo or a sighting by
place.

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
from Site where County = 'Greene County'
order by "Drainage area" desc nulls last
```

The greatest floods in the record:

```sql
select s.name, p."Water year", p.Date, p.Discharge, p."Discharge codes"
from Site_Peaks p join Site s using (_file)
where p.Discharge is not null
order by p.Discharge desc limit 10
```

SCHOHARIE CREEK AT PRATTSVILLE NY (the longest record still reporting, since 1902-11-09) on this day, every year it was gauged:

```sql
select d.Day, d.Discharge, d."Discharge approval", d."Discharge codes"
from Water_Year_Days d join "Water Year" w using (_file)
where w."Site ID" = 'USGS-01350000'
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
| DEBRIS | affected by debris |
| DIFFDATUM | gage height at another site or datum than now |
| DISCONTINUED | the series discontinued |
| EQUIP | equipment malfunction |
| ESTIMATED | estimated |
| EVENT | a peak from an event: snowmelt, a hurricane, an ice jam or a debris dam breaking |
| FLOOD | affected by flood damage to the gauge |
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
| RATINGDEV | the rating (stage to discharge) being developed or revised |
| REGULATED | affected by regulation or diversion |
| REVISED | revised after it was first published |
| SEASONAL | a seasonal record: the gauge runs part of the year |
| TEST | affected by a test at the gauge |
| UNAVAIL | the value unavailable |
| UNKNOWNREGULATION | affected to an unknown degree by regulation or diversion |
| URBAN | affected by urbanization, mining, farming or channel changes |
| YEARUNKNOWN | year not known |
| ZEROFLOW | no flow |

## Changes

A change USGS marks in what a number means is a record in `Changes.md`
(83 records, 180 datum changes in all): the gauge's
datum moved in a year, so gage heights before and after are not alike.
Nothing is split or adjusted; the peak is marked, as USGS marks it.
The years: 1911 (2 sites); 1913 (1 site); 1916 (2 sites); 1920 (1 site); 1921 (3 sites); 1923 (1 site); 1924 (1 site); 1925 (2 sites); 1927 (2 sites); 1931 (1 site); 1933 (1 site); 1934 (1 site); 1936 (1 site); 1937 (6 sites); 1938 (1 site); 1939 (5 sites); 1940 (4 sites); 1941 (4 sites); 1942 (1 site); 1943 (1 site); 1944 (2 sites); 1945 (1 site); 1947 (2 sites); 1949 (1 site); 1951 (2 sites); 1953 (3 sites); 1954 (4 sites); 1955 (3 sites); 1956 (3 sites); 1957 (2 sites); 1958 (4 sites); 1959 (3 sites); 1961 (1 site); 1963 (5 sites); 1964 (5 sites); 1965 (2 sites); 1966 (1 site); 1967 (2 sites); 1968 (2 sites); 1969 (3 sites); 1970 (3 sites); 1971 (2 sites); 1972 (4 sites); 1973 (1 site); 1974 (6 sites); 1975 (4 sites); 1977 (3 sites); 1978 (1 site); 1979 (1 site); 1980 (3 sites); 1981 (2 sites); 1983 (3 sites); 1985 (1 site); 1986 (2 sites); 1987 (2 sites); 1991 (1 site); 1992 (1 site); 1994 (1 site); 1996 (4 sites); 1997 (4 sites); 1998 (1 site); 1999 (2 sites); 2001 (2 sites); 2002 (1 site); 2003 (1 site); 2004 (2 sites); 2005 (3 sites); 2006 (1 site); 2007 (1 site); 2009 (3 sites); 2010 (2 sites); 2011 (2 sites); 2012 (2 sites); 2013 (1 site); 2014 (2 sites); 2015 (2 sites); 2017 (2 sites); 2018 (2 sites); 2019 (3 sites); 2020 (1 site); 2021 (1 site); 2024 (1 site); 2025 (1 site).

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
