import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { emotionHex } from './emotions.js';

function mulberry32(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function createSoftDisc(size = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.28, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.12)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createStarDisc(size = 64) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.88)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.22)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createMemoryStarDisc(size = 128) {
  // same soft point as disk stars — no hard ball core, no fake halo ring
  return createStarDisc(size);
}

function starColorFromTemp(t, extra = 0) {
  const u = Math.pow(t, 1.1);
  let color;
  if (u < 0.18) {
    // deep orange / M-dwarf
    const k = u / 0.18;
    color = new THREE.Color().setRGB(1.0, 0.42 + k * 0.22, 0.22 + k * 0.15);
  } else if (u < 0.38) {
    // K / cool yellow-orange
    const k = (u - 0.18) / 0.2;
    color = new THREE.Color().setRGB(1.0, 0.64 + k * 0.18, 0.35 + k * 0.2);
  } else if (u < 0.58) {
    // G / solar-like cream
    const k = (u - 0.38) / 0.2;
    color = new THREE.Color().setRGB(1.0, 0.82 + k * 0.1, 0.55 + k * 0.22);
  } else if (u < 0.78) {
    // A / white with slight blue
    const k = (u - 0.58) / 0.2;
    color = new THREE.Color().setRGB(1.0 - k * 0.1, 0.92 + k * 0.04, 0.78 + k * 0.18);
  } else {
    // B/O / blue-white
    const k = (u - 0.78) / 0.22;
    color = new THREE.Color().setRGB(0.82 - k * 0.22, 0.9 - k * 0.12, 1.0);
  }

  // subtle H-alpha / dust reddening mix for some stars (deep muted red, not magenta)
  if (extra > 0.72) {
    color.lerp(new THREE.Color(0.95, 0.45, 0.32), 0.18);
  }
  // occasional steel-blue distant look
  if (extra < 0.12) {
    color.lerp(new THREE.Color(0.62, 0.72, 0.9), 0.25);
  }
  return color;
}

const MEMORY_COLORS = [
  // warm whites / champagne
  '#fff2d8',
  '#f5e6c8',
  // cool blue-white (hot young star)
  '#d8e4f5',
  '#c0d0e8',
  // amber / old population
  '#e8c490',
  '#f0d0a0',
  // muted copper / dust
  '#d4b090',
  // steel / distant starlight
  '#a8b4c8',
  // very soft rose-brown (not pink candy)
  '#e0c8b8',
];

/** Continuous thick disk sample — no discrete layers. */
function sampleDiskPoint(rand) {
  const u = rand() * 2 - 1;
  const v = (rand() + rand() + rand() - 1.5) * (2 / 3);
  const w = (rand() + rand() + rand() - 1.5) * (2 / 3);

  const x = u * 100;
  const curveZ = Math.sin(u * 1.2) * 12 + Math.sin(u * 0.4) * 8;
  const curveY = Math.sin(u * 0.9 + 1.0) * 4;

  const z = v * 38 + curveZ;
  const y = w * 16 + curveY;

  const mid = Math.exp(-Math.abs(y) * 0.07);
  const widthFall = 1 - Math.min(1, Math.abs(v) * 0.5);
  return { x, y, z, density: 0.28 + mid * 0.48 + widthFall * 0.24 };
}

export class GalaxyScene {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.onStarClick = options.onStarClick || (() => {});
    this.onEmptyDoubleClick = options.onEmptyDoubleClick || (() => {});
    this.onEmptyClick = options.onEmptyClick || (() => {});
    this.starLabel = options.starLabel || ((star) => star.name || '');

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(canvas.clientWidth || window.innerWidth, canvas.clientHeight || window.innerHeight, false);
    this.renderer.setClearColor(0x000000, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // slightly lower exposure → deeper blacks, brighter cores
    this.renderer.toneMappingExposure = 0.88;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x000000, 0.0008);

    this.camera = new THREE.PerspectiveCamera(55, 1, 0.05, 500);
    this.camera.position.set(-20, 8, 35);

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.045;
    this.controls.minDistance = 6;
    this.controls.maxDistance = 140;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.14;
    this.controls.target.set(10, 0, 0);

    this.clock = new THREE.Clock();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.starMeshes = [];
    this.memoryStars = [];
    this.highlight = null;
    this.hovered = null;
    this.running = true;

    this.starTexture = createStarDisc(128);
    this.memoryTexture = createMemoryStarDisc(128);
    this.glowTexture = createSoftDisc(256);

    this._buildDeepField();
    this._buildDiskStars();
    this._buildVolumeGlow();
    this._buildDustRifts();
    this._buildHighlight();
    this._buildConstellations();
    this._buildVignette();

    this._onResize = () => this.resize();
    window.addEventListener('resize', this._onResize);

    this._onClick = (event) => this._handleClick(event);
    this._onPointerMove = (event) => this._handlePointerMove(event);
    this._onDblClick = (event) => this._handleDblClick(event);
    canvas.addEventListener('click', this._onClick);
    canvas.addEventListener('pointermove', this._onPointerMove);
    canvas.addEventListener('dblclick', this._onDblClick);

    this.resize();
    this._animate = this._animate.bind(this);
    window.__galaxy = this;
    requestAnimationFrame(this._animate);
  }

  /**
   * Deep-field: far, faint, sparse. Creates the "void" behind the galaxy.
   */
  _buildDeepField() {
    const count = 7000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const rand = mulberry32(11);

    for (let i = 0; i < count; i++) {
      // shell around the scene — far so they stay dim
      const r = 80 + Math.pow(rand(), 0.35) * 200;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(2 * rand() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
      const c = starColorFromTemp(rand()).multiplyScalar(0.2 + rand() * 0.35);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
      sizes[i] = 0.3 + rand() * 0.75;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uMap: { value: this.starTexture },
      },
      vertexShader: `
        attribute float aSize;
        varying vec3 vColor;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = max(1.0, aSize * (80.0 / max(1.0, -mv.z)) * uPixelRatio);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.02) discard;
          gl_FragColor = vec4(vColor, tex.a);
        }
      `,
    });

    this.deepField = new THREE.Points(geo, mat);
    this.scene.add(this.deepField);
  }

  /**
   * One continuous midplane glow (never stacked sheets).
   * Soft edges so side-on views stay smooth.
   */
  _buildDiskGlow() {
    const halfLen = 110;
    const halfWidth = 42;
    const segments = 140;
    const positions = [];
    const uvs = [];
    const indices = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const u = t * 2 - 1;
      const x = u * halfLen;
      const curveZ = Math.sin(u * 1.2) * 12 + Math.sin(u * 0.4) * 8;
      const curveY = Math.sin(u * 0.9 + 1.0) * 4;
      for (let j = 0; j <= 12; j++) {
        const v = j / 12;
        const z = (v * 2 - 1) * halfWidth + curveZ;
        const y = curveY + Math.cos((v - 0.5) * Math.PI) * 2.8 - 1.4;
        positions.push(x, y, z);
        uvs.push(t, v);
      }
    }

    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < 12; j++) {
        const a = i * 13 + j;
        const b = a + 13;
        const c = a + 1;
        const d = b + 1;
        indices.push(a, b, c, c, b, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float uTime;
        varying vec2 vUv;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
        }
        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
            mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
            f.y
          );
        }

        void main() {
          float u = vUv.x;
          float v = vUv.y;
          float flow = uTime * 0.02;

          float n1 = noise(vec2(u * 9.0 - flow * 1.8, v * 2.5));
          float n2 = noise(vec2(u * 22.0 - flow * 3.0, v * 5.0 + 1.2));
          float n3 = noise(vec2(u * 3.5 - flow * 0.5, v * 1.8));

          float mid = 1.0 - abs(v - 0.5) * 2.0;
          float core = smoothstep(0.0, 0.9, mid * (0.7 + 0.4 * n3));

          float clouds = 0.4 + 0.6 * n1;
          float fine = 0.75 + 0.3 * n2;

          float rift = smoothstep(0.48, 0.88, noise(vec2(u * 6.0 - flow, v * 2.5)));
          float dust = 1.0 - 0.45 * rift * core;

          float ends = smoothstep(0.0, 0.12, u) * smoothstep(1.0, 0.88, u);
          float edge = smoothstep(0.0, 0.32, v) * smoothstep(1.0, 0.68, v);

          float density = core * clouds * fine * dust * ends * edge;

          vec3 warm = vec3(0.95, 0.82, 0.58);
          vec3 cool = vec3(0.72, 0.8, 0.95);
          vec3 col = mix(warm, cool, clamp(v * 0.7 + 0.15 * n2, 0.0, 1.0));
          col = mix(col, vec3(0.98, 0.9, 0.75), core * 0.18);

          // immersive full-screen band — still continuous, no layers
          float alpha = clamp(density * 0.5, 0.0, 0.7);
          gl_FragColor = vec4(col * (0.75 + 0.4 * density), alpha);
        }
      `,
    });

    this.band = new THREE.Mesh(geo, mat);
    this.band.frustumCulled = false;
    this.scene.add(this.band);
  }

  _buildDiskStars() {
    const count = 48000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const rand = mulberry32(42);

    for (let i = 0; i < count; i++) {
      const p = sampleDiskPoint(rand);
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;

      const heat = 0.25 + rand() * 0.75;
      const c = starColorFromTemp(heat, rand()).multiplyScalar(0.4 + rand() * 0.42);
      if (Math.abs(p.y) < 4) {
        c.r = Math.min(1, c.r + 0.05);
        c.g = Math.min(1, c.g + 0.015);
        c.b = Math.max(0.28, c.b - 0.08);
      }
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;

      sizes[i] = (0.45 + rand() * 1.25) * p.density;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexColors: true,
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uMap: { value: this.starTexture },
      },
      vertexShader: `
        attribute float aSize;
        varying vec3 vColor;
        varying float vTwinkle;
        uniform float uTime;
        uniform float uPixelRatio;
        void main() {
          vColor = color;
          vec3 p = position;
          p.x += sin(uTime * 0.035 + p.z * 0.012) * 0.45;
          p.y += sin(uTime * 0.06 + p.x * 0.018) * 0.18;
          vTwinkle = 0.88 + 0.12 * sin(uTime * 1.3 + p.x * 0.12 + p.z * 0.08);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = max(1.5, aSize * (140.0 / max(1.0, -mv.z)) * uPixelRatio);
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform sampler2D uMap;
        varying vec3 vColor;
        varying float vTwinkle;
        void main() {
          vec4 tex = texture2D(uMap, gl_PointCoord);
          if (tex.a < 0.02) discard;
          gl_FragColor = vec4(vColor * vTwinkle * 0.95, tex.a);
        }
      `,
    });

    this.diskStars = new THREE.Points(geo, mat);
    this.diskStars.frustumCulled = false;
    this.scene.add(this.diskStars);
  }

  /**
   * Local morning-fog banks: soft, irregular patches of light haze.
   * Not a global wash — clustered, with natural soft edges.
   */
  _buildVolumeGlow() {
    const group = new THREE.Group();
    const rand = mulberry32(7);

    // a few fog banks, each made of overlapping soft puffs
    const banks = 9;
    for (let b = 0; b < banks; b++) {
      const u = (b + 0.5) / banks * 2 - 1 + (rand() - 0.5) * 0.15;
      const bankX = u * 95;
      const curveZ = Math.sin(u * 1.2) * 12 + Math.sin(u * 0.4) * 8;
      const curveY = Math.sin(u * 0.9 + 1.0) * 4;

      const bankY = curveY + (rand() - 0.5) * 14;
      const bankZ = curveZ + (rand() - 0.5) * 28;
      const warmBank = rand() > 0.4;
      const base = 28 + rand() * 30;
      const puffs = 5 + Math.floor(rand() * 5);

      for (let p = 0; p < puffs; p++) {
        const cool = warmBank ? rand() > 0.75 : rand() > 0.55;
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTexture,
            color: cool ? 0xc4d0e4 : 0xf0dcc0,
            transparent: true,
            // soft morning mist — visible but not a global wash
            opacity: 0.03 + rand() * 0.035,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          }),
        );

        // scatter puffs around bank center with soft falloff
        const ox = (rand() - 0.5) * base * 1.6;
        const oy = (rand() - 0.5) * base * 0.55;
        const oz = (rand() - 0.5) * base * 1.1;
        sprite.position.set(bankX + ox, bankY + oy, bankZ + oz);

        const s = base * (0.7 + rand() * 0.9);
        sprite.scale.set(s * (1.4 + rand() * 0.8), s * (0.65 + rand() * 0.45), 1);
        group.add(sprite);
      }
    }

    this.volumeGlow = group;
    this.scene.add(group);
  }

  _buildDustRifts() {
    const group = new THREE.Group();
    const rand = mulberry32(99);

    for (let i = 0; i < 40; i++) {
      const u = rand() * 2 - 1;
      const x = u * 95;
      const curveZ = Math.sin(u * 1.2) * 12;
      const mat = new THREE.SpriteMaterial({
        map: this.glowTexture,
        color: 0x0a0806,
        transparent: true,
        // softer dust so it doesn't cut a hard mid-line
        opacity: 0.18 + rand() * 0.22,
        depthWrite: false,
        blending: THREE.NormalBlending,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(20 + rand() * 28, 8 + rand() * 14, 1);
      sprite.position.set(x, (rand() - 0.5) * 10, curveZ + (rand() - 0.5) * 32);
      group.add(sprite);
    }

    this.dust = group;
    this.scene.add(group);
  }

  _buildHighlight() {
    // very thin, small ring — selection cue only, not a target reticle
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.9, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0xfff0e0,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    ring.visible = false;
    this.highlight = ring;
    this.scene.add(ring);
  }

  /**
   * Constellation links — almost invisible gold lines; brighten when related star is hovered.
   */
  _buildConstellations() {
    this.constellationLinks = [];
    this.constellationLines = null;
    this.linkSourceId = null;
    this.constellationMat = new THREE.LineBasicMaterial({
      color: 0xd4b878,
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.constellationMatHot = new THREE.LineBasicMaterial({
      color: 0xffe2a8,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
  }

  setConstellationLinks(links) {
    this.constellationLinks = Array.isArray(links) ? links.filter((l) => l && l.a && l.b) : [];
    this._rebuildConstellationLines();
  }

  _starPos(id) {
    const mesh = this.starMeshes.find((m) => m.userData.starId === id);
    return mesh ? mesh.position : null;
  }

  _rebuildConstellationLines() {
    if (this.constellationLines) {
      this.scene.remove(this.constellationLines);
      this.constellationLines.geometry?.dispose?.();
      this.constellationLines = null;
    }

    const positions = [];
    this.constellationSegs = [];
    for (const link of this.constellationLinks) {
      const pa = this._starPos(link.a);
      const pb = this._starPos(link.b);
      if (!pa || !pb) continue;
      positions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
      this.constellationSegs.push({ a: link.a, b: link.b, pa, pb });
    }
    if (!positions.length) return;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    this.constellationLines = new THREE.LineSegments(geo, this.constellationMat);
    this.constellationLines.frustumCulled = false;
    this.scene.add(this.constellationLines);
  }

  _updateConstellationEmphasis(hoveredId) {
    if (!this.constellationLines) return;
    // single material for all segments — hot if any endpoint is hovered
    const hot = Boolean(
      hoveredId &&
        this.constellationSegs?.some((s) => s.a === hoveredId || s.b === hoveredId),
    );
    this.constellationLines.material = hot ? this.constellationMatHot : this.constellationMat;
  }

  /** Screen-space vignette — darkens corners, deepens the void. */
  _buildVignette() {
    const geo = new THREE.PlaneGeometry(2, 2);
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {},
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = vec4(position.xy, 0.0, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        void main() {
          vec2 p = vUv - 0.5;
          float d = length(p) * 1.35;
          float vig = smoothstep(0.4, 1.05, d);
          gl_FragColor = vec4(0.0, 0.0, 0.0, vig * 0.38);
        }
      `,
    });
    this.vignette = new THREE.Mesh(geo, mat);
    this.vignette.frustumCulled = false;
    this.vignette.renderOrder = 999;
    // draw on top of everything
    this.scene.add(this.vignette);
  }

  resize() {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  clearMemoryStars() {
    for (const mesh of this.starMeshes) {
      this.scene.remove(mesh);
      mesh.geometry?.dispose?.();
      mesh.material?.dispose?.();
      if (mesh.userData.glow) {
        this.scene.remove(mesh.userData.glow);
        mesh.userData.glow.material?.dispose?.();
      }
    }
    this.starMeshes = [];
    this.memoryStars = [];
    this.memoryGlows = [];
    this._rebuildConstellationLines();
  }

  _realisticColor(star) {
    const emotion = star.layers?.[0]?.emotion;
    if (emotion) return new THREE.Color(emotionHex(emotion, star.status === 'dim'));
    if (star.color) return new THREE.Color(star.color);
    return new THREE.Color('#e8e6e0');
  }

  setMemoryStars(stars) {
    this.clearMemoryStars();
    const rand = mulberry32(31);
    this.memoryGlows = [];

    for (const star of stars) {
      const color = this._realisticColor(star);
      const size = THREE.MathUtils.clamp(star.size || 0.8, 0.45, 1.2);
      const p = star.pos || { x: star.x || 0, y: star.y || 0, z: star.z || 0 };
      const pos = new THREE.Vector3(p.x, p.y, p.z);

      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.95, 8, 8),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      mesh.position.copy(pos);
      mesh.userData.starId = star.id;
      mesh.userData.hitRadius = 0.95;
      mesh.userData.star = star;

      const baseScale = 0.55 + size * 0.32;
      const baseOpacity = star.status === 'dim' ? 0.35 : 1.0;
      const glow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.starTexture,
          color,
          transparent: true,
          opacity: baseOpacity,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      glow.scale.setScalar(baseScale);
      glow.position.copy(pos);
      mesh.userData.glow = glow;
      mesh.userData.baseScale = baseScale;
      glow.userData.starId = star.id;

      this.memoryGlows.push({
        sprite: glow,
        baseScale,
        baseOpacity,
        phase: rand() * Math.PI * 2,
        speed: 0.35 + rand() * 0.25,
      });

      this.scene.add(glow);
      this.scene.add(mesh);
      this.starMeshes.push(mesh);
      this.memoryStars.push(star);
    }

    if (this.hovered && !this.starMeshes.some((m) => m.userData.starId === this.hovered)) {
      this.hovered = null;
      this.highlight.visible = false;
    }
    this._rebuildConstellationLines();
  }

  createStarPosition() {
    const rand = Math.random;
    const p = sampleDiskPoint(rand);
    return {
      x: p.x * 0.85,
      y: p.y * 0.45,
      z: p.z * 0.7,
      size: 0.6 + rand() * 0.5,
      color: '#E8E6E0',
    };
  }

  /** 凝星：光粒飞向星位 */
  fxConverge({ pos, emotion, text = '' }, duration = 5000, memorial = false) {
    return new Promise((resolve) => {
      const target = new THREE.Vector3(pos.x, pos.y, pos.z);
      const color = new THREE.Color(emotionHex(emotion || 'warm'));
      const count = Math.min(800, 200 + Math.floor(text.length * 2));
      const positions = new Float32Array(count * 3);
      const rand = mulberry32(Date.now() & 0xffff);

      for (let i = 0; i < count; i++) {
        const r = 2 + rand() * 8;
        const a = rand() * Math.PI * 2;
        const y = memorial ? 6 + rand() * 10 : (rand() - 0.5) * 4;
        positions[i * 3] = target.x + Math.cos(a) * r;
        positions[i * 3 + 1] = target.y + y;
        positions[i * 3 + 2] = target.z + Math.sin(a) * r;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({
        size: 0.35,
        map: this.starTexture,
        color,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const points = new THREE.Points(geo, mat);
      this.scene.add(points);

      // end glow
      const endGlow = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.starTexture,
          color,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      endGlow.position.copy(target);
      endGlow.scale.setScalar(0.01);
      this.scene.add(endGlow);

      const start = performance.now();
      const from = positions.slice();

      const step = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const e = memorial ? easeInOutSine(t) : easeInOutCubic(t);
        const arr = points.geometry.attributes.position.array;
        for (let i = 0; i < count; i++) {
          const ix = i * 3;
          arr[ix] = from[ix] + (target.x - from[ix]) * e;
          arr[ix + 1] = from[ix + 1] + (target.y - from[ix + 1]) * e;
          arr[ix + 2] = from[ix + 2] + (target.z - from[ix + 2]) * e;
        }
        points.geometry.attributes.position.needsUpdate = true;
        mat.opacity = 0.95 * (1 - Math.pow(t, 2.2));
        endGlow.material.opacity = Math.pow(t, 1.5) * 0.9;
        endGlow.scale.setScalar(0.01 + t * 0.9);

        if (t < 1 && this.running) requestAnimationFrame(step);
        else {
          this.scene.remove(points);
          this.scene.remove(endGlow);
          geo.dispose();
          mat.dispose();
          endGlow.material.dispose();
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }

  leaveUnformed(pos) {
    if (!pos) return;
    const glow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.starTexture,
        color: 0x6a6a78,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    glow.position.set(pos.x, pos.y, pos.z);
    glow.scale.setScalar(0.5);
    this.scene.add(glow);
    this._unformed = this._unformed || [];
    this._unformed.push(glow);
  }

  clearUnformed() {
    if (!this._unformed) return;
    for (const g of this._unformed) {
      this.scene.remove(g);
      g.material?.dispose?.();
    }
    this._unformed = [];
  }

  pullBack(duration = 3000) {
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = Math.max(this.camera.position.distanceTo(this.controls.target) * 1.25, 28);
    const to = this.controls.target.clone().add(dir.multiplyScalar(dist));
    this._tweenCamera(to, this.controls.target.clone(), duration);
  }

  findStarByName(query) {
    const q = String(query || '').trim();
    if (!q) return null;
    const hit = this.memoryStars.find(
      (s) =>
        (s.name && s.name.includes(q)) ||
        (s.seedName && s.seedName.includes(q)) ||
        (s.layers?.[0]?.text || '').includes(q),
    );
    if (!hit) return null;
    this.focusStar(hit.id);
    return hit;
  }

  seedDemoStars(count = 24) {
    const rand = mulberry32(123456);
    const stars = [];
    for (let i = 0; i < count; i++) {
      const p = sampleDiskPoint(rand);
      stars.push({
        id: `demo-${i + 1}`,
        name: `示例·${i + 1}`,
        seedName: `示例·${i + 1}`,
        layers: [
          {
            id: `Ldemo${i}`,
            text: '这是一颗示例星辰。',
            emotion: 'calm',
            media: [],
            createdAt: Date.now() - i * 3600000,
          },
        ],
        pos: { x: p.x * 0.8, y: p.y * 0.45, z: p.z * 0.65 },
        color: '#E8E6E0',
        size: 0.55 + rand() * 0.5,
        bornAt: Date.now() - i * 3600000,
        lastVisitAt: null,
        visitCount: 0,
        status: 'live',
        visibility: 'private',
        isMemorial: false,
        isPublic: false,
      });
    }
    return stars;
  }

  _ndcFromEvent(event) {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  _pickStar(event) {
    this._ndcFromEvent(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.starMeshes, false)[0]?.object || null;
  }

  _handleClick(event) {
    const mesh = this._pickStar(event);
    if (mesh) this.onStarClick(mesh.userData.starId, { shiftKey: event.shiftKey });
  }

  _handleDblClick(event) {
    if (this._pickStar(event)) return;
    this._ndcFromEvent(event);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, point)) {
      const pos = {
        x: THREE.MathUtils.clamp(point.x, -90, 90),
        y: (Math.random() - 0.5) * 8,
        z: THREE.MathUtils.clamp(point.z, -35, 35),
      };
      this.onEmptyDoubleClick(pos);
      this.onEmptyClick(pos);
    }
  }

  _handlePointerMove(event) {
    const mesh = this._pickStar(event);
    const prev = this.hovered;
    this.hovered = mesh?.userData.starId || null;
    this._updateConstellationEmphasis(this.hovered);

    // restore previous star glow if unhovered
    if (prev && prev !== this.hovered) {
      const old = this.starMeshes.find((m) => m.userData.starId === prev);
      if (old?.userData.glow && old.userData.baseScale) {
        old.userData.glow.scale.setScalar(old.userData.baseScale);
      }
    }

    if (mesh) {
      this.canvas.style.cursor = 'pointer';
      this.highlight.visible = true;
      this.highlight.position.copy(mesh.position);
      this.highlight.lookAt(this.camera.position);
      // hug the star glow tightly
      const base = mesh.userData.baseScale || 0.55;
      this.highlight.scale.setScalar(base * 1.55);
      if (mesh.userData.glow && mesh.userData.baseScale) {
        mesh.userData.glow.scale.setScalar(mesh.userData.baseScale * 1.2);
      }
    } else {
      this.canvas.style.cursor = 'grab';
      this.highlight.visible = false;
    }
  }

  focusStar(starId) {
    const mesh = this.starMeshes.find((m) => m.userData.starId === starId);
    if (!mesh) return;
    const target = mesh.position.clone();
    const direction = this.camera.position.clone().sub(target).normalize();
    // pause spin while focusing, then resume so the galaxy keeps turning
    this.controls.autoRotate = false;
    if (this._autoRotateTimer) clearTimeout(this._autoRotateTimer);
    this._tweenCamera(target.clone().add(direction.multiplyScalar(11)), target, 800, () => {
      this._autoRotateTimer = setTimeout(() => {
        this.controls.autoRotate = true;
      }, 2200);
    });
  }

  _tweenCamera(toPos, toTarget, duration, onComplete) {
    const fromPos = this.camera.position.clone();
    const fromTarget = this.controls.target.clone();
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = 1 - Math.pow(1 - t, 3);
      this.camera.position.lerpVectors(fromPos, toPos, e);
      this.controls.target.lerpVectors(fromTarget, toTarget, e);
      if (t < 1 && this.running) {
        requestAnimationFrame(step);
      } else {
        onComplete?.();
      }
    };
    requestAnimationFrame(step);
  }

  _animate() {
    if (!this.running) return;
    requestAnimationFrame(this._animate);

    const t = this.clock.getElapsedTime();
    if (this.diskStars?.material?.uniforms) this.diskStars.material.uniforms.uTime.value = t;
    if (this.dust) this.dust.position.x = Math.sin(t * 0.012) * 0.35;
    if (this.deepField) this.deepField.rotation.y = t * 0.0008;

    // memory stars: gentle breathing (~±12% brightness)
    if (this.memoryGlows) {
      for (const g of this.memoryGlows) {
        const pulse = 0.88 + 0.12 * Math.sin(t * g.speed + g.phase);
        g.sprite.material.opacity = g.baseOpacity * pulse;
      }
    }

    if (this.highlight?.visible) this.highlight.material.opacity = 0.38 + Math.sin(t * 2.2) * 0.08;

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.running = false;
    if (this._autoRotateTimer) clearTimeout(this._autoRotateTimer);
    window.removeEventListener('resize', this._onResize);
    this.canvas.removeEventListener('click', this._onClick);
    this.canvas.removeEventListener('pointermove', this._onPointerMove);
    this.canvas.removeEventListener('dblclick', this._onDblClick);
    this.clearMemoryStars();
    this.controls.dispose();
    this.renderer.dispose();
  }
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutSine(t) {
  return -(Math.cos(Math.PI * t) - 1) / 2;
}
