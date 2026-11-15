import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import {
  CONTAMINATION_SCENARIOS,
  UNDERGROUND_ENTITIES,
} from '../data/undergroundData';
import { computeUndergroundMetrics, isWellDry } from '../services/simulationEngine';
import { useAppState } from '../state/appStore';
import { createUndergroundTextureBundle } from '../utils/undergroundTextures';
import { applyGestureOrbitToCamera, raycastAtViewportNorm } from '../utils/gestureSpatial';

const _v1 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _proj = new THREE.Vector3();

// Map geological depth (0 - 44 m) to scene Y coordinate (0 to -12.8)
function depthToY(depthM: number): number {
  return -(depthM / 44) * 12.8;
}

function detectSoftwareGl(): boolean {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

interface HoverMeta {
  id: string;
  name: string;
  subtitle: string;
  worldPos: THREE.Vector3;
}

export const UndergroundScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { state, dispatch, focusUndergroundEntity } = useAppState();

  const stateRef = useRef(state);
  stateRef.current = state;
  const focusUgRef = useRef(focusUndergroundEntity);
  focusUgRef.current = focusUndergroundEntity;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const [hovered, setHovered] = useState<{
    name: string;
    subtitle: string;
    x: number;
    y: number;
  } | null>(null);
  const [webglLost, setWebglLost] = useState(false);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const isSoftwareGl = detectSoftwareGl();
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#040a14');
    scene.fog = new THREE.FogExp2('#040a14', 0.011);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 180);
    camera.position.set(17, 6.5, 22);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const onContextRestored = () => setWebglLost(false);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff4e6, 2.0);
    keyLight.position.set(18, 22, 16);
    scene.add(keyLight);

    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x0b1a2e, 0.95);
    scene.add(hemi);

    const subSurfaceGlow = new THREE.PointLight(0x22d3ee, 2.2, 34);
    subSurfaceGlow.position.set(0, -6.5, 9);
    scene.add(subSurfaceGlow);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.minDistance = 8;
    controls.maxDistance = 45;
    controls.maxPolarAngle = Math.PI * 0.72;
    controls.target.set(0, -4.5, 0);

    const textures = createUndergroundTextureBundle(renderer.capabilities.getMaxAnisotropy());
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    const clickableMeshes: THREE.Object3D[] = [];
    const layerHighlightMeshes = new Map<string, THREE.Mesh>();

    const BLOCK_W = 24;
    const BLOCK_D = 15;

    // 1. Geological Strata Cutaway Slabs (Depth 0 m -> 44 m)
    const strataSpecs: {
      id: string;
      topM: number;
      botM: number;
      tex: THREE.CanvasTexture;
      opacity: number;
      emissive?: number;
      emissiveIntensity?: number;
    }[] = [
      { id: 'layer-topsoil', topM: 0, botM: 3.0, tex: textures.topsoil, opacity: 0.92 },
      { id: 'layer-sand', topM: 3.0, botM: 9.0, tex: textures.sand, opacity: 0.86 },
      {
        id: 'layer-gravel',
        topM: 9.0,
        botM: 18.0,
        tex: textures.gravel,
        opacity: 0.78,
        emissive: 0x0369a1,
        emissiveIntensity: 0.25,
      },
      { id: 'layer-clay', topM: 18.0, botM: 23.0, tex: textures.clay, opacity: 0.94 },
      {
        id: 'layer-confined-aquifer',
        topM: 23.0,
        botM: 34.0,
        tex: textures.sandstone,
        opacity: 0.82,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.38,
      },
      { id: 'layer-bedrock', topM: 34.0, botM: 44.0, tex: textures.bedrock, opacity: 0.98 },
    ];

    for (const s of strataSpecs) {
      const yTop = depthToY(s.topM);
      const yBot = depthToY(s.botM);
      const h = Math.abs(yTop - yBot) - 0.03;
      const yMid = (yTop + yBot) * 0.5;

      const geo = track(new THREE.BoxGeometry(BLOCK_W, h, BLOCK_D));
      const mat = track(
        new THREE.MeshStandardMaterial({
          map: s.tex,
          roughness: 0.78,
          metalness: 0.08,
          transparent: s.opacity < 0.95,
          opacity: s.opacity,
          emissive: s.emissive ?? 0x000000,
          emissiveIntensity: s.emissiveIntensity ?? 0,
        })
      );
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(0, yMid, 0);
      mesh.layers.enable(1);

      const ent = UNDERGROUND_ENTITIES.find((e) => e.id === s.id);
      if (ent) {
        mesh.userData.hoverMeta = {
          id: ent.id,
          name: ent.name,
          subtitle: `Depth ${ent.depthRangeM} · Click to inspect`,
          worldPos: new THREE.Vector3(0, yMid, BLOCK_D * 0.5 + 0.3),
        } as HoverMeta;
        clickableMeshes.push(mesh);
      }
      scene.add(mesh);

      // Subtle wireframe outline for selected stratum highlight
      const edgesGeo = track(new THREE.EdgesGeometry(geo));
      const highlightMesh = new THREE.Mesh(
        track(new THREE.BoxGeometry(BLOCK_W + 0.14, h + 0.06, BLOCK_D + 0.14)),
        track(
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            wireframe: true,
            transparent: true,
            opacity: 0.85,
          })
        )
      );
      highlightMesh.position.copy(mesh.position);
      highlightMesh.visible = false;
      scene.add(highlightMesh);
      layerHighlightMeshes.set(s.id, highlightMesh);

      // Clean subtle border edge line
      const edgeLines = new THREE.LineSegments(
        edgesGeo,
        track(
          new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.15,
          })
        )
      );
      edgeLines.position.copy(mesh.position);
      scene.add(edgeLines);
    }

    // 2. Above-Ground Smart City Surface Footprint (showing connection to Phase 2 City!)
    const surfaceGroup = new THREE.Group();
    const surfacePad = new THREE.Mesh(
      track(new THREE.BoxGeometry(BLOCK_W, 0.16, BLOCK_D)),
      track(new THREE.MeshStandardMaterial({ color: 0x0f2d2c, roughness: 0.85 }))
    );
    surfacePad.position.set(0, 0.08, 0);
    surfacePad.layers.enable(1);
    surfacePad.userData.hoverMeta = {
      id: 'layer-surface',
      name: 'Urban Surface & Recharge Footprint',
      subtitle: '0.0 m · Smart City Surface',
      worldPos: new THREE.Vector3(0, 0.4, 0),
    } as HoverMeta;
    clickableMeshes.push(surfacePad);
    surfaceGroup.add(surfacePad);

    // Emerald River channel on surface
    const riverStrip = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.2, 0.08, BLOCK_D)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x0ea5e9,
          emissive: 0x0284c7,
          emissiveIntensity: 0.45,
          roughness: 0.15,
        })
      )
    );
    riverStrip.position.set(4.5, 0.15, 0);
    surfaceGroup.add(riverStrip);

    // Surface Recharge Basin (connected to Phase 2 Eco-Canopy Rainwater Hub)
    const rechargeBasin = new THREE.Mesh(
      track(new THREE.BoxGeometry(4.4, 0.12, 3.6)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x14b8a6,
          emissive: 0x0d9488,
          emissiveIntensity: 0.35,
          roughness: 0.5,
        })
      )
    );
    rechargeBasin.position.set(-8.2, 0.14, -2.5);
    surfaceGroup.add(rechargeBasin);

    // Translucent Smart City Buildings sitting above their respective wells
    const citySilhouetteMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.38,
        roughness: 0.2,
        metalness: 0.3,
      })
    );
    // Veridian Residences above shallow well
    const westResSil = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 1.5, 2.4)), citySilhouetteMat);
    westResSil.position.set(-5.6, 0.9, 3.2);
    surfaceGroup.add(westResSil);

    // AquaSpire Tower above central deep borewell
    const centralTowerSil = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.2, 3.8, 2.2)),
      citySilhouetteMat
    );
    centralTowerSil.position.set(0.4, 2.05, -0.8);
    surfaceGroup.add(centralTowerSil);

    // Harborview Apartments above east borewell
    const eastResSil = new THREE.Mesh(track(new THREE.BoxGeometry(3.0, 2.1, 2.4)), citySilhouetteMat);
    eastResSil.position.set(7.6, 1.2, -1.6);
    surfaceGroup.add(eastResSil);

    scene.add(surfaceGroup);

    // 3. Dynamic Water Table Plane (Moves up/down with waterTableDepthM)
    const waterTableMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(BLOCK_W + 0.12, 0.14, BLOCK_D + 0.12)),
      track(
        new THREE.MeshStandardMaterial({
          color: 0x22d3ee,
          emissive: 0x06b6d4,
          emissiveIntensity: 1.0,
          transparent: true,
          opacity: 0.62,
          roughness: 0.1,
        })
      )
    );
    waterTableMesh.layers.enable(1);
    waterTableMesh.userData.hoverMeta = {
      id: 'water-table-plane',
      name: 'Dynamic Water Table',
      subtitle: 'Phreatic Surface · Click to inspect',
      worldPos: new THREE.Vector3(-4, depthToY(10.5), BLOCK_D * 0.5),
    } as HoverMeta;
    clickableMeshes.push(waterTableMesh);
    scene.add(waterTableMesh);

    // 4. Subsurface Underground Reservoir Vault (Karst Pocket in Deep Aquifer)
    const vaultGeo = track(new THREE.SphereGeometry(2.2, 24, 16));
    vaultGeo.scale(1.8, 0.55, 1.2);
    const vaultMesh = new THREE.Mesh(
      vaultGeo,
      track(
        new THREE.MeshPhysicalMaterial({
          color: 0x06b6d4,
          emissive: 0x0284c7,
          emissiveIntensity: 0.85,
          transparent: true,
          opacity: 0.72,
          roughness: 0.12,
        })
      )
    );
    vaultMesh.position.set(-4.8, depthToY(28.5), 1.5);
    vaultMesh.layers.enable(1);
    vaultMesh.userData.hoverMeta = {
      id: 'underground-reservoir',
      name: 'Subsurface Aquifer Vault',
      subtitle: '25 – 33 m · Zero-evaporation storage',
      worldPos: new THREE.Vector3(-4.8, depthToY(28.5), 2.5),
    } as HoverMeta;
    clickableMeshes.push(vaultMesh);
    scene.add(vaultMesh);

    // 5. Buried Smart City Pipeline (Connected to Phase 2 city.leak state!)
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-11, -0.55, -2.5),
      new THREE.Vector3(-5.6, -0.55, 1.0),
      new THREE.Vector3(0.4, -0.55, -0.8),
      new THREE.Vector3(7.6, -0.55, -1.6),
    ]);
    const pipeMesh = new THREE.Mesh(
      track(new THREE.TubeGeometry(pipeCurve, 44, 0.2, 10, false)),
      track(
        new THREE.MeshPhysicalMaterial({
          color: 0x38bdf8,
          emissive: 0x0284c7,
          emissiveIntensity: 0.45,
          transparent: true,
          opacity: 0.78,
        })
      )
    );
    pipeMesh.layers.enable(1);
    pipeMesh.userData.hoverMeta = {
      id: 'pipe-distribution',
      name: 'Buried Municipal Water Pipeline',
      subtitle: '1.5 – 2.2 m depth · Linked to Smart City',
      worldPos: new THREE.Vector3(0.4, -0.55, -0.8),
    } as HoverMeta;
    clickableMeshes.push(pipeMesh);
    scene.add(pipeMesh);

    // Underground Pipeline Leak Burst Plume (visible when state.city.leak.active === true)
    const ugLeakGroup = new THREE.Group();
    ugLeakGroup.position.set(1.2, -0.55, -0.9);
    ugLeakGroup.visible = false;
    const ugLeakPlume = new THREE.Mesh(
      track(new THREE.SphereGeometry(1.15, 16, 12)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.48,
          wireframe: true,
        })
      )
    );
    ugLeakGroup.add(ugLeakPlume);
    const ugLeakCore = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.55, 16, 12)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.85,
        })
      )
    );
    ugLeakGroup.add(ugLeakCore);
    scene.add(ugLeakGroup);

    // 6. Interactive 3D Wells & Borewells
    interface WellVisuals {
      id: string;
      shaftWater: THREE.Mesh;
      statusRing: THREE.Mesh;
      pumpingParticles: THREE.Points;
      particleOffsets: Float32Array;
      depthM: number;
      wellType: 'shallow' | 'borewell';
    }
    const wellVisualsList: WellVisuals[] = [];

    const steelMat = track(
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.75, roughness: 0.25 })
    );
    const stoneMat = track(
      new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.85, metalness: 0.1 })
    );

    for (const w of stateRef.current.underground.wells) {
      const wg = new THREE.Group();
      wg.position.set(w.position[0], 0, w.position[1]);

      const depthY = Math.abs(depthToY(w.depthM));
      const radius = w.wellType === 'shallow' ? 0.52 : 0.26;

      // Surface well collar / pump head
      const collar = new THREE.Mesh(
        track(new THREE.CylinderGeometry(radius * 1.4, radius * 1.5, 0.45, 18)),
        w.wellType === 'shallow' ? stoneMat : steelMat
      );
      collar.position.y = 0.25;
      wg.add(collar);

      // Translucent casing shaft extending down into target aquifer
      const casing = new THREE.Mesh(
        track(new THREE.CylinderGeometry(radius, radius, depthY, 18, 1, true)),
        track(
          new THREE.MeshPhysicalMaterial({
            color: 0xcbd5e1,
            transparent: true,
            opacity: 0.35,
            roughness: 0.15,
            depthWrite: false,
            side: THREE.DoubleSide,
          })
        )
      );
      casing.position.y = -depthY * 0.5;
      wg.add(casing);

      // Inner water column
      const shaftWater = new THREE.Mesh(
        track(new THREE.CylinderGeometry(radius * 0.78, radius * 0.78, depthY, 16)),
        track(
          new THREE.MeshBasicMaterial({
            color: 0x22d3ee,
            transparent: true,
            opacity: 0.72,
          })
        )
      );
      shaftWater.position.y = -depthY * 0.5;
      wg.add(shaftWater);

      // Status ring at surface (cyan active / slate paused / amber dry)
      const statusRing = new THREE.Mesh(
        track(new THREE.TorusGeometry(radius * 1.75, 0.07, 8, 24)),
        track(new THREE.MeshBasicMaterial({ color: 0x22d3ee }))
      );
      statusRing.rotation.x = Math.PI / 2;
      statusRing.position.y = 0.22;
      wg.add(statusRing);

      // Rising pumping particles inside shaft
      const pCount = 18;
      const pPos = new Float32Array(pCount * 3);
      const pOff = new Float32Array(pCount);
      for (let i = 0; i < pCount; i++) {
        pOff[i] = i / pCount;
        pPos[i * 3] = (Math.random() - 0.5) * radius * 0.6;
        pPos[i * 3 + 1] = -depthY * pOff[i];
        pPos[i * 3 + 2] = (Math.random() - 0.5) * radius * 0.6;
      }
      const pGeo = track(new THREE.BufferGeometry());
      pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
      const pPts = new THREE.Points(
        pGeo,
        track(new THREE.PointsMaterial({ color: 0xa5f3fc, size: 0.16 }))
      );
      wg.add(pPts);

      // Click hit proxy
      const hitCyl = new THREE.Mesh(
        track(new THREE.CylinderGeometry(radius * 2.2, radius * 2.2, depthY + 1.0, 10)),
        track(new THREE.MeshBasicMaterial({ visible: false }))
      );
      hitCyl.position.y = -depthY * 0.45;
      hitCyl.layers.set(1);
      hitCyl.userData.hoverMeta = {
        id: w.id,
        name: w.name,
        subtitle: `${w.depthM} m ${w.wellType === 'shallow' ? 'Shallow Well' : 'Deep Borewell'}`,
        worldPos: new THREE.Vector3(w.position[0], 0.8, w.position[1]),
      } as HoverMeta;
      wg.add(hitCyl);
      clickableMeshes.push(hitCyl);

      scene.add(wg);
      wellVisualsList.push({
        id: w.id,
        shaftWater,
        statusRing,
        pumpingParticles: pPts,
        particleOffsets: pOff,
        depthM: w.depthM,
        wellType: w.wellType,
      });
    }

    // 7. Animated Hydrogeological Particle Systems
    // A. Rainfall & Infiltration Drops (Percolating from sky -> topsoil -> sand -> water table)
    const rainDropCount = 160;
    const rainPos = new Float32Array(rainDropCount * 3);
    const rainPhase = new Float32Array(rainDropCount);
    for (let i = 0; i < rainDropCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * (BLOCK_W - 2);
      rainPos[i * 3 + 1] = Math.random() * 8 - 2;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * (BLOCK_D - 2);
      rainPhase[i] = Math.random();
    }
    const rainGeo = track(new THREE.BufferGeometry());
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = track(
      new THREE.PointsMaterial({
        color: 0x7dd3fc,
        size: 0.16,
        transparent: true,
        opacity: 0.8,
      })
    );
    const rainPoints = new THREE.Points(rainGeo, rainMat);
    scene.add(rainPoints);

    // B. Horizontal Groundwater Flow Particles (Unconfined Gravel + Confined Sandstone)
    const flowCount = 140;
    const flowPos = new Float32Array(flowCount * 3);
    const flowAquifer = new Uint8Array(flowCount); // 0 = unconfined, 1 = confined
    for (let i = 0; i < flowCount; i++) {
      flowAquifer[i] = i < 80 ? 0 : 1;
      flowPos[i * 3] = (Math.random() - 0.5) * (BLOCK_W - 1.5);
      flowPos[i * 3 + 1] = i < 80 ? depthToY(12 + Math.random() * 5) : depthToY(24 + Math.random() * 9);
      flowPos[i * 3 + 2] = (Math.random() - 0.5) * (BLOCK_D - 1.5);
    }
    const flowGeo = track(new THREE.BufferGeometry());
    flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
    const flowPoints = new THREE.Points(
      flowGeo,
      track(
        new THREE.PointsMaterial({
          color: 0x22d3ee,
          size: 0.18,
          transparent: true,
          opacity: 0.88,
        })
      )
    );
    scene.add(flowPoints);

    // C. Illustrative Contamination Plume Particles
    const contCount = 90;
    const contPos = new Float32Array(contCount * 3);
    for (let i = 0; i < contCount; i++) {
      contPos[i * 3] = -6 + Math.random() * 2;
      contPos[i * 3 + 1] = -Math.random() * 4;
      contPos[i * 3 + 2] = (Math.random() - 0.5) * 3;
    }
    const contGeo = track(new THREE.BufferGeometry());
    contGeo.setAttribute('position', new THREE.BufferAttribute(contPos, 3));
    const contMat = track(
      new THREE.PointsMaterial({
        color: 0xeab308,
        size: 0.22,
        transparent: true,
        opacity: 0.9,
      })
    );
    const contPoints = new THREE.Points(contGeo, contMat);
    contPoints.visible = false;
    scene.add(contPoints);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const pointer = new THREE.Vector2();
    let downPos = { x: 0, y: 0 };
    let lastHover = 0;

    const setPointer = (cx: number, cy: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((cx - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((cy - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      downPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) return;
      setPointer(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const meta = hits[0].object.userData.hoverMeta as HoverMeta | undefined;
        if (meta) {
          focusUgRef.current(meta.id);
        }
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
      setPointer(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const meta = hits[0].object.userData.hoverMeta as HoverMeta | undefined;
        if (meta) {
          renderer.domElement.style.cursor = 'pointer';
          _proj.copy(meta.worldPos).project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          setHovered({
            name: meta.name,
            subtitle: meta.subtitle,
            x: ((_proj.x + 1) / 2) * rect.width,
            y: ((-_proj.y + 1) / 2) * rect.height,
          });
          return;
        }
      }
      renderer.domElement.style.cursor = 'grab';
      setHovered(null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const cameraFlight = {
      active: false,
      camPos: new THREE.Vector3(17, 6.5, 22),
      targetPos: new THREE.Vector3(0, -4.5, 0),
      lastFlyVersion: -1,
      lastZoomVersion: -1,
    };

    controls.addEventListener('start', () => {
      cameraFlight.active = false;
    });

    controls.addEventListener('end', () => {
      const dist = camera.position.distanceTo(controls.target);
      const zoomPct = Math.round(THREE.MathUtils.clamp(((45 - dist) / (45 - 8)) * 100, 0, 100));
      dispatchRef.current({
        type: 'SYNC_CAMERA_TELEMETRY',
        activeCameraId: 'underground-cutaway-cam',
        position: [
          Number(camera.position.x.toFixed(2)),
          Number(camera.position.y.toFixed(2)),
          Number(camera.position.z.toFixed(2)),
        ],
        rotation: [
          Number(camera.rotation.x.toFixed(2)),
          Number(camera.rotation.y.toFixed(2)),
          Number(camera.rotation.z.toFixed(2)),
        ],
        zoomLevelPct: zoomPct,
      });
    });

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let frameId = 0;
    let disposed = false;
    let simTimer = 0;
    let lastOrbitVersion = stateRef.current.gesture.orbitStep.version;
    let lastGesturePointTrigger = stateRef.current.gesture.pointerCursor.triggerCount;
    let lastGestureHoverCheck = 0;
    let lastGestureHoverLabel: string | null = null;
    const clock = new THREE.Clock();
    let tabHidden = typeof document !== 'undefined' && document.hidden;
    const onVisibilityChange = () => {
      tabHidden = document.hidden;
      if (!tabHidden) {
        clock.getDelta();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (disposed) return;
      if (tabHidden) {
        frameId = window.setTimeout(tick, 450);
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const ug = stateRef.current.underground;
      const city = stateRef.current.city;
      const simParams = stateRef.current.simulationParams;
      const isSimRunning = simParams.running && ug.simulationSpeed > 0;
      const simDt = isSimRunning ? dt * Math.max(0.5, ug.simulationSpeed || simParams.speed || 1) : 0;
      const selectedId = stateRef.current.selectedObject?.id ?? null;
      const metrics = computeUndergroundMetrics(ug, city);

      // Tick continuous groundwater balance every ~0.35s when running
      if (isSimRunning) {
        simTimer += dt;
        if (simTimer >= 0.35) {
          dispatchRef.current({ type: 'TICK_UNDERGROUND', dt: simTimer });
          simTimer = 0;
        }
      }

      // Highlight selected stratum wireframe
      layerHighlightMeshes.forEach((hlMesh, id) => {
        hlMesh.visible = id === selectedId;
      });

      // Smoothly move Water Table plane to current waterTableDepthM
      const targetTableY = depthToY(ug.waterTableDepthM);
      waterTableMesh.position.y = THREE.MathUtils.damp(
        waterTableMesh.position.y,
        targetTableY,
        6,
        dt
      );
      (waterTableMesh.userData.hoverMeta as HoverMeta).worldPos.y = waterTableMesh.position.y;

      // Update Underground Pipeline Leak Visual (shared with Smart City!)
      ugLeakGroup.visible = city.leak.active;
      if (city.leak.active && simDt > 0) {
        ugLeakPlume.rotation.y += simDt * 1.4;
        const pulse = 1 + Math.sin(elapsed * 4) * 0.12;
        ugLeakCore.scale.setScalar(pulse);
      }

      // Update Wells & Borewells
      for (const wv of wellVisualsList) {
        const wState = ug.wells.find((w) => w.id === wv.id);
        const isDry = isWellDry(wv, ug.waterTableDepthM);
        const isPumping = Boolean(wState?.active && !isDry);

        // Update inner water column height relative to water table
        const colMat = wv.shaftWater.material as THREE.MeshBasicMaterial;
        const ringMat = wv.statusRing.material as THREE.MeshBasicMaterial;
        if (isDry) {
          wv.shaftWater.visible = false;
          ringMat.color.setHex(0xf59e0b);
        } else {
          wv.shaftWater.visible = true;
          colMat.opacity = isPumping ? 0.85 : 0.45;
          ringMat.color.setHex(
            selectedId === wv.id ? 0xffffff : isPumping ? 0x22d3ee : 0x64748b
          );
        }

        // Animate upward extraction droplets when pumping
        wv.pumpingParticles.visible = isPumping;
        if (isPumping && simDt > 0) {
          const pAttr = wv.pumpingParticles.geometry.getAttribute('position') as THREE.BufferAttribute;
          const depthY = Math.abs(depthToY(wv.depthM));
          const speed = ((wState?.extractionLph ?? 60000) / 100000) * 1.8;
          for (let i = 0; i < wv.particleOffsets.length; i++) {
            let y = pAttr.getY(i) + speed * simDt;
            if (y > 0.25) y = -depthY;
            pAttr.setY(i, y);
          }
          pAttr.needsUpdate = true;
        }
      }

      // Animate Rainfall & Subsurface Percolation
      const rainFactor = Math.max(0.08, city.rainfallIntensity / 60);
      rainPoints.visible = city.rainfallIntensity > 2;
      rainMat.opacity = Math.min(0.85, 0.22 + (city.rainfallIntensity / 120) * 0.65);
      if (rainPoints.visible && simDt > 0) {
        const rainAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
        const maxInfilY = depthToY(ug.soilPermeability === 'low' ? 16 : 19);
        for (let i = 0; i < rainDropCount; i++) {
          let y = rainAttr.getY(i);
          const speed = y > 0 ? 5.5 * rainFactor : 2.2 * metrics.permeabilityFactor * rainFactor;
          y -= speed * simDt;
          if (y < Math.max(maxInfilY, waterTableMesh.position.y)) {
            y = 5.5 + Math.random() * 2.5;
            rainAttr.setX(i, (Math.random() - 0.5) * (BLOCK_W - 2));
          }
          rainAttr.setY(i, y);
        }
        rainAttr.needsUpdate = true;
      }

      // Animate Horizontal Groundwater Flow in Aquifers
      if (simDt > 0) {
        const flowAttr = flowGeo.getAttribute('position') as THREE.BufferAttribute;
        const flowSpeed = 0.8 + Math.abs(metrics.netBalanceMLd) * 0.12;
        for (let i = 0; i < flowCount; i++) {
          let x = flowAttr.getX(i) + flowSpeed * (flowAquifer[i] === 0 ? 1.1 : 0.65) * simDt;
          if (x > BLOCK_W * 0.5 - 0.6) x = -BLOCK_W * 0.5 + 0.6;
          flowAttr.setX(i, x);
          if (flowAquifer[i] === 0) {
            const minY = depthToY(17.5);
            const maxY = Math.min(depthToY(9.2), waterTableMesh.position.y - 0.2);
            let y = flowAttr.getY(i);
            if (y > maxY || y < minY) {
              y = minY + Math.random() * Math.max(0.15, maxY - minY);
              flowAttr.setY(i, y);
            }
          }
        }
        flowAttr.needsUpdate = true;
      }

      // Animate Contamination Plume (blocked above clay layer at 18 m!)
      contPoints.visible = ug.contamination.active;
      if (ug.contamination.active) {
        const scenario = CONTAMINATION_SCENARIOS[ug.contamination.sourceType];
        contMat.color.set(scenario.colorHex);
        if (simDt > 0) {
          const cAttr = contGeo.getAttribute('position') as THREE.BufferAttribute;
          const clayCeilingY = depthToY(17.5);
          for (let i = 0; i < contCount; i++) {
            let x = cAttr.getX(i);
            let y = cAttr.getY(i);
            if (y > waterTableMesh.position.y) {
              y -= 1.2 * metrics.permeabilityFactor * simDt;
            } else {
              x += 0.95 * simDt;
              y = Math.max(clayCeilingY, y - 0.18 * simDt);
            }
            if (x > 6.5 || y <= clayCeilingY) {
              x = -6.8 + (Math.random() - 0.5) * 1.6;
              y = -0.1;
              cAttr.setZ(i, (Math.random() - 0.5) * 3.2);
            }
            cAttr.setX(i, x);
            cAttr.setY(i, y);
          }
          cAttr.needsUpdate = true;
        }
      }

      // Camera Preset Flights & Zoom
      if (ug.undergroundCameraFlyVersion !== cameraFlight.lastFlyVersion) {
        cameraFlight.lastFlyVersion = ug.undergroundCameraFlyVersion;
        if (ug.undergroundCameraPreset === 'overview') {
          cameraFlight.camPos.set(17, 6.5, 22);
          cameraFlight.targetPos.set(0, -4.5, 0);
        } else {
          const well = ug.wells.find((w) => w.id === ug.undergroundCameraPreset);
          if (well) {
            const wy = depthToY(well.depthM * 0.45);
            cameraFlight.targetPos.set(well.position[0], wy, well.position[1]);
            cameraFlight.camPos.set(well.position[0] + 8, wy + 4.5, well.position[1] + 10);
          } else {
            const ent = UNDERGROUND_ENTITIES.find((e) => e.id === ug.undergroundCameraPreset);
            if (ent) {
              cameraFlight.targetPos.set(0, ent.yCenter, 0);
              cameraFlight.camPos.set(
                ent.cameraOffset[0],
                ent.cameraOffset[1],
                ent.cameraOffset[2]
              );
            }
          }
        }
        cameraFlight.active = true;
      }

      if (ug.undergroundZoomVersion !== cameraFlight.lastZoomVersion) {
        cameraFlight.lastZoomVersion = ug.undergroundZoomVersion;
        _v1.copy(camera.position).sub(controls.target);
        const curLen = _v1.length();
        const nextLen = THREE.MathUtils.clamp(curLen + ug.undergroundZoomDelta, 8, 45);
        _v1.normalize().multiplyScalar(nextLen);
        cameraFlight.camPos.copy(controls.target).add(_v1);
        cameraFlight.targetPos.copy(controls.target);
        cameraFlight.active = true;
      }

      if (cameraFlight.active) {
        const alpha = 1 - Math.exp(-5.0 * dt);
        camera.position.lerp(cameraFlight.camPos, alpha);
        controls.target.lerp(cameraFlight.targetPos, alpha);
        if (
          camera.position.distanceTo(cameraFlight.camPos) < 0.06 &&
          controls.target.distanceTo(cameraFlight.targetPos) < 0.04
        ) {
          cameraFlight.active = false;
        }
      }

      controls.autoRotate = ug.undergroundAutoRotate && !cameraFlight.active;
      controls.autoRotateSpeed = 0.65;

      // Gesture Camera Orbit (Hand Movement)
      const gestureState = stateRef.current.gesture;
      if (gestureState.orbitStep.version !== lastOrbitVersion) {
        lastOrbitVersion = gestureState.orbitStep.version;
        cameraFlight.active = false;
        applyGestureOrbitToCamera(
          camera,
          controls.target,
          gestureState.orbitStep.yawDelta,
          gestureState.orbitStep.pitchDelta,
          0.26,
          Math.PI / 1.55
        );
      }

      // Gesture Pointing Hover & Dwell Click Raycasting
      if (gestureState.pointerCursor.active) {
        const nowMs = performance.now();
        if (gestureState.pointerCursor.triggerCount !== lastGesturePointTrigger) {
          lastGesturePointTrigger = gestureState.pointerCursor.triggerCount;
          const hits = raycastAtViewportNorm(
            gestureState.pointerCursor.x,
            gestureState.pointerCursor.y,
            renderer.domElement,
            camera,
            raycaster,
            clickableMeshes
          );
          if (hits.length > 0) {
            const meta = hits[0].object.userData.hoverMeta as HoverMeta | undefined;
            if (meta) {
              focusUgRef.current(meta.id, 'gesture');
            }
          }
        } else if (nowMs - lastGestureHoverCheck > 85) {
          lastGestureHoverCheck = nowMs;
          const hits = raycastAtViewportNorm(
            gestureState.pointerCursor.x,
            gestureState.pointerCursor.y,
            renderer.domElement,
            camera,
            raycaster,
            clickableMeshes
          );
          const nextLabel =
            hits.length > 0
              ? ((hits[0].object.userData.hoverMeta as HoverMeta | undefined)?.name ?? null)
              : null;
          if (nextLabel !== lastGestureHoverLabel) {
            lastGestureHoverLabel = nextLabel;
            dispatchRef.current({
              type: 'SET_GESTURE_POINTER',
              x: gestureState.pointerCursor.x,
              y: gestureState.pointerCursor.y,
              active: true,
              hoveredLabel: nextLabel,
            });
          }
        }
      } else if (lastGestureHoverLabel !== null) {
        lastGestureHoverLabel = null;
      }

      controls.update();
      renderer.render(scene, camera);

      if (isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    }

    if (isSoftwareGl) afterDraw(tick);
    else frameId = requestAnimationFrame(tick);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      controls.dispose();
      textures.dispose();
      envRT.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#040a14]">
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Underground Water World"
      />

      {hovered && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-2"
          style={{ left: hovered.x, top: hovered.y }}
        >
          <div className="rounded-lg border border-cyan-400/35 bg-[#061121]/95 px-3 py-1.5 shadow-lg">
            <div className="text-xs font-semibold text-white whitespace-nowrap">{hovered.name}</div>
            <div className="text-[11px] text-cyan-300/90 whitespace-nowrap">
              {hovered.subtitle}
            </div>
          </div>
        </div>
      )}

      {webglLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#040a14]/95 p-6 text-center">
          <div className="max-w-md rounded-xl border border-cyan-500/30 bg-[#08162b] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              3D Graphics Context Paused
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              WebGL rendering was temporarily interrupted. Restoring the Underground Water World.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
