import * as THREE from 'three';

const _offset = new THREE.Vector3();
const _spherical = new THREE.Spherical();
const _ndc = new THREE.Vector2();

export function applyGestureOrbitToCamera(
  camera: THREE.PerspectiveCamera,
  target: THREE.Vector3,
  yawDelta: number,
  pitchDelta: number,
  minPhi: number,
  maxPhi: number
): void {
  _offset.copy(camera.position).sub(target);
  _spherical.setFromVector3(_offset);
  _spherical.theta -= yawDelta;
  _spherical.phi = THREE.MathUtils.clamp(_spherical.phi - pitchDelta, minPhi, maxPhi);
  _offset.setFromSpherical(_spherical);
  camera.position.copy(target).add(_offset);
}

export function raycastAtViewportNorm(
  normX: number,
  normY: number,
  canvas: HTMLCanvasElement,
  camera: THREE.PerspectiveCamera,
  raycaster: THREE.Raycaster,
  targets: THREE.Object3D[]
): THREE.Intersection[] {
  const rect = canvas.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return [];
  const clientX = normX * window.innerWidth;
  const clientY = normY * window.innerHeight;
  _ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  _ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(_ndc, camera);
  return raycaster.intersectObjects(targets, false);
}
