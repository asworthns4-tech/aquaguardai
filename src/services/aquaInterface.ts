import { EARTH_OVERLAYS, EARTH_REGIONS, GLOBAL_WATER_BUDGET } from '../data/earthWaterData';
import { LAB_EXPERIMENTS_BY_ID, LabExperimentId } from '../data/labExperimentsData';
import { CITY_ENTITIES, WASTEWATER_STAGES } from '../data/smartCityData';
import { CONTAMINATION_SCENARIOS, UNDERGROUND_ENTITIES } from '../data/undergroundData';
import {
  ActionExecutionResult,
  DeviceInterfaceStatus,
  ExhibitionState,
  RegisteredActionName,
} from '../types/exhibition';
import { ACTION_CATALOG, ActionCatalogEntry } from './actionRegistry';
import { computeLabComparison, computeLabExperimentOutput } from './labSimulationEngine';
import { MISSION_STAGES, evaluateMissionStage } from './missionEngine';
import { PRESENTATION_CHAPTERS } from './presentationEngine';
import { resolveRegisteredObject } from './objectRegistry';
import { computeIntegratedWaterBalance } from './simulationEngine';

export interface AquaStateSnapshot {
  currentScene: ExhibitionState['currentScene'];
  previousScene: ExhibitionState['previousScene'];
  exhibitionMode: boolean;
  selectedObject: ExhibitionState['selectedObject'];
  earthOverlay: ExhibitionState['earthOverlay'];
  camera: {
    zoomLevelPct: number;
    distance: number;
    presetId: string;
    autoRotate: boolean;
  };
  gesture: {
    enabled: boolean;
    paused: boolean;
    cameraActive: boolean;
    currentGesture: ExhibitionState['gesture']['currentGesture'];
  };
  simulation: {
    running: boolean;
    speed: number;
    activeSim: string | null;
  };
  city: {
    population: number;
    rainfallIntensityMm: number;
    demandMultiplier: number;
    reservoirStoragePct: number;
    recyclingCapacityPct: number;
    groundwaterExtractionPct: number;
    pipelinePressureBar: number;
    leakActive: boolean;
    leakLocationId: string;
    leakSeverityLph: number;
  };
  underground: {
    waterTableDepthM: number;
    soilPermeability: string;
    rechargeAreaPct: number;
    demoPhase: string;
    activeWells: string[];
    contaminationActive: boolean;
    contaminationSource: string;
  };
  lab: {
    activeExperiment: LabExperimentId;
    experimentTitle: string;
    learnScienceOpen: boolean;
    headlineStatus: string;
    metrics: Array<{ label: string; value: string; unit: string }>;
    beforeAfterSummary: string;
    waterCycle: ExhibitionState['lab']['waterCycle'];
    filtration: ExhibitionState['lab']['filtration'];
    desalination: ExhibitionState['lab']['desalination'];
    supplyDemandExtra: ExhibitionState['lab']['supplyDemandExtra'];
  };
  mission: {
    activeStageId: ExhibitionState['mission']['activeStageId'];
    difficulty: ExhibitionState['mission']['difficulty'];
    completedStages: ExhibitionState['mission']['completedStages'];
    score: number;
    waterSavedLitres: number;
    leaksRepaired: number;
    gameStarted: boolean;
    gameCompleted: boolean;
  };
  presentation: {
    active: boolean;
    activeChapterIndex: number;
    activeChapterTitle: string;
    isPlaying: boolean;
  };
  computedMetrics: ReturnType<typeof computeIntegratedWaterBalance>;
  allowlistedActions: Pick<
    ActionCatalogEntry,
    'name' | 'category' | 'description' | 'permittedScenes'
  >[];
  lastFeedback: ExhibitionState['interaction']['actionFeedback'];
}

export interface AquaEducationalContext {
  sceneTitle: string;
  selectionContext: {
    id: string;
    canonicalId?: string;
    name: string;
    summary: string;
    scienceNote: string;
    connectedSystems: string[];
  } | null;
  activeModuleFacts: string[];
  dataDisclaimer: string;
}

export type AquaActionDispatcher = (
  actionName: RegisteredActionName,
  params?: Record<string, unknown>
) => ActionExecutionResult;

export function detectVoiceCapabilities(): {
  speechRecognitionAvailable: boolean;
  speechSynthesisAvailable: boolean;
  recommendedStatus: DeviceInterfaceStatus;
} {
  if (typeof window === 'undefined') {
    return {
      speechRecognitionAvailable: false,
      speechSynthesisAvailable: false,
      recommendedStatus: 'unavailable',
    };
  }
  const win = window as unknown as Record<string, unknown>;
  const speechRecognitionAvailable = Boolean(
    win.SpeechRecognition || win.webkitSpeechRecognition
  );
  const speechSynthesisAvailable = 'speechSynthesis' in window;
  return {
    speechRecognitionAvailable,
    speechSynthesisAvailable,
    recommendedStatus: speechRecognitionAvailable || speechSynthesisAvailable ? 'ready' : 'unavailable',
  };
}

export function getAquaStateSnapshot(state: ExhibitionState): AquaStateSnapshot {
  const computedMetrics = computeIntegratedWaterBalance(state);
  return {
    currentScene: state.currentScene,
    previousScene: state.previousScene,
    exhibitionMode: state.exhibitionMode,
    selectedObject: state.selectedObject,
    earthOverlay: state.earthOverlay,
    camera: {
      zoomLevelPct: state.camera.zoomLevelPct,
      distance: state.camera.distance,
      presetId: state.camera.presetId,
      autoRotate: state.camera.autoRotate,
    },
    gesture: {
      enabled: state.gesture.enabled,
      paused: state.gesture.paused,
      cameraActive: state.gesture.cameraActive,
      currentGesture: state.gesture.currentGesture,
    },
    simulation: {
      running: state.simulationParams.running,
      speed: state.simulationParams.speed,
      activeSim: state.simulationParams.activeSim,
    },
    city: {
      population: state.city.population,
      rainfallIntensityMm: state.city.rainfallIntensity,
      demandMultiplier: state.city.demandMultiplier,
      reservoirStoragePct: state.city.reservoirStoragePct,
      recyclingCapacityPct: state.city.recyclingCapacityPct,
      groundwaterExtractionPct: state.city.groundwaterExtractionPct,
      pipelinePressureBar: state.city.pipelinePressureBar,
      leakActive: state.city.leak.active,
      leakLocationId: state.city.leak.locationId,
      leakSeverityLph: state.city.leak.severityLph,
    },
    underground: {
      waterTableDepthM: state.underground.waterTableDepthM,
      soilPermeability: state.underground.soilPermeability,
      rechargeAreaPct: state.underground.rechargeAreaPct,
      demoPhase: state.underground.demoPhase,
      activeWells: state.underground.wells.filter((w) => w.active).map((w) => w.id),
      contaminationActive: state.underground.contamination.active,
      contaminationSource: state.underground.contamination.sourceType,
    },
    lab: (() => {
      const meta = LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment];
      const out = computeLabExperimentOutput(state.lab.activeExperiment, state);
      const cmp = computeLabComparison(state.lab.activeExperiment, state);
      return {
        activeExperiment: state.lab.activeExperiment,
        experimentTitle: meta.title,
        learnScienceOpen: state.lab.learnScienceOpen,
        headlineStatus: out.headlineStatus,
        metrics: out.cards.map((c) => ({ label: c.label, value: c.value, unit: c.unit })),
        beforeAfterSummary: cmp.summaryText,
        waterCycle: state.lab.waterCycle,
        filtration: state.lab.filtration,
        desalination: state.lab.desalination,
        supplyDemandExtra: state.lab.supplyDemandExtra,
      };
    })(),
    mission: {
      activeStageId: state.mission.activeStageId,
      difficulty: state.mission.difficulty,
      completedStages: state.mission.completedStages,
      score: state.mission.score,
      waterSavedLitres: state.mission.waterSavedLitres,
      leaksRepaired: state.mission.leaksRepaired,
      gameStarted: state.mission.gameStarted,
      gameCompleted: state.mission.gameCompleted,
    },
    presentation: {
      active: state.presentation.active,
      activeChapterIndex: state.presentation.activeChapterIndex,
      activeChapterTitle:
        (PRESENTATION_CHAPTERS[state.presentation.activeChapterIndex] ?? PRESENTATION_CHAPTERS[0])
          .title,
      isPlaying: state.presentation.isPlaying,
    },
    computedMetrics,
    allowlistedActions: ACTION_CATALOG.map(({ name, category, description, permittedScenes }) => ({
      name,
      category,
      description,
      permittedScenes,
    })),
    lastFeedback: state.interaction.actionFeedback,
  };
}

export function getAquaEducationalContext(state: ExhibitionState): AquaEducationalContext {
  const sel = state.selectedObject;
  let selectionContext: AquaEducationalContext['selectionContext'] = null;

  if (sel) {
    const reg = resolveRegisteredObject(sel.canonicalId ?? sel.id, state.currentScene);
    const earthRegion = EARTH_REGIONS.find((r) => r.id === (sel.regionId ?? sel.id));
    const cityEnt = CITY_ENTITIES.find((c) => c.id === sel.id);
    const ugEnt = UNDERGROUND_ENTITIES.find((u) => u.id === sel.id);
    const well = state.underground.wells.find((w) => w.id === sel.id);

    if (earthRegion) {
      selectionContext = {
        id: earthRegion.id,
        canonicalId: reg?.canonicalId,
        name: earthRegion.name,
        summary: earthRegion.summary,
        scienceNote: earthRegion.scienceHighlight,
        connectedSystems: reg?.connectedIds ?? [],
      };
    } else if (cityEnt) {
      selectionContext = {
        id: cityEnt.id,
        canonicalId: reg?.canonicalId,
        name: cityEnt.name,
        summary: cityEnt.summary,
        scienceNote: cityEnt.scienceExplanation,
        connectedSystems: reg?.connectedIds ?? [],
      };
    } else if (ugEnt) {
      selectionContext = {
        id: ugEnt.id,
        canonicalId: reg?.canonicalId,
        name: ugEnt.name,
        summary: ugEnt.summary,
        scienceNote: ugEnt.scienceExplanation,
        connectedSystems: reg?.connectedIds ?? [],
      };
    } else if (well) {
      selectionContext = {
        id: well.id,
        canonicalId: reg?.canonicalId,
        name: well.name,
        summary: `${well.wellType === 'shallow' ? 'Shallow open well' : 'Deep borewell'} at ${well.depthM} m depth serving ${well.connectedCityLabel}.`,
        scienceNote: `Draws from ${well.aquiferTarget} aquifer at ${well.extractionLph.toLocaleString()} L/hr.`,
        connectedSystems: reg?.connectedIds ?? [],
      };
    } else if (reg && (reg.type === 'lab-equipment' || reg.type === 'lab-station')) {
      selectionContext = {
        id: reg.internalId,
        canonicalId: reg.canonicalId,
        name: reg.name,
        summary: reg.educationalSummary,
        scienceNote: `Active lab experiment: ${LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment].title}`,
        connectedSystems: reg.connectedIds,
      };
    }
  }

  const activeModuleFacts: string[] = [];
  if (state.currentScene === 'earth') {
    activeModuleFacts.push(
      `Global budget: ${GLOBAL_WATER_BUDGET.saltwaterPercent}% saline, ${GLOBAL_WATER_BUDGET.freshwaterPercent}% freshwater.`,
      EARTH_OVERLAYS[state.earthOverlay].scienceFact
    );
  } else if (state.currentScene === 'city') {
    const stage = WASTEWATER_STAGES[state.city.activeRecyclingStage];
    activeModuleFacts.push(
      `Active recycling step ${stage.step}/7: ${stage.name} (${stage.recoveryYieldPct}% yield).`,
      `Urban rainwater equation: Collected (L) = Rainfall (mm) × Roof Area (m²) × Runoff Coeff.`
    );
  } else if (state.currentScene === 'underground') {
    const cont = CONTAMINATION_SCENARIOS[state.underground.contamination.sourceType];
    activeModuleFacts.push(
      `Current water table depth: ${state.underground.waterTableDepthM.toFixed(1)} m.`,
      state.underground.contamination.active
        ? `Active plume scenario: ${cont.title} — ${cont.prevention}`
        : `Clay aquitard (18–23 m) separates shallow unconfined gravel from deep confined sandstone.`
    );
  } else if (state.currentScene === 'lab' || state.currentScene === 'simulations') {
    const exp = LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment];
    const out = computeLabExperimentOutput(state.lab.activeExperiment, state);
    activeModuleFacts.push(
      `Active Experiment ${exp.number}: ${exp.title} — ${out.headlineStatus}`,
      `Formula: ${exp.formulaDisplay}`,
      exp.safetyNotice ?? exp.disclaimer
    );
  } else if (state.currentScene === 'mission') {
    const stageMeta =
      MISSION_STAGES.find((s) => s.id === state.mission.activeStageId) ?? MISSION_STAGES[0];
    const evalPreview = evaluateMissionStage(
      state.mission.activeStageId,
      state.city,
      state.underground,
      state.mission
    );
    activeModuleFacts.push(
      `Active Mission Stage ${stageMeta.number}/5: ${stageMeta.title} (${state.mission.difficulty} difficulty).`,
      `Score: ${state.mission.score} pts · Cleared: ${state.mission.completedStages.length}/5 · Current Check: ${evalPreview.passed ? 'Ready to pass' : evalPreview.unmetReasons.join(', ')}`
    );
  } else if (state.currentScene === 'exhibition') {
    const ch =
      PRESENTATION_CHAPTERS[state.presentation.activeChapterIndex] ?? PRESENTATION_CHAPTERS[0];
    activeModuleFacts.push(
      `Presentation Chapter ${ch.number + 1}/${PRESENTATION_CHAPTERS.length}: ${ch.title}.`,
      ch.scienceNote
    );
  }

  return {
    sceneTitle:
      state.currentScene === 'earth'
        ? 'Earth Water Explorer'
        : state.currentScene === 'city'
          ? 'Future Smart City'
          : state.currentScene === 'underground'
            ? 'Underground Water World'
            : state.currentScene === 'lab'
              ? 'AQUA Science Lab'
              : state.currentScene === 'simulations'
                ? 'Water Simulations Workbench'
                : state.currentScene === 'mission'
                  ? 'Save the City Mission Command'
                  : state.currentScene === 'exhibition'
                    ? 'Exhibition Presentation Mode'
                    : `Module: ${state.currentScene}`,
    selectionContext,
    activeModuleFacts,
    dataDisclaimer:
      'All dynamic simulation readings are illustrative educational models, not live sensor measurements.',
  };
}

export function createAquaBridge(
  state: ExhibitionState,
  dispatchAction: (
    actionName: RegisteredActionName,
    params?: Record<string, unknown>,
    source?: 'aqua'
  ) => ActionExecutionResult
) {
  return {
    getState: () => getAquaStateSnapshot(state),
    getEducationalContext: () => getAquaEducationalContext(state),
    submitAction: (
      actionName: RegisteredActionName,
      params: Record<string, unknown> = {}
    ): ActionExecutionResult => {
      return dispatchAction(actionName, params, 'aqua');
    },
  };
}
