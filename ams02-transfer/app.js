/* AMS-02 Layer 0 integration: the QLCS is located on Station 2, then one ladder travels from
   Station 1 to Station 2 on the vacuum positioning jig.
   three.js r149 (classic build), no build step. World units are millimetres, y is up.
   Every frame is computed from the timeline time t, so playing, scrubbing and stepping
   all go through the same update(t). */
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
  // ?poster shows the bare 3D view filling the window, for rendering preview stills
  if (/[?&]poster\b/.test(location.search)) root.classList.add('is-poster');

  /* ---------- dimensions (mm) ---------- */
  const SENSOR_L = 80, SENSOR_W = 113, N_SENSORS = 12, HYBRID_L = 95;
  const LADDER_L = N_SENSORS * SENSOR_L + HYBRID_L;            // L12 ladder
  // Thin layers are drawn thicker than they are so they stay visible (real values in the comments).
  const LADDER_T = 1.6;    // 0.52
  const GLUE_T = 0.8;      // 0.10
  const QLCS_T = 7;        // 5.6
  const BUTTON_H = 2.5;    // 0.5, the button base standing proud of the plate
  const FOOT = BUTTON_H + QLCS_T + GLUE_T + LADDER_T;           // jig foot below the pad face
  const PAD_T = 1.5, JIG_H = 46, JIG_W = 124, JIG_L = LADDER_L + 50, END_L = 40;
  const PIN_X = JIG_L / 2 + END_L / 2, PIN_LEN = 14, PIN_R = 4;
  const PITCH = SENSOR_W + 0.2;                                 // 200 µm between neighbouring ladders
  // the jig goes in electronics end first: tilted so the +x (hybrid) pin seats before the far one
  const TILT = 0.045, TILT_DY = PIN_X * Math.sin(TILT);

  const S1 = { x: -900, L: 1200, W: 560, T: 30 };
  const S1_TOP = S1.T;
  const BED_H = FOOT - LADDER_T;          // the bed lifts the ladder so the jig feet seat on the plate
  const BED_TOP = S1_TOP + BED_H;
  const CONT_Z = 175, GLUE_Z = -180;
  const S2 = { x: 650, L: 1200, W: 1100, T: 20 };
  const S2_TOP = S2.T;
  const Q_BASE = S2_TOP + BUTTON_H;                              // QLCS underside, resting on the button bases
  const Q_OFF = 3 / Math.SQRT2;                                 // the 3 mm slide at 45°, per axis
  const BOND_Y = Q_BASE + QLCS_T + GLUE_T;                      // ladder underside at Station 2
  const rowZ = r => (r - 5) * PITCH;                            // rows 1-9; row 5 on the centre line
  const ladderLen = n => n * SENSOR_L + HYBRID_L;
  const rowN = r => (r <= 5 ? 12 : r <= 7 ? 10 : 8);             // 5 x L12, 2 x L10, 2 x L8 per QLCS
  const rowCX = r => -LADDER_L / 2 + ladderLen(rowN(r)) / 2;     // rows line up at their far end

  // Station 3 and Layer 0 (part C)
  const S3 = { x: 3800, top: 220 };                              // L0 centre and the height of its top skin
  const L0_APO = 1330, L0_T = 50;                                // octagon apothem and plane thickness (drawn)
  const L0_R = L0_APO / Math.cos(Math.PI / 8);
  const QUAD_YAW = Math.PI / 4;                                  // our QLCS-L takes the right-hand quadrant of the zenith plane
  const CORNER_X = -LADDER_L / 2 - 6, CORNER_Z = -535;           // QLCS inner corner, which sits on the L0 centre
  const AMS = { x: 9800, l0: 3150 };                             // AMS-02 model and the height of L0's top skin on it

  // QLCS-L locating features along its front edge (x relative to S2.x, final position)
  const EDGE_Z = 522;
  const PREC_X = -511, GUIDE_A_X = -455, GUIDE_B_X = 60, HSLOT_X = 117;
  const INSERT_A_X = -480, INSERT_B_X = 88, INSERT_L = 104, INSERT_W = 22;
  const BUTTONS = [[-482, -445], [-26, -445], [430, -445], [-482, 1], [-26, 1], [430, 1], [-482, 447], [-26, 447], [430, 447],
    [-253, -223], [202, -223], [-253, 223], [202, 223]];

  const J_PARK = [S1.x, FOOT, -480];
  const J_SHOW = [S1.x, FOOT + 300, -480];                      // held up so its pins can be seen
  const J_S1 = [S1.x, BED_TOP + LADDER_T, 0];
  const J_GLUE = [S1.x, S1_TOP + PAD_T + JIG_H, GLUE_Z];
  const J_S2 = [S2.x, BOND_Y + LADDER_T, 0];
  const J_PARK2 = [S2.x, FOOT, -780];
  const L_CONT = [S1.x, BED_TOP, CONT_Z];
  const L_S1 = [S1.x, BED_TOP, 0];
  const GLUE_FACE = J_GLUE[1] + LADDER_T;                       // bonding face while the jig sits inverted

  const C = {
    bg: 0xebe8e1, table: 0xd9d7d1, tableSide: 0xbfbcb4,
    s1: 0xa63b30, s1Side: 0x8a2c23, s1Pocket: 0x8f3027,
    s2: 0x52bab3, s2Side: 0x3f9d97, qlcs: 0x46484e, peek: 0xd2b48c, cap: 0x7a3b36, insert: 0xd6c79a,
    jig: 0x82a8d6, jigEnd: 0x5f80a8, handle: 0xbcbdd5, pad: 0xd47b2d,
    sensor: 0xb6b5df, sensorBack: 0x8f8daa, sensorSide: 0x9d9cbb,
    hybrid: 0x3ba84c, connector: 0x2a2b2f, pin: 0xd9b23b, s1Pin: 0x3954d0, guidePin: 0xcf3b30, fixPin: 0x59606b,
    glue: 0xe4a52c, alu: 0xc9cdd3, lid: 0xdfe5ec, mask: 0xd6d9df, accent: 0xb0601f, edge: 0x1c1d21,
  };
  const css = hex => '#' + hex.toString(16).padStart(6, '0');

  /* ---------- timeline ---------- */
  const PHASES = [
    ['supports', 5], ['lower', 5.5], ['slide', 5], ['qpin', 4.5], ['timelapse', 3.4],
    ['unpack', 6], ['align', 6], ['capture', 10.1], ['invert', 6.5], ['glue', 8],
    ['transfer', 6.5], ['locate', 8], ['cure', 4.5], ['release', 7],
    ['finish', 3.6], ['tjig', 6], ['l0glue', 6.5], ['l0place', 8.5], ['l0cure', 4.5], ['quads', 4.5], ['cupola', 5], ['ams', 10],
  ].map(([id, dur]) => ({ id, dur }));
  const PH = {};
  let acc = 0;
  PHASES.forEach((p, i) => { p.start = acc; p.end = acc + p.dur; p.index = i; PH[p.id] = p; acc = p.end; });
  const TOTAL = acc;
  const at = (id, s) => PH[id].start + s;

  const ease = {
    inOut: u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
    out: u => 1 - Math.pow(1 - u, 3),
    linear: u => u,
  };
  const clamp01 = u => Math.min(1, Math.max(0, u));
  const win = (t, a, b) => clamp01((t - a) / (b - a));
  const lerp = (a, b, u) => (typeof a === 'number' ? a + (b - a) * u : a.map((v, i) => v + (b[i] - v) * u));

  // keys: [time, value, easing of the segment that ends at this key]
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

  const T = {
    qlcs: track([
      [0, [S2.x + Q_OFF, Q_BASE + 420, Q_OFF]],
      [at('lower', 0.3), [S2.x + Q_OFF, Q_BASE + 420, Q_OFF]],
      [at('lower', 3.4), [S2.x + Q_OFF, Q_BASE + 30, Q_OFF]],
      [at('lower', 4.8), [S2.x + Q_OFF, Q_BASE, Q_OFF], 'out'],
      [at('slide', 0.8), [S2.x + Q_OFF, Q_BASE, Q_OFF]],
      [at('slide', 3.8), [S2.x, Q_BASE, 0]],
    ]),
    jigPos: track([
      [0, J_PARK],
      [at('capture', 0.3), J_PARK],
      [at('capture', 1.5), J_SHOW],
      [at('capture', 4.6), J_SHOW],
      [at('capture', 6.1), [S1.x, J_S1[1] + 150, 0]],
      [at('capture', 7.0), [S1.x + 3, J_S1[1] + TILT_DY + 30, 3]],
      [at('capture', 7.7), [S1.x, J_S1[1] + TILT_DY, 0], 'out'],      // electronics-end pin in its hole
      [at('capture', 8.5), J_S1],                                      // far end down into the slot
      [at('invert', 0.4), J_S1],
      [at('invert', 1.6), [S1.x, J_S1[1] + 240, 0]],
      [at('invert', 3.8), [S1.x, S1_TOP + 300, GLUE_Z]],
      [at('invert', 5.4), J_GLUE, 'out'],
      [at('transfer', 0.2), J_GLUE],
      [at('transfer', 1.3), [S1.x, S1_TOP + 320, GLUE_Z]],
      [at('transfer', 5.6), [S2.x, J_S2[1] + 280, 0]],
      [at('locate', 1.6), [S2.x + 3, J_S2[1] + TILT_DY + 50, 3]],
      [at('locate', 2.6), [S2.x + 3, J_S2[1] + TILT_DY + 50, 3]],
      [at('locate', 4.2), [S2.x, J_S2[1] + TILT_DY, 0], 'out'],
      [at('locate', 6.0), J_S2],
      [at('release', 1.0), J_S2],
      [at('release', 2.6), [S2.x, J_S2[1] + 250, 0]],
      [at('release', 4.4), [S2.x, FOOT + 250, -780]],
      [at('release', 5.6), J_PARK2, 'out'],
    ]),
    // the tilt segments share key times and easing with jigPos, so the seated end stays put
    jigTilt: track([
      [0, 0], [at('capture', 4.6), 0], [at('capture', 6.1), -TILT], [at('capture', 7.7), -TILT], [at('capture', 8.5), 0],
      [at('locate', 0.2), 0], [at('locate', 1.6), -TILT], [at('locate', 4.2), -TILT], [at('locate', 6.0), 0],
    ]),
    jigRot: track([
      [0, 0], [at('invert', 1.4), 0], [at('invert', 4.0), Math.PI],
      [at('transfer', 1.2), Math.PI], [at('transfer', 3.2), 2 * Math.PI],
    ]),
    ladder: track([
      [0, L_CONT], [at('align', 0.3), L_CONT],
      [at('align', 1.3), [S1.x, BED_TOP + 34, CONT_Z]],
      [at('align', 2.9), [S1.x + 8, BED_TOP + 34, 8]],
      [at('align', 3.7), [S1.x + 8, BED_TOP, 8], 'out'],
      [at('align', 5.0), L_S1, 'out'],
    ]),
    maskY: track([
      [at('glue', 0), GLUE_FACE + 170], [at('glue', 1.4), GLUE_FACE + 0.45, 'out'],
      [at('glue', 5.6), GLUE_FACE + 0.45], [at('glue', 6.8), GLUE_FACE + 170],
    ]),
    sweep: track([[at('glue', 1.8), 0], [at('glue', 5.2), 1, 'linear']]),
  };

  // camera: [time, position, target]. Part A is framed directly; the part B shots were framed
  // tight and are pulled back from their targets.
  const pullBack = (k, f) => [k[0], k[2].map((g, j) => g + (k[1][j] - g) * f), k[2]];
  const CAM = [
    [0, [-120, 2050, 2500], [-110, 0, 0]],
    [at('supports', 0.6), [-120, 2050, 2500], [-110, 0, 0]],
    [at('supports', 2.6), [1250, 1000, 1700], [650, 0, 150]],
    [at('supports', 5.0), [1100, 760, 1560], [560, 0, 260]],
    [at('lower', 1.0), [1300, 1050, 1800], [650, 60, 100]],
    [at('lower', 5.0), [560, 420, 1150], [300, 10, 480]],
    [at('slide', 1.0), [450, 220, 880], [300, 10, 560]],
    [at('slide', 5.0), [440, 210, 865], [295, 10, 560]],
    [at('qpin', 0.8), [440, 830, 1750], [500, 10, 700]],
    [at('qpin', 4.5), [440, 830, 1750], [500, 10, 700]],
    [at('timelapse', 1.0), [1350, 1100, 1500], [650, 0, -100]],
    [at('timelapse', 3.4), [1300, 1000, 1450], [650, 0, -120]],
  ].concat([
    [at('unpack', 2.2), [-560, 780, 1220], [-900, 30, 110]],
    [at('align', 0.6), [-560, 760, 1150], [-900, 30, 80]],
    [at('align', 3.6), [-1130, 360, 560], [-1350, 40, 0]],
    [at('align', 6), [-1110, 340, 520], [-1360, 40, -10]],
    [at('capture', 1.0), [-380, 940, 1300], [-900, 60, -140]],
    [at('capture', 6.0), [-380, 940, 1300], [-900, 60, -140]],
    [at('capture', 8.3), [-420, 640, 960], [-900, 50, -20]],
    [at('capture', 10.1), [-430, 620, 930], [-900, 50, -20]],
    [at('invert', 1.0), [-420, 820, 1100], [-900, 120, -90]],
    [at('invert', 6.5), [-480, 720, 820], [-900, 80, -170]],
    [at('glue', 1.2), [-560, 560, 420], [-860, 70, -180]],
    [at('glue', 7.2), [-1180, 520, 380], [-920, 70, -180]],
    [at('glue', 8), [-1180, 520, 380], [-920, 70, -180]],
    [at('transfer', 1.4), [-500, 1250, 1650], [-640, 160, -80]],
    [at('transfer', 6.0), [1050, 1050, 1600], [640, 120, 0]],
    [at('locate', 1.6), [1520, 330, 560], [1180, 40, 0]],
    [at('locate', 6.4), [1500, 250, 400], [1225, 30, 0]],
    [at('locate', 8), [1340, 620, 1020], [720, 20, 0]],
    [at('cure', 4.5), [180, 760, 1260], [640, 20, -40]],
    [at('release', 3.0), [760, 1050, 1450], [650, 60, -120]],
    [at('release', 6.2), [1230, 330, 360], [1020, 20, -55]],
    [at('release', 7), [1230, 330, 360], [1020, 20, -55]],
  ].map(k => pullBack(k, 1.6)), [
    // close on the held-up jig, from low in front, so both ends and their pins are in view
    [at('capture', 2.0), [-760, 175, 1070], [-900, 300, -480]],
    [at('capture', 4.4), [-820, 185, 1040], [-900, 300, -480]],
  ]);

  /* ---------- renderer, scene, lights ---------- */
  THREE.ColorManagement.legacyMode = false;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.bg);
  scene.fog = new THREE.Fog(C.bg, 4200, 9000);
  const camera = new THREE.PerspectiveCamera(32, 1.6, 10, 20000);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xb9b3a8, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 0.95);
  sun.position.set(-1200, 2600, 1500);
  sun.target.position.set(-100, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -2000, right: 2000, top: 1500, bottom: -1500, near: 500, far: 6500 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 1.5;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0xfff4e6, 0.25);
  fill.position.set(2000, 900, -1200);
  scene.add(fill);

  /* ---------- helpers ---------- */
  const std = (color, o) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.62, metalness: 0.06 }, o));
  const EDGE = new THREE.LineBasicMaterial({ color: C.edge, transparent: true, opacity: 0.3 });
  const edgeCache = new Map();
  function mesh(geo, m, x = 0, y = 0, z = 0, { cast = true, receive = true, edges = EDGE } = {}) {
    const o = new THREE.Mesh(geo, m);
    o.position.set(x, y, z);
    o.castShadow = cast;
    o.receiveShadow = receive;
    if (edges) {
      if (!edgeCache.has(geo)) edgeCache.set(geo, new THREE.EdgesGeometry(geo, 20));
      o.add(new THREE.LineSegments(edgeCache.get(geo), edges));
    }
    return o;
  }
  const boxG = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  // cylindrical pin chamfered at both ends, centred on its axis
  const chamferPin = (r, h, c) => new THREE.LatheGeometry(
    [[0, -h / 2], [r - c, -h / 2], [r, -h / 2 + c], [r, h / 2 - c], [r - c, h / 2], [0, h / 2]].map(([x, y]) => new THREE.Vector2(x, y)), 24);
  const faces = (side, top, bottom = side) => [side, side, top, bottom, side, side];
  function texture(w, h, draw) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const tx = new THREE.CanvasTexture(c);
    tx.encoding = THREE.sRGBEncoding;
    tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
    return tx;
  }
  function rrect(g, x, y, w, h, r) {
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  function hole(g, x, y, rx, ry, fill) {
    g.fillStyle = fill;
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
  }
  function slot(g, x1, y1, x2, y2, r, stroke) {
    g.strokeStyle = stroke; g.lineWidth = 2 * r; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
  }

  /* ---------- table ---------- */
  const tableTex = texture(256, 256, (g, w, h) => {
    g.fillStyle = css(C.table); g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) hole(g, 32 + i * 64, 32 + j * 64, 8, 8, 'rgba(120,114,104,.45)');
  });
  tableTex.wrapS = tableTex.wrapT = THREE.RepeatWrapping;
  tableTex.repeat.set(44, 26);                                 // 25 mm hole pitch
  scene.add(mesh(boxG(4400, 80, 2600), faces(std(C.tableSide), std(0xffffff, { map: tableTex, roughness: 0.85 })),
    -150, -40, 0, { cast: false, edges: false }));

  /* ---------- Station 1: zone 1 container pocket, zone 2 alignment bed, zone 3 glue bay ---------- */
  const s1Side = std(C.s1Side, { roughness: 0.55 });
  const s1Mat = std(C.s1, { roughness: 0.55 });
  const s1Tex = texture(1200, 560, (g, w, h) => {
    g.fillStyle = css(C.s1); g.fillRect(0, 0, w, h);
    g.fillStyle = css(C.s1Pocket); rrect(g, 24, CONT_Z + 280 - 84, 1152, 168, 6); g.fill();
    g.strokeStyle = 'rgba(40,8,6,.35)'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(40,8,6,.25)'; rrect(g, 30, GLUE_Z + 280 - 75, 1140, 150, 6); g.stroke();
    hole(g, 600 + PIN_X, 280, 6.5, 6.5, '#3b100c');           // jig hole, electronics end
    hole(g, 600 - PIN_X, 280, 11, 6.5, '#3b100c');            // jig slot, far end
    for (const [x, y] of [[14, 14], [1186, 14], [14, 546], [1186, 546]]) hole(g, x, y, 4, 4, '#4a140f');
  });
  scene.add(mesh(boxG(S1.L, S1.T, S1.W), faces(s1Side, std(0xffffff, { map: s1Tex, roughness: 0.55 })), S1.x, S1.T / 2, 0));
  const bedTex = texture(1090, 140, (g, w, h) => {
    g.fillStyle = css(C.s1); g.fillRect(0, 0, w, h);
    for (let x = 12; x < w - 8; x += 12) for (let y = 12; y < h - 8; y += 12) hole(g, x, y, 1.4, 1.4, 'rgba(50,10,8,.45)');
  });
  scene.add(mesh(boxG(1090, BED_H, 140), faces(s1Side, std(0xffffff, { map: bedTex, roughness: 0.5 })), S1.x, S1_TOP + BED_H / 2, 0));

  // precision pins: two on the long edge, one on the far end
  const s1PinMat = std(C.s1Pin, { metalness: 0.3, roughness: 0.35, emissive: new THREE.Color(C.s1Pin), emissiveIntensity: 0 });
  const pinGeo = chamferPin(4, 14, 0.9);                        // 4 mm in the bed, 10 mm standing
  const S1_PINS = [[-LADDER_L / 2 + 40, -SENSOR_W / 2 - 4], [LADDER_L / 2 - HYBRID_L - 12, -SENSOR_W / 2 - 4], [-LADDER_L / 2 - 4, 0]];
  S1_PINS.forEach(([x, z]) => scene.add(mesh(pinGeo, s1PinMat, S1.x + x, BED_TOP + 3, z)));

  // glue bay guide posts
  const postGeo = boxG(34, 46, 30);
  for (const x of [-160, 250]) for (const dz of [-85, 85]) scene.add(mesh(postGeo, s1Mat, S1.x + x, S1_TOP + 23, GLUE_Z + dz));

  // transport container with its cover and fixing brackets
  const aluMat = std(C.alu, { metalness: 0.35, roughness: 0.4 });
  scene.add(mesh(boxG(1110, BED_H, 150), aluMat, S1.x, S1_TOP + BED_H / 2, CONT_Z));
  for (const s of [-1, 1]) {
    scene.add(mesh(boxG(1110, 14, 5), aluMat, S1.x, BED_TOP + 7, CONT_Z + s * 72.5));
    scene.add(mesh(boxG(5, 14, 140), aluMat, S1.x + s * 552.5, BED_TOP + 7, CONT_Z));
  }
  const lidMat = std(C.lid, { transparent: true, opacity: 0.5, roughness: 0.2, metalness: 0, depthWrite: false });
  const lidEdge = EDGE.clone();
  const lid = mesh(boxG(1124, 3, 160), lidMat, S1.x, BED_TOP + 15.5, CONT_Z, { cast: false, edges: lidEdge });
  const LID0 = lid.position.clone();
  scene.add(lid);
  const brackets = [];
  const bracketGeo = boxG(8, 4, 140);
  for (let i = 0; i <= N_SENSORS; i++) {
    const m = std(0xa7abb3, { metalness: 0.4, roughness: 0.4, transparent: true });
    const e = EDGE.clone();
    const b = mesh(bracketGeo, m, S1.x - LADDER_L / 2 + i * SENSOR_L, BED_TOP + LADDER_T + 2, CONT_Z, { edges: e });
    b.userData = { m, e, y0: b.position.y };
    scene.add(b);
    brackets.push(b);
  }

  /* ---------- Station 2: plate, support buttons, QLCS pins ---------- */
  const s2Tex = texture(1200, 1100, (g, w, h) => {
    g.fillStyle = css(C.s2); g.fillRect(0, 0, w, h);
    for (let r = 1; r <= 9; r++) {                             // jig hole (electronics end) and slot, per row
      const n = r <= 5 ? 12 : r <= 7 ? 10 : 8, len = n * SENSOR_L + HYBRID_L;
      const cx = -LADDER_L / 2 + len / 2, px = (len + 50) / 2 + END_L / 2, y = rowZ(r) + 550;
      hole(g, 600 + cx - px, y, 11, 6.5, '#256b66');
      hole(g, 600 + cx + px, y, 6.5, 6.5, '#256b66');
    }
    for (const [x, z] of BUTTONS) {                            // button pockets
      g.strokeStyle = '#2f7f7a'; g.lineWidth = 2;
      g.beginPath(); g.arc(600 + x, 550 + z, 9, 0, Math.PI * 2); g.stroke();
    }
    for (const x of [PREC_X, GUIDE_A_X, GUIDE_B_X, HSLOT_X]) {  // QLCS-L (front) and QLCS-R (back) locating holes
      hole(g, 600 + x, 550 + EDGE_Z, 3.5, 3.5, '#256b66');
      hole(g, 600 + x, 550 - EDGE_Z, 3.5, 3.5, '#256b66');
    }
  });
  scene.add(mesh(boxG(S2.L, S2.T, S2.W), faces(std(C.s2Side, { roughness: 0.5 }), std(0xffffff, { map: s2Tex, roughness: 0.5 })), S2.x, S2.T / 2, 0));

  // support buttons: PEEK base glued in its pocket (0.5 mm proud) and the flexible cap on top
  const baseMat = std(C.peek, { roughness: 0.5, emissive: new THREE.Color(C.peek), emissiveIntensity: 0 });
  const capMat = std(C.cap, { roughness: 0.45, emissive: new THREE.Color(C.cap), emissiveIntensity: 0 });
  const baseGeo = new THREE.CylinderGeometry(7.5, 7.5, BUTTON_H, 28), capGeo = new THREE.CylinderGeometry(5.8, 4.6, 3, 24);
  BUTTONS.forEach(([x, z]) => {
    scene.add(mesh(baseGeo, baseMat, S2.x + x, S2_TOP + BUTTON_H / 2, z, { edges: false }));
    scene.add(mesh(capGeo, capMat, S2.x + x, Q_BASE + 1.5, z, { edges: false }));
  });

  // QLCS locating pins: two guide pins already in the station, two fixing pins added after the slide
  const qPinGeo = chamferPin(3, 18, 0.7);                        // 5 mm in the plate, 13 mm standing
  function qlcsPin(color, x) {
    const m = std(color, { metalness: 0.45, roughness: 0.35, transparent: true });
    const g = new THREE.Group();
    g.add(mesh(qPinGeo, m, 0, 4, 0, { edges: false }));
    g.position.set(S2.x + x, S2_TOP, EDGE_Z);
    g.userData = { m, x };
    scene.add(g);
    return g;
  }
  const guidePins = [qlcsPin(C.guidePin, GUIDE_A_X), qlcsPin(C.guidePin, GUIDE_B_X)];
  const fixPins = [qlcsPin(C.fixPin, PREC_X), qlcsPin(C.fixPin, HSLOT_X)];

  /* ---------- QLCS (QLCS-L): sandwich panel with two PEEK edge inserts ---------- */
  const qShape = new THREE.Shape();
  {
    const far = -LADDER_L / 2 - 6;
    const x12 = LADDER_L / 2 + 6, x10 = -LADDER_L / 2 + 10 * SENSOR_L + HYBRID_L + 6, x8 = -LADDER_L / 2 + 8 * SENSOR_L + HYBRID_L + 6;
    const zTop = -535, z5 = rowZ(5) + PITCH / 2, z7 = rowZ(7) + PITCH / 2, zBot = 535;
    // shape y = -world z (the geometry is rotated flat below)
    [[far, zTop], [x12, zTop], [x12, z5], [x10, z5], [x10, z7], [x8, z7], [x8, zBot], [far, zBot]]
      .forEach(([x, z], i) => (i ? qShape.lineTo(x, -z) : qShape.moveTo(x, -z)));
    qShape.closePath();
  }
  const qGeo = new THREE.ExtrudeGeometry(qShape, { depth: QLCS_T, bevelEnabled: false });
  qGeo.rotateX(-Math.PI / 2);
  const qMat = std(C.qlcs, { roughness: 0.8, transparent: true });
  const qEdge = EDGE.clone();
  const qlcs = new THREE.Group();
  qlcs.add(mesh(qGeo, qMat, 0, 0, 0, { edges: qEdge }));
  // insert tops: precision hole + diagonal slot (A), diagonal slot + horizontal slot (B), in 4 px/mm canvases
  const insertTex = (cx, draw) => texture(INSERT_L * 4, INSERT_W * 4, (g, w, h) => {
    g.fillStyle = css(C.insert); g.fillRect(0, 0, w, h);
    const P = (x, z) => [(x - cx + INSERT_L / 2) * 4, (z + INSERT_W / 2) * 4];
    draw(g, P);
  });
  const ink = '#2b2c30';
  const texA = insertTex(INSERT_A_X, (g, P) => {
    hole(g, ...P(PREC_X, 0), 13, 13, ink);
    slot(g, ...P(GUIDE_A_X - Q_OFF, -Q_OFF), ...P(GUIDE_A_X, 0), 13, ink);
  });
  const texB = insertTex(INSERT_B_X, (g, P) => {
    slot(g, ...P(GUIDE_B_X - Q_OFF, -Q_OFF), ...P(GUIDE_B_X, 0), 13, ink);
    slot(g, ...P(HSLOT_X - 2.5, 0), ...P(HSLOT_X + 2.5, 0), 13, ink);
  });
  const insertSide = std(C.insert, { roughness: 0.5 });
  const insertGeo = boxG(INSERT_L, QLCS_T + 0.3, INSERT_W);
  qlcs.add(mesh(insertGeo, faces(insertSide, std(0xffffff, { map: texA, roughness: 0.5 })), INSERT_A_X, (QLCS_T + 0.3) / 2, EDGE_Z));
  qlcs.add(mesh(insertGeo, faces(insertSide, std(0xffffff, { map: texB, roughness: 0.5 })), INSERT_B_X, (QLCS_T + 0.3) / 2, EDGE_Z));
  scene.add(qlcs);

  /* ---------- ladder ---------- */
  const sensorTex = texture(160, 226, (g, w, h) => {
    g.fillStyle = css(C.sensor); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(80,78,130,.10)'; g.lineWidth = 1;
    for (let x = 12; x < w - 10; x += 4) { g.beginPath(); g.moveTo(x + 0.5, 10); g.lineTo(x + 0.5, h - 10); g.stroke(); }
    g.strokeStyle = 'rgba(60,58,110,.35)'; g.lineWidth = 2; g.strokeRect(6, 6, w - 12, h - 12);
  });
  const hybridTex = texture(190, 226, (g, w, h) => {
    g.fillStyle = css(C.hybrid); g.fillRect(0, 0, w, h);
    g.fillStyle = '#c9a23a';
    for (let y = 10; y < h - 10; y += 8) g.fillRect(4, y, 10, 5);
    g.fillStyle = '#25272b';
    for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) g.fillRect(34 + i * 46, 30 + j * 62, 26, 34);
    g.strokeStyle = 'rgba(210,240,200,.35)'; g.lineWidth = 2;
    for (let j = 0; j < 6; j++) { g.beginPath(); g.moveTo(130, 30 + j * 32); g.lineTo(170, 113); g.stroke(); }
  });
  const sensorMats = faces(std(C.sensorSide, { roughness: 0.4 }),
    std(0xffffff, { map: sensorTex, roughness: 0.32, metalness: 0.18 }), std(C.sensorBack, { roughness: 0.5 }));
  const hybridSide = std(0x2f8a3e);
  const hybridMats = faces(hybridSide, std(0xffffff, { map: hybridTex, roughness: 0.5 }), hybridSide);
  const sensorGeo = boxG(SENSOR_L - 0.8, LADDER_T, SENSOR_W);
  const hybridGeo = boxG(HYBRID_L - 0.8, LADDER_T, SENSOR_W);
  const connGeo = boxG(12, 8, 34), connMat = std(C.connector, { roughness: 0.4 });
  const glueMat = std(C.glue, { roughness: 0.3, metalness: 0 });

  // ladder origin: centre of the bonding (under) face; sensors up, hybrid at +x
  function buildLadder(n = N_SENSORS) {
    const g = new THREE.Group(), L = ladderLen(n);
    for (let i = 0; i < n; i++) g.add(mesh(sensorGeo, sensorMats, -L / 2 + SENSOR_L * (i + 0.5), LADDER_T / 2, 0));
    g.add(mesh(hybridGeo, hybridMats, L / 2 - HYBRID_L / 2, LADDER_T / 2, 0));
    g.add(mesh(connGeo, connMat, L / 2 - 12, LADDER_T + 4, 0));
    return g;
  }
  // ladders 1-4, placed in the time-lapse
  const bondedGlueGeo = boxG(LADDER_L - 20, GLUE_T, SENSOR_W - 10);
  const bonded = [1, 2, 3, 4].map(r => {
    const l = buildLadder();
    l.position.set(S2.x, BOND_Y, rowZ(r));
    l.add(mesh(bondedGlueGeo, glueMat, 0, -GLUE_T / 2, 0, { edges: false }));
    scene.add(l);
    return l;
  });

  const ladder = buildLadder();
  scene.add(ladder);

  // adhesive dots on the bonding face, laid through the mask
  const DOTS = [];
  for (let i = 0; i < N_SENSORS; i++) {
    const x0 = -LADDER_L / 2 + SENSOR_L * (i + 0.5);
    for (const dx of [-24, 0, 24]) for (const dz of [-39, -13, 13, 39]) DOTS.push([x0 + dx, dz]);
  }
  for (const dx of [-22, 18]) for (const dz of [-30, 0, 30]) DOTS.push([LADDER_L / 2 - HYBRID_L / 2 + dx, dz]);
  const dots = new THREE.InstancedMesh(new THREE.CylinderGeometry(5.5, 5.5, GLUE_T, 18), glueMat, DOTS.length);
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dots.frustumCulled = false;
  ladder.add(dots);
  const mM = new THREE.Matrix4(), mQ = new THREE.Quaternion(), mS = new THREE.Vector3(), mP = new THREE.Vector3();
  let lastSweep = -1;
  function setDots(sweep) {
    if (sweep === lastSweep) return;
    lastSweep = sweep;
    const front = -LADDER_L / 2 - 40 + (LADDER_L + 80) * sweep;
    DOTS.forEach(([x, z], i) => {
      const k = clamp01((front - x) / 30);
      const s = k < 0.01 ? 0.001 : ease.out(k);
      mP.set(x, -GLUE_T / 2, z);
      mS.set(s, s < 0.01 ? 0.001 : 1, s);
      dots.setMatrixAt(i, mM.compose(mP, mQ, mS));
    });
    dots.instanceMatrix.needsUpdate = true;
  }

  // ladder datum: drawn over everything so it stays visible while the ladder travels
  const triadMat = new THREE.MeshBasicMaterial({ color: C.accent, transparent: true, opacity: 0, depthTest: false });
  const triad = new THREE.Group();
  {
    const shaft = new THREE.CylinderGeometry(1.8, 1.8, 70, 10), tip = new THREE.ConeGeometry(5.5, 16, 14);
    const add = (geo, x, z, rx, rz) => {
      const m = new THREE.Mesh(geo, triadMat);
      m.position.set(x, 0, z); m.rotation.set(rx, 0, rz); m.renderOrder = 20;
      triad.add(m);
    };
    add(shaft, 35, 0, 0, -Math.PI / 2); add(tip, 76, 0, 0, -Math.PI / 2);
    add(shaft, 0, 35, Math.PI / 2, 0); add(tip, 0, 76, Math.PI / 2, 0);
    add(new THREE.SphereGeometry(5.5, 14, 10), 0, 0, 0, 0);
  }
  triad.position.set(-LADDER_L / 2, LADDER_T + 0.5, -SENSOR_W / 2);
  ladder.add(triad);

  /* ---------- positioning jig (origin: centre of the pad face, pads facing -y) ---------- */
  const padTex = texture(144, 202, (g, w, h) => {
    g.fillStyle = css(C.pad); g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(90,40,8,.55)'; g.lineWidth = 2.5;
    for (let k = 0; k < 6; k++) { const m = 14 + k * 11; rrect(g, m, m, w - 2 * m, h - 2 * m, 8); g.stroke(); }
  });
  const padMat = std(0xffffff, { map: padTex, roughness: 0.6, emissive: new THREE.Color(C.pad), emissiveIntensity: 0 });
  function handleGeo(s) {
    const pts = [[0, -40], [46, -40], [66, -28], [72, 0], [66, 28], [46, 40], [0, 40]].map(([x, z]) => new THREE.Vector3(s * x, 0, z));
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 7, 12, false);
  }
  const handleGeos = [handleGeo(-1), handleGeo(1)];
  // ghost: the see-through stand-in that places ladders 1-4 in the time-lapse
  function buildJig(ghost, n = N_SENSORS) {
    const g = new THREE.Group();
    const LL = ladderLen(n), JL = LL + 50, PX = JL / 2 + END_L / 2;
    const gm = ghost && std(C.jig, { transparent: true, opacity: 0, depthWrite: false });
    const ge = ghost && EDGE.clone();
    const o = { cast: !ghost, edges: ghost ? ge : EDGE };
    const jigMat = gm || std(C.jig, { metalness: 0.25, roughness: 0.45 });
    const endMat = gm || std(C.jigEnd, { metalness: 0.25, roughness: 0.45 });
    const padSide = gm || std(0xb5651f);
    g.add(mesh(boxG(JL, JIG_H, JIG_W), jigMat, 0, PAD_T + JIG_H / 2, 0, o));
    const padGeo = boxG(SENSOR_L - 8, PAD_T, SENSOR_W - 12);
    const pads = gm || faces(padSide, padSide, padMat);
    for (let i = 0; i < n; i++) g.add(mesh(padGeo, pads, -LL / 2 + SENSOR_L * (i + 0.5), PAD_T / 2, 0, { cast: !ghost, edges: false }));
    const pinMat = gm || std(C.pin, { metalness: 0.55, roughness: 0.3, emissive: new THREE.Color(C.pin), emissiveIntensity: 0 });
    const handleMat = gm || std(C.handle, { metalness: 0.3, roughness: 0.35 });
    const endGeo = boxG(END_L, PAD_T + JIG_H + FOOT, JIG_W + 8);
    [-1, 1].forEach((s, k) => {
      g.add(mesh(endGeo, endMat, s * (JL / 2 + END_L / 2), (PAD_T + JIG_H - FOOT) / 2, 0, o));
      const pin = new THREE.Group();
      pin.position.set(s * PX, -FOOT, 0);
      pin.add(mesh(new THREE.CylinderGeometry(PIN_R * 0.8, PIN_R * 0.8, PIN_LEN, 16), pinMat, 0, -PIN_LEN / 2, 0, { cast: !ghost, edges: false }));
      pin.add(mesh(new THREE.SphereGeometry(PIN_R, 18, 12), pinMat, 0, -PIN_LEN, 0, { cast: !ghost, edges: false }));
      g.add(pin);
      g.add(mesh(handleGeos[k], handleMat, s * (JL / 2 + END_L - 3), PAD_T + JIG_H * 0.62, 0, { cast: !ghost, edges: false }));
    });
    g.userData = { gm, ge, pinMat };
    return g;
  }
  const jig = buildJig(false);
  scene.add(jig);
  const ghost = buildJig(true);
  scene.add(ghost);

  /* ---------- bonding mask and applicator ---------- */
  const MASK_L = 1035, MASK_W = 108;
  const maskTex = texture(MASK_L * 2, MASK_W * 2, (g, w, h) => {
    g.fillStyle = css(C.mask); g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-out';
    for (const [x, z] of DOTS) hole(g, (x + MASK_L / 2) * 2, (z + MASK_W / 2) * 2, 13, 13, '#000');
    g.globalCompositeOperation = 'source-over';
  });
  const maskFace = std(0xffffff, { map: maskTex, transparent: true, alphaTest: 0.5, roughness: 0.4, metalness: 0.3 });
  const maskSide = std(C.mask, { transparent: true });
  const maskEdge = EDGE.clone();
  const mask = mesh(boxG(MASK_L, 0.8, MASK_W), faces(maskSide, maskFace, maskFace), S1.x, GLUE_FACE + 170, GLUE_Z, { cast: false, edges: maskEdge });
  scene.add(mask);
  const appMat = std(0xc3c7cd, { metalness: 0.4, roughness: 0.35, transparent: true });
  const appEdge = EDGE.clone();
  const applicator = mesh(boxG(10, 34, 140), appMat, 0, 0, GLUE_Z, { cast: false, edges: appEdge });
  scene.add(applicator);


  /* ======================= part C: the quadrant onto Layer 0 ======================= */

  // ladders 6-9 (10 and 8 sensors), placed in the second time-lapse
  const later = [6, 7, 8, 9].map(r => {
    const n = rowN(r), l = buildLadder(n);
    l.position.set(S2.x + rowCX(r), BOND_Y, rowZ(r));
    l.add(mesh(boxG(ladderLen(n) - 20, GLUE_T, SENSOR_W - 10), glueMat, 0, -GLUE_T / 2, 0, { edges: false }));
    l.userData.r = r;
    scene.add(l);
    return l;
  });
  const ghosts = { 10: buildJig(true, 10), 8: buildJig(true, 8) };
  scene.add(ghosts[10], ghosts[8]);

  // transport jig (thesis Fig. 4.2): a frame that holds the populated QLCS by suction on the sensors.
  // Its origin is the QLCS origin, so the quadrant simply rides along as its child.
  const tjMat = std(0xd8b98a, { roughness: 0.55, transparent: true });
  const tjCupMat = std(0x3a3c40, { roughness: 0.5, transparent: true });
  const tjPinMat = std(C.fixPin, { metalness: 0.45, roughness: 0.35, transparent: true });
  const tjEdge = EDGE.clone();
  const tj = new THREE.Group();
  {
    const LT = QLCS_T + GLUE_T + LADDER_T;                       // top of the ladders, in QLCS coordinates
    const bar = (xa, za, xb, zb, w = 30, h = 26) => {
      const len = Math.hypot(xb - xa, zb - za);
      const m = mesh(boxG(len, h, w), tjMat, (xa + xb) / 2, LT + 16 + h / 2, (za + zb) / 2, { edges: tjEdge });
      m.rotation.y = -Math.atan2(zb - za, xb - xa);
      tj.add(m);
      for (let d = 60; d < len - 40; d += 140) {                 // suction cups on the sensors
        const u = d / len;
        tj.add(mesh(new THREE.CylinderGeometry(14, 14, 16, 18), tjCupMat, xa + (xb - xa) * u, LT + 8, za + (zb - za) * u, { edges: false }));
      }
    };
    bar(-470, -360, 330, -360); bar(330, -360, 80, 330); bar(80, 330, -470, 330); bar(-470, 330, -470, -360);
    bar(-470, -15, 205, -15);
    const pinG = chamferPin(4, 40, 0.8);
    for (const z of [rowZ(3), rowZ(7)]) {                        // brackets carrying the locating pins
      const tip = [-PIN_X, z];
      [[-470, z - 70], [-470, z + 70]].forEach(([x, zz]) => {
        const len = Math.hypot(tip[0] - x, tip[1] - zz);
        const m = mesh(boxG(len, 12, 22), tjMat, (x + tip[0]) / 2, LT + 30, (zz + tip[1]) / 2, { edges: tjEdge });
        m.rotation.y = -Math.atan2(tip[1] - zz, tip[0] - x);
        tj.add(m);
      });
      tj.add(mesh(pinG, tjPinMat, tip[0], 11.5, tip[1], { edges: false }));
    }
  }
  tj.visible = false;
  scene.add(tj);
  const quad = new THREE.Group();                                // the populated QLCS while it travels
  scene.add(quad);

  // Station 3: second table, stand, and the octagonal L0 support plane
  const tableTex2 = tableTex.clone();
  tableTex2.repeat.set(33, 33);
  tableTex2.needsUpdate = true;
  scene.add(mesh(boxG(3300, 80, 3300), faces(std(C.tableSide), std(0xffffff, { map: tableTex2, roughness: 0.85 })),
    S3.x, -40, 0, { cast: false, edges: false }));
  const standMat = std(0x8d939b, { metalness: 0.35, roughness: 0.4 });
  for (let k = 0; k < 8; k++) {
    const a = Math.PI / 8 + k * Math.PI / 4, h = S3.top - L0_T;
    scene.add(mesh(boxG(40, h, 40), standMat, S3.x + 1405 * Math.cos(a), h / 2, 1405 * Math.sin(a)));
  }
  const octShape = apo => {
    const s = new THREE.Shape(), r = apo / Math.cos(Math.PI / 8);
    for (let k = 0; k < 8; k++) {
      const a = Math.PI / 8 + k * Math.PI / 4;
      if (k) s.lineTo(r * Math.cos(a), r * Math.sin(a)); else s.moveTo(r * Math.cos(a), r * Math.sin(a));
    }
    s.closePath();
    return s;
  };
  const octGeo = (apo, t) => {
    const g = new THREE.ExtrudeGeometry(octShape(apo), { depth: t, bevelEnabled: false });
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const l0 = new THREE.Group();                                  // origin: centre of L0, y = 0 at the table
  l0.position.set(S3.x, 0, 0);
  scene.add(l0);
  l0.add(mesh(octGeo(L0_APO, L0_T), [std(0x2f3136, { roughness: 0.7 }), std(0xdcc760, { roughness: 0.8 })], 0, S3.top - L0_T, 0));
  const panelMat = std(0xc9a77a, { roughness: 0.6 });
  for (let k = 0; k < 8; k++) {                                  // frame panels around the edge
    const a = k * Math.PI / 4, len = 2 * L0_R * Math.sin(Math.PI / 8) - 20;
    const m = mesh(boxG(len, 190, 12), panelMat, (L0_APO + 6) * Math.cos(a), S3.top - L0_T + 95, (L0_APO + 6) * Math.sin(a));
    m.rotation.y = -a - Math.PI / 2;
    l0.add(m);
  }
  for (let k = 0; k < 4; k++) {                                  // read-out electronics between the quadrants
    const a = Math.PI / 4 + k * Math.PI / 2;
    const m = mesh(boxG(430, 20, 150), std(0xd27a2e, { roughness: 0.5 }), 1170 * Math.cos(a), S3.top + 10, 1170 * Math.sin(a));
    m.rotation.y = -a - Math.PI / 2;
    l0.add(m);
  }
  // the seat for our QLCS-L: rotated 45° on the zenith plane, inner corner on the L0 centre
  const seat = new THREE.Group();
  seat.position.set(0, S3.top, 0);
  seat.rotation.y = QUAD_YAW;
  const seatIn = new THREE.Group();
  seatIn.position.set(-CORNER_X, 0, -CORNER_Z);
  seat.add(seatIn);
  l0.add(seat);
  BUTTONS.forEach(([x, z]) => {
    seatIn.add(mesh(baseGeo, baseMat, x, BUTTON_H / 2, z, { edges: false }));
    seatIn.add(mesh(capGeo, capMat, x, BUTTON_H + 1.5, z, { edges: false }));
  });
  function seatPin(color, x) {
    const m = std(color, { metalness: 0.45, roughness: 0.35, transparent: true });
    const g = new THREE.Group();
    g.add(mesh(qPinGeo, m, 0, 4, 0, { edges: false }));
    g.position.set(x, 0, EDGE_Z);
    g.userData = { m };
    seatIn.add(g);
    return g;
  }
  const l0Guide = [seatPin(C.guidePin, GUIDE_A_X), seatPin(C.guidePin, GUIDE_B_X)];
  const l0Fix = [seatPin(C.fixPin, PREC_X), seatPin(C.fixPin, HSLOT_X)];

  // glue discs through a 0.6 mm mask (Ø10 holes), spaced so they stay apart after the 3 mm slide
  const L0_GLUE_T = 1.4;
  const inQuad = (x, z, m) => {
    if (z < CORNER_Z + m || z > 500 || x < CORNER_X + m) return false;
    const xMax = z <= rowZ(5) + PITCH / 2 ? LADDER_L / 2 + 6 : z <= rowZ(7) + PITCH / 2 ? -LADDER_L / 2 + ladderLen(10) + 6 : -LADDER_L / 2 + ladderLen(8) + 6;
    return x <= xMax - m;
  };
  const GDOTS = [];
  for (let z = CORNER_Z + 30; z < 500; z += 44) for (let x = CORNER_X + 30; x < 540; x += 44) {
    if (inQuad(x, z, 22) && BUTTONS.every(([bx, bz]) => Math.hypot(bx - x, bz - z) > 26)) GDOTS.push([x, z]);
  }
  const gdots = new THREE.InstancedMesh(new THREE.CylinderGeometry(5, 5, L0_GLUE_T, 14), glueMat, GDOTS.length);
  gdots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  gdots.frustumCulled = false;
  seatIn.add(gdots);
  let lastG = '';
  function setGlueDots(front, spread) {
    const key = front.toFixed(1) + '|' + spread.toFixed(3);
    if (key === lastG) return;
    lastG = key;
    GDOTS.forEach(([x, z], i) => {
      const k = clamp01((front - z) / 40), s = k < 0.01 ? 0.001 : ease.out(k);
      const r = s * (1 + 0.35 * spread), hy = s < 0.01 ? 0.001 : 1 - 0.3 * spread;
      mP.set(x, L0_GLUE_T * hy / 2, z);
      mS.set(r, hy, r);
      gdots.setMatrixAt(i, mM.compose(mP, mQ, mS));
    });
    gdots.instanceMatrix.needsUpdate = true;
  }
  const l0MaskTex = texture(1090, 1090, (g, w, h) => {
    g.fillStyle = css(C.mask);
    for (let y = 0; y < h; y += 2) for (let x = 0; x < w; x += 2) if (inQuad(x - 545, y - 545, 4)) g.fillRect(x, y, 2, 2);
    g.globalCompositeOperation = 'destination-out';
    for (const [x, z] of GDOTS) hole(g, x + 545, z + 545, 6.5, 6.5, '#000');
    g.globalCompositeOperation = 'source-over';
  });
  const l0MaskMat = new THREE.MeshStandardMaterial({ map: l0MaskTex, transparent: true, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.4, metalness: 0.3 });
  const l0Mask = new THREE.Mesh(new THREE.PlaneGeometry(1090, 1090), l0MaskMat);
  l0Mask.rotation.x = -Math.PI / 2;
  seatIn.add(l0Mask);
  const spatMat = std(0xc3c7cd, { metalness: 0.4, roughness: 0.35, transparent: true });
  const spatEdge = EDGE.clone();
  const spatula = mesh(boxG(1120, 30, 14), spatMat, 0, 16, 0, { cast: false, edges: spatEdge });
  seatIn.add(spatula);

  // the other three quadrants: QLCS-R and QLCS-L alternate around the zenith plane
  const qSolidMat = std(C.qlcs, { roughness: 0.8 });
  function buildQuadrant() {
    const g = new THREE.Group();
    g.add(mesh(qGeo, qSolidMat));
    for (let r = 1; r <= 9; r++) {
      const l = buildLadder(rowN(r));
      l.position.set(rowCX(r), BOND_Y - Q_BASE, rowZ(r));
      g.add(l);
    }
    return g;
  }
  const others = [1, 2, 3].map(k => {
    const slot = new THREE.Group();
    slot.rotation.y = QUAD_YAW + k * Math.PI / 2;
    let host = slot;
    if (k % 2) {                                                 // QLCS-R: the mirror image of QLCS-L
      const m = new THREE.Group();
      m.scale.x = -1;
      m.rotation.y = Math.PI / 2;
      slot.add(m);
      host = m;
    }
    const inner = buildQuadrant();
    inner.position.set(-CORNER_X, BUTTON_H, -CORNER_Z);
    host.add(inner);
    slot.visible = false;
    l0.add(slot);
    slot.userData = { inner, name: k % 2 ? 'QLCS-R' : 'QLCS-L' };
    return slot;
  });

  // cupolas: carbon-skin sandwich covers above and below the detector planes
  const cupMat = std(0x8fd3cf, { transparent: true, opacity: 0, roughness: 0.3, depthWrite: false });
  const cupEdge = EDGE.clone();
  const cupGeo = octGeo(1270, 14);
  const cupUp = mesh(cupGeo, cupMat, 0, S3.top + 125, 0, { cast: false, edges: cupEdge });
  const cupLow = mesh(cupGeo, cupMat, 0, S3.top - L0_T - 139, 0, { cast: false, edges: cupEdge });
  l0.add(cupUp, cupLow);

  // AMS-02, much simplified: ECAL, RICH, TOF, magnet (layers 2-8 inside), TRD, layer 1, struts for L0
  const ams = new THREE.Group();
  ams.position.set(AMS.x, 0, 0);
  scene.add(ams);
  {
    const add = (geo, color, y, o = {}) => {
      const m = mesh(geo, std(color, Object.assign({ roughness: 0.55 }, o)), 0, y, 0);
      ams.add(m);
      return m;
    };
    const oct = (rTop, rBot, h) => new THREE.CylinderGeometry(rTop, rBot, h, 8);
    add(boxG(900, 380, 900), 0x39465c, 190);
    add(oct(1050, 880, 420), 0xc9a24a, 600, { metalness: 0.3 }).rotation.y = Math.PI / 8;
    add(oct(1120, 1120, 50), 0x8a96a8, 845).rotation.y = Math.PI / 8;
    add(new THREE.CylinderGeometry(1000, 1000, 880, 48), 0x5f8a58, 1310);
    for (let k = 0; k < 9; k++) add(new THREE.CylinderGeometry(1016, 1016, 24, 48), 0x48703f, 900 + k * 102);
    add(oct(1150, 1150, 50), 0x8a96a8, 1780).rotation.y = Math.PI / 8;
    add(oct(1420, 1100, 620), 0x8b8f96, 2120).rotation.y = Math.PI / 8;
    add(oct(1450, 1450, 40), 0x2f3136, 2470).rotation.y = Math.PI / 8;
    add(oct(950, 950, 6), 0xd88a3c, 2493).rotation.y = Math.PI / 8;
    const beam = (a, b, w, color) => {
      const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b);
      const m = mesh(boxG(w, w, va.distanceTo(vb)), std(color, { metalness: 0.3, roughness: 0.45 }), 0, 0, 0);
      m.position.copy(va).add(vb).multiplyScalar(0.5);
      m.lookAt(vb);
      ams.add(m);
    };
    for (let k = 0; k < 8; k++) {                                // TRD truss and the struts carrying L0
      const a = Math.PI / 8 + k * Math.PI / 4, c = Math.cos(a), s = Math.sin(a);
      beam([1080 * c, 1820, 1080 * s], [1400 * c, 2430, 1400 * s], 36, 0x58b84a);
      const b = k * Math.PI / 4;
      beam([1350 * Math.cos(b), 2490, 1350 * Math.sin(b)], [1300 * Math.cos(b), AMS.l0 - L0_T, 1300 * Math.sin(b)], 40, 0x9ba1aa);
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {        // the main support structure and its trunnions
      const end = [sx * 2500, 1150, sz * 1050];
      beam([sx * 900, 1750, sz * 500], end, 90, 0x9ba1aa);
      beam([sx * 500, 400, sz * 500], end, 90, 0x9ba1aa);
      const tr = mesh(new THREE.CylinderGeometry(55, 55, 260, 18), std(0xc7d24a, { metalness: 0.4 }), end[0] + sx * 100, end[1], end[2]);
      tr.rotation.z = Math.PI / 2;
      ams.add(tr);
    }
  }
  const AMS_L0 = [AMS.x, AMS.l0 - S3.top, 0];

  // part C motion: transport jig, quadrant, L0 flight. World poses of the seat are known once L0 is built.
  l0.updateMatrixWorld(true);
  const tv2 = new THREE.Vector3();
  const SW = (x, y, z) => { seatIn.localToWorld(tv2.set(x, y, z)); return [tv2.x, tv2.y, tv2.z]; };
  const PRE_SEAT = SW(Q_OFF, BUTTON_H, Q_OFF), SEATED = SW(0, BUTTON_H, 0);
  const TJ_S2 = [S2.x, Q_BASE, 0], TJ_UP = [S2.x, Q_BASE + 380, 0];
  T.tj = track([
    [at('tjig', 0), [S2.x, Q_BASE + 520, 0]],
    [at('tjig', 1.6), TJ_S2, 'out'],
    [at('tjig', 3.4), TJ_S2],
    [at('tjig', 5.0), TJ_UP],
    [at('l0place', 0.2), TJ_UP],
    [at('l0place', 3.2), [PRE_SEAT[0], PRE_SEAT[1] + 380, PRE_SEAT[2]]],
    [at('l0place', 4.8), PRE_SEAT, 'out'],
    [at('l0place', 5.2), PRE_SEAT],
    [at('l0place', 7.0), SEATED],
    [at('l0cure', 1.2), SEATED],
    [at('l0cure', 3.4), [SEATED[0], SEATED[1] + 650, SEATED[2]]],
  ]);
  T.tjYaw = track([[0, 0], [at('l0place', 0.2), 0], [at('l0place', 3.2), QUAD_YAW]]);
  T.l0 = track([
    [at('ams', 0.2), [S3.x, 0, 0]],
    [at('ams', 1.8), [S3.x, 900, 0]],
    [at('ams', 4.4), [AMS_L0[0], AMS_L0[1] + 700, 0]],
    [at('ams', 6.0), AMS_L0, 'out'],
  ]);
  T.l0Mask = track([
    [at('l0glue', 0.6), 160], [at('l0glue', 1.8), 1, 'out'], [at('l0glue', 5.0), 1], [at('l0glue', 6.2), 160],
  ]);
  T.l0Sweep = track([[at('l0glue', 2.0), CORNER_Z - 30], [at('l0glue', 4.8), 560, 'linear']]);

  CAM.push(
    [at('finish', 0.6), [1300, 1000, 1450], [650, 0, -120]],
    [at('finish', 3.6), [1350, 950, 1500], [650, 0, 60]],
    [at('tjig', 0.8), [1650, 1250, 1900], [650, 40, 0]],
    [at('tjig', 6.0), [1600, 1150, 1850], [650, 120, 0]],
    [at('l0glue', 1.2), [S3.x + 900, 1900, 2500], [S3.x + 600, 200, 100]],
    [at('l0glue', 6.5), [S3.x + 1200, 1500, 2000], [S3.x + 700, 200, 150]],
    [at('l0place', 0.6), [2600, 2300, 4300], [2400, 250, 0]],
    [at('l0place', 3.4), [S3.x + 1300, 1500, 2300], [S3.x + 700, 220, 150]],
    [at('l0place', 8.5), [S3.x + 1100, 1300, 2000], [S3.x + 750, 220, 200]],
    [at('l0cure', 1.2), [S3.x + 1300, 1700, 2500], [S3.x + 600, 220, 100]],
    [at('l0cure', 4.5), [S3.x + 1200, 2100, 2800], [S3.x + 300, 220, 0]],
    [at('quads', 1.0), [S3.x + 300, 4300, 2700], [S3.x, 200, 0]],
    [at('quads', 4.5), [S3.x - 300, 4200, 2800], [S3.x, 200, 0]],
    [at('cupola', 1.0), [S3.x + 1800, 1700, 3300], [S3.x, 200, 0]],
    [at('cupola', 5.0), [S3.x + 2100, 1400, 3200], [S3.x, 200, 0]],
    [at('ams', 0.6), [S3.x + 2600, 3600, 7400], [(S3.x + AMS.x) / 2, 1500, 0]],
    [at('ams', 6.0), [AMS.x + 3200, 3700, 7900], [AMS.x, 1750, 0]],
    [TOTAL, [AMS.x - 3600, 3300, 7500], [AMS.x, 1750, 0]],
  );
  CAM.sort((a, b) => a[0] - b[0]);
  T.camPos = track(CAM.map(([t, p]) => [t, p]));
  T.camTgt = track(CAM.map(([t, , g]) => [t, g]));

  /* ---------- labels ---------- */
  const labelsEl = document.getElementById('labels');
  const tv = new THREE.Vector3();
  const pointOn = (obj, x, y, z = 0) => () => { obj.localToWorld(tv.set(x, y, z)); return [tv.x, tv.y, tv.z]; };
  const pinTop = p => [p.position.x, p.position.y + 13, p.position.z];
  const SVGNS = 'http://www.w3.org/2000/svg';
  const leaders = document.createElementNS(SVGNS, 'svg');
  leaders.setAttribute('class', 'leaders');
  labelsEl.appendChild(leaders);
  const LADDER_TOP_S2 = BOND_Y + LADDER_T;
  const LABELS = [
    ['Station 1', [S1.x - 470, S1_TOP, 300], [[0.4, at('supports', 1.6)], [at('unpack', 0.8), at('unpack', 2.6)]]],
    ['Station 2', [S2.x - 420, S2_TOP, 570], [[0.4, at('supports', 2.2)], [at('transfer', 3.4), at('locate', 1.0)]]],
    ['13 support buttons', [[S2.x + 430, Q_BASE + 3, 1], [S2.x + 202, Q_BASE + 3, 223], [S2.x + 430, Q_BASE + 3, -445]], [[at('supports', 1.8), at('supports', 5.0)]]],
    ['Guide pins, already in place', () => guidePins.map(pinTop), [[at('supports', 2.6), at('lower', 1.0)]]],
    ['QLCS', pointOn(qlcs, -150, QLCS_T, -100), [[at('lower', 0.4), at('lower', 2.6)]]],
    ['PEEK edge inserts', pointOn(qlcs, INSERT_B_X, QLCS_T, EDGE_Z), [[at('lower', 3.4), at('slide', 0.6)]]],
    ['Slides 3 mm at 45°', pointOn(qlcs, INSERT_A_X + 20, QLCS_T, EDGE_Z), [[at('slide', 0.6), at('slide', 4.6)]]],
    ['Pin in the precision hole', [S2.x + PREC_X, S2_TOP + 17, EDGE_Z], [[at('qpin', 1.2), at('qpin', 2.8)]]],
    ['Pin in the horizontal slot', [S2.x + HSLOT_X, S2_TOP + 17, EDGE_Z], [[at('qpin', 1.6), at('qpin', 3.0)]]],
    ['Guide pins out', () => guidePins.map(pinTop), [[at('qpin', 3.0), at('qpin', 4.5)]]],
    ['Ladders 1–4 · time-lapse', [S2.x - 200, LADDER_TOP_S2, rowZ(2)], [[at('timelapse', 0.4), at('timelapse', 3.4)]]],
    ['Zone 1 · transport container', [S1.x + 420, BED_TOP + 16, CONT_Z + 75], [[at('unpack', 1.4), at('align', 1.2)]]],
    ['Zone 2 · alignment', [S1.x - 330, BED_TOP, 70], [[at('align', 1.4), at('align', 3.4)]]],
    ['Precision pins', S1_PINS.map(([x, z]) => [S1.x + x, BED_TOP + 10, z]), [[at('align', 3.8), at('align', 5.6)]]],
    ['Ladder datum', () => { triad.getWorldPosition(tv); return [tv.x, tv.y, tv.z]; }, [[at('align', 5.7), at('capture', 1.4)], [at('locate', 6.4), at('cure', 2)]]],
    ['Positioning jig', pointOn(jig, -250, PAD_T + JIG_H), [[at('capture', 0.3), at('capture', 1.6)]]],
    ['Electronics end first', [S1.x + PIN_X, S1_TOP, 0], [[at('capture', 6.5), at('capture', 8.1)]]],
    ['Far pin → slot', [S1.x - PIN_X, S1_TOP, 0], [[at('capture', 7.7), at('capture', 8.9)]]],
    ['Vacuum on: pads hold every sensor', pointOn(jig, 0, PAD_T + JIG_H), [[at('capture', 8.8), at('capture', 10.0)]]],
    ['Zone 3 · glue', [S1.x + 420, S1_TOP + 50, GLUE_Z - 70], [[at('invert', 2.6), at('invert', 6.4)]]],
    ['Bonding mask', () => [mask.position.x - 300, mask.position.y, mask.position.z], [[at('glue', 0.8), at('glue', 2.4)]]],
    ['Adhesive through the mask', () => [applicator.position.x, applicator.position.y + 18, applicator.position.z], [[at('glue', 2.6), at('glue', 5.0)]]],
    ['QLCS on its support buttons', [S2.x + 230, Q_BASE + QLCS_T, 400], [[at('transfer', 3.6), at('locate', 1.4)]]],
    ['Ladders 1–4, bonded', [S2.x - 150, LADDER_TOP_S2, rowZ(2)], [[at('transfer', 4.0), at('locate', 1.4)]]],
    ['Electronics-end pin → hole', [S2.x + PIN_X, S2_TOP, 0], [[at('locate', 1.2), at('locate', 6.6)]]],
    ['Vacuum off', pointOn(jig, 250, PAD_T + JIG_H), [[at('release', 0.5), at('release', 2.2)]]],
    ['Ladder 5 bonded', [S2.x + 330, LADDER_TOP_S2, 20], [[at('release', 3.0), at('finish', 0.3)]]],
    ['200 µm gap to ladder 4', [S2.x + 450, LADDER_TOP_S2, rowZ(5) - PITCH / 2], [[at('release', 4.6), at('finish', 0.3)]]],
    ['Ladders 6–9 · time-lapse', [S2.x - 200, LADDER_TOP_S2, rowZ(7)], [[at('finish', 0.4), at('finish', 3.6)]]],
    ['Transport jig', pointOn(tj, -100, 60, -360), [[at('tjig', 0.5), at('tjig', 2.6)]]],
    ['Suction on the sensors, QLCS lifted', pointOn(tj, 200, 60, -15), [[at('tjig', 3.0), at('tjig', 5.6)]]],
    ['Station 3 · L0 support plane', pointOn(l0, -900, S3.top, 900), [[at('l0glue', 0.4), at('l0glue', 2.6)]]],
    ['Support buttons, glued and ground', () => [[430, 1], [-26, 1], [202, 223]].map(([x, z]) => pointOn(seatIn, x, BUTTON_H + 3, z)()), [[at('l0glue', 0.8), at('l0glue', 2.4)]]],
    ['3M 2216 through a 0.6 mm mask', () => pointOn(seatIn, 0, 30, spatula.position.z)(), [[at('l0glue', 2.4), at('l0glue', 4.8)]]],
    ['Slides 3 mm at 45°, glue spreads', pointOn(seatIn, INSERT_A_X + 20, QLCS_T + 10, EDGE_Z), [[at('l0place', 5.0), at('l0place', 7.4)]]],
    ['Glue carries the launch loads', pointOn(seatIn, 0, 20, 0), [[at('l0cure', 0.4), at('l0cure', 3.0)]]],
    ['QLCS-R', pointOn(others[0].userData.inner, 0, 12, 0), [[at('quads', 2.6), at('quads', 4.5)]]],
    ['QLCS-L', pointOn(others[1].userData.inner, 0, 12, 0), [[at('quads', 3.2), at('quads', 4.5)]]],
    ['QLCS-R', pointOn(others[2].userData.inner, 0, 12, 0), [[at('quads', 3.8), at('quads', 4.5)]]],
    ['Upper cupola', pointOn(cupUp, 600, 14, 600), [[at('cupola', 1.6), at('cupola', 3.6)]]],
    ['Lower cupola', pointOn(cupLow, 900, 0, 700), [[at('cupola', 2.8), at('cupola', 5.0)]]],
    ['New Layer 0', pointOn(l0, 900, S3.top + 140, 900), [[at('ams', 5.8), TOTAL + 1]]],
    ['Layer 1', [AMS.x + 1050, 2490, 1050], [[at('ams', 6.4), TOTAL + 1]]],
    ['TRD', [AMS.x + 1150, 2150, 600], [[at('ams', 6.8), TOTAL + 1]]],
    ['Magnet · tracker layers 2–8 inside', [AMS.x + 800, 1500, 600], [[at('ams', 7.2), TOTAL + 1]]],
    ['RICH and ECAL', [AMS.x + 700, 600, 600], [[at('ams', 7.6), TOTAL + 1]]],
  ].map(([text, p, wins]) => {
    const el = document.createElement('div');
    el.className = 'lbl';
    const span = document.createElement('span');
    span.textContent = text;
    el.appendChild(span);
    labelsEl.appendChild(el);
    return { el, p, wins, op: -1, g: null };
  });
  // a label anchored on several parts sits above them and draws a leader line to each one on screen
  function leaderGroup(L, n) {
    L.el.classList.add('lbl--multi');
    L.g = document.createElementNS(SVGNS, 'g');
    for (let i = 0; i < n; i++) {
      L.g.appendChild(document.createElementNS(SVGNS, 'line'));
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('r', 3);
      L.g.appendChild(c);
    }
    leaders.appendChild(L.g);
  }
  function updateLabels(t) {
    const w = viewer.clientWidth, h = viewer.clientHeight;
    for (const L of LABELS) {
      let a = 0;
      for (const [s, e] of L.wins) a = Math.max(a, win(t, s, s + 0.35) * (1 - win(t, e - 0.35, e)));
      if (a > 0.01) {
        const p = typeof L.p === 'function' ? L.p() : L.p;
        const multi = Array.isArray(p[0]);
        const pts = (multi ? p : [p]).map(q => {
          tv.set(q[0], q[1], q[2]).project(camera);
          return [(tv.x * 0.5 + 0.5) * w, (-tv.y * 0.5 + 0.5) * h, tv.z];
        });
        const seen = pts.filter(([x, y, z]) => z < 1 && x > -10 && x < w + 10 && y > 0 && y < h + 10);
        if (multi && !L.g) leaderGroup(L, pts.length);
        if (!seen.length) a = 0;
        else if (!L.g) {
          const [x, y] = seen[0];
          if (y < 40) a = 0;
          else L.el.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
        } else {
          const bx = seen.reduce((m, q) => m + q[0], 0) / seen.length;
          const by = Math.max(30, Math.min(...seen.map(q => q[1])) - 36);
          L.el.style.transform = 'translate(' + bx.toFixed(1) + 'px,' + by.toFixed(1) + 'px)';
          const kids = L.g.children;
          pts.forEach((q, i) => {
            const on = seen.includes(q);
            const ln = kids[2 * i], c = kids[2 * i + 1];
            ln.style.display = c.style.display = on ? '' : 'none';
            if (!on) return;
            ln.setAttribute('x1', bx.toFixed(1)); ln.setAttribute('y1', by.toFixed(1));
            ln.setAttribute('x2', q[0].toFixed(1)); ln.setAttribute('y2', q[1].toFixed(1));
            c.setAttribute('cx', q[0].toFixed(1)); c.setAttribute('cy', q[1].toFixed(1));
          });
        }
      }
      const op = Math.round(a * 100) / 100;
      if (op !== L.op) { L.el.style.opacity = op; if (L.g) L.g.style.opacity = op; L.op = op; }
    }
  }

  /* ---------- magnifiers: close-ups of the jig's two ball-ended pins while it is held up ---------- */
  const detailCam = new THREE.PerspectiveCamera(30, 1.4, 1, 5000);
  const MAGS = [
    { s: -1, text: 'Far end · ball-ended pin, for the slot' },
    { s: 1, text: 'Electronics end · ball-ended pin, for the precision hole' },
  ].map(m => {
    const el = document.createElement('div');
    el.className = 'mag';
    el.appendChild(document.createElement('span')).textContent = m.text;
    viewer.appendChild(el);
    const ln = document.createElementNS(SVGNS, 'line');
    ln.setAttribute('class', 'mag-line');
    leaders.appendChild(ln);
    return Object.assign(m, { el, ln });
  });
  const pv = new THREE.Vector3();
  function render(t) {
    const w = viewer.clientWidth, h = viewer.clientHeight;
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
    renderer.render(scene, camera);
    const k = ease.out(win(t, at('capture', 1.7), at('capture', 2.2)) * (1 - win(t, at('capture', 4.2), at('capture', 4.6))));
    MAGS.forEach(m => {
      const on = k > 0.01;
      m.el.style.display = m.ln.style.display = on ? '' : 'none';
      if (!on) return;
      const bw = Math.round(Math.min(310, w * 0.31) * k), bh = Math.round(bw * 0.7);
      const x = m.s < 0 ? 14 : w - 14 - bw, y = 14;               // viewport origin is bottom-left
      jig.localToWorld(pv.set(m.s * PIN_X, -FOOT - PIN_LEN * 0.55, 0));
      detailCam.position.set(pv.x - m.s * 22, pv.y - 14, pv.z + 115);
      detailCam.lookAt(pv);
      detailCam.aspect = bw / bh;
      detailCam.updateProjectionMatrix();
      renderer.setScissorTest(true);
      renderer.setViewport(x, y, bw, bh);
      renderer.setScissor(x, y, bw, bh);
      renderer.render(scene, detailCam);
      Object.assign(m.el.style, { left: x + 'px', bottom: y + 'px', width: bw + 'px', height: bh + 'px' });
      pv.project(camera);
      m.ln.setAttribute('x1', (x + bw / 2).toFixed(1)); m.ln.setAttribute('y1', (h - y - bh).toFixed(1));
      m.ln.setAttribute('x2', ((pv.x * 0.5 + 0.5) * w).toFixed(1)); m.ln.setAttribute('y2', ((-pv.y * 0.5 + 0.5) * h).toFixed(1));
    });
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, w, h);
  }

  /* ---------- camera with a user orbit offset on top of the scripted path ---------- */
  const user = { yaw: 0, pitch: 0, zoom: 1 };
  let fit = 1;
  const sph = new THREE.Spherical(), off = new THREE.Vector3();
  function applyCamera(p, g) {
    off.set(p[0] - g[0], p[1] - g[1], p[2] - g[2]);
    sph.setFromVector3(off);
    sph.theta += user.yaw;
    sph.phi = Math.min(1.45, Math.max(0.12, sph.phi + user.pitch));
    sph.radius *= user.zoom * fit;
    off.setFromSpherical(sph);
    camera.position.set(g[0] + off.x, g[1] + off.y, g[2] + off.z);
    camera.lookAt(g[0], g[1], g[2]);
  }

  /* ---------- DOM: HUD, steps, insets, controls ---------- */
  const $ = id => document.getElementById(id);
  const stepEls = [...document.querySelectorAll('.steps > li')];
  const hudWhere = $('hudWhere'), hudNum = $('hudNum'), hudTitle = $('hudTitle');
  const vacEl = $('vac'), vacState = $('vacState'), cureEl = $('cure'), cureBar = $('cureBar');
  const sect = $('sect'), secJig = $('secJig'), secLadder = $('secLadder'), secGlue = $('secGlue');
  const qPlan = $('qPlan'), qGuide = $('qGuide'), qFix = $('qFix').children, qSec = $('qSec'), qArrow = $('qArrow');
  const qCap = $('qCap'), qCapIn = $('qCapIn'), qCapLbl = $('qCapLbl');
  const lQ = $('lQ'), lGlue = $('lGlue'), lDiscs = [$('lG1'), $('lG2')];
  // button cap in the section: a shallow dish whose lower face bears on the bottom skin.
  // That face sits below the skin top, so the skin sliding in from the right bends it up.
  const CAP = [[162, 220], [258, 220], [250, 226], [244, 232], [215, 232], [215, 246], [205, 246], [205, 232], [176, 232], [170, 226]];
  const CAP_IN = [[172, 220], [248, 220], [241, 224], [179, 224]];
  const capPath = (pts, flex) => 'M' + pts.map(([x, y]) => x + ' ' + (y - (x > 215 ? flex * (x - 215) / 43 : 0)).toFixed(2)).join('L') + 'Z';
  let lastFlex = -1;
  const btnPlay = $('btnPlay'), scrub = $('scrub'), timeEl = $('time'), btnSpeed = $('btnSpeed'), btnReset = $('btnReset');

  const ICON = {
    play: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5v11l9-5.5z" fill="currentColor"/></svg>',
    pause: '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" fill="currentColor"/></svg>',
    replay: '<svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true"><path d="M8 2.5a5.5 5.5 0 1 1-5.2 3.7l1.6.6A3.8 3.8 0 1 0 8 4.2V6L4.8 3.4 8 .8z" fill="currentColor"/></svg>',
  };
  const fmt = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

  scrub.max = TOTAL;
  const ticks = $('ticks');
  PHASES.slice(1).forEach(p => {
    const i = document.createElement('i');
    i.style.left = 'calc(7px + (100% - 14px) * ' + (p.start / TOTAL).toFixed(4) + ')';
    if (p.id === 'unpack') i.className = 'is-part';
    ticks.appendChild(i);
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

  /* ---------- per-frame state ---------- */
  const tCatch = at('capture', 8.5), tFree = at('release', 1.0);
  const TL0 = at('timelapse', 0.5), TL_EACH = 0.6;
  const TL2 = at('finish', 0.4), TL2_EACH = 0.7;
  const tLift = at('tjig', 3.4), tSeat = at('l0place', 7.0);
  const drop = p => (p < 0.45 ? 260 * (1 - ease.out(p / 0.45)) : 0);
  let lastVac = null, lastCure = null, lastShown = null, lastPanel = null;

  function update(t) {
    /* part A: QLCS onto its supports, 3 mm slide, pins */
    const qp = T.qlcs.at(t);
    qlcs.position.set(qp[0], qp[1], qp[2]);
    const qo = 0.55 * win(t, at('lower', 0), at('lower', 0.6)) + 0.45 * win(t, at('timelapse', 0), at('timelapse', 0.8));
    qMat.opacity = qo; qEdge.opacity = 0.3 * Math.min(1, qo * 1.8); qlcs.visible = qo > 0.01;
    qMat.depthWrite = qo > 0.99;
    const glow = Math.sin(Math.PI * win(t, at('supports', 1.4), at('supports', 4.4)));
    baseMat.emissiveIntensity = 0.45 * glow; capMat.emissiveIntensity = 0.45 * glow;

    guidePins.forEach(p => {
      const u = win(t, at('qpin', 2.6), at('qpin', 3.6));
      p.position.y = S2_TOP + 80 * ease.inOut(u);
      p.userData.m.opacity = 1 - win(t, at('qpin', 3.1), at('qpin', 3.7));
      p.visible = p.userData.m.opacity > 0.01;
    });
    fixPins.forEach((p, i) => {
      const s = at('qpin', 0.6 + 0.5 * i), u = ease.out(win(t, s, s + 1.0));
      const out = ease.inOut(win(t, at('tjig', 2.0), at('tjig', 3.0)));
      p.position.y = S2_TOP + 80 * (1 - u) + 80 * out;
      p.userData.m.opacity = win(t, s, s + 0.3) * (1 - win(t, at('tjig', 2.5), at('tjig', 3.1)));
      p.visible = t >= s && p.userData.m.opacity > 0.01;
    });

    // time-lapse: the ghost jig sets ladders 1-4 in rows 1-4
    bonded.forEach((l, k) => {
      const s = TL0 + k * TL_EACH;
      l.visible = t >= s;
      l.position.set(S2.x, BOND_Y + drop((t - s) / TL_EACH), rowZ(k + 1));
    });
    const go = win(t, TL0 - 0.4, TL0) * (1 - win(t, TL0 + 4 * TL_EACH - 0.1, TL0 + 4 * TL_EACH + 0.4));
    ghost.visible = go > 0.01;
    if (ghost.visible) {
      const k = Math.min(3, Math.max(0, Math.floor((t - TL0) / TL_EACH))), p = (t - TL0 - k * TL_EACH) / TL_EACH;
      const h = p < 0.45 ? drop(p) : p < 0.6 ? 0 : 260 * ease.inOut(clamp01((p - 0.6) / 0.4));
      ghost.position.set(S2.x, J_S2[1] + h, rowZ(k + 1));
      ghost.userData.gm.opacity = 0.32 * go; ghost.userData.ge.opacity = 0.25 * go;
    }

    /* part B: ladder 5 */
    const jp = T.jigPos.at(t), tilt = T.jigTilt.at(t);
    jig.position.set(jp[0], jp[1], jp[2]);
    jig.rotation.set(T.jigRot.at(t), 0, tilt);

    // the ladder is free until the jig captures it, carried until release, bonded after
    if (t >= tCatch && t < tFree) {
      if (ladder.parent !== jig) jig.add(ladder);
      ladder.position.set(0, -LADDER_T, 0);
    } else if (t < tLift) {
      if (ladder.parent !== scene) scene.add(ladder);
      const lp = t < tCatch ? T.ladder.at(t) : [S2.x, BOND_Y, 0];
      ladder.position.set(lp[0], lp[1], lp[2]);
    }

    // unpacking: cover, then the brackets
    const lu = ease.inOut(win(t, at('unpack', 1.3), at('unpack', 2.7)));
    lid.position.set(LID0.x, LID0.y + 150 * lu, LID0.z + 70 * lu);
    const lo = 1 - win(t, at('unpack', 2.2), at('unpack', 3.0));
    lidMat.opacity = 0.5 * lo; lidEdge.opacity = 0.3 * lo; lid.visible = lo > 0.01;
    brackets.forEach((b, i) => {
      const s = at('unpack', 2.9) + i * 0.1;
      b.position.y = b.userData.y0 + 80 * ease.inOut(win(t, s, s + 0.9));
      const o = 1 - win(t, s + 0.45, s + 1.0);
      b.userData.m.opacity = o; b.userData.e.opacity = 0.3 * o; b.visible = o > 0.01;
    });

    s1PinMat.emissiveIntensity = 0.9 * win(t, at('align', 4.2), at('align', 5.0)) * (1 - win(t, at('capture', 0.6), at('capture', 1.6)));
    const tri = win(t, at('align', 4.9), at('align', 5.5)) * (1 - win(t, at('finish', 0), at('finish', 0.6)));
    triadMat.opacity = 0.95 * tri; triad.visible = tri > 0.01;

    const vac = (t >= at('capture', 8.7) && t < at('release', 0.6)) || (t >= at('tjig', 1.8) && t < at('l0cure', 0.6));
    padMat.emissiveIntensity = vac ? 0.25 : 0;
    if (vac !== lastVac) { lastVac = vac; vacEl.classList.toggle('is-on', vac); vacState.textContent = vac ? 'on' : 'off'; }

    // glue: mask down, adhesive swept through it, mask off
    const mo = win(t, at('glue', 0), at('glue', 0.6)) * (1 - win(t, at('glue', 6.2), at('glue', 7.0)));
    mask.position.y = T.maskY.at(t);
    maskFace.opacity = mo; maskFace.alphaTest = Math.max(0.01, 0.5 * mo); maskSide.opacity = mo; maskEdge.opacity = 0.3 * mo;
    mask.visible = mo > 0.01;
    const sweep = T.sweep.at(t);
    setDots(sweep);
    const ao = win(t, at('glue', 1.4), at('glue', 1.9)) * (1 - win(t, at('glue', 5.3), at('glue', 5.8)));
    applicator.position.set(S1.x - LADDER_L / 2 - 40 + (LADDER_L + 80) * sweep, GLUE_FACE + 18.6, GLUE_Z);
    appMat.opacity = ao; appEdge.opacity = 0.3 * ao; applicator.visible = ao > 0.01;

    // cure progress
    const inL0Cure = t >= PH.l0cure.start - 0.3;
    const cureShown = (t >= PH.cure.start && t < PH.cure.end + 0.4) || (t >= PH.l0cure.start && t < PH.l0cure.end);
    if (cureShown !== lastCure) { lastCure = cureShown; cureEl.classList.toggle('is-shown', cureShown); }
    cureBar.style.width = (100 * (inL0Cure ? win(t, at('l0cure', 0.2), at('l0cure', 4.2)) : win(t, at('cure', 0.2), at('cure', 4.2)))).toFixed(1) + '%';

    /* insets: the QLCS mechanism during part A, the bond stack from Locate on */
    // the QLCS mechanism in part A, the bond stack from Locate, then the ladder gap
    const tGap = at('release', 4.4);
    const panel = t < PH.timelapse.start ? 'qlcs' : t < tGap ? 'bond' : t < PH.l0glue.start ? 'gap' : 'l0';
    if (panel !== lastPanel) { lastPanel = panel; sect.dataset.panel = panel; }
    const shown = (t >= at('lower', 0) && t < PH.timelapse.start) || (t >= at('locate', 0.4) && t < at('finish', 0.6)) ||
      (t >= at('l0glue', 0.8) && t < PH.l0cure.end);
    jig.userData.pinMat.emissiveIntensity = 0.8 * Math.sin(Math.PI * win(t, at('capture', 1.2), at('capture', 4.9)));
    if (shown !== lastShown) { lastShown = shown; sect.classList.toggle('is-shown', shown); }

    if (panel === 'qlcs') {
      const qh = qp[1] - Q_BASE, slideU = 1 - (qp[0] - S2.x) / Q_OFF;   // 0 before the slide, 1 after
      const d = 12.7 * (1 - slideU);
      qPlan.setAttribute('transform', 'translate(' + d.toFixed(2) + ' ' + d.toFixed(2) + ')');
      qPlan.style.opacity = (1 - clamp01(qh / 120)).toFixed(3);
      qSec.setAttribute('transform', 'translate(' + (-24 * slideU).toFixed(2) + ' ' + (-Math.min(40, qh * 0.35)).toFixed(2) + ')');
      const flex = Math.round(350 * clamp01(slideU * 24 / 14)) / 100;
      if (flex !== lastFlex) {
        lastFlex = flex;
        qCap.setAttribute('d', capPath(CAP, flex));
        qCapIn.setAttribute('d', capPath(CAP_IN, flex));
        qCapLbl.textContent = flex > 2.8 ? 'cap flexes, clamps the skin' : 'cap';
      }
      qArrow.style.opacity = (win(t, at('slide', 0.2), at('slide', 0.8)) * (1 - win(t, at('slide', 4.0), at('slide', 4.6)))).toFixed(3);
      qGuide.style.opacity = (1 - win(t, at('qpin', 2.8), at('qpin', 3.6))).toFixed(3);
      for (let i = 0; i < 2; i++) {
        const s = at('qpin', 0.6 + 0.5 * i);
        qFix[i].style.opacity = win(t, s + 0.4, s + 1.0).toFixed(3);
      }
    } else if (panel === 'l0') {
      const above = t < PH.l0place.start ? 999 : Math.max(0, T.tj.at(t)[1] - PRE_SEAT[1]);
      const uL = ease.inOut(win(t, at('l0place', 5.2), at('l0place', 7.0)));
      lQ.setAttribute('transform', 'translate(' + (-24 * uL).toFixed(2) + ' ' + (-Math.min(40, above * 0.3)).toFixed(2) + ')');
      const landed = t >= at('l0place', 4.7);
      lGlue.style.opacity = win(t, at('l0glue', 2.4), at('l0glue', 4.4)).toFixed(3);
      lDiscs.forEach((r, i) => {
        const x0 = [170, 260][i];
        r.setAttribute('y', landed ? 146 : 145); r.setAttribute('height', landed ? 4 : 5);
        r.setAttribute('x', (landed ? x0 - 3 - 6 * uL : x0).toFixed(1)); r.setAttribute('width', (landed ? 46 + 6 * uL : 40).toFixed(1));
      });
    } else {
      // height of the electronics-end foot above its seat at Station 2
      let dj = 90;
      if (t >= at('transfer', 4.5) && t <= at('release', 3.2)) dj = Math.min(90, Math.max(0, (jp[1] + PIN_X * Math.sin(tilt) - J_S2[1]) * 2.4));
      secJig.setAttribute('transform', 'translate(0 ' + (-dj).toFixed(1) + ')');
      secLadder.setAttribute('transform', 'translate(0 ' + (t < tFree ? -dj : 0).toFixed(1) + ')');
      secGlue.style.opacity = t >= at('glue', 5) ? 1 : 0;
    }


    /* part C: ladders 6-9, transport jig, Station 3, other quadrants, cupolas, AMS-02 */
    later.forEach((l, k) => {
      const s = TL2 + k * TL2_EACH, r = l.userData.r;
      l.visible = t >= s;
      l.position.set(S2.x + rowCX(r), BOND_Y + drop((t - s) / TL2_EACH), rowZ(r));
    });
    const go2 = win(t, TL2 - 0.4, TL2) * (1 - win(t, TL2 + 4 * TL2_EACH - 0.1, TL2 + 4 * TL2_EACH + 0.4));
    const k2 = Math.min(3, Math.max(0, Math.floor((t - TL2) / TL2_EACH))), r2 = 6 + k2;
    [10, 8].forEach(n => {
      const g = ghosts[n], on = go2 > 0.01 && rowN(r2) === n;
      g.visible = on;
      if (!on) return;
      const p = (t - TL2 - k2 * TL2_EACH) / TL2_EACH;
      const h = p < 0.45 ? drop(p) : p < 0.6 ? 0 : 260 * ease.inOut(clamp01((p - 0.6) / 0.4));
      g.position.set(S2.x + rowCX(r2), J_S2[1] + h, rowZ(r2));
      g.userData.gm.opacity = 0.32 * go2; g.userData.ge.opacity = 0.25 * go2;
    });

    // transport jig and the quadrant it carries
    const tjp = T.tj.at(t);
    tj.position.set(tjp[0], tjp[1], tjp[2]);
    tj.rotation.y = T.tjYaw.at(t);
    const tjo = win(t, at('tjig', 0), at('tjig', 0.5)) * (1 - win(t, at('l0cure', 2.8), at('l0cure', 3.4)));
    tj.visible = tjo > 0.01;
    tjMat.opacity = tjCupMat.opacity = tjPinMat.opacity = tjo; tjEdge.opacity = 0.3 * tjo;
    if (t >= tLift) {
      const host = t < tSeat ? tj : seatIn;
      if (quad.parent !== host) host.add(quad);
      quad.position.set(0, t < tSeat ? 0 : BUTTON_H, 0);
      const local = [[qlcs, 0, 0, 0], [ladder, 0, BOND_Y - Q_BASE, 0]]
        .concat(bonded.map((l, k) => [l, 0, BOND_Y - Q_BASE, rowZ(k + 1)]))
        .concat(later.map(l => [l, rowCX(l.userData.r), BOND_Y - Q_BASE, rowZ(l.userData.r)]));
      local.forEach(([o, x, y, z]) => { if (o.parent !== quad) quad.add(o); o.position.set(x, y, z); o.visible = true; });
    } else {
      [qlcs, ladder].concat(bonded, later).forEach(o => { if (o.parent === quad) scene.add(o); });
    }

    // Station 3: glue through the mask, placement, pins
    const mh = T.l0Mask.at(t), mo3 = win(t, at('l0glue', 0.6), at('l0glue', 1.0)) * (1 - win(t, at('l0glue', 5.6), at('l0glue', 6.2)));
    l0Mask.position.y = mh;
    l0MaskMat.opacity = mo3; l0MaskMat.alphaTest = Math.max(0.01, 0.5 * mo3); l0Mask.visible = mo3 > 0.01;
    const sw = T.l0Sweep.at(t);
    spatula.position.z = sw;
    const so = win(t, at('l0glue', 1.6), at('l0glue', 2.0)) * (1 - win(t, at('l0glue', 4.8), at('l0glue', 5.2)));
    spatMat.opacity = so; spatEdge.opacity = 0.3 * so; spatula.visible = so > 0.01;
    const spread = t < at('l0place', 4.6) ? 0 : 0.5 * win(t, at('l0place', 4.6), at('l0place', 4.9)) + 0.5 * win(t, at('l0place', 5.2), at('l0place', 7.0));
    setGlueDots(sw, spread);
    l0Guide.forEach(p => {
      p.position.y = 80 * ease.inOut(win(t, at('l0cure', 0.2), at('l0cure', 1.0)));
      p.userData.m.opacity = 1 - win(t, at('l0cure', 0.6), at('l0cure', 1.1));
      p.visible = p.userData.m.opacity > 0.01;
    });
    l0Fix.forEach((p, i) => {
      const s = at('l0place', 7.2 + 0.4 * i);
      p.position.y = 80 * (1 - ease.out(win(t, s, s + 0.9)));
      p.userData.m.opacity = win(t, s, s + 0.3);
      p.visible = t >= s;
    });

    // the other quadrants, the cupolas, and L0 onto AMS-02
    others.forEach((o, k) => {
      const s = at('quads', 0.5 + k * 1.1);
      o.visible = t >= s;
      o.position.y = S3.top + 1.5 * drop((t - s) / 1.1);
    });
    const cu = ease.inOut(win(t, at('cupola', 0.3), at('cupola', 2.4)));
    cupUp.position.y = S3.top + 125 + 700 * (1 - cu);
    cupLow.position.y = S3.top - L0_T - 139 - 120 * (1 - ease.inOut(win(t, at('cupola', 1.6), at('cupola', 3.6))));
    const co = win(t, at('cupola', 0.3), at('cupola', 1.0));
    cupMat.opacity = 0.45 * co; cupEdge.opacity = 0.3 * co; cupUp.visible = cupLow.visible = co > 0.01;
    const lp0 = T.l0.at(t);
    l0.position.set(lp0[0], lp0[1], lp0[2]);
    const fa = win(t, at('ams', 0), at('ams', 4));
    scene.fog.near = 4200 + 5300 * fa; scene.fog.far = 9000 + 15000 * fa;

    const pi = phaseAt(t);
    if (pi !== curPhase) setPhase(pi);

    const camTgt = T.camTgt.at(t);
    applyCamera(T.camPos.at(t), camTgt);
    // keep the shadow-casting light over whatever the camera is looking at
    sun.position.set(camTgt[0] - 1100, 2600 + camTgt[1], 1500);
    sun.target.position.set(camTgt[0], camTgt[1] * 0.5, 0);
    sun.target.updateMatrixWorld();
  }

  /* ---------- playback ---------- */
  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  // timeline seconds run at 0.7x real time at the 1x setting
  const RATE = 0.7;
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
  $('btnPrev').addEventListener('click', () => {
    const i = phaseAt(t);
    jumpTo(t - PHASES[i].start > 0.6 ? i : i - 1, playing);
  });
  $('btnNext').addEventListener('click', () => { if (phaseAt(t) < PHASES.length - 1) jumpTo(phaseAt(t) + 1, playing); });
  btnSpeed.addEventListener('click', () => {
    speed = speed === 1 ? 2 : speed === 2 ? 0.5 : 1;
    btnSpeed.textContent = (speed === 0.5 ? '½' : speed) + '×';
  });
  stepEls.forEach((li, i) => li.querySelector('button').addEventListener('click', () => jumpTo(i, true)));
  document.querySelectorAll('.side__h[data-step]').forEach(h => {
    const go = () => jumpTo(+h.dataset.step, true);
    h.tabIndex = 0;
    h.setAttribute('role', 'button');
    h.addEventListener('click', go);
    h.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  scrub.addEventListener('pointerdown', () => { scrubbing = true; });
  window.addEventListener('pointerup', () => { scrubbing = false; });
  scrub.addEventListener('input', () => { t = +scrub.value; dirty = true; if (!playing) setPlaying(false); });

  function keys(e) {
    if (e.key === ' ' || e.key === 'k') { e.preventDefault(); btnPlay.click(); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); $('btnNext').click(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); $('btnPrev').click(); }
  }
  viewer.addEventListener('keydown', keys);

  // orbit: drag rotates around the scripted target, Ctrl + wheel (or pinch) zooms
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
    user.zoom = Math.max(0.45, Math.min(2.2, user.zoom * Math.exp(e.deltaY * 0.0015)));
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
      t += dt * speed * RATE;
      if (t >= TOTAL) { t = TOTAL; setPlaying(false); }
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
      timeEl.textContent = fmt(t / RATE) + ' / ' + fmt(TOTAL / RATE);
    }
    requestAnimationFrame(frame);
  }

  // ?step=N or ?t=seconds open paused at that point (add &play=1 to play from there);
  // otherwise play from the start once the viewer is in view
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
  // poster mode: render one exact frame on demand (used to capture the homepage preview video)
  if (root.classList.contains('is-poster')) window.__amsRender = nt => { t = nt; dirty = false; update(t); render(t); };
  requestAnimationFrame(frame);
})();
