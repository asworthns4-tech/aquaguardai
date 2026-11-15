import type { LabExperimentId } from '../data/labExperimentsData';

export type SceneId =
  | 'earth'
  | 'city'
  | 'underground'
  | 'lab'
  | 'simulations'
  | 'mission'
  | 'aqua'
  | 'exhibition';

export type EarthOverlayMode =
  | 'water-availability'
  | 'freshwater'
  | 'saltwater'
  | 'groundwater';

export interface EarthLayerState {
  showOverlay: boolean;
  showClouds: boolean;
  showNightLights: boolean;
  showGrid: boolean;
  showBoundaries: boolean;
}

export interface EarthSurfaceFocus {
  lat: number;
  lon: number;
  label: string;
  countryOrBasin?: string;
}

export type EarthExplorerFocus = 'overview' | 'geography' | 'islands' | 'coverage' | 'intelligence';

export type GeoNodeLevel =
  | 'earth'
  | 'continent'
  | 'country'
  | 'adm1'
  | 'adm2'
  | 'adm3'
  | 'city'
  | 'ocean'
  | 'island-region'
  | 'archipelago'
  | 'island'
  | 'minor-island';

export interface GeoBreadcrumbNode {
  id: string;
  name: string;
  level: GeoNodeLevel;
  levelLabel: string;
  iso2?: string;
  iso3?: string;
  stateCode?: string;
  ocean?: string;
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
}

export interface GeoPolygonFeature {
  id: string;
  name: string;
  level: 'country' | 'adm1' | 'adm2' | 'adm3' | 'island' | 'archipelago' | 'minor-island';
  levelLabel: string;
  iso2?: string;
  iso3?: string;
  ccn3?: string;
  stateCode?: string;
  officialName?: string;
  altSpellings?: string[];
  continent?: string;
  subregion?: string;
  capital?: string;
  flag?: string;
  areaKm2?: number | null;
  population?: number | null;
  isTerritory?: boolean;
  ocean?: string;
  islandRegion?: string;
  countryOrTerritory?: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number];
  rings: number[][][];
  datasetSource: string;
  datasetYear?: string;
  datasetLicense?: string;
  boundaryAvailable: boolean;
}

export interface SelectedGeographyNode {
  id: string;
  name: string;
  officialName?: string;
  level: GeoNodeLevel;
  levelLabel: string;
  breadcrumbs: GeoBreadcrumbNode[];
  iso2?: string;
  iso3?: string;
  ccn3?: string;
  stateCode?: string;
  capital?: string;
  flag?: string;
  continent?: string;
  subregion?: string;
  ocean?: string;
  islandRegion?: string;
  countryOrTerritory?: string;
  isTerritory?: boolean;
  areaKm2?: number | null;
  population?: number | null;
  lat: number;
  lon: number;
  bbox?: [number, number, number, number];
  boundaryAvailable: boolean;
  datasetSource: string;
  datasetYear?: string;
  datasetLicense?: string;
  rings?: number[][][];
}

export type InteractionMode = 'mouse' | 'keyboard' | 'touch' | 'voice' | 'gesture' | 'exhibition';

export type InteractionSource =
  | 'mouse'
  | 'keyboard'
  | 'touch'
  | 'aqua'
  | 'gesture'
  | 'debug'
  | 'system';

export type DeviceInterfaceStatus =
  | 'idle'
  | 'ready'
  | 'listening'
  | 'tracking'
  | 'processing'
  | 'unavailable';

export type CityPanelTab = 'inspect' | 'dashboard' | 'leak-rain' | 'recycling-crisis';

export type UndergroundPanelTab = 'inspect' | 'depletion' | 'recharge' | 'contamination';

export type SoilPermeabilityLevel = 'low' | 'medium' | 'high';

export type ContaminationSourceType = 'agricultural' | 'wastewater' | 'industrial' | 'landfill';

export type GroundwaterDemoPhase =
  | 'normal'
  | 'over-extraction'
  | 'falling-table'
  | 'recharge'
  | 'recovery';

export interface SelectedObjectInfo {
  id: string;
  canonicalId?: string;
  type:
    | 'country'
    | 'region'
    | 'ocean'
    | 'river'
    | 'glacier'
    | 'lake'
    | 'aquifer'
    | 'infrastructure'
    | 'building'
    | 'pipeline'
    | 'stratum'
    | 'well'
    | 'water-table'
    | 'lab-equipment'
    | 'lab-station';
  name: string;
  regionId?: string;
}

export interface CameraState {
  activeCameraId: string;
  position: [number, number, number];
  rotation: [number, number, number];
  targetLat: number;
  targetLon: number;
  distance: number;
  zoomLevelPct: number;
  autoRotate: boolean;
  rotationSpeed: number;
  presetId: string;
  flyToVersion: number;
}

export interface SimulationParams {
  demand: number; // % baseline
  rainfall: number; // mm/yr or normalized slider
  storage: number; // % capacity
  recycling: number; // % wastewater recycled
  activeSim: string | null;
  running: boolean;
  speed: number; // 0.5 | 1 | 2
}

export interface CityLeakState {
  active: boolean;
  locationId: 'pipe-distribution' | 'pipe-residential-east' | 'pipe-intake';
  severityLph: number; // litres per hour
  accumulatedLossLitres: number;
  repairedCount: number;
  lastBeforeLossLph: number;
}

export interface RainwaterHarvestState {
  rainfallMm: number;
  roofAreaM2: number;
  runoffCoeff: number;
  tankCapacityLitres: number;
  tankStoredLitres: number;
}

export interface CitySimulationState {
  rainfallIntensity: number; // mm/event (0 - 120)
  population: number; // 50,000 - 400,000
  demandMultiplier: number; // 0.6 - 1.6
  reservoirStoragePct: number; // 10 - 100
  recyclingCapacityPct: number; // 0 - 85
  pipelinePressureBar: number; // 2.0 - 6.5
  baseLeakageRatePct: number; // 2 - 35
  groundwaterExtractionPct: number; // 5 - 95
  leak: CityLeakState;
  rainwater: RainwaterHarvestState;
  buildingDemandOverrides: Record<string, number>; // multiplier 0.5 - 1.6 per building
  activeRecyclingStage: number; // 0..6
  resolvedEmergencies: string[];
  activeTab: CityPanelTab;
  cityCameraPreset: string;
  cityCameraFlyVersion: number;
  cityZoomDelta: number;
  cityZoomVersion: number;
  cityAutoRotate: boolean;
}

export interface UndergroundWellState {
  id: string;
  name: string;
  wellType: 'shallow' | 'borewell';
  depthM: number;
  active: boolean;
  extractionLph: number;
  aquiferTarget: 'unconfined' | 'confined';
  connectedCityEntityId: string;
  connectedCityLabel: string;
  position: [number, number]; // x, z
}

export interface UndergroundContaminationState {
  active: boolean;
  sourceType: ContaminationSourceType;
  plumeIntensity: number; // 0.2 - 1.0
}

export interface UndergroundSimulationState {
  initialWaterTableDepthM: number; // e.g., 10.5 m
  waterTableDepthM: number; // 4.0 m (high/full) to 34.0 m (severely depleted)
  soilPermeability: SoilPermeabilityLevel;
  rechargeAreaPct: number; // 15 - 95%
  simulationSpeed: number; // 0, 0.5, 1, 2
  demoPhase: GroundwaterDemoPhase;
  wells: UndergroundWellState[];
  contamination: UndergroundContaminationState;
  activeTab: UndergroundPanelTab;
  undergroundCameraPreset: string;
  undergroundCameraFlyVersion: number;
  undergroundZoomDelta: number;
  undergroundZoomVersion: number;
  undergroundAutoRotate: boolean;
}

export interface CommandFeedback {
  id: string;
  actionName: string;
  status: 'success' | 'error' | 'info';
  message: string;
  updatedValue?: string;
  error?: string;
  source: InteractionSource;
  timestamp: number;
}

export interface ActionLogEntry {
  id: string;
  actionName: string;
  source: InteractionSource;
  status: 'success' | 'error';
  message: string;
  updatedValue?: string;
  error?: string;
  paramsSummary?: string;
  timestamp: number;
}

export interface InteractionSystemState {
  currentSource: InteractionSource;
  voiceStatus: DeviceInterfaceStatus;
  gestureStatus: DeviceInterfaceStatus;
  selectedControlMode: InteractionMode;
  currentAction: string | null;
  actionFeedback: CommandFeedback | null;
  actionHistory: ActionLogEntry[];
}

export type GestureType =
  | 'none'
  | 'open_palm'
  | 'hand_move'
  | 'pinch'
  | 'pointing'
  | 'swipe_left'
  | 'swipe_right'
  | 'fist'
  | 'two_hand_zoom';

export interface GestureCursorState {
  active: boolean;
  x: number; // 0..1 normalized viewport X
  y: number; // 0..1 normalized viewport Y
  dwellProgress: number; // 0..1 pointing hold progress
  triggerCount: number;
  hoveredLabel: string | null;
}

export interface GestureSystemState {
  enabled: boolean;
  paused: boolean;
  panelOpen: boolean;
  tutorialOpen: boolean;
  tutorialCompleted: boolean;
  cameraPermission: 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';
  cameraActive: boolean;
  modelStatus: 'idle' | 'loading' | 'ready' | 'error';
  errorMessage: string | null;
  handDetected: boolean;
  handCount: number;
  handedness: string | null;
  palmActive: boolean;
  currentGesture: GestureType;
  gestureLabel: string;
  confidence: number;
  sensitivity: number; // 0.5..2.0
  twoHandEnabled: boolean;
  pinchBaseline: number;
  neutralPalmOrigin: { x: number; y: number } | null;
  trackingLost: boolean;
  pointerCursor: GestureCursorState;
  orbitStep: { yawDelta: number; pitchDelta: number; version: number };
}

export type AquaLanguage = 'en' | 'ml' | 'hi';

export type AquaAssistantStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

export type AquaAiMode = 'live' | 'offline-demo';

export interface AquaExecutedActionBadge {
  actionName: RegisteredActionName;
  ok: boolean;
  message: string;
  updatedValue?: string;
}

export interface AquaChatMessage {
  id: string;
  role: 'user' | 'aqua' | 'system';
  text: string;
  spokenText?: string;
  language: AquaLanguage;
  mode?: AquaAiMode;
  inputMethod?: 'text' | 'voice';
  executedActions?: AquaExecutedActionBadge[];
  timestamp: number;
}

export interface AquaPendingConfirmation {
  id: string;
  actionName: RegisteredActionName;
  params: Record<string, unknown>;
  prompt: string;
}

export interface AquaSystemState {
  panelOpen: boolean;
  minimized: boolean;
  language: AquaLanguage;
  ttsEnabled: boolean;
  autoSendVoice: boolean;
  status: AquaAssistantStatus;
  aiMode: AquaAiMode;
  aiReason: string | null;
  transcriptInterim: string;
  lastVoiceTranscript: string;
  transcriptConfidence: number | null;
  micPermission: 'idle' | 'requesting' | 'granted' | 'denied' | 'unsupported';
  micSupported: boolean;
  ttsSupported: boolean;
  ttsLanguageSupported: boolean;
  lastDiscussedTopic: string | null;
  lastModifiedParam: 'rainfall' | 'extraction' | 'demand' | 'recycling' | 'storage' | null;
  pendingConfirmation: AquaPendingConfirmation | null;
  messages: AquaChatMessage[];
}

export interface LabBaselineSnapshot {
  experimentId: LabExperimentId;
  capturedAt: number;
  label: string;
  metrics: Record<string, number>;
  formatted: Record<string, string>;
}

export interface LabWaterCycleParams {
  temperatureC: number;
  solarIntensityPct: number;
  cloudFormationRatePct: number;
  vaporStorageIndex: number; // dynamic accumulated reservoir 0..100
  cloudMassIndex: number; // 0..100
}

export interface LabRainwaterExtraParams {
  firstFlushMm: number;
  filterEfficiencyPct: number;
}

export interface LabLeakSimParams {
  leakOrificeMm: number;
  leakCount: number;
  supplyFlowLph: number;
}

export interface LabFiltrationParams {
  initialTurbidityNtu: number;
  flowRateLpm: number;
  filterConditionPct: number;
  sedimentationMin: number;
  carbonEfficiencyPct: number;
  cumulativeFilteredLitres: number;
}

export interface LabDesalinationParams {
  salinityGpl: number;
  feedPressureBar: number;
  recoveryRatePct: number;
  feedVolumeM3: number;
  energyFactor: number;
  cumulativeFreshwaterM3: number;
  cumulativeBrineM3: number;
}

export interface LabSupplyDemandExtraParams {
  industrialDemandMLd: number;
  commercialDemandMLd: number;
  availableSupplyMLd: number;
  distributionLossPct: number;
  reservoirCapacityML: number;
}

export interface LabSimulationState {
  activeExperiment: LabExperimentId;
  elapsedSeconds: number;
  learnScienceOpen: boolean;
  labAutoRotate: boolean;
  labCameraFlyVersion: number;
  labZoomDelta: number;
  labZoomVersion: number;
  waterCycle: LabWaterCycleParams;
  rainwaterExtra: LabRainwaterExtraParams;
  groundwaterHorizonYears: number;
  leakSim: LabLeakSimParams;
  filtration: LabFiltrationParams;
  desalination: LabDesalinationParams;
  supplyDemandExtra: LabSupplyDemandExtraParams;
  baselines: Partial<Record<LabExperimentId, LabBaselineSnapshot>>;
}

export interface PresentationState {
  active: boolean;
  activeChapterIndex: number;
  isPlaying: boolean;
  narrationActive: boolean;
  showTextNarration: boolean;
  welcomeModalOpen: boolean;
}

export interface ExhibitionState {
  currentScene: SceneId;
  previousScene: SceneId | null;
  selectedObject: SelectedObjectInfo | null;
  camera: CameraState;
  earthOverlay: EarthOverlayMode;
  earthLayers: EarthLayerState;
  earthSurfacePoint: EarthSurfaceFocus | null;
  selectedGeography: SelectedGeographyNode | null;
  earthExplorerFocus: EarthExplorerFocus;
  leftNavOpen: boolean;
  simulationParams: SimulationParams;
  city: CitySimulationState;
  underground: UndergroundSimulationState;
  lab: LabSimulationState;
  mission: import('../services/missionEngine').MissionProgressState;
  presentation: PresentationState;
  interactionMode: InteractionMode;
  interaction: InteractionSystemState;
  gesture: GestureSystemState;
  aqua: AquaSystemState;
  controlsCollapsed: boolean;
  infoPanelOpen: boolean;
  exhibitionMode: boolean;
  debugPanelOpen: boolean;
}

export type RegisteredActionName =
  // Navigation
  | 'navigate_to_earth'
  | 'navigate_to_city'
  | 'navigate_to_underground'
  | 'navigate_to_lab'
  | 'navigate_to_simulations'
  | 'navigate_to_mission'
  | 'navigate_to_aqua'
  | 'navigate_to_exhibition'
  | 'toggle_left_nav'
  | 'focus_earth_section'
  // Earth
  | 'rotate_earth'
  | 'zoom_earth'
  | 'select_country'
  | 'set_earth_overlay'
  | 'toggle_earth_overlay_visibility'
  | 'toggle_earth_clouds'
  | 'toggle_earth_night_lights'
  | 'toggle_earth_grid'
  | 'toggle_earth_boundaries'
  | 'set_earth_surface_point'
  | 'select_geography'
  | 'clear_geography_selection'
  | 'navigate_geography_parent'
  | 'reset_earth_camera'
  // Smart City
  | 'select_building'
  | 'select_reservoir'
  | 'select_city_entity'
  | 'set_rainfall'
  | 'set_water_demand'
  | 'set_building_demand'
  | 'set_recycling_rate'
  | 'set_reservoir_storage'
  | 'set_pipeline_pressure'
  | 'set_base_leakage_rate'
  | 'set_city_population'
  | 'update_rainwater_harvest'
  | 'collect_rainwater_cistern'
  | 'drain_rainwater_cistern'
  | 'set_recycling_stage'
  | 'solve_city_emergency'
  | 'create_pipeline_leak'
  | 'repair_pipeline_leak'
  | 'set_city_tab'
  | 'focus_city_preset'
  | 'reset_city'
  // Underground
  | 'select_aquifer'
  | 'select_soil_layer'
  | 'select_well'
  | 'select_underground_entity'
  | 'set_groundwater_extraction'
  | 'set_groundwater_recharge'
  | 'set_soil_permeability'
  | 'activate_well'
  | 'deactivate_well'
  | 'toggle_well'
  | 'set_well_extraction'
  | 'set_underground_demo_phase'
  | 'set_contamination'
  | 'set_underground_tab'
  | 'focus_underground_preset'
  | 'reset_underground'
  // Simulations & Universal Scene Controls
  | 'start_simulation'
  | 'pause_simulation'
  | 'resume_simulation'
  | 'reset_simulation'
  | 'set_simulation_speed'
  | 'rotate_scene'
  | 'orbit_scene'
  | 'zoom_scene'
  | 'point_select_at'
  | 'swipe_navigate'
  | 'reset_camera'
  | 'clear_selection'
  | 'toggle_info_panel'
  | 'toggle_controls_collapsed'
  | 'toggle_exhibition_mode'
  | 'set_control_mode'
  | 'toggle_debug_panel'
  // Gesture Control System
  | 'set_gesture_enabled'
  | 'pause_gesture_input'
  | 'resume_gesture_input'
  | 'calibrate_gesture'
  | 'set_gesture_sensitivity'
  | 'set_gesture_two_hand'
  | 'toggle_gesture_panel'
  | 'toggle_gesture_tutorial'
  | 'select_lab_experiment'
  | 'cycle_lab_experiment'
  | 'set_lab_param'
  | 'adjust_lab_param_step'
  | 'apply_lab_preset'
  | 'reset_lab_experiment'
  | 'capture_lab_baseline'
  | 'toggle_lab_learn_panel'
  // Save the City Mission & Presentation Mode (Phase 8)
  | 'start_mission'
  | 'select_mission_stage'
  | 'set_mission_difficulty'
  | 'evaluate_mission'
  | 'reset_mission'
  | 'start_presentation'
  | 'exit_presentation'
  | 'next_chapter'
  | 'prev_chapter'
  | 'jump_chapter'
  | 'toggle_presentation_play'
  | 'toggle_narration'
  | 'toggle_welcome_screen'
  | 'update_presentation_state'
  // AQUA AI Assistant
  | 'toggle_aqua_panel'
  | 'set_aqua_minimized'
  | 'set_aqua_language'
  | 'set_aqua_tts'
  | 'clear_aqua_history';

export interface ActionExecutionResult {
  ok: boolean;
  action: RegisteredActionName;
  source: InteractionSource;
  message: string;
  updatedValue?: string;
  error?: string;
  data?: Record<string, unknown>;
  timestamp: number;
}

export type ExhibitionAction =
  | { type: 'SET_SCENE'; scene: SceneId }
  | { type: 'SELECT_OBJECT'; object: SelectedObjectInfo | null }
  | { type: 'FOCUS_COORDINATES'; lat: number; lon: number; distance?: number; presetId?: string }
  | { type: 'SET_CAMERA_DISTANCE'; distance: number }
  | {
      type: 'SYNC_CAMERA_TELEMETRY';
      activeCameraId: string;
      position: [number, number, number];
      rotation: [number, number, number];
      zoomLevelPct?: number;
    }
  | { type: 'ZOOM_BY'; delta: number }
  | { type: 'TOGGLE_AUTO_ROTATE'; value?: boolean }
  | { type: 'SET_ROTATION_SPEED'; speed: number }
  | { type: 'RESET_CAMERA' }
  | { type: 'SET_EARTH_OVERLAY'; overlay: EarthOverlayMode; showOverlay?: boolean }
  | { type: 'UPDATE_EARTH_LAYERS'; patch: Partial<EarthLayerState> }
  | { type: 'SET_EARTH_SURFACE_POINT'; point: EarthSurfaceFocus | null }
  | { type: 'SELECT_GEOGRAPHY'; geography: SelectedGeographyNode | null }
  | { type: 'SET_EARTH_EXPLORER_FOCUS'; focus: EarthExplorerFocus }
  | { type: 'SET_LEFT_NAV_OPEN'; open?: boolean }
  | { type: 'UPDATE_SIMULATION_PARAMS'; params: Partial<SimulationParams> }
  | { type: 'SET_SIMULATION_RUNNING'; running: boolean }
  | { type: 'SET_SIMULATION_SPEED'; speed: number }
  | { type: 'RESET_ALL_SIMULATIONS' }
  | { type: 'UPDATE_CITY_STATE'; patch: Partial<CitySimulationState> }
  | { type: 'SET_BUILDING_DEMAND'; buildingId: string; multiplier: number }
  | { type: 'UPDATE_RAINWATER'; patch: Partial<RainwaterHarvestState> }
  | {
      type: 'TRIGGER_CITY_LEAK';
      locationId?: CityLeakState['locationId'];
      severityLph?: number;
    }
  | { type: 'TICK_CITY_LEAK'; litresLost: number }
  | { type: 'REPAIR_CITY_LEAK' }
  | { type: 'FOCUS_CITY_PRESET'; presetId: string }
  | { type: 'RESET_CITY' }
  | { type: 'SOLVE_CITY_EMERGENCY'; emergencyId: string }
  | { type: 'UPDATE_UNDERGROUND_STATE'; patch: Partial<UndergroundSimulationState> }
  | { type: 'TOGGLE_WELL'; wellId: string; active?: boolean }
  | { type: 'SET_WELL_EXTRACTION'; wellId: string; extractionLph: number }
  | { type: 'TICK_UNDERGROUND'; dt: number }
  | { type: 'SET_UNDERGROUND_DEMO_PHASE'; phase: GroundwaterDemoPhase }
  | { type: 'UPDATE_CONTAMINATION'; patch: Partial<UndergroundContaminationState> }
  | { type: 'FOCUS_UNDERGROUND_PRESET'; presetId: string }
  | { type: 'RESET_UNDERGROUND' }
  | { type: 'SET_INTERACTION_MODE'; mode: InteractionMode }
  | { type: 'SET_DEVICE_INTERFACE_STATUS'; voiceStatus?: DeviceInterfaceStatus; gestureStatus?: DeviceInterfaceStatus }
  | { type: 'RECORD_ACTION_RESULT'; result: ActionExecutionResult; paramsSummary?: string }
  | { type: 'CLEAR_ACTION_FEEDBACK' }
  | { type: 'TOGGLE_CONTROLS_COLLAPSED'; value?: boolean }
  | { type: 'SET_INFO_PANEL_OPEN'; open: boolean }
  | { type: 'TOGGLE_EXHIBITION_MODE'; value?: boolean }
  | { type: 'TOGGLE_DEBUG_PANEL'; value?: boolean }
  | { type: 'UPDATE_GESTURE_STATE'; patch: Partial<GestureSystemState> }
  | { type: 'ORBIT_SCENE'; yawDelta: number; pitchDelta: number }
  | { type: 'TRIGGER_GESTURE_POINT'; x: number; y: number }
  | { type: 'SET_GESTURE_POINTER'; x: number; y: number; active: boolean; dwellProgress?: number; hoveredLabel?: string | null }
  | { type: 'UPDATE_AQUA_STATE'; patch: Partial<AquaSystemState> }
  | { type: 'APPEND_AQUA_MESSAGE'; message: AquaChatMessage }
  | { type: 'CLEAR_AQUA_MESSAGES' }
  | { type: 'SET_AQUA_PENDING_CONFIRMATION'; confirmation: AquaPendingConfirmation | null }
  | { type: 'SELECT_LAB_EXPERIMENT'; experimentId: LabExperimentId }
  | { type: 'UPDATE_LAB_STATE'; patch: Partial<LabSimulationState> }
  | { type: 'TICK_LAB_EXPERIMENT'; dt: number }
  | { type: 'RESET_LAB_EXPERIMENT'; experimentId?: LabExperimentId }
  | { type: 'CAPTURE_LAB_BASELINE'; experimentId: LabExperimentId; baseline: LabBaselineSnapshot }
  | { type: 'TOGGLE_LAB_LEARN_PANEL'; open?: boolean }
  | { type: 'UPDATE_MISSION_STATE'; patch: Partial<import('../services/missionEngine').MissionProgressState> }
  | { type: 'UPDATE_PRESENTATION_STATE'; patch: Partial<PresentationState> };

export interface AppCommand {
  name:
    | 'navigate'
    | 'selectRegion'
    | 'selectCityObject'
    | 'selectUndergroundObject'
    | 'setOverlay'
    | 'setRainfall'
    | 'setDemand'
    | 'createLeak'
    | 'repairLeak'
    | 'setCityTab'
    | 'setUndergroundTab'
    | 'setGroundwaterExtraction'
    | 'setSoilPermeability'
    | 'toggleWell'
    | 'setUndergroundDemoPhase'
    | 'setContamination'
    | 'resetCity'
    | 'resetUnderground'
    | 'zoomIn'
    | 'zoomOut'
    | 'setRotate'
    | 'resetCamera'
    | RegisteredActionName;
  payload?: Record<string, string | number | boolean>;
  source?: InteractionSource;
}
