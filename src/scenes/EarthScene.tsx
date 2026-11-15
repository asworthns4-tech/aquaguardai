import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EARTH_REGIONS, WaterRegion } from '../data/earthWaterData';
import {
  buildSelectedGeographyFromFeature,
  computeRecommendedDistanceForBbox,
  fetchAdminBoundaries,
  fetchCountriesLayer,
  fetchIslandsLayer,
  fetchMinorIslandsInBbox,
  findPolygonFeatureAtLatLon,
} from '../services/geoClient';
import { useAppState } from '../state/appStore';
import { GeoPolygonFeature, SelectedGeographyNode } from '../types/exhibition';
import {
  createEarthTextureBundle,
  getEarthFallbackPreviewDataUrl,
  latLonToVector3,
  vector3ToLatLon,
} from '../utils/earthTextures';
import { applyGestureOrbitToCamera, raycastAtViewportNorm } from '../utils/gestureSpatial';

const EARTH_RADIUS = 1.0;

// Pre-allocated math helpers outside render loop (zero GC)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _quat = new THREE.Quaternion();
const _proj = new THREE.Vector3();
const _localHit = new THREE.Vector3();
const _tmpRingPt = new THREE.Vector3();
const _sunDir = latLonToVector3(16, 26, 1).normalize();

function probeWebGLSupport(): { supported: boolean; isSoftwareGl: boolean } {
  try {
    const probeCanvas = document.createElement('canvas');
    const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
    if (!gl) return { supported: false, isSoftwareGl: true };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return {
      supported: true,
      isSoftwareGl: /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu),
    };
  } catch {
    return { supported: false, isSoftwareGl: true };
  }
}

function angularDistanceDeg(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = Math.PI / 180;
  const p1 = lat1 * toRad;
  const p2 = lat2 * toRad;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
  return (c * 180) / Math.PI;
}

function inferOceanSurfaceLabel(lat: number, lon: number): string {
  if (lat >= 66.5) return 'Arctic Ocean';
  if (lat <= -60) return 'Southern Ocean';
  if (lon >= 20 && lon <= 120 && lat <= 30) return 'Indian Ocean';
  if (lon > -72 && lon < 20) return 'Atlantic Ocean';
  return 'Pacific Ocean';
}

function createLatLonGraticule(radius: number): THREE.Group {
  const group = new THREE.Group();
  const minorPositions: number[] = [];
  const majorPositions: number[] = [];

  const pushArc = (target: number[], pts: THREE.Vector3[]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      target.push(pts[i].x, pts[i].y, pts[i].z, pts[i + 1].x, pts[i + 1].y, pts[i + 1].z);
    }
  };

  for (let lat = -75; lat <= 75; lat += 15) {
    const pts: THREE.Vector3[] = [];
    for (let lon = -180; lon <= 180; lon += 4) {
      pts.push(latLonToVector3(lat, lon, radius, new THREE.Vector3()));
    }
    pushArc(lat === 0 ? majorPositions : minorPositions, pts);
  }

  for (let lon = -180; lon < 180; lon += 15) {
    const pts: THREE.Vector3[] = [];
    for (let lat = -84; lat <= 84; lat += 4) {
      pts.push(latLonToVector3(lat, lon, radius, new THREE.Vector3()));
    }
    pushArc(lon === 0 ? majorPositions : minorPositions, pts);
  }

  const minorGeo = new THREE.BufferGeometry();
  minorGeo.setAttribute('position', new THREE.Float32BufferAttribute(minorPositions, 3));
  const minorMat = new THREE.LineBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.22,
  });
  group.add(new THREE.LineSegments(minorGeo, minorMat));

  const majorGeo = new THREE.BufferGeometry();
  majorGeo.setAttribute('position', new THREE.Float32BufferAttribute(majorPositions, 3));
  const majorMat = new THREE.LineBasicMaterial({
    color: 0x22d3ee,
    transparent: true,
    opacity: 0.48,
  });
  group.add(new THREE.LineSegments(majorGeo, majorMat));

  return group;
}

function buildLineGeometryFromRings(ringsList: number[][][][], radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (let fIdx = 0; fIdx < ringsList.length; fIdx++) {
    const featureRings = ringsList[fIdx];
    for (let rIdx = 0; rIdx < featureRings.length; rIdx++) {
      const ring = featureRings[rIdx];
      for (let i = 0; i < ring.length - 1; i++) {
        const [lon1, lat1] = ring[i];
        const [lon2, lat2] = ring[i + 1];
        // Skip bogus antimeridian jumps > 180 deg across the globe
        if (Math.abs(lon2 - lon1) > 170) continue;
        latLonToVector3(lat1, lon1, radius, _tmpRingPt);
        positions.push(_tmpRingPt.x, _tmpRingPt.y, _tmpRingPt.z);
        latLonToVector3(lat2, lon2, radius, _tmpRingPt);
        positions.push(_tmpRingPt.x, _tmpRingPt.y, _tmpRingPt.z);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return geo;
}

function disposeLineGroup(group: THREE.Group) {
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    if (child instanceof THREE.LineSegments) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
      else child.material.dispose();
    }
  }
}

export const EarthScene: React.FC = () => {
  const mountRef = useRef<HTMLDivElement>(null);
  const { state, dispatch, dispatchAction, focusRegion } = useAppState();

  const stateRef = useRef(state);
  stateRef.current = state;
  const focusRegionRef = useRef(focusRegion);
  focusRegionRef.current = focusRegion;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const dispatchActionRef = useRef(dispatchAction);
  dispatchActionRef.current = dispatchAction;

  const [hoveredRegion, setHoveredRegion] = useState<{
    region: WaterRegion;
    x: number;
    y: number;
  } | null>(null);
  const [hoveredGeo, setHoveredGeo] = useState<{
    feature: GeoPolygonFeature;
    x: number;
    y: number;
  } | null>(null);
  const [webglLost, setWebglLost] = useState(false);
  const [webglUnavailable, setWebglUnavailable] = useState(false);
  const [fallbackPreviewUrl, setFallbackPreviewUrl] = useState<string>('');

  // Dynamic 3D boundary layer data stored in refs so WebGL updates without remounting
  const countriesLayerRef = useRef<GeoPolygonFeature[]>([]);
  const activeCountryDetailRef = useRef<'110m' | '50m'>('110m');
  const adm1FeaturesRef = useRef<GeoPolygonFeature[]>([]);
  const adm2FeaturesRef = useRef<GeoPolygonFeature[]>([]);
  const adm3FeaturesRef = useRef<GeoPolygonFeature[]>([]);
  const islandsFeaturesRef = useRef<GeoPolygonFeature[]>([]);
  const minorIslandsFeaturesRef = useRef<GeoPolygonFeature[]>([]);

  // Three.js layer group refs
  const overlayMeshRef = useRef<THREE.Mesh | null>(null);
  const cloudMeshRef = useRef<THREE.Mesh | null>(null);
  const graticuleRef = useRef<THREE.Group | null>(null);
  const boundariesMasterGroupRef = useRef<THREE.Group | null>(null);
  const countryLinesGroupRef = useRef<THREE.Group | null>(null);
  const admLinesGroupRef = useRef<THREE.Group | null>(null);
  const islandLinesGroupRef = useRef<THREE.Group | null>(null);
  const hoverLineGroupRef = useRef<THREE.Group | null>(null);
  const selectedLineGroupRef = useRef<THREE.Group | null>(null);
  const selectedPinRef = useRef<THREE.Group | null>(null);

  const nightUniformRef = useRef<{ value: number } | null>(null);
  const texturesRef = useRef<ReturnType<typeof createEarthTextureBundle> | null>(null);
  const markerGroupsRef = useRef<Map<string, THREE.Group>>(new Map());
  const cameraFlightRef = useRef<{
    active: boolean;
    targetPos: THREE.Vector3;
    lastFlyVersion: number;
    lastDistance: number;
  }>({
    active: false,
    targetPos: new THREE.Vector3(),
    lastFlyVersion: -1,
    lastDistance: state.camera.distance,
  });

  // Helper to rebuild Three.js boundary groups cleanly
  const rebuildCountryLines = (features: GeoPolygonFeature[]) => {
    const group = countryLinesGroupRef.current;
    if (!group) return;
    disposeLineGroup(group);
    if (features.length === 0) return;
    const geo = buildLineGeometryFromRings(
      features.map((f) => f.rings),
      EARTH_RADIUS * 1.0032
    );
    const mat = new THREE.LineBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.36,
    });
    group.add(new THREE.LineSegments(geo, mat));
  };

  const rebuildAdmLines = () => {
    const group = admLinesGroupRef.current;
    if (!group) return;
    disposeLineGroup(group);

    if (adm1FeaturesRef.current.length > 0) {
      const geo1 = buildLineGeometryFromRings(
        adm1FeaturesRef.current.map((f) => f.rings),
        EARTH_RADIUS * 1.0044
      );
      const mat1 = new THREE.LineBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.56,
      });
      group.add(new THREE.LineSegments(geo1, mat1));
    }
    if (adm2FeaturesRef.current.length > 0) {
      const geo2 = buildLineGeometryFromRings(
        adm2FeaturesRef.current.map((f) => f.rings),
        EARTH_RADIUS * 1.0052
      );
      const mat2 = new THREE.LineBasicMaterial({
        color: 0x34d399,
        transparent: true,
        opacity: 0.68,
      });
      group.add(new THREE.LineSegments(geo2, mat2));
    }
    if (adm3FeaturesRef.current.length > 0) {
      const geo3 = buildLineGeometryFromRings(
        adm3FeaturesRef.current.map((f) => f.rings),
        EARTH_RADIUS * 1.0058
      );
      const mat3 = new THREE.LineBasicMaterial({
        color: 0xfbbf24,
        transparent: true,
        opacity: 0.72,
      });
      group.add(new THREE.LineSegments(geo3, mat3));
    }
  };

  const rebuildIslandLines = () => {
    const group = islandLinesGroupRef.current;
    if (!group) return;
    disposeLineGroup(group);
    const all = [...islandsFeaturesRef.current, ...minorIslandsFeaturesRef.current];
    if (all.length === 0) return;
    const geo = buildLineGeometryFromRings(
      all.map((f) => f.rings),
      EARTH_RADIUS * 1.004
    );
    const mat = new THREE.LineBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.52,
    });
    group.add(new THREE.LineSegments(geo, mat));
  };

  const rebuildHoveredLine = (feature: GeoPolygonFeature | null) => {
    const group = hoverLineGroupRef.current;
    if (!group) return;
    disposeLineGroup(group);
    if (!feature || feature.rings.length === 0) return;
    const geo = buildLineGeometryFromRings([feature.rings], EARTH_RADIUS * 1.0068);
    const mat = new THREE.LineBasicMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.92,
    });
    group.add(new THREE.LineSegments(geo, mat));
  };

  const rebuildSelectedHighlight = (geoNode: SelectedGeographyNode | null) => {
    const group = selectedLineGroupRef.current;
    const pin = selectedPinRef.current;
    if (group) {
      disposeLineGroup(group);
    }
    if (!geoNode) {
      if (pin) pin.visible = false;
      return;
    }

    // Locate rings if geoNode came from search without embedded polygon rings
    let rings = geoNode.rings;
    if (!rings || rings.length === 0) {
      const allLoaded = [
        ...adm3FeaturesRef.current,
        ...adm2FeaturesRef.current,
        ...adm1FeaturesRef.current,
        ...islandsFeaturesRef.current,
        ...countriesLayerRef.current,
      ];
      const matched = allLoaded.find(
        (f) =>
          f.id === geoNode.id ||
          (geoNode.iso3 && f.iso3 === geoNode.iso3 && f.level === geoNode.level) ||
          (f.name.toLowerCase() === geoNode.name.toLowerCase() &&
            (!geoNode.iso3 || f.iso3 === geoNode.iso3))
      );
      if (matched) rings = matched.rings;
    }

    if (group && rings && rings.length > 0) {
      const outerGeo = buildLineGeometryFromRings([rings], EARTH_RADIUS * 1.0076);
      const outerMat = new THREE.LineBasicMaterial({
        color: geoNode.level === 'island' || geoNode.level === 'archipelago' ? 0x2dd4bf : 0x22d3ee,
        transparent: true,
        opacity: 0.98,
      });
      group.add(new THREE.LineSegments(outerGeo, outerMat));
    }

    if (pin) {
      const pos = latLonToVector3(geoNode.lat, geoNode.lon, EARTH_RADIUS * 1.008);
      pin.position.copy(pos);
      _v1.copy(pos).normalize();
      _quat.setFromUnitVectors(_up, _v1);
      pin.quaternion.copy(_quat);
      pin.visible = true;
    }
  };

  // Sync overlay texture & visibility
  useEffect(() => {
    const mesh = overlayMeshRef.current;
    const bundle = texturesRef.current;
    if (!mesh || !bundle) return;
    mesh.visible = state.earthLayers.showOverlay;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.map = bundle.overlays[state.earthOverlay];
    mat.needsUpdate = true;
  }, [state.earthOverlay, state.earthLayers.showOverlay]);

  // Sync cloud, night city lights, coordinate grid & boundaries visibility
  useEffect(() => {
    if (cloudMeshRef.current) {
      cloudMeshRef.current.visible = state.earthLayers.showClouds;
    }
    if (graticuleRef.current) {
      graticuleRef.current.visible = state.earthLayers.showGrid;
    }
    if (boundariesMasterGroupRef.current) {
      boundariesMasterGroupRef.current.visible = state.earthLayers.showBoundaries;
    }
    if (nightUniformRef.current) {
      nightUniformRef.current.value = state.earthLayers.showNightLights ? 1.0 : 0.0;
    }
  }, [
    state.earthLayers.showClouds,
    state.earthLayers.showGrid,
    state.earthLayers.showNightLights,
    state.earthLayers.showBoundaries,
  ]);

  // Sync selected marker highlight scale
  useEffect(() => {
    const selectedId = state.selectedObject?.regionId ?? state.selectedObject?.id ?? null;
    markerGroupsRef.current.forEach((group, id) => {
      const isSelected = id === selectedId;
      const isFeatured = Boolean(group.userData.featured);
      group.userData.targetScale = isSelected ? 1.48 : isFeatured ? 1.15 : 1.0;
    });
  }, [state.selectedObject]);

  // Progressive Zoom-Dependent Boundary Detail (110m <-> 50m countries + close-range minor islands)
  useEffect(() => {
    let cancelled = false;
    const dist = state.camera.distance;

    if (dist <= 2.38 && activeCountryDetailRef.current !== '50m') {
      activeCountryDetailRef.current = '50m';
      fetchCountriesLayer('50m').then((feats) => {
        if (cancelled || feats.length === 0) return;
        countriesLayerRef.current = feats;
        rebuildCountryLines(feats);
        if (stateRef.current.selectedGeography) {
          rebuildSelectedHighlight(stateRef.current.selectedGeography);
        }
      });
    } else if (dist > 2.65 && activeCountryDetailRef.current !== '110m') {
      activeCountryDetailRef.current = '110m';
      fetchCountriesLayer('110m').then((feats) => {
        if (cancelled || feats.length === 0) return;
        countriesLayerRef.current = feats;
        rebuildCountryLines(feats);
      });
    }

    if (dist <= 1.98) {
      const lat = state.camera.targetLat;
      const lon = state.camera.targetLon;
      fetchMinorIslandsInBbox([lon - 18, lat - 14, lon + 18, lat + 14]).then((minor) => {
        if (cancelled) return;
        minorIslandsFeaturesRef.current = minor;
        rebuildIslandLines();
      });
    } else if (minorIslandsFeaturesRef.current.length > 0) {
      minorIslandsFeaturesRef.current = [];
      rebuildIslandLines();
    }

    return () => {
      cancelled = true;
    };
  }, [state.camera.distance, state.camera.targetLat, state.camera.targetLon]);

  // Load Islands layer when entering Island Explorer or zooming in closely
  useEffect(() => {
    let cancelled = false;
    if (
      (state.earthExplorerFocus === 'islands' || state.camera.distance <= 2.25) &&
      islandsFeaturesRef.current.length === 0
    ) {
      fetchIslandsLayer().then((islands) => {
        if (cancelled) return;
        islandsFeaturesRef.current = islands;
        rebuildIslandLines();
        if (stateRef.current.selectedGeography) {
          rebuildSelectedHighlight(stateRef.current.selectedGeography);
        }
      });
    }
    return () => {
      cancelled = true;
    };
  }, [state.earthExplorerFocus, state.camera.distance]);

  // Automatically load progressive child ADM1/ADM2/ADM3 boundaries & highlight selectedGeography
  useEffect(() => {
    let cancelled = false;
    const geo = state.selectedGeography;

    if (!geo) {
      adm1FeaturesRef.current = [];
      adm2FeaturesRef.current = [];
      adm3FeaturesRef.current = [];
      rebuildAdmLines();
      rebuildSelectedHighlight(null);
      return;
    }

    rebuildSelectedHighlight(geo);

    if (!geo.iso3) {
      adm1FeaturesRef.current = [];
      adm2FeaturesRef.current = [];
      adm3FeaturesRef.current = [];
      rebuildAdmLines();
      return;
    }

    if (geo.level === 'country') {
      adm2FeaturesRef.current = [];
      adm3FeaturesRef.current = [];
      fetchAdminBoundaries(geo.iso3, 'ADM1').then((res) => {
        if (cancelled) return;
        adm1FeaturesRef.current = res.available ? res.features : [];
        rebuildAdmLines();
      });
    } else if (geo.level === 'adm1') {
      adm3FeaturesRef.current = [];
      // Ensure ADM1 context is loaded too if selected via search
      if (adm1FeaturesRef.current.length === 0 || adm1FeaturesRef.current[0]?.iso3 !== geo.iso3) {
        fetchAdminBoundaries(geo.iso3, 'ADM1').then((res1) => {
          if (cancelled) return;
          adm1FeaturesRef.current = res1.available ? res1.features : [];
          rebuildAdmLines();
          if (stateRef.current.selectedGeography?.id === geo.id) {
            rebuildSelectedHighlight(stateRef.current.selectedGeography);
          }
        });
      }
      fetchAdminBoundaries(geo.iso3, 'ADM2', {
        parentName: geo.name,
        parentLevel: 'ADM1',
        parentBbox: geo.bbox,
      }).then((res2) => {
        if (cancelled) return;
        adm2FeaturesRef.current = res2.available ? res2.features : [];
        rebuildAdmLines();
      });
    } else if (geo.level === 'adm2') {
      const parentAdm1 = geo.breadcrumbs.find((b) => b.level === 'adm1');
      if (adm2FeaturesRef.current.length === 0 && parentAdm1) {
        fetchAdminBoundaries(geo.iso3, 'ADM2', {
          parentName: parentAdm1.name,
          parentLevel: 'ADM1',
          parentBbox: parentAdm1.bbox,
        }).then((res2) => {
          if (cancelled) return;
          adm2FeaturesRef.current = res2.available ? res2.features : [];
          rebuildAdmLines();
        });
      }
      fetchAdminBoundaries(geo.iso3, 'ADM3', {
        parentName: geo.name,
        parentLevel: 'ADM2',
        parentBbox: geo.bbox,
      }).then((res3) => {
        if (cancelled) return;
        adm3FeaturesRef.current = res3.available ? res3.features : [];
        rebuildAdmLines();
      });
    }

    return () => {
      cancelled = true;
    };
  }, [state.selectedGeography]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const { supported, isSoftwareGl } = probeWebGLSupport();
    if (!supported) {
      setWebglUnavailable(true);
      setFallbackPreviewUrl(getEarthFallbackPreviewDataUrl());
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#02050b');

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 120);
    const initPos = latLonToVector3(
      stateRef.current.camera.targetLat,
      stateRef.current.camera.targetLon,
      stateRef.current.camera.distance
    );
    camera.position.copy(initPos);

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglUnavailable(true);
      setFallbackPreviewUrl(getEarthFallbackPreviewDataUrl());
      return;
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const handleContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const handleContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const envRT = pmremGenerator.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();

    const keyLight = new THREE.DirectionalLight(0xfff8ef, 2.75);
    keyLight.position.copy(_sunDir).multiplyScalar(8);
    scene.add(keyLight);

    const hemiFill = new THREE.HemisphereLight(0x60a5fa, 0x02050b, 0.28);
    scene.add(hemiFill);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.72);
    rimLight.position.copy(_sunDir).multiplyScalar(-6);
    scene.add(rimLight);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.minDistance = 1.65;
    controls.maxDistance = 5.4;
    controls.rotateSpeed = 0.65;
    controls.zoomSpeed = 0.85;
    controls.target.set(0, 0, 0);

    controls.addEventListener('start', () => {
      cameraFlightRef.current.active = false;
      if (stateRef.current.camera.autoRotate) {
        dispatchRef.current({ type: 'TOGGLE_AUTO_ROTATE', value: false });
      }
    });

    controls.addEventListener('end', () => {
      const dist = camera.position.length();
      cameraFlightRef.current.lastDistance = dist;
      dispatchRef.current({ type: 'SET_CAMERA_DISTANCE', distance: dist });
      dispatchRef.current({
        type: 'SYNC_CAMERA_TELEMETRY',
        activeCameraId: 'earth-orbit-cam',
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
      });
    });

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const textures = createEarthTextureBundle(maxAniso);
    texturesRef.current = textures;

    const earthGroup = new THREE.Group();
    scene.add(earthGroup);

    const uNightLightsValue = { value: stateRef.current.earthLayers.showNightLights ? 1.0 : 0.0 };
    nightUniformRef.current = uNightLightsValue;

    // 1. Primary Realistic Blue Marble Earth Sphere
    const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 80, 80);
    const earthMat = new THREE.MeshStandardMaterial({
      map: textures.colorMap,
      roughnessMap: textures.roughnessMap,
      bumpMap: textures.bumpMap,
      bumpScale: 0.028,
      metalness: 0.06,
      roughness: 0.92,
      envMapIntensity: 0.42,
    });
    earthMat.onBeforeCompile = (shader) => {
      shader.uniforms.uSunDir = { value: _sunDir };
      shader.uniforms.uNightMap = { value: textures.nightLightsMap };
      shader.uniforms.uShowNightLights = uNightLightsValue;

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
varying vec3 vWorldNormal;
varying vec2 vEarthUv;
varying vec3 vWorldViewDir;`
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
vEarthUv = uv;
vWorldNormal = normalize(mat3(modelMatrix) * normal);
vec4 earthWorldPos = modelMatrix * vec4(transformed, 1.0);
vWorldViewDir = normalize(cameraPosition - earthWorldPos.xyz);`
        );

      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
uniform vec3 uSunDir;
uniform sampler2D uNightMap;
uniform float uShowNightLights;
varying vec3 vWorldNormal;
varying vec2 vEarthUv;
varying vec3 vWorldViewDir;`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
vec3 wNorm = normalize(vWorldNormal);
float sunDot = dot(wNorm, normalize(uSunDir));
float dayFactor = smoothstep(-0.16, 0.24, sunDot);
float nightMask = smoothstep(0.08, -0.22, sunDot);
float twilight = smoothstep(-0.22, 0.0, sunDot) * smoothstep(0.24, 0.0, sunDot);
float earthFresnel = pow(1.0 - max(dot(wNorm, normalize(vWorldViewDir)), 0.0), 3.6);
vec3 nightCities = texture2D(uNightMap, vEarthUv).rgb;
totalEmissiveRadiance += nightCities * (nightMask * uShowNightLights * 1.55);
totalEmissiveRadiance += vec3(0.08, 0.34, 0.68) * earthFresnel * (0.12 + 0.88 * dayFactor);
totalEmissiveRadiance += vec3(0.32, 0.14, 0.06) * twilight * earthFresnel * 0.45;`
        );
    };
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    earthGroup.add(earthMesh);

    // 2. Scientific Water Overlay Sphere
    const overlayGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.004, 64, 64);
    const overlayMat = new THREE.MeshBasicMaterial({
      map: textures.overlays[stateRef.current.earthOverlay],
      transparent: true,
      opacity: 0.84,
      depthWrite: false,
    });
    const overlayMesh = new THREE.Mesh(overlayGeo, overlayMat);
    overlayMesh.visible = stateRef.current.earthLayers.showOverlay;
    overlayMeshRef.current = overlayMesh;
    earthGroup.add(overlayMesh);

    // 3. Stage 2: 3D Geographic & Administrative Boundary Vector Layers
    const boundariesMasterGroup = new THREE.Group();
    boundariesMasterGroup.visible = stateRef.current.earthLayers.showBoundaries;
    boundariesMasterGroupRef.current = boundariesMasterGroup;
    earthGroup.add(boundariesMasterGroup);

    const countryLinesGroup = new THREE.Group();
    countryLinesGroupRef.current = countryLinesGroup;
    boundariesMasterGroup.add(countryLinesGroup);

    const admLinesGroup = new THREE.Group();
    admLinesGroupRef.current = admLinesGroup;
    boundariesMasterGroup.add(admLinesGroup);

    const islandLinesGroup = new THREE.Group();
    islandLinesGroupRef.current = islandLinesGroup;
    boundariesMasterGroup.add(islandLinesGroup);

    const hoverLineGroup = new THREE.Group();
    hoverLineGroupRef.current = hoverLineGroup;
    boundariesMasterGroup.add(hoverLineGroup);

    const selectedLineGroup = new THREE.Group();
    selectedLineGroupRef.current = selectedLineGroup;
    boundariesMasterGroup.add(selectedLineGroup);

    // Selected geographic centroid beacon pin
    const selectedPinGroup = new THREE.Group();
    selectedPinGroup.visible = false;
    const selRingGeo = new THREE.RingGeometry(0.016, 0.024, 32);
    const selRingMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    const selRing = new THREE.Mesh(selRingGeo, selRingMat);
    selRing.rotation.x = Math.PI / 2;
    selectedPinGroup.add(selRing);
    const selDotGeo = new THREE.SphereGeometry(0.0085, 12, 12);
    const selDotMat = new THREE.MeshBasicMaterial({ color: 0x67e8f9 });
    const selDot = new THREE.Mesh(selDotGeo, selDotMat);
    selDot.position.y = 0.012;
    selectedPinGroup.add(selDot);
    selectedPinRef.current = selectedPinGroup;
    boundariesMasterGroup.add(selectedPinGroup);

    // Load initial 110m global country/territory boundaries
    fetchCountriesLayer('110m').then((feats) => {
      countriesLayerRef.current = feats;
      rebuildCountryLines(feats);
      if (stateRef.current.selectedGeography) {
        rebuildSelectedHighlight(stateRef.current.selectedGeography);
      }
    });

    // 4. Optional 3D Lat/Lon Coordinate Graticule
    const graticuleGroup = createLatLonGraticule(EARTH_RADIUS * 1.007);
    graticuleGroup.visible = stateRef.current.earthLayers.showGrid;
    graticuleRef.current = graticuleGroup;
    earthGroup.add(graticuleGroup);

    // 5. Drifting Atmospheric Cloud Layer
    const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.016, 72, 72);
    const cloudMat = new THREE.MeshStandardMaterial({
      map: textures.cloudMap,
      transparent: true,
      opacity: 0.54,
      roughness: 0.96,
      metalness: 0.0,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.visible = stateRef.current.earthLayers.showClouds;
    cloudMeshRef.current = cloudMesh;
    earthGroup.add(cloudMesh);

    // 6. Outer Atmospheric Rayleigh Scattering Halo
    const atmosGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.085, 64, 64);
    const atmosMat = new THREE.ShaderMaterial({
      uniforms: {
        glowColor: { value: new THREE.Color('#38bdf8') },
        uSunDir: { value: _sunDir },
        intensity: { value: 1.05 },
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vWorldNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewPos = -mvPos.xyz;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        uniform vec3 glowColor;
        uniform vec3 uSunDir;
        uniform float intensity;
        varying vec3 vNormal;
        varying vec3 vViewPos;
        varying vec3 vWorldNormal;
        void main() {
          vec3 viewDir = normalize(vViewPos);
          float rim = pow(0.68 - dot(vNormal, viewDir), 3.6);
          float sunLit = smoothstep(-0.35, 0.55, dot(normalize(vWorldNormal), normalize(uSunDir)));
          float alpha = clamp(rim * intensity * (0.18 + 0.82 * sunLit), 0.0, 0.72);
          gl_FragColor = vec4(glowColor, alpha);
        }
      `,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(atmosGeo, atmosMat);
    scene.add(atmosMesh);

    // 7. Deep Space Multi-Magnitude Starfield
    const starCount = 1400;
    const starPos = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 18 + Math.random() * 34;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const brightness = 0.45 + Math.pow(Math.random(), 1.8) * 0.55;
      const spectral = Math.random();
      if (spectral < 0.25) {
        starColors[i * 3] = brightness;
        starColors[i * 3 + 1] = brightness * 0.92;
        starColors[i * 3 + 2] = brightness * 0.78;
      } else if (spectral < 0.65) {
        starColors[i * 3] = brightness;
        starColors[i * 3 + 1] = brightness;
        starColors[i * 3 + 2] = brightness;
      } else {
        starColors[i * 3] = brightness * 0.82;
        starColors[i * 3 + 1] = brightness * 0.92;
        starColors[i * 3 + 2] = brightness;
      }
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute('color', new THREE.BufferAttribute(starColors, 3));
    const starMat = new THREE.PointsMaterial({
      size: 0.085,
      vertexColors: true,
      transparent: true,
      opacity: 0.88,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeo, starMat);
    scene.add(stars);

    // 8. Composite 3D Interactive Regional Beacons
    const clickableMeshes: THREE.Object3D[] = [];
    const markerMap = new Map<string, THREE.Group>();

    const baseCollarGeo = new THREE.TorusGeometry(0.017, 0.0028, 8, 24);
    const outerHaloGeo = new THREE.RingGeometry(0.022, 0.029, 28);
    const stemGeo = new THREE.CylinderGeometry(0.002, 0.0032, 0.038, 8);
    const orbGeo = new THREE.OctahedronGeometry(0.012, 1);
    const hitSphereGeo = new THREE.SphereGeometry(0.044, 12, 12);
    const hitMat = new THREE.MeshBasicMaterial({ visible: false });

    for (const region of EARTH_REGIONS) {
      const markerGroup = new THREE.Group();
      const pos = latLonToVector3(region.lat, region.lon, EARTH_RADIUS * 1.005);
      markerGroup.position.copy(pos);

      _v1.copy(pos).normalize();
      _quat.setFromUnitVectors(_up, _v1);
      markerGroup.quaternion.copy(_quat);

      const accent = new THREE.Color(region.accentHex);

      const collarMat = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: region.featured ? 0.85 : 0.45,
        metalness: 0.75,
        roughness: 0.25,
      });
      const collar = new THREE.Mesh(baseCollarGeo, collarMat);
      collar.rotation.x = Math.PI / 2;
      markerGroup.add(collar);

      const stemMat = new THREE.MeshStandardMaterial({
        color: 0xe2e8f0,
        metalness: 0.85,
        roughness: 0.2,
      });
      const stem = new THREE.Mesh(stemGeo, stemMat);
      stem.position.y = 0.019;
      markerGroup.add(stem);

      const orbMat = new THREE.MeshStandardMaterial({
        color: accent,
        emissive: accent,
        emissiveIntensity: region.featured ? 1.1 : 0.65,
        metalness: 0.25,
        roughness: 0.15,
      });
      const orb = new THREE.Mesh(orbGeo, orbMat);
      orb.position.y = 0.044;
      markerGroup.add(orb);

      if (region.featured) {
        const haloMat = new THREE.MeshBasicMaterial({
          color: accent,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.72,
        });
        const halo = new THREE.Mesh(outerHaloGeo, haloMat);
        halo.rotation.x = Math.PI / 2;
        halo.position.y = 0.003;
        markerGroup.add(halo);
      }

      const hitMesh = new THREE.Mesh(hitSphereGeo, hitMat);
      hitMesh.position.y = 0.028;
      hitMesh.layers.set(1);
      hitMesh.userData.region = region;
      markerGroup.add(hitMesh);
      clickableMeshes.push(hitMesh);

      const baseScale = region.featured ? 1.15 : 1.0;
      markerGroup.scale.setScalar(baseScale);
      markerGroup.userData.featured = Boolean(region.featured);
      markerGroup.userData.targetScale = baseScale;
      markerGroup.userData.orb = orb;

      earthGroup.add(markerGroup);
      markerMap.set(region.id, markerGroup);
    }
    markerGroupsRef.current = markerMap;

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting & Spherical Spatial Hit-Testing
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(1);
    const surfaceRaycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };
    let lastHoverTime = 0;
    let lastHoveredFeatureId: string | null = null;

    const findGeoFeatureAt = (lat: number, lon: number): GeoPolygonFeature | null => {
      if (adm3FeaturesRef.current.length > 0) {
        const h3 = findPolygonFeatureAtLatLon(adm3FeaturesRef.current, lat, lon);
        if (h3) return h3;
      }
      if (adm2FeaturesRef.current.length > 0) {
        const h2 = findPolygonFeatureAtLatLon(adm2FeaturesRef.current, lat, lon);
        if (h2) return h2;
      }
      if (adm1FeaturesRef.current.length > 0) {
        const h1 = findPolygonFeatureAtLatLon(adm1FeaturesRef.current, lat, lon);
        if (h1) return h1;
      }
      if (islandsFeaturesRef.current.length > 0) {
        const hi = findPolygonFeatureAtLatLon(islandsFeaturesRef.current, lat, lon);
        if (hi) return hi;
      }
      if (countriesLayerRef.current.length > 0) {
        const hc = findPolygonFeatureAtLatLon(countriesLayerRef.current, lat, lon);
        if (hc) return hc;
      }
      return null;
    };

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = (e: PointerEvent) => {
      const moveDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (moveDist > 6) return;

      updatePointer(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);
      if (hits.length > 0) {
        const region = hits[0].object.userData.region as WaterRegion | undefined;
        if (region) {
          focusRegionRef.current(region.id);
          return;
        }
      }

      surfaceRaycaster.setFromCamera(pointer, camera);
      const surfaceHits = surfaceRaycaster.intersectObject(earthMesh, false);
      if (surfaceHits.length > 0) {
        _localHit.copy(surfaceHits[0].point);
        earthGroup.worldToLocal(_localHit);
        const { lat, lon } = vector3ToLatLon(_localHit);

        const hitFeature = findGeoFeatureAt(lat, lon);
        if (hitFeature) {
          const curGeo = stateRef.current.selectedGeography;
          const parentChain =
            curGeo && hitFeature.level !== 'country' && curGeo.iso3 === hitFeature.iso3
              ? curGeo.breadcrumbs
              : undefined;
          const selectedNode = buildSelectedGeographyFromFeature(hitFeature, parentChain);
          const dist = computeRecommendedDistanceForBbox(hitFeature.bbox, 2.08);
          dispatchActionRef.current(
            'select_geography',
            { geography: selectedNode, distance: dist },
            'mouse'
          );
          return;
        }

        // Open Ocean or Unmapped Surface Coordinates
        let nearestRegion: WaterRegion | null = null;
        let minDeg = 999;
        for (const r of EARTH_REGIONS) {
          const d = angularDistanceDeg(lat, lon, r.lat, r.lon);
          if (d < minDeg) {
            minDeg = d;
            nearestRegion = r;
          }
        }
        const closeMatch = nearestRegion && minDeg <= 12 ? nearestRegion : null;
        const oceanName = inferOceanSurfaceLabel(lat, lon);
        dispatchRef.current({
          type: 'SET_EARTH_SURFACE_POINT',
          point: {
            lat,
            lon,
            label: closeMatch ? `Near ${closeMatch.name}` : oceanName,
            countryOrBasin: closeMatch?.countryOrBasin ?? oceanName,
          },
        });
      }
    };

    const onPointerMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverTime < 55) return;
      lastHoverTime = now;

      updatePointer(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickableMeshes, false);

      if (hits.length > 0) {
        const hitObj = hits[0].object;
        const region = hitObj.userData.region as WaterRegion | undefined;
        if (region) {
          renderer.domElement.style.cursor = 'pointer';
          hitObj.getWorldPosition(_proj);
          _proj.project(camera);
          const rect = renderer.domElement.getBoundingClientRect();
          setHoveredRegion({
            region,
            x: ((_proj.x + 1) / 2) * rect.width,
            y: ((-_proj.y + 1) / 2) * rect.height,
          });
          setHoveredGeo(null);
          if (lastHoveredFeatureId !== null) {
            lastHoveredFeatureId = null;
            rebuildHoveredLine(null);
          }
          return;
        }
      }

      setHoveredRegion(null);

      // Hover over real geographic polygon borders
      if (stateRef.current.earthLayers.showBoundaries) {
        surfaceRaycaster.setFromCamera(pointer, camera);
        const surfaceHits = surfaceRaycaster.intersectObject(earthMesh, false);
        if (surfaceHits.length > 0) {
          _localHit.copy(surfaceHits[0].point);
          earthGroup.worldToLocal(_localHit);
          const { lat, lon } = vector3ToLatLon(_localHit);
          const hitFeat = findGeoFeatureAt(lat, lon);
          if (hitFeat) {
            renderer.domElement.style.cursor = 'pointer';
            const rect = renderer.domElement.getBoundingClientRect();
            setHoveredGeo({
              feature: hitFeat,
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            });
            if (lastHoveredFeatureId !== hitFeat.id) {
              lastHoveredFeatureId = hitFeat.id;
              rebuildHoveredLine(hitFeat);
            }
            return;
          }
        }
      }

      renderer.domElement.style.cursor = 'grab';
      setHoveredGeo(null);
      if (lastHoveredFeatureId !== null) {
        lastHoveredFeatureId = null;
        rebuildHoveredLine(null);
      }
    };

    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    renderer.domElement.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      if (w <= 0 || h <= 0) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    };
    window.addEventListener('resize', onResize);
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => onResize()) : null;
    resizeObserver?.observe(container);

    let frameId = 0;
    let disposed = false;
    let tabHidden = typeof document !== 'undefined' && document.hidden;
    let lastOrbitVersion = stateRef.current.gesture.orbitStep.version;
    let lastGesturePointTrigger = stateRef.current.gesture.pointerCursor.triggerCount;
    let lastGestureHoverCheck = 0;
    let lastGestureHoverLabel: string | null = null;
    const clock = new THREE.Clock();
    const onVisibilityChange = () => {
      tabHidden = document.hidden;
      if (!tabHidden) clock.getDelta();
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
      const camState = stateRef.current.camera;

      if (camState.flyToVersion !== cameraFlightRef.current.lastFlyVersion) {
        cameraFlightRef.current.lastFlyVersion = camState.flyToVersion;
        latLonToVector3(camState.targetLat, camState.targetLon, camState.distance, _v1);
        _v1.applyAxisAngle(_up, earthGroup.rotation.y);
        cameraFlightRef.current.targetPos.copy(_v1);
        cameraFlightRef.current.active = true;
        cameraFlightRef.current.lastDistance = camState.distance;
      }

      if (Math.abs(camState.distance - cameraFlightRef.current.lastDistance) > 0.005) {
        cameraFlightRef.current.lastDistance = camState.distance;
        if (!cameraFlightRef.current.active) {
          _v2.copy(camera.position).normalize().multiplyScalar(camState.distance);
          cameraFlightRef.current.targetPos.copy(_v2);
          cameraFlightRef.current.active = true;
        } else {
          cameraFlightRef.current.targetPos.normalize().multiplyScalar(camState.distance);
        }
      }

      if (cameraFlightRef.current.active) {
        const alpha = 1 - Math.exp(-5.2 * dt);
        camera.position.lerp(cameraFlightRef.current.targetPos, alpha);
        if (camera.position.distanceTo(cameraFlightRef.current.targetPos) < 0.012) {
          camera.position.copy(cameraFlightRef.current.targetPos);
          cameraFlightRef.current.active = false;
        }
      }

      if (camState.autoRotate && !cameraFlightRef.current.active) {
        earthGroup.rotation.y += camState.rotationSpeed * dt;
      }
      cloudMesh.rotation.y += 0.018 * dt;

      markerMap.forEach((group) => {
        const target = group.userData.targetScale ?? 1.0;
        const cur = group.scale.x;
        const next = THREE.MathUtils.damp(cur, target, 8, dt);
        group.scale.setScalar(next);
        const orb = group.userData.orb as THREE.Mesh | undefined;
        if (orb) orb.rotation.y = elapsed * 1.1;
      });

      const gestureState = stateRef.current.gesture;
      if (gestureState.orbitStep.version !== lastOrbitVersion) {
        lastOrbitVersion = gestureState.orbitStep.version;
        cameraFlightRef.current.active = false;
        applyGestureOrbitToCamera(
          camera,
          controls.target,
          gestureState.orbitStep.yawDelta,
          gestureState.orbitStep.pitchDelta,
          0.28,
          Math.PI - 0.28
        );
      }

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
            const region = hits[0].object.userData.region as WaterRegion | undefined;
            if (region) {
              focusRegionRef.current(region.id, 'gesture');
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
              ? ((hits[0].object.userData.region as WaterRegion | undefined)?.name ?? null)
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
      resizeObserver?.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      renderer.domElement.removeEventListener('pointermove', onPointerMove);
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);

      controls.dispose();
      textures.dispose();
      envRT.dispose();

      earthGeo.dispose();
      earthMat.dispose();
      overlayGeo.dispose();
      overlayMat.dispose();
      cloudGeo.dispose();
      cloudMat.dispose();
      atmosGeo.dispose();
      atmosMat.dispose();
      starGeo.dispose();
      starMat.dispose();

      disposeLineGroup(countryLinesGroup);
      disposeLineGroup(admLinesGroup);
      disposeLineGroup(islandLinesGroup);
      disposeLineGroup(hoverLineGroup);
      disposeLineGroup(selectedLineGroup);
      selRingGeo.dispose();
      selRingMat.dispose();
      selDotGeo.dispose();
      selDotMat.dispose();

      graticuleGroup.traverse((obj) => {
        if (obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
          else obj.material.dispose();
        }
      });

      baseCollarGeo.dispose();
      outerHaloGeo.dispose();
      stemGeo.dispose();
      orbGeo.dispose();
      hitSphereGeo.dispose();
      hitMat.dispose();
      markerMap.forEach((group) => {
        group.traverse((obj) => {
          if (obj instanceof THREE.Mesh && obj.material !== hitMat) {
            if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
            else obj.material.dispose();
          }
        });
      });

      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  if (webglUnavailable) {
    return (
      <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#02050b] p-6">
        <div className="w-full max-w-2xl rounded-xl border border-cyan-500/30 bg-[#060d1a] p-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
            <div>
              <div className="font-mono-tabular text-[11px] uppercase tracking-wider text-cyan-300">
                2D Fallback Projection · WebGL Disabled
              </div>
              <h2 className="font-display text-lg font-semibold text-white">
                Earth Observation Map
              </h2>
            </div>
            <span className="rounded border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 font-mono-tabular text-[11px] text-amber-200">
              Hardware 3D Unavailable
            </span>
          </div>
          {fallbackPreviewUrl && (
            <div className="mt-4 overflow-hidden rounded-lg border border-cyan-500/20 bg-[#02050b]">
              <img
                src={fallbackPreviewUrl}
                alt="2D Reference Earth Observation Map"
                className="h-auto w-full object-cover"
              />
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {EARTH_REGIONS.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => focusRegion(r.id, 'mouse')}
                className="rounded border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1 text-xs font-medium text-cyan-100 hover:bg-cyan-500/20"
              >
                {r.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#02050b]">
      <div
        ref={mountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        aria-label="Interactive 3D Earth Globe"
      />

      {/* Hover Tooltip over 3D Hydro Beacons */}
      {hoveredRegion && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-3 transition-opacity duration-150"
          style={{ left: hoveredRegion.x, top: hoveredRegion.y }}
        >
          <div className="rounded-lg border border-cyan-400/35 bg-[#040a14]/95 px-3 py-1.5 shadow-lg">
            <div className="text-xs font-semibold text-white whitespace-nowrap">
              {hoveredRegion.region.name}
            </div>
            <div className="text-[11px] text-cyan-300/90 whitespace-nowrap">
              {hoveredRegion.region.waterStressLevel} · Click to inspect
            </div>
          </div>
        </div>
      )}

      {/* Hover Tooltip over Real Administrative / Country / Island Boundaries */}
      {!hoveredRegion && hoveredGeo && (
        <div
          className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full pb-3"
          style={{ left: hoveredGeo.x, top: hoveredGeo.y }}
        >
          <div className="rounded-lg border border-cyan-400/40 bg-[#040a14]/95 px-3 py-1.5 shadow-lg">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-white whitespace-nowrap">
              {hoveredGeo.feature.flag && <span>{hoveredGeo.feature.flag}</span>}
              <span>{hoveredGeo.feature.name}</span>
            </div>
            <div className="font-mono-tabular text-[10px] text-cyan-300/90 whitespace-nowrap">
              {hoveredGeo.feature.levelLabel}
              {hoveredGeo.feature.iso3 ? ` · ${hoveredGeo.feature.iso3}` : ''}
              {hoveredGeo.feature.ocean ? ` · ${hoveredGeo.feature.ocean}` : ''}
              {' · Click to explore'}
            </div>
          </div>
        </div>
      )}

      {/* WebGL Context Lost Fallback */}
      {webglLost && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#02050b]/95 p-6 text-center">
          <div className="max-w-md rounded-xl border border-cyan-500/30 bg-[#060d1a] p-6">
            <h2 className="font-display text-lg font-semibold text-white">
              3D Graphics Context Paused
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              WebGL rendering was temporarily interrupted by your browser. Restoring the Living
              Planet globe automatically.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
