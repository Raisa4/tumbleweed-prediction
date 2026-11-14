# Frontend

React + Vite + TypeScript, react-leaflet map, recharts charts.

```bash
npm install
npm run dev        # placeholder data from public/fixtures (yellow banner on top)
npm run dev:live   # real backend at http://localhost:8000 (Andrei's server must be running)
```
Open http://localhost:5173.

- `public/fixtures/` mirrors the API in CLAUDE.md §7. Regenerate the fake trend data with `npm run fixtures` (needs `../.venv` with numpy, pandas, scipy).
- `public/fixtures/layers` is a symlink to `geo/output` (Person C's real map layers).
- `/backtest` rows must also carry `lat`, `lon`, `source_url`, `season` (used for map markers and chart lines).

Files: `App.tsx` (state + layout) · `Onboarding.tsx` · `TrendPanel.tsx` (cards + chart) · `MapView.tsx` · `Backtest.tsx` · `Demo.tsx` (guided South Jordan story) · `api.ts` (URLs + fetch hook) · `vars.ts` (plain-English definitions).
