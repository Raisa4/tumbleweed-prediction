# Slides — Tumbleweed Trend Detective (7 slides, ~3 min)

Fill every `[TODO]` from the live app once real data is in (`npm run dev:live`). Never quote fixture numbers.

## 1 · The hook
- Photo: South Jordan (Daybreak), 2 March 2024: streets blocked by tumbleweeds (Deseret News).
- Line: "Every few years, towns in the dry West get buried by tumbleweeds. Is it getting worse?"

## 2 · The problem
- Victorville CA 2018: 100–150 homes affected. SR 240, WA, 31 Dec 2019: road closed 10 h, cars trapped. South Jordan & Eagle Mountain UT 2024.
- Farmers already treat it as routine weed control. Cities, road crews and fire districts only ever clean up afterwards.

## 3 · The science chain (one picture, five arrows)
| Link | NASA data | Why it matters |
|---|---|---|
| Wet spring | GPM IMERG rainfall | seedlings sprout |
| Green summer | MODIS NDVI | plants bulk up |
| Dry autumn | GLDAS soil moisture | plants go brittle, snap off |
| Windy winter | MERRA-2 wind | wind rolls them into towns |
| Open land | MODIS land cover | room to grow |

Say it out loud: **satellites can't see tumbleweeds (1–2 m plant vs 250–500 m pixel). We measure the conditions they need.**

## 4 · The trend test (the challenge core)
- 25 years (2001–2025), 3 regions, Mann-Kendall test (Hamed–Rao, corrects for autocorrelation) + Sen's slope with 95% CI.
- Screenshot: index chart for Salt Lake Valley with the trend line.
- Results, one line per region: `[TODO from /index and /trend]`
- "Not significant" is a real result: the change can't be told apart from noise.

## 5 · Reality check (backtest)
- For every news-reported pile-up: where did the season before it rank among 25 years?
- `[TODO: e.g. "South Jordan 2024: season ranked Xth of 25"; "N of M events followed a top-20% season"]`
- A plausibility check on ~8 events, not an accuracy score.

## 6 · Where they pile up (live demo)
- Map: green = seed sources (GBIF + iNaturalist sightings, OSM open land), red = where real wind directions push them into buildings and fences, yellow = real events.
- Slider: wind threshold is an assumption, so we expose it.
- Use: cities and fire districts mow and clear before the wind season, not after.

## 7 · Honest limits + what's next
- MERRA-2 wind ~50 km: regional wind seasons, not street paths.
- Threshold is an assumption; backtest is small.
- Next: more regions, finer wind (HRRR), add a seasonal outlook.
- Team, link to the app, link to the repo.
