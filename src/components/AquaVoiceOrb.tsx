import React from 'react';
import { AquaAssistantStatus } from '../types/exhibition';

interface AquaVoiceOrbProps {
  status: AquaAssistantStatus;
  size?: 'sm' | 'lg';
}

const WAVE_BARS = [0.42, 0.72, 0.96, 0.64, 0.88, 0.54, 0.78];

export const AquaVoiceOrb: React.FC<AquaVoiceOrbProps> = ({ status, size = 'sm' }) => {
  const isLg = size === 'lg';
  const dim = isLg ? 'h-24 w-24' : 'h-10 w-10';

  const ringClass =
    status === 'listening'
      ? 'border-emerald-400/75 shadow-[0_0_24px_rgba(16,185,129,0.38)]'
      : status === 'thinking'
        ? 'border-amber-400/75 shadow-[0_0_24px_rgba(245,158,11,0.35)]'
        : status === 'speaking'
          ? 'border-cyan-300/90 shadow-[0_0_28px_rgba(34,211,238,0.48)]'
          : 'border-cyan-500/40 shadow-[0_0_14px_rgba(6,182,212,0.2)]';

  const coreGradient =
    status === 'listening'
      ? 'from-emerald-400/35 via-teal-500/20 to-[#040a14]'
      : status === 'thinking'
        ? 'from-amber-400/35 via-cyan-500/20 to-[#040a14]'
        : status === 'speaking'
          ? 'from-cyan-300/45 via-sky-500/25 to-[#040a14]'
          : 'from-cyan-500/25 via-sky-600/15 to-[#040a14]';

  const barColor =
    status === 'listening'
      ? 'bg-emerald-300'
      : status === 'thinking'
        ? 'bg-amber-300'
        : 'bg-cyan-300';

  return (
    <div className="flex items-center gap-3 shrink-0">
      <div
        aria-hidden="true"
        className={`relative flex items-center justify-center rounded-full border bg-gradient-to-br transition-all duration-200 ${dim} ${ringClass} ${coreGradient}`}
      >
        <div
          className={`absolute inset-1 rounded-full border border-white/15 ${
            status === 'thinking' ? 'animate-spin' : ''
          }`}
          style={{
            borderTopColor:
              status === 'thinking' ? 'rgba(251,191,36,0.85)' : 'rgba(103,232,249,0.5)',
          }}
        />
        <div
          className={`flex items-end justify-center gap-[2px] ${
            isLg ? 'h-8' : 'h-4'
          }`}
        >
          {WAVE_BARS.slice(0, isLg ? 7 : 5).map((factor, idx) => {
            const active = status === 'listening' || status === 'speaking';
            const heightPct = active
              ? Math.round(35 + factor * 65)
              : status === 'thinking'
                ? 42
                : Math.round(28 + factor * 24);
            return (
              <span
                key={idx}
                className={`w-[2.5px] rounded-full transition-all duration-150 ${barColor} ${
                  active ? 'animate-pulse' : 'opacity-80'
                }`}
                style={{
                  height: `${heightPct}%`,
                  animationDelay: `${idx * 90}ms`,
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
};
