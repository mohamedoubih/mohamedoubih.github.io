/* FD-11 radiosonde enclosure: how the board is held in the lower shell, how the cover clips on over the
   sensor flex, and what carries the load in flight.
   three.js r149 (classic build). fd11.glb is the 1.G CAD in its own frame (metres, converted to mm here):
   x = thickness (cover side +x), y = width, z = length (tether ring at +z). The probe group turns that frame
   into the bench view (opening up) or the flight attitude (ring up).
   Every frame is computed from the timeline time t, so playing, scrubbing and stepping agree. */
(function () {
  'use strict';

  const THREE = window.THREE;
  const root = document.documentElement;
  const viewer = document.getElementById('viewer');
  const canvas = document.getElementById('scene');

  function hasWebGL() {
    try {
      const c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }
  if (!THREE || !hasWebGL()) { root.classList.add('no-webgl'); return; }
  root.classList.add('webgl');
  if (/[?&]poster\b/.test(location.search)) root.classList.add('is-poster');
  const poster = root.classList.contains('is-poster');

  /* ---------- geometry from the CAD (mm) ---------- */
  // hook at the ring end: a 0.4 mm wall between two slots, with a lip over the board
  const HOOK = { root: -2.66, top: 1.0, zc: 40.65, zIn: 40.43, y0: -1.97, y1: 0.97, z0: 38.8, z1: 40.92, lipX: 0.1, px: 0.4, tip: [1.0, 40.65] };   // tip: top edge of the hook's upward tab, where the tool pulls
  const HOOK_OPEN = 1.95;          // mm the top of the hook is pushed out: the lip clears the board end with room for the tool
  // clip bars: slim bars above the four windows in the lower shell's side walls, centred at z = -20 and 24
  const BARS = [-20, 24];
  const BAR_D = 0.78;              // mm inward: the barb tip (y 8.65) has to pass the bar's outer face (y 9.4)
  const barDefl = o => (o >= 2.15 || o < 0.2 ? 0 : BAR_D * Math.min(1, (2.15 - o) / 0.55));  // o: cover height above closed
  const CENTRE = new THREE.Vector3(4, 0, 1.7);
  const RING = new THREE.Vector3(-2.6, 0, 44.35);   // inside of the ring's crown, where the thread bears
  const CG = new THREE.Vector3(3.5, 0, 5);          // rough centre of mass of the 20 g assembly
  const FLEX = { xb: 14.7, zc: -20.93, len: 76.3, tipAngle: 0.6 };    // bends only above the stiffener in the cover's slot; tip about 22 mm down when level
  // yellow polyimide stiffener bonded to the flex where it passes the slot in the cover's end block (slot 1.9 mm, wall at x 12.65-13.25)
  const STIFF = { x0: 11.9, x1: 14.6, z0: -20.85, z1: -19.6 };
  // AAA cell and its contacts: clip arms grip the cell above its axis (tips at x 10.2, y ±3.46), the negative
  // contact is a conical spring (free 4.49 mm, base at z -13.7), the positive contact a V-shaped leaf (apex z 32.45)
  const CELL = { cx: 6.25, R: 5.25, zNeg: -13.36, len: 46.8, tipX: 10.2, tipY: 3.46 };
  const SPRING = { base: -13.7, free: 4.49 };
  const LEAF_APEX = 32.1;          // inner face of the leaf's apex (plus a little room, so the nub never shows through it)
  const BUTTON = new THREE.Vector3(-5.15, 4.9, -5.5), LED = new THREE.Vector3(-4.25, -5.3, -5.5);   // on the lower shell's floor, outside

  /* ---------- timeline: authored in seconds at the original pace, played at half speed ---------- */
  const SLOW = 2;
  const PHASES = [['board', 3.6], ['cell', 2.6], ['cover', 2.6], ['flight', 1.7], ['back', 2.6], ['load', 3.3]].map(([id, dur]) => ({ id, dur: dur * SLOW }));
  const PH = {};
  let acc = 0;
  PHASES.forEach((p, i) => { p.start = acc; p.end = acc + p.dur; p.index = i; PH[p.id] = p; acc = p.end; });
  const TOTAL = acc;
  const at = (id, s) => PH[id].start + s * SLOW;

  const ease = {
    inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    out: u => 1 - Math.pow(1 - u, 3),
    in: u => u * u * u,
    linear: u => u,
    sine: u => 0.5 - 0.5 * Math.cos(Math.PI * u),
  };
  const clamp01 = u => Math.min(1, Math.max(0, u));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, u) => (typeof a === 'number' ? a + (b - a) * u : a.map((v, i) => v + (b[i] - v) * u));
  function track(keys) {
    return {
      at(t) {
        if (t <= keys[0][0]) return keys[0][1];
        for (let i = 1; i < keys.length; i++) {
          const b = keys[i];
          if (t <= b[0]) {
            const a = keys[i - 1], span = b[0] - a[0];
            return lerp(a[1], b[1], span > 0 ? ease[b[2] || 'inOut']((t - a[0]) / span) : 1);
          }
        }
        return keys[keys.length - 1][1];
      },
    };
  }
  const D2R = Math.PI / 180;
  const T = {
    // board: [lift along x, shift along z, tilt (deg, ring end up)] about its far top edge
    board: track([
      [at('board', 0.45), [62, 1.5, 9]], [at('board', 1.55), [0.02, 1.5, 3.4], 'out'], [at('board', 1.95), [0, 0, 3.4]],
      [at('board', 2.5), [0, 0, 0], 'inOut'],
    ]),
    hook: track([[at('board', 0.75), 0], [at('board', 1.3), HOOK_OPEN], [at('board', 2.6), HOOK_OPEN], [at('board', 2.85), 0, 'out']]),
    tool: track([[at('board', 0.3), 34], [at('board', 0.75), 0, 'out'], [at('board', 2.5), 0], [at('board', 3.1), 40, 'in']]),
    flex: track([[at('cell', 0), 100], [at('cell', 0.65), 0, 'out']]),
    // cell: [lift, shift along z, tilt (deg, positive end up)] about the centre of its negative end:
    // in at an angle, push the spring flat, rotate down into the clips, then the spring sets it on the positive leaf
    cell: track([
      [at('cell', 0.5), [45, 4.2, 20]], [at('cell', 1.1), [0.35, 4.2, 20], 'out'], [at('cell', 1.55), [0.35, 0.02, 20]],
      [at('cell', 2.15), [0, 0.02, 0]], [at('cell', 2.3), [0, 0, 0], 'out'],
    ]),
    cover: track([[at('cover', 0), 72], [at('cover', 0.85), 2.6, 'out'], [at('cover', 1.9), 0, 'sine']]),
    turn: track([[at('flight', 0), 0], [at('flight', 1.3), 1, 'inOut']]),
    thread: track([[at('flight', 0.9), 0], [at('flight', 1.45), 1, 'out']]),
    twist: track([[at('back', 0.1), 0], [at('back', 0.85), 1], [at('back', 1.95), 1], [at('back', 2.6), 0]]),
    ghost: track([[at('load', 0), 0], [at('load', 0.5), 1]]),
    sweep: track([[at('load', 0.3), 47], [at('load', 1.6), -43, 'inOut']]),
    arrows: track([[at('load', 0.9), 0], [at('load', 1.35), 1, 'out']]),
    fade: track([[0, 1], [at('board', 0.35), 0, 'linear'], [at('load', 2.7), 0], [TOTAL, 1, 'linear']]),
  };

  /* ---------- attitude: bench (opening up, ring to the right), flight (ring up), and a turn about the thread ---------- */
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const qBench = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 1, 0), V(0, 0, 1), V(1, 0, 0)));
  const qFlight = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), -72 * D2R)
    .multiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(V(0, 0, 1), V(1, 0, 0), V(0, 1, 0))));
  const RING_W = RING.clone().sub(CENTRE).applyQuaternion(qFlight);             // ring position in flight; the turn keeps it fixed
  const backDir = V(-1, 0, 0).applyQuaternion(qFlight);
  const TWIST = 14 * D2R - Math.atan2(backDir.x, backDir.z);                    // turns the outside of the floor to the camera
  const qBack = new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), TWIST).multiply(qFlight);
  const BACK_TGT = BUTTON.clone().add(LED).multiplyScalar(0.5).sub(RING).applyQuaternion(qBack).add(RING_W);
  const BACK_EYE = V(-1, 0, 0).applyQuaternion(qBack).multiplyScalar(Math.cos(14 * D2R)).add(V(0, Math.sin(14 * D2R), 0))
    .multiplyScalar(118).add(BACK_TGT);
  const CAM_BENCH = [[14, 64, 98], [0, -1.5, 0]], CAM_FLIGHT = [[-22, 46, 214], [-22, 6, 0]], CAM_BACK = [BACK_EYE.toArray(), BACK_TGT.toArray()];
  const CAM = [
    [0, ...CAM_BENCH], [at('flight', 0), ...CAM_BENCH], [at('flight', 1.3), ...CAM_FLIGHT],
    [at('back', 0.15), ...CAM_FLIGHT], [at('back', 0.9), ...CAM_BACK], [at('back', 1.9), ...CAM_BACK], [at('back', 2.6), ...CAM_FLIGHT],
    [TOTAL, ...CAM_FLIGHT],
  ];
  T.camPos = track(CAM.map(([t, p]) => [t, p]));
  T.camTgt = track(CAM.map(([t, , g]) => [t, g]));
  const MAGS_ON = {
    hook: [at('board', 0.8), at('board', 3.35)], clip: [at('cover', 0.7), at('cover', 2.45)],
  };

  /* ---------- renderer, scene ---------- */
  THREE.ColorManagement.legacyMode = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const BG = 0xebe8e1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(32, 1.6, 2, 5000);
  {
    const env = new THREE.Scene();
    env.background = new THREE.Color(0x8d8a85);
    const pl = (c, w, h, pos, rot) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide }));
      m.position.set(...pos); m.rotation.set(...rot); env.add(m);
    };
    pl(0xffffff, 10, 10, [0, 6, 0], [Math.PI / 2, 0, 0]);
    pl(0xf3efe8, 8, 4, [-6, 2, 2], [0, Math.PI / 2, 0]);
    pl(0xd9e2ee, 8, 4, [6, 2, -2], [0, -Math.PI / 2, 0]);
    pl(0x3a3a3a, 20, 20, [0, -4, 0], [Math.PI / 2, 0, 0]);
    const pm = new THREE.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.04).texture;
    pm.dispose();
  }
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb6b0a6, 0.5));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-70, 210, 140);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, near: 40, far: 600 });
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const fillL = new THREE.DirectionalLight(0xfff1e0, 0.35);
  fillL.position.set(160, 60, 90);
  scene.add(fillL);
  const groundMat = new THREE.ShadowMaterial({ opacity: 0.15, depthWrite: false });   // must not hide the hanging probe's lower half
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -9.25;
  ground.receiveShadow = true;
  scene.add(ground);

  // fade to the background colour at the loop point
  const fadeMat = new THREE.ShaderMaterial({
    transparent: true, depthTest: false, depthWrite: false,
    uniforms: { a: { value: 0 }, c: { value: new THREE.Vector3(0xeb / 255, 0xe8 / 255, 0xe1 / 255) } },   // sRGB, written as is
    vertexShader: 'void main(){ gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: 'uniform float a; uniform vec3 c; void main(){ gl_FragColor = vec4(c, a); }',
  });
  const fade = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fadeMat);
  fade.frustumCulled = false;
  fade.renderOrder = 999;
  scene.add(fade);

  /* ---------- materials: section caps (back faces drawn flat) for the magnifiers, load-path tint on the lower shell ---------- */
  const capOn = { value: 0 };
  const sweepZ = { value: 99 }, sweepK = { value: 0 };
  const srgb = hex => new THREE.Vector3(((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255);
  function mat(opts, capHex, sweep, capAll) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide, envMapIntensity: 0.7 }, opts));
    m.customProgramCacheKey = () => 'fd11-' + (sweep ? 'sweep' : 'plain');       // the tinted shell needs its own program
    m.onBeforeCompile = sh => {
      sh.uniforms.uCap = capOn;
      sh.uniforms.uCapCol = { value: srgb(capHex) };
      sh.uniforms.uCapAll = { value: capAll ? 1 : 0 };                          // the cell (two overlapping solids) is drawn flat in sections
      let f = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uCap;\nuniform float uCapAll;\nuniform vec3 uCapCol;' +
        (sweep ? '\nuniform float uSweepZ;\nuniform float uSweepK;\nuniform vec3 uHi;\nvarying float vCadZ;' : ''));
      if (sweep) {
        Object.assign(sh.uniforms, { uSweepZ: sweepZ, uSweepK: sweepK, uHi: { value: new THREE.Color(0xc4702c) } });
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vCadZ;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvCadZ = position.z;');
        f = f.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, uHi, uSweepK * smoothstep(uSweepZ - 7.0, uSweepZ, vCadZ));');
      }
      sh.fragmentShader = f.replace('#include <dithering_fragment>', '#include <dithering_fragment>\nif (uCap > 0.5 && (!gl_FrontFacing || uCapAll > 0.5)) gl_FragColor = vec4(uCapCol, 1.0);');
    };
    return m;
  }
  // second colour: the section cap seen in the magnifiers
  const M = {
    lower: mat({ color: 0xd3d6d9, roughness: 0.62, metalness: 0 }, 0x7d8ea3, true),
    upper: mat({ color: 0xe9e7e1, roughness: 0.6, metalness: 0 }, 0xcf8d74),
    pcb: mat({ color: 0x1d1f22, roughness: 0.5, metalness: 0.05 }, 0x2f5e45),
    dark: mat({ color: 0x2b2d31, roughness: 0.45, metalness: 0.1 }, 0x45484e),
    light: mat({ color: 0xb3ad9f, roughness: 0.5, metalness: 0.1 }, 0x9c9584),
    metal: mat({ color: 0xcfd2d6, roughness: 0.3, metalness: 0.85 }, 0x9aa0a8),
    conn: mat({ color: 0xd9cdb4, roughness: 0.55, metalness: 0 }, 0xb3a37f),
    cell: mat({ color: 0x8b9097, roughness: 0.32, metalness: 0.6 }, 0x59606a, false, true),
    flex: mat({ color: 0xf2f2ef, roughness: 0.5, metalness: 0 }, 0xb9b9b2),
    tool: mat({ color: 0x3b3f46, roughness: 0.35, metalness: 0.6 }, 0x30343a),
  };
  const magFog = new THREE.Fog(BG, 1, 2);
  const PART_MAT = { lower: 'lower', upper: 'upper', pcb: 'pcb', comps_dark: 'dark', comps_light: 'light', can: 'metal', holder_neg: 'metal', holder_pos: 'metal', spring: 'metal', fpc: 'conn', battery: 'cell', flex: 'flex' };
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x1a1c20, transparent: true, opacity: 0.26 });
  const edgeMatCover = new THREE.LineBasicMaterial({ color: 0x1a1c20, transparent: true, opacity: 0.26 });

  /* ---------- loading ---------- */
  async function loadGLB(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    const dv = new DataView(buf);
    const jl = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
    const bin = 20 + jl + 8;
    const accr = i => {
      const a = json.accessors[i], bv = json.bufferViews[a.bufferView];
      const off = bin + (bv.byteOffset || 0) + (a.byteOffset || 0);
      const n = a.count * ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 })[a.type];
      const Arr = { 5126: Float32Array, 5123: Uint16Array, 5125: Uint32Array }[a.componentType];
      return new Arr(buf.slice(off, off + n * Arr.BYTES_PER_ELEMENT));
    };
    const out = {};
    json.nodes.forEach(n => {
      if (n.mesh === undefined) return;
      const pr = json.meshes[n.mesh].primitives[0];
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(accr(pr.attributes.POSITION), 3));
      if (pr.attributes.NORMAL !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(accr(pr.attributes.NORMAL), 3));
      g.setIndex(new THREE.BufferAttribute(accr(pr.indices), 1));
      g.scale(1000, 1000, 1000);                                  // metres -> millimetres
      if (!g.attributes.normal) g.computeVertexNormals();
      out[n.name] = g;
    });
    return out;
  }
  loadGLB('fd11.glb').then(start).catch(err => {
    console.error(err);
    document.getElementById('fallbackTxt').textContent = 'The enclosure model could not be loaded. Open this page from the website rather than from a local file.';
    root.classList.add('no-webgl');
  });

  // feature edges that share the mesh's position buffer, so they follow the bending
  function sharpEdges(geo, deg) {
    const pos = geo.attributes.position.array, idx = geo.index.array, n = geo.attributes.position.count;
    const canon = new Uint32Array(n), seen = new Map();
    for (let i = 0; i < n; i++) {
      const k = Math.round(pos[3 * i] * 400) + ',' + Math.round(pos[3 * i + 1] * 400) + ',' + Math.round(pos[3 * i + 2] * 400);
      const c = seen.get(k);
      canon[i] = c === undefined ? (seen.set(k, i), i) : c;
    }
    const thr = Math.cos(deg * D2R), edges = new Map(), out = [];
    const fn = [0, 0, 0];
    for (let f = 0; f < idx.length; f += 3) {
      const a = idx[f], b = idx[f + 1], c = idx[f + 2];
      const ux = pos[3 * b] - pos[3 * a], uy = pos[3 * b + 1] - pos[3 * a + 1], uz = pos[3 * b + 2] - pos[3 * a + 2];
      const vx = pos[3 * c] - pos[3 * a], vy = pos[3 * c + 1] - pos[3 * a + 1], vz = pos[3 * c + 2] - pos[3 * a + 2];
      fn[0] = uy * vz - uz * vy; fn[1] = uz * vx - ux * vz; fn[2] = ux * vy - uy * vx;
      const l = Math.hypot(fn[0], fn[1], fn[2]) || 1;
      const nx = fn[0] / l, ny = fn[1] / l, nz = fn[2] / l;
      for (const [p, q] of [[a, b], [b, c], [c, a]]) {
        const cp = canon[p], cq = canon[q];
        if (cp === cq) continue;
        const key = cp < cq ? cp * 4294967296 + cq : cq * 4294967296 + cp;
        const e = edges.get(key);
        if (!e) edges.set(key, [p, q, nx, ny, nz, 1]);
        else { e[5]++; if (e[2] * nx + e[3] * ny + e[4] * nz < thr) e[6] = 1; }
      }
    }
    edges.forEach(e => { if (e[5] === 1 || e[6]) out.push(e[0], e[1]); });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', geo.attributes.position);
    g.setIndex(out);
    return g;
  }

  function start(GEO) {
    /* ---------- the probe: CAD frame inside a group that is turned into the bench or flight attitude ---------- */
    const probe = new THREE.Group();
    scene.add(probe);
    const mesh = (name, parent) => {
      const m = new THREE.Mesh(GEO[name], M[PART_MAT[name]]);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    };
    const lower = mesh('lower', probe);
    const lowerEdges = new THREE.LineSegments(sharpEdges(GEO.lower, 32), edgeMat);
    probe.add(lowerEdges);
    // board and what is soldered to it, pivoting about the far top edge of the board
    const PIVOT = new THREE.Vector3(0, 0, -40.2);
    const boardG = new THREE.Group(), boardIn = new THREE.Group();
    boardIn.position.copy(PIVOT).negate();
    boardG.add(boardIn);
    probe.add(boardG);
    ['pcb', 'comps_dark', 'comps_light', 'can', 'holder_neg', 'holder_pos', 'fpc'].forEach(n => mesh(n, boardIn));
    // conical coil spring of the negative contact, drawn so it can be compressed without flattening the wire
    const SPR = { ax: 5.35, R0: 2.45, R1: 1.45, r: 0.17, turns: 4.25 };
    const springMesh = new THREE.Mesh(new THREE.BufferGeometry(), M.metal);
    springMesh.castShadow = true;
    boardIn.add(springMesh);
    let springLen = -1;
    function setSpring(L) {
      if (Math.abs(L - springLen) < 1e-4) return;
      springLen = L;
      const N = Math.round(SPR.turns * 40), pts = [], flat = 1 / SPR.turns;
      for (let i = 0; i <= N; i++) {
        const u = i / N, a = 2 * Math.PI * SPR.turns * u, R = SPR.R0 + (SPR.R1 - SPR.R0) * u;
        const h = u < flat ? 0 : (u - flat) / (1 - flat) * Math.max(0, L - 2 * SPR.r);   // first turn closed on the clip
        pts.push(new THREE.Vector3(SPR.ax + R * Math.cos(a), R * Math.sin(a), SPRING.base + SPR.r + h));
      }
      springMesh.geometry.dispose();
      springMesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, SPR.r, 8, false);
    }
    // the cell pivots about the centre of its negative end
    const CELL_PIVOT = V(CELL.cx, 0, CELL.zNeg);
    const cellG = new THREE.Group();
    probe.add(cellG);
    // the AAA cell, lathed from the CAD profile (a closed solid, so its section reads cleanly)
    const cellGeo = new THREE.LatheGeometry([[0, -13.36], [4.95, -13.36], [5.25, -13.06], [5.25, 32.0], [4.95, 32.3], [1.85, 32.3],
      [1.85, 33.2], [1.6, 33.44], [0, 33.44]].map(([r, z]) => new THREE.Vector2(r, z)), 72);
    cellGeo.rotateX(Math.PI / 2);
    cellGeo.translate(CELL.cx, 0, 0);
    const cell = new THREE.Mesh(cellGeo, M.cell);
    cell.castShadow = cell.receiveShadow = true;
    cellG.add(cell);
    cell.position.copy(CELL_PIVOT).negate();
    const flex = mesh('flex', probe);
    {
      // stiffener: as wide as the flex at the slot, filling the slot with the flex
      const fp = GEO.flex.attributes.position.array;
      let y0 = 99, y1 = -99;
      for (let i = 0; i < fp.length; i += 3) if (fp[i] > STIFF.x0 && fp[i] < STIFF.x1) { y0 = Math.min(y0, fp[i + 1]); y1 = Math.max(y1, fp[i + 1]); }
      const sg = new THREE.BoxGeometry(STIFF.x1 - STIFF.x0, y1 - y0, STIFF.z1 - STIFF.z0);
      sg.translate((STIFF.x0 + STIFF.x1) / 2, (y0 + y1) / 2, (STIFF.z0 + STIFF.z1) / 2);
      const stiff = new THREE.Mesh(sg, mat({ color: 0xd99a2b, roughness: 0.45, metalness: 0 }, 0xb87a17));
      stiff.castShadow = true;
      flex.add(stiff);
    }
    flex.frustumCulled = false;
    const coverG = new THREE.Group();
    probe.add(coverG);
    const cover = mesh('upper', coverG);
    const coverEdges = new THREE.LineSegments(new THREE.EdgesGeometry(GEO.upper, 32), edgeMatCover);
    coverG.add(coverEdges);
    // a thin flat tool for bending the hook back (a fingernail does the same)
    const toolG = new THREE.Group();
    const tool = new THREE.Mesh(new THREE.BoxGeometry(26, 2.0, 0.3), M.tool);
    tool.position.x = 13;
    tool.castShadow = true;
    toolG.add(tool);
    probe.add(toolG);

    /* ---------- bending: hook (cantilever) and the four clip bars, on the lower shell ---------- */
    const lPos = GEO.lower.attributes.position, l0 = Float32Array.from(lPos.array);
    const hookV = [], lipV = [], barV = [];
    for (let i = 0; i < lPos.count; i++) {
      const x = l0[3 * i], y = l0[3 * i + 1], z = l0[3 * i + 2];
      if (y >= HOOK.y0 && y <= HOOK.y1 && z >= HOOK.z0 && z <= HOOK.z1 && x >= HOOK.root - 0.02) {
        (z < HOOK.zIn && x > HOOK.lipX ? lipV : hookV).push(i);
      } else if (x >= -0.45 && x <= 0.9 && Math.abs(y) >= 8.05 && Math.abs(y) <= 9.55) {
        for (const zc of BARS) {
          const d = Math.abs(z - zc);
          if (d <= 6.2) {
            const w = d <= 3.1 ? 1 : 1 - (u => u * u * (3 - 2 * u))((d - 3.1) / 3.1);
            barV.push(i, w);
          }
        }
      }
    }
    const L = HOOK.top - HOOK.root;
    const hu = (s, d) => d * (3 * s * s * L - s * s * s) / (2 * L * L * L);
    const hs = (s, d) => d * (6 * s * L - 3 * s * s) / (2 * L * L * L);
    // position of a point of the hook (rest x, z) with the top pushed out by d: the wall bends as a cantilever
    // up to the level of the lip, and the head (wall top and lip) turns with it as one piece
    function hookPoint(x, z, d, out) {
      if (x <= HOOK.root) { out[0] = x; out[1] = z; return; }
      const head = x > HOOK.px || (z < HOOK.zIn && x > HOOK.lipX);
      const s = head ? HOOK.px - HOOK.root : x - HOOK.root;
      const th = hs(s, d), u = hu(s, d);
      const dx = head ? x - HOOK.px : 0, dz = z - HOOK.zc;
      out[0] = HOOK.root + s + dx * Math.cos(th) - dz * Math.sin(th);
      out[1] = HOOK.zc + u + dx * Math.sin(th) + dz * Math.cos(th);
    }
    const hp = [0, 0];
    let lastHook = -1, lastBar = -1;
    function setLower(d, b) {
      if (Math.abs(d - lastHook) < 1e-4 && Math.abs(b - lastBar) < 1e-4) return;
      const changedHook = Math.abs(d - lastHook) >= 1e-4;
      lastHook = d; lastBar = b;
      const p = lPos.array;
      if (changedHook) {
        for (const i of hookV.concat(lipV)) {
          hookPoint(l0[3 * i], l0[3 * i + 2], d, hp);
          p[3 * i] = hp[0]; p[3 * i + 2] = hp[1];
        }
      }
      for (let k = 0; k < barV.length; k += 2) {
        const i = barV[k], w = barV[k + 1], y = l0[3 * i + 1];
        p[3 * i + 1] = y - Math.sign(y) * b * w;
      }
      lPos.needsUpdate = true;
      GEO.lower.computeVertexNormals();
    }

    /* ---------- flex: the part outside the cover sags in an even arc, by the share of gravity across the strip ---------- */
    const fPos = GEO.flex.attributes.position, f0 = Float32Array.from(fPos.array);
    const FN = 160, fx = new Float32Array(FN + 1), fz = new Float32Array(FN + 1), fa = new Float32Array(FN + 1);
    let lastBend = NaN;
    function setFlex(k) {
      if (Math.abs(k - lastBend) < 1e-4) return;
      lastBend = k;
      const A = k * FLEX.tipAngle, ds = FLEX.len / FN;
      fx[0] = FLEX.xb; fz[0] = FLEX.zc; fa[0] = 0;
      for (let i = 1; i <= FN; i++) {
        const a = A * i / FN, am = (a + fa[i - 1]) / 2;
        fa[i] = a; fx[i] = fx[i - 1] + ds * Math.cos(am); fz[i] = fz[i - 1] - ds * Math.sin(am);
      }
      const p = fPos.array;
      for (let i = 0; i < fPos.count; i++) {
        const x = f0[3 * i], z = f0[3 * i + 2];
        if (x <= FLEX.xb) { p[3 * i] = x; p[3 * i + 2] = z; continue; }
        const s = Math.min(FN, (x - FLEX.xb) / ds), j = Math.min(FN - 1, Math.floor(s)), u = s - j;
        const cx = fx[j] + (fx[j + 1] - fx[j]) * u, cz = fz[j] + (fz[j + 1] - fz[j]) * u, a = fa[j] + (fa[j + 1] - fa[j]) * u;
        const d = z - FLEX.zc;
        p[3 * i] = cx + d * Math.sin(a); p[3 * i + 2] = cz + d * Math.cos(a);
      }
      fPos.needsUpdate = true;
      GEO.flex.computeVertexNormals();
    }

    /* ---------- cell contacts: clip arms spread as the cell passes their tips, the spring and the leaf are pushed back ---------- */
    function contactSet(geo, classify) {
      const p = geo.attributes.position, r = Float32Array.from(p.array), idx = [];
      for (let i = 0; i < p.count; i++) {
        const w = classify(r[3 * i], r[3 * i + 1], r[3 * i + 2]);
        if (w > 0) idx.push(i, w);
      }
      return { geo, p, r, idx, last: -1 };
    }
    // side arms of the two clips (|y| > 2.7); each is pushed out, height by height, exactly as far as the cell needs
    const ARM_BIN = 0.25, ARM_NB = 48;
    function armSet(geo) {
      const S = contactSet(geo, (x, y) => (Math.abs(y) > 2.7 ? 1 : 0));
      S.need = new Float32Array(2 * ARM_NB);
      S.key = '';
      return S;
    }
    const armsNeg = armSet(GEO.holder_neg), armsPos = armSet(GEO.holder_pos);
    function pushArms(S, axisAt, c, zLo, zHi, on) {
      const key = on ? axisAt(0).toFixed(4) + '|' + c.toFixed(5) + '|' + zLo.toFixed(3) : 'off';
      if (key === S.key) return false;
      S.key = key;
      const need = S.need, r = S.r, p = S.p.array;
      need.fill(0);
      if (on) {
        for (let k = 0; k < S.idx.length; k += 2) {
          const i = S.idx[k], x = r[3 * i], y = r[3 * i + 1], z = r[3 * i + 2];
          if (z < zLo || z > zHi) continue;
          const dx = (x - axisAt(z)) * c;
          if (Math.abs(dx) >= CELL.R) continue;
          const req = Math.sqrt(CELL.R * CELL.R - dx * dx) + 0.06 - Math.abs(y);   // cell surface plus a little clearance
          if (req > 0) {
            const b = (y > 0 ? ARM_NB : 0) + Math.min(ARM_NB - 1, Math.max(0, Math.floor(x / ARM_BIN)));
            if (req > need[b]) need[b] = req;
          }
        }
        for (let sd = 0; sd < 2; sd++) {
          const o = sd * ARM_NB, b3 = Math.floor(3 / ARM_BIN);
          for (let b = b3 + 1; b < ARM_NB; b++) need[o + b] = Math.max(need[o + b], need[o + b - 1]);        // the arm above a push moves at least as far
          for (let b = ARM_NB - 2; b >= 0; b--) need[o + b] = Math.max(need[o + b], need[o + b + 1] - 0.6 * ARM_BIN);  // and bends smoothly below it
        }
      }
      for (let k = 0; k < S.idx.length; k += 2) {
        const i = S.idx[k], x = r[3 * i], y = r[3 * i + 1];
        const b = (y > 0 ? ARM_NB : 0) + Math.min(ARM_NB - 1, Math.max(0, Math.floor(x / ARM_BIN)));
        p[3 * i + 1] = y + Math.sign(y) * need[b];
      }
      S.p.needsUpdate = true;
      return true;
    }
    const leaf = contactSet(GEO.holder_pos, (x, y, z) => (Math.abs(y) < 2.6 && z > 31.6 && x > 0.7 ? Math.min(1.6, (x - 0.6) / 5.4) : 0));
    function bendSet(S, amount, apply) {
      if (Math.abs(amount - S.last) < 1e-4) return false;
      S.last = amount;
      for (let k = 0; k < S.idx.length; k += 2) apply(S.p.array, S.r, S.idx[k], S.idx[k + 1], amount);
      S.p.needsUpdate = true;
      return true;
    }
    function setContacts(lift, shift, tilt) {
      const s = Math.sin(tilt), c = Math.cos(tilt), px = CELL.cx + lift, pz = CELL.zNeg + shift;
      const axisAt = z => px + (z - pz) / c * s;                                  // height of the cell axis at z
      const zEnd = pz + CELL.len * c + CELL.R * s;                                 // the cell's far end along z
      const changed = [
        pushArms(armsNeg, axisAt, c, pz - 0.3, zEnd, lift < 30),
        pushArms(armsPos, axisAt, c, pz - 0.3, zEnd, lift < 30),
        // the leaf is pushed by the nub, or by the cell's lower edge while the cell is still tilted
        bendSet(leaf, (px + CELL.len * s - CELL.R * c > 10.5 ? 0 : Math.max(0, pz + CELL.len * c + 3 * CELL.R * s - LEAF_APEX)),
          (p, r, i, w, e) => { p[3 * i + 2] = r[3 * i + 2] + e * w; }),
      ];
      if (changed[0]) GEO.holder_neg.computeVertexNormals();
      if (changed[1] || changed[2]) GEO.holder_pos.computeVertexNormals();
      setSpring(lift > 3 ? SPRING.free : Math.min(SPRING.free, Math.max(0.36, pz - SPRING.base)));
    }

    /* ---------- attitude: bench, flight, and the turn about the thread to show the outside of the floor ---------- */
    const qTmp = new THREE.Quaternion(), qTw = new THREE.Quaternion(), vTmp = new THREE.Vector3(), Y = V(0, 1, 0);
    function setAttitude(u, tw) {
      qTmp.copy(qBench).slerp(qFlight, u);
      if (tw > 0) {
        qTmp.premultiply(qTw.setFromAxisAngle(Y, TWIST * tw));
        vTmp.copy(RING).applyQuaternion(qTmp).negate().add(RING_W);          // turn about the vertical through the ring
      } else {
        vTmp.copy(CENTRE).applyQuaternion(qTmp).negate();
      }
      probe.quaternion.copy(qTmp);
      probe.position.copy(vTmp);
      probe.updateMatrixWorld(true);
    }

    /* ---------- thread and arrows (world space) ---------- */
    const inkMat = new THREE.MeshBasicMaterial({ color: 0x2b2e34, transparent: true });
    const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 1, 8), inkMat);
    thread.castShadow = false;
    scene.add(thread);
    function arrow(color, onTop) {
      const m = new THREE.MeshBasicMaterial({ color, transparent: true, depthTest: !onTop });
      const g = new THREE.Group();
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 1, 12), m);
      const head = new THREE.Mesh(new THREE.ConeGeometry(1.7, 4.4, 20), m);
      g.add(shaft, head);
      g.userData = { m, shaft, head };
      if (onTop) { shaft.renderOrder = head.renderOrder = 20; }
      scene.add(g);
      return g;
    }
    const tArrow = arrow(0xa0561c, false), wArrow = arrow(0x24272c, true);
    function setArrow(a, from, dirY, len, op) {
      a.visible = op > 0.01;
      if (!a.visible) return;
      const { m, shaft, head } = a.userData;
      m.opacity = op;
      const sl = Math.max(0.01, len - 4.4);
      shaft.scale.y = sl;
      shaft.position.y = dirY * sl / 2;
      head.position.y = dirY * (sl + 2.2);
      head.rotation.x = dirY > 0 ? 0 : Math.PI;
      a.position.copy(from);
    }

    /* ---------- labels ---------- */
    const labelsEl = document.getElementById('labels');
    const pl = new THREE.Vector3();
    const LABELS = [
      { text: 'Power button', at: () => probe.localToWorld(pl.copy(BUTTON)), win: [at('back', 0.8), at('back', 1.95)], cls: 'lbl--dot lbl--left' },
      { text: 'LED window', at: () => probe.localToWorld(pl.copy(LED)), win: [at('back', 0.9), at('back', 1.95)], cls: 'lbl--dot' },
      { text: '20 g', at: () => wArrow.position.clone().add(V(2.4, -23, 0)), win: [at('load', 1.3), TOTAL + 1], cls: '' },
    ].map(L => {
      L.el = document.createElement('div');
      L.el.className = ('lbl ' + L.cls).trim();
      L.el.appendChild(document.createElement('span')).textContent = L.text;
      labelsEl.appendChild(L.el);
      L.op = -1;
      return L;
    });
    const tv = new THREE.Vector3();
    function updateLabels(t) {
      const w = viewer.clientWidth, h = viewer.clientHeight;
      for (const L of LABELS) {
        let a = win(t, L.win[0], L.win[0] + 0.3) * (1 - win(t, L.win[1] - 0.3, L.win[1])) * (1 - T.fade.at(t));
        if (a > 0.01) {
          tv.copy(L.at()).project(camera);
          L.el.style.transform = 'translate(' + ((tv.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-tv.y * 0.5 + 0.5) * h).toFixed(1) + 'px)';
        }
        const op = Math.round(a * 100) / 100;
        if (op !== L.op) { L.el.style.opacity = op; L.op = op; }
      }
    }

    /* ---------- magnifiers: sections through the hook and through a clip ---------- */
    const SVGNS = 'http://www.w3.org/2000/svg';
    const leaders = document.getElementById('leaders');
    const detailCam = new THREE.PerspectiveCamera(8, 1.4, 1, 2000);
    const clipPlane = new THREE.Plane();
    const MAGS = {
      hook: {
        text: 'Ring end, in section · the hook is bent back, the board drops onto its rests, the hook springs back over it',
        side: 'right', plane: [0, -1, 0, -0.4], depth: 1.6,            // keep y <= -0.4
        eye: [0.35, 60, 39.6], tgt: [0.35, -0.4, 39.6], half: 3.6, anchor: [0.8, -0.4, 40.6],
      },
      clip: {
        text: 'Clip, in section · the bar flexes in over the cover’s barb and springs back above it',
        side: 'left', plane: [0, 0, 1, 19.5], depth: 3.0,              // keep z >= -19.5
        eye: [0.5, 9.4, -75], tgt: [0.5, 9.4, -19.5], half: 3.4, anchor: [-0.6, 9.9, -19.5],
      },
    };
    Object.values(MAGS).forEach(m => {
      m.el = document.createElement('div');
      m.el.className = 'mag';
      m.veil = m.el.appendChild(document.createElement('i'));          // fades the close-up in and out
      m.veil.className = 'mag__veil';
      m.el.appendChild(document.createElement('span')).textContent = m.text;
      viewer.appendChild(m.el);
      m.ln = document.createElementNS(SVGNS, 'line');
      m.dot = document.createElementNS(SVGNS, 'circle');
      m.dot.setAttribute('r', '3');
      leaders.append(m.ln, m.dot);
    });
    const hint = viewer.querySelector('.hint');
    const pv = new THREE.Vector3(), up = new THREE.Vector3();
    function render(t) {
      const w = viewer.clientWidth, h = viewer.clientHeight;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
      renderer.render(scene, camera);
      let anyMag = false;
      Object.entries(MAGS).forEach(([k, m]) => {
        const [a, b] = MAGS_ON[k];
        const kk = win(t, a, a + 0.3) * (1 - win(t, b - 0.3, b));
        const on = kk > 0.01;
        m.el.style.display = m.ln.style.display = m.dot.style.display = on ? '' : 'none';
        if (!on) return;
        anyMag = true;
        m.veil.style.opacity = (1 - kk).toFixed(3);
        m.el.style.borderColor = 'rgba(20,21,26,' + kk.toFixed(3) + ')';
        m.el.lastChild.style.opacity = kk.toFixed(3);
        const bw = Math.round(Math.min(330, w * (w < 600 ? 0.46 : 0.36))), bh = Math.round(bw * 0.66);
        const x = m.side === 'left' ? 14 : w - 14 - bw, y = m.side === 'left' ? 14 : h - 14 - bh;   // viewport origin is bottom-left
        probe.localToWorld(detailCam.position.set(...m.eye));
        probe.localToWorld(pv.set(...m.tgt));
        up.set(1, 0, 0).applyQuaternion(probe.quaternion);
        detailCam.up.copy(up);
        detailCam.lookAt(pv);
        detailCam.aspect = bw / bh;
        const dist = detailCam.position.distanceTo(pv);
        detailCam.fov = 2 * Math.atan(m.half / dist) / D2R;
        detailCam.updateProjectionMatrix();
        magFog.near = dist + 0.4; magFog.far = dist + m.depth;      // what lies far behind the cut fades out; caps stay
        scene.fog = magFog;
        clipPlane.normal.set(m.plane[0], m.plane[1], m.plane[2]);
        clipPlane.constant = m.plane[3];
        clipPlane.applyMatrix4(probe.matrixWorld);
        renderer.clippingPlanes = [clipPlane];
        capOn.value = 1;
        fade.visible = false;
        renderer.setScissorTest(true);
        renderer.setViewport(x, y, bw, bh);
        renderer.setScissor(x, y, bw, bh);
        renderer.render(scene, detailCam);
        renderer.clippingPlanes = [];
        capOn.value = 0;
        scene.fog = null;
        fade.visible = true;
        Object.assign(m.el.style, { left: x + 'px', bottom: y + 'px', width: bw + 'px', height: bh + 'px' });
        probe.localToWorld(pv.set(...m.anchor)).project(camera);
        const ax = (pv.x * 0.5 + 0.5) * w, ay = (-pv.y * 0.5 + 0.5) * h;
        const ex = m.side === 'left' ? x + bw : x, ey = h - y - bh / 2;
        m.ln.setAttribute('x1', ex.toFixed(1)); m.ln.setAttribute('y1', ey.toFixed(1));
        m.ln.setAttribute('x2', ax.toFixed(1)); m.ln.setAttribute('y2', ay.toFixed(1));
        m.dot.setAttribute('cx', ax.toFixed(1)); m.dot.setAttribute('cy', ay.toFixed(1));
        m.ln.style.opacity = m.dot.style.opacity = kk;
      });
      if (hint) hint.style.opacity = anyMag ? 0 : 1;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, w, h);
    }

    /* ---------- camera with a user orbit offset ---------- */
    const user = { yaw: 0, pitch: 0, zoom: 1 };
    let fit = 1;
    const sph = new THREE.Spherical(), off = new THREE.Vector3();
    function applyCamera(p, g) {
      off.set(p[0] - g[0], p[1] - g[1], p[2] - g[2]);
      sph.setFromVector3(off);
      sph.theta += user.yaw;
      sph.phi = Math.min(2.9, Math.max(0.12, sph.phi + user.pitch));
      sph.radius *= user.zoom * fit;
      off.setFromSpherical(sph);
      camera.position.set(g[0] + off.x, g[1] + off.y, g[2] + off.z);
      camera.lookAt(g[0], g[1], g[2]);
    }

    /* ---------- DOM ---------- */
    const $ = id => document.getElementById(id);
    const stepEls = [...document.querySelectorAll('.steps > li')];
    const hudWhere = $('hudWhere'), hudNum = $('hudNum'), hudTitle = $('hudTitle');
    const btnPlay = $('btnPlay'), scrub = $('scrub'), timeEl = $('time'), btnSpeed = $('btnSpeed'), btnReset = $('btnReset');
    const ICON = {
      play: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
      pause: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>',
    };
    const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    scrub.max = TOTAL;
    PHASES.slice(1).forEach(p => {
      const i = document.createElement('i');
      i.style.left = 'calc(7px + (100% - 14px) * ' + (p.start / TOTAL).toFixed(4) + ')';
      $('ticks').appendChild(i);
    });
    const phaseAt = t => { let i = 0; while (i < PHASES.length - 1 && t >= PHASES[i + 1].start) i++; return i; };
    let curPhase = -1;
    function setPhase(i) {
      curPhase = i;
      const li = stepEls[i];
      hudNum.textContent = String(i + 1).padStart(2, '0');
      hudTitle.textContent = li.querySelector('.steps__t').textContent;
      hudWhere.textContent = li.dataset.where;
      stepEls.forEach((el, k) => el.classList.toggle('is-active', k === i));
    }

    /* ---------- per frame ---------- */
    // the tool leans out over the end wall, away from the board's path
    const LEAN = 0.5, toolTip = [0, 0], toolDir = V(Math.cos(LEAN), 0, Math.sin(LEAN));
    function update(t) {
      // board into the lower shell; hook bent back by the tool, then released
      const [bx, bz, bt] = T.board.at(t);
      boardG.visible = t >= at('board', 0.4);
      boardG.position.set(PIVOT.x + bx, PIVOT.y, PIVOT.z + bz);
      boardG.rotation.set(0, bt * D2R, 0);
      const d = T.hook.at(t);
      const o = T.cover.at(t);
      setLower(d, t >= at('cover', 0) ? barDefl(o) : 0);
      const tu = T.tool.at(t);
      toolG.visible = t > at('board', 0.3) && t < at('board', 3.2);
      hookPoint(HOOK.tip[0], HOOK.tip[1], d, toolTip);
      // the tool's tip sits on the top edge of the hook's upward tab and pulls it outward; it never goes below the tab
      toolG.position.set(toolTip[0] + 0.03 + toolDir.x * tu, -0.45, toolTip[1] - 0.1 + toolDir.z * tu);
      toolG.rotation.set(0, -LEAN, 0);

      // flex and cell onto the board, then the cover down the flex
      flex.visible = t >= at('cell', 0);
      flex.position.x = T.flex.at(t);
      const [cl, cs, ct] = T.cell.at(t);
      cellG.visible = t >= at('cell', 0.5);
      cellG.position.set(CELL_PIVOT.x + cl, 0, CELL_PIVOT.z + cs);
      cellG.rotation.set(0, ct * D2R, 0);
      setContacts(cellG.visible ? cl : 99, cs, ct * D2R);
      coverG.visible = t >= at('cover', 0);
      coverG.position.x = o;
      // parts still above the frame cast no shadow
      boardIn.children.forEach(m => { m.castShadow = bx < 15; });
      flex.castShadow = flex.position.x < 15;
      cell.castShadow = cl < 15;

      // flight: turn to hang from the ring, thread; then a turn about the thread to show the floor.
      // The flex sags with the part of gravity across it: none while it points up, all of it once it sticks out level.
      setAttitude(T.turn.at(t), T.twist.at(t));
      setFlex(vTmp.set(0, 0, 1).applyQuaternion(probe.quaternion).y);
      groundMat.opacity = 0.15 * (1 - win(t, at('flight', 0), at('flight', 0.7)));
      ground.visible = groundMat.opacity > 0.001;
      const th = T.thread.at(t);
      thread.visible = th > 0.001;
      if (thread.visible) {
        probe.localToWorld(pv.copy(RING));
        const top = pv.y + 260, bottom = top + (pv.y - top) * th;
        thread.scale.y = top - bottom;
        thread.position.set(pv.x, (top + bottom) / 2, pv.z);
      }

      // load path: cover ghosted, tint sweeping from the ring down the lower shell, arrows
      const g = T.ghost.at(t);
      M.upper.opacity = 1 - 0.84 * g;
      if (M.upper.transparent !== g > 0.001) { M.upper.transparent = g > 0.001; M.upper.needsUpdate = true; }
      M.upper.depthWrite = g < 0.01;
      edgeMatCover.opacity = 0.26 * (1 - 0.7 * g);
      cover.castShadow = g < 0.5 && o < 15;
      sweepZ.value = T.sweep.at(t);
      sweepK.value = 0.5 * win(t, at('load', 0.2), at('load', 0.5));
      const ar = T.arrows.at(t) * (1 - T.fade.at(t));
      probe.localToWorld(pv.copy(RING));
      setArrow(tArrow, vTmp.set(pv.x, pv.y + 3, pv.z), 1, 15 * T.arrows.at(t) + 0.01, ar);
      probe.localToWorld(vTmp.copy(CG));
      setArrow(wArrow, vTmp, -1, 22 * T.arrows.at(t) + 0.01, ar);
      fadeMat.uniforms.a.value = T.fade.at(t);

      const pi = phaseAt(t);
      if (pi !== curPhase) setPhase(pi);
      const tgt = T.camTgt.at(t), pos = T.camPos.at(t);
      applyCamera(pos, tgt);
      sun.target.position.set(tgt[0], tgt[1], tgt[2]);
      sun.target.updateMatrixWorld();
    }

    /* ---------- playback (same controls as the AMS-02 and valve animations; this one loops) ---------- */
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0, playing = false, speed = 1, scrubbing = false, dirty = true, loaded = false, last = performance.now();
    function setPlaying(p) {
      playing = p;
      btnPlay.innerHTML = p ? ICON.pause : ICON.play;
      btnPlay.setAttribute('aria-label', p ? 'Pause' : 'Play');
    }
    function seek(nt) { t = Math.min(TOTAL, Math.max(0, nt)); dirty = true; }
    function jumpTo(i, play) { seek(PHASES[Math.max(0, Math.min(PHASES.length - 1, i))].start); if (play) setPlaying(true); }
    btnPlay.addEventListener('click', () => setPlaying(!playing));
    $('btnPrev').addEventListener('click', () => { const i = phaseAt(t); jumpTo(t - PHASES[i].start > 0.6 ? i : i - 1, playing); });
    $('btnNext').addEventListener('click', () => { jumpTo((phaseAt(t) + 1) % PHASES.length, playing); });
    btnSpeed.addEventListener('click', () => {
      speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
      btnSpeed.textContent = (speed === 0.5 ? '½' : speed) + '×';
    });
    stepEls.forEach((li, i) => li.querySelector('button').addEventListener('click', () => jumpTo(i, true)));
    scrub.addEventListener('pointerdown', () => { scrubbing = true; });
    window.addEventListener('pointerup', () => { scrubbing = false; });
    scrub.addEventListener('input', () => { t = +scrub.value; dirty = true; });
    viewer.addEventListener('keydown', e => {
      if (e.key === ' ' || e.key === 'k') { e.preventDefault(); btnPlay.click(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); $('btnNext').click(); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); $('btnPrev').click(); }
    });
    let drag = null;
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, id: e.pointerId };
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add('is-dragging');
    });
    canvas.addEventListener('pointermove', e => {
      if (!drag || e.pointerId !== drag.id) return;
      user.yaw -= (e.clientX - drag.x) * 0.006;
      if (e.pointerType === 'mouse') user.pitch = Math.max(-1.2, Math.min(1.2, user.pitch - (e.clientY - drag.y) * 0.005));
      drag.x = e.clientX; drag.y = e.clientY;
      btnReset.classList.add('is-shown');
      dirty = true;
    });
    const endDrag = () => { drag = null; canvas.classList.remove('is-dragging'); };
    canvas.addEventListener('pointerup', endDrag);
    canvas.addEventListener('pointercancel', endDrag);
    canvas.addEventListener('wheel', e => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      user.zoom = Math.max(0.35, Math.min(2.2, user.zoom * Math.exp(e.deltaY * 0.0015)));
      btnReset.classList.add('is-shown');
      dirty = true;
    }, { passive: false });
    btnReset.addEventListener('click', () => {
      user.yaw = 0; user.pitch = 0; user.zoom = 1;
      btnReset.classList.remove('is-shown');
      dirty = true;
    });
    function resize() {
      const w = viewer.clientWidth, h = viewer.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      fit = Math.pow(Math.max(1, 1.6 / camera.aspect), 0.9);
      dirty = true;
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(viewer);
    else window.addEventListener('resize', resize);
    resize();
    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (playing && !scrubbing) {
        t += dt * speed;
        if (t >= TOTAL) t -= TOTAL;
        dirty = true;
      }
      if (dirty) {
        dirty = false;
        update(t);
        render(t);
        if (!loaded) { loaded = true; viewer.classList.add('is-loaded'); }
        updateLabels(t);
        if (!scrubbing) scrub.value = t;
        scrub.style.setProperty('--p', (100 * t / TOTAL).toFixed(2) + '%');
        timeEl.textContent = fmt(t) + ' / ' + fmt(TOTAL);
      }
      requestAnimationFrame(frame);
    }
    // ?step=N or ?t=seconds open paused there (add &play=1 to play); otherwise play once in view
    const q = new URLSearchParams(location.search);
    const deep = (q.has('step') || q.has('t')) && q.get('play') !== '1';
    if (q.has('step')) t = PHASES[Math.max(0, Math.min(PHASES.length - 1, (parseInt(q.get('step'), 10) || 1) - 1))].start;
    else if (q.has('t')) t = Math.min(TOTAL, Math.max(0, parseFloat(q.get('t')) || 0));
    setPlaying(false);
    if (!deep && !poster && !reduceMotion && window.IntersectionObserver) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { io.disconnect(); setPlaying(true); }
      }, { threshold: 0.35 });
      io.observe(viewer);
    }
    if (poster) window.__render = nt => { t = nt; dirty = false; update(t); render(t); updateLabels(t); };
    requestAnimationFrame(frame);
  }
})();
