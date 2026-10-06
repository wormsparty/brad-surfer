// Repères de couloirs : fine ligne claire sur l'eau, pointillés dans le sable.
// Bandes semi-transparentes qui épousent la surface (sable ou houle).
import * as THREE from 'three';
import { basicMat } from './ps1.js';
import { LANES, WATER_START, WATER_END } from './level.js';
import { waterHeight, beachHeight } from './world.js';

function surfaceY(x, z, t) {
  const sand = beachHeight(x);
  if (x <= WATER_START - 1 || x >= WATER_END + 1) return sand + 0.03;
  return Math.max(sand + 0.03, waterHeight(x, z, t) + 0.13);
}

class Strip {
  // len/segs en x, largeur en z ; paint(worldX, relX) -> [r, g, b, a]
  constructor(scene, len, width, segs, paint) {
    const geo = new THREE.PlaneGeometry(len, width, segs, 1);
    geo.rotateX(-Math.PI / 2);
    geo.translate(len / 2, 0, 0);
    geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 4), 4));
    this.baseX = Float32Array.from({ length: geo.attributes.position.count }, (_, i) => geo.attributes.position.getX(i));
    this.baseZ = Float32Array.from({ length: geo.attributes.position.count }, (_, i) => geo.attributes.position.getZ(i));
    this.mesh = new THREE.Mesh(geo, basicMat({
      vertexColors: true, transparent: true, depthWrite: false, fog: false,
    }));
    this.mesh.renderOrder = 2;
    this.len = len;
    this.paint = paint;
    scene.add(this.mesh);
  }

  update(x0, z, t) {
    this.mesh.position.set(x0, 0, z);
    const pos = this.mesh.geometry.attributes.position;
    const col = this.mesh.geometry.attributes.color;
    for (let i = 0; i < pos.count; i++) {
      const rx = this.baseX[i];
      const wx = x0 + rx;
      pos.setY(i, surfaceY(wx, z + this.baseZ[i], t));
      const [r, g, b, a] = this.paint(wx, rx / this.len);
      col.setXYZW(i, r, g, b, a);
    }
    pos.needsUpdate = true;
    col.needsUpdate = true;
  }
}

export class LaneGuides {
  constructor(scene) {
    const fade = (r) => Math.min(1, r * 6) * Math.min(1, (1 - r) * 3);
    const onSand = (wx) => wx < WATER_START - 0.5 || wx > WATER_END + 0.5;
    // séparateurs : pointillés tracés dans le sable, simple ligne claire semi-transparente sur l'eau
    const divider = (wx, r) => {
      if (!onSand(wx)) return [0.9, 1, 1, fade(r) * 0.45];
      const on = ((Math.round(wx * 2) % 4) + 4) % 4 < 2 ? 1 : 0;
      return [0.6, 0.45, 0.2, on * fade(r) * 0.4];
    };
    this.dividers = [-1, 1].map(() => new Strip(scene, 60, 0.12, 120, divider));
  }

  set visible(v) {
    for (const s of this.dividers) s.mesh.visible = v;
  }

  update(player, t) {
    const x0 = Math.floor(player.x / 0.5) * 0.5 - 12;
    this.dividers[0].update(x0, (LANES[0] + LANES[1]) / 2, t);
    this.dividers[1].update(x0, (LANES[1] + LANES[2]) / 2, t);
  }
}
