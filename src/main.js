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
  hands:   '✋ FORWARD  ✊ TURN  ✌️ DIVE  👍 PICK  🤟 CLOSE',
  touch:   'DRAG=STEER · PINCH=DIVE · TAP=PICK/CLOSE',
  buttons: 'HOLD THE PADS · TAP FLOWER=PICK · TAP=CLOSE',
  keys:    'WASD=STEER · SCROLL=DIVE · E=PICK/CLOSE · ESC=EXIT',
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

async function startHandsFlow() {
  ui.setHint('starting hand tracking…');
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
    ui.hideSplash();
    if (mode === 'hands' && !hands) await startHandsFlow();
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
  if (mode === 'hands') await startHandsFlow();
  else ui.setLegend(LEGENDS[controlMode]);
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
