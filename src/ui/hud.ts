interface HudActions {
  toggleGrid: () => void;
  toggleScale: () => void;
  resetCamera: () => void;
  togglePlan: () => void;
  planSummary: { starter: number; jungle: number; jungleZones: number; hidden: number; hiddenZones: number; total: number };
  /** Dev mode shows the secret late-game sites in the legend. */
  dev: boolean;
}

/** Phase 0 overlay: title chip, view toggles, control hints, FPS. */
export function createHud(actions: HudActions) {
  const root = document.createElement('div');
  root.className = 'hud';
  root.innerHTML = `
    <div class="chip brand"><span class="logo">▲</span><div><b>OUTPOST</b><small>Phase 1 · The World + Land clearing</small></div></div>
    <div class="toggles">
      <button data-a="grid" title="Show build grid (G)">Grid <kbd>G</kbd></button>
      <button data-a="scale" title="Show greybox scale markers (B)">Scale <kbd>B</kbd></button>
      <button data-a="plan" title="Show buildable land plan (P)">Plan <kbd>P</kbd></button>
      <button data-a="reset" title="Reset camera (R)">Reset <kbd>R</kbd></button>
    </div>
    <div class="chip hints">Drag to pan · Scroll to zoom · <kbd>WASD</kbd> move · <kbd>Q</kbd>/<kbd>E</kbd> rotate</div>
    <div class="chip fps">-- fps</div>
    <div class="chip legend" hidden>
      <b>Land</b>
      <div><i style="background:#3fd16b"></i>Open / cleared</div>
      <div><i style="background:#ffc93c"></i>Can clear next</div>
      <div><i style="background:#2bb3a3"></i>Clearing</div>
      <div><i style="background:#9aa0a3"></i>Locked</div>
      ${actions.dev ? '<div><i style="background:#b07bff"></i>Secret site (dev)<span>' + actions.planSummary.hidden + ' tiles</span></div>' : ''}
      <div class="total">Plateau<span>${actions.planSummary.starter + actions.planSummary.jungle} tiles</span></div>
      <div class="sub">Click a jungle zone to clear it</div>
    </div>`;
  document.body.appendChild(root);

  const legend = root.querySelector<HTMLElement>('.legend')!;
  const map: Record<string, () => void> = {
    grid: actions.toggleGrid,
    scale: actions.toggleScale,
    reset: actions.resetCamera,
    plan: () => {
      actions.togglePlan();
      legend.hidden = !legend.hidden;
    },
  };
  root.querySelectorAll<HTMLButtonElement>('button[data-a]').forEach((b) => {
    b.addEventListener('click', () => {
      map[b.dataset.a!]();
      if (b.dataset.a !== 'reset') b.classList.toggle('on');
    });
  });
  window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (k === 'g') root.querySelector('[data-a=grid]')!.dispatchEvent(new Event('click'));
    if (k === 'b') root.querySelector('[data-a=scale]')!.dispatchEvent(new Event('click'));
    if (k === 'p') root.querySelector('[data-a=plan]')!.dispatchEvent(new Event('click'));
  });

  const fpsEl = root.querySelector('.fps')!;
  let acc = 0;
  let n = 0;
  return {
    /** Programmatic toggle (used by screenshot tooling). */
    setPlan(on: boolean) {
      const b = root.querySelector<HTMLButtonElement>('[data-a=plan]')!;
      if (b.classList.contains('on') !== on) b.click();
    },
    tick(dt: number) {
      acc += dt;
      n++;
      if (acc > 0.5) {
        fpsEl.textContent = `${Math.round(n / acc)} fps`;
        acc = 0;
        n = 0;
      }
    },
  };
}
