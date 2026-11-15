import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { LAB_EXPERIMENTS_BY_ID, LabExperimentId } from '../data/labExperimentsData';
import {
  computeDesalinationLabModel,
  computeFiltrationLabModel,
  computePipelineLeakLabModel,
  computeRainwaterLabModel,
  computeSmartCityMgmtModel,
  computeSupplyDemandLabModel,
  computeWaterCycleModel,
} from '../services/labSimulationEngine';
import { resolveRegisteredObject, toSelectedObjectInfo } from '../services/objectRegistry';
import { computeUndergroundMetrics } from '../services/simulationEngine';
import { useAppState } from '../state/appStore';
import { applyGestureOrbitToCamera, raycastAtViewportNorm } from '../utils/gestureSpatial';
import { createLabTextureBundle } from '../utils/labTextures';

const _v1 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _proj = new THREE.Vector3();

function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2') || c.getContext('webgl');
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

interface LabHoverMeta {
  id: string;
  name: string;
  subtitle: string;
  worldPos: THREE.Vector3;
}

export const ScienceLabScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useAppState();
  const stateRef = useRef(state);
  stateRef.current = state;
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
    scene.fog = new THREE.FogExp2('#040a14', 0.015);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.2, 140);
    camera.position.set(8.2, 4.8, 9.4);

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

    // Calibrated 3-point warm/cool lab lighting
    const keyLight = new THREE.DirectionalLight(0xfff4e8, 1.9);
    keyLight.position.set(10, 14, 11);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x7dd3fc, 0.95);
    fillLight.position.set(-10, 7, -8);
    scene.add(fillLight);

    const hemi = new THREE.HemisphereLight(0x93c5fd, 0x091628, 0.75);
    scene.add(hemi);

    const benchSpot = new THREE.PointLight(0x22d3ee, 2.2, 22);
    benchSpot.position.set(0, 5.2, 3.2);
    scene.add(benchSpot);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.minDistance = 4.8;
    controls.maxDistance = 18.5;
    controls.minPolarAngle = 0.25;
    controls.maxPolarAngle = Math.PI * 0.48;
    controls.target.set(0, 1.4, 0);

    const textures = createLabTextureBundle(renderer.capabilities.getMaxAnisotropy());
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // Shared materials
    const alloyDarkMat = track(
      new THREE.MeshStandardMaterial({ color: 0x162235, metalness: 0.75, roughness: 0.32 })
    );
    const alloyLightMat = track(
      new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.25 })
    );
    const glassMat = track(
      new THREE.MeshPhysicalMaterial({
        color: 0xbfe9ff,
        transparent: true,
        opacity: 0.24,
        roughness: 0.08,
        metalness: 0.05,
        depthWrite: false,
      })
    );
    const cyanGlowMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x22d3ee,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
        roughness: 0.2,
      })
    );
    const waterClearMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        emissive: 0x0284c7,
        emissiveIntensity: 0.35,
        transparent: true,
        opacity: 0.78,
        roughness: 0.14,
      })
    );
    const highlightRingMat = track(
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
      })
    );

    // -------------------------------------------------------------------------
    // SHARED FUTURISTIC LAB ENVIRONMENT ARCHITECTURE
    // -------------------------------------------------------------------------
    const labShell = new THREE.Group();
    const deckFloor = new THREE.Mesh(
      track(new THREE.CylinderGeometry(14, 14.5, 0.4, 48)),
      track(
        new THREE.MeshStandardMaterial({
          map: textures.deckGrid,
          roughness: 0.45,
          metalness: 0.35,
        })
      )
    );
    deckFloor.position.y = -0.22;
    labShell.add(deckFloor);

    // Central optical test pedestal
    const pedestalBase = new THREE.Mesh(
      track(new THREE.CylinderGeometry(4.4, 4.75, 0.36, 40)),
      alloyDarkMat
    );
    pedestalBase.position.y = 0.16;
    labShell.add(pedestalBase);

    const pedestalRim = new THREE.Mesh(
      track(new THREE.TorusGeometry(4.45, 0.045, 12, 64)),
      cyanGlowMat
    );
    pedestalRim.rotation.x = Math.PI / 2;
    pedestalRim.position.y = 0.35;
    labShell.add(pedestalRim);

    // Overhead futuristic telemetry gantry arches
    for (let i = 0; i < 2; i++) {
      const arch = new THREE.Mesh(
        track(new THREE.TorusGeometry(8.6, 0.08, 12, 64, Math.PI)),
        alloyDarkMat
      );
      arch.rotation.y = (i * Math.PI) / 2 + Math.PI / 4;
      arch.position.y = 0;
      labShell.add(arch);
    }

    // Perimeter glass safety panels (low & clean so sightlines never clip)
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const post = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.06, 0.08, 1.1, 10)),
        alloyLightMat
      );
      post.position.set(Math.cos(angle) * 9.5, 0.55, Math.sin(angle) * 9.5);
      labShell.add(post);
    }
    scene.add(labShell);

    // Selection highlight ring beneath selected sub-equipment
    const selectionRing = new THREE.Mesh(
      track(new THREE.RingGeometry(0.55, 0.72, 32)),
      highlightRingMat
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.38;
    selectionRing.visible = false;
    scene.add(selectionRing);

    // Track clickable equipment per experiment
    const stationGroups = new Map<LabExperimentId, THREE.Group>();
    const stationClickables = new Map<LabExperimentId, THREE.Object3D[]>();

    const registerEquipment = (
      expId: LabExperimentId,
      mesh: THREE.Object3D,
      nodeId: string
    ) => {
      const meta = LAB_EXPERIMENTS_BY_ID[expId].equipmentNodes.find((n) => n.id === nodeId);
      if (!meta) return;
      mesh.layers.enable(1);
      const box = new THREE.Box3().setFromObject(mesh);
      const center = new THREE.Vector3();
      box.getCenter(center);
      mesh.userData.hoverMeta = {
        id: meta.id,
        name: meta.name,
        subtitle: `${meta.role} · Click to inspect`,
        worldPos: center.clone().add(new THREE.Vector3(0, 0.6, 0)),
      } as LabHoverMeta;
      const arr = stationClickables.get(expId) ?? [];
      arr.push(mesh);
      stationClickables.set(expId, arr);
    };

    // Helper: create a tank cylinder with dynamic water inner mesh
    const createGlassTank = (r: number, h: number, x: number, y: number, z: number, waterColor = 0x0ea5e9) => {
      const wrap = new THREE.Group();
      wrap.position.set(x, y, z);
      const capBot = new THREE.Mesh(track(new THREE.CylinderGeometry(r + 0.05, r + 0.07, 0.1, 28)), alloyDarkMat);
      capBot.position.y = 0.05;
      wrap.add(capBot);
      const shell = new THREE.Mesh(track(new THREE.CylinderGeometry(r, r, h, 28)), glassMat);
      shell.position.y = h * 0.5 + 0.1;
      wrap.add(shell);
      const capTop = new THREE.Mesh(track(new THREE.TorusGeometry(r, 0.035, 10, 28)), alloyLightMat);
      capTop.rotation.x = Math.PI / 2;
      capTop.position.y = h + 0.1;
      wrap.add(capTop);

      const fillGeo = track(new THREE.CylinderGeometry(r * 0.92, r * 0.92, h * 0.92, 24));
      fillGeo.translate(0, (h * 0.92) / 2, 0);
      const fillMat = track(
        new THREE.MeshStandardMaterial({
          color: waterColor,
          emissive: waterColor,
          emissiveIntensity: 0.28,
          transparent: true,
          opacity: 0.78,
          roughness: 0.15,
        })
      );
      const fill = new THREE.Mesh(fillGeo, fillMat);
      fill.position.y = 0.11;
      wrap.add(fill);
      return { wrap, fill, fillMat, hit: shell };
    };

    // =========================================================================
    // STATION 01: WATER CYCLE CHAMBER
    // =========================================================================
    const wcGroup = new THREE.Group();
    const wcOcean = new THREE.Mesh(track(new THREE.BoxGeometry(3.4, 0.48, 3.6)), waterClearMat);
    wcOcean.position.set(-1.35, 0.6, 0);
    wcGroup.add(wcOcean);
    const wcOceanFrame = new THREE.Mesh(track(new THREE.BoxGeometry(3.55, 0.25, 3.75)), alloyDarkMat);
    wcOceanFrame.position.set(-1.35, 0.46, 0);
    wcGroup.add(wcOceanFrame);
    registerEquipment('water-cycle', wcOcean, 'wc-ocean-basin');

    // Solar lamp assembly
    const wcSun = new THREE.Group();
    wcSun.position.set(-2.3, 3.55, -0.8);
    const sunOrb = new THREE.Mesh(
      track(new THREE.SphereGeometry(0.38, 24, 24)),
      track(new THREE.MeshStandardMaterial({ color: 0xfde047, emissive: 0xf59e0b, emissiveIntensity: 1.5 }))
    );
    wcSun.add(sunOrb);
    const sunRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.54, 0.03, 10, 32)), alloyLightMat);
    wcSun.add(sunRing);
    wcGroup.add(wcSun);
    registerEquipment('water-cycle', sunOrb, 'wc-solar-emitter');

    // Condenser cloud cluster
    const wcClouds = new THREE.Group();
    wcClouds.position.set(0.35, 3.35, 0);
    const cloudMat = track(
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, emissive: 0x38bdf8, emissiveIntensity: 0.18, roughness: 0.85 })
    );
    const cloudOffsets: [number, number, number, number][] = [
      [-0.7, 0, 0, 0.52],
      [0, 0.16, 0.1, 0.66],
      [0.75, 0.04, -0.05, 0.54],
      [0.25, -0.08, 0.35, 0.48],
    ];
    for (const [cx, cy, cz, cr] of cloudOffsets) {
      const puff = new THREE.Mesh(track(new THREE.SphereGeometry(cr, 18, 18)), cloudMat);
      puff.position.set(cx, cy, cz);
      wcClouds.add(puff);
    }
    wcGroup.add(wcClouds);
    registerEquipment('water-cycle', wcClouds, 'wc-condenser-cloud');

    // Land mountain + strata catchment
    const wcLand = new THREE.Group();
    wcLand.position.set(1.65, 0.35, 0);
    const landSub = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.6, 0.9, 3.5)),
      track(new THREE.MeshStandardMaterial({ map: textures.strataSide, roughness: 0.78 }))
    );
    landSub.position.y = 0.45;
    wcLand.add(landSub);
    const mountain = new THREE.Mesh(
      track(new THREE.ConeGeometry(1.45, 1.45, 6)),
      track(new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.85 }))
    );
    mountain.position.set(0.2, 1.62, -0.35);
    wcLand.add(mountain);
    // River return flow chute back into ocean
    const riverChute = new THREE.Mesh(
      track(new THREE.BoxGeometry(1.75, 0.08, 0.45)),
      waterClearMat
    );
    riverChute.position.set(-1.1, 0.92, 0.45);
    riverChute.rotation.z = 0.18;
    wcLand.add(riverChute);
    wcGroup.add(wcLand);
    registerEquipment('water-cycle', landSub, 'wc-catchment-slope');

    // Vapor & raindrop InstancedMesh pools
    const wcVaporCount = 36;
    const wcVaporMesh = new THREE.InstancedMesh(
      track(new THREE.SphereGeometry(0.065, 8, 8)),
      track(new THREE.MeshBasicMaterial({ color: 0xbae6fd, transparent: true, opacity: 0.72 })),
      wcVaporCount
    );
    wcGroup.add(wcVaporMesh);

    const wcRainCount = 48;
    const wcRainMesh = new THREE.InstancedMesh(
      track(new THREE.CylinderGeometry(0.022, 0.022, 0.24, 6)),
      track(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.82 })),
      wcRainCount
    );
    wcGroup.add(wcRainMesh);
    scene.add(wcGroup);
    stationGroups.set('water-cycle', wcGroup);

    // =========================================================================
    // STATION 02: RAINWATER HARVESTING RIG
    // =========================================================================
    const rhGroup = new THREE.Group();
    // Eco house body + sloped roof
    const houseBody = new THREE.Mesh(
      track(new THREE.BoxGeometry(2.3, 1.45, 2.2)),
      track(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65 }))
    );
    houseBody.position.set(-1.45, 1.08, 0);
    rhGroup.add(houseBody);

    const roofGeo = track(new THREE.BoxGeometry(2.6, 0.14, 2.45));
    const roofMesh = new THREE.Mesh(
      roofGeo,
      track(new THREE.MeshStandardMaterial({ color: 0x0f766e, metalness: 0.5, roughness: 0.35 }))
    );
    roofMesh.position.set(-1.4, 2.02, 0);
    roofMesh.rotation.z = -0.26;
    rhGroup.add(roofMesh);
    registerEquipment('rainwater-harvesting', roofMesh, 'rh-roof-catchment');

    // Gutter & vertical downpipe
    const gutter = new THREE.Mesh(track(new THREE.BoxGeometry(0.18, 0.14, 2.45)), alloyLightMat);
    gutter.position.set(-0.2, 1.66, 0);
    rhGroup.add(gutter);

    const firstFlushCol = createGlassTank(0.24, 1.1, 0.22, 0.35, -0.55, 0xd97706);
    rhGroup.add(firstFlushCol.wrap);
    registerEquipment('rainwater-harvesting', firstFlushCol.hit, 'rh-first-flush');

    const filterVessel = createGlassTank(0.42, 1.35, 0.78, 0.35, 0.25, 0x34d399);
    rhGroup.add(filterVessel.wrap);
    registerEquipment('rainwater-harvesting', filterVessel.hit, 'rh-filter-vessel');

    const rhStorageTank = createGlassTank(0.75, 2.0, 2.0, 0.35, 0, 0x22d3ee);
    rhGroup.add(rhStorageTank.wrap);
    registerEquipment('rainwater-harvesting', rhStorageTank.hit, 'rh-storage-tank');

    // Connecting pipe roof -> filter -> storage
    const rhPipe1 = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 2.25, 12)), alloyLightMat);
    rhPipe1.rotation.z = Math.PI / 2;
    rhPipe1.position.set(0.92, 1.66, 0.1);
    rhGroup.add(rhPipe1);

    // Groundwater recharge pit on right
    const rechargePit = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.65, 0.55, 0.28, 24)),
      track(new THREE.MeshStandardMaterial({ color: 0x14b8a6, emissive: 0x0d9488, emissiveIntensity: 0.45 }))
    );
    rechargePit.position.set(2.95, 0.48, 0.85);
    rhGroup.add(rechargePit);
    registerEquipment('rainwater-harvesting', rechargePit, 'rh-recharge-pit');

    const rhRainPool = new THREE.InstancedMesh(
      track(new THREE.CylinderGeometry(0.022, 0.022, 0.22, 6)),
      track(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.82 })),
      40
    );
    rhGroup.add(rhRainPool);
    scene.add(rhGroup);
    stationGroups.set('rainwater-harvesting', rhGroup);

    // =========================================================================
    // STATION 03: GROUNDWATER DEPLETION COLUMN
    // =========================================================================
    const gdGroup = new THREE.Group();
    const strataColumn = new THREE.Mesh(
      track(new THREE.BoxGeometry(4.4, 2.45, 2.8)),
      track(new THREE.MeshStandardMaterial({ map: textures.strataSide, transparent: true, opacity: 0.86, roughness: 0.72 }))
    );
    strataColumn.position.set(0, 1.58, 0);
    gdGroup.add(strataColumn);
    registerEquipment('groundwater-depletion', strataColumn, 'gd-strata-column');

    const columnFrame = new THREE.Mesh(track(new THREE.BoxGeometry(4.5, 2.52, 2.9)), glassMat);
    columnFrame.position.copy(strataColumn.position);
    gdGroup.add(columnFrame);

    // Dynamic phreatic water table plane & glowing fill
    const gdWaterGeo = track(new THREE.BoxGeometry(4.32, 1.6, 2.72));
    gdWaterGeo.translate(0, 0.8, 0);
    const gdWaterVolume = new THREE.Mesh(gdWaterGeo, waterClearMat);
    gdWaterVolume.position.set(0, 0.38, 0);
    gdGroup.add(gdWaterVolume);

    const gdWaterPlane = new THREE.Mesh(
      track(new THREE.BoxGeometry(4.42, 0.06, 2.82)),
      cyanGlowMat
    );
    gdWaterPlane.position.set(0, 1.9, 0);
    gdGroup.add(gdWaterPlane);
    registerEquipment('groundwater-depletion', gdWaterPlane, 'gd-water-table');

    // Shallow open well (left) & Deep borewell rig (right)
    const gdShallowWell = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.24, 0.24, 1.5, 18)),
      track(new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 }))
    );
    gdShallowWell.position.set(-1.25, 2.22, 0.4);
    gdGroup.add(gdShallowWell);
    registerEquipment('groundwater-depletion', gdShallowWell, 'gd-shallow-well');

    const gdDeepWell = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.18, 0.18, 2.55, 18)),
      track(new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.55, roughness: 0.3 }))
    );
    gdDeepWell.position.set(1.2, 1.72, -0.35);
    gdGroup.add(gdDeepWell);
    registerEquipment('groundwater-depletion', gdDeepWell, 'gd-deep-borewell');

    const gdInfilParticles = new THREE.InstancedMesh(
      track(new THREE.SphereGeometry(0.05, 8, 8)),
      track(new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.85 })),
      32
    );
    gdGroup.add(gdInfilParticles);
    scene.add(gdGroup);
    stationGroups.set('groundwater-depletion', gdGroup);

    // =========================================================================
    // STATION 04: PIPELINE LEAKAGE TEST RIG
    // =========================================================================
    const plGroup = new THREE.Group();
    const pumpHeader = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.55, 0.65, 1.4, 24)),
      alloyDarkMat
    );
    pumpHeader.position.set(-2.4, 1.05, 0);
    plGroup.add(pumpHeader);
    registerEquipment('pipeline-leakage', pumpHeader, 'pl-pump-header');

    // Main horizontal trunk pipe
    const mainPipe = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.18, 0.18, 5.2, 20)),
      alloyLightMat
    );
    mainPipe.rotation.z = Math.PI / 2;
    mainPipe.position.set(0.2, 1.25, 0);
    plGroup.add(mainPipe);
    registerEquipment('pipeline-leakage', mainPipe, 'pl-leak-manifold');

    // Ultrasonic flow meter with pressure dial
    const meterDial = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 24)),
      track(new THREE.MeshStandardMaterial({ map: textures.gaugeDial }))
    );
    meterDial.rotation.x = Math.PI / 2;
    meterDial.position.set(-1.2, 1.82, 0.15);
    plGroup.add(meterDial);
    registerEquipment('pipeline-leakage', meterDial, 'pl-smart-meter');

    // Leak collar lights
    const leakCollars: THREE.Mesh[] = [];
    const leakMat = track(
      new THREE.MeshStandardMaterial({ color: 0xfb923c, emissive: 0xea580c, emissiveIntensity: 1.0 })
    );
    for (let i = 0; i < 3; i++) {
      const collar = new THREE.Mesh(track(new THREE.TorusGeometry(0.22, 0.045, 10, 24)), leakMat);
      collar.rotation.y = Math.PI / 2;
      collar.position.set(-0.3 + i * 1.15, 1.25, 0);
      plGroup.add(collar);
      leakCollars.push(collar);
    }

    // Downstream consumer mini-buildings
    const bldgStatusMats: THREE.MeshStandardMaterial[] = [];
    const bldgGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const stMat = track(
        new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0284c7, emissiveIntensity: 0.45 })
      );
      bldgStatusMats.push(stMat);
      const b = new THREE.Mesh(track(new THREE.BoxGeometry(0.7, 1.0 + i * 0.35, 0.7)), alloyDarkMat);
      b.position.set(1.2 + i * 0.9, 0.85 + (i * 0.35) / 2, 1.35);
      bldgGroup.add(b);
      const cap = new THREE.Mesh(track(new THREE.BoxGeometry(0.74, 0.1, 0.74)), stMat);
      cap.position.set(b.position.x, b.position.y + (1.0 + i * 0.35) * 0.5 + 0.05, 1.35);
      bldgGroup.add(cap);
    }
    plGroup.add(bldgGroup);
    registerEquipment('pipeline-leakage', bldgGroup, 'pl-building-branches');

    const leakSprayMesh = new THREE.InstancedMesh(
      track(new THREE.SphereGeometry(0.055, 8, 8)),
      track(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.88 })),
      60
    );
    plGroup.add(leakSprayMesh);
    scene.add(plGroup);
    stationGroups.set('pipeline-leakage', plGroup);

    // =========================================================================
    // STATION 05: WATER FILTRATION BENCH
    // =========================================================================
    const wfGroup = new THREE.Group();
    const sedTank = createGlassTank(0.65, 1.85, -2.25, 0.35, 0, 0x92400e);
    wfGroup.add(sedTank.wrap);
    registerEquipment('water-filtration', sedTank.hit, 'wf-sediment-tank');

    // Multi-media main column (gravel bottom, sand middle, activated carbon top)
    const mediaShell = new THREE.Mesh(track(new THREE.CylinderGeometry(0.68, 0.68, 2.55, 28)), glassMat);
    mediaShell.position.set(-0.2, 1.65, 0);
    wfGroup.add(mediaShell);

    const gravelLayer = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.62, 0.62, 0.65, 24)),
      track(new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.92 }))
    );
    gravelLayer.position.set(-0.2, 0.72, 0);
    wfGroup.add(gravelLayer);
    registerEquipment('water-filtration', gravelLayer, 'wf-gravel-bed');

    const sandLayer = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.62, 0.62, 0.7, 24)),
      track(new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.88 }))
    );
    sandLayer.position.set(-0.2, 1.42, 0);
    wfGroup.add(sandLayer);
    registerEquipment('water-filtration', sandLayer, 'wf-sand-bed');

    const carbonLayer = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.62, 0.62, 0.65, 24)),
      track(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.6 }))
    );
    carbonLayer.position.set(-0.2, 2.12, 0);
    wfGroup.add(carbonLayer);
    registerEquipment('water-filtration', carbonLayer, 'wf-carbon-bed');

    const wfCleanTank = createGlassTank(0.68, 1.9, 1.95, 0.35, 0, 0x22d3ee);
    wfGroup.add(wfCleanTank.wrap);
    registerEquipment('water-filtration', wfCleanTank.hit, 'wf-clean-receiver');

    const wfTransferPipe = new THREE.Mesh(track(new THREE.CylinderGeometry(0.06, 0.06, 4.3, 12)), alloyLightMat);
    wfTransferPipe.rotation.z = Math.PI / 2;
    wfTransferPipe.position.set(-0.15, 2.35, 0);
    wfGroup.add(wfTransferPipe);

    const wfParticles = new THREE.InstancedMesh(
      track(new THREE.SphereGeometry(0.05, 8, 8)),
      track(new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.85 })),
      36
    );
    wfGroup.add(wfParticles);
    scene.add(wfGroup);
    stationGroups.set('water-filtration', wfGroup);

    // =========================================================================
    // STATION 06: REVERSE OSMOSIS DESALINATION PLANT
    // =========================================================================
    const roGroup = new THREE.Group();
    const roIntakeTank = createGlassTank(0.65, 1.65, -2.5, 0.35, 0, 0x0369a1);
    roGroup.add(roIntakeTank.wrap);
    registerEquipment('desalination', roIntakeTank.hit, 'ro-intake-pretreat');

    const roPump = new THREE.Group();
    roPump.position.set(-1.2, 1.05, 0.3);
    const roPumpBody = new THREE.Mesh(track(new THREE.CylinderGeometry(0.38, 0.42, 0.9, 20)), alloyLightMat);
    roPumpBody.rotation.z = Math.PI / 2;
    roPump.add(roPumpBody);
    const roImpeller = new THREE.Mesh(
      track(new THREE.BoxGeometry(0.12, 0.56, 0.56)),
      cyanGlowMat
    );
    roImpeller.position.x = 0.48;
    roPump.add(roImpeller);
    roGroup.add(roPump);
    registerEquipment('desalination', roPumpBody, 'ro-hp-pump');

    // Dual parallel RO spiral-wound pressure vessels
    const roVessels = new THREE.Group();
    const vesselMat = track(
      new THREE.MeshStandardMaterial({ map: textures.roMembrane, metalness: 0.35, roughness: 0.28 })
    );
    for (let i = 0; i < 2; i++) {
      const v = new THREE.Mesh(track(new THREE.CylinderGeometry(0.28, 0.28, 2.3, 24)), vesselMat);
      v.rotation.z = Math.PI / 2;
      v.position.set(0.35, 1.55 + i * 0.72, 0);
      roVessels.add(v);
    }
    roGroup.add(roVessels);
    registerEquipment('desalination', roVessels, 'ro-membrane-vessels');

    const roFreshTank = createGlassTank(0.65, 1.9, 2.35, 0.35, -0.7, 0x22d3ee);
    roGroup.add(roFreshTank.wrap);
    registerEquipment('desalination', roFreshTank.hit, 'ro-fresh-tank');

    const roBrineTank = createGlassTank(0.55, 1.4, 2.35, 0.35, 0.9, 0xf59e0b);
    roGroup.add(roBrineTank.wrap);
    registerEquipment('desalination', roBrineTank.hit, 'ro-brine-outfall');

    const roFlowParticles = new THREE.InstancedMesh(
      track(new THREE.SphereGeometry(0.05, 8, 8)),
      track(new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })),
      36
    );
    roGroup.add(roFlowParticles);
    scene.add(roGroup);
    stationGroups.set('desalination', roGroup);

    // =========================================================================
    // STATION 07: WATER SUPPLY & DEMAND BALANCE
    // =========================================================================
    const sdGroup = new THREE.Group();
    const sdReservoir = createGlassTank(0.95, 2.3, -2.0, 0.35, 0, 0x0ea5e9);
    sdGroup.add(sdReservoir.wrap);
    registerEquipment('supply-demand', sdReservoir.hit, 'sd-reservoir-tower');

    const sdDistHub = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.65, 0.75, 0.85, 6)),
      alloyDarkMat
    );
    sdDistHub.position.set(-0.25, 0.78, 0);
    sdGroup.add(sdDistHub);
    registerEquipment('supply-demand', sdDistHub, 'sd-treatment-core');

    // 3 volumetric Sector Towers (Domestic, Industrial, Commercial)
    const sdSectorsGroup = new THREE.Group();
    const sectorBars: THREE.Mesh[] = [];
    const sectorColors = [0x38bdf8, 0xa78bfa, 0x34d399];
    for (let i = 0; i < 3; i++) {
      const geo = track(new THREE.BoxGeometry(0.68, 1.0, 0.68));
      geo.translate(0, 0.5, 0);
      const bar = new THREE.Mesh(
        geo,
        track(
          new THREE.MeshStandardMaterial({
            color: sectorColors[i],
            emissive: sectorColors[i],
            emissiveIntensity: 0.32,
            roughness: 0.28,
          })
        )
      );
      bar.position.set(1.25 + (i % 2) * 1.15, 0.38, -0.75 + Math.floor(i / 2) * 1.45);
      sdSectorsGroup.add(bar);
      sectorBars.push(bar);
    }
    sdGroup.add(sdSectorsGroup);
    registerEquipment('supply-demand', sdSectorsGroup, 'sd-sector-towers');
    scene.add(sdGroup);
    stationGroups.set('supply-demand', sdGroup);

    // =========================================================================
    // STATION 08: SMART CITY INTEGRATED MANAGEMENT DIGITAL TWIN
    // =========================================================================
    const scGroup = new THREE.Group();
    const scHoloTable = new THREE.Mesh(
      track(new THREE.CylinderGeometry(2.6, 2.8, 0.35, 32)),
      alloyDarkMat
    );
    scHoloTable.position.y = 0.52;
    scGroup.add(scHoloTable);
    registerEquipment('smart-city-management', scHoloTable, 'sc-command-core');

    const scMeterRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(2.35, 0.055, 10, 48)),
      cyanGlowMat
    );
    scMeterRing.rotation.x = Math.PI / 2;
    scMeterRing.position.y = 0.72;
    scGroup.add(scMeterRing);
    registerEquipment('smart-city-management', scMeterRing, 'sc-smart-meter-ring');

    // Miniature city blocks & recycling loop inside the table
    for (let i = 0; i < 5; i++) {
      const ang = (i / 5) * Math.PI * 2;
      const tower = new THREE.Mesh(
        track(new THREE.BoxGeometry(0.38, 0.6 + (i % 3) * 0.42, 0.38)),
        alloyLightMat
      );
      tower.position.set(Math.cos(ang) * 1.15, 0.7 + (0.6 + (i % 3) * 0.42) * 0.5, Math.sin(ang) * 1.15);
      scGroup.add(tower);
    }

    const scPurpleLoop = new THREE.Mesh(
      track(new THREE.TorusGeometry(1.55, 0.06, 12, 48)),
      track(new THREE.MeshStandardMaterial({ color: 0xa855f7, emissive: 0x9333ea, emissiveIntensity: 0.75 }))
    );
    scPurpleLoop.rotation.x = Math.PI / 2;
    scPurpleLoop.position.y = 0.76;
    scGroup.add(scPurpleLoop);
    registerEquipment('smart-city-management', scPurpleLoop, 'sc-recycling-loop');

    const scAquiferLink = new THREE.Mesh(
      track(new THREE.CylinderGeometry(1.1, 1.1, 0.24, 28)),
      waterClearMat
    );
    scAquiferLink.position.y = 0.22;
    scGroup.add(scAquiferLink);
    registerEquipment('smart-city-management', scAquiferLink, 'sc-aquifer-link');

    const scParticles = new THREE.InstancedMesh(
      track(new THREE.SphereGeometry(0.055, 8, 8)),
      track(new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.9 })),
      32
    );
    scGroup.add(scParticles);
    scene.add(scGroup);
    stationGroups.set('smart-city-management', scGroup);

    // -------------------------------------------------------------------------
    // CAMERA FLY-TO & INTERACTION HANDLERS
    // -------------------------------------------------------------------------
    let lastFlyVersion = stateRef.current.lab.labCameraFlyVersion;
    let lastZoomVersion = stateRef.current.lab.labZoomVersion;
    let lastOrbitVersion = stateRef.current.gesture.orbitStep.version;
    let lastPointCount = stateRef.current.gesture.pointerCursor.triggerCount;
    let lastExpId: LabExperimentId = stateRef.current.lab.activeExperiment;

    let animFly: {
      active: boolean;
      target: THREE.Vector3;
      camPos: THREE.Vector3;
    } = { active: false, target: new THREE.Vector3(), camPos: new THREE.Vector3() };

    const raycaster = new THREE.Raycaster();
    raycaster.layers.enable(1);
    const pointerNdc = new THREE.Vector2();
    let pointerDownPos: { x: number; y: number } | null = null;

    const getActiveTargets = () => stationClickables.get(stateRef.current.lab.activeExperiment) ?? [];

    const selectEquipmentHit = (hitObj: THREE.Object3D) => {
      let cur: THREE.Object3D | null = hitObj;
      while (cur && !cur.userData?.hoverMeta) cur = cur.parent;
      const meta = cur?.userData?.hoverMeta as LabHoverMeta | undefined;
      if (!meta || !cur) return;
      const reg = resolveRegisteredObject(meta.id, 'lab');
      dispatchRef.current({
        type: 'SELECT_OBJECT',
        object: reg
          ? toSelectedObjectInfo(reg)
          : { id: meta.id, type: 'lab-equipment', name: meta.name },
      });
      const box = new THREE.Box3().setFromObject(cur);
      const center = new THREE.Vector3();
      box.getCenter(center);
      selectionRing.position.set(center.x, 0.39, center.z);
      selectionRing.visible = true;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(getActiveTargets(), true);
      if (hits.length > 0) {
        let cur: THREE.Object3D | null = hits[0].object;
        while (cur && !cur.userData?.hoverMeta) cur = cur.parent;
        const meta = cur?.userData?.hoverMeta as LabHoverMeta | undefined;
        if (meta) {
          _proj.copy(meta.worldPos).project(camera);
          setHovered({
            name: meta.name,
            subtitle: meta.subtitle,
            x: ((_proj.x + 1) / 2) * rect.width,
            y: ((-_proj.y + 1) / 2) * rect.height,
          });
          renderer.domElement.style.cursor = 'pointer';
          return;
        }
      }
      setHovered(null);
      renderer.domElement.style.cursor = 'grab';
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!pointerDownPos) return;
      const moved = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      pointerDownPos = null;
      if (moved > 6) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointerNdc, camera);
      const hits = raycaster.intersectObjects(getActiveTargets(), true);
      if (hits.length > 0) {
        selectEquipmentHit(hits[0].object);
      }
    };

    renderer.domElement.addEventListener('pointermove', onPointerMove);
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // -------------------------------------------------------------------------
    // RENDER & ANIMATION LOOP (Only Active Experiment Animated & Ticked!)
    // -------------------------------------------------------------------------
    let disposed = false;
    let rafId = 0;
    let timeoutId = 0;
    let lastTime = performance.now();
    let tickAccum = 0;
    let tabHidden = typeof document !== 'undefined' && document.hidden;
    const onVisibilityChange = () => {
      tabHidden = document.hidden;
      if (!tabHidden) {
        lastTime = performance.now();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    const afterDraw = (cb: () => void) => {
      if (!isSoftwareGl) {
        rafId = requestAnimationFrame(cb);
        return;
      }
      const gl = renderer.getContext();
      const sync = (gl as WebGL2RenderingContext).fenceSync?.(
        (gl as WebGL2RenderingContext).SYNC_GPU_COMMANDS_COMPLETE,
        0
      );
      if (!sync) {
        timeoutId = window.setTimeout(cb, 80);
        return;
      }
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = (gl as WebGL2RenderingContext).clientWaitSync(sync, 0, 0);
        if (status === (gl as WebGL2RenderingContext).TIMEOUT_EXPIRED) {
          timeoutId = window.setTimeout(poll, 16);
        } else {
          (gl as WebGL2RenderingContext).deleteSync(sync);
          timeoutId = window.setTimeout(cb, 80);
        }
      };
      poll();
    };

    const tick = () => {
      if (disposed) return;
      if (tabHidden) {
        lastTime = performance.now();
        timeoutId = window.setTimeout(tick, 450);
        return;
      }
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      const t = now * 0.001;
      const st = stateRef.current;
      const activeId = st.lab.activeExperiment;
      const speedMult = st.simulationParams.running ? st.simulationParams.speed : 0;

      // Dispatch state accumulation ticks cleanly at ~4 Hz
      tickAccum += dt;
      if (tickAccum >= 0.25 && speedMult > 0) {
        dispatchRef.current({ type: 'TICK_LAB_EXPERIMENT', dt: tickAccum });
        tickAccum = 0;
      }

      // Toggle only the active 3D experiment rig
      if (activeId !== lastExpId) {
        lastExpId = activeId;
        selectionRing.visible = false;
        setHovered(null);
      }
      stationGroups.forEach((grp, id) => {
        grp.visible = id === activeId;
      });
      if (!st.selectedObject) {
        selectionRing.visible = false;
      }

      // Camera resets & fly-to transitions
      if (st.lab.labCameraFlyVersion !== lastFlyVersion) {
        lastFlyVersion = st.lab.labCameraFlyVersion;
        const meta = LAB_EXPERIMENTS_BY_ID[activeId];
        animFly = {
          active: true,
          target: new THREE.Vector3(...meta.cameraTarget),
          camPos: new THREE.Vector3(
            meta.cameraTarget[0] + meta.cameraOffset[0],
            meta.cameraTarget[1] + meta.cameraOffset[1],
            meta.cameraTarget[2] + meta.cameraOffset[2]
          ),
        };
      }
      if (animFly.active) {
        controls.target.lerp(animFly.target, 0.14);
        camera.position.lerp(animFly.camPos, 0.14);
        if (camera.position.distanceTo(animFly.camPos) < 0.08) {
          animFly.active = false;
        }
      }

      if (st.lab.labZoomVersion !== lastZoomVersion) {
        lastZoomVersion = st.lab.labZoomVersion;
        _v1.copy(camera.position).sub(controls.target);
        const nextLen = THREE.MathUtils.clamp(
          _v1.length() + st.lab.labZoomDelta,
          controls.minDistance,
          controls.maxDistance
        );
        _v1.setLength(nextLen);
        camera.position.copy(controls.target).add(_v1);
      }

      if (st.gesture.orbitStep.version !== lastOrbitVersion) {
        lastOrbitVersion = st.gesture.orbitStep.version;
        applyGestureOrbitToCamera(
          camera,
          controls.target,
          st.gesture.orbitStep.yawDelta,
          st.gesture.orbitStep.pitchDelta,
          controls.minPolarAngle,
          controls.maxPolarAngle
        );
      }

      if (st.gesture.pointerCursor.triggerCount !== lastPointCount) {
        lastPointCount = st.gesture.pointerCursor.triggerCount;
        const hits = raycastAtViewportNorm(
          st.gesture.pointerCursor.x,
          st.gesture.pointerCursor.y,
          renderer.domElement,
          camera,
          raycaster,
          getActiveTargets()
        );
        if (hits.length > 0) selectEquipmentHit(hits[0].object);
      }

      controls.autoRotate = st.lab.labAutoRotate;
      controls.autoRotateSpeed = 0.9;
      controls.update();

      // ---------------------------------------------------------------------
      // ACTIVE EXPERIMENT 3D ANIMATIONS
      // ---------------------------------------------------------------------
      if (activeId === 'water-cycle') {
        const wc = computeWaterCycleModel(st.lab, st.city, st.underground);
        sunRing.rotation.z = t * 0.6;
        const sunScale = 0.8 + (wc.solarIntensityPct / 100) * 0.45;
        sunOrb.scale.setScalar(sunScale);
        wcClouds.scale.setScalar(0.65 + (wc.cloudFormationRatePct / 100) * 0.55);

        for (let i = 0; i < wcVaporCount; i++) {
          const p = ((t * (0.35 + (wc.evaporationMmDay / 12) * 0.4) * Math.max(0.2, speedMult) + i * 0.27) % 1);
          const x = -2.3 + ((i % 6) - 2.5) * 0.38 + Math.sin(t * 2 + i) * 0.1;
          const y = 0.9 + p * 2.35;
          const z = ((Math.floor(i / 6) - 2.5) * 0.35);
          _v1.set(x, y, z);
          _scale.setScalar(0.6 + Math.sin(p * Math.PI) * 0.7);
          _mat4.compose(_v1, _quat, _scale);
          wcVaporMesh.setMatrixAt(i, _mat4);
        }
        wcVaporMesh.instanceMatrix.needsUpdate = true;

        const rainVisibleCount = Math.round((wc.rainfallMm / 120) * wcRainCount);
        for (let i = 0; i < wcRainCount; i++) {
          if (i >= rainVisibleCount) {
            _scale.setScalar(0);
            _mat4.compose(_v1.set(0, -10, 0), _quat, _scale);
          } else {
            const p = ((t * 1.45 * Math.max(0.25, speedMult) + i * 0.19) % 1);
            _v1.set(0.35 + ((i % 7) - 3) * 0.36, 3.1 - p * 2.2, ((Math.floor(i / 7) - 3) * 0.35));
            _scale.setScalar(1);
            _mat4.compose(_v1, _quat, _scale);
          }
          wcRainMesh.setMatrixAt(i, _mat4);
        }
        wcRainMesh.instanceMatrix.needsUpdate = true;
      } else if (activeId === 'rainwater-harvesting') {
        const rh = computeRainwaterLabModel(st.lab, st.city);
        const fillFrac = Math.max(0.05, rh.tankFillPct / 100);
        rhStorageTank.fill.scale.y = fillFrac;
        firstFlushCol.fill.scale.y = Math.min(1, 0.2 + rh.firstFlushMm * 0.2);
        filterVessel.fill.scale.y = 0.55 + (rh.filterEfficiencyPct / 100) * 0.35;

        const dropVis = Math.round(Math.min(1, rh.rainfallMm / 110) * 40);
        for (let i = 0; i < 40; i++) {
          if (i >= dropVis) {
            _scale.setScalar(0);
            _mat4.compose(_v1.set(0, -10, 0), _quat, _scale);
          } else {
            const p = ((t * 1.6 * Math.max(0.2, speedMult) + i * 0.21) % 1);
            _v1.set(-2.3 + (i % 8) * 0.26, 3.6 - p * 1.9, ((Math.floor(i / 8) - 2.5) * 0.42));
            _scale.setScalar(1);
            _mat4.compose(_v1, _quat, _scale);
          }
          rhRainPool.setMatrixAt(i, _mat4);
        }
        rhRainPool.instanceMatrix.needsUpdate = true;
      } else if (activeId === 'groundwater-depletion') {
        const ugM = computeUndergroundMetrics(st.underground, st.city);
        const normDepth = 1 - (st.underground.waterTableDepthM - 4.0) / 30.0; // 0..1
        const waterH = THREE.MathUtils.clamp(normDepth, 0.1, 0.92);
        gdWaterVolume.scale.y = waterH;
        gdWaterPlane.position.y = 0.42 + waterH * 1.56;
        (gdShallowWell.material as THREE.MeshStandardMaterial).color.setHex(
          ugM.shallowWellDry ? 0xf59e0b : 0x38bdf8
        );

        const activeDots = Math.round(THREE.MathUtils.clamp(ugM.rechargeRateMLd / 16, 0.2, 1) * 32);
        for (let i = 0; i < 32; i++) {
          if (i >= activeDots) {
            _scale.setScalar(0);
            _mat4.compose(_v1.set(0, -10, 0), _quat, _scale);
          } else {
            const p = ((t * 0.85 * Math.max(0.2, speedMult) + i * 0.31) % 1);
            _v1.set(((i % 8) - 3.5) * 0.48, 2.75 - p * 1.4, ((Math.floor(i / 8) - 1.5) * 0.6));
            _scale.setScalar(1);
            _mat4.compose(_v1, _quat, _scale);
          }
          gdInfilParticles.setMatrixAt(i, _mat4);
        }
        gdInfilParticles.instanceMatrix.needsUpdate = true;
      } else if (activeId === 'pipeline-leakage') {
        const pl = computePipelineLeakLabModel(st.lab, st.city);
        leakCollars.forEach((col, idx) => {
          col.visible = pl.leakActive && idx < Math.max(1, pl.leakCount);
        });
        bldgStatusMats.forEach((mat, idx) => {
          const affected = pl.leakActive && idx < pl.affectedBuildingsCount;
          mat.color.setHex(affected ? 0xf59e0b : 0x0ea5e9);
          mat.emissive.setHex(affected ? 0xd97706 : 0x0284c7);
        });
        for (let i = 0; i < 60; i++) {
          if (!pl.leakActive) {
            _scale.setScalar(0);
            _mat4.compose(_v1.set(0, -10, 0), _quat, _scale);
          } else {
            const collarIdx = i % Math.min(3, Math.max(1, pl.leakCount));
            const baseColX = -0.3 + collarIdx * 1.15;
            const p = ((t * (1.2 + pl.pressureBar * 0.25) * Math.max(0.2, speedMult) + i * 0.13) % 1);
            const ang = (i * 2.4) % (Math.PI * 2);
            const spread = 0.2 + (pl.leakOrificeMm / 36) * 0.65;
            _v1.set(
              baseColX + Math.sin(ang) * p * 0.28,
              1.25 + p * (0.9 + spread) - p * p * 1.45,
              Math.cos(ang) * p * spread
            );
            _scale.setScalar(0.85);
            _mat4.compose(_v1, _quat, _scale);
          }
          leakSprayMesh.setMatrixAt(i, _mat4);
        }
        leakSprayMesh.instanceMatrix.needsUpdate = true;
      } else if (activeId === 'water-filtration') {
        const wf = computeFiltrationLabModel(st.lab);
        const clarityHue = THREE.MathUtils.clamp(1 - wf.outletTurbidityNtu / 80, 0.2, 1);
        wfCleanTank.fillMat.color.setRGB(0.05 + (1 - clarityHue) * 0.4, 0.65 * clarityHue + 0.2, 0.92 * clarityHue + 0.15);
        for (let i = 0; i < 36; i++) {
          const p = ((t * (0.28 + wf.flowRateLpm / 120) * Math.max(0.2, speedMult) + i * 0.17) % 1);
          let x = -2.25;
          let y = 1.6;
          if (p < 0.3) {
            x = THREE.MathUtils.lerp(-2.25, -0.2, p / 0.3);
            y = 2.35;
          } else if (p < 0.72) {
            x = -0.2 + Math.sin(i * 1.9) * 0.22;
            y = THREE.MathUtils.lerp(2.4, 0.6, (p - 0.3) / 0.42);
          } else {
            x = THREE.MathUtils.lerp(-0.2, 1.95, (p - 0.72) / 0.28);
            y = 1.5;
          }
          _v1.set(x, y, Math.cos(i * 2.3) * 0.2);
          _scale.setScalar(0.95);
          _mat4.compose(_v1, _quat, _scale);
          wfParticles.setMatrixAt(i, _mat4);
        }
        wfParticles.instanceMatrix.needsUpdate = true;
      } else if (activeId === 'desalination') {
        const ro = computeDesalinationLabModel(st.lab);
        roImpeller.rotation.x += dt * (ro.membraneStalled ? 1.5 : 8.5) * Math.max(0.2, speedMult);
        roFreshTank.fill.scale.y = ro.membraneStalled ? 0.06 : Math.max(0.15, ro.effectiveRecoveryPct / 65);
        roBrineTank.fill.scale.y = Math.max(0.22, 1 - ro.effectiveRecoveryPct / 100);
        for (let i = 0; i < 36; i++) {
          if (ro.membraneStalled) {
            _scale.setScalar(0);
            _mat4.compose(_v1.set(0, -10, 0), _quat, _scale);
          } else {
            const p = ((t * 0.72 * Math.max(0.2, speedMult) + i * 0.21) % 1);
            const x = THREE.MathUtils.lerp(-2.1, 2.25, p);
            const laneZ = i % 2 === 0 ? -0.35 : 0.45;
            _v1.set(x, 1.55 + (i % 3) * 0.18, laneZ * p);
            _scale.setScalar(0.9);
            _mat4.compose(_v1, _quat, _scale);
          }
          roFlowParticles.setMatrixAt(i, _mat4);
        }
        roFlowParticles.instanceMatrix.needsUpdate = true;
      } else if (activeId === 'supply-demand') {
        const sd = computeSupplyDemandLabModel(st.lab, st.city);
        sdReservoir.fill.scale.y = Math.max(0.1, sd.reservoirStoragePct / 100);
        sectorBars[0].scale.y = THREE.MathUtils.clamp(sd.domesticDemandMLd / 18, 0.35, 2.8);
        sectorBars[1].scale.y = THREE.MathUtils.clamp(sd.industrialDemandMLd / 7, 0.35, 2.8);
        sectorBars[2].scale.y = THREE.MathUtils.clamp(sd.commercialDemandMLd / 5.5, 0.35, 2.8);
      } else if (activeId === 'smart-city-management') {
        const sc = computeSmartCityMgmtModel(st.city, st.underground);
        scPurpleLoop.scale.setScalar(0.88 + (st.city.recyclingCapacityPct / 100) * 0.24);
        cyanGlowMat.emissiveIntensity = 0.55 + (sc.sustainabilityIndicator / 100) * 0.8;
        for (let i = 0; i < 32; i++) {
          const ang = t * (0.65 + (st.city.recyclingCapacityPct / 100) * 0.9) * Math.max(0.2, speedMult) + i * 0.4;
          const r = i % 2 === 0 ? 1.55 : 2.35;
          _v1.set(Math.cos(ang) * r, 0.78 + Math.sin(t * 2 + i) * 0.08, Math.sin(ang) * r);
          _scale.setScalar(0.85);
          _mat4.compose(_v1, _quat, _scale);
          scParticles.setMatrixAt(i, _mat4);
        }
        scParticles.instanceMatrix.needsUpdate = true;
      }

      renderer.render(scene, camera);
      afterDraw(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('resize', onResize);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      envRT.dispose();
      textures.dispose();
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglLost) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-[#040a14] text-sm text-cyan-200">
        3D Lab graphics context paused — restoring WebGL renderer…
      </div>
    );
  }

  return (
    <div ref={mountRef} className="relative h-full w-full overflow-hidden">
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-cyan-400/35 bg-[#061121]/95 px-3 py-1.5 text-xs shadow-xl"
          style={{ left: hovered.x, top: Math.max(64, hovered.y - 8) }}
        >
          <div className="font-semibold text-white">{hovered.name}</div>
          <div className="text-[11px] text-cyan-300/90">{hovered.subtitle}</div>
        </div>
      )}
    </div>
  );
};
