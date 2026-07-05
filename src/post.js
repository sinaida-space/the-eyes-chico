// Journey texture: one fullscreen pass — RGB delay tied to speed, VHS scanlines
// and tape noise, glitch bursts on flower picks. Skipped entirely on low tier.
import * as THREE from 'three';

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D tScene;
uniform float uTime, uShift, uGlitch;
varying vec2 vUv;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void main(){
  vec2 uv = vUv;
  // glitch: horizontal band displacement
  if (uGlitch > 0.01) {
    float band = step(0.92 - uGlitch*0.25, hash(vec2(floor(uv.y*36.0), floor(uTime*24.0))));
    uv.x += band * (hash(vec2(floor(uv.y*36.0), floor(uTime*24.0)+1.0)) - 0.5) * 0.12 * uGlitch;
  }
  // rgb delay
  float s = uShift + uGlitch*0.01;
  vec3 c;
  c.r = texture2D(tScene, uv + vec2(s, 0.0)).r;
  c.g = texture2D(tScene, uv).g;
  c.b = texture2D(tScene, uv - vec2(s, 0.0)).b;
  // vhs scanlines + tape noise
  c *= 0.90 + 0.10 * sin(uv.y * 900.0 + uTime * 8.0);
  c += (hash(uv * vec2(1441.0, 907.0) + fract(uTime)) - 0.5) * 0.055;
  // tracking flutter at the very bottom
  c *= 1.0 - 0.25*smoothstep(0.985, 1.0, uv.y + 0.008*sin(uTime*3.0));
  // vignette
  float v = length(uv - 0.5);
  c *= 1.0 - v*v*0.55;
  gl_FragColor = vec4(c, 1.0);
}`;

export function createPost(renderer, quality) {
  let rt = null;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    tScene: { value: null },
    uTime: { value: 0 }, uShift: { value: 0 }, uGlitch: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    fragmentShader: FRAG,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    uniforms, depthTest: false, depthWrite: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));
  let glitch = 0;

  function resize() {
    if (rt) rt.dispose();
    const dpr = renderer.getPixelRatio();
    rt = new THREE.WebGLRenderTarget(
      Math.round(renderer.domElement.clientWidth * dpr),
      Math.round(renderer.domElement.clientHeight * dpr)
    );
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    uniforms.tScene.value = rt.texture;
  }
  resize();

  return {
    get enabled() { return quality.p.post; },
    resize,
    burst(strength = 1) { glitch = Math.min(1.5, glitch + strength); },
    render(mainScene, mainCam, dt, t, speed) {
      if (!quality.p.post) { renderer.setRenderTarget(null); renderer.render(mainScene, mainCam); return; }
      glitch = Math.max(0, glitch - dt * 2.2);
      uniforms.uTime.value = t;
      uniforms.uGlitch.value = glitch;
      uniforms.uShift.value = 0.0006 + Math.min(0.005, Math.abs(speed) * 0.0006) + glitch * 0.002;
      renderer.setRenderTarget(rt);
      renderer.render(mainScene, mainCam);
      renderer.setRenderTarget(null);
      renderer.render(scene, cam);
    },
  };
}
