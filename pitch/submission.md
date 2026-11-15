# Submission draft — NASA Space Apps 2026

Fields follow the official project form, in order. All text must be in English. Deadline: **Sunday 15 November, 23:59** (Local Event time).

## Project Name
Tumbleweed Trend Detective

## High-Level Project Summary
In the dry western US, wind rolls tumbleweeds into neighbourhoods and highways, burying homes and closing roads, and cities and road crews are always caught by surprise.

Tumbleweed Trend Detective takes 25 years (2001–2025) of NASA Earth-science data for three real pile-up hotspots: Salt Lake Valley UT, Victorville CA and Tri-Cities WA. It covers spring rainfall, vegetation greenness, autumn soil moisture, windy days and open land. For each one, it tests whether there is a statistically significant trend (Mann-Kendall with Hamed-Rao correction, Sen's slope with 95% CI). It combines them into a Tumbleweed Conditions Index and checks that index against real, news-reported pile-ups.

It then asks the question a city cares about: *could we have warned them?* We hide the latest seasons, predict them from earlier years only, and compare with what really happened. Maps show where tumbleweeds grow and where real NASA wind piles them against buildings.

Satellites can't see single tumbleweeds, so we show the conditions they need, and we say so.

## Link to Project Demo
`[TODO: public link to the 7-slide PDF (Google Drive, "Anyone with the link"); test it in a private window]`

## Link to Final Project
- Website: https://white-mushroom-0d731ed10.3.azurestaticapps.net
- Code: https://github.com/Raisa4/tumbleweed-prediction `[TODO: Raisa makes the repo public; test in a private window]`

## Detailed Project Description

**What it does.** The website has four views, chosen by role (city / fire crews, farmers, students):
1. **Map**: where tumbleweeds grow (sightings + open land) and where the wind piles them up against buildings and fences. A slider sets the wind speed assumed to roll a plant (4–12 m/s). Real news-reported pile-ups are marked.
2. **Trends**: for each NASA variable, a 25-year chart, Sen's slope, a significance badge and a plain-English verdict, plus the combined index.
3. **Past pile-ups**: how the index ranked the seasons behind each real pile-up (rank 1 = worst season on record).
4. **Prediction vs reality**: seasons 2023 and 2024 predicted from earlier years only, compared with what happened, with predicted vs actual pile-up maps side by side.

A guided demo asks *"Why did South Jordan get buried in 2024?"*.

**How it works.**
- **Seasons.** A season is the year the plants grow; they tumble from the following November to April.
- **Trends.** Mann-Kendall test with the Hamed-Rao correction for autocorrelation (significant at p < 0.05). Sen's slope with 95% confidence interval as the rate of change.
- **Index.** Each variable is turned into a z-score, with soil moisture flipped because drier is worse, and the scores are averaged.
- **Hindcast.**
  - *Validation 2011–2022:* each season is predicted from the seasons before it only.
  - *Forecasters:* the long-term mean, the Sen trend, and TabPFN v3.5, a pre-trained tabular foundation model used via API without fine-tuning.
  - *Choice:* the best forecaster per variable on those years is frozen and run on 2023 and 2024.
  - *No leakage:* a test checks that a season's real data never changes its own prediction.
- **Maps.**
  - *Grid:* 250 m cells.
  - *Sources:* GBIF/iNaturalist sightings plus OpenStreetMap open land.
  - *Push:* sources are pushed downwind up to 4 km, in 8 directions weighted by hours of real MERRA-2 wind above the threshold.
  - *Pile-up:* risk accumulates at OpenStreetMap buildings and fences.

**What we found.** No region shows a significant overall worsening of tumbleweed conditions.
- **Trends:**
  - Salt Lake Valley: windy days are increasing (+0.14 days/yr, p = 0.050).
  - Victorville: open land is shrinking (p < 0.001).
  - Tri-Cities: autumn soil is getting wetter (p = 0.003).
- **Backtest:** the Victorville 2018 pile-up season ranked 4th of 24; Utah 2018 ranked 7th.
- **Hindcast:**
  - The real value fell inside our 95% interval in 61–67 of 72 validation cases per region.
  - Salt Lake Valley season 2023, the one before the March 2024 South Jordan pile-up, was predicted 11th of 23 and really ranked 11th.
  - We also show the misses.

The takeaway: pile-ups come from single bad seasons, not a steady trend, so towns need a check **every season**.

**Benefits.** Cities, road crews and fire districts currently only clean up after a wind event. This shows them, from free NASA data, whether conditions are building up this season, where the plants come from and where they will land. That gives them time to mow before seeding, clear piles or stage crews. Students get a real, honestly tested example of Earth-science trend analysis.

**What we hope to achieve.** Next steps:
- run it for any western US town;
- update the season check every autumn;
- validate against more reported pile-ups;
- use finer wind data.

**Honest limits.**
- We model conditions and habitat, not plants: tumbleweeds are 0.5–2 m, pixels are 250–500 m.
- MERRA-2 wind is about 50 km resolution.
- The wind threshold is an assumption (hence the slider; it applies to hourly mean wind, not ground gusts).
- About 10 news events and 14 hindcast seasons make this a demonstration, not an accuracy score.

**Tools.**
- Python: pandas, numpy, xarray, scipy, pymannkendall, geopandas, osmnx, rasterio, FastAPI, pytest, tabpfn-client.
- TypeScript: React, Vite, Leaflet, Recharts.
- Hosting: Azure Static Web Apps.

## Use of Super Intelligence (SI)
`[TODO: each teammate confirm or add what they used]`
- **Coding assistant.** We used Claude Code (Anthropic) to help write and debug parts of the data pipeline, statistics backend, map processing and website.
- **TabPFN.** We used TabPFN v3.5 (Prior Labs), a pre-trained machine-learning model, as one of three forecasters in the hindcast. Its predictions are labelled "TabPFN" wherever it was the chosen model.
- **What is not AI.** The idea and approach are our own. All data comes from the NASA and open sources listed below. All statistics are computed by our code from that data, not generated by AI. The team reviewed and tested the code and wrote the final claims.

## NASA Data
| Variable | Dataset | Access |
|---|---|---|
| Spring rainfall (Mar–May total) | GPM IMERG monthly precipitation (GPM_3IMERGM) | Giovanni, area-averaged time series |
| Peak greenness anomaly (open-land pixels) | MODIS Terra vegetation indices, 16-day 250 m (MOD13Q1 v061) | AppEEARS |
| Autumn topsoil moisture (Sep–Nov mean, 0–10 cm) | GLDAS Noah land surface model, monthly 0.25° | Giovanni, area-averaged time series |
| Windy days (Nov–Apr days with daily max 10 m wind ≥ 8 m/s) | MERRA-2 (WS10M_MAX) | NASA POWER daily API |
| Hourly wind speed and direction (pile-up maps) | MERRA-2 (WS10M, WD10M) | NASA POWER hourly API |
| Open-land fraction (open shrubland, grassland, barren) | MODIS land cover type, yearly 500 m (MCD12Q1 v061, LC_Type1) | AppEEARS |

## Space Agency Partner Data and Other References
- **Data.**
  - GBIF.org occurrence records: Salsola tragus, S. kali, Kali tragus, Bassia scoparia and synonyms.
  - iNaturalist observations: research-grade and needs-ID, open coordinates.
  - OpenStreetMap land use, buildings and fences (via osmnx), © OpenStreetMap contributors.
- **News reports of pile-ups** (source links in `data/*/events.csv`):
  - NPR on Victorville 2018;
  - KSL on West Jordan 2018;
  - KIRO 7 on Highway 240, 2019;
  - plus the Utah 2022 and 2024 reports.
- **Basemaps:** Esri World Street Map and World Imagery.
- **Models and libraries:** TabPFN (Prior Labs); open-source libraries listed under Tools.
- **Methods:**
  - Mann (1945) and Kendall (1975) trend test.
  - Hamed & Rao (1998) modified Mann-Kendall test for autocorrelated data.
  - Sen (1968) slope estimator.
- No Space Agency Partner data was used.

## Team
`[TODO: full names of all 6 members]`
| Role | Name |
|---|---|
| NASA data collection | Bianca Geica |
| Statistics, forecasting, backend | Irina |
| Maps | Raisa Bahaciu |
| Website and pitch | Anesti |
| `[TODO]` | `[TODO]` |
| `[TODO]` | `[TODO]` |
