export type { ComputedCityMetrics } from '../services/simulationEngine';
export { computeCityMetrics } from '../services/simulationEngine';

export interface CityEntity {
  id: string;
  name: string;
  category: 'building' | 'infrastructure' | 'pipeline';
  subType: string;
  position: [number, number, number];
  cameraOffset: [number, number, number];
  simulatedPopulation?: number;
  baseDemandLpd: number; // litres per day baseline
  baseStoragePct: number;
  recyclingSupported: boolean;
  summary: string;
  scienceExplanation: string;
  conservationTips: string[];
  affectedByLeakIds?: string[];
}

export interface WastewaterStage {
  id: string;
  step: number;
  name: string;
  processType: string;
  description: string;
  contaminantsRemoved: string;
  recoveryYieldPct: number;
}

export interface CityEmergencyChallenge {
  id: string;
  title: string;
  issue: string;
  metricLabel: string;
  actionLabel: string;
  impactSummary: string;
}

export const CITY_ENTITIES: CityEntity[] = [
  {
    id: 'city-reservoir',
    name: 'Periyar Valley Smart Reservoir',
    category: 'infrastructure',
    subType: 'Surface Water Storage & Dam',
    position: [-16, 0.5, -12],
    cameraOffset: [-8, 9, -2],
    baseDemandLpd: 0,
    baseStoragePct: 72,
    recyclingSupported: false,
    summary:
      'Primary municipal raw-water reservoir fed by seasonal rainfall runoff and mountain river inflows, regulated by automated spillway gates.',
    scienceExplanation:
      'Surface reservoirs buffer seasonal rainfall variability—storing wet-season inflows to maintain steady municipal water supply during dry months while balancing evaporation losses.',
    conservationTips: [
      'Floating solar arrays reduce evaporative water loss while generating clean pumping energy.',
      'Upstream riparian wetlands filter silt before water enters the reservoir basin.',
    ],
  },
  {
    id: 'treatment-plant',
    name: 'Clarion Water Treatment Plant',
    category: 'infrastructure',
    subType: 'Potable Purification Facility',
    position: [-8.5, 0.6, -5.5],
    cameraOffset: [-2, 7.5, 4],
    baseDemandLpd: 450000,
    baseStoragePct: 84,
    recyclingSupported: false,
    summary:
      'Multi-barrier drinking water facility purifying raw reservoir water through coagulation, flocculation, rapid sand filtration, and UV disinfection.',
    scienceExplanation:
      'Coagulants neutralize suspended clay particles so they clump and settle; fine silica sand and activated carbon remove turbidity and micro-organics before UV inactivation of pathogens.',
    conservationTips: [
      'Filter backwash water can be settled and recovered, cutting plant water waste by ~80%.',
      'Variable-speed pump drives adjust pressure dynamically to reduce pipe bursts.',
    ],
  },
  {
    id: 'overhead-tank',
    name: 'Elevated Hydraulic Pressure Tower',
    category: 'infrastructure',
    subType: 'Gravity Storage & Pressure Regulation',
    position: [-1.5, 2.5, -6.5],
    cameraOffset: [4, 7.5, 2],
    baseDemandLpd: 0,
    baseStoragePct: 78,
    recyclingSupported: false,
    summary:
      'Elevated spherical tank maintaining stable hydrostatic head across city distribution mains without continuous peak-hour pumping.',
    scienceExplanation:
      'Every 10 meters of water elevation generates approximately 0.98 bar (~98 kPa) of gravity pressure, smoothing diurnal morning and evening demand spikes.',
    conservationTips: [
      'Gravity pressure zoning prevents excessive night-time pressure that worsens pipe leaks.',
      'Ultrasonic level sensors prevent tank overflow events.',
    ],
  },
  {
    id: 'recycling-plant',
    name: 'Closed-Loop Wastewater Recycling Plant',
    category: 'infrastructure',
    subType: '7-Stage Resource Recovery Facility',
    position: [14.5, 0.6, 10.5],
    cameraOffset: [7, 8, 19],
    baseDemandLpd: 200000,
    baseStoragePct: 80,
    recyclingSupported: true,
    summary:
      'Transforms municipal sewage into high-grade reclaimed water for cooling towers, urban landscaping, toilet flushing, and aquifer recharge.',
    scienceExplanation:
      'Biological reactors use aerobic microbes to break down dissolved organic nutrients before ultrafiltration membranes and UV light polish water for safe non-potable reuse.',
    conservationTips: [
      'Dual purple-pipe networks deliver reclaimed water to parks and skyscrapers, cutting freshwater draw by up to 45%.',
      'Anaerobic sludge digesters generate biogas to power plant aeration blowers.',
    ],
  },
  {
    id: 'rainwater-facility',
    name: 'Eco-Canopy Rainwater Harvesting Hub',
    category: 'infrastructure',
    subType: 'Stormwater Capture & Cistern',
    position: [-10, 0.8, 10.5],
    cameraOffset: [-4, 6.5, 18],
    baseDemandLpd: 0,
    baseStoragePct: 55,
    recyclingSupported: true,
    summary:
      'Demonstrates rooftop catchment gutters, vortex first-flush diverters, sand-charcoal filtration, and underground storage cisterns.',
    scienceExplanation:
      'First-flush diverters discard the initial dusty roof runoff, allowing clean rainwater to fill subterranean tanks; excess overflow is routed into permeable recharge trenches.',
    conservationTips: [
      'Each 1 mm of rain on 1 m² of impervious roof yields up to ~0.85 litres after runoff losses.',
      'Connecting overflow pipes to recharge wells replenishes local groundwater tables.',
    ],
  },
  {
    id: 'smart-meter-hub',
    name: 'AMI Smart Water Meter & Sensor Hub',
    category: 'infrastructure',
    subType: 'District Metered Area Telemetry',
    position: [1.5, 0.7, 2.2],
    cameraOffset: [6, 6.5, 9],
    baseDemandLpd: 0,
    baseStoragePct: 90,
    recyclingSupported: true,
    summary:
      'District flow-metering station comparing inflow vs customer meter totals and listening for acoustic leak signatures in real time (simulated).',
    scienceExplanation:
      'Mass-balance monitoring (Inflow − Billed Consumption = Real + Apparent Losses) allows engineers to isolate pipeline bursts within hours instead of months.',
    conservationTips: [
      'Smart household meters alert residents immediately when continuous night-time flow indicates a hidden leak.',
      'Pressure-reducing valves (PRVs) trim background leakage by 25–35%.',
    ],
  },
  {
    id: 'sky-tower-alpha',
    name: 'AquaSpire Mixed-Use Skyscraper',
    category: 'building',
    subType: 'High-Rise Commercial & Residential Tower',
    position: [-2.5, 3.2, 2.5],
    cameraOffset: [4, 9, 10],
    simulatedPopulation: 3400,
    baseDemandLpd: 460000,
    baseStoragePct: 82,
    recyclingSupported: true,
    affectedByLeakIds: ['pipe-distribution'],
    summary:
      'Solar-clad sustainable skyscraper featuring dual potable/greywater plumbing, cooling-tower condensate recovery, and smart floor sub-meters.',
    scienceExplanation:
      'High-rise buildings rely on booster zones and intermediate break tanks; reusing treated shower/sink greywater for toilets and HVAC cooling cuts potable demand by ~40%.',
    conservationTips: [
      'Install 1.5 L/min sensor faucets and dual-flush fixtures across commercial floors.',
      'Route HVAC condensation water directly into rooftop cooling make-up tanks.',
    ],
  },
  {
    id: 'sky-tower-beta',
    name: 'Helios Civic & Research Tower',
    category: 'building',
    subType: 'Solar-Powered Innovation Tower',
    position: [4.2, 3.6, -2.5],
    cameraOffset: [10, 9.5, 5],
    simulatedPopulation: 2600,
    baseDemandLpd: 350000,
    baseStoragePct: 85,
    recyclingSupported: true,
    affectedByLeakIds: ['pipe-distribution'],
    summary:
      'Civic science tower topped with photovoltaic arrays and a terraced rainwater catchment roof supplying lab cooling loops.',
    scienceExplanation:
      'Photovoltaic panels offset the high electricity footprint of municipal water pumping and membrane treatment ("the water-energy nexus").',
    conservationTips: [
      'Closed-loop chilled water cooling eliminates single-pass water waste.',
      'Native drought-tolerant terrace gardens minimize irrigation needs.',
    ],
  },
  {
    id: 'res-district-west',
    name: 'Veridian Eco-Residences',
    category: 'building',
    subType: 'Low-Impact Residential Neighborhood',
    position: [-6.2, 1.5, 5.2],
    cameraOffset: [-1, 7.5, 13],
    simulatedPopulation: 18500,
    baseDemandLpd: 2497500,
    baseStoragePct: 76,
    recyclingSupported: true,
    affectedByLeakIds: ['pipe-distribution'],
    summary:
      'Solar-equipped residential blocks featuring rooftop rainwater harvesting, permeable courtyards, and smart household water meters.',
    scienceExplanation:
      'Domestic indoor water use averages ~135 L/person/day; high-efficiency showerheads, aerated taps, and greywater garden reuse can lower demand below 95 L/person/day.',
    conservationTips: [
      'Reuse laundry rinse water and RO reject water for garden irrigation and floor cleaning.',
      'Repair dripping taps promptly—one slow drip wastes >15 litres per day.',
    ],
  },
  {
    id: 'res-district-east',
    name: 'Harborview Apartments',
    category: 'building',
    subType: 'High-Density Urban Housing',
    position: [11.2, 1.8, -1.8],
    cameraOffset: [16, 8, 6],
    simulatedPopulation: 22000,
    baseDemandLpd: 2970000,
    baseStoragePct: 68,
    recyclingSupported: true,
    affectedByLeakIds: ['pipe-distribution', 'pipe-residential-east'],
    summary:
      'High-density east-bank residential complex supplied by the eastern trunk main across the Emerald River bridge.',
    scienceExplanation:
      'Because this district sits at the end of the eastern distribution trunk, upstream pipeline leaks rapidly drop service pressure and overhead tank reserves.',
    conservationTips: [
      'Install building-level pressure regulators and smart sub-meters per apartment block.',
      'Connect rooftop gutters to underground sump recharge pits.',
    ],
  },
  {
    id: 'industrial-tech-park',
    name: 'CleanTech Innovation Campus',
    category: 'building',
    subType: 'Zero-Liquid-Discharge Tech Campus',
    position: [10.8, 1.4, -10.2],
    cameraOffset: [16, 7.5, -3],
    simulatedPopulation: 4800,
    baseDemandLpd: 780000,
    baseStoragePct: 79,
    recyclingSupported: true,
    affectedByLeakIds: ['pipe-residential-east'],
    summary:
      'Advanced manufacturing and data-cooling campus running on reclaimed wastewater rather than potable reservoir supplies.',
    scienceExplanation:
      'Industrial cooling loops lose water mainly through evaporation; using reclaimed tertiary effluent preserves drinking water for households.',
    conservationTips: [
      'Increase cooling-tower cycles of concentration with scale monitoring.',
      'Adopt zero-liquid-discharge (ZLD) recovery for process rinse water.',
    ],
  },
  {
    id: 'pipe-intake',
    name: 'Raw Water Intake Trunk',
    category: 'pipeline',
    subType: 'Reservoir → Treatment Plant Main',
    position: [-12.2, 0.3, -8.8],
    cameraOffset: [-7, 6.5, -2],
    baseDemandLpd: 0,
    baseStoragePct: 100,
    recyclingSupported: false,
    summary:
      'Large-diameter transmission conduit conveying gravity-fed raw water from Periyar Valley Reservoir to Clarion Water Treatment Plant.',
    scienceExplanation:
      'Minimizing friction head loss with smooth epoxy-lined pipes saves significant pumping energy across large volumetric flows.',
    conservationTips: [
      'Acoustic fiber-optic sensing detects hairline joint fractures along intake mains.',
    ],
  },
  {
    id: 'pipe-distribution',
    name: 'Main Treated Distribution Line',
    category: 'pipeline',
    subType: 'Pressurized Potable Network',
    position: [1.0, 0.3, -1.5],
    cameraOffset: [5, 7, 6],
    baseDemandLpd: 0,
    baseStoragePct: 100,
    recyclingSupported: false,
    summary:
      'Pressurized central water main feeding AquaSpire, Veridian Eco-Residences, and the eastern river crossing.',
    scienceExplanation:
      'Under pressurized flow, leak rate increases roughly with the square root (or higher exponent in plastic pipes) of operating pressure—known as the FAVAD relationship.',
    conservationTips: [
      'Night-time pressure modulation reduces background weeping at pipe joints.',
      'Rapid valve isolation limits water loss when a burst is detected.',
    ],
  },
  {
    id: 'pipe-wastewater',
    name: 'Wastewater & Reclaimed Reuse Loop',
    category: 'pipeline',
    subType: 'Sewerage & Purple-Pipe Return',
    position: [7.5, 0.3, 6.8],
    cameraOffset: [12, 7.5, 13],
    baseDemandLpd: 0,
    baseStoragePct: 100,
    recyclingSupported: true,
    summary:
      'Dual-corridor network collecting urban wastewater for treatment and returning purified reclaimed water to parks, towers, and cooling loops.',
    scienceExplanation:
      'Separating storm drainage from sanitary sewers prevents monsoon rainwater from flooding wastewater treatment plants.',
    conservationTips: [
      'Keep fats, oils, and non-biodegradable wipes out of drains to protect treatment pumps.',
    ],
  },
];

export const WASTEWATER_STAGES: WastewaterStage[] = [
  {
    id: 'collection',
    step: 1,
    name: 'Collection',
    processType: 'Gravity Sewerage Network',
    description:
      'Separate sanitary pipelines channel household and commercial greywater/blackwater toward the treatment headworks.',
    contaminantsRemoved: 'Transports raw urban effluent safely away from surface rivers.',
    recoveryYieldPct: 100,
  },
  {
    id: 'screening',
    step: 2,
    name: 'Screening & Grit Removal',
    processType: 'Physical Bar Screens & Vortex Chambers',
    description:
      'Mechanical bar screens catch plastics, rags, and debris, while grit chambers settle heavy sand and gravel.',
    contaminantsRemoved: 'Coarse solids (>3 mm), sand, and grit that would damage downstream pumps.',
    recoveryYieldPct: 98,
  },
  {
    id: 'sedimentation',
    step: 3,
    name: 'Primary Sedimentation',
    processType: 'Gravity Clarifier Basins',
    description:
      'Slow-moving circular tanks let heavier organic suspended solids settle to the bottom as primary sludge.',
    contaminantsRemoved: '~55–65% of suspended solids and ~30% of biological oxygen demand (BOD).',
    recoveryYieldPct: 95,
  },
  {
    id: 'biological',
    step: 4,
    name: 'Biological Treatment',
    processType: 'Activated Sludge Aeration',
    description:
      'Oxygen is bubbled through aeration basins so beneficial aerobic microorganisms consume dissolved organic pollutants.',
    contaminantsRemoved: '>85% of dissolved organic carbon, ammonia, and nitrogen compounds.',
    recoveryYieldPct: 91,
  },
  {
    id: 'filtration',
    step: 5,
    name: 'Tertiary Membrane Filtration',
    processType: 'Ultrafiltration / Dual-Media Beds',
    description:
      'Polishes clarified effluent through fine pore membranes (0.02–0.1 µm) to remove residual turbidity and micro-particles.',
    contaminantsRemoved: 'Fine colloids, protozoa, and remaining suspended micro-solids.',
    recoveryYieldPct: 86,
  },
  {
    id: 'disinfection',
    step: 6,
    name: 'UV & Safe Disinfection',
    processType: 'Ultraviolet Irradiation',
    description:
      'High-intensity UV-C lamps neutralize bacterial and viral DNA without adding excess chemical byproducts.',
    contaminantsRemoved: '>99.9% inactivation of waterborne pathogens.',
    recoveryYieldPct: 85,
  },
  {
    id: 'reuse',
    step: 7,
    name: 'Reclaimed Urban Reuse',
    processType: 'Dual Purple-Pipe Distribution',
    description:
      'Purified reclaimed water returns to city cooling towers, park irrigation, street cleaning, and dual-flush buildings.',
    contaminantsRemoved: 'Directly offsets fresh reservoir and groundwater extraction.',
    recoveryYieldPct: 82,
  },
];

export const CITY_EMERGENCIES: CityEmergencyChallenge[] = [
  {
    id: 'em-reservoir',
    title: 'Reservoir Storage Shortage',
    issue: 'Dry-season drawdown pushes Periyar Reservoir below safe reserve (<55%).',
    metricLabel: 'Target: Reservoir ≥ 60% or Demand Balanced',
    actionLabel: 'Activate Conservation & Storage Buffer',
    impactSummary: 'Reduces peak municipal draw by 15% and prioritizes reservoir retention.',
  },
  {
    id: 'em-leak',
    title: 'Pipeline Trunk Leakage',
    issue: 'Pressurized distribution main loses treated water before reaching neighborhoods.',
    metricLabel: 'Target: Active Leak Repaired & Base Loss ≤ 10%',
    actionLabel: 'Deploy Smart Acoustic Repair Crew',
    impactSummary: 'Seals active trunk burst and cuts background network loss to 8%.',
  },
  {
    id: 'em-consumption',
    title: 'Excessive Per-Capita Consumption',
    issue: 'Unchecked cooling and residential usage drives demand above 110% baseline.',
    metricLabel: 'Target: Demand Multiplier ≤ 1.00×',
    actionLabel: 'Enable Smart Metering & Aerator Targets',
    impactSummary: 'Lowers urban demand multiplier to 0.88× (~119 L/person/day).',
  },
  {
    id: 'em-population',
    title: 'Rapid Population Growth Pressure',
    issue: 'Expanding urban population stresses treatment plant and freshwater supply margins.',
    metricLabel: 'Target: Positive Net Supply Margin',
    actionLabel: 'Expand Rainwater & Reuse Infrastructure',
    impactSummary: 'Boosts rainwater roof capture and raises recycling capacity to offset growth.',
  },
  {
    id: 'em-groundwater',
    title: 'Low Groundwater Reserves',
    issue: 'Over-pumping subsurface aquifers (>50%) risks permanent water-table decline.',
    metricLabel: 'Target: Groundwater Extraction ≤ 35%',
    actionLabel: 'Shift Supply to Recycled & Surface Sources',
    impactSummary: 'Caps aquifer extraction at 25%, allowing monsoon recharge recovery.',
  },
  {
    id: 'em-recycling',
    title: 'Insufficient Wastewater Recycling',
    issue: 'Low reuse (<45%) wastes treated effluent into the river instead of cooling/parks.',
    metricLabel: 'Target: Recycling Capacity ≥ 55%',
    actionLabel: 'Upgrade Tertiary Purple-Pipe Loop',
    impactSummary: 'Raises city-wide water recycling capacity to 65%.',
  },
];
