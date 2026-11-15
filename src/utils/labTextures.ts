import * as THREE from 'three';

export interface LabTextureBundle {
  deckGrid: THREE.CanvasTexture;
  strataSide: THREE.CanvasTexture;
  gaugeDial: THREE.CanvasTexture;
  roMembrane: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalizeTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, Math.max(1, anisotropy));
  if (repeatX !== 1 || repeatY !== 1) {
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(repeatX, repeatY);
  }
  tex.needsUpdate = true;
  return tex;
}

export function createLabTextureBundle(maxAnisotropy: number): LabTextureBundle {
  // 1. Futuristic clean-room hexagonal/radial deck grid
  const [deckCanvas, dCtx] = makeCanvas(512, 512);
  dCtx.fillStyle = '#071323';
  dCtx.fillRect(0, 0, 512, 512);
  dCtx.strokeStyle = 'rgba(34, 211, 238, 0.18)';
  dCtx.lineWidth = 2;
  for (let i = 0; i <= 512; i += 64) {
    dCtx.beginPath();
    dCtx.moveTo(i, 0);
    dCtx.lineTo(i, 512);
    dCtx.stroke();
    dCtx.beginPath();
    dCtx.moveTo(0, i);
    dCtx.lineTo(512, i);
    dCtx.stroke();
  }
  dCtx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
  dCtx.lineWidth = 1;
  for (let i = 32; i < 512; i += 64) {
    dCtx.beginPath();
    dCtx.moveTo(i, 0);
    dCtx.lineTo(i, 512);
    dCtx.stroke();
    dCtx.beginPath();
    dCtx.moveTo(0, i);
    dCtx.lineTo(512, i);
    dCtx.stroke();
  }
  const deckGrid = finalizeTexture(deckCanvas, maxAnisotropy, 3, 3);

  // 2. Geological bench cutaway strata band
  const [strataCanvas, sCtx] = makeCanvas(512, 512);
  const bands: Array<[number, number, string, string]> = [
    [0, 0.14, '#365314', '#4d7c0f'],
    [0.14, 0.34, '#a16207', '#ca8a04'],
    [0.34, 0.58, '#0284c7', '#0369a1'],
    [0.58, 0.72, '#57534e', '#44403c'],
    [0.72, 0.88, '#0369a1', '#0e7490'],
    [0.88, 1.0, '#1e293b', '#0f172a'],
  ];
  for (const [y0, y1, c0, c1] of bands) {
    const grad = sCtx.createLinearGradient(0, y0 * 512, 0, y1 * 512);
    grad.addColorStop(0, c0);
    grad.addColorStop(1, c1);
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, y0 * 512, 512, (y1 - y0) * 512);
  }
  // deterministic grain dots
  sCtx.fillStyle = 'rgba(255,255,255,0.08)';
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 512;
    const y = (i * 139) % 512;
    sCtx.fillRect(x, y, 2, 2);
  }
  const strataSide = finalizeTexture(strataCanvas, maxAnisotropy);

  // 3. Scientific Pressure / Turbidity Analog Gauge Dial
  const [dialCanvas, gCtx] = makeCanvas(256, 256);
  gCtx.fillStyle = '#061121';
  gCtx.beginPath();
  gCtx.arc(128, 128, 120, 0, Math.PI * 2);
  gCtx.fill();
  gCtx.strokeStyle = '#38bdf8';
  gCtx.lineWidth = 6;
  gCtx.stroke();
  for (let a = 0; a <= 10; a++) {
    const ang = Math.PI * 0.75 + (a / 10) * Math.PI * 1.5;
    gCtx.strokeStyle = a >= 8 ? '#fb7185' : '#94a3b8';
    gCtx.lineWidth = a % 2 === 0 ? 4 : 2;
    gCtx.beginPath();
    gCtx.moveTo(128 + Math.cos(ang) * 86, 128 + Math.sin(ang) * 86);
    gCtx.lineTo(128 + Math.cos(ang) * 104, 128 + Math.sin(ang) * 104);
    gCtx.stroke();
  }
  const gaugeDial = finalizeTexture(dialCanvas, maxAnisotropy);

  // 4. Reverse Osmosis Spiral-Wound Membrane Wrap
  const [roCanvas, rCtx] = makeCanvas(256, 256);
  rCtx.fillStyle = '#0f2942';
  rCtx.fillRect(0, 0, 256, 256);
  rCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  rCtx.lineWidth = 2;
  for (let y = 16; y < 256; y += 20) {
    rCtx.beginPath();
    rCtx.moveTo(0, y);
    rCtx.lineTo(256, y);
    rCtx.stroke();
  }
  const roMembrane = finalizeTexture(roCanvas, maxAnisotropy, 2, 1);

  return {
    deckGrid,
    strataSide,
    gaugeDial,
    roMembrane,
    dispose: () => {
      deckGrid.dispose();
      strataSide.dispose();
      gaugeDial.dispose();
      roMembrane.dispose();
    },
  };
}
