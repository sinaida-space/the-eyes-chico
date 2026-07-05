// The field: ground, instanced eyeballs nested in hair tufts, instanced poppies,
// and the 50 question flowers. Eyes track the avatar in-shader.
import * as THREE from 'three';

const GLSL_NOISE = /* glsl */`
float hash13(vec3 p){ p = fract(p*0.1031); p += dot(p, p.zyx+31.32); return fract((p.x+p.y)*p.z); }
float noise3(vec3 p){
  vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
  return mix(
    mix(mix(hash13(i), hash13(i+vec3(1,0,0)), f.x), mix(hash13(i+vec3(0,1,0)), hash13(i+vec3(1,1,0)), f.x), f.y),
    mix(mix(hash13(i+vec3(0,0,1)), hash13(i+vec3(1,0,1)), f.x), mix(hash13(i+vec3(0,1,1)), hash13(i+vec3(1,1,1)), f.x), f.y), f.z);
}
float fbm(vec3 p){ float a=.5, r=0.; for(int k=0;k<4;k++){ r += a*noise3(p); p *= 2.1; a *= .5; } return r; }
`;

const EYE_VERT = /* glsl */`
attribute float aSeed;
uniform vec3 uAvatar;
varying vec3 vN; varying vec3 vWp; varying vec3 vLook; varying float vSeed;
void main(){
  vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;
  vec3 tgt = vec3(uAvatar.x, origin.y + (uAvatar.y + 1.2 - origin.y)*0.35, uAvatar.z);
  vLook = normalize(tgt - origin);
  vSeed = aSeed;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const EYE_FRAG = /* glsl */`
precision highp float;
uniform vec3 uFogC; uniform float uFogD;
varying vec3 vN; varying vec3 vWp; varying vec3 vLook; varying float vSeed;
${GLSL_NOISE}
void main(){
  vec3 n = normalize(vN);
  float fd = dot(n, normalize(vLook));
  // sclera with red marbled veins
  vec3 col = vec3(0.93, 0.88, 0.85);
  float vn = fbm(n*6.0 + vSeed*17.0);
  col = mix(col, vec3(0.70, 0.12, 0.10), smoothstep(0.56, 0.78, vn)*0.55);
  // iris color from seed: green / brown / grey
  float pick = fract(vSeed*13.7);
  vec3 irisCol = pick < 0.34 ? vec3(0.16,0.30,0.18) : (pick < 0.67 ? vec3(0.32,0.20,0.10) : vec3(0.30,0.34,0.36));
  float ring = fbm(n*26.0 + vSeed*31.0);
  float iris = smoothstep(0.80, 0.835, fd);
  col = mix(col, irisCol*(0.45 + 1.1*ring), iris);
  // limbal ring + pupil
  col = mix(col, vec3(0.04,0.02,0.02), smoothstep(0.78,0.815,fd)*(1.0-smoothstep(0.835,0.90,fd))*0.8);
  col = mix(col, vec3(0.015,0.008,0.008), smoothstep(0.950,0.962,fd));
  // lighting: bone key from above, red nebula rim
  vec3 L1 = normalize(vec3(0.25, 0.85, 0.45));
  vec3 L2 = normalize(vec3(-0.4, 0.35, -0.85));
  vec3 V = normalize(cameraPosition - vWp);
  float dif = max(dot(n, L1), 0.0);
  vec3 c = col*(0.26 + 1.15*dif) * vec3(1.0, 0.88, 0.85);
  c += vec3(1.0,0.96,0.9) * pow(max(dot(n, normalize(L1+V)), 0.0), 90.0) * 1.3;   // wet spec
  c += vec3(1.0,0.16,0.10) * pow(1.0-max(dot(n,V),0.0), 3.0) * max(dot(n,L2),0.0) * 0.8; // red rim
  float fog = 1.0 - exp(-length(cameraPosition - vWp) * uFogD);
  gl_FragColor = vec4(mix(c, uFogC, fog), 1.0);
}`;

const BUD_VERT = /* glsl */`
attribute float aPhase; attribute float aVisited;
uniform float uTime;
varying float vPulse; varying float vVisited; varying vec3 vN; varying vec3 vWp;
void main(){
  vPulse = 0.5 + 0.5*sin(uTime*2.2 + aPhase*6.2831);
  vVisited = aVisited;
  float s = 1.0 + 0.12*vPulse*(1.0-aVisited);
  vec4 wp = modelMatrix * instanceMatrix * vec4(position*s, 1.0);
  vWp = wp.xyz;
  vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const BUD_FRAG = /* glsl */`
precision highp float;
uniform vec3 uFogC; uniform float uFogD;
varying float vPulse; varying float vVisited; varying vec3 vN; varying vec3 vWp;
void main(){
  vec3 V = normalize(cameraPosition - vWp);
  float fres = pow(1.0 - max(dot(normalize(vN), V), 0.0), 1.6);
  vec3 alive = mix(vec3(0.9,0.2,0.2), vec3(1.0,0.95,0.9), fres) * (0.55 + 0.9*vPulse);
  vec3 dead  = vec3(0.25, 0.06, 0.06) * (0.4 + 0.3*fres);
  vec3 c = mix(alive, dead, vVisited);
  float fog = 1.0 - exp(-length(cameraPosition - vWp) * uFogD);
  gl_FragColor = vec4(mix(c, uFogC, fog), 1.0);
}`;

// --- canvas textures ---------------------------------------------------------
function poppyTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  for (let i = 0; i < 7; i++) { // ruffled petals
    g.save(); g.rotate((i / 7) * Math.PI * 2 + Math.random() * 0.4);
    const grad = g.createRadialGradient(0, 0, 4, 0, 38, 40);
    grad.addColorStop(0, '#4a060c'); grad.addColorStop(0.5, '#a50f1c'); grad.addColorStop(1, '#7d0a14');
    g.fillStyle = grad;
    g.beginPath(); g.ellipse(0, 30, 26, 34, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.fillStyle = '#17040a'; g.beginPath(); g.arc(0, 0, 11, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#2e0a12';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    g.beginPath(); g.arc(Math.cos(a) * 15, Math.sin(a) * 15, 2.2, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function tuftTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 96);
  for (let i = 0; i < 90; i++) { // wispy white cilia fanning up
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4;
    const len = 30 + Math.random() * 58;
    g.strokeStyle = `rgba(238,225,220,${0.14 + Math.random() * 0.3})`;
    g.lineWidth = 0.8 + Math.random();
    g.beginPath(); g.moveTo((Math.random() - 0.5) * 70, 20);
    const mx = Math.cos(a) * len, my = Math.sin(a) * len;
    g.quadraticCurveTo(mx * 0.5 + (Math.random() - 0.5) * 20, my * 0.6, mx, my);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function groundTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#060305'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = Math.random() < 0.75 ? 'rgba(20,10,10,0.5)' : 'rgba(60,12,14,0.28)';
    g.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 3);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(24, 24);
  t.colorSpace = THREE.SRGBColorSpace; return t;
}

// --- field -------------------------------------------------------------------
const FIELD_R = 85;
const rnd = (a, b) => a + Math.random() * (b - a);

export function createField(scene, quality) {
  const fogUniforms = { uFogC: { value: new THREE.Color(0x160409) }, uFogD: { value: 0.011 } };
  const uAvatar = { value: new THREE.Vector3() };
  const uTime = { value: 0 };
  const group = new THREE.Group();
  scene.add(group);

  // ground
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(320, 40).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: groundTexture() })
  );
  group.add(ground);

  // --- eyeballs + tufts (max counts allocated once; tier sets .count) --------
  const MAXE = 110;
  const eyeGeo = new THREE.SphereGeometry(1, quality.p.sphereSeg, quality.p.sphereSeg / 2);
  const seeds = new Float32Array(MAXE);
  const eyeMat = new THREE.ShaderMaterial({
    vertexShader: EYE_VERT, fragmentShader: EYE_FRAG,
    uniforms: { uAvatar, ...fogUniforms },
  });
  const eyes = new THREE.InstancedMesh(eyeGeo, eyeMat, MAXE);
  const tuftMatl = new THREE.MeshBasicMaterial({ map: tuftTexture(), transparent: true, alphaTest: 0.12, side: THREE.DoubleSide, depthWrite: false, fog: true });
  const tuftGeoA = new THREE.PlaneGeometry(3.4, 3.4);
  const tuftGeoB = new THREE.PlaneGeometry(3.4, 3.4).rotateY(Math.PI / 2);
  const tuftA = new THREE.InstancedMesh(tuftGeoA, tuftMatl, MAXE);
  const tuftB = new THREE.InstancedMesh(tuftGeoB, tuftMatl, MAXE);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    for (let i = 0; i < MAXE; i++) {
      const a = Math.random() * Math.PI * 2, r = 6 + Math.pow(Math.random(), 0.7) * FIELD_R;
      const s = rnd(0.7, 1.7);
      pos.set(Math.cos(a) * r, s * 0.55, Math.sin(a) * r);
      q.setFromEuler(new THREE.Euler(rnd(-0.15, 0.15), rnd(0, Math.PI * 2), rnd(-0.15, 0.15)));
      m.compose(pos, q, sc.set(s, s, s));
      eyes.setMatrixAt(i, m);
      seeds[i] = Math.random();
      m.compose(pos.clone().setY(s * 0.35), q, sc.set(s, s, s));
      tuftA.setMatrixAt(i, m); tuftB.setMatrixAt(i, m);
    }
  }
  eyeGeo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  group.add(eyes, tuftA, tuftB);

  // --- poppies: two crossed instanced quads -----------------------------------
  const MAXP = 4200;
  const popMat = new THREE.MeshBasicMaterial({ map: poppyTexture(), alphaTest: 0.35, side: THREE.DoubleSide, fog: true });
  const popGeoA = new THREE.PlaneGeometry(1, 1);
  const popGeoB = new THREE.PlaneGeometry(1, 1).rotateY(Math.PI / 2);
  const popA = new THREE.InstancedMesh(popGeoA, popMat, MAXP);
  const popB = new THREE.InstancedMesh(popGeoB, popMat, MAXP);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), pos = new THREE.Vector3();
    for (let i = 0; i < MAXP; i++) {
      const a = Math.random() * Math.PI * 2, r = 3 + Math.sqrt(Math.random()) * (FIELD_R + 25);
      const s = rnd(0.85, 1.6);
      pos.set(Math.cos(a) * r, s * 0.5, Math.sin(a) * r);
      q.setFromEuler(new THREE.Euler(0, rnd(0, Math.PI * 2), rnd(-0.12, 0.12)));
      m.compose(pos, q, sc.set(s, s, s));
      popA.setMatrixAt(i, m); popB.setMatrixAt(i, m);
    }
  }
  group.add(popA, popB);

  // --- 50 question flowers -----------------------------------------------------
  const NQ = 50;
  const questionPositions = [];
  const stemMat = new THREE.MeshBasicMaterial({ color: 0x3a0d12, fog: true });
  const stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.08, 2.4, 5), stemMat, NQ);
  const budGeo = new THREE.SphereGeometry(0.42, 14, 12).scale(1, 1.35, 1);
  const phases = new Float32Array(NQ), visited = new Float32Array(NQ);
  const budMat = new THREE.ShaderMaterial({
    vertexShader: BUD_VERT, fragmentShader: BUD_FRAG,
    uniforms: { uTime, ...fogUniforms },
  });
  const buds = new THREE.InstancedMesh(budGeo, budMat, NQ);
  {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1), pos = new THREE.Vector3();
    for (let i = 0; i < NQ; i++) {
      const a = (i / NQ) * Math.PI * 2 + rnd(-0.25, 0.25);
      const r = 8 + (i % 5) * (FIELD_R - 12) / 5 + rnd(0, 8);
      pos.set(Math.cos(a) * r, 1.2, Math.sin(a) * r);
      questionPositions.push(pos.clone());
      q.setFromEuler(new THREE.Euler(rnd(-0.1, 0.1), 0, rnd(-0.1, 0.1)));
      m.compose(pos, q, one); stems.setMatrixAt(i, m);
      m.compose(pos.clone().setY(2.55), q, one); buds.setMatrixAt(i, m);
      phases[i] = Math.random();
    }
  }
  budGeo.setAttribute('aPhase', new THREE.InstancedBufferAttribute(phases, 1));
  const aVisited = new THREE.InstancedBufferAttribute(visited, 1);
  budGeo.setAttribute('aVisited', aVisited);
  group.add(stems, buds);

  function retier() {
    eyes.count = quality.p.eyes; tuftA.count = quality.p.eyes; tuftB.count = quality.p.eyes;
    popA.count = quality.p.poppies; popB.count = quality.p.poppies;
  }
  retier();

  return {
    questionPositions,
    markVisited(i, on = true) { visited[i] = on ? 1 : 0; aVisited.needsUpdate = true; },
    setAvatar(v) { uAvatar.value.copy(v); },
    update(t) { uTime.value = t; },
    retier,
  };
}
