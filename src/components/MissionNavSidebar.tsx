import React from 'react';
import {
  Activity,
  Anchor,
  AudioLines,
  BarChart3,
  Building2,
  Compass,
  Droplets,
  FlaskConical,
  Globe,
  Layers,
  PanelLeftClose,
  ShieldAlert,
  X,
} from 'lucide-react';
import { useAppState } from '../state/appStore';
import { RegisteredActionName } from '../types/exhibition';

interface SidebarNavItem {
  id: string;
  code: string;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  group: 'observation' | 'worlds' | 'operations';
  action: RegisteredActionName;
  params?: Record<string, unknown>;
  isActive: (state: ReturnType<typeof useAppState>['state']) => boolean;
}

const NAV_ITEMS: SidebarNavItem[] = [
  {
    id: 'earth-explorer',
    code: '01',
    label: 'Earth Explorer',
    subtitle: 'Natural Blue Marble',
    icon: Globe,
    group: 'observation',
    action: 'focus_earth_section',
    params: { focus: 'overview' },
    isActive: (s) => s.currentScene === 'earth' && s.earthExplorerFocus === 'overview',
  },
  {
    id: 'geography-explorer',
    code: '02',
    label: 'Geography Explorer',
    subtitle: 'Countries, States & Districts',
    icon: Compass,
    group: 'observation',
    action: 'focus_earth_section',
    params: { focus: 'geography' },
    isActive: (s) => s.currentScene === 'earth' && s.earthExplorerFocus === 'geography',
  },
  {
    id: 'island-explorer',
    code: '03',
    label: 'Island Explorer',
    subtitle: 'Oceans, Archipelagos & Islands',
    icon: Anchor,
    group: 'observation',
    action: 'focus_earth_section',
    params: { focus: 'islands' },
    isActive: (s) => s.currentScene === 'earth' && s.earthExplorerFocus === 'islands',
  },
  {
    id: 'global-coverage',
    code: '04',
    label: 'Global Coverage',
    subtitle: 'Boundary & Dataset Status',
    icon: BarChart3,
    group: 'observation',
    action: 'focus_earth_section',
    params: { focus: 'coverage' },
    isActive: (s) => s.currentScene === 'earth' && s.earthExplorerFocus === 'coverage',
  },
  {
    id: 'water-intelligence',
    code: '05',
    label: 'Water Intelligence',
    subtitle: 'Global Budget & Stress',
    icon: Droplets,
    group: 'observation',
    action: 'focus_earth_section',
    params: { focus: 'intelligence' },
    isActive: (s) => s.currentScene === 'earth' && s.earthExplorerFocus === 'intelligence',
  },
  {
    id: 'smart-city',
    code: '06',
    label: 'Future Smart City',
    subtitle: 'Urban Hydro Grid',
    icon: Building2,
    group: 'worlds',
    action: 'navigate_to_city',
    isActive: (s) => s.currentScene === 'city',
  },
  {
    id: 'underground',
    code: '07',
    label: 'Underground Water World',
    subtitle: 'Aquifers & Strata',
    icon: Layers,
    group: 'worlds',
    action: 'navigate_to_underground',
    isActive: (s) => s.currentScene === 'underground',
  },
  {
    id: 'science-lab',
    code: '08',
    label: 'Science Laboratory',
    subtitle: '8 Interactive Stations',
    icon: FlaskConical,
    group: 'worlds',
    action: 'navigate_to_lab',
    isActive: (s) => s.currentScene === 'lab',
  },
  {
    id: 'water-simulations',
    code: '09',
    label: 'Water Simulations',
    subtitle: 'Quantitative Models',
    icon: Activity,
    group: 'worlds',
    action: 'navigate_to_simulations',
    isActive: (s) => s.currentScene === 'simulations',
  },
  {
    id: 'aqua-ai',
    code: '10',
    label: 'AQUA AI',
    subtitle: 'Voice & Science Core',
    icon: AudioLines,
    group: 'operations',
    action: 'navigate_to_aqua',
    isActive: (s) => s.currentScene === 'aqua',
  },
  {
    id: 'save-the-city',
    code: '11',
    label: 'Save the City',
    subtitle: 'Crisis Mission Game',
    icon: ShieldAlert,
    group: 'operations',
    action: 'navigate_to_mission',
    isActive: (s) => s.currentScene === 'mission',
  },
];

const GROUP_LABELS: { id: SidebarNavItem['group']; label: string }[] = [
  { id: 'observation', label: 'Planetary Observation' },
  { id: 'worlds', label: '3D Worlds & Lab' },
  { id: 'operations', label: 'AI & Crisis Mission' },
];

export const MissionNavSidebar: React.FC = () => {
  const { state, dispatchAction } = useAppState();

  if (!state.leftNavOpen) return null;

  const handleSelect = (item: SidebarNavItem) => {
    dispatchAction(item.action, item.params ?? {}, 'mouse');
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      dispatchAction('toggle_left_nav', { open: false }, 'mouse');
    }
  };

  return (
    <>
      <div
        aria-hidden="true"
        onClick={() => dispatchAction('toggle_left_nav', { open: false }, 'mouse')}
        className="fixed inset-0 top-14 z-20 bg-black/60 lg:hidden"
      />

      <aside
        aria-label="Mission Navigation"
        className="aqua-scroll fixed top-14 bottom-0 left-0 z-30 flex w-60 shrink-0 flex-col justify-between overflow-y-auto border-r border-cyan-500/20 bg-[#040a14]/96 p-3 lg:static lg:z-10"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-cyan-500/15 pb-2.5 px-1">
            <div>
              <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
                Mission Directory
              </div>
              <div className="text-[11px] text-slate-400">{NAV_ITEMS.length} Active Modules</div>
            </div>
            <button
              type="button"
              onClick={() => dispatchAction('toggle_left_nav', { open: false }, 'mouse')}
              title="Collapse Navigation Sidebar"
              aria-label="Collapse Navigation Sidebar"
              className="rounded border border-white/10 bg-white/5 p-1 text-slate-300 hover:bg-white/10 hover:text-white transition-colors"
            >
              <PanelLeftClose className="hidden h-3.5 w-3.5 lg:block" />
              <X className="h-3.5 w-3.5 lg:hidden" />
            </button>
          </div>

          {GROUP_LABELS.map((group) => {
            const items = NAV_ITEMS.filter((i) => i.group === group.id);
            return (
              <div key={group.id} className="space-y-1">
                <div className="px-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">
                  {group.label}
                </div>
                <nav className="space-y-1" aria-label={group.label}>
                  {items.map((item) => {
                    const active = item.isActive(state);
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleSelect(item)}
                        aria-current={active ? 'page' : undefined}
                        className={`group flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                          active
                            ? 'border-cyan-400/45 bg-cyan-500/14 text-white'
                            : 'border-transparent bg-transparent text-slate-300 hover:border-cyan-500/20 hover:bg-white/5 hover:text-white'
                        }`}
                      >
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border ${
                            active
                              ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                              : 'border-white/10 bg-[#060d1a] text-slate-400 group-hover:text-cyan-300'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5 text-xs font-semibold leading-tight">
                            <span className="font-mono-tabular text-[10px] text-cyan-400/80">
                              {item.code}
                            </span>
                            <span className="truncate">{item.label}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-[10px] text-slate-400">
                            {item.subtitle}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </div>
            );
          })}
        </div>

        <div className="mt-4 rounded-lg border border-cyan-500/15 bg-[#060d1a] p-2.5 text-[10px] leading-relaxed text-slate-400">
          <div className="font-mono-tabular font-semibold uppercase tracking-wider text-cyan-300">
            Command Architecture
          </div>
          <p className="mt-1">
            All modules share one state bus across mouse, touch, keyboard, AQUA voice, and hand
            gestures.
          </p>
        </div>
      </aside>
    </>
  );
};
