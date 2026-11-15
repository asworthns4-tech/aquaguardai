import React, { useMemo, useState } from 'react';
import {
  Activity,
  Award,
  CheckCircle2,
  ChevronRight,
  Circle,
  Droplets,
  Gauge,
  HelpCircle,
  RotateCcw,
  Sparkles,
  Wrench,
} from 'lucide-react';
import { computeSmartCityMgmtModel } from '../services/labSimulationEngine';
import {
  DIFFICULTY_PROFILES,
  MISSION_STAGES,
  MissionDifficulty,
  evaluateMissionStage,
} from '../services/missionEngine';
import { computeCityMetrics, computeUndergroundMetrics } from '../services/simulationEngine';
import { useAppState } from '../state/appStore';

export const SaveTheCityMissionView: React.FC = () => {
  const { state, dispatch, dispatchAction } = useAppState();
  const { city, underground, mission } = state;
  const metrics = computeCityMetrics(city);
  const ugMetrics = computeUndergroundMetrics(underground, city);
  const mgmtModel = computeSmartCityMgmtModel(city, underground);
  const diffProfile = DIFFICULTY_PROFILES[mission.difficulty] ?? DIFFICULTY_PROFILES.medium;

  const activeStageMeta =
    MISSION_STAGES.find((s) => s.id === mission.activeStageId) ?? MISSION_STAGES[0];

  const liveEval = useMemo(
    () => evaluateMissionStage(mission.activeStageId, city, underground, mission),
    [mission, city, underground]
  );

  const [lastSubmittedResult, setLastSubmittedResult] = useState<{
    stageId: string;
    passed: boolean;
    feedback: string;
    pointsEarned: number;
  } | null>(null);

  const [hintOpen, setHintOpen] = useState(false);

  const handleEvaluate = () => {
    const res = dispatchAction('evaluate_mission', { stageId: mission.activeStageId }, 'mouse');
    const data = res.data as
      | { passed?: boolean; pointsEarned?: number; stageId?: string }
      | undefined;
    setLastSubmittedResult({
      stageId: mission.activeStageId,
      passed: Boolean(data?.passed),
      feedback: res.message,
      pointsEarned: Number(data?.pointsEarned ?? 0),
    });
  };

  const completedCount = mission.completedStages.length;
  const progressPct = Math.round((completedCount / MISSION_STAGES.length) * 100);

  const badgeTitle =
    completedCount >= 5
      ? 'Planet Protector'
      : completedCount >= 3
        ? 'Sustainability Engineer'
        : completedCount >= 1
          ? 'Water Guardian'
          : 'Water Explorer';

  return (
    <div className="aqua-scroll h-full w-full overflow-y-auto bg-[#040a14] p-4 pb-16 lg:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Mission Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-cyan-500/25 bg-[#061121] p-6 shadow-2xl">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium text-cyan-300">
              <Sparkles className="h-4 w-4" />
              <span>AquaGuard AI · The Living Planet · Module 06 · Save the City Mission</span>
            </div>
            <h1 className="mt-1 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Water Crisis Mission Command
            </h1>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-slate-300">
              You are the Water Sustainability Commander. Resolve drought alerts, repair trunk
              leaks, rebalance aquifers, and raise the Simulated Sustainability Index using
              connected 3D scenes or direct command controls.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wider text-cyan-300">Total Score</div>
              <div className="font-mono-tabular text-xl font-semibold text-white">
                {mission.score} <span className="text-xs font-normal text-slate-400">PTS</span>
              </div>
            </div>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2.5 text-center">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300">Rank Badge</div>
              <div className="text-xs font-semibold text-emerald-200">{badgeTitle}</div>
            </div>
          </div>
        </div>

        {/* Progress, Difficulty & Replay Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-[#061121] px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="text-xs font-medium text-slate-300">
              Progress:{' '}
              <span className="font-mono-tabular text-cyan-300">{completedCount}/5 Stages</span>
            </div>
            <div
              className="h-2 w-36 overflow-hidden rounded-full bg-slate-800"
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-cyan-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-400">Difficulty:</span>
            {(['easy', 'medium', 'hard'] as MissionDifficulty[]).map((diff) => (
              <button
                key={diff}
                type="button"
                onClick={() => dispatchAction('set_mission_difficulty', { difficulty: diff }, 'mouse')}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                  mission.difficulty === diff
                    ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'
                }`}
              >
                {diff}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setLastSubmittedResult(null);
                dispatchAction('reset_mission', {}, 'mouse');
              }}
              className="ml-2 flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Replay Mission</span>
            </button>
          </div>
        </div>

        {/* Post-Mission Completion Summary */}
        {mission.gameCompleted && (
          <div className="rounded-2xl border border-emerald-400/45 bg-emerald-500/10 p-6 space-y-3 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Award className="h-6 w-6 text-emerald-300" />
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-emerald-300">
                    All 5 Stages Completed · {diffProfile.label}
                  </div>
                  <h2 className="font-display text-xl font-bold text-white">
                    City Water Resilience Secured — Learning Summary
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setLastSubmittedResult(null);
                  dispatchAction('reset_mission', {}, 'mouse');
                }}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
              >
                Play Again
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
              <div className="rounded-xl border border-emerald-400/25 bg-[#040a14]/80 p-3">
                <div className="font-semibold text-emerald-200">What Happened</div>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  Your interventions resolved drought shortages, sealed {mission.leaksRepaired}{' '}
                  pipeline burst(s), lowered pumping stress, and raised the Simulated Sustainability
                  Index to {mgmtModel.sustainabilityIndicator}/100.
                </p>
              </div>
              <div className="rounded-xl border border-emerald-400/25 bg-[#040a14]/80 p-3">
                <div className="font-semibold text-cyan-200">Why It Worked</div>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  Combining non-revenue water leak repair with purple-pipe wastewater recycling (
                  {city.recyclingCapacityPct}%) reduced raw river &amp; aquifer extraction while
                  preserving reservoir storage ({city.reservoirStoragePct}%).
                </p>
              </div>
              <div className="rounded-xl border border-emerald-400/25 bg-[#040a14]/80 p-3">
                <div className="font-semibold text-amber-200">Next Optimization Challenge</div>
                <p className="mt-1 text-slate-300 leading-relaxed">
                  Try <span className="font-semibold">Hard</span> difficulty to manage severe
                  heatwave demand ({DIFFICULTY_PROFILES.hard.thresholds.finalMinSsi}+ Sustainability
                  Index with 0 ML/d aquifer depletion).
                </p>
              </div>
            </div>
          </div>
        )}

        {/* 5 Mission Stages Navigation Strip */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {MISSION_STAGES.map((stage) => {
            const isCurrent = stage.id === mission.activeStageId;
            const isCompleted = mission.completedStages.includes(stage.id);
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => {
                  setLastSubmittedResult(null);
                  dispatchAction('select_mission_stage', { stageId: stage.id }, 'mouse');
                }}
                className={`flex flex-col justify-between rounded-xl border p-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
                  isCurrent
                    ? 'border-cyan-400/60 bg-cyan-500/20 shadow-lg'
                    : isCompleted
                      ? 'border-emerald-500/40 bg-emerald-500/10'
                      : 'border-white/10 bg-[#061121] hover:border-cyan-400/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono-tabular text-xs font-bold text-cyan-300">
                    Mission {stage.number}
                  </span>
                  {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : (
                    <Activity className="h-3.5 w-3.5 text-slate-400" />
                  )}
                </div>
                <div className="mt-2 text-xs font-semibold text-white leading-tight">
                  {stage.title}
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Stage Briefing & Interactive Controls */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: Briefing, Live Verification Checklist & Evaluate */}
          <div className="space-y-5 rounded-2xl border border-cyan-500/20 bg-[#061121] p-6 lg:col-span-6">
            <div className="border-b border-white/10 pb-3">
              <div className="flex items-center justify-between text-xs font-medium text-cyan-300">
                <span>
                  Mission {activeStageMeta.number} Briefing · {diffProfile.label}
                </span>
                <span className="font-mono-tabular text-slate-400">
                  +{Math.round(activeStageMeta.basePoints * diffProfile.scoreMultiplier)} PTS
                </span>
              </div>
              <h2 className="mt-0.5 font-display text-2xl font-semibold text-white">
                {activeStageMeta.title}
              </h2>
              <p className="mt-1 text-xs text-slate-400">{activeStageMeta.subtitle}</p>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-semibold text-cyan-200">Scenario Context</div>
              <p className="text-xs leading-relaxed text-slate-300">{activeStageMeta.scenario}</p>
            </div>

            {/* Live Objective Checklist */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-cyan-200">Live Objective Checklist</div>
              <ul className="space-y-2 text-xs">
                {liveEval.checks.map((chk) => (
                  <li
                    key={chk.label}
                    className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
                      chk.met
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
                        : 'border-white/10 bg-[#040a14] text-slate-200'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {chk.met ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-slate-500 shrink-0" />
                      )}
                      <span>{chk.label}</span>
                    </span>
                    {chk.detail && (
                      <span className="font-mono-tabular text-[11px] text-cyan-200/90 shrink-0">
                        {chk.detail}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {/* Mission 1 Dedicated Interactive Diagnostic Buttons */}
            {mission.activeStageId === 'drought-alert' && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_MISSION_STATE',
                      patch: { inspectedReservoir: true, gameStarted: true },
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    mission.inspectedReservoir
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                  }`}
                >
                  {mission.inspectedReservoir
                    ? `Reservoir Inspected (${city.reservoirStoragePct}%)`
                    : 'Inspect Surface Reservoir'}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_MISSION_STATE',
                      patch: { inspectedWaterBalance: true, gameStarted: true },
                    })
                  }
                  className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    mission.inspectedWaterBalance
                      ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                      : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                  }`}
                >
                  {mission.inspectedWaterBalance
                    ? `Balance Analyzed (${metrics.netBalanceMLd.toFixed(1)} ML/d)`
                    : 'Analyze City Water Balance'}
                </button>
              </div>
            )}

            <div className="rounded-xl border border-cyan-500/20 bg-[#040a14] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-cyan-300">Scientific Principle</span>
                <button
                  type="button"
                  onClick={() => setHintOpen(!hintOpen)}
                  className="flex items-center gap-1 text-[11px] text-cyan-300 hover:underline focus-visible:outline-2 focus-visible:outline-cyan-400 rounded"
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  <span>{hintOpen ? 'Hide Hint' : 'Request Hint'}</span>
                </button>
              </div>
              <p className="text-xs leading-relaxed text-slate-300">
                {activeStageMeta.sciencePrinciple}
              </p>
              {hintOpen && (
                <div className="mt-2 rounded-lg border border-amber-400/40 bg-amber-500/15 p-2.5 text-xs text-amber-100">
                  <span className="font-semibold">Commander Hint:</span> {activeStageMeta.hint}
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleEvaluate}
                className="flex-1 rounded-xl bg-cyan-500 py-3 text-xs font-semibold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg focus-visible:outline-2 focus-visible:outline-white"
              >
                Evaluate Mission Objectives
              </button>
              <button
                type="button"
                title="Reset Mission Progress"
                onClick={() => {
                  setLastSubmittedResult(null);
                  dispatchAction('reset_mission', {}, 'mouse');
                }}
                className="rounded-xl border border-white/15 bg-white/5 px-4 py-3 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>

            {lastSubmittedResult && lastSubmittedResult.stageId === mission.activeStageId && (
              <div
                className={`rounded-xl border p-4 text-xs space-y-1.5 ${
                  lastSubmittedResult.passed
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-100'
                    : 'border-amber-400/40 bg-amber-500/15 text-amber-100'
                }`}
              >
                <div className="flex items-center justify-between font-semibold">
                  <span>
                    {lastSubmittedResult.passed
                      ? 'Stage Successfully Passed!'
                      : 'Objectives Not Yet Met'}
                  </span>
                  {lastSubmittedResult.passed && lastSubmittedResult.pointsEarned > 0 && (
                    <span className="font-mono-tabular text-emerald-300">
                      +{lastSubmittedResult.pointsEarned} PTS
                    </span>
                  )}
                </div>
                <p className="leading-relaxed">{lastSubmittedResult.feedback}</p>
                {lastSubmittedResult.passed && activeStageMeta.number < 5 && (
                  <button
                    type="button"
                    onClick={() => {
                      const next = MISSION_STAGES[activeStageMeta.number];
                      if (next) {
                        setLastSubmittedResult(null);
                        dispatchAction('select_mission_stage', { stageId: next.id }, 'mouse');
                      }
                    }}
                    className="mt-1 inline-flex items-center gap-1 rounded-md bg-emerald-500/25 border border-emerald-400/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 hover:bg-emerald-500/35"
                  >
                    <span>Advance to Mission {activeStageMeta.number + 1}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right: Live City Status Dashboard & Direct Mission Sliders */}
          <div className="space-y-4 rounded-2xl border border-cyan-500/20 bg-[#061121] p-6 lg:col-span-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <div className="text-xs font-medium text-slate-400">
                  Simulated Exhibition Model · Synced Live
                </div>
                <h3 className="font-display text-lg font-semibold text-white">
                  Live Smart City &amp; Aquifer Telemetry
                </h3>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-xs font-mono-tabular text-cyan-200">
                <Gauge className="h-3.5 w-3.5" />
                <span>SSI: {mgmtModel.sustainabilityIndicator}/100</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#040a14] p-3">
                <div className="text-[11px] text-slate-400">Surface Reservoir</div>
                <div className="mt-1 font-mono-tabular text-lg font-semibold text-white">
                  {city.reservoirStoragePct}%
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#040a14] p-3">
                <div className="text-[11px] text-slate-400">City Water Balance</div>
                <div
                  className={`mt-1 font-mono-tabular text-lg font-semibold ${
                    metrics.netBalanceMLd >= 0 ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {metrics.netBalanceMLd >= 0 ? '+' : ''}
                  {metrics.netBalanceMLd.toFixed(1)} <span className="text-xs">ML/d</span>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#040a14] p-3">
                <div className="text-[11px] text-slate-400">Pipeline Leak</div>
                <div
                  className={`mt-1 text-sm font-semibold ${
                    city.leak.active ? 'text-amber-300' : 'text-emerald-300'
                  }`}
                >
                  {city.leak.active ? `${city.leak.severityLph.toLocaleString()} L/h` : 'All Sealed'}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#040a14] p-3">
                <div className="text-[11px] text-slate-400">Wastewater Reuse</div>
                <div className="mt-1 font-mono-tabular text-lg font-semibold text-purple-300">
                  {city.recyclingCapacityPct}%
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#040a14] p-3">
                <div className="text-[11px] text-slate-400">Aquifer Net Flow</div>
                <div
                  className={`mt-1 font-mono-tabular text-lg font-semibold ${
                    ugMetrics.netBalanceMLd >= 0 ? 'text-emerald-300' : 'text-amber-300'
                  }`}
                >
                  {ugMetrics.netBalanceMLd >= 0 ? '+' : ''}
                  {ugMetrics.netBalanceMLd.toFixed(1)} <span className="text-xs">ML/d</span>
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#040a14] p-3">
                <div className="text-[11px] text-slate-400">Simulated Saved</div>
                <div className="mt-1 font-mono-tabular text-lg font-semibold text-cyan-300">
                  {Math.round(mission.waterSavedLitres / 1000).toLocaleString()}{' '}
                  <span className="text-xs">kL</span>
                </div>
              </div>
            </div>

            {/* Direct Mission Engineering Controls */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-[#040a14] p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-cyan-300">
                  <Droplets className="h-3.5 w-3.5" />
                  <span>Direct Commander Simulation Controls</span>
                </span>
                {city.leak.active ? (
                  <button
                    type="button"
                    onClick={() => dispatchAction('repair_pipeline_leak', {}, 'mouse')}
                    className="flex items-center gap-1 rounded-md bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-emerald-400 transition-colors"
                  >
                    <Wrench className="h-3 w-3" />
                    <span>Repair Active Burst</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => dispatchAction('create_pipeline_leak', {}, 'mouse')}
                    className="rounded-md border border-amber-400/40 bg-amber-500/15 px-2.5 py-1 text-[11px] font-medium text-amber-200 hover:bg-amber-500/25 transition-colors"
                  >
                    Simulate Burst Test
                  </button>
                )}
              </div>

              {[
                {
                  label: 'Wastewater Recycling Capacity',
                  value: `${city.recyclingCapacityPct}%`,
                  min: 0,
                  max: 85,
                  step: 1,
                  raw: city.recyclingCapacityPct,
                  onChange: (v: number) =>
                    dispatchAction('set_recycling_rate', { value: v }, 'mouse'),
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
                {
                  label: 'City Demand Multiplier',
                  value: `${Math.round(city.demandMultiplier * 100)}%`,
                  min: 0.6,
                  max: 1.5,
                  step: 0.05,
                  raw: city.demandMultiplier,
                  onChange: (v: number) =>
                    dispatchAction('set_water_demand', { value: v }, 'mouse'),
                },
                {
                  label: 'Surface Reservoir Level',
                  value: `${city.reservoirStoragePct}%`,
                  min: 15,
                  max: 100,
                  step: 1,
                  raw: city.reservoirStoragePct,
                  onChange: (v: number) =>
                    dispatchAction('set_reservoir_storage', { value: v }, 'mouse'),
                },
                {
                  label: 'Monsoon Rainfall Intensity',
                  value: `${city.rainfallIntensity} mm`,
                  min: 0,
                  max: 120,
                  step: 2,
                  raw: city.rainfallIntensity,
                  onChange: (v: number) =>
                    dispatchAction('set_rainfall', { value: v }, 'mouse'),
                },
              ].map((ctrl) => (
                <div key={ctrl.label} className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-300">{ctrl.label}</span>
                    <span className="font-mono-tabular text-cyan-200">{ctrl.value}</span>
                  </div>
                  <input
                    type="range"
                    aria-label={ctrl.label}
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

            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="text-xs font-semibold text-cyan-300">Jump to 3D Environments</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => dispatchAction('navigate_to_city', {}, 'mouse')}
                  className="rounded-xl border border-cyan-400/35 bg-cyan-500/15 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition-colors"
                >
                  3D Smart City
                </button>
                <button
                  type="button"
                  onClick={() => dispatchAction('navigate_to_underground', {}, 'mouse')}
                  className="rounded-xl border border-cyan-400/35 bg-cyan-500/15 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition-colors"
                >
                  3D Aquifer
                </button>
                <button
                  type="button"
                  onClick={() => dispatchAction('navigate_to_lab', {}, 'mouse')}
                  className="rounded-xl border border-cyan-400/35 bg-cyan-500/15 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/25 transition-colors"
                >
                  Science Lab
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
