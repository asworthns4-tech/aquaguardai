import * as THREE from 'three';

export interface CityTextureBundle {
  glassFacade: THREE.CanvasTexture;
  glassEmissive: THREE.CanvasTexture;
  residentialFacade: THREE.CanvasTexture;
  solarPanel: THREE.CanvasTexture;
  roadMap: THREE.CanvasTexture;
  dispose: () => void;
}

export function createCityTextureBundle(maxAnisotropy: number): CityTextureBundle {
  // 1. Futuristic Skyscraper Glass Curtain Wall + Window Lights
  const gCanvas = document.createElement('canvas');
  gCanvas.width = 512;
  gCanvas.height = 512;
  const gCtx = gCanvas.getContext('2d')!;

  const eCanvas = document.createElement('canvas');
  eCanvas.width = 512;
  eCanvas.height = 512;
  const eCtx = eCanvas.getContext('2d')!;

  gCtx.fillStyle = '#0d2238';
  gCtx.fillRect(0, 0, 512, 512);
  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, 512, 512);

  const cols = 12;
  const rows = 24;
  const cw = 512 / cols;
  const rh = 512 / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = c * cw + 3;
      const y = r * rh + 3;
      const w = cw - 6;
      const h = rh - 5;
      const seed = Math.sin(r * 37.1 + c * 91.7) * 43758.54;
      const frac = seed - Math.floor(seed);

      gCtx.fillStyle = frac > 0.4 ? '#15446b' : '#10314f';
      gCtx.fillRect(x, y, w, h);

      if (frac > 0.58) {
        eCtx.fillStyle = frac > 0.85 ? '#67e8f9' : '#1e6e8c';
        eCtx.fillRect(x, y, w, h);
      }
    }
  }

  // Horizontal structural floor mullions
  gCtx.fillStyle = '#1e3a52';
  for (let r = 0; r < rows; r++) {
    gCtx.fillRect(0, r * rh, 512, 3);
  }

  const glassFacade = new THREE.CanvasTexture(gCanvas);
  glassFacade.colorSpace = THREE.SRGBColorSpace;
  glassFacade.wrapS = THREE.RepeatWrapping;
  glassFacade.wrapT = THREE.RepeatWrapping;
  glassFacade.anisotropy = maxAnisotropy;

  const glassEmissive = new THREE.CanvasTexture(eCanvas);
  glassEmissive.colorSpace = THREE.SRGBColorSpace;
  glassEmissive.wrapS = THREE.RepeatWrapping;
  glassEmissive.wrapT = THREE.RepeatWrapping;
  glassEmissive.anisotropy = maxAnisotropy;

  // 2. Eco-Residential Facade (Warm neutral concrete + balconies + lit windows)
  const rCanvas = document.createElement('canvas');
  rCanvas.width = 512;
  rCanvas.height = 512;
  const rCtx = rCanvas.getContext('2d')!;
  rCtx.fillStyle = '#243447';
  rCtx.fillRect(0, 0, 512, 512);

  for (let row = 0; row < 12; row++) {
    const y = row * (512 / 12);
    rCtx.fillStyle = '#334861';
    rCtx.fillRect(0, y, 512, 6);
    for (let col = 0; col < 8; col++) {
      const x = col * 64 + 10;
      const seed = Math.sin(row * 19.3 + col * 53.1) * 9123.4;
      const lit = seed - Math.floor(seed) > 0.45;
      rCtx.fillStyle = lit ? '#7dd3fc' : '#122233';
      rCtx.fillRect(x, y + 10, 44, 24);
    }
  }
  const residentialFacade = new THREE.CanvasTexture(rCanvas);
  residentialFacade.colorSpace = THREE.SRGBColorSpace;
  residentialFacade.anisotropy = maxAnisotropy;

  // 3. Solar Photovoltaic Panel Texture
  const sCanvas = document.createElement('canvas');
  sCanvas.width = 256;
  sCanvas.height = 256;
  const sCtx = sCanvas.getContext('2d')!;
  sCtx.fillStyle = '#081b3a';
  sCtx.fillRect(0, 0, 256, 256);
  sCtx.strokeStyle = '#38bdf8';
  sCtx.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    sCtx.beginPath();
    sCtx.moveTo(i, 0);
    sCtx.lineTo(i, 256);
    sCtx.stroke();
    sCtx.beginPath();
    sCtx.moveTo(0, i);
    sCtx.lineTo(256, i);
    sCtx.stroke();
  }
  const solarPanel = new THREE.CanvasTexture(sCanvas);
  solarPanel.colorSpace = THREE.SRGBColorSpace;
  solarPanel.anisotropy = maxAnisotropy;

  // 4. Smart City Road Asphalt & Lane Markings
  const roadCanvas = document.createElement('canvas');
  roadCanvas.width = 256;
  roadCanvas.height = 256;
  const rdCtx = roadCanvas.getContext('2d')!;
  rdCtx.fillStyle = '#131d2c';
  rdCtx.fillRect(0, 0, 256, 256);
  rdCtx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
  rdCtx.lineWidth = 4;
  rdCtx.setLineDash([22, 18]);
  rdCtx.beginPath();
  rdCtx.moveTo(128, 0);
  rdCtx.lineTo(128, 256);
  rdCtx.stroke();
  rdCtx.setLineDash([]);
  const roadMap = new THREE.CanvasTexture(roadCanvas);
  roadMap.colorSpace = THREE.SRGBColorSpace;
  roadMap.wrapS = THREE.RepeatWrapping;
  roadMap.wrapT = THREE.RepeatWrapping;
  roadMap.anisotropy = maxAnisotropy;

  return {
    glassFacade,
    glassEmissive,
    residentialFacade,
    solarPanel,
    roadMap,
    dispose: () => {
      glassFacade.dispose();
      glassEmissive.dispose();
      residentialFacade.dispose();
      solarPanel.dispose();
      roadMap.dispose();
    },
  };
}
