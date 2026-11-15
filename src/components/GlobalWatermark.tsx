import React from 'react';

/**
 * Permanent Global Attribution Watermark.
 * Mounted once at the highest shared layout root so it remains fixed
 * above all 3D scenes, modals, fullscreen views, and mobile layouts.
 */
export const GlobalWatermark: React.FC = () => {
  return (
    <div
      aria-label="Global attribution watermark"
      data-testid="global-watermark"
      style={{ right: '18px', bottom: '14px' }}
      className="pointer-events-none fixed z-[9999] select-none rounded-md border border-cyan-400/40 bg-[#02050b]/88 px-2.5 py-1 text-[11px] font-medium tracking-wide text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.18)]"
    >
      Powered by Asworth&amp;Theerdha
    </div>
  );
};
