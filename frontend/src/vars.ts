export type Dir = "up" | "down";

export type Variable = {
  id: string;
  label: string;
  unit: string;
  source: string;
  definition: string;
  worseWhen: Dir;
  digits: number;
};

export const VARS: Variable[] = [
  {
    id: "spring_precip",
    label: "Spring rain",
    unit: "mm",
    source: "NASA GPM IMERG satellite rainfall",
    definition:
      "Total rain from March to May. A wet spring lets tumbleweed seedlings take hold, so more rain means more plants later.",
    worseWhen: "up",
    digits: 0,
  },
  {
    id: "peak_ndvi_anom",
    label: "Peak greenness",
    unit: "NDVI",
    source: "NASA MODIS MOD13Q1 vegetation index",
    definition:
      "How green the open land got at its peak, compared with a normal year. More green means more plant material that can dry out and blow away.",
    worseWhen: "up",
    digits: 3,
  },
  {
    id: "autumn_soilm",
    label: "Autumn soil moisture",
    unit: "kg/m²",
    source: "NASA GLDAS Noah land model",
    definition:
      "How wet the top 10 cm of soil was from September to November. Drier soil makes plants go brittle and snap off sooner, so lower is worse.",
    worseWhen: "down",
    digits: 1,
  },
  {
    id: "windy_days",
    label: "Windy days",
    unit: "days",
    source: "NASA MERRA-2 reanalysis, via NASA POWER",
    definition:
      "Days from November to April when the wind reached 8 m/s (about 29 km/h) as a regional hourly average. Gusts at the ground are stronger than this.",
    worseWhen: "up",
    digits: 0,
  },
  {
    id: "barren_frac",
    label: "Open land",
    unit: "share of area",
    source: "NASA MODIS MCD12Q1 land cover",
    definition:
      "Share of the area that is bare ground, open shrub or grassland: the disturbed, open land tumbleweeds grow on.",
    worseWhen: "up",
    digits: 3,
  },
];

export const INDEX = {
  id: "index",
  label: "Tumbleweed Conditions Index",
  unit: "vs. normal",
  source: "Combined from the NASA drivers below",
  definition:
    "All drivers rolled into one number per season. 0 is a normal season; +1 means conditions one standard step more favourable to pile-ups than normal, -1 one step less.",
  worseWhen: "up" as Dir,
  digits: 2,
};

export const meta = (id: string) => (id === "index" ? INDEX : VARS.find((v) => v.id === id)!);

export const fmt = (v: number, digits: number) =>
  v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const seasonLabel = (s: number) => `plants grew in ${s}, blew Nov ${s} – Apr ${s + 1}`;

export const METHODS = {
  mean: "Long-term average",
  sen: "Trend line",
  tabpfn: "TabPFN (AI model)",
} as const;

export const ROLES = [
  { id: "city", label: "City, road crew or fire district", tab: "map" },
  { id: "farmer", label: "Farmer or landowner", tab: "map" },
  { id: "student", label: "Student or just curious", tab: "trends" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const THRESHOLDS = [4, 6, 8, 10, 12];

export const RISK_CLASSES = [
  { min: 0.05, colour: "#F0A050" },
  { min: 0.1, colour: "#E27A2B" },
  { min: 0.2, colour: "#C85614" },
  { min: 0.4, colour: "#94380A" },
  { min: 0.7, colour: "#561D03" },
];

export const riskColour = (r: number) =>
  RISK_CLASSES.reduce((c, k) => (r >= k.min ? k.colour : c), RISK_CLASSES[0].colour);

export const SOURCE_CLASSES = [
  { test: (w: number) => w < 0.45, colour: "#7DBFB0", label: "Past sightings nearby" },
  { test: (w: number) => w < 0.55, colour: "#36988A", label: "Open land" },
  { test: () => true, colour: "#145A50", label: "Open land + past sightings" },
];

export const sourceColour = (w: number) => SOURCE_CLASSES.find((c) => c.test(w))!.colour;
