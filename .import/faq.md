# The book's questions: databook-water

The questions a good reader of this book can answer, a paddler's, an
angler's or a town planner's (SPEC B9), written by hand and only ever added
to: a question changed is a new question, under a new id. Each: its Tier
(BENCH.md's ladder), Ask, Type (number, set, list, none, judge),
Tolerance, the Rules it probes, How its answer is worked out from USGS's
files, and Look in, the pages where a reader finds it (several split by
"; "; none for a Gap question). `.import/faq.js` works out each answer
from USGS's files as fetched, never from the book, and writes FAQ.md.
Discharge is in cubic feet a second. First written 2026-10-15.

### Question: wa-lookup-1
- Tier: Lookup
- Ask: What was the daily mean discharge of Schoharie Creek at Prattsville on 2011-08-28?
- Type: number
- Tolerance: 0
- Rules: D8
- How: the daily discharge series of USGS-01350000, 2011-08-28
- Look in: New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY/2011.md

### Question: wa-lookup-2
- Tier: Lookup
- Ask: How much water was Esopus Creek at Coldbrook carrying on 2023-12-18, as a daily mean?
- Type: number
- Tolerance: 0
- Rules:
- How: the daily discharge series of USGS-01362500, 2023-12-18
- Look in: New York/Ulster County/ESOPUS CREEK AT COLDBROOK NY/2024.md

### Question: wa-lookup-3
- Tier: Lookup
- Ask: What is the greatest flood on record at Schoharie Creek at Prattsville: its peak discharge, and the day?
- Type: number
- Tolerance: 0
- Rules:
- How: the annual peaks of USGS-01350000, the greatest discharge
- Look in: New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY.md

### Question: wa-lookup-4
- Tier: Lookup
- Ask: How large an area, in square miles, drains to the Hudson River gauge at Green Island?
- Type: number
- Tolerance: 0
- Rules:
- How: the monitoring location USGS-01358000, its drainage area
- Look in: New York/Albany County/HUDSON RIVER AT GREEN ISLAND NY.md

### Question: wa-page-1
- Tier: Page
- Ask: In which county is the gauge on the Saw Mill River at Yonkers?
- Type: set
- Tolerance:
- Rules: B7
- How: the monitoring location named SAW MILL RIVER AT YONKERS NY, its county
- Look in: New York/Westchester County.md; New York/Westchester County/SAW MILL RIVER AT YONKERS NY.md

### Question: wa-page-2
- Tier: Page
- Ask: What was the mean discharge of the Ausable River near Au Sable Forks over water year 2020, to three figures?
- Type: number
- Tolerance: 0
- Rules: B7
- How: the daily discharge series of USGS-04275500, 2019-10-01 to 2020-09-30, the mean, to three significant figures
- Look in: New York/Clinton County/AUSABLE RIVER NEAR AU SABLE FORKS NY.md

### Question: wa-page-3
- Tier: Page
- Ask: How many stream gauges does the book list in Greene County?
- Type: number
- Tolerance: 0
- Rules: B7
- How: the monitoring locations in Greene County with a daily series or an annual peak
- Look in: New York/Greene County.md

### Question: wa-across-1
- Tier: Across
- Ask: Which gauges stand on Esopus Creek? Give their site IDs, from its head downstream.
- Type: list
- Tolerance:
- Rules: K1
- How: the locations named for Esopus Creek, by drainage area, smallest first
- Look in: New York/Ulster County.md

### Question: wa-across-2
- Tier: Across
- Ask: Which county's gauges have run the longest, counting every day of daily record at every gauge in it?
- Type: set
- Tolerance:
- Rules:
- How: every daily series, its days counted, summed by the site's county
- Look in: New York.md; New York/Delaware County.md

### Question: wa-across-3
- Tier: Across
- Ask: Which gauges have the oldest daily record in the book, and from what day?
- Type: set
- Tolerance:
- Rules:
- How: every daily series, its first day, the earliest
- Look in: New York/Saratoga County/HUDSON RIVER AT MECHANICVILLE NY.md; New York/Saratoga County/HUDSON RIVER ABOVE LOCK 1 NEAR WATERFORD NY.md

### Question: wa-across-4
- Tier: Across
- Ask: Which site has the greatest annual peak discharge in the book, and what kind of number is it?
- Type: judge
- Tolerance:
- Rules: D8
- How: every site's annual peaks of discharge, the greatest, with its codes
- Look in: New York/St. Lawrence County/ST. LAWRENCE R AT CORNWALL ONT NR MASSENA NY.md

### Question: wa-join-1
- Tier: Join
- Ask: At Schoharie Creek at Prattsville, how did the peak of its greatest flood compare with that day's mean discharge?
- Type: list
- Tolerance: 0
- Rules:
- How: the annual peaks and the daily series of USGS-01350000, on the day of the greatest peak
- Look in: New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY.md; New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY/2011.md

### Question: wa-join-2
- Tier: Join
- Ask: What is the largest discharge USGS has measured on a visit to Esopus Creek at Coldbrook, on what day, and what was the daily mean that day?
- Type: list
- Tolerance: 0
- Rules:
- How: the field measurements of USGS-01362500, the largest discharge reading, and the daily series on its day
- Look in: New York/Ulster County/ESOPUS CREEK AT COLDBROOK NY.md; New York/Ulster County/ESOPUS CREEK AT COLDBROOK NY/1951.md

### Question: wa-change-1
- Tier: Change
- Ask: Can the gage heights of the Sacandaga River at Stewarts Bridge near Hadley be compared across its whole record? In which water years did its gauge's datum change?
- Type: judge
- Tolerance:
- Rules: D3, D5
- How: the annual peaks of gage height at USGS-01325000 coded DATUMCHANGE
- Look in: Changes.md; New York/Saratoga County/SACANDAGA RIVER AT STEWARTS BRIDGE NR HADLEY NY.md

### Question: wa-change-2
- Tier: Change
- Ask: How many of Schoharie Creek at Prattsville's daily means in water year 2026 are provisional, and what does that mean for them?
- Type: judge
- Tolerance:
- Rules: D8
- How: the daily discharge series of USGS-01350000, water year 2026, its approval
- Look in: New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY/2026.md

### Question: wa-gap-1
- Tier: Gap
- Ask: What was the discharge of Schoharie Creek at Prattsville on 1902-10-15?
- Type: none
- Tolerance:
- Rules: D6
- How: its daily series begins 1902-11-09
- Look in:

### Question: wa-gap-2
- Tier: Gap
- Ask: How warm was Schoharie Creek at Prattsville on 2024-07-15?
- Type: none
- Tolerance:
- Rules: D7
- How: the book holds discharge and gage height only, no water temperature
- Look in:

### Question: wa-gap-3
- Tier: Gap
- Ask: What was the discharge of Schoharie Creek at Prattsville at three in the afternoon of 2011-08-28?
- Type: none
- Tolerance:
- Rules: D7
- How: the book holds daily means and annual peaks, not the 15-minute record
- Look in:

### Question: wa-gap-4
- Tier: Gap
- Ask: What was the daily mean discharge of the Delaware River at Trenton on 2011-08-29?
- Type: none
- Tolerance:
- Rules: D7
- How: the book is New York's gauges; Trenton is in New Jersey
- Look in:

### Question: wa-nearby-1
- Tier: Nearby
- Ask: Which other gauge with daily discharge stands nearest to the Schoharie Creek gauge at Prattsville?
- Type: set
- Tolerance:
- Rules:
- How: every site with a daily discharge series, by distance from USGS-01350000's point
- Look in: New York/Delaware County/BEAR KILL NEAR PRATTSVILLE NY.md

### Question: wa-nearby-2
- Tier: Nearby
- Ask: Which is the next gauge downstream of Prattsville on Schoharie Creek?
- Type: set
- Tolerance:
- Rules:
- How: the locations named for Schoharie Creek, the least drainage area above Prattsville's
- Look in: New York/Schoharie County/SCHOHARIE CREEK AT GILBOA NY.md

### Question: wa-analysis-1
- Tier: Analysis
- Ask: Which was New York's wettest water year? Take every gauge with thirty full years of daily discharge or more, find each one's wettest year (its highest mean), and say which year most share.
- Type: number
- Tolerance: 0
- Rules:
- How: every daily discharge series, each full water year's mean, the highest at each site of thirty such years or more, counted by year
- Look in: New York.md

### Question: wa-analysis-2
- Tier: Analysis
- Ask: What is the median daily discharge of Schoharie Creek at Prattsville in each month, over its whole record, October first?
- Type: list
- Tolerance: 0
- Rules:
- How: the daily discharge series of USGS-01350000, every day by its month, the median
- Look in: New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY.md

### Question: wa-analysis-3
- Tier: Analysis
- Ask: Are Schoharie Creek's floods at Prattsville growing? Compare its median annual peak in water years 1951 to 1980 with 1996 to 2025.
- Type: judge
- Tolerance:
- Rules:
- How: the annual peaks of USGS-01350000, the median of each span
- Look in: New York/Greene County/SCHOHARIE CREEK AT PRATTSVILLE NY.md
