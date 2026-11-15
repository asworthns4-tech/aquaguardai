import React from 'react';
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Camera,
  ChevronLeft,
  ChevronRight,
  Droplets,
  Eye,
  EyeOff,
  FlaskConical,
  Gauge,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ShieldAlert,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react';
import { LAB_EXPERIMENTS, LAB_EXPERIMENTS_BY_ID } from '../data/labExperimentsData';
import { ScienceLabScene } from '../scenes/ScienceLabScene';
import {
  computeFiltrationLabModel,
  computeLabComparison,
  computeLabExperimentOutput,
} from '../services/labSimulationEngine';
import { useAppState } from '../state/appStore';
import { SoilPermeabilityLevel } from '../types/exhibition';

interface SliderControlSpec {
  key: string;
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
}

const STATUS_BADGE_CLASSES: Record<'optimal' | 'caution' | 'critical', string> = {
  optimal: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
  caution: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
  critical: 'border-rose-400/40 bg-rose-500/20 text-rose-200',
};

const CARD_VALUE_CLASSES: Record<'optimal' | 'caution' | 'critical' | 'neutral', string> = {
  optimal: 'text-emerald-300',
  caution: 'text-amber-300',
  critical: 'text-rose-300',
  neutral: 'text-cyan-200',
};

export const ScienceLabView: React.FC = () => {
  const { state, dispatchAction } = useAppState();
  const activeId = state.lab.activeExperiment;
  const meta = LAB_EXPERIMENTS_BY_ID[activeId];
  const output = computeLabExperimentOutput(activeId, state);
  const comparison = computeLabComparison(activeId, state);
  const filtrationDetail = activeId === 'water-filtration' ? computeFiltrationLabModel(state.lab) : null;

  const selectedEquipNode = state.selectedObject
    ? meta.equipmentNodes.find((n) => n.id === state.selectedObject?.id) ?? null
    : null;

  // Build slider specs tailored to the active station (wired strictly to shared state)
  const sliders: SliderControlSpec[] = (() => {
    switch (activeId) {
      case 'water-cycle':
        return [
          {
            key: 'temperatureC',
            label: 'Ambient Temperature',
            value: state.lab.waterCycle.temperatureC,
            displayValue: `${state.lab.waterCycle.temperatureC} °C`,
            min: 10,
            max: 42,
            step: 1,
          },
          {
            key: 'solarIntensityPct',
            label: 'Solar Radiation Intensity',
            value: state.lab.waterCycle.solarIntensityPct,
            displayValue: `${state.lab.waterCycle.solarIntensityPct}%`,
            min: 20,
            max: 100,
            step: 2,
          },
          {
            key: 'rainfallIntensity',
            label: 'Rainfall Intensity (Shared)',
            value: state.city.rainfallIntensity,
            displayValue: `${state.city.rainfallIntensity} mm`,
            min: 0,
            max: 120,
            step: 2,
          },
          {
            key: 'cloudFormationRatePct',
            label: 'Cloud Condensation Rate',
            value: state.lab.waterCycle.cloudFormationRatePct,
            displayValue: `${state.lab.waterCycle.cloudFormationRatePct}%`,
            min: 20,
            max: 100,
            step: 2,
          },
        ];

      case 'rainwater-harvesting':
        return [
          {
            key: 'rainfallMm',
            label: 'Design Rainfall Event',
            value: state.city.rainwater.rainfallMm,
            displayValue: `${state.city.rainwater.rainfallMm} mm`,
            min: 0,
            max: 150,
            step: 5,
          },
          {
            key: 'roofAreaM2',
            label: 'Roof Catchment Area',
            value: state.city.rainwater.roofAreaM2,
            displayValue: `${state.city.rainwater.roofAreaM2} m²`,
            min: 50,
            max: 1200,
            step: 25,
          },
          {
            key: 'runoffCoeff',
            label: 'Runoff Coefficient (Roof Type)',
            value: state.city.rainwater.runoffCoeff,
            displayValue: state.city.rainwater.runoffCoeff.toFixed(2),
            min: 0.5,
            max: 0.95,
            step: 0.05,
          },
          {
            key: 'firstFlushMm',
            label: 'First-Flush Diversion',
            value: state.lab.rainwaterExtra.firstFlushMm,
            displayValue: `${state.lab.rainwaterExtra.firstFlushMm.toFixed(1)} mm`,
            min: 0,
            max: 4,
            step: 0.5,
          },
          {
            key: 'filterEfficiencyPct',
            label: 'Filter Pass Efficiency',
            value: state.lab.rainwaterExtra.filterEfficiencyPct,
            displayValue: `${state.lab.rainwaterExtra.filterEfficiencyPct}%`,
            min: 60,
            max: 98,
            step: 2,
          },
          {
            key: 'tankCapacityLitres',
            label: 'Storage Cistern Capacity',
            value: state.city.rainwater.tankCapacityLitres,
            displayValue: `${state.city.rainwater.tankCapacityLitres.toLocaleString()} L`,
            min: 5000,
            max: 60000,
            step: 2500,
          },
        ];

      case 'groundwater-depletion':
        return [
          {
            key: 'groundwaterExtractionPct',
            label: 'Pumping Extraction Pressure (Shared)',
            value: state.city.groundwaterExtractionPct,
            displayValue: `${state.city.groundwaterExtractionPct}%`,
            min: 5,
            max: 95,
            step: 2,
          },
          {
            key: 'rainfallIntensity',
            label: 'Monsoon Rainfall Supply (Shared)',
            value: state.city.rainfallIntensity,
            displayValue: `${state.city.rainfallIntensity} mm`,
            min: 0,
            max: 120,
            step: 2,
          },
          {
            key: 'groundwaterHorizonYears',
            label: 'Projection Time Horizon',
            value: state.lab.groundwaterHorizonYears,
            displayValue: `${state.lab.groundwaterHorizonYears} yrs`,
            min: 1,
            max: 25,
            step: 1,
          },
        ];

      case 'pipeline-leakage':
        return [
          {
            key: 'pipelinePressureBar',
            label: 'Trunk Line Pressure (Shared)',
            value: state.city.pipelinePressureBar,
            displayValue: `${state.city.pipelinePressureBar.toFixed(1)} bar`,
            min: 2.0,
            max: 6.5,
            step: 0.1,
          },
          {
            key: 'leakOrificeMm',
            label: 'Crack / Orifice Diameter',
            value: state.lab.leakSim.leakOrificeMm,
            displayValue: `${state.lab.leakSim.leakOrificeMm} mm`,
            min: 4,
            max: 36,
            step: 2,
          },
          {
            key: 'leakCount',
            label: 'Active Burst Points',
            value: state.city.leak.active ? state.lab.leakSim.leakCount : 0,
            displayValue: `${state.city.leak.active ? state.lab.leakSim.leakCount : 0} leaks`,
            min: 0,
            max: 6,
            step: 1,
          },
          {
            key: 'supplyFlowLph',
            label: 'Supply Header Input Flow',
            value: state.lab.leakSim.supplyFlowLph,
            displayValue: `${state.lab.leakSim.supplyFlowLph.toLocaleString()} L/hr`,
            min: 40000,
            max: 240000,
            step: 5000,
          },
        ];

      case 'water-filtration':
        return [
          {
            key: 'initialTurbidityNtu',
            label: 'Raw Source Water Turbidity',
            value: state.lab.filtration.initialTurbidityNtu,
            displayValue: `${state.lab.filtration.initialTurbidityNtu} NTU`,
            min: 15,
            max: 300,
            step: 5,
          },
          {
            key: 'flowRateLpm',
            label: 'Filtration Flow Rate',
            value: state.lab.filtration.flowRateLpm,
            displayValue: `${state.lab.filtration.flowRateLpm} L/min`,
            min: 5,
            max: 60,
            step: 1,
          },
          {
            key: 'filterConditionPct',
            label: 'Sand & Gravel Condition',
            value: state.lab.filtration.filterConditionPct,
            displayValue: `${state.lab.filtration.filterConditionPct}%`,
            min: 25,
            max: 100,
            step: 2,
          },
          {
            key: 'sedimentationMin',
            label: 'Sedimentation Settling Time',
            value: state.lab.filtration.sedimentationMin,
            displayValue: `${state.lab.filtration.sedimentationMin} min`,
            min: 5,
            max: 90,
            step: 5,
          },
          {
            key: 'carbonEfficiencyPct',
            label: 'Activated Carbon Capacity',
            value: state.lab.filtration.carbonEfficiencyPct,
            displayValue: `${state.lab.filtration.carbonEfficiencyPct}%`,
            min: 40,
            max: 99,
            step: 2,
          },
        ];

      case 'desalination':
        return [
          {
            key: 'salinityGpl',
            label: 'Feed Seawater Salinity',
            value: state.lab.desalination.salinityGpl,
            displayValue: `${state.lab.desalination.salinityGpl} g/L`,
            min: 20,
            max: 48,
            step: 1,
          },
          {
            key: 'feedPressureBar',
            label: 'RO Pump Feed Pressure',
            value: state.lab.desalination.feedPressureBar,
            displayValue: `${state.lab.desalination.feedPressureBar} bar`,
            min: 35,
            max: 80,
            step: 1,
          },
          {
            key: 'recoveryRatePct',
            label: 'Target Membrane Recovery',
            value: state.lab.desalination.recoveryRatePct,
            displayValue: `${state.lab.desalination.recoveryRatePct}%`,
            min: 25,
            max: 55,
            step: 1,
          },
          {
            key: 'feedVolumeM3',
            label: 'Seawater Feed Batch',
            value: state.lab.desalination.feedVolumeM3,
            displayValue: `${state.lab.desalination.feedVolumeM3} m³`,
            min: 10,
            max: 200,
            step: 10,
          },
          {
            key: 'energyFactor',
            label: 'Pump Energy Recovery Factor',
            value: state.lab.desalination.energyFactor,
            displayValue: `${state.lab.desalination.energyFactor.toFixed(2)}×`,
            min: 0.85,
            max: 1.35,
            step: 0.05,
          },
        ];

      case 'supply-demand':
        return [
          {
            key: 'population',
            label: 'City Population (Shared)',
            value: state.city.population,
            displayValue: state.city.population.toLocaleString(),
            min: 50000,
            max: 400000,
            step: 5000,
          },
          {
            key: 'perCapitaLpd',
            label: 'Per-Person Demand (Shared)',
            value: Math.round(state.city.demandMultiplier * 135),
            displayValue: `${Math.round(state.city.demandMultiplier * 135)} L/day`,
            min: 75,
            max: 215,
            step: 5,
          },
          {
            key: 'industrialDemandMLd',
            label: 'Industrial Sector Demand',
            value: state.lab.supplyDemandExtra.industrialDemandMLd,
            displayValue: `${state.lab.supplyDemandExtra.industrialDemandMLd.toFixed(1)} ML/d`,
            min: 1,
            max: 18,
            step: 0.5,
          },
          {
            key: 'commercialDemandMLd',
            label: 'Commercial & Civic Demand',
            value: state.lab.supplyDemandExtra.commercialDemandMLd,
            displayValue: `${state.lab.supplyDemandExtra.commercialDemandMLd.toFixed(1)} ML/d`,
            min: 0.5,
            max: 12,
            step: 0.5,
          },
          {
            key: 'availableSupplyMLd',
            label: 'Treatment & Intake Supply',
            value: state.lab.supplyDemandExtra.availableSupplyMLd,
            displayValue: `${state.lab.supplyDemandExtra.availableSupplyMLd.toFixed(1)} ML/d`,
            min: 10,
            max: 65,
            step: 1,
          },
          {
            key: 'distributionLossPct',
            label: 'Distribution Network Loss',
            value: state.lab.supplyDemandExtra.distributionLossPct,
            displayValue: `${state.lab.supplyDemandExtra.distributionLossPct}%`,
            min: 3,
            max: 35,
            step: 1,
          },
        ];

      case 'smart-city-management':
        return [
          {
            key: 'recyclingCapacityPct',
            label: 'Wastewater Recycling Rate (Shared)',
            value: state.city.recyclingCapacityPct,
            displayValue: `${state.city.recyclingCapacityPct}%`,
            min: 0,
            max: 85,
            step: 2,
          },
          {
            key: 'perCapitaLpd',
            label: 'Urban Water Demand (Shared)',
            value: Math.round(state.city.demandMultiplier * 135),
            displayValue: `${Math.round(state.city.demandMultiplier * 135)} L/day`,
            min: 80,
            max: 210,
            step: 5,
          },
          {
            key: 'groundwaterExtractionPct',
            label: 'Groundwater Pumping (Shared)',
            value: state.city.groundwaterExtractionPct,
            displayValue: `${state.city.groundwaterExtractionPct}%`,
            min: 5,
            max: 95,
            step: 2,
          },
          {
            key: 'rainfallIntensity',
            label: 'Rainfall Intensity (Shared)',
            value: state.city.rainfallIntensity,
            displayValue: `${state.city.rainfallIntensity} mm`,
            min: 0,
            max: 120,
            step: 2,
          },
          {
            key: 'reservoirStoragePct',
            label: 'Reservoir Level (Shared)',
            value: state.city.reservoirStoragePct,
            displayValue: `${state.city.reservoirStoragePct}%`,
            min: 10,
            max: 100,
            step: 2,
          },
        ];
    }
  })();

  const handleSliderChange = (key: string, value: number) => {
    dispatchAction('set_lab_param', { key, value }, 'mouse');
  };

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#040a14]">
      {/* 3D Interactive Science Lab Viewport */}
      <ScienceLabScene />

      {/* Top Experiment Selector Strip + Quick Toolbar */}
      <div className="pointer-events-none absolute top-3 right-3 left-3 z-10 flex flex-col gap-2">
        <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-xl border border-cyan-500/20 bg-[#061121]/92 px-3 py-2 shadow-xl">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/30 bg-cyan-500/15 text-cyan-300 shrink-0">
              <FlaskConical className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-medium uppercase tracking-wider text-cyan-300/85">
                AquaGuard AI · The Living Planet · Module 04 · Simulated Model
              </div>
              <div className="truncate font-display text-sm font-semibold text-white">
                Station {meta.number}: {meta.title}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() =>
                dispatchAction('cycle_lab_experiment', { direction: 'prev' }, 'mouse')
              }
              title="Previous Experiment"
              className="rounded-md border border-white/10 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchAction('cycle_lab_experiment', { direction: 'next' }, 'mouse')
              }
              title="Next Experiment"
              className="rounded-md border border-white/10 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() =>
                dispatchAction(
                  state.simulationParams.running ? 'pause_simulation' : 'resume_simulation',
                  {},
                  'mouse'
                )
              }
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${
                state.simulationParams.running
                  ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                  : 'border-amber-400/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
              }`}
            >
              {state.simulationParams.running ? (
                <>
                  <Pause className="h-3 w-3" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  <span>Play</span>
                </>
              )}
            </button>

            {[0.5, 1, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() =>
                  dispatchAction('set_simulation_speed', { speed: spd }, 'mouse')
                }
                className={`rounded-md border px-1.5 py-1 font-mono-tabular text-[11px] transition-colors ${
                  state.simulationParams.speed === spd
                    ? 'border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                }`}
              >
                {spd}×
              </button>
            ))}

            <button
              type="button"
              onClick={() =>
                dispatchAction('capture_lab_baseline', { experimentId: activeId }, 'mouse')
              }
              title="Capture current state as Before snapshot"
              className="flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/10 px-2 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors"
            >
              <Camera className="h-3 w-3" />
              <span className="hidden sm:inline">Capture Before</span>
            </button>

            <button
              type="button"
              onClick={() =>
                dispatchAction('reset_lab_experiment', { experimentId: activeId }, 'mouse')
              }
              title="Reset active experiment"
              className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-3 w-3" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('rotate_scene', {}, 'mouse')}
              title="Toggle 3D Camera Auto-Rotate (Space)"
              className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors ${
                state.lab.labAutoRotate
                  ? 'border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              <RotateCw className="h-3 w-3" />
              <span className="hidden md:inline">Orbit</span>
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('reset_camera', {}, 'mouse')}
              title="Reset 3D Camera View (R)"
              className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10 transition-colors"
            >
              View
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('toggle_lab_learn_panel', {}, 'mouse')}
              className={`flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                state.lab.learnScienceOpen
                  ? 'border-cyan-400/50 bg-cyan-500/25 text-white'
                  : 'border-cyan-400/35 bg-cyan-500/15 text-cyan-200 hover:bg-cyan-500/25'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Learn Science</span>
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('toggle_controls_collapsed', {}, 'mouse')}
              title="Hide/Show Lab Panels (H)"
              className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-200 hover:bg-white/10 transition-colors"
            >
              {state.controlsCollapsed ? (
                <Eye className="h-3.5 w-3.5" />
              ) : (
                <EyeOff className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* 8 Experiment Stations Selector Strip */}
        <div className="pointer-events-auto aqua-scroll flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {LAB_EXPERIMENTS.map((exp) => {
            const isSelected = exp.id === activeId;
            return (
              <button
                key={exp.id}
                type="button"
                onClick={() =>
                  dispatchAction('select_lab_experiment', { experimentId: exp.id }, 'mouse')
                }
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isSelected
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-white shadow-md'
                    : 'border-white/10 bg-[#061121]/90 text-slate-300 hover:border-cyan-400/30 hover:text-white'
                }`}
              >
                <span className="font-mono-tabular text-[11px] text-cyan-300">{exp.number}</span>
                <span>{exp.shortTitle}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => dispatchAction('navigate_to_simulations', {}, 'mouse')}
            className="ml-auto flex items-center gap-1 rounded-lg border border-indigo-400/30 bg-indigo-500/15 px-2.5 py-1.5 text-xs font-medium text-indigo-200 hover:bg-indigo-500/25 whitespace-nowrap shrink-0 transition-colors"
          >
            <Gauge className="h-3.5 w-3.5" />
            <span>Module 05 Workbench</span>
          </button>
        </div>
      </div>

      {/* Main Left & Right Experiment Panels (Hidden when collapsed or infoPanelOpen=false) */}
      {!state.controlsCollapsed && state.infoPanelOpen && (
        <div className="pointer-events-none absolute inset-x-3 top-28 bottom-3 z-10 flex flex-col justify-between gap-3 lg:flex-row lg:items-stretch">
          {/* LEFT PANEL: Experiment Controls & Presets */}
          <section
            aria-label="Experiment Controls"
            className="pointer-events-auto aqua-scroll flex max-h-[46vh] w-full flex-col overflow-y-auto rounded-xl border border-cyan-500/20 bg-[#061121]/92 p-3.5 shadow-2xl lg:max-h-full lg:w-[348px]"
          >
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2.5">
              <div>
                <div className="text-[11px] text-cyan-300">{meta.category} Station</div>
                <h2 className="font-display text-sm font-semibold text-white">{meta.shortTitle}</h2>
                <p className="mt-0.5 text-[11px] leading-snug text-slate-400">{meta.subtitle}</p>
              </div>
              <span
                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold shrink-0 ${STATUS_BADGE_CLASSES[output.statusTone]}`}
              >
                {output.statusTone === 'optimal'
                  ? 'Optimal'
                  : output.statusTone === 'caution'
                    ? 'Caution'
                    : 'Alert'}
              </span>
            </div>

            {/* Scenario Presets */}
            <div className="mt-3 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-medium text-slate-300">
                <span>Quick Test Scenarios</span>
                <SlidersHorizontal className="h-3 w-3 text-cyan-400" />
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {meta.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      dispatchAction(
                        'apply_lab_preset',
                        { experimentId: activeId, presetId: preset.id },
                        'mouse'
                      )
                    }
                    className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
                  >
                    <div className="text-xs font-medium text-white">{preset.label}</div>
                    <div className="text-[10px] text-slate-400">{preset.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Primary Gesture Step Control */}
            <div className="mt-3 flex items-center justify-between rounded-lg border border-cyan-500/20 bg-cyan-500/10 px-2.5 py-2">
              <div className="min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-cyan-300">
                  Gesture / Quick Step Target
                </div>
                <div className="truncate text-xs font-medium text-white">
                  {meta.primaryGestureParam.label} (±{meta.primaryGestureParam.step}{' '}
                  {meta.primaryGestureParam.unit})
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    dispatchAction('adjust_lab_param_step', { direction: 'down' }, 'mouse')
                  }
                  className="rounded border border-white/15 bg-[#040a14] px-2 py-0.5 font-mono-tabular text-xs font-semibold text-white hover:border-cyan-400"
                >
                  −
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatchAction('adjust_lab_param_step', { direction: 'up' }, 'mouse')
                  }
                  className="rounded border border-white/15 bg-[#040a14] px-2 py-0.5 font-mono-tabular text-xs font-semibold text-white hover:border-cyan-400"
                >
                  +
                </button>
              </div>
            </div>

            {/* Sliders */}
            <div className="mt-3.5 space-y-3 border-t border-white/10 pt-3">
              {sliders.map((ctrl) => (
                <div key={ctrl.key} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-200">{ctrl.label}</span>
                    <span className="font-mono-tabular font-semibold text-cyan-200">
                      {ctrl.displayValue}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    step={ctrl.step}
                    value={ctrl.value}
                    onChange={(e) => handleSliderChange(ctrl.key, Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              ))}
            </div>

            {/* Station-Specific Action Buttons */}
            {activeId === 'rainwater-harvesting' && (
              <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => dispatchAction('collect_rainwater_cistern', {}, 'mouse')}
                  className="flex-1 rounded-lg border border-cyan-400/35 bg-cyan-500/20 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 transition-colors"
                >
                  Collect Into Cistern
                </button>
                <button
                  type="button"
                  onClick={() => dispatchAction('drain_rainwater_cistern', {}, 'mouse')}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Drain
                </button>
              </div>
            )}

            {activeId === 'groundwater-depletion' && (
              <div className="mt-3 space-y-2.5 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-300">Soil Permeability (Shared Underground)</span>
                  <span className="font-semibold capitalize text-cyan-200">
                    {state.underground.soilPermeability}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {(['low', 'medium', 'high'] as SoilPermeabilityLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() =>
                        dispatchAction('set_soil_permeability', { level: lvl }, 'mouse')
                      }
                      className={`rounded-md border py-1 text-[11px] font-medium capitalize transition-colors ${
                        state.underground.soilPermeability === lvl
                          ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                          : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Open Recharge Land Area</span>
                    <span className="font-mono-tabular text-cyan-200">
                      {state.underground.rechargeAreaPct}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={15}
                    max={95}
                    step={5}
                    value={state.underground.rechargeAreaPct}
                    onChange={(e) =>
                      dispatchAction(
                        'set_groundwater_recharge',
                        { pct: Number(e.target.value) },
                        'mouse'
                      )
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div className="space-y-1">
                  <div className="text-[11px] text-slate-300">Connected Wells (Phase 3 Sync)</div>
                  <div className="grid grid-cols-1 gap-1">
                    {state.underground.wells.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() =>
                          dispatchAction('toggle_well', { wellId: w.id }, 'mouse')
                        }
                        className={`flex items-center justify-between rounded-md border px-2.5 py-1 text-[11px] transition-colors ${
                          w.active
                            ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-slate-400'
                        }`}
                      >
                        <span className="truncate">{w.name}</span>
                        <span className="font-mono-tabular ml-2 shrink-0">
                          {w.active ? 'ON' : 'OFF'} · {w.depthM}m
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeId === 'pipeline-leakage' && (
              <div className="mt-3 flex gap-2 border-t border-white/10 pt-3">
                {state.city.leak.active ? (
                  <button
                    type="button"
                    onClick={() => dispatchAction('repair_pipeline_leak', {}, 'mouse')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Repair All Pipelines</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      dispatchAction(
                        'create_pipeline_leak',
                        { locationId: 'pipe-distribution' },
                        'mouse'
                      )
                    }
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/20 py-1.5 text-xs font-semibold text-amber-100 hover:bg-amber-500/30 transition-colors"
                  >
                    <Droplets className="h-3.5 w-3.5" />
                    <span>Simulate Active Pipe Burst</span>
                  </button>
                )}
              </div>
            )}

            {activeId === 'smart-city-management' && (
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      state.city.leak.active
                        ? dispatchAction('repair_pipeline_leak', {}, 'mouse')
                        : dispatchAction('create_pipeline_leak', {}, 'mouse')
                    }
                    className={`flex-1 rounded-lg border py-1.5 text-xs font-semibold transition-colors ${
                      state.city.leak.active
                        ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-100'
                        : 'border-amber-400/35 bg-amber-500/15 text-amber-100'
                    }`}
                  >
                    {state.city.leak.active ? 'Repair Active Burst' : 'Trigger Burst Test'}
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchAction('navigate_to_city', {}, 'mouse')}
                    className="rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition-colors"
                  >
                    Open 3D City
                  </button>
                </div>
              </div>
            )}

            {/* Selected 3D Apparatus Readout */}
            {selectedEquipNode && (
              <div className="mt-3 rounded-lg border border-cyan-400/35 bg-cyan-500/10 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                    Selected 3D Apparatus
                  </span>
                  <button
                    type="button"
                    onClick={() => dispatchAction('clear_selection', {}, 'mouse')}
                    className="text-slate-400 hover:text-white"
                    aria-label="Clear selected apparatus"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-0.5 text-xs font-semibold text-white">
                  {selectedEquipNode.name}
                </div>
                <div className="text-[11px] text-cyan-200">{selectedEquipNode.role}</div>
                <p className="mt-1 text-[11px] leading-snug text-slate-300">
                  {selectedEquipNode.scienceDetail}
                </p>
              </div>
            )}
          </section>

          {/* RIGHT PANEL: Live Scientific Results & Before/After Comparison */}
          <section
            aria-label="Experiment Results Dashboard"
            className="pointer-events-auto aqua-scroll flex max-h-[44vh] w-full flex-col overflow-y-auto rounded-xl border border-cyan-500/20 bg-[#061121]/92 p-3.5 shadow-2xl lg:max-h-full lg:w-[376px]"
          >
            <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
              <div>
                <div className="text-[11px] text-slate-400">Simulated Laboratory Output</div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                  <Activity className="h-3.5 w-3.5 text-cyan-300" />
                  <span>{output.headlineStatus}</span>
                </div>
              </div>
              <span className="font-mono-tabular text-[11px] text-slate-400">
                t={state.lab.elapsedSeconds.toFixed(0)}s
              </span>
            </div>

            {/* 6 Quantitative Cards */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              {output.cards.map((c) => (
                <div
                  key={c.key}
                  className="rounded-lg border border-white/10 bg-[#040a14] p-2.5"
                >
                  <div className="text-[10px] text-slate-400 leading-tight">{c.label}</div>
                  <div
                    className={`mt-1 font-mono-tabular text-base font-semibold ${CARD_VALUE_CLASSES[c.status ?? 'neutral']}`}
                  >
                    {c.value}{' '}
                    <span className="text-[10px] font-normal text-slate-400">{c.unit}</span>
                  </div>
                  {c.hint && (
                    <div className="mt-0.5 text-[10px] text-slate-400 leading-tight">{c.hint}</div>
                  )}
                </div>
              ))}
            </div>

            {/* Filtration Mandatory Stage Table & Potable Water Safety Notice */}
            {filtrationDetail && (
              <div className="mt-3 space-y-2.5">
                <div className="rounded-lg border border-white/10 bg-[#040a14] p-2.5">
                  <div className="text-[11px] font-semibold text-cyan-300 mb-1.5">
                    Stage-by-Stage Clarification (NTU)
                  </div>
                  <div className="space-y-1">
                    {filtrationDetail.stageOutputs.map((st) => (
                      <div
                        key={st.stage}
                        className="flex items-center justify-between text-[11px] font-mono-tabular"
                      >
                        <span className="text-slate-300 font-sans">{st.stage}</span>
                        <span className="text-white">
                          {st.ntu.toFixed(1)} NTU{' '}
                          {st.removedFromPrevPct > 0 && (
                            <span className="text-emerald-300">
                              (−{st.removedFromPrevPct}%)
                            </span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {meta.safetyNotice && (
                  <div className="rounded-lg border border-amber-400/45 bg-amber-500/15 p-2.5 text-[11px] leading-snug text-amber-100">
                    <div className="flex items-center gap-1.5 font-semibold text-amber-200 mb-1">
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
                      <span>Potable Water Safety Notice</span>
                    </div>
                    {meta.safetyNotice}
                  </div>
                )}
              </div>
            )}

            {/* Formula Display */}
            <div className="mt-3 rounded-lg border border-cyan-500/20 bg-[#040a14] p-2.5">
              <div className="text-[10px] uppercase tracking-wider text-slate-400">
                Governing Equation
              </div>
              <div className="mt-1 font-mono-tabular text-[11px] leading-relaxed text-cyan-200">
                {meta.formulaDisplay}
              </div>
            </div>

            {/* Notes */}
            <div className="mt-2.5 space-y-1">
              {output.detailNotes.map((note) => (
                <p key={note} className="text-[11px] leading-snug text-slate-300">
                  • {note}
                </p>
              ))}
            </div>

            {/* Before vs After Baseline Comparison */}
            <div className="mt-3 rounded-lg border border-white/10 bg-[#040a14] p-2.5">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="text-[11px] font-semibold text-white">
                  Before vs After Comparison
                </div>
                <button
                  type="button"
                  onClick={() =>
                    dispatchAction(
                      'capture_lab_baseline',
                      { experimentId: activeId, label: 'User Snapshot' },
                      'mouse'
                    )
                  }
                  className="flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  <span>Set Before</span>
                </button>
              </div>
              {comparison.hasBaseline ? (
                <div className="space-y-1.5">
                  {comparison.rows.map((row) => (
                    <div
                      key={row.key}
                      className="flex items-center justify-between gap-2 text-[11px] border-t border-white/5 pt-1"
                    >
                      <span className="text-slate-300 truncate">{row.label}</span>
                      <div className="font-mono-tabular text-right shrink-0">
                        <span className="text-slate-400">{row.beforeVal}</span>
                        <span className="mx-1 text-slate-500">→</span>
                        <span className="text-white font-semibold">{row.afterVal}</span>
                        <span
                          className={`ml-1.5 text-[10px] ${
                            Math.abs(row.deltaNumeric) < 0.05
                              ? 'text-slate-500'
                              : row.deltaNumeric > 0
                                ? 'text-cyan-300'
                                : 'text-amber-300'
                          }`}
                        >
                          ({row.deltaText})
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-slate-400">
                  Capture a snapshot to compare parameter adjustments side by side.
                </p>
              )}
            </div>

            {/* Educational Disclaimer */}
            <div className="mt-3 flex items-start gap-1.5 border-t border-white/10 pt-2.5 text-[10px] leading-snug text-slate-400">
              <AlertTriangle className="h-3.5 w-3.5 text-slate-400 shrink-0 mt-0.5" />
              <span>{meta.disclaimer}</span>
            </div>
          </section>
        </div>
      )}

      {/* Compact Drag Hint when HUD collapsed */}
      {state.controlsCollapsed && (
        <div className="pointer-events-auto absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-lg border border-cyan-500/25 bg-[#061121]/92 px-3 py-2 text-xs text-slate-200 shadow-lg">
          <span>
            Station {meta.number}: {meta.shortTitle} · {output.headlineStatus}
          </span>
          <button
            type="button"
            onClick={() => dispatchAction('toggle_controls_collapsed', { collapsed: false }, 'mouse')}
            className="rounded border border-cyan-400/35 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/25"
          >
            Show Lab Panels
          </button>
        </div>
      )}

      {/* Expandable "Learn the Science" Drawer / Modal */}
      {state.lab.learnScienceOpen && (
        <div
          role="dialog"
          aria-label={`Scientific Guide: ${meta.title}`}
          className="fixed inset-0 z-30 flex items-center justify-center bg-black/70 p-4"
        >
          <div className="aqua-scroll max-h-[86vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-cyan-400/30 bg-[#061121] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <div className="text-xs font-medium text-cyan-300">
                  Scientific Guide · Experiment {meta.number}
                </div>
                <h2 className="mt-0.5 font-display text-2xl font-semibold text-white">
                  {meta.title}
                </h2>
                <p className="mt-1 text-xs text-slate-400">{meta.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => dispatchAction('toggle_lab_learn_panel', { open: false }, 'mouse')}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:text-white"
                aria-label="Close Science Explanation"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 space-y-5 text-xs leading-relaxed text-slate-200">
              {meta.safetyNotice && (
                <div className="rounded-xl border border-amber-400/50 bg-amber-500/15 p-3.5 text-amber-100">
                  <div className="flex items-center gap-2 font-semibold text-amber-200 mb-1">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Important Health &amp; Safety Notice</span>
                  </div>
                  <p>{meta.safetyNotice}</p>
                </div>
              )}

              <div>
                <h3 className="text-sm font-semibold text-cyan-300">Scientific Principle</h3>
                <p className="mt-1 text-slate-200">{meta.principle}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-cyan-300">Step-by-Step Process</h3>
                <ol className="mt-1.5 space-y-1.5 list-decimal list-inside text-slate-300">
                  {meta.processSteps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>

              <div className="rounded-xl border border-cyan-500/20 bg-[#040a14] p-4">
                <h3 className="text-sm font-semibold text-cyan-300">
                  Formula &amp; Calculation Method
                </h3>
                <div className="mt-2 rounded-lg bg-white/5 px-3 py-2 font-mono-tabular text-xs text-cyan-200">
                  {meta.formulaDisplay}
                </div>
                <p className="mt-2 text-slate-300">{meta.calculationMethod}</p>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-cyan-300">Variables &amp; Units</h3>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {meta.variables.map((v) => (
                    <div
                      key={v.symbol}
                      className="rounded-lg border border-white/10 bg-[#040a14] p-2.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-white">{v.name}</span>
                        <span className="font-mono-tabular text-[11px] text-cyan-300">
                          {v.symbol} ({v.unit})
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{v.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-white/10 bg-[#040a14] p-3">
                  <h4 className="font-semibold text-emerald-300">Model Assumptions</h4>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-300">
                    {meta.assumptions.map((a) => (
                      <li key={a}>• {a}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-lg border border-white/10 bg-[#040a14] p-3">
                  <h4 className="font-semibold text-amber-300">Scientific Limitations</h4>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-300">
                    {meta.limitations.map((l) => (
                      <li key={l}>• {l}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="rounded-lg border border-cyan-400/20 bg-cyan-500/5 p-3">
                <h4 className="font-semibold text-cyan-200">Exhibition Learning Outcomes</h4>
                <ul className="mt-1.5 space-y-1 text-[11px] text-slate-200">
                  {meta.learningOutcomes.map((lo) => (
                    <li key={lo}>• {lo}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
