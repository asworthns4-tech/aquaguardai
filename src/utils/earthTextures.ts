import * as THREE from 'three';
import { EarthOverlayMode } from '../types/exhibition';

export function latLonToVector3(
  lat: number,
  lon: number,
  radius: number,
  out = new THREE.Vector3()
): THREE.Vector3 {
  const phi = THREE.MathUtils.degToRad(90 - lat);
  const theta = THREE.MathUtils.degToRad(lon + 180);
  out.set(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
  return out;
}

export function vector3ToLatLon(localPoint: THREE.Vector3): { lat: number; lon: number } {
  const n = localPoint.clone().normalize();
  const lat = THREE.MathUtils.radToDeg(Math.asin(THREE.MathUtils.clamp(n.y, -1, 1)));
  // Forward formula: x = -r*sin(phi)*cos(theta), z = r*sin(phi)*sin(theta), theta = lon + 180
  let theta = Math.atan2(n.z, -n.x);
  if (theta < 0) theta += Math.PI * 2;
  let lon = THREE.MathUtils.radToDeg(theta) - 180;
  if (lon > 180) lon -= 360;
  if (lon < -180) lon += 360;
  return {
    lat: Number(lat.toFixed(2)),
    lon: Number(lon.toFixed(2)),
  };
}

// Detailed natural-earth-style [lon, lat] polygons for realistic landmass silhouette synthesis
const CONTINENT_POLYGONS: {
  name: string;
  biome: 'temperate' | 'arid' | 'tropical' | 'ice' | 'india' | 'kerala' | 'boreal';
  coords: [number, number][];
}[] = [
  // North America
  {
    name: 'North America',
    biome: 'temperate',
    coords: [
      [-168, 65.5], [-164, 68.5], [-156, 71.2], [-141, 70.0], [-130, 70.2], [-121, 71.5],
      [-108, 73.2], [-96, 71.8], [-86, 70.2], [-81, 66.5], [-77, 62.5], [-68, 60.5],
      [-64, 58.2], [-56, 52.2], [-53, 47.0], [-60, 46.2], [-66.5, 44.5], [-70.5, 42.2],
      [-74.0, 40.5], [-76.0, 36.5], [-81.2, 31.0], [-80.2, 25.2], [-82.5, 27.5],
      [-84.5, 30.0], [-89.2, 29.1], [-94.5, 29.5], [-97.2, 26.0], [-96.3, 19.2],
      [-91.5, 18.8], [-88.0, 21.4], [-87.5, 18.0], [-83.5, 14.5], [-83.0, 10.0],
      [-78.0, 8.2], [-79.8, 8.8], [-85.5, 10.8], [-92.5, 14.8], [-99.0, 16.5],
      [-105.5, 20.5], [-109.5, 25.5], [-112.5, 29.5], [-110.0, 23.0], [-114.5, 27.5],
      [-117.1, 32.5], [-120.6, 34.8], [-124.2, 40.5], [-124.5, 48.2], [-128.0, 52.0],
      [-135.5, 57.5], [-145.0, 60.4], [-151.5, 59.5], [-158.0, 56.2], [-164.5, 54.8],
      [-162.5, 58.8], [-166.2, 62.0], [-168, 65.5],
    ],
  },
  // Hudson & Baffin Island region carve/detail
  {
    name: 'Baffin Island',
    biome: 'ice',
    coords: [
      [-84, 73], [-72, 71], [-62, 66], [-66, 62], [-76, 64], [-84, 70], [-84, 73],
    ],
  },
  {
    name: 'Cuba & Hispaniola',
    biome: 'tropical',
    coords: [[-84.8, 21.8], [-79.5, 22.8], [-74.3, 20.2], [-78.5, 19.8], [-84.8, 21.8]],
  },
  // Greenland
  {
    name: 'Greenland',
    biome: 'ice',
    coords: [
      [-44, 60], [-39, 64], [-32, 68], [-22, 74], [-18, 79], [-28, 82.8], [-48, 83.2],
      [-67, 78.5], [-71, 76], [-56, 71], [-53, 66], [-49, 61.5], [-44, 60],
    ],
  },
  // Iceland
  {
    name: 'Iceland',
    biome: 'boreal',
    coords: [[-24, 65.5], [-16, 66.2], [-14, 64.5], [-21, 63.8], [-24, 65.5]],
  },
  // South America
  {
    name: 'South America',
    biome: 'tropical',
    coords: [
      [-77.8, 8.8], [-75.5, 10.8], [-71.8, 12.1], [-66.5, 10.6], [-61.8, 10.2],
      [-55.0, 5.8], [-50.0, 1.2], [-44.0, -2.5], [-35.2, -5.8], [-34.8, -8.5],
      [-38.8, -14.2], [-40.5, -21.5], [-45.5, -24.0], [-48.8, -28.0], [-53.5, -33.8],
      [-58.2, -38.5], [-64.5, -42.5], [-66.8, -48.5], [-67.5, -54.2], [-72.5, -54.8],
      [-75.0, -48.5], [-73.8, -41.5], [-71.8, -33.5], [-70.6, -24.0], [-70.4, -18.2],
      [-76.5, -13.5], [-79.2, -8.0], [-81.3, -4.6], [-79.8, -1.5], [-77.8, 5.2], [-77.8, 8.8],
    ],
  },
  // Europe
  {
    name: 'Europe',
    biome: 'temperate',
    coords: [
      [-9.2, 37.1], [-9.3, 42.8], [-2.0, 43.4], [-4.6, 48.2], [1.8, 50.9], [5.0, 53.2],
      [8.5, 54.5], [8.2, 57.0], [10.6, 57.7], [12.0, 56.0], [10.5, 59.5], [5.2, 60.8],
      [9.5, 64.5], [16.5, 69.2], [27.5, 71.0], [32.0, 69.4], [41.5, 67.2], [44.5, 65.5],
      [59.5, 68.5], [60.0, 51.5], [45.0, 44.5], [38.0, 45.2], [33.5, 44.5], [29.0, 41.2],
      [25.5, 40.5], [22.8, 36.8], [19.5, 40.5], [16.2, 38.0], [12.8, 41.5], [13.8, 45.4],
      [9.0, 44.2], [5.2, 43.3], [1.2, 40.8], [-5.5, 36.1], [-9.2, 37.1],
    ],
  },
  // British Isles
  {
    name: 'Great Britain',
    biome: 'temperate',
    coords: [[-5.6, 50.1], [-1.5, 50.7], [1.7, 52.6], [-1.8, 55.6], [-3.2, 58.6], [-5.8, 58.0], [-4.8, 54.0], [-5.6, 50.1]],
  },
  {
    name: 'Ireland',
    biome: 'temperate',
    coords: [[-10.1, 51.6], [-6.2, 52.2], [-6.0, 55.1], [-9.8, 54.2], [-10.1, 51.6]],
  },
  // Africa
  {
    name: 'Africa',
    biome: 'arid',
    coords: [
      [-17.4, 14.8], [-16.8, 21.0], [-13.0, 27.5], [-6.0, 35.8], [3.5, 36.8],
      [10.8, 37.0], [11.5, 33.2], [20.5, 32.5], [32.5, 31.4], [34.5, 27.5],
      [38.5, 20.5], [43.2, 12.6], [51.3, 11.8], [48.0, 5.2], [41.5, -1.5],
      [40.4, -10.5], [35.2, -19.5], [33.0, -25.8], [28.2, -32.8], [20.0, -34.8],
      [17.8, -32.0], [14.5, -22.5], [12.0, -13.0], [12.4, -5.8], [9.4, 1.2],
      [8.5, 4.4], [2.5, 6.2], [-7.8, 4.6], [-13.8, 8.8], [-17.4, 14.8],
    ],
  },
  // Madagascar
  {
    name: 'Madagascar',
    biome: 'tropical',
    coords: [[44.2, -25.2], [47.2, -24.8], [49.9, -15.5], [49.3, -12.0], [46.2, -15.5], [43.4, -21.5], [44.2, -25.2]],
  },
  // Eurasia (Middle East + North/Central/East/SE Asia)
  {
    name: 'Eurasia',
    biome: 'temperate',
    coords: [
      [27.2, 41.2], [26.8, 38.2], [35.8, 36.2], [34.8, 31.2], [39.5, 21.5],
      [43.5, 12.8], [53.8, 16.5], [59.8, 22.4], [56.3, 26.2], [51.5, 25.5],
      [50.0, 29.8], [57.0, 25.5], [66.5, 24.8], [74.0, 35.8], [80.0, 31.0],
      [88.5, 27.2], [93.0, 21.0], [96.5, 16.5], [98.5, 12.0], [103.8, 1.4],
      [104.6, 8.6], [109.2, 12.8], [107.2, 20.8], [114.2, 22.3], [120.5, 26.8],
      [122.0, 31.5], [119.5, 35.2], [122.5, 37.3], [118.0, 39.0], [124.2, 39.8],
      [126.5, 35.0], [129.2, 35.2], [128.5, 40.5], [135.5, 44.0], [141.2, 53.0],
      [138.0, 58.0], [148.0, 59.5], [156.5, 51.0], [162.5, 56.5], [174.0, 62.5],
      [179.0, 66.2], [170.0, 69.8], [148.0, 71.2], [132.0, 72.5], [106.0, 77.2],
      [84.0, 73.5], [70.0, 72.8], [59.5, 68.5], [60.0, 51.5], [45.0, 44.5],
      [38.0, 45.2], [29.0, 41.2], [27.2, 41.2],
    ],
  },
  // India Subcontinent
  {
    name: 'India',
    biome: 'india',
    coords: [
      [68.4, 23.7], [70.8, 27.6], [74.4, 32.5], [77.6, 35.6], [80.1, 31.1],
      [84.4, 28.0], [88.5, 27.2], [92.5, 28.1], [96.8, 28.0], [94.6, 24.2],
      [92.1, 21.8], [88.8, 21.7], [86.8, 20.2], [83.2, 17.6], [80.3, 13.1],
      [79.8, 10.2], [77.5, 8.08], [76.2, 9.9], [74.8, 13.8], [73.2, 17.8],
      [72.8, 20.6], [72.2, 21.8], [69.0, 22.3], [68.4, 23.7],
    ],
  },
  // Kerala Coastal Belt
  {
    name: 'Kerala',
    biome: 'kerala',
    coords: [
      [74.95, 12.75], [76.1, 11.9], [76.8, 10.6], [77.25, 9.2], [77.45, 8.22],
      [76.85, 8.4], [76.22, 9.82], [75.68, 11.3], [74.95, 12.75],
    ],
  },
  // Sri Lanka
  {
    name: 'Sri Lanka',
    biome: 'tropical',
    coords: [[79.8, 9.6], [81.7, 8.1], [81.2, 6.0], [79.8, 6.8], [79.8, 9.6]],
  },
  // Maritime SE Asia & Japan
  {
    name: 'Sumatra',
    biome: 'tropical',
    coords: [[95.2, 5.5], [99.8, 3.2], [104.5, -1.8], [105.6, -5.8], [102.2, -4.2], [97.5, 1.5], [95.2, 5.5]],
  },
  {
    name: 'Java',
    biome: 'tropical',
    coords: [[105.5, -6.2], [114.4, -7.8], [113.8, -8.5], [106.0, -7.2], [105.5, -6.2]],
  },
  {
    name: 'Borneo',
    biome: 'tropical',
    coords: [[109.2, 1.6], [117.5, 6.5], [118.8, 1.2], [115.8, -3.6], [110.2, -3.1], [109.2, 1.6]],
  },
  {
    name: 'Philippines',
    biome: 'tropical',
    coords: [[120.2, 18.4], [122.6, 15.2], [126.2, 8.5], [123.5, 6.5], [120.0, 14.5], [120.2, 18.4]],
  },
  {
    name: 'Japan',
    biome: 'temperate',
    coords: [[130.2, 31.6], [134.8, 34.4], [139.8, 35.6], [141.6, 40.8], [145.2, 44.2], [141.4, 43.2], [138.8, 37.5], [132.5, 34.2], [130.2, 31.6]],
  },
  {
    name: 'New Guinea',
    biome: 'tropical',
    coords: [[132.0, -2.5], [141.0, -2.6], [150.5, -10.2], [142.5, -8.8], [135.5, -5.2], [132.0, -2.5]],
  },
  // Australia
  {
    name: 'Australia',
    biome: 'arid',
    coords: [
      [113.8, -22.2], [118.5, -20.2], [123.5, -16.5], [130.5, -12.4], [136.8, -12.2],
      [139.8, -17.2], [142.5, -10.8], [145.8, -15.5], [150.5, -22.5], [153.5, -28.0],
      [150.2, -36.8], [145.2, -38.5], [138.5, -35.5], [134.0, -32.2], [128.5, -31.8],
      [121.8, -33.8], [115.2, -34.2], [113.8, -26.5], [113.8, -22.2],
    ],
  },
  // New Zealand
  {
    name: 'New Zealand',
    biome: 'temperate',
    coords: [[166.8, -46.2], [174.2, -41.2], [178.4, -37.6], [173.2, -34.6], [171.2, -41.5], [166.8, -46.2]],
  },
  // Antarctica
  {
    name: 'Antarctica',
    biome: 'ice',
    coords: [
      [-180, -72], [-145, -75], [-105, -73], [-75, -72], [-61, -63.5], [-55, -65],
      [-40, -75], [-10, -71], [18, -70], [45, -67.5], [75, -68.5], [105, -66.5],
      [140, -66.8], [168, -71.5], [180, -73], [180, -90], [-180, -90],
    ],
  },
];

const MAJOR_RIVERS: [number, number][][] = [
  [[-75.5, -5.2], [-68.0, -4.0], [-60.2, -3.1], [-54.0, -2.0], [-49.2, 0.2]], // Amazon
  [[32.5, 0.8], [31.8, 9.5], [32.5, 15.8], [31.2, 24.5], [31.1, 31.1]], // Nile
  [[78.9, 30.8], [81.2, 26.4], [85.2, 25.4], [88.4, 23.6], [90.2, 22.0]], // Ganga
  [[84.5, 30.0], [92.2, 29.2], [95.0, 27.6], [90.2, 25.4], [90.2, 22.0]], // Brahmaputra
  [[77.15, 9.55], [76.68, 10.08], [76.22, 10.18]], // Periyar
  [[95.0, 33.0], [104.5, 29.2], [112.2, 30.1], [121.2, 31.5]], // Yangtze
  [[-95.2, 47.0], [-91.2, 41.2], [-90.2, 35.1], [-89.4, 29.2]], // Mississippi
];

// Global urban light corridors [lon, lat, spreadDeg, intensity]
const URBAN_CLUSTERS: [number, number, number, number][] = [
  // India & South Asia
  [77.2, 28.6, 4.2, 1.0], // Delhi-NCR
  [75.8, 26.9, 2.8, 0.7], // Jaipur
  [80.9, 26.8, 3.6, 0.8], // Lucknow / Kanpur
  [85.1, 25.6, 3.0, 0.68], // Patna
  [88.4, 22.6, 3.2, 0.92], // Kolkata
  [72.85, 19.05, 3.2, 0.96], // Mumbai / Pune
  [72.6, 23.0, 2.6, 0.8], // Ahmedabad / Surat
  [78.5, 17.4, 2.8, 0.85], // Hyderabad
  [77.6, 12.97, 3.0, 0.92], // Bengaluru
  [80.27, 13.08, 2.6, 0.88], // Chennai
  [76.28, 10.0, 2.0, 0.85], // Kerala Kochi corridor
  [76.95, 8.52, 1.6, 0.72], // Thiruvananthapuram
  [74.3, 31.5, 2.6, 0.72], // Lahore
  [90.4, 23.8, 2.4, 0.75], // Dhaka
  // Europe
  [-0.1, 51.5, 3.8, 1.0], // London
  [2.35, 48.85, 3.8, 0.96], // Paris
  [4.9, 51.8, 3.5, 0.95], // Benelux / Ruhr
  [10.0, 51.0, 4.2, 0.88], // Central Germany
  [9.2, 45.46, 3.2, 0.9], // Milan / Po Valley
  [12.5, 41.9, 2.4, 0.82], // Rome
  [-3.7, 40.4, 2.6, 0.82], // Madrid
  [37.6, 55.75, 4.2, 0.92], // Moscow
  // Nile & Middle East
  [31.23, 30.04, 2.8, 1.0], // Cairo / Nile Delta
  [31.6, 26.5, 2.2, 0.55], // Nile Valley
  [28.97, 41.0, 2.8, 0.88], // Istanbul
  [55.27, 25.2, 2.4, 0.88], // Dubai / Persian Gulf
  [46.7, 24.7, 2.6, 0.78], // Riyadh
  // East & SE Asia
  [116.4, 39.9, 4.6, 1.0], // Beijing-Tianjin
  [121.47, 31.23, 4.8, 1.0], // Shanghai / Yangtze Delta
  [113.3, 23.1, 4.2, 1.0], // Pearl River Delta
  [126.97, 37.56, 2.8, 0.96], // Seoul
  [139.69, 35.68, 3.6, 1.0], // Tokyo
  [135.5, 34.7, 2.6, 0.9], // Osaka
  [121.56, 25.03, 1.8, 0.82], // Taipei
  [100.5, 13.75, 2.8, 0.85], // Bangkok
  [103.8, 1.35, 2.2, 0.88], // Singapore
  [106.84, -6.2, 3.6, 0.9], // Jakarta / Java
  [121.0, 14.6, 2.2, 0.82], // Manila
  // North America
  [-74.0, 40.7, 5.2, 1.0], // NY / Boston / DC BosWash
  [-87.6, 41.8, 5.5, 0.95], // Chicago / Midwest
  [-84.4, 33.7, 4.5, 0.82], // Atlanta / SE US
  [-95.4, 29.76, 4.8, 0.9], // Texas triangle
  [-118.24, 34.05, 4.0, 0.98], // Los Angeles
  [-122.4, 37.77, 2.8, 0.88], // SF Bay
  [-79.38, 43.65, 3.2, 0.86], // Toronto
  [-99.13, 19.43, 3.2, 0.9], // Mexico City
  // South America, Africa & Oceania
  [-46.63, -23.55, 3.8, 0.95], // Sao Paulo / Rio
  [-58.38, -34.6, 3.2, 0.88], // Buenos Aires
  [-74.07, 4.71, 2.4, 0.72], // Bogota
  [28.04, -26.2, 2.8, 0.82], // Johannesburg
  [3.38, 6.52, 2.8, 0.75], // Lagos
  [151.2, -33.86, 2.8, 0.86], // Sydney
  [144.96, -37.81, 2.4, 0.82], // Melbourne
];

function lonToX(lon: number, width: number): number {
  return ((lon + 180) / 360) * width;
}

function latToY(lat: number, height: number): number {
  return ((90 - lat) / 180) * height;
}

function tracePoly(ctx: CanvasRenderingContext2D, coords: [number, number][], w: number, h: number) {
  ctx.beginPath();
  coords.forEach(([lon, lat], idx) => {
    const x = lonToX(lon, w);
    const y = latToY(lat, h);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
}

// Fast 32-bit integer hash noise (no slow Math.sin inside pixel loops)
function intHash(ix: number, iy: number): number {
  let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function fastNoise2D(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = intHash(ix, iy);
  const b = intHash(ix + 1, iy);
  const c = intHash(ix, iy + 1);
  const d = intHash(ix + 1, iy + 1);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fastFbm(x: number, y: number, octaves = 4): number {
  let value = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    value += amp * fastNoise2D(x * freq, y * freq);
    freq *= 2.03;
    amp *= 0.5;
  }
  return value;
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export interface EarthTextureBundle {
  colorMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  cloudMap: THREE.CanvasTexture;
  nightLightsMap: THREE.CanvasTexture;
  overlays: Record<EarthOverlayMode, THREE.CanvasTexture>;
  dispose: () => void;
}

let cachedFallbackPreviewUrl: string | null = null;

export function getEarthFallbackPreviewDataUrl(): string {
  if (cachedFallbackPreviewUrl) return cachedFallbackPreviewUrl;
  const c = document.createElement('canvas');
  c.width = 720;
  c.height = 360;
  const ctx = c.getContext('2d');
  if (ctx) {
    renderSimplifiedBlueMarbleToCanvas(ctx, 720, 360);
    cachedFallbackPreviewUrl = c.toDataURL('image/png');
  } else {
    cachedFallbackPreviewUrl = '';
  }
  return cachedFallbackPreviewUrl;
}

function renderSimplifiedBlueMarbleToCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number
) {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#07223e');
  g.addColorStop(0.5, '#09345c');
  g.addColorStop(1, '#061f38');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.14)';
  ctx.lineWidth = 1;
  for (let lat = -60; lat <= 60; lat += 30) {
    const y = latToY(lat, h);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  for (let lon = -150; lon <= 180; lon += 30) {
    const x = lonToX(lon, w);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }

  for (const poly of CONTINENT_POLYGONS) {
    tracePoly(ctx, poly.coords, w, h);
    if (poly.biome === 'ice') ctx.fillStyle = '#dcebf6';
    else if (poly.biome === 'arid') ctx.fillStyle = '#7e7154';
    else if (poly.biome === 'tropical') ctx.fillStyle = '#245232';
    else if (poly.biome === 'india' || poly.biome === 'kerala') ctx.fillStyle = '#2b5e42';
    else ctx.fillStyle = '#2d533c';
    ctx.fill();
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

export function createEarthTextureBundle(maxAnisotropy: number): EarthTextureBundle {
  const W = 2048;
  const H = 1024;
  const MW = 1024;
  const MH = 512;

  // 1. Rasterize land, shelf & biome feature masks at 1024x512 (fast offscreen geometry)
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = MW;
  maskCanvas.height = MH;
  const mCtx = maskCanvas.getContext('2d')!;

  // Layer A (Red channel): Land elevation & shelf distance
  // Draw soft coastal shelf halos -> crisp solid white continents
  mCtx.fillStyle = '#000000';
  mCtx.fillRect(0, 0, MW, MH);
  mCtx.lineJoin = 'round';
  mCtx.lineCap = 'round';

  const shelfPasses: [number, string][] = [
    [24, 'rgba(65, 65, 65, 0.35)'],
    [13, 'rgba(120, 120, 120, 0.45)'],
    [6, 'rgba(180, 180, 180, 0.65)'],
  ];
  for (const [lw, col] of shelfPasses) {
    mCtx.lineWidth = lw;
    mCtx.strokeStyle = col;
    for (const poly of CONTINENT_POLYGONS) {
      tracePoly(mCtx, poly.coords, MW, MH);
      mCtx.stroke();
    }
  }
  for (const poly of CONTINENT_POLYGONS) {
    tracePoly(mCtx, poly.coords, MW, MH);
    mCtx.fillStyle = '#ffffff';
    mCtx.fill();
  }
  const landMaskBytes = mCtx.getImageData(0, 0, MW, MH).data;

  // Layer B: Biome feature mask (Red = Arid/Desert, Green = Lush Rainforest, Blue = Mountains/Snowpeaks)
  const bioCanvas = document.createElement('canvas');
  bioCanvas.width = MW;
  bioCanvas.height = MH;
  const bCtx = bioCanvas.getContext('2d')!;
  bCtx.fillStyle = '#000000';
  bCtx.fillRect(0, 0, MW, MH);

  // Arid desert regions -> Red channel
  const deserts: [number, number, number, number][] = [
    [13, 23, 98, 36], // Sahara
    [46, 23, 42, 26], // Arabian desert
    [62, 41, 44, 24], // Central Asia / Karakum / Kyzylkum
    [98, 41, 42, 20], // Gobi / Taklamakan
    [71, 27, 20, 16], // Thar
    [132, -24, 52, 26], // Australian Outback
    [-112, 33, 26, 24], // Sonoran / Mojave
    [-69, -22, 12, 26], // Atacama / Patagonia arid
    [19, -24, 18, 18], // Kalahari / Namib
  ];
  for (const [lon, lat, rx, ry] of deserts) {
    paintMaskEllipse(bCtx, MW, MH, lon, lat, rx, ry, 'rgba(255, 0, 0, 0.92)', 'rgba(255, 0, 0, 0)');
  }

  // Rainforest & monsoon canopy belts -> Green channel
  const forests: [number, number, number, number][] = [
    [-61, -4, 72, 44], // Amazon
    [22, 0, 44, 26], // Congo
    [104, 1, 56, 28], // SE Asia / Borneo / Sumatra
    [76.2, 10.5, 16, 16], // Western Ghats / Kerala
    [90, 24, 30, 20], // NE India / Myanmar
    [-92, 56, 85, 22], // North American Boreal
    [82, 60, 145, 22], // Siberian Taiga
  ];
  for (const [lon, lat, rx, ry] of forests) {
    paintMaskEllipse(bCtx, MW, MH, lon, lat, rx, ry, 'rgba(0, 255, 0, 0.9)', 'rgba(0, 255, 0, 0)');
  }

  // Alpine mountain belts -> Blue channel
  const mountains: [number, number, number, number][] = [
    [84, 32, 52, 18], // Himalayas & Tibetan Plateau
    [75.8, 12.2, 7, 18], // Western Ghats
    [-69, -18, 12, 62], // Andes
    [-112, 46, 18, 42], // Rockies
    [10, 46, 18, 10], // Alps
    [38, 9, 14, 18], // Ethiopian Highlands
  ];
  for (const [lon, lat, rx, ry] of mountains) {
    paintMaskEllipse(bCtx, MW, MH, lon, lat, rx, ry, 'rgba(0, 0, 255, 0.95)', 'rgba(0, 0, 255, 0)');
  }

  // Highlight ice caps polygon in biome alpha/white via separate check using lat + CONTINENT_POLYGONS
  const biomeBytes = bCtx.getImageData(0, 0, MW, MH).data;

  // 2. Synthesize 2048x1024 Color Map + 1024x512 Roughness + 1024x512 Bump Map cleanly
  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const cCtx = colorCanvas.getContext('2d')!;
  const colorImg = cCtx.createImageData(W, H);
  const cData = colorImg.data;

  const roughCanvas = document.createElement('canvas');
  roughCanvas.width = MW;
  roughCanvas.height = MH;
  const rCtx = roughCanvas.getContext('2d')!;
  const roughImg = rCtx.createImageData(MW, MH);
  const rData = roughImg.data;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = MW;
  bumpCanvas.height = MH;
  const bmpCtx = bumpCanvas.getContext('2d')!;
  const bumpImg = bmpCtx.createImageData(MW, MH);
  const bData = bumpImg.data;

  for (let y = 0; y < H; y++) {
    const v = y / H;
    const lat = 90 - v * 180;
    const absLat = Math.abs(lat);
    const my = Math.min(MH - 1, y >> 1);
    const cosLat = Math.max(0.18, Math.cos((lat * Math.PI) / 180));

    for (let x = 0; x < W; x++) {
      const mx = x >> 1;
      const mIdx = (my * MW + mx) * 4;
      const baseMask = landMaskBytes[mIdx] / 255;

      // Seamless cylindrical noise coordinates so there is zero seam at lon = ±180°
      const angle = (x / W) * Math.PI * 2;
      const sx = Math.cos(angle) * 6.5 * cosLat + 14.2;
      const sz = Math.sin(angle) * 6.5 * cosLat + 21.7;
      const sy = v * 13.0;

      const microNoise = fastFbm(sx * 3.1 + sy * 0.4, sz * 3.1 - sy * 0.6, 3);
      const macroNoise = fastFbm(sx * 1.15, sy * 1.35 + sz * 0.85, 3);

      // Organic coastline edge perturbation
      const coastSignal = baseMask + (microNoise - 0.5) * 0.24;
      const isLand = coastSignal > 0.72;

      const arid = biomeBytes[mIdx] / 255;
      const lush = biomeBytes[mIdx + 1] / 255;
      const alpine = biomeBytes[mIdx + 2] / 255;

      let r = 0;
      let g = 0;
      let b = 0;
      let rough = 54;
      let bump = 16;

      if (!isLand) {
        // Bathymetric ocean shading
        const shelf = THREE.MathUtils.clamp(coastSignal / 0.72, 0, 1);
        const pelagicWave = (macroNoise - 0.5) * 14 + (microNoise - 0.5) * 8;
        // Deep abyss -> mid pelagic -> shallow turquoise continental shelf
        const rBase = lerp(4, 22, Math.pow(shelf, 2.2));
        const gBase = lerp(22, 108, Math.pow(shelf, 1.8));
        const bBase = lerp(52, 146, Math.pow(shelf, 1.45));

        r = rBase + pelagicWave * 0.25;
        g = gBase + pelagicWave * 0.45;
        b = bBase + pelagicWave * 0.7;

        // Arctic / Southern Ocean pack ice glint above 73°
        if (absLat > 73 + (microNoise - 0.5) * 6) {
          const iceBlend = THREE.MathUtils.clamp((absLat - 72) / 10, 0, 0.88);
          r = lerp(r, 214, iceBlend);
          g = lerp(g, 232, iceBlend);
          b = lerp(b, 244, iceBlend);
          rough = lerp(54, 128, iceBlend);
        }

        // Seafloor ridge bump modulation (subtle)
        bump = 10 + macroNoise * 12;
      } else {
        // Terrestrial biome color synthesis
        const detail = (microNoise - 0.5) * 34 + (macroNoise - 0.5) * 26;

        // Base temperate green-slate
        r = 46 + detail * 0.6;
        g = 72 + detail * 0.7;
        b = 42 + detail * 0.4;

        // Tropical / Boreal lush forest blend
        if (lush > 0.05) {
          const t = lush * (0.75 + microNoise * 0.35);
          r = lerp(r, 24 + detail * 0.4, Math.min(1, t));
          g = lerp(g, 62 + detail * 0.55, Math.min(1, t));
          b = lerp(b, 30 + detail * 0.3, Math.min(1, t));
        }

        // Arid deserts & plateaus
        if (arid > 0.05) {
          const t = Math.min(1, arid * (0.8 + macroNoise * 0.35));
          r = lerp(r, 174 + detail * 0.85, t);
          g = lerp(g, 142 + detail * 0.65, t);
          b = lerp(b, 98 + detail * 0.45, t);
        }

        // Alpine rock + high-elevation glacier snowcaps
        if (alpine > 0.08) {
          const peak = Math.min(1, alpine * (0.65 + microNoise * 0.7));
          const rockR = 114 + detail * 0.5;
          const rockG = 104 + detail * 0.45;
          const rockB = 92 + detail * 0.45;
          r = lerp(r, rockR, peak);
          g = lerp(g, rockG, peak);
          b = lerp(b, rockB, peak);
          if (peak > 0.58) {
            const snow = THREE.MathUtils.clamp((peak - 0.56) * 2.2, 0, 1);
            r = lerp(r, 232, snow);
            g = lerp(g, 241, snow);
            b = lerp(b, 249, snow);
          }
          bump = 115 + peak * 140;
        } else {
          bump = 88 + macroNoise * 44 + microNoise * 22;
        }

        // Polar ice sheet override (Antarctica, Greenland, high Arctic)
        const polarLat = lat < -64 || (lat > 66 && macroNoise > 0.35);
        if (polarLat) {
          const iceT = lat < -64 ? 0.92 : THREE.MathUtils.clamp((lat - 64) / 14, 0, 0.9);
          r = lerp(r, 228 + detail * 0.25, iceT);
          g = lerp(g, 239 + detail * 0.22, iceT);
          b = lerp(b, 248 + detail * 0.18, iceT);
          rough = lerp(218, 126, iceT);
        } else {
          rough = 216 + (microNoise - 0.5) * 18;
        }
      }

      const pIdx = (y * W + x) * 4;
      cData[pIdx] = clampByte(r);
      cData[pIdx + 1] = clampByte(g);
      cData[pIdx + 2] = clampByte(b);
      cData[pIdx + 3] = 255;

      // Populate 1024x512 roughness & bump on even pixel indices
      if ((x & 1) === 0 && (y & 1) === 0) {
        rData[mIdx] = rData[mIdx + 1] = rData[mIdx + 2] = clampByte(rough);
        rData[mIdx + 3] = 255;
        bData[mIdx] = bData[mIdx + 1] = bData[mIdx + 2] = clampByte(bump);
        bData[mIdx + 3] = 255;
      }
    }
  }

  cCtx.putImageData(colorImg, 0, 0);
  rCtx.putImageData(roughImg, 0, 0);
  bmpCtx.putImageData(bumpImg, 0, 0);

  // Overlay inland Great Lakes, Lake Baikal, Caspian Sea & Major Rivers subtly onto Color + Roughness
  cCtx.fillStyle = '#0f567a';
  rCtx.fillStyle = 'rgb(56, 56, 56)';
  const inlandLakes: [number, number, number, number, number][] = [
    [-85, 45.8, 22, 11, 0.2], // Great Lakes
    [108, 53.5, 5, 16, 0.4], // Lake Baikal
    [51, 41.5, 14, 28, 0.08], // Caspian Sea
    [33, -1.5, 9, 9, 0], // Lake Victoria
  ];
  for (const [lon, lat, rx, ry, rot] of inlandLakes) {
    cCtx.beginPath();
    cCtx.ellipse(lonToX(lon, W), latToY(lat, H), rx, ry, rot, 0, Math.PI * 2);
    cCtx.fill();

    rCtx.beginPath();
    rCtx.ellipse(lonToX(lon, MW), latToY(lat, MH), rx * 0.5, ry * 0.5, rot, 0, Math.PI * 2);
    rCtx.fill();
  }

  cCtx.strokeStyle = 'rgba(26, 128, 168, 0.62)';
  cCtx.lineWidth = 2.0;
  cCtx.lineCap = 'round';
  cCtx.lineJoin = 'round';
  for (const river of MAJOR_RIVERS) {
    cCtx.beginPath();
    river.forEach(([lon, lat], i) => {
      const rx = lonToX(lon, W);
      const ry = latToY(lat, H);
      if (i === 0) cCtx.moveTo(rx, ry);
      else cCtx.lineTo(rx, ry);
    });
    cCtx.stroke();
  }

  const colorMap = new THREE.CanvasTexture(colorCanvas);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  colorMap.anisotropy = maxAnisotropy;

  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  roughnessMap.colorSpace = THREE.NoColorSpace;

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.colorSpace = THREE.NoColorSpace;

  // 3. Night City Lights Map (1024 x 512, black space/oceans, warm urban illumination clusters)
  const nightCanvas = document.createElement('canvas');
  nightCanvas.width = MW;
  nightCanvas.height = MH;
  const nCtx = nightCanvas.getContext('2d')!;
  nCtx.fillStyle = '#000000';
  nCtx.fillRect(0, 0, MW, MH);

  for (const [lon, lat, spread, intensity] of URBAN_CLUSTERS) {
    const cx = lonToX(lon, MW);
    const cy = latToY(lat, MH);
    const r = (spread / 360) * MW;

    // Warm urban haze halo
    const g = nCtx.createRadialGradient(cx, cy, 0, cx, cy, r * 2.1);
    g.addColorStop(0, `rgba(255, 200, 108, ${0.42 * intensity})`);
    g.addColorStop(0.45, `rgba(255, 152, 58, ${0.18 * intensity})`);
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    nCtx.fillStyle = g;
    nCtx.beginPath();
    nCtx.arc(cx, cy, r * 2.1, 0, Math.PI * 2);
    nCtx.fill();

    // Deterministic pinpoint city clusters inside urban spread
    const count = Math.round(28 * intensity);
    for (let k = 0; k < count; k++) {
      const angle = intHash(Math.round(lon * 10) + k, Math.round(lat * 10)) * Math.PI * 2;
      const dist = Math.pow(intHash(k + 13, Math.round(lon * 17)), 0.75) * r * 1.45;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist * 0.72;
      const ix = Math.max(0, Math.min(MW - 1, Math.round(px)));
      const iy = Math.max(0, Math.min(MH - 1, Math.round(py)));
      // Keep urban lights strictly on land
      if (landMaskBytes[(iy * MW + ix) * 4] < 160) continue;
      const dotR = 0.7 + intHash(k, 79) * 1.3;
      nCtx.fillStyle = k % 4 === 0 ? '#fff2c9' : '#ffc164';
      nCtx.beginPath();
      nCtx.arc(px, py, dotR, 0, Math.PI * 2);
      nCtx.fill();
    }
  }

  const nightLightsMap = new THREE.CanvasTexture(nightCanvas);
  nightLightsMap.colorSpace = THREE.SRGBColorSpace;
  nightLightsMap.anisotropy = maxAnisotropy;

  // 4. High-Detail Atmospheric Cloud Map (1024 x 512, fast spherical FBM with cyclone warp)
  const cloudCanvas = document.createElement('canvas');
  cloudCanvas.width = MW;
  cloudCanvas.height = MH;
  const clCtx = cloudCanvas.getContext('2d')!;
  const cloudImg = clCtx.createImageData(MW, MH);
  const clData = cloudImg.data;
  for (let y = 0; y < MH; y++) {
    const v = y / MH;
    const lat = 90 - v * 180;
    const latBand = 0.72 + 0.28 * Math.sin(v * Math.PI);
    const itczBoost = Math.exp(-Math.pow((lat - 4) / 14, 2)) * 0.08;
    const stormBeltBoost = Math.exp(-Math.pow((Math.abs(lat) - 48) / 16, 2)) * 0.09;
    for (let x = 0; x < MW; x++) {
      const angle = (x / MW) * Math.PI * 2;
      const cx = Math.cos(angle) * 2.4 + 6.0;
      const cz = Math.sin(angle) * 2.4 + 6.0;
      const cy = v * 5.6;
      const warp = fastFbm(cx + cy * 0.45, cz - cy * 0.45, 3);
      const n = fastFbm(cx + warp * 1.45, cz + cy * 0.9 + warp * 1.2, 4);
      const density = n * latBand + itczBoost + stormBeltBoost;
      const alpha = clampByte((density - 0.51) * 620);
      const idx = (y * MW + x) * 4;
      clData[idx] = 240;
      clData[idx + 1] = 247;
      clData[idx + 2] = 255;
      clData[idx + 3] = alpha;
    }
  }
  clCtx.putImageData(cloudImg, 0, 0);
  const cloudMap = new THREE.CanvasTexture(cloudCanvas);
  cloudMap.colorSpace = THREE.SRGBColorSpace;
  cloudMap.wrapS = THREE.RepeatWrapping;
  cloudMap.anisotropy = maxAnisotropy;

  // 5. Four Educational Water Overlay Textures
  const overlays: Record<EarthOverlayMode, THREE.CanvasTexture> = {
    'water-availability': buildAvailabilityOverlay(maxAnisotropy),
    freshwater: buildFreshwaterOverlay(maxAnisotropy),
    saltwater: buildSaltwaterOverlay(maxAnisotropy),
    groundwater: buildGroundwaterOverlay(maxAnisotropy),
  };

  return {
    colorMap,
    roughnessMap,
    bumpMap,
    cloudMap,
    nightLightsMap,
    overlays,
    dispose: () => {
      colorMap.dispose();
      roughnessMap.dispose();
      bumpMap.dispose();
      cloudMap.dispose();
      nightLightsMap.dispose();
      Object.values(overlays).forEach((t) => t.dispose());
    },
  };
}

function paintMaskEllipse(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lon: number,
  lat: number,
  rx: number,
  ry: number,
  colorInner: string,
  colorOuter: string
) {
  const cx = lonToX(lon, w);
  const cy = latToY(lat, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
  g.addColorStop(0, colorInner);
  g.addColorStop(1, colorOuter);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintRadialSpot(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lon: number,
  lat: number,
  rx: number,
  ry: number,
  colorInner: string,
  colorOuter: string
) {
  const cx = lonToX(lon, w);
  const cy = latToY(lat, h);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(1, ry / rx);
  const g = ctx.createRadialGradient(0, 0, 2, 0, 0, rx);
  g.addColorStop(0, colorInner);
  g.addColorStop(1, colorOuter);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, rx, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function buildAvailabilityOverlay(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const stressZones: [number, number, number, number][] = [
    [12, 23, 95, 42],
    [45, 24, 52, 34],
    [73, 28, 38, 28],
    [-110, 34, 42, 32],
    [132, -25, 50, 28],
    [62, 41, 45, 25],
  ];
  for (const [lon, lat, rx, ry] of stressZones) {
    paintRadialSpot(ctx, w, h, lon, lat, rx, ry, 'rgba(245, 158, 11, 0.56)', 'rgba(234, 88, 12, 0)');
  }

  const abundantZones: [number, number, number, number][] = [
    [76.2, 10.5, 22, 24],
    [-62, -4, 72, 48],
    [22, 0, 48, 34],
    [106, 2, 56, 36],
    [90, 24, 34, 24],
  ];
  for (const [lon, lat, rx, ry] of abundantZones) {
    paintRadialSpot(ctx, w, h, lon, lat, rx, ry, 'rgba(34, 211, 238, 0.62)', 'rgba(52, 211, 153, 0)');
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildFreshwaterOverlay(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  paintRadialSpot(ctx, w, h, 83, 31, 48, 20, 'rgba(224, 242, 254, 0.85)', 'rgba(186, 230, 253, 0)');
  paintRadialSpot(ctx, w, h, -42, 72, 62, 45, 'rgba(224, 242, 254, 0.78)', 'rgba(186, 230, 253, 0)');
  ctx.fillStyle = 'rgba(224, 242, 254, 0.52)';
  ctx.fillRect(0, h * 0.86, w, h * 0.14);

  ctx.strokeStyle = 'rgba(34, 211, 238, 0.95)';
  ctx.lineWidth = 4.0;
  ctx.shadowColor = '#22d3ee';
  ctx.shadowBlur = 8;
  for (const river of MAJOR_RIVERS) {
    ctx.beginPath();
    river.forEach(([lon, lat], i) => {
      const x = lonToX(lon, w);
      const y = latToY(lat, h);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.shadowBlur = 0;

  paintRadialSpot(ctx, w, h, -85, 45.8, 22, 14, 'rgba(34, 211, 238, 0.9)', 'rgba(34, 211, 238, 0)');
  paintRadialSpot(ctx, w, h, 108, 53.5, 16, 20, 'rgba(34, 211, 238, 0.9)', 'rgba(34, 211, 238, 0)');
  paintRadialSpot(ctx, w, h, 76.2, 10.5, 16, 18, 'rgba(52, 211, 153, 0.85)', 'rgba(52, 211, 153, 0)');

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildSaltwaterOverlay(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(14, 165, 233, 0.36)';
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = 'destination-out';
  for (const poly of CONTINENT_POLYGONS) {
    tracePoly(ctx, poly.coords, w, h);
    ctx.fillStyle = 'rgba(0,0,0,0.94)';
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';

  ctx.strokeStyle = 'rgba(125, 211, 252, 0.75)';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([10, 8]);
  const currents: [number, number][][] = [
    [[-75, 26], [-55, 38], [-25, 48], [-10, 56]],
    [[52, 0], [64, 8], [75, 11]],
    [[140, 20], [165, 35], [-150, 38], [-125, 25]],
  ];
  for (const c of currents) {
    ctx.beginPath();
    c.forEach(([lon, lat], i) => {
      const x = lonToX(lon, w);
      const y = latToY(lat, h);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.setLineDash([]);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}

function buildGroundwaterOverlay(maxAnisotropy: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);

  const aquifers: [number, number, number, number, string][] = [
    [79, 27, 45, 20, 'rgba(245, 158, 11, 0.78)'],
    [76.2, 10.5, 15, 18, 'rgba(45, 212, 191, 0.85)'],
    [-101, 38, 28, 32, 'rgba(245, 158, 11, 0.72)'],
    [-56, -24, 34, 34, 'rgba(45, 212, 191, 0.75)'],
    [22, 22, 48, 30, 'rgba(56, 189, 248, 0.65)'],
    [116, 36, 26, 22, 'rgba(245, 158, 11, 0.72)'],
    [138, -24, 36, 28, 'rgba(45, 212, 191, 0.68)'],
  ];

  for (const [lon, lat, rx, ry, col] of aquifers) {
    paintRadialSpot(ctx, w, h, lon, lat, rx, ry, col, 'rgba(45, 212, 191, 0)');
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  return tex;
}
