import * as THREE from 'three';
import { Quality } from './quality.js';
import { createSky } from './sky.js';
import { createField } from './field.js';
import { createAvatar } from './avatar.js';
import { createPost } from './post.js';
import { AudioEngine } from './audio.js';
import { InputRouter } from './input.js';
import { QUESTIONS } from './questions.js';
import { UI } from './ui.js';

const canvas = document.getElementById('gl');
const quality = new Quality();
const ui = new UI();

const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.tier > 0, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(quality.p.pixelRatio, devicePixelRatio));
renderer.setSize(innerWidth, innerHeight);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x160409, 0.011);
const camera = new THREE.PerspectiveCamera(46, innerWidth / innerHeight, 0.1, 600);

const sky = createSky(renderer, quality);
scene.background = sky.texture;
const field = createField(scene, quality);
// the field stays hidden (sky only) until the player has entered, then rises from below
field.group.visible = false;
field.group.position.y = -30;
let riseStart = -1;
const RISE_MS = 2600;
function riseField() { field.group.visible = true; riseStart = performance.now(); }
const avatar = createAvatar(scene, camera, quality);
const post = createPost(renderer, quality);
const audio = new AudioEngine();
const router = new InputRouter();

// --- progress ---------------------------------------------------------------
let visited = new Set();
function loadProgress() {
  if (!ui.storageOK) return;
  try {
    const raw = localStorage.getItem('eyes-progress');
    if (raw) visited = new Set(JSON.parse(raw));
  } catch (e) {}
  visited.forEach(i => field.markVisited(i));
}
function saveProgress() {
  if (!ui.storageOK) return;
  try { localStorage.setItem('eyes-progress', JSON.stringify([...visited])); } catch (e) {}
}

// --- state ------------------------------------------------------------------
let running = false, exited = false, hands = null;
let nearFlower = -1;
let controlMode = 'keys';
const LEGENDS = {
  hands:   '✋ FORWARD  ✊ TURN  ✌️ DIVE  👍 PICK  🤟 FORGET',
  touch:   'DRAG=STEER · PINCH=DIVE · TAP=PICK/FORGET',
  buttons: 'HOLD THE PADS · TAP FLOWER=PICK · TAP=FORGET',
  keys:    'WASD=STEER · SCROLL=DIVE · E=PICK/FORGET · ESC=EXIT',
};
const DIVE_HINTS = {
  hands:   '▼ hold ✌️ to descend into the field',
  touch:   '▼ pinch outward to descend into the field',
  buttons: '▼ hold DIVE to descend into the field',
  keys:    '▼ scroll down to descend into the field',
};

router.on('steer', v => { if (running && !ui.bubbleOpen) avatar.onSteer(v); });
router.on('dive', a => { if (running && !ui.bubbleOpen) avatar.onDive(a * 0.9); });
router.on('halt', () => { if (running && !ui.bubbleOpen) doExit(); });
router.on('close', () => ui.closeBubble());
// ✌️ hold: dives toward the far end from where you are — in from above, out from below
let diveDir = 1;
router.on('divestart', () => { diveDir = avatar.state.dive > 0.5 ? -1 : 1; });
router.on('divehold', () => { if (running && !ui.bubbleOpen) avatar.onDive(diveDir * 0.055); });
router.on('pick', () => {
  if (!running || ui.bubbleOpen) return;
  if (nearFlower >= 0) openFlower(nearFlower);
});

async function openFlower(i) {
  avatar.halt();
  post.burst(1);
  audio.flowerTone();
  await ui.showQuestion(QUESTIONS[i]);
  visited.add(i);
  field.markVisited(i);
  saveProgress();
  ui.setCounter(visited.size, QUESTIONS.length);
  if (visited.size === QUESTIONS.length) { ui.finale(); sky.setCalm(1); post.burst(1.5); }
}

// Hand tracking starts while the terminal splash is still up, so the camera prompt
// and model download happen in the terminal's atmosphere and never over the field.
const CROSSING_LINES = [
  'C:\\> how are you feeling?',
  'C:\\> the field is waking up.',
  'C:\\> your hands will be the only thing it trusts.',
  'C:\\> breathe. nothing is recorded.',
  'C:\\> crossing over...',
];
async function wakeHands() {
  // full-screen crossing: the camera prompt and the model download both happen behind it
  const el = document.createElement('div');
  el.id = 'crossing';
  el.innerHTML = '<div class="line"></div><div class="sub">allow the camera when your browser asks<span class="cursor">_</span></div>';
  document.body.appendChild(el);
  const line = el.querySelector('.line');
  let n = 0;
  const show = () => {
    line.classList.add('fade');
    setTimeout(() => { line.textContent = CROSSING_LINES[n % CROSSING_LINES.length]; n++; line.classList.remove('fade'); }, 600);
  };
  line.textContent = CROSSING_LINES[n++];
  requestAnimationFrame(() => el.classList.add('on'));
  const timer = setInterval(show, 3200);
  const minShow = new Promise(r => setTimeout(r, 2600)); // never a flash
  await Promise.all([startHandsFlow(), minShow]);
  clearInterval(timer);
  // the splash is hidden by the caller; fade out once the field is about to rise
  el.classList.remove('on');
  setTimeout(() => el.remove(), 900);
}

async function startHandsFlow() {
  try {
    const { startHands } = await import('./hands.js');
    hands = await startHands(router, ui.glyphEl);
    controlMode = 'hands';
    ui.setHint('');
  } catch (e) {
    console.warn('hand tracking failed, falling back:', e);
    ui.setHint('hand tracking unavailable — keys/touch active');
    setTimeout(() => ui.setHint(''), 5000);
  }
  ui.setLegend(LEGENDS[controlMode]);
}

async function doExit() {
  if (exited) return;
  exited = true; running = false;
  avatar.halt();
  ui.closeBubble();
  const choice = await ui.showExit(visited.size, QUESTIONS.length);
  if (choice === 'welcome') {
    ui.showSplash();
    const mode = await ui.waitForEnter();
    if (mode === 'hands' && !hands) await wakeHands();
    ui.hideSplash();
  }
  exited = false; running = true;
}

// --- boot -------------------------------------------------------------------
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.resize();
});

quality.onDowngrade = () => {
  renderer.setPixelRatio(Math.min(quality.p.pixelRatio, devicePixelRatio));
  field.retier(); sky.retier(); post.resize();
  quality.persist(ui.storageOK);
};

(async function boot() {
  await ui.initConsent();
  loadProgress();
  ui.setCounter(visited.size, QUESTIONS.length);
  await ui.runBoot(quality.p.name, quality.canHands, quality.tier === 0 && !quality.forced);
  const touchCapable = quality.isMobile || 'ontouchstart' in window
    || new URLSearchParams(location.search).has('touch');
  if (touchCapable) {
    let saved = null;
    try { saved = localStorage.getItem('eyes-touchmode'); } catch (e) {}
    ui.initTouchChoice(saved);
  }
  const mode = await ui.waitForEnter();
  if (mode === 'hands') await wakeHands();
  ui.hideSplash();
  audio.start();
  ui.onMute(m => audio.setMuted(m));
  ui.onExit(doExit);

  router.attachKeyboardMouse(canvas);
  if (touchCapable) {
    router.attachTouch(canvas);
    controlMode = 'touch';
    if (ui.touchMode === 'buttons') {
      router.attachButtons();
      controlMode = 'buttons';
    }
    if (ui.storageOK) { try { localStorage.setItem('eyes-touchmode', ui.touchMode); } catch (e) {} }
  } else controlMode = 'keys';
  if (mode !== 'hands') ui.setLegend(LEGENDS[controlMode]);
  riseField();
  running = true;
})();

// dev hook (console-only; the field forgives curiosity)
window.__eyes = { openFlower, avatar, field, router, get visited() { return visited; } };

// --- loop -------------------------------------------------------------------
const clock = new THREE.Clock();
const tmp = new THREE.Vector3();
let hintShown = false;

renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  const t = clock.elapsedTime;

  if (riseStart >= 0) {
    const k = Math.min(1, (performance.now() - riseStart) / RISE_MS);
    field.group.position.y = -30 * Math.pow(1 - k, 3); // ease-out cubic
    if (k >= 1) riseStart = -1;
  }
  sky.render(t);
  field.update(t);
  field.setAvatar(avatar.position);

  if (running && !ui.bubbleOpen) avatar.update(dt, t);
  audio.motion(avatar.state.speed);
  quality.govern(dt);

  // contextual guidance + proximity to question flowers
  if (running && !ui.bubbleOpen && !exited) {
    if (avatar.state.dive <= 0.4) {
      nearFlower = -1;
      ui.setHint(DIVE_HINTS[controlMode]); hintShown = true;
    } else {
      nearFlower = -1;
      let best = 36; // 6 units squared
      field.questionPositions.forEach((p, i) => {
        if (visited.has(i)) return; // sunk — the abyss keeps it
        const d2 = tmp.subVectors(p, avatar.position).lengthSq();
        if (d2 < best) { best = d2; nearFlower = i; }
      });
      if (nearFlower >= 0) {
        ui.setHint({ hands: '👍 thumbs up — pick the question', touch: 'tap — pick the question',
          buttons: 'PICK — take the question', keys: 'E — pick the question' }[controlMode]);
        hintShown = true;
      } else if (Math.abs(avatar.state.speed) < 0.2 && visited.size === 0) {
        ui.setHint({ hands: '✋ open palm — glide toward a glowing flower', touch: 'drag — walk toward a glowing flower',
          buttons: 'hold ▲ — walk toward a glowing flower', keys: 'WASD — walk toward a glowing flower' }[controlMode]);
        hintShown = true;
      } else if (hintShown) { ui.setHint(''); hintShown = false; }
    }
  } else nearFlower = -1;

  post.render(scene, camera, dt, t, avatar.state.speed + avatar.state.diveVel * 4);
});

/*! Je suis le spectre d'une rose que tu portais hier au bal. Théophile Gautier, 1837 */
