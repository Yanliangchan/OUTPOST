import * as THREE from 'three';
import { Terrain } from './world/terrain';
import { createWater } from './world/water';
import { createVegetation } from './world/vegetation';
import { createLighting } from './world/lighting';
import { createAmbient } from './world/ambient';
import { createBuildGrid, createScaleReference } from './world/scaleReference';
import { CameraRig } from './core/cameraRig';
import { timeUniform } from './core/wind';
import { createHud } from './ui/hud';

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(app.clientWidth, app.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
app.appendChild(renderer.domElement);
renderer.domElement.style.cursor = 'grab';

const scene = new THREE.Scene();
const terrain = new Terrain();
const groundY = terrain.plateauHeight;
const vegetation = createVegetation(terrain);
const grid = createBuildGrid(groundY);
const scaleRef = createScaleReference(groundY);
const ambient = createAmbient();
scene.add(terrain.mesh, createWater(terrain), vegetation, createLighting(), ambient.group, grid, scaleRef);

const rig = new CameraRig(renderer.domElement, groundY);

const hud = createHud({
  toggleGrid: () => (grid.visible = !grid.visible),
  toggleScale: () => (scaleRef.visible = !scaleRef.visible),
  resetCamera: () => rig.reset(),
});

window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  rig.resize(app.clientWidth, app.clientHeight);
});

const clock = new THREE.Clock();
let frames = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  timeUniform.value += dt;
  rig.update(dt);
  ambient.update(dt, timeUniform.value);
  renderer.render(scene, rig.camera);
  hud.tick(dt);
  frames++;
});

// Debug / screenshot hooks (dev only).
(window as unknown as Record<string, unknown>).__outpost = {
  rig,
  grid,
  scaleRef,
  renderer,
  counts: vegetation.userData.counts,
  get frames() {
    return frames;
  },
  info: () => renderer.info.render,
};
