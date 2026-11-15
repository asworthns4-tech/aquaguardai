import React from 'react';
import { EARTH_OVERLAYS, EARTH_REGIONS, EXHIBITION_MODULES } from '../data/earthWaterData';
import {
  LAB_EXPERIMENTS,
  LAB_EXPERIMENTS_BY_ID,
  LabExperimentId,
} from '../data/labExperimentsData';
import { CITY_EMERGENCIES, CITY_ENTITIES } from '../data/smartCityData';
import { UNDERGROUND_ENTITIES } from '../data/undergroundData';
import {
  ActionExecutionResult,
  AquaLanguage,
  CityLeakState,
  CityPanelTab,
  ContaminationSourceType,
  EarthExplorerFocus,
  EarthOverlayMode,
  ExhibitionAction,
  ExhibitionState,
  GroundwaterDemoPhase,
  InteractionMode,
  InteractionSource,
  RegisteredActionName,
  SceneId,
  SelectedGeographyNode,
  SoilPermeabilityLevel,
  UndergroundPanelTab,
} from '../types/exhibition';
import { buildLabBaselineSnapshot } from './labSimulationEngine';
import {
  DIFFICULTY_PROFILES,
  MISSION_STAGES,
  MissionDifficulty,
  MissionStageId,
  createDefaultMissionState,
  evaluateMissionStage,
} from './missionEngine';
import { PRESENTATION_CHAPTERS } from './presentationEngine';
import { resolveRegisteredObject, toSelectedObjectInfo } from './objectRegistry';
import {
  WATER_SCIENCE_CONSTANTS,
  computeCityMetrics,
  computeUndergroundMetrics,
} from './simulationEngine';

export interface ActionCatalogEntry {
  name: RegisteredActionName;
  category: 'Navigation' | 'Earth' | 'Smart City' | 'Underground' | 'Simulation' | 'Interface' | 'Mission' | 'Presentation';
  description: string;
  permittedScenes: SceneId[] | 'any';
  defaultParams: Record<string, string | number | boolean>;
  requiresConfirmation?: boolean;
}

export const ACTION_CATALOG: ActionCatalogEntry[] = [
  {
    name: 'navigate_to_earth',
    category: 'Navigation',
    description: 'Switch active 3D scene to Earth Water Explorer (Module 01).',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'navigate_to_city',
    category: 'Navigation',
    description: 'Switch active 3D scene to Future Smart City (Module 02).',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'navigate_to_underground',
    category: 'Navigation',
    description: 'Switch active 3D scene to Underground Water World (Module 03).',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'navigate_to_lab',
    category: 'Navigation',
    description: 'Open Water Science Lab module view.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'navigate_to_simulations',
    category: 'Navigation',
    description: 'Open Water Simulations module view.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'navigate_to_mission',
    category: 'Navigation',
    description: 'Open Save the City Mission module view.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'navigate_to_aqua',
    category: 'Navigation',
    description: 'Open AQUA AI Assistant module view.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'navigate_to_exhibition',
    category: 'Navigation',
    description: 'Open Exhibition Mode module view.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'toggle_left_nav',
    category: 'Navigation',
    description: 'Open or collapse the left Mission Control navigation sidebar.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'focus_earth_section',
    category: 'Navigation',
    description: 'Navigate to Earth and focus Explorer Overview, Geography Explorer, or Water Intelligence.',
    permittedScenes: 'any',
    defaultParams: { focus: 'overview' },
  },
  {
    name: 'rotate_earth',
    category: 'Earth',
    description: 'Toggle or set Earth globe auto-rotation.',
    permittedScenes: ['earth'],
    defaultParams: { rotate: true },
  },
  {
    name: 'zoom_earth',
    category: 'Earth',
    description: 'Zoom Earth globe camera in or out.',
    permittedScenes: ['earth'],
    defaultParams: { delta: -0.42 },
  },
  {
    name: 'select_country',
    category: 'Earth',
    description: 'Focus and select a country, river, glacier, ocean, or region on Earth.',
    permittedScenes: ['earth'],
    defaultParams: { id: 'earth.kerala', autoNavigate: true },
  },
  {
    name: 'set_earth_overlay',
    category: 'Earth',
    description: 'Switch scientific data overlay on the 3D globe.',
    permittedScenes: ['earth'],
    defaultParams: { overlay: 'groundwater' },
  },
  {
    name: 'toggle_earth_overlay_visibility',
    category: 'Earth',
    description: 'Switch between Natural Space View and Scientific Water Overlays on the 3D globe.',
    permittedScenes: ['earth'],
    defaultParams: { visible: false },
  },
  {
    name: 'toggle_earth_clouds',
    category: 'Earth',
    description: 'Show or hide atmospheric cloud layer on the 3D Earth.',
    permittedScenes: ['earth'],
    defaultParams: {},
  },
  {
    name: 'toggle_earth_night_lights',
    category: 'Earth',
    description: 'Show or hide night-side urban illumination on the 3D Earth.',
    permittedScenes: ['earth'],
    defaultParams: {},
  },
  {
    name: 'toggle_earth_grid',
    category: 'Earth',
    description: 'Show or hide 3D latitude/longitude coordinate grid on Earth.',
    permittedScenes: ['earth'],
    defaultParams: {},
  },
  {
    name: 'toggle_earth_boundaries',
    category: 'Earth',
    description: 'Show or hide 3D administrative and island borders on Earth.',
    permittedScenes: ['earth'],
    defaultParams: {},
  },
  {
    name: 'set_earth_surface_point',
    category: 'Earth',
    description: 'Inspect latitude and longitude coordinates clicked on the 3D Earth surface.',
    permittedScenes: ['earth'],
    defaultParams: { lat: 10.55, lon: 76.25, label: 'Surface Coordinate' },
  },
  {
    name: 'select_geography',
    category: 'Earth',
    description: 'Select a country, territory, state, district, local division, city, island, or archipelago on Earth.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'clear_geography_selection',
    category: 'Earth',
    description: 'Clear active geographic boundary selection on Earth.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'navigate_geography_parent',
    category: 'Earth',
    description: 'Step up one level in the active geographic hierarchy breadcrumb.',
    permittedScenes: ['earth'],
    defaultParams: {},
  },
  {
    name: 'reset_earth_camera',
    category: 'Earth',
    description: 'Reset Earth camera to global overview.',
    permittedScenes: ['earth'],
    defaultParams: {},
  },
  {
    name: 'select_building',
    category: 'Smart City',
    description: 'Select and inspect a Smart City building or district.',
    permittedScenes: ['city'],
    defaultParams: { id: 'city.building.01', autoNavigate: true },
  },
  {
    name: 'select_reservoir',
    category: 'Smart City',
    description: 'Select and focus Periyar Valley Smart Reservoir.',
    permittedScenes: ['city'],
    defaultParams: { autoNavigate: true },
  },
  {
    name: 'select_city_entity',
    category: 'Smart City',
    description: 'Select any Smart City building, infrastructure, or pipeline.',
    permittedScenes: ['city'],
    defaultParams: { id: 'city.pipeline.02', autoNavigate: true },
  },
  {
    name: 'set_rainfall',
    category: 'Smart City',
    description: 'Set shared rainfall intensity (0–120 mm), updating City, Underground & Science Lab.',
    permittedScenes: ['earth', 'city', 'underground', 'lab', 'simulations', 'mission'],
    defaultParams: { value: 95 },
  },
  {
    name: 'set_water_demand',
    category: 'Smart City',
    description: 'Set Smart City per-capita demand multiplier (0.6×–1.6×).',
    permittedScenes: ['city', 'underground', 'earth', 'lab', 'simulations', 'mission'],
    defaultParams: { value: 0.88 },
  },
  {
    name: 'set_building_demand',
    category: 'Smart City',
    description: 'Adjust a specific building demand multiplier (0.5×–1.6×).',
    permittedScenes: ['city'],
    defaultParams: { buildingId: 'sky-tower-alpha', multiplier: 0.8 },
  },
  {
    name: 'set_recycling_rate',
    category: 'Smart City',
    description: 'Set municipal wastewater recycling capacity (0–85%).',
    permittedScenes: ['city', 'underground', 'earth', 'lab', 'simulations', 'mission'],
    defaultParams: { value: 65 },
  },
  {
    name: 'set_reservoir_storage',
    category: 'Smart City',
    description: 'Set surface reservoir storage percentage (10–100%).',
    permittedScenes: ['city', 'earth', 'underground', 'lab', 'simulations', 'mission'],
    defaultParams: { value: 78 },
  },
  {
    name: 'set_pipeline_pressure',
    category: 'Smart City',
    description: 'Set Smart City main pipeline pressure (2.0–6.5 bar).',
    permittedScenes: ['city', 'lab', 'simulations', 'mission'],
    defaultParams: { value: 4.0 },
  },
  {
    name: 'set_base_leakage_rate',
    category: 'Smart City',
    description: 'Set background pipeline network leakage rate (2–35%).',
    permittedScenes: ['city', 'lab', 'simulations', 'mission'],
    defaultParams: { value: 8 },
  },
  {
    name: 'set_city_population',
    category: 'Smart City',
    description: 'Set simulated Smart City population (50,000–400,000).',
    permittedScenes: ['city', 'lab', 'simulations'],
    defaultParams: { value: 185000 },
  },
  {
    name: 'update_rainwater_harvest',
    category: 'Smart City',
    description: 'Update Rainwater Harvesting Lab parameters.',
    permittedScenes: ['city', 'lab', 'simulations'],
    defaultParams: { rainfallMm: 60, roofAreaM2: 500, runoffCoeff: 0.85 },
  },
  {
    name: 'collect_rainwater_cistern',
    category: 'Smart City',
    description: 'Collect calculated rainwater event yield into Smart City cistern.',
    permittedScenes: ['city', 'lab', 'simulations'],
    defaultParams: {},
  },
  {
    name: 'drain_rainwater_cistern',
    category: 'Smart City',
    description: 'Empty rainwater harvesting cistern.',
    permittedScenes: ['city', 'lab', 'simulations'],
    defaultParams: {},
  },
  {
    name: 'set_recycling_stage',
    category: 'Smart City',
    description: 'Select active wastewater treatment step (1–7).',
    permittedScenes: ['city'],
    defaultParams: { step: 5 },
  },
  {
    name: 'solve_city_emergency',
    category: 'Smart City',
    description: 'Apply mitigation strategy for a Smart City water emergency.',
    permittedScenes: ['city'],
    defaultParams: { emergencyId: 'em-leak' },
  },
  {
    name: 'create_pipeline_leak',
    category: 'Smart City',
    description: 'Simulate a pipeline burst visible in Smart City, Underground & Lab.',
    permittedScenes: ['city', 'underground', 'lab', 'simulations', 'mission'],
    defaultParams: { locationId: 'pipe-distribution', severityLph: 14500 },
  },
  {
    name: 'repair_pipeline_leak',
    category: 'Smart City',
    description: 'Repair active pipeline leak and restore normal pressure across City, Underground & Lab.',
    permittedScenes: ['city', 'underground', 'lab', 'simulations', 'mission'],
    defaultParams: {},
  },
  {
    name: 'set_city_tab',
    category: 'Smart City',
    description: 'Switch Smart City Console tab.',
    permittedScenes: ['city'],
    defaultParams: { tab: 'dashboard' },
  },
  {
    name: 'focus_city_preset',
    category: 'Smart City',
    description: 'Fly Smart City camera to a named preset or entity.',
    permittedScenes: ['city'],
    defaultParams: { presetId: 'overview' },
  },
  {
    name: 'reset_city',
    category: 'Smart City',
    description: 'Reset Smart City parameters to exhibition baseline.',
    permittedScenes: ['city'],
    defaultParams: { confirmed: true },
    requiresConfirmation: true,
  },
  {
    name: 'select_aquifer',
    category: 'Underground',
    description: 'Select an underground aquifer (unconfined, confined, or subsurface vault).',
    permittedScenes: ['underground'],
    defaultParams: { id: 'underground.aquifer.01', autoNavigate: true },
  },
  {
    name: 'select_soil_layer',
    category: 'Underground',
    description: 'Select a geological soil or rock stratum.',
    permittedScenes: ['underground'],
    defaultParams: { id: 'underground.layer.04', autoNavigate: true },
  },
  {
    name: 'select_well',
    category: 'Underground',
    description: 'Select an underground shallow well or deep borewell.',
    permittedScenes: ['underground'],
    defaultParams: { id: 'underground.well.02', autoNavigate: true },
  },
  {
    name: 'select_underground_entity',
    category: 'Underground',
    description: 'Select any underground layer, aquifer, water table, well, or pipeline.',
    permittedScenes: ['underground'],
    defaultParams: { id: 'water-table-plane', autoNavigate: true },
  },
  {
    name: 'set_groundwater_extraction',
    category: 'Underground',
    description: 'Set groundwater extraction percentage (5–95%) or well pumping rate (L/hr).',
    permittedScenes: ['city', 'underground', 'earth', 'lab', 'simulations', 'mission'],
    defaultParams: { pct: 68 },
  },
  {
    name: 'set_groundwater_recharge',
    category: 'Underground',
    description: 'Set permeable urban recharge zone area percentage (15–95%).',
    permittedScenes: ['underground', 'city', 'lab', 'simulations', 'mission'],
    defaultParams: { value: 75 },
  },
  {
    name: 'set_soil_permeability',
    category: 'Underground',
    description: 'Set soil permeability class (low, medium, high).',
    permittedScenes: ['underground', 'lab', 'simulations'],
    defaultParams: { permeability: 'high' },
  },
  {
    name: 'activate_well',
    category: 'Underground',
    description: 'Start pumping on an underground well or borewell.',
    permittedScenes: ['underground', 'lab', 'simulations'],
    defaultParams: { wellId: 'borewell-east' },
  },
  {
    name: 'deactivate_well',
    category: 'Underground',
    description: 'Stop pumping on an underground well or borewell.',
    permittedScenes: ['underground', 'lab', 'simulations'],
    defaultParams: { wellId: 'borewell-central' },
  },
  {
    name: 'toggle_well',
    category: 'Underground',
    description: 'Toggle an underground well or borewell pump.',
    permittedScenes: ['underground', 'lab', 'simulations'],
    defaultParams: { wellId: 'well-shallow-west' },
  },
  {
    name: 'set_well_extraction',
    category: 'Underground',
    description: 'Adjust pumping rate (10,000–220,000 L/hr) on a specific well.',
    permittedScenes: ['underground'],
    defaultParams: { wellId: 'borewell-central', extractionLph: 140000 },
  },
  {
    name: 'set_underground_demo_phase',
    category: 'Underground',
    description: 'Jump to one of the 5 groundwater depletion/recovery sequence stages.',
    permittedScenes: ['underground'],
    defaultParams: { phase: 'falling-table' },
  },
  {
    name: 'set_contamination',
    category: 'Underground',
    description: 'Toggle or configure illustrative groundwater contamination plume.',
    permittedScenes: ['underground'],
    defaultParams: { active: true, sourceType: 'agricultural' },
  },
  {
    name: 'set_underground_tab',
    category: 'Underground',
    description: 'Switch Underground Water Console tab.',
    permittedScenes: ['underground'],
    defaultParams: { tab: 'depletion' },
  },
  {
    name: 'focus_underground_preset',
    category: 'Underground',
    description: 'Fly Underground camera to a preset or stratum.',
    permittedScenes: ['underground'],
    defaultParams: { presetId: 'overview' },
  },
  {
    name: 'reset_underground',
    category: 'Underground',
    description: 'Reset Underground hydrogeology simulation to baseline.',
    permittedScenes: ['underground'],
    defaultParams: { confirmed: true },
    requiresConfirmation: true,
  },
  {
    name: 'start_simulation',
    category: 'Simulation',
    description: 'Start or resume active water simulation.',
    permittedScenes: 'any',
    defaultParams: { simId: 'hydrology-live' },
  },
  {
    name: 'pause_simulation',
    category: 'Simulation',
    description: 'Pause live simulation updates across Smart City and Underground.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'resume_simulation',
    category: 'Simulation',
    description: 'Resume live simulation updates.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'set_simulation_speed',
    category: 'Simulation',
    description: 'Set simulation time multiplier (0.5×, 1×, 2×).',
    permittedScenes: 'any',
    defaultParams: { speed: 1 },
  },
  {
    name: 'reset_simulation',
    category: 'Simulation',
    description: 'Reset all shared simulation parameters across City & Underground.',
    permittedScenes: 'any',
    defaultParams: { confirmed: true },
    requiresConfirmation: true,
  },
  {
    name: 'rotate_scene',
    category: 'Interface',
    description: 'Toggle or set auto-rotation on the current 3D scene.',
    permittedScenes: ['earth', 'city', 'underground', 'lab'],
    defaultParams: {},
  },
  {
    name: 'orbit_scene',
    category: 'Interface',
    description: 'Smoothly orbit and tilt active 3D scene camera by yaw/pitch delta (radians).',
    permittedScenes: ['earth', 'city', 'underground', 'lab'],
    defaultParams: { yawDelta: 0.14, pitchDelta: 0 },
  },
  {
    name: 'zoom_scene',
    category: 'Interface',
    description: 'Zoom current 3D scene camera by delta (negative = in, positive = out).',
    permittedScenes: ['earth', 'city', 'underground', 'lab'],
    defaultParams: { delta: -0.42 },
  },
  {
    name: 'point_select_at',
    category: 'Interface',
    description: 'Raycast and select a visible 3D object at normalized viewport coordinates (x, y in 0..1).',
    permittedScenes: ['earth', 'city', 'underground', 'lab'],
    defaultParams: { normX: 0.5, normY: 0.5 },
  },
  {
    name: 'swipe_navigate',
    category: 'Navigation',
    description: 'Swipe left or right between scenes or cycle Science Lab experiments.',
    permittedScenes: 'any',
    defaultParams: { direction: 'right' },
  },
  {
    name: 'reset_camera',
    category: 'Interface',
    description: 'Reset camera of current 3D scene to overview.',
    permittedScenes: ['earth', 'city', 'underground', 'lab'],
    defaultParams: {},
  },
  {
    name: 'clear_selection',
    category: 'Interface',
    description: 'Clear currently selected 3D object.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'toggle_info_panel',
    category: 'Interface',
    description: 'Open or close the side scientific console panel.',
    permittedScenes: ['earth', 'city', 'underground', 'lab'],
    defaultParams: {},
  },
  {
    name: 'toggle_controls_collapsed',
    category: 'Interface',
    description: 'Collapse or expand the bottom control dock.',
    permittedScenes: ['earth', 'city', 'underground', 'lab'],
    defaultParams: {},
  },
  {
    name: 'toggle_exhibition_mode',
    category: 'Interface',
    description: 'Toggle exhibition kiosk mode (hides developer tools).',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'set_control_mode',
    category: 'Interface',
    description: 'Switch active interaction control mode.',
    permittedScenes: 'any',
    defaultParams: { mode: 'mouse' },
  },
  {
    name: 'toggle_debug_panel',
    category: 'Interface',
    description: 'Open or close the developer Interaction Debug Panel.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'set_gesture_enabled',
    category: 'Interface',
    description: 'Enable or disable webcam hand-gesture recognition and camera stream.',
    permittedScenes: 'any',
    defaultParams: { enabled: true },
  },
  {
    name: 'pause_gesture_input',
    category: 'Interface',
    description: 'Pause live hand-gesture commands while keeping camera preview open.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'resume_gesture_input',
    category: 'Interface',
    description: 'Resume live hand-gesture commands.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'calibrate_gesture',
    category: 'Interface',
    description: 'Calibrate neutral palm center and resting pinch threshold.',
    permittedScenes: 'any',
    defaultParams: { pinchBaseline: 0.38 },
  },
  {
    name: 'set_gesture_sensitivity',
    category: 'Interface',
    description: 'Set hand movement and pinch gesture sensitivity (0.5×–2.0×).',
    permittedScenes: 'any',
    defaultParams: { sensitivity: 1.0 },
  },
  {
    name: 'set_gesture_two_hand',
    category: 'Interface',
    description: 'Enable or disable optional two-hand spread zoom.',
    permittedScenes: 'any',
    defaultParams: { enabled: true },
  },
  {
    name: 'toggle_gesture_panel',
    category: 'Interface',
    description: 'Open or close the Gesture Control Panel.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'toggle_gesture_tutorial',
    category: 'Interface',
    description: 'Open or close the interactive Gesture Tutorial.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'toggle_aqua_panel',
    category: 'Interface',
    description: 'Open or close the floating AQUA AI Assistant panel.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'set_aqua_minimized',
    category: 'Interface',
    description: 'Minimise or expand the AQUA AI Assistant panel.',
    permittedScenes: 'any',
    defaultParams: { minimized: true },
  },
  {
    name: 'set_aqua_language',
    category: 'Interface',
    description: 'Switch AQUA AI Assistant language (en, ml, hi).',
    permittedScenes: 'any',
    defaultParams: { language: 'en' },
  },
  {
    name: 'set_aqua_tts',
    category: 'Interface',
    description: 'Enable or disable AQUA browser speech output (TTS).',
    permittedScenes: 'any',
    defaultParams: { enabled: true },
  },
  {
    name: 'start_mission',
    category: 'Mission',
    description: 'Launch Save the City interactive water crisis mission game.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'select_mission_stage',
    category: 'Mission',
    description: 'Switch active Save the City mission stage (1–5).',
    permittedScenes: 'any',
    defaultParams: { stageId: 'stop-leaks' },
  },
  {
    name: 'set_mission_difficulty',
    category: 'Mission',
    description: 'Set Save the City game difficulty (easy, medium, hard) and configure scenario parameters.',
    permittedScenes: 'any',
    defaultParams: { difficulty: 'medium' },
  },
  {
    name: 'evaluate_mission',
    category: 'Mission',
    description: 'Evaluate live mission stage success conditions against shared city/aquifer telemetry.',
    permittedScenes: 'any',
    defaultParams: { stageId: 'drought-alert' },
  },
  {
    name: 'reset_mission',
    category: 'Mission',
    description: 'Reset Save the City mission progress and restore initial crisis parameters.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'start_presentation',
    category: 'Presentation',
    description: 'Start professional exhibition presentation mode.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'exit_presentation',
    category: 'Presentation',
    description: 'Exit exhibition presentation mode back to normal navigation.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'next_chapter',
    category: 'Presentation',
    description: 'Advance to the next presentation chapter.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'prev_chapter',
    category: 'Presentation',
    description: 'Return to the previous presentation chapter.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'jump_chapter',
    category: 'Presentation',
    description: 'Jump directly to a numbered presentation chapter.',
    permittedScenes: 'any',
    defaultParams: { index: 1 },
  },
  {
    name: 'toggle_presentation_play',
    category: 'Presentation',
    description: 'Play or pause automated presentation narration and chapter advance.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'toggle_narration',
    category: 'Presentation',
    description: 'Enable or mute spoken text-to-speech presentation narration.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'toggle_welcome_screen',
    category: 'Presentation',
    description: 'Open or close the exhibition welcome screen overlay.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'update_presentation_state',
    category: 'Presentation',
    description: 'Update presentation player state parameters.',
    permittedScenes: 'any',
    defaultParams: {},
  },
  {
    name: 'clear_aqua_history',
    category: 'Interface',
    description: 'Clear AQUA conversation history for the current session.',
    permittedScenes: 'any',
    defaultParams: { confirmed: true },
    requiresConfirmation: true,
  },
  // Phase 7: Science Lab & 8 Quantitative Simulations
  {
    name: 'select_lab_experiment',
    category: 'Simulation',
    description: 'Switch the active water experiment station in AQUA Science Lab / Simulations.',
    permittedScenes: 'any',
    defaultParams: { experimentId: 'water-cycle', autoNavigate: false },
  },
  {
    name: 'cycle_lab_experiment',
    category: 'Simulation',
    description: 'Cycle forward or backward through the 8 Science Lab experiments.',
    permittedScenes: ['lab', 'simulations'],
    defaultParams: { direction: 'next' },
  },
  {
    name: 'set_lab_param',
    category: 'Simulation',
    description: 'Set a named numerical parameter on any of the 8 Science Lab water simulations.',
    permittedScenes: ['lab', 'simulations'],
    defaultParams: { key: 'temperatureC', value: 28 },
  },
  {
    name: 'adjust_lab_param_step',
    category: 'Simulation',
    description: 'Step the active experiment primary gesture slider up or down.',
    permittedScenes: ['lab', 'simulations'],
    defaultParams: { direction: 'up' },
  },
  {
    name: 'apply_lab_preset',
    category: 'Simulation',
    description: 'Apply an educational scenario preset to the active or named Science Lab experiment.',
    permittedScenes: ['lab', 'simulations'],
    defaultParams: { presetId: 'monsoon-peak' },
  },
  {
    name: 'reset_lab_experiment',
    category: 'Simulation',
    description: 'Reset parameters of the active or named Science Lab experiment to baseline.',
    permittedScenes: ['lab', 'simulations'],
    defaultParams: {},
  },
  {
    name: 'capture_lab_baseline',
    category: 'Simulation',
    description: 'Capture current computed outputs as the "Before" reference for before/after comparisons.',
    permittedScenes: ['lab', 'simulations'],
    defaultParams: { label: 'Visitor Baseline' },
  },
  {
    name: 'toggle_lab_learn_panel',
    category: 'Interface',
    description: 'Open or close the "Learn the Science" explanation panel in Science Lab.',
    permittedScenes: ['lab', 'simulations'],
    defaultParams: {},
  },
];

function buildResult(
  ok: boolean,
  action: RegisteredActionName,
  source: InteractionSource,
  message: string,
  extra?: Partial<ActionExecutionResult>
): ActionExecutionResult {
  return {
    ok,
    action,
    source,
    message,
    timestamp: Date.now(),
    ...extra,
  };
}

function summarizeParams(params?: Record<string, unknown>): string | undefined {
  if (!params) return undefined;
  const entries = Object.entries(params).filter(([, v]) => v !== undefined);
  if (entries.length === 0) return undefined;
  return entries.map(([k, v]) => `${k}=${String(v)}`).join(', ');
}

function isFiniteNumber(val: unknown): val is number {
  return typeof val === 'number' && Number.isFinite(val);
}

function parseNumeric(val: unknown): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val === 'string' && val.trim() !== '') {
    const parsed = Number(val);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

export function executeRegisteredAction(
  actionName: RegisteredActionName,
  rawParams: Record<string, unknown> = {},
  source: InteractionSource = 'mouse',
  state: ExhibitionState,
  dispatch: React.Dispatch<ExhibitionAction>
): ActionExecutionResult {
  const params = rawParams ?? {};
  const record = (res: ActionExecutionResult): ActionExecutionResult => {
    dispatch({
      type: 'RECORD_ACTION_RESULT',
      result: res,
      paramsSummary: summarizeParams(params),
    });
    return res;
  };

  const fail = (message: string, error?: string): ActionExecutionResult =>
    record(
      buildResult(false, actionName, source, message, {
        error: error ?? message,
      })
    );

  const succeed = (
    message: string,
    updatedValue?: string,
    data?: Record<string, unknown>
  ): ActionExecutionResult =>
    record(
      buildResult(true, actionName, source, message, {
        updatedValue,
        data,
      })
    );

  // Validate action exists in allowlist
  const catalogEntry = ACTION_CATALOG.find((c) => c.name === actionName);
  if (!catalogEntry) {
    return fail(`Action "${String(actionName)}" is not registered.`, 'UNKNOWN_ACTION');
  }

  // Context permission check
  const autoNavigate = Boolean(params.autoNavigate);
  if (
    catalogEntry.permittedScenes !== 'any' &&
    !catalogEntry.permittedScenes.includes(state.currentScene) &&
    !autoNavigate
  ) {
    return fail(
      `"${actionName}" is not available in the current "${state.currentScene}" view.`,
      `SCENE_CONTEXT_MISMATCH: expected [${catalogEntry.permittedScenes.join(', ')}], active "${state.currentScene}"`
    );
  }

  switch (actionName) {
    // -------------------------------------------------------------------------
    // NAVIGATION
    // -------------------------------------------------------------------------
    case 'navigate_to_earth':
    case 'navigate_to_city':
    case 'navigate_to_underground':
    case 'navigate_to_lab':
    case 'navigate_to_simulations':
    case 'navigate_to_mission':
    case 'navigate_to_aqua':
    case 'navigate_to_exhibition': {
      const targetSceneMap: Record<string, SceneId> = {
        navigate_to_earth: 'earth',
        navigate_to_city: 'city',
        navigate_to_underground: 'underground',
        navigate_to_lab: 'lab',
        navigate_to_simulations: 'simulations',
        navigate_to_mission: 'mission',
        navigate_to_aqua: 'aqua',
        navigate_to_exhibition: 'exhibition',
      };
      const scene = targetSceneMap[actionName];
      const mod = EXHIBITION_MODULES.find((m) => m.id === scene);
      if (state.presentation.welcomeModalOpen) {
        dispatch({ type: 'UPDATE_PRESENTATION_STATE', patch: { welcomeModalOpen: false } });
      }
      if (scene === 'exhibition') {
        dispatch({ type: 'UPDATE_PRESENTATION_STATE', patch: { active: true } });
      }
      dispatch({ type: 'SET_SCENE', scene });
      return succeed(
        `Navigated to ${mod?.label ?? scene}.`,
        mod?.shortLabel ?? scene,
        { scene, available: mod?.available ?? false }
      );
    }

    case 'toggle_left_nav': {
      const next = typeof params.open === 'boolean' ? params.open : !state.leftNavOpen;
      dispatch({ type: 'SET_LEFT_NAV_OPEN', open: next });
      return succeed(
        next ? 'Navigation sidebar opened.' : 'Navigation sidebar collapsed.',
        next ? 'Open' : 'Collapsed'
      );
    }

    case 'focus_earth_section': {
      const focus = String(params.focus ?? 'overview') as EarthExplorerFocus;
      if (!['overview', 'geography', 'islands', 'coverage', 'intelligence'].includes(focus)) {
        return fail(`Invalid Earth section "${focus}".`, 'INVALID_ENUM');
      }
      if (state.presentation.welcomeModalOpen) {
        dispatch({ type: 'UPDATE_PRESENTATION_STATE', patch: { welcomeModalOpen: false } });
      }
      if (state.currentScene !== 'earth') {
        dispatch({ type: 'SET_SCENE', scene: 'earth' });
      }
      dispatch({ type: 'SET_EARTH_EXPLORER_FOCUS', focus });
      if (focus === 'intelligence') {
        dispatch({ type: 'SET_EARTH_OVERLAY', overlay: state.earthOverlay, showOverlay: true });
      } else if (focus === 'overview' || focus === 'geography' || focus === 'islands') {
        dispatch({ type: 'UPDATE_EARTH_LAYERS', patch: { showOverlay: false } });
      }
      const labels: Record<EarthExplorerFocus, string> = {
        overview: 'Earth Explorer',
        geography: 'Geography Explorer',
        islands: 'Island & Archipelago Explorer',
        coverage: 'Global Coverage Dashboard',
        intelligence: 'Global Water Intelligence',
      };
      return succeed(`Switched to ${labels[focus]}.`, labels[focus], { focus });
    }

    // -------------------------------------------------------------------------
    // EARTH EXPLORER
    // -------------------------------------------------------------------------
    case 'rotate_earth': {
      const rotate = typeof params.rotate === 'boolean' ? params.rotate : undefined;
      const next = rotate !== undefined ? rotate : !state.camera.autoRotate;
      dispatch({ type: 'TOGGLE_AUTO_ROTATE', value: next });
      return succeed(
        next ? 'Earth auto-rotation resumed.' : 'Earth auto-rotation paused.',
        next ? 'Rotating' : 'Paused'
      );
    }

    case 'zoom_earth': {
      const delta = parseNumeric(params.delta);
      if (delta === null || Math.abs(delta) > 3) {
        return fail('Invalid zoom delta for Earth camera.', 'RANGE_ERROR: delta in [-3, 3]');
      }
      dispatch({ type: 'ZOOM_BY', delta });
      return succeed(
        delta < 0 ? 'Zoomed in on Earth.' : 'Zoomed out on Earth.',
        `${delta < 0 ? '-' : '+'}${Math.abs(delta).toFixed(2)}`
      );
    }

    case 'select_country': {
      const query = String(
        params.id ?? params.country ?? params.countryId ?? params.regionId ?? ''
      ).trim();
      if (!query) {
        return fail('No country or Earth region identifier provided.', 'MISSING_PARAM: id');
      }
      const entry = resolveRegisteredObject(query, 'earth');
      const region = entry
        ? EARTH_REGIONS.find((r) => r.id === entry.internalId)
        : EARTH_REGIONS.find((r) => r.id === query.toLowerCase());
      if (!region) {
        return fail(`Unknown Earth region "${query}".`, 'NOT_FOUND');
      }
      if (state.currentScene !== 'earth') {
        dispatch({ type: 'SET_SCENE', scene: 'earth' });
      }
      const selected = entry
        ? toSelectedObjectInfo(entry)
        : {
            id: region.id,
            canonicalId: `earth.${region.id.replace(/-/g, '_')}`,
            type: region.category,
            name: region.name,
            regionId: region.id,
          };
      dispatch({ type: 'SELECT_OBJECT', object: selected });
      dispatch({
        type: 'FOCUS_COORDINATES',
        lat: region.lat,
        lon: region.lon,
        distance: region.recommendedDistance,
        presetId: region.id,
      });
      return succeed(`${region.name} selected on Earth Explorer.`, selected.canonicalId, {
        id: region.id,
        canonicalId: selected.canonicalId,
        lat: region.lat,
        lon: region.lon,
      });
    }

    case 'set_earth_overlay': {
      const overlay = String(params.overlay ?? '') as EarthOverlayMode;
      if (!EARTH_OVERLAYS[overlay]) {
        return fail(`Invalid Earth overlay "${overlay}".`, 'INVALID_ENUM');
      }
      dispatch({ type: 'SET_EARTH_OVERLAY', overlay, showOverlay: true });
      return succeed(
        `Earth overlay switched to ${EARTH_OVERLAYS[overlay].shortLabel}.`,
        EARTH_OVERLAYS[overlay].shortLabel
      );
    }

    case 'toggle_earth_overlay_visibility': {
      const next =
        typeof params.visible === 'boolean' ? params.visible : !state.earthLayers.showOverlay;
      dispatch({ type: 'UPDATE_EARTH_LAYERS', patch: { showOverlay: next } });
      return succeed(
        next
          ? `Water layer (${EARTH_OVERLAYS[state.earthOverlay].shortLabel}) enabled.`
          : 'Switched to Natural Space Earth View.',
        next ? EARTH_OVERLAYS[state.earthOverlay].shortLabel : 'Natural View'
      );
    }

    case 'toggle_earth_clouds': {
      const next =
        typeof params.visible === 'boolean' ? params.visible : !state.earthLayers.showClouds;
      dispatch({ type: 'UPDATE_EARTH_LAYERS', patch: { showClouds: next } });
      return succeed(
        next ? 'Atmospheric cloud layer enabled.' : 'Atmospheric cloud layer hidden.',
        next ? 'Clouds On' : 'Clouds Off'
      );
    }

    case 'toggle_earth_night_lights': {
      const next =
        typeof params.visible === 'boolean' ? params.visible : !state.earthLayers.showNightLights;
      dispatch({ type: 'UPDATE_EARTH_LAYERS', patch: { showNightLights: next } });
      return succeed(
        next ? 'Night-side urban illumination enabled.' : 'Night-side urban illumination hidden.',
        next ? 'City Lights On' : 'City Lights Off'
      );
    }

    case 'toggle_earth_grid': {
      const next =
        typeof params.visible === 'boolean' ? params.visible : !state.earthLayers.showGrid;
      dispatch({ type: 'UPDATE_EARTH_LAYERS', patch: { showGrid: next } });
      return succeed(
        next ? '3D latitude/longitude coordinate grid enabled.' : 'Coordinate grid hidden.',
        next ? 'Grid On' : 'Grid Off'
      );
    }

    case 'toggle_earth_boundaries': {
      const next =
        typeof params.visible === 'boolean' ? params.visible : !state.earthLayers.showBoundaries;
      dispatch({ type: 'UPDATE_EARTH_LAYERS', patch: { showBoundaries: next } });
      return succeed(
        next ? '3D geographic boundaries enabled.' : '3D geographic boundaries hidden.',
        next ? 'Borders On' : 'Borders Off'
      );
    }

    case 'set_earth_surface_point': {
      const lat = parseNumeric(params.lat);
      const lon = parseNumeric(params.lon);
      if (lat === null || lon === null || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        return fail('Invalid surface coordinates.', 'VALIDATION_ERROR');
      }
      const label = String(params.label ?? 'Surface Observation Point');
      const countryOrBasin =
        typeof params.countryOrBasin === 'string' && params.countryOrBasin.trim()
          ? params.countryOrBasin
          : undefined;
      dispatch({
        type: 'SET_EARTH_SURFACE_POINT',
        point: {
          lat: Number(lat.toFixed(2)),
          lon: Number(lon.toFixed(2)),
          label,
          countryOrBasin,
        },
      });
      return succeed(
        `Coordinates inspected: ${lat >= 0 ? `${lat.toFixed(1)}°N` : `${Math.abs(lat).toFixed(1)}°S`}, ${lon >= 0 ? `${lon.toFixed(1)}°E` : `${Math.abs(lon).toFixed(1)}°W`}`,
        `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`
      );
    }

    case 'select_geography': {
      const geo = params.geography as SelectedGeographyNode | undefined;
      if (!geo || !geo.name || typeof geo.lat !== 'number' || typeof geo.lon !== 'number') {
        return fail('Invalid geography payload.', 'VALIDATION_ERROR');
      }
      if (state.currentScene !== 'earth') {
        dispatch({ type: 'SET_SCENE', scene: 'earth' });
      }
      dispatch({ type: 'SELECT_GEOGRAPHY', geography: geo });
      const targetDistance = parseNumeric(params.distance) ?? 2.08;
      dispatch({
        type: 'FOCUS_COORDINATES',
        lat: geo.lat,
        lon: geo.lon,
        distance: targetDistance,
        presetId: geo.id,
      });
      return succeed(`${geo.name} (${geo.levelLabel}) selected.`, geo.name, {
        id: geo.id,
        level: geo.level,
        iso3: geo.iso3,
      });
    }

    case 'clear_geography_selection': {
      dispatch({ type: 'SELECT_GEOGRAPHY', geography: null });
      return succeed('Geography boundary selection cleared.', 'Cleared');
    }

    case 'navigate_geography_parent': {
      const cur = state.selectedGeography;
      if (!cur || cur.breadcrumbs.length <= 1) {
        dispatch({ type: 'SELECT_GEOGRAPHY', geography: null });
        dispatch({ type: 'RESET_CAMERA' });
        return succeed('Returned to Earth global overview.', 'Earth');
      }
      const parent = cur.breadcrumbs[cur.breadcrumbs.length - 2];
      if (!parent || parent.level === 'earth') {
        dispatch({ type: 'SELECT_GEOGRAPHY', geography: null });
        dispatch({ type: 'RESET_CAMERA' });
        return succeed('Returned to Earth global overview.', 'Earth');
      }
      dispatch({
        type: 'FOCUS_COORDINATES',
        lat: parent.lat,
        lon: parent.lon,
        distance: parent.level === 'continent' || parent.level === 'ocean' ? 2.9 : 2.15,
        presetId: parent.id,
      });
      return succeed(`Focused parent ${parent.name}.`, parent.name);
    }

    case 'reset_earth_camera': {
      dispatch({ type: 'RESET_CAMERA' });
      return succeed('Earth camera reset to global overview.', 'Global Overview');
    }

    // -------------------------------------------------------------------------
    // SMART CITY
    // -------------------------------------------------------------------------
    case 'select_reservoir': {
      if (state.currentScene !== 'city') {
        dispatch({ type: 'SET_SCENE', scene: 'city' });
      }
      const entry = resolveRegisteredObject('city.reservoir.01', 'city');
      const entity = CITY_ENTITIES.find((e) => e.id === 'city-reservoir')!;
      const selected = entry
        ? toSelectedObjectInfo(entry)
        : {
            id: entity.id,
            canonicalId: 'city.reservoir.01',
            type: entity.category,
            name: entity.name,
          };
      dispatch({ type: 'SELECT_OBJECT', object: selected });
      dispatch({ type: 'FOCUS_CITY_PRESET', presetId: entity.id });
      return succeed(
        `Reservoir selected (${state.city.reservoirStoragePct}% storage).`,
        `${state.city.reservoirStoragePct}%`,
        { canonicalId: selected.canonicalId }
      );
    }

    case 'select_building':
    case 'select_city_entity': {
      const query = String(params.id ?? params.entityId ?? '').trim();
      if (!query) {
        return fail('No Smart City object ID provided.', 'MISSING_PARAM: id');
      }
      const entry = resolveRegisteredObject(query, 'city');
      const entity = entry
        ? CITY_ENTITIES.find((e) => e.id === entry.internalId)
        : CITY_ENTITIES.find((e) => e.id === query);
      if (!entity) {
        return fail(`Unknown Smart City entity "${query}".`, 'NOT_FOUND');
      }
      if (actionName === 'select_building' && entity.category !== 'building') {
        return fail(`"${entity.name}" is not a Smart City building.`, 'TYPE_MISMATCH');
      }
      if (state.currentScene !== 'city') {
        dispatch({ type: 'SET_SCENE', scene: 'city' });
      }
      const selected = entry
        ? toSelectedObjectInfo(entry)
        : {
            id: entity.id,
            canonicalId: `city.${entity.id}`,
            type: entity.category,
            name: entity.name,
          };
      dispatch({ type: 'SELECT_OBJECT', object: selected });
      dispatch({ type: 'FOCUS_CITY_PRESET', presetId: entity.id });
      return succeed(`${entity.name} selected.`, selected.canonicalId, {
        id: entity.id,
        canonicalId: selected.canonicalId,
      });
    }

    case 'set_rainfall': {
      const val = parseNumeric(params.value);
      if (val === null || val < 0 || val > 150) {
        return fail(
          'Rainfall must be between 0 and 150 mm.',
          'VALIDATION_ERROR: rainfall in [0, 150]'
        );
      }
      const cityRainfall = Math.min(120, Math.round(val));
      const rainwaterMm = Math.max(5, Math.round(val));
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { rainfallIntensity: cityRainfall } });
      dispatch({ type: 'UPDATE_RAINWATER', patch: { rainfallMm: rainwaterMm } });
      const ugMetrics = computeUndergroundMetrics(state.underground, {
        ...state.city,
        rainfallIntensity: cityRainfall,
      });
      return succeed(
        `Rainfall set to ${cityRainfall} mm (aquifer recharge ${ugMetrics.rechargeRateMLd.toFixed(1)} ML/d).`,
        `${cityRainfall} mm`,
        {
          rainfallIntensity: cityRainfall,
          rechargeRateMLd: Number(ugMetrics.rechargeRateMLd.toFixed(2)),
        }
      );
    }

    case 'set_water_demand': {
      const val = parseNumeric(params.value);
      if (val === null || val < 0.6 || val > 1.6) {
        return fail(
          'Demand multiplier must be between 0.6× and 1.6×.',
          'VALIDATION_ERROR: demandMultiplier in [0.6, 1.6]'
        );
      }
      const rounded = Number(val.toFixed(2));
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { demandMultiplier: rounded } });
      const metrics = computeCityMetrics({ ...state.city, demandMultiplier: rounded });
      return succeed(
        `City water demand set to ${Math.round(rounded * 100)}% (${metrics.effectiveDemandMLd.toFixed(1)} ML/d).`,
        `${Math.round(rounded * 100)}%`,
        { demandMultiplier: rounded, effectiveDemandMLd: metrics.effectiveDemandMLd }
      );
    }

    case 'set_building_demand': {
      const buildingId = String(params.buildingId ?? '');
      const mult = parseNumeric(params.multiplier);
      const { MIN_BUILDING_MULTIPLIER, MAX_BUILDING_MULTIPLIER } =
        WATER_SCIENCE_CONSTANTS.URBAN_CONSUMPTION;
      const entity = CITY_ENTITIES.find(
        (e) => e.id === buildingId && e.category === 'building'
      );
      if (!entity) {
        return fail(`Invalid building "${buildingId}".`, 'NOT_FOUND');
      }
      if (mult === null || mult < MIN_BUILDING_MULTIPLIER || mult > MAX_BUILDING_MULTIPLIER) {
        return fail(
          `Building demand multiplier must be between ${MIN_BUILDING_MULTIPLIER} and ${MAX_BUILDING_MULTIPLIER}.`,
          'VALIDATION_ERROR'
        );
      }
      dispatch({ type: 'SET_BUILDING_DEMAND', buildingId, multiplier: mult });
      return succeed(
        `${entity.name} demand set to ${Math.round(mult * 100)}%.`,
        `${Math.round(mult * 100)}%`
      );
    }

    case 'set_recycling_rate': {
      const val = parseNumeric(params.value);
      if (val === null || val < 0 || val > 85) {
        return fail(
          'Recycling rate must be between 0% and 85%.',
          'VALIDATION_ERROR: recyclingCapacityPct in [0, 85]'
        );
      }
      const pct = Math.round(val);
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { recyclingCapacityPct: pct } });
      return succeed(`Wastewater recycling capacity updated to ${pct}%.`, `${pct}%`);
    }

    case 'set_reservoir_storage': {
      const val = parseNumeric(params.value);
      if (val === null || val < 10 || val > 100) {
        return fail('Reservoir storage must be between 10% and 100%.', 'VALIDATION_ERROR');
      }
      const pct = Math.round(val);
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { reservoirStoragePct: pct } });
      return succeed(`Surface reservoir level set to ${pct}%.`, `${pct}%`);
    }

    case 'set_pipeline_pressure': {
      const val = parseNumeric(params.value);
      if (val === null || val < 2.0 || val > 6.5) {
        return fail('Pipeline pressure must be between 2.0 and 6.5 bar.', 'VALIDATION_ERROR');
      }
      const bar = Number(val.toFixed(1));
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { pipelinePressureBar: bar } });
      return succeed(`Pipeline pressure set to ${bar.toFixed(1)} bar.`, `${bar.toFixed(1)} bar`);
    }

    case 'set_base_leakage_rate': {
      const val = parseNumeric(params.value);
      if (val === null || val < 2 || val > 35) {
        return fail('Base leakage rate must be between 2% and 35%.', 'VALIDATION_ERROR');
      }
      const pct = Math.round(val);
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { baseLeakageRatePct: pct } });
      return succeed(`Background pipeline leakage set to ${pct}%.`, `${pct}%`);
    }

    case 'set_city_population': {
      const val = parseNumeric(params.value);
      if (val === null || val < 50_000 || val > 400_000) {
        return fail('Population must be between 50,000 and 400,000.', 'VALIDATION_ERROR');
      }
      const pop = Math.round(val);
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { population: pop } });
      return succeed(`City population set to ${pop.toLocaleString()}.`, pop.toLocaleString());
    }

    case 'update_rainwater_harvest': {
      const patch: Record<string, number> = {};
      if (params.rainfallMm !== undefined) {
        const v = parseNumeric(params.rainfallMm);
        if (v === null || v < 0 || v > 150) return fail('Invalid rainfallMm (0–150).');
        patch.rainfallMm = v;
      }
      if (params.roofAreaM2 !== undefined) {
        const v = parseNumeric(params.roofAreaM2);
        if (v === null || v < 50 || v > 1200) return fail('Invalid roofAreaM2 (50–1200).');
        patch.roofAreaM2 = v;
      }
      if (params.runoffCoeff !== undefined) {
        const v = parseNumeric(params.runoffCoeff);
        if (v === null || v < 0.5 || v > 0.95) return fail('Invalid runoffCoeff (0.5–0.95).');
        patch.runoffCoeff = v;
      }
      if (params.tankCapacityLitres !== undefined) {
        const v = parseNumeric(params.tankCapacityLitres);
        if (v === null || v < 5000 || v > 60000) return fail('Invalid tankCapacityLitres.');
        patch.tankCapacityLitres = v;
      }
      dispatch({ type: 'UPDATE_RAINWATER', patch });
      if (patch.rainfallMm !== undefined) {
        dispatch({
          type: 'UPDATE_CITY_STATE',
          patch: { rainfallIntensity: Math.min(120, Math.round(patch.rainfallMm)) },
        });
      }
      return succeed('Rainwater harvesting parameters updated.');
    }

    case 'collect_rainwater_cistern': {
      const metrics = computeCityMetrics(state.city);
      const nextStored = Math.min(
        state.city.rainwater.tankCapacityLitres,
        state.city.rainwater.tankStoredLitres + metrics.rainwaterFormulaLitres
      );
      dispatch({ type: 'UPDATE_RAINWATER', patch: { tankStoredLitres: nextStored } });
      return succeed(
        `Collected ${metrics.rainwaterFormulaLitres.toLocaleString()} L into rainwater cistern.`,
        `${nextStored.toLocaleString()} L`
      );
    }

    case 'drain_rainwater_cistern': {
      dispatch({ type: 'UPDATE_RAINWATER', patch: { tankStoredLitres: 0 } });
      return succeed('Rainwater cistern drained to 0 L.', '0 L');
    }

    case 'set_recycling_stage': {
      const step = parseNumeric(params.step);
      if (step === null || step < 0 || step > 6) {
        return fail('Recycling stage index must be 0–6.', 'VALIDATION_ERROR');
      }
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { activeRecyclingStage: Math.round(step) } });
      return succeed(`Wastewater recycling stage ${Math.round(step) + 1} inspected.`);
    }

    case 'solve_city_emergency': {
      const id = String(params.emergencyId ?? '');
      const challenge = CITY_EMERGENCIES.find((c) => c.id === id);
      if (!challenge) {
        return fail(`Unknown city emergency "${id}".`, 'NOT_FOUND');
      }
      dispatch({ type: 'SOLVE_CITY_EMERGENCY', emergencyId: id });
      return succeed(`Resolved: ${challenge.title}.`, 'Mitigated');
    }

    case 'create_pipeline_leak': {
      const loc = (params.locationId ?? 'pipe-distribution') as CityLeakState['locationId'];
      if (!['pipe-distribution', 'pipe-residential-east', 'pipe-intake'].includes(loc)) {
        return fail(`Invalid pipeline leak location "${String(loc)}".`, 'INVALID_ENUM');
      }
      const severity =
        params.severityLph !== undefined ? parseNumeric(params.severityLph) : undefined;
      if (severity !== undefined && (severity === null || severity < 1000 || severity > 50000)) {
        return fail('Leak severity must be between 1,000 and 50,000 L/hr.', 'VALIDATION_ERROR');
      }
      dispatch({
        type: 'TRIGGER_CITY_LEAK',
        locationId: loc,
        severityLph: severity ?? undefined,
      });
      if (params.openTab) {
        dispatch({ type: 'UPDATE_CITY_STATE', patch: { activeTab: 'leak-rain' } });
        dispatch({ type: 'SET_INFO_PANEL_OPEN', open: true });
      }
      return succeed(
        `Pipeline leak triggered on ${loc} (visible in Smart City & Underground).`,
        `${(severity ?? state.city.leak.severityLph).toLocaleString()} L/hr`
      );
    }

    case 'repair_pipeline_leak': {
      if (!state.city.leak.active) {
        return succeed('All distribution pipelines are already sealed.', 'Nominal');
      }
      dispatch({ type: 'REPAIR_CITY_LEAK' });
      return succeed('Pipeline leak repaired across Smart City & Underground.', 'Sealed');
    }

    case 'set_city_tab': {
      const tab = String(params.tab ?? '') as CityPanelTab;
      if (!['inspect', 'dashboard', 'leak-rain', 'recycling-crisis'].includes(tab)) {
        return fail(`Invalid Smart City console tab "${tab}".`, 'INVALID_ENUM');
      }
      dispatch({ type: 'UPDATE_CITY_STATE', patch: { activeTab: tab } });
      dispatch({ type: 'SET_INFO_PANEL_OPEN', open: true });
      return succeed(`Smart City tab switched to ${tab}.`, tab);
    }

    case 'focus_city_preset': {
      const presetId = String(params.presetId ?? 'overview');
      dispatch({ type: 'FOCUS_CITY_PRESET', presetId });
      return succeed(`Smart City camera focused on ${presetId}.`, presetId);
    }

    case 'reset_city': {
      if (params.confirmed === false) {
        return fail('City reset cancelled (confirmation required).', 'CONFIRMATION_REQUIRED');
      }
      dispatch({ type: 'RESET_CITY' });
      return succeed('Smart City simulation reset to baseline.', 'Reset');
    }

    // -------------------------------------------------------------------------
    // UNDERGROUND WATER WORLD
    // -------------------------------------------------------------------------
    case 'select_aquifer':
    case 'select_soil_layer':
    case 'select_well':
    case 'select_underground_entity': {
      const query = String(params.id ?? params.entityId ?? params.wellId ?? '').trim();
      if (!query) {
        return fail('No underground object ID provided.', 'MISSING_PARAM: id');
      }
      const entry = resolveRegisteredObject(query, 'underground');
      const internalId = entry?.internalId ?? query;
      const isWell = state.underground.wells.some((w) => w.id === internalId);
      const ugEntity = UNDERGROUND_ENTITIES.find((e) => e.id === internalId);
      if (!isWell && !ugEntity) {
        return fail(`Unknown underground object "${query}".`, 'NOT_FOUND');
      }
      if (actionName === 'select_aquifer' && ugEntity?.category !== 'aquifer') {
        return fail(`"${ugEntity?.name ?? query}" is not an aquifer.`, 'TYPE_MISMATCH');
      }
      if (actionName === 'select_soil_layer' && ugEntity?.category !== 'stratum') {
        return fail(`"${ugEntity?.name ?? query}" is not a soil/rock stratum.`, 'TYPE_MISMATCH');
      }
      if (actionName === 'select_well' && !isWell) {
        return fail(`"${query}" is not a well or borewell.`, 'TYPE_MISMATCH');
      }
      if (state.currentScene !== 'underground') {
        dispatch({ type: 'SET_SCENE', scene: 'underground' });
      }
      const wellObj = state.underground.wells.find((w) => w.id === internalId);
      const selected = entry
        ? toSelectedObjectInfo(entry)
        : {
            id: internalId,
            canonicalId: `underground.${internalId}`,
            type: isWell
              ? ('well' as const)
              : ugEntity!.category === 'water-table'
                ? ('water-table' as const)
                : ugEntity!.category === 'aquifer'
                  ? ('aquifer' as const)
                  : ugEntity!.category === 'pipeline'
                    ? ('pipeline' as const)
                    : ('stratum' as const),
            name: wellObj?.name ?? ugEntity!.name,
          };
      dispatch({ type: 'SELECT_OBJECT', object: selected });
      dispatch({ type: 'FOCUS_UNDERGROUND_PRESET', presetId: internalId });
      return succeed(`${selected.name} selected.`, selected.canonicalId, {
        id: internalId,
        canonicalId: selected.canonicalId,
      });
    }

    case 'set_groundwater_extraction': {
      const pct = parseNumeric(params.pct);
      const lph = parseNumeric(params.extractionLph);
      if (pct !== null) {
        if (pct < 5 || pct > 95) {
          return fail(
            'Groundwater extraction % must be between 5% and 95%.',
            'VALIDATION_ERROR: pct in [5, 95]'
          );
        }
        const roundedPct = Math.round(pct);
        dispatch({
          type: 'UPDATE_CITY_STATE',
          patch: { groundwaterExtractionPct: roundedPct },
        });
        return succeed(
          `Groundwater extraction updated to ${roundedPct}% across City & Underground.`,
          `${roundedPct}%`
        );
      }
      if (lph !== null) {
        const { MIN_WELL_EXTRACTION_LPH, MAX_WELL_EXTRACTION_LPH } =
          WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;
        if (lph < MIN_WELL_EXTRACTION_LPH || lph > MAX_WELL_EXTRACTION_LPH) {
          return fail(
            `Well extraction must be between ${MIN_WELL_EXTRACTION_LPH.toLocaleString()} and ${MAX_WELL_EXTRACTION_LPH.toLocaleString()} L/hr.`,
            'VALIDATION_ERROR'
          );
        }
        state.underground.wells.forEach((w) => {
          dispatch({ type: 'SET_WELL_EXTRACTION', wellId: w.id, extractionLph: lph });
        });
        return succeed(
          `All well pumping rates updated to ${Math.round(lph).toLocaleString()} L/hr.`,
          `${Math.round(lph).toLocaleString()} L/hr`
        );
      }
      return fail('Provide "pct" (5–95) or "extractionLph" (10,000–220,000).', 'MISSING_PARAM');
    }

    case 'set_groundwater_recharge': {
      const val = parseNumeric(params.value ?? params.rechargeAreaPct);
      if (val === null || val < 15 || val > 95) {
        return fail('Recharge area percentage must be between 15% and 95%.', 'VALIDATION_ERROR');
      }
      const pct = Math.round(val);
      dispatch({ type: 'UPDATE_UNDERGROUND_STATE', patch: { rechargeAreaPct: pct } });
      return succeed(`Permeable recharge zone area set to ${pct}%.`, `${pct}%`);
    }

    case 'set_soil_permeability': {
      const perm = String(params.permeability ?? '') as SoilPermeabilityLevel;
      if (!['low', 'medium', 'high'].includes(perm)) {
        return fail('Permeability must be "low", "medium", or "high".', 'INVALID_ENUM');
      }
      dispatch({ type: 'UPDATE_UNDERGROUND_STATE', patch: { soilPermeability: perm } });
      return succeed(`Soil permeability set to ${perm}.`, perm);
    }

    case 'activate_well':
    case 'deactivate_well':
    case 'toggle_well': {
      const query = String(params.wellId ?? params.id ?? 'borewell-central');
      const entry = resolveRegisteredObject(query, 'underground');
      const resolvedId = entry?.internalId ?? query;
      const well = state.underground.wells.find((w) => w.id === resolvedId);
      if (!well) {
        return fail(`Unknown well "${query}".`, 'NOT_FOUND');
      }
      const nextActive =
        actionName === 'activate_well'
          ? true
          : actionName === 'deactivate_well'
            ? false
            : typeof params.active === 'boolean'
              ? params.active
              : !well.active;
      dispatch({ type: 'TOGGLE_WELL', wellId: well.id, active: nextActive });
      return succeed(
        `${well.name} pump ${nextActive ? 'activated' : 'stopped'}.`,
        nextActive ? 'Active' : 'Standby'
      );
    }

    case 'set_well_extraction': {
      const query = String(params.wellId ?? params.id ?? '');
      const rate = parseNumeric(params.extractionLph);
      const entry = resolveRegisteredObject(query, 'underground');
      const resolvedId = entry?.internalId ?? query;
      const well = state.underground.wells.find((w) => w.id === resolvedId);
      if (!well) {
        return fail(`Unknown well "${query}".`, 'NOT_FOUND');
      }
      const { MIN_WELL_EXTRACTION_LPH, MAX_WELL_EXTRACTION_LPH } =
        WATER_SCIENCE_CONSTANTS.HYDROGEOLOGY;
      if (rate === null || rate < MIN_WELL_EXTRACTION_LPH || rate > MAX_WELL_EXTRACTION_LPH) {
        return fail(
          `Extraction rate must be between ${MIN_WELL_EXTRACTION_LPH} and ${MAX_WELL_EXTRACTION_LPH} L/hr.`,
          'VALIDATION_ERROR'
        );
      }
      dispatch({ type: 'SET_WELL_EXTRACTION', wellId: well.id, extractionLph: rate });
      return succeed(
        `${well.name} rate set to ${Math.round(rate).toLocaleString()} L/hr.`,
        `${Math.round(rate).toLocaleString()} L/hr`
      );
    }

    case 'set_underground_demo_phase': {
      const phase = String(params.phase ?? '') as GroundwaterDemoPhase;
      if (!['normal', 'over-extraction', 'falling-table', 'recharge', 'recovery'].includes(phase)) {
        return fail(`Invalid demo phase "${phase}".`, 'INVALID_ENUM');
      }
      dispatch({ type: 'SET_UNDERGROUND_DEMO_PHASE', phase });
      return succeed(`Groundwater sequence set to "${phase}".`, phase);
    }

    case 'set_contamination': {
      const active =
        typeof params.active === 'boolean'
          ? params.active
          : !state.underground.contamination.active;
      const sourceType = params.sourceType as ContaminationSourceType | undefined;
      if (
        sourceType &&
        !['agricultural', 'wastewater', 'industrial', 'landfill'].includes(sourceType)
      ) {
        return fail(`Invalid contamination source "${sourceType}".`, 'INVALID_ENUM');
      }
      const intensity =
        params.plumeIntensity !== undefined ? parseNumeric(params.plumeIntensity) : undefined;
      if (intensity !== undefined && (intensity === null || intensity < 0.2 || intensity > 1)) {
        return fail('Plume intensity must be between 0.2 and 1.0.', 'VALIDATION_ERROR');
      }
      dispatch({
        type: 'UPDATE_CONTAMINATION',
        patch: {
          active,
          ...(sourceType ? { sourceType } : {}),
          ...(intensity !== undefined && intensity !== null ? { plumeIntensity: intensity } : {}),
        },
      });
      return succeed(
        active
          ? `Contamination plume active (${sourceType ?? state.underground.contamination.sourceType}).`
          : 'Contamination plume cleared.',
        active ? 'Active' : 'Cleared'
      );
    }

    case 'set_underground_tab': {
      const tab = String(params.tab ?? '') as UndergroundPanelTab;
      if (!['inspect', 'depletion', 'recharge', 'contamination'].includes(tab)) {
        return fail(`Invalid Underground console tab "${tab}".`, 'INVALID_ENUM');
      }
      dispatch({ type: 'UPDATE_UNDERGROUND_STATE', patch: { activeTab: tab } });
      dispatch({ type: 'SET_INFO_PANEL_OPEN', open: true });
      return succeed(`Underground tab switched to ${tab}.`, tab);
    }

    case 'focus_underground_preset': {
      const presetId = String(params.presetId ?? 'overview');
      dispatch({ type: 'FOCUS_UNDERGROUND_PRESET', presetId });
      return succeed(`Underground camera focused on ${presetId}.`, presetId);
    }

    case 'reset_underground': {
      if (params.confirmed === false) {
        return fail('Underground reset cancelled.', 'CONFIRMATION_REQUIRED');
      }
      dispatch({ type: 'RESET_UNDERGROUND' });
      return succeed('Underground hydrogeology simulation reset to baseline.', 'Reset');
    }

    // -------------------------------------------------------------------------
    // SIMULATIONS & UNIVERSAL INTERFACE
    // -------------------------------------------------------------------------
    case 'start_simulation': {
      const simId = String(params.simId ?? state.simulationParams.activeSim ?? 'hydrology-live');
      dispatch({
        type: 'UPDATE_SIMULATION_PARAMS',
        params: { activeSim: simId, running: true },
      });
      dispatch({ type: 'SET_SIMULATION_RUNNING', running: true });
      return succeed(`Simulation "${simId}" started.`, 'Running');
    }

    case 'pause_simulation': {
      dispatch({ type: 'SET_SIMULATION_RUNNING', running: false });
      return succeed('Simulation paused across all connected modules.', 'Paused');
    }

    case 'resume_simulation': {
      dispatch({ type: 'SET_SIMULATION_RUNNING', running: true });
      return succeed('Simulation resumed.', `${state.simulationParams.speed}×`);
    }

    case 'set_simulation_speed': {
      const speed = parseNumeric(params.speed);
      if (speed === null || ![0, 0.5, 1, 2].includes(speed)) {
        return fail('Simulation speed must be 0, 0.5, 1, or 2.', 'VALIDATION_ERROR');
      }
      dispatch({ type: 'SET_SIMULATION_SPEED', speed });
      return succeed(
        speed === 0 ? 'Simulation paused (0×).' : `Simulation speed set to ${speed}×.`,
        `${speed}×`
      );
    }

    case 'reset_simulation': {
      if (params.confirmed === false) {
        return fail('Global simulation reset cancelled.', 'CONFIRMATION_REQUIRED');
      }
      dispatch({ type: 'RESET_ALL_SIMULATIONS' });
      return succeed('All City and Underground simulations reset to initial state.', 'Reset');
    }

    case 'rotate_scene': {
      const value = typeof params.value === 'boolean' ? params.value : undefined;
      dispatch({ type: 'TOGGLE_AUTO_ROTATE', value });
      const next =
        value !== undefined
          ? value
          : state.currentScene === 'city'
            ? !state.city.cityAutoRotate
            : state.currentScene === 'underground'
              ? !state.underground.undergroundAutoRotate
              : state.currentScene === 'lab'
                ? !state.lab.labAutoRotate
                : !state.camera.autoRotate;
      return succeed(
        next ? '3D scene auto-rotation enabled.' : '3D scene auto-rotation paused.',
        next ? 'Rotating' : 'Paused'
      );
    }

    case 'orbit_scene': {
      const yawDelta = parseNumeric(params.yawDelta) ?? 0;
      const pitchDelta = parseNumeric(params.pitchDelta) ?? 0;
      if (Math.abs(yawDelta) > 0.6 || Math.abs(pitchDelta) > 0.6) {
        return fail('Orbit delta out of safe bounds [-0.6, 0.6].', 'VALIDATION_ERROR');
      }
      dispatch({ type: 'ORBIT_SCENE', yawDelta, pitchDelta });
      return succeed('Scene camera oriented via spatial orbit.', `${yawDelta.toFixed(2)} rad`);
    }

    case 'zoom_scene': {
      const delta = parseNumeric(params.delta);
      if (delta === null || Math.abs(delta) > 3) {
        return fail('Zoom delta must be a finite number in [-3, 3].', 'VALIDATION_ERROR');
      }
      dispatch({ type: 'ZOOM_BY', delta });
      return succeed(delta < 0 ? 'Zoomed in.' : 'Zoomed out.');
    }

    case 'point_select_at': {
      const normX = parseNumeric(params.normX);
      const normY = parseNumeric(params.normY);
      if (
        normX === null ||
        normY === null ||
        normX < 0 ||
        normX > 1 ||
        normY < 0 ||
        normY > 1
      ) {
        return fail('Pointing coordinates must be normalized in [0, 1].', 'VALIDATION_ERROR');
      }
      dispatch({ type: 'TRIGGER_GESTURE_POINT', x: normX, y: normY });
      return succeed(
        `Raycast target triggered at (${Math.round(normX * 100)}%, ${Math.round(normY * 100)}%).`,
        state.gesture.pointerCursor.hoveredLabel ?? 'Raycasting'
      );
    }

    case 'swipe_navigate': {
      const direction = String(params.direction ?? 'right');
      if (direction !== 'left' && direction !== 'right') {
        return fail('Swipe direction must be "left" or "right".', 'INVALID_ENUM');
      }
      if (state.currentScene === 'lab' && params.scope !== 'scene') {
        const idx = LAB_EXPERIMENTS.findIndex((e) => e.id === state.lab.activeExperiment);
        const base = idx === -1 ? 0 : idx;
        const nextIdx =
          direction === 'right'
            ? (base + 1) % LAB_EXPERIMENTS.length
            : (base - 1 + LAB_EXPERIMENTS.length) % LAB_EXPERIMENTS.length;
        const nextExp = LAB_EXPERIMENTS[nextIdx];
        dispatch({ type: 'SELECT_LAB_EXPERIMENT', experimentId: nextExp.id });
        return succeed(
          `Swiped ${direction} to Station ${nextExp.number}: ${nextExp.shortTitle}.`,
          nextExp.shortTitle,
          { experimentId: nextExp.id, direction }
        );
      }
      const sceneOrder: SceneId[] = [
        'earth',
        'city',
        'underground',
        'lab',
        'simulations',
        'mission',
        'aqua',
      ];
      const currentIdx = sceneOrder.indexOf(state.currentScene);
      const baseIdx = currentIdx === -1 ? 0 : currentIdx;
      const nextIdx =
        direction === 'right'
          ? (baseIdx + 1) % sceneOrder.length
          : (baseIdx - 1 + sceneOrder.length) % sceneOrder.length;
      const targetScene = sceneOrder[nextIdx];
      const mod = EXHIBITION_MODULES.find((m) => m.id === targetScene);
      dispatch({ type: 'SET_SCENE', scene: targetScene });
      return succeed(
        `Swiped ${direction} to ${mod?.label ?? targetScene}.`,
        mod?.shortLabel ?? targetScene,
        { scene: targetScene, direction }
      );
    }

    case 'reset_camera': {
      dispatch({ type: 'RESET_CAMERA' });
      return succeed(`Camera reset in ${state.currentScene} view.`, 'Overview');
    }

    case 'clear_selection': {
      dispatch({ type: 'SELECT_OBJECT', object: null });
      dispatch({ type: 'SELECT_GEOGRAPHY', geography: null });
      dispatch({ type: 'SET_EARTH_SURFACE_POINT', point: null });
      return succeed('Object selection cleared.', 'None');
    }

    case 'toggle_info_panel': {
      const next = typeof params.open === 'boolean' ? params.open : !state.infoPanelOpen;
      dispatch({ type: 'SET_INFO_PANEL_OPEN', open: next });
      return succeed(next ? 'Information panel opened.' : 'Information panel hidden.');
    }

    case 'toggle_controls_collapsed': {
      const next = typeof params.value === 'boolean' ? params.value : !state.controlsCollapsed;
      dispatch({ type: 'TOGGLE_CONTROLS_COLLAPSED', value: next });
      return succeed(next ? 'Control dock collapsed.' : 'Control dock expanded.');
    }

    case 'toggle_exhibition_mode': {
      const next = typeof params.value === 'boolean' ? params.value : !state.exhibitionMode;
      dispatch({ type: 'TOGGLE_EXHIBITION_MODE', value: next });
      return succeed(next ? 'Exhibition mode enabled.' : 'Exhibition mode disabled.');
    }

    case 'set_control_mode': {
      const mode = String(params.mode ?? '') as InteractionMode;
      if (!['mouse', 'keyboard', 'touch', 'voice', 'gesture', 'exhibition'].includes(mode)) {
        return fail(`Invalid control mode "${mode}".`, 'INVALID_ENUM');
      }
      dispatch({ type: 'SET_INTERACTION_MODE', mode });
      return succeed(`Interaction control mode set to ${mode}.`, mode);
    }

    case 'toggle_debug_panel': {
      if (state.exhibitionMode) {
        return fail(
          'Developer Debug Panel is hidden in Exhibition Mode.',
          'EXHIBITION_MODE_LOCKED'
        );
      }
      const next = typeof params.value === 'boolean' ? params.value : !state.debugPanelOpen;
      if (next && state.gesture.panelOpen) {
        dispatch({ type: 'UPDATE_GESTURE_STATE', patch: { panelOpen: false } });
      }
      if (next && state.aqua.panelOpen) {
        dispatch({ type: 'UPDATE_AQUA_STATE', patch: { panelOpen: false } });
      }
      dispatch({ type: 'TOGGLE_DEBUG_PANEL', value: next });
      return succeed(next ? 'Interaction Debug Panel opened.' : 'Interaction Debug Panel closed.');
    }

    // -------------------------------------------------------------------------
    // GESTURE CONTROL SYSTEM
    // -------------------------------------------------------------------------
    case 'set_gesture_enabled': {
      const next =
        typeof params.enabled === 'boolean' ? params.enabled : !state.gesture.enabled;
      dispatch({
        type: 'UPDATE_GESTURE_STATE',
        patch: {
          enabled: next,
          paused: false,
          palmActive: false,
          errorMessage: next ? null : state.gesture.errorMessage,
          ...(next
            ? {}
            : {
                cameraActive: false,
                handDetected: false,
                handCount: 0,
                currentGesture: 'none',
                gestureLabel: 'Camera Off',
                trackingLost: false,
                pointerCursor: {
                  ...state.gesture.pointerCursor,
                  active: false,
                  dwellProgress: 0,
                  hoveredLabel: null,
                },
              }),
        },
      });
      dispatch({
        type: 'SET_INTERACTION_MODE',
        mode: next ? 'gesture' : 'mouse',
      });
      dispatch({
        type: 'SET_DEVICE_INTERFACE_STATUS',
        gestureStatus: next ? 'tracking' : 'ready',
      });
      return succeed(
        next ? 'Webcam gesture control activated.' : 'Webcam camera stopped and gesture control disabled.',
        next ? 'Active' : 'Camera Off'
      );
    }

    case 'pause_gesture_input': {
      dispatch({
        type: 'UPDATE_GESTURE_STATE',
        patch: {
          paused: true,
          palmActive: false,
          currentGesture: 'none',
          gestureLabel: 'Gesture Paused',
          pointerCursor: {
            ...state.gesture.pointerCursor,
            active: false,
            dwellProgress: 0,
            hoveredLabel: null,
          },
        },
      });
      return succeed('Gesture input paused (camera stream still local).', 'Paused');
    }

    case 'resume_gesture_input': {
      dispatch({
        type: 'UPDATE_GESTURE_STATE',
        patch: {
          paused: false,
          palmActive: true,
          gestureLabel: 'Tracking Resumed',
        },
      });
      return succeed('Gesture input resumed.', 'Active');
    }

    case 'calibrate_gesture': {
      const pinchBaseline = parseNumeric(params.pinchBaseline);
      const originX = parseNumeric(params.originX);
      const originY = parseNumeric(params.originY);
      const safeBaseline =
        pinchBaseline !== null ? Math.min(0.65, Math.max(0.2, pinchBaseline)) : state.gesture.pinchBaseline;
      const neutralPalmOrigin =
        originX !== null && originY !== null
          ? { x: Math.min(0.9, Math.max(0.1, originX)), y: Math.min(0.9, Math.max(0.1, originY)) }
          : null;
      dispatch({
        type: 'UPDATE_GESTURE_STATE',
        patch: {
          pinchBaseline: safeBaseline,
          neutralPalmOrigin,
        },
      });
      return succeed(
        'Neutral hand origin and pinch threshold calibrated.',
        `Pinch ${safeBaseline.toFixed(2)}`
      );
    }

    case 'set_gesture_sensitivity': {
      const sens = parseNumeric(params.sensitivity ?? params.value);
      if (sens === null || sens < 0.4 || sens > 2.2) {
        return fail('Sensitivity must be between 0.4× and 2.2×.', 'VALIDATION_ERROR');
      }
      const rounded = Number(sens.toFixed(2));
      dispatch({ type: 'UPDATE_GESTURE_STATE', patch: { sensitivity: rounded } });
      return succeed(`Gesture sensitivity set to ${rounded.toFixed(1)}×.`, `${rounded.toFixed(1)}×`);
    }

    case 'set_gesture_two_hand': {
      const next =
        typeof params.enabled === 'boolean' ? params.enabled : !state.gesture.twoHandEnabled;
      dispatch({ type: 'UPDATE_GESTURE_STATE', patch: { twoHandEnabled: next } });
      return succeed(
        next ? 'Two-hand zoom gesture enabled.' : 'Switched to single-hand tracking.',
        next ? '2-Hand On' : '1-Hand'
      );
    }

    case 'toggle_gesture_panel': {
      const next = typeof params.open === 'boolean' ? params.open : !state.gesture.panelOpen;
      if (next && state.debugPanelOpen) {
        dispatch({ type: 'TOGGLE_DEBUG_PANEL', value: false });
      }
      if (next && state.aqua.panelOpen) {
        dispatch({ type: 'UPDATE_AQUA_STATE', patch: { panelOpen: false } });
      }
      dispatch({ type: 'UPDATE_GESTURE_STATE', patch: { panelOpen: next } });
      return succeed(next ? 'Gesture Control Panel opened.' : 'Gesture Control Panel hidden.');
    }

    case 'toggle_gesture_tutorial': {
      const next = typeof params.open === 'boolean' ? params.open : !state.gesture.tutorialOpen;
      dispatch({
        type: 'UPDATE_GESTURE_STATE',
        patch: {
          tutorialOpen: next,
          tutorialCompleted: next ? state.gesture.tutorialCompleted : true,
        },
      });
      return succeed(next ? 'Gesture tutorial opened.' : 'Gesture tutorial closed.');
    }

    // -------------------------------------------------------------------------
    // AQUA AI ASSISTANT
    // -------------------------------------------------------------------------
    case 'toggle_aqua_panel': {
      const next = typeof params.open === 'boolean' ? params.open : !state.aqua.panelOpen;
      if (next && state.gesture.panelOpen) {
        dispatch({ type: 'UPDATE_GESTURE_STATE', patch: { panelOpen: false } });
      }
      if (next && state.debugPanelOpen) {
        dispatch({ type: 'TOGGLE_DEBUG_PANEL', value: false });
      }
      dispatch({
        type: 'UPDATE_AQUA_STATE',
        patch: { panelOpen: next, ...(next ? { minimized: false } : {}) },
      });
      return succeed(next ? 'AQUA AI panel opened.' : 'AQUA AI panel hidden.', next ? 'Open' : 'Hidden');
    }

    case 'set_aqua_minimized': {
      const next = typeof params.minimized === 'boolean' ? params.minimized : !state.aqua.minimized;
      dispatch({ type: 'UPDATE_AQUA_STATE', patch: { minimized: next, panelOpen: true } });
      return succeed(next ? 'AQUA AI minimized.' : 'AQUA AI expanded.', next ? 'Minimized' : 'Expanded');
    }

    case 'set_aqua_language': {
      const lang = String(params.language ?? 'en') as AquaLanguage;
      if (!['en', 'ml', 'hi'].includes(lang)) {
        return fail('Language must be "en", "ml", or "hi".', 'INVALID_ENUM');
      }
      const label = lang === 'ml' ? 'Malayalam' : lang === 'hi' ? 'Hindi' : 'English';
      dispatch({ type: 'UPDATE_AQUA_STATE', patch: { language: lang } });
      return succeed(`AQUA language switched to ${label}.`, label);
    }

    case 'set_aqua_tts': {
      const next = typeof params.enabled === 'boolean' ? params.enabled : !state.aqua.ttsEnabled;
      dispatch({ type: 'UPDATE_AQUA_STATE', patch: { ttsEnabled: next } });
      return succeed(next ? 'AQUA spoken responses enabled.' : 'AQUA spoken responses muted.');
    }

    case 'clear_aqua_history': {
      if (params.confirmed === false) {
        return fail('Clear session cancelled (confirmation required).', 'CONFIRMATION_REQUIRED');
      }
      dispatch({ type: 'CLEAR_AQUA_MESSAGES' });
      dispatch({ type: 'SET_AQUA_PENDING_CONFIRMATION', confirmation: null });
      return succeed('AQUA session conversation cleared.', 'Cleared');
    }

    // -------------------------------------------------------------------------
    // SCIENCE LAB & EIGHT WATER SIMULATIONS (PHASE 7)
    // -------------------------------------------------------------------------
    case 'select_lab_experiment': {
      const expId = String(params.experimentId ?? '') as LabExperimentId;
      const meta = LAB_EXPERIMENTS_BY_ID[expId];
      if (!meta) {
        return fail(`Unknown Science Lab experiment "${expId}".`, 'NOT_FOUND');
      }
      if (params.autoNavigate === true && state.currentScene !== 'lab' && state.currentScene !== 'simulations') {
        dispatch({ type: 'SET_SCENE', scene: 'lab' });
      }
      dispatch({ type: 'SELECT_LAB_EXPERIMENT', experimentId: expId });
      return succeed(
        `Experiment ${meta.number} active: ${meta.title}.`,
        meta.shortTitle,
        { experimentId: expId }
      );
    }

    case 'cycle_lab_experiment': {
      const direction = String(params.direction ?? 'next');
      const idx = LAB_EXPERIMENTS.findIndex((e) => e.id === state.lab.activeExperiment);
      const base = idx === -1 ? 0 : idx;
      const nextIdx =
        direction === 'prev'
          ? (base - 1 + LAB_EXPERIMENTS.length) % LAB_EXPERIMENTS.length
          : (base + 1) % LAB_EXPERIMENTS.length;
      const nextExp = LAB_EXPERIMENTS[nextIdx];
      dispatch({ type: 'SELECT_LAB_EXPERIMENT', experimentId: nextExp.id });
      return succeed(`Switched to ${nextExp.title}.`, nextExp.shortTitle, {
        experimentId: nextExp.id,
      });
    }

    case 'set_lab_param': {
      const key = String(params.key ?? '').trim();
      const val = parseNumeric(params.value);
      if (!key || val === null) {
        return fail('Provide numeric "key" and "value" for set_lab_param.', 'VALIDATION_ERROR');
      }

      // Shared cross-module variables reuse existing canonical state
      if (key === 'rainfallIntensity') {
        const clamped = Math.max(0, Math.min(120, Math.round(val)));
        dispatch({ type: 'UPDATE_CITY_STATE', patch: { rainfallIntensity: clamped } });
        dispatch({ type: 'UPDATE_RAINWATER', patch: { rainfallMm: clamped } });
        return succeed(`Rainfall set to ${clamped} mm.`, `${clamped} mm`);
      }
      if (key === 'rainfallMm') {
        const clamped = Math.max(0, Math.min(150, Math.round(val)));
        dispatch({ type: 'UPDATE_RAINWATER', patch: { rainfallMm: clamped } });
        dispatch({ type: 'UPDATE_CITY_STATE', patch: { rainfallIntensity: Math.min(120, clamped) } });
        return succeed(`Rainwater design rainfall set to ${clamped} mm.`, `${clamped} mm`);
      }
      if (key === 'roofAreaM2') {
        const clamped = Math.max(50, Math.min(1200, Math.round(val)));
        dispatch({ type: 'UPDATE_RAINWATER', patch: { roofAreaM2: clamped } });
        return succeed(`Roof catchment area set to ${clamped} m².`, `${clamped} m²`);
      }
      if (key === 'runoffCoeff') {
        const clamped = Number(Math.max(0.5, Math.min(0.95, val)).toFixed(2));
        dispatch({ type: 'UPDATE_RAINWATER', patch: { runoffCoeff: clamped } });
        return succeed(`Roof runoff coefficient set to ${clamped.toFixed(2)}.`, clamped.toFixed(2));
      }
      if (key === 'tankCapacityLitres') {
        const clamped = Math.max(5000, Math.min(60000, Math.round(val)));
        dispatch({ type: 'UPDATE_RAINWATER', patch: { tankCapacityLitres: clamped } });
        return succeed(`Cistern capacity set to ${clamped.toLocaleString()} L.`, `${clamped.toLocaleString()} L`);
      }
      if (key === 'pipelinePressureBar') {
        const clamped = Number(Math.max(2.0, Math.min(6.5, val)).toFixed(1));
        dispatch({ type: 'UPDATE_CITY_STATE', patch: { pipelinePressureBar: clamped } });
        return succeed(`Pipeline pressure set to ${clamped.toFixed(1)} bar.`, `${clamped.toFixed(1)} bar`);
      }
      if (key === 'population') {
        const clamped = Math.max(50_000, Math.min(400_000, Math.round(val)));
        dispatch({ type: 'UPDATE_CITY_STATE', patch: { population: clamped } });
        return succeed(`City population set to ${clamped.toLocaleString()}.`, clamped.toLocaleString());
      }
      if (key === 'perCapitaLpd') {
        const clamped = Math.max(70, Math.min(220, Math.round(val)));
        const mult = Number(Math.max(0.52, Math.min(1.63, clamped / 135)).toFixed(2));
        dispatch({ type: 'UPDATE_CITY_STATE', patch: { demandMultiplier: mult } });
        return succeed(`Per-person demand set to ${clamped} L/day.`, `${clamped} L/d`);
      }
      if (key === 'groundwaterExtractionPct') {
        const clamped = Math.max(5, Math.min(95, Math.round(val)));
        dispatch({ type: 'UPDATE_CITY_STATE', patch: { groundwaterExtractionPct: clamped } });
        return succeed(`Groundwater extraction set to ${clamped}%.`, `${clamped}%`);
      }
      if (key === 'recyclingCapacityPct') {
        const clamped = Math.max(0, Math.min(85, Math.round(val)));
        dispatch({ type: 'UPDATE_CITY_STATE', patch: { recyclingCapacityPct: clamped } });
        return succeed(`Wastewater recycling set to ${clamped}%.`, `${clamped}%`);
      }

      // Lab-specific simulation parameters
      if (key === 'temperatureC') {
        const clamped = Math.max(10, Math.min(42, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { waterCycle: { ...state.lab.waterCycle, temperatureC: clamped } },
        });
        return succeed(`Water cycle temperature set to ${clamped} °C.`, `${clamped} °C`);
      }
      if (key === 'solarIntensityPct') {
        const clamped = Math.max(20, Math.min(100, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { waterCycle: { ...state.lab.waterCycle, solarIntensityPct: clamped } },
        });
        return succeed(`Solar intensity set to ${clamped}%.`, `${clamped}%`);
      }
      if (key === 'cloudFormationRatePct') {
        const clamped = Math.max(20, Math.min(100, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { waterCycle: { ...state.lab.waterCycle, cloudFormationRatePct: clamped } },
        });
        return succeed(`Cloud formation rate set to ${clamped}%.`, `${clamped}%`);
      }
      if (key === 'firstFlushMm') {
        const clamped = Number(Math.max(0, Math.min(4, val)).toFixed(1));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { rainwaterExtra: { ...state.lab.rainwaterExtra, firstFlushMm: clamped } },
        });
        return succeed(`First-flush diversion set to ${clamped} mm.`, `${clamped} mm`);
      }
      if (key === 'filterEfficiencyPct') {
        const clamped = Math.max(60, Math.min(98, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { rainwaterExtra: { ...state.lab.rainwaterExtra, filterEfficiencyPct: clamped } },
        });
        return succeed(`Rainwater filter efficiency set to ${clamped}%.`, `${clamped}%`);
      }
      if (key === 'groundwaterHorizonYears') {
        const clamped = Math.max(1, Math.min(25, Math.round(val)));
        dispatch({ type: 'UPDATE_LAB_STATE', patch: { groundwaterHorizonYears: clamped } });
        return succeed(`Groundwater projection horizon set to ${clamped} years.`, `${clamped} yrs`);
      }
      if (key === 'leakOrificeMm') {
        const clamped = Math.max(4, Math.min(36, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { leakSim: { ...state.lab.leakSim, leakOrificeMm: clamped } },
        });
        return succeed(`Pipeline crack diameter set to ${clamped} mm.`, `${clamped} mm`);
      }
      if (key === 'leakCount') {
        const clamped = Math.max(0, Math.min(6, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { leakSim: { ...state.lab.leakSim, leakCount: clamped } },
        });
        if (clamped === 0 && state.city.leak.active) {
          dispatch({ type: 'REPAIR_CITY_LEAK' });
        } else if (clamped > 0 && !state.city.leak.active) {
          dispatch({ type: 'TRIGGER_CITY_LEAK', locationId: 'pipe-distribution' });
        }
        return succeed(`Active pipeline leak points set to ${clamped}.`, `${clamped} leaks`);
      }
      if (key === 'supplyFlowLph') {
        const clamped = Math.max(40_000, Math.min(240_000, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { leakSim: { ...state.lab.leakSim, supplyFlowLph: clamped } },
        });
        return succeed(`Trunk supply input set to ${clamped.toLocaleString()} L/hr.`, `${clamped.toLocaleString()} L/hr`);
      }
      if (key === 'initialTurbidityNtu') {
        const clamped = Math.max(15, Math.min(300, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { filtration: { ...state.lab.filtration, initialTurbidityNtu: clamped } },
        });
        return succeed(`Raw water turbidity set to ${clamped} NTU.`, `${clamped} NTU`);
      }
      if (key === 'flowRateLpm') {
        const clamped = Math.max(5, Math.min(60, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { filtration: { ...state.lab.filtration, flowRateLpm: clamped } },
        });
        return succeed(`Filtration flow rate set to ${clamped} L/min.`, `${clamped} L/min`);
      }
      if (key === 'filterConditionPct') {
        const clamped = Math.max(25, Math.min(100, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { filtration: { ...state.lab.filtration, filterConditionPct: clamped } },
        });
        return succeed(`Filter media condition set to ${clamped}%.`, `${clamped}%`);
      }
      if (key === 'sedimentationMin') {
        const clamped = Math.max(5, Math.min(90, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { filtration: { ...state.lab.filtration, sedimentationMin: clamped } },
        });
        return succeed(`Sedimentation residence time set to ${clamped} min.`, `${clamped} min`);
      }
      if (key === 'carbonEfficiencyPct') {
        const clamped = Math.max(40, Math.min(99, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { filtration: { ...state.lab.filtration, carbonEfficiencyPct: clamped } },
        });
        return succeed(`Activated carbon capacity set to ${clamped}%.`, `${clamped}%`);
      }
      if (key === 'salinityGpl') {
        const clamped = Math.max(20, Math.min(48, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { desalination: { ...state.lab.desalination, salinityGpl: clamped } },
        });
        return succeed(`Seawater salinity set to ${clamped} g/L (PSU).`, `${clamped} g/L`);
      }
      if (key === 'feedPressureBar') {
        const clamped = Math.max(35, Math.min(80, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { desalination: { ...state.lab.desalination, feedPressureBar: clamped } },
        });
        return succeed(`RO feed pressure set to ${clamped} bar.`, `${clamped} bar`);
      }
      if (key === 'recoveryRatePct') {
        const clamped = Math.max(25, Math.min(55, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { desalination: { ...state.lab.desalination, recoveryRatePct: clamped } },
        });
        return succeed(`RO membrane recovery set to ${clamped}%.`, `${clamped}%`);
      }
      if (key === 'feedVolumeM3') {
        const clamped = Math.max(10, Math.min(200, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { desalination: { ...state.lab.desalination, feedVolumeM3: clamped } },
        });
        return succeed(`RO seawater batch set to ${clamped} m³.`, `${clamped} m³`);
      }
      if (key === 'energyFactor') {
        const clamped = Number(Math.max(0.85, Math.min(1.35, val)).toFixed(2));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { desalination: { ...state.lab.desalination, energyFactor: clamped } },
        });
        return succeed(`RO energy multiplier set to ${clamped}×.`, `${clamped}×`);
      }
      if (key === 'industrialDemandMLd') {
        const clamped = Number(Math.max(1, Math.min(18, val)).toFixed(1));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            supplyDemandExtra: { ...state.lab.supplyDemandExtra, industrialDemandMLd: clamped },
          },
        });
        return succeed(`Industrial demand set to ${clamped} ML/d.`, `${clamped} ML/d`);
      }
      if (key === 'commercialDemandMLd') {
        const clamped = Number(Math.max(0.5, Math.min(12, val)).toFixed(1));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            supplyDemandExtra: { ...state.lab.supplyDemandExtra, commercialDemandMLd: clamped },
          },
        });
        return succeed(`Commercial demand set to ${clamped} ML/d.`, `${clamped} ML/d`);
      }
      if (key === 'availableSupplyMLd') {
        const clamped = Number(Math.max(10, Math.min(65, val)).toFixed(1));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            supplyDemandExtra: { ...state.lab.supplyDemandExtra, availableSupplyMLd: clamped },
          },
        });
        return succeed(`Available municipal supply set to ${clamped} ML/d.`, `${clamped} ML/d`);
      }
      if (key === 'distributionLossPct') {
        const clamped = Math.max(3, Math.min(35, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            supplyDemandExtra: { ...state.lab.supplyDemandExtra, distributionLossPct: clamped },
          },
        });
        return succeed(`Distribution losses set to ${clamped}%.`, `${clamped}%`);
      }
      if (key === 'reservoirCapacityML') {
        const clamped = Math.max(150, Math.min(600, Math.round(val)));
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            supplyDemandExtra: { ...state.lab.supplyDemandExtra, reservoirCapacityML: clamped },
          },
        });
        return succeed(`Reservoir capacity set to ${clamped} ML.`, `${clamped} ML`);
      }

      return fail(`Unknown Science Lab parameter "${key}".`, 'UNKNOWN_PARAM');
    }

    case 'adjust_lab_param_step': {
      const exp = LAB_EXPERIMENTS_BY_ID[state.lab.activeExperiment];
      const spec = exp.primaryGestureParam;
      const dir = String(params.direction ?? 'up') === 'down' ? -1 : 1;

      let currentVal = 0;
      if (spec.key === 'temperatureC') currentVal = state.lab.waterCycle.temperatureC;
      else if (spec.key === 'rainfallMm') currentVal = state.city.rainwater.rainfallMm;
      else if (spec.key === 'groundwaterExtractionPct') currentVal = state.city.groundwaterExtractionPct;
      else if (spec.key === 'pipelinePressureBar') currentVal = state.city.pipelinePressureBar;
      else if (spec.key === 'initialTurbidityNtu') currentVal = state.lab.filtration.initialTurbidityNtu;
      else if (spec.key === 'feedPressureBar') currentVal = state.lab.desalination.feedPressureBar;
      else if (spec.key === 'population') currentVal = state.city.population;
      else if (spec.key === 'recyclingCapacityPct') currentVal = state.city.recyclingCapacityPct;

      const nextVal = Math.max(spec.min, Math.min(spec.max, currentVal + dir * spec.step));
      return executeRegisteredAction(
        'set_lab_param',
        { key: spec.key, value: nextVal },
        source,
        state,
        dispatch
      );
    }

    case 'apply_lab_preset': {
      const expId = (params.experimentId as LabExperimentId) || state.lab.activeExperiment;
      const meta = LAB_EXPERIMENTS_BY_ID[expId];
      if (!meta) return fail(`Unknown experiment "${expId}".`, 'NOT_FOUND');
      const presetId = String(params.presetId ?? '');
      const preset = meta.presets.find((p) => p.id === presetId);
      if (!preset) return fail(`Unknown preset "${presetId}" for ${meta.shortTitle}.`, 'NOT_FOUND');

      if (expId !== state.lab.activeExperiment) {
        dispatch({ type: 'SELECT_LAB_EXPERIMENT', experimentId: expId });
      }

      const p = preset.params;
      if (expId === 'water-cycle') {
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            waterCycle: {
              ...state.lab.waterCycle,
              temperatureC: Number(p.temperatureC ?? 26),
              solarIntensityPct: Number(p.solarIntensityPct ?? 78),
              cloudFormationRatePct: Number(p.cloudFormationRatePct ?? 72),
            },
          },
        });
        dispatch({
          type: 'UPDATE_CITY_STATE',
          patch: { rainfallIntensity: Number(p.rainfallIntensity ?? 48) },
        });
      } else if (expId === 'rainwater-harvesting') {
        dispatch({
          type: 'UPDATE_RAINWATER',
          patch: {
            rainfallMm: Number(p.rainfallMm ?? 50),
            roofAreaM2: Number(p.roofAreaM2 ?? 400),
            runoffCoeff: Number(p.runoffCoeff ?? 0.85),
          },
        });
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            rainwaterExtra: {
              firstFlushMm: Number(p.firstFlushMm ?? 1.5),
              filterEfficiencyPct: Number(p.filterEfficiencyPct ?? 90),
            },
          },
        });
      } else if (expId === 'groundwater-depletion') {
        dispatch({
          type: 'UPDATE_CITY_STATE',
          patch: {
            groundwaterExtractionPct: Number(p.extractionPct ?? 34),
            rainfallIntensity: Number(p.rainfallIntensity ?? 48),
          },
        });
        dispatch({
          type: 'UPDATE_UNDERGROUND_STATE',
          patch: { rechargeAreaPct: Number(p.rechargeAreaPct ?? 60) },
        });
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: { groundwaterHorizonYears: Number(p.groundwaterHorizonYears ?? 5) },
        });
      } else if (expId === 'pipeline-leakage') {
        dispatch({
          type: 'UPDATE_CITY_STATE',
          patch: { pipelinePressureBar: Number(p.pipelinePressureBar ?? 4.2) },
        });
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            leakSim: {
              ...state.lab.leakSim,
              leakOrificeMm: Number(p.leakOrificeMm ?? 16),
              leakCount: Number(p.leakCount ?? 1),
            },
          },
        });
        if (p.leakActive === false) {
          dispatch({ type: 'REPAIR_CITY_LEAK' });
        } else {
          dispatch({ type: 'TRIGGER_CITY_LEAK', locationId: 'pipe-distribution' });
        }
      } else if (expId === 'water-filtration') {
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            filtration: {
              ...state.lab.filtration,
              initialTurbidityNtu: Number(p.initialTurbidityNtu ?? 120),
              flowRateLpm: Number(p.flowRateLpm ?? 22),
              filterConditionPct: Number(p.filterConditionPct ?? 88),
              sedimentationMin: Number(p.sedimentationMin ?? 30),
              carbonEfficiencyPct: Number(p.carbonEfficiencyPct ?? 90),
            },
          },
        });
      } else if (expId === 'desalination') {
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            desalination: {
              ...state.lab.desalination,
              salinityGpl: Number(p.salinityGpl ?? 35),
              feedPressureBar: Number(p.feedPressureBar ?? 62),
              recoveryRatePct: Number(p.recoveryRatePct ?? 42),
              feedVolumeM3: Number(p.feedVolumeM3 ?? 100),
              energyFactor: Number(p.energyFactor ?? 1.0),
            },
          },
        });
      } else if (expId === 'supply-demand') {
        const lpd = Number(p.perCapitaLpd ?? 135);
        dispatch({
          type: 'UPDATE_CITY_STATE',
          patch: {
            population: Number(p.population ?? 165000),
            demandMultiplier: Number((lpd / 135).toFixed(2)),
          },
        });
        dispatch({
          type: 'UPDATE_LAB_STATE',
          patch: {
            supplyDemandExtra: {
              ...state.lab.supplyDemandExtra,
              industrialDemandMLd: Number(p.industrialDemandMLd ?? 5.5),
              commercialDemandMLd: Number(p.commercialDemandMLd ?? 4.0),
              availableSupplyMLd: Number(p.availableSupplyMLd ?? 36),
              distributionLossPct: Number(p.distributionLossPct ?? 12),
            },
          },
        });
      } else if (expId === 'smart-city-management') {
        dispatch({
          type: 'UPDATE_CITY_STATE',
          patch: {
            recyclingCapacityPct: Number(p.recyclingCapacityPct ?? 48),
            demandMultiplier: Number(p.demandMultiplier ?? 1.0),
            groundwaterExtractionPct: Number(p.groundwaterExtractionPct ?? 34),
            rainfallIntensity: Number(p.rainfallIntensity ?? 48),
          },
        });
        if (p.repairLeak) {
          dispatch({ type: 'REPAIR_CITY_LEAK' });
        } else if (p.createLeak) {
          dispatch({ type: 'TRIGGER_CITY_LEAK', locationId: 'pipe-distribution' });
        }
      }

      return succeed(`Applied "${preset.label}" scenario preset.`, preset.label);
    }

    case 'reset_lab_experiment': {
      const target = (params.experimentId as LabExperimentId | undefined) ?? state.lab.activeExperiment;
      const meta = LAB_EXPERIMENTS_BY_ID[target];
      dispatch({ type: 'RESET_LAB_EXPERIMENT', experimentId: target });
      return succeed(`Reset ${meta?.shortTitle ?? target} to baseline parameters.`, 'Reset');
    }

    case 'capture_lab_baseline': {
      const target = (params.experimentId as LabExperimentId | undefined) ?? state.lab.activeExperiment;
      const label = String(params.label ?? 'Before Snapshot');
      const snap = buildLabBaselineSnapshot(target, state, label);
      dispatch({ type: 'CAPTURE_LAB_BASELINE', experimentId: target, baseline: snap });
      return succeed(`Captured "${label}" baseline for ${LAB_EXPERIMENTS_BY_ID[target].shortTitle}.`, 'Captured');
    }

    case 'toggle_lab_learn_panel': {
      const next =
        typeof params.open === 'boolean' ? params.open : !state.lab.learnScienceOpen;
      dispatch({ type: 'TOGGLE_LAB_LEARN_PANEL', open: next });
      return succeed(
        next ? 'Science explanation panel opened.' : 'Science explanation panel closed.',
        next ? 'Open' : 'Closed'
      );
    }

    case 'start_mission': {
      const diff = (state.mission.difficulty in DIFFICULTY_PROFILES
        ? state.mission.difficulty
        : 'medium') as MissionDifficulty;
      const profile = DIFFICULTY_PROFILES[diff];
      if (state.presentation.welcomeModalOpen) {
        dispatch({ type: 'UPDATE_PRESENTATION_STATE', patch: { welcomeModalOpen: false } });
      }
      dispatch({ type: 'SET_SCENE', scene: 'mission' });
      if (!state.mission.gameStarted) {
        dispatch({
          type: 'UPDATE_CITY_STATE',
          patch: {
            rainfallIntensity: profile.initialSetup.rainfallIntensity,
            reservoirStoragePct: profile.initialSetup.reservoirStoragePct,
            recyclingCapacityPct: profile.initialSetup.recyclingCapacityPct,
            demandMultiplier: profile.initialSetup.demandMultiplier,
            groundwaterExtractionPct: profile.initialSetup.groundwaterExtractionPct,
          },
        });
        if (profile.initialSetup.leakActive && !state.city.leak.active) {
          dispatch({
            type: 'TRIGGER_CITY_LEAK',
            locationId: 'pipe-distribution',
            severityLph: profile.initialSetup.leakSeverityLph,
          });
        }
      }
      dispatch({ type: 'UPDATE_MISSION_STATE', patch: { gameStarted: true } });
      return succeed(`Save the City mission started (${profile.label}).`, 'Mission Start');
    }

    case 'select_mission_stage': {
      const stageId = String(params.stageId ?? '') as MissionStageId;
      const meta = MISSION_STAGES.find((s) => s.id === stageId);
      if (!meta) return fail('Invalid or missing mission stageId.', 'INVALID_PARAM');
      if (state.currentScene !== 'mission') {
        dispatch({ type: 'SET_SCENE', scene: 'mission' });
      }
      if (
        stageId === 'stop-leaks' &&
        !state.city.leak.active &&
        !state.mission.completedStages.includes('stop-leaks')
      ) {
        const profile = DIFFICULTY_PROFILES[state.mission.difficulty] ?? DIFFICULTY_PROFILES.medium;
        dispatch({
          type: 'TRIGGER_CITY_LEAK',
          locationId: 'pipe-distribution',
          severityLph: profile.initialSetup.leakSeverityLph,
        });
      }
      dispatch({
        type: 'UPDATE_MISSION_STATE',
        patch: { activeStageId: stageId, evaluationNote: null, gameStarted: true },
      });
      return succeed(`Switched to Mission ${meta.number}: ${meta.title}.`, meta.title);
    }

    case 'set_mission_difficulty': {
      const rawDiff = String(params.difficulty ?? 'medium').toLowerCase() as MissionDifficulty;
      if (rawDiff !== 'easy' && rawDiff !== 'medium' && rawDiff !== 'hard') {
        return fail('Difficulty must be easy, medium, or hard.', 'INVALID_ENUM');
      }
      const profile = DIFFICULTY_PROFILES[rawDiff];
      dispatch({
        type: 'UPDATE_CITY_STATE',
        patch: {
          rainfallIntensity: profile.initialSetup.rainfallIntensity,
          reservoirStoragePct: profile.initialSetup.reservoirStoragePct,
          recyclingCapacityPct: profile.initialSetup.recyclingCapacityPct,
          demandMultiplier: profile.initialSetup.demandMultiplier,
          groundwaterExtractionPct: profile.initialSetup.groundwaterExtractionPct,
        },
      });
      if (profile.initialSetup.leakActive) {
        dispatch({
          type: 'TRIGGER_CITY_LEAK',
          locationId: 'pipe-distribution',
          severityLph: profile.initialSetup.leakSeverityLph,
        });
      }
      dispatch({
        type: 'UPDATE_MISSION_STATE',
        patch: {
          difficulty: rawDiff,
          evaluationNote: `Difficulty configured to ${profile.label}. Crisis parameters updated.`,
        },
      });
      return succeed(`Mission difficulty set to ${profile.label}.`, profile.label);
    }

    case 'evaluate_mission': {
      const stageId = String(params.stageId ?? state.mission.activeStageId) as MissionStageId;
      const meta = MISSION_STAGES.find((s) => s.id === stageId);
      if (!meta) return fail('Unknown mission stageId.', 'INVALID_PARAM');

      const evalRes = evaluateMissionStage(
        stageId,
        state.city,
        state.underground,
        state.mission
      );
      const alreadyCompleted = state.mission.completedStages.includes(stageId);
      const nextCompleted =
        evalRes.passed && !alreadyCompleted
          ? [...state.mission.completedStages, stageId]
          : state.mission.completedStages;
      const pointsToAdd = evalRes.passed && !alreadyCompleted ? evalRes.pointsEarned : 0;
      const nextScore = state.mission.score + pointsToAdd;
      const gameCompleted = nextCompleted.length >= MISSION_STAGES.length;

      // Track conservation water saved based on active recycling + rainwater when stage passes
      const cityM = computeCityMetrics(state.city);
      const bonusWaterSavedLitres =
        evalRes.passed && !alreadyCompleted
          ? Math.round((cityM.recycledSupplyMLd + cityM.rainwaterCollectedMLd) * 1000)
          : 0;

      dispatch({
        type: 'UPDATE_MISSION_STATE',
        patch: {
          completedStages: nextCompleted,
          score: nextScore,
          waterSavedLitres: state.mission.waterSavedLitres + bonusWaterSavedLitres,
          stageAttempts: state.mission.stageAttempts + 1,
          gameCompleted,
          evaluationNote: evalRes.feedback,
        },
      });
      return succeed(
        evalRes.feedback,
        evalRes.passed ? (alreadyCompleted ? 'Cleared' : `+${pointsToAdd} PTS`) : 'Review',
        {
          stageId,
          passed: evalRes.passed,
          pointsEarned: pointsToAdd,
          totalScore: nextScore,
          unmetReasons: evalRes.unmetReasons,
        }
      );
    }

    case 'reset_mission': {
      const diff = (state.mission.difficulty in DIFFICULTY_PROFILES
        ? state.mission.difficulty
        : 'medium') as MissionDifficulty;
      const profile = DIFFICULTY_PROFILES[diff];
      dispatch({
        type: 'UPDATE_CITY_STATE',
        patch: {
          rainfallIntensity: profile.initialSetup.rainfallIntensity,
          reservoirStoragePct: profile.initialSetup.reservoirStoragePct,
          recyclingCapacityPct: profile.initialSetup.recyclingCapacityPct,
          demandMultiplier: profile.initialSetup.demandMultiplier,
          groundwaterExtractionPct: profile.initialSetup.groundwaterExtractionPct,
          leak: {
            active: profile.initialSetup.leakActive,
            locationId: 'pipe-distribution',
            severityLph: profile.initialSetup.leakSeverityLph,
            accumulatedLossLitres: 0,
            repairedCount: 0,
            lastBeforeLossLph: 0,
          },
        },
      });
      dispatch({
        type: 'UPDATE_MISSION_STATE',
        patch: {
          ...createDefaultMissionState(),
          difficulty: diff,
          gameStarted: true,
          evaluationNote: `Mission reset under ${profile.label} difficulty. Ready for Stage 1.`,
        },
      });
      return succeed(`Save the City mission reset (${profile.label}).`, 'Mission Reset');
    }

    case 'start_presentation':
      dispatch({ type: 'TOGGLE_EXHIBITION_MODE', value: true });
      dispatch({ type: 'SET_SCENE', scene: 'exhibition' });
      dispatch({
        type: 'UPDATE_PRESENTATION_STATE',
        patch: {
          active: true,
          activeChapterIndex: 0,
          welcomeModalOpen: false,
          isPlaying: true,
          narrationActive: state.aqua.ttsSupported,
        },
      });
      return succeed('Exhibition Presentation Mode started.', 'Presentation');

    case 'exit_presentation':
      dispatch({ type: 'TOGGLE_EXHIBITION_MODE', value: false });
      if (state.currentScene === 'exhibition') {
        dispatch({ type: 'SET_SCENE', scene: 'earth' });
      }
      dispatch({
        type: 'UPDATE_PRESENTATION_STATE',
        patch: { active: false, isPlaying: false, narrationActive: false, welcomeModalOpen: false },
      });
      return succeed('Exited presentation mode.', 'Normal Mode');

    case 'next_chapter': {
      const nextIdx = Math.min(
        PRESENTATION_CHAPTERS.length - 1,
        state.presentation.activeChapterIndex + 1
      );
      const ch = PRESENTATION_CHAPTERS[nextIdx];
      dispatch({
        type: 'UPDATE_PRESENTATION_STATE',
        patch: { active: true, activeChapterIndex: nextIdx, welcomeModalOpen: false },
      });
      if (ch.sceneTarget && ch.sceneTarget !== 'exhibition') {
        dispatch({ type: 'SET_SCENE', scene: ch.sceneTarget });
      }
      return succeed(`Chapter ${ch.number + 1}/${PRESENTATION_CHAPTERS.length}: ${ch.title}`, ch.title);
    }

    case 'prev_chapter': {
      const prevIdx = Math.max(0, state.presentation.activeChapterIndex - 1);
      const ch = PRESENTATION_CHAPTERS[prevIdx];
      dispatch({
        type: 'UPDATE_PRESENTATION_STATE',
        patch: { active: true, activeChapterIndex: prevIdx, welcomeModalOpen: false },
      });
      if (ch.sceneTarget && ch.sceneTarget !== 'exhibition') {
        dispatch({ type: 'SET_SCENE', scene: ch.sceneTarget });
      }
      return succeed(`Chapter ${ch.number + 1}/${PRESENTATION_CHAPTERS.length}: ${ch.title}`, ch.title);
    }

    case 'jump_chapter': {
      const idx = Number(params.index ?? params.chapterIndex ?? 0);
      const clamped = Number.isFinite(idx)
        ? Math.max(0, Math.min(PRESENTATION_CHAPTERS.length - 1, Math.round(idx)))
        : 0;
      const ch = PRESENTATION_CHAPTERS[clamped];
      dispatch({
        type: 'UPDATE_PRESENTATION_STATE',
        patch: { active: true, activeChapterIndex: clamped, welcomeModalOpen: false },
      });
      if (ch.sceneTarget && ch.sceneTarget !== 'exhibition') {
        dispatch({ type: 'SET_SCENE', scene: ch.sceneTarget });
      }
      return succeed(`Jumped to Chapter ${ch.number + 1}: ${ch.title}`, ch.title);
    }

    case 'toggle_presentation_play': {
      const next =
        typeof params.playing === 'boolean'
          ? params.playing
          : !state.presentation.isPlaying;
      dispatch({ type: 'UPDATE_PRESENTATION_STATE', patch: { isPlaying: next } });
      return succeed(
        next ? 'Presentation auto-play running.' : 'Presentation paused.',
        next ? 'Playing' : 'Paused'
      );
    }

    case 'toggle_narration': {
      const next =
        typeof params.active === 'boolean'
          ? params.active
          : !state.presentation.narrationActive;
      dispatch({ type: 'UPDATE_PRESENTATION_STATE', patch: { narrationActive: next } });
      return succeed(
        next ? 'Spoken narration enabled.' : 'Spoken narration muted.',
        next ? 'Narration On' : 'Muted'
      );
    }

    case 'toggle_welcome_screen': {
      const next =
        typeof params.open === 'boolean'
          ? params.open
          : !state.presentation.welcomeModalOpen;
      dispatch({ type: 'UPDATE_PRESENTATION_STATE', patch: { welcomeModalOpen: next } });
      return succeed(next ? 'Exhibition welcome screen opened.' : 'Welcome screen closed.');
    }

    case 'update_presentation_state': {
      dispatch({ type: 'UPDATE_PRESENTATION_STATE', patch: params as any });
      return succeed('Presentation state updated.');
    }

    default: {
      // TypeScript exhaustiveness guard
      const exhaustiveCheck: never = actionName;
      if (!isFiniteNumber(0)) return fail(`Unsupported action ${String(exhaustiveCheck)}`);
      return fail(`Unsupported action "${String(exhaustiveCheck)}".`);
    }
  }
}
