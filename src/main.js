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

router.on('steer', v => { if (running && !ui.bubbleOpen) avatar.onSteer(v); });
router.on('dive', a => { if (running && !ui.bubbleOpen) avatar.onDive(a * 0.9); });
router.on('halt', () => { if (running && !ui.bubbleOpen) doExit(); });
router.on('pick', () => {
  if (!running || ui.bubbleOpen) return;
  if (nearFlower >= 0) openFlower(nearFlower);
});

async function openFlower(i) {
  avatar.halt();
  const isNew = !visited.has(i);
  post.burst(1);
  audio.flowerTone();
  await ui.showQuestion(QUESTIONS[i]);
  if (isNew) {
    visited.add(i);
    field.markVisited(i);
    saveProgress();
    ui.setCounter(visited.size, QUESTIONS.length);
    if (visited.size === QUESTIONS.length) { ui.finale(); sky.setCalm(1); post.burst(1.5); }
  }
}

async function doExit() {
  if (exited) return;
  exited = true; running = false;
  avatar.halt();
  ui.closeBubble();
  await ui.showExit(visited.size, QUESTIONS.length);
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
  await ui.runBoot(quality.p.name, quality.canHands);
  const mode = await ui.waitForEnter();
  ui.hideSplash();
  audio.start();
  ui.onMute(m => audio.setMuted(m));
  ui.onExit(doExit);

  router.attachKeyboardMouse(canvas);
  if (quality.isMobile || 'ontouchstart' in window) router.attachTouch(canvas);
  if (mode === 'hands') {
    ui.setHint('starting hand tracking…');
    try {
      const { startHands } = await import('./hands.js');
      hands = await startHands(router, ui.glyphEl);
      ui.setHint('✋ steer · ✊ dive · 🤏 pick · 🖐 hold to exit');
    } catch (e) {
      console.warn('hand tracking failed, falling back:', e);
      ui.setHint('hand tracking unavailable — keys/touch active');
    }
  } else {
    ui.setHint('scroll or pinch to descend into the field');
  }
  setTimeout(() => { if (!ui.bubbleOpen) ui.setHint(''); }, 9000);
  running = true;
})();

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

  // proximity to question flowers (only when descended)
  if (running && avatar.state.dive > 0.4) {
    nearFlower = -1;
    let best = 36; // 6 units squared
    field.questionPositions.forEach((p, i) => {
      const d2 = tmp.subVectors(p, avatar.position).lengthSq();
      if (d2 < best) { best = d2; nearFlower = i; }
    });
    if (nearFlower >= 0 && !ui.bubbleOpen) {
      ui.setHint(visited.has(nearFlower) ? 'a question you already carry — pick to reread' : '🤏 / tap / E — pick the question');
      hintShown = true;
    } else if (hintShown) { ui.setHint(''); hintShown = false; }
  } else nearFlower = -1;

  post.render(scene, camera, dt, t, avatar.state.speed + avatar.state.diveVel * 4);
});
