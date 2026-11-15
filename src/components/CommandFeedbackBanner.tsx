import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useAppState } from '../state/appStore';

export const CommandFeedbackBanner: React.FC = () => {
  const { state, dispatch } = useAppState();
  const feedback = state.interaction.actionFeedback;

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => {
      dispatch({ type: 'CLEAR_ACTION_FEEDBACK' });
    }, 4200);
    return () => window.clearTimeout(timer);
  }, [feedback, dispatch]);

  if (!feedback) return null;

  const isError = feedback.status === 'error';

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto absolute top-3 left-3 z-30 max-w-sm rounded-lg border px-3 py-2 shadow-xl transition-all duration-150 bg-[#040a14]/96 border-cyan-500/30"
      style={{
        borderColor: isError ? 'rgba(245, 158, 11, 0.45)' : 'rgba(34, 211, 238, 0.35)',
      }}
    >
      <div className="flex items-start gap-2.5">
        {isError ? (
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cyan-300" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className="font-mono-tabular font-semibold text-white">
              {feedback.actionName}
            </span>
            <span className="text-slate-500">·</span>
            <span className="uppercase tracking-wider text-slate-400">{feedback.source}</span>
            {feedback.updatedValue && (
              <>
                <span className="text-slate-500">·</span>
                <span className="font-mono-tabular font-semibold text-cyan-300">
                  {feedback.updatedValue}
                </span>
              </>
            )}
          </div>
          <p className={`mt-0.5 text-xs leading-snug ${isError ? 'text-amber-200' : 'text-slate-200'}`}>
            {feedback.message}
          </p>
          {isError && feedback.error && feedback.error !== feedback.message && (
            <p className="mt-0.5 font-mono-tabular text-[11px] text-amber-300/80">
              {feedback.error}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => dispatch({ type: 'CLEAR_ACTION_FEEDBACK' })}
          aria-label="Dismiss feedback"
          className="rounded p-0.5 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
