export type Region = {
  id: string;
  name: string;
  bbox: [number, number, number, number];
};

export type Trend = {
  region: string;
  var: string;
  years: number[];
  values: number[];
  slope: number;
  ci_low: number;
  ci_high: number;
  p: number;
  trend: "increasing" | "decreasing" | "no trend";
  significant: boolean;
  verdict: string;
};

export type BacktestRow = {
  date: string;
  place: string;
  season: number;
  index_value: number;
  rank: number;
  of_years: number;
  lat?: number;
  lon?: number;
  source_url?: string;
};

export type Prediction = {
  var: string;
  model: "mean" | "sen" | "tabpfn";
  predicted: number;
  pi_low: number;
  pi_high: number;
  actual: number;
  inside: boolean;
  error: number;
  baseline: number;
  baseline_error: number;
};

export type Forecast = {
  target: number;
  train: [number, number];
  made_on: string;
  validation: {
    years: [number, number];
    models: Record<string, Prediction["model"]>;
    inside_interval: number;
    beat_mean: number;
    same_as_mean: number;
    of: number;
  };
  variables: Prediction[];
  index: Prediction & { predicted_rank: number; actual_rank: number; of_years: number };
  history: { years: number[] } & Record<string, number[]>;
};

export type Cells = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: Record<string, number>;
    geometry: { type: "Polygon"; coordinates: number[][][] };
  }[];
};

export type Points = {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: { id: string; source: string; quality: string; taxon: string };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
};

const BASE = import.meta.env.VITE_API ?? "http://localhost:8000";
// Static hosting (npm run build:static): read the files written by backend/export_static.py
// instead of calling the Python API. `live` is the API url, `file` the exported file under /data/
// (not /api/: Azure Static Web Apps reserves that path for server functions).
const STATIC = import.meta.env.VITE_STATIC === "1";
const src = (live: string, file: string) => (STATIC ? `${import.meta.env.BASE_URL}data/${file}` : BASE + live);

let fixtures = false;
export const usingFixtures = () => fixtures;

const EMPTY = { type: "FeatureCollection" as const, features: [] };

async function grab<T>(live: string, backup: string | null): Promise<T | null> {
  const res = await fetch(live).catch(() => null);
  if (res?.ok) return res.json() as Promise<T>;
  if (res?.status === 404) return null;
  fixtures = true;
  if (!backup) return null;
  const fix = await fetch(backup).catch(() => null);
  return fix?.ok ? (fix.json() as Promise<T>) : null;
}

export const getRegions = () =>
  grab<Region[]>(src("/regions", "regions.json"), "/fixtures/regions.json").then((r) => r ?? []);

export const getTrend = (region: string, v: string) =>
  grab<Trend>(src(`/trend?region=${region}&var=${v}`, `trend/${region}/${v}.json`), `/fixtures/trend/${region}/${v}.json`);

export const getIndex = (region: string) =>
  grab<Trend>(src(`/index?region=${region}`, `index/${region}.json`), `/fixtures/index/${region}.json`);

export const getBacktest = (region: string) =>
  grab<BacktestRow[]>(src(`/backtest?region=${region}`, `backtest/${region}.json`), `/fixtures/backtest/${region}.json`).then(
    (r) => r ?? [],
  );

export const getForecast = (region: string, target: number) =>
  grab<Forecast>(src(`/forecast?region=${region}&target=${target}`, `forecast/${region}/${target}.json`), null);

export const getSources = (region: string) =>
  grab<Cells>(src(`/layers/${region}/sources.geojson`, `layers/${region}/sources.geojson`), null).then((r) => r ?? EMPTY);

export const getPileup = (region: string, threshold: number) =>
  grab<Cells>(src(`/layers/${region}/pileup.geojson?threshold=${threshold}`, `layers/${region}/pileup/${threshold}.geojson`), null).then(
    (r) => r ?? EMPTY,
  );

export const getHindcast = (
  region: string,
  threshold: number,
  target: number,
  kind: "predicted" | "actual",
) =>
  grab<Cells>(
    src(
      `/layers/${region}/hindcast.geojson?threshold=${threshold}&target=${target}&kind=${kind}`,
      `layers/${region}/hindcast/${threshold}_${target}_${kind}.geojson`,
    ),
    null,
  ).then((r) => r ?? EMPTY);

export const getSightings = (region: string, target: number) =>
  grab<Points>(src(`/layers/${region}/sightings.geojson?target=${target}`, `layers/${region}/sightings/${target}.geojson`), null).then(
    (r) => r ?? EMPTY,
  );
