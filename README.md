# 🌵 Tumbleweed Trend Detective

**Are tumbleweed conditions getting worse, and could we have warned the towns that got buried?**
A NASA Space Apps 2026 project (challenge: *Earth science trends*) that turns 25 years of NASA Earth-science data into statistically tested trends, a seasonal warning check and pile-up maps for three real tumbleweed hotspots in the western US.

**Live site:** https://white-mushroom-0d731ed10.3.azurestaticapps.net

---

## The problem

In the dry western US, Russian thistle and kochia grow on fallow, bare and disturbed land. When they dry out, strong winds roll them into neighbourhoods, highways and fire lines:

- **Victorville, CA, April 2018**: about 100–150 homes buried.
- **West Jordan & Eagle Mountain, UT, 2018; South Jordan & Eagle Mountain, UT, March 2024**: streets blocked, homes buried to the roof.
- **Highway 240, WA, 31 Dec 2019**: cars and a semi trapped, road closed for 10 hours.

Farmers already handle tumbleweeds as routine weed control. **Cities, road crews, fire districts and homeowners** are the ones taken by surprise, and they only ever clean up afterwards. We want to help them move from cleanup to prevention.

## What the site does

| View | Question it answers | For |
|---|---|---|
| **Map** | Where do tumbleweeds grow, and where does the wind pile them up? A wind-threshold slider changes the pile-up layer. | city crews, fire districts, farmers |
| **Trends** | Is each driver (rain, greenness, soil moisture, wind, open land) changing since 2001, and is the change statistically significant? | students, the science-curious |
| **Past pile-ups** | Was our index high in the seasons before real, news-reported pile-ups? | everyone |
| **Prediction vs reality** | If we hide the latest seasons and predict them from earlier years only, how close do we get? | everyone |

A short guided demo walks through *"Why did South Jordan get buried in 2024?"*.

## NASA data

| Variable | What it measures | Dataset | Access |
|---|---|---|---|
| `spring_precip` | Total precipitation, March–May (mm) | GPM IMERG monthly (GPM_3IMERGM) | Giovanni area average |
| `peak_ndvi_anom` | Peak growing-season greenness of open-land pixels, vs the 2001–2025 mean | MODIS Terra MOD13Q1 v061 (250 m) | AppEEARS |
| `autumn_soilm` | Mean 0–10 cm soil moisture, September–November (kg/m²) | GLDAS Noah 0.25° monthly | Giovanni area average |
| `windy_days` | Days from November to April with daily maximum 10 m wind ≥ 8 m/s | MERRA-2 | NASA POWER |
| `barren_frac` | Share of the region that is open shrubland, grassland or barren | MODIS MCD12Q1 v061 (500 m) | AppEEARS |
| hourly wind | Hourly 10 m wind speed and direction, every winter 2001–2025 | MERRA-2 | NASA POWER |

Other open data: tumbleweed sightings from **GBIF** and **iNaturalist**; land use, buildings and fences from **OpenStreetMap**; pile-up dates and places from news reports (links in `data/*/events.csv`).

## How it works

**Seasons.** Season *Y* means the plants grow and dry in year *Y* and tumble from November *Y* to April *Y+1*. A pile-up in March 2024 therefore belongs to season 2023.

**1. Trend test.** For each variable and region:
- **Mann-Kendall test** with the **Hamed-Rao correction** for year-to-year autocorrelation, significant when p < 0.05;
- **Sen's slope** with a 95% confidence interval as the rate of change.

**2. Tumbleweed Conditions Index.** Each variable is converted to a z-score and the scores are averaged into one number per season (0 = a normal season, higher = worse). Soil moisture is flipped, because drier soil is worse.

**3. Backtest.** For every news-reported pile-up, we look up how its season ranks among all seasons (rank 1 = the worst on record).

**4. Prediction vs reality (hindcast).**
- **Validation, 2011–2022.** Each season is predicted from the seasons before it only. Three forecasters are compared per variable: the long-term mean, the Sen trend, and **TabPFN v3.5**, a pre-trained tabular foundation model, used through its API without fine-tuning.
- **Choice.** The forecaster with the lowest error on these years is kept.
- **Final test.** It is then run, unchanged, on seasons **2023 and 2024**, and the predictions are frozen to files.
- **No leakage.** A test checks that the target season's real data never changes its own prediction.

**5. Pile-up map.**
- **Grid.** Each region is split into 250 m cells.
- **Sources.** Sightings density plus suitable open land.
- **Push.** Sources are pushed downwind up to 4 km, in 8 wind directions, weighted by how many hours the real MERRA-2 wind blew that way above the chosen threshold.
- **Pile-up.** Plants stop at buildings and fences, so risk builds up there.
- **Hindcast maps.** "Predicted" uses the average wind of the training seasons, "actual" the target season's real wind.

## What we found

**Trends, 2001–2025.** No region shows a significant overall worsening.

| Region | Significant change | Effect on tumbleweed risk | Combined index |
|---|---|---|---|
| Salt Lake Valley, UT | Windy days increasing, +0.14 days/yr (p = 0.050) | worse | no steady change |
| Victorville, CA | Open land decreasing (p < 0.001) | better | no steady change |
| Tri-Cities, WA | Autumn soil getting wetter, +0.10 kg/m²/yr (p = 0.003) | better | no steady change |

**Backtest.** The seasons behind the pile-ups ranked:
- 4th of 24 for Victorville 2018;
- 7th for Utah 2018;
- 11th for South Jordan 2024;
- 14th for Hwy 240 / Kennewick 2019.

Utah 2022 ranked last, so the index did not see it coming. This is a plausibility check, not an accuracy score.

**Prediction vs reality.**
- **Validation, 2011–2022.** The real value fell inside our 95% interval in 61–67 of 72 cases per region.
- **Hits.** Salt Lake Valley season 2023, the one before the South Jordan pile-up, was predicted 11th of 23 and was really 11th.
- **Misses.** Tri-Cities 2023 and Victorville 2024 were big misses, and we show them.

**Takeaway.** Pile-ups come from single bad seasons rather than a steady long-term trend, so towns need a warning **every season**.

## Honest limits

- Satellites cannot see individual tumbleweeds (0.5–2 m plants vs 250–500 m pixels). We model **conditions and habitat**, not plants.
- MERRA-2 wind has a resolution of about 50 km. It shows regional wind seasons, not street-level paths.
- The tumbling wind threshold is an **assumption**, which is why it is a slider. It applies to hourly mean wind over a ~50 km cell, not to gusts at the ground.
- The backtest uses about 10 news-reported events, and the hindcast 12 validation seasons plus 2 test seasons. Both are demonstrations, not accuracy scores. Single-year rain and wind are largely unpredictable.
- We do not claim a fire probability, insurance use, or that we detect tumbleweeds from space.

## Repository

```
data/       regions, yearly NASA values (annual.csv), hourly wind, news events, frozen forecasts
scripts/    NASA data download and reduction (fetch.py)
backend/    statistics (stats.py), hindcast (forecast.py), FastAPI server (main.py), static export
geo/        seed sources and pile-up maps (build.py), hindcast maps (hindcast.py)
frontend/   React + Vite + TypeScript website (Leaflet maps, Recharts charts)
pitch/      slides and submission text
```

## Run it locally

```bash
# backend (Python 3.10+)
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload            # API on http://localhost:8000 (docs at /docs)

# frontend (Node 20+), in a second terminal
cd frontend
npm install
npm run dev                          # website on http://localhost:5173
```

Tests: `cd backend && pytest` and `cd geo && pytest`.
Rebuild the forecasts after new data: `cd backend && python forecast.py`. TabPFN needs `TAB_PFN_API_KEY` in a `.env` file; `python forecast.py mean sen` runs fully offline.

**Static hosting.** `npm run deploy` in `frontend/` does three things:
1. exports every API answer to JSON (`backend/export_static.py`);
2. builds the site;
3. uploads it to Azure Static Web Apps.

The upload needs `SWA_CLI_DEPLOYMENT_TOKEN` in `.env`.

## Team

| Role | Person |
|---|---|
| NASA data collection | Bianca |
| Statistics, forecasting and backend | Irina |
| Maps (sources and pile-ups) | Raisa |
| Website | Anesti |
| Pitch | All team members |  

## Credits

NASA GPM, MODIS (Terra), GLDAS and MERRA-2 data via Giovanni, AppEEARS and NASA POWER · GBIF.org and iNaturalist occurrence data · © OpenStreetMap contributors · basemaps © Esri · TabPFN by Prior Labs.
