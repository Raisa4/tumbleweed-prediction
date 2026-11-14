export type Var = {
  id: string; label: string; unit: string; source: string; step: string
  def: string; question: string; worseWhen: 'up' | 'down'
}

export const INDEX: Var = {
  id: 'index', label: 'Tumbleweed Conditions Index', unit: 'std. dev.', source: 'All five NASA variables combined',
  step: 'The whole chain',
  def: 'The five conditions below, each turned into "how unusual is this year" and averaged. 0 = a typical year; +1 = clearly worse than usual for tumbleweeds.',
  question: 'Overall, are tumbleweed conditions here getting worse?', worseWhen: 'up',
}

export const VARS: Var[] = [
  {
    id: 'spring_precip', label: 'Spring rainfall', unit: 'mm', source: 'NASA GPM IMERG', step: '1 · Seeds sprout',
    def: 'Total rain from March to May. A wet spring lets more tumbleweed seedlings take root.',
    question: 'Are springs getting wetter?', worseWhen: 'up',
  },
  {
    id: 'peak_ndvi_anom', label: 'Vegetation greenness', unit: 'NDVI', source: 'NASA MODIS (MOD13Q1)', step: '2 · Plants bulk up',
    def: 'How green the open land gets at the summer peak, compared with the 2001–2025 average. Greener means bigger plants, which become bigger tumbleweeds.',
    question: 'Is summer growth on open land getting stronger?', worseWhen: 'up',
  },
  {
    id: 'autumn_soilm', label: 'Autumn soil moisture', unit: 'kg/m²', source: 'NASA GLDAS Noah', step: '3 · Plants dry and snap',
    def: 'Water in the top 10 cm of soil, September–November. Dry soil makes plants brittle so they snap off at the base. Lower is worse.',
    question: 'Are autumns getting drier?', worseWhen: 'down',
  },
  {
    id: 'windy_days', label: 'Windy days', unit: 'days', source: 'NASA MERRA-2', step: '4 · Wind rolls them',
    def: 'Days from November to April when the strongest wind of the day reaches 12 m/s (27 mph). Wind is what rolls dry plants into towns and roads.',
    question: 'Are windy winter days becoming more common?', worseWhen: 'up',
  },
  {
    id: 'barren_frac', label: 'Open land', unit: 'fraction', source: 'NASA MODIS (MCD12Q1)', step: '5 · Room to grow',
    def: 'Share of the region that is bare ground, open shrubland or grassland: the ground tumbleweeds grow on.',
    question: 'Is there more open land than before?', worseWhen: 'up',
  },
]

export const ALL = [INDEX, ...VARS]
