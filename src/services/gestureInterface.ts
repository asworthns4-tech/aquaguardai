import type { LabExperimentId } from '../data/labExperimentsData';
import {
  ActionExecutionResult,
  DeviceInterfaceStatus,
  ExhibitionState,
  RegisteredActionName,
  SceneId,
} from '../types/exhibition';
import { resolveRegisteredObject } from './objectRegistry';

export interface GestureCapabilities {
  webcamApiAvailable: boolean;
  recommendedStatus: DeviceInterfaceStatus;
}

export function detectGestureCapabilities(): GestureCapabilities {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      webcamApiAvailable: false,
      recommendedStatus: 'unavailable',
    };
  }
  return {
    webcamApiAvailable: true,
    recommendedStatus: 'ready',
  };
}

export type GestureSimulationTarget =
  | 'rainfall'
  | 'demand'
  | 'recycling'
  | 'groundwater_extraction'
  | 'groundwater_recharge'
  | 'simulation_speed';

export interface GestureControlBridge {
  getCurrentState: () => {
    scene: SceneId;
    selectedObject: ExhibitionState['selectedObject'];
    simulationRunning: boolean;
    simulationSpeed: number;
    rainfallMm: number;
    demandMultiplier: number;
    recyclingCapacityPct: number;
    groundwaterExtractionPct: number;
    waterTableDepthM: number;
    gestureEnabled: boolean;
    gesturePaused: boolean;
    currentGesture: ExhibitionState['gesture']['currentGesture'];
    activeLabExperiment: LabExperimentId;
  };
  rotateScene: (autoRotate?: boolean) => ActionExecutionResult;
  orbitScene: (yawDelta: number, pitchDelta: number) => ActionExecutionResult;
  zoomScene: (direction: 'in' | 'out', step?: number) => ActionExecutionResult;
  pointSelectAt: (normX: number, normY: number) => ActionExecutionResult;
  swipeNavigate: (direction: 'left' | 'right') => ActionExecutionResult;
  selectObjectById: (canonicalOrInternalId: string) => ActionExecutionResult;
  selectLabExperiment: (experimentId: LabExperimentId, autoNavigate?: boolean) => ActionExecutionResult;
  cycleLabExperiment: (direction: 'next' | 'prev') => ActionExecutionResult;
  adjustLabParamStep: (direction: 'up' | 'down') => ActionExecutionResult;
  adjustSimulationValue: (
    target: GestureSimulationTarget,
    nextValue: number
  ) => ActionExecutionResult;
  navigateToScene: (scene: SceneId) => ActionExecutionResult;
  toggleSimulationPause: (running?: boolean) => ActionExecutionResult;
  resetSceneCamera: () => ActionExecutionResult;
}

export function createGestureBridge(
  state: ExhibitionState,
  dispatchAction: (
    actionName: RegisteredActionName,
    params?: Record<string, unknown>,
    source?: 'gesture'
  ) => ActionExecutionResult
): GestureControlBridge {
  return {
    getCurrentState: () => ({
      scene: state.currentScene,
      selectedObject: state.selectedObject,
      simulationRunning: state.simulationParams.running,
      simulationSpeed: state.simulationParams.speed,
      rainfallMm: state.city.rainfallIntensity,
      demandMultiplier: state.city.demandMultiplier,
      recyclingCapacityPct: state.city.recyclingCapacityPct,
      groundwaterExtractionPct: state.city.groundwaterExtractionPct,
      waterTableDepthM: state.underground.waterTableDepthM,
      gestureEnabled: state.gesture.enabled,
      gesturePaused: state.gesture.paused,
      currentGesture: state.gesture.currentGesture,
      activeLabExperiment: state.lab.activeExperiment,
    }),

    rotateScene: (autoRotate) =>
      dispatchAction(
        'rotate_scene',
        typeof autoRotate === 'boolean' ? { value: autoRotate } : {},
        'gesture'
      ),

    orbitScene: (yawDelta, pitchDelta) =>
      dispatchAction('orbit_scene', { yawDelta, pitchDelta }, 'gesture'),

    zoomScene: (direction, step = 0.42) =>
      dispatchAction(
        'zoom_scene',
        { delta: direction === 'in' ? -Math.abs(step) : Math.abs(step) },
        'gesture'
      ),

    pointSelectAt: (normX, normY) =>
      dispatchAction('point_select_at', { normX, normY }, 'gesture'),

    swipeNavigate: (direction) =>
      dispatchAction('swipe_navigate', { direction }, 'gesture'),

    selectObjectById: (canonicalOrInternalId) => {
      const entry = resolveRegisteredObject(canonicalOrInternalId, state.currentScene);
      if (!entry) {
        return dispatchAction('select_city_entity', { id: canonicalOrInternalId }, 'gesture');
      }
      if (entry.scene === 'earth') {
        return dispatchAction('select_country', { id: entry.canonicalId, autoNavigate: true }, 'gesture');
      }
      if (entry.scene === 'underground') {
        return dispatchAction(
          'select_underground_entity',
          { id: entry.canonicalId, autoNavigate: true },
          'gesture'
        );
      }
      return dispatchAction(
        'select_city_entity',
        { id: entry.canonicalId, autoNavigate: true },
        'gesture'
      );
    },

    selectLabExperiment: (experimentId, autoNavigate = true) =>
      dispatchAction('select_lab_experiment', { experimentId, autoNavigate }, 'gesture'),

    cycleLabExperiment: (direction) =>
      dispatchAction('cycle_lab_experiment', { direction }, 'gesture'),

    adjustLabParamStep: (direction) =>
      dispatchAction('adjust_lab_param_step', { direction }, 'gesture'),

    adjustSimulationValue: (target, nextValue) => {
      switch (target) {
        case 'rainfall':
          return dispatchAction('set_rainfall', { value: nextValue }, 'gesture');
        case 'demand':
          return dispatchAction('set_water_demand', { value: nextValue }, 'gesture');
        case 'recycling':
          return dispatchAction('set_recycling_rate', { value: nextValue }, 'gesture');
        case 'groundwater_extraction':
          return dispatchAction('set_groundwater_extraction', { pct: nextValue }, 'gesture');
        case 'groundwater_recharge':
          return dispatchAction('set_groundwater_recharge', { value: nextValue }, 'gesture');
        case 'simulation_speed':
          return dispatchAction('set_simulation_speed', { speed: nextValue }, 'gesture');
      }
    },

    navigateToScene: (scene) => {
      const navMap: Record<SceneId, RegisteredActionName> = {
        earth: 'navigate_to_earth',
        city: 'navigate_to_city',
        underground: 'navigate_to_underground',
        lab: 'navigate_to_lab',
        simulations: 'navigate_to_simulations',
        mission: 'navigate_to_mission',
        aqua: 'navigate_to_aqua',
        exhibition: 'navigate_to_exhibition',
      };
      return dispatchAction(navMap[scene], {}, 'gesture');
    },

    toggleSimulationPause: (running) => {
      const targetRun = running !== undefined ? running : !state.simulationParams.running;
      return dispatchAction(targetRun ? 'resume_simulation' : 'pause_simulation', {}, 'gesture');
    },

    resetSceneCamera: () => dispatchAction('reset_camera', {}, 'gesture'),
  };
}
