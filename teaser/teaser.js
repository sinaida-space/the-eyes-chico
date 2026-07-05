// Deterministic 15s teaser renderer. window.SEEK(t) draws the frame at time t;
// window.AUDIO() renders the 15s soundtrack offline and returns base64 WAV.
import * as THREE from 'three';
import { createSky } from '../src/sky.js';
import { createField } from '../src/field.js';
import { createPost } from '../src/post.js';

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

// hero eye for the closeup: mid-radius, big
const heroPos = new THREE.Vector3(); let heroScale = 1;
{
  const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  for (let i = 0; i < quality.p.eyes; i++) {
    field._eyes.getMatrixAt(i, m); m.decompose(p, q, s);
    const r = Math.hypot(p.x, p.z);
    if (r > 18 && r < 45 && s.x > 1.25) { heroPos.copy(p); heroScale = s.x; break; }
    if (i === quality.p.eyes - 1) { field._eyes.getMatrixAt(0, m); m.decompose(heroPos, q, s); heroScale = s.x; }
  }
}

// ghost figure (loose import of the silhouette without its camera rig)
import { createAvatar } from '../src/avatar.js';
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

// glitch bursts at cuts + moments (post keeps internal decay; SEEK is called sequentially)
const BURSTS = [2.6, 4.2, 5.7, 8.8, 10.2, 11.35, 14.55];
let burstIdx = 0;

const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tmp = new THREE.Vector3();

function typed(el, text, t, t0, cps = 22) {
  const n = Math.floor(Math.max(0, t - t0) * cps);
  el.textContent = text.slice(0, n) + (n < text.length && (t * 3 | 0) % 2 ? '▌' : '');
}

window.SEEK = function (t) {
  const dt = 1 / 30;
  while (burstIdx < BURSTS.length && t >= BURSTS[burstIdx]) { post.burst(1.1); burstIdx++; }
  if (t < 0.01) burstIdx = 0;

  // ---- camera by shot ----
  let blackout = 0;
  if (t < 2.6) {                               // 1: terminal in the void
    blackout = 1;
    camPos.copy(V(0, 26, 80)); camLook.copy(V(0, 7, -20));
  } else if (t < 4.2) {                        // 2: the eye stares into the lens
    const k = ease(seg(t, 2.6, 4.2));
    tmp.copy(heroPos).normalize();
    const d0 = 3.0 * heroScale, d1 = 1.9 * heroScale;
    camPos.copy(heroPos).addScaledVector(tmp, lerp(d0, d1, k))
      .setY(heroPos.y + lerp(1.8, 1.2, k) * heroScale); // from above — it looks up at you
    camLook.copy(heroPos);
    field.setAvatar(camPos);                   // it looks AT you
  } else if (t < 8.8) {                        // 3: the dive
    const k = ease(seg(t, 4.2, 8.8));
    camPos.set(lerp(0, 6, k), lerp(26, 2.2, k), lerp(80, 16, k));
    camLook.set(lerp(0, 0, k), lerp(7, 1.4, k), lerp(-20, -14, k));
    field.setAvatar(FIGURE);
  } else if (t < 11.4) {                       // 4: low glide among the eyes
    const k = seg(t, 8.8, 11.4);
    camPos.set(lerp(11, 3, k), lerp(2.6, 2.2, k), lerp(4, -5, k));
    camLook.set(0, 1.4, -14);
    field.setAvatar(camPos);
  } else {                                     // 5: title void
    blackout = 1;
    camPos.copy(V(0, 26, 80)); camLook.copy(V(0, 7, -20));
  }
  camera.position.copy(camPos); camera.lookAt(camLook);
  camera.fov = t < 4.2 ? 38 : 50; camera.updateProjectionMatrix();

  // ---- overlays ----
  $('blackout').style.opacity = blackout;
  // brief red flash on the hard cut to title
  const fl = t > 11.35 && t < 11.48 ? 1 - seg(t, 11.35, 11.48) : 0;
  $('flash').style.opacity = fl * 0.85;

  const term = $('term');
  if (t > 0.7 && t < 2.6) { term.style.visibility = 'visible'; typed(term, 'C:\\> the field is watching.', t, 0.7); }
  else term.style.visibility = 'hidden';

  const q = $('question');
  if (t > 5.7 && t < 8.7) {
    q.classList.remove('hid');
    q.innerHTML = 'what did you survive<br>that you never called survival?';
    q.style.opacity = seg(t, 5.7, 6.5) * (1 - seg(t, 8.2, 8.7));
  } else q.classList.add('hid');

  const c = $('claim');
  if (t > 9.3 && t < 11.3) {
    c.classList.remove('hid');
    c.innerHTML = '50 questions.' + (t > 10.2 ? '<br>nothing is recorded.' : '');
    c.style.opacity = seg(t, 9.3, 9.8) * (1 - seg(t, 11.0, 11.3));
  } else c.classList.add('hid');

  if (t > 11.9) { $('title').classList.remove('hid'); typed($('title'), 'the eyes, chico', t, 11.9, 16); }
  else $('title').classList.add('hid');
  $('subtitle').classList.toggle('hid', t < 13.2);
  $('subtitle').style.opacity = seg(t, 13.2, 13.7);
  $('cta').classList.toggle('hid', t < 13.9);
  $('cta').style.opacity = seg(t, 13.9, 14.4);

  // ---- render ----
  sky.render(t * 0.7);
  field.update(t);
  avatar.update(dt, t); // dummy camera absorbs its rig; shimmer + drift only
  avatar.points.position.copy(FIGURE);
  const fakeSpeed = t >= 4.2 && t < 8.8 ? 6 : 1.2;
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
  filter.frequency.setValueAtTime(160, 0);
  filter.frequency.linearRampToValueAtTime(320, 8);
  filter.frequency.exponentialRampToValueAtTime(1400, 14.4);
  const droneGain = ctx.createGain();
  droneGain.gain.setValueAtTime(0, 0);
  droneGain.gain.linearRampToValueAtTime(0.055, 2);
  droneGain.gain.setValueAtTime(0.055, 14.55);
  droneGain.gain.linearRampToValueAtTime(0, 14.62); // hard tape cut
  for (const f of [54, 54.6, 108.4]) {
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
  for (let t = 0.3; t < 14.4; t += 0.25 + rnd() * 0.5) {
    if (rnd() < 0.4) continue;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = 900 + rnd() * 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02 + rnd() * 0.02, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + rnd() * 0.04);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + 0.09);
  }

  // bell when the question surfaces
  for (const [f, v] of [[523.25, 0.09], [784, 0.045], [1046.5, 0.028]]) {
    const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, 5.75);
    g.gain.exponentialRampToValueAtTime(v, 5.8);
    g.gain.exponentialRampToValueAtTime(0.0001, 8.6);
    o.connect(g); g.connect(master); o.start(5.75); o.stop(8.7);
  }

  // glitch stingers at the cuts
  for (const t of [2.6, 4.2, 8.8, 11.35]) {
    const src = ctx.createBufferSource(); src.buffer = nbuf;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.09, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    src.connect(hp); hp.connect(g); g.connect(master); src.start(t); src.stop(t + 0.12);
  }

  // sub riser into the title
  const r = ctx.createOscillator(); r.type = 'sine';
  r.frequency.setValueAtTime(40, 10.5); r.frequency.exponentialRampToValueAtTime(120, 14.4);
  const rg = ctx.createGain();
  rg.gain.setValueAtTime(0, 10.5); rg.gain.linearRampToValueAtTime(0.06, 13.8);
  rg.gain.linearRampToValueAtTime(0, 14.6);
  r.connect(rg); rg.connect(master); r.start(10.5); r.stop(14.7);

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
