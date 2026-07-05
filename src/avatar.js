// The glowing particle silhouette — the visitor's body in the field — and the
// camera rig that dollies continuously from the full tableau down to its shoulder.
import * as THREE from 'three';

function silhouettePoints(n) {
  // draw a standing figure on an offscreen canvas, sample filled pixels
  const W = 72, H = 144;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.beginPath(); g.arc(36, 20, 11, 0, Math.PI * 2); g.fill();          // head
  g.beginPath(); g.moveTo(22, 34); g.lineTo(50, 34); g.lineTo(46, 82); // torso
  g.lineTo(26, 82); g.closePath(); g.fill();
  g.fillRect(15, 36, 8, 42); g.fillRect(49, 36, 8, 42);                // arms
  g.fillRect(26, 82, 9, 56); g.fillRect(38, 82, 9, 56);                // legs
  const px = g.getImageData(0, 0, W, H).data;
  const pts = new Float32Array(n * 3), extra = new Float32Array(n);
  let i = 0, guard = 0;
  while (i < n && guard++ < n * 400) {
    const x = Math.random() * W, y = Math.random() * H;
    if (px[((y | 0) * W + (x | 0)) * 4 + 3] > 128) {
      pts[i * 3] = (x / W - 0.5) * 0.9;
      pts[i * 3 + 1] = (1 - y / H) * 1.9;
      pts[i * 3 + 2] = (Math.random() - 0.5) * 0.28;
      extra[i] = Math.random();
      i++;
    }
  }
  return { pts, extra };
}

const AV_VERT = /* glsl */`
attribute float aRnd;
uniform float uTime;
varying float vA;
void main(){
  vec3 p = position;
  p.x += sin(uTime*1.7 + aRnd*40.0) * 0.02;
  p.y += cos(uTime*1.3 + aRnd*31.0) * 0.02;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = min((2.2 + aRnd*2.4) * (48.0 / -mv.z), 5.5);
  vA = 0.45 + 0.55 * fract(sin(aRnd*91.7 + uTime*(0.6+aRnd)) * 43758.5);
  gl_Position = projectionMatrix * mv;
}`;
const AV_FRAG = /* glsl */`
precision highp float;
varying float vA;
void main(){
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d) * vA;
  gl_FragColor = vec4(vec3(1.0, 0.96, 0.92), a);
}`;

export function createAvatar(scene, camera, quality) {
  const { pts, extra } = silhouettePoints(quality.p.particles);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(extra, 1));
  const uTime = { value: 0 };
  const mat = new THREE.ShaderMaterial({
    vertexShader: AV_VERT, fragmentShader: AV_FRAG,
    uniforms: { uTime },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);

  // movement state
  const state = {
    pos: new THREE.Vector3(0, 0, -14), // stands among the poppies at spawn, like the image
    heading: Math.PI,                  // facing the camera side
    speed: 0,
    dive: 0,        // 0 = full tableau, 1 = ground level
    steer: { x: 0, y: 0 },
    diveVel: 0,
  };

  // tableau pose reproduces the reference composition
  const TABLEAU_POS = new THREE.Vector3(0, 20, 74);
  const TABLEAU_LOOK = new THREE.Vector3(0, 7, -30);
  const camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const fwd = new THREE.Vector3();

  function update(dt, t) {
    uTime.value = t;
    // dive momentum
    state.dive = THREE.MathUtils.clamp(state.dive + state.diveVel * dt, 0, 1);
    state.diveVel *= Math.pow(0.12, dt); // decay
    // steering only matters once we've descended a little
    const drive = THREE.MathUtils.smoothstep(state.dive, 0.12, 0.45);
    state.heading -= state.steer.x * dt * 1.9 * drive;
    const targetSpeed = -state.steer.y * 7.5 * drive;
    state.speed += (targetSpeed - state.speed) * Math.min(1, dt * 3);
    fwd.set(Math.sin(state.heading), 0, Math.cos(state.heading));
    state.pos.addScaledVector(fwd, state.speed * dt);
    const r = Math.hypot(state.pos.x, state.pos.z);
    if (r > 92) { state.pos.multiplyScalar(92 / r); } // soft field edge
    points.position.copy(state.pos);
    points.rotation.y = state.heading;

    // camera: smooth interpolation tableau -> shoulder follow
    const k = THREE.MathUtils.smootherstep(state.dive, 0, 1);
    camPos.set(
      state.pos.x - fwd.x * 5.6,
      2.6,
      state.pos.z - fwd.z * 5.6
    );
    camLook.set(state.pos.x + fwd.x * 8, 1.3, state.pos.z + fwd.z * 8);
    camPos.lerpVectors(TABLEAU_POS, camPos, k);
    camLook.lerpVectors(TABLEAU_LOOK, camLook, k);
    camera.position.lerp(camPos, Math.min(1, dt * 4));
    camera.lookAt(camLook);
    camera.fov = 46 + 14 * k;
    camera.updateProjectionMatrix();
  }

  return {
    state, points, update,
    get position() { return state.pos; },
    onSteer(v) { state.steer.x = THREE.MathUtils.clamp(v.x, -1, 1); state.steer.y = THREE.MathUtils.clamp(v.y, -1, 1); },
    onDive(amount) { state.diveVel += amount; },
    halt() { state.steer.x = 0; state.steer.y = 0; state.speed = 0; },
  };
}
