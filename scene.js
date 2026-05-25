// ─────────────────────────────────────────────────────────
// i01.kz — Three.js scroll-driven 3D scene
// Topographic contour rings forming an organic 3D blob.
// Each ring is a deformed loop; together they sculpt a
// single recognizable shape entirely from lines.
// ─────────────────────────────────────────────────────────

import * as THREE from "three";

const canvas = document.getElementById("three-canvas");

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: "high-performance"
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  44,
  window.innerWidth / window.innerHeight,
  0.1,
  100
);
camera.position.set(0, 0, 6.2);

// ─── GLSL simplex noise (shader-side) ───────────────────
const glslSimplex = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(
    i.z+vec4(0.0,i1.z,i2.z,1.0))
    +i.y+vec4(0.0,i1.y,i2.y,1.0))
    +i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
`;

// ─── Generate topographic ring geometry ─────────────────
// 64 horizontal rings stacked from y=-1.6 to y=1.6.
// Each ring is a sphere slice — undeformed it's a sphere.
// Vertex shader displaces radially with noise → organic blob.

const N_RINGS   = 64;
const SEGMENTS  = 80;
const BASE_R    = 1.55;
const SPAN      = 1.55;

const positions = [];
const seeds = [];
const tArr = [];
const yNorm = []; // normalized y for shader

for (let i = 0; i < N_RINGS; i++) {
  const tY = i / (N_RINGS - 1);       // 0..1 top→bottom
  const y  = -SPAN + 2 * SPAN * tY;   // -SPAN..+SPAN
  const ringSeed = i * 13.37;
  // sphere base radius at this y (with very slight padding)
  const yn = y / SPAN;
  const baseR = BASE_R * Math.sqrt(Math.max(0, 1 - yn * yn * 0.98));
  for (let j = 0; j < SEGMENTS; j++) {
    const a1 = (j / SEGMENTS) * Math.PI * 2;
    const a2 = ((j + 1) / SEGMENTS) * Math.PI * 2;
    const x1 = baseR * Math.cos(a1), z1 = baseR * Math.sin(a1);
    const x2 = baseR * Math.cos(a2), z2 = baseR * Math.sin(a2);
    positions.push(x1, y, z1);
    positions.push(x2, y, z2);
    seeds.push(ringSeed, ringSeed);
    tArr.push(a1 / (Math.PI * 2), a2 / (Math.PI * 2));
    yNorm.push(yn, yn);
  }
}

const ringsGeo = new THREE.BufferGeometry();
ringsGeo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
ringsGeo.setAttribute("seed",     new THREE.Float32BufferAttribute(seeds, 1));
ringsGeo.setAttribute("tA",       new THREE.Float32BufferAttribute(tArr, 1));
ringsGeo.setAttribute("yN",       new THREE.Float32BufferAttribute(yNorm, 1));

const uniforms = {
  uTime:    { value: 0 },
  uScroll:  { value: 0 },
  uDistort: { value: 0.32 },
  uColorA:  { value: new THREE.Color("#ff8b4a") },
  uColorB:  { value: new THREE.Color("#f5e0c3") },
  uColorC:  { value: new THREE.Color("#d05b6f") },
  uColorD:  { value: new THREE.Color("#3a2418") }
};

const ringsMat = new THREE.ShaderMaterial({
  uniforms,
  vertexShader: `
    ${glslSimplex}
    attribute float seed;
    attribute float tA;
    attribute float yN;
    uniform float uTime;
    uniform float uScroll;
    uniform float uDistort;
    varying float vT;
    varying float vY;
    varying float vSeed;
    varying float vDepth;
    varying float vGlow;
    varying float vDisp;
    void main(){
      vec3 p = position;
      // multi-octave noise displacement, radial
      vec3 noiseP = p * 0.9 + vec3(0.0, uTime * 0.12, 0.0);
      float n1 = snoise(noiseP);
      float n2 = snoise(noiseP * 2.1 + 13.0) * 0.45;
      float n  = n1 + n2;
      // radial displacement direction (project onto XZ)
      vec3 radial = vec3(p.x, 0.0, p.z);
      float radialLen = length(radial);
      if (radialLen > 0.001) radial /= radialLen;
      // displacement amount — more on equator, less at poles
      float poleFade = 1.0 - pow(abs(yN), 2.5);
      float amp = (0.28 + uDistort * 0.5) * (1.0 + uScroll * 0.5) * poleFade;
      p += radial * n * amp;
      // small vertical wobble
      p.y += snoise(noiseP * 0.8 + 100.0) * 0.05 * poleFade;

      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      vT = tA;
      vY = yN;
      vSeed = seed;
      vDepth = -mv.z;
      vDisp = n;
      // travelling glow around each ring
      float pulse = sin(tA * 18.0 - uTime * 1.4 + seed * 0.5);
      vGlow = smoothstep(0.4, 1.0, pulse) * 0.8 + 0.35;
    }
  `,
  fragmentShader: `
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    uniform vec3 uColorD;
    uniform float uScroll;
    varying float vT;
    varying float vY;
    varying float vSeed;
    varying float vDepth;
    varying float vGlow;
    varying float vDisp;
    void main(){
      // color by Y (top=light, bottom=accent)
      float band = vY * 0.5 + 0.5;            // 0=bottom, 1=top
      vec3 c = mix(uColorA, uColorB, band);
      // shift toward coral on displacement crests
      c = mix(c, uColorC, smoothstep(0.2, 1.0, vDisp) * 0.45);
      // deeper near poles
      c = mix(uColorD * 1.5, c, smoothstep(0.0, 0.4, 1.0 - abs(vY)));

      // depth fade
      float depthFade = clamp(1.0 - (vDepth - 3.0) / 8.0, 0.0, 1.0);
      // end fade per ring segment (not really needed since rings loop)
      float a = vGlow * depthFade * 0.85;
      gl_FragColor = vec4(c * (0.55 + vGlow * 0.65), a);
    }
  `,
  transparent: true,
  blending: THREE.AdditiveBlending,
  depthWrite: false
});

const rings = new THREE.LineSegments(ringsGeo, ringsMat);
scene.add(rings);

// ─── Soft particle dust ─────────────────────────────────
const PARTICLE_COUNT = 320;
const particleGeo = new THREE.BufferGeometry();
const pPos  = new Float32Array(PARTICLE_COUNT * 3);
const pSeed = new Float32Array(PARTICLE_COUNT);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const r  = 2 + Math.random() * 7;
  const th = Math.random() * Math.PI * 2;
  const ph = Math.acos(2 * Math.random() - 1);
  pPos[3 * i + 0] = r * Math.sin(ph) * Math.cos(th);
  pPos[3 * i + 1] = r * Math.sin(ph) * Math.sin(th);
  pPos[3 * i + 2] = r * Math.cos(ph) - 1;
  pSeed[i] = Math.random();
}
particleGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
particleGeo.setAttribute("seed",     new THREE.BufferAttribute(pSeed, 1));

const particleMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime:       { value: 0 },
    uScroll:     { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() }
  },
  vertexShader: `
    attribute float seed;
    uniform float uTime;
    uniform float uScroll;
    uniform float uPixelRatio;
    varying float vAlpha;
    void main(){
      vec3 p = position;
      p.y += sin(uTime * 0.4 + seed * 6.28) * 0.25;
      p.x += cos(uTime * 0.3 + seed * 3.14) * 0.18;
      p.z += uScroll * 2.0 * (0.4 + seed);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = (0.6 + seed * 1.0) * uPixelRatio * (160.0 / -mv.z);
      vAlpha = (0.2 + seed * 0.45) * clamp(1.0 - length(p) / 12.0, 0.0, 1.0);
    }
  `,
  fragmentShader: `
    varying float vAlpha;
    void main(){
      vec2 c = gl_PointCoord - 0.5;
      float d = length(c);
      float a = smoothstep(0.5, 0.0, d) * vAlpha;
      gl_FragColor = vec4(vec3(0.98, 0.85, 0.72), a);
    }
  `,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// ─── Resize ─────────────────────────────────────────────
function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  particleMat.uniforms.uPixelRatio.value = renderer.getPixelRatio();
}
window.addEventListener("resize", onResize);

// ─── Scroll progress ────────────────────────────────────
const scrollState = { progress: 0, target: 0 };
function updateScroll() {
  const doc = document.documentElement;
  const max = doc.scrollHeight - window.innerHeight;
  scrollState.target = max > 0 ? Math.min(1, window.scrollY / max) : 0;
}
window.addEventListener("scroll", updateScroll, { passive: true });
updateScroll();

// ─── Mouse parallax ─────────────────────────────────────
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
window.addEventListener("mousemove", (e) => {
  mouse.tx = (e.clientX / window.innerWidth - 0.5);
  mouse.ty = (e.clientY / window.innerHeight - 0.5);
});

// ─── Color presets (Tweaks) ─────────────────────────────
const PRESETS = {
  amber: {
    A: "#ff8b4a", B: "#f5e0c3", C: "#d05b6f", D: "#3a2418",
    bg: "oklch(0.135 0.012 60)",
    accent: "oklch(0.80 0.155 55)"
  },
  cobalt: {
    A: "#6ea0ff", B: "#dceaff", C: "#9a78ff", D: "#11192c",
    bg: "oklch(0.135 0.015 260)",
    accent: "oklch(0.72 0.16 265)"
  },
  forest: {
    A: "#6cd9a6", B: "#e2f0d6", C: "#4ac4cf", D: "#0e1b14",
    bg: "oklch(0.135 0.012 150)",
    accent: "oklch(0.78 0.14 160)"
  },
  ember: {
    A: "#ff5e3a", B: "#ffd2a5", C: "#ff9c2f", D: "#21070a",
    bg: "oklch(0.135 0.018 30)",
    accent: "oklch(0.75 0.18 28)"
  },
  ghost: {
    A: "#e8e6e0", B: "#ffffff", C: "#9b96a6", D: "#0b0b0c",
    bg: "oklch(0.10 0.006 250)",
    accent: "oklch(0.92 0.01 250)"
  }
};

window.__i01_scene = {
  setPreset(name) {
    const p = PRESETS[name] || PRESETS.amber;
    uniforms.uColorA.value.set(p.A);
    uniforms.uColorB.value.set(p.B);
    uniforms.uColorC.value.set(p.C);
    uniforms.uColorD.value.set(p.D);
    document.documentElement.style.setProperty("--bg", p.bg);
    document.documentElement.style.setProperty("--accent", p.accent);
  },
  setDistort(v) { uniforms.uDistort.value = v; },
  setDensity(mul) {
    rings.material.opacity = mul;
    rings.material.transparent = true;
    particles.material.opacity = mul;
  }
};

// ─── Animation loop ─────────────────────────────────────
const clock = new THREE.Clock();
function animate() {
  const t = clock.getElapsedTime();

  scrollState.progress += (scrollState.target - scrollState.progress) * 0.06;
  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;

  uniforms.uTime.value = t;
  uniforms.uScroll.value = scrollState.progress;
  particleMat.uniforms.uTime.value = t;
  particleMat.uniforms.uScroll.value = scrollState.progress;

  // slow rotation + scroll tilt + mouse parallax
  rings.rotation.y = t * 0.10 + mouse.x * 0.45 + scrollState.progress * 0.9;
  rings.rotation.x = Math.sin(t * 0.16) * 0.14 - mouse.y * 0.30 + scrollState.progress * 0.5;
  rings.rotation.z = scrollState.progress * 0.25;

  // position: starts upper-right, drifts to lower-left across the page
  const baseX = 1.5, baseY = 0.35;
  rings.position.x = baseX - scrollState.progress * 2.6 + mouse.x * 0.3;
  rings.position.y = baseY - scrollState.progress * 0.9 - mouse.y * 0.2;

  // camera dolly + sway
  camera.position.z = 6.2 - scrollState.progress * 1.8;
  camera.position.y = scrollState.progress * 0.3;
  camera.position.x = mouse.x * 0.25 - scrollState.progress * 0.3;
  camera.lookAt(scrollState.progress * 0.2, -scrollState.progress * 0.2, 0);

  // particles
  particles.rotation.y = t * 0.02;
  particles.rotation.x = scrollState.progress * 0.3;

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}
animate();
onResize();
