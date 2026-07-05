// MediaPipe hand tracking → router events. Loaded lazily, only after the user
// explicitly chooses hand mode. All processing stays in the browser; the model
// files are fetched from jsDelivr/Google CDN (disclosed on splash + privacy page).
// Grammar: ✋ palm = forward · ✊ fist = turn right · ✌️ peace = dive in/out ·
//          👍 thumbs up = pick · 🤟 I-love-you = close the question.
const CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';

export async function startHands(router, glyphEl) {
  const vision = await import(`${CDN}/vision_bundle.mjs`);
  const files = await vision.FilesetResolver.forVisionTasks(`${CDN}/wasm`);
  const lm = await vision.HandLandmarker.createFromOptions(files, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    numHands: 1, runningMode: 'VIDEO',
  });

  const video = document.createElement('video');
  video.playsInline = true; video.muted = true;
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: 320, height: 240, facingMode: 'user' },
  });
  video.srcObject = stream;
  await video.play();

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) || 0);
  let pickLatch = false, closeLatch = false, diveHeld = false, stopped = false;
  let lastVideoTime = -1;
  let rawG = 'none', stableFor = 0;

  function classify(l) {
    const wrist = l[0], mcp = l[9];
    const size = dist(wrist, mcp) || 1e-4; // scale reference
    const isCurled = t => dist(l[t], wrist) < dist(l[t - 2], wrist) + size * 0.1;
    const c = { i: isCurled(8), m: isCurled(12), r: isCurled(16), p: isCurled(20) };
    const thumbUp = l[4].y < wrist.y - size * 0.35 && dist(l[4], l[9]) > size * 0.55;
    if (!c.i && !c.m && c.r && c.p) return 'victory';           // ✌️
    if (!c.i && c.m && c.r && !c.p) return 'ily';               // 🤟
    if (c.i && c.m && c.r && c.p) return thumbUp ? 'thumbs' : 'fist'; // 👍 / ✊
    if (!c.i && !c.m && !c.r && !c.p) return 'palm';            // ✋
    return 'none';
  }

  function loop(now) {
    if (stopped) return;
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const res = lm.detectForVideo(video, now);
      const l = res.landmarks && res.landmarks[0];
      let g = 'none';
      if (l) g = classify(l);
      // temporal debounce: hand-shape transitions flicker through other gestures
      // for a frame or two — never fire a discrete action on a flicker
      if (g === rawG) stableFor++; else { rawG = g; stableFor = 1; }
      const need = (g === 'thumbs' || g === 'ily') ? 5 : 2;
      if (stableFor < need) g = 'none';
      switch (g) {
        case 'palm':    // glide forward
          router.emit('steer', { x: 0, y: -1 });
          glyphEl.textContent = '✋'; break;
        case 'fist':    // turn — always clockwise, release to stop
          router.emit('steer', { x: 0.75, y: 0 });
          glyphEl.textContent = '✊'; break;
        case 'victory': // dive in / out, hold to travel
          if (!diveHeld) { router.emit('divestart'); diveHeld = true; }
          router.emit('divehold');
          router.emit('steer', { x: 0, y: 0 });
          glyphEl.textContent = '✌️'; break;
        case 'thumbs':  // pick the question
          if (!pickLatch) { router.emit('pick'); pickLatch = true; }
          router.emit('steer', { x: 0, y: 0 });
          glyphEl.textContent = '👍'; break;
        case 'ily':     // close it, let it sink
          if (!closeLatch) { router.emit('close'); closeLatch = true; }
          router.emit('steer', { x: 0, y: 0 });
          glyphEl.textContent = '🤟'; break;
        default:
          router.emit('steer', { x: 0, y: 0 });
          glyphEl.textContent = l ? '·' : '';
      }
      if (g !== 'thumbs') pickLatch = false;
      if (g !== 'ily') closeLatch = false;
      if (g !== 'victory') diveHeld = false;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  return {
    stop() {
      stopped = true;
      stream.getTracks().forEach(t => t.stop());
      lm.close();
    },
  };
}
