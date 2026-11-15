import {
  CityLeakState,
  CitySimulationState,
  ExhibitionState,
  SimulationParams,
  SoilPermeabilityLevel,
  UndergroundSimulationState,
  UndergroundWellState,
} from '../types/exhibition';

export const WATER_SCIENCE_CONSTANTS = {
  PLANETARY: {
    TOTAL_VOLUME_KM3: 1_386_000_000,
    SALTWATER_PCT: 97.5,
    FRESHWATER_PCT: 2.5,
    GLACIERS_OF_FRESHWATER_PCT: 68.7,
    GROUNDWATER_OF_FRESHWATER_PCT: 30.1,
    SURFACE_OF_FRESHWATER_PCT: 1.2,
    OCEAN_SALINITY_GPL: 35,
    OCEAN_EVAPORATION_SHARE: 0.86,
  },
  CONVERSION: {
    LITRES_PER_MEGALITRE: 1_000_000,
    HOURS_PER_DAY: 24,
    SECONDS_PER_HOUR: 3600,
  },
  URBAN_CONSUMPTION: {
    BASE_PER_CAPITA_LPD: 135,
    MIN_BUILDING_MULTIPLIER: 0.5,
    MAX_BUILDING_MULTIPLIER: 1.6,
    WASTEWATER_RETURN_FRACTION: 0.8,
    REFERENCE_PRESSURE_BAR: 4.2,
    MAX_REPORTED_LEAK_PCT: 65,
    MIN_EFFICIENCY_PCT: 35,
    MAX_EFFICIENCY_PCT: 98,
    CITY_ROOF_CATCHMENT_KM2: 1.4,
    CITY_RUNOFF_EFFICIENCY: 0.82,
    RESERVOIR_BASE_INFLOW_MLD: 4.5,
    RESERVOIR_RAINFALL_INFLOW_FACTOR: 0.24,
    GROUNDWATER_MAX_CITY_CAPACITY_MLD: 14.0,
    LEAK_SIMULATION_TIME_ACCEL: 60,
  },
  HYDROGEOLOGY: {
    PERMEABILITY_FACTORS: {
      low: 0.28,
      medium: 0.58,
      high: 0.92,
    } as Record<SoilPermeabilityLevel, number>,
    HYDRAULIC_CONDUCTIVITY_MS: {
      low: 1e-8,
      medium: 1e-4,
      high: 1e-2,
    } as Record<SoilPermeabilityLevel, number>,
    MIN_WATER_TABLE_DEPTH_M: 4.2,
    MAX_WATER_TABLE_DEPTH_M: 33.5,
    STORAGE_REF_TOP_M: 4.0,
    STORAGE_SPAN_M: 30.0,
    SHALLOW_WELL_DRY_DEPTH_M: 14.0,
    BASELINE_EQUILIBRIUM_DEPTH_M: 11.5,
    EQUILIBRIUM_BALANCE_SLOPE: 1.45,
    RECHARGE_BASE_MLD: 7.8,
    RECHARGE_REF_RAINFALL_MM: 45,
    RECHARGE_REF_AREA_PCT: 50,
    CITY_EXTRACTION_COUPLING_MLD: 3.5,
    WELL_MAX_REFERENCE_LPH: 360_000,
    MIN_WELL_EXTRACTION_LPH: 10_000,
    MAX_WELL_EXTRACTION_LPH: 220_000,
    WATER_TABLE_RESPONSE_RATE: 0.18,
    MIN_DEPTH_STEP_DELTA_M: 0.005,
  },
} as const;

export interface ComputedCityMetrics {
  baseDemandMLd: number;
  effectiveDemandMLd: number;
  wastewaterGeneratedMLd: number;
  recycledSupplyMLd: number;
  leakageLossPct: number;
  leakageLossMLd: number;
  leakageLossLph: number;
  rainwaterCollectedMLd: number;
  groundwaterSupplyMLd: number;
  reservoirInflowMLd: number;
  surfaceSupplyMLd: number;
  totalAvailableSupplyMLd: number;
  netBalanceMLd: number;
  distributionEfficiencyPct: number;
  groundwaterAvailabilityPct: number;
  dailyPerCapitaLitres: number;
  rainwaterFormulaLitres: number;
  rainwaterOverflowLitres: number;
  cityResilienceScore: number;
}

export interface ComputedUndergroundMetrics {
  extractionRateMLd: number;
  rechargeRateMLd: number;
  netBalanceMLd: number;
  activeWellsCount: number;
  aquiferStoragePct: number;
  permeabilityFactor: number;
  shallowWellDry: boolean;
  equilibriumDepthM: number;
}

export interface PlanetaryWaterModelOutput {
  demandIndexPct: number;
  renewableRunoffIndex: number;
  effectiveSupplyIndex: number;
  globalStressScore: number;
  statusLabel: 'Balanced' | 'Seasonal Pressure' | 'High Stress';
}

export interface IntegratedSimulationSnapshot {
  planetary: PlanetaryWaterModelOutput;
  city: ComputedCityMetrics;
  underground: ComputedUndergroundMetrics;
  combinedReuseAndRechargeMLd: number;
  combinedExtractionMLd: number;
  systemSustainabilityPct: number;
}

export function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lphToMld(litresPerHour: number): number {
  const { HOURS_PER_DAY, LITRES_PER_MEGALITRE } = WATER_SCIENCE_CONSTANTS.CONVERSION;
  return (litresPerHour * HOURS_PER_DAY) / LITRES_PER_MEGALITRE;
}

export function mldToLph(megalitresPerDay: number): number {
  const { HOURS_PER_DAY, LITRES_PER_MEGALITRE } = WATER_SCIENCE_CONSTANTS.CONVERSION;
  return Math.round((megalitresPerDay * LITRES_PER_MEGALITRE) / HOURS_PER_DAY);
}

/**
 * Computes effective per-capita daily water consumption (L/person/day)
 * factoring the city-wide demand multiplier and per-building overrides.
 */
export function calculatePerCapitaDemandLpd(
  demandMultiplier: number,
  buildingDemandOverrides: Record<string, number>
): number {
  const { BASE_PER_CAPITA_LPD } = WATER_SCIENCE_CONSTANTS.URBAN_CONSUMPTION;
  const overrides = Object.values(buildingDemandOverrides);
  const avgBuildingFactor =
    overrides.length > 0
      ? overrides.reduce((sum, val) => sum + val, 0) / overrides.length
      : 1.0;
  return Math.round(BASE_PER_CAPITA_LPD * demandMultiplier * avgBuildingFactor);
}

/**
 * Computes baseline and effective urban water consumption plus generated wastewater (ML/d).
 */
export function calculateUrbanWaterDemand(population: number, dailyPerCapitaLitres: number) {
  const { LITRES_PER_MEGALITRE } = WATER_SCIENCE_CONSTANTS.CONVERSION;
  const { BASE_PER_CAPITA_LPD, WASTEWATER_RETURN_FRACTION } =
    WATER_SCIENCE_CONSTANTS.URBAN_CONSUMPTION;

  const baseDemandMLd = (population * BASE_PER_CAPITA_LPD) / LITRES_PER_MEGALITRE;
  const effectiveDemandMLd = (population * dailyPerCapitaLitres) / LITRES_PER_MEGALITRE;
  const wastewaterGeneratedMLd = effectiveDemandMLd * WASTEWATER_RETURN_FRACTION;

  return {
    baseDemandMLd,
    effectiveDemandMLd,
    wastewaterGeneratedMLd,
  };
}

/**
 * Models background pressure-dependent distribution losses plus active trunk bursts.
 */
export function calculatePipelineLeakage(
  effectiveDemandMLd: number,
  baseLeakageRatePct: number,
  pipelinePressureBar: number,
  leak: CityLeakState
) {
  const {
    REFERENCE_PRESSURE_BAR,
    MAX_REPORTED_LEAK_PCT,
    MIN_EFFICIENCY_PCT,
    MAX_EFFICIENCY_PCT,
  } = WATER_SCIENCE_CONSTANTS.URBAN_CONSUMPTION;

  const pressureFactor = pipelinePressureBar / REFERENCE_PRESSURE_BAR;
  const activeLeakMLd = leak.active ? lphToMld(leak.severityLph) : 0;
  const baseLeakMLd = effectiveDemandMLd * (baseLeakageRatePct / 100) * pressureFactor;
  const leakageLossMLd = baseLeakMLd + activeLeakMLd;
  const leakageLossLph = mldToLph(leakageLossMLd);
  const leakageLossPct = Math.min(
    MAX_REPORTED_LEAK_PCT,
    (leakageLossMLd / Math.max(1, effectiveDemandMLd + leakageLossMLd)) * 100
  );
  const distributionEfficiencyPct = clampValue(
    100 - leakageLossPct,
    MIN_EFFICIENCY_PCT,
    MAX_EFFICIENCY_PCT
  );

  return {
    leakageLossMLd,
    leakageLossLph,
    leakageLossPct,
    distributionEfficiencyPct,
  };
}

/**
 * Computes incremental simulated water lost during an active pipe burst tick.
 */
export function calculateLeakTickLossLitres(
  severityLph: number,
  dtSeconds: number,
  accelerationFactor: number = WATER_SCIENCE_CONSTANTS.URBAN_CONSUMPTION.LEAK_SIMULATION_TIME_ACCEL
): number {
  const { SECONDS_PER_HOUR } = WATER_SCIENCE_CONSTANTS.CONVERSION;
  return Math.round((severityLph / SECONDS_PER_HOUR) * dtSeconds * accelerationFactor);
}

/**
 * Rational rainwater harvesting equation:
 * Collected (L) = Rainfall (mm) × Catchment Area (m²) × Runoff Coefficient
 */
export function calculateRainwaterHarvest(
  rainfallMm: number,
  roofAreaM2: number,
  runoffCoeff: number,
  tankCapacityLitres: number,
  tankStoredLitres: number
) {
  const rainwaterFormulaLitres = Math.round(rainfallMm * roofAreaM2 * runoffCoeff);
  const potentialTotal = tankStoredLitres + rainwaterFormulaLitres;
  const rainwaterOverflowLitres = Math.max(0, potentialTotal - tankCapacityLitres);
  const nextStoredLitresIfCollected = Math.min(tankCapacityLitres, potentialTotal);
  const tankFillPct = Math.min(
    100,
    Math.round((tankStoredLitres / Math.max(1, tankCapacityLitres)) * 100)
  );

  return {
    rainwaterFormulaLitres,
    rainwaterOverflowLitres,
    nextStoredLitresIfCollected,
    tankFillPct,
  };
}

/**
 * Computes full Smart City urban water supply, consumption, leakage, and resilience metrics.
 */
export function computeCityMetrics(city: CitySimulationState): ComputedCityMetrics {
  const {
    CITY_ROOF_CATCHMENT_KM2,
    CITY_RUNOFF_EFFICIENCY,
    RESERVOIR_BASE_INFLOW_MLD,
    RESERVOIR_RAINFALL_INFLOW_FACTOR,
    GROUNDWATER_MAX_CITY_CAPACITY_MLD,
  } = WATER_SCIENCE_CONSTANTS.URBAN_CONSUMPTION;

  const dailyPerCapitaLitres = calculatePerCapitaDemandLpd(
    city.demandMultiplier,
    city.buildingDemandOverrides
  );
  const { baseDemandMLd, effectiveDemandMLd, wastewaterGeneratedMLd } =
    calculateUrbanWaterDemand(city.population, dailyPerCapitaLitres);

  const recycledSupplyMLd = wastewaterGeneratedMLd * (city.recyclingCapacityPct / 100);

  const {
    leakageLossMLd,
    leakageLossLph,
    leakageLossPct,
    distributionEfficiencyPct,
  } = calculatePipelineLeakage(
    effectiveDemandMLd,
    city.baseLeakageRatePct,
    city.pipelinePressureBar,
    city.leak
  );

  const { rainwaterFormulaLitres, rainwaterOverflowLitres } = calculateRainwaterHarvest(
    city.rainwater.rainfallMm,
    city.rainwater.roofAreaM2,
    city.rainwater.runoffCoeff,
    city.rainwater.tankCapacityLitres,
    city.rainwater.tankStoredLitres
  );

  const rainwaterCollectedMLd =
    (city.rainfallIntensity * CITY_ROOF_CATCHMENT_KM2 * CITY_RUNOFF_EFFICIENCY) / 10;
  const reservoirInflowMLd =
    RESERVOIR_BASE_INFLOW_MLD + city.rainfallIntensity * RESERVOIR_RAINFALL_INFLOW_FACTOR;
  const surfaceSupplyMLd = reservoirInflowMLd * (0.45 + city.reservoirStoragePct / 140);
  const groundwaterSupplyMLd =
    (city.groundwaterExtractionPct / 100) * GROUNDWATER_MAX_CITY_CAPACITY_MLD;

  const totalAvailableSupplyMLd =
    surfaceSupplyMLd + recycledSupplyMLd + rainwaterCollectedMLd + groundwaterSupplyMLd;

  const grossRequiredMLd = effectiveDemandMLd + leakageLossMLd;
  const netBalanceMLd = totalAvailableSupplyMLd - grossRequiredMLd;
  const groundwaterAvailabilityPct = clampValue(
    88 - city.groundwaterExtractionPct * 0.65 + city.rainfallIntensity * 0.14,
    12,
    96
  );

  let score = 55;
  score += Math.min(18, Math.max(-22, netBalanceMLd * 1.8));
  score += (distributionEfficiencyPct - 75) * 0.6;
  score += (city.recyclingCapacityPct - 35) * 0.35;
  score += (groundwaterAvailabilityPct - 50) * 0.25;
  if (city.leak.active) score -= 14;
  const cityResilienceScore = Math.round(clampValue(score, 8, 99));

  return {
    baseDemandMLd,
    effectiveDemandMLd,
    wastewaterGeneratedMLd,
    recycledSupplyMLd,
    leakageLossPct,
    leakageLossMLd,
    leakageLossLph,
    rainwaterCollectedMLd,
    groundwaterSupplyMLd,
    reservoirInflowMLd,
    surfaceSupplyMLd,
    totalAvailableSupplyMLd,
    netBalanceMLd,
    distributionEfficiencyPct,
    groundwaterAvailabilityPct,
    dailyPerCapitaLitres,
    rainwaterFormulaLitres,
    rainwaterOverflowLitres,
    cityResilienceScore,
  };
}

/**
 * Synchronizes Smart City groundwater extraction (%) with active underground well rates.
 */
export function syncCityExtractionFromWells(wells: UndergroundWellState[]): number {
  const { WELL_MAX_REFERENCE_LPH } = WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;
  const activeLph = wells
    .filter((well) => well.active)
    .reduce((sum, well) => sum + well.extractionLph, 0);
  return Math.round(clampValue((activeLph / WELL_MAX_REFERENCE_LPH) * 85, 5, 95));
}

/**
 * Determines whether a shallow unconfined well has gone dry because the water table
 * dropped beneath its intake depth.
 */
export function isWellDry(well: Pick<UndergroundWellState, 'wellType' | 'depthM'>, waterTableDepthM: number): boolean {
  return well.wellType === 'shallow' && waterTableDepthM > well.depthM;
}

/**
 * Computes combined subsurface groundwater extraction rate (ML/d) from active wells
 * and Smart City municipal pumping demand.
 */
export function calculateGroundwaterExtraction(
  wells: UndergroundWellState[],
  cityGroundwaterExtractionPct: number
) {
  const { CITY_EXTRACTION_COUPLING_MLD } = WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;
  const activeWells = wells.filter((w) => w.active);
  const activeWellsCount = activeWells.length;
  const wellsLph = activeWells.reduce((sum, w) => sum + w.extractionLph, 0);
  const wellsMLd = lphToMld(wellsLph);
  const cityCoupledMLd = (cityGroundwaterExtractionPct / 100) * CITY_EXTRACTION_COUPLING_MLD;
  const extractionRateMLd = wellsMLd + cityCoupledMLd;

  return {
    activeWellsCount,
    wellsLph,
    wellsMLd,
    cityCoupledMLd,
    extractionRateMLd,
  };
}

/**
 * Computes rainfall infiltration & managed aquifer recharge rate (ML/d).
 */
export function calculateAquiferRechargeMLd(
  rainfallIntensityMm: number,
  soilPermeability: SoilPermeabilityLevel,
  rechargeAreaPct: number
): { permeabilityFactor: number; rechargeRateMLd: number } {
  const {
    PERMEABILITY_FACTORS,
    RECHARGE_BASE_MLD,
    RECHARGE_REF_RAINFALL_MM,
    RECHARGE_REF_AREA_PCT,
  } = WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;

  const permeabilityFactor = PERMEABILITY_FACTORS[soilPermeability];
  const rechargeRateMLd =
    (rainfallIntensityMm / RECHARGE_REF_RAINFALL_MM) *
    permeabilityFactor *
    (rechargeAreaPct / RECHARGE_REF_AREA_PCT) *
    RECHARGE_BASE_MLD;

  return {
    permeabilityFactor,
    rechargeRateMLd,
  };
}

/**
 * Maps current phreatic surface depth (4 m = full, 34 m = depleted) to remaining aquifer storage (%).
 */
export function calculateAquiferStoragePct(waterTableDepthM: number): number {
  const { STORAGE_REF_TOP_M, STORAGE_SPAN_M } = WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;
  return Math.round(
    clampValue(100 - ((waterTableDepthM - STORAGE_REF_TOP_M) / STORAGE_SPAN_M) * 88, 10, 100)
  );
}

/**
 * Projects long-term steady-state water table depth (m) for the current net aquifer balance.
 */
export function calculateEquilibriumDepthM(netBalanceMLd: number): number {
  const {
    BASELINE_EQUILIBRIUM_DEPTH_M,
    EQUILIBRIUM_BALANCE_SLOPE,
  } = WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;
  return clampValue(
    BASELINE_EQUILIBRIUM_DEPTH_M - netBalanceMLd * EQUILIBRIUM_BALANCE_SLOPE,
    4.5,
    33.5
  );
}

/**
 * Advances the simulated water table depth by one continuous time step (dt in seconds).
 */
export function stepWaterTableDepth(
  currentDepthM: number,
  netBalanceMLd: number,
  simulationSpeed: number,
  dtSeconds: number
): number | null {
  if (simulationSpeed <= 0) return null;
  const {
    WATER_TABLE_RESPONSE_RATE,
    MIN_WATER_TABLE_DEPTH_M,
    MAX_WATER_TABLE_DEPTH_M,
    MIN_DEPTH_STEP_DELTA_M,
  } = WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;

  const rate = -netBalanceMLd * WATER_TABLE_RESPONSE_RATE * simulationSpeed * dtSeconds;
  const nextDepth = clampValue(
    currentDepthM + rate,
    MIN_WATER_TABLE_DEPTH_M,
    MAX_WATER_TABLE_DEPTH_M
  );

  if (Math.abs(nextDepth - currentDepthM) < MIN_DEPTH_STEP_DELTA_M) {
    return null;
  }
  return Number(nextDepth.toFixed(2));
}

/**
 * Computes full subsurface hydrogeology metrics synchronized with Smart City rainfall & pumping.
 */
export function computeUndergroundMetrics(
  ug: UndergroundSimulationState,
  city: CitySimulationState
): ComputedUndergroundMetrics {
  const { SHALLOW_WELL_DRY_DEPTH_M } = WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;

  const { activeWellsCount, extractionRateMLd } = calculateGroundwaterExtraction(
    ug.wells,
    city.groundwaterExtractionPct
  );
  const { permeabilityFactor, rechargeRateMLd } = calculateAquiferRechargeMLd(
    city.rainfallIntensity,
    ug.soilPermeability,
    ug.rechargeAreaPct
  );

  const netBalanceMLd = rechargeRateMLd - extractionRateMLd;
  const aquiferStoragePct = calculateAquiferStoragePct(ug.waterTableDepthM);
  const shallowWellDry = ug.waterTableDepthM > SHALLOW_WELL_DRY_DEPTH_M;
  const equilibriumDepthM = calculateEquilibriumDepthM(netBalanceMLd);

  return {
    extractionRateMLd,
    rechargeRateMLd,
    netBalanceMLd,
    activeWellsCount,
    aquiferStoragePct,
    permeabilityFactor,
    shallowWellDry,
    equilibriumDepthM,
  };
}

/**
 * Evaluates planetary-scale simulation parameters (linked to Earth Explorer state).
 */
export function computePlanetaryWaterModel(params: SimulationParams): PlanetaryWaterModelOutput {
  const demandIndexPct = clampValue(params.demand, 40, 200);
  const renewableRunoffIndex = clampValue((params.rainfall / 1200) * 100, 15, 180);
  const effectiveSupplyIndex =
    renewableRunoffIndex * 0.55 + params.storage * 0.28 + params.recycling * 0.35;
  const rawStress = clampValue(
    (demandIndexPct / Math.max(25, effectiveSupplyIndex)) * 48,
    8,
    98
  );
  const globalStressScore = Math.round(rawStress);

  const statusLabel: PlanetaryWaterModelOutput['statusLabel'] =
    globalStressScore < 42
      ? 'Balanced'
      : globalStressScore < 68
        ? 'Seasonal Pressure'
        : 'High Stress';

  return {
    demandIndexPct,
    renewableRunoffIndex: Math.round(renewableRunoffIndex),
    effectiveSupplyIndex: Math.round(effectiveSupplyIndex),
    globalStressScore,
    statusLabel,
  };
}

/**
 * Unified cross-module water balance snapshot combining Earth, Smart City, and Underground models.
 */
export function computeIntegratedWaterBalance(state: ExhibitionState): IntegratedSimulationSnapshot {
  const planetary = computePlanetaryWaterModel(state.simulationParams);
  const city = computeCityMetrics(state.city);
  const underground = computeUndergroundMetrics(state.underground, state.city);

  const combinedReuseAndRechargeMLd =
    city.recycledSupplyMLd + city.rainwaterCollectedMLd + underground.rechargeRateMLd;
  const combinedExtractionMLd = city.groundwaterSupplyMLd + underground.extractionRateMLd;
  const systemSustainabilityPct = Math.round(
    clampValue(
      city.cityResilienceScore * 0.55 +
        underground.aquiferStoragePct * 0.3 +
        (100 - planetary.globalStressScore) * 0.15,
      5,
      99
    )
  );

  return {
    planetary,
    city,
    underground,
    combinedReuseAndRechargeMLd,
    combinedExtractionMLd,
    systemSustainabilityPct,
  };
}
