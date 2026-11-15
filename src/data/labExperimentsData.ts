export type LabExperimentId =
  | 'water-cycle'
  | 'rainwater-harvesting'
  | 'groundwater-depletion'
  | 'pipeline-leakage'
  | 'water-filtration'
  | 'desalination'
  | 'supply-demand'
  | 'smart-city-management';

export interface LabVariableSpec {
  name: string;
  symbol: string;
  unit: string;
  description: string;
}

export interface LabPreset {
  id: string;
  label: string;
  description: string;
  params: Record<string, number | boolean | string>;
}

export interface LabEquipmentNode {
  id: string;
  name: string;
  role: string;
  scienceDetail: string;
}

export interface LabExperimentMeta {
  id: LabExperimentId;
  number: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  category: 'Hydrology' | 'Urban Catchments' | 'Subsurface' | 'Distribution' | 'Treatment' | 'Integrated';
  accentHex: string;
  primaryGestureParam: {
    key: string;
    label: string;
    unit: string;
    step: number;
    min: number;
    max: number;
  };
  principle: string;
  processSteps: string[];
  variables: LabVariableSpec[];
  calculationMethod: string;
  formulaDisplay: string;
  assumptions: string[];
  limitations: string[];
  safetyNotice?: string;
  disclaimer: string;
  learningOutcomes: string[];
  presets: LabPreset[];
  equipmentNodes: LabEquipmentNode[];
  cameraTarget: [number, number, number];
  cameraOffset: [number, number, number];
}

export const LAB_EXPERIMENTS: LabExperimentMeta[] = [
  {
    id: 'water-cycle',
    number: '01',
    title: 'Hydrological Water Cycle Chamber',
    shortTitle: 'Water Cycle',
    subtitle: 'Solar heating, ocean evaporation, cloud condensation, precipitation & aquifer recharge',
    category: 'Hydrology',
    accentHex: '#38bdf8',
    primaryGestureParam: {
      key: 'temperatureC',
      label: 'Ambient Temperature',
      unit: '°C',
      step: 2,
      min: 10,
      max: 42,
    },
    principle:
      'Solar radiation supplies latent heat (approx. 2.45 MJ/kg) to evaporate liquid water from oceans and land surfaces. Warm moist air rises, cools adiabatically, condenses on aerosols into clouds, and returns to Earth as precipitation feeding surface runoff and groundwater infiltration.',
    processSteps: [
      'Solar irradiance warms the ocean basin, increasing molecular kinetic energy and vapor pressure.',
      'Evaporated water vapor rises into the cooler upper atmosphere.',
      'Water vapor condenses around micro-nuclei into visible cloud droplets, releasing latent heat.',
      'Precipitation falls onto vegetated terrain: part becomes surface river runoff and part infiltrates into the subsurface water table.',
      'Surface rivers and coastal groundwater baseflow return water back to the ocean basin.',
    ],
    variables: [
      { name: 'Ambient Temperature', symbol: 'T', unit: '°C', description: 'Surface air temperature driving saturation vapor capacity (~7% rise per °C).' },
      { name: 'Solar Intensity', symbol: 'I', unit: '%', description: 'Normalized incoming solar radiation powering surface evaporation.' },
      { name: 'Rainfall Intensity', symbol: 'P', unit: 'mm', description: 'Shared atmospheric precipitation rate synced with City & Underground.' },
      { name: 'Cloud Condensation Rate', symbol: 'C', unit: '%', description: 'Efficiency of vapor-to-droplet cloud nucleation.' },
      { name: 'Simulation Speed', symbol: 'v', unit: '×', description: 'Educational time-scale multiplier for observing dynamic fluxes.' },
    ],
    calculationMethod:
      'Saturation multiplier scales exponentially with temperature (Clausius–Clapeyron approximation: 1.07^(T−20)) multiplied by solar intensity. Infiltration depends on shared Underground soil permeability & permeable recharge area, while the remaining precipitation forms surface river runoff.',
    formulaDisplay: 'E = E₀ × (I / 100) × 1.07^(T − 20)   |   P = R_runoff + R_infiltration',
    assumptions: [
      'Closed atmospheric-basin balance ignores cross-continental monsoon wind exports.',
      'Infiltration partition reuses the soil permeability class configured in Underground Water World.',
      'Fluxes are scaled to daily basin equivalents (mm/day and ML/day) for classroom clarity.',
    ],
    limitations: [
      'Simplified educational mass-balance model — NOT a numerical weather prediction or real-time meteorological forecast.',
      'Does not simulate extreme hurricane thermodynamics or topographic rain-shadow aerodynamics.',
    ],
    disclaimer:
      'Simulated educational hydrology model. Values illustrate conservation of mass and thermal trends rather than live weather telemetry.',
    learningOutcomes: [
      'Explain why rising air temperatures amplify both evaporation and heavy precipitation potential.',
      'Connect atmospheric rainfall directly to subterranean aquifer recharge and surface runoff.',
    ],
    presets: [
      {
        id: 'monsoon-peak',
        label: 'Monsoon Peak',
        description: 'Warm ocean heating + intense rainfall feeding rapid infiltration',
        params: { temperatureC: 30, solarIntensityPct: 82, rainfallIntensity: 96, cloudFormationRatePct: 90 },
      },
      {
        id: 'heatwave-drought',
        label: 'Arid Heatwave',
        description: 'High evaporation demand with minimal cloud formation and low rain',
        params: { temperatureC: 39, solarIntensityPct: 96, rainfallIntensity: 12, cloudFormationRatePct: 30 },
      },
      {
        id: 'balanced-temperate',
        label: 'Balanced Climate',
        description: 'Moderate evaporation matching steady precipitation and aquifer recharge',
        params: { temperatureC: 24, solarIntensityPct: 70, rainfallIntensity: 52, cloudFormationRatePct: 72 },
      },
    ],
    equipmentNodes: [
      { id: 'wc-ocean-basin', name: 'Heated Ocean Reservoir', role: 'Evaporation Source', scienceDetail: 'Simulates Earth’s saline ocean supplying ~86% of global atmospheric vapor.' },
      { id: 'wc-solar-emitter', name: 'Solar Thermal Array', role: 'Energy Input', scienceDetail: 'Provides radiant energy driving phase change from liquid water to water vapor.' },
      { id: 'wc-condenser-cloud', name: 'Atmospheric Cloud Deck', role: 'Condensation Zone', scienceDetail: 'Cools rising vapor below its dew point to nucleate falling droplets.' },
      { id: 'wc-catchment-slope', name: 'Land Catchment & Aquifer Table', role: 'Runoff vs Infiltration', scienceDetail: 'Splits falling rain between fast surface rivers and deep groundwater recharge.' },
    ],
    cameraTarget: [0, 1.5, 0],
    cameraOffset: [7.8, 4.8, 9.6],
  },
  {
    id: 'rainwater-harvesting',
    number: '02',
    title: 'Rainwater Harvesting Rig',
    shortTitle: 'Rainwater Harvest',
    subtitle: 'Roof catchment, gutters, first-flush diverter, sand-carbon filter, cistern & recharge pit',
    category: 'Urban Catchments',
    accentHex: '#2dd4bf',
    primaryGestureParam: {
      key: 'rainfallMm',
      label: 'Design Rainfall Event',
      unit: 'mm',
      step: 5,
      min: 0,
      max: 150,
    },
    principle:
      'Intercepting clean roof runoff before it hits impervious streets captures high-quality freshwater. First-flush diverters discard the initial dusty wash, multi-media filters remove leaves and grit, cisterns store water for non-potable use, and overflow pipes recharge groundwater aquifers.',
    processSteps: [
      'Rain falls over the sloped catchment roof with known area (m²) and surface runoff coefficient.',
      'Perimeter gutters channel runoff to the vertical downpipe.',
      'First-flush diverter chamber isolates the initial dust-laden millimetres of rain.',
      'Dual-stage coarse screen + sand-charcoal filter clarifies remaining water at defined filter efficiency.',
      'Filtered water fills the main storage cistern; excess volume spills cleanly into the percolation recharge pit.',
    ],
    variables: [
      { name: 'Rainfall Depth', symbol: 'R', unit: 'mm', description: 'Precipitation depth during the simulated rain event (1 mm over 1 m² = 1 L).' },
      { name: 'Roof Catchment Area', symbol: 'A', unit: 'm²', description: 'Horizontal projected roof area collecting rainfall.' },
      { name: 'Runoff Coefficient', symbol: 'C', unit: 'ratio', description: 'Fraction of rain flowing off roof (0.85–0.92 metal/tile, 0.50–0.70 green roof).' },
      { name: 'First-Flush Diversion', symbol: 'F', unit: 'mm', description: 'Initial rainfall depth bypassed to discard roof dust & bird droppings.' },
      { name: 'Filter Efficiency', symbol: 'η', unit: '%', description: 'Hydraulic pass-through efficiency of leaf screens & sand/charcoal beds.' },
      { name: 'Cistern Capacity', symbol: 'V_max', unit: 'L', description: 'Maximum storage volume of the household or building tank.' },
    ],
    calculationMethod:
      'Gross catchment volume follows the exact rational formula V_gross (L) = Rainfall (mm) × Area (m²) × Runoff Coefficient. Separately, net harvestable volume subtracts first-flush depth (F × A × C) and applies filter hydraulic efficiency (η/100), routing overflow above tank capacity into the recharge pit.',
    formulaDisplay: 'Collected (L) = Rainfall (mm) × Roof Area (m²) × Runoff Coeff (C)',
    assumptions: [
      '1 mm depth of rainfall across 1 m² equals 1.0 litre by definition (0.001 m × 1 m² = 0.001 m³ = 1 L).',
      'Roof splash/evaporation losses are captured by (1 − C); filter & first-flush losses are tracked separately.',
      'Tank overflow is assumed to enter an unlined percolation pit at the site.',
    ],
    limitations: [
      'Stored rooftop rainwater is non-potable without dedicated disinfection (boiling, UV, or chlorination).',
      'Event yield represents a single storm pulse rather than continuous multi-season rainfall time series.',
    ],
    disclaimer:
      'Educational engineering calculator aligned with Smart City cistern state. Always disinfect & test harvested rainwater before drinking.',
    learningOutcomes: [
      'Calculate exact roof harvesting potential in litres using area, rainfall depth, and runoff coefficient.',
      'Understand why first-flush diversion and overflow recharge pits maximize both water quality and aquifer health.',
    ],
    presets: [
      {
        id: 'kerala-monsoon',
        label: 'Kerala Monsoon Downpour',
        description: '95 mm storm over a 450 m² sheet-metal roof',
        params: { rainfallMm: 95, roofAreaM2: 450, runoffCoeff: 0.9, filterEfficiencyPct: 92, firstFlushMm: 1.5 },
      },
      {
        id: 'urban-home',
        label: 'Eco-Home Standard',
        description: '35 mm shower on a 220 m² concrete roof',
        params: { rainfallMm: 35, roofAreaM2: 220, runoffCoeff: 0.85, filterEfficiencyPct: 90, firstFlushMm: 1.0 },
      },
      {
        id: 'green-roof',
        label: 'Vegetated Green Roof',
        description: '45 mm rain on a 400 m² planted roof with higher retention',
        params: { rainfallMm: 45, roofAreaM2: 400, runoffCoeff: 0.58, filterEfficiencyPct: 86, firstFlushMm: 1.0 },
      },
    ],
    equipmentNodes: [
      { id: 'rh-roof-catchment', name: 'Instrumented Catchment Roof', role: 'Collection Surface', scienceDetail: 'Sloped roof surface where runoff coefficient C governs splash vs gutter capture.' },
      { id: 'rh-first-flush', name: 'First-Flush Diverter Column', role: 'Contaminant Bypass', scienceDetail: 'Diverts initial dusty roof runoff away from the clean cistern.' },
      { id: 'rh-filter-vessel', name: 'Dual-Media Sand & Carbon Filter', role: 'Suspended Solids Removal', scienceDetail: 'Traps leaves, grit, and roof sediment prior to tank storage.' },
      { id: 'rh-storage-tank', name: 'Smart Storage Cistern', role: 'Buffered Supply', scienceDetail: 'Holds clarified water up to tank capacity, cutting municipal demand.' },
      { id: 'rh-recharge-pit', name: 'Aquifer Recharge Percolation Pit', role: 'Overflow Recovery', scienceDetail: 'Routes surplus storm overflow underground to replenish shallow water tables.' },
    ],
    cameraTarget: [0, 1.5, 0],
    cameraOffset: [8.2, 4.9, 9.4],
  },
  {
    id: 'groundwater-depletion',
    number: '03',
    title: 'Aquifer Depletion & Recharge Column',
    shortTitle: 'Aquifer Depletion',
    subtitle: 'Layered strata, water table drawdown, borewell pumping cones & recharge recovery',
    category: 'Subsurface',
    accentHex: '#22d3ee',
    primaryGestureParam: {
      key: 'groundwaterExtractionPct',
      label: 'Extraction Intensity',
      unit: '%',
      step: 5,
      min: 5,
      max: 95,
    },
    principle:
      'Aquifers behave like underground water banks: when extraction through borewells and urban pumping exceeds natural rainfall infiltration, hydraulic head drops, creating cones of depression around wells and drying shallow open wells above deep confined strata.',
    processSteps: [
      'Rainfall infiltrates through topsoil and unsaturated sand based on soil permeability and open land area.',
      'Water reaches the phreatic water table (top of the saturated unconfined gravel aquifer).',
      'Active shallow wells (14 m) and deep borewells (29–34 m) withdraw water continuously.',
      'If extraction exceeds recharge (net balance < 0), aquifer storage declines and the water table sinks.',
      'Pausing pumping or boosting permeable recharge surfaces allows gradual water-table recovery.',
    ],
    variables: [
      { name: 'Active Extraction Rate', symbol: 'Q_ext', unit: 'ML/d', description: 'Combined pumping from active underground wells and Smart City demand.' },
      { name: 'Natural & Managed Recharge', symbol: 'Q_rec', unit: 'ML/d', description: 'Rainfall percolation governed by permeability and open recharge land (%).' },
      { name: 'Water Table Depth', symbol: 'D_wt', unit: 'm', description: 'Depth from ground surface to phreatic water level (4.2–33.5 m).' },
      { name: 'Active Wells Count', symbol: 'N_w', unit: 'wells', description: 'Number of active pumping wells synchronized with Underground Water World.' },
      { name: 'Projection Horizon', symbol: 'T_sim', unit: 'years', description: 'Multi-year projection horizon showing cumulative storage shift.' },
    ],
    calculationMethod:
      'Net aquifer balance ΔS = Recharge (ML/d) − Extraction (ML/d). Current storage % maps linearly between 4 m (full) and 34 m (depleted). Multi-year storage change multiplies annual net balance across the chosen simulation duration.',
    formulaDisplay: 'ΔS = Recharge Rate − Extraction Rate   |   D_next = D_curr − k · ΔS · Δt',
    assumptions: [
      'Reuses the exact live well network, permeability, and phreatic depth of Phase 3 Underground Water World.',
      'Uniform effective porosity is assumed across the bench block for multi-year projections.',
    ],
    limitations: [
      'Simplified lumped water-balance column — not calibrated to site-specific piezometer logs or real borewell telemetry.',
      'Real confined aquifer recovery times can span decades longer than accelerated classroom playback.',
    ],
    disclaimer:
      'Educational hydrogeology simulation linked to Phase 3 Underground state. Readings are simulated values, not live well measurements.',
    learningOutcomes: [
      'Identify why shallow 14 m open wells fail before deep confined borewells during over-pumping.',
      'Quantify the pumping reduction and permeable land area needed to return an aquifer to positive balance.',
    ],
    presets: [
      {
        id: 'sustainable-balance',
        label: 'Sustainable Equilibrium',
        description: 'High permeability + 1 active shallow well + healthy monsoon recharge',
        params: { extractionPct: 24, rechargeAreaPct: 75, rainfallIntensity: 75, groundwaterHorizonYears: 5 },
      },
      {
        id: 'severe-overdraft',
        label: 'Severe Over-Pumping',
        description: 'Heavy pumping + paved low recharge -> rapid water table fall',
        params: { extractionPct: 86, rechargeAreaPct: 24, rainfallIntensity: 18, groundwaterHorizonYears: 10 },
      },
      {
        id: 'managed-recovery',
        label: 'Artificial Recharge Recovery',
        description: 'Reduced extraction with 88% permeable recharge basins',
        params: { extractionPct: 18, rechargeAreaPct: 88, rainfallIntensity: 96, groundwaterHorizonYears: 5 },
      },
    ],
    equipmentNodes: [
      { id: 'gd-strata-column', name: 'Transparent Geological Strata Core', role: 'Topsoil to Bedrock', scienceDetail: 'Shows topsoil, unsaturated sand, gravel aquifer, clay aquitard, and sandstone aquifer.' },
      { id: 'gd-water-table', name: 'Dynamic Phreatic Water Table', role: 'Saturation Boundary', scienceDetail: 'Rises during net recharge and drops during over-extraction.' },
      { id: 'gd-shallow-well', name: 'Shallow Open Well Rig (14 m)', role: 'Vulnerable Intake', scienceDetail: 'Goes dry whenever the water table drops beneath 14 m.' },
      { id: 'gd-deep-borewell', name: 'Cased Deep Borewell Pump (34 m)', role: 'Confined Pumping', scienceDetail: 'Extracts pressurized water from beneath the clay aquitard.' },
    ],
    cameraTarget: [0, 1.4, 0],
    cameraOffset: [7.5, 4.4, 9.2],
  },
  {
    id: 'pipeline-leakage',
    number: '04',
    title: 'Pressurized Pipeline Leakage Rig',
    shortTitle: 'Pipeline Leakage',
    subtitle: 'Hydraulic main & branches, flow meters, burst jets, pressure drop & active leak repair',
    category: 'Distribution',
    accentHex: '#fb923c',
    primaryGestureParam: {
      key: 'pipelinePressureBar',
      label: 'Main Pressure',
      unit: 'bar',
      step: 0.4,
      min: 2.0,
      max: 6.5,
    },
    principle:
      'Water escaping from pressurized municipal mains follows orifice hydraulics: flow rate increases with both crack cross-sectional area and the square root of internal pressure (Q ∝ A · √P). Leaks drain treated water, collapse downstream pressure, and raise pumping energy.',
    processSteps: [
      'Pump station pressurizes the municipal trunk line (2.0–6.5 bar) at set supply flow (L/hr).',
      'Upstream smart flow meter measures total water entering the distribution network.',
      'Pressurized bursts spray water continuously according to crack diameter (mm), number of leaks, and bar pressure.',
      'Downstream pressure gauges register hydraulic head loss while branch buildings experience low pressure.',
      'Triggering "Repair Pipelines" seals active breaks, stopping spray loss and restoring pressure across City & Lab.',
    ],
    variables: [
      { name: 'System Pressure', symbol: 'P', unit: 'bar', description: 'Shared municipal distribution line pressure synced with Smart City.' },
      { name: 'Leak Orifice Size', symbol: 'd', unit: 'mm', description: 'Effective equivalent diameter of each pipe rupture or joint crack.' },
      { name: 'Active Leak Points', symbol: 'N_L', unit: 'leaks', description: 'Number of active ruptures along main and residential branch pipes.' },
      { name: 'Supply Input Rate', symbol: 'Q_in', unit: 'L/hr', description: 'Treated water entering the test distribution manifold.' },
    ],
    calculationMethod:
      'Simulated orifice loss per leak uses Q_leak = C_d · A_orifice · √(2·ΔP/ρ) converted to L/hr and summed across N_L active leaks plus background seepage. Repairing zeroes active burst discharge and drops background leakage to ~6%.',
    formulaDisplay: 'Q_leak ∝ N_L · (π·d²/4) · √P   |   Efficiency = (Q_delivered / Q_in) × 100%',
    assumptions: [
      'Orifice discharge coefficient C_d = 0.62 represents sharp circular pipe fractures.',
      'Repaired pipes reset Smart City trunk burst state (`city.leak.active = false`).',
    ],
    limitations: [
      'Steady hydraulic snapshot ignores transient water-hammer pressure surges.',
      'Real urban pipes experience variable soil back-pressure that alters buried leak rates.',
    ],
    disclaimer:
      'Educational hydraulic leak model synchronized with Phase 2 Smart City & Phase 3 buried pipelines. Pressure/flow figures are simulated.',
    learningOutcomes: [
      'Discover how modest nighttime pressure management dramatically cuts non-revenue water loss.',
      'Quantify how quickly a single 16 mm pressurized crack wastes tens of thousands of litres per day.',
    ],
    presets: [
      {
        id: 'critical-burst',
        label: 'High-Pressure Burst',
        description: '5.8 bar pressure + 3 large 24 mm leaks disrupting downstream buildings',
        params: { pipelinePressureBar: 5.8, leakOrificeMm: 24, leakCount: 3, leakActive: true },
      },
      {
        id: 'minor-seepage',
        label: 'Moderate Joint Crack',
        description: '4.0 bar + 1 small 10 mm leak for leak-detection testing',
        params: { pipelinePressureBar: 4.0, leakOrificeMm: 10, leakCount: 1, leakActive: true },
      },
      {
        id: 'sealed-network',
        label: 'Repaired Tight Network',
        description: 'Zero active bursts, optimal 3.8 bar pressure across all buildings',
        params: { pipelinePressureBar: 3.8, leakOrificeMm: 8, leakCount: 0, leakActive: false },
      },
    ],
    equipmentNodes: [
      { id: 'pl-pump-header', name: 'Variable-Pressure Supply Header', role: 'Hydraulic Source', scienceDetail: 'Regulates trunk line pressure (2.0–6.5 bar) entering the neighborhood loop.' },
      { id: 'pl-smart-meter', name: 'Ultrasonic Flow Meter Node', role: 'Non-Revenue Water Monitor', scienceDetail: 'Detects imbalance between trunk inflow and building consumption.' },
      { id: 'pl-leak-manifold', name: 'Fractured Pipe & Spray Manifold', role: 'Leakage Visualization', scienceDetail: 'Sprays water droplets proportional to pressure and crack size until repaired.' },
      { id: 'pl-building-branches', name: 'Downstream Building Feeders', role: 'Affected Consumers', scienceDetail: 'Shows falling pressure gauge and reduced delivery during major trunk bursts.' },
    ],
    cameraTarget: [0, 1.3, 0],
    cameraOffset: [8.0, 4.5, 8.8],
  },
  {
    id: 'water-filtration',
    number: '05',
    title: 'Multi-Stage Water Filtration Bench',
    shortTitle: 'Water Filtration',
    subtitle: 'Sedimentation chamber, gravel bed, fine silica sand, activated carbon & turbidity meter',
    category: 'Treatment',
    accentHex: '#34d399',
    primaryGestureParam: {
      key: 'initialTurbidityNtu',
      label: 'Raw Water Turbidity',
      unit: 'NTU',
      step: 15,
      min: 15,
      max: 300,
    },
    principle:
      'Physical-adsorptive filtration removes suspended particles in size order: gravity sedimentation settles heavy grit, coarse gravel distributes flow and traps debris, fine sand strains micro-silt, and porous activated carbon adsorbs dissolved organic odor and color molecules.',
    processSteps: [
      'Raw turbid water (measured in NTU) enters the gravity sedimentation chamber where dense silt settles.',
      'Water passes downward through coarse gravel to prevent clogging and trap coarse suspended solids.',
      'Fine silica sand layer physically strains clay flocs and suspended colloids.',
      'Granular activated carbon (GAC) adsorbs organic compounds, chlorine taste, and trace odors.',
      'Clarified effluent exits to the clean observation tank — still requiring disinfection before drinking.',
    ],
    variables: [
      { name: 'Initial Turbidity', symbol: 'T_0', unit: 'NTU', description: 'Cloudiness of raw source water in Nephelometric Turbidity Units.' },
      { name: 'Filtration Flow Rate', symbol: 'Q', unit: 'L/min', description: 'Higher flow cuts contact time and reduces fine straining effectiveness.' },
      { name: 'Media Condition', symbol: 'M_c', unit: '%', description: 'Cleanliness/backwash status of gravel, sand, and carbon beds.' },
      { name: 'Sedimentation Time', symbol: 't_sed', unit: 'min', description: 'Residence time in the primary settling basin prior to media beds.' },
      { name: 'Activated Carbon Efficiency', symbol: 'η_C', unit: '%', description: 'Adsorption capacity remaining in the granular activated carbon bed.' },
    ],
    calculationMethod:
      'Sequential first-order removal efficiency through Sedimentation -> Gravel -> Sand -> Activated Carbon, penalized when flow rate rises above 25 L/min or filter condition degrades below 75%.',
    formulaDisplay: 'T_out = T_0 × (1 − η_sed) × (1 − η_gravel) × (1 − η_sand) × (1 − η_carbon)',
    assumptions: [
      'Turbidity reduction reflects suspended solids removal rather than dissolved ionic salinity.',
      'Gravity flow operates at atmospheric bench head without chemical coagulant dosing.',
    ],
    limitations: [
      'CANNOT remove dissolved salts (NaCl), hard minerals, heavy metals (arsenic/lead), fluoride, or microscopic viruses.',
      'Media clogging slows flow and causes breakthrough turbidity if not periodically backwashed.',
    ],
    safetyNotice:
      'POTABLE WATER SAFETY NOTICE: Mechanical gravel, sand, and activated carbon filtration alone does NOT make contaminated water safe to drink. Microscopic bacteria, protozoa, and viruses can still pass through—microbiological disinfection (UV, chlorination, or boiling) and laboratory quality testing remain essential.',
    disclaimer:
      'Educational treatment bench simulation. Ordinary physical filtration reduces turbidity & odors but does not replace biological disinfection or lab testing.',
    learningOutcomes: [
      'Identify the specific physical or chemical removal mechanism in sedimentation, gravel, sand, and activated carbon.',
      'Explain why clear filtered water is not automatically microbiologically safe to drink without disinfection.',
    ],
    presets: [
      {
        id: 'monsoon-muddy',
        label: 'Muddy Monsoon Runoff',
        description: '240 NTU high-silt intake tested against clean media & long settling',
        params: { initialTurbidityNtu: 240, flowRateLpm: 16, filterConditionPct: 95, sedimentationMin: 45, carbonEfficiencyPct: 92 },
      },
      {
        id: 'fouled-high-flow',
        label: 'Overloaded Dirty Filter',
        description: 'Fast 52 L/min flow through 40% clogged beds showing turbidity breakthrough',
        params: { initialTurbidityNtu: 160, flowRateLpm: 52, filterConditionPct: 40, sedimentationMin: 10, carbonEfficiencyPct: 55 },
      },
      {
        id: 'lab-baseline',
        label: 'Nominal Bench Run',
        description: '120 NTU raw water at optimal 22 L/min contact rate',
        params: { initialTurbidityNtu: 120, flowRateLpm: 22, filterConditionPct: 88, sedimentationMin: 30, carbonEfficiencyPct: 90 },
      },
    ],
    equipmentNodes: [
      { id: 'wf-sediment-tank', name: 'Raw Intake & Sedimentation Basin', role: 'Gravity Settling', scienceDetail: 'Removes heavy sand/silt particles before reaching fine filter beds.' },
      { id: 'wf-gravel-bed', name: 'Graded Gravel Column', role: 'Coarse Barrier', scienceDetail: 'Supports finer sand above and traps coarse debris.' },
      { id: 'wf-sand-bed', name: 'Fine Silica Sand Layer', role: 'Micro-Straining', scienceDetail: 'Captures fine suspended clay and flocs.' },
      { id: 'wf-carbon-bed', name: 'Activated Carbon Cartridge', role: 'Adsorption Stage', scienceDetail: 'High-surface-area carbon pores bind organic taste, odor, and color molecules.' },
      { id: 'wf-clean-receiver', name: 'Clarified Tank & Optical Turbidity Sensor', role: 'Outlet Verification', scienceDetail: 'Measures remaining NTU — still requires disinfection before human consumption.' },
    ],
    cameraTarget: [0, 1.5, 0],
    cameraOffset: [7.8, 4.4, 9.0],
  },
  {
    id: 'desalination',
    number: '06',
    title: 'Reverse Osmosis Desalination Plant',
    shortTitle: 'Desalination RO',
    subtitle: 'Seawater intake, pretreatment, high-pressure pump, RO membranes & brine management',
    category: 'Treatment',
    accentHex: '#60a5fa',
    primaryGestureParam: {
      key: 'feedPressureBar',
      label: 'Feed Pressure',
      unit: 'bar',
      step: 4,
      min: 35,
      max: 80,
    },
    principle:
      'Normal osmosis moves freshwater across a semi-permeable membrane toward salty water. Reverse Osmosis (RO) applies external hydraulic pressure (55–70 bar) higher than seawater’s natural osmotic pressure (~27 bar at 35 g/L salinity) to force pure H₂O molecules through spiral-wound membranes while rejecting 98–99% of dissolved salt ions.',
    processSteps: [
      'Seawater at salinity S (typically 35 g/L / PSU) enters through fine pretreatment cartridges to protect delicate membranes.',
      'High-pressure centrifugal pump boosts feed stream to 35–80 bar against osmotic resistance.',
      'Inside pressure vessels, spiral-wound polyamide RO membranes allow H₂O molecules through while rejecting Na⁺ and Cl⁻ ions.',
      'Low-salinity freshwater permeate flows to municipal storage.',
      'Concentrated hyper-saline brine exits through energy-recovery diffusers before responsible marine dilution.',
    ],
    variables: [
      { name: 'Seawater Salinity', symbol: 'S_in', unit: 'g/L (PSU)', description: 'Total dissolved salts (~35 g/L global ocean, ~42–45 g/L enclosed seas).' },
      { name: 'Applied Feed Pressure', symbol: 'P_feed', unit: 'bar', description: 'Pump pressure applied to overcome natural osmotic back-pressure.' },
      { name: 'Membrane Recovery Rate', symbol: 'Y', unit: '%', description: 'Fraction of feed seawater converted into freshwater permeate.' },
      { name: 'Energy Assumptions Factor', symbol: 'k_E', unit: '×', description: 'Plant efficiency multiplier reflecting pump & energy-recovery turbine state.' },
      { name: 'Feed Volume Batch', symbol: 'V_feed', unit: 'm³', description: 'Total seawater batch volume processed in the current calculation.' },
    ],
    calculationMethod:
      'Van ’t Hoff osmotic approximation: Π_osm (bar) ≈ 0.78 × Salinity (g/L). Freshwater permeate only flows when Feed Pressure > Π_osm. Freshwater = Feed × Effective Recovery; Brine = Feed − Freshwater; Brine Salinity concentrates by 1/(1−Y). Specific energy rises with applied pressure and osmotic resistance.',
    formulaDisplay: 'Π_osm ≈ 0.78 × S (bar)   |   V_fresh = V_feed × Y_eff   |   S_brine ≈ S_in / (1 − Y_eff)',
    assumptions: [
      'Pretreatment removes suspended solids prior to the RO pressure vessels.',
      'Specific energy (kWh/m³) assumes modern pressure-exchanger energy recovery when factor ≈ 1.0×.',
    ],
    limitations: [
      'Below osmotic pressure (~27.3 bar for 35 g/L seawater), reverse osmosis stalls completely with zero permeate output.',
      'Concentrated brine discharge (~55–75 g/L) can harm benthic marine life if released without submerged multi-port diffusers.',
      'High electrical footprint makes desalination more expensive than rainwater harvesting or conservation.',
    ],
    disclaimer:
      'Educational membrane physics model. Real RO plants require post-mineralization, pH stabilization, and strict brine outfall permitting.',
    learningOutcomes: [
      'Explain why seawater RO requires 55–70 bar operating pressure to overcome natural osmotic pressure.',
      'Evaluate the trade-off between higher membrane recovery, specific energy use (kWh/m³), and concentrated brine salinity.',
    ],
    presets: [
      {
        id: 'nominal-seawater',
        label: 'Ocean Standard RO',
        description: '35 g/L seawater at 62 bar, 42% recovery with energy recovery',
        params: { salinityGpl: 35, feedPressureBar: 62, recoveryRatePct: 42, feedVolumeM3: 100, energyFactor: 1.0 },
      },
      {
        id: 'osmotic-stall',
        label: 'Below Osmotic Pressure',
        description: 'High 45 g/L hypersaline water at insufficient 36 bar -> zero permeate stall',
        params: { salinityGpl: 45, feedPressureBar: 36, recoveryRatePct: 40, feedVolumeM3: 100, energyFactor: 1.1 },
      },
      {
        id: 'high-recovery',
        label: 'Max Recovery Push',
        description: 'High 74 bar pressure achieving 52% recovery with dense 72 g/L brine',
        params: { salinityGpl: 36, feedPressureBar: 74, recoveryRatePct: 52, feedVolumeM3: 120, energyFactor: 1.0 },
      },
    ],
    equipmentNodes: [
      { id: 'ro-intake-pretreat', name: 'Seawater Intake & Pretreatment Rack', role: 'Micro-Filtration', scienceDetail: 'Protects fragile RO polyamide films from silt and algae biofouling.' },
      { id: 'ro-hp-pump', name: 'High-Pressure Triplex Pump', role: '60+ Bar Drive', scienceDetail: 'Supplies hydraulic energy exceeding seawater osmotic pressure (~27 bar).' },
      { id: 'ro-membrane-vessels', name: 'Spiral-Wound RO Pressure Vessels', role: 'Ionic Separation', scienceDetail: 'Rejects >98.5% of dissolved salt ions while permeating freshwater.' },
      { id: 'ro-fresh-tank', name: 'Permeate Freshwater Tank', role: 'Product Output', scienceDetail: 'Stores desalinated water for stabilization and city supply.' },
      { id: 'ro-brine-outfall', name: 'Concentrated Brine Diffuser', role: 'Reject Management', scienceDetail: 'Handles concentrated salty reject stream that must be safely diluted.' },
    ],
    cameraTarget: [0, 1.4, 0],
    cameraOffset: [8.4, 4.5, 9.2],
  },
  {
    id: 'supply-demand',
    number: '07',
    title: 'Urban Water Supply & Demand Balance',
    shortTitle: 'Supply & Demand',
    subtitle: 'Reservoir, treatment intake, distribution losses, city sectors & shortage analysis',
    category: 'Urban Catchments',
    accentHex: '#a78bfa',
    primaryGestureParam: {
      key: 'population',
      label: 'City Population',
      unit: 'ppl',
      step: 15000,
      min: 50000,
      max: 400000,
    },
    principle:
      'Water security requires matching total municipal supply capacity against domestic, commercial, industrial, and pipeline-loss requirements. Even small drops in distribution losses or per-capita usage compound into megalitres saved daily across growing populations.',
    processSteps: [
      'Population multiplied by per-person daily demand sets domestic consumption (ML/d).',
      'Commercial offices and industrial parks add sector demand requirements.',
      'Distribution leakage % inflates the gross treated volume that must leave the treatment plant.',
      'Available supply is drawn from the storage reservoir and treatment capacity.',
      'When gross requirement exceeds supply, reservoir reserves deplete and shortage rationing ensues.',
    ],
    variables: [
      { name: 'City Population', symbol: 'P_pop', unit: 'people', description: 'Shared municipal population synchronized with Future Smart City.' },
      { name: 'Per-Person Demand', symbol: 'q_p', unit: 'L/day', description: 'Average residential water allowance per resident (default 135 L/person/day).' },
      { name: 'Industrial Demand', symbol: 'D_ind', unit: 'ML/d', description: 'Manufacturing, cooling, and CleanTech campus demand.' },
      { name: 'Commercial Demand', symbol: 'D_com', unit: 'ML/d', description: 'Civic towers, hospitals, schools, and business districts.' },
      { name: 'Available Supply Rate', symbol: 'Q_sup', unit: 'ML/d', description: 'Treated water output deliverable by plant and intake.' },
      { name: 'Distribution Loss', symbol: 'L_%', unit: '%', description: 'Fraction lost between treatment outlet and customer taps.' },
    ],
    calculationMethod:
      'Total End Demand = (Population × L/person/day)/10⁶ + Industrial + Commercial. Gross Required Supply = Total End Demand / (1 − Distribution Loss/100). Surplus/Deficit = Available Supply − Gross Required.',
    formulaDisplay: 'Deficit/Surplus = Q_supply − [ (Pop·q_p/10⁶ + D_ind + D_com) / (1 − Loss) ]',
    assumptions: [
      'Population and reservoir percentage share state directly with Phase 2 Smart City.',
      'Per-person L/day syncs `city.demandMultiplier` proportionally against the 135 L/day baseline.',
    ],
    limitations: [
      'Daily steady-state average omits sharp morning/evening peak-hour pressure spikes.',
      'Does not automatically account for drought rationing ordinances unless adjusted via controls.',
    ],
    disclaimer:
      'Educational urban demand-balance model linked to Phase 2 Smart City population and reservoir level.',
    learningOutcomes: [
      'Calculate municipal demand in Megalitres/day from population and per-capita consumption.',
      'Observe how distribution losses multiply the raw water extraction required from reservoirs.',
    ],
    presets: [
      {
        id: 'sustainable-surplus',
        label: 'Efficiency Surplus',
        description: 'Moderate population, 110 L/day fixtures, low 8% network loss',
        params: { population: 150000, perCapitaLpd: 110, industrialDemandMLd: 4.5, commercialDemandMLd: 3.5, availableSupplyMLd: 36, distributionLossPct: 8 },
      },
      {
        id: 'rapid-urban-deficit',
        label: 'Booming Megacity Deficit',
        description: '320,000 residents, 170 L/day demand, 24% leakage -> acute daily deficit',
        params: { population: 320000, perCapitaLpd: 170, industrialDemandMLd: 10.0, commercialDemandMLd: 6.5, availableSupplyMLd: 42, distributionLossPct: 24 },
      },
      {
        id: 'balanced-city',
        label: 'Current City Baseline',
        description: '165,000 residents at 135 L/day baseline with 34 ML/d supply',
        params: { population: 165000, perCapitaLpd: 135, industrialDemandMLd: 5.5, commercialDemandMLd: 4.0, availableSupplyMLd: 36, distributionLossPct: 12 },
      },
    ],
    equipmentNodes: [
      { id: 'sd-reservoir-tower', name: 'Municipal Reservoir & Intake Gauge', role: 'Storage Buffer', scienceDetail: 'Stores reserve megalitres buffering daily deficits before shortages hit.' },
      { id: 'sd-treatment-core', name: 'Supply Distribution Manifold', role: 'Delivery Trunk', scienceDetail: 'Dispatches treated ML/d while accounting for distribution losses.' },
      { id: 'sd-sector-towers', name: 'Residential / Commercial / Industrial Blocks', role: 'End-Use Demand', scienceDetail: 'Visualizes relative volumetric share demanded by each city sector.' },
    ],
    cameraTarget: [0, 1.5, 0],
    cameraOffset: [8.2, 4.7, 9.0],
  },
  {
    id: 'smart-city-management',
    number: '08',
    title: 'Smart City Integrated Water Control',
    shortTitle: 'Smart City Mgmt',
    subtitle: 'Coordinated meters, leak repair, recycling, rainwater, reservoir & aquifer optimization',
    category: 'Integrated',
    accentHex: '#22c55e',
    primaryGestureParam: {
      key: 'recyclingCapacityPct',
      label: 'Wastewater Recycling',
      unit: '%',
      step: 5,
      min: 0,
      max: 85,
    },
    principle:
      'Sustainable smart cities never rely on a single pipe or reservoir. They integrate rainwater capture, pressurized leak control, closed-loop purple-pipe wastewater recycling, demand optimization, and aquifer recharge so surface and groundwater stocks remain resilient year-round.',
    processSteps: [
      'Smart AMI water meters monitor sector demand and spot anomalous trunk pressure drops.',
      'Rapid leak sealing cuts non-revenue water losses across City and Underground pipes.',
      'Wastewater recycling plant reclaims domestic effluent for industrial cooling and parks.',
      'Monsoon rainwater harvesting boosts cistern reserves and infiltrates into recharge basins.',
      'Coordinated controls stabilize the deep aquifer water table while keeping supply > demand.',
    ],
    variables: [
      { name: 'Wastewater Recycling', symbol: 'η_rec', unit: '%', description: 'Shared municipal reclamation rate (0–85%).' },
      { name: 'Urban Demand Multiplier', symbol: 'k_dem', unit: '×', description: 'Shared Smart City conservation & fixture efficiency factor (0.6×–1.6×).' },
      { name: 'Groundwater Extraction', symbol: 'E_gw', unit: '%', description: 'Coupled pumping pressure synced with Underground borewells.' },
      { name: 'Rainfall Intensity', symbol: 'P', unit: 'mm', description: 'Shared precipitation feeding reservoir inflow, rainwater hubs & aquifers.' },
      { name: 'Simulated Sustainability Index', symbol: 'SSI', unit: '/100', description: 'Defined composite indicator: Supply Balance (30%) + Pipe Efficiency (20%) + Reuse & Rain (25%) + Aquifer Health (25%).' },
    ],
    calculationMethod:
      'Uses the exact centralized computeCityMetrics() and computeUndergroundMetrics() engine from Smart City & Underground Water World without double-counting, then computes the explicitly weighted Simulated Sustainability Index (SSI).',
    formulaDisplay: 'SSI = 0.30·S_balance + 0.20·η_dist + 0.25·S_reuse + 0.25·S_aquifer',
    assumptions: [
      'Every slider, toggle, and repair action mutates the single shared exhibition state used by Modules 02 and 03.',
      'Simulated Sustainability Index is strictly a defined educational scoring formula for scenario comparison.',
    ],
    limitations: [
      'Values represent linked mathematical simulation balances — NOT live municipal SCADA or IoT sensor streams.',
      'Assumes citizens and industrial facilities adopt reclaimed non-potable water safely via separate purple-pipe networks.',
    ],
    disclaimer:
      'Integrated Phase 2 + Phase 3 command hub. All telemetry and the Sustainability Indicator are simulated educational outputs.',
    learningOutcomes: [
      'Design a combined policy (leak repair + recycling + demand efficiency + aquifer balance) that lifts city sustainability above 80/100.',
      'Verify firsthand how changing one variable ripples across Earth, Smart City, and Underground models.',
    ],
    presets: [
      {
        id: 'net-zero-water-city',
        label: 'Net-Positive Future City',
        description: '75% wastewater reuse, sealed leaks, 0.80× fixtures, low pumping',
        params: { recyclingCapacityPct: 75, demandMultiplier: 0.8, groundwaterExtractionPct: 20, rainfallIntensity: 68, repairLeak: true },
      },
      {
        id: 'crisis-stress-test',
        label: 'Drought & Leak Stress Test',
        description: 'Low rain 18 mm, active burst, 72% groundwater pumping, 1.3× demand',
        params: { recyclingCapacityPct: 18, demandMultiplier: 1.3, groundwaterExtractionPct: 72, rainfallIntensity: 18, createLeak: true },
      },
      {
        id: 'monsoon-harvest-mode',
        label: 'Monsoon Banking Strategy',
        description: '92 mm rainfall, 85% aquifer recharge area, strong cistern storage',
        params: { recyclingCapacityPct: 62, demandMultiplier: 0.9, groundwaterExtractionPct: 18, rainfallIntensity: 92, repairLeak: true },
      },
    ],
    equipmentNodes: [
      { id: 'sc-command-core', name: 'Central Smart Water Digital Twin Core', role: 'System Optimizer', scienceDetail: 'Synchronizes surface reservoir, pipes, treatment, and underground balance.' },
      { id: 'sc-recycling-loop', name: 'Purple-Pipe Wastewater Loop', role: 'Water Reuse', scienceDetail: 'Returns reclaimed water to non-potable urban uses, cutting extraction.' },
      { id: 'sc-smart-meter-ring', name: 'AMI Meter & Leak Telemetry Array', role: 'Loss Prevention', scienceDetail: 'Flags active trunk bursts for instant sealing.' },
      { id: 'sc-aquifer-link', name: 'Subsurface Aquifer Recharge Conduit', role: 'Long-Term Reserve', scienceDetail: 'Links urban rainfall infiltration directly to Phase 3 groundwater depth.' },
    ],
    cameraTarget: [0, 1.5, 0],
    cameraOffset: [8.4, 4.8, 9.2],
  },
];

export const LAB_EXPERIMENTS_BY_ID: Record<LabExperimentId, LabExperimentMeta> =
  LAB_EXPERIMENTS.reduce(
    (acc, exp) => {
      acc[exp.id] = exp;
      return acc;
    },
    {} as Record<LabExperimentId, LabExperimentMeta>
  );
