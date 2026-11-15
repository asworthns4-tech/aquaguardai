import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  Mic,
  MicOff,
  Send,
  ShieldAlert,
  Square,
  Trash2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAquaController } from '../hooks/useAquaController';
import { computeIntegratedWaterBalance } from '../services/simulationEngine';
import { useAppState } from '../state/appStore';
import { AquaLanguage } from '../types/exhibition';
import { AquaVoiceOrb } from './AquaVoiceOrb';

const EXAMPLE_TOPICS: Array<{ category: string; items: string[] }> = [
  {
    category: 'Scientific Questions',
    items: [
      'What is groundwater and how does an aquifer work?',
      'Why are cities running out of water?',
      'How does rainwater harvesting work?',
      'Explain desalination and its energy limits.',
      'What happens when a pipeline leaks?',
    ],
  },
  {
    category: 'Live Website & Simulation Control',
    items: [
      'Zoom into Kerala on Earth Explorer',
      'Take me to the smart city and select the reservoir',
      'Show me what happens when groundwater is depleted',
      'Increase rainfall to 95 mm',
      'Create a pipeline leak',
    ],
  },
];

export const AquaControlCentreView: React.FC = () => {
  const { state, dispatch, dispatchAction } = useAppState();
  const aqua = state.aqua;
  const metrics = computeIntegratedWaterBalance(state);
  const {
    submitQuery,
    startListening,
    stopListening,
    stopSpeaking,
    confirmPending,
    setLanguage,
  } = useAquaController();

  const [inputText, setInputText] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aqua.messages.length]);

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    const val = inputText.trim();
    if (!val) return;
    setInputText('');
    void submitQuery(val, 'text');
  };

  return (
    <div className="aqua-scroll flex h-full w-full flex-col overflow-y-auto bg-[#040a14] p-4 pb-12 lg:p-6 lg:pb-12">
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-5 lg:grid-cols-[360px_1fr]">
        {/* Left Control & Telemetry Column */}
        <section className="flex flex-col gap-4 rounded-xl border border-cyan-500/25 bg-[#061121] p-5">
          <div className="flex items-center gap-4">
            <AquaVoiceOrb status={aqua.status} size="lg" />
            <div>
              <div className="text-xs font-medium text-cyan-300">
                Module 07 · Water Research AI
              </div>
              <h1 className="font-display text-2xl font-semibold tracking-tight text-white">
                AQUA Control Centre
              </h1>
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span className={aqua.aiMode === 'live' ? 'text-emerald-300' : 'text-amber-300'}>
                  {aqua.aiMode === 'live' ? 'Live Gemini AI' : 'Offline Demo Mode'}
                </span>
                <span className="text-slate-500">·</span>
                <span className="font-mono-tabular text-slate-300 capitalize">{aqua.status}</span>
              </div>
            </div>
          </div>

          {aqua.aiReason && (
            <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
              {aqua.aiReason}
            </p>
          )}

          {/* Synchronized Exhibition State Snapshot */}
          <div className="rounded-lg border border-white/10 bg-[#040a14] p-3.5 text-xs space-y-2.5">
            <div className="font-semibold text-slate-200">
              Live Shared State (Synced with 3D &amp; Gestures)
            </div>
            <div className="grid grid-cols-2 gap-2.5 font-mono-tabular">
              <div>
                <div className="text-[11px] text-slate-400">Previous 3D Scene</div>
                <div className="text-cyan-200">{state.previousScene ?? 'earth'}</div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Selected Object</div>
                <div className="truncate text-white">
                  {state.selectedObject?.name ?? 'None'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Rainfall / Supply</div>
                <div className="text-white">
                  {state.city.rainfallIntensity} mm · {metrics.city.totalAvailableSupplyMLd.toFixed(1)} ML/d
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Water Table</div>
                <div className="text-white">
                  {state.underground.waterTableDepthM.toFixed(1)} m ({metrics.underground.aquiferStoragePct}%)
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Hand Gestures</div>
                <div className={state.gesture.cameraActive ? 'text-emerald-300' : 'text-slate-400'}>
                  {state.gesture.cameraActive ? 'Camera Active' : 'Off'}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-400">Pipe Leak</div>
                <div className={state.city.leak.active ? 'text-amber-300' : 'text-emerald-300'}>
                  {state.city.leak.active ? `${state.city.leak.severityLph.toLocaleString()} L/hr` : 'Sealed'}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-white/10 pt-2.5">
              <button
                type="button"
                onClick={() => dispatchAction('navigate_to_earth', {}, 'mouse')}
                className="flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                <span>Earth</span>
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => dispatchAction('navigate_to_city', {}, 'mouse')}
                className="flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                <span>Smart City</span>
                <ArrowRight className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => dispatchAction('navigate_to_underground', {}, 'mouse')}
                className="flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20"
              >
                <span>Underground</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Starter Prompts */}
          <div className="space-y-3 text-xs">
            {EXAMPLE_TOPICS.map((group) => (
              <div key={group.category} className="space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400">{group.category}</div>
                <div className="flex flex-col gap-1.5">
                  {group.items.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => void submitQuery(prompt, 'text')}
                      className="rounded-lg border border-white/10 bg-[#040a14] px-3 py-2 text-left text-xs text-slate-200 hover:border-cyan-400/40 hover:text-white transition-colors"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right Conversation Console */}
        <section className="flex min-h-[520px] flex-col overflow-hidden rounded-xl border border-cyan-500/25 bg-[#061121]">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#050d1a] px-4 py-3">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#040a14] p-1">
              {(['en', 'ml', 'hi'] as AquaLanguage[]).map((code) => {
                const label = code === 'en' ? 'English' : code === 'ml' ? 'മലയാളം' : 'हिन्दी';
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setLanguage(code)}
                    className={`rounded-md px-3 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                      aqua.language === code
                        ? 'bg-cyan-500/20 text-cyan-100 border border-cyan-400/35'
                        : 'text-slate-400 hover:text-white border border-transparent'
                    }`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  dispatchAction('set_aqua_tts', { enabled: !aqua.ttsEnabled }, 'mouse')
                }
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                  aqua.ttsEnabled && aqua.ttsSupported
                    ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100'
                    : 'border-white/10 bg-white/5 text-slate-400'
                }`}
              >
                {aqua.ttsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                <span>{aqua.ttsEnabled ? 'Speech On' : 'Speech Off'}</span>
              </button>

              {aqua.status === 'speaking' && (
                <button
                  type="button"
                  onClick={stopSpeaking}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-400/45 bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-100"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Stop Speaking</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => void submitQuery('clear chat', 'text')}
                className="flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="aqua-scroll flex-1 space-y-3.5 overflow-y-auto p-5 text-sm">
            {aqua.messages.map((msg) => {
              const isUser = msg.role === 'user';
              const isSystem = msg.role === 'system';
              return (
                <div key={msg.id} className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                  <div
                    className={`max-w-[82%] rounded-xl border px-4 py-3 leading-relaxed ${
                      isUser
                        ? 'border-cyan-400/35 bg-cyan-500/15 text-cyan-50'
                        : isSystem
                          ? 'border-amber-400/35 bg-amber-500/10 text-amber-100'
                          : 'border-white/10 bg-[#040a14] text-slate-200'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-semibold text-slate-300">
                        {isUser ? 'Visitor' : isSystem ? 'System Notice' : 'AQUA'}
                      </span>
                      {msg.inputMethod === 'voice' && <span>· Voice Input</span>}
                      {msg.mode && !isUser && !isSystem && (
                        <span>· {msg.mode === 'live' ? 'Live Gemini AI' : 'Offline Demo Mode'}</span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap text-[13px]">{msg.text}</p>
                    {msg.executedActions && msg.executedActions.length > 0 && (
                      <div className="mt-2.5 space-y-1 border-t border-white/10 pt-2">
                        {msg.executedActions.map((act, idx) => (
                          <div key={`${act.actionName}-${idx}`} className="flex items-center gap-2 text-xs">
                            <CheckCircle2
                              className={`h-3.5 w-3.5 ${act.ok ? 'text-emerald-300' : 'text-amber-300'}`}
                            />
                            <span className="font-mono-tabular text-cyan-200">{act.actionName}</span>
                            <span className="text-slate-400">— {act.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={endRef} />
          </div>

          {/* Pending Confirmation */}
          {aqua.pendingConfirmation && (
            <div className="border-t border-amber-400/35 bg-amber-500/10 px-4 py-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 text-amber-100">
                  <ShieldAlert className="h-4 w-4 text-amber-300 shrink-0" />
                  <span>{aqua.pendingConfirmation.prompt}</span>
                </span>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => confirmPending(true)}
                    className="rounded-md border border-amber-400/50 bg-amber-500/25 px-3 py-1 font-semibold text-white"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmPending(false)}
                    className="rounded-md border border-white/15 bg-white/5 px-3 py-1 text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSend} className="border-t border-white/10 bg-[#050d1a] p-4 space-y-2">
            {(aqua.status === 'listening' || aqua.transcriptInterim) && (
              <div className="flex items-center justify-between rounded-lg border border-emerald-400/35 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
                <span>
                  {aqua.transcriptInterim
                    ? `Recognized speech: "${aqua.transcriptInterim}"`
                    : 'Listening via browser Web Speech API…'}
                </span>
                {aqua.status === 'listening' && (
                  <button type="button" onClick={stopListening} className="font-semibold underline">
                    Stop Listening
                  </button>
                )}
              </div>
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() =>
                  aqua.status === 'listening'
                    ? stopListening()
                    : startListening((txt) => setInputText(txt))
                }
                className={`flex h-10 items-center gap-2 rounded-lg border px-3.5 text-xs font-semibold transition-colors whitespace-nowrap ${
                  aqua.status === 'listening'
                    ? 'border-emerald-400/60 bg-emerald-500/25 text-emerald-100'
                    : 'border-cyan-400/35 bg-cyan-500/15 text-cyan-100 hover:bg-cyan-500/25'
                }`}
              >
                {aqua.status === 'listening' ? (
                  <>
                    <MicOff className="h-4 w-4" />
                    <span>Stop Mic</span>
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4" />
                    <span>Speak</span>
                  </>
                )}
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask a water-science question or issue a command…"
                className="h-10 flex-1 rounded-lg border border-white/15 bg-[#040a14] px-3.5 text-sm text-white placeholder-slate-500 focus:border-cyan-400/60 focus:outline-none"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || aqua.status === 'thinking'}
                className="flex h-10 items-center gap-2 rounded-lg border border-cyan-400/45 bg-cyan-500/20 px-4 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 disabled:opacity-45 whitespace-nowrap"
              >
                <Send className="h-4 w-4" />
                <span>Send</span>
              </button>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span>
                All dynamic simulation readings are illustrative educational models, not live field sensors.
              </span>
              <label className="flex items-center gap-1.5 cursor-pointer shrink-0 ml-3">
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
                <span>Auto-send voice</span>
              </label>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
};
