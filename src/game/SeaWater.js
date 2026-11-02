// SeaWater.js — stylized stormy sea for three.js (r155+)
// - Gerstner waves (rolling swell) computed in the vertex shader
// - Fresnel transparency + sky reflection + sun glint + crest foam
// - getWaveHeight(x, z, t) returns the SAME wave height on the CPU,
//   so mobs can bob on the waves and stay partly submerged.
//
// Usage:
//   import { createSea, createSky, getWaveHeight, SEA_FOG } from './SeaWater.js';
//   const sea = createSea(); scene.add(sea);
//   scene.add(createSky());
//   scene.fog = new THREE.Fog(SEA_FOG.color, SEA_FOG.near, SEA_FOG.far);
//   // every frame:
//   sea.material.uniforms.uTime.value = clock.getElapsedTime();

import * as THREE from 'three';

// ---------------------------------------------------------------------------
// Wave set (shared by GPU and CPU). dirX, dirZ, steepness, wavelength(m)
// Sum of steepness must stay < 1.0 or the crests loop over themselves.
// Wave direction points toward the breakwater (+Z = toward the player).
// ---------------------------------------------------------------------------
export const WAVES = [
  [0.15, 1.0, 0.16, 38.0],
  [-0.4, 1.0, 0.13, 24.0],
  [0.6, 0.8, 0.10, 15.0],
  [-0.1, 1.0, 0.07, 9.0],
];

export const SEA_COLORS = {
  deep: 0x1f4f5a,      // looking straight down
  grazing: 0x56767f,   // looking across the water
  sky: 0x6a7e86,       // what the water reflects (kept darker than the sky on purpose)
  foam: 0xdfe8ea,
  sun: 0xffe2c0,
};

export const SEA_FOG = { color: 0x9aa4a8, near: 120, far: 950 };

// Sun low on the left, behind the mountains (matches the Blender scene).
export const SUN_DIRECTION = new THREE.Vector3(-0.45, 0.14, -0.88).normalize();

// ---------------------------------------------------------------------------
// CPU wave height — identical math to the vertex shader.
// Gerstner waves also move vertices sideways; for floating objects the
// vertical part is what matters, and this is accurate enough for gameplay.
// ---------------------------------------------------------------------------
export function getWaveHeight(x, z, t, amp = 1.0) {
  let y = 0;
  for (const [dx, dz, steep, wl] of WAVES) {
    const len = Math.hypot(dx, dz);
    const ndx = dx / len, ndz = dz / len;
    const k = (2 * Math.PI) / wl;
    const c = Math.sqrt(9.8 / k);
    const s = steep * amp;
    const f = k * (ndx * x + ndz * z - c * t);
    y += (s / k) * Math.sin(f);
  }
  return y;
}

const wavesGLSL = WAVES.map(
  ([dx, dz, s, wl]) => `off += gerstner(vec4(${dx.toFixed(3)}, ${dz.toFixed(3)}, ${s.toFixed(3)} * uWaveAmp, ${wl.toFixed(1)}), grid, tangent, binormal);`
).join('\n  ');

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uWaveAmp;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;
#include <fog_pars_vertex>

vec3 gerstner(vec4 w, vec3 p, inout vec3 tangent, inout vec3 binormal) {
  float steep = w.z;
  float k = 6.28318530718 / w.w;
  float c = sqrt(9.8 / k);
  vec2 d = normalize(w.xy);
  float f = k * (dot(d, p.xz) - c * uTime);
  float a = steep / k;
  float sf = sin(f), cf = cos(f);
  tangent  += vec3(-d.x * d.x * steep * sf, d.x * steep * cf, -d.x * d.y * steep * sf);
  binormal += vec3(-d.x * d.y * steep * sf, d.y * steep * cf, -d.y * d.y * steep * sf);
  return vec3(d.x * a * cf, a * sf, d.y * a * cf);
}

void main() {
  vec3 grid = (modelMatrix * vec4(position, 1.0)).xyz;
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);
  vec3 off = vec3(0.0);
  ${wavesGLSL}
  vec3 p = grid + off;
  vNormal = normalize(cross(binormal, tangent));
  vCrest = off.y;
  vWorldPos = p;
  vec4 mvPosition = viewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const fragmentShader = /* glsl */ `
uniform float uTime;
uniform float uOpacity;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uDeepColor;
uniform vec3 uGrazingColor;
uniform vec3 uSkyColor;
uniform vec3 uFoamColor;
varying vec3 vWorldPos;
varying vec3 vNormal;
varying float vCrest;
#include <fog_pars_fragment>

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
// small wind ripples on top of the swell
float ripple(vec2 p) {
  return noise(p * 0.35 + vec2(uTime * 0.25, uTime * 0.4)) * 0.6
       + noise(p * 0.9 - vec2(uTime * 0.5, uTime * 0.2)) * 0.4;
}

void main() {
  vec3 V = normalize(cameraPosition - vWorldPos);
  float dist = length(cameraPosition - vWorldPos);

  // ripple normal (fades with distance to avoid shimmer/aliasing)
  vec2 uv = vWorldPos.xz;
  float e = 0.25;
  float h0 = ripple(uv);
  float hx = ripple(uv + vec2(e, 0.0)) - h0;
  float hz = ripple(uv + vec2(0.0, e)) - h0;
  float rippleFade = 1.0 - smoothstep(60.0, 400.0, dist);
  vec3 N = normalize(vNormal + vec3(-hx, 0.0, -hz) * 1.2 * rippleFade);

  float NdV = max(dot(N, V), 0.0);
  float fres = mix(0.03, 1.0, pow(1.0 - NdV, 5.0));

  // body color: deep teal when looking down, steel-blue across the surface
  vec3 body = mix(uDeepColor, uGrazingColor, pow(1.0 - NdV, 1.6));

  // reflected sky (stylized: darker than the real sky so the sea stays teal)
  vec3 R = reflect(-V, N);
  vec3 refl = uSkyColor * (0.85 + 0.25 * clamp(R.y, 0.0, 1.0));
  vec3 col = mix(body, refl, fres * 0.65);

  // sun glint: sharp sparkle + soft sheen
  vec3 H = normalize(uSunDir + V);
  float NdH = max(dot(N, H), 0.0);
  float glint = pow(NdH, 500.0) * 5.0 + pow(NdH, 60.0) * 0.35;
  col += uSunColor * glint;

  // foam on wave crests
  float foamMask = smoothstep(0.9, 1.8, vCrest);
  float foamNoise = smoothstep(0.45, 0.8, noise(uv * 0.5 + uTime * 0.15));
  float foam = foamMask * foamNoise;
  col = mix(col, uFoamColor, foam * 0.85);

  // transparency: see-through when looking down, opaque at grazing angles & foam
  float alpha = mix(uOpacity, 1.0, max(fres, foam));

  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/**
 * Creates the sea mesh.
 * size/segments: 1600 m with 400 segments (~4 m grid) keeps 9 m waves smooth.
 * Lower segments (e.g. 256) for low-end/mobile.
 */
export function createSea({ size = 1600, segments = 400, waveAmp = 1.0, opacity = 0.82 } = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const uniforms = THREE.UniformsUtils.merge([
    THREE.UniformsLib.fog,
    {
      uTime: { value: 0 },
      uWaveAmp: { value: waveAmp },
      uOpacity: { value: opacity },
      uSunDir: { value: SUN_DIRECTION.clone() },
      uSunColor: { value: new THREE.Color(SEA_COLORS.sun) },
      uDeepColor: { value: new THREE.Color(SEA_COLORS.deep) },
      uGrazingColor: { value: new THREE.Color(SEA_COLORS.grazing) },
      uSkyColor: { value: new THREE.Color(SEA_COLORS.sky) },
      uFoamColor: { value: new THREE.Color(SEA_COLORS.foam) },
    },
  ]);

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false, // lets the submerged part of mobs show through faintly
    fog: true,
  });

  const sea = new THREE.Mesh(geometry, material);
  sea.name = 'Sea';
  sea.renderOrder = 1; // draw after opaque mobs
  sea.frustumCulled = false; // vertices move in the shader
  return sea;
}

/** Overcast gradient sky with a warm glow toward the sun (matches the Blender world). */
export function createSky({ radius = 2500 } = {}) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uSunDir: { value: SUN_DIRECTION.clone() },
      uHorizon: { value: new THREE.Color(0xcfcfcb) },
      uMid: { value: new THREE.Color(0xbabdc1) },
      uTop: { value: new THREE.Color(0x9ba6b0) },
      uGlow: { value: new THREE.Color(0xf6eadf) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * viewMatrix * vec4(position + cameraPosition, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uHorizon, uMid, uTop, uGlow;
      varying vec3 vDir;
      void main() {
        float h = clamp(vDir.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.25, h));
        col = mix(col, uTop, smoothstep(0.25, 0.9, h));
        float g = pow(max(dot(vDir, uSunDir), 0.0), 4.0);
        col = mix(col, uGlow, g * 0.8);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(radius, 32, 16), material);
  sky.name = 'Sky';
  sky.renderOrder = -1;
  sky.frustumCulled = false;
  return sky;
}
