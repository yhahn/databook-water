-- V3: what proper gathers, checked against what the importer wrote and read
-- (.import/water/counts.json) and against the rules (SPEC B, K, D). Each
-- check: a name, what it should give ({x} read from counts.json), and one
-- query giving one value. Played by .import/target.js with `proper query`.

-- name: B3 the keys of Site
-- want: Site ID, Number, Agency, Type, County, County code, State, HUC, Latitude, Longitude, Locality, Locality ID, Drainage area, Contributing area, Altitude, Altitude datum, Time zone, Daily from, Daily to, Discharge days, Gage height days, Discharge series, Gage height series, Peaks, Peaks from, Peaks to, Field measurements, Revisions
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Site' and column_name not in ('name', '_file', '_line', '_end_line');

-- name: K2 sites' localities, by placescope's id, as the importer counted
-- want: {localities}
select count(distinct "Locality ID") from Site;

-- name: B3 the keys of Water Year
-- want: Site ID, Site, Water year, From, To, Days, Discharge days, Gage height days, Provisional
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Water Year' and column_name not in ('name', '_file', '_line', '_end_line');

-- name: B3 the keys of County and State
-- want: County code, State, Sites / State code, Counties, Sites
select (select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
  where table_name = 'County' and column_name not in ('name', '_file', '_line', '_end_line')) || ' / ' ||
  (select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
  where table_name = 'State' and column_name not in ('name', '_file', '_line', '_end_line'));

-- name: B3 the keys of Change
-- want: What, Year, Boundary, Was, Now, Crosswalk, Places, Source
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Change' and column_name not in ('name', '_file', '_line', '_end_line');

-- name: B4 the days' columns, the same in every year's page
-- want: Day, Discharge, Discharge approval, Discharge codes, Gage height, Gage height approval, Gage height codes
select string_agg(column_name, ', ' order by ordinal_position) from information_schema.columns
where table_name = 'Water_Year_Days' and column_name not in ('record', '_file', '_line');

-- name: B5 the kinds
-- want: Change, County, Site, State, Water Year
select string_agg(distinct table_name, ', ' order by table_name) from information_schema.columns
where column_name = '_end_line';

-- name: Sites, one a Site ID (K2: USGS's key, kept whole)
-- want: {sites} {sites}
select count(*) || ' ' || count(distinct "Site ID") from Site;

-- name: Sites with daily means
-- want: {withDaily}
select count(*) from Site where nullif(cast("Daily from" as varchar), '') is not null;

-- name: Counties
-- want: {counties}
select count(*) from County;

-- name: Water years, a page each
-- want: {years}
select count(*) from "Water Year";

-- name: Days written, as the importer counted
-- want: {days}
select count(*) from Water_Year_Days;

-- name: Discharge days and gage height days, each against the rows read
-- want: {discharge} {gageHeight}
select count("Discharge approval") || ' ' || count("Gage height approval") from Water_Year_Days;

-- name: Days of the main series and of the others are every row read from USGS's daily series
-- want: {dailyRead}
-- (the other series' rows as the importer counted them: their table is
-- there only when a site has one)
select count("Discharge approval") + count("Gage height approval") + {other} from Water_Year_Days;

-- name: Peaks, by parameter, every peak of a site in the book
-- want: {peaksQ} {peaksGH}
select count(Discharge) || ' ' || count("Gage height") from Site_Peaks;

-- name: Peaks and the peaks with no site, every peak fetched
-- want: {fetched.peaks}
select count(Discharge) + count("Gage height") + {left.peaksNoSite} + {waiting.peaks} from Site_Peaks;

-- name: Field measurements, and those of sites not in the book, every one fetched
-- want: {fetched.field}
select count(*) + {left.fieldNotInBook} + {waiting.field} from Site_Field_measurements;

-- name: Every daily series of New York's sites is a site's main or other series, or waits
-- want: {seriesAll}
select count(nullif("Discharge series", '')) + count(nullif("Gage height series", '')) + {otherSeries} + {waiting.series} from Site;

-- name: A day's approval is Approved or Provisional, never blank beside a value
-- want: 0
select count(*) from Water_Year_Days where (Discharge is not null and "Discharge approval" is null) or ("Gage height" is not null and "Gage height approval" is null);

-- name: Every water year's days fall in it (October to September)
-- want: 0
select count(*) from Water_Year_Days d join "Water Year" w using (_file)
where d.Day < make_date(w."Water year" - 1, 10, 1) or d.Day > make_date(w."Water year", 9, 30);

-- name: D5 a change a year, its places every datum change USGS marks
-- want: {changes} {datumSites}
select count(*) || ' ' || sum(Places) from Change;

-- name: Pages
-- want: {pages}
select count(*) from files where path like '%.md' and path not like 'README.md';
