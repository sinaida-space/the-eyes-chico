// MediaPipe hand tracking → router events. Loaded lazily, only after the user
// explicitly chooses hand mode. All processing stays in the browser; the model
// files are fetched from jsDelivr/Google CDN (disclosed on splash + privacy page).
// Grammar: open palm = steer · held fist = dive · pinch = pick · flat palm 1s = halt.
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
  let palmSince = 0, pinchLatch = false, pointLatch = false, stopped = false;
  let lastVideoTime = -1;

  function classify(l) {
    const wrist = l[0], mcp = l[9];
    const size = dist(wrist, mcp) || 1e-4; // scale reference
    const isCurled = t => dist(l[t], wrist) < dist(l[t - 2], wrist) + size * 0.1;
    const c = { i: isCurled(8), m: isCurled(12), r: isCurled(16), p: isCurled(20) };
    const curled = c.i + c.m + c.r + c.p;
    const pinch = dist(l[4], l[8]) < size * 0.45;
    if (pinch && curled < 3) return 'pinch';
    // index up, rest curled, fingertip above the wrist → "let it sink"
    if (!c.i && c.m && c.r && c.p && l[8].y < wrist.y - size * 0.5) return 'point';
    if (curled >= 3) return 'fist';
    return 'palm';
  }

  function loop(now) {
    if (stopped) return;
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      const res = lm.detectForVideo(video, now);
      const l = res.landmarks && res.landmarks[0];
      if (l) {
        const g = classify(l);
        const cx = 1 - l[9].x, cy = l[9].y; // mirror x
        if (g === 'palm') {
          // dead zone in the middle 20%
          const dx = (cx - 0.5) * 2, dy = (cy - 0.5) * 2;
          const dead = v => Math.abs(v) < 0.2 ? 0 : Math.sign(v) * (Math.abs(v) - 0.2) / 0.8;
          router.emit('steer', { x: dead(dx) * 1.4, y: dead(dy) * 1.4 });
          glyphEl.textContent = '✋';
          if (Math.abs(dead(dx)) < 0.01 && Math.abs(dead(dy)) < 0.01) {
            if (!palmSince) palmSince = now;
            else if (now - palmSince > 1000) { router.emit('halt'); palmSince = 0; }
          } else palmSince = 0;
          pinchLatch = false;
        } else if (g === 'fist') {
          router.emit('steer', { x: 0, y: 0 });
          router.emit('dive', 0.05);
          glyphEl.textContent = '✊';
          palmSince = 0; pinchLatch = false;
        } else if (g === 'pinch') {
          if (!pinchLatch) { router.emit('pick'); pinchLatch = true; }
          glyphEl.textContent = '🤏';
          palmSince = 0;
        } else if (g === 'point') {
          if (!pointLatch) { router.emit('close'); pointLatch = true; }
          glyphEl.textContent = '☝';
          palmSince = 0;
        }
        if (g !== 'point') pointLatch = false;
      } else {
        glyphEl.textContent = '·';
        router.emit('steer', { x: 0, y: 0 });
        palmSince = 0;
      }
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
