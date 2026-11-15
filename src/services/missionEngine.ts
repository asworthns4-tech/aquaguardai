import { CitySimulationState, UndergroundSimulationState } from '../types/exhibition';
import { computeSmartCityMgmtModel } from './labSimulationEngine';
import { computeCityMetrics, computeUndergroundMetrics } from './simulationEngine';

export type MissionStageId =
  | 'drought-alert'
  | 'stop-leaks'
  | 'restore-groundwater'
  | 'smart-city'
  | 'save-city';

export type MissionDifficulty = 'easy' | 'medium' | 'hard';

export interface MissionDifficultyProfile {
  id: MissionDifficulty;
  label: string;
  description: string;
  scoreMultiplier: number;
  initialSetup: {
    rainfallIntensity: number;
    reservoirStoragePct: number;
    recyclingCapacityPct: number;
    demandMultiplier: number;
    groundwaterExtractionPct: number;
    leakActive: boolean;
    leakSeverityLph: number;
  };
  thresholds: {
    maxExtractionPct: number;
    minNetBalanceUg: number;
    minRecyclingPct: number;
    minCityBalance: number;
    finalMinReservoirPct: number;
    finalMinSsi: number;
  };
}

export const DIFFICULTY_PROFILES: Record<MissionDifficulty, MissionDifficultyProfile> = {
  easy: {
    id: 'easy',
    label: 'Explorer (Easy)',
    description: 'Moderate drought stress and forgiving resilience targets.',
    scoreMultiplier: 1.0,
    initialSetup: {
      rainfallIntensity: 38,
      reservoirStoragePct: 54,
      recyclingCapacityPct: 32,
      demandMultiplier: 1.05,
      groundwaterExtractionPct: 52,
      leakActive: true,
      leakSeverityLph: 11000,
    },
    thresholds: {
      maxExtractionPct: 55,
      minNetBalanceUg: -1.8,
      minRecyclingPct: 35,
      minCityBalance: -2.0,
      finalMinReservoirPct: 38,
      finalMinSsi: 68,
    },
  },
  medium: {
    id: 'medium',
    label: 'Commander (Medium)',
    description: 'Standard monsoon deficit with active trunk leak and high aquifer pumping.',
    scoreMultiplier: 1.25,
    initialSetup: {
      rainfallIntensity: 24,
      reservoirStoragePct: 38,
      recyclingCapacityPct: 24,
      demandMultiplier: 1.15,
      groundwaterExtractionPct: 68,
      leakActive: true,
      leakSeverityLph: 16500,
    },
    thresholds: {
      maxExtractionPct: 45,
      minNetBalanceUg: -0.8,
      minRecyclingPct: 45,
      minCityBalance: -0.5,
      finalMinReservoirPct: 42,
      finalMinSsi: 75,
    },
  },
  hard: {
    id: 'hard',
    label: 'Crisis Response (Hard)',
    description: 'Severe heatwave drought, heavy demand, and strict sustainability targets.',
    scoreMultiplier: 1.5,
    initialSetup: {
      rainfallIntensity: 14,
      reservoirStoragePct: 28,
      recyclingCapacityPct: 16,
      demandMultiplier: 1.3,
      groundwaterExtractionPct: 82,
      leakActive: true,
      leakSeverityLph: 22500,
    },
    thresholds: {
      maxExtractionPct: 35,
      minNetBalanceUg: 0.0,
      minRecyclingPct: 55,
      minCityBalance: 0.5,
      finalMinReservoirPct: 48,
      finalMinSsi: 80,
    },
  },
};

export interface MissionStageMeta {
  id: MissionStageId;
  number: number;
  title: string;
  subtitle: string;
  scenario: string;
  objectives: string[];
  hint: string;
  sciencePrinciple: string;
  basePoints: number;
}

export const MISSION_STAGES: MissionStageMeta[] = [
  {
    id: 'drought-alert',
    number: 1,
    title: 'The Drought Alert',
    subtitle: 'Inspect the reservoir, check supply deficits & analyze rainfall scarcity.',
    scenario:
      'The regional monsoon has underperformed. Reservoir storage is declining rapidly, and rural/urban water availability is shrinking.',
    objectives: [
      'Inspect the 3D surface reservoir level.',
      'Analyze the current city supply vs demand water balance.',
    ],
    hint: 'Click "Inspect Surface Reservoir" and "Analyze City Water Balance" below—or inspect the Periyar Reservoir in 3D Smart City.',
    sciencePrinciple:
      'Seasonal precipitation variability in monsoon basins creates dry-season dependence on surface reservoirs and subsurface groundwater buffers.',
    basePoints: 150,
  },
  {
    id: 'stop-leaks',
    number: 2,
    title: 'Stop the Leaks',
    subtitle: 'Find and repair underground pipeline bursts to stop non-revenue water loss.',
    scenario:
      'Pressurized distribution mains have ruptured at key junctions, wasting thousands of litres of treated water every hour.',
    objectives: [
      'Confirm no active pipeline burst remains in the network.',
      'Complete at least one pipeline leak repair to restore pressure.',
    ],
    hint: 'Click "Repair Active Burst" here or repair the trunk leak in Future Smart City / Science Lab Station 04.',
    sciencePrinciple:
      'Orifice hydraulics show that leak discharge rises with pipe pressure and crack area. Rapid isolation and pressure zoning prevent non-revenue water loss.',
    basePoints: 250,
  },
  {
    id: 'restore-groundwater',
    number: 3,
    title: 'Restore the Groundwater',
    subtitle: 'Balance over-extraction, increase permeable recharge and recover water tables.',
    scenario:
      'Unchecked borewell pumping has caused the phreatic water table to drop, threatening shallow wells and long-term aquifer reserves.',
    objectives: [
      'Reduce groundwater extraction below difficulty threshold.',
      'Stabilize subsurface recharge vs extraction balance.',
    ],
    hint: 'Lower groundwater extraction % and increase rainfall or permeable recharge area in Underground World or Mission Controls.',
    sciencePrinciple:
      'Aquifers behave as subsurface storage banks. When pumping exceeds natural percolation, hydraulic head drops and shallow wells run dry first.',
    basePoints: 300,
  },
  {
    id: 'smart-city',
    number: 4,
    title: 'Build a Water-Smart City',
    subtitle: 'Activate rainwater harvesting, wastewater recycling and demand efficiency.',
    scenario:
      'The growing city needs closed-loop urban water infrastructure combining purple-pipe recycling, rainwater harvesting, and demand moderation.',
    objectives: [
      'Raise wastewater recycling capacity to difficulty target.',
      'Keep municipal daily water balance stabilized.',
    ],
    hint: 'Increase Wastewater Recycling % and lower City Demand multiplier in Mission Controls or Smart City Console.',
    sciencePrinciple:
      'Circular urban water systems reuse treated greywater for cooling and landscaping, slashing raw freshwater intake from rivers and aquifers.',
    basePoints: 350,
  },
  {
    id: 'save-city',
    number: 5,
    title: 'Save the City',
    subtitle: 'Ultimate emergency challenge: balance total resources and protect essential services.',
    scenario:
      'Peak summer demand hits simultaneously with tight reservoir reserves. As Water Sustainability Commander, secure all integrated resilience targets.',
    objectives: [
      'All pipeline bursts sealed (zero active leaks).',
      'Positive city supply balance (> 0 ML/d).',
      'Reservoir storage and Simulated Sustainability Index at target.',
    ],
    hint: 'Ensure pipes are sealed, boost recycling ≥ 55%, keep demand reasonable, and check Reservoir Storage and Sustainability Index.',
    sciencePrinciple:
      'Integrated Water Resource Management (IWRM) coordinates surface reservoirs, aquifers, leak control, and wastewater reuse for climate resilience.',
    basePoints: 500,
  },
];

export interface MissionProgressState {
  activeStageId: MissionStageId;
  difficulty: MissionDifficulty;
  completedStages: MissionStageId[];
  score: number;
  waterSavedLitres: number;
  leaksRepaired: number;
  inspectedReservoir: boolean;
  inspectedWaterBalance: boolean;
  stageAttempts: number;
  gameStarted: boolean;
  gameCompleted: boolean;
  evaluationNote: string | null;
}

export function createDefaultMissionState(): MissionProgressState {
  return {
    activeStageId: 'drought-alert',
    difficulty: 'medium',
    completedStages: [],
    score: 0,
    waterSavedLitres: 0,
    leaksRepaired: 0,
    inspectedReservoir: false,
    inspectedWaterBalance: false,
    stageAttempts: 0,
    gameStarted: false,
    gameCompleted: false,
    evaluationNote: null,
  };
}

export interface MissionCheckItem {
  label: string;
  met: boolean;
  detail?: string;
}

export interface MissionEvaluationResult {
  passed: boolean;
  feedback: string;
  pointsEarned: number;
  checks: MissionCheckItem[];
  unmetReasons: string[];
}

export function evaluateMissionStage(
  stageId: MissionStageId,
  city: CitySimulationState,
  ug: UndergroundSimulationState,
  mission: MissionProgressState
): MissionEvaluationResult {
  const cityM = computeCityMetrics(city);
  const ugM = computeUndergroundMetrics(ug, city);
  const mgmt = computeSmartCityMgmtModel(city, ug);
  const profile = DIFFICULTY_PROFILES[mission.difficulty] ?? DIFFICULTY_PROFILES.medium;
  const stageMeta = MISSION_STAGES.find((s) => s.id === stageId) ?? MISSION_STAGES[0];
  const calcPoints = () => Math.round(stageMeta.basePoints * profile.scoreMultiplier);

  switch (stageId) {
    case 'drought-alert': {
      const checks: MissionCheckItem[] = [
        {
          label: 'Inspect Surface Reservoir level',
          met: mission.inspectedReservoir,
          detail: `${city.reservoirStoragePct}% storage`,
        },
        {
          label: 'Analyze City Supply vs Demand balance',
          met: mission.inspectedWaterBalance,
          detail: `${cityM.netBalanceMLd >= 0 ? '+' : ''}${cityM.netBalanceMLd.toFixed(1)} ML/d`,
        },
      ];
      const unmetReasons = checks.filter((c) => !c.met).map((c) => c.label);
      const passed = unmetReasons.length === 0;
      return {
        passed,
        checks,
        unmetReasons,
        feedback: passed
          ? `Diagnostic complete (${profile.label}): Reservoir is at ${city.reservoirStoragePct}% with ${city.rainfallIntensity} mm rainfall and ${cityM.netBalanceMLd.toFixed(1)} ML/d net balance.`
          : `Inspection incomplete: Please complete ${unmetReasons.join(' and ')} before advancing.`,
        pointsEarned: passed ? calcPoints() : 0,
      };
    }

    case 'stop-leaks': {
      const noActiveLeak = !city.leak.active;
      const repairedAtLeastOnce = city.leak.repairedCount > 0 || mission.leaksRepaired > 0;
      const checks: MissionCheckItem[] = [
        {
          label: 'All distribution trunk bursts sealed',
          met: noActiveLeak,
          detail: noActiveLeak ? 'Sealed' : `${city.leak.severityLph.toLocaleString()} L/hr leak active`,
        },
        {
          label: 'Verified pipeline repair executed',
          met: repairedAtLeastOnce,
          detail: `${Math.max(city.leak.repairedCount, mission.leaksRepaired)} repair(s)`,
        },
      ];
      const unmetReasons = checks.filter((c) => !c.met).map((c) => c.label);
      const passed = unmetReasons.length === 0;
      return {
        passed,
        checks,
        unmetReasons,
        feedback: passed
          ? `Pipeline bursts sealed! Network efficiency improved to ${cityM.distributionEfficiencyPct.toFixed(1)}%, preventing major treated-water loss.`
          : city.leak.active
            ? `Active pipeline burst (${city.leak.severityLph.toLocaleString()} L/hr) is still wasting treated water. Repair the leak to pass Mission 2.`
            : 'No leak repair has been verified yet. Run a leak inspection/repair cycle to validate sealing.',
        pointsEarned: passed ? calcPoints() : 0,
      };
    }

    case 'restore-groundwater': {
      const maxExt = profile.thresholds.maxExtractionPct;
      const minBal = profile.thresholds.minNetBalanceUg;
      const extOk = city.groundwaterExtractionPct <= maxExt;
      const balOk = ugM.netBalanceMLd >= minBal;
      const checks: MissionCheckItem[] = [
        {
          label: `Groundwater extraction ≤ ${maxExt}%`,
          met: extOk,
          detail: `Current ${city.groundwaterExtractionPct}%`,
        },
        {
          label: `Aquifer net balance ≥ ${minBal >= 0 ? '+' : ''}${minBal.toFixed(1)} ML/d`,
          met: balOk,
          detail: `Current ${ugM.netBalanceMLd >= 0 ? '+' : ''}${ugM.netBalanceMLd.toFixed(1)} ML/d`,
        },
      ];
      const unmetReasons = checks.filter((c) => !c.met).map((c) => `${c.label} (${c.detail})`);
      const passed = unmetReasons.length === 0;
      return {
        passed,
        checks,
        unmetReasons,
        feedback: passed
          ? `Aquifer pumping stabilized (${city.groundwaterExtractionPct}% extraction, ${ugM.netBalanceMLd >= 0 ? '+' : ''}${ugM.netBalanceMLd.toFixed(1)} ML/d recharge balance).`
          : `Targets not met: ${unmetReasons.join('; ')}. Lower extraction or raise recharge area / rainfall.`,
        pointsEarned: passed ? calcPoints() : 0,
      };
    }

    case 'smart-city': {
      const minRecycle = profile.thresholds.minRecyclingPct;
      const minCityBal = profile.thresholds.minCityBalance;
      const recycleOk = city.recyclingCapacityPct >= minRecycle;
      const balOk = cityM.netBalanceMLd >= minCityBal;
      const checks: MissionCheckItem[] = [
        {
          label: `Wastewater recycling ≥ ${minRecycle}%`,
          met: recycleOk,
          detail: `Current ${city.recyclingCapacityPct}%`,
        },
        {
          label: `City water balance ≥ ${minCityBal >= 0 ? '+' : ''}${minCityBal.toFixed(1)} ML/d`,
          met: balOk,
          detail: `Current ${cityM.netBalanceMLd >= 0 ? '+' : ''}${cityM.netBalanceMLd.toFixed(1)} ML/d`,
        },
      ];
      const unmetReasons = checks.filter((c) => !c.met).map((c) => `${c.label} (${c.detail})`);
      const passed = unmetReasons.length === 0;
      return {
        passed,
        checks,
        unmetReasons,
        feedback: passed
          ? `Circular urban infrastructure active (${city.recyclingCapacityPct}% recycling, ${cityM.recycledSupplyMLd.toFixed(1)} ML/d reclaimed).`
          : `Optimization needed: ${unmetReasons.join('; ')}.`,
        pointsEarned: passed ? calcPoints() : 0,
      };
    }

    case 'save-city': {
      const noLeak = !city.leak.active;
      const positiveBal = cityM.netBalanceMLd > 0;
      const resOk = city.reservoirStoragePct >= profile.thresholds.finalMinReservoirPct;
      const ssiOk = mgmt.sustainabilityIndicator >= profile.thresholds.finalMinSsi;
      const checks: MissionCheckItem[] = [
        {
          label: 'Zero active pipeline leaks',
          met: noLeak,
          detail: noLeak ? 'Sealed' : 'Burst active',
        },
        {
          label: 'Positive city water balance (> 0 ML/d)',
          met: positiveBal,
          detail: `${cityM.netBalanceMLd >= 0 ? '+' : ''}${cityM.netBalanceMLd.toFixed(1)} ML/d`,
        },
        {
          label: `Reservoir storage ≥ ${profile.thresholds.finalMinReservoirPct}%`,
          met: resOk,
          detail: `${city.reservoirStoragePct}%`,
        },
        {
          label: `Simulated Sustainability Index ≥ ${profile.thresholds.finalMinSsi}/100`,
          met: ssiOk,
          detail: `${mgmt.sustainabilityIndicator}/100`,
        },
      ];
      const unmetReasons = checks.filter((c) => !c.met).map((c) => `${c.label} (${c.detail})`);
      const passed = unmetReasons.length === 0;
      return {
        passed,
        checks,
        unmetReasons,
        feedback: passed
          ? `MISSION ACCOMPLISHED (${profile.label})! City Sustainability Index reached ${mgmt.sustainabilityIndicator}/100 with +${cityM.netBalanceMLd.toFixed(1)} ML/d positive water balance.`
          : `Final resilience targets unmet: ${unmetReasons.join('; ')}.`,
        pointsEarned: passed ? calcPoints() : 0,
      };
    }
  }
}
