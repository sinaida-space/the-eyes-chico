// Nebula sky — the user's log-polar domain-warp fBm raymarch, recolored to the
// reference image: deep-red vortex ringed around a star-filled void.
// Rendered into a low-res render target each frame and used as scene.background,
// so the march cost is independent of screen resolution.

// Based on source that has SPDX-License-Identifier: MIT
// Source Copyright (c) 2026 @YoheiNishitsuji
// [LICENSE] https://opensource.org/licenses/MIT

import * as THREE from 'three';

const FRAG = /* glsl */`
precision highp float;
uniform vec2 u_resolution;
uniform float u_time;
uniform float u_steps;
uniform float u_calm; // finale: 0 normal, 1 becalmed

vec3 hsv(float h, float s, float v) {
  vec4 t = vec4(1.0, 2.0/3.0, 1.0/3.0, 3.0);
  vec3 p = abs(fract(vec3(h) + t.xyz) * 6.0 - vec3(t.w));
  return v * mix(vec3(t.x), clamp(p - vec3(t.x), 0.0, 1.0), s);
}
float hash21(vec2 p){ p = fract(p*vec2(234.34, 435.345)); p += dot(p, p+34.23); return fract(p.x*p.y); }

void main() {
  vec2 r = u_resolution;
  float t = u_time * mix(0.5, 0.12, u_calm);
  vec4 o = vec4(0.0, 0.0, 0.0, 1.0);
  float i = 0.0, e = 0.0, R = 0.0, s = 0.0;
  vec2 uv = (gl_FragCoord.xy - 0.5*r) / min(r.y, r.x);
  vec3 q = vec3(0.0), p,
       d = vec3(uv*0.5 + vec2(0.0, 1.0), 1.0);
  for (q.yz -= 1.0; i++ < u_steps; ) {
    o.rgb += hsv(-R/i*0.18 + 0.985, 0.72, min(R*e*s - 0.07, e)/6.0);
    s = 1.0;
    p = q += d*e*R*0.24;
    p = vec3(log2(R = length(p)) - t*0.5, exp(-p.z/R), atan(p.y, p.x));
    for (e = (p.y -= 1.0); s < 3e2; s += s)
      e += dot(sin(p.yzx*s - t), vec3(0.2) - cos(p.yxy*s))/s*0.2;
  }
  // normalize march brightness against step count so tiers match
  o.rgb *= pow(100.0 / u_steps, 0.3);

  // palette clamp: near-black / deep red / bone highlights
  vec3 c = max(o.rgb, 0.0);
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  vec3 red  = vec3(1.0, 0.14, 0.11) * lum * 1.9;
  vec3 bone = vec3(0.95, 0.88, 0.82) * lum;
  c = mix(red, bone, smoothstep(0.55, 1.15, lum) * 0.55);
  c = c / (1.0 + dot(c, vec3(0.30))); // soft tonemap — keep the vortex out of pure white
  c = pow(max(c, 0.0), vec3(1.8)) * 1.15; // crush mids back to near-black nightmare
  c = mix(c, c * vec3(0.9, 0.5, 0.5), u_calm * 0.4);

  // red haze toward the horizon so the ground fog meets the sky seamlessly
  c += vec3(0.30, 0.035, 0.03) * smoothstep(0.15, -0.55, uv.y);

  // stars, strongest where the nebula is dark (the void)
  float darkness = 1.0 - smoothstep(0.0, 0.28, lum);
  vec2 sg = uv * 90.0;
  vec2 cell = floor(sg);
  float h = hash21(cell);
  vec2 sp = fract(sg) - 0.5 - (vec2(hash21(cell + 7.0), hash21(cell + 13.0)) - 0.5)*0.8;
  float star = smoothstep(0.10, 0.0, length(sp)) * step(0.93, h);
  float twinkle = 0.6 + 0.4 * sin(u_time*2.0 + h*40.0);
  c += vec3(0.75, 0.82, 0.95) * star * twinkle * darkness * 1.4;

  gl_FragColor = vec4(c, 1.0);
}`;

export function createSky(renderer, quality) {
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const uniforms = {
    u_resolution: { value: new THREE.Vector2(1, 1) },
    u_time: { value: 0 },
    u_steps: { value: quality.p.skySteps },
    u_calm: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    fragmentShader: FRAG,
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    uniforms, depthWrite: false, depthTest: false,
  });
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat));

  let rt = null;
  function alloc() {
    const w = quality.p.skyRes;
    const h = Math.round(w * 0.62);
    if (rt) rt.dispose();
    rt = new THREE.WebGLRenderTarget(w, h, { depthBuffer: false });
    rt.texture.colorSpace = THREE.SRGBColorSpace;
    uniforms.u_resolution.value.set(w, h);
    uniforms.u_steps.value = quality.p.skySteps;
  }
  alloc();

  return {
    get texture() { return rt.texture; },
    setCalm(v) { uniforms.u_calm.value = v; },
    retier: alloc,
    render(time) {
      uniforms.u_time.value = time;
      const prev = renderer.getRenderTarget();
      renderer.setRenderTarget(rt);
      renderer.render(scene, cam);
      renderer.setRenderTarget(prev);
    },
  };
}
