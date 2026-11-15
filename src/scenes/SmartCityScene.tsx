import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CITY_ENTITIES, CityEntity } from '../data/smartCityData';
import { calculateLeakTickLossLitres } from '../services/simulationEngine';
import { useAppState } from '../state/appStore';
import { createCityTextureBundle } from '../utils/cityTextures';
import { applyGestureOrbitToCamera, raycastAtViewportNorm } from '../utils/gestureSpatial';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _proj = new THREE.Vector3();

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

const LEAK_LOCATIONS: Record<
  'pipe-distribution' | 'pipe-residential-east' | 'pipe-intake',
  [number, number, number]
> = {
  'pipe-distribution': [1.0, 0.35, -1.5],
  'pipe-residential-east': [8.2, 0.35, -1.8],
  'pipe-intake': [-12.2, 0.35, -8.8],
};

export const SmartCityScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { state, dispatch, focusCityEntity } = useAppState();

  const stateRef = useRef(state);
  stateRef.current = state;
  const focusEntityRef = useRef(focusCityEntity);
  focusEntityRef.current = focusCityEntity;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const [hoveredEntity, setHoveredEntity] = useState<{
    entity: CityEntity;
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
    scene.background = new THREE.Color('#040c18');
    scene.fog = new THREE.FogExp2('#040c18', 0.0115);

    const camera = new THREE.PerspectiveCamera(44, width / height, 0.2, 220);
    camera.position.set(18, 17, 26);

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const onContextRestored = () => setWebglLost(false);
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // Environment reflection for glass towers, water & metallic pipes
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmrem.dispose();

    // 3-Point Museum Lighting Rig
    const keyLight = new THREE.DirectionalLight(0xfff1dc, 2.2);
    keyLight.position.set(22, 30, 18);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -28;
      keyLight.shadow.camera.right = 28;
      keyLight.shadow.camera.top = 28;
      keyLight.shadow.camera.bottom = -28;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const hemi = new THREE.HemisphereLight(0x7dd3fc, 0x091628, 0.9);
    scene.add(hemi);

    const rimLight = new THREE.DirectionalLight(0x22d3ee, 1.0);
    rimLight.position.set(-24, 12, -20);
    scene.add(rimLight);

    // OrbitControls (Rotate, Zoom, Pan)
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = true;
    controls.screenSpacePanning = false;
    controls.minDistance = 6.5;
    controls.maxDistance = 52;
    controls.maxPolarAngle = Math.PI / 2.12;
    controls.target.set(0, 0.8, 0);

    const textures = createCityTextureBundle(renderer.capabilities.getMaxAnisotropy());
    const disposables: { dispose: () => void }[] = [];
    const track = <T extends { dispose: () => void }>(item: T): T => {
      disposables.push(item);
      return item;
    };

    // 1. Extended Terrain & Natural Coastal/Ridge Horizon (no indoor box void)
    const groundGeo = track(new THREE.PlaneGeometry(140, 140, 24, 24));
    const groundMat = track(
      new THREE.MeshStandardMaterial({
        color: 0x0a1728,
        roughness: 0.92,
        metalness: 0.08,
      })
    );
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Subtle scientific grid overlay on city pad
    const grid = new THREE.GridHelper(48, 24, 0x164e63, 0x0b253c);
    grid.position.y = 0.015;
    scene.add(grid);

    // Distant low-poly mountain ridge perimeter
    const ridgeMat = track(
      new THREE.MeshStandardMaterial({ color: 0x0b1f36, roughness: 0.9, metalness: 0.05 })
    );
    const ridgeGeo = track(new THREE.ConeGeometry(8, 9, 5));
    const ridgeInst = new THREE.InstancedMesh(ridgeGeo, ridgeMat, 22);
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const dist = 54 + (i % 3) * 5;
      _v1.set(Math.cos(angle) * dist, 3.2 + (i % 3) * 1.1, Math.sin(angle) * dist);
      _scale.set(1.2 + (i % 4) * 0.3, 0.8 + (i % 3) * 0.45, 1.2 + (i % 2) * 0.3);
      _quat.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
      _mat4.compose(_v1, _quat, _scale);
      ridgeInst.setMatrixAt(i, _mat4);
    }
    ridgeInst.computeBoundingSphere();
    scene.add(ridgeInst);

    // 2. Emerald River & Urban Lake (Animated custom water shader)
    const waterShaderMat = track(
      new THREE.ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uDeepColor: { value: new THREE.Color('#0369a1') },
          uShallowColor: { value: new THREE.Color('#22d3ee') },
        },
        vertexShader: `
          varying vec2 vUv;
          uniform float uTime;
          void main() {
            vUv = uv;
            vec3 pos = position;
            pos.z += sin(pos.x * 2.5 + uTime * 2.2) * 0.03 + cos(pos.y * 3.0 + uTime * 1.8) * 0.02;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          varying vec2 vUv;
          uniform float uTime;
          uniform vec3 uDeepColor;
          uniform vec3 uShallowColor;
          void main() {
            float wave = sin(vUv.x * 24.0 + uTime * 2.5) * 0.5 + 0.5;
            float shimmer = sin(vUv.y * 18.0 - uTime * 3.0) * 0.5 + 0.5;
            vec3 col = mix(uDeepColor, uShallowColor, 0.32 + 0.35 * wave * shimmer);
            gl_FragColor = vec4(col, 0.9);
          }
        `,
        transparent: true,
      })
    );

    // River channel cutting North-South at x ≈ 6.5
    const riverGeo = track(new THREE.PlaneGeometry(3.4, 48, 12, 48));
    const riverMesh = new THREE.Mesh(riverGeo, waterShaderMat);
    riverMesh.rotation.x = -Math.PI / 2;
    riverMesh.position.set(6.5, 0.04, 0);
    scene.add(riverMesh);

    // Urban Park Lake
    const lakeGeo = track(new THREE.CircleGeometry(3.6, 36));
    const lakeMesh = new THREE.Mesh(lakeGeo, waterShaderMat);
    lakeMesh.rotation.x = -Math.PI / 2;
    lakeMesh.position.set(2.5, 0.045, 9.8);
    scene.add(lakeMesh);

    // 3. Roads & Cable-Stayed Bridge across Emerald River
    const roadMatH = track(
      new THREE.MeshStandardMaterial({ map: textures.roadMap, roughness: 0.78, metalness: 0.1 })
    );
    const hRoad = new THREE.Mesh(track(new THREE.PlaneGeometry(34, 2.2)), roadMatH);
    hRoad.rotation.x = -Math.PI / 2;
    hRoad.rotation.z = Math.PI / 2;
    hRoad.position.set(0, 0.025, 0);
    scene.add(hRoad);

    const vRoad1 = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 32)), roadMatH);
    vRoad1.rotation.x = -Math.PI / 2;
    vRoad1.position.set(-4.5, 0.026, 0);
    scene.add(vRoad1);

    const vRoad2 = new THREE.Mesh(track(new THREE.PlaneGeometry(2.2, 32)), roadMatH);
    vRoad2.rotation.x = -Math.PI / 2;
    vRoad2.position.set(1.2, 0.026, 0);
    scene.add(vRoad2);

    // Cable-stayed bridge spanning x = 4.2 to 8.8 at z = 0
    const bridgeGroup = new THREE.Group();
    const concreteMat = track(
      new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.65, metalness: 0.25 })
    );
    const steelMat = track(
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.25, metalness: 0.82 })
    );
    const bridgeDeck = new THREE.Mesh(track(new THREE.BoxGeometry(5.6, 0.28, 2.5)), concreteMat);
    bridgeDeck.position.set(6.5, 0.45, 0);
    bridgeGroup.add(bridgeDeck);
    for (const side of [-1, 1]) {
      const pylon = new THREE.Mesh(track(new THREE.BoxGeometry(0.28, 3.2, 0.28)), steelMat);
      pylon.position.set(6.5, 1.6, side * 1.15);
      bridgeGroup.add(pylon);
      for (const offset of [-1.8, -0.9, 0.9, 1.8]) {
        const len = Math.hypot(offset, 2.4);
        const cable = new THREE.Mesh(
          track(new THREE.CylinderGeometry(0.02, 0.02, len, 6)),
          steelMat
        );
        cable.position.set(6.5 + offset * 0.5, 1.65, side * 1.12);
        cable.rotation.z = Math.atan2(offset, 2.4);
        bridgeGroup.add(cable);
      }
    }
    scene.add(bridgeGroup);

    // 4. Parks & Instanced Trees
    const parkMat = track(
      new THREE.MeshStandardMaterial({ color: 0x114b3e, roughness: 0.9, metalness: 0.02 })
    );
    for (const [px, pz, pw, pd] of [
      [-1.5, 9.8, 10.5, 7.5],
      [9.5, 5.2, 4.2, 6.0],
      [-9.5, 0.0, 4.5, 6.2],
    ]) {
      const parkPad = new THREE.Mesh(track(new THREE.BoxGeometry(pw, 0.08, pd)), parkMat);
      parkPad.position.set(px, 0.04, pz);
      parkPad.receiveShadow = true;
      scene.add(parkPad);
    }

    const treeCoords: [number, number][] = [
      [-5.2, 8.2], [-4.1, 11.2], [-2.5, 12.1], [0.2, 12.6], [4.5, 11.8],
      [-9.8, -1.8], [-10.5, 1.6], [-8.8, 2.1], [8.8, 3.5], [10.4, 4.4],
      [9.4, 6.8], [10.6, 7.2], [-7.5, -2.5], [2.4, -7.8], [3.8, -8.5],
      [-0.8, 7.6], [-3.2, 7.2], [13.5, 3.0], [14.8, 2.4], [8.6, -7.5],
      [-12.5, 5.5], [-13.2, 7.2], [5.0, 7.8], [3.5, 6.2],
    ];
    const trunkGeo = track(new THREE.CylinderGeometry(0.08, 0.12, 0.55, 6));
    const trunkMat = track(new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9 }));
    const canopyGeo = track(new THREE.DodecahedronGeometry(0.45, 1));
    const canopyMat = track(
      new THREE.MeshStandardMaterial({ color: 0x10b981, roughness: 0.78, metalness: 0.05 })
    );
    const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeCoords.length);
    const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeCoords.length);
    treeCoords.forEach(([tx, tz], i) => {
      const s = 0.85 + (i % 5) * 0.1;
      _v1.set(tx, 0.28 * s, tz);
      _quat.identity();
      _scale.set(s, s, s);
      _mat4.compose(_v1, _quat, _scale);
      trunkInst.setMatrixAt(i, _mat4);

      _v1.set(tx, 0.72 * s, tz);
      _scale.set(s, s * 1.15, s);
      _mat4.compose(_v1, _quat, _scale);
      canopyInst.setMatrixAt(i, _mat4);
      canopyInst.setColorAt(
        i,
        new THREE.Color().setHSL(0.43 + (i % 4) * 0.015, 0.68, 0.36 + (i % 3) * 0.04)
      );
    });
    trunkInst.computeBoundingSphere();
    canopyInst.computeBoundingSphere();
    if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
    scene.add(trunkInst);
    scene.add(canopyInst);

    // Shared PBR Materials for City Buildings & Infrastructure
    const glassMat = track(
      new THREE.MeshPhysicalMaterial({
        map: textures.glassFacade,
        emissiveMap: textures.glassEmissive,
        emissive: new THREE.Color(0x38bdf8),
        emissiveIntensity: 0.6,
        roughness: 0.16,
        metalness: 0.45,
        clearcoat: 0.85,
      })
    );
    const resMat = track(
      new THREE.MeshStandardMaterial({
        map: textures.residentialFacade,
        roughness: 0.55,
        metalness: 0.15,
      })
    );
    const solarMat = track(
      new THREE.MeshStandardMaterial({
        map: textures.solarPanel,
        roughness: 0.22,
        metalness: 0.65,
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
    const reclaimedMat = track(
      new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0x9333ea,
        emissiveIntensity: 0.75,
        roughness: 0.25,
      })
    );
    const hitMat = track(new THREE.MeshBasicMaterial({ visible: false }));

    const clickableMeshes: THREE.Object3D[] = [];
    const entityGroups = new Map<string, THREE.Group>();

    const registerClickable = (
      entityId: string,
      group: THREE.Group,
      hitRadius: number,
      hitHeight: number
    ) => {
      const entity = CITY_ENTITIES.find((e) => e.id === entityId);
      if (!entity) return;
      const hitMesh = new THREE.Mesh(
        track(new THREE.CylinderGeometry(hitRadius, hitRadius, hitHeight, 10)),
        hitMat
      );
      hitMesh.position.y = hitHeight * 0.5;
      hitMesh.layers.set(1);
      hitMesh.userData.entity = entity;
      group.add(hitMesh);
      clickableMeshes.push(hitMesh);
      entityGroups.set(entityId, group);
      scene.add(group);
    };

    // 5. Build Each Interactive City Infrastructure & Building (3-8 parts per Group)

    // A. Periyar Valley Smart Reservoir (dynamic water level!)
    const resGroup = new THREE.Group();
    resGroup.position.set(-16, 0, -12);
    const damWall = new THREE.Mesh(track(new THREE.BoxGeometry(7.2, 1.4, 0.8)), concreteMat);
    damWall.position.set(0, 0.7, 3.2);
    damWall.castShadow = true;
    resGroup.add(damWall);
    const basinRim = new THREE.Mesh(
      track(new THREE.BoxGeometry(7.6, 0.7, 6.8)),
      track(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85 }))
    );
    basinRim.position.set(0, 0.35, -0.2);
    resGroup.add(basinRim);
    const reservoirWaterMesh = new THREE.Mesh(
      track(new THREE.BoxGeometry(6.8, 0.9, 6.0)),
      waterShaderMat
    );
    reservoirWaterMesh.position.set(0, 0.55, -0.2);
    resGroup.add(reservoirWaterMesh);
    // Floating solar panels on reservoir
    const floatSolar = new THREE.Mesh(track(new THREE.BoxGeometry(2.4, 0.08, 1.6)), solarMat);
    floatSolar.position.set(-1.3, 1.04, -0.8);
    resGroup.add(floatSolar);
    registerClickable('city-reservoir', resGroup, 4.2, 2.2);

    // B. Clarion Water Treatment Plant
    const treatGroup = new THREE.Group();
    treatGroup.position.set(-8.5, 0, -5.5);
    const treatBase = new THREE.Mesh(track(new THREE.BoxGeometry(5.2, 0.3, 4.2)), concreteMat);
    treatBase.position.y = 0.15;
    treatGroup.add(treatBase);
    const clarifierSkimmers: THREE.Mesh[] = [];
    for (const cx of [-1.2, 1.1]) {
      const tankWall = new THREE.Mesh(
        track(new THREE.CylinderGeometry(1.05, 1.05, 0.9, 24, 1, true)),
        steelMat
      );
      tankWall.position.set(cx, 0.65, -0.7);
      treatGroup.add(tankWall);
      const tankWater = new THREE.Mesh(
        track(new THREE.CylinderGeometry(0.98, 0.98, 0.75, 24)),
        waterShaderMat
      );
      tankWater.position.set(cx, 0.58, -0.7);
      treatGroup.add(tankWater);
      const skimmer = new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 0.08, 0.12)), cyanGlowMat);
      skimmer.position.set(cx, 1.14, -0.7);
      treatGroup.add(skimmer);
      clarifierSkimmers.push(skimmer);
    }
    const filterHall = new THREE.Mesh(track(new THREE.BoxGeometry(4.4, 1.25, 1.5)), glassMat);
    filterHall.position.set(0, 0.9, 1.1);
    filterHall.castShadow = true;
    treatGroup.add(filterHall);
    registerClickable('treatment-plant', treatGroup, 3.0, 2.2);

    // C. Elevated Hydraulic Pressure Tower
    const towerGroup = new THREE.Group();
    towerGroup.position.set(-1.5, 0, -6.5);
    for (const [lx, lz] of [
      [-0.7, -0.7],
      [0.7, -0.7],
      [-0.7, 0.7],
      [0.7, 0.7],
    ]) {
      const leg = new THREE.Mesh(track(new THREE.CylinderGeometry(0.1, 0.14, 3.4, 8)), steelMat);
      leg.position.set(lx, 1.7, lz);
      leg.castShadow = true;
      towerGroup.add(leg);
    }
    const tankShell = new THREE.Mesh(
      track(new THREE.CylinderGeometry(1.45, 1.25, 1.6, 24)),
      steelMat
    );
    tankShell.position.y = 4.1;
    tankShell.castShadow = true;
    towerGroup.add(tankShell);
    const tankBand = new THREE.Mesh(
      track(new THREE.CylinderGeometry(1.48, 1.48, 0.45, 24)),
      cyanGlowMat
    );
    tankBand.position.y = 4.1;
    towerGroup.add(tankBand);
    const towerCap = new THREE.Mesh(track(new THREE.ConeGeometry(1.45, 0.55, 24)), solarMat);
    towerCap.position.y = 5.15;
    towerGroup.add(towerCap);
    registerClickable('overhead-tank', towerGroup, 2.0, 5.5);

    // D. Closed-Loop Wastewater Recycling Plant (7-Stage Facility)
    const recGroup = new THREE.Group();
    recGroup.position.set(14.5, 0, 10.5);
    const recPad = new THREE.Mesh(track(new THREE.BoxGeometry(6.4, 0.25, 5.2)), concreteMat);
    recPad.position.y = 0.125;
    recGroup.add(recPad);
    // Biological aeration basins
    for (const bz of [-1.1, 0.6]) {
      const basin = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 0.85, 1.2)), steelMat);
      basin.position.set(-1.1, 0.55, bz);
      recGroup.add(basin);
      const bioSurface = new THREE.Mesh(
        track(new THREE.BoxGeometry(2.9, 0.1, 1.0)),
        reclaimedMat
      );
      bioSurface.position.set(-1.1, 0.96, bz);
      recGroup.add(bioSurface);
    }
    // Membrane + UV hall
    const membraneHall = new THREE.Mesh(track(new THREE.BoxGeometry(2.0, 1.5, 3.8)), glassMat);
    membraneHall.position.set(1.6, 0.9, -0.2);
    membraneHall.castShadow = true;
    recGroup.add(membraneHall);
    const reuseDome = new THREE.Mesh(track(new THREE.SphereGeometry(0.85, 20, 12)), reclaimedMat);
    reuseDome.position.set(1.6, 1.75, -0.2);
    recGroup.add(reuseDome);
    registerClickable('recycling-plant', recGroup, 3.6, 2.8);

    // E. Eco-Canopy Rainwater Harvesting Hub (Dynamic cistern water level!)
    const rainGroup = new THREE.Group();
    rainGroup.position.set(-10, 0, 10.5);
    const rainPad = new THREE.Mesh(track(new THREE.BoxGeometry(5.0, 0.22, 4.2)), concreteMat);
    rainPad.position.y = 0.11;
    rainGroup.add(rainPad);
    const canopyRoof = new THREE.Mesh(
      track(new THREE.BoxGeometry(3.4, 0.12, 2.6)),
      track(
        new THREE.MeshPhysicalMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.62,
          roughness: 0.15,
          metalness: 0.2,
        })
      )
    );
    canopyRoof.position.set(-0.6, 2.35, 0);
    canopyRoof.rotation.z = -0.24;
    rainGroup.add(canopyRoof);
    for (const [px, pz] of [
      [-2.0, -1.0],
      [-2.0, 1.0],
      [0.6, -1.0],
      [0.6, 1.0],
    ]) {
      const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 8)), steelMat);
      post.position.set(px, 1.15, pz);
      rainGroup.add(post);
    }
    // Translucent storage cistern + dynamic inner water column
    const cisternShell = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.92, 0.92, 2.0, 24)),
      track(
        new THREE.MeshPhysicalMaterial({
          color: 0xbae6fd,
          transparent: true,
          opacity: 0.3,
          roughness: 0.1,
          depthWrite: false,
        })
      )
    );
    cisternShell.position.set(1.45, 1.2, 0);
    rainGroup.add(cisternShell);
    const cisternWaterMesh = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.84, 0.84, 1.85, 24)),
      cyanGlowMat
    );
    cisternWaterMesh.position.set(1.45, 1.1, 0);
    rainGroup.add(cisternWaterMesh);
    registerClickable('rainwater-facility', rainGroup, 2.9, 2.8);

    // F. AMI Smart Water Meter & Sensor Hub
    const meterGroup = new THREE.Group();
    meterGroup.position.set(1.5, 0, 2.2);
    const meterBase = new THREE.Mesh(track(new THREE.CylinderGeometry(1.1, 1.25, 0.4, 16)), steelMat);
    meterBase.position.y = 0.2;
    meterGroup.add(meterBase);
    const meterCore = new THREE.Mesh(track(new THREE.CylinderGeometry(0.55, 0.55, 1.4, 16)), glassMat);
    meterCore.position.y = 0.9;
    meterGroup.add(meterCore);
    const meterRing = new THREE.Mesh(track(new THREE.TorusGeometry(0.8, 0.06, 8, 28)), cyanGlowMat);
    meterRing.rotation.x = Math.PI / 2;
    meterRing.position.y = 1.3;
    meterGroup.add(meterRing);
    registerClickable('smart-meter-hub', meterGroup, 1.6, 2.0);

    // G. Skyscrapers & Eco-Residential Buildings
    // 1. AquaSpire Skyscraper
    const skyAlpha = new THREE.Group();
    skyAlpha.position.set(-2.5, 0, 2.5);
    const podiumA = new THREE.Mesh(track(new THREE.BoxGeometry(3.2, 1.2, 3.2)), concreteMat);
    podiumA.position.y = 0.6;
    podiumA.castShadow = true;
    skyAlpha.add(podiumA);
    const shaftA = new THREE.Mesh(track(new THREE.BoxGeometry(2.3, 6.8, 2.3)), glassMat);
    shaftA.position.y = 4.6;
    shaftA.castShadow = true;
    skyAlpha.add(shaftA);
    const crownA = new THREE.Mesh(track(new THREE.BoxGeometry(1.7, 1.4, 1.7)), glassMat);
    crownA.position.y = 8.7;
    skyAlpha.add(crownA);
    const solarCrownA = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 0.1, 1.5)), solarMat);
    solarCrownA.position.y = 9.48;
    solarCrownA.rotation.x = 0.22;
    skyAlpha.add(solarCrownA);
    const spireA = new THREE.Mesh(track(new THREE.CylinderGeometry(0.04, 0.08, 1.6, 8)), cyanGlowMat);
    spireA.position.y = 10.2;
    skyAlpha.add(spireA);
    registerClickable('sky-tower-alpha', skyAlpha, 2.1, 10.5);

    // 2. Helios Civic & Research Tower
    const skyBeta = new THREE.Group();
    skyBeta.position.set(4.2, 0, -2.5);
    const baseB = new THREE.Mesh(track(new THREE.BoxGeometry(3.0, 1.0, 2.8)), concreteMat);
    baseB.position.y = 0.5;
    skyBeta.add(baseB);
    const leftShaftB = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 6.4, 1.8)), glassMat);
    leftShaftB.position.set(-0.65, 4.2, 0);
    leftShaftB.castShadow = true;
    skyBeta.add(leftShaftB);
    const rightShaftB = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, 7.6, 1.6)), glassMat);
    rightShaftB.position.set(0.75, 4.8, 0.1);
    rightShaftB.castShadow = true;
    skyBeta.add(rightShaftB);
    const skyBridgeB = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, 0.45, 0.9)), cyanGlowMat);
    skyBridgeB.position.set(0, 5.1, 0);
    skyBeta.add(skyBridgeB);
    const solarB = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, 0.1, 1.5)), solarMat);
    solarB.position.set(0.75, 8.7, 0.1);
    solarB.rotation.x = -0.25;
    skyBeta.add(solarB);
    registerClickable('sky-tower-beta', skyBeta, 2.1, 9.2);

    // 3. Veridian Eco-Residences (West District)
    const resWest = new THREE.Group();
    resWest.position.set(-6.2, 0, 5.2);
    for (const [bx, bz, bh] of [
      [-1.1, -0.8, 2.5],
      [1.0, -0.6, 3.1],
      [0.0, 1.1, 2.2],
    ]) {
      const blk = new THREE.Mesh(track(new THREE.BoxGeometry(1.6, bh, 1.4)), resMat);
      blk.position.set(bx, bh * 0.5, bz);
      blk.castShadow = true;
      resWest.add(blk);
      const pv = new THREE.Mesh(track(new THREE.BoxGeometry(1.3, 0.08, 1.0)), solarMat);
      pv.position.set(bx, bh + 0.08, bz);
      pv.rotation.x = 0.2;
      resWest.add(pv);
    }
    registerClickable('res-district-west', resWest, 2.5, 3.4);

    // 4. Harborview Apartments (East Bank — affected by trunk leak!)
    const resEast = new THREE.Group();
    resEast.position.set(11.2, 0, -1.8);
    for (const [bx, bz, bh] of [
      [-0.9, -0.9, 3.6],
      [1.0, -0.7, 4.2],
      [0.1, 1.1, 3.0],
    ]) {
      const blk = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, bh, 1.4)), resMat);
      blk.position.set(bx, bh * 0.5, bz);
      blk.castShadow = true;
      resEast.add(blk);
      const pv = new THREE.Mesh(track(new THREE.BoxGeometry(1.2, 0.08, 1.0)), solarMat);
      pv.position.set(bx, bh + 0.08, bz);
      resEast.add(pv);
    }
    // Status warning beacon shown only when active leak affects east district
    const eastAlertRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(2.3, 0.08, 8, 32)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0xf59e0b,
          transparent: true,
          opacity: 0.9,
        })
      )
    );
    eastAlertRing.rotation.x = Math.PI / 2;
    eastAlertRing.position.y = 0.14;
    eastAlertRing.visible = false;
    resEast.add(eastAlertRing);
    registerClickable('res-district-east', resEast, 2.5, 4.5);

    // 5. CleanTech Innovation Campus
    const techGroup = new THREE.Group();
    techGroup.position.set(10.8, 0, -10.2);
    const techHall = new THREE.Mesh(track(new THREE.BoxGeometry(4.0, 1.6, 2.8)), glassMat);
    techHall.position.set(-0.4, 0.8, 0);
    techHall.castShadow = true;
    techGroup.add(techHall);
    const techSolar = new THREE.Mesh(track(new THREE.BoxGeometry(3.4, 0.08, 2.2)), solarMat);
    techSolar.position.set(-0.4, 1.68, 0);
    techGroup.add(techSolar);
    const coolingTower = new THREE.Mesh(
      track(new THREE.CylinderGeometry(0.7, 0.9, 2.1, 16)),
      steelMat
    );
    coolingTower.position.set(2.2, 1.05, 0);
    techGroup.add(coolingTower);
    registerClickable('industrial-tech-park', techGroup, 3.1, 2.5);

    // 6. Visible Water Distribution Network (Transparent Tubes + Animated Flow Beads)
    interface PipeFlowChannel {
      curve: THREE.CatmullRomCurve3;
      beads: THREE.InstancedMesh;
      beadCount: number;
      baseSpeed: number;
    }
    const pipeChannels: PipeFlowChannel[] = [];

    const buildPipeline = (
      entityId: string,
      points: THREE.Vector3[],
      pipeColorHex: number,
      beadColorHex: number,
      beadCount: number,
      baseSpeed: number
    ) => {
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = track(new THREE.TubeGeometry(curve, 52, 0.22, 10, false));
      const tubeMat = track(
        new THREE.MeshPhysicalMaterial({
          color: pipeColorHex,
          transparent: true,
          opacity: 0.34,
          roughness: 0.15,
          metalness: 0.1,
          depthWrite: false,
        })
      );
      const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
      scene.add(tubeMesh);

      // Clickable invisible tube proxy on Layer 1
      const entity = CITY_ENTITIES.find((e) => e.id === entityId);
      if (entity) {
        const hitTube = new THREE.Mesh(
          track(new THREE.TubeGeometry(curve, 32, 0.45, 8, false)),
          hitMat
        );
        hitTube.layers.set(1);
        hitTube.userData.entity = entity;
        scene.add(hitTube);
        clickableMeshes.push(hitTube);
      }

      const beadGeo = track(new THREE.SphereGeometry(0.13, 8, 8));
      const beadMat = track(
        new THREE.MeshBasicMaterial({
          color: beadColorHex,
        })
      );
      const beads = new THREE.InstancedMesh(beadGeo, beadMat, beadCount);
      beads.frustumCulled = false;
      scene.add(beads);
      pipeChannels.push({ curve, beads, beadCount, baseSpeed });
    };

    // Pipe 1: Reservoir -> Treatment Plant -> Overhead Tank
    buildPipeline(
      'pipe-intake',
      [
        new THREE.Vector3(-15.5, 0.32, -9.0),
        new THREE.Vector3(-12.2, 0.32, -8.8),
        new THREE.Vector3(-8.5, 0.32, -5.5),
        new THREE.Vector3(-1.5, 0.32, -6.5),
      ],
      0x38bdf8,
      0x7dd3fc,
      18,
      0.18
    );

    // Pipe 2: Treatment/Overhead Tank -> City Districts & Skyscrapers
    buildPipeline(
      'pipe-distribution',
      [
        new THREE.Vector3(-1.5, 0.32, -6.5),
        new THREE.Vector3(1.0, 0.32, -1.5),
        new THREE.Vector3(-2.5, 0.32, 2.5),
        new THREE.Vector3(-6.2, 0.32, 5.2),
        new THREE.Vector3(1.5, 0.32, 2.2),
        new THREE.Vector3(4.2, 0.32, -2.5),
        new THREE.Vector3(11.2, 0.32, -1.8),
        new THREE.Vector3(10.8, 0.32, -10.2),
      ],
      0x06b6d4,
      0x22d3ee,
      28,
      0.22
    );

    // Pipe 3: Wastewater Collection -> Recycling Plant -> Reclaimed Reuse Return
    buildPipeline(
      'pipe-wastewater',
      [
        new THREE.Vector3(-6.2, 0.25, 6.2),
        new THREE.Vector3(1.5, 0.25, 4.5),
        new THREE.Vector3(7.5, 0.25, 6.8),
        new THREE.Vector3(14.5, 0.25, 10.5),
        new THREE.Vector3(11.2, 0.25, 1.5),
        new THREE.Vector3(4.2, 0.25, -0.5),
      ],
      0xa855f7,
      0xc084fc,
      22,
      0.16
    );

    // 7. Pipeline Leak Spray & Expanding Puddle Group
    const leakGroup = new THREE.Group();
    leakGroup.visible = false;
    const leakRing = new THREE.Mesh(
      track(new THREE.RingGeometry(0.4, 1.25, 28)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.68,
        })
      )
    );
    leakRing.rotation.x = -Math.PI / 2;
    leakRing.position.y = 0.08;
    leakGroup.add(leakRing);

    const leakAlertRing = new THREE.Mesh(
      track(new THREE.TorusGeometry(1.1, 0.07, 8, 28)),
      track(new THREE.MeshBasicMaterial({ color: 0xf59e0b }))
    );
    leakAlertRing.rotation.x = Math.PI / 2;
    leakAlertRing.position.y = 0.25;
    leakGroup.add(leakAlertRing);

    const sprayCount = 48;
    const sprayPos = new Float32Array(sprayCount * 3);
    const sprayVel = new Float32Array(sprayCount * 3);
    for (let i = 0; i < sprayCount; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = 0.4 + Math.random() * 0.8;
      sprayVel[i * 3] = Math.cos(a) * spd;
      sprayVel[i * 3 + 1] = 2.2 + Math.random() * 1.6;
      sprayVel[i * 3 + 2] = Math.sin(a) * spd;
      sprayPos[i * 3 + 1] = Math.random() * 1.2;
    }
    const sprayGeo = track(new THREE.BufferGeometry());
    sprayGeo.setAttribute('position', new THREE.BufferAttribute(sprayPos, 3));
    const sprayPoints = new THREE.Points(
      sprayGeo,
      track(
        new THREE.PointsMaterial({
          color: 0x7dd3fc,
          size: 0.16,
          transparent: true,
          opacity: 0.9,
        })
      )
    );
    leakGroup.add(sprayPoints);
    scene.add(leakGroup);

    // 8. Animated City Rain Particles (driven by rainfallIntensity)
    const rainCount = 320;
    const rainPos = new Float32Array(rainCount * 3);
    for (let i = 0; i < rainCount; i++) {
      rainPos[i * 3] = (Math.random() - 0.5) * 34;
      rainPos[i * 3 + 1] = Math.random() * 16;
      rainPos[i * 3 + 2] = (Math.random() - 0.5) * 28;
    }
    const rainGeo = track(new THREE.BufferGeometry());
    rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
    const rainMat = track(
      new THREE.PointsMaterial({
        color: 0xbae6fd,
        size: 0.14,
        transparent: true,
        opacity: 0.55,
      })
    );
    const rainPoints = new THREE.Points(rainGeo, rainMat);
    scene.add(rainPoints);

    // 9. Selection Highlight Ring
    const selectionRing = new THREE.Mesh(
      track(new THREE.RingGeometry(2.3, 2.6, 36)),
      track(
        new THREE.MeshBasicMaterial({
          color: 0x22d3ee,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.88,
        })
      )
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.y = 0.12;
    selectionRing.visible = false;
    scene.add(selectionRing);

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
        const entity = hits[0].object.userData.entity as CityEntity | undefined;
        if (entity) {
          focusEntityRef.current(entity.id);
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
        const entity = hits[0].object.userData.entity as CityEntity | undefined;
        if (entity) {
          renderer.domElement.style.cursor = 'pointer';
          _proj.set(entity.position[0], entity.position[1] + 1.8, entity.position[2]);
          _proj.project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          setHoveredEntity({
            entity,
            x: ((_proj.x + 1) / 2) * rect.width,
            y: ((-_proj.y + 1) / 2) * rect.height,
          });
          return;
        }
      }
      renderer.domElement.style.cursor = 'grab';
      setHoveredEntity(null);
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const cameraFlight = {
      active: false,
      camPos: new THREE.Vector3(18, 17, 26),
      targetPos: new THREE.Vector3(0, 0.8, 0),
      lastFlyVersion: -1,
      lastZoomVersion: -1,
    };

    controls.addEventListener('start', () => {
      cameraFlight.active = false;
    });

    controls.addEventListener('end', () => {
      const dist = camera.position.distanceTo(controls.target);
      const zoomPct = Math.round(THREE.MathUtils.clamp(((52 - dist) / (52 - 6.5)) * 100, 0, 100));
      dispatchRef.current({
        type: 'SYNC_CAMERA_TELEMETRY',
        activeCameraId: 'smart-city-cam',
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

    // Animation Loop
    let frameId = 0;
    let disposed = false;
    let leakAccumTimer = 0;
    let lastOrbitVersion = stateRef.current.gesture.orbitStep.version;
    let lastGesturePointTrigger = stateRef.current.gesture.pointerCursor.triggerCount;
    let lastGestureHoverCheck = 0;
    let lastGestureHoverLabel: string | null = null;
    const clock = new THREE.Clock();

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

    let simElapsed = 0;
    let tabHidden = typeof document !== 'undefined' && document.hidden;
    const onVisibilityChange = () => {
      tabHidden = document.hidden;
      if (!tabHidden) {
        clock.getDelta();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    function tick() {
      if (disposed) return;
      if (tabHidden) {
        frameId = window.setTimeout(tick, 450);
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.1);
      const elapsed = clock.getElapsedTime();
      const city = stateRef.current.city;
      const simParams = stateRef.current.simulationParams;
      const simDt = simParams.running ? dt * (simParams.speed || 1) : 0;
      simElapsed += simDt;
      const selectedId = stateRef.current.selectedObject?.id ?? null;

      // Update water shader time
      waterShaderMat.uniforms.uTime.value = simElapsed;

      // Rotate treatment plant clarifier skimmers
      clarifierSkimmers.forEach((s) => {
        s.rotation.y = simElapsed * 0.45;
      });

      // Dynamic Reservoir water surface height based on reservoirStoragePct (10..100%)
      const resFactor = THREE.MathUtils.clamp(city.reservoirStoragePct / 100, 0.15, 1.0);
      reservoirWaterMesh.scale.y = resFactor;
      reservoirWaterMesh.position.y = 0.1 + 0.45 * resFactor;

      // Dynamic Rainwater Cistern fill column
      const tankRatio = THREE.MathUtils.clamp(
        city.rainwater.tankStoredLitres / Math.max(1, city.rainwater.tankCapacityLitres),
        0.06,
        1.0
      );
      cisternWaterMesh.scale.y = tankRatio;
      cisternWaterMesh.position.y = 0.2 + 0.9 * tankRatio;

      // Camera Preset Flights & Zoom Buttons
      if (city.cityCameraFlyVersion !== cameraFlight.lastFlyVersion) {
        cameraFlight.lastFlyVersion = city.cityCameraFlyVersion;
        if (city.cityCameraPreset === 'overview') {
          cameraFlight.camPos.set(18, 17, 26);
          cameraFlight.targetPos.set(0, 0.8, 0);
        } else {
          const ent = CITY_ENTITIES.find((e) => e.id === city.cityCameraPreset);
          if (ent) {
            cameraFlight.targetPos.set(ent.position[0], ent.position[1], ent.position[2]);
            cameraFlight.camPos.set(
              ent.position[0] + ent.cameraOffset[0],
              ent.cameraOffset[1],
              ent.cameraOffset[2]
            );
          }
        }
        cameraFlight.active = true;
      }

      if (city.cityZoomVersion !== cameraFlight.lastZoomVersion) {
        cameraFlight.lastZoomVersion = city.cityZoomVersion;
        _v1.copy(camera.position).sub(controls.target);
        const curLen = _v1.length();
        const nextLen = THREE.MathUtils.clamp(curLen + city.cityZoomDelta, 6.5, 52);
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

      controls.autoRotate = city.cityAutoRotate && !cameraFlight.active;
      controls.autoRotateSpeed = 0.7;

      // Selection highlight ring
      if (selectedId) {
        const ent = CITY_ENTITIES.find((e) => e.id === selectedId);
        if (ent) {
          selectionRing.visible = true;
          selectionRing.position.set(ent.position[0], 0.12, ent.position[2]);
          selectionRing.rotation.z = elapsed * 0.9;
        } else {
          selectionRing.visible = false;
        }
      } else {
        selectionRing.visible = false;
      }

      // Animate water flow beads through transparent pipes
      const flowSpeedFactor = (city.pipelinePressureBar / 4.2) * (0.7 + city.demandMultiplier * 0.4);
      for (const ch of pipeChannels) {
        for (let i = 0; i < ch.beadCount; i++) {
          const t = (i / ch.beadCount + simElapsed * ch.baseSpeed * flowSpeedFactor) % 1;
          ch.curve.getPointAt(t, _v2);
          _quat.identity();
          _scale.setScalar(1);
          _mat4.compose(_v2, _quat, _scale);
          ch.beads.setMatrixAt(i, _mat4);
        }
        ch.beads.instanceMatrix.needsUpdate = true;
      }

      // Animate Pipeline Leak Spray + Accumulate Simulated Litres Lost
      if (city.leak.active) {
        const loc = LEAK_LOCATIONS[city.leak.locationId];
        leakGroup.visible = true;
        leakGroup.position.set(loc[0], loc[1], loc[2]);
        eastAlertRing.visible =
          city.leak.locationId === 'pipe-distribution' ||
          city.leak.locationId === 'pipe-residential-east';

        if (simDt > 0) {
          const pAttr = sprayGeo.getAttribute('position') as THREE.BufferAttribute;
          for (let i = 0; i < sprayCount; i++) {
            let x = pAttr.getX(i) + sprayVel[i * 3] * simDt;
            let y = pAttr.getY(i) + sprayVel[i * 3 + 1] * simDt;
            let z = pAttr.getZ(i) + sprayVel[i * 3 + 2] * simDt;
            sprayVel[i * 3 + 1] -= 5.8 * simDt;
            if (y < 0) {
              x = 0;
              y = 0.05;
              z = 0;
              const a = Math.random() * Math.PI * 2;
              const spd = 0.45 + Math.random() * 0.85;
              sprayVel[i * 3] = Math.cos(a) * spd;
              sprayVel[i * 3 + 1] = 2.0 + Math.random() * 1.6;
              sprayVel[i * 3 + 2] = Math.sin(a) * spd;
            }
            pAttr.setXYZ(i, x, y, z);
          }
          pAttr.needsUpdate = true;

          leakAccumTimer += simDt;
          if (leakAccumTimer >= 1.0) {
            const lost = calculateLeakTickLossLitres(city.leak.severityLph, leakAccumTimer);
            leakAccumTimer = 0;
            dispatchRef.current({ type: 'TICK_CITY_LEAK', litresLost: lost });
          }
        }
      } else {
        leakGroup.visible = false;
        eastAlertRing.visible = false;
      }

      // Animate Rainfall Particles when rainfallIntensity > 4 mm
      if (city.rainfallIntensity > 4) {
        rainPoints.visible = true;
        rainMat.opacity = Math.min(0.75, 0.15 + city.rainfallIntensity / 140);
        if (simDt > 0) {
          const rAttr = rainGeo.getAttribute('position') as THREE.BufferAttribute;
          const dropSpeed = 7.5 + city.rainfallIntensity * 0.08;
          for (let i = 0; i < rainCount; i++) {
            let ry = rAttr.getY(i) - dropSpeed * simDt;
            if (ry < 0) ry = 16;
            rAttr.setY(i, ry);
          }
          rAttr.needsUpdate = true;
        }
      } else {
        rainPoints.visible = false;
      }

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
          Math.PI / 2.14
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
            const entity = hits[0].object.userData.entity as CityEntity | undefined;
            if (entity) {
              focusEntityRef.current(entity.id, 'gesture');
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
              ? ((hits[0].object.userData.entity as CityEntity | undefined)?.name ?? null)
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
    <div className="relative w-full h-full overflow-hidden bg-[#040c18]">
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Future Smart City"
      />

      {hoveredEntity && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-2"
          style={{ left: hoveredEntity.x, top: hoveredEntity.y }}
        >
          <div className="rounded-lg border border-cyan-400/35 bg-[#061121]/95 px-3 py-1.5 shadow-lg">
            <div className="text-xs font-semibold text-white whitespace-nowrap">
              {hoveredEntity.entity.name}
            </div>
            <div className="text-[11px] text-cyan-300/90 whitespace-nowrap">
              {hoveredEntity.entity.subType} · Click to inspect
            </div>
          </div>
        </div>
      )}

      {webglLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#040c18]/95 p-6 text-center">
          <div className="max-w-md rounded-xl border border-cyan-500/30 bg-[#08162b] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              3D Graphics Context Paused
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              WebGL rendering was temporarily interrupted. Restoring the Future Smart City scene.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
