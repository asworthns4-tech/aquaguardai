import React, { useCallback, useEffect, useState } from 'react';
import { AquaAssistantPanel } from './components/AquaAssistantPanel';
import { AquaControlCentreView } from './components/AquaControlCentreView';
import { CommandFeedbackBanner } from './components/CommandFeedbackBanner';
import { EarthControlDock } from './components/EarthControlDock';
import { EarthInfoPanel } from './components/EarthInfoPanel';
import { GestureControlPanel } from './components/GestureControlPanel';
import { GestureEngineHost, GestureLiveFeed } from './components/GestureEngineHost';
import { GestureHudOverlay } from './components/GestureHudOverlay';
import { GestureTutorialModal } from './components/GestureTutorialModal';
import { GlobalWatermark } from './components/GlobalWatermark';
import { InteractionDebugPanel } from './components/InteractionDebugPanel';
import { MissionNavSidebar } from './components/MissionNavSidebar';
import { SaveTheCityMissionView } from './components/SaveTheCityMissionView';
import { ScienceLabView } from './components/ScienceLabView';
import { SmartCityDock } from './components/SmartCityDock';
import { SmartCityPanel } from './components/SmartCityPanel';
import { TopNavBar } from './components/TopNavBar';
import { UndergroundDock } from './components/UndergroundDock';
import { UndergroundPanel } from './components/UndergroundPanel';
import { UpcomingModuleView } from './components/UpcomingModuleView';
import { WaterSimulationsView } from './components/WaterSimulationsView';
import { useAquaStatusSync } from './hooks/useAquaController';
import { EarthScene } from './scenes/EarthScene';
import { SmartCityScene } from './scenes/SmartCityScene';
import { UndergroundScene } from './scenes/UndergroundScene';
import { AppProvider, useAppState } from './state/appStore';

const ExhibitionWorkspace: React.FC = () => {
  const { state, dispatchAction } = useAppState();
  useAquaStatusSync();
  const [liveFeed, setLiveFeed] = useState<GestureLiveFeed | null>(null);
  const handleLiveFeedReady = useCallback((feed: GestureLiveFeed) => {
    setLiveFeed(feed);
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      window.dispatchEvent(new Event('resize'));
    }, 30);
    return () => window.clearTimeout(id);
  }, [state.leftNavOpen]);

  // Keyboard shortcuts wired through the exact same Central Action Registry
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT')
      ) {
        return;
      }

      if ((e.key === 'D' || e.key === 'd') && e.shiftKey && !state.exhibitionMode) {
        e.preventDefault();
        dispatchAction('toggle_debug_panel', {}, 'keyboard');
        return;
      }

      if ((e.key === 'g' || e.key === 'G') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        dispatchAction('toggle_gesture_panel', {}, 'keyboard');
        return;
      }

      if ((e.key === 'a' || e.key === 'A') && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        dispatchAction('toggle_aqua_panel', {}, 'keyboard');
        return;
      }

      if (
        state.currentScene === 'earth' ||
        state.currentScene === 'city' ||
        state.currentScene === 'underground' ||
        state.currentScene === 'lab'
      ) {
        if (e.code === 'Space') {
          e.preventDefault();
          dispatchAction('rotate_scene', {}, 'keyboard');
        } else if (e.key === 'p' || e.key === 'P') {
          dispatchAction(
            state.simulationParams.running ? 'pause_simulation' : 'resume_simulation',
            {},
            'keyboard'
          );
        } else if (e.key === 'r' || e.key === 'R') {
          dispatchAction('reset_camera', {}, 'keyboard');
        } else if (e.key === 'h' || e.key === 'H') {
          dispatchAction('toggle_controls_collapsed', {}, 'keyboard');
        } else if (e.key === '+' || e.key === '=') {
          dispatchAction('zoom_scene', { delta: -0.4 }, 'keyboard');
        } else if (e.key === '-' || e.key === '_') {
          dispatchAction('zoom_scene', { delta: 0.4 }, 'keyboard');
        } else if (e.key === 'Escape') {
          dispatchAction('clear_selection', {}, 'keyboard');
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [dispatchAction, state.currentScene, state.exhibitionMode, state.simulationParams.running]);

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#02050b] text-slate-100">
      <TopNavBar />

      <div className="relative flex flex-1 overflow-hidden">
        <MissionNavSidebar />

        <main className="relative flex-1 overflow-hidden">
          <GestureEngineHost onLiveFeedReady={handleLiveFeedReady} />
          <CommandFeedbackBanner />
          <GestureHudOverlay />
          <GestureControlPanel liveFeed={liveFeed} />
          <AquaAssistantPanel />
          <GestureTutorialModal />
          <InteractionDebugPanel />

          {state.currentScene === 'earth' && (
            <>
              <EarthScene />

              <div className="pointer-events-none absolute top-3 left-3 z-10 hidden sm:block max-w-xs">
                <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-300/90">
                  {state.earthExplorerFocus === 'intelligence'
                    ? 'Planetary Telemetry · Water Intelligence'
                    : state.earthExplorerFocus === 'geography'
                      ? 'Planetary Telemetry · Geography Explorer'
                      : state.earthExplorerFocus === 'islands'
                        ? 'Planetary Telemetry · Island Explorer'
                        : state.earthExplorerFocus === 'coverage'
                          ? 'Planetary Telemetry · Global Coverage'
                          : 'Planetary Telemetry · Orbital Earth View'}
                </div>
                <div className="font-display text-base font-semibold tracking-tight text-white">
                  {state.earthLayers.showOverlay
                    ? 'Global Water Distribution Layers'
                    : state.selectedGeography
                      ? `${state.selectedGeography.flag ? `${state.selectedGeography.flag} ` : ''}${state.selectedGeography.name}`
                      : 'Earth Observation View'}
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Drag to orbit · Scroll to zoom · Click countries, borders, islands, or beacons
                </p>
              </div>

              <EarthInfoPanel />
              <EarthControlDock />
            </>
          )}

        {state.currentScene === 'city' && (
          <>
            <SmartCityScene />

            <div className="pointer-events-none absolute top-4 left-4 z-10 hidden sm:block max-w-xs">
              <div className="text-[11px] font-medium text-cyan-300/85">
                AquaGuard AI · The Living Planet · Module 02
              </div>
              <div className="font-display text-lg font-semibold tracking-tight text-white">
                Future Smart City
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Drag to orbit · Right-drag to pan · Click any building or pipeline
              </p>
            </div>

            <SmartCityPanel />
            <SmartCityDock />
          </>
        )}

        {state.currentScene === 'underground' && (
          <>
            <UndergroundScene />

            <div className="pointer-events-none absolute top-4 left-4 z-10 hidden sm:block max-w-xs">
              <div className="text-[11px] font-medium text-cyan-300/85">
                AquaGuard AI · The Living Planet · Module 03
              </div>
              <div className="font-display text-lg font-semibold tracking-tight text-white">
                Underground Water World
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Drag to orbit · Click any soil stratum, aquifer, well, or pipeline
              </p>
            </div>

            <UndergroundPanel />
            <UndergroundDock />
          </>
        )}

        {state.currentScene === 'lab' && <ScienceLabView />}

        {state.currentScene === 'simulations' && <WaterSimulationsView />}

        {state.currentScene === 'mission' && <SaveTheCityMissionView />}

        {state.currentScene === 'aqua' && <AquaControlCentreView />}

        {state.currentScene !== 'earth' &&
          state.currentScene !== 'city' &&
          state.currentScene !== 'underground' &&
          state.currentScene !== 'lab' &&
          state.currentScene !== 'simulations' &&
          state.currentScene !== 'mission' &&
          state.currentScene !== 'aqua' && <UpcomingModuleView />}
        </main>
      </div>

      <GlobalWatermark />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <ExhibitionWorkspace />
    </AppProvider>
  );
}
