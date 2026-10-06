// Environnement : ciel, mer animée, les deux plages et le décor lointain.
import * as THREE from 'three';
import { mat, basicMat, lambertMat } from './ps1.js';
import * as M from './models.js';
import { WATER_START, WATER_END, FINISH_X } from './level.js';

export const HORIZON = 0xffc9a8;

const SKY_TOP = new THREE.Color(0x2f6bff);
const SKY_MID = new THREE.Color(0x7cc8ff);
const SKY_LOW = new THREE.Color(HORIZON);

const WATER_DEEP = new THREE.Color(0x1360b8);
const WATER_MID = new THREE.Color(0x1cb3d0);
const WATER_LIGHT = new THREE.Color(0x7ff0f0);
const WATER_FOAM = new THREE.Color(0xf4ffff);

export function waterHeight(x, z, t) {
  return (
    0.12 * Math.sin(0.35 * x + 1.6 * t) +
    0.08 * Math.sin(0.6 * z + 0.2 * x + 1.1 * t) +
    0.05 * Math.sin(1.3 * x - 0.8 * z + 2.3 * t) - 0.08
  );
}

// Distance au bord du sable sec : négative sur la plage, positive dans l'eau.
export function shoreDistance(x) {
  return Math.min(x - (WATER_START - 1), WATER_END + 1 - x);
}

// Profil des plages : plat, puis une pente franche qui plonge sous l'eau
// (une pente douce au niveau de l'eau provoquait du z-fighting).
export function beachHeight(x) {
  const d = shoreDistance(x);
  if (d <= 0) return 0.02;
  if (d < 2.5) return 0.02 - d * 0.25;
  return Math.max(-2, -0.605 - (d - 2.5) * 0.55);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.bobbers = [];
    this.foams = [];

    scene.fog = new THREE.Fog(HORIZON, 60, 320);
    scene.add(new THREE.HemisphereLight(0xcfe9ff, 0xffd2a0, 2.2));
    const sun = new THREE.DirectionalLight(0xfff1d6, 2.6);
    sun.position.set(-30, 60, 40);
    scene.add(sun);

    this.buildSky();
    this.buildSea();
    this.buildBeaches();
    this.buildScenery();
  }

  buildSky() {
    const geo = new THREE.SphereGeometry(600, 16, 10);
    const colors = [];
    const pos = geo.attributes.position;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const h = pos.getY(i) / 600;
      if (h < 0.05) c.copy(SKY_LOW);
      else if (h < 0.35) c.copy(SKY_LOW).lerp(SKY_MID, (h - 0.05) / 0.3);
      else c.copy(SKY_MID).lerp(SKY_TOP, Math.min(1, (h - 0.35) / 0.5));
      colors.push(c.r, c.g, c.b);
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    this.sky = new THREE.Mesh(geo, basicMat({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    this.sun = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.CircleGeometry(40, 10), basicMat({ color: 0xfff4c0, fog: false, depthWrite: false }));
    const halo = new THREE.Mesh(new THREE.CircleGeometry(60, 10), basicMat({ color: 0xffe08a, fog: false, depthWrite: false, transparent: true, opacity: 0.45 }));
    halo.position.z = -1;
    this.sun.add(halo, disc);
    this.sun.renderOrder = -9;
    disc.renderOrder = -8;
    halo.renderOrder = -9;
    this.scene.add(this.sun);

    this.clouds = new THREE.Group();
    const r = M.rng(42);
    for (let i = 0; i < 14; i++) {
      const cl = M.createCloud(i + 3);
      cl.position.set(-250 + i * 40 + r() * 20, 45 + r() * 40, -280 - r() * 60);
      this.clouds.add(cl);
    }
    this.scene.add(this.clouds);
  }

  buildSea() {
    // mer lointaine plate
    // (sans effet de tremblement : ses deux triangles sont immenses)
    const far = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1200), new THREE.MeshLambertMaterial({ color: WATER_DEEP }));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -1.0;
    this.farSea = far;
    this.scene.add(far);

    // grille animée près du joueur
    const W = 180;
    const D = 90;
    const geo = new THREE.PlaneGeometry(W, D, 72, 36);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, 0, -D / 2 + 25);
    this.cell = W / 72;
    const colors = new Float32Array(geo.attributes.position.count * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.baseXZ = Float32Array.from(geo.attributes.position.array);
    this.sea = new THREE.Mesh(geo, lambertMat({ vertexColors: true }));
    this.scene.add(this.sea);
  }

  buildBeaches() {
    // Plage en grille fine (pas de triangles géants qui tremblent avec l'effet PS1),
    // sable mouillé peint dans les couleurs des sommets plutôt qu'en calque superposé.
    const DRY = new THREE.Color(M.C.sand);
    const DAMP = new THREE.Color(M.C.sandDark);
    const WET = new THREE.Color(0xb88f4e);
    const makeBeach = (x0, x1, seg, seed) => {
      const geo = new THREE.PlaneGeometry(x1 - x0, 160, seg, 40);
      geo.rotateX(-Math.PI / 2);
      geo.translate((x0 + x1) / 2, 0, -40);
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const r = M.rng(seed);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        pos.setY(i, beachHeight(x));
        const d = shoreDistance(x);
        if (d > 0) c.copy(WET);
        else if (d > -4) c.copy(DAMP).lerp(WET, 1 + d / 4);
        else c.copy(DRY).lerp(DAMP, Math.max(0, 1 + (d + 4) / 3));
        c.multiplyScalar(0.96 + r() * 0.08);
        colors.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      return new THREE.Mesh(geo, lambertMat({ vertexColors: true }));
    };
    const ws = WATER_START;
    const we = WATER_END;
    this.scene.add(makeBeach(-120, ws + 7, 127, 11));
    this.scene.add(makeBeach(we - 7, we + 300, 205, 12));

    // écume qui lèche le rivage
    for (const [x, dir] of [[ws - 0.3, 1], [we + 0.3, -1]]) {
      const foam = new THREE.Group();
      const r = M.rng(Math.floor(x));
      for (let z = -100; z < 38; z += 2.2) {
        foam.add(M.box(0.4 + r() * 0.6, 0.08, 2.4, M.C.white, (r() - 0.5) * 0.6, 0, z));
      }
      foam.position.set(x, -0.02, 0);
      foam.userData.dir = dir;
      foam.userData.base = x;
      this.foams.push(foam);
      this.scene.add(foam);
    }
  }

  add(obj, x, y, z, ry = 0, s = 1) {
    obj.position.set(x, y, z);
    obj.rotation.y = ry;
    obj.scale.setScalar(s);
    this.scene.add(obj);
    return obj;
  }

  buildScenery() {
    const r = M.rng(1234);
    const ws = WATER_START;
    const we = WATER_END;

    // --- plage de départ
    this.add(M.createHut("BRAD'S SURF"), -2, 0, -10, 0, 1.3);
    this.add(M.createSign('ALOHA!', '#ff9ec4'), 8, 0, -5.5, 0, 0.9);
    for (let i = 0; i < 14; i++) {
      const x = -30 + i * 5.5 + r() * 3;
      if (x > ws - 4) break;
      this.add(M.createPalm(i + 1, 4.5 + r() * 2.5), x, 0, -8 - r() * 12, r() * 6);
    }
    const umbrellaColors = [0xff3d7f, 0x2ee8ff, 0xffe14a, 0x8a5bff];
    for (let i = 0; i < 5; i++) {
      const x = 4 + i * 7 + r() * 2;
      this.add(M.createUmbrella(umbrellaColors[i % 4]), x, 0, -5.5 - r() * 2, 0);
      this.add(M.createTowel(umbrellaColors[(i + 1) % 4]), x + 0.8, 0, -4.6 - r(), r() - 0.5);
    }
    for (let i = 0; i < 6; i++) {
      this.add(M.createTowel(umbrellaColors[i % 4], 0xffffff), -6 + i * 7 + r() * 3, 0, 5.6 + r() * 2, r() - 0.5);
    }
    this.add(M.createSandcastle(), 13, 0, 6.5, 0.4, 0.8);

    // --- l'autre rive
    this.add(M.createHut('TIKI BAR'), FINISH_X + 12, 0, -10, 0, 1.3);
    this.add(M.createFinishArch(), FINISH_X, 0, 0);
    for (let i = 0; i < 12; i++) {
      const x = we + 4 + i * 5.5 + r() * 3;
      this.add(M.createPalm(i + 50, 4.5 + r() * 2.5), x, 0, -8 - r() * 12, r() * 6);
    }
    for (let i = 0; i < 4; i++) {
      const x = we + 8 + i * 7 + r() * 2;
      this.add(M.createUmbrella(umbrellaColors[(i + 2) % 4]), x, 0, -5.5 - r() * 2, 0);
    }
    for (let i = 0; i < 5; i++) {
      this.add(M.createTowel(umbrellaColors[i % 4], 0xffffff), we + 5 + i * 6 + r() * 3, 0, 5.6 + r() * 2, r() - 0.5);
    }

    // --- au large
    for (let x = -100; x < 1100; x += 110 + r() * 60) {
      this.add(M.createIsland(Math.floor(x) + 7), x, -0.5, -170 - r() * 60, r() * 3, 1);
    }
    const lighthouse = new THREE.Group();
    for (let i = 0; i < 6; i++) lighthouse.add(M.box(2.2 - i * 0.12, 2, 2.2 - i * 0.12, i % 2 ? M.C.white : M.C.red, 0, 1 + i * 2, 0));
    lighthouse.add(M.box(1.8, 1.2, 1.8, 0xfff2a0, 0, 12.6, 0));
    lighthouse.add(M.box(2.2, 0.5, 2.2, M.C.black, 0, 13.4, 0));
    this.add(lighthouse, 470, 0, -75);
    this.add(M.createRock(77), 470, -1.2, -75, 0, 3.2);

    const sailColors = [0xff3d7f, 0xffe14a, 0x2ee8ff, 0xff7a1a];
    for (let x = 60; x < 900; x += 55 + r() * 50) {
      const b = this.add(M.createSailboat(sailColors[Math.floor(r() * 4)]), x, -0.2, -40 - r() * 45, r() * 0.6 - 0.3, 1);
      this.bobbers.push({ obj: b, phase: r() * 6, base: -0.2 });
    }
    for (let x = 70; x < 850; x += 30 + r() * 30) {
      this.add(M.createRock(Math.floor(x)), x, -0.8, -12 - r() * 20, r() * 6, 0.6 + r() * 0.8);
    }
  }

  update(t, camX) {
    this.sky.position.x = camX;
    this.sun.position.set(camX - 60, 90, -520);
    this.clouds.position.x = camX * 0.9;
    this.farSea.position.x = camX;

    // la grille avance par pas d'une cellule pour éviter que les sommets « glissent »
    const offset = Math.round(camX / this.cell) * this.cell;
    this.sea.position.x = offset;
    const pos = this.sea.geometry.attributes.position;
    const col = this.sea.geometry.attributes.color;
    const base = this.baseXZ;
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3] + offset;
      const z = base[i * 3 + 2];
      // sous le sable sec, on enfonce la mer ; près du bord, les vagues s'aplatissent
      const d = shoreDistance(x);
      const h = d < -1 ? -1.0 : waterHeight(x, z, t) * Math.min(1, Math.max(0.35, d / 5));
      pos.setY(i, h);
      const depthT = Math.min(1, Math.max(0, (-z - 5) / 55));
      c.copy(WATER_MID).lerp(WATER_DEEP, depthT);
      const crest = (h + 0.1) / 0.3;
      if (crest > 0.75) c.lerp(WATER_FOAM, (crest - 0.75) * 1.6);
      else if (crest > 0.45) c.lerp(WATER_LIGHT, (crest - 0.45));
      col.setXYZ(i, c.r, c.g, c.b);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;

    for (const b of this.bobbers) {
      b.obj.position.y = b.base + Math.sin(t * 1.3 + b.phase) * 0.15;
      b.obj.rotation.z = Math.sin(t * 1.1 + b.phase) * 0.05;
    }
    for (const f of this.foams) {
      f.position.x = f.userData.base + Math.sin(t * 0.9) * 0.5 * f.userData.dir;
    }
  }
}
