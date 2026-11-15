import React, { useState } from 'react';
import {
  Activity,
  AlertTriangle,
  Building2,
  CheckCircle2,
  CloudRain,
  Droplets,
  Gauge,
  Recycle,
  RotateCcw,
  ShieldAlert,
  Wrench,
  X,
} from 'lucide-react';
import {
  CITY_EMERGENCIES,
  CITY_ENTITIES,
  WASTEWATER_STAGES,
} from '../data/smartCityData';
import { computeCityMetrics } from '../services/simulationEngine';
import { useAppState } from '../state/appStore';
import { CityPanelTab } from '../types/exhibition';

const TABS: { id: CityPanelTab; label: string }[] = [
  { id: 'inspect', label: 'Inspect' },
  { id: 'dashboard', label: 'Control' },
  { id: 'leak-rain', label: 'Leak & Rain' },
  { id: 'recycling-crisis', label: 'Reuse & Crisis' },
];

export const SmartCityPanel: React.FC = () => {
  const { state, dispatchAction, focusCityEntity, focusUndergroundEntity } = useAppState();
  const [confirmReset, setConfirmReset] = useState(false);

  if (!state.infoPanelOpen) return null;

  const { city } = state;
  const metrics = computeCityMetrics(city);
  const selectedEntity = state.selectedObject
    ? CITY_ENTITIES.find((e) => e.id === state.selectedObject?.id) ?? null
    : null;

  const activeStage = WASTEWATER_STAGES[city.activeRecyclingStage] ?? WASTEWATER_STAGES[0];
  const currentBuildingFactor = selectedEntity
    ? city.buildingDemandOverrides[selectedEntity.id] ?? 1.0
    : 1.0;

  const isEntityAffectedByLeak = Boolean(
    selectedEntity &&
      city.leak.active &&
      (selectedEntity.affectedByLeakIds?.includes(city.leak.locationId) ||
        selectedEntity.id === city.leak.locationId ||
        (city.leak.locationId === 'pipe-residential-east' &&
          selectedEntity.id === 'pipe-distribution'))
  );

  const tankFillPct = Math.min(
    100,
    Math.round((city.rainwater.tankStoredLitres / Math.max(1, city.rainwater.tankCapacityLitres)) * 100)
  );

  return (
    <aside
      aria-label="Smart City Water Management Console"
      className="aqua-scroll fixed top-16 right-4 bottom-24 z-10 flex w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-xl border border-cyan-500/20 bg-[#061121]/94 shadow-2xl"
    >
      {/* Console Header + Tabs */}
      <div className="border-b border-white/10 px-4 pt-3.5 pb-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="text-[11px] text-cyan-300/90">
              Simulated City Model · Module 02
            </div>
            <h2 className="font-display text-base font-semibold text-white">
              Smart City Water Console
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
              onClick={() => dispatchAction('set_city_tab', { tab: t.id }, 'mouse')}
              className={`rounded-md px-1.5 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                city.activeTab === t.id
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
        {/* TAB 1: INSPECT BUILDING / INFRASTRUCTURE / PIPELINE */}
        {city.activeTab === 'inspect' && (
          <div className="space-y-4">
            {selectedEntity ? (
              <>
                <div className="border-b border-white/10 pb-3">
                  <div className="text-[11px] text-cyan-300/90">{selectedEntity.subType}</div>
                  <h3 className="mt-0.5 font-display text-xl font-semibold text-white">
                    {selectedEntity.name}
                  </h3>
                  <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                    <span className="capitalize">{selectedEntity.category}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={
                        isEntityAffectedByLeak ? 'text-amber-300 font-medium' : 'text-emerald-300'
                      }
                    >
                      {isEntityAffectedByLeak
                        ? 'Affected by Active Pipeline Leak'
                        : 'Normal Supply Status'}
                    </span>
                  </div>
                </div>

                <p className="text-xs leading-relaxed text-slate-200">{selectedEntity.summary}</p>

                {/* Simulated Stats Grid */}
                <div className="grid grid-cols-2 gap-3 border-y border-white/10 py-3.5">
                  {selectedEntity.simulatedPopulation !== undefined && (
                    <div>
                      <div className="text-[11px] text-slate-400">Population (Simulated)</div>
                      <div className="font-mono-tabular text-base font-semibold text-white">
                        {selectedEntity.simulatedPopulation.toLocaleString()}
                      </div>
                    </div>
                  )}

                  {selectedEntity.baseDemandLpd > 0 && (
                    <div>
                      <div className="text-[11px] text-slate-400">Daily Consumption</div>
                      <div className="font-mono-tabular text-base font-semibold text-cyan-200">
                        {Math.round(
                          selectedEntity.baseDemandLpd *
                            city.demandMultiplier *
                            currentBuildingFactor
                        ).toLocaleString()}{' '}
                        <span className="text-[11px] text-slate-400">L/day</span>
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="text-[11px] text-slate-400">Storage Level</div>
                    <div className="font-mono-tabular text-base font-semibold text-white">
                      {selectedEntity.id === 'city-reservoir'
                        ? `${city.reservoirStoragePct}%`
                        : selectedEntity.id === 'rainwater-facility'
                          ? `${tankFillPct}%`
                          : `${Math.max(
                              20,
                              selectedEntity.baseStoragePct - (isEntityAffectedByLeak ? 22 : 0)
                            )}%`}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">Recycling Rate</div>
                    <div className="font-mono-tabular text-base font-semibold text-emerald-300">
                      {selectedEntity.recyclingSupported ? `${city.recyclingCapacityPct}%` : '0%'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">Water Supply Status</div>
                    <div className="text-xs font-medium text-slate-100">
                      {isEntityAffectedByLeak
                        ? 'Reduced Pressure (-28%)'
                        : metrics.netBalanceMLd >= 0
                          ? 'Adequate Supply'
                          : 'Tight Margin'}
                    </div>
                  </div>

                  <div>
                    <div className="text-[11px] text-slate-400">Leakage Status</div>
                    <div
                      className={`text-xs font-medium ${
                        isEntityAffectedByLeak ? 'text-amber-300' : 'text-emerald-300'
                      }`}
                    >
                      {isEntityAffectedByLeak
                        ? `${city.leak.severityLph.toLocaleString()} L/hr leak`
                        : 'Nominal'}
                    </div>
                  </div>
                </div>

                {/* Building-Specific Demand Slider */}
                {selectedEntity.category === 'building' && (
                  <div className="space-y-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-cyan-200">
                        Adjust Building Water Consumption
                      </span>
                      <span className="font-mono-tabular text-white">
                        {Math.round(currentBuildingFactor * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={1.6}
                      step={0.05}
                      value={currentBuildingFactor}
                      onChange={(e) =>
                        dispatchAction(
                          'set_building_demand',
                          {
                            buildingId: selectedEntity.id,
                            multiplier: Number(e.target.value),
                          },
                          'mouse'
                        )
                      }
                      className="w-full accent-cyan-400"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Conservation (50%)</span>
                      <span>City Total: {metrics.effectiveDemandMLd.toFixed(1)} ML/d</span>
                    </div>
                  </div>
                )}

                {/* Scientific Explanation */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-cyan-300">Scientific Function</div>
                  <p className="text-xs leading-relaxed text-slate-300">
                    {selectedEntity.scienceExplanation}
                  </p>
                </div>

                {/* Conservation Tips */}
                <div className="space-y-1.5 border-t border-white/10 pt-3">
                  <div className="text-xs font-semibold text-emerald-300">
                    Conservation Recommendations
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {selectedEntity.conservationTips.map((tip) => (
                      <li key={tip} className="leading-relaxed">
                        • {tip}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const ugTarget =
                      selectedEntity.id === 'city-reservoir' ||
                      selectedEntity.id === 'rainwater-facility'
                        ? 'layer-sand'
                        : selectedEntity.id === 'res-district-west'
                          ? 'well-shallow-west'
                          : selectedEntity.id === 'res-district-east'
                            ? 'borewell-east'
                            : selectedEntity.id === 'pipe-distribution'
                              ? 'pipe-distribution'
                              : 'borewell-central';
                    dispatchAction('navigate_to_underground', {}, 'mouse');
                    focusUndergroundEntity(ugTarget, 'mouse');
                  }}
                  className="w-full rounded-lg border border-cyan-400/35 bg-cyan-500/15 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition-colors"
                >
                  Explore Underground Aquifer Connection
                </button>

                <button
                  type="button"
                  onClick={() => dispatchAction('clear_selection', {}, 'mouse')}
                  className="w-full rounded-lg border border-white/10 bg-white/5 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Browse All City Infrastructure
                </button>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-xs leading-relaxed text-slate-300">
                  Click any skyscraper, residential block, water plant, reservoir, or glowing
                  pipeline in the 3D city—or choose a facility below to inspect its simulated
                  hydrology.
                </p>

                {(['infrastructure', 'building', 'pipeline'] as const).map((cat) => (
                  <div key={cat} className="space-y-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {cat === 'infrastructure'
                        ? 'Water Infrastructure'
                        : cat === 'building'
                          ? 'Smart Buildings'
                          : 'Distribution Pipelines'}
                    </div>
                    <div className="grid grid-cols-1 gap-1.5">
                      {CITY_ENTITIES.filter((e) => e.category === cat).map((ent) => (
                        <button
                          key={ent.id}
                          type="button"
                          onClick={() => focusCityEntity(ent.id)}
                          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
                        >
                          <div>
                            <div className="text-xs font-medium text-white">{ent.name}</div>
                            <div className="text-[11px] text-slate-400">{ent.subType}</div>
                          </div>
                          <Building2 className="h-3.5 w-3.5 text-cyan-300 shrink-0 ml-2" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: SMART CITY CONTROL CENTRE */}
        {city.activeTab === 'dashboard' && (
          <div className="space-y-4">
            {/* Supply vs Demand Summary Bar */}
            <div className="space-y-2 rounded-lg border border-cyan-500/20 bg-[#040a14] p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Daily City Water Balance</span>
                <span
                  className={`font-mono-tabular font-semibold ${
                    metrics.netBalanceMLd >= 0 ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {metrics.netBalanceMLd >= 0 ? '+' : ''}
                  {metrics.netBalanceMLd.toFixed(1)} ML/d
                </span>
              </div>

              {/* Stacked Source Supply Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Available Supply: {metrics.totalAvailableSupplyMLd.toFixed(1)} ML/d</span>
                  <span>Demand + Loss: {(metrics.effectiveDemandMLd + metrics.leakageLossMLd).toFixed(1)} ML/d</span>
                </div>
                <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="bg-sky-500"
                    style={{
                      width: `${Math.min(
                        100,
                        (metrics.surfaceSupplyMLd / Math.max(1, metrics.totalAvailableSupplyMLd)) *
                          100
                      )}%`,
                    }}
                    title="Surface & Reservoir Supply"
                  />
                  <div
                    className="bg-purple-400"
                    style={{
                      width: `${Math.min(
                        100,
                        (metrics.recycledSupplyMLd / Math.max(1, metrics.totalAvailableSupplyMLd)) *
                          100
                      )}%`,
                    }}
                    title="Recycled Water"
                  />
                  <div
                    className="bg-cyan-300"
                    style={{
                      width: `${Math.min(
                        100,
                        (metrics.rainwaterCollectedMLd /
                          Math.max(1, metrics.totalAvailableSupplyMLd)) *
                          100
                      )}%`,
                    }}
                    title="Rainwater Harvesting"
                  />
                  <div
                    className="bg-emerald-400"
                    style={{
                      width: `${Math.min(
                        100,
                        (metrics.groundwaterSupplyMLd /
                          Math.max(1, metrics.totalAvailableSupplyMLd)) *
                          100
                      )}%`,
                    }}
                    title="Groundwater Extraction"
                  />
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <span>■ Surface</span>
                  <span className="text-purple-300">■ Recycled</span>
                  <span className="text-cyan-300">■ Rainwater</span>
                  <span className="text-emerald-300">■ Groundwater</span>
                </div>
              </div>
            </div>

            {/* 8 City Telemetry Readouts */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-[11px] text-slate-400">City Water Demand</div>
                <div className="font-mono-tabular text-base font-semibold text-white">
                  {metrics.effectiveDemandMLd.toFixed(1)}{' '}
                  <span className="text-[11px] text-slate-400">ML/d</span>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-[11px] text-slate-400">Available Supply</div>
                <div className="font-mono-tabular text-base font-semibold text-cyan-200">
                  {metrics.totalAvailableSupplyMLd.toFixed(1)}{' '}
                  <span className="text-[11px] text-slate-400">ML/d</span>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-[11px] text-slate-400">Reservoir Storage</div>
                <div className="font-mono-tabular text-base font-semibold text-white">
                  {city.reservoirStoragePct}%
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-[11px] text-slate-400">Recycling Rate</div>
                <div className="font-mono-tabular text-base font-semibold text-purple-300">
                  {city.recyclingCapacityPct}%{' '}
                  <span className="text-[11px] text-slate-400">
                    ({metrics.recycledSupplyMLd.toFixed(1)} ML/d)
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-[11px] text-slate-400">Pipeline Leakage</div>
                <div
                  className={`font-mono-tabular text-base font-semibold ${
                    city.leak.active || metrics.leakageLossPct > 18
                      ? 'text-amber-300'
                      : 'text-white'
                  }`}
                >
                  {metrics.leakageLossPct.toFixed(1)}%
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-[11px] text-slate-400">Groundwater Reserve</div>
                <div className="font-mono-tabular text-base font-semibold text-emerald-300">
                  {Math.round(metrics.groundwaterAvailabilityPct)}%
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-[11px] text-slate-400">Per-Capita Use</div>
                <div className="font-mono-tabular text-base font-semibold text-white">
                  {metrics.dailyPerCapitaLitres}{' '}
                  <span className="text-[11px] text-slate-400">L/p/d</span>
                </div>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
                <div className="text-[11px] text-slate-400">Network Efficiency</div>
                <div className="font-mono-tabular text-base font-semibold text-cyan-300">
                  {metrics.distributionEfficiencyPct.toFixed(1)}%
                </div>
              </div>
            </div>

            {/* Interactive Simulation Sliders */}
            <div className="space-y-3 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-300">
                  Interactive City Parameters
                </span>
                {!confirmReset ? (
                  <button
                    type="button"
                    onClick={() => setConfirmReset(true)}
                    className="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:text-white transition-colors"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>Reset</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        dispatchAction('reset_city', { confirmed: true }, 'mouse');
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

              {[
                {
                  label: 'Rainfall Intensity',
                  value: `${city.rainfallIntensity} mm`,
                  min: 0,
                  max: 120,
                  step: 2,
                  raw: city.rainfallIntensity,
                  onChange: (v: number) =>
                    dispatchAction('set_rainfall', { value: v }, 'mouse'),
                },
                {
                  label: 'City Population',
                  value: city.population.toLocaleString(),
                  min: 60000,
                  max: 350000,
                  step: 5000,
                  raw: city.population,
                  onChange: (v: number) =>
                    dispatchAction('set_city_population', { value: v }, 'mouse'),
                },
                {
                  label: 'Water Demand Factor',
                  value: `${Math.round(city.demandMultiplier * 100)}%`,
                  min: 0.6,
                  max: 1.6,
                  step: 0.05,
                  raw: city.demandMultiplier,
                  onChange: (v: number) =>
                    dispatchAction('set_water_demand', { value: v }, 'mouse'),
                },
                {
                  label: 'Reservoir Storage',
                  value: `${city.reservoirStoragePct}%`,
                  min: 15,
                  max: 100,
                  step: 1,
                  raw: city.reservoirStoragePct,
                  onChange: (v: number) =>
                    dispatchAction('set_reservoir_storage', { value: v }, 'mouse'),
                },
                {
                  label: 'Recycling Capacity',
                  value: `${city.recyclingCapacityPct}%`,
                  min: 0,
                  max: 85,
                  step: 1,
                  raw: city.recyclingCapacityPct,
                  onChange: (v: number) =>
                    dispatchAction('set_recycling_rate', { value: v }, 'mouse'),
                },
                {
                  label: 'Pipeline Pressure',
                  value: `${city.pipelinePressureBar.toFixed(1)} bar`,
                  min: 2.0,
                  max: 6.5,
                  step: 0.1,
                  raw: city.pipelinePressureBar,
                  onChange: (v: number) =>
                    dispatchAction('set_pipeline_pressure', { value: v }, 'mouse'),
                },
                {
                  label: 'Base Leakage Rate',
                  value: `${city.baseLeakageRatePct}%`,
                  min: 2,
                  max: 35,
                  step: 1,
                  raw: city.baseLeakageRatePct,
                  onChange: (v: number) =>
                    dispatchAction('set_base_leakage_rate', { value: v }, 'mouse'),
                },
                {
                  label: 'Groundwater Extraction',
                  value: `${city.groundwaterExtractionPct}%`,
                  min: 5,
                  max: 95,
                  step: 1,
                  raw: city.groundwaterExtractionPct,
                  onChange: (v: number) =>
                    dispatchAction('set_groundwater_extraction', { pct: v }, 'mouse'),
                },
              ].map((ctrl) => (
                <div key={ctrl.label} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">{ctrl.label}</span>
                    <span className="font-mono-tabular text-cyan-200">{ctrl.value}</span>
                  </div>
                  <input
                    type="range"
                    min={ctrl.min}
                    max={ctrl.max}
                    step={ctrl.step}
                    value={ctrl.raw}
                    onChange={(e) => ctrl.onChange(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </div>
              ))}
            </div>

            <p className="border-t border-white/10 pt-2.5 text-[11px] leading-snug text-slate-400">
              Simulated educational model assuming 135 L/person/day baseline urban demand, ~80%
              wastewater return, and pressure-dependent leakage. Not live municipal telemetry.
            </p>
          </div>
        )}

        {/* TAB 3: PIPELINE LEAK DETECTION & RAINWATER HARVESTING LAB */}
        {city.activeTab === 'leak-rain' && (
          <div className="space-y-5">
            {/* Pipeline Leak Detection */}
            <div className="space-y-3 rounded-lg border border-white/10 bg-[#040a14] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  <span>Pipeline Leak Detection</span>
                </div>
                <span className="font-mono-tabular text-[11px] text-slate-400">Simulated</span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400" htmlFor="leak-loc-select">
                  Select Pipeline Junction
                </label>
                <select
                  id="leak-loc-select"
                  value={city.leak.locationId}
                  onChange={(e) =>
                    dispatchAction(
                      'create_pipeline_leak',
                      { locationId: e.target.value },
                      'mouse'
                    )
                  }
                  className="w-full rounded-lg border border-white/15 bg-[#08162b] px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="pipe-distribution">Main Distribution Trunk (Central)</option>
                  <option value="pipe-residential-east">East Bank Bridge Trunk</option>
                  <option value="pipe-intake">Raw Water Intake Main</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-white/5 p-2">
                  <div className="text-[10px] text-slate-400">Est. Network Loss</div>
                  <div className="font-mono-tabular text-sm font-semibold text-amber-300">
                    {metrics.leakageLossLph.toLocaleString()} L/hr
                  </div>
                </div>
                <div className="rounded-md bg-white/5 p-2">
                  <div className="text-[10px] text-slate-400">Accumulated Burst Loss</div>
                  <div className="font-mono-tabular text-sm font-semibold text-white">
                    {city.leak.accumulatedLossLitres.toLocaleString()} L
                  </div>
                </div>
              </div>

              {city.leak.active ? (
                <div className="space-y-2 rounded-md border border-amber-400/30 bg-amber-500/10 p-2.5 text-[11px] text-amber-100">
                  <div>
                    Active burst on{' '}
                    <span className="font-semibold">
                      {city.leak.locationId === 'pipe-intake'
                        ? 'Raw Intake Main'
                        : city.leak.locationId === 'pipe-residential-east'
                          ? 'East Bank Trunk'
                          : 'Main Distribution Trunk'}
                    </span>
                    . Affected districts: Harborview Apartments
                    {city.leak.locationId === 'pipe-distribution'
                      ? ', AquaSpire Tower, Veridian Eco-Residences'
                      : ''}
                    .
                  </div>
                  <button
                    type="button"
                    onClick={() => dispatchAction('repair_pipeline_leak', {}, 'mouse')}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    <span>Repair Pipeline Leak</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    dispatchAction('create_pipeline_leak', { openTab: true }, 'mouse');
                    focusCityEntity('pipe-distribution', 'mouse');
                  }}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-amber-400/35 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/25 transition-colors"
                >
                  <Droplets className="h-3.5 w-3.5" />
                  <span>Create Simulated Leak</span>
                </button>
              )}

              {city.leak.lastBeforeLossLph > 0 && !city.leak.active && (
                <div className="text-[11px] text-emerald-300">
                  Repair savings: eliminated {city.leak.lastBeforeLossLph.toLocaleString()} L/hr
                  burst loss (Repairs completed: {city.leak.repairedCount}).
                </div>
              )}
            </div>

            {/* Rainwater Harvesting Lab */}
            <div className="space-y-3 rounded-lg border border-cyan-500/20 bg-[#040a14] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                  <CloudRain className="h-3.5 w-3.5" />
                  <span>Rainwater Harvesting Calculator</span>
                </div>
                <button
                  type="button"
                  onClick={() => focusCityEntity('rainwater-facility')}
                  className="text-[11px] text-cyan-300 hover:underline"
                >
                  Focus 3D Hub
                </button>
              </div>

              <div className="rounded-md bg-white/5 p-2 font-mono-tabular text-[11px] text-cyan-100">
                Collected (L) = Rainfall (mm) × Area (m²) × Runoff Coeff
              </div>

              <div className="space-y-2.5">
                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Rainfall</span>
                    <span className="font-mono-tabular text-white">
                      {city.rainwater.rainfallMm} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5}
                    max={150}
                    step={5}
                    value={city.rainwater.rainfallMm}
                    onChange={(e) =>
                      dispatchAction(
                        'update_rainwater_harvest',
                        { rainfallMm: Number(e.target.value) },
                        'mouse'
                      )
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Roof Catchment Area</span>
                    <span className="font-mono-tabular text-white">
                      {city.rainwater.roofAreaM2} m²
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={1200}
                    step={25}
                    value={city.rainwater.roofAreaM2}
                    onChange={(e) =>
                      dispatchAction(
                        'update_rainwater_harvest',
                        { roofAreaM2: Number(e.target.value) },
                        'mouse'
                      )
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Runoff Coefficient (Roof Type)</span>
                    <span className="font-mono-tabular text-white">
                      {city.rainwater.runoffCoeff.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.5}
                    max={0.95}
                    step={0.05}
                    value={city.rainwater.runoffCoeff}
                    onChange={(e) =>
                      dispatchAction(
                        'update_rainwater_harvest',
                        { runoffCoeff: Number(e.target.value) },
                        'mouse'
                      )
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">Storage Tank Capacity</span>
                    <span className="font-mono-tabular text-white">
                      {city.rainwater.tankCapacityLitres.toLocaleString()} L
                    </span>
                  </div>
                  <input
                    type="range"
                    min={5000}
                    max={60000}
                    step={2500}
                    value={city.rainwater.tankCapacityLitres}
                    onChange={(e) =>
                      dispatchAction(
                        'update_rainwater_harvest',
                        { tankCapacityLitres: Number(e.target.value) },
                        'mouse'
                      )
                    }
                    className="w-full accent-cyan-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-white/10 pt-2.5">
                <span className="text-xs text-slate-300">Event Yield</span>
                <span className="font-mono-tabular text-base font-semibold text-cyan-300">
                  {metrics.rainwaterFormulaLitres.toLocaleString()} Litres
                </span>
              </div>

              {/* Tank Level Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-300 font-mono-tabular">
                  <span>
                    Cistern Stored: {city.rainwater.tankStoredLitres.toLocaleString()} L (
                    {tankFillPct}%)
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full bg-cyan-400 transition-all duration-200"
                    style={{ width: `${tankFillPct}%` }}
                  />
                </div>
              </div>

              {metrics.rainwaterOverflowLitres > 0 && (
                <div className="text-[11px] text-amber-300">
                  Tank full warning: {metrics.rainwaterOverflowLitres.toLocaleString()} L would
                  overflow to groundwater recharge bioswales.
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => dispatchAction('collect_rainwater_cistern', {}, 'mouse')}
                  className="flex-1 rounded-md bg-cyan-500/20 border border-cyan-400/35 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/30 transition-colors"
                >
                  Collect Into Cistern
                </button>
                <button
                  type="button"
                  onClick={() => dispatchAction('drain_rainwater_cistern', {}, 'mouse')}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                >
                  Drain
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: WASTEWATER RECYCLING STAGES & CITY EMERGENCY MODE */}
        {city.activeTab === 'recycling-crisis' && (
          <div className="space-y-5">
            {/* 7-Stage Wastewater Treatment */}
            <div className="space-y-3 rounded-lg border border-white/10 bg-[#040a14] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
                  <Recycle className="h-3.5 w-3.5" />
                  <span>7-Stage Wastewater Recycling</span>
                </div>
                <span className="font-mono-tabular text-xs text-purple-200">
                  {metrics.recycledSupplyMLd.toFixed(1)} ML/d recovered
                </span>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {WASTEWATER_STAGES.map((st, idx) => (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() =>
                      dispatchAction('set_recycling_stage', { step: idx }, 'mouse')
                    }
                    className={`rounded py-1 font-mono-tabular text-xs font-semibold transition-colors ${
                      city.activeRecyclingStage === idx
                        ? 'bg-purple-500/30 text-purple-100 border border-purple-400/50'
                        : 'bg-white/5 text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {st.step}
                  </button>
                ))}
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-xs font-semibold text-white">
                  Stage {activeStage.step}: {activeStage.name}
                </div>
                <div className="text-[11px] text-purple-300">{activeStage.processType}</div>
                <p className="text-xs leading-relaxed text-slate-300">{activeStage.description}</p>
                <div className="text-[11px] text-slate-400">
                  Removes: {activeStage.contaminantsRemoved}
                </div>
              </div>
            </div>

            {/* City Emergency Mode */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-300">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  <span>City Emergency Response</span>
                </div>
                <div className="flex items-center gap-1 font-mono-tabular text-xs text-cyan-200">
                  <Gauge className="h-3.5 w-3.5" />
                  <span>Resilience: {metrics.cityResilienceScore}/100</span>
                </div>
              </div>

              <div className="space-y-2">
                {CITY_EMERGENCIES.map((em) => {
                  const solved =
                    city.resolvedEmergencies.includes(em.id) &&
                    !(em.id === 'em-leak' && city.leak.active);
                  return (
                    <div
                      key={em.id}
                      className={`rounded-lg border p-3 space-y-2 ${
                        solved
                          ? 'border-emerald-500/30 bg-emerald-500/5'
                          : 'border-white/10 bg-[#040a14]'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-semibold text-white">{em.title}</div>
                          <div className="text-[11px] text-slate-400 mt-0.5">{em.issue}</div>
                        </div>
                        {solved ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                        ) : (
                          <Activity className="h-4 w-4 text-amber-400 shrink-0" />
                        )}
                      </div>
                      <div className="text-[11px] text-cyan-300/85">{em.metricLabel}</div>
                      {!solved ? (
                        <button
                          type="button"
                          onClick={() =>
                            dispatchAction('solve_city_emergency', { emergencyId: em.id }, 'mouse')
                          }
                          className="w-full rounded-md border border-cyan-400/35 bg-cyan-500/15 py-1.5 text-xs font-medium text-cyan-100 hover:bg-cyan-500/25 transition-colors"
                        >
                          {em.actionLabel}
                        </button>
                      ) : (
                        <div className="text-[11px] text-emerald-300">{em.impactSummary}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};
