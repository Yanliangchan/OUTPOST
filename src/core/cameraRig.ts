import * as THREE from 'three';
import { CAMERA } from '../config/world';
import { clamp } from './rng';

const DEG = Math.PI / 180;

/**
 * Elevated three-quarter orthographic camera.
 * Drag to pan, wheel to zoom toward the cursor, WASD/arrows to pan, Q/E to rotate 90°.
 */
export class CameraRig {
  readonly camera: THREE.OrthographicCamera;
  readonly target = new THREE.Vector3();
  private goalTarget = new THREE.Vector3();
  private yaw = CAMERA.yawDeg * DEG;
  private goalYaw = this.yaw;
  private zoom = CAMERA.zoomStart;
  private goalZoom = CAMERA.zoomStart;
  private readonly pitch = CAMERA.pitchDeg * DEG;
  private zoomAnchor: THREE.Vector3 | null = null;
  private keys = new Set<string>();
  private dragging = false;
  private last = new THREE.Vector2();
  private readonly ray = new THREE.Raycaster();
  private readonly ground: THREE.Plane;

  constructor(private readonly dom: HTMLElement, groundY: number) {
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 500);
    this.target.set(0, groundY, 0);
    this.goalTarget.copy(this.target);
    this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), -groundY);
    this.bind();
    this.resize(dom.clientWidth, dom.clientHeight);
    this.apply();
  }

  private bind() {
    const el = this.dom;
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('pointerdown', (e) => {
      this.dragging = true;
      this.last.set(e.clientX, e.clientY);
      el.setPointerCapture(e.pointerId);
      el.style.cursor = 'grabbing';
    });
    el.addEventListener('pointerup', (e) => {
      this.dragging = false;
      el.releasePointerCapture(e.pointerId);
      el.style.cursor = 'grab';
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.dragging) return;
      const dx = e.clientX - this.last.x;
      const dy = e.clientY - this.last.y;
      this.last.set(e.clientX, e.clientY);
      this.panPixels(dx, dy);
    });
    el.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        this.zoomAnchor = this.groundPointAt(e.clientX, e.clientY);
        this.goalZoom = clamp(this.goalZoom * Math.exp(-e.deltaY * 0.0012), CAMERA.zoomMin, CAMERA.zoomMax);
      },
      { passive: false },
    );
    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'q') this.goalYaw -= Math.PI / 2;
      else if (k === 'e') this.goalYaw += Math.PI / 2;
      else if (k === 'r') this.reset();
      else this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private get worldPerPixel() {
    return (2 * CAMERA.viewHalfHeight) / this.zoom / this.dom.clientHeight;
  }

  private basis() {
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    return { forward, right };
  }

  panPixels(dx: number, dy: number) {
    const { forward, right } = this.basis();
    const w = this.worldPerPixel;
    this.goalTarget.addScaledVector(right, -dx * w);
    this.goalTarget.addScaledVector(forward, (dy * w) / Math.sin(this.pitch));
    this.clampGoal();
    this.target.copy(this.goalTarget); // direct manipulation feels best unsmoothed
  }

  private clampGoal() {
    const b = CAMERA.boundsHalf;
    this.goalTarget.x = clamp(this.goalTarget.x, -b, b);
    this.goalTarget.z = clamp(this.goalTarget.z, -b, b);
  }

  private groundPointAt(cx: number, cy: number): THREE.Vector3 | null {
    const rect = this.dom.getBoundingClientRect();
    const ndc = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    return this.ray.ray.intersectPlane(this.ground, new THREE.Vector3());
  }

  reset() {
    this.goalTarget.set(0, this.target.y, 0);
    this.goalZoom = CAMERA.zoomStart;
    this.goalYaw = Math.round((this.goalYaw - CAMERA.yawDeg * DEG) / (2 * Math.PI)) * 2 * Math.PI + CAMERA.yawDeg * DEG;
  }

  /** Jump straight to a view (used by screenshot tooling and future cutscenes). */
  setView(x: number, z: number, zoom: number, yawDeg = CAMERA.yawDeg) {
    this.goalTarget.set(x, this.target.y, z);
    this.target.copy(this.goalTarget);
    this.zoom = this.goalZoom = zoom;
    this.yaw = this.goalYaw = yawDeg * DEG;
    this.apply();
  }

  resize(w: number, h: number) {
    const aspect = w / Math.max(h, 1);
    const hh = CAMERA.viewHalfHeight;
    Object.assign(this.camera, { left: -hh * aspect, right: hh * aspect, top: hh, bottom: -hh });
    this.camera.updateProjectionMatrix();
  }

  update(dt: number) {
    // Keyboard panning
    const { forward, right } = this.basis();
    const speed = (CAMERA.keyPanSpeed * dt) / this.zoom;
    const k = this.keys;
    if (k.has('w') || k.has('arrowup')) this.goalTarget.addScaledVector(forward, speed);
    if (k.has('s') || k.has('arrowdown')) this.goalTarget.addScaledVector(forward, -speed);
    if (k.has('d') || k.has('arrowright')) this.goalTarget.addScaledVector(right, speed);
    if (k.has('a') || k.has('arrowleft')) this.goalTarget.addScaledVector(right, -speed);
    this.clampGoal();

    // Smooth zoom, keeping the point under the cursor fixed.
    const z0 = this.zoom;
    this.zoom += (this.goalZoom - this.zoom) * (1 - Math.exp(-CAMERA.zoomSmoothing * dt));
    if (this.zoomAnchor && Math.abs(this.zoom - z0) > 1e-5) {
      const f = 1 - z0 / this.zoom;
      this.goalTarget.x += (this.zoomAnchor.x - this.goalTarget.x) * f;
      this.goalTarget.z += (this.zoomAnchor.z - this.goalTarget.z) * f;
      this.target.x += (this.zoomAnchor.x - this.target.x) * f;
      this.target.z += (this.zoomAnchor.z - this.target.z) * f;
      this.clampGoal();
    }

    this.target.lerp(this.goalTarget, 1 - Math.exp(-CAMERA.panSmoothing * dt));
    this.yaw += (this.goalYaw - this.yaw) * (1 - Math.exp(-CAMERA.rotateSmoothing * dt));
    this.apply();
  }

  private apply() {
    const dist = 120;
    const cp = Math.cos(this.pitch);
    this.camera.position.set(
      this.target.x + Math.sin(this.yaw) * cp * dist,
      this.target.y + Math.sin(this.pitch) * dist,
      this.target.z + Math.cos(this.yaw) * cp * dist,
    );
    this.camera.zoom = this.zoom;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(this.target);
  }
}
