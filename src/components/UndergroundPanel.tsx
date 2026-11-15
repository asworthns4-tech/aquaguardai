import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  Biohazard,
  CloudRain,
  Droplets,
  Layers,
  Power,
  RotateCcw,
  Wrench,
  X,
} from 'lucide-react';
import {
  CONTAMINATION_SCENARIOS,
  DEMO_PHASES,
  UNDERGROUND_ENTITIES,
} from '../data/undergroundData';
import { computeUndergroundMetrics } from '../services/simulationEngine';
import { useAppState } from '../state/appStore';
import {
  ContaminationSourceType,
  SoilPermeabilityLevel,
  UndergroundPanelTab,
} from '../types/exhibition';

const TABS: { id: UndergroundPanelTab; label: string }[] = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'depletion', label: 'Depletion' },
  { id: 'recharge', label: 'Recharge' },
  { id: 'contamination', label: 'Plume' },
];

export const UndergroundPanel: React.FC = () => {
  const { state, dispatchAction, focusUndergroundEntity, focusCityEntity } = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!state.infoPanelOpen) return null;

  const { underground: ug, city } = state;
  const metrics = computeUndergroundMetrics(ug, city);
  const selectedId = state.selectedObject?.id ?? null;

  const selectedWell = selectedId
    ? ug.wells.find((w) => w.id === selectedId) ?? null
    : null;
  const selectedEntity = selectedId
    ? UNDERGROUND_ENTITIES.find((e) => e.id === selectedId) ?? null
    : null;

  const activePhase = DEMO_PHASES.find((p) => p.id === ug.demoPhase) ?? DEMO_PHASES[0];
  const contScenario = CONTAMINATION_SCENARIOS[ug.contamination.sourceType];

  const jumpToCityEntity = (entityId: string) => {
    dispatchAction('navigate_to_city', {}, 'mouse');
    focusCityEntity(entityId, 'mouse');
  };

  return (
    <aside
      aria-label="Underground Water World Console"
      className="aqua-scroll fixed top-16 right-4 bottom-24 z-10 flex w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-xl border border-cyan-500/20 bg-[#061121]/94 shadow-2xl"
    >
      {/* Header & Tabs */}
      <div className="border-b border-white/10 px-4 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-cyan-300/90">
              Simulated Hydrogeology · Module 03
            </div>
            <h2 className="font-display text-base font-semibold text-white">
              Underground Water Console
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dispatchAction('toggle_info_panel', { open: false }, 'mouse')}
            aria-label="Close panel"
            className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1 rounded-lg bg-[#040a14] p-1 border border-white/5">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => dispatchAction('set_underground_tab', { tab: t.id }, 'mouse')}
              className={`rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                ug.activeTab === t.id
                  ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                  : 'text-slate-400 hover:text-white border border-transparent'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Body */}
      <div className="aqua-scroll flex-1 overflow-y-auto p-4 space-y-5">
        {/* TAB 1: INSPECT STRATA / AQUIFER / WELL / PIPELINE */}
        {ug.activeTab === 'inspect' && (
          <div className="space-y-4">
            {selectedWell ? (
              <>
                <div className="border-b border-white/10 pb-3">
                  <div className="text-[11px] text-cyan-300/90">
                    {selectedWell.wellType === 'shallow'
                      ? 'Shallow Open Well · Unconfined Aquifer'
                      : 'Deep Cased Borewell · Confined Aquifer'}
                  </div>
                  <h3 className="mt-0.5 font-display text-xl font-semibold text-white">
                    {selectedWell.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs font-mono-tabular text-slate-400">
                    <span>Depth: {selectedWell.depthM.toFixed(1)} m</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        selectedWell.wellType === 'shallow' &&
                        ug.waterTableDepthM > selectedWell.depthM
                          ? 'text-amber-300 font-semibold'
                          : selectedWell.active
                            ? 'text-emerald-300'
                            : 'text-slate-400'
                      }
                    >
                      {selectedWell.wellType === 'shallow' &&
                      ug.waterTableDepthM > selectedWell.depthM
                        ? 'Dry (Table Below Well)'
                        : selectedWell.active
                          ? 'Pumping Active'
                          : 'Pump Standby'}
                    </span>
                  </div>
                </div>

                {/* Well Controls */}
                <div className="space-y-3 rounded-lg border border-cyan-500/20 bg-[#040a14] p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-white">Pump Status</span>
                    <button
                      type="button"
                      onClick={() =>
                        dispatchAction('toggle_well', { wellId: selectedWell.id }, 'mouse')
                      }
                      className={`flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                        selectedWell.active
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-400/40'
                          : 'bg-white/10 text-slate-300 border border-white/15'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{selectedWell.active ? 'Stop Pump' : 'Start Pump'}</span>
                    </button>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-slate-300">Extraction Rate</span>
                      <span className="font-mono-tabular text-cyan-200">
                        {selectedWell.extractionLph.toLocaleString()} L/hr
                      </span>
                    </div>
                    <input
                      type="range"
                      min={15000}
                      max={210000}
                      step={5000}
                      value={selectedWell.extractionLph}
                      onChange={(e) =>
                        dispatchAction(
                          'set_well_extraction',
                          {
                            wellId: selectedWell.id,
                            extractionLph: Number(e.target.value),
                          },
                          'mouse'
                        )
                      }
                      className="w-full accent-cyan-400"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-xs leading-relaxed text-slate-300">
                  <div className="font-semibold text-cyan-300">
                    Shallow Well vs. Deep Borewell Science
                  </div>
                  <p>
                    {selectedWell.wellType === 'shallow'
                      ? `This ${selectedWell.depthM} m shallow well draws from the upper unconfined gravel aquifer. Because the water table sits at ${ug.waterTableDepthM.toFixed(1)} m, heavy regional extraction causes shallow wells to run dry first.`
                      : `This ${selectedWell.depthM} m deep borewell is sealed through the impermeable clay aquitard (18–23 m) to tap pressurized groundwater in deep sandstone. Excessive deep pumping can cause irreversible aquifer compaction.`}
                  </p>
                </div>

                {/* Connected Smart City Link */}
                <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-2">
                  <div className="text-[11px] text-slate-400">Connected Smart City District</div>
                  <div className="text-xs font-semibold text-white">
                    {selectedWell.connectedCityLabel}
                  </div>
                  <button
                    type="button"
                    onClick={() => jumpToCityEntity(selectedWell.connectedCityEntityId)}
                    className="flex items-center gap-1.5 text-xs font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    <span>Inspect District in Smart City</span>
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => dispatchAction('clear_selection', {}, 'mouse')}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Browse All Strata & Wells
                </button>
              </>
            ) : selectedEntity ? (
              <>
                <div className="border-b border-white/10 pb-3">
                  <div className="text-[11px] text-cyan-300/90 capitalize">
                    {selectedEntity.category.replace('-', ' ')}
                  </div>
                  <h3 className="mt-0.5 font-display text-xl font-semibold text-white">
                    {selectedEntity.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs font-mono-tabular text-slate-400">
                    <span>
                      Depth:{' '}
                      {selectedEntity.id === 'water-table-plane'
                        ? `${ug.waterTableDepthM.toFixed(1)} m (current)`
                        : selectedEntity.depthRangeM}
                    </span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-200">{selectedEntity.summary}</p>

                <div className="grid grid-cols-2 gap-3 border-y border-white/10 py-3 text-xs">
                  <div>
                    <div className="text-[11px] text-slate-400">Permeability</div>
                    <div className="font-medium text-white mt-0.5">
                      {selectedEntity.permeabilityLabel}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Porosity / Saturation</div>
                    <div className="font-medium text-cyan-200 mt-0.5">
                      {selectedEntity.porosityLabel}
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-cyan-300">Scientific Importance</div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {selectedEntity.scienceExplanation}
                  </p>
                </div>

                <div className="space-y-1.5 border-t border-white/10 pt-3">
                  <div className="text-xs font-semibold text-emerald-300">Hydrological Role</div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {selectedEntity.hydrologyRole}
                  </p>
                </div>

                <div className="rounded-lg border border-white/10 bg-white/5 p-3 space-y-1.5">
                  <div className="text-[11px] text-slate-400">Smart City Connection</div>
                  <p className="text-xs text-slate-200">{selectedEntity.connectedCityNote}</p>
                  {selectedEntity.connectedCityEntityId && (
                    <button
                      type="button"
                      onClick={() => jumpToCityEntity(selectedEntity.connectedCityEntityId!)}
                      className="flex items-center gap-1 text-xs font-medium text-cyan-300 hover:text-cyan-200 pt-1"
                    >
                      <span>Open Connected Smart City Object</span>
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => dispatchAction('clear_selection', {}, 'mouse')}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Browse All Strata & Wells
                </button>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-xs leading-relaxed text-slate-300">
                  Click any soil layer, aquifer, water table, buried pipeline, or borewell in the
                  3D cutaway—or select from the index below.
                </p>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Interactive Wells & Borewells
                  </div>
                  {ug.wells.map((w) => {
                    const isDry = w.wellType === 'shallow' && ug.waterTableDepthM > w.depthM;
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => focusUndergroundEntity(w.id)}
                        className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
                      >
                        <div>
                          <div className="text-xs font-medium text-white">{w.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono-tabular">
                            {w.depthM} m · {isDry ? 'Dry' : w.active ? 'Pumping' : 'Standby'}
                          </div>
                        </div>
                        <Droplets className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-1.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                    Geological Strata & Aquifers
                  </div>
                  {UNDERGROUND_ENTITIES.map((ent) => (
                    <button
                      key={ent.id}
                      type="button"
                      onClick={() => focusUndergroundEntity(ent.id)}
                      className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
                    >
                      <div>
                        <div className="text-xs font-medium text-white">{ent.name}</div>
                        <div className="text-[11px] text-slate-400 font-mono-tabular">
                          {ent.depthRangeM}
                        </div>
                      </div>
                      <Layers className="h-3.5 w-3.5 text-cyan-300 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: GROUNDWATER DEPLETION & DASHBOARD */}
        {ug.activeTab === 'depletion' && (
          <div className="space-y-4">
            {/* Simulated Dashboard KPIs */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-white/10 bg-[#040a14] p-2.5">
                <div className="text-[11px] text-slate-400">Water Table Depth</div>
                <div className="font-mono-tabular text-base font-semibold text-cyan-200">
                  {ug.waterTableDepthM.toFixed(1)} m
                </div>
                <div className="text-[10px] text-slate-400 font-mono-tabular">
                  Initial: {ug.initialWaterTableDepthM.toFixed(1)} m
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#040a14] p-2.5">
                <div className="text-[11px] text-slate-400">Aquifer Storage</div>
                <div className="font-mono-tabular text-base font-semibold text-white">
                  {metrics.aquiferStoragePct}%
                </div>
                <div className="text-[10px] text-slate-400">
                  {metrics.shallowWellDry ? 'Shallow well dry' : 'Shallow well active'}
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#040a14] p-2.5">
                <div className="text-[11px] text-slate-400">Extraction Rate</div>
                <div className="font-mono-tabular text-base font-semibold text-amber-300">
                  {metrics.extractionRateMLd.toFixed(1)} ML/d
                </div>
                <div className="text-[10px] text-slate-400">
                  Active Wells: {metrics.activeWellsCount}/3
                </div>
              </div>

              <div className="rounded-lg border border-white/10 bg-[#040a14] p-2.5">
                <div className="text-[11px] text-slate-400">Recharge Rate</div>
                <div className="font-mono-tabular text-base font-semibold text-emerald-300">
                  {metrics.rechargeRateMLd.toFixed(1)} ML/d
                </div>
                <div className="text-[10px] text-slate-400 font-mono-tabular">
                  Net: {metrics.netBalanceMLd >= 0 ? '+' : ''}
                  {metrics.netBalanceMLd.toFixed(1)} ML/d
                </div>
              </div>
            </div>

            {/* 5-Stage Interactive Groundwater Sequence */}
            <div className="space-y-2.5 rounded-lg border border-cyan-500/20 bg-[#040a14] p-3">
              <div className="text-xs font-semibold text-cyan-300">
                5-Stage Groundwater Sequence
              </div>
              <div className="grid grid-cols-5 gap-1">
                {DEMO_PHASES.map((ph) => (
                  <button
                    key={ph.id}
                    type="button"
                    onClick={() =>
                      dispatchAction('set_underground_demo_phase', { phase: ph.id }, 'mouse')
                    }
                    className={`rounded py-1 text-center font-mono-tabular text-xs font-semibold transition-colors ${
                      ug.demoPhase === ph.id
                        ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/50'
                        : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {ph.step}
                  </button>
                ))}
              </div>
              <div className="text-xs font-semibold text-white">
                {activePhase.step}. {activePhase.title}
              </div>
              <p className="text-[11px] leading-relaxed text-slate-300">
                {activePhase.scienceSummary}
              </p>
            </div>

            {/* Active Wells Quick Toggles */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-300">Active Wells & Borewells</div>
              <div className="grid grid-cols-1 gap-1.5">
                {ug.wells.map((w) => (
                  <div
                    key={w.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-1.5"
                  >
                    <button
                      type="button"
                      onClick={() => focusUndergroundEntity(w.id, 'mouse')}
                      className="text-left text-xs text-white hover:text-cyan-200"
                    >
                      {w.name}{' '}
                      <span className="text-[10px] text-slate-400 font-mono-tabular">
                        ({w.depthM}m)
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => dispatchAction('toggle_well', { wellId: w.id }, 'mouse')}
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        w.active
                          ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/40'
                          : 'bg-slate-800 text-slate-400 border border-white/10'
                      }`}
                    >
                      {w.active ? 'ON' : 'OFF'}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Experiment Controls */}
            <div className="space-y-3 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-300">
                  Depletion & Demand Controls
                </span>
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        dispatchAction('reset_underground', { confirmed: true }, 'mouse');
                        setConfirmReset(false);
                      }}
                      className="rounded-md border border-amber-400/40 bg-amber-500/20 px-2 py-1 text-[11px] font-semibold text-amber-200"
                    >
                      Confirm Reset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmReset(false)}
                      className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Rainfall Intensity (Shared with City)</span>
                  <span className="font-mono-tabular text-cyan-200">
                    {city.rainfallIntensity} mm
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={120}
                  step={2}
                  value={city.rainfallIntensity}
                  onChange={(e) =>
                    dispatchAction('set_rainfall', { value: Number(e.target.value) }, 'mouse')
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">City Water Demand (Shared)</span>
                  <span className="font-mono-tabular text-cyan-200">
                    {Math.round(city.demandMultiplier * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0.6}
                  max={1.6}
                  step={0.05}
                  value={city.demandMultiplier}
                  onChange={(e) =>
                    dispatchAction('set_water_demand', { value: Number(e.target.value) }, 'mouse')
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Simulation Speed</span>
                  <span className="font-mono-tabular text-white">{ug.simulationSpeed}×</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {[0, 0.5, 1, 2].map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() =>
                        dispatchAction('set_simulation_speed', { speed: spd }, 'mouse')
                      }
                      className={`rounded py-1 font-mono-tabular text-[11px] ${
                        ug.simulationSpeed === spd
                          ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/40'
                          : 'bg-white/5 text-slate-400 border border-white/10'
                      }`}
                    >
                      {spd === 0 ? 'Pause' : `${spd}×`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <p className="border-t border-white/10 pt-2.5 text-[11px] leading-snug text-slate-400">
              Simulated simplified water-balance model. Real aquifer response depends on hydraulic
              conductivity, storage coefficients, boundary inflows, and multi-year geology.
            </p>
          </div>
        )}

        {/* TAB 3: RAINWATER RECHARGE & BURIED PIPELINE LEAKAGE */}
        {ug.activeTab === 'recharge' && (
          <div className="space-y-5">
            {/* Rainwater Infiltration Controls */}
            <div className="space-y-3 rounded-lg border border-cyan-500/20 bg-[#040a14] p-3.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                <CloudRain className="h-3.5 w-3.5" />
                <span>Rainwater Infiltration & Soil Permeability</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                Adjust soil permeability and urban recharge pits to observe how rainwater infiltrates
                through sand into the aquifer—or gets blocked by dense clay.
              </p>

              <div className="space-y-1.5">
                <div className="text-[11px] text-slate-400">Surface & Soil Permeability</div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'high', label: 'High (Sand)' },
                      { id: 'medium', label: 'Medium (Loam)' },
                      { id: 'low', label: 'Low (Clay)' },
                    ] as { id: SoilPermeabilityLevel; label: string }[]
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() =>
                        dispatchAction('set_soil_permeability', { permeability: opt.id }, 'mouse')
                      }
                      className={`rounded-md py-1.5 text-[11px] font-medium transition-colors ${
                        ug.soilPermeability === opt.id
                          ? 'bg-cyan-500/25 text-cyan-100 border border-cyan-400/45'
                          : 'bg-white/5 text-slate-300 border border-white/10'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-300">Permeable Recharge Area</span>
                  <span className="font-mono-tabular text-white">{ug.rechargeAreaPct}%</span>
                </div>
                <input
                  type="range"
                  min={15}
                  max={95}
                  step={5}
                  value={ug.rechargeAreaPct}
                  onChange={(e) =>
                    dispatchAction(
                      'set_groundwater_recharge',
                      { value: Number(e.target.value) },
                      'mouse'
                    )
                  }
                  className="w-full accent-cyan-400"
                />
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-2 text-xs">
                <span className="text-slate-300">Resulting Recharge Rate</span>
                <span className="font-mono-tabular font-semibold text-emerald-300">
                  {metrics.rechargeRateMLd.toFixed(1)} ML/day
                </span>
              </div>
            </div>

            {/* Connected Phase 2 Buried Pipeline Network */}
            <div className="space-y-3 rounded-lg border border-white/10 bg-[#040a14] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Buried City Pipeline Network</span>
                </div>
                <span className="text-[10px] text-cyan-300">Linked to Smart City</span>
              </div>

              <p className="text-[11px] leading-relaxed text-slate-300">
                Uses the exact same Smart City pipeline state. Triggering or repairing a leak here
                immediately updates the above-ground Future Smart City scene.
              </p>

              {city.leak.active ? (
                <div className="space-y-2 rounded-md border border-amber-400/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-100">
                  <div>
                    Subsurface burst active ({city.leak.severityLph.toLocaleString()} L/hr). Water
                    is escaping into surrounding topsoil.
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatchAction('repair_pipeline_leak', {}, 'mouse')}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-500 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Repair Underground Leak</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => dispatchAction('create_pipeline_leak', {}, 'mouse')}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-400/35 bg-amber-500/15 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors"
                >
                  <Droplets className="h-3.5 w-3.5" />
                  <span>Simulate Underground Pipe Leak</span>
                </button>
              )}

              {city.leak.lastBeforeLossLph > 0 && !city.leak.active && (
                <div className="text-[11px] text-emerald-300">
                  Last repair saved {city.leak.lastBeforeLossLph.toLocaleString()} L/hr across both
                  city & subsurface networks.
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: EDUCATIONAL CONTAMINATION SIMULATION */}
        {ug.activeTab === 'contamination' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-white/10 bg-[#040a14] p-3">
              <div className="flex items-center gap-2">
                <Biohazard className="h-4 w-4 text-amber-300" />
                <div>
                  <div className="text-xs font-semibold text-white">Contamination Plume</div>
                  <div className="text-[11px] text-slate-400">
                    {ug.contamination.active ? 'Illustrative Plume Active' : 'Inactive'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  dispatchAction(
                    'set_contamination',
                    { active: !ug.contamination.active },
                    'mouse'
                  )
                }
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  ug.contamination.active
                    ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50'
                    : 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                }`}
              >
                {ug.contamination.active ? 'Clear Plume' : 'Start Plume'}
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] text-slate-400">Select Contamination Example</div>
              <div className="grid grid-cols-2 gap-1.5">
                {(
                  [
                    { id: 'agricultural', label: 'Agricultural' },
                    { id: 'wastewater', label: 'Wastewater' },
                    { id: 'industrial', label: 'Industrial' },
                    { id: 'landfill', label: 'Waste Dump' },
                  ] as { id: ContaminationSourceType; label: string }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                      dispatchAction(
                        'set_contamination',
                        { sourceType: item.id, active: true },
                        'mouse'
                      )
                    }
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      ug.contamination.sourceType === item.id
                        ? 'bg-amber-500/20 text-amber-100 border border-amber-400/45'
                        : 'bg-white/5 text-slate-300 border border-white/10'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 rounded-lg border border-white/10 bg-[#040a14] p-3.5 text-xs">
              <div className="font-semibold text-white">{contScenario.title}</div>
              <div>
                <span className="text-slate-400">Source: </span>
                <span className="text-slate-200">{contScenario.origin}</span>
              </div>
              <div>
                <span className="text-slate-400">Subsurface Path: </span>
                <span className="text-slate-200">{contScenario.mechanism}</span>
              </div>
              <div>
                <span className="text-slate-400">Affected Region: </span>
                <span className="text-amber-200">{contScenario.affectedZone}</span>
              </div>
              <div className="border-t border-white/10 pt-2">
                <span className="text-emerald-300 font-semibold">Prevention: </span>
                <span className="text-slate-300">{contScenario.prevention}</span>
              </div>
            </div>

            <p className="text-[11px] leading-snug text-slate-400">
              Educational visualization only: simplified particle dispersion demonstrates general
              hydrogeological concepts and does not predict real chemical transport or health risk.
            </p>
          </div>
        )}
      </div>
    </aside>
  );
};
