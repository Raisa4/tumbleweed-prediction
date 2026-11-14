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
5. **Prediction vs reality (hindcast).** Prove the method on seasons it has not seen: predict 2023 and 2024 from earlier years only and compare with what really happened (section 4b).

**Users:** city / road crews / fire districts → pile-up map. Farmers → seed-source layer. Students → trend explorer.

### Seasons (applies everywhere)
Season Y = plants grow and dry in year Y, tumble Nov Y–Apr Y+1. It joins `spring_precip`, `peak_ndvi_anom`, `autumn_soilm`, `barren_frac` of year Y with `windy_days` labelled Y+1. A pile-up in Jan–Oct belongs to the previous season, Nov–Dec to the same year (e.g. 2024-03-02 South Jordan → season 2023, 2019-12-31 Hwy 240 → season 2019).

## 4b. Prediction vs reality (hindcast)

1. **Validation, 2011–2022 (rolling origin).** For each season T: train on 2001…T-1 only, predict T. Compare three forecasters per variable and for the index: training **mean** (baseline), **Sen trend** extended one year, **TabPFN** (Prior Labs tabular foundation model, via API, no fine-tuning — ~22 rows per region is too few). Each gives a value + 95% prediction interval. Pick the best on these years only.
2. **Final test, seasons 2023 and 2024.** Run only the chosen forecaster, unchanged. 2023 is the headline demo: "would we have warned South Jordan before March 2024?"
3. **No leakage:** index z-scores use the training years' mean/std only; a test asserts that changing season T's real data does not change T's prediction.
4. **Frozen outputs:** predictions are written once to files with a `made_on` date and never silently recomputed.
5. **Map (C):** predicted = pile-up with the wind of all training seasons (climatology); actual = pile-up with season T's wind. Overlay GBIF/iNaturalist sightings observed in season T.
6. **Frontend (D):** "Prediction vs Reality" view per region and target season — table, chart (training series, forecast, interval band, actual point), predicted vs actual map side by side. Fixed size, all numbers visible without hover, so it can be screenshotted for the slides.
7. **Always show the validation score next to 2023/2024**, e.g. "2011–2022: real value inside our 95% interval 11 of 12 times; trend beat the average 7 of 12."

**TabPFN key:** `TAB_PFN_API_KEY` in the repo-root `.env` (gitignored). Read it from the environment; never hard-code, print, log or commit it. Data sent to the API is public NASA area averages only.
**TabPFN setup:** `tabpfn-client`, pinned `model_path="v3.5_default"`. One call per (region, season) for all 6 series: features = series name, season, last season's value, all z-scored with training stats; interval = 2.5% / 97.5% quantiles, point = median. ~4 s per call, 14 calls per region. `python backend/forecast.py mean sen` runs offline without TabPFN.

## 5. Honesty rules (put these in the pitch, never contradict them in UI text)

- Satellites can't see individual tumbleweeds (0.5–2 m plants vs 250–500 m pixels). We model **conditions and habitat**, not plants.
- MERRA-2 wind is ~50 km resolution: regional wind seasons, not street-level paths.
- The tumbling wind threshold is an **assumption**, exposed as a slider.
- Validation = backtest against ~10 news-reported pile-ups: a plausibility check, not an accuracy score.
- Hindcast: 12 validation + 2 test seasons is a demonstration, not an accuracy score. Single-year rain and wind are mostly unpredictable; say so when the real value falls outside the interval.
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

### Person B — Analyst / backend · `backend/` (Irina)
**Job:** answer the challenge's question — is it getting worse, by how much, is it significant — and serve everything to the frontend.
**Build:** `backend/main.py` (FastAPI) + `backend/stats.py`.
- `stats.analyze(years, values) -> dict`: `pymannkendall.hamed_rao_modification_test` (trend, p; handles autocorrelation) + `scipy.stats.theilslopes` (Sen's slope + 95% CI; `pymannkendall.sens_slope` has no CI) + plain-English verdict. Reused by `/trend` and `/index`.
- Index: z-score each variable, flip `autumn_soilm` (drier = worse), mean — per season (section 4 "Seasons").
- Backtest: per event, index of the season that grew its plants, rank among all seasons (1 = worst).
- Hindcast (section 4b): mean / Sen / TabPFN forecasters, rolling-origin validation 2011–2022, frozen forecasts for 2023 and 2024, `/forecast` endpoint.
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
| `windy_days` | days Nov(prev yr)–Apr with daily max 10 m wind ≥ 12 m/s | MERRA-2 | days |
| `barren_frac` | fraction of region barren / open shrub / grassland | MODIS MCD12Q1 | 0–1 |

### `data/{region}/wind.csv` — hourly, every Nov–Apr season 2000/01 … 2024/25 (needed for the hindcast map)
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
Hindcast: `geo/output/{region}/hindcast/pileup_{t}_{T}_{predicted|actual}.geojson` (properties `risk` 0–1, `hours`) and `geo/output/{region}/sightings_{T}.geojson` (points: `id`, `source`, `quality`, `taxon`), T ∈ {2023, 2024}. Built by `python geo/hindcast.py` (written by B for C): predicted = mean hours per direction over the seasons before T, actual = season T's hours; both maps share one 0–1 scale so equal colour = equal risk. `hours` = hours ≥ t in the season (mean per season for predicted). Sightings of season T = records with `year == T`.

### `data/{region}/forecast_{T}.json` — frozen hindcast, written by B (draft)
```json
{"target": 2023, "train": [2001, 2022], "made_on": "2026-11-14",
 "validation": {"years": [2011, 2022], "compared": ["mean", "sen", "tabpfn"], "tabpfn_model": "v3.5_default",
                "models": {"windy_days": "sen", "spring_precip": "mean", "...": "..."},
                "inside_interval": 66, "beat_mean": 23, "same_as_mean": 36, "of": 72},
 "variables": [{"var": "...", "model": "mean|sen|tabpfn", "predicted": 0.0, "pi_low": 0.0, "pi_high": 0.0,
                "actual": 0.0, "inside": true, "error": 0.0, "baseline": 0.0, "baseline_error": 0.0}],
 "index": {"...same fields as a variable...", "predicted_rank": 1, "actual_rank": 1, "of_years": 23},
 "history": {"years": [2001, 2022], "spring_precip": [0.0], "...": [], "index": [0.0]}}
```
`validation.models` = model chosen per series by lowest mean error on 2011–2022. `beat_mean` counts validation cases where the chosen trend beat the average, out of `of - same_as_mean`. `history` = training seasons for the chart (index z-scored with training stats). Rank 1 = worse than every training season. Written by `python backend/forecast.py`; rerun it when `annual.csv` changes.

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
- `GET /backtest?region={id}` → `[{"date", "place", "season", "index_value", "rank", "of_years"}]` (rank 1 = worst season)
- `GET /layers/{region}/sources.geojson`
- `GET /layers/{region}/pileup.geojson?threshold={t}`
- `GET /forecast?region={id}&target={T}` → `forecast_{T}.json`
- `GET /layers/{region}/hindcast.geojson?threshold={t}&target={T}&kind=predicted|actual`
- `GET /layers/{region}/sightings.geojson?target={T}`

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
