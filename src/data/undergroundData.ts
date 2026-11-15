import {
  ContaminationSourceType,
  GroundwaterDemoPhase,
} from '../types/exhibition';

export type { ComputedUndergroundMetrics } from '../services/simulationEngine';
export { computeUndergroundMetrics } from '../services/simulationEngine';

export interface UndergroundEntity {
  id: string;
  name: string;
  category: 'stratum' | 'aquifer' | 'water-table' | 'infrastructure' | 'pipeline';
  depthRangeM: string;
  permeabilityLabel: string;
  porosityLabel: string;
  yCenter: number;
  cameraOffset: [number, number, number];
  summary: string;
  scienceExplanation: string;
  hydrologyRole: string;
  connectedCityNote: string;
  connectedCityEntityId?: string;
}

export const UNDERGROUND_ENTITIES: UndergroundEntity[] = [
  {
    id: 'layer-surface',
    name: 'Urban Surface & Recharge Footprint',
    category: 'stratum',
    depthRangeM: '0.0 m (Ground Level)',
    permeabilityLabel: 'Mixed (Paved vs Permeable Parks)',
    porosityLabel: 'N/A (Surface Interface)',
    yCenter: 0.1,
    cameraOffset: [16, 10, 18],
    summary:
      'The interface where rainfall meets Smart City rooftops, permeable parklands, bioswales, and surface rivers.',
    scienceExplanation:
      'Paved roads cause rapid surface runoff and flooding, whereas green parks and rainwater recharge pits slow water down so it can percolate into underlying soil.',
    hydrologyRole: 'Controls how much rainfall enters the subsurface versus running off to drains.',
    connectedCityNote: 'Directly linked to Eco-Canopy Rainwater Hub & Veridian Parks in Smart City.',
    connectedCityEntityId: 'rainwater-facility',
  },
  {
    id: 'layer-topsoil',
    name: 'Topsoil & Vadose (Unsaturated) Zone',
    category: 'stratum',
    depthRangeM: '0.0 – 3.0 m',
    permeabilityLabel: 'Moderate–High (Organic Loam)',
    porosityLabel: '35 – 48% (Air + Moisture)',
    yCenter: -0.7,
    cameraOffset: [14, 4, 15],
    summary:
      'Root-rich organic soil layer above the water table where pores contain both air and downward-percolating rainwater.',
    scienceExplanation:
      'Plant roots transpire moisture back to the atmosphere while soil microbes naturally filter organic pollutants before water moves deeper.',
    hydrologyRole: 'First natural bio-filter and moisture sponge for infiltrating rain.',
    connectedCityNote: 'Supports urban green spaces and absorbs park irrigation runoff.',
    connectedCityEntityId: 'res-district-west',
  },
  {
    id: 'layer-sand',
    name: 'Alluvial Sand Layer',
    category: 'stratum',
    depthRangeM: '3.0 – 9.0 m',
    permeabilityLabel: 'High (~10⁻³ m/s)',
    porosityLabel: '30 – 40%',
    yCenter: -2.2,
    cameraOffset: [13, 2, 14],
    summary:
      'Well-sorted quartz sand grains with interconnected pores allowing rapid downward infiltration and horizontal seepage.',
    scienceExplanation:
      'Because sand grains are rounded and uniform, water moves freely by gravity through the unsaturated zone until it reaches the water table.',
    hydrologyRole: 'Primary vertical conduit feeding the unconfined aquifer below.',
    connectedCityNote: 'Transmits recharge from city rainwater harvesting trenches.',
    connectedCityEntityId: 'rainwater-facility',
  },
  {
    id: 'layer-gravel',
    name: 'Coarse Gravel — Unconfined Aquifer',
    category: 'aquifer',
    depthRangeM: '9.0 – 18.0 m',
    permeabilityLabel: 'Very High (~10⁻² m/s)',
    porosityLabel: '25 – 35%',
    yCenter: -4.4,
    cameraOffset: [14, -1, 15],
    summary:
      'Coarse gravel and cobble bed forming the upper Unconfined Aquifer, directly open to atmospheric pressure and surface recharge.',
    scienceExplanation:
      'The top of the saturated zone in this layer is the Water Table. Shallow open wells tap this aquifer, so over-pumping drops the water table quickly.',
    hydrologyRole: 'Fast-recharging shallow groundwater reservoir supporting wells & river baseflow.',
    connectedCityNote: 'Supplies Veridian Shallow Open Well and sustains Emerald River baseflow.',
    connectedCityEntityId: 'res-district-west',
  },
  {
    id: 'water-table-plane',
    name: 'Dynamic Water Table (Phreatic Surface)',
    category: 'water-table',
    depthRangeM: 'Variable (4 – 34 m)',
    permeabilityLabel: 'Hydrostatic Boundary',
    porosityLabel: '100% Saturated Below',
    yCenter: -3.6,
    cameraOffset: [14, 0, 14],
    summary:
      'The upper boundary of the Saturated Zone where water pressure equals atmospheric pressure.',
    scienceExplanation:
      'Above the water table lies the Unsaturated (Vadose) Zone; below it, all soil and rock pores are 100% filled with groundwater. Pumping > Recharge causes the table to fall.',
    hydrologyRole: 'Key indicator of sustainable vs. over-exploited groundwater balance.',
    connectedCityNote: 'When the table falls below 14 m, shallow neighborhood wells run dry.',
    connectedCityEntityId: 'city-reservoir',
  },
  {
    id: 'layer-clay',
    name: 'Dense Clay Aquitard (Confining Layer)',
    category: 'stratum',
    depthRangeM: '18.0 – 23.0 m',
    permeabilityLabel: 'Very Low (<10⁻⁸ m/s)',
    porosityLabel: 'High porosity, near-zero flow',
    yCenter: -6.4,
    cameraOffset: [14, -3, 15],
    summary:
      'Tightly packed microscopic clay platelets that block vertical water movement, sealing the deep aquifer beneath.',
    scienceExplanation:
      'Even though clay holds bound water molecules, microscopic pore throats prevent gravity flow—forming a natural hydraulic barrier (aquitard) that also slows surface pollutants.',
    hydrologyRole: 'Protects deep confined aquifers from surface contamination and creates artesian pressure.',
    connectedCityNote: 'Deep borewells must be cased through this clay layer to reach deep clean water.',
    connectedCityEntityId: 'sky-tower-alpha',
  },
  {
    id: 'layer-confined-aquifer',
    name: 'Permeable Sandstone — Confined Aquifer',
    category: 'aquifer',
    depthRangeM: '23.0 – 34.0 m',
    permeabilityLabel: 'Moderate–High (Fractured/Porous)',
    porosityLabel: '18 – 28%',
    yCenter: -8.8,
    cameraOffset: [15, -5, 16],
    summary:
      'Deep permeable sandstone trapped beneath the impermeable clay layer, storing older groundwater under confining pressure.',
    scienceExplanation:
      'Recharged primarily at distant upland outcrop zones; because recharge takes decades to centuries, excessive borewell pumping causes long-term depletion and land subsidence.',
    hydrologyRole: 'Strategic deep drought buffer tapped by municipal deep borewells.',
    connectedCityNote: 'Feeds AquaSpire & Harborview municipal deep borewells.',
    connectedCityEntityId: 'sky-tower-alpha',
  },
  {
    id: 'underground-reservoir',
    name: 'Subsurface Aquifer Vault (Karst Pocket)',
    category: 'aquifer',
    depthRangeM: '25.0 – 33.0 m',
    permeabilityLabel: 'Open Conduit Storage',
    porosityLabel: 'High Cavern Void',
    yCenter: -8.6,
    cameraOffset: [11, -5, 13],
    summary:
      'Natural dissolved/fractured subsurface storage pocket holding concentrated clean groundwater within the deep permeable rock.',
    scienceExplanation:
      'Unlike surface dams, underground reservoirs lose zero water to evaporation—making Managed Aquifer Recharge (MAR) one of the smartest future water strategies.',
    hydrologyRole: 'Zero-evaporation subterranean water bank.',
    connectedCityNote: 'Complements Periyar Valley Surface Reservoir during dry summer months.',
    connectedCityEntityId: 'city-reservoir',
  },
  {
    id: 'layer-bedrock',
    name: 'Impermeable Crystalline Bedrock',
    category: 'stratum',
    depthRangeM: '34.0 – 44.0 m',
    permeabilityLabel: 'Impermeable (<10⁻¹⁰ m/s)',
    porosityLabel: '< 2%',
    yCenter: -11.4,
    cameraOffset: [15, -7, 16],
    summary:
      'Solid granite-basalt basement rock forming the watertight floor beneath the entire sedimentary basin.',
    scienceExplanation:
      'Unfractured crystalline rock stops downward percolation completely, pooling groundwater in the permeable sandstone and gravel strata above it.',
    hydrologyRole: 'Impermeable lower boundary of the groundwater system.',
    connectedCityNote: 'Defines the maximum useful drilling depth for municipal borewells.',
  },
  {
    id: 'pipe-distribution',
    name: 'Buried Municipal Water Pipeline',
    category: 'pipeline',
    depthRangeM: '1.5 – 2.2 m',
    permeabilityLabel: 'Pressurized Closed Conduit',
    porosityLabel: 'N/A',
    yCenter: -0.5,
    cameraOffset: [10, 4, 12],
    summary:
      'Underground pressurized drinking water trunk connecting Clarion Treatment Plant to city neighborhoods.',
    scienceExplanation:
      'Because pipelines sit buried in topsoil, leaks often stay hidden underground—eroding soil and wasting treated water unless smart acoustic meters detect pressure drops.',
    hydrologyRole: 'Shares the exact same Phase 2 Smart City pipeline & leak state.',
    connectedCityNote: 'Connected directly to AquaSpire, Veridian, and Harborview Apartments.',
    connectedCityEntityId: 'pipe-distribution',
  },
];

export const CONTAMINATION_SCENARIOS: Record<
  ContaminationSourceType,
  {
    title: string;
    origin: string;
    mechanism: string;
    affectedZone: string;
    prevention: string;
    colorHex: string;
  }
> = {
  agricultural: {
    title: 'Agricultural Nitrate & Pesticide Leaching',
    origin: 'Over-fertilized peri-urban farmland above permeable sand',
    mechanism:
      'Excess nitrates dissolve in irrigation and rainwater, percolating downward through the vadose zone into the unconfined gravel aquifer.',
    affectedZone: 'Shallow unconfined aquifer and open domestic wells',
    prevention:
      'Precision drip fertigation, riparian vegetative buffer strips, and organic soil management.',
    colorHex: '#eab308',
  },
  wastewater: {
    title: 'Untreated Sewage & Septic Seepage',
    origin: 'Cracked sewer main or unlined septic soak-pits',
    mechanism:
      'Pathogens and ammonium seep vertically through porous sand toward shallow water tables if clay protection is absent.',
    affectedZone: 'Upper sand & shallow gravel water table near residential wells',
    prevention:
      'Sealed sewerage pipes, 7-stage wastewater recycling plants, and safe setback distances from wells.',
    colorHex: '#f97316',
  },
  industrial: {
    title: 'Industrial Solvent & Heavy-Metal Plume',
    origin: 'Unlined chemical storage or improper industrial effluent pit',
    mechanism:
      'Dense or dissolved industrial compounds migrate slowly along the regional hydraulic gradient toward downstream pumping wells.',
    affectedZone: 'Down-gradient aquifer plume corridor',
    prevention:
      'Zero-Liquid-Discharge (ZLD) treatment loops, impermeable containment liners, and continuous monitoring wells.',
    colorHex: '#ec4899',
  },
  landfill: {
    title: 'Improper Solid Waste Leachate',
    origin: 'Unlined open waste dump exposed to monsoon rain',
    mechanism:
      'Rainwater percolating through decomposing waste generates toxic leachate that infiltrates permeable soils below.',
    affectedZone: 'Local unconfined groundwater zone beneath dump footprint',
    prevention:
      'Engineered sanitary landfills with HDPE geomembrane liners, leachate collection, and waste segregation.',
    colorHex: '#a855f7',
  },
};

export const DEMO_PHASES: {
  id: GroundwaterDemoPhase;
  step: number;
  title: string;
  scienceSummary: string;
}[] = [
  {
    id: 'normal',
    step: 1,
    title: 'Normal Equilibrium',
    scienceSummary:
      'Natural monsoon rainfall recharge balances modest well pumping, holding the water table steady around ~10.5 m depth.',
  },
  {
    id: 'over-extraction',
    step: 2,
    title: 'Excessive Extraction',
    scienceSummary:
      'Multiple wells and deep borewells pump faster than rainfall can infiltrate, creating cones of depression around wells.',
  },
  {
    id: 'falling-table',
    step: 3,
    title: 'Falling Water Table',
    scienceSummary:
      'The water table drops below 14 m; shallow open wells run dry while deep confined aquifers experience falling pressure.',
  },
  {
    id: 'recharge',
    step: 4,
    title: 'Rainwater Recharge',
    scienceSummary:
      'Pumping is reduced and rainwater harvesting pits channel monsoon runoff rapidly through sand into the aquifer.',
  },
  {
    id: 'recovery',
    step: 5,
    title: 'Aquifer Recovery',
    scienceSummary:
      'As recharge exceeds extraction, groundwater pores refill, raising the water table and restoring shallow wells.',
  },
];
