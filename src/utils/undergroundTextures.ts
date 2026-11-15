import * as THREE from 'three';

export interface UndergroundTextureBundle {
  topsoil: THREE.CanvasTexture;
  sand: THREE.CanvasTexture;
  gravel: THREE.CanvasTexture;
  clay: THREE.CanvasTexture;
  sandstone: THREE.CanvasTexture;
  bedrock: THREE.CanvasTexture;
  dispose: () => void;
}

function makeStratumTexture(
  baseHex: string,
  drawFn: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
  maxAniso: number
): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, 512, 256);
  drawFn(ctx, 512, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

function rand(seed: number): number {
  const n = Math.sin(seed * 127.1 + 31.7) * 43758.5453;
  return n - Math.floor(n);
}

export function createUndergroundTextureBundle(maxAniso: number): UndergroundTextureBundle {
  const topsoil = makeStratumTexture(
    '#2f2419',
    (ctx, w, h) => {
      for (let i = 0; i < 650; i++) {
        const x = rand(i * 1.1) * w;
        const y = rand(i * 2.3) * h;
        const r = 1.5 + rand(i * 3.7) * 3.5;
        ctx.fillStyle = rand(i * 4.9) > 0.5 ? '#3e3022' : '#1f1710';
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      // Subtle root fibers near top
      ctx.strokeStyle = 'rgba(101, 163, 13, 0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 40; i++) {
        const x = rand(i * 7.1) * w;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.quadraticCurveTo(x + (rand(i) - 0.5) * 20, h * 0.25, x + (rand(i * 2) - 0.5) * 28, h * 0.5);
        ctx.stroke();
      }
    },
    maxAniso
  );

  const sand = makeStratumTexture(
    '#8b6f47',
    (ctx, w, h) => {
      // Cross-bedded sedimentary bands
      for (let y = 0; y < h; y += 14) {
        ctx.fillStyle = y % 28 === 0 ? 'rgba(217, 179, 124, 0.18)' : 'rgba(92, 70, 42, 0.16)';
        ctx.fillRect(0, y, w, 7);
      }
      for (let i = 0; i < 1400; i++) {
        const x = rand(i * 1.7) * w;
        const y = rand(i * 2.9) * h;
        ctx.fillStyle = rand(i * 5.3) > 0.5 ? '#b59362' : '#6c5334';
        ctx.fillRect(x, y, 2, 2);
      }
    },
    maxAniso
  );

  const gravel = makeStratumTexture(
    '#3d4c5c',
    (ctx, w, h) => {
      // Saturated bluish-slate gravel pebbles
      for (let i = 0; i < 420; i++) {
        const x = rand(i * 1.3) * w;
        const y = rand(i * 3.1) * h;
        const rx = 4 + rand(i * 4.1) * 9;
        const ry = 3 + rand(i * 5.7) * 6;
        const choice = rand(i * 6.9);
        ctx.fillStyle =
          choice > 0.66 ? '#64748b' : choice > 0.33 ? '#475569' : '#263849';
        ctx.beginPath();
        ctx.ellipse(x, y, rx, ry, rand(i) * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    maxAniso
  );

  const clay = makeStratumTexture(
    '#4c342e',
    (ctx, w, h) => {
      // Tight horizontal impermeable laminations
      for (let y = 0; y < h; y += 8) {
        ctx.fillStyle = y % 16 === 0 ? 'rgba(138, 86, 72, 0.35)' : 'rgba(46, 28, 25, 0.35)';
        ctx.fillRect(0, y, w, 4);
      }
    },
    maxAniso
  );

  const sandstone = makeStratumTexture(
    '#1b4965',
    (ctx, w, h) => {
      // Porous deep aquifer sandstone with cyan pore striations
      for (let y = 0; y < h; y += 18) {
        ctx.fillStyle = y % 36 === 0 ? 'rgba(56, 189, 248, 0.2)' : 'rgba(15, 45, 68, 0.32)';
        ctx.fillRect(0, y, w, 8);
      }
      for (let i = 0; i < 600; i++) {
        const x = rand(i * 1.9) * w;
        const y = rand(i * 3.3) * h;
        ctx.fillStyle = rand(i * 7.7) > 0.7 ? '#38bdf8' : '#2c6e91';
        ctx.fillRect(x, y, 3, 2);
      }
    },
    maxAniso
  );

  const bedrock = makeStratumTexture(
    '#161e29',
    (ctx, w, h) => {
      // Crystalline fractured granite/basalt
      ctx.strokeStyle = 'rgba(71, 85, 105, 0.35)';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 36; i++) {
        const x = rand(i * 3.7) * w;
        const y = rand(i * 5.1) * h;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (rand(i * 2) - 0.5) * 90, y + (rand(i * 4) - 0.5) * 45);
        ctx.stroke();
      }
    },
    maxAniso
  );

  return {
    topsoil,
    sand,
    gravel,
    clay,
    sandstone,
    bedrock,
    dispose: () => {
      topsoil.dispose();
      sand.dispose();
      gravel.dispose();
      clay.dispose();
      sandstone.dispose();
      bedrock.dispose();
    },
  };
}
