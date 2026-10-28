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
import { PlanOverlay, planSummary } from './world/planOverlay';
import { Particles } from './fx/particles';
import { ClearanceSystem } from './clearance/clearanceSystem';
import { ClearanceUi } from './ui/clearanceUi';
import { gameClock } from './core/gameClock';
import { plateauZoneAt, ZONES } from './world/zones';

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
const dev = new URLSearchParams(location.search).has('dev');
const particles = new Particles();
const clearance = new ClearanceSystem(vegetation, particles);
const plan = new PlanOverlay(clearance, dev);
clearance.onChange(() => plan.refresh());
scene.add(terrain.mesh, createWater(terrain), vegetation.group, createLighting(), ambient.group, grid, scaleRef, clearance.group, particles.group, plan.group);

const rig = new CameraRig(renderer.domElement, groundY);

const hud = createHud({
  toggleGrid: () => (grid.visible = !grid.visible),
  toggleScale: () => (scaleRef.visible = !scaleRef.visible),
  resetCamera: () => rig.reset(),
  togglePlan: () => (plan.group.visible = !plan.group.visible),
  planSummary: planSummary(),
  dev,
});

const clearanceUi = new ClearanceUi(clearance, (z) => {
  if (clearance.start(z.id)) rig.focusOn((z.minX + z.maxX) / 2, (z.minZ + z.maxZ) / 2);
});
scene.add(clearanceUi.tags);

// Click (not drag) on the ground selects a land zone.
const down = new THREE.Vector2();
renderer.domElement.addEventListener('pointerdown', (e) => down.set(e.clientX, e.clientY));
renderer.domElement.addEventListener('pointerup', (e) => {
  if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
  const p = rig.groundPointAt(e.clientX, e.clientY);
  const z = p ? plateauZoneAt(p.x, p.z) : undefined;
  clearanceUi.select(z && z.kind === 'jungle' ? z : null);
});

window.addEventListener('resize', () => {
  renderer.setSize(app.clientWidth, app.clientHeight);
  rig.resize(app.clientWidth, app.clientHeight);
});

const clock = new THREE.Clock();
let frames = 0;
let planTimer = 0;
renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.1);
  timeUniform.value += dt;
  gameClock.tick(dt);
  rig.update(dt);
  ambient.update(dt, timeUniform.value);
  clearance.update(dt);
  particles.update(dt);
  clearanceUi.tick(dt);
  planTimer += dt;
  if (plan.group.visible && planTimer > 0.5) {
    plan.refresh();
    planTimer = 0;
  }
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
  counts: vegetation.counts,
  plan,
  hud,
  clearance,
  clearanceUi,
  gameClock,
  zonesList: ZONES,
  /** Instantly hide a zone's jungle (screenshot tooling only). */
  clearZone: (id: string, cleared = true) => {
    const g = vegetation.clearables[id];
    if (g) g.group.visible = !cleared;
  },
  zones: () => Object.keys(vegetation.clearables),
  get frames() {
    return frames;
  },
  info: () => renderer.info.render,
};
