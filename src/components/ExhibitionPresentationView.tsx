import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  FlaskConical,
  Gauge,
  Globe,
  Layers,
  Maximize,
  Minimize,
  Pause,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { PRESENTATION_CHAPTERS } from '../services/presentationEngine';
import { useAppState } from '../state/appStore';

/**
 * Shared Presentation Audio + Auto-Advance Hook used both inside the main
 * Presentation Overview slide and the persistent FloatingPresenterBar overlay
 * when chapters display live 3D modules (Earth, Smart City, Underground, Lab, AQUA, Mission).
 */
function usePresentationPlayback(
  enabled: boolean,
  activeChapterIndex: number,
  isPlaying: boolean,
  narrationActive: boolean,
  narrationScript: string,
  dispatchAction: ReturnType<typeof useAppState>['dispatchAction']
) {
  useEffect(() => {
    if (!enabled || !isPlaying) return;
    const timer = window.setInterval(() => {
      if (activeChapterIndex < PRESENTATION_CHAPTERS.length - 1) {
        dispatchAction('next_chapter', {}, 'mouse');
      } else {
        dispatchAction('toggle_presentation_play', { playing: false }, 'mouse');
      }
    }, 12000);
    return () => window.clearInterval(timer);
  }, [enabled, isPlaying, activeChapterIndex, dispatchAction]);

  useEffect(() => {
    if (!enabled || !narrationActive || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(narrationScript);
    utterance.rate = 0.96;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [enabled, narrationActive, activeChapterIndex, narrationScript]);
}

export const FloatingPresenterBar: React.FC = () => {
  const { state, dispatchAction } = useAppState();
  const { active, activeChapterIndex, isPlaying, narrationActive, showTextNarration, welcomeModalOpen } =
    state.presentation;
  const chapter = PRESENTATION_CHAPTERS[activeChapterIndex] ?? PRESENTATION_CHAPTERS[0];

  const barVisible = active && !welcomeModalOpen && state.currentScene !== 'exhibition';
  usePresentationPlayback(
    barVisible,
    activeChapterIndex,
    isPlaying,
    narrationActive,
    chapter.narrationScript,
    dispatchAction
  );

  if (!barVisible) return null;

  const hasBottomDock =
    state.currentScene === 'earth' ||
    state.currentScene === 'city' ||
    state.currentScene === 'underground';
  const bottomClass = hasBottomDock
    ? state.controlsCollapsed
      ? 'bottom-14'
      : 'bottom-28 sm:bottom-24'
    : 'bottom-10';

  return (
    <div
      role="region"
      aria-label="Exhibition Presenter Controls"
      className={`absolute ${bottomClass} left-1/2 z-30 w-[calc(100%-1.5rem)] max-w-2xl -translate-x-1/2 rounded-2xl border border-cyan-400/40 bg-[#050d1b]/95 px-4 py-2.5 shadow-2xl transition-[bottom] duration-200`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-mono-tabular uppercase tracking-wider text-cyan-300">
            Presentation · Chapter {chapter.number + 1}/{PRESENTATION_CHAPTERS.length}
          </div>
          <div className="truncate font-display text-sm font-semibold text-white">
            {chapter.title}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => dispatchAction('prev_chapter', {}, 'mouse')}
            disabled={activeChapterIndex === 0}
            className="flex items-center gap-0.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('toggle_presentation_play', {}, 'mouse')}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              isPlaying
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : 'border-cyan-400/40 bg-cyan-500/20 text-cyan-200'
            }`}
          >
            {isPlaying ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
            <span className="hidden sm:inline">{isPlaying ? 'Pause' : 'Play'}</span>
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('next_chapter', {}, 'mouse')}
            disabled={activeChapterIndex === PRESENTATION_CHAPTERS.length - 1}
            className="flex items-center gap-0.5 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('toggle_narration', {}, 'mouse')}
            title="Toggle Spoken Narration"
            aria-label="Toggle Spoken Narration"
            className={`rounded-lg border p-1.5 text-xs ${
              narrationActive
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : 'border-white/15 bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {narrationActive ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('navigate_to_exhibition', {}, 'mouse')}
            title="Open Presentation Overview Slide"
            className="flex items-center gap-1 rounded-lg border border-cyan-400/35 bg-cyan-500/15 px-2 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/25"
          >
            <Layers className="h-3 w-3" />
            <span className="hidden sm:inline">Slide</span>
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('exit_presentation', {}, 'mouse')}
            className="flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/15 px-2 py-1 text-xs font-medium text-rose-200 hover:bg-rose-500/25"
          >
            <X className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Exit</span>
          </button>
        </div>
      </div>

      {showTextNarration && (
        <p className="mt-1.5 line-clamp-2 border-t border-white/10 pt-1.5 text-[11px] italic text-slate-300">
          “{chapter.narrationScript}”
        </p>
      )}
    </div>
  );
};

export const ExhibitionPresentationView: React.FC = () => {
  const { state, dispatchAction } = useAppState();
  const { activeChapterIndex, isPlaying, narrationActive, showTextNarration, welcomeModalOpen } =
    state.presentation;

  const chapter = PRESENTATION_CHAPTERS[activeChapterIndex] ?? PRESENTATION_CHAPTERS[0];
  const [isFullscreen, setIsFullscreen] = useState(false);

  const mainPresentationActive = !welcomeModalOpen && state.currentScene === 'exhibition';
  usePresentationPlayback(
    mainPresentationActive,
    activeChapterIndex,
    isPlaying,
    narrationActive,
    chapter.narrationScript,
    dispatchAction
  );

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
      setIsFullscreen(false);
    }
  };

  if (welcomeModalOpen) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#040a14]/96 p-4">
        <div className="aqua-scroll max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-cyan-400/40 bg-[#061121] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/40 bg-cyan-500/15 text-cyan-300">
            <Globe className="h-7 w-7" />
          </div>

          <div className="mt-4 text-xs font-semibold uppercase tracking-widest text-cyan-300">
            AQUAGUARD AI · Interactive 3D Water Science Exhibition
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            AquaGuard AI — The Living Planet
          </h1>
          <p className="mt-2 text-sm text-slate-300">
            Explore. Experiment. Protect Our Water Resources.
          </p>

          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => dispatchAction('start_presentation', {}, 'mouse')}
              className="flex items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-3.5 px-4 text-sm font-semibold text-slate-950 hover:bg-cyan-400 transition-colors shadow-lg focus-visible:outline-2 focus-visible:outline-white"
            >
              <Sparkles className="h-4 w-4" />
              <span>Start Presentation Mode</span>
            </button>
            <button
              type="button"
              onClick={() => dispatchAction('start_mission', {}, 'mouse')}
              className="flex items-center justify-center gap-2 rounded-2xl border border-cyan-400/35 bg-cyan-500/15 py-3.5 px-4 text-sm font-semibold text-cyan-200 hover:bg-cyan-500/25 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <Compass className="h-4 w-4" />
              <span>Save the City Mission</span>
            </button>
            <button
              type="button"
              onClick={() => dispatchAction('toggle_welcome_screen', { open: false }, 'mouse')}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-3.5 px-4 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <Globe className="h-4 w-4" />
              <span>Explore Freely</span>
            </button>
            <button
              type="button"
              onClick={() => {
                dispatchAction('toggle_welcome_screen', { open: false }, 'mouse');
                dispatchAction('toggle_aqua_panel', { open: true }, 'mouse');
              }}
              className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 py-3.5 px-4 text-sm font-medium text-slate-200 hover:bg-white/10 transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400"
            >
              <BookOpen className="h-4 w-4" />
              <span>Meet AQUA AI</span>
            </button>
          </div>

          <div className="mt-8 border-t border-white/10 pt-4 text-xs text-slate-400">
            THE LIVING PLANET · Fully offline-capable educational water simulation
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-[#040a14] text-slate-100">
      {/* Presentation Header Bar */}
      <header className="flex h-16 w-full items-center justify-between border-b border-cyan-500/20 bg-[#050d1b] px-4 sm:px-6 shrink-0 z-20">
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/15 text-cyan-300 shrink-0">
            <Globe className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-widest text-cyan-300 font-mono-tabular">
              AquaGuard AI · Chapter {chapter.number + 1} of {PRESENTATION_CHAPTERS.length}
            </div>
            <div className="truncate font-display text-base font-semibold text-white">
              {chapter.title}
            </div>
          </div>
        </div>

        {/* Presenter Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => dispatchAction('prev_chapter', {}, 'mouse')}
            disabled={activeChapterIndex === 0}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Prev</span>
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('toggle_presentation_play', {}, 'mouse')}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
              isPlaying
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : 'border-cyan-400/40 bg-cyan-500/20 text-cyan-200'
            }`}
          >
            {isPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{isPlaying ? 'Pause Auto' : 'Auto Play'}</span>
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('next_chapter', {}, 'mouse')}
            disabled={activeChapterIndex === PRESENTATION_CHAPTERS.length - 1}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40 transition-colors"
          >
            <span className="hidden sm:inline">Next</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('toggle_narration', {}, 'mouse')}
            title="Toggle Spoken Narration"
            aria-label="Toggle Spoken Narration"
            className={`rounded-lg border p-2 text-xs transition-colors ${
              narrationActive
                ? 'border-emerald-400/40 bg-emerald-500/20 text-emerald-200'
                : 'border-white/15 bg-white/5 text-slate-400 hover:text-white'
            }`}
          >
            {narrationActive ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={toggleFullscreen}
            title="Toggle Fullscreen"
            aria-label="Toggle Fullscreen"
            className="rounded-lg border border-white/15 bg-white/5 p-2 text-xs text-slate-300 hover:text-white transition-colors"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={() => dispatchAction('exit_presentation', {}, 'mouse')}
            className="flex items-center gap-1.5 rounded-lg border border-rose-400/35 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/25 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
            <span>Exit</span>
          </button>
        </div>
      </header>

      {/* Main Presentation Body */}
      <main className="aqua-scroll relative flex-1 overflow-y-auto p-6 pb-16 lg:p-10">
        <div className="mx-auto max-w-4xl space-y-6">
          {/* Chapter Quick Index Strip */}
          <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
            {PRESENTATION_CHAPTERS.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                onClick={() => dispatchAction('jump_chapter', { index: idx }, 'mouse')}
                className={`rounded-lg border px-2 py-1.5 text-center text-[11px] font-medium transition-colors ${
                  idx === activeChapterIndex
                    ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                    : 'border-white/10 bg-[#061121] text-slate-400 hover:text-white'
                }`}
              >
                Ch {ch.number + 1}
              </button>
            ))}
          </div>

          {/* Chapter Hero Card */}
          <div className="rounded-3xl border border-cyan-500/30 bg-[#061121] p-8 shadow-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
              <span>Chapter {chapter.number + 1}</span>
              <span aria-hidden="true">·</span>
              <span>{chapter.subtitle}</span>
            </div>

            <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
              {chapter.title}
            </h2>

            <p className="text-base leading-relaxed text-slate-200">{chapter.summary}</p>

            <div className="border-t border-white/10 pt-5">
              <div className="text-xs font-semibold text-cyan-300">Key Exhibition Highlights</div>
              <ul className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                {chapter.keyPoints.map((pt) => (
                  <li
                    key={pt}
                    className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#040a14] p-3 text-xs text-slate-200"
                  >
                    <ArrowRight className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Narration Script Box */}
          <div className="rounded-2xl border border-cyan-500/20 bg-[#061121]/90 p-6 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-cyan-200">Presenter Narration Script</div>
              <button
                type="button"
                onClick={() =>
                  dispatchAction(
                    'update_presentation_state',
                    { showTextNarration: !showTextNarration },
                    'mouse'
                  )
                }
                className="text-xs text-cyan-300 hover:underline"
              >
                {showTextNarration ? 'Hide Script' : 'Show Script'}
              </button>
            </div>
            {showTextNarration && (
              <p className="text-sm leading-relaxed text-slate-300 font-sans italic border-l-2 border-cyan-400 pl-4 py-1">
                "{chapter.narrationScript}"
              </p>
            )}
            <div className="text-[11px] text-slate-400">
              <span className="font-semibold text-slate-300">Science Note:</span> {chapter.scienceNote}
            </div>
          </div>

          {/* Live Demonstration Scene Jump */}
          <div className="rounded-2xl border border-cyan-500/20 bg-[#061121] p-6 space-y-3">
            <div className="text-xs font-semibold text-cyan-300">
              Live Demonstration Scene Jump (Keeps Presentation Controls Active)
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => dispatchAction('jump_chapter', { index: 1 }, 'mouse')}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
              >
                <Globe className="h-4 w-4 text-cyan-300 shrink-0" />
                <span className="text-xs font-medium text-white">Earth Explorer</span>
              </button>
              <button
                type="button"
                onClick={() => dispatchAction('jump_chapter', { index: 2 }, 'mouse')}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
              >
                <Gauge className="h-4 w-4 text-cyan-300 shrink-0" />
                <span className="text-xs font-medium text-white">Smart City</span>
              </button>
              <button
                type="button"
                onClick={() => dispatchAction('jump_chapter', { index: 3 }, 'mouse')}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
              >
                <Compass className="h-4 w-4 text-cyan-300 shrink-0" />
                <span className="text-xs font-medium text-white">Underground</span>
              </button>
              <button
                type="button"
                onClick={() => dispatchAction('jump_chapter', { index: 4 }, 'mouse')}
                className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 p-3 text-left hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors"
              >
                <FlaskConical className="h-4 w-4 text-cyan-300 shrink-0" />
                <span className="text-xs font-medium text-white">Science Lab</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
