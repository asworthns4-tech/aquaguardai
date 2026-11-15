import React, { useEffect } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Camera,
  CheckCircle2,
  Droplets,
  FlaskConical,
  Gauge,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Wrench,
} from 'lucide-react';
import { LAB_EXPERIMENTS, LAB_EXPERIMENTS_BY_ID } from '../data/labExperimentsData';
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
}

const TONE_PILL: Record<'optimal' | 'caution' | 'critical', string> = {
  optimal: 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200',
  caution: 'border-amber-400/35 bg-amber-500/15 text-amber-200',
  critical: 'border-rose-400/40 bg-rose-500/20 text-rose-200',
};

const VALUE_COLOR: Record<'optimal' | 'caution' | 'critical' | 'neutral', string> = {
  optimal: 'text-emerald-300',
  caution: 'text-amber-300',
  critical: 'text-rose-300',
  neutral: 'text-cyan-200',
};

export const WaterSimulationsView: React.FC = () => {
  const { state, dispatch, dispatchAction } = useAppState();

  useEffect(() => {
    if (!state.simulationParams.running || state.simulationParams.speed <= 0) return;
    const timer = window.setInterval(() => {
      dispatch({ type: 'TICK_LAB_EXPERIMENT', dt: 0.5 });
    }, 500);
    return () => window.clearInterval(timer);
  }, [dispatch, state.simulationParams.running, state.simulationParams.speed]);
  const activeId = state.lab.activeExperiment;
  const meta = LAB_EXPERIMENTS_BY_ID[activeId];
  const output = computeLabExperimentOutput(activeId, state);
  const comparison = computeLabComparison(activeId, state);
  const filtrationDetail = activeId === 'water-filtration' ? computeFiltrationLabModel(state.lab) : null;

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
            label: 'Runoff Coefficient (C)',
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
            label: 'Cistern Tank Capacity',
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
            label: 'Raw Source Turbidity',
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
            label: 'Media Cleanliness Condition',
            value: state.lab.filtration.filterConditionPct,
            displayValue: `${state.lab.filtration.filterConditionPct}%`,
            min: 25,
            max: 100,
            step: 2,
          },
          {
            key: 'sedimentationMin',
            label: 'Sedimentation Time',
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
            label: 'Seawater Salinity',
            value: state.lab.desalination.salinityGpl,
            displayValue: `${state.lab.desalination.salinityGpl} g/L`,
            min: 20,
            max: 48,
            step: 1,
          },
          {
            key: 'feedPressureBar',
            label: 'RO Feed Pressure',
            value: state.lab.desalination.feedPressureBar,
            displayValue: `${state.lab.desalination.feedPressureBar} bar`,
            min: 35,
            max: 80,
            step: 1,
          },
          {
            key: 'recoveryRatePct',
            label: 'Membrane Recovery Rate',
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
            label: 'Energy Recovery Factor',
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
            label: 'Per-Person Allowance (Shared)',
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
            label: 'Commercial Sector Demand',
            value: state.lab.supplyDemandExtra.commercialDemandMLd,
            displayValue: `${state.lab.supplyDemandExtra.commercialDemandMLd.toFixed(1)} ML/d`,
            min: 0.5,
            max: 12,
            step: 0.5,
          },
          {
            key: 'availableSupplyMLd',
            label: 'Available Municipal Supply',
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
            label: 'Wastewater Recycling (Shared)',
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
            label: 'Surface Reservoir (Shared)',
            value: state.city.reservoirStoragePct,
            displayValue: `${state.city.reservoirStoragePct}%`,
            min: 10,
            max: 100,
            step: 2,
          },
        ];
    }
  })();

  return (
    <div className="aqua-scroll h-full w-full overflow-y-auto bg-[#040a14] p-4 lg:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        {/* Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/20 bg-[#061121] p-5 shadow-xl">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-cyan-300">
              <Gauge className="h-4 w-4" />
              <span>AquaGuard AI · The Living Planet · Module 05 · Simulated Model</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white">
              Eight Interactive Water Simulations
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">
              Transparent equation-driven water engineering models synced directly with Future Smart
              City (Module 02), Underground Water World (Module 03), AQUA Science Lab (Module 04),
              gestures, and AQUA AI.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                dispatchAction('capture_lab_baseline', { experimentId: activeId }, 'mouse')
              }
              className="flex items-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors"
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Capture Before Snapshot</span>
            </button>
            <button
              type="button"
              onClick={() =>
                dispatchAction('reset_lab_experiment', { experimentId: activeId }, 'mouse')
              }
              className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset Model</span>
            </button>
            <button
              type="button"
              onClick={() => dispatchAction('navigate_to_lab', {}, 'mouse')}
              className="flex items-center gap-1.5 rounded-lg bg-cyan-500 px-3.5 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors"
            >
              <FlaskConical className="h-3.5 w-3.5" />
              <span>Open 3D Apparatus in Lab</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* 8 Simulations Selector Cards */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-8">
          {LAB_EXPERIMENTS.map((exp) => {
            const cardOut = computeLabExperimentOutput(exp.id, state);
            const active = exp.id === activeId;
            const leadCard = cardOut.cards[1] ?? cardOut.cards[0];
            return (
              <button
                key={exp.id}
                type="button"
                onClick={() =>
                  dispatchAction('select_lab_experiment', { experimentId: exp.id }, 'mouse')
                }
                className={`flex flex-col justify-between rounded-xl border p-3 text-left transition-colors ${
                  active
                    ? 'border-cyan-400/60 bg-cyan-500/15 shadow-lg'
                    : 'border-white/10 bg-[#061121] hover:border-cyan-400/35 hover:bg-white/5'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono-tabular">
                    <span className="text-cyan-300">{exp.number}</span>
                    <span className="text-slate-400">{exp.category}</span>
                  </div>
                  <div className="mt-1 text-xs font-semibold text-white leading-tight">
                    {exp.shortTitle}
                  </div>
                </div>
                <div className="mt-2.5 border-t border-white/10 pt-1.5 font-mono-tabular text-xs font-semibold text-cyan-200">
                  {leadCard.value}{' '}
                  <span className="text-[10px] font-normal text-slate-400">{leadCard.unit}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Main Simulation Workbench */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Left Column: Parameters & Scenarios */}
          <div className="space-y-4 rounded-2xl border border-cyan-500/20 bg-[#061121] p-5 lg:col-span-5">
            <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <div className="text-xs font-medium text-cyan-300">
                  Model {meta.number} · {meta.category}
                </div>
                <h2 className="mt-0.5 font-display text-xl font-semibold text-white">
                  {meta.title}
                </h2>
              </div>
              <span
                className={`rounded-md border px-2.5 py-0.5 text-[11px] font-semibold shrink-0 ${TONE_PILL[output.statusTone]}`}
              >
                {output.statusTone === 'optimal'
                  ? 'Optimal'
                  : output.statusTone === 'caution'
                    ? 'Caution'
                    : 'Critical'}
              </span>
            </div>

            {/* Scenario Presets */}
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-slate-300">Preset Test Cases</div>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3 lg:grid-cols-1">
                {meta.presets.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() =>
                      dispatchAction(
                        'apply_lab_preset',
                        { experimentId: activeId, presetId: p.id },
                        'mouse'
                      )
                    }
                    className="rounded-lg border border-white/10 bg-[#040a14] px-3 py-2 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
                  >
                    <div className="text-xs font-semibold text-white">{p.label}</div>
                    <div className="text-[11px] text-slate-400">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Parameter Sliders */}
            <div className="space-y-3 border-t border-white/10 pt-3">
              <div className="text-xs font-semibold text-cyan-300">Interactive Variables</div>
              {sliders.map((ctrl) => (
                <div key={ctrl.key} className="space-y-1">
                  <div className="flex justify-between text-xs">
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
                    onChange={(e) =>
                      dispatchAction(
                        'set_lab_param',
                        { key: ctrl.key, value: Number(e.target.value) },
                        'mouse'
                      )
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              ))}
            </div>

            {/* Model-Specific Interactive Actions */}
            {activeId === 'rainwater-harvesting' && (
              <div className="flex gap-2 border-t border-white/10 pt-3">
                <button
                  type="button"
                  onClick={() => dispatchAction('collect_rainwater_cistern', {}, 'mouse')}
                  className="flex-1 rounded-lg border border-cyan-400/35 bg-cyan-500/20 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30"
                >
                  Collect Into Cistern
                </button>
                <button
                  type="button"
                  onClick={() => dispatchAction('drain_rainwater_cistern', {}, 'mouse')}
                  className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-slate-300 hover:bg-white/10"
                >
                  Drain
                </button>
              </div>
            )}

            {activeId === 'groundwater-depletion' && (
              <div className="space-y-2.5 border-t border-white/10 pt-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Soil Permeability (Shared)</span>
                  <span className="font-semibold capitalize text-cyan-200">
                    {state.underground.soilPermeability}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['low', 'medium', 'high'] as SoilPermeabilityLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() =>
                        dispatchAction('set_soil_permeability', { level: lvl }, 'mouse')
                      }
                      className={`rounded-md border py-1.5 text-xs font-medium capitalize ${
                        state.underground.soilPermeability === lvl
                          ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                          : 'border-white/10 bg-white/5 text-slate-300'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-300">Open Recharge Zone Area</span>
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
                  <div className="text-xs text-slate-300">Toggle Connected Wells</div>
                  <div className="grid grid-cols-1 gap-1">
                    {state.underground.wells.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => dispatchAction('toggle_well', { wellId: w.id }, 'mouse')}
                        className={`flex items-center justify-between rounded-md border px-3 py-1.5 text-xs ${
                          w.active
                            ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-100'
                            : 'border-white/10 bg-white/5 text-slate-400'
                        }`}
                      >
                        <span>{w.name}</span>
                        <span className="font-mono-tabular">
                          {w.active ? 'ACTIVE' : 'PAUSED'} ({w.depthM} m)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {(activeId === 'pipeline-leakage' || activeId === 'smart-city-management') && (
              <div className="flex gap-2 border-t border-white/10 pt-3">
                {state.city.leak.active ? (
                  <button
                    type="button"
                    onClick={() => dispatchAction('repair_pipeline_leak', {}, 'mouse')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500 py-2 text-xs font-semibold text-slate-950 hover:bg-emerald-400"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Repair Pipeline Leaks</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => dispatchAction('create_pipeline_leak', {}, 'mouse')}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-amber-400/40 bg-amber-500/20 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-500/30"
                  >
                    <Droplets className="h-3.5 w-3.5" />
                    <span>Simulate Active Pipe Leak</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Live Outputs, Formula, Safety Notice, Before/After & Assumptions */}
          <div className="space-y-4 lg:col-span-7">
            {/* Live Results Grid */}
            <div className="rounded-2xl border border-cyan-500/20 bg-[#061121] p-5">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div>
                  <div className="text-xs text-slate-400">Live Simulation Outputs</div>
                  <div className="text-base font-semibold text-white">{output.headlineStatus}</div>
                </div>
                <span className="rounded-md border border-white/10 bg-[#040a14] px-2.5 py-1 text-[11px] text-slate-300">
                  Simulated Model
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {output.cards.map((c) => (
                  <div
                    key={c.key}
                    className="rounded-xl border border-white/10 bg-[#040a14] p-3"
                  >
                    <div className="text-[11px] text-slate-400">{c.label}</div>
                    <div
                      className={`mt-1 font-mono-tabular text-xl font-semibold ${VALUE_COLOR[c.status ?? 'neutral']}`}
                    >
                      {c.value}{' '}
                      <span className="text-xs font-normal text-slate-400">{c.unit}</span>
                    </div>
                    {c.hint && <div className="mt-0.5 text-[11px] text-slate-400">{c.hint}</div>}
                  </div>
                ))}
              </div>

              {filtrationDetail && (
                <div className="mt-4 rounded-xl border border-white/10 bg-[#040a14] p-3.5">
                  <div className="text-xs font-semibold text-cyan-300 mb-2">
                    Stage-by-Stage Turbidity Progression (NTU)
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
                    {filtrationDetail.stageOutputs.map((st) => (
                      <div
                        key={st.stage}
                        className="rounded-lg border border-white/10 bg-white/5 p-2.5"
                      >
                        <div className="text-[10px] text-slate-400">{st.stage}</div>
                        <div className="mt-1 font-mono-tabular text-sm font-semibold text-white">
                          {st.ntu.toFixed(1)} NTU
                        </div>
                        {st.removedFromPrevPct > 0 && (
                          <div className="text-[10px] text-emerald-300">
                            −{st.removedFromPrevPct}% stage drop
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {meta.safetyNotice && (
                <div className="mt-4 rounded-xl border border-amber-400/50 bg-amber-500/15 p-3.5 text-xs leading-relaxed text-amber-100">
                  <div className="flex items-center gap-2 font-semibold text-amber-200 mb-1">
                    <ShieldAlert className="h-4 w-4 shrink-0" />
                    <span>Potable Water Safety Warning</span>
                  </div>
                  {meta.safetyNotice}
                </div>
              )}
            </div>

            {/* Before vs After Comparison Card */}
            <div className="rounded-2xl border border-cyan-500/20 bg-[#061121] p-5">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">
                    Before vs After Parameter Comparison
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    Compare current values against "{comparison.baselineLabel}"
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    dispatchAction(
                      'capture_lab_baseline',
                      { experimentId: activeId, label: 'Workbook Snapshot' },
                      'mouse'
                    )
                  }
                  className="flex items-center gap-1.5 rounded-lg border border-cyan-400/35 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>Update Before Baseline</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {comparison.rows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-[#040a14] px-3 py-2 text-xs"
                  >
                    <span className="text-slate-300">{row.label}</span>
                    <span className="font-mono-tabular">
                      <span className="text-slate-400">{row.beforeVal}</span>
                      <span className="mx-1 text-slate-500">→</span>
                      <span className="font-semibold text-white">{row.afterVal}</span>
                      <span
                        className={`ml-1.5 text-[11px] ${
                          Math.abs(row.deltaNumeric) < 0.05
                            ? 'text-slate-500'
                            : row.deltaNumeric > 0
                              ? 'text-cyan-300'
                              : 'text-amber-300'
                        }`}
                      >
                        ({row.deltaText})
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Scientific Equations, Assumptions & Limitations */}
            <div className="rounded-2xl border border-cyan-500/20 bg-[#061121] p-5 space-y-4">
              <div>
                <div className="text-xs font-semibold text-cyan-300">
                  Equation &amp; Calculation Basis
                </div>
                <div className="mt-1.5 rounded-lg border border-cyan-500/20 bg-[#040a14] px-3 py-2.5 font-mono-tabular text-xs text-cyan-100">
                  {meta.formulaDisplay}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">
                  {meta.calculationMethod}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-[#040a14] p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>Assumptions</span>
                  </div>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-300">
                    {meta.assumptions.map((a) => (
                      <li key={a}>• {a}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-[#040a14] p-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>Model Limitations</span>
                  </div>
                  <ul className="mt-1.5 space-y-1 text-[11px] text-slate-300">
                    {meta.limitations.map((l) => (
                      <li key={l}>• {l}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="flex items-start gap-2 border-t border-white/10 pt-3 text-[11px] text-slate-400">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>{meta.disclaimer}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
