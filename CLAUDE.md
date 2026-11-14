# Tumbleweed Trend Detective — NASA Space Apps

**One-liner:** Are the conditions that cause tumbleweed pile-ups getting worse where you live — and where will they hit?
Challenge: Earth science trends. We pick NASA variables for known tumbleweed hotspots, plot them over time, and test whether the trends are statistically significant (Mann-Kendall + Sen's slope). A downwind pile-up map is the bonus layer.

**Audience:** cities / road crews / fire districts (pile-up map), farmers (seed sources), students (trend explorer).
**Do NOT claim:** satellites detect tumbleweeds, a fire probability %, insurer use cases.

## Team & folders — stay in your folder
| Person | Role | Folder |
|---|---|---|
| A | NASA data download + yearly variables | `data/`, `scripts/` |
| B (Andrei) | FastAPI backend + statistics | `backend/` |
| C | Geo layers: seed sources + downwind pile-ups | `geo/` |
| D | React frontend + pitch | `frontend/` |

Rules:
- Only edit your own folder. Contracts below change only after the whole team agrees.
- Commit small and often; pull before starting a new task.
- Until real data exists, use the fixture files (same schema). Replace fixtures with real data without changing the schema.
- Raw downloads go in `data/raw/` (gitignored). Only processed, small files are committed.

## Regions
`data/regions.json`
```json
[
  {"id": "salt_lake_valley", "name": "Salt Lake Valley, UT", "bbox": [-112.20, 40.30, -111.80, 40.80]},
  {"id": "victorville",      "name": "Victorville, CA",      "bbox": [-117.50, 34.40, -117.20, 34.65]},
  {"id": "tri_cities_wa",    "name": "Tri-Cities, WA",       "bbox": [-119.50, 46.10, -119.00, 46.40]}
]
```
bbox = [west, south, east, north] in WGS84.

## Data contracts
`data/{region}/annual.csv` — one row per year per variable, years 2001–2025
```
year,variable,value
```
| variable | meaning | source | unit |
|---|---|---|---|
| `spring_precip` | total precipitation Mar–May | GPM IMERG | mm |
| `peak_ndvi_anom` | peak growing-season NDVI anomaly vs 2001–2025 mean, grass/shrub/barren pixels | MODIS MOD13Q1 | NDVI units |
| `autumn_soilm` | mean topsoil moisture Sep–Nov (lower = drier = worse) | GLDAS Noah | kg/m² |
| `windy_days` | days Nov(prev yr)–Apr with daily max 10 m wind ≥ threshold (default 12 m/s) | MERRA-2 | days |
| `barren_frac` | fraction of region classed barren/open shrub/grassland | MODIS MCD12Q1 | 0–1 |

`data/{region}/events.csv` — documented pile-up events (from news)
```
date,place,lat,lon,source_url
```

## API contract (backend, FastAPI, default port 8000, CORS on)
- `GET /regions` → contents of `regions.json`
- `GET /trend?region={id}&var={variable}` →
  ```json
  {"region": "...", "var": "...", "years": [2001, ...], "values": [..],
   "slope": 0.0, "ci_low": 0.0, "ci_high": 0.0, "p": 0.0,
   "trend": "increasing|decreasing|no trend", "significant": true,
   "verdict": "Increasing by 0.8 days/yr — significant (p=0.01)"}
  ```
  Stats: `pymannkendall.hamed_rao_modification_test` for trend/p (handles autocorrelation), `pymannkendall.sens_slope` for slope; 95% CI. Significance at p < 0.05.
- `GET /index?region={id}` → same shape as `/trend`, for the **Tumbleweed Conditions Index** = mean of z-scored variables, with `autumn_soilm` sign flipped (drier = higher risk).
- `GET /backtest?region={id}` → `[{"date", "place", "index_value", "rank", "of_years"}]` — index for the season before each event and its rank among all years.
- `GET /layers/{region}/sources.geojson` → seed-source polygons/points, property `weight` 0–1
- `GET /layers/{region}/pileup.geojson?threshold={m/s}` → pile-up risk cells, property `risk` 0–1

Geo outputs are files in `geo/output/{region}/sources.geojson` and `geo/output/{region}/pileup_{threshold}.geojson`; the backend just serves them.

## Geo layer method (Person C)
- Seed sources = GBIF occurrences (query ALL names: Salsola tragus, Salsola kali, Salsola kali subsp. tragus, Kali tragus, Salsola iberica, Bassia scoparia, Kochia scoparia) + suitable land (fallow/barren/disturbed from MODIS land cover or OSM landuse).
- Pile-ups = spread source weight downwind along dominant high-wind directions, max ~4 km, stopped by OSM buildings/fences/walls. Wind threshold is an explicit **assumption** exposed as a slider.

## Frontend (Person D)
React + Vite + TS, react-leaflet, recharts. Calls backend at `http://localhost:8000`.
- Onboarding: "Who are you?" (city/fire, farmer, student) + "Where?" (region)
- Variable cards with one-sentence plain-English definitions
- Trend chart: values, Sen's slope line, significance badge, verdict text
- Map: sources + pile-up layers, threshold slider, event markers
- Two guided demos, e.g. "Why did South Jordan get buried in 2024?"

## Honesty in the pitch
- Satellites can't see individual tumbleweeds (0.5–2 m vs 250–500 m pixels) — we model conditions and habitat.
- MERRA-2 wind is ~50 km resolution: regional wind seasons, not street-level paths.
- Validation = backtest against ~10 news-reported pile-ups: a plausibility check, not an accuracy score.
- A non-significant trend is still a valid, reported result.

## Run
```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
cd frontend && npm install && npm run dev
```
