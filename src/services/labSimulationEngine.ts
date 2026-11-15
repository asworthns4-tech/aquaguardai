import { LAB_EXPERIMENTS_BY_ID, LabExperimentId } from '../data/labExperimentsData';
import {
  CitySimulationState,
  ExhibitionState,
  LabBaselineSnapshot,
  LabSimulationState,
  UndergroundSimulationState,
} from '../types/exhibition';
import {
  calculateAquiferRechargeMLd,
  calculateAquiferStoragePct,
  calculateRainwaterHarvest,
  clampValue,
  computeCityMetrics,
  computeUndergroundMetrics,
  lphToMld,
  stepWaterTableDepth,
} from './simulationEngine';

export interface LabMetricCard {
  key: string;
  label: string;
  value: string;
  numericValue: number;
  unit: string;
  status?: 'optimal' | 'caution' | 'critical' | 'neutral';
  hint?: string;
}

export interface LabComparisonDelta {
  key: string;
  label: string;
  unit: string;
  beforeVal: string;
  afterVal: string;
  deltaNumeric: number;
  deltaText: string;
}

export interface LabExperimentComputedOutput {
  experimentId: LabExperimentId;
  headlineStatus: string;
  statusTone: 'optimal' | 'caution' | 'critical';
  cards: LabMetricCard[];
  beforeAfterMetrics: Record<string, { label: string; unit: string; value: number; formatted: string }>;
  detailNotes: string[];
}

export function createDefaultLabStateParams(): Omit<LabSimulationState, 'baselines'> {
  return {
    activeExperiment: 'water-cycle',
    elapsedSeconds: 0,
    learnScienceOpen: false,
    labAutoRotate: false,
    labCameraFlyVersion: 0,
    labZoomDelta: 0,
    labZoomVersion: 0,
    waterCycle: {
      temperatureC: 26,
      solarIntensityPct: 78,
      cloudFormationRatePct: 72,
      vaporStorageIndex: 52,
      cloudMassIndex: 58,
    },
    rainwaterExtra: {
      firstFlushMm: 1.5,
      filterEfficiencyPct: 90,
    },
    groundwaterHorizonYears: 5,
    leakSim: {
      leakOrificeMm: 16,
      leakCount: 2,
      supplyFlowLph: 120000,
    },
    filtration: {
      initialTurbidityNtu: 120,
      flowRateLpm: 22,
      filterConditionPct: 88,
      sedimentationMin: 30,
      carbonEfficiencyPct: 90,
      cumulativeFilteredLitres: 0,
    },
    desalination: {
      salinityGpl: 35,
      feedPressureBar: 62,
      recoveryRatePct: 42,
      feedVolumeM3: 100,
      energyFactor: 1.0,
      cumulativeFreshwaterM3: 0,
      cumulativeBrineM3: 0,
    },
    supplyDemandExtra: {
      industrialDemandMLd: 5.5,
      commercialDemandMLd: 4.0,
      availableSupplyMLd: 36.0,
      distributionLossPct: 12,
      reservoirCapacityML: 320,
    },
  };
}

// ---------------------------------------------------------------------------
// 1. WATER CYCLE MODEL
// ---------------------------------------------------------------------------
export function computeWaterCycleModel(
  lab: LabSimulationState,
  city: CitySimulationState,
  ug: UndergroundSimulationState
) {
  const { temperatureC, solarIntensityPct, cloudFormationRatePct } = lab.waterCycle;
  const rainfallMm = city.rainfallIntensity;

  // Clausius-Clapeyron moisture capacity scaling (~7% per °C around 20 °C reference)
  const thermalFactor = Math.pow(1.07, temperatureC - 20);
  const evaporationMmDay = 4.2 * (solarIntensityPct / 100) * thermalFactor;
  const condensationMmDay = evaporationMmDay * (cloudFormationRatePct / 100) * 0.94;
  const effectiveRainMmDay = rainfallMm * 0.85 + condensationMmDay * 0.65;

  const { permeabilityFactor, rechargeRateMLd } = calculateAquiferRechargeMLd(
    rainfallMm,
    ug.soilPermeability,
    ug.rechargeAreaPct
  );
  const infiltrationShare = clampValue(0.12 + permeabilityFactor * (ug.rechargeAreaPct / 100) * 0.45, 0.08, 0.58);
  const infiltrationMmDay = effectiveRainMmDay * infiltrationShare;
  const surfaceRunoffMmDay = effectiveRainMmDay - infiltrationMmDay;
  const oceanReturnMmDay = surfaceRunoffMmDay + infiltrationMmDay * 0.62;

  return {
    temperatureC,
    solarIntensityPct,
    cloudFormationRatePct,
    rainfallMm,
    evaporationMmDay,
    condensationMmDay,
    effectiveRainMmDay,
    infiltrationSharePct: Math.round(infiltrationShare * 100),
    infiltrationMmDay,
    surfaceRunoffMmDay,
    aquiferRechargeMLd: rechargeRateMLd,
    oceanReturnMmDay,
  };
}

// ---------------------------------------------------------------------------
// 2. RAINWATER HARVESTING MODEL
// ---------------------------------------------------------------------------
export function computeRainwaterLabModel(lab: LabSimulationState, city: CitySimulationState) {
  const { rainfallMm, roofAreaM2, runoffCoeff, tankCapacityLitres, tankStoredLitres } =
    city.rainwater;
  const { firstFlushMm, filterEfficiencyPct } = lab.rainwaterExtra;

  // Exact rational equation specified by curriculum:
  // Gross catchment yield (L) = Rainfall (mm) × Roof area (m²) × Runoff coefficient
  const {
    rainwaterFormulaLitres: grossFormulaLitres,
    tankFillPct,
  } = calculateRainwaterHarvest(
    rainfallMm,
    roofAreaM2,
    runoffCoeff,
    tankCapacityLitres,
    tankStoredLitres
  );

  // Separate explicit tracking of first-flush and filter losses
  const rawIncidentLitres = Math.round(rainfallMm * roofAreaM2);
  const roofRetentionLossLitres = Math.max(0, rawIncidentLitres - grossFormulaLitres);
  const firstFlushDivertedLitres = Math.round(
    Math.min(rainfallMm, firstFlushMm) * roofAreaM2 * runoffCoeff
  );
  const postFirstFlushLitres = Math.max(0, grossFormulaLitres - firstFlushDivertedLitres);
  const collectedNetLitres = Math.round(postFirstFlushLitres * (filterEfficiencyPct / 100));
  const filterBackwashLossLitres = Math.max(0, postFirstFlushLitres - collectedNetLitres);
  const totalLostInTreatmentLitres = firstFlushDivertedLitres + filterBackwashLossLitres;

  const tankHeadroomLitres = Math.max(0, tankCapacityLitres - tankStoredLitres);
  const overflowRechargeLitres = Math.max(0, collectedNetLitres - tankHeadroomLitres);
  const householdDaysEquivalent = Number((collectedNetLitres / (4 * 135)).toFixed(1));

  return {
    rainfallMm,
    roofAreaM2,
    runoffCoeff,
    firstFlushMm,
    filterEfficiencyPct,
    tankCapacityLitres,
    tankStoredLitres,
    tankFillPct,
    rawIncidentLitres,
    grossFormulaLitres,
    roofRetentionLossLitres,
    firstFlushDivertedLitres,
    filterBackwashLossLitres,
    totalLostInTreatmentLitres,
    collectedNetLitres,
    overflowRechargeLitres,
    householdDaysEquivalent,
  };
}

// ---------------------------------------------------------------------------
// 3. GROUNDWATER DEPLETION MODEL
// ---------------------------------------------------------------------------
export function computeGroundwaterLabModel(
  lab: LabSimulationState,
  city: CitySimulationState,
  ug: UndergroundSimulationState
) {
  const ugMetrics = computeUndergroundMetrics(ug, city);
  // Treat column benchmark block as 500 ML initial storage capacity when at initial depth (10.5 m)
  const initialStoragePct = calculateAquiferStoragePct(ug.initialWaterTableDepthM);
  const benchmarkMaxCapacityML = 500;
  const initialStorageML = (initialStoragePct / 100) * benchmarkMaxCapacityML;
  const currentStorageML = (ugMetrics.aquiferStoragePct / 100) * benchmarkMaxCapacityML;
  const storageChangeFromInitialML = currentStorageML - initialStorageML;

  const horizonYears = clampValue(lab.groundwaterHorizonYears, 1, 25);
  // Scale multi-year bench projection conservatively (annual ML balance on bench scale)
  const projectedNetChangeML = ugMetrics.netBalanceMLd * 18 * horizonYears;
  const projectedStorageML = clampValue(
    currentStorageML + projectedNetChangeML * 0.25,
    40,
    benchmarkMaxCapacityML
  );
  const projectedStorageChangePct =
    ((projectedStorageML - currentStorageML) / Math.max(1, currentStorageML)) * 100;
  const projectedDepthM = clampValue(
    ug.waterTableDepthM - ugMetrics.netBalanceMLd * horizonYears * 0.38,
    4.2,
    33.5
  );

  return {
    ...ugMetrics,
    waterTableDepthM: ug.waterTableDepthM,
    initialWaterTableDepthM: ug.initialWaterTableDepthM,
    rechargeAreaPct: ug.rechargeAreaPct,
    soilPermeability: ug.soilPermeability,
    groundwaterExtractionPct: city.groundwaterExtractionPct,
    initialStorageML,
    currentStorageML,
    storageChangeFromInitialML,
    horizonYears,
    projectedStorageML,
    projectedStorageChangePct,
    projectedDepthM,
  };
}

// ---------------------------------------------------------------------------
// 4. PIPELINE LEAKAGE MODEL
// ---------------------------------------------------------------------------
export function computePipelineLeakLabModel(lab: LabSimulationState, city: CitySimulationState) {
  const { leakOrificeMm, leakCount, supplyFlowLph } = lab.leakSim;
  const pressureBar = city.pipelinePressureBar;
  const effectiveLeakCount = city.leak.active ? Math.max(1, leakCount) : 0;

  // Orifice equation: Q = Cd * A * sqrt(2 * dP / rho) -> scaled cleanly in L/hr
  const radiusM = (leakOrificeMm / 1000) * 0.5;
  const areaM2 = Math.PI * radiusM * radiusM;
  const dP = pressureBar * 100_000; // Pa
  const singleLeakM3s = 0.62 * areaM2 * Math.sqrt((2 * dP) / 1000);
  const singleLeakLph = singleLeakM3s * 1000 * 3600;

  const burstLeakLph = effectiveLeakCount * singleLeakLph;
  const backgroundSeepageLph = supplyFlowLph * (city.baseLeakageRatePct / 100) * (pressureBar / 4.2);
  const totalWastedLph = burstLeakLph + backgroundSeepageLph;
  const wastedPerDayLitres = totalWastedLph * 24;
  const wastedSharePct = clampValue((totalWastedLph / Math.max(1, supplyFlowLph)) * 100, 1, 78);

  const headDropBar = Math.min(
    pressureBar * 0.62,
    (burstLeakLph / Math.max(20000, supplyFlowLph)) * pressureBar * 1.15
  );
  const downstreamPressureBar = Math.max(0.8, pressureBar - headDropBar);
  const deliveredLph = Math.max(0, supplyFlowLph - totalWastedLph);

  const affectedBuildingsCount = !city.leak.active
    ? 0
    : downstreamPressureBar < 2.2
      ? 5
      : downstreamPressureBar < 3.0
        ? 3
        : downstreamPressureBar < 3.6
          ? 2
          : 1;

  return {
    pressureBar,
    downstreamPressureBar,
    headDropBar,
    leakOrificeMm,
    leakCount: effectiveLeakCount,
    leakActive: city.leak.active,
    supplyFlowLph,
    deliveredLph,
    burstLeakLph,
    backgroundSeepageLph,
    totalWastedLph,
    wastedPerDayLitres,
    wastedSharePct,
    accumulatedLossLitres: city.leak.accumulatedLossLitres,
    affectedBuildingsCount,
    repairedCount: city.leak.repairedCount,
  };
}

// ---------------------------------------------------------------------------
// 5. WATER FILTRATION MODEL
// ---------------------------------------------------------------------------
export function computeFiltrationLabModel(lab: LabSimulationState) {
  const {
    initialTurbidityNtu,
    flowRateLpm,
    filterConditionPct,
    sedimentationMin,
    carbonEfficiencyPct,
    cumulativeFilteredLitres,
  } = lab.filtration;

  const condFactor = clampValue(filterConditionPct / 100, 0.25, 1.0);
  // Excess velocity above 22 L/min reduces residence & straining efficiency
  const flowPenalty = flowRateLpm <= 22 ? 1.0 : clampValue(1 - (flowRateLpm - 22) * 0.011, 0.55, 1.0);

  const sedRemoval = clampValue((0.28 + (sedimentationMin / 90) * 0.34) * flowPenalty, 0.12, 0.62);
  const afterSedNtu = initialTurbidityNtu * (1 - sedRemoval);

  const gravelRemoval = clampValue(0.32 * condFactor * flowPenalty, 0.08, 0.36);
  const afterGravelNtu = afterSedNtu * (1 - gravelRemoval);

  const sandRemoval = clampValue(0.76 * condFactor * flowPenalty, 0.25, 0.84);
  const afterSandNtu = afterGravelNtu * (1 - sandRemoval);

  const carbonRemoval = clampValue(0.58 * (carbonEfficiencyPct / 100) * flowPenalty, 0.15, 0.66);
  const outletTurbidityNtu = Math.max(0.4, afterSandNtu * (1 - carbonRemoval));

  const turbidityReductionPct = clampValue(
    ((initialTurbidityNtu - outletTurbidityNtu) / Math.max(1, initialTurbidityNtu)) * 100,
    0,
    99.7
  );

  // Organic odor removal primarily driven by activated carbon contact
  const organicOdorRemovalPct = Math.round(
    clampValue(carbonEfficiencyPct * flowPenalty * (0.7 + 0.3 * condFactor), 20, 96)
  );

  const dissolvedSaltsRemovedPct = 0; // Explicitly zero — sand/gravel/carbon do not remove dissolved ions!

  return {
    initialTurbidityNtu,
    flowRateLpm,
    filterConditionPct,
    sedimentationMin,
    carbonEfficiencyPct,
    cumulativeFilteredLitres,
    afterSedNtu,
    afterGravelNtu,
    afterSandNtu,
    outletTurbidityNtu,
    turbidityReductionPct,
    organicOdorRemovalPct,
    dissolvedSaltsRemovedPct,
    requiresDisinfection: true,
    stageOutputs: [
      { stage: 'Raw Intake', ntu: initialTurbidityNtu, removedFromPrevPct: 0 },
      { stage: 'Sedimentation', ntu: afterSedNtu, removedFromPrevPct: Math.round(sedRemoval * 100) },
      { stage: 'Coarse Gravel', ntu: afterGravelNtu, removedFromPrevPct: Math.round(gravelRemoval * 100) },
      { stage: 'Fine Sand', ntu: afterSandNtu, removedFromPrevPct: Math.round(sandRemoval * 100) },
      { stage: 'Activated Carbon', ntu: outletTurbidityNtu, removedFromPrevPct: Math.round(carbonRemoval * 100) },
    ],
  };
}

// ---------------------------------------------------------------------------
// 6. DESALINATION (REVERSE OSMOSIS) MODEL
// ---------------------------------------------------------------------------
export function computeDesalinationLabModel(lab: LabSimulationState) {
  const {
    salinityGpl,
    feedPressureBar,
    recoveryRatePct,
    feedVolumeM3,
    energyFactor,
    cumulativeFreshwaterM3,
    cumulativeBrineM3,
  } = lab.desalination;

  // Approximate seawater osmotic pressure (bar) ~ 0.78 * salinity (g/L)
  const osmoticPressureBar = Number((salinityGpl * 0.78).toFixed(1));
  const netDrivingBar = feedPressureBar - osmoticPressureBar;
  const membraneStalled = netDrivingBar <= 2.0;

  // Effective recovery caps cleanly if driving pressure is low
  const pressureAdequacy = membraneStalled
    ? 0
    : clampValue((netDrivingBar - 2) / 28, 0.08, 1.08);
  const effectiveRecoveryPct = membraneStalled
    ? 0
    : clampValue(recoveryRatePct * Math.min(1, pressureAdequacy), 0, 58);

  const freshwaterM3 = (feedVolumeM3 * effectiveRecoveryPct) / 100;
  const brineVolumeM3 = Math.max(0, feedVolumeM3 - freshwaterM3);

  const saltRejectionPct = membraneStalled
    ? 0
    : Number(clampValue(97.2 + pressureAdequacy * 2.1, 94.0, 99.6).toFixed(2));
  const permeateTdsMgL = membraneStalled
    ? salinityGpl * 1000
    : Math.round(salinityGpl * 1000 * (1 - saltRejectionPct / 100));
  const brineSalinityGpl =
    brineVolumeM3 > 0
      ? Number(
          clampValue(
            (feedVolumeM3 * salinityGpl - freshwaterM3 * (permeateTdsMgL / 1000)) / brineVolumeM3,
            salinityGpl,
            95
          ).toFixed(1)
        )
      : salinityGpl;

  // Specific energy demand in kWh per m3 of produced freshwater
  const specificEnergyKwhM3 = membraneStalled
    ? 0
    : Number(
        clampValue(
          (1.85 + (feedPressureBar / 26) + (salinityGpl - 30) * 0.045) *
            energyFactor *
            (45 / Math.max(25, effectiveRecoveryPct)),
          2.4,
          9.8
        ).toFixed(2)
      );
  const totalEnergyKwh = Math.round(freshwaterM3 * specificEnergyKwhM3);

  return {
    salinityGpl,
    feedPressureBar,
    osmoticPressureBar,
    netDrivingBar,
    membraneStalled,
    recoveryRatePct,
    effectiveRecoveryPct,
    feedVolumeM3,
    freshwaterM3,
    brineVolumeM3,
    saltRejectionPct,
    permeateTdsMgL,
    brineSalinityGpl,
    specificEnergyKwhM3,
    totalEnergyKwh,
    cumulativeFreshwaterM3,
    cumulativeBrineM3,
  };
}

// ---------------------------------------------------------------------------
// 7. WATER SUPPLY AND DEMAND MODEL
// ---------------------------------------------------------------------------
export function computeSupplyDemandLabModel(
  lab: LabSimulationState,
  city: CitySimulationState
) {
  const {
    industrialDemandMLd,
    commercialDemandMLd,
    availableSupplyMLd,
    distributionLossPct,
    reservoirCapacityML,
  } = lab.supplyDemandExtra;

  const population = city.population;
  const perCapitaLpd = Math.round(city.demandMultiplier * 135);
  const domesticDemandMLd = (population * perCapitaLpd) / 1_000_000;
  const totalEndDemandMLd = domesticDemandMLd + industrialDemandMLd + commercialDemandMLd;
  const grossRequiredMLd = totalEndDemandMLd / Math.max(0.55, 1 - distributionLossPct / 100);
  const distributionLossMLd = grossRequiredMLd - totalEndDemandMLd;

  const netSurplusOrDeficitMLd = availableSupplyMLd - grossRequiredMLd;
  const reservoirLevelML = (city.reservoirStoragePct / 100) * reservoirCapacityML;
  const daysOfBuffer =
    netSurplusOrDeficitMLd >= 0
      ? 99
      : Math.max(0, Math.round(reservoirLevelML / Math.abs(netSurplusOrDeficitMLd)));

  const shortageConsequence =
    netSurplusOrDeficitMLd >= 2.0
      ? 'Healthy Surplus — Reservoir Rebuilding'
      : netSurplusOrDeficitMLd >= -0.5
        ? 'Tight Margin — Peak-Hour Pressure Drops'
        : netSurplusOrDeficitMLd >= -6.0
          ? 'Supply Deficit — Intermittent Rationing Risk'
          : 'Severe Shortfall — Rapid Reservoir Depletion';

  return {
    population,
    perCapitaLpd,
    domesticDemandMLd,
    industrialDemandMLd,
    commercialDemandMLd,
    totalEndDemandMLd,
    distributionLossPct,
    distributionLossMLd,
    grossRequiredMLd,
    availableSupplyMLd,
    netSurplusOrDeficitMLd,
    reservoirStoragePct: city.reservoirStoragePct,
    reservoirCapacityML,
    reservoirLevelML,
    daysOfBuffer,
    shortageConsequence,
  };
}

// ---------------------------------------------------------------------------
// 8. SMART CITY INTEGRATED WATER MANAGEMENT MODEL
// ---------------------------------------------------------------------------
export function computeSmartCityMgmtModel(
  city: CitySimulationState,
  ug: UndergroundSimulationState
) {
  const cityM = computeCityMetrics(city);
  const ugM = computeUndergroundMetrics(ug, city);

  // Explicitly defined weights for the Simulated Sustainability Index (SSI):
  const supplyAdequacySub = clampValue(
    65 + (cityM.netBalanceMLd / Math.max(5, cityM.effectiveDemandMLd)) * 75,
    5,
    100
  );
  const distEfficiencySub = clampValue(cityM.distributionEfficiencyPct, 20, 100);
  const reuseRatioPct =
    ((cityM.recycledSupplyMLd + cityM.rainwaterCollectedMLd) /
      Math.max(1, cityM.effectiveDemandMLd)) *
    100;
  const reuseSub = clampValue(reuseRatioPct * 1.45, 5, 100);
  const aquiferSub = clampValue(
    ugM.aquiferStoragePct * 0.7 + (ugM.netBalanceMLd >= 0 ? 30 : Math.max(0, 22 + ugM.netBalanceMLd * 3)),
    8,
    100
  );

  const sustainabilityIndicator = Math.round(
    clampValue(
      supplyAdequacySub * 0.3 +
        distEfficiencySub * 0.2 +
        reuseSub * 0.25 +
        aquiferSub * 0.25 -
        (city.leak.active ? 10 : 0),
      5,
      99
    )
  );

  return {
    city: cityM,
    underground: ugM,
    sustainabilityIndicator,
    subscores: {
      supplyAdequacy: Math.round(supplyAdequacySub),
      distributionEfficiency: Math.round(distEfficiencySub),
      reuseAndRain: Math.round(reuseSub),
      aquiferStability: Math.round(aquiferSub),
    },
    combinedReuseMLd: cityM.recycledSupplyMLd + cityM.rainwaterCollectedMLd,
  };
}

// ---------------------------------------------------------------------------
// UNIFIED EXPERIMENT OUTPUT + BASELINE SNAPSHOT & COMPARISON
// ---------------------------------------------------------------------------
export function computeLabExperimentOutput(
  experimentId: LabExperimentId,
  state: ExhibitionState
): LabExperimentComputedOutput {
  switch (experimentId) {
    case 'water-cycle': {
      const m = computeWaterCycleModel(state.lab, state.city, state.underground);
      return {
        experimentId,
        headlineStatus:
          m.evaporationMmDay > m.effectiveRainMmDay * 0.35
            ? 'Intense Evaporative Cycling'
            : 'Steady Atmospheric Cycle',
        statusTone: m.rainfallMm < 20 ? 'caution' : 'optimal',
        cards: [
          { key: 'evap', label: 'Evaporation Flux', value: m.evaporationMmDay.toFixed(1), numericValue: m.evaporationMmDay, unit: 'mm/day', status: 'neutral' },
          { key: 'cond', label: 'Condensation Rate', value: m.condensationMmDay.toFixed(1), numericValue: m.condensationMmDay, unit: 'mm/day', status: 'neutral' },
          { key: 'runoff', label: 'Surface Runoff', value: m.surfaceRunoffMmDay.toFixed(1), numericValue: m.surfaceRunoffMmDay, unit: 'mm/day', status: 'neutral' },
          { key: 'infil', label: 'Infiltration Yield', value: m.infiltrationMmDay.toFixed(1), numericValue: m.infiltrationMmDay, unit: 'mm/day', status: 'optimal', hint: `${m.infiltrationSharePct}% of rain` },
          { key: 'recharge', label: 'Aquifer Recharge', value: m.aquiferRechargeMLd.toFixed(1), numericValue: m.aquiferRechargeMLd, unit: 'ML/d', status: m.aquiferRechargeMLd >= 5 ? 'optimal' : 'caution' },
          { key: 'return', label: 'Ocean Return Flow', value: m.oceanReturnMmDay.toFixed(1), numericValue: m.oceanReturnMmDay, unit: 'mm/day', status: 'neutral' },
        ],
        beforeAfterMetrics: {
          evap: { label: 'Evaporation Flux', unit: 'mm/day', value: m.evaporationMmDay, formatted: `${m.evaporationMmDay.toFixed(1)} mm/d` },
          runoff: { label: 'Surface Runoff', unit: 'mm/day', value: m.surfaceRunoffMmDay, formatted: `${m.surfaceRunoffMmDay.toFixed(1)} mm/d` },
          infiltration: { label: 'Infiltration Yield', unit: 'mm/day', value: m.infiltrationMmDay, formatted: `${m.infiltrationMmDay.toFixed(1)} mm/d` },
          aquiferRecharge: { label: 'Aquifer Recharge', unit: 'ML/d', value: m.aquiferRechargeMLd, formatted: `${m.aquiferRechargeMLd.toFixed(1)} ML/d` },
        },
        detailNotes: [
          `Shared rainfall ${m.rainfallMm} mm feeds both surface runoff (${m.surfaceRunoffMmDay.toFixed(1)} mm/d) and ${state.underground.soilPermeability}-permeability groundwater infiltration (${m.infiltrationSharePct}%).`,
        ],
      };
    }

    case 'rainwater-harvesting': {
      const m = computeRainwaterLabModel(state.lab, state.city);
      return {
        experimentId,
        headlineStatus: m.overflowRechargeLitres > 0 ? 'Tank Full — Recharge Overflow Active' : 'Cistern Capturing Event',
        statusTone: m.collectedNetLitres >= 5000 ? 'optimal' : 'caution',
        cards: [
          { key: 'gross', label: 'Formula Catchment (R×A×C)', value: m.grossFormulaLitres.toLocaleString(), numericValue: m.grossFormulaLitres, unit: 'L', status: 'neutral' },
          { key: 'collected', label: 'Net Filtered Harvest', value: m.collectedNetLitres.toLocaleString(), numericValue: m.collectedNetLitres, unit: 'L', status: 'optimal' },
          { key: 'lost', label: 'First-Flush & Filter Loss', value: m.totalLostInTreatmentLitres.toLocaleString(), numericValue: m.totalLostInTreatmentLitres, unit: 'L', status: 'neutral' },
          { key: 'tankPct', label: 'Cistern Fill Level', value: `${m.tankFillPct}`, numericValue: m.tankFillPct, unit: '%', status: m.tankFillPct > 85 ? 'caution' : 'optimal', hint: `${m.tankStoredLitres.toLocaleString()} / ${m.tankCapacityLitres.toLocaleString()} L` },
          { key: 'overflow', label: 'Recharge Pit Overflow', value: m.overflowRechargeLitres.toLocaleString(), numericValue: m.overflowRechargeLitres, unit: 'L', status: 'neutral' },
          { key: 'saved', label: 'Freshwater Supply Saved', value: `${m.householdDaysEquivalent}`, numericValue: m.householdDaysEquivalent, unit: 'hh-days', status: 'optimal' },
        ],
        beforeAfterMetrics: {
          gross: { label: 'Formula Yield (R×A×C)', unit: 'L', value: m.grossFormulaLitres, formatted: `${m.grossFormulaLitres.toLocaleString()} L` },
          collected: { label: 'Net Harvested Water', unit: 'L', value: m.collectedNetLitres, formatted: `${m.collectedNetLitres.toLocaleString()} L` },
          lost: { label: 'Treatment Bypass Loss', unit: 'L', value: m.totalLostInTreatmentLitres, formatted: `${m.totalLostInTreatmentLitres.toLocaleString()} L` },
          overflow: { label: 'Aquifer Overflow', unit: 'L', value: m.overflowRechargeLitres, formatted: `${m.overflowRechargeLitres.toLocaleString()} L` },
        },
        detailNotes: [
          `Exact equation: ${m.rainfallMm} mm × ${m.roofAreaM2} m² × ${m.runoffCoeff.toFixed(2)} = ${m.grossFormulaLitres.toLocaleString()} L before ${m.firstFlushMm} mm first-flush & ${m.filterEfficiencyPct}% filter pass.`,
        ],
      };
    }

    case 'groundwater-depletion': {
      const m = computeGroundwaterLabModel(state.lab, state.city, state.underground);
      return {
        experimentId,
        headlineStatus:
          m.netBalanceMLd >= 0
            ? 'Aquifer Recharge Surplus'
            : m.shallowWellDry
              ? 'Critical Drawdown — Shallow Wells Dry'
              : 'Net Aquifer Depletion',
        statusTone: m.netBalanceMLd >= 0 ? 'optimal' : m.shallowWellDry ? 'critical' : 'caution',
        cards: [
          { key: 'initialStorage', label: 'Initial Column Storage', value: m.initialStorageML.toFixed(0), numericValue: m.initialStorageML, unit: 'ML', status: 'neutral' },
          { key: 'currentStorage', label: 'Current Storage', value: m.currentStorageML.toFixed(0), numericValue: m.currentStorageML, unit: 'ML', status: m.aquiferStoragePct > 55 ? 'optimal' : 'critical', hint: `${m.aquiferStoragePct}% capacity` },
          { key: 'depth', label: 'Water Table Depth', value: m.waterTableDepthM.toFixed(1), numericValue: m.waterTableDepthM, unit: 'm', status: m.shallowWellDry ? 'critical' : 'optimal' },
          { key: 'extract', label: 'Extraction Rate', value: m.extractionRateMLd.toFixed(1), numericValue: m.extractionRateMLd, unit: 'ML/d', status: 'caution', hint: `${m.activeWellsCount} wells active` },
          { key: 'recharge', label: 'Recharge Rate', value: m.rechargeRateMLd.toFixed(1), numericValue: m.rechargeRateMLd, unit: 'ML/d', status: 'optimal' },
          { key: 'horizonChange', label: `${m.horizonYears}-Yr Projected Shift`, value: `${m.projectedStorageChangePct >= 0 ? '+' : ''}${m.projectedStorageChangePct.toFixed(1)}`, numericValue: m.projectedStorageChangePct, unit: '%', status: m.projectedStorageChangePct >= 0 ? 'optimal' : 'critical', hint: `Depth -> ${m.projectedDepthM.toFixed(1)} m` },
        ],
        beforeAfterMetrics: {
          currentStorage: { label: 'Current Storage', unit: 'ML', value: m.currentStorageML, formatted: `${m.currentStorageML.toFixed(0)} ML` },
          waterTableDepth: { label: 'Water Table Depth', unit: 'm', value: m.waterTableDepthM, formatted: `${m.waterTableDepthM.toFixed(1)} m` },
          extractionRate: { label: 'Extraction Rate', unit: 'ML/d', value: m.extractionRateMLd, formatted: `${m.extractionRateMLd.toFixed(1)} ML/d` },
          rechargeRate: { label: 'Recharge Rate', unit: 'ML/d', value: m.rechargeRateMLd, formatted: `${m.rechargeRateMLd.toFixed(1)} ML/d` },
        },
        detailNotes: [
          `Shared with Phase 3 Underground: ${m.activeWellsCount} active wells + ${m.soilPermeability} soil permeability (${m.rechargeAreaPct}% open recharge zone).`,
        ],
      };
    }

    case 'pipeline-leakage': {
      const m = computePipelineLeakLabModel(state.lab, state.city);
      return {
        experimentId,
        headlineStatus: m.leakActive
          ? `Active Burst (${m.leakCount} leaks spraying)`
          : 'All Pipes Sealed — Nominal Pressure',
        statusTone: !m.leakActive ? 'optimal' : m.wastedSharePct > 28 ? 'critical' : 'caution',
        cards: [
          { key: 'wasteRate', label: 'Total Leakage Rate', value: Math.round(m.totalWastedLph).toLocaleString(), numericValue: m.totalWastedLph, unit: 'L/hr', status: m.leakActive ? 'critical' : 'optimal' },
          { key: 'dailyWaste', label: '24-Hr Projected Loss', value: Math.round(m.wastedPerDayLitres).toLocaleString(), numericValue: m.wastedPerDayLitres, unit: 'L/day', status: m.leakActive ? 'caution' : 'optimal' },
          { key: 'downstreamBar', label: 'Downstream Pressure', value: m.downstreamPressureBar.toFixed(1), numericValue: m.downstreamPressureBar, unit: 'bar', status: m.downstreamPressureBar < 2.6 ? 'critical' : 'optimal', hint: `Head drop -${m.headDropBar.toFixed(1)} bar` },
          { key: 'wastePct', label: 'Non-Revenue Water', value: m.wastedSharePct.toFixed(1), numericValue: m.wastedSharePct, unit: '%', status: m.wastedSharePct > 25 ? 'critical' : 'neutral' },
          { key: 'affectedBldgs', label: 'Low-Pressure Buildings', value: `${m.affectedBuildingsCount}/5`, numericValue: m.affectedBuildingsCount, unit: 'bldgs', status: m.affectedBuildingsCount > 0 ? 'caution' : 'optimal' },
          { key: 'accumulated', label: 'Accumulated Burst Loss', value: Math.round(m.accumulatedLossLitres).toLocaleString(), numericValue: m.accumulatedLossLitres, unit: 'L', status: 'neutral' },
        ],
        beforeAfterMetrics: {
          wasteRate: { label: 'Total Leakage Rate', unit: 'L/hr', value: m.totalWastedLph, formatted: `${Math.round(m.totalWastedLph).toLocaleString()} L/hr` },
          downstreamPressure: { label: 'Downstream Pressure', unit: 'bar', value: m.downstreamPressureBar, formatted: `${m.downstreamPressureBar.toFixed(1)} bar` },
          nonRevenuePct: { label: 'Non-Revenue Water', unit: '%', value: m.wastedSharePct, formatted: `${m.wastedSharePct.toFixed(1)}%` },
          affectedBuildings: { label: 'Affected Buildings', unit: 'bldgs', value: m.affectedBuildingsCount, formatted: `${m.affectedBuildingsCount}/5` },
        },
        detailNotes: [
          m.leakActive
            ? `${m.leakCount} active ${m.leakOrificeMm} mm crack(s) at ${m.pressureBar.toFixed(1)} bar — click "Repair All Leaks" to seal both Lab & Smart City pipes.`
            : `Network sealed. Repaired bursts count: ${m.repairedCount}. Only background seepage (${Math.round(m.backgroundSeepageLph).toLocaleString()} L/hr) remains.`,
        ],
      };
    }

    case 'water-filtration': {
      const m = computeFiltrationLabModel(state.lab);
      return {
        experimentId,
        headlineStatus:
          m.outletTurbidityNtu <= 5
            ? 'High Optical Clarification (Disinfection Still Needed)'
            : m.outletTurbidityNtu <= 15
              ? 'Moderate Clarification'
              : 'High Outlet Turbidity — Check Flow/Media',
        statusTone: m.outletTurbidityNtu <= 5 ? 'optimal' : m.outletTurbidityNtu <= 15 ? 'caution' : 'critical',
        cards: [
          { key: 'rawNtu', label: 'Raw Intake Turbidity', value: m.initialTurbidityNtu.toFixed(0), numericValue: m.initialTurbidityNtu, unit: 'NTU', status: 'neutral' },
          { key: 'outletNtu', label: 'Outlet Turbidity', value: m.outletTurbidityNtu.toFixed(1), numericValue: m.outletTurbidityNtu, unit: 'NTU', status: m.outletTurbidityNtu <= 5 ? 'optimal' : 'caution' },
          { key: 'reduction', label: 'Suspended Solids Removed', value: m.turbidityReductionPct.toFixed(1), numericValue: m.turbidityReductionPct, unit: '%', status: 'optimal' },
          { key: 'odor', label: 'Organic Odor Adsorption', value: `${m.organicOdorRemovalPct}`, numericValue: m.organicOdorRemovalPct, unit: '%', status: 'neutral' },
          { key: 'salt', label: 'Dissolved Salts Removed', value: '0', numericValue: 0, unit: '%', status: 'caution', hint: 'Requires RO/distillation' },
          { key: 'volume', label: 'Bench Volume Processed', value: Math.round(m.cumulativeFilteredLitres).toLocaleString(), numericValue: m.cumulativeFilteredLitres, unit: 'L', status: 'neutral' },
        ],
        beforeAfterMetrics: {
          outletNtu: { label: 'Outlet Turbidity', unit: 'NTU', value: m.outletTurbidityNtu, formatted: `${m.outletTurbidityNtu.toFixed(1)} NTU` },
          reductionPct: { label: 'Turbidity Reduction', unit: '%', value: m.turbidityReductionPct, formatted: `${m.turbidityReductionPct.toFixed(1)}%` },
          odorRemoval: { label: 'Carbon Odor Adsorption', unit: '%', value: m.organicOdorRemovalPct, formatted: `${m.organicOdorRemovalPct}%` },
        },
        detailNotes: [
          `Stage path: ${m.stageOutputs.map((s) => `${s.stage} ${s.ntu.toFixed(1)} NTU`).join(' → ')}.`,
          'Mandatory reminder: Mechanical media filtration does NOT sterilize pathogens or remove dissolved salts—UV/chlorination & testing are required.',
        ],
      };
    }

    case 'desalination': {
      const m = computeDesalinationLabModel(state.lab);
      return {
        experimentId,
        headlineStatus: m.membraneStalled
          ? 'Osmotic Stall — Pressure Below Π_osm'
          : 'Active Reverse Osmosis Separation',
        statusTone: m.membraneStalled ? 'critical' : m.specificEnergyKwhM3 > 5.0 ? 'caution' : 'optimal',
        cards: [
          { key: 'feed', label: 'Seawater Feed Volume', value: m.feedVolumeM3.toFixed(0), numericValue: m.feedVolumeM3, unit: 'm³', status: 'neutral' },
          { key: 'fresh', label: 'Freshwater Permeate', value: m.freshwaterM3.toFixed(1), numericValue: m.freshwaterM3, unit: 'm³', status: m.membraneStalled ? 'critical' : 'optimal', hint: `${m.effectiveRecoveryPct.toFixed(1)}% recovery` },
          { key: 'brine', label: 'Brine Concentrate', value: m.brineVolumeM3.toFixed(1), numericValue: m.brineVolumeM3, unit: 'm³', status: 'caution', hint: `${m.brineSalinityGpl} g/L salinity` },
          { key: 'rejection', label: 'Salt Rejection Rate', value: m.saltRejectionPct.toFixed(1), numericValue: m.saltRejectionPct, unit: '%', status: m.membraneStalled ? 'critical' : 'optimal', hint: `Product ~${m.permeateTdsMgL} mg/L` },
          { key: 'energy', label: 'Specific Energy Demand', value: m.specificEnergyKwhM3.toFixed(2), numericValue: m.specificEnergyKwhM3, unit: 'kWh/m³', status: m.specificEnergyKwhM3 > 4.8 ? 'caution' : 'optimal' },
          { key: 'osmotic', label: 'Osmotic Barrier Π_osm', value: m.osmoticPressureBar.toFixed(1), numericValue: m.osmoticPressureBar, unit: 'bar', status: m.netDrivingBar <= 6 ? 'critical' : 'neutral', hint: `Net drive ${m.netDrivingBar.toFixed(1)} bar` },
        ],
        beforeAfterMetrics: {
          freshwater: { label: 'Freshwater Output', unit: 'm³', value: m.freshwaterM3, formatted: `${m.freshwaterM3.toFixed(1)} m³` },
          brine: { label: 'Brine Discharge', unit: 'm³', value: m.brineVolumeM3, formatted: `${m.brineVolumeM3.toFixed(1)} m³` },
          saltRejection: { label: 'Salt Rejection', unit: '%', value: m.saltRejectionPct, formatted: `${m.saltRejectionPct.toFixed(1)}%` },
          energyPerM3: { label: 'Energy Intensity', unit: 'kWh/m³', value: m.specificEnergyKwhM3, formatted: `${m.specificEnergyKwhM3.toFixed(2)} kWh/m³` },
        },
        detailNotes: [
          m.membraneStalled
            ? `Feed pressure (${m.feedPressureBar} bar) must exceed natural osmotic back-pressure (${m.osmoticPressureBar} bar at ${m.salinityGpl} g/L) to produce freshwater.`
            : `Cumulative batch runtime total: ${m.cumulativeFreshwaterM3.toFixed(1)} m³ permeate vs ${m.cumulativeBrineM3.toFixed(1)} m³ brine (${m.totalEnergyKwh.toLocaleString()} kWh batch work).`,
        ],
      };
    }

    case 'supply-demand': {
      const m = computeSupplyDemandLabModel(state.lab, state.city);
      return {
        experimentId,
        headlineStatus: m.shortageConsequence,
        statusTone:
          m.netSurplusOrDeficitMLd >= 0
            ? 'optimal'
            : m.netSurplusOrDeficitMLd >= -5
              ? 'caution'
              : 'critical',
        cards: [
          { key: 'totalDemand', label: 'Sector End Demand', value: m.totalEndDemandMLd.toFixed(1), numericValue: m.totalEndDemandMLd, unit: 'ML/d', status: 'neutral', hint: `Dom ${m.domesticDemandMLd.toFixed(1)} ML/d` },
          { key: 'supply', label: 'Available Supply', value: m.availableSupplyMLd.toFixed(1), numericValue: m.availableSupplyMLd, unit: 'ML/d', status: 'neutral' },
          { key: 'balance', label: 'Surplus / Deficit', value: `${m.netSurplusOrDeficitMLd >= 0 ? '+' : ''}${m.netSurplusOrDeficitMLd.toFixed(1)}`, numericValue: m.netSurplusOrDeficitMLd, unit: 'ML/d', status: m.netSurplusOrDeficitMLd >= 0 ? 'optimal' : 'critical' },
          { key: 'reservoir', label: 'Reservoir Storage', value: m.reservoirLevelML.toFixed(0), numericValue: m.reservoirLevelML, unit: 'ML', status: m.reservoirStoragePct < 35 ? 'critical' : 'optimal', hint: `${m.reservoirStoragePct}% of ${m.reservoirCapacityML} ML` },
          { key: 'losses', label: 'Distribution Losses', value: m.distributionLossMLd.toFixed(1), numericValue: m.distributionLossMLd, unit: 'ML/d', status: m.distributionLossPct > 18 ? 'caution' : 'neutral', hint: `${m.distributionLossPct}% NRW` },
          { key: 'perCapita', label: 'Per-Person Allowance', value: `${m.perCapitaLpd}`, numericValue: m.perCapitaLpd, unit: 'L/day', status: m.perCapitaLpd > 160 ? 'caution' : 'optimal' },
        ],
        beforeAfterMetrics: {
          totalDemand: { label: 'Sector End Demand', unit: 'ML/d', value: m.totalEndDemandMLd, formatted: `${m.totalEndDemandMLd.toFixed(1)} ML/d` },
          balance: { label: 'Net Surplus / Deficit', unit: 'ML/d', value: m.netSurplusOrDeficitMLd, formatted: `${m.netSurplusOrDeficitMLd >= 0 ? '+' : ''}${m.netSurplusOrDeficitMLd.toFixed(1)} ML/d` },
          losses: { label: 'Distribution Loss', unit: 'ML/d', value: m.distributionLossMLd, formatted: `${m.distributionLossMLd.toFixed(1)} ML/d` },
          perCapita: { label: 'Per-Person Usage', unit: 'L/day', value: m.perCapitaLpd, formatted: `${m.perCapitaLpd} L/d` },
        },
        detailNotes: [
          m.netSurplusOrDeficitMLd < 0
            ? `At a deficit of ${Math.abs(m.netSurplusOrDeficitMLd).toFixed(1)} ML/d, the ${m.reservoirLevelML.toFixed(0)} ML reserve buffers ~${m.daysOfBuffer} days before rationing.`
            : `Supply covers all ${m.population.toLocaleString()} residents + industrial/commercial loads plus ${m.distributionLossMLd.toFixed(1)} ML/d pipe losses.`,
        ],
      };
    }

    case 'smart-city-management': {
      const m = computeSmartCityMgmtModel(state.city, state.underground);
      return {
        experimentId,
        headlineStatus:
          m.sustainabilityIndicator >= 78
            ? 'Highly Resilient Smart Water Loop'
            : m.sustainabilityIndicator >= 55
              ? 'Moderate Stress — Optimization Available'
              : 'Critical Urban Water Imbalance',
        statusTone:
          m.sustainabilityIndicator >= 78
            ? 'optimal'
            : m.sustainabilityIndicator >= 55
              ? 'caution'
              : 'critical',
        cards: [
          { key: 'ssi', label: 'Simulated Sustainability Index', value: `${m.sustainabilityIndicator}`, numericValue: m.sustainabilityIndicator, unit: '/100', status: m.sustainabilityIndicator >= 75 ? 'optimal' : m.sustainabilityIndicator >= 55 ? 'caution' : 'critical' },
          { key: 'cityBal', label: 'City Supply vs Demand', value: `${m.city.netBalanceMLd >= 0 ? '+' : ''}${m.city.netBalanceMLd.toFixed(1)}`, numericValue: m.city.netBalanceMLd, unit: 'ML/d', status: m.city.netBalanceMLd >= 0 ? 'optimal' : 'critical' },
          { key: 'reuse', label: 'Recycled + Rainwater Supply', value: m.combinedReuseMLd.toFixed(1), numericValue: m.combinedReuseMLd, unit: 'ML/d', status: 'optimal' },
          { key: 'eff', label: 'Pipeline Efficiency', value: m.city.distributionEfficiencyPct.toFixed(0), numericValue: m.city.distributionEfficiencyPct, unit: '%', status: state.city.leak.active ? 'critical' : 'optimal' },
          { key: 'ugBal', label: 'Aquifer Recharge Balance', value: `${m.underground.netBalanceMLd >= 0 ? '+' : ''}${m.underground.netBalanceMLd.toFixed(1)}`, numericValue: m.underground.netBalanceMLd, unit: 'ML/d', status: m.underground.netBalanceMLd >= 0 ? 'optimal' : 'caution' },
          { key: 'wtDepth', label: 'Subsurface Water Table', value: state.underground.waterTableDepthM.toFixed(1), numericValue: state.underground.waterTableDepthM, unit: 'm', status: m.underground.shallowWellDry ? 'critical' : 'optimal' },
        ],
        beforeAfterMetrics: {
          sustainability: { label: 'Simulated Sustainability Index', unit: '/100', value: m.sustainabilityIndicator, formatted: `${m.sustainabilityIndicator}/100` },
          cityNetBalance: { label: 'City Supply Balance', unit: 'ML/d', value: m.city.netBalanceMLd, formatted: `${m.city.netBalanceMLd >= 0 ? '+' : ''}${m.city.netBalanceMLd.toFixed(1)} ML/d` },
          distributionEff: { label: 'Distribution Efficiency', unit: '%', value: m.city.distributionEfficiencyPct, formatted: `${m.city.distributionEfficiencyPct.toFixed(1)}%` },
          waterTable: { label: 'Water Table Depth', unit: 'm', value: state.underground.waterTableDepthM, formatted: `${state.underground.waterTableDepthM.toFixed(1)} m` },
        },
        detailNotes: [
          `Subscores — Balance: ${m.subscores.supplyAdequacy}%, Pipe Efficiency: ${m.subscores.distributionEfficiency}%, Reuse & Rain: ${m.subscores.reuseAndRain}%, Aquifer: ${m.subscores.aquiferStability}%.`,
        ],
      };
    }
  }
}

export function buildLabBaselineSnapshot(
  experimentId: LabExperimentId,
  state: ExhibitionState,
  label = 'Baseline Snapshot'
): LabBaselineSnapshot {
  const output = computeLabExperimentOutput(experimentId, state);
  const metrics: Record<string, number> = {};
  const formatted: Record<string, string> = {};
  for (const [k, item] of Object.entries(output.beforeAfterMetrics)) {
    metrics[k] = Number(item.value.toFixed(2));
    formatted[k] = item.formatted;
  }
  return {
    experimentId,
    capturedAt: Date.now(),
    label,
    metrics,
    formatted,
  };
}

export function computeLabComparison(
  experimentId: LabExperimentId,
  state: ExhibitionState
): {
  hasBaseline: boolean;
  baselineLabel: string;
  rows: LabComparisonDelta[];
  summaryText: string;
} {
  const output = computeLabExperimentOutput(experimentId, state);
  const baseline = state.lab.baselines[experimentId];
  const meta = LAB_EXPERIMENTS_BY_ID[experimentId];

  if (!baseline) {
    return {
      hasBaseline: false,
      baselineLabel: 'No snapshot yet',
      rows: [],
      summaryText: `No baseline snapshot captured yet for ${meta.shortTitle}.`,
    };
  }

  const rows: LabComparisonDelta[] = Object.entries(output.beforeAfterMetrics).map(([k, now]) => {
    const prev = baseline.metrics[k] ?? now.value;
    const prevFormatted = baseline.formatted[k] ?? now.formatted;
    const diff = Number((now.value - prev).toFixed(2));
    const sign = diff > 0 ? '+' : '';
    const deltaText =
      Math.abs(diff) < 0.05
        ? 'No change'
        : `${sign}${Math.abs(diff) >= 100 ? Math.round(diff).toLocaleString() : diff.toFixed(1)} ${now.unit}`;
    return {
      key: k,
      label: now.label,
      unit: now.unit,
      beforeVal: prevFormatted,
      afterVal: now.formatted,
      deltaNumeric: diff,
      deltaText,
    };
  });

  const summaryParts = rows.map(
    (r) => `${r.label}: ${r.beforeVal} -> ${r.afterVal} (${r.deltaText})`
  );

  return {
    hasBaseline: true,
    baselineLabel: baseline.label,
    rows,
    summaryText: `Before vs After comparison for ${meta.title}: ${summaryParts.join('; ')}. (Educational simulation outputs.)`,
  };
}

/**
 * Steps ONLY the active lab experiment's time-integrated accumulators cleanly.
 */
export function stepActiveLabState(state: ExhibitionState, rawDt: number): ExhibitionState {
  if (!state.simulationParams.running || state.simulationParams.speed <= 0) {
    return state;
  }
  const dt = Math.min(0.25, Math.max(0.01, rawDt)) * state.simulationParams.speed;
  const expId = state.lab.activeExperiment;
  const nextElapsed = Number((state.lab.elapsedSeconds + dt).toFixed(2));

  if (expId === 'water-cycle') {
    const wc = computeWaterCycleModel(state.lab, state.city, state.underground);
    const targetVapor = clampValue(30 + wc.evaporationMmDay * 6.5, 12, 98);
    const targetCloud = clampValue(22 + wc.condensationMmDay * 7.2, 10, 98);
    const nextVapor =
      state.lab.waterCycle.vaporStorageIndex +
      (targetVapor - state.lab.waterCycle.vaporStorageIndex) * Math.min(1, dt * 1.4);
    const nextCloud =
      state.lab.waterCycle.cloudMassIndex +
      (targetCloud - state.lab.waterCycle.cloudMassIndex) * Math.min(1, dt * 1.1);
    return {
      ...state,
      lab: {
        ...state.lab,
        elapsedSeconds: nextElapsed,
        waterCycle: {
          ...state.lab.waterCycle,
          vaporStorageIndex: Number(nextVapor.toFixed(1)),
          cloudMassIndex: Number(nextCloud.toFixed(1)),
        },
      },
    };
  }

  if (expId === 'groundwater-depletion') {
    const ugM = computeUndergroundMetrics(state.underground, state.city);
    const nextDepth = stepWaterTableDepth(
      state.underground.waterTableDepthM,
      ugM.netBalanceMLd,
      state.simulationParams.speed,
      dt / state.simulationParams.speed
    );
    return {
      ...state,
      underground:
        nextDepth !== null
          ? { ...state.underground, waterTableDepthM: nextDepth }
          : state.underground,
      lab: {
        ...state.lab,
        elapsedSeconds: nextElapsed,
      },
    };
  }

  if (expId === 'pipeline-leakage' && state.city.leak.active) {
    const m = computePipelineLeakLabModel(state.lab, state.city);
    const addedLitres = Math.round((m.totalWastedLph / 3600) * dt * 60);
    return {
      ...state,
      city: {
        ...state.city,
        leak: {
          ...state.city.leak,
          severityLph: Math.round(clampValue(m.burstLeakLph, 1000, 50000)),
          accumulatedLossLitres: state.city.leak.accumulatedLossLitres + addedLitres,
        },
      },
      lab: {
        ...state.lab,
        elapsedSeconds: nextElapsed,
      },
    };
  }

  if (expId === 'water-filtration') {
    const addedL = (state.lab.filtration.flowRateLpm / 60) * dt * 12;
    return {
      ...state,
      lab: {
        ...state.lab,
        elapsedSeconds: nextElapsed,
        filtration: {
          ...state.lab.filtration,
          cumulativeFilteredLitres: Number(
            (state.lab.filtration.cumulativeFilteredLitres + addedL).toFixed(1)
          ),
        },
      },
    };
  }

  if (expId === 'desalination') {
    const ro = computeDesalinationLabModel(state.lab);
    if (ro.membraneStalled) {
      return {
        ...state,
        lab: { ...state.lab, elapsedSeconds: nextElapsed },
      };
    }
    const freshDelta = (ro.freshwaterM3 / 40) * dt;
    const brineDelta = (ro.brineVolumeM3 / 40) * dt;
    return {
      ...state,
      lab: {
        ...state.lab,
        elapsedSeconds: nextElapsed,
        desalination: {
          ...state.lab.desalination,
          cumulativeFreshwaterM3: Number(
            (state.lab.desalination.cumulativeFreshwaterM3 + freshDelta).toFixed(2)
          ),
          cumulativeBrineM3: Number(
            (state.lab.desalination.cumulativeBrineM3 + brineDelta).toFixed(2)
          ),
        },
      },
    };
  }

  if (expId === 'smart-city-management') {
    const ugM = computeUndergroundMetrics(state.underground, state.city);
    const nextDepth = stepWaterTableDepth(
      state.underground.waterTableDepthM,
      ugM.netBalanceMLd,
      state.simulationParams.speed,
      dt / state.simulationParams.speed
    );
    const leakAdd = state.city.leak.active ? Math.round((lphToMld(state.city.leak.severityLph) * 1_000_000 / 86400) * dt * 60) : 0;
    return {
      ...state,
      underground:
        nextDepth !== null
          ? { ...state.underground, waterTableDepthM: nextDepth }
          : state.underground,
      city:
        leakAdd > 0
          ? {
              ...state.city,
              leak: {
                ...state.city.leak,
                accumulatedLossLitres: state.city.leak.accumulatedLossLitres + leakAdd,
              },
            }
          : state.city,
      lab: {
        ...state.lab,
        elapsedSeconds: nextElapsed,
      },
    };
  }

  return {
    ...state,
    lab: {
      ...state.lab,
      elapsedSeconds: nextElapsed,
    },
  };
}
