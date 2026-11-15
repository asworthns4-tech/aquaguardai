import { EarthOverlayMode, SceneId } from '../types/exhibition';

export interface WaterRegion {
  id: string;
  name: string;
  subtitle: string;
  category: 'country' | 'region' | 'ocean' | 'river' | 'glacier' | 'lake' | 'aquifer';
  lat: number;
  lon: number;
  recommendedDistance: number;
  featured?: boolean;
  waterStressLevel: 'Abundant' | 'Seasonal Stress' | 'High Stress' | 'Cryosphere Reserve' | 'Saline Basin';
  accentHex: string;
  summary: string;
  metrics: {
    label: string;
    value: string;
    unit: string;
  }[];
  scienceHighlight: string;
  conservationNote: string;
  dataNote: string;
  countryOrBasin?: string;
  observationSource?: string;
  referenceEpoch?: string;
}

export interface OverlayConfig {
  id: EarthOverlayMode;
  label: string;
  shortLabel: string;
  headline: string;
  description: string;
  legend: { color: string; label: string }[];
  scienceFact: string;
}

export interface ExhibitionModuleInfo {
  id: SceneId;
  number: string;
  label: string;
  shortLabel: string;
  phase: number;
  available: boolean;
  description: string;
  plannedFeatures: string[];
}

export const EXHIBITION_MODULES: ExhibitionModuleInfo[] = [
  {
    id: 'earth',
    number: '01',
    label: 'Earth Explorer',
    shortLabel: 'Earth',
    phase: 1,
    available: true,
    description:
      'Interactive 3D planet exploring oceans, freshwater basins, glaciers, aquifers, India, and Kerala.',
    plannedFeatures: ['Interactive 3D Globe', 'Water Scarcity Overlays', 'India & Kerala Focus'],
  },
  {
    id: 'city',
    number: '02',
    label: 'Future Smart City',
    shortLabel: 'Smart City',
    phase: 2,
    available: true,
    description:
      'Interactive 3D urban water ecosystem with reservoirs, treatment plants, pipelines, smart meters, and rainwater harvesting.',
    plannedFeatures: [
      'Selectable City Infrastructure',
      'Live Demand & Recycling Controls',
      'Leakage & Storage Simulation',
    ],
  },
  {
    id: 'underground',
    number: '03',
    label: 'Underground Water World',
    shortLabel: 'Underground',
    phase: 3,
    available: true,
    description:
      '3D geological cutaway beneath the city revealing soil strata, aquifers, water tables, borewells, and recharge zones.',
    plannedFeatures: [
      'Geological Strata Explorer',
      'Over-Extraction vs Recharge',
      'Animated Aquifer Flow',
    ],
  },
  {
    id: 'lab',
    number: '04',
    label: 'AQUA Science Lab',
    shortLabel: 'Science Lab',
    phase: 7,
    available: true,
    description:
      'Futuristic 3D water research laboratory with eight interactive experiment stations covering the water cycle, rainwater harvesting, groundwater depletion, pipeline leakage, filtration, RO desalination, urban balance, and smart city management.',
    plannedFeatures: [
      '8 Interactive 3D Stations',
      'Live Quantitative Dashboards',
      'Before & After Comparisons',
    ],
  },
  {
    id: 'simulations',
    number: '05',
    label: 'Water Simulations',
    shortLabel: 'Simulations',
    phase: 7,
    available: true,
    description:
      'Eight equation-driven quantitative water models synced with Future Smart City, Underground Water World, AQUA AI, and gesture controls.',
    plannedFeatures: [
      '8 Equation-Driven Models',
      'Transparent Formulas & Units',
      'Live Cross-Module Sync',
    ],
  },
  {
    id: 'mission',
    number: '06',
    label: 'Save the City Mission',
    shortLabel: 'Mission',
    phase: 8,
    available: true,
    description:
      'Decision-making sustainability challenge where visitors resolve droughts, leaks, and aquifer decline across five mission stages.',
    plannedFeatures: [
      '5 Interactive Mission Stages',
      'Transparent Scoring & Badges',
      'City Resilience Outcomes',
    ],
  },
  {
    id: 'aqua',
    number: '07',
    label: 'AQUA AI Assistant',
    shortLabel: 'AQUA AI',
    phase: 6,
    available: true,
    description:
      'Voice and text science guide that answers questions and directly controls 3D scenes, cameras, and simulations.',
    plannedFeatures: [
      'Natural Voice & Text Chat',
      'Direct Website & 3D Control',
      'Context-Aware Explanations',
    ],
  },
  {
    id: 'exhibition',
    number: '08',
    label: 'Exhibition Mode',
    shortLabel: 'Exhibition',
    phase: 8,
    available: true,
    description:
      'Professional presentation mode with 8 guided chapters, narration scripts, and live demonstration controls.',
    plannedFeatures: [
      '8 Guided Presentation Chapters',
      'Spoken Narration & Text Scripts',
      'Live Demonstration Toolbar',
    ],
  },
];

export const GLOBAL_WATER_BUDGET = {
  totalVolumeKm3: '1,386,000,000',
  saltwaterPercent: 97.5,
  freshwaterPercent: 2.5,
  freshwaterBreakdown: [
    { label: 'Glaciers & Ice Caps', percent: 68.7, color: '#BAE6FD' },
    { label: 'Groundwater', percent: 30.1, color: '#22D3EE' },
    { label: 'Surface & Other Freshwater', percent: 1.2, color: '#34D399' },
  ],
  accessibleSurfaceNotes:
    'Less than 1% of all freshwater (about 0.007% of Earth’s total water) sits in accessible lakes and rivers.',
  sourceNotice: 'Educational reference figures based on USGS / UNESCO World Water Assessment.',
};

export const EARTH_OVERLAYS: Record<EarthOverlayMode, OverlayConfig> = {
  'water-availability': {
    id: 'water-availability',
    label: 'Water Availability & Scarcity',
    shortLabel: 'Availability',
    headline: 'Global Water Stress & Monsoon Distribution',
    description:
      'Visualizes illustrative regional water balance—contrasting equatorial and monsoon-fed basins (such as Kerala and the Amazon) against subtropical arid belts facing chronic water stress.',
    legend: [
      { color: '#22D3EE', label: 'High renewable runoff / monsoon' },
      { color: '#34D399', label: 'Moderate seasonal balance' },
      { color: '#F59E0B', label: 'Seasonal or emerging stress' },
      { color: '#EA580C', label: 'Severe arid / basin stress' },
    ],
    scienceFact:
      'Over 2 billion people live in countries experiencing high water stress, largely driven by uneven seasonal precipitation and groundwater over-extraction.',
  },
  freshwater: {
    id: 'freshwater',
    label: 'Freshwater Systems (2.5%)',
    shortLabel: 'Freshwater',
    headline: 'Rivers, Lakes & Glacial Reserves',
    description:
      'Highlights Earth’s rare 2.5% freshwater fraction—dominated by polar ice sheets, Himalayan glaciers, great inland lakes, and major continental river networks.',
    legend: [
      { color: '#E0F2FE', label: 'Ice sheets & mountain glaciers (68.7%)' },
      { color: '#06B6D4', label: 'Major river basins & lakes (1.2%)' },
      { color: '#1E293B', label: 'Arid / low surface runoff zones' },
    ],
    scienceFact:
      'More than two-thirds of Earth’s freshwater is locked in glaciers and permanent snow cover—making glacial melt a critical indicator of future river security.',
  },
  saltwater: {
    id: 'saltwater',
    label: 'Saltwater Oceans (97.5%)',
    shortLabel: 'Saltwater',
    headline: 'The Global Ocean & Climate Engine',
    description:
      'Highlights the interconnected ocean basins containing 97.5% of Earth’s water (~35 g/L average salinity), driving evaporation, monsoons, and planetary heat transport.',
    legend: [
      { color: '#0284C7', label: 'Deep abyssal ocean basins' },
      { color: '#38BDF8', label: 'Warm evaporation & monsoon corridors' },
      { color: '#0EA5E9', label: 'Continental shelf & coastal seas' },
    ],
    scienceFact:
      'Ocean evaporation supplies roughly 86% of global atmospheric moisture, powering rain systems like India’s Southwest Monsoon.',
  },
  groundwater: {
    id: 'groundwater',
    label: 'Groundwater & Aquifers (30.1%)',
    shortLabel: 'Groundwater',
    headline: 'Hidden Subsurface Aquifers',
    description:
      'Reveals major subterranean aquifer basins holding ~30.1% of all freshwater—vital buffers during dry months that face rapid depletion when pumping exceeds natural recharge.',
    legend: [
      { color: '#2DD4BF', label: 'Major alluvial & sedimentary aquifers' },
      { color: '#F59E0B', label: 'High extraction / declining water table' },
      { color: '#38BDF8', label: 'Coastal & lateritic recharge zones' },
    ],
    scienceFact:
      'India is the world’s largest user of groundwater, relying on subsurface aquifers for over 60% of irrigated agriculture and 85% of rural drinking water.',
  },
};

export const EARTH_REGIONS: WaterRegion[] = [
  {
    id: 'kerala',
    name: 'Kerala',
    subtitle: 'Featured Region · Land of 44 Rivers & Backwaters',
    category: 'region',
    lat: 10.55,
    lon: 76.25,
    recommendedDistance: 1.82,
    featured: true,
    waterStressLevel: 'Seasonal Stress',
    accentHex: '#34D399',
    summary:
      'Nestled between the Western Ghats and the Arabian Sea, Kerala receives intense monsoon rainfall (~3,000 mm/year), yet steep topography causes rapid runoff to the sea—creating seasonal summer water scarcity.',
    metrics: [
      { label: 'Annual Rainfall (Avg)', value: '3,000', unit: 'mm/yr (illustrative)' },
      { label: 'River Systems', value: '44', unit: '41 west-flowing, 3 east' },
      { label: 'Longest River', value: '244', unit: 'km (Periyar)' },
      { label: 'Peak Runoff Loss', value: '~40–50', unit: '% rapid coastal runoff' },
    ],
    scienceHighlight:
      'Porous laterite soils and steep Western Ghats slopes mean monsoon rainwater drains quickly into Vembanad and Ashtamudi backwaters unless captured via contour bunds, check dams, and rooftop rainwater harvesting.',
    conservationNote:
      'Open-well groundwater recharge (Mazhapolima model) and wetland restoration help prevent summer dry-ups and coastal saltwater intrusion.',
    dataNote: 'Educational synthesis based on India WRIS & Kerala Groundwater Dept. reference patterns.',
    countryOrBasin: 'India · Western Ghats / Malabar Basin',
    observationSource: 'India WRIS · Kerala Groundwater Dept. Reference',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'india',
    name: 'India',
    subtitle: 'Featured Country · Monsoon & Himalayan Hydrology',
    category: 'country',
    lat: 22.2,
    lon: 79.0,
    recommendedDistance: 2.15,
    featured: true,
    waterStressLevel: 'High Stress',
    accentHex: '#22D3EE',
    summary:
      'India supports roughly 18% of the global human population with only ~4% of the world’s renewable freshwater resources, making spatial and seasonal water management critical.',
    metrics: [
      { label: 'Share of Global Freshwater', value: '~4.0', unit: '%' },
      { label: 'Share of World Population', value: '~18.0', unit: '%' },
      { label: 'Mean Annual Rainfall', value: '1,170', unit: 'mm/yr (national avg)' },
      { label: 'Groundwater Irrigation Share', value: '>60', unit: '% of net irrigated area' },
    ],
    scienceHighlight:
      'Over 75% of annual rainfall arrives in just 4 Southwest Monsoon months (June–September). Storage in reservoirs, soil moisture, and alluvial aquifers bridges the 8-month dry period.',
    conservationNote:
      'Micro-irrigation, urban wastewater recycling, smart metering, and aquifer recharge are transforming India’s future water security.',
    dataNote: 'Illustrative national profile based on Central Water Commission & NITI Aayog reference figures.',
    countryOrBasin: 'Republic of India · South Asia',
    observationSource: 'Central Water Commission · NITI Aayog Reference',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'himalayas',
    name: 'Himalayan Glaciers',
    subtitle: 'Cryosphere · The Third Pole',
    category: 'glacier',
    lat: 30.8,
    lon: 82.5,
    recommendedDistance: 2.15,
    featured: true,
    waterStressLevel: 'Cryosphere Reserve',
    accentHex: '#BAE6FD',
    summary:
      'Outside the polar caps, the Hindu Kush–Himalaya region holds the largest mass of glacial ice on Earth, sustaining perennial river flow for over 1.3 billion people downstream.',
    metrics: [
      { label: 'Glacier Area', value: '~60,000', unit: 'km² (HKH region)' },
      { label: 'Major Rivers Fed', value: '10', unit: 'Asian river basins' },
      { label: 'Downstream Population', value: '>1.3', unit: 'billion people' },
    ],
    scienceHighlight:
      'Glaciers act as natural frozen reservoirs: they accumulate snow in winter and release meltwater during hot pre-monsoon spring months when river demand peaks.',
    conservationNote:
      'Warming temperatures accelerate glacial retreat, threatening long-term dry-season river stability and increasing glacial lake outburst flood risks.',
    dataNote: 'Illustrative cryosphere educational data (ICIMOD / IPCC AR6 reference range).',
    countryOrBasin: 'Hindu Kush–Himalaya · Transboundary Cryosphere',
    observationSource: 'ICIMOD / IPCC AR6 Reference',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'ganga-brahmaputra',
    name: 'Ganga–Brahmaputra Basin',
    subtitle: 'Major River System · South Asia',
    category: 'river',
    lat: 25.4,
    lon: 86.2,
    recommendedDistance: 2.1,
    waterStressLevel: 'Seasonal Stress',
    accentHex: '#38BDF8',
    summary:
      'One of Earth’s highest-sediment and highest-discharge river systems, fed by both Himalayan snowmelt and intense summer monsoon rains across northern and eastern India and Bangladesh.',
    metrics: [
      { label: 'Basin Area', value: '1.73', unit: 'million km²' },
      { label: 'Combined Avg Discharge', value: '~38,000', unit: 'm³/s' },
      { label: 'Alluvial Aquifer Depth', value: '>1,000', unit: 'm in Indo-Gangetic plain' },
    ],
    scienceHighlight:
      'Deep Indo-Gangetic alluvial sands store immense groundwater, yet intensive tube-well pumping in the western basin has created one of the steepest aquifer declines on Earth.',
    conservationNote:
      'Conjunctive surface-groundwater management and treated urban wastewater reuse help protect both river baseflow and aquifer levels.',
    dataNote: 'Illustrative hydrological values based on UNESCO / GRACE satellite study summaries.',
    countryOrBasin: 'India / Bangladesh / Nepal / Bhutan',
    observationSource: 'UNESCO / GRACE Reference Synthesis',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'indian-ocean',
    name: 'Indian Ocean',
    subtitle: 'Saline Ocean · Monsoon Engine',
    category: 'ocean',
    lat: -12.0,
    lon: 76.0,
    recommendedDistance: 3.1,
    waterStressLevel: 'Saline Basin',
    accentHex: '#0284C7',
    summary:
      'The warmest of Earth’s major oceans, bounded to the north by Asia. Differential land-sea heating draws moisture-laden winds northward every summer to create the Indian Monsoon.',
    metrics: [
      { label: 'Surface Area', value: '70.56', unit: 'million km²' },
      { label: 'Average Depth', value: '3,741', unit: 'meters' },
      { label: 'Average Salinity', value: '~34.8', unit: 'g/kg (PSU)' },
    ],
    scienceHighlight:
      'Solar energy evaporates trillions of tonnes of seawater from the Arabian Sea and Bay of Bengal; condensation over the Western Ghats and Himalayas releases latent heat and freshwater.',
    conservationNote:
      'Coastal desalination plants must carefully manage brine discharge to protect sensitive coral and mangrove ecosystems.',
    dataNote: 'Illustrative oceanographic reference values (NOAA / UNESCO).',
  },
  {
    id: 'pacific-ocean',
    name: 'Pacific Ocean',
    subtitle: 'Saline Ocean · Earth’s Largest Water Body',
    category: 'ocean',
    lat: 5.0,
    lon: -145.0,
    recommendedDistance: 3.4,
    waterStressLevel: 'Saline Basin',
    accentHex: '#0EA5E9',
    summary:
      'Covering over 30% of Earth’s surface, the Pacific holds nearly half of all oceanic water and regulates global rainfall cycles through El Niño–Southern Oscillation (ENSO).',
    metrics: [
      { label: 'Surface Area', value: '165.2', unit: 'million km²' },
      { label: 'Share of Global Ocean', value: '~46', unit: '% of ocean water' },
      { label: 'Deepest Point', value: '10,984', unit: 'm (Mariana Trench)' },
    ],
    scienceHighlight:
      'ENSO sea-surface temperature shifts in the equatorial Pacific alter atmospheric jet streams, influencing monsoon strength in India and drought patterns across continents.',
    conservationNote:
      'Ocean thermal and salinity monitoring helps scientists forecast droughts and floods months in advance.',
    dataNote: 'Illustrative oceanographic reference values (NOAA).',
  },
  {
    id: 'atlantic-ocean',
    name: 'Atlantic Ocean',
    subtitle: 'Saline Ocean · Thermohaline Conveyor',
    category: 'ocean',
    lat: 18.0,
    lon: -40.0,
    recommendedDistance: 3.2,
    waterStressLevel: 'Saline Basin',
    accentHex: '#0284C7',
    summary:
      'Connects polar and tropical waters through the Atlantic Meridional Overturning Circulation (AMOC), driven by temperature and salinity density gradients.',
    metrics: [
      { label: 'Surface Area', value: '85.1', unit: 'million km²' },
      { label: 'Average Depth', value: '3,646', unit: 'meters' },
      { label: 'Salinity Range', value: '33–37', unit: 'PSU' },
    ],
    scienceHighlight:
      'Cold, salty water in the North Atlantic becomes dense enough to sink into the abyss, driving a planetary circulation conveyor that takes ~1,000 years to complete.',
    conservationNote:
      'Freshwater melt from Greenland lowers surface salinity, potentially slowing deep-water formation and shifting global rainfall belts.',
    dataNote: 'Illustrative oceanographic reference values.',
  },
  {
    id: 'amazon',
    name: 'Amazon River Basin',
    subtitle: 'Major River System · South America',
    category: 'river',
    lat: -3.5,
    lon: -62.0,
    recommendedDistance: 2.35,
    waterStressLevel: 'Abundant',
    accentHex: '#34D399',
    summary:
      'Earth’s largest river basin by volume, discharging approximately one-fifth of all riverine freshwater entering the world’s oceans every day.',
    metrics: [
      { label: 'Average Discharge', value: '209,000', unit: 'm³/s' },
      { label: 'Share of Global River Flow', value: '~20', unit: '%' },
      { label: 'Basin Area', value: '7.0', unit: 'million km²' },
    ],
    scienceHighlight:
      'Rainforest canopies transpire vast plumes of water vapor ("flying rivers") that recycle rainfall thousands of kilometers inland toward the Andes.',
    conservationNote:
      'Forest conservation directly protects atmospheric moisture recycling—showing how vegetation and hydrology are inseparable.',
    dataNote: 'Illustrative hydrological values (FAO / UNESCO).',
    countryOrBasin: 'Brazil / Peru / Colombia / Bolivia (8 Nations)',
    observationSource: 'FAO / UNESCO Reference',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'nile',
    name: 'Nile River Basin',
    subtitle: 'Major River System · Northeastern Africa',
    category: 'river',
    lat: 19.5,
    lon: 32.0,
    recommendedDistance: 2.35,
    waterStressLevel: 'High Stress',
    accentHex: '#F59E0B',
    summary:
      'Flowing 6,650 km northward across 11 countries, the Nile sustains desert agriculture and cities through seasonal rains originating in the Ethiopian Highlands and East African lakes.',
    metrics: [
      { label: 'River Length', value: '6,650', unit: 'km' },
      { label: 'Basin Countries', value: '11', unit: 'nations' },
      { label: 'Avg Annual Flow (Aswan)', value: '~84', unit: 'billion m³/yr' },
    ],
    scienceHighlight:
      'High evaporation rates across arid desert stretches make reservoir design, canal lining, and drip irrigation essential to prevent massive evaporative losses.',
    conservationNote:
      'Cooperative transboundary basin governance is vital when upstream rainfall and downstream urban demand meet.',
    dataNote: 'Illustrative hydrological reference figures (FAO Aquastat).',
    countryOrBasin: 'Egypt / Sudan / Ethiopia (11 Nations)',
    observationSource: 'FAO Aquastat Reference',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'baikal',
    name: 'Lake Baikal',
    subtitle: 'Freshwater Lake · Siberia',
    category: 'lake',
    lat: 53.5,
    lon: 108.0,
    recommendedDistance: 2.2,
    waterStressLevel: 'Abundant',
    accentHex: '#22D3EE',
    summary:
      'The world’s deepest and oldest tectonic rift lake, holding roughly 20% of all unfrozen liquid surface freshwater on Earth.',
    metrics: [
      { label: 'Maximum Depth', value: '1,642', unit: 'meters' },
      { label: 'Freshwater Volume', value: '23,615', unit: 'km³' },
      { label: 'Share of Surface Liquid Freshwater', value: '~20', unit: '%' },
    ],
    scienceHighlight:
      'Tectonic rifting created an extraordinary water column where cold oxygen-rich surface water circulates all the way to the abyssal floor, supporting endemic species.',
    conservationNote:
      'Protecting watershed inflow purity preserves one of the planet’s largest strategic freshwater archives.',
    dataNote: 'Illustrative limnological reference data.',
    countryOrBasin: 'Siberia, Russian Federation',
    observationSource: 'UNESCO World Water Assessment',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'great-lakes',
    name: 'North American Great Lakes',
    subtitle: 'Freshwater System · Five Interconnected Lakes',
    category: 'lake',
    lat: 45.8,
    lon: -84.5,
    recommendedDistance: 2.25,
    waterStressLevel: 'Abundant',
    accentHex: '#22D3EE',
    summary:
      'Superior, Michigan, Huron, Erie, and Ontario together form the largest surface area of liquid freshwater on Earth (~21% of global surface freshwater by volume).',
    metrics: [
      { label: 'Combined Volume', value: '22,671', unit: 'km³' },
      { label: 'Surface Area', value: '244,106', unit: 'km²' },
      { label: 'Population Served', value: '>30', unit: 'million people' },
    ],
    scienceHighlight:
      'Because only ~1% of total lake volume renews annually via precipitation and runoff, contaminants can persist for decades—making source protection essential.',
    conservationNote:
      'Closed-loop industrial water reuse and stormwater wetlands reduce nutrient runoff and algal blooms.',
    dataNote: 'Illustrative limnological reference data (GLERL / EPA).',
    countryOrBasin: 'Canada / United States Basin',
    observationSource: 'NOAA GLERL / EPA Reference',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'greenland',
    name: 'Greenland Ice Sheet',
    subtitle: 'Cryosphere · Northern Hemisphere Ice Cap',
    category: 'glacier',
    lat: 72.0,
    lon: -42.0,
    recommendedDistance: 2.5,
    waterStressLevel: 'Cryosphere Reserve',
    accentHex: '#E0F2FE',
    summary:
      'The second-largest ice body on Earth, holding ~2.9 million km³ of frozen freshwater—enough to raise global mean sea level by ~7.4 meters if completely melted.',
    metrics: [
      { label: 'Ice Volume', value: '~2.9', unit: 'million km³' },
      { label: 'Max Ice Thickness', value: '~3,200', unit: 'meters' },
      { label: 'Sea-Level Equivalent', value: '~7.4', unit: 'meters' },
    ],
    scienceHighlight:
      'Ice-albedo feedback accelerates melting: bright snow reflects ~85% of sunlight, while exposed dark meltwater pools absorb solar radiation.',
    conservationNote:
      'Polar cryosphere preservation stabilizes coastal freshwater aquifers from saltwater intrusion worldwide.',
    dataNote: 'Illustrative cryosphere reference values (NASA / NSIDC).',
    countryOrBasin: 'Greenland (Arctic Polar Basin)',
    observationSource: 'NSIDC / Cryosphere Reference',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
  {
    id: 'antarctica',
    name: 'Antarctic Ice Sheet',
    subtitle: 'Cryosphere · Largest Freshwater Store on Earth',
    category: 'glacier',
    lat: -80.0,
    lon: 45.0,
    recommendedDistance: 2.75,
    waterStressLevel: 'Cryosphere Reserve',
    accentHex: '#E0F2FE',
    summary:
      'Contains approximately 60% of all freshwater on planet Earth locked in continental ice up to 4.8 km thick.',
    metrics: [
      { label: 'Ice Volume', value: '~26.5', unit: 'million km³' },
      { label: 'Share of Global Freshwater', value: '~60', unit: '%' },
      { label: 'Average Ice Thickness', value: '~2,160', unit: 'meters' },
    ],
    scienceHighlight:
      'Antarctic sea-ice formation rejects salt brine into surrounding waters, creating cold, dense bottom water that ventilates the world’s deep oceans.',
    conservationNote:
      'Even fractional changes in Antarctic ice balance reshape global coastlines and salinity currents.',
    dataNote: 'Illustrative cryosphere reference values (British Antarctic Survey / NSIDC).',
    countryOrBasin: 'Antarctic Polar Plateau',
    observationSource: 'BAS / NSIDC Reference',
    referenceEpoch: 'Static Reference Dataset (Non-Live)',
  },
];
