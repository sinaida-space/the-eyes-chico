// Deterministic 15s collab reel. window.SEEK(t) draws the frame at time t;
// window.AUDIO() renders the 15s soundtrack offline and returns base64 WAV.
// Timeline: liminal glitch void → clean jumpscare → the eye LINGERS (a
// materialised nightmare, watching) → pull back, ghost line from the site's
// own copy → terminal windows side by side (@uvaliss painting / @sin.ai.da
// installation, with a static-painting and a real site "welcome screen" cameo
// swapped in) → eerie glitch walk through the field, with subliminal
// eye-glimpse cuts and the teaser question → title card → loop to the void.
import * as THREE from 'three';
import { createSky } from '../src/sky.js';
import { createField } from '../src/field.js';
import { createPost } from '../src/post.js';
import { createAvatar } from '../src/avatar.js';

const W = 1080, H = 1920, DUR = 15;
const quality = { tier: 2, isMobile: false, p: { name: 'HIGH', eyes: 110, poppies: 4200, particles: 3200, skySteps: 110, skyRes: 720, pixelRatio: 1, post: true, sphereSeg: 32 } };

const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(W, H, false);
const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x160409, 0.011);
const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 600);
const sky = createSky(renderer, quality);
scene.background = sky.texture;
const field = createField(scene, quality);
const post = createPost(renderer, quality);

// hero eye for the closeup + jumpscare — pick the most ISOLATED candidate
// (max distance to its nearest neighbor) so it reads as one clean eye, not a
// blur of overlapping irises.
const heroPos = new THREE.Vector3(); let heroScale = 1;
{
  const m = new THREE.Matrix4(), q = new THREE.Quaternion();
  const N = quality.p.eyes;
  const pos = [], scl = [];
  for (let i = 0; i < N; i++) {
    const p = new THREE.Vector3(), s = new THREE.Vector3();
    field._eyes.getMatrixAt(i, m); m.decompose(p, q, s);
    pos.push(p); scl.push(s.x);
  }
  let bestI = 0, bestScore = -1;
  for (let i = 0; i < N; i++) {
    const r = Math.hypot(pos[i].x, pos[i].z);
    if (r < 16 || r > 48 || scl[i] < 1.15) continue;
    let minD = Infinity;
    for (let j = 0; j < N; j++) {
      if (j === i) continue;
      const d = Math.hypot(pos[i].x - pos[j].x, pos[i].z - pos[j].z);
      if (d < minD) minD = d;
    }
    if (minD > bestScore) { bestScore = minD; bestI = i; }
  }
  heroPos.copy(pos[bestI]); heroScale = scl[bestI];
}

const dummyCam = new THREE.PerspectiveCamera();
const avatar = createAvatar(scene, dummyCam, quality);
const FIGURE = new THREE.Vector3(0, 0, -14);
avatar.points.position.copy(FIGURE);

const $ = id => document.getElementById(id);
const lerp = (a, b, k) => a + (b - a) * k;
const clamp01 = v => Math.max(0, Math.min(1, v));
const ease = k => k * k * (3 - 2 * k);
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const seg = (t, a, b) => clamp01((t - a) / (b - a));

// ---- collab footage: preloaded frame sequences drawn to window canvases ------
async function loadSeq(pattern, max = 400) {
  const imgs = [];
  for (let i = 1; i <= max; i++) {
    const img = new Image();
    img.src = pattern.replace('###', String(i).padStart(3, '0'));
    const ok = await new Promise(res => { img.onload = () => res(true); img.onerror = () => res(false); });
    if (!ok) break;
    imgs.push(img);
  }
  return imgs;
}
const alisaSeq = await loadSeq('assets/alisa/f###.jpg');
const projSeq = await loadSeq('assets/proj/f###.jpg');
const paintImg = new Image();
const havePaint = await new Promise(res => {
  paintImg.onload = () => res(true); paintImg.onerror = () => res(false);
  paintImg.src = 'assets/painting.jpg';
});

function drawCover(cv, img) {
  const g = cv.getContext('2d');
  const s = Math.max(cv.width / img.width, cv.height / img.height);
  const w = img.width * s, h = img.height * s;
  g.clearRect(0, 0, cv.width, cv.height);
  g.drawImage(img, (cv.width - w) / 2, (cv.height - h) / 2, w, h);
}
// deterministic blocky static — the liminal-void texture
function drawStatic(cv, frame) {
  const g = cv.getContext('2d'), B = Math.max(4, cv.width / 90);
  let s = (frame * 2246822519 + 374761393) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let y = 0; y < cv.height; y += B) for (let x = 0; x < cv.width; x += B) {
    const v = rnd();
    g.fillStyle = v > 0.95 ? '#5c0a10' : `rgb(${8 + v * 26 | 0},${2 + v * 9 | 0},${5 + v * 14 | 0})`;
    g.fillRect(x, y, B, B);
  }
}

// dual bordered windows, side by side — like a desktop of two collab documents
const winA = $('winA'), winB = $('winB'), winC = $('winC');
Object.assign(winA.style, { left: '46px', top: '660px', width: '478px', height: '760px' });
Object.assign(winB.style, { left: '556px', top: '660px', width: '478px', height: '760px' });
Object.assign(winC.style, { left: '556px', top: '660px', width: '478px', height: '760px' });

// glitch bursts at cuts + moments (post keeps internal decay; SEEK is sequential)
const BURSTS = [0.55, 0.75, 0.9, 1.25, 2.55, 3.55, 6.0, 6.15, 6.35, 6.5, 6.7, 6.85, 7.45, 7.65, 8.0, 9.0, 9.15, 9.6, 10.6, 10.75, 11.0, 12.0, 14.75];
let burstIdx = 0;

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3();

function typed(el, text, t, t0, cps = 22) {
  const n = Math.floor(Math.max(0, t - t0) * cps);
  el.textContent = text.slice(0, n) + (n < text.length && (t * 3 | 0) % 2 ? '▌' : '');
}
// CRT decode: characters resolve out of glitch glyphs instead of a clean typewriter
const GLYPHS = '!<>-_\\/[]{}=+*^#%$@~';
function glitchTyped(el, text, t, t0, cps = 20, chance = 0.14) {
  const n = Math.floor(Math.max(0, t - t0) * cps);
  let s = Math.floor(t * 997) >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  let out = '';
  for (let i = 0; i < Math.min(n, text.length); i++) {
    out += (i < n - 1 && rnd() < chance) ? GLYPHS[Math.floor(rnd() * GLYPHS.length)] : text[i];
  }
  el.textContent = out + (n < text.length && (t * 3 | 0) % 2 ? '▌' : '');
}

const QUESTION = 'what is your most treasured memory,\nand how much of it\nhave you edited?';

// eye-close framing reused by the jumpscare, the lingering shot, and the
// subliminal glimpse cuts during the walkthrough — always the SAME eye.
function eyeCam(distMul, yMul, drift) {
  tmp.copy(heroPos).normalize();
  camPos.copy(heroPos).addScaledVector(tmp, distMul * heroScale).setY(heroPos.y + yMul * heroScale);
  if (drift) { camPos.x += drift.x; camPos.z += drift.z; }
  camLook.copy(heroPos);
}

window.SEEK = function (t) {
  const dt = 1 / 30;
  while (burstIdx < BURSTS.length && t >= BURSTS[burstIdx]) { post.burst(1.1); burstIdx++; }
  if (t < 0.01) burstIdx = 0;

  // ---- camera by shot ----
  let blackout = 0, fov = 50, fakeSpeed = 1.2, watcherOnAvatar = false;
  if (t < 0.95) {                                // 1: liminal void
    blackout = 1;
    camPos.copy(V(0, 26, 80)); camLook.copy(V(0, 7, -20));
  } else if (t < 1.08) {                         // 2: JUMPSCARE — clean, legible, brief
    eyeCam(2.6, 1.5); fov = 34; watcherOnAvatar = true;
  } else if (t < 1.25) {                         // 3: black afterimage
    blackout = 1;
    camPos.copy(V(0, 26, 80)); camLook.copy(V(0, 7, -20));
  } else if (t < 2.55) {                         // 4: THE EYE LINGERS — materialised nightmare, watching
    const breathe = Math.sin((t - 1.25) * 1.7) * 0.12;
    eyeCam(3.0 + breathe, 1.5, { x: Math.sin(t * 0.6) * 0.4, z: Math.cos(t * 0.5) * 0.3 });
    fov = 36; watcherOnAvatar = true;
  } else if (t < 3.55) {                         // 5: pull back — ghost line surfaces
    const k = ease(seg(t, 2.55, 3.55));
    camPos.set(lerp(heroPos.x, 5, k), lerp(heroPos.y + 4, 5, k), lerp(heroPos.z + 8, 22, k));
    camLook.set(0, lerp(heroPos.y, 2, k), lerp(heroPos.z, -10, k));
    watcherOnAvatar = true;
  } else if (t < 7.45) {                         // 6: collab windows — the eye still lurks behind them
    const drift = { x: Math.sin(t * 0.35) * 0.6, z: Math.cos(t * 0.28) * 0.4 };
    eyeCam(4.6, 2.2, drift); fov = 42; watcherOnAvatar = true;
  } else if (t < 7.65) {                         // 7: glitch transition out of the windows
    blackout = seg(t, 7.45, 7.55) * (1 - seg(t, 7.6, 7.65));
    camPos.set(6, 6, 14); camLook.set(0, 2, -13);
  } else if (t < 12.0) {                         // 8: eerie glitch walk through the field
    const k = ease(seg(t, 7.65, 12.0));
    camPos.set(lerp(6, 6, k), lerp(6, 2.1, k), lerp(14, 16, k));
    camLook.set(0, lerp(2, 1.3, k), lerp(-13, -14.5, k));
    field.setAvatar(FIGURE);
    fakeSpeed = 5;
    // subliminal eye-glimpse cuts — the same eye, snapping into frame
    if ((t > 9.0 && t < 9.15) || (t > 10.6 && t < 10.75)) {
      eyeCam(2.9, 1.4); fov = 35; watcherOnAvatar = true;
    }
  } else {                                       // 9: title void → loop tail
    blackout = 1;
    camPos.copy(V(0, 26, 80)); camLook.copy(V(0, 7, -20));
  }
  camera.position.copy(camPos); camera.lookAt(camLook);
  camera.fov = fov; camera.updateProjectionMatrix();
  if (watcherOnAvatar) field.setAvatar(camPos);

  // ---- overlays ----
  $('blackout').style.opacity = blackout;
  const liminalOn = t < 0.95 || (t >= 1.08 && t < 1.25) || t >= 14.6;
  const lim = $('liminal');
  if (liminalOn) {
    lim.classList.remove('hid');
    const flicker = t < 0.95 ? (0.5 + 0.5 * Math.sin(t * 47)) : 1;
    lim.style.opacity = String(0.35 + 0.35 * flicker);
    drawStatic(lim, Math.floor(t * 30));
  } else lim.classList.add('hid');

  // red vignette breathes stronger while the eye lingers / lurks
  const vig = $('vignette');
  const lingering = (t >= 1.08 && t < 2.55) || (t >= 3.85 && t < 7.45) ||
    (t > 9.0 && t < 9.15) || (t > 10.6 && t < 10.75);
  vig.style.opacity = lingering ? String(0.6 + 0.25 * Math.sin(t * 2.2)) : '0.25';

  // red flash frames: pre-scare flicker + jumpscare + hard cut to title
  const preflicker = (t > 0.55 && t < 0.62) || (t > 0.75 && t < 0.8) || (t > 0.88 && t < 0.95) ? 0.22 : 0;
  const scareFlash = (t >= 0.95 && t < 1.0) ? 0.32 : 0;
  const glimpseFlash = ((t > 9.0 && t < 9.05) || (t > 10.6 && t < 10.65)) ? 0.2 : 0;
  const titleFlash = t > 12.0 && t < 12.12 ? (1 - seg(t, 12.0, 12.12)) * 0.85 : 0;
  $('flash').style.opacity = preflicker + scareFlash + glimpseFlash + titleFlash;

  // terminal line: corrupted boot text, collab header, loop-tail prompt
  const term = $('term');
  term.style.visibility = 'visible';
  if (t < 0.95) glitchTyped(term, 'C:\\> loading memory.sys', t, 0.08, 22);
  else if (t >= 3.55 && t < 7.45) typed(term, 'C:\\> ./collab  @uvaliss  x  @sin.ai.da', t, 3.6, 30);
  else if (t >= 14.6) term.textContent = 'C:\\> ' + ((t * 3 | 0) % 2 ? '▌' : '');
  else term.style.visibility = 'hidden';

  // ghost line — the site's own copy, flickers in and never fully settles
  const ghost = $('ghost');
  const ghostWin = t > 2.75 && t < 3.5;
  ghost.classList.toggle('hid', !ghostWin);
  if (ghostWin) {
    ghost.style.top = '150px';
    const flick = ((t * 6) | 0) % 3 !== 0;
    ghost.style.opacity = flick ? String(0.55 * seg(t, 2.75, 3.0)) : '0';
    ghost.textContent = 'a field that watches back.';
  }

  // ---- collab windows: side by side, with cameo swaps inside them ----
  const winsOn = t >= 3.85 && t < 7.45;
  winA.classList.toggle('hid', !winsOn);
  const showWelcome = t >= 6.35 && t < 6.7;
  winB.classList.toggle('hid', !(winsOn && !showWelcome));
  winC.classList.toggle('hid', !(winsOn && showWelcome));

  if (winsOn) {
    const showStaticPaint = t >= 6.0 && t < 6.35;
    if (showStaticPaint && havePaint) drawCover($('cvA'), paintImg);
    else if (alisaSeq.length) drawCover($('cvA'), alisaSeq[Math.floor((t - 3.85) * 30) % alisaSeq.length]);
    if (!showWelcome) {
      if (projSeq.length) drawCover($('cvB'), projSeq[Math.floor((t - 3.85) * 30) % projSeq.length]);
    }
  }

  // the question, typed over the eerie walk
  const q = $('question');
  if (t > 8.3 && t < 11.75) {
    q.classList.remove('hid');
    typed(q, QUESTION, t, 8.4, 28);
    q.style.opacity = seg(t, 8.3, 8.7) * (1 - seg(t, 11.45, 11.75));
  } else q.classList.add('hid');

  // title card
  if (t > 12.15 && t < 14.6) { $('title').classList.remove('hid'); typed($('title'), 'the eyes, chico', t, 12.15, 20); }
  else $('title').classList.add('hid');
  $('collab').classList.toggle('hid', !(t > 12.8 && t < 14.6));
  $('collab').style.opacity = seg(t, 12.8, 13.15);
  $('concept').classList.toggle('hid', !(t > 13.15 && t < 14.6));
  $('concept').style.opacity = seg(t, 13.15, 13.45);
  $('url').classList.toggle('hid', !(t > 13.85 && t < 14.6));
  $('url').style.opacity = seg(t, 13.85, 14.1);

  // ---- render ----
  sky.render(t * 0.7);
  field.update(t);
  avatar.update(dt, t);
  avatar.points.position.copy(FIGURE);
  post.render(scene, camera, dt, t, fakeSpeed);
  return true;
};

// ---- 15s soundtrack, same recipe as the site ---------------------------------
window.AUDIO = async function () {
  const sr = 44100;
  const ctx = new OfflineAudioContext(2, sr * DUR, sr);
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);

  // drone swell
  const filter = ctx.createBiquadFilter(); filter.type = 'lowpass'; filter.Q.value = 2.5;
  filter.frequency.setValueAtTime(130, 0);
  filter.frequency.linearRampToValueAtTime(260, 7);
  filter.frequency.exponentialRampToValueAtTime(1300, 12.0);
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0, 0);
  droneGain.gain.linearRampToValueAtTime(0.05, 1.8);
  droneGain.gain.setValueAtTime(0.05, 14.75);
  droneGain.gain.linearRampToValueAtTime(0, 14.82); // hard tape cut → silent loop tail
  for (const f of [50, 50.6, 100.4]) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
    o.connect(filter); o.start();
  }
  filter.connect(droneGain); droneGain.connect(master);

  // vinyl crackle bed + deterministic pops
  let s = 7; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  const nbuf = ctx.createBuffer(1, sr * 2, sr);
  const nd = nbuf.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = (rnd() * 2 - 1) * 0.5;
  const noise = ctx.createBufferSource(); noise.buffer = nbuf; noise.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6;
  const cg = ctx.createGain(); cg.gain.value = 0.013;
  noise.connect(bp); bp.connect(cg); cg.connect(master); noise.start();
  for (let t = 1.4; t < 14.6; t += 0.25 + rnd() * 0.5) {
    if (rnd() < 0.4) continue;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 900 + rnd() * 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02 + rnd() * 0.02, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + rnd() * 0.04);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.09);
  }

  // pre-scare flicker ticks
  for (const t of [0.55, 0.75, 0.88]) {
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.06);
  }

  // jumpscare stab: noise burst + sub thump
  {
    const src = ctx.createBufferSource(); src.buffer = nbuf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.34, 0.95);
    g.gain.exponentialRampToValueAtTime(0.0001, 1.1);
    src.connect(g); g.connect(master); src.start(0.95); src.stop(1.12);
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(56, 0.95); o.frequency.exponentialRampToValueAtTime(28, 1.25);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.42, 0.95);
    og.gain.exponentialRampToValueAtTime(0.0001, 1.3);
    o.connect(og); og.connect(master); o.start(0.95); o.stop(1.35);
  }

  // slow heartbeat thumps while the eye lingers — existential dread, not jump-scare
  for (const t of [1.4, 2.05]) {
    const o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(48, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.32);
  }

  // subliminal glimpse stabs during the walkthrough
  for (const t of [9.0, 10.6]) {
    const src = ctx.createBufferSource(); src.buffer = nbuf;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.16, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(g); g.connect(master); src.start(t); src.stop(t + 0.12);
  }

  // bell when the question surfaces
  for (const [f, v] of [[523.25, 0.09], [784, 0.045], [1046.5, 0.028]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 8.25);
    g.gain.exponentialRampToValueAtTime(v, 8.3);
    g.gain.exponentialRampToValueAtTime(0.0001, 11.8);
    o.connect(g); g.connect(master); o.start(8.25); o.stop(11.9);
  }

  // glitch stingers at the cuts
  for (const t of [3.55, 6.0, 6.35, 6.7, 7.45, 12.0]) {
    const src = ctx.createBufferSource(); src.buffer = nbuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    src.connect(hp); hp.connect(g); g.connect(master); src.start(t); src.stop(t + 0.11);
  }

  // sub riser into the title
  const r = ctx.createOscillator(); r.type = 'sine';
  r.frequency.setValueAtTime(38, 9.5); r.frequency.exponentialRampToValueAtTime(118, 12.05);
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0, 9.5); rg.gain.linearRampToValueAtTime(0.06, 11.7);
  rg.gain.linearRampToValueAtTime(0, 12.1);
  r.connect(rg); rg.connect(master); r.start(9.5); r.stop(12.15);

  const buf = await ctx.startRendering();
  // 16-bit stereo WAV
  const n = buf.length, out = new DataView(new ArrayBuffer(44 + n * 4));
  const wr = (o, str) => { for (let i = 0; i < str.length; i++) out.setUint8(o + i, str.charCodeAt(i)); };
  wr(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); wr(8, 'WAVEfmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true);
  out.setUint32(24, sr, true); out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true);
  out.setUint16(34, 16, true); wr(36, 'data'); out.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  let bin = ''; const bytes = new Uint8Array(out.buffer);
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(bin);
};

await document.fonts.ready;
window.SEEK(0);
window.READY = true;
