import React, { useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Pause,
  Play,
  RotateCcw,
  Terminal,
  X,
  XCircle,
} from 'lucide-react';
import { ACTION_CATALOG } from '../services/actionRegistry';
import { computeIntegratedWaterBalance } from '../services/simulationEngine';
import { useAppState } from '../state/appStore';
import { InteractionSource, RegisteredActionName } from '../types/exhibition';

export const InteractionDebugPanel: React.FC = () => {
  const { state, dispatchAction, aquaBridge, gestureBridge } = useAppState();
  const [selectedAction, setSelectedAction] = useState<RegisteredActionName>('set_rainfall');
  const [testSource, setTestSource] = useState<InteractionSource>('debug');
  const [paramsText, setParamsText] = useState<string>('{\n  "value": 95\n}');
  const [parseError, setParseError] = useState<string | null>(null);
  const [confirmGlobalReset, setConfirmGlobalReset] = useState(false);

  const selectedCatalog = ACTION_CATALOG.find((a) => a.name === selectedAction) ?? ACTION_CATALOG[0];

  useEffect(() => {
    setParamsText(JSON.stringify(selectedCatalog.defaultParams, null, 2));
    setParseError(null);
  }, [selectedAction, selectedCatalog]);

  if (state.exhibitionMode || !state.debugPanelOpen) {
    return null;
  }

  const integrated = computeIntegratedWaterBalance(state);
  const aquaSnap = aquaBridge.getState();
  const gestureSnap = gestureBridge.getCurrentState();

  const handleExecuteTest = () => {
    try {
      const parsed = paramsText.trim() ? (JSON.parse(paramsText) as Record<string, unknown>) : {};
      setParseError(null);
      if (testSource === 'aqua') {
        aquaBridge.submitAction(selectedAction, parsed);
      } else {
        dispatchAction(selectedAction, parsed, testSource);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : 'Invalid JSON payload');
    }
  };

  return (
    <aside
      aria-label="Developer Interaction Debug Panel"
      className="aqua-scroll fixed top-16 left-4 bottom-24 z-30 flex w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-xl border border-cyan-400/35 bg-[#050e1c]/97 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-cyan-300" />
          <div>
            <div className="text-[11px] font-medium text-cyan-300/90">
              Developer State &amp; Action Inspector
            </div>
            <h2 className="font-display text-sm font-semibold text-white">
              Central Interaction Bus
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dispatchAction('toggle_debug_panel', { value: false }, 'debug')}
          aria-label="Close Debug Panel"
          className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="aqua-scroll flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        {/* Global Simulation Controls */}
        <div className="rounded-lg border border-white/10 bg-[#040a14] p-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-cyan-300" />
              Global Simulation Controls
            </span>
            <span
              className={`font-mono-tabular text-[11px] font-semibold ${
                state.simulationParams.running ? 'text-emerald-300' : 'text-amber-300'
              }`}
            >
              {state.simulationParams.running ? `Running (${state.simulationParams.speed}×)` : 'Paused'}
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() =>
                dispatchAction(
                  state.simulationParams.running ? 'pause_simulation' : 'resume_simulation',
                  {},
                  'debug'
                )
              }
              className="flex items-center gap-1 rounded-md border border-cyan-400/30 bg-cyan-500/15 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/25"
            >
              {state.simulationParams.running ? (
                <>
                  <Pause className="h-3 w-3" />
                  <span>Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3 w-3" />
                  <span>Resume</span>
                </>
              )}
            </button>
            {[0.5, 1, 2].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => dispatchAction('set_simulation_speed', { speed: spd }, 'debug')}
                className={`rounded-md px-2 py-1 font-mono-tabular text-[11px] ${
                  state.simulationParams.speed === spd && state.simulationParams.running
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/35'
                    : 'bg-white/5 text-slate-300 border border-white/10 hover:bg-white/10'
                }`}
              >
                {spd}×
              </button>
            ))}
            {!confirmGlobalReset ? (
              <button
                type="button"
                onClick={() => setConfirmGlobalReset(true)}
                className="ml-auto flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-slate-300 hover:bg-white/10"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Reset All</span>
              </button>
            ) : (
              <div className="ml-auto flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    dispatchAction('reset_simulation', { confirmed: true }, 'debug');
                    setConfirmGlobalReset(false);
                  }}
                  className="rounded-md border border-amber-400/40 bg-amber-500/25 px-2 py-1 text-[11px] font-semibold text-amber-200"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmGlobalReset(false)}
                  className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Core Shared State Telemetry */}
        <div className="rounded-lg border border-white/10 bg-[#040a14] p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Centralized Shared State
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono-tabular text-[11px]">
            <div className="text-slate-400">Scene:</div>
            <div className="text-white">
              {state.currentScene}
              {state.previousScene ? ` (prev: ${state.previousScene})` : ''}
            </div>

            <div className="text-slate-400">Active Camera:</div>
            <div className="text-cyan-200 truncate">{state.camera.activeCameraId}</div>

            <div className="text-slate-400">Selected ID:</div>
            <div className="text-emerald-300 truncate">
              {state.selectedObject
                ? `${state.selectedObject.canonicalId ?? state.selectedObject.id}`
                : 'none'}
            </div>

            <div className="text-slate-400">Source / Mode:</div>
            <div className="text-white">
              {state.interaction.currentSource} / {state.interactionMode}
            </div>

            <div className="text-slate-400">AQUA / Gesture:</div>
            <div className="text-slate-200">
              {state.interaction.voiceStatus} / {state.interaction.gestureStatus}
            </div>

            <div className="text-slate-400">Rainfall (Synced):</div>
            <div className="text-cyan-300">
              City {state.city.rainfallIntensity} mm · Lab {state.city.rainwater.rainfallMm} mm
            </div>

            <div className="text-slate-400">Demand / GW Ext:</div>
            <div className="text-white">
              {Math.round(state.city.demandMultiplier * 100)}% / {state.city.groundwaterExtractionPct}%
            </div>

            <div className="text-slate-400">Water Table / Storage:</div>
            <div className="text-cyan-200">
              {state.underground.waterTableDepthM.toFixed(1)} m ({integrated.underground.aquiferStoragePct}%)
            </div>

            <div className="text-slate-400">Leak / Sustainability:</div>
            <div className={state.city.leak.active ? 'text-amber-300' : 'text-emerald-300'}>
              {state.city.leak.active ? 'ACTIVE' : 'Sealed'} · {integrated.systemSustainabilityPct}/100
            </div>
          </div>

          <div className="border-t border-white/10 pt-2 text-[11px] text-slate-400">
            Bridge Sync Check: AQUA={aquaSnap.city.rainfallIntensityMm}mm, Gesture=
            {gestureSnap.rainfallMm}mm, Table={gestureSnap.waterTableDepthM.toFixed(1)}m
          </div>
        </div>

        {/* Registered Action Tester */}
        <div className="rounded-lg border border-cyan-500/20 bg-[#040a14] p-3 space-y-2.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
            Test Registered Action ({ACTION_CATALOG.length} Total)
          </div>

          <div className="grid grid-cols-3 gap-2">
            <select
              aria-label="Registered action"
              value={selectedAction}
              onChange={(e) => setSelectedAction(e.target.value as RegisteredActionName)}
              className="col-span-2 rounded-md border border-white/15 bg-[#081529] px-2 py-1.5 text-[11px] text-white"
            >
              {ACTION_CATALOG.map((a) => (
                <option key={a.name} value={a.name}>
                  [{a.category}] {a.name}
                </option>
              ))}
            </select>

            <select
              aria-label="Interaction source"
              value={testSource}
              onChange={(e) => setTestSource(e.target.value as InteractionSource)}
              className="rounded-md border border-white/15 bg-[#081529] px-2 py-1.5 text-[11px] text-cyan-200"
            >
              <option value="debug">debug</option>
              <option value="aqua">aqua</option>
              <option value="gesture">gesture</option>
              <option value="mouse">mouse</option>
              <option value="keyboard">keyboard</option>
            </select>
          </div>

          <p className="text-[11px] text-slate-400">
            {selectedCatalog.description} (Scenes:{' '}
            {Array.isArray(selectedCatalog.permittedScenes)
              ? selectedCatalog.permittedScenes.join(', ')
              : 'any'}
            )
          </p>

          <textarea
            aria-label="Action parameters JSON"
            rows={3}
            value={paramsText}
            onChange={(e) => setParamsText(e.target.value)}
            className="w-full rounded-md border border-white/15 bg-[#020710] p-2 font-mono-tabular text-[11px] text-cyan-100"
          />

          {parseError && <div className="text-[11px] text-amber-300">{parseError}</div>}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExecuteTest}
              className="flex-1 rounded-md border border-cyan-400/40 bg-cyan-500/20 py-1.5 text-[11px] font-semibold text-cyan-100 hover:bg-cyan-500/30"
            >
              Dispatch Action
            </button>
            <button
              type="button"
              onClick={() => gestureBridge.adjustSimulationValue('rainfall', 110)}
              className="rounded-md border border-white/15 bg-white/5 px-2.5 py-1.5 text-[11px] text-slate-200 hover:bg-white/10"
              title="Simulate Gesture Rainfall = 110 mm"
            >
              Gesture Rain 110
            </button>
          </div>
        </div>

        {/* Recent Actions Log */}
        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Recent Actions ({state.interaction.actionHistory.length})
          </div>
          {state.interaction.actionHistory.length === 0 ? (
            <p className="text-[11px] text-slate-500">No actions dispatched yet.</p>
          ) : (
            <div className="space-y-1.5">
              {state.interaction.actionHistory.slice(0, 12).map((item) => (
                <div
                  key={item.id}
                  className="rounded-md border border-white/10 bg-[#040a14] px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {item.status === 'success' ? (
                        <CheckCircle2 className="h-3 w-3 shrink-0 text-emerald-300" />
                      ) : (
                        <XCircle className="h-3 w-3 shrink-0 text-amber-300" />
                      )}
                      <span className="font-mono-tabular font-semibold text-white truncate">
                        {item.actionName}
                      </span>
                    </div>
                    <span className="font-mono-tabular text-[10px] uppercase text-cyan-300/80 shrink-0">
                      {item.source}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-300 leading-snug">
                    {item.message}
                  </div>
                  {item.paramsSummary && (
                    <div className="mt-0.5 font-mono-tabular text-[10px] text-slate-500">
                      {item.paramsSummary}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};
