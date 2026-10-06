// Modèles low-poly construits à la main à partir de primitives.
import * as THREE from 'three';
import { mat, basicMat, lambertMat } from './ps1.js';

export const C = {
  skin: 0xe8a06a,
  skinLight: 0xf2b784,
  hair: 0xffd83a,
  hairDark: 0xe8a81c,
  shorts: 0xff3d7f,
  shortsStripe: 0x2ee8ff,
  board: 0xff7a1a,
  boardStripe: 0xffffff,
  boardRail: 0x1e3cff,
  glasses: 0x101018,
  sand: 0xf2d58c,
  sandDark: 0xd9b46a,
  rock: 0x7a6e66,
  rockDark: 0x5a504c,
  wood: 0x8a5a2b,
  woodDark: 0x5e3a1a,
  palmLeaf: 0x2fae3c,
  palmLeafDark: 0x1f8a30,
  white: 0xffffff,
  red: 0xff2a2a,
  yellow: 0xffe14a,
  black: 0x111111,
};

export function box(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color));
  m.position.set(x, y, z);
  return m;
}

function cone(r, h, seg, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
}

function cyl(rt, rb, h, seg, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat(color));
  m.position.set(x, y, z);
  return m;
}

// Petit RNG déterministe pour que le décor soit identique à chaque partie.
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function jitterGeometry(geo, amount, rand) {
  const pos = geo.attributes.position;
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!seen.has(key)) seen.set(key, [(rand() - 0.5) * amount, (rand() - 0.5) * amount, (rand() - 0.5) * amount]);
    const [dx, dy, dz] = seen.get(key);
    pos.setXYZ(i, pos.getX(i) + dx, pos.getY(i) + dy, pos.getZ(i) + dz);
  }
  geo.computeVertexNormals();
  return geo;
}

// Texte peint dans une texture, filtrage « nearest » pour garder les gros pixels.
export function textTexture(text, { w = 256, h = 64, bg = '#ffe14a', fg = '#111', font = 34, checker = false } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  if (checker) {
    const s = h / 4;
    for (let x = 0; x < w; x += s) {
      for (let y = 0; y < h; y += s) {
        if (((x + y) / s) % 2 === 0) {
          g.fillStyle = '#111';
          g.fillRect(x, y, s, s);
        }
      }
    }
    g.fillStyle = bg;
    g.fillRect(s * 2, s * 0.6, w - s * 4, h - s * 1.2);
  }
  g.fillStyle = fg;
  g.font = `bold ${font}px "Press Start 2P", monospace`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

// ---------------------------------------------------------------- Surfeur

export function createSurfboard() {
  const s = new THREE.Shape();
  const pts = [
    [1.1, 0], [0.85, 0.16], [0.45, 0.26], [0, 0.29], [-0.5, 0.26], [-0.88, 0.17], [-1.0, 0.08],
    [-1.0, -0.08], [-0.88, -0.17], [-0.5, -0.26], [0, -0.29], [0.45, -0.26], [0.85, -0.16],
  ];
  s.moveTo(pts[0][0], pts[0][1]);
  for (const [x, y] of pts.slice(1)) s.lineTo(x, y);
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat(C.board)));
  // bande centrale + liserés
  g.add(box(1.7, 0.02, 0.1, C.boardStripe, 0.02, 0.09, 0));
  g.add(box(1.2, 0.02, 0.04, C.boardRail, 0.02, 0.09, 0.12));
  g.add(box(1.2, 0.02, 0.04, C.boardRail, 0.02, 0.09, -0.12));
  const fin = cone(0.12, 0.25, 3, C.boardRail, -0.8, -0.1, 0);
  fin.rotation.x = Math.PI;
  fin.scale.z = 0.3;
  g.add(fin);
  return g;
}

export function createSurfer() {
  const root = new THREE.Group();
  const spin = new THREE.Group();
  spin.position.y = 0.9;
  root.add(spin);
  const rig = new THREE.Group();
  rig.position.y = -0.9;
  spin.add(rig);

  const board = createSurfboard();
  rig.add(board);

  const body = new THREE.Group();
  rig.add(body);

  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);
  hips.add(box(0.3, 0.22, 0.44, C.shorts, 0, 0.02, 0));
  hips.add(box(0.31, 0.05, 0.45, C.shortsStripe, 0, 0.1, 0));

  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(box(0.26, 0.5, 0.42, C.skin, 0, 0.36, 0));
  // pectoraux bombés (il est fier de lui)
  torso.add(box(0.08, 0.16, 0.18, C.skinLight, 0.15, 0.5, 0.1));
  torso.add(box(0.08, 0.16, 0.18, C.skinLight, 0.15, 0.5, -0.1));
  torso.add(box(0.06, 0.2, 0.2, C.skinLight, 0.13, 0.26, 0));
  // épaules larges
  torso.add(box(0.28, 0.14, 0.62, C.skin, 0, 0.6, 0));
  // collier de coquillages
  for (let i = -2; i <= 2; i++) torso.add(box(0.05, 0.05, 0.05, i % 2 ? C.white : 0xff9ec4, 0.15, 0.62 - Math.abs(i) * 0.02, i * 0.07));

  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);
  head.add(box(0.12, 0.1, 0.14, C.skin, 0, -0.03, 0)); // cou
  head.add(box(0.3, 0.32, 0.28, C.skin, 0.02, 0.17, 0));
  head.add(box(0.12, 0.1, 0.24, C.skin, 0.1, 0.02, 0)); // mâchoire carrée
  head.add(box(0.06, 0.07, 0.05, C.skinLight, 0.19, 0.15, 0)); // nez
  head.add(box(0.04, 0.08, 0.3, C.glasses, 0.18, 0.22, 0)); // lunettes
  head.add(box(0.02, 0.03, 0.12, 0x6af0ff, 0.2, 0.235, 0.075));
  head.add(box(0.02, 0.025, 0.14, C.white, 0.17, 0.05, 0.02)); // sourire en coin
  head.add(box(0.02, 0.03, 0.03, C.white, 0.17, 0.065, 0.09));
  // cheveux blonds en pics
  head.add(box(0.3, 0.1, 0.3, C.hair, -0.01, 0.35, 0));
  head.add(box(0.12, 0.25, 0.3, C.hair, -0.1, 0.22, 0));
  const spikes = [
    [0.14, 0.42, 0, -0.9, 0], [0.04, 0.47, 0.08, -0.6, 0.3], [0.04, 0.47, -0.08, -0.6, -0.3],
    [-0.08, 0.45, 0, 0.2, 0], [-0.14, 0.4, 0.1, 0.6, 0.5], [-0.14, 0.4, -0.1, 0.6, -0.5],
    [-0.18, 0.3, 0, 1.2, 0],
  ];
  for (const [x, y, z, rz, rx] of spikes) {
    const sp = cone(0.08, 0.26, 4, (x * 100) % 2 ? C.hairDark : C.hair, x, y, z);
    sp.rotation.set(rx, 0, rz);
    head.add(sp);
  }
  // la mèche de devant, son orgueil
  const quiff = cone(0.1, 0.34, 4, C.hair, 0.2, 0.42, 0);
  quiff.rotation.z = -1.25;
  head.add(quiff);

  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, 0.6, side * 0.33);
    torso.add(shoulder);
    shoulder.add(box(0.15, 0.32, 0.15, C.skin, 0, -0.16, 0));
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    shoulder.add(elbow);
    elbow.add(box(0.13, 0.3, 0.13, C.skin, 0, -0.15, 0));
    elbow.add(box(0.14, 0.11, 0.12, C.skinLight, 0, -0.34, 0));
    return { shoulder, elbow };
  }

  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0, 0, side * 0.12);
    hips.add(hip);
    hip.add(box(0.2, 0.42, 0.19, C.shorts, 0, -0.2, 0));
    hip.add(box(0.21, 0.05, 0.2, C.shortsStripe, 0, -0.38, 0));
    const knee = new THREE.Group();
    knee.position.y = -0.42;
    hip.add(knee);
    knee.add(box(0.14, 0.44, 0.14, C.skin, 0, -0.22, 0));
    knee.add(box(0.26, 0.08, 0.14, C.skinLight, 0.05, -0.47, 0));
    return { hip, knee };
  }

  // médaille d'or (cachée), gagnée en ramassant tous les coquillages
  const medal = new THREE.Group();
  medal.visible = false;
  for (const side of [-1, 1]) {
    const strap = box(0.03, 0.34, 0.06, side < 0 ? C.red : 0x2e6bff, 0.15, 0.48, side * 0.1);
    strap.rotation.x = side * 0.35;
    medal.add(strap);
  }
  const disc = cyl(0.12, 0.12, 0.04, 8, 0xffd23a, 0.17, 0.26, 0);
  disc.rotation.z = Math.PI / 2;
  medal.add(disc);
  medal.add(box(0.02, 0.1, 0.1, 0xfff4a0, 0.2, 0.27, 0));
  torso.add(medal);

  return {
    root, spin, rig, board, body, hips, torso, head, medal,
    armL: makeArm(-1), armR: makeArm(1),
    legL: makeLeg(-1), legR: makeLeg(1),
  };
}

// ---------------------------------------------------------------- Obstacles

export function createBuoy() {
  const g = new THREE.Group();
  g.add(cyl(0.38, 0.45, 0.45, 8, C.red, 0, 0.15, 0));
  g.add(cyl(0.3, 0.38, 0.25, 8, C.white, 0, 0.5, 0));
  g.add(cone(0.3, 0.35, 8, C.red, 0, 0.8, 0));
  g.add(box(0.06, 0.25, 0.06, C.yellow, 0, 1.05, 0));
  return g;
}

export function createFin() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.55, 0);
  s.lineTo(0.35, 0);
  s.lineTo(0.05, 0.2);
  s.lineTo(-0.25, 0.95);
  s.lineTo(-0.35, 0.5);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false });
  geo.translate(0, 0, -0.06);
  g.add(new THREE.Mesh(geo, mat(0x5d6f84)));
  g.add(box(1.2, 0.1, 0.5, 0x3d4f64, -0.1, -0.02, 0));
  return g;
}

export function createRock(seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const geo = jitterGeometry(new THREE.DodecahedronGeometry(1.1, 0), 0.5, r);
  const m = new THREE.Mesh(geo, mat(C.rock));
  m.scale.set(1.1, 1.5, 1.0);
  m.position.y = 1.0;
  m.rotation.y = r() * 3;
  g.add(m);
  const m2 = new THREE.Mesh(jitterGeometry(new THREE.DodecahedronGeometry(0.6, 0), 0.3, r), mat(C.rockDark));
  m2.position.set(0.7, 0.3, 0.5);
  g.add(m2);
  // un peu de mousse et une mouette perchée? non : des algues.
  g.add(box(0.4, 0.1, 0.3, 0x3f8f3a, -0.2, 2.35, 0.1));
  return g;
}

export function createLog() {
  const g = new THREE.Group();
  const trunk = cyl(0.36, 0.36, 8.6, 7, C.wood);
  trunk.rotation.x = Math.PI / 2;
  trunk.position.y = 0.3;
  g.add(trunk);
  for (const z of [-4.3, 4.3]) {
    const end = cyl(0.3, 0.3, 0.04, 7, 0xd8a868, 0, 0.3, z);
    end.rotation.x = Math.PI / 2;
    g.add(end);
  }
  const branch = cyl(0.08, 0.12, 0.9, 5, C.woodDark, 0.2, 0.7, -1.5);
  branch.rotation.z = -0.6;
  g.add(branch);
  return g;
}

export function createGull() {
  const g = new THREE.Group();
  const body = box(0.6, 0.24, 0.24, C.white);
  g.add(body);
  g.add(box(0.2, 0.2, 0.2, C.white, 0.35, 0.08, 0));
  const beak = cone(0.06, 0.2, 4, 0xffa21a, 0.53, 0.06, 0);
  beak.rotation.z = -Math.PI / 2;
  g.add(beak);
  g.add(box(0.04, 0.05, 0.22, C.black, 0.4, 0.12, 0));
  g.add(box(0.2, 0.06, 0.2, 0x9aa4b0, -0.38, 0.04, 0));
  const wings = [];
  for (const side of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(0, 0.08, side * 0.12);
    const wing = box(0.36, 0.04, 0.7, 0xd8dde4, 0, 0, side * 0.35);
    pivot.add(wing);
    pivot.add(box(0.2, 0.05, 0.25, 0x333a44, -0.05, 0.01, side * 0.62));
    g.add(pivot);
    wings.push({ pivot, side });
  }
  g.userData.wings = wings;
  const shadow = groundShadow(0.6, 0.9);
  g.add(shadow);
  g.userData.shadow = shadow;
  return g;
}

// Ponton qui s'avance dans la mer : il faut passer dessous en se baissant.
export function createPier() {
  // Le tablier s'arrête avant les couloirs (sinon il cacherait Brad vu d'en haut) ;
  // seule une poutre rayée jaune/noir, ornée de fanions, traverse les couloirs.
  const g = new THREE.Group();
  for (let z = -40, i = 0; z <= -4.6; z += 0.9, i++) g.add(box(1.6, 0.12, 0.8, i % 2 ? C.wood : 0x9a6a38, 0, 2.3, z));
  for (const z of [-40, -32, -24, -16, -8, -4.8]) {
    for (const x of [-0.7, 0.7]) g.add(box(0.22, 5, 0.22, C.woodDark, x, -0.2, z));
  }
  g.add(box(1.6, 0.6, 0.12, C.wood, 0, 2.65, -4.8));
  for (let z = -4.8, i = 0; z < 4.8; z += 0.6, i++) g.add(box(0.32, 0.32, 0.6, i % 2 ? C.black : C.yellow, 0, 2.05, z + 0.3));
  const colors = [C.red, 0x2ee8ff, 0xff3d7f, 0xffffff];
  for (let z = -4.2, i = 0; z <= 4.2; z += 0.7, i++) {
    const p = cone(0.16, 0.3, 3, colors[i % 4], 0, 1.8, z);
    p.rotation.x = Math.PI;
    p.scale.x = 0.2;
    g.add(p);
  }
  const shadow = groundShadow(0.7, 9.6, 0.22);
  shadow.position.x = 0.5;
  g.add(shadow);
  return g;
}

export function createWave() {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-2.6, -0.2);
  s.lineTo(-1.2, 0.25);
  s.lineTo(-0.2, 0.75);
  s.lineTo(0.6, 1.25);
  s.lineTo(1.1, 1.5);
  s.lineTo(1.5, 1.35);
  s.lineTo(1.35, 0.9);
  s.lineTo(1.7, -0.2);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 2.3, bevelEnabled: false });
  geo.translate(0, 0, -1.15);
  g.add(new THREE.Mesh(geo, mat(0x27c7d8)));
  // crête d'écume
  const r = rng(7);
  for (let z = -1.1; z <= 1.1; z += 0.35) {
    const f = box(0.35, 0.22, 0.35, C.white, 1.1 + r() * 0.2, 1.5 + r() * 0.1, z);
    f.rotation.y = r();
    g.add(f);
  }
  g.add(box(1.2, 0.08, 2.3, 0x7ff0f5, -0.6, 0.55, 0));
  return g;
}

export function createSandcastle() {
  const g = new THREE.Group();
  g.add(box(1.2, 0.4, 1.2, C.sandDark, 0, 0.2, 0));
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    g.add(cyl(0.18, 0.2, 0.55, 6, C.sand, x, 0.5, z));
    g.add(cone(0.2, 0.2, 6, C.sandDark, x, 0.87, z));
  }
  g.add(cyl(0.25, 0.3, 0.7, 6, C.sand, 0, 0.6, 0));
  g.add(box(0.03, 0.4, 0.03, C.black, 0, 1.15, 0));
  g.add(box(0.2, 0.12, 0.02, C.red, 0.1, 1.28, 0));
  return g;
}

export function createCrab() {
  const g = new THREE.Group();
  g.add(box(0.6, 0.25, 0.45, 0xff4422, 0, 0.25, 0));
  for (const z of [-0.12, 0.12]) {
    g.add(box(0.04, 0.16, 0.04, 0xff4422, 0.15, 0.45, z));
    g.add(box(0.07, 0.07, 0.07, C.black, 0.15, 0.55, z));
  }
  for (const side of [-1, 1]) {
    g.add(box(0.26, 0.18, 0.12, 0xff6a3a, 0.35, 0.32, side * 0.32));
    for (let i = 0; i < 3; i++) g.add(box(0.05, 0.05, 0.3, 0xcc3311, -0.15 + i * 0.12, 0.12, side * 0.3));
  }
  return g;
}

// Filet de volley sur la plage : on se baisse.
// Ombre plate posée au sol : en vue plongeante, c'est elle qui montre qu'un obstacle est en l'air.
export function groundShadow(w, d, y = 0.08) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.01, d),
    basicMat({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }),
  );
  m.position.y = y;
  return m;
}

// Filet de volley sur la plage : on se baisse. Bien haut, on voit le passage dessous.
export function createNet() {
  const g = new THREE.Group();
  const bottom = 1.72;
  const top = 2.75;
  const h = top - bottom;
  for (const z of [-4.4, 4.4]) g.add(cyl(0.08, 0.08, 3.2, 6, C.white, 0, 1.6, z));
  g.add(box(0.06, 0.14, 8.8, C.white, 0, top, 0));
  const net = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, h, 8.8),
    basicMat({ color: 0x1a1a2a, transparent: true, opacity: 0.55 }),
  );
  net.position.y = bottom + h / 2;
  g.add(net);
  for (let z = -4.2; z <= 4.2; z += 0.6) g.add(box(0.04, h, 0.03, 0xdddddd, 0, bottom + h / 2, z));
  g.add(box(0.06, 0.06, 8.8, 0xdddddd, 0, bottom, 0));
  const shadow = groundShadow(0.6, 8.8);
  shadow.position.x = 0.5;
  g.add(shadow);
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.22, 0), mat(0xfff2b0));
  ball.position.set(0.4, 0.22, 3.6);
  g.add(ball);
  return g;
}

// ---------------------------------------------------------------- Objets

// Coquille Saint-Jacques très low-poly : éventail bombé de 6 facettes à côtes alternées,
// une « oreille » à la charnière. Couleurs par sommet (crème au centre, corail au bord).
let shellMaterial;
export function createShell() {
  const N = 6; // pas angulaires (côtes alternées)
  const R = 0.42;
  const rings = [0, 0.55, 1];
  const a0 = 0.32;
  const a1 = Math.PI - 0.32;
  const cream = new THREE.Color(0xfff1dc);
  const coral = new THREE.Color(0xff7a96);
  const pos = [];
  const col = [];
  const vtx = (i, k) => {
    const a = a0 + ((a1 - a0) * i) / N;
    const rib = i % 2;
    const r = rings[k] * R * (k === rings.length - 1 && rib ? 1.1 : 1);
    const z = 0.15 * (1 - rings[k] * rings[k]) + (rib ? 0.06 * rings[k] : 0);
    const c = cream.clone().lerp(coral, rings[k] * 0.85).multiplyScalar(rib ? 1 : 0.86);
    return [Math.cos(a) * r, Math.sin(a) * r - 0.18, z, c];
  };
  const tri = (...v) => {
    for (const [x, y, z, c] of v) {
      pos.push(x, y, z);
      col.push(c.r, c.g, c.b);
    }
  };
  for (let i = 0; i < N; i++) {
    for (let k = 0; k < rings.length - 1; k++) {
      const p00 = vtx(i, k);
      const p10 = vtx(i + 1, k);
      const p01 = vtx(i, k + 1);
      const p11 = vtx(i + 1, k + 1);
      if (k > 0) tri(p00, p10, p11);
      tri(p00, p11, p01);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals();
  shellMaterial ??= lambertMat({ vertexColors: true, side: THREE.DoubleSide });

  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, shellMaterial));
  g.add(box(0.26, 0.1, 0.05, 0xffc2cf, 0, -0.2, 0.04)); // l'oreille de la charnière
  return g;
}

// Canette de boisson énergisante : le boost. Trapue, col rétréci, couvercle avec la languette,
// gros éclair jaune. Elle est inclinée vers la caméra pour qu'on voie toujours le dessus
// (c'est lui qui la distingue d'un aérosol) ; seul le groupe interne `spin` tourne.
export function createBoostCan() {
  const g = new THREE.Group();
  g.rotation.x = 0.4;
  g.scale.setScalar(1.3);
  const spin = new THREE.Group();
  g.add(spin);
  const alu = 0x9ea8b8;
  spin.add(cyl(0.32, 0.32, 0.6, 10, 0xff2f7a));
  spin.add(cyl(0.25, 0.32, 0.09, 10, alu, 0, 0.345, 0)); // col
  spin.add(cyl(0.25, 0.25, 0.03, 10, 0x7c8798, 0, 0.4, 0)); // couvercle
  spin.add(cyl(0.32, 0.27, 0.06, 10, alu, 0, -0.33, 0)); // fond
  const tab = box(0.2, 0.025, 0.11, 0xc8d0dc, 0.03, 0.425, 0); // languette
  spin.add(tab);
  spin.add(box(0.09, 0.03, 0.07, 0x1a1e26, -0.1, 0.42, 0)); // ouverture

  const bolt = new THREE.Shape();
  [[0.06, 0.3], [-0.14, 0.0], [0.0, 0.0], [-0.08, -0.3], [0.14, 0.04], [0.0, 0.04]].forEach(([x, y], i) => (i ? bolt.lineTo(x, y) : bolt.moveTo(x, y)));
  bolt.closePath();
  const boltGeo = new THREE.ExtrudeGeometry(bolt, { depth: 0.06, bevelEnabled: false });
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(boltGeo, mat(C.yellow));
    m.position.set(0, 0, side * 0.29);
    m.scale.set(1.2, 0.95, 1);
    if (side < 0) m.rotation.y = Math.PI;
    spin.add(m);
  }

  const sparkles = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const sp = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), basicMat({ color: i % 2 ? 0xfff4a0 : C.white }));
    sp.position.set(Math.cos(a) * 0.62, Math.sin(a * 2) * 0.2, Math.sin(a) * 0.62);
    sparkles.add(sp);
  }
  g.add(sparkles);
  g.userData.sparkles = sparkles;
  g.userData.spin = spin;
  return g;
}

export function createCheckpointFlag() {
  const g = new THREE.Group();
  // bouée jaune + drapeau côté large, ligne de flotteurs à travers les couloirs
  const buoy = new THREE.Group();
  buoy.add(cyl(0.5, 0.6, 0.6, 8, C.yellow, 0, 0.2, 0));
  buoy.add(box(0.08, 2.6, 0.08, C.white, 0, 1.6, 0));
  const flag = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.8, 0.04),
    basicMat({ map: textTexture('CHECK', { w: 128, h: 64, font: 20, bg: '#ff3d7f', fg: '#fff' }) }),
  );
  flag.position.set(0.72, 2.45, 0);
  buoy.add(flag);
  buoy.position.z = -4.7;
  g.add(buoy);
  const near = buoy.clone();
  near.position.z = 4.7;
  g.add(near);
  for (let z = -4.2; z <= 4.2; z += 0.7) {
    const f = new THREE.Mesh(new THREE.IcosahedronGeometry(0.14, 0), mat(Math.round(z / 0.7) % 2 ? C.yellow : 0xff3d7f));
    f.position.set(0, 0.05, z);
    g.add(f);
  }
  g.userData.flags = [flag];
  return g;
}

// ---------------------------------------------------------------- Décor

export function createPalm(seed = 1, height = 5) {
  const r = rng(seed);
  const g = new THREE.Group();
  const segs = 6;
  const lean = (r() - 0.5) * 0.5 + 0.25;
  let x = 0;
  let y = 0;
  for (let i = 0; i < segs; i++) {
    const h = height / segs;
    const t = cyl(0.16 - i * 0.012, 0.2 - i * 0.012, h * 1.05, 5, i % 2 ? C.wood : 0x9c6a35, x, y + h / 2, 0);
    t.rotation.z = -lean * (i / segs);
    g.add(t);
    x += Math.sin(lean * (i / segs)) * h;
    y += Math.cos(lean * (i / segs)) * h;
  }
  const top = new THREE.Group();
  top.position.set(x, y, 0);
  g.add(top);
  for (let i = 0; i < 7; i++) {
    const leaf = new THREE.Group();
    leaf.rotation.y = (i / 7) * Math.PI * 2 + r() * 0.3;
    const l1 = box(1.3, 0.05, 0.42, i % 2 ? C.palmLeaf : C.palmLeafDark, 0.65, 0, 0);
    l1.rotation.z = 0.25;
    const l2 = box(1.2, 0.05, 0.3, i % 2 ? C.palmLeaf : C.palmLeafDark, 1.75, -0.35, 0);
    l2.rotation.z = -0.4;
    leaf.add(l1, l2);
    top.add(leaf);
  }
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 0), mat(0x5a3a1a));
    c.position.set(Math.cos(i * 2.1) * 0.2, -0.2, Math.sin(i * 2.1) * 0.2);
    top.add(c);
  }
  return g;
}

export function createUmbrella(color = 0xff3d7f) {
  const g = new THREE.Group();
  const pole = cyl(0.04, 0.04, 2.3, 4, C.white, 0, 1.0, 0);
  pole.rotation.z = 0.15;
  g.add(pole);
  const top = cone(1.3, 0.55, 8, color, 0.17, 2.15, 0);
  top.rotation.z = 0.15;
  g.add(top);
  const top2 = cone(1.32, 0.56, 8, C.white, 0.17, 2.14, 0);
  top2.rotation.set(0, Math.PI / 8, 0.15);
  top2.scale.set(1, 1, 0.35);
  g.add(top2);
  return g;
}

export function createTowel(color = 0x2ee8ff, stripe = 0xffffff) {
  const g = new THREE.Group();
  // assez épaisse et surélevée pour ne pas se disputer les pixels avec le sable
  g.add(box(1.6, 0.04, 0.8, color, 0, 0.06, 0));
  g.add(box(1.6, 0.02, 0.15, stripe, 0, 0.09, 0));
  return g;
}

export function createHut(signText) {
  const g = new THREE.Group();
  for (const [x, z] of [[-1.6, -1.2], [1.6, -1.2], [-1.6, 1.2], [1.6, 1.2]]) g.add(cyl(0.12, 0.14, 2.6, 5, C.wood, x, 1.3, z));
  g.add(box(3.6, 1.1, 0.15, 0xc8873a, 0, 1.0, 1.2));
  g.add(box(3.8, 0.15, 0.5, C.woodDark, 0, 1.6, 1.3));
  const roof = cone(3.0, 1.6, 4, 0xe2c262, 0, 3.3, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.8;
  g.add(roof);
  if (signText) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(3.0, 0.55, 0.08),
      basicMat({ map: textTexture(signText, { w: 256, h: 48, font: 18, bg: '#2ee8ff', fg: '#111' }) }),
    );
    // sur le devant du comptoir : rien ne la masque
    sign.position.set(0, 1.05, 1.3);
    g.add(sign);
  }
  // planches de surf appuyées
  const b1 = createSurfboard();
  b1.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.15);
  b1.position.set(2.0, 1.0, 1.5);
  g.add(b1);
  return g;
}

export function createSailboat(color = 0xff3d7f) {
  const g = new THREE.Group();
  g.add(box(3, 0.5, 1, C.white, 0, 0.1, 0));
  g.add(box(2.4, 0.2, 1.05, color, 0, 0.25, 0));
  g.add(box(0.1, 4.5, 0.1, C.woodDark, 0, 2.4, 0));
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.lineTo(1.6, 0);
  s.lineTo(0, 3.8);
  s.closePath();
  const sail = new THREE.Mesh(new THREE.ShapeGeometry(s), mat(0xfff6e0, { side: THREE.DoubleSide }));
  sail.position.set(0.1, 0.6, 0);
  g.add(sail);
  const s2 = sail.clone();
  s2.scale.x = -0.6;
  s2.position.x = -0.1;
  s2.material = mat(color, { side: THREE.DoubleSide });
  g.add(s2);
  return g;
}

export function createCloud(seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const n = 3 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(3 + r() * 3, 0), basicMat({ color: i % 2 ? 0xffffff : 0xffeef4, fog: false }));
    c.position.set(i * 4 - n * 2, r() * 2, r() * 2);
    c.scale.y = 0.55;
    g.add(c);
  }
  return g;
}

export function createIsland(seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const geo = jitterGeometry(new THREE.ConeGeometry(14 + r() * 10, 10 + r() * 14, 7, 2), 2.5, r);
  const m = new THREE.Mesh(geo, mat(0x2f9a5a));
  m.position.y = 4;
  m.scale.z = 0.6;
  g.add(m);
  const sand = cyl(20, 24, 1.5, 9, C.sand, 0, 0, 0);
  sand.scale.z = 0.5;
  g.add(sand);
  return g;
}

export function createFinishArch() {
  const g = new THREE.Group();
  for (const z of [-4.8, 4.8]) {
    g.add(cyl(0.18, 0.22, 4.6, 6, 0xff3d7f, 0, 2.3, z));
    g.add(cone(0.35, 0.6, 6, C.yellow, 0, 4.9, z));
  }
  // poutre en damier au-dessus des couloirs
  for (let i = 0; i < 12; i++) {
    g.add(box(0.5, 0.4, 0.8, i % 2 ? C.black : C.white, 0, 4.2, -4.4 + i * 0.8));
    g.add(box(0.5, 0.4, 0.8, i % 2 ? C.white : C.black, 0, 3.8, -4.4 + i * 0.8));
  }
  // grand panneau face caméra, derrière l'arche
  const sign = new THREE.Mesh(
    new THREE.BoxGeometry(7, 1.4, 0.15),
    basicMat({ map: textTexture('FINISH', { w: 512, h: 96, font: 40, checker: true }) }),
  );
  sign.position.set(1.5, 5.4, -4.8);
  g.add(sign);
  return g;
}

export function createSign(text, color = '#ffe14a') {
  const g = new THREE.Group();
  g.add(box(0.12, 2.2, 0.12, C.wood, -0.9, 1.1, 0));
  g.add(box(0.12, 2.2, 0.12, C.wood, 0.9, 1.1, 0));
  const s = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 0.9, 0.1),
    basicMat({ map: textTexture(text, { w: 256, h: 88, font: 22, bg: color, fg: '#111' }) }),
  );
  s.position.y = 2.0;
  g.add(s);
  return g;
}

// ---------------------------------------------------------------- Tutoriel 3D
// Une ou deux touches de clavier en volume qui s'enfoncent en rythme.

const ARROW_GLYPHS = {
  up: [[0, -7], [7, 4], [-7, 4]], down: [[0, 7], [7, -4], [-7, -4]],
  right: [[7, 0], [-4, -7], [-4, 7]], left: [[-7, 0], [4, -7], [4, 7]],
};

function keyLabelTexture(label) {
  const arrow = ARROW_GLYPHS[label];
  const c = document.createElement('canvas');
  c.width = arrow ? 32 : 64;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#ffe14a';
  g.fillRect(0, 0, c.width, 32);
  g.fillStyle = '#111';
  if (arrow) {
    g.beginPath();
    for (const [dx, dy] of arrow) g.lineTo(16 + dx, 16 + dy);
    g.fill();
  } else {
    g.font = '8px "Press Start 2P", monospace';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(label, 32, 17);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// Touche : un socle sombre et un capuchon jaune (étiquette sur la face avant) qui s'enfonce.
function createKey(label) {
  const w = ARROW_GLYPHS[label] ? 1.1 : 2.2;
  const g = new THREE.Group();
  g.add(box(w + 0.2, 1.3, 0.3, 0x5a4a10, 0, 0, -0.35));
  const yellow = mat(C.yellow);
  const cap = new THREE.Mesh(
    new THREE.BoxGeometry(w, 1.1, 0.5),
    [yellow, yellow, mat(0xfff2a0), mat(0xc8a020), basicMat({ map: keyLabelTexture(label) }), yellow],
  );
  g.add(cap);
  g.userData.press = (amount) => { cap.position.z = -amount * 0.3; };
  return g;
}

// kind : 'space' (sauter) | 'shift' (se baisser) | 'updown' (couloir).
// touch : sur mobile, les touches portent les libellés des boutons à l'écran.
export function createTutorialCue(kind, touch = false) {
  const g = new THREE.Group();
  const labels = {
    space: [touch ? 'JUMP' : 'SPACE'], shift: [touch ? 'DUCK' : 'SHIFT'], updown: ['up', 'down'],
  }[kind];
  const keys = labels.map(createKey);
  keys.forEach((k, i) => {
    k.position.x = (i - (keys.length - 1) / 2) * 1.35;
    g.add(k);
  });
  g.scale.setScalar(1.5);

  g.userData.animate = (t) => {
    const p = (t % 1.6) / 1.6;
    if (kind === 'space') keys[0].userData.press(p < 0.15 || (p > 0.5 && p < 0.65) ? 1 : 0);
    else if (kind === 'shift') keys[0].userData.press(p < 0.7 ? 1 : 0); // maintenue
    else {
      keys[0].userData.press(p < 0.25 ? 1 : 0);
      keys[1].userData.press(p > 0.5 && p < 0.75 ? 1 : 0);
    }
  };
  return g;
}
