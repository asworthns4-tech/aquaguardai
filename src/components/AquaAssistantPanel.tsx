import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Maximize2,
  Mic,
  MicOff,
  Minimize2,
  Send,
  ShieldAlert,
  Square,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useAquaController } from '../hooks/useAquaController';
import { useAppState } from '../state/appStore';
import { AquaLanguage } from '../types/exhibition';
import { AquaVoiceOrb } from './AquaVoiceOrb';

const QUICK_COMMANDS: Array<{ label: string; prompt: string }> = [
  { label: 'Show Kerala', prompt: 'Show Kerala' },
  { label: 'Smart City', prompt: 'Take me to the smart city' },
  { label: 'Underground Aquifer', prompt: 'Show groundwater depletion' },
  { label: 'Create Leak', prompt: 'Create a pipeline leak' },
  { label: 'What is this?', prompt: 'What is this?' },
  { label: 'Sim Status', prompt: 'What is happening in the current simulation?' },
];

const STATUS_LABEL: Record<'idle' | 'listening' | 'thinking' | 'speaking', string> = {
  idle: 'Ready',
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
};

export interface ConfidenceDisplayInfo {
  pct: number | null;
  tierLabel: string;
  toneTextClass: string;
  barColorClass: string;
  borderClass: string;
}

export function getConfidenceDisplay(
  confidence: number | null,
  isListening: boolean,
  hasTranscript: boolean
): ConfidenceDisplayInfo {
  if (confidence === null || !Number.isFinite(confidence)) {
    return {
      pct: null,
      tierLabel: isListening
        ? 'Awaiting Score'
        : hasTranscript
          ? 'Score Unavailable'
          : 'Standby',
      toneTextClass: 'text-slate-400',
      barColorClass: 'bg-slate-700',
      borderClass: isListening ? 'border-emerald-400/35' : 'border-white/15',
    };
  }

  const pct = Math.round(Math.min(1, Math.max(0, confidence)) * 100);
  if (pct >= 80) {
    return {
      pct,
      tierLabel: 'High Certainty',
      toneTextClass: 'text-emerald-300',
      barColorClass: 'bg-emerald-400',
      borderClass: 'border-emerald-400/35',
    };
  }
  if (pct >= 55) {
    return {
      pct,
      tierLabel: 'Moderate Certainty',
      toneTextClass: 'text-cyan-300',
      barColorClass: 'bg-cyan-400',
      borderClass: 'border-cyan-400/35',
    };
  }
  return {
    pct,
    tierLabel: 'Low Certainty',
    toneTextClass: 'text-amber-300',
    barColorClass: 'bg-amber-400',
    borderClass: 'border-amber-400/35',
  };
}

const METER_SEGMENTS = Array.from({ length: 20 }, (_, i) => i);

export const AquaAssistantPanel: React.FC = () => {
  const { state, dispatch, dispatchAction } = useAppState();
  const aqua = state.aqua;
  const {
    submitQuery,
    startListening,
    stopListening,
    stopSpeaking,
    confirmPending,
    setLanguage,
  } = useAquaController();

  const [inputText, setInputText] = useState('');
  const scrollEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (aqua.panelOpen && !aqua.minimized) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [aqua.messages.length, aqua.panelOpen, aqua.minimized]);

  // Do not render floating overlay when already inside full Module 07 Control Centre view
  if (!aqua.panelOpen || state.currentScene === 'aqua') {
    return null;
  }

  const activeTranscript = aqua.transcriptInterim || aqua.lastVoiceTranscript;
  const showConfidenceMeter =
    aqua.status === 'listening' ||
    Boolean(activeTranscript) ||
    aqua.transcriptConfidence !== null;
  const confidenceInfo = getConfidenceDisplay(
    aqua.transcriptConfidence,
    aqua.status === 'listening',
    Boolean(activeTranscript)
  );
  const activeSegmentCount =
    confidenceInfo.pct === null ? 0 : Math.round((confidenceInfo.pct / 100) * METER_SEGMENTS.length);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = inputText.trim();
    if (!val) return;
    setInputText('');
    void submitQuery(val, 'text');
  };

  // Minimized compact bar (non-obstructive bottom-left strip)
  if (aqua.minimized) {
    return (
      <div
        aria-label="AQUA AI Minimized Bar"
        className="fixed bottom-20 left-4 z-30 flex items-center gap-2.5 rounded-xl border border-cyan-500/35 bg-[#061121]/97 px-3 py-2 shadow-2xl"
      >
        <AquaVoiceOrb status={aqua.status} size="sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-white whitespace-nowrap">
            <span>AQUA AI</span>
            <span className="text-slate-500">·</span>
            <span className="font-mono-tabular text-[11px] text-cyan-300">
              {STATUS_LABEL[aqua.status]}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 whitespace-nowrap">
            {aqua.aiMode === 'live' ? 'Live Gemini AI' : 'Offline Demo Mode'}
          </div>
        </div>

        <button
          type="button"
          onClick={() =>
            aqua.status === 'listening'
              ? stopListening()
              : startListening((t) => setInputText(t))
          }
          title={aqua.status === 'listening' ? 'Stop Listening' : 'Speak to AQUA'}
          className={`rounded-lg border p-2 transition-colors ${
            aqua.status === 'listening'
              ? 'border-emerald-400/50 bg-emerald-500/20 text-emerald-200'
              : 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
          }`}
        >
          {aqua.status === 'listening' ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
        </button>

        {aqua.status === 'speaking' && (
          <button
            type="button"
            onClick={stopSpeaking}
            title="Stop Speaking"
            className="rounded-lg border border-rose-400/40 bg-rose-500/15 p-2 text-rose-200 hover:bg-rose-500/25"
          >
            <Square className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          onClick={() => dispatchAction('set_aqua_minimized', { minimized: false }, 'mouse')}
          aria-label="Expand AQUA panel"
          title="Expand AQUA panel"
          className="rounded-lg border border-white/15 bg-white/5 p-2 text-slate-200 hover:bg-white/10"
        >
          <Maximize2 className="h-3.5 w-3.5" />
        </button>

        <button
          type="button"
          onClick={() => dispatchAction('toggle_aqua_panel', { open: false }, 'mouse')}
          aria-label="Close AQUA panel"
          className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <aside
      aria-label="AQUA AI Assistant Console"
      className="fixed top-16 left-4 bottom-24 z-30 flex w-[calc(100vw-2rem)] max-w-[390px] flex-col overflow-hidden rounded-xl border border-cyan-500/30 bg-[#061121]/97 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <AquaVoiceOrb status={aqua.status} size="sm" />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap">
              <span className={aqua.aiMode === 'live' ? 'text-emerald-300' : 'text-amber-300'}>
                {aqua.aiMode === 'live' ? 'Live Gemini AI' : 'Offline Demo Mode'}
              </span>
              <span className="text-slate-500">·</span>
              <span className="font-mono-tabular text-cyan-300">{STATUS_LABEL[aqua.status]}</span>
            </div>
            <h2 className="truncate font-display text-sm font-semibold text-white">
              AQUA Control Assistant
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => dispatchAction('set_aqua_minimized', { minimized: true }, 'mouse')}
            aria-label="Minimise AQUA panel"
            title="Minimise panel"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => dispatchAction('toggle_aqua_panel', { open: false }, 'mouse')}
            aria-label="Close AQUA panel"
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mode & Language Controls Row */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#040a14] px-3 py-2 text-[11px]">
        <div className="flex items-center gap-1 rounded-md border border-white/10 bg-[#061121] p-0.5">
          {(['en', 'ml', 'hi'] as AquaLanguage[]).map((code) => {
            const label = code === 'en' ? 'EN' : code === 'ml' ? 'മലയാളം' : 'हिन्दी';
            const active = aqua.language === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setLanguage(code)}
                className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                  active
                    ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-400/35'
                    : 'text-slate-400 hover:text-white border border-transparent'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() =>
              dispatchAction('set_aqua_tts', { enabled: !aqua.ttsEnabled }, 'mouse')
            }
            title={aqua.ttsEnabled ? 'Disable spoken replies' : 'Enable spoken replies'}
            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium whitespace-nowrap ${
              aqua.ttsEnabled && aqua.ttsSupported
                ? 'border-cyan-400/30 bg-cyan-500/10 text-cyan-200'
                : 'border-white/10 bg-white/5 text-slate-400'
            }`}
          >
            {aqua.ttsEnabled ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
            <span>{aqua.ttsEnabled ? 'Voice On' : 'Muted'}</span>
          </button>

          {aqua.status === 'speaking' && (
            <button
              type="button"
              onClick={stopSpeaking}
              className="flex items-center gap-1 rounded-md border border-rose-400/45 bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-100 hover:bg-rose-500/30 whitespace-nowrap"
            >
              <Square className="h-3 w-3" />
              <span>Stop</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void submitQuery('clear chat', 'text')}
            title="Clear session messages"
            aria-label="Clear session messages"
            className="rounded-md border border-white/10 bg-white/5 p-1 text-slate-400 hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Mode / Language Limitation Transparency Strip */}
      {(aqua.aiMode === 'offline-demo' || !aqua.ttsLanguageSupported || !aqua.micSupported) && (
        <div className="border-b border-white/10 bg-[#050d1a] px-3 py-1.5 text-[11px] leading-snug text-slate-400">
          {aqua.aiMode === 'offline-demo' && (
            <div>
              <span className="font-semibold text-amber-300">Offline Demo Mode:</span>{' '}
              Local rule-based science &amp; command engine active
              {aqua.aiReason ? ` (${aqua.aiReason})` : '.'}
            </div>
          )}
          {!aqua.ttsLanguageSupported && aqua.language !== 'en' && (
            <div className="mt-0.5 text-amber-300/90">
              Text chat active; browser speech voice for{' '}
              {aqua.language === 'ml' ? 'Malayalam' : 'Hindi'} is unavailable on this device.
            </div>
          )}
          {!aqua.micSupported && (
            <div className="mt-0.5 text-slate-400">
              Web Speech microphone input is unsupported in this browser—use text input below.
            </div>
          )}
        </div>
      )}

      {/* Conversation History */}
      <div className="aqua-scroll flex-1 space-y-3 overflow-y-auto p-3.5 text-xs">
        {aqua.messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[92%] rounded-lg border px-3 py-2 leading-relaxed ${
                  isUser
                    ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-50'
                    : isSystem
                      ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
                      : 'border-white/10 bg-[#040a14] text-slate-200'
                }`}
              >
                <div className="mb-1 flex items-center gap-1.5 text-[10px] text-slate-400">
                  <span className="font-semibold text-slate-300">
                    {isUser ? 'Visitor' : isSystem ? 'Notice' : 'AQUA'}
                  </span>
                  {msg.inputMethod === 'voice' && <span>· Voice</span>}
                  {msg.mode && !isUser && !isSystem && (
                    <span>· {msg.mode === 'live' ? 'Gemini' : 'Demo'}</span>
                  )}
                </div>

                <p className="whitespace-pre-wrap">{msg.text}</p>

                {msg.executedActions && msg.executedActions.length > 0 && (
                  <div className="mt-2 space-y-1 border-t border-white/10 pt-1.5">
                    {msg.executedActions.map((act, idx) => (
                      <div
                        key={`${act.actionName}-${idx}`}
                        className="flex items-center gap-1.5 text-[11px]"
                      >
                        <CheckCircle2
                          className={`h-3 w-3 shrink-0 ${
                            act.ok ? 'text-emerald-300' : 'text-amber-300'
                          }`}
                        />
                        <span className="font-mono-tabular text-cyan-200">{act.actionName}</span>
                        {act.updatedValue && (
                          <span className="font-mono-tabular text-slate-400">
                            ({act.updatedValue})
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {aqua.status === 'thinking' && (
          <div className="text-[11px] font-mono-tabular text-amber-300">
            AQUA is analyzing context and validating actions…
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Confirmation Gate Bar */}
      {aqua.pendingConfirmation && (
        <div className="border-t border-amber-400/35 bg-amber-500/10 px-3 py-2.5 text-xs">
          <div className="flex items-start gap-2 text-amber-100">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div className="flex-1">
              <p className="leading-snug">{aqua.pendingConfirmation.prompt}</p>
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => confirmPending(true)}
                  className="rounded-md border border-amber-400/50 bg-amber-500/25 px-3 py-1 text-[11px] font-semibold text-white hover:bg-amber-500/35"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => confirmPending(false)}
                  className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-slate-300 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Starter Commands */}
      <div className="aqua-scroll flex items-center gap-1.5 overflow-x-auto border-t border-white/10 bg-[#040a14] px-3 py-2">
        {QUICK_COMMANDS.map((cmd) => (
          <button
            key={cmd.label}
            type="button"
            onClick={() => void submitQuery(cmd.prompt, 'text')}
            className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-medium text-slate-300 hover:border-cyan-400/40 hover:text-white whitespace-nowrap shrink-0"
          >
            {cmd.label}
          </button>
        ))}
      </div>

      {/* Live Voice Transcript Preview, Confidence Meter & Input Bar */}
      <form
        onSubmit={handleSend}
        className="border-t border-white/10 bg-[#050d1a] p-3 space-y-2"
      >
        {showConfidenceMeter && (
          <div
            aria-label="Speech Recognition Confidence Meter"
            className={`rounded-lg border ${confidenceInfo.borderClass} bg-[#040a14] px-2.5 py-2 space-y-1.5`}
          >
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <span className="truncate text-slate-100">
                {activeTranscript
                  ? `Transcript: "${activeTranscript}"`
                  : 'Listening… Speak your question or command'}
              </span>
              {aqua.status === 'listening' ? (
                <button
                  type="button"
                  onClick={stopListening}
                  className="font-semibold text-emerald-300 underline shrink-0"
                >
                  Stop
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: 'UPDATE_AQUA_STATE',
                      patch: { lastVoiceTranscript: '', transcriptConfidence: null },
                    })
                  }
                  aria-label="Dismiss transcript confidence meter"
                  className="text-slate-400 hover:text-white shrink-0"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 text-[10px]">
              <span className="font-medium text-slate-400">Confidence Meter</span>
              <span className={`font-mono-tabular font-semibold ${confidenceInfo.toneTextClass}`}>
                {confidenceInfo.pct !== null ? `${confidenceInfo.pct}%` : '--%'} ·{' '}
                {confidenceInfo.tierLabel}
              </span>
            </div>

            <div
              role="meter"
              aria-label="Speech-to-text certainty score"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={confidenceInfo.pct ?? 0}
              aria-valuetext={
                confidenceInfo.pct !== null
                  ? `${confidenceInfo.pct}% (${confidenceInfo.tierLabel})`
                  : confidenceInfo.tierLabel
              }
              className="grid grid-cols-20 gap-0.5"
            >
              {METER_SEGMENTS.map((idx) => {
                const filled = idx < activeSegmentCount;
                return (
                  <div
                    key={idx}
                    className={`h-1.5 rounded-[1px] transition-colors ${
                      filled ? confidenceInfo.barColorClass : 'bg-white/10'
                    }`}
                  />
                );
              })}
            </div>

            <div className="flex items-center justify-between font-mono-tabular text-[9px] text-slate-500">
              <span>0%</span>
              <span>50%</span>
              <span>100%</span>
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              aqua.status === 'listening'
                ? stopListening()
                : startListening((txt) => setInputText(txt))
            }
            aria-label={aqua.status === 'listening' ? 'Stop microphone' : 'Activate microphone'}
            title={
              aqua.micSupported
                ? aqua.status === 'listening'
                  ? 'Stop listening'
                  : 'Ask AQUA with voice'
                : 'Browser voice recognition unsupported'
            }
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              aqua.status === 'listening'
                ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-100'
                : aqua.micSupported
                  ? 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20'
                  : 'border-white/10 bg-white/5 text-slate-500'
            }`}
          >
            {aqua.status === 'listening' ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </button>

          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Ask AQUA or command a scene…"
            aria-label="Ask AQUA a question or command"
            className="h-9 flex-1 rounded-lg border border-white/15 bg-[#040a14] px-3 text-xs text-white placeholder-slate-500 focus:border-cyan-400/60 focus:outline-none"
          />

          <button
            type="submit"
            disabled={!inputText.trim() || aqua.status === 'thinking'}
            aria-label="Send message to AQUA"
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-cyan-400/45 bg-cyan-500/20 px-3 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-45"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Send</span>
          </button>
        </div>

        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>
            Voice runs in-browser; audio is never uploaded unless using server Gemini text query.
          </span>
          <label className="flex items-center gap-1 cursor-pointer text-slate-400 shrink-0 ml-2">
            <input
              type="checkbox"
              checked={aqua.autoSendVoice}
              onChange={(e) =>
                dispatch({
                  type: 'UPDATE_AQUA_STATE',
                  patch: { autoSendVoice: e.target.checked },
                })
              }
              className="accent-cyan-400"
            />
            <span>Auto-send</span>
          </label>
        </div>
      </form>
    </aside>
  );
};
