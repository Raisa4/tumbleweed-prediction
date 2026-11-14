# Tumbleweed Trend Detective — NASA Space Apps

Read this whole file before doing anything. It is the single source of truth for the team. Four people each run their own Claude Code; this file keeps all of you building the same thing.

---

## 1. The contest

**NASA Space Apps hackathon** — we are in the middle of it now, time is short.
**Challenge: Earth science trends.** Build a tool that:
1. selects variables measured by NASA Earth science missions or models,
2. gets them for a specific region,
3. plots them as a time series long enough for statistics,
4. computes the rate of change and tests whether the trend is **significant** (Mann-Kendall, t-test, or confidence intervals).

The challenge's audience is high school / college students and the science-curious public ("data detectives"). It suggests: a few guiding questions for the user, simple definitions of each variable, and a couple of demo walkthroughs. A non-significant trend is still a valid, interesting result.

**Judges will check first:** do we really use NASA data, do we really show trends with significance tests, is it understandable, is it honest. Everything else is a bonus.

## 2. The problem we solve

In the dry western US, tumbleweeds (Russian thistle, kochia) grow on fallow, bare and disturbed land. When they dry out in autumn/winter, strong winds roll them into neighborhoods, roads and fire lines — burying homes (Victorville CA 2018: ~100 homes; South Jordan & Eagle Mountain UT 2024), closing highways (Hwy 240, WA, Dec 2019: ~10 h, cars trapped), and adding dry fuel. Farmers already handle tumbleweeds as routine weed control. **Cities, road crews, fire districts and homeowners are the ones taken by surprise** — they only ever clean up after the wind event.

## 3. The impact we aim for

Move those groups from cleanup to prevention: show whether tumbleweed conditions are trending worse in their area, where this season's plants come from, and where they will pile up — early enough to mow before seeding, clear piles, or stage crews before a wind event. For the challenge audience: show how NASA data reveals real, statistically tested trends behind a weird local problem.

## 4. How we solve it

1. **Trend engine (the core — this is what wins the challenge).** For 3 known pile-up hotspots, take 2001–2025 NASA data — spring rainfall (GPM), vegetation greenness (MODIS), autumn soil moisture (GLDAS), windy-day counts (MERRA-2), bare/open land (MODIS land cover) — and run Mann-Kendall + Sen's slope on each, plus on a combined **Tumbleweed Conditions Index**.
2. **Backtest.** Check whether the index was high in the seasons before real, news-reported pile-ups.
3. **Pile-up map (bonus layer).** Seed sources from past sightings (GBIF) + open land; push them downwind using real wind directions; mark where they stop against buildings/fences.
4. **Website** that guides users by role and region, explains each variable simply, and runs a guided demo.

**Users:** city / road crews / fire districts → pile-up map. Farmers → seed-source layer. Students → trend explorer.

## 5. Honesty rules (put these in the pitch, never contradict them in UI text)

- Satellites can't see individual tumbleweeds (0.5–2 m plants vs 250–500 m pixels). We model **conditions and habitat**, not plants.
- MERRA-2 wind is ~50 km resolution: regional wind seasons, not street-level paths.
- The tumbling wind threshold is an **assumption**, exposed as a slider.
- Validation = backtest against ~10 news-reported pile-ups: a plausibility check, not an accuracy score.
- **Do NOT claim:** a fire probability %, insurer use cases, that we detect tumbleweeds from space.

---

## 6. Team — who does what

**Stay in your own folder.** Contracts in section 7 change only after the whole team agrees. Build against fixture files (fake data, same schema) until real data arrives; swapping in real data must not require code changes.

### Person A — NASA data collector · `data/`, `scripts/`
**Job:** download NASA data for the 3 regions and reduce it to one value per year per variable, plus hourly wind.
**Order of work (others depend on you):**
1. Submit the AppEEARS area request by hand immediately (3 bboxes, MOD13Q1.061 NDVI + MCD12Q1.061 LC_Type1, 2001–2025) — it queues.
2. **`wind.csv` first** (Person C is blocked on it): MERRA-2 hourly M2T1NXSLV U10M/V10M, region mean → speed + direction toward.
3. `windy_days`, `spring_precip` (GPM_3IMERGM, convert mm/hr → mm/month, sum Mar–May), `autumn_soilm` (GLDAS Noah 0.25° monthly, SoilMoi0_10cm_inst, Sep–Nov mean).
4. `peak_ndvi_anom`, `barren_frac` from the AppEEARS exports in `data/raw/`.
Use `earthaccess`; subset to bbox before loading; one function per variable, one `main` over regions. If a source isn't working within 45 min, switch to Giovanni area-averaged CSV exports and tell the team.
**Done when:** all 3 regions have real `annual.csv` (5 variables × 25 years, no gaps) and `wind.csv`, committed, fixtures replaced.

### Person B — Analyst / backend · `backend/` (Andrei)
**Job:** answer the challenge's question — is it getting worse, by how much, is it significant — and serve everything to the frontend.
**Build:** `backend/main.py` (FastAPI) + `backend/stats.py`.
- `stats.analyze(years, values) -> dict`: `pymannkendall.hamed_rao_modification_test` (trend, p; handles autocorrelation) + `pymannkendall.sens_slope` (slope, 95% CI) + plain-English verdict. Reused by `/trend` and `/index`.
- Index: z-score each variable, flip `autumn_soilm` (drier = worse), mean.
- Backtest: per event, index of the season ending before the event, rank among all years.
- All endpoints in section 7; CORS for localhost:5173; read data files per request.
- pytest: known upward fixture → significant; flat → not; soil-moisture sign flip correct.
**Done when:** all endpoints return real data for 3 regions, tests pass, and you can state one line per region (e.g. "windy_days increasing, p=0.03; 2024 index ranked 2nd of 25").

### Person C — Map maker · `geo/`
**Job:** show where tumbleweeds come from and where wind piles them up.
**Can start immediately — only the final pile-up run needs A's `wind.csv`.** Until then, use a fake `wind.csv` (same columns, winds mostly toward east) and rerun when the real one lands.
**Build:** `geo/build.py`, per region:
- Sources: GBIF occurrence API in bbox — query ALL names: Salsola tragus, Salsola kali, Salsola kali subsp. tragus, Kali tragus, Salsola iberica, Bassia scoparia, Kochia scoparia (paginate) — plus iNaturalist research-grade and needs-ID observations (genus Salsola + Bassia scoparia, open coordinates only, deduplicated against GBIF), plus OSM landuse farmland/brownfield/greenfield/construction/meadow and natural scrub/grassland/heath (osmnx). 250 m grid; weight = normalized sighting density + suitable-land flag → `sources.geojson`.
- Barriers: OSM buildings + barrier=fence/wall on the same grid.
- Pile-ups for thresholds t = 8,10,12,14,16 m/s: hours with speed ≥ t → 8-bin direction histogram; per bin push source weight downwind with numpy array shifts up to 4 km, accumulating where it hits barrier cells; sum bins by frequency; normalize to `risk` 0–1; export cells with risk > 0.05 → `pileup_{t}.geojson`.
- Fill `data/{region}/events.csv` (geocode): Victorville CA Apr 2018; West Jordan UT Apr 2018; Eagle Mountain UT Apr 2018; South Jordan UT 2021; South Jordan UT Mar 2024; Eagle Mountain UT Mar 2024; Hwy 240 West Richland WA 2019-12-31. Use real source URLs.
**Done when:** 3 regions × (1 sources + 5 pile-up) GeoJSON committed, hotspots sit on built-up edges downwind of open land, events file filled.

### Person D — Face of the project · `frontend/` + pitch
**Job:** the website people use and everything the judges see.
**Build:** React + Vite + TS, react-leaflet, recharts, backend at http://localhost:8000 (fixtures work from minute one).
- Onboarding: "Who are you?" (city/fire, farmer, student) + "Where?" → main view. Role sets default focus: city/fire → map, farmer → sources, student → trends.
- Left: Tumbleweed Conditions Index card on top, then variable cards with one-sentence plain definitions; click → line chart + Sen's slope line + badge (significant ↑/↓ or not significant) + verdict text.
- Right: map with sources + pile-up layers, wind-threshold slider (8–16, step 2) swapping pile-up files, event markers with popups.
- Guided demo: "Why did South Jordan get buried in 2024?" → index trend → event marker → pile-up layer.
- Few small components, no state library, no UI kit.
**Midway:** check Space Apps submission requirements; draft slides + video.
**Done when:** runs (deployed or local) on real data, guided demo works end-to-end with no errors, slides + video drafted, submission page ready.

### Dependencies at a glance
- A → B (`annual.csv`, `events.csv` via C), A → C (`wind.csv`), B + C → D.
- Nobody waits: everyone builds on fixtures first.

### Checkpoints
- **~2h:** real data for 1 region flows A → B → D end to end.
- **~5h:** all 3 regions, maps visible, backtest numbers in hand.
- **Freeze 6h before deadline:** bug fixes, deploy, pitch only.

**Finished product:** pick a region → see which NASA-measured drivers are significantly trending → see the index's rank in a real pile-up year → see on the map where tumbleweeds pile up at a chosen wind speed.

---

## 7. Contracts

### Regions — `data/regions.json`
```json
[
  {"id": "salt_lake_valley", "name": "Salt Lake Valley, UT", "bbox": [-112.20, 40.30, -111.80, 40.80]},
  {"id": "victorville",      "name": "Victorville, CA",      "bbox": [-117.50, 34.40, -117.20, 34.65]},
  {"id": "tri_cities_wa",    "name": "Tri-Cities, WA",       "bbox": [-119.50, 46.10, -119.00, 46.40]}
]
```
bbox = [west, south, east, north], WGS84.

### `data/{region}/annual.csv` — years 2001–2025
```
year,variable,value
```
| variable | meaning | source | unit |
|---|---|---|---|
| `spring_precip` | total precipitation Mar–May | GPM IMERG | mm |
| `peak_ndvi_anom` | peak growing-season NDVI anomaly vs 2001–2025 mean, grass/shrub/barren pixels | MODIS MOD13Q1 | NDVI |
| `autumn_soilm` | mean topsoil moisture Sep–Nov (lower = drier = worse) | GLDAS Noah | kg/m² |
| `windy_days` | days Nov(prev yr)–Apr with daily max 10 m wind ≥ 8 m/s (12 m/s gave mostly 0s on the ~50 km grid) | MERRA-2 via NASA POWER | days |
| `barren_frac` | fraction of region barren / open shrub / grassland | MODIS MCD12Q1 | 0–1 |

### `data/{region}/wind.csv` — hourly, Nov–Apr seasons
```
time,speed_ms,dir_deg
```
`dir_deg` = direction the wind blows TOWARD (0 = N, 90 = E).

### `data/{region}/events.csv`
```
date,place,lat,lon,source_url
```

### Geo outputs
`geo/output/{region}/sources.geojson` (property `weight` 0–1), `geo/output/{region}/pileup_{t}.geojson` (property `risk` 0–1), t ∈ {8,10,12,14,16}.

### API — FastAPI, port 8000, CORS on
- `GET /regions` → `regions.json`
- `GET /trend?region={id}&var={variable}` →
  ```json
  {"region": "...", "var": "...", "years": [2001], "values": [0.0],
   "slope": 0.0, "ci_low": 0.0, "ci_high": 0.0, "p": 0.0,
   "trend": "increasing|decreasing|no trend", "significant": true,
   "verdict": "Increasing by 0.8 days/yr — significant (p=0.01)"}
  ```
  Significance: p < 0.05.
- `GET /index?region={id}` → same shape, for the Tumbleweed Conditions Index
- `GET /backtest?region={id}` → `[{"date", "place", "index_value", "rank", "of_years"}]`
- `GET /layers/{region}/sources.geojson`
- `GET /layers/{region}/pileup.geojson?threshold={t}`

---

## 8. Code style — succinct, working code only

- Write the shortest code that works. No dead code, no unused params, no speculative abstractions, no wrapper classes around one function.
- Vectorize with pandas / numpy / xarray. No Python loops over pixels or rows.
- No try/except that swallows errors. Fail loudly.
- No comments that restate the code; one-line docstring max per public function.
- One file per module until it passes ~300 lines.
- No new dependency without a real need.
- Before finishing any task: run it, delete anything unused, make sure every line is exercised.
- Tests: a few meaningful pytest cases, not boilerplate.

## 9. Git

- Commit small and often with clear messages; pull before every new task.
- Only processed, small files are committed. Raw downloads → `data/raw/` (gitignored). Never commit credentials (`.env`, `.netrc`).

## 10. Run

```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
cd frontend && npm install && npm run dev
```
