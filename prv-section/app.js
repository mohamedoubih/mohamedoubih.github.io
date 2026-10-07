/* Miniature pressure-relief valve (Valve 5F): fast assembly, section through the inlet, and one
   pressure cycle showing the gas path and the force balance.
   three.js r149 (classic build). The model is the CATIA assembly exported to GLB (metres, y up,
   rotated so the inlet barb lies in the plane z = 0). Section faces and gas regions come from the
   same CAD, cut at z = 0 (valve_section.json, millimetres). Everything else here is in millimetres.
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

  /* ---------- the physics of the example setting ---------- */
  const A_EFF = 599.5;                 // mm², fitted effective diaphragm area
  const K = 0.27;                      // N/mm
  const X0 = 5.5;                      // mm preload in the cycle
  const kPa2N = p => p * A_EFF * 1e-3; // kPa x mm² -> N
  const PC0 = K * X0 / (A_EFF * 1e-3); // kPa, cracking pressure from the force balance (about 2.48)
  const SCREW = 3;                     // mm the preload screw is turned in at the end
  const LIFT = 1.1;                    // mm, drawn lift of plunger and ball (exaggerated)
  const R_BOND = 13, R_CLAMP = 17.47;  // diaphragm: bonded to the plunger inside R_BOND, clamped at R_CLAMP

  /* ---------- timeline ---------- */
  const PHASES = [['assembly', 7], ['cut', 4], ['parts', 6], ['pressure', 7], ['crack', 7], ['reseal', 4], ['setting', 6]]
    .map(([id, dur]) => ({ id, dur }));
  const PH = {};
  let acc = 0;
  PHASES.forEach((p, i) => { p.start = acc; p.end = acc + p.dur; p.index = i; PH[p.id] = p; acc = p.end; });
  const TOTAL = acc;
  const at = (id, s) => PH[id].start + s;

  const ease = {
    inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    out: u => 1 - Math.pow(1 - u, 3),
    in: u => u * u * u,
    linear: u => u,
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

  // gas pressure above ambient (kPa), plunger lift (mm, drawn), screw travel (mm)
  const T = {
    dp: track([
      [at('pressure', 0.4), 0], [at('pressure', 6.6), PC0, 'in'],
      [at('crack', 0.6), PC0 * 1.01], [at('crack', 6.2), PC0 * 1.005, 'linear'],
      [at('reseal', 1.2), PC0 * 0.9], [at('reseal', 4), PC0 * 0.9],
    ]),
    lift: track([
      [at('crack', 0.15), 0], [at('crack', 0.9), LIFT, 'out'], [at('crack', 6.3), LIFT],
      [at('reseal', 0.9), 0, 'inOut'],
    ]),
    screw: track([[at('setting', 0.6), 0], [at('setting', 3.6), SCREW]]),
    slide: track([[at('cut', 0.3), 0], [at('cut', 3.0), 70]]),
  };
  const CAM = [
    [0, [205, 135, 270], [0, 30, 0]],
    [at('assembly', 5.3), [195, 105, 255], [0, 22, 0]],
    [at('assembly', 7), [155, 70, 205], [0, 20, 0]],
    [at('cut', 1.6), [70, 42, 215], [0, 20, 0]],
    [at('cut', 4), [62, 32, 178], [4, 20, 0]],
    [at('parts', 2.7), [55, 28, 172], [4, 20, 0]],
    [at('parts', 3.7), [12, -4, 96], [12, -4, 0]],
    [at('pressure', 1.4), [12, -4, 96], [12, -4, 0]],
    [at('crack', 7), [12, -4, 92], [12, -4, 0]],
    [at('reseal', 4), [12, -4, 94], [12, -4, 0]],
    [at('setting', 1.4), [16, 21, 176], [16, 21, 0]],
    [TOTAL, [16, 21, 176], [16, 21, 0]],
  ];
  T.camPos = track(CAM.map(([t, p]) => [t, p]));
  T.camTgt = track(CAM.map(([t, , g]) => [t, g]));

  // fast assembly: [part, start offset in y (mm), start time (s)]
  const ASSY = {
    lower_housing: [-45, 0.0], upper_extra: [40, 0.35], ptfe_seat: [45, 0.55], ball: [50, 0.75], plunger: [55, 0.95],
    oring: [55, 1.15], diaphragm: [60, 1.35], spring_seat: [65, 1.55], spring: [70, 1.75], m6_nut_low: [75, 1.95],
    upper_housing: [85, 2.2], m3_bolts: [55, 2.65], m3_nuts: [-40, 2.65], m6_nut_high: [70, 2.95], m6_bolt: [70, 3.05],
  };
  const ASSY_SLOW = 1.4;                                         // assembly pace: 40% slower than the timings above
  Object.values(ASSY).forEach(a => { a[1] *= ASSY_SLOW; });
  const ASSY_DUR = 0.75 * ASSY_SLOW;
  const assyOffset = (name, t) => {
    const a = ASSY[name];
    if (!a) return 0;
    return a[0] * (1 - ease.out(win(t, a[1], a[1] + ASSY_DUR)));
  };
  const assyShown = (name, t) => !ASSY[name] || t >= ASSY[name][1] - 0.02;

  /* ---------- renderer, scene ---------- */
  THREE.ColorManagement.legacyMode = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.localClippingEnabled = true;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const BG = 0xebe8e1;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(BG);
  const camera = new THREE.PerspectiveCamera(32, 1.6, 2, 5000);

  // a simple studio environment so the steel and the resin get some reflections
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb6b0a6, 0.45));
  const sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(-90, 220, 160);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 120, bottom: -60, near: 50, far: 600 });
  sun.shadow.bias = -0.0005;
  scene.add(sun);
  const fillL = new THREE.DirectionalLight(0xfff1e0, 0.35);
  fillL.position.set(160, 60, 90);
  scene.add(fillL);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.ShadowMaterial({ opacity: 0.16 }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -24.5;
  ground.receiveShadow = true;
  scene.add(ground);

  /* ---------- clipping: back half kept at z <= 0, front half at z >= slide ---------- */
  const planeBack = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0);
  const planeFront = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0.001);
  const backRoot = new THREE.Group(), frontRoot = new THREE.Group();
  scene.add(backRoot, frontRoot);

  const MAT = {
    housing: { color: 0x3c4048, roughness: 0.62, metalness: 0.05 },
    resin: { color: 0x4f5560, roughness: 0.55, metalness: 0.05 },
    kapton: { color: 0xd8962a, roughness: 0.35, metalness: 0, transparent: true, opacity: 0.8, side: THREE.DoubleSide },
    steel: { color: 0xd4d7dc, roughness: 0.22, metalness: 1 },
    zinc: { color: 0xb9bdc3, roughness: 0.38, metalness: 0.85 },
    ptfe: { color: 0xf2f1ea, roughness: 0.5, metalness: 0 },
    silicone: { color: 0xf0f0ea, roughness: 0.3, metalness: 0, transparent: true, opacity: 0.93 },
  };
  const PART_MAT = {
    upper_housing: 'housing', lower_housing: 'housing', plunger: 'resin', spring_seat: 'resin', diaphragm: 'kapton',
    ball: 'steel', ptfe_seat: 'ptfe', oring: 'silicone', upper_extra: 'silicone',
    m6_bolt: 'zinc', m6_nut_low: 'zinc', m6_nut_high: 'zinc', m3_bolts: 'zinc', m3_nuts: 'zinc',
  };
  const EDGED = { upper_housing: 1, lower_housing: 1, plunger: 1, spring_seat: 1, ptfe_seat: 1 };
  const frontMats = [];
  function makeMat(kind, front) {
    const m = new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide, envMapIntensity: 0.7 }, MAT[kind]));
    m.clippingPlanes = [front ? planeFront : planeBack];
    m.clipShadows = true;
    if (front) { m.transparent = true; m.userData.baseOpacity = MAT[kind].opacity || 1; frontMats.push(m); }
    return m;
  }
  const edgeBack = new THREE.LineBasicMaterial({ color: 0x16181c, transparent: true, opacity: 0.28, clippingPlanes: [planeBack] });
  const edgeFront = new THREE.LineBasicMaterial({ color: 0x16181c, transparent: true, opacity: 0.28, clippingPlanes: [planeFront] });
  frontMats.push(edgeFront);
  edgeFront.userData.baseOpacity = 0.28;

  /* ---------- section faces, outlines, gas ---------- */
  function hatch(bg, line, dir, gap) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = bg; g.fillRect(0, 0, 64, 64);
    if (line) {
      g.strokeStyle = line; g.lineWidth = 3;
      g.beginPath();
      for (const o of [-64, 0, 64]) {
        if (dir > 0) { g.moveTo(o, 64); g.lineTo(o + 64, 0); } else { g.moveTo(o, 0); g.lineTo(o + 64, 64); }
      }
      g.stroke();
    }
    const tx = new THREE.CanvasTexture(c);
    tx.encoding = THREE.sRGBEncoding;
    tx.wrapS = tx.wrapT = THREE.RepeatWrapping;
    tx.repeat.set(1 / gap, 1 / gap);
    tx.anisotropy = 4;
    return tx;
  }
  const CAP = {
    housing: hatch('#dcdfe4', '#9ba2ad', 1, 1.7),
    resin: hatch('#d5dbe6', '#8e98a8', -1, 1.4),
    metal: hatch('#e6e2d8', '#aaa18d', 1, 0.9),
    ball: hatch('#cfd2d7', '#8d939b', -1, 0.8),
    ptfe: hatch('#f4f4ef', '#c6c8bf', -1, 1.0),
    silicone: hatch('#f6f6f1', null, 1, 1),
  };
  const PART_CAP = {
    upper_housing: 'housing', lower_housing: 'housing', plunger: 'resin', spring_seat: 'resin', ball: 'ball',
    ptfe_seat: 'ptfe', oring: 'silicone', upper_extra: 'silicone', seat_oring: 'silicone', m6_bolt: 'metal', m6_nut_low: 'metal', m6_nut_high: 'metal',
  };
  const capRoot = new THREE.Group();
  capRoot.visible = false;
  scene.add(capRoot);
  const outlineMat = new THREE.LineBasicMaterial({ color: 0x4d535c });
  function shapesFrom(geo) {
    const polys = geo.type === 'MultiPolygon' ? geo.coordinates : [geo.coordinates];
    return polys.map(rings => {
      const s = new THREE.Shape(rings[0].slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)));
      rings.slice(1).forEach(h => s.holes.push(new THREE.Path(h.slice(0, -1).map(([x, y]) => new THREE.Vector2(x, y)))));
      return s;
    });
  }
  function outlineFrom(geo) {
    const polys = geo.type === 'MultiPolygon' ? geo.coordinates : [geo.coordinates];
    const pts = [];
    polys.forEach(rings => rings.forEach(r => {
      for (let i = 0; i < r.length - 1; i++) pts.push(r[i][0], r[i][1], 0, r[i + 1][0], r[i + 1][1], 0);
    }));
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }

  /* ---------- loading ---------- */
  async function loadGLB(url) {
    const buf = await (await fetch(url)).arrayBuffer();
    const dv = new DataView(buf);
    const jl = dv.getUint32(12, true);
    const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
    const bin = 20 + jl + 8;
    const acc = i => {
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
      g.setAttribute('position', new THREE.BufferAttribute(acc(pr.attributes.POSITION), 3));
      if (pr.attributes.NORMAL !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(acc(pr.attributes.NORMAL), 3));
      else g.computeVertexNormals();
      g.setIndex(new THREE.BufferAttribute(acc(pr.indices), 1));
      g.scale(1000, 1000, 1000);                                  // metres -> millimetres
      out[n.name] = g;
    });
    return out;
  }

  Promise.all([loadGLB('valve.glb'), fetch('valve_section.json').then(r => r.json())])
    .then(([geos, sec]) => start(geos, sec))
    .catch(err => {
      console.error(err);
      document.getElementById('fallbackTxt').textContent = 'The valve model could not be loaded. Open this page from the website rather than from a local file.';
      root.classList.add('no-webgl');
    });

  function start(GEO, SEC) {
    /* ---------- parts: a back half and a front half of each ---------- */
    const parts = {};
    Object.keys(GEO).forEach(name => {
      const kind = PART_MAT[name];
      if (!kind) return;
      const geo = GEO[name];
      const pair = {};
      [['back', backRoot, false], ['front', frontRoot, true]].forEach(([side, rootG, front]) => {
        const g = new THREE.Group();
        const m = new THREE.Mesh(geo, makeMat(kind, front));
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
        if (EDGED[name]) {
          if (!geo.userData.edges) geo.userData.edges = new THREE.EdgesGeometry(geo, 28);
          g.add(new THREE.LineSegments(geo.userData.edges, front ? edgeFront : edgeBack));
        }
        rootG.add(g);
        pair[side] = g;
      });
      parts[name] = pair;
    });

    // diaphragm: bonded centre lifts with the plunger, the free annulus bends (clamped-guided plate shape)
    const phi = r => (r <= R_BOND ? 1 : r >= R_CLAMP ? 0 : (s => 1 - 3 * s * s + 2 * s * s * s)((r - R_BOND) / (R_CLAMP - R_BOND)));
    const dGeo = GEO.diaphragm, dPos = dGeo.attributes.position, dY0 = Float32Array.from(dPos.array);
    let lastLift = -1;
    function setDiaphragm(d) {
      if (Math.abs(d - lastLift) < 1e-4) return;
      lastLift = d;
      for (let i = 0; i < dPos.count; i++) {
        const x = dY0[3 * i], z = dY0[3 * i + 2];
        dPos.array[3 * i + 1] = dY0[3 * i + 1] + d * phi(Math.hypot(x, z));
      }
      dPos.needsUpdate = true;
      dGeo.computeBoundingSphere();
    }

    /* ---------- spring (drawn: real rate, approximate coils) ---------- */
    const SPR = { R: 4.75, r: 0.36, turns: 9.5 };
    const springMatB = makeMat('steel', false), springMatF = makeMat('steel', true);
    const springB = new THREE.Mesh(new THREE.BufferGeometry(), springMatB);
    const springF = new THREE.Mesh(new THREE.BufferGeometry(), springMatF);
    springB.castShadow = springF.castShadow = true;
    const springGB = new THREE.Group(), springGF = new THREE.Group();
    springGB.add(springB); springGF.add(springF);
    backRoot.add(springGB); frontRoot.add(springGF);
    const springY = (yb, yt, tn) => {
      const n = SPR.turns, p0 = 2 * SPR.r, L = (yt - SPR.r) - (yb + SPR.r), pa = (L - 2 * p0) / (n - 2);
      const h = tn < 1 ? tn * p0 : tn > n - 1 ? p0 + (n - 2) * pa + (tn - n + 1) * p0 : p0 + (tn - 1) * pa;
      return yb + SPR.r + h;
    };
    let springKey = '';
    function setSpring(yb, yt) {
      const key = yb.toFixed(3) + '|' + yt.toFixed(3);
      if (key === springKey) return;
      springKey = key;
      const pts = [], N = Math.round(SPR.turns * 36);
      for (let i = 0; i <= N; i++) {
        const tn = SPR.turns * i / N, a = 2 * Math.PI * tn;
        pts.push(new THREE.Vector3(SPR.R * Math.cos(a), springY(yb, yt, tn), SPR.R * Math.sin(a)));
      }
      const g = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, SPR.r, 8, false);
      springB.geometry.dispose();
      springB.geometry = g; springF.geometry = g;
      // section of the wire: where the helix crosses z = 0
      for (let k = 0; k < wireCaps.count; k++) {
        const tn = k / 2, x = k % 2 ? -SPR.R : SPR.R;
        mM.makeTranslation(x, springY(yb, yt, tn), 0.05);
        wireCaps.setMatrixAt(k, mM);
      }
      wireCaps.instanceMatrix.needsUpdate = true;
    }
    const mM = new THREE.Matrix4();
    const wireCaps = new THREE.InstancedMesh(new THREE.CircleGeometry(SPR.r, 16),
      new THREE.MeshBasicMaterial({ color: 0x8e949d }), Math.floor(SPR.turns * 2) + 1);
    wireCaps.frustumCulled = false;
    capRoot.add(wireCaps);

    /* ---------- section faces of the parts ---------- */
    const caps = {};
    Object.entries(SEC.parts).forEach(([name, geo]) => {
      const kind = PART_CAP[name];
      if (!kind) return;
      const g = new THREE.Group();
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shapesFrom(geo)), new THREE.MeshBasicMaterial({ map: CAP[kind] }));
      m.position.z = 0.03;
      const ol = new THREE.LineSegments(outlineFrom(geo), outlineMat);
      ol.position.z = 0.035;
      g.add(m, ol);
      capRoot.add(g);
      caps[name] = g;
    });
    // diaphragm section: a band (drawn 0.3 mm thick) that follows the deflection
    const DN = 160, dx0 = -24.93, dx1 = 24.93;
    const dBandGeo = new THREE.BufferGeometry();
    const dBandPos = new Float32Array((DN + 1) * 2 * 3);
    const dIdx = [];
    for (let i = 0; i < DN; i++) { const a = 2 * i; dIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    dBandGeo.setAttribute('position', new THREE.BufferAttribute(dBandPos, 3));
    dBandGeo.setIndex(dIdx);
    const dBand = new THREE.Mesh(dBandGeo, new THREE.MeshBasicMaterial({ color: 0xc9861c, side: THREE.DoubleSide }));
    dBand.frustumCulled = false;
    capRoot.add(dBand);

    // gas: ambient blue, inlet side red with pressure; a strip under the lifted diaphragm
    const GAS_AMB = new THREE.Color(0x8fb8e4), GAS_P = new THREE.Color(0xdc4a2e), GAS_FLOW = new THREE.Color(0xe98a6a);
    const gasMat = {
      inlet: new THREE.MeshBasicMaterial({ color: GAS_AMB.clone() }),
      outlet: new THREE.MeshBasicMaterial({ color: GAS_AMB.clone() }),
      upper: new THREE.MeshBasicMaterial({ color: GAS_AMB.clone(), transparent: true, opacity: 0.5, depthWrite: false }),
    };
    Object.entries(SEC.gas).forEach(([k, geo]) => {
      const m = new THREE.Mesh(new THREE.ShapeGeometry(shapesFrom(geo)), gasMat[k]);
      m.position.z = k === 'upper' ? 0.01 : 0.012;
      capRoot.add(m);
    });
    const gapGeo = new THREE.BufferGeometry();
    const gapPos = new Float32Array((DN + 1) * 2 * 3);
    gapGeo.setAttribute('position', new THREE.BufferAttribute(gapPos, 3));
    gapGeo.setIndex(dIdx);
    const gap = new THREE.Mesh(gapGeo, gasMat.inlet);
    gap.frustumCulled = false;
    capRoot.add(gap);
    function setBand(d) {
      for (let i = 0; i <= DN; i++) {
        const x = dx0 + (dx1 - dx0) * i / DN, y = d * phi(Math.abs(x));
        dBandPos.set([x, y + 0.15, 0.045, x, y - 0.15, 0.045], 6 * i);
        const inside = Math.abs(x) < R_CLAMP;
        gapPos.set([x, inside ? y : 0, 0.014, x, 0, 0.014], 6 * i);
      }
      dBandGeo.attributes.position.needsUpdate = true;
      gapGeo.attributes.position.needsUpdate = true;
    }

    /* ---------- pressure arrows on the plunger and diaphragm ---------- */
    const arrowMat = new THREE.MeshBasicMaterial({ color: 0x7d1f10, transparent: true });
    const arrowGeo = (() => {
      const s = new THREE.Shape();
      s.moveTo(-0.12, 0); s.lineTo(0.12, 0); s.lineTo(0.12, 0.62); s.lineTo(0.34, 0.62); s.lineTo(0, 1); s.lineTo(-0.34, 0.62); s.lineTo(-0.12, 0.62);
      s.closePath();
      return new THREE.ShapeGeometry(s);
    })();
    const ARROWS = [-9, -7, -5, -3.1, 3.1, 5, 7, 9].map(x => [x, -2.99]).concat([[-15.3, -0.05], [15.3, -0.05]]);
    const arrows = ARROWS.map(() => { const m = new THREE.Mesh(arrowGeo, arrowMat); capRoot.add(m); return m; });
    // spring force arrow, inside the coils
    const fsMat = new THREE.MeshBasicMaterial({ color: 0x2b2e34, transparent: true });
    const fsArrow = new THREE.Mesh(arrowGeo, fsMat);
    fsArrow.rotation.z = Math.PI;
    capRoot.add(fsArrow);

    /* ---------- gas particles (stateless, so scrubbing works) ---------- */
    const bore = SEC.inlet_bore;                                    // from the barb tip into the chamber
    const P_IN = [[bore[0][0] + 0.9, bore[0][1] - 1.5, 0]].concat(bore.filter((_, i) => i % 4 === 0).map(p => [p[0], p[1], 0]));
    const SEAT = [[2.5, -3.62, 0.5], [1.75, -4.3, 0.6], [1.3, -4.95, 0.75], [0.55, -5.75, 0.3], [0, -6.6, 0], [0, -23.4, 0], [0, -27.5, 0]];
    const mirror = p => p.map(([x, y, w]) => [-x, y, w]);
    const PATHS = {
      ventR: P_IN.concat([[7.5, -3.6, 0.5], [5, -3.62, 0.5]], SEAT),
      ventL: [[-8.8, -3.5, 0.5], [-5, -3.62, 0.5]].concat(mirror(SEAT)),
      fill: [
        P_IN.concat([[7, -3.6, 0.5], [3.4, -3.7, 0.5]]),
        P_IN.concat([[8.8, -3.4, 0.5], [12.5, -2.4, 0.7], [15.2, -0.9, 0.3]]),
        P_IN.concat([[6, -3.6, 0.5], [0, -3.5, 0.5], [-6, -3.6, 0.5]]),
        P_IN.concat([[6, -3.6, 0.5], [-1, -3.5, 0.5], [-9, -3.4, 0.5], [-13.5, -2.0, 0.7], [-15.4, -0.9, 0.3]]),
      ],
    };
    // each path: cumulative lengths; points carry a weight w so they follow the lift of the plunger
    const prep = pts => {
      const L = [0];
      for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
      return { pts, L, len: L[L.length - 1] };
    };
    const ventR = prep(PATHS.ventR), ventL = prep(PATHS.ventL), fills = PATHS.fill.map(prep);
    const along = (P, s, d, out) => {
      let i = 1;
      while (i < P.L.length - 1 && P.L[i] < s) i++;
      const a = P.pts[i - 1], b = P.pts[i], u = clamp01((s - P.L[i - 1]) / Math.max(1e-6, P.L[i] - P.L[i - 1]));
      out[0] = a[0] + (b[0] - a[0]) * u;
      out[1] = a[1] + (b[1] - a[1]) * u + d * (a[2] + (b[2] - a[2]) * u);
    };
    const NP = 150;
    const pPos = new Float32Array(NP * 3), pAlpha = new Float32Array(NP);
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    pGeo.setAttribute('alpha', new THREE.BufferAttribute(pAlpha, 1));
    const pMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { size: { value: 1 }, color: { value: new THREE.Color(0xffffff) } },
      vertexShader: 'attribute float alpha; varying float vA; uniform float size; void main(){ vA = alpha; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying float vA; uniform vec3 color; void main(){ vec2 c = gl_PointCoord - 0.5; float r = length(c); if (r > 0.5) discard; gl_FragColor = vec4(color, vA * smoothstep(0.5, 0.25, r)); }',
    });
    const particles = new THREE.Points(pGeo, pMat);
    particles.frustumCulled = false;
    particles.position.z = 0.08;
    capRoot.add(particles);
    const rnd = i => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
    const tmp = [0, 0];
    function setParticles(t, d) {
      const fillA = at('pressure', 0.3), fillB = at('pressure', 6.4), ventA = at('crack', 0.35), ventB = at('reseal', 0.6);
      for (let i = 0; i < NP; i++) {
        let a = 0;
        if (i < 60) {                                                // filling: in through the barb, spreading into the chamber
          const P = fills[i % fills.length], v = 11 + 5 * rnd(i), period = P.len / v;
          const s = (((t - fillA) / period + i / 60) % 1 + 1) % 1 * P.len, te = t - s / v;
          if (te >= fillA && te <= fillB) {
            along(P, s, d, tmp);
            a = Math.min(1, s / 1.5) * (1 - clamp01((s - (P.len - 2)) / 2)) * (1 - 0.6 * win(te, fillA + 4, fillB));
          }
        } else {                                                     // venting: through the seat to the outlet
          const j = i - 60, P = j % 3 === 2 ? ventL : ventR, v = 16 + 6 * rnd(i + 9), period = P.len / v;
          const s = (((t - ventA) / period + j / 90) % 1 + 1) % 1 * P.len, te = t - s / v;
          if (te >= ventA && te <= ventB && s <= P.len) {
            along(P, s, d, tmp);
            a = Math.min(1, s / 1.5) * (1 - clamp01((s - (P.len - 3)) / 3));
          }
        }
        pPos[3 * i] = tmp[0]; pPos[3 * i + 1] = tmp[1]; pPos[3 * i + 2] = 0;
        pAlpha[i] = a * 0.95;
      }
      pGeo.attributes.position.needsUpdate = true;
      pGeo.attributes.alpha.needsUpdate = true;
    }

    /* ---------- labels ---------- */
    const labelsEl = document.getElementById('labels');
    const tv = new THREE.Vector3();
    const LABELS = [
      ['Lower housing', [22, -6, 20], [[0.4, 1.6]]],
      ['PTFE seat and steel ball', [0, -4, 6], [[1.4, 2.45]]],
      ['Kapton diaphragm', [20, 0, 14], [[2.4, 3.45]]],
      ['Spring', [0, 30, 6], [[3.3, 4.25]]],
      ['Upper housing', [7, 40, 4], [[4.2, 5.4]]],
      ['Preload screw', [0, 66, 0], [[5.3, 6.9]]],
      ['Preload screw · M6', [0, 63, 0], [[at('parts', 0.3), at('parts', 2.9)]]],
      ['Jam nut', [4.9, 40.6, 0], [[at('parts', 0.6), at('parts', 2.9)]]],
      ['Spring · k = 0.27 N/mm', [-SPR.R, 20, 0], [[at('parts', 0.9), at('parts', 2.9)]]],
      ['Spring seat', [-6.2, 1.3, 0], [[at('parts', 1.2), at('parts', 2.9)]]],
      ['Ambient', [3, 12, 0], [[at('parts', 1.5), at('parts', 2.9)]]],
      ['Kapton diaphragm · 55 µm', [-18.6, 0.1, 0], [[at('parts', 3.5), at('parts', 4.75)]]],
      ['Plunger', [-7, -1.7, 0], [[at('parts', 3.6), at('parts', 4.75)]]],
      ['Steel ball Ø3.175', [0, -2.6, 0], [[at('parts', 3.7), at('parts', 4.75)]]],
      ['PTFE seat', [4, -6.4, 0], [[at('parts', 3.8), at('parts', 4.75)]]],
      ['Seat O-ring', [-3.5, -8.3, 0], [[at('parts', 4.7), at('parts', 5.95)]]],
      ['Clamp O-ring', [-21, 0.2, 0], [[at('parts', 4.7), at('parts', 5.95)]]],
      ['Inlet · from the balloon', [16.6, -14.5, 0], [[at('parts', 4.8), at('parts', 5.95)], [at('pressure', 0.6), at('pressure', 3.4)]]],
      ['Outlet · to ambient', [0, -23.6, 0], [[at('parts', 4.9), at('parts', 5.95)]]],
      ['Pressure acts on diaphragm and plunger', [-7, -3.4, 0], [[at('pressure', 3.6), at('pressure', 6.9)]]],
      ['Ball lifts off the seat', [-1.2, -4.6, 0], [[at('crack', 0.8), at('crack', 3.6)]]],
      ['Gas vents to the outlet', [0, -16, 0], [[at('crack', 3.4), at('crack', 6.9)]]],
      ['Sealed again', [-1.1, -5.2, 0], [[at('reseal', 1.1), at('reseal', 3.9)]]],
      ['Preload screw turned in 3 mm', [0, 63, 0], [[at('setting', 0.5), at('setting', 5.9)]]],
      ['Spring compressed further', [-SPR.R, 22, 0], [[at('setting', 2.0), TOTAL + 1]]],
    ].map(([text, p, wins]) => {
      const el = document.createElement('div');
      el.className = 'lbl';
      el.appendChild(document.createElement('span')).textContent = text;
      labelsEl.appendChild(el);
      return { el, p, wins, op: -1 };
    });
    function updateLabels(t) {
      const w = viewer.clientWidth, h = viewer.clientHeight;
      for (const L of LABELS) {
        let a = 0;
        for (const [s, e] of L.wins) a = Math.max(a, win(t, s, s + 0.3) * (1 - win(t, e - 0.3, e)));
        if (a > 0.01) {
          tv.set(L.p[0], L.p[1], L.p[2]).project(camera);
          const x = (tv.x * 0.5 + 0.5) * w, y = (-tv.y * 0.5 + 0.5) * h;
          if (tv.z > 1 || x < -40 || x > w + 40 || y < 40 || y > h + 10) a = 0;
          else L.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        }
        const op = Math.round(a * 100) / 100;
        if (op !== L.op) { L.el.style.opacity = op; L.op = op; }
      }
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
    const stateEl = $('state'), stateTxt = $('stateTxt'), forces = $('forces');
    const valX = $('valX'), barP = $('barP'), markP = $('markP'), barFp = $('barFp'), barFs = $('barFs'), valP = $('valP'), valFp = $('valFp'), valFs = $('valFs');
    const btnPlay = $('btnPlay'), scrub = $('scrub'), timeEl = $('time'), btnSpeed = $('btnSpeed'), btnReset = $('btnReset');
    const ICON = {
      play: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
      pause: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>',
      replay: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7l1.6.6A3.8 3.8 0 1 0 8 4.2V6L4.8 3.4 8 .8z" fill="currentColor"/></svg>',
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
      hudWhere.innerHTML = li.dataset.where;
      stepEls.forEach((el, k) => el.classList.toggle('is-active', k === i));
    }

    /* ---------- per frame ---------- */
    const DP_MAX = 4.5, F_MAX = 2.6;
    const poster = root.classList.contains('is-poster');
    let lastOpen = null, lastForces = null;
    const SEAT_Y = { spring_seat: 1, plunger: 1, ball: 1 };
    const BOLT = { m6_bolt: 1, m6_nut_low: 1 };
    function update(t) {
      const d = T.lift.at(t), b = T.screw.at(t), dp = T.dp.at(t);
      const slide = T.slide.at(t);

      // parts
      Object.entries(parts).forEach(([name, pair]) => {
        const y = assyOffset(name, t) + (SEAT_Y[name] ? d : 0) - (BOLT[name] ? b : 0);
        const shown = assyShown(name, t);
        ['back', 'front'].forEach(side => {
          const g = pair[side];
          g.position.y = y;
          g.visible = shown && (side === 'back' || slide < 69);
        });
        if (name === 'm6_bolt') {
          const spin = -8 * Math.PI * (1 - ease.out(win(t, ASSY.m6_bolt[1], ASSY.m6_bolt[1] + ASSY_DUR))) - (b / 1) * 2 * Math.PI;
          pair.back.rotation.y = pair.front.rotation.y = spin;
        }
        const cap = caps[name];
        if (cap) cap.position.y = (SEAT_Y[name] ? d : 0) - (BOLT[name] ? b : 0);
      });
      setDiaphragm(d);
      const sOff = assyOffset('spring', t);
      setSpring(2.52 + d, 38.23 - b);
      springGB.position.y = springGF.position.y = sOff;
      springGB.visible = springGF.visible = assyShown('spring', t);
      springGF.visible = springGF.visible && slide < 69;

      // the cut: the front half slides towards the viewer and fades
      frontRoot.position.z = slide;
      planeFront.constant = -(slide - 0.001);
      const fo = 1 - win(t, at('cut', 1.2), at('cut', 3.0));
      frontMats.forEach(m => { m.opacity = m.userData.baseOpacity * fo; m.depthWrite = fo > 0.98; });
      capRoot.visible = t >= at('cut', 0.25);

      // section: band, gas colours, arrows, particles
      setBand(d);
      const pr = clamp01(dp / PC0);
      gasMat.inlet.color.copy(GAS_AMB).lerp(GAS_P, ease.out(pr));
      const venting = t >= at('crack', 0.35) && t < at('reseal', 0.8);
      gasMat.outlet.color.copy(GAS_AMB).lerp(GAS_FLOW, venting ? 0.55 * win(t, at('crack', 0.4), at('crack', 1.4)) * (1 - win(t, at('reseal', 0.2), at('reseal', 1.2))) : 0);
      const ao = win(t, at('pressure', 1.5), at('pressure', 2.5)) * (1 - win(t, at('setting', 0), at('setting', 0.8)));
      arrowMat.opacity = ao;
      ARROWS.forEach(([x, y], i) => {
        const m = arrows[i], len = 0.6 + 1.0 * pr;
        m.visible = ao > 0.01;
        m.scale.set(len * 0.9, len, 1);
        m.position.set(x, y + d * phi(Math.abs(x)) - len - 0.05, 0.07);
      });
      const fsLen = 3 + 3 * (K * (X0 + b)) / F_MAX * 2;
      fsMat.opacity = win(t, at('parts', 0.9), at('parts', 1.8));
      fsArrow.visible = fsMat.opacity > 0.01;
      fsArrow.scale.set(2.2, fsLen, 1);
      fsArrow.position.set(0, 3.2 + d + fsLen, 0.07);
      setParticles(t, d);

      // HUD: valve state and the force balance
      const open = venting;
      if (open !== lastOpen) { lastOpen = open; stateEl.classList.toggle('is-open', open); stateTxt.textContent = open ? 'venting' : 'sealed'; }
      const showF = t >= at('pressure', 0.2);
      if (showF !== lastForces) { lastForces = showF; forces.classList.toggle('is-shown', showF); }
      const fs = K * (X0 + b), pc = fs / (A_EFF * 1e-3), fp = kPa2N(dp);
      barP.style.width = (100 * Math.min(1, dp / DP_MAX)).toFixed(1) + '%';
      markP.style.left = (100 * Math.min(1, pc / DP_MAX)).toFixed(1) + '%';
      barFp.style.width = (100 * Math.min(1, fp / F_MAX)).toFixed(1) + '%';
      barFs.style.width = (100 * Math.min(1, fs / F_MAX)).toFixed(1) + '%';
      valP.textContent = dp.toFixed(2) + ' kPa';
      valFp.textContent = fp.toFixed(2) + ' N';
      valFs.textContent = fs.toFixed(2) + ' N';
      valX.textContent = (X0 + b).toFixed(1);
      markP.title = 'P_c ' + pc.toFixed(2) + ' kPa';
      markP.dataset.pc = 'Pc ' + pc.toFixed(1);

      const pi = phaseAt(t);
      if (pi !== curPhase) setPhase(pi);
      const tgt = T.camTgt.at(t), pos = T.camPos.at(t);
      if (poster) { pos[0] -= tgt[0]; tgt[0] = 0; }               // no force panel in the preview, so centre the valve
      applyCamera(pos, tgt);
      sun.target.position.set(tgt[0], tgt[1], 0);
      sun.target.updateMatrixWorld();
    }

    /* ---------- playback (same controls as the AMS-02 animation) ---------- */
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let t = 0, playing = false, speed = 1, scrubbing = false, dirty = true, loaded = false, last = performance.now();
    function setPlaying(p) {
      playing = p;
      const ended = !p && t >= TOTAL - 1e-3;
      btnPlay.innerHTML = p ? ICON.pause : ended ? ICON.replay : ICON.play;
      btnPlay.setAttribute('aria-label', p ? 'Pause' : ended ? 'Replay' : 'Play');
    }
    function seek(nt) { t = Math.min(TOTAL, Math.max(0, nt)); dirty = true; if (!playing) setPlaying(false); }
    function jumpTo(i, play) { seek(PHASES[Math.max(0, Math.min(PHASES.length - 1, i))].start); if (play) setPlaying(true); }
    btnPlay.addEventListener('click', () => {
      if (playing) setPlaying(false);
      else { if (t >= TOTAL - 1e-3) t = 0; setPlaying(true); }
    });
    $('btnPrev').addEventListener('click', () => { const i = phaseAt(t); jumpTo(t - PHASES[i].start > 0.6 ? i : i - 1, playing); });
    $('btnNext').addEventListener('click', () => { if (phaseAt(t) < PHASES.length - 1) jumpTo(phaseAt(t) + 1, playing); });
    btnSpeed.addEventListener('click', () => {
      speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
      btnSpeed.textContent = (speed === 0.5 ? '½' : speed) + '×';
    });
    stepEls.forEach((li, i) => li.querySelector('button').addEventListener('click', () => jumpTo(i, true)));
    scrub.addEventListener('pointerdown', () => { scrubbing = true; });
    window.addEventListener('pointerup', () => { scrubbing = false; });
    scrub.addEventListener('input', () => { t = +scrub.value; dirty = true; if (!playing) setPlaying(false); });
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
      pMat.uniforms.size.value = 0.55 * h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * renderer.getPixelRatio();
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
        if (t >= TOTAL) { t = TOTAL; setPlaying(false); }
        dirty = true;
      }
      if (dirty) {
        dirty = false;
        update(t);
        renderer.render(scene, camera);
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
    if (!deep && !reduceMotion && window.IntersectionObserver) {
      const io = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) { io.disconnect(); setPlaying(true); }
      }, { threshold: 0.35 });
      io.observe(viewer);
    }
    if (root.classList.contains('is-poster')) window.__render = nt => { t = nt; dirty = false; update(t); renderer.render(scene, camera); };
    requestAnimationFrame(frame);
  }
})();
