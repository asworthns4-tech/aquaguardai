import React, { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import {
  ActionExecutionResult,
  ActionLogEntry,
  AppCommand,
  CitySimulationState,
  ExhibitionAction,
  ExhibitionState,
  InteractionSource,
  RegisteredActionName,
  SceneId,
  UndergroundSimulationState,
} from '../types/exhibition';
import { LAB_EXPERIMENTS, LabExperimentId } from '../data/labExperimentsData';
import {
  buildLabBaselineSnapshot,
  createDefaultLabStateParams,
  stepActiveLabState,
} from '../services/labSimulationEngine';
import {
  WATER_SCIENCE_CONSTANTS,
  clampValue,
  computeUndergroundMetrics,
  stepWaterTableDepth,
  syncCityExtractionFromWells,
} from '../services/simulationEngine';
import { resolveRegisteredObject, toSelectedObjectInfo } from '../services/objectRegistry';
import { executeRegisteredAction } from '../services/actionRegistry';
import { createAquaBridge, detectVoiceCapabilities } from '../services/aquaInterface';
import { createGestureBridge, detectGestureCapabilities } from '../services/gestureInterface';
import { createDefaultMissionState } from '../services/missionEngine';
import { PRESENTATION_CHAPTERS } from '../services/presentationEngine';

export const DEFAULT_CAMERA_DISTANCE = 3.15;
export const MIN_CAMERA_DISTANCE = 1.65;
export const MAX_CAMERA_DISTANCE = 5.4;

const INITIAL_CITY_STATE: CitySimulationState = {
  rainfallIntensity: 48,
  population: 165000,
  demandMultiplier: 1.0,
  reservoirStoragePct: 72,
  recyclingCapacityPct: 48,
  pipelinePressureBar: 4.2,
  baseLeakageRatePct: 12,
  groundwaterExtractionPct: 34,
  leak: {
    active: false,
    locationId: 'pipe-distribution',
    severityLph: 14500,
    accumulatedLossLitres: 0,
    repairedCount: 0,
    lastBeforeLossLph: 0,
  },
  rainwater: {
    rainfallMm: 50,
    roofAreaM2: 400,
    runoffCoeff: 0.85,
    tankCapacityLitres: 25000,
    tankStoredLitres: 8500,
  },
  buildingDemandOverrides: {},
  activeRecyclingStage: 3,
  resolvedEmergencies: [],
  activeTab: 'dashboard',
  cityCameraPreset: 'overview',
  cityCameraFlyVersion: 0,
  cityZoomDelta: 0,
  cityZoomVersion: 0,
  cityAutoRotate: false,
};

const INITIAL_UNDERGROUND_STATE: UndergroundSimulationState = {
  initialWaterTableDepthM: 10.5,
  waterTableDepthM: 10.5,
  soilPermeability: 'high',
  rechargeAreaPct: 60,
  simulationSpeed: 1,
  demoPhase: 'normal',
  wells: [
    {
      id: 'well-shallow-west',
      name: 'Veridian Shallow Open Well',
      wellType: 'shallow',
      depthM: 14.0,
      active: true,
      extractionLph: 55000,
      aquiferTarget: 'unconfined',
      connectedCityEntityId: 'res-district-west',
      connectedCityLabel: 'Veridian Eco-Residences',
      position: [-5.6, 3.2],
    },
    {
      id: 'borewell-central',
      name: 'AquaSpire Deep Borewell',
      wellType: 'borewell',
      depthM: 34.0,
      active: true,
      extractionLph: 115000,
      aquiferTarget: 'confined',
      connectedCityEntityId: 'sky-tower-alpha',
      connectedCityLabel: 'AquaSpire & Civic District',
      position: [0.4, -0.8],
    },
    {
      id: 'borewell-east',
      name: 'Harborview Municipal Borewell',
      wellType: 'borewell',
      depthM: 29.0,
      active: false,
      extractionLph: 95000,
      aquiferTarget: 'confined',
      connectedCityEntityId: 'res-district-east',
      connectedCityLabel: 'Harborview Apartments',
      position: [7.6, -1.6],
    },
  ],
  contamination: {
    active: false,
    sourceType: 'agricultural',
    plumeIntensity: 0.7,
  },
  activeTab: 'inspect',
  undergroundCameraPreset: 'overview',
  undergroundCameraFlyVersion: 0,
  undergroundZoomDelta: 0,
  undergroundZoomVersion: 0,
  undergroundAutoRotate: false,
};

function computeEarthZoomPct(distance: number): number {
  const ratio = (MAX_CAMERA_DISTANCE - distance) / (MAX_CAMERA_DISTANCE - MIN_CAMERA_DISTANCE);
  return Math.round(clampValue(ratio * 100, 0, 100));
}

const INITIAL_LAB_STATE = {
  ...createDefaultLabStateParams(),
  baselines: {},
};

const BASE_INITIAL_STATE: ExhibitionState = {
  currentScene: 'earth',
  previousScene: null,
  selectedObject: null,
  camera: {
    activeCameraId: 'earth-orbit-cam',
    position: [0.7, 0.85, 2.95],
    rotation: [-0.28, 0.22, 0],
    targetLat: 16,
    targetLon: 76,
    distance: DEFAULT_CAMERA_DISTANCE,
    zoomLevelPct: computeEarthZoomPct(DEFAULT_CAMERA_DISTANCE),
    autoRotate:
      typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        ? false
        : true,
    rotationSpeed: 0.14,
    presetId: 'global',
    flyToVersion: 0,
  },
  earthOverlay: 'water-availability',
  earthLayers: {
    showOverlay: false,
    showClouds: true,
    showNightLights: true,
    showGrid: false,
    showBoundaries: true,
  },
  earthSurfacePoint: null,
  selectedGeography: null,
  earthExplorerFocus: 'overview',
  leftNavOpen: typeof window !== 'undefined' ? window.innerWidth >= 1024 : true,
  simulationParams: {
    demand: 100,
    rainfall: 48,
    storage: 72,
    recycling: 48,
    activeSim: 'hydrology-live',
    running: true,
    speed: 1,
  },
  city: INITIAL_CITY_STATE,
  underground: INITIAL_UNDERGROUND_STATE,
  lab: INITIAL_LAB_STATE,
  interactionMode: 'mouse',
  interaction: {
    currentSource: 'system',
    voiceStatus: 'idle',
    gestureStatus: 'idle',
    selectedControlMode: 'mouse',
    currentAction: null,
    actionFeedback: null,
    actionHistory: [],
  },
  gesture: {
    enabled: false,
    paused: false,
    panelOpen: false,
    tutorialOpen: false,
    tutorialCompleted: false,
    cameraPermission: 'idle',
    cameraActive: false,
    modelStatus: 'idle',
    errorMessage: null,
    handDetected: false,
    handCount: 0,
    handedness: null,
    palmActive: false,
    currentGesture: 'none',
    gestureLabel: 'Camera Off',
    confidence: 0,
    sensitivity: 1.0,
    twoHandEnabled: false,
    pinchBaseline: 0.38,
    neutralPalmOrigin: null,
    trackingLost: false,
    pointerCursor: {
      active: false,
      x: 0.5,
      y: 0.5,
      dwellProgress: 0,
      triggerCount: 0,
      hoveredLabel: null,
    },
    orbitStep: { yawDelta: 0, pitchDelta: 0, version: 0 },
  },
  aqua: {
    panelOpen: false,
    minimized: false,
    language: 'en',
    ttsEnabled: true,
    autoSendVoice: true,
    status: 'idle',
    aiMode: 'offline-demo',
    aiReason: 'Checking AI brain availability…',
    transcriptInterim: '',
    lastVoiceTranscript: '',
    transcriptConfidence: null,
    micPermission: 'idle',
    micSupported: false,
    ttsSupported: false,
    ttsLanguageSupported: true,
    lastDiscussedTopic: null,
    lastModifiedParam: null,
    pendingConfirmation: null,
    messages: [
      {
        id: 'aqua-welcome-1',
        role: 'aqua',
        text: 'Hello! I am AQUA, your water-science exhibition guide and facility controller. Ask me any hydrological question or tell me to navigate scenes, inspect objects, or adjust simulations.',
        language: 'en',
        timestamp: Date.now(),
      },
    ],
  },
  controlsCollapsed: false,
  infoPanelOpen: true,
  exhibitionMode: false,
  debugPanelOpen: false,
  mission: createDefaultMissionState(),
  presentation: {
    active: false,
    activeChapterIndex: 0,
    isPlaying: false,
    narrationActive: false,
    showTextNarration: true,
    welcomeModalOpen: false,
  },
};

function buildInitialBaselines(): Partial<
  Record<LabExperimentId, ReturnType<typeof buildLabBaselineSnapshot>>
> {
  const map: Partial<Record<LabExperimentId, ReturnType<typeof buildLabBaselineSnapshot>>> = {};
  for (const exp of LAB_EXPERIMENTS) {
    map[exp.id] = buildLabBaselineSnapshot(exp.id, BASE_INITIAL_STATE, 'Initial Baseline');
  }
  return map;
}

export const INITIAL_STATE: ExhibitionState = {
  ...BASE_INITIAL_STATE,
  lab: {
    ...INITIAL_LAB_STATE,
    baselines: buildInitialBaselines(),
  },
};

function clampDistance(d: number): number {
  return Math.max(MIN_CAMERA_DISTANCE, Math.min(MAX_CAMERA_DISTANCE, d));
}

function getCameraIdForScene(scene: SceneId): string {
  if (scene === 'earth') return 'earth-orbit-cam';
  if (scene === 'city') return 'smart-city-cam';
  if (scene === 'underground') return 'underground-cutaway-cam';
  if (scene === 'lab') return 'science-lab-cam';
  return `${scene}-view-cam`;
}

export function exhibitionReducer(state: ExhibitionState, action: ExhibitionAction): ExhibitionState {
  switch (action.type) {
    case 'SET_SCENE':
      if (state.currentScene === action.scene) return state;
      return {
        ...state,
        previousScene: state.currentScene,
        currentScene: action.scene,
        selectedObject: null,
        infoPanelOpen: true,
        camera: {
          ...state.camera,
          activeCameraId: getCameraIdForScene(action.scene),
        },
        exhibitionMode: action.scene === 'exhibition' ? true : state.exhibitionMode,
        debugPanelOpen: action.scene === 'exhibition' ? false : state.debugPanelOpen,
      };
    case 'SELECT_OBJECT': {
      let enriched = action.object;
      if (enriched && !enriched.canonicalId) {
        const reg = resolveRegisteredObject(enriched.id, state.currentScene);
        if (reg) {
          enriched = { ...enriched, canonicalId: reg.canonicalId };
        }
      }
      return {
        ...state,
        selectedObject: enriched,
        earthSurfacePoint: enriched && state.currentScene === 'earth' ? null : state.earthSurfacePoint,
        infoPanelOpen: enriched ? true : state.infoPanelOpen,
        city:
          enriched && state.currentScene === 'city'
            ? { ...state.city, activeTab: 'inspect' }
            : state.city,
        underground:
          enriched && state.currentScene === 'underground'
            ? { ...state.underground, activeTab: 'inspect' }
            : state.underground,
        mission:
          enriched?.id === 'city-reservoir' && state.mission.gameStarted
            ? { ...state.mission, inspectedReservoir: true }
            : state.mission,
      };
    }
    case 'FOCUS_COORDINATES': {
      const dist = clampDistance(action.distance ?? 2.25);
      return {
        ...state,
        camera: {
          ...state.camera,
          activeCameraId: 'earth-orbit-cam',
          targetLat: action.lat,
          targetLon: action.lon,
          distance: dist,
          zoomLevelPct: computeEarthZoomPct(dist),
          autoRotate: false,
          presetId: action.presetId ?? 'custom',
          flyToVersion: state.camera.flyToVersion + 1,
        },
      };
    }
    case 'SET_CAMERA_DISTANCE': {
      const dist = clampDistance(action.distance);
      return {
        ...state,
        camera: {
          ...state.camera,
          distance: dist,
          zoomLevelPct: computeEarthZoomPct(dist),
        },
      };
    }
    case 'SYNC_CAMERA_TELEMETRY':
      return {
        ...state,
        camera: {
          ...state.camera,
          activeCameraId: action.activeCameraId,
          position: action.position,
          rotation: action.rotation,
          zoomLevelPct: action.zoomLevelPct ?? state.camera.zoomLevelPct,
        },
      };
    case 'ZOOM_BY':
      if (state.currentScene === 'city') {
        return {
          ...state,
          city: {
            ...state.city,
            cityZoomDelta: action.delta * 6,
            cityZoomVersion: state.city.cityZoomVersion + 1,
          },
        };
      }
      if (state.currentScene === 'underground') {
        return {
          ...state,
          underground: {
            ...state.underground,
            undergroundZoomDelta: action.delta * 5,
            undergroundZoomVersion: state.underground.undergroundZoomVersion + 1,
          },
        };
      }
      if (state.currentScene === 'lab') {
        return {
          ...state,
          lab: {
            ...state.lab,
            labZoomDelta: action.delta * 3.5,
            labZoomVersion: state.lab.labZoomVersion + 1,
          },
        };
      }
      {
        const dist = clampDistance(state.camera.distance + action.delta);
        return {
          ...state,
          camera: {
            ...state.camera,
            distance: dist,
            zoomLevelPct: computeEarthZoomPct(dist),
          },
        };
      }
    case 'TOGGLE_AUTO_ROTATE':
      if (state.currentScene === 'city') {
        return {
          ...state,
          city: {
            ...state.city,
            cityAutoRotate:
              action.value !== undefined ? action.value : !state.city.cityAutoRotate,
          },
        };
      }
      if (state.currentScene === 'underground') {
        return {
          ...state,
          underground: {
            ...state.underground,
            undergroundAutoRotate:
              action.value !== undefined
                ? action.value
                : !state.underground.undergroundAutoRotate,
          },
        };
      }
      if (state.currentScene === 'lab') {
        return {
          ...state,
          lab: {
            ...state.lab,
            labAutoRotate:
              action.value !== undefined ? action.value : !state.lab.labAutoRotate,
          },
        };
      }
      return {
        ...state,
        camera: {
          ...state.camera,
          autoRotate: action.value !== undefined ? action.value : !state.camera.autoRotate,
        },
      };
    case 'SET_ROTATION_SPEED':
      return {
        ...state,
        camera: {
          ...state.camera,
          rotationSpeed: action.speed,
        },
      };
    case 'RESET_CAMERA':
      if (state.currentScene === 'city') {
        return {
          ...state,
          selectedObject: null,
          city: {
            ...state.city,
            cityCameraPreset: 'overview',
            cityCameraFlyVersion: state.city.cityCameraFlyVersion + 1,
          },
        };
      }
      if (state.currentScene === 'underground') {
        return {
          ...state,
          selectedObject: null,
          underground: {
            ...state.underground,
            undergroundCameraPreset: 'overview',
            undergroundCameraFlyVersion: state.underground.undergroundCameraFlyVersion + 1,
          },
        };
      }
      if (state.currentScene === 'lab') {
        return {
          ...state,
          selectedObject: null,
          lab: {
            ...state.lab,
            labCameraFlyVersion: state.lab.labCameraFlyVersion + 1,
          },
        };
      }
      return {
        ...state,
        selectedObject: null,
        earthSurfacePoint: null,
        selectedGeography: null,
        camera: {
          ...INITIAL_STATE.camera,
          flyToVersion: state.camera.flyToVersion + 1,
        },
      };
    case 'SET_EARTH_OVERLAY':
      return {
        ...state,
        earthOverlay: action.overlay,
        earthLayers: {
          ...state.earthLayers,
          showOverlay: action.showOverlay ?? true,
        },
      };
    case 'UPDATE_EARTH_LAYERS':
      return {
        ...state,
        earthLayers: {
          ...state.earthLayers,
          ...action.patch,
        },
      };
    case 'SET_EARTH_SURFACE_POINT':
      return {
        ...state,
        selectedObject: action.point ? null : state.selectedObject,
        selectedGeography: action.point ? null : state.selectedGeography,
        earthSurfacePoint: action.point,
        infoPanelOpen: action.point ? true : state.infoPanelOpen,
        camera: action.point
          ? {
              ...state.camera,
              targetLat: action.point.lat,
              targetLon: action.point.lon,
            }
          : state.camera,
      };
    case 'SELECT_GEOGRAPHY':
      return {
        ...state,
        selectedGeography: action.geography,
        selectedObject: action.geography ? null : state.selectedObject,
        earthSurfacePoint: action.geography ? null : state.earthSurfacePoint,
        infoPanelOpen: action.geography ? true : state.infoPanelOpen,
        camera: action.geography
          ? {
              ...state.camera,
              targetLat: action.geography.lat,
              targetLon: action.geography.lon,
            }
          : state.camera,
      };
    case 'SET_EARTH_EXPLORER_FOCUS':
      return {
        ...state,
        earthExplorerFocus: action.focus,
        selectedObject: null,
        earthSurfacePoint: null,
        infoPanelOpen: true,
      };
    case 'SET_LEFT_NAV_OPEN':
      return {
        ...state,
        leftNavOpen: action.open !== undefined ? action.open : !state.leftNavOpen,
      };
    case 'UPDATE_SIMULATION_PARAMS':
      return {
        ...state,
        simulationParams: {
          ...state.simulationParams,
          ...action.params,
        },
      };
    case 'SET_SIMULATION_RUNNING':
      return {
        ...state,
        simulationParams: {
          ...state.simulationParams,
          running: action.running,
        },
        underground: {
          ...state.underground,
          simulationSpeed: action.running ? Math.max(0.5, state.simulationParams.speed || 1) : 0,
        },
      };
    case 'SET_SIMULATION_SPEED':
      return {
        ...state,
        simulationParams: {
          ...state.simulationParams,
          running: action.speed > 0,
          speed: action.speed > 0 ? action.speed : state.simulationParams.speed,
        },
        underground: {
          ...state.underground,
          simulationSpeed: action.speed,
        },
      };
    case 'RESET_ALL_SIMULATIONS':
      return {
        ...state,
        selectedObject: null,
        simulationParams: {
          ...INITIAL_STATE.simulationParams,
        },
        city: {
          ...INITIAL_CITY_STATE,
          cityCameraFlyVersion: state.city.cityCameraFlyVersion + 1,
        },
        underground: {
          ...INITIAL_UNDERGROUND_STATE,
          undergroundCameraFlyVersion: state.underground.undergroundCameraFlyVersion + 1,
        },
        lab: {
          ...INITIAL_STATE.lab,
          activeExperiment: state.lab.activeExperiment,
          labCameraFlyVersion: state.lab.labCameraFlyVersion + 1,
        },
      };
    case 'UPDATE_CITY_STATE': {
      const nextCity = { ...state.city, ...action.patch };
      return {
        ...state,
        city: nextCity,
        simulationParams: {
          ...state.simulationParams,
          demand: Math.round(nextCity.demandMultiplier * 100),
          rainfall: nextCity.rainfallIntensity,
          storage: nextCity.reservoirStoragePct,
          recycling: nextCity.recyclingCapacityPct,
        },
        mission:
          action.patch.activeTab === 'dashboard' && state.mission.gameStarted
            ? { ...state.mission, inspectedWaterBalance: true }
            : state.mission,
      };
    }
    case 'SET_BUILDING_DEMAND':
      return {
        ...state,
        city: {
          ...state.city,
          buildingDemandOverrides: {
            ...state.city.buildingDemandOverrides,
            [action.buildingId]: clampValue(
              action.multiplier,
              WATER_SCIENCE_CONSTANTS.URBAN_CONSUMPTION.MIN_BUILDING_MULTIPLIER,
              WATER_SCIENCE_CONSTANTS.URBAN_CONSUMPTION.MAX_BUILDING_MULTIPLIER
            ),
          },
        },
      };
    case 'UPDATE_RAINWATER':
      return {
        ...state,
        city: {
          ...state.city,
          rainwater: {
            ...state.city.rainwater,
            ...action.patch,
          },
        },
      };
    case 'TRIGGER_CITY_LEAK':
      return {
        ...state,
        city: {
          ...state.city,
          leak: {
            ...state.city.leak,
            active: true,
            locationId: action.locationId ?? state.city.leak.locationId,
            severityLph: action.severityLph ?? state.city.leak.severityLph,
          },
        },
      };
    case 'TICK_CITY_LEAK':
      if (!state.city.leak.active || !state.simulationParams.running) return state;
      return {
        ...state,
        city: {
          ...state.city,
          leak: {
            ...state.city.leak,
            accumulatedLossLitres:
              state.city.leak.accumulatedLossLitres + action.litresLost,
          },
        },
      };
    case 'REPAIR_CITY_LEAK': {
      const wasActive = state.city.leak.active;
      const savedToday = wasActive ? state.city.leak.severityLph * 24 : 0;
      return {
        ...state,
        city: {
          ...state.city,
          baseLeakageRatePct: Math.max(5, Math.min(state.city.baseLeakageRatePct, 8)),
          leak: {
            ...state.city.leak,
            active: false,
            lastBeforeLossLph: wasActive
              ? state.city.leak.severityLph
              : state.city.leak.lastBeforeLossLph,
            repairedCount: wasActive
              ? state.city.leak.repairedCount + 1
              : state.city.leak.repairedCount,
          },
        },
        mission: wasActive
          ? {
              ...state.mission,
              leaksRepaired: state.mission.leaksRepaired + 1,
              waterSavedLitres: state.mission.waterSavedLitres + savedToday,
            }
          : state.mission,
      };
    }
    case 'FOCUS_CITY_PRESET':
      return {
        ...state,
        city: {
          ...state.city,
          cityCameraPreset: action.presetId,
          cityCameraFlyVersion: state.city.cityCameraFlyVersion + 1,
        },
      };
    case 'RESET_CITY':
      return {
        ...state,
        selectedObject: null,
        city: {
          ...INITIAL_CITY_STATE,
          cityCameraFlyVersion: state.city.cityCameraFlyVersion + 1,
        },
      };
    case 'SOLVE_CITY_EMERGENCY': {
      const id = action.emergencyId;
      let patch: Partial<CitySimulationState> = {};
      let nextLeak = state.city.leak;

      if (id === 'em-reservoir') {
        patch = {
          reservoirStoragePct: Math.max(state.city.reservoirStoragePct, 74),
          demandMultiplier: Math.min(state.city.demandMultiplier, 0.92),
        };
      } else if (id === 'em-leak') {
        patch = { baseLeakageRatePct: 8 };
        nextLeak = {
          ...state.city.leak,
          active: false,
          lastBeforeLossLph: state.city.leak.active
            ? state.city.leak.severityLph
            : state.city.leak.lastBeforeLossLph,
        };
      } else if (id === 'em-consumption') {
        patch = { demandMultiplier: 0.88 };
      } else if (id === 'em-population') {
        patch = {
          recyclingCapacityPct: Math.max(state.city.recyclingCapacityPct, 62),
          rainfallIntensity: Math.max(state.city.rainfallIntensity, 60),
        };
      } else if (id === 'em-groundwater') {
        patch = {
          groundwaterExtractionPct: 24,
          recyclingCapacityPct: Math.max(state.city.recyclingCapacityPct, 58),
        };
      } else if (id === 'em-recycling') {
        patch = { recyclingCapacityPct: 65 };
      }

      const resolved = state.city.resolvedEmergencies.includes(id)
        ? state.city.resolvedEmergencies
        : [...state.city.resolvedEmergencies, id];

      const wasLeakActive = id === 'em-leak' && state.city.leak.active;
      return {
        ...state,
        city: {
          ...state.city,
          ...patch,
          leak: wasLeakActive ? { ...nextLeak, repairedCount: state.city.leak.repairedCount + 1 } : nextLeak,
          resolvedEmergencies: resolved,
        },
        mission: wasLeakActive
          ? {
              ...state.mission,
              leaksRepaired: state.mission.leaksRepaired + 1,
              waterSavedLitres: state.mission.waterSavedLitres + state.city.leak.severityLph * 24,
            }
          : state.mission,
      };
    }
    case 'UPDATE_UNDERGROUND_STATE': {
      const nextUg = { ...state.underground, ...action.patch };
      return {
        ...state,
        underground: nextUg,
        simulationParams:
          action.patch.simulationSpeed !== undefined
            ? {
                ...state.simulationParams,
                running: action.patch.simulationSpeed > 0,
                speed:
                  action.patch.simulationSpeed > 0
                    ? action.patch.simulationSpeed
                    : state.simulationParams.speed,
              }
            : state.simulationParams,
      };
    }
    case 'TOGGLE_WELL': {
      const wells = state.underground.wells.map((w) =>
        w.id === action.wellId
          ? { ...w, active: action.active !== undefined ? action.active : !w.active }
          : w
      );
      return {
        ...state,
        underground: { ...state.underground, wells },
        city: {
          ...state.city,
          groundwaterExtractionPct: syncCityExtractionFromWells(wells),
        },
      };
    }
    case 'SET_WELL_EXTRACTION': {
      const { MIN_WELL_EXTRACTION_LPH, MAX_WELL_EXTRACTION_LPH } =
        WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;
      const wells = state.underground.wells.map((w) =>
        w.id === action.wellId
          ? {
              ...w,
              extractionLph: clampValue(
                action.extractionLph,
                MIN_WELL_EXTRACTION_LPH,
                MAX_WELL_EXTRACTION_LPH
              ),
            }
          : w
      );
      return {
        ...state,
        underground: { ...state.underground, wells },
        city: {
          ...state.city,
          groundwaterExtractionPct: syncCityExtractionFromWells(wells),
        },
      };
    }
    case 'TICK_UNDERGROUND': {
      if (!state.simulationParams.running || state.underground.simulationSpeed <= 0) {
        return state;
      }
      const metrics = computeUndergroundMetrics(state.underground, state.city);
      const nextDepth = stepWaterTableDepth(
        state.underground.waterTableDepthM,
        metrics.netBalanceMLd,
        state.underground.simulationSpeed,
        action.dt
      );
      if (nextDepth === null) {
        return state;
      }
      return {
        ...state,
        underground: {
          ...state.underground,
          waterTableDepthM: nextDepth,
        },
      };
    }
    case 'SET_UNDERGROUND_DEMO_PHASE': {
      const phase = action.phase;
      let wells = state.underground.wells;
      let rainfall = state.city.rainfallIntensity;
      let rechargeAreaPct = state.underground.rechargeAreaPct;
      let perm = state.underground.soilPermeability;
      let targetDepth = state.underground.waterTableDepthM;

      if (phase === 'normal') {
        wells = wells.map((w, idx) => ({
          ...w,
          active: idx < 2,
          extractionLph: idx === 0 ? 55000 : 115000,
        }));
        rainfall = 50;
        rechargeAreaPct = 60;
        perm = 'high';
        targetDepth = 10.5;
      } else if (phase === 'over-extraction') {
        wells = wells.map((w) => ({ ...w, active: true, extractionLph: 185000 }));
        rainfall = 18;
        rechargeAreaPct = 30;
        targetDepth = 13.8;
      } else if (phase === 'falling-table') {
        wells = wells.map((w) => ({ ...w, active: true, extractionLph: 205000 }));
        rainfall = 10;
        rechargeAreaPct = 22;
        targetDepth = 20.5;
      } else if (phase === 'recharge') {
        wells = wells.map((w, idx) => ({
          ...w,
          active: idx === 1,
          extractionLph: 45000,
        }));
        rainfall = 98;
        rechargeAreaPct = 88;
        perm = 'high';
        targetDepth = 15.0;
      } else if (phase === 'recovery') {
        wells = wells.map((w, idx) => ({
          ...w,
          active: idx === 0,
          extractionLph: 35000,
        }));
        rainfall = 90;
        rechargeAreaPct = 85;
        perm = 'high';
        targetDepth = 8.4;
      }

      return {
        ...state,
        city: {
          ...state.city,
          rainfallIntensity: rainfall,
          groundwaterExtractionPct: syncCityExtractionFromWells(wells),
        },
        underground: {
          ...state.underground,
          demoPhase: phase,
          wells,
          rechargeAreaPct,
          soilPermeability: perm,
          waterTableDepthM: targetDepth,
        },
      };
    }
    case 'UPDATE_CONTAMINATION':
      return {
        ...state,
        underground: {
          ...state.underground,
          contamination: {
            ...state.underground.contamination,
            ...action.patch,
          },
        },
      };
    case 'FOCUS_UNDERGROUND_PRESET':
      return {
        ...state,
        underground: {
          ...state.underground,
          undergroundCameraPreset: action.presetId,
          undergroundCameraFlyVersion: state.underground.undergroundCameraFlyVersion + 1,
        },
      };
    case 'RESET_UNDERGROUND':
      return {
        ...state,
        selectedObject: null,
        city: {
          ...state.city,
          rainfallIntensity: INITIAL_CITY_STATE.rainfallIntensity,
          groundwaterExtractionPct: INITIAL_CITY_STATE.groundwaterExtractionPct,
        },
        underground: {
          ...INITIAL_UNDERGROUND_STATE,
          undergroundCameraFlyVersion: state.underground.undergroundCameraFlyVersion + 1,
        },
      };
    case 'SET_INTERACTION_MODE':
      return {
        ...state,
        interactionMode: action.mode,
        interaction: {
          ...state.interaction,
          selectedControlMode: action.mode,
        },
      };
    case 'SET_DEVICE_INTERFACE_STATUS':
      return {
        ...state,
        interaction: {
          ...state.interaction,
          voiceStatus: action.voiceStatus ?? state.interaction.voiceStatus,
          gestureStatus: action.gestureStatus ?? state.interaction.gestureStatus,
        },
      };
    case 'RECORD_ACTION_RESULT': {
      const res = action.result;
      const entryId = `${res.timestamp}-${Math.random().toString(36).slice(2, 7)}`;
      const logEntry: ActionLogEntry = {
        id: entryId,
        actionName: res.action,
        source: res.source,
        status: res.ok ? 'success' : 'error',
        message: res.message,
        updatedValue: res.updatedValue,
        error: res.error,
        paramsSummary: action.paramsSummary,
        timestamp: res.timestamp,
      };
      return {
        ...state,
        interaction: {
          ...state.interaction,
          currentSource: res.source,
          currentAction: res.action,
          actionFeedback: {
            id: entryId,
            actionName: res.action,
            status: res.ok ? 'success' : 'error',
            message: res.message,
            updatedValue: res.updatedValue,
            error: res.error,
            source: res.source,
            timestamp: res.timestamp,
          },
          actionHistory: [logEntry, ...state.interaction.actionHistory].slice(0, 25),
        },
      };
    }
    case 'CLEAR_ACTION_FEEDBACK':
      return {
        ...state,
        interaction: {
          ...state.interaction,
          actionFeedback: null,
        },
      };
    case 'TOGGLE_CONTROLS_COLLAPSED':
      return {
        ...state,
        controlsCollapsed:
          action.value !== undefined ? action.value : !state.controlsCollapsed,
      };
    case 'SET_INFO_PANEL_OPEN':
      return {
        ...state,
        infoPanelOpen: action.open,
      };
    case 'TOGGLE_EXHIBITION_MODE': {
      const next = action.value !== undefined ? action.value : !state.exhibitionMode;
      return {
        ...state,
        exhibitionMode: next,
        controlsCollapsed: next ? true : false,
        debugPanelOpen: next ? false : state.debugPanelOpen,
      };
    }
    case 'TOGGLE_DEBUG_PANEL':
      return {
        ...state,
        debugPanelOpen: state.exhibitionMode
          ? false
          : action.value !== undefined
            ? action.value
            : !state.debugPanelOpen,
      };
    case 'UPDATE_GESTURE_STATE':
      return {
        ...state,
        gesture: {
          ...state.gesture,
          ...action.patch,
        },
      };
    case 'ORBIT_SCENE':
      return {
        ...state,
        camera: {
          ...state.camera,
          autoRotate: false,
        },
        city:
          state.currentScene === 'city'
            ? { ...state.city, cityAutoRotate: false }
            : state.city,
        underground:
          state.currentScene === 'underground'
            ? { ...state.underground, undergroundAutoRotate: false }
            : state.underground,
        lab:
          state.currentScene === 'lab'
            ? { ...state.lab, labAutoRotate: false }
            : state.lab,
        gesture: {
          ...state.gesture,
          orbitStep: {
            yawDelta: action.yawDelta,
            pitchDelta: action.pitchDelta,
            version: state.gesture.orbitStep.version + 1,
          },
        },
      };
    case 'TRIGGER_GESTURE_POINT':
      return {
        ...state,
        gesture: {
          ...state.gesture,
          pointerCursor: {
            ...state.gesture.pointerCursor,
            active: true,
            x: action.x,
            y: action.y,
            dwellProgress: 0,
            triggerCount: state.gesture.pointerCursor.triggerCount + 1,
          },
        },
      };
    case 'SET_GESTURE_POINTER':
      return {
        ...state,
        gesture: {
          ...state.gesture,
          pointerCursor: {
            ...state.gesture.pointerCursor,
            active: action.active,
            x: action.x,
            y: action.y,
            dwellProgress: action.dwellProgress ?? state.gesture.pointerCursor.dwellProgress,
            hoveredLabel:
              action.hoveredLabel !== undefined
                ? action.hoveredLabel
                : state.gesture.pointerCursor.hoveredLabel,
          },
        },
      };
    case 'UPDATE_AQUA_STATE':
      return {
        ...state,
        aqua: {
          ...state.aqua,
          ...action.patch,
        },
      };
    case 'APPEND_AQUA_MESSAGE':
      return {
        ...state,
        aqua: {
          ...state.aqua,
          messages: [...state.aqua.messages, action.message].slice(-40),
        },
      };
    case 'CLEAR_AQUA_MESSAGES':
      return {
        ...state,
        aqua: {
          ...state.aqua,
          transcriptInterim: '',
          lastVoiceTranscript: '',
          transcriptConfidence: null,
          lastDiscussedTopic: null,
          lastModifiedParam: null,
          pendingConfirmation: null,
          messages: [
            {
              id: `aqua-reset-${Date.now()}`,
              role: 'aqua',
              text: 'Session conversation cleared. I am ready to answer water-science questions or control the 3D exhibition.',
              language: state.aqua.language,
              mode: state.aqua.aiMode,
              timestamp: Date.now(),
            },
          ],
        },
      };
    case 'SET_AQUA_PENDING_CONFIRMATION':
      return {
        ...state,
        aqua: {
          ...state.aqua,
          pendingConfirmation: action.confirmation,
        },
      };
    case 'SELECT_LAB_EXPERIMENT':
      return {
        ...state,
        selectedObject: null,
        lab: {
          ...state.lab,
          activeExperiment: action.experimentId,
          elapsedSeconds: 0,
          labCameraFlyVersion: state.lab.labCameraFlyVersion + 1,
        },
      };
    case 'UPDATE_LAB_STATE':
      return {
        ...state,
        lab: {
          ...state.lab,
          ...action.patch,
        },
      };
    case 'TICK_LAB_EXPERIMENT':
      return stepActiveLabState(state, action.dt);
    case 'RESET_LAB_EXPERIMENT': {
      const targetId = action.experimentId ?? state.lab.activeExperiment;
      const def = createDefaultLabStateParams();
      if (targetId === 'water-cycle') {
        return {
          ...state,
          city: { ...state.city, rainfallIntensity: INITIAL_CITY_STATE.rainfallIntensity },
          lab: { ...state.lab, elapsedSeconds: 0, waterCycle: def.waterCycle },
        };
      }
      if (targetId === 'rainwater-harvesting') {
        return {
          ...state,
          city: { ...state.city, rainwater: INITIAL_CITY_STATE.rainwater },
          lab: { ...state.lab, elapsedSeconds: 0, rainwaterExtra: def.rainwaterExtra },
        };
      }
      if (targetId === 'groundwater-depletion') {
        return {
          ...state,
          city: {
            ...state.city,
            rainfallIntensity: INITIAL_CITY_STATE.rainfallIntensity,
            groundwaterExtractionPct: INITIAL_CITY_STATE.groundwaterExtractionPct,
          },
          underground: {
            ...INITIAL_UNDERGROUND_STATE,
            undergroundCameraFlyVersion: state.underground.undergroundCameraFlyVersion + 1,
          },
          lab: {
            ...state.lab,
            elapsedSeconds: 0,
            groundwaterHorizonYears: def.groundwaterHorizonYears,
          },
        };
      }
      if (targetId === 'pipeline-leakage') {
        return {
          ...state,
          city: {
            ...state.city,
            pipelinePressureBar: INITIAL_CITY_STATE.pipelinePressureBar,
            baseLeakageRatePct: INITIAL_CITY_STATE.baseLeakageRatePct,
            leak: INITIAL_CITY_STATE.leak,
          },
          lab: { ...state.lab, elapsedSeconds: 0, leakSim: def.leakSim },
        };
      }
      if (targetId === 'water-filtration') {
        return {
          ...state,
          lab: { ...state.lab, elapsedSeconds: 0, filtration: def.filtration },
        };
      }
      if (targetId === 'desalination') {
        return {
          ...state,
          lab: { ...state.lab, elapsedSeconds: 0, desalination: def.desalination },
        };
      }
      if (targetId === 'supply-demand') {
        return {
          ...state,
          city: {
            ...state.city,
            population: INITIAL_CITY_STATE.population,
            demandMultiplier: INITIAL_CITY_STATE.demandMultiplier,
            reservoirStoragePct: INITIAL_CITY_STATE.reservoirStoragePct,
          },
          lab: { ...state.lab, elapsedSeconds: 0, supplyDemandExtra: def.supplyDemandExtra },
        };
      }
      return {
        ...state,
        city: { ...INITIAL_CITY_STATE, cityCameraFlyVersion: state.city.cityCameraFlyVersion + 1 },
        underground: {
          ...INITIAL_UNDERGROUND_STATE,
          undergroundCameraFlyVersion: state.underground.undergroundCameraFlyVersion + 1,
        },
        lab: { ...state.lab, elapsedSeconds: 0 },
      };
    }
    case 'CAPTURE_LAB_BASELINE':
      return {
        ...state,
        lab: {
          ...state.lab,
          baselines: {
            ...state.lab.baselines,
            [action.experimentId]: action.baseline,
          },
        },
      };
    case 'TOGGLE_LAB_LEARN_PANEL':
      return {
        ...state,
        lab: {
          ...state.lab,
          learnScienceOpen:
            action.open !== undefined ? action.open : !state.lab.learnScienceOpen,
        },
      };
    case 'UPDATE_MISSION_STATE':
      return {
        ...state,
        mission: {
          ...state.mission,
          ...action.patch,
        },
      };
    case 'UPDATE_PRESENTATION_STATE':
      return {
        ...state,
        presentation: {
          ...state.presentation,
          ...action.patch,
        },
      };
    default:
      return state;
  }
}

interface AppContextValue {
  state: ExhibitionState;
  dispatch: React.Dispatch<ExhibitionAction>;
  dispatchAction: (
    actionName: RegisteredActionName,
    params?: Record<string, unknown>,
    source?: InteractionSource
  ) => ActionExecutionResult;
  focusRegion: (regionId: string, source?: InteractionSource) => void;
  focusCityEntity: (entityId: string, source?: InteractionSource) => void;
  focusUndergroundEntity: (entityId: string, source?: InteractionSource) => void;
  executeCommand: (cmd: AppCommand) => boolean;
  aquaBridge: ReturnType<typeof createAquaBridge>;
  gestureBridge: ReturnType<typeof createGestureBridge>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(exhibitionReducer, INITIAL_STATE);

  // Detect browser voice & webcam capabilities gracefully without failing or requesting permissions
  useEffect(() => {
    const voice = detectVoiceCapabilities();
    const gesture = detectGestureCapabilities();
    dispatch({
      type: 'SET_DEVICE_INTERFACE_STATUS',
      voiceStatus: voice.recommendedStatus,
      gestureStatus: gesture.recommendedStatus,
    });
    dispatch({
      type: 'UPDATE_AQUA_STATE',
      patch: {
        micSupported: voice.speechRecognitionAvailable,
        ttsSupported: voice.speechSynthesisAvailable,
        micPermission: voice.speechRecognitionAvailable ? 'idle' : 'unsupported',
      },
    });
  }, []);

  const dispatchAction = useCallback(
    (
      actionName: RegisteredActionName,
      params: Record<string, unknown> = {},
      source: InteractionSource = 'mouse'
    ): ActionExecutionResult => {
      return executeRegisteredAction(actionName, params, source, state, dispatch);
    },
    [state]
  );

  const focusRegion = useCallback(
    (regionId: string, source: InteractionSource = 'mouse') => {
      dispatchAction('select_country', { id: regionId, autoNavigate: true }, source);
    },
    [dispatchAction]
  );

  const focusCityEntity = useCallback(
    (entityId: string, source: InteractionSource = 'mouse') => {
      dispatchAction('select_city_entity', { id: entityId, autoNavigate: true }, source);
    },
    [dispatchAction]
  );

  const focusUndergroundEntity = useCallback(
    (entityId: string, source: InteractionSource = 'mouse') => {
      dispatchAction('select_underground_entity', { id: entityId, autoNavigate: true }, source);
    },
    [dispatchAction]
  );

  const executeCommand = useCallback(
    (cmd: AppCommand): boolean => {
      const source: InteractionSource = cmd.source ?? 'aqua';
      const payload = cmd.payload ?? {};

      // Legacy AppCommand compatibility mapped directly onto the Central Action Registry
      const legacyMap: Record<string, () => ActionExecutionResult> = {
        navigate: () => {
          const s = String(payload.scene ?? 'earth') as SceneId;
          const map: Record<SceneId, RegisteredActionName> = {
            earth: 'navigate_to_earth',
            city: 'navigate_to_city',
            underground: 'navigate_to_underground',
            lab: 'navigate_to_lab',
            simulations: 'navigate_to_simulations',
            mission: 'navigate_to_mission',
            aqua: 'navigate_to_aqua',
            exhibition: 'navigate_to_exhibition',
          };
          return dispatchAction(map[s] ?? 'navigate_to_earth', {}, source);
        },
        selectRegion: () =>
          dispatchAction(
            'select_country',
            { id: String(payload.regionId ?? ''), autoNavigate: true },
            source
          ),
        selectCityObject: () =>
          dispatchAction(
            'select_city_entity',
            { id: String(payload.entityId ?? ''), autoNavigate: true },
            source
          ),
        selectUndergroundObject: () =>
          dispatchAction(
            'select_underground_entity',
            { id: String(payload.entityId ?? ''), autoNavigate: true },
            source
          ),
        setOverlay: () =>
          dispatchAction('set_earth_overlay', { overlay: String(payload.overlay ?? '') }, source),
        setRainfall: () =>
          dispatchAction('set_rainfall', { value: Number(payload.value ?? 65) }, source),
        setDemand: () =>
          dispatchAction('set_water_demand', { value: Number(payload.value ?? 0.85) }, source),
        createLeak: () =>
          dispatchAction(
            'create_pipeline_leak',
            { locationId: String(payload.locationId ?? 'pipe-distribution') },
            source
          ),
        repairLeak: () => dispatchAction('repair_pipeline_leak', {}, source),
        setCityTab: () =>
          dispatchAction('set_city_tab', { tab: String(payload.tab ?? 'dashboard') }, source),
        setUndergroundTab: () =>
          dispatchAction(
            'set_underground_tab',
            { tab: String(payload.tab ?? 'inspect') },
            source
          ),
        setGroundwaterExtraction: () =>
          dispatchAction(
            'set_groundwater_extraction',
            { extractionLph: Number(payload.extractionLph ?? 165000) },
            source
          ),
        setSoilPermeability: () =>
          dispatchAction(
            'set_soil_permeability',
            { permeability: String(payload.permeability ?? 'high') },
            source
          ),
        toggleWell: () =>
          dispatchAction(
            'toggle_well',
            {
              wellId: String(payload.wellId ?? 'borewell-central'),
              ...(typeof payload.active === 'boolean' ? { active: payload.active } : {}),
            },
            source
          ),
        setUndergroundDemoPhase: () =>
          dispatchAction(
            'set_underground_demo_phase',
            { phase: String(payload.phase ?? 'normal') },
            source
          ),
        setContamination: () => dispatchAction('set_contamination', payload, source),
        resetCity: () => dispatchAction('reset_city', { confirmed: true }, source),
        resetUnderground: () => dispatchAction('reset_underground', { confirmed: true }, source),
        zoomIn: () => dispatchAction('zoom_scene', { delta: -0.45 }, source),
        zoomOut: () => dispatchAction('zoom_scene', { delta: 0.45 }, source),
        setRotate: () => dispatchAction('rotate_scene', payload, source),
        resetCamera: () => dispatchAction('reset_camera', {}, source),
      };

      if (legacyMap[cmd.name]) {
        return legacyMap[cmd.name]().ok;
      }

      // Direct RegisteredActionName execution
      return dispatchAction(cmd.name as RegisteredActionName, payload, source).ok;
    },
    [dispatchAction]
  );

  const aquaBridge = useMemo(
    () => createAquaBridge(state, (name, params) => dispatchAction(name, params, 'aqua')),
    [state, dispatchAction]
  );

  const gestureBridge = useMemo(
    () => createGestureBridge(state, (name, params) => dispatchAction(name, params, 'gesture')),
    [state, dispatchAction]
  );

  const value = useMemo(
    () => ({
      state,
      dispatch,
      dispatchAction,
      focusRegion,
      focusCityEntity,
      focusUndergroundEntity,
      executeCommand,
      aquaBridge,
      gestureBridge,
    }),
    [
      state,
      dispatchAction,
      focusRegion,
      focusCityEntity,
      focusUndergroundEntity,
      executeCommand,
      aquaBridge,
      gestureBridge,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export function useAppState(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useAppState must be used within AppProvider');
  }
  return ctx;
}

export function useActionDispatcher() {
  return useAppState().dispatchAction;
}

export function useAquaInterface() {
  return useAppState().aquaBridge;
}

export function useGestureInterface() {
  return useAppState().gestureBridge;
}

export { toSelectedObjectInfo };
