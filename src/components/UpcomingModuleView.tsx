import React from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { EXHIBITION_MODULES } from '../data/earthWaterData';
import { useAppState } from '../state/appStore';

export const UpcomingModuleView: React.FC = () => {
  const { state, dispatchAction } = useAppState();
  const mod = EXHIBITION_MODULES.find((m) => m.id === state.currentScene);

  if (!mod) return null;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#040a14] p-6">
      <div className="w-full max-w-xl rounded-xl border border-cyan-500/25 bg-[#061121] p-8 shadow-2xl">
        <div className="flex items-center gap-2 text-xs text-cyan-300 font-mono-tabular">
          <span>Module {mod.number}</span>
          <span aria-hidden="true">·</span>
          <span>Scheduled for Phase {mod.phase}</span>
        </div>

        <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">
          {mod.label}
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-300">{mod.description}</p>

        <div className="mt-6 border-t border-white/10 pt-5">
          <div className="text-xs font-medium text-slate-400">
            Capabilities Planned in This Exhibition Module
          </div>
          <ul className="mt-3 space-y-2">
            {mod.plannedFeatures.map((feat) => (
              <li key={feat} className="flex items-center gap-2.5 text-sm text-slate-200">
                <CheckCircle2 className="h-4 w-4 text-cyan-400 shrink-0" />
                <span>{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex items-center justify-between gap-4 border-t border-white/10 pt-5">
          <span className="text-xs text-slate-400">
            Centralized exhibition state &amp; action registry connected
          </span>
          <button
            type="button"
            onClick={() => dispatchAction('navigate_to_earth', {}, 'mouse')}
            className="flex items-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-4 py-2 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition-colors whitespace-nowrap"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Return to 3D Earth Explorer</span>
          </button>
        </div>
      </div>
    </div>
  );
};
