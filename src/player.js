import * as THREE from 'three';
import { createSurfer } from './models.js';
import { basicMat } from './ps1.js';
import {
  LANES, WATER_START, WATER_END, FINISH_X, GRAVITY, JUMP_VY, WAVE_VY, BOOST_MULT, speedAt,
} from './level.js';

const STAND_H = 1.8;
const DUCK_H = 0.95;

const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));

export class Player {
  constructor(scene) {
    this.m = createSurfer();
    scene.add(this.m.root);

    this.shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.7, 8),
      basicMat({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }),
    );
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);

    this.reset(0);
  }

  reset(x) {
    this.x = x;
    this.y = 0;
    this.vy = 0;
    this.lane = 1;
    this.z = LANES[1];
    this.grounded = true;
    this.onRamp = false;
    this.ducking = false;
    this.duckTimer = 0;
    this.mode = x < WATER_START ? 'walk' : 'surf';
    this.boardBlend = this.mode === 'surf' ? 1 : 0;
    this.phase = 0;
    this.crashT = 0;
    this.winT = 0;
    this.invuln = 0;
    this.boost = 0;
    this.m.spin.rotation.set(0, 0, 0);
    this.m.root.visible = true;
  }

  get height() {
    return this.ducking ? DUCK_H : STAND_H;
  }

  get speed() {
    if (this.mode === 'win' || this.mode === 'crash') return 0;
    return speedAt(this.x) * (this.boost > 0 ? BOOST_MULT : 1);
  }

  get controllable() {
    return this.mode === 'walk' || this.mode === 'surf';
  }

  // rampAt(x, z) -> hauteur de vague sous le joueur (0 hors vague)
  update(dt, input, rampAt) {
    const ev = [];
    this.invuln = Math.max(0, this.invuln - dt);
    this.boost = Math.max(0, this.boost - dt);

    if (this.mode === 'crash') {
      this.crashT += dt;
      this.x += dt * 3;
      this.vy -= GRAVITY * 0.6 * dt;
      this.y = Math.max(-0.6, this.y + this.vy * dt);
      return ev;
    }
    if (this.mode === 'win') {
      this.winT += dt;
      this.z = damp(this.z, LANES[1], 4, dt);
      return ev;
    }

    // --- commandes
    if (this.controllable) {
      if (input.pressed('up')) this.lane = Math.max(0, this.lane - 1);
      if (input.pressed('down')) this.lane = Math.min(2, this.lane + 1);
      if (input.pressed('jump') && this.grounded) {
        this.vy = JUMP_VY;
        this.grounded = false;
        this.ducking = false;
        ev.push('jump');
      }
      if (input.pressed('duck')) {
        this.duckTimer = 0.35;
        if (!this.grounded) this.vy = Math.min(this.vy, -14); // plongeon rapide
      }
      this.duckTimer = Math.max(0, this.duckTimer - dt);
      this.ducking = this.grounded && (input.down('duck') || this.duckTimer > 0);
    } else {
      this.lane = 1;
      this.ducking = false;
    }

    // --- déplacement
    this.x += this.speed * dt;
    this.z = damp(this.z, LANES[this.lane], 14, dt);

    // --- vertical
    const ramp = this.mode === 'surf' ? rampAt(this.x, this.z) : 0;
    if (this.grounded) {
      if (ramp > 0) {
        this.y = ramp;
        this.onRamp = true;
      } else if (this.onRamp) {
        this.onRamp = false;
        this.grounded = false;
        this.vy = WAVE_VY;
        ev.push('wave');
      } else {
        this.y = 0;
      }
    } else {
      this.vy -= GRAVITY * dt;
      this.y += this.vy * dt;
      const ground = Math.max(0, ramp);
      if (this.y <= ground && this.vy < 0) {
        this.y = ground;
        this.vy = 0;
        this.grounded = true;
        this.onRamp = ramp > 0;
        ev.push('land');
      }
    }

    // --- transitions plage / mer
    if (this.mode === 'walk' && this.x >= WATER_START - 1) {
      this.mode = 'surf';
      this.vy = 7;
      this.grounded = false;
      ev.push('enterWater');
    } else if (this.mode === 'surf' && this.x >= WATER_END && this.grounded) {
      this.mode = 'arrive';
      this.vy = 6;
      this.grounded = false;
      ev.push('arrive');
    } else if (this.mode === 'arrive' && this.x >= FINISH_X + 4) {
      this.mode = 'win';
      ev.push('win');
    }
    return ev;
  }

  crash() {
    this.mode = 'crash';
    this.crashT = 0;
    this.vy = 7;
    this.grounded = false;
    this.ducking = false;
  }

  // ------------------------------------------------------------ animation
  animate(dt, t, waterY) {
    const m = this.m;
    const surfing = this.mode === 'surf' || this.mode === 'crash';
    this.boardBlend = damp(this.boardBlend, surfing ? 1 : 0, 10, dt);
    const b = this.boardBlend;

    const bob = this.mode === 'surf' && this.grounded && !this.onRamp ? waterY : 0;
    m.root.position.set(this.x, this.y + bob, this.z);

    // planche : portée sous le bras (b=0) ou sous les pieds (b=1)
    if (this.mode === 'win') {
      m.board.position.set(lerp(m.board.position.x, 0.2, 0.2), 1.0, -0.9);
      m.board.rotation.set(Math.PI / 2, 0, Math.PI / 2 - 0.1);
    } else if (this.mode === 'crash') {
      const ct = this.crashT;
      m.board.position.set(-ct * 1.5, ct * 4 - ct * ct * 6, ct * 1.2);
      m.board.rotation.set(ct * 9, ct * 4, ct * 6);
    } else {
      // portée sous le bras : elle descend avec les hanches quand Brad se baisse
      this.carryY = damp(this.carryY ?? 1.0, this.ducking ? 0.52 : 1.0, 25, dt);
      m.board.position.set(lerp(0.05, 0, b), lerp(this.carryY, 0, b), lerp(0.48, 0, b));
      m.board.rotation.set(lerp(Math.PI / 2, 0, b), 0, lerp(-0.12, 0, b));
    }

    const legs = [m.legL, m.legR];
    const arms = [m.armL, m.armR];

    if (this.mode === 'win') {
      this.animateWin(t);
    } else if (this.mode === 'crash') {
      m.body.rotation.set(0, -Math.PI / 2, 0);
      m.spin.rotation.z = this.crashT * 9;
      m.spin.rotation.y = this.crashT * 3;
      for (const a of arms) { a.shoulder.rotation.set(Math.sin(t * 30) * 2, 0, 0); a.elbow.rotation.set(0, 0, 0.5); }
      for (const [i, l] of legs.entries()) { l.hip.rotation.set(0, 0, Math.sin(t * 25 + i) * 1.2); l.knee.rotation.z = -0.5; }
      m.root.visible = true;
      return this.updateShadow(waterY);
    } else if (b < 0.5) {
      this.animateWalk(dt, t);
    } else {
      this.animateSurf(dt, t);
    }

    m.spin.rotation.set(0, 0, 0);
    // penché dans le changement de couloir
    m.rig.rotation.x = THREE.MathUtils.clamp((this.z - LANES[this.lane]) * 0.25, -0.4, 0.4);

    m.root.visible = this.invuln <= 0 || Math.floor(t * 16) % 2 === 0;
    this.updateShadow(waterY);
  }

  updateShadow(waterY) {
    const ground = this.mode === 'surf' ? Math.max(0, this.onRamp ? this.y : 0) : 0;
    const h = Math.max(0, this.y - ground);
    this.shadow.position.set(this.x, ground + (this.x > WATER_START && this.x < WATER_END ? waterY + 0.1 : 0.08), this.z);
    const s = Math.max(0.3, 1 - h * 0.15);
    this.shadow.scale.set(s * 1.4, s, 1);
    this.shadow.visible = this.mode !== 'crash';
  }

  animateWalk(dt, t) {
    const m = this.m;
    const moving = this.mode !== 'win';
    if (moving) this.phase += dt * 11;
    const p = this.phase;
    m.body.rotation.set(0, 0, 0);
    m.body.position.y = this.grounded ? Math.abs(Math.sin(p)) * 0.07 : 0;

    const duck = this.ducking ? 1 : 0;
    const air = this.grounded ? 0 : 1;
    const swing = this.grounded && !duck ? Math.sin(p) * 0.75 : 0;

    m.legL.hip.rotation.set(0, 0, swing + air * 0.6 + duck * 1.1);
    m.legR.hip.rotation.set(0, 0, -swing + air * 0.2 + duck * 1.1);
    m.legL.knee.rotation.z = -Math.max(0, -Math.sin(p - 0.6)) * 0.9 * (1 - duck) - air * 1.0 - duck * 2.0;
    m.legR.knee.rotation.z = -Math.max(0, Math.sin(p - 0.6)) * 0.9 * (1 - duck) - air * 0.5 - duck * 2.0;
    m.hips.position.y = 0.95 - duck * 0.5;

    // torse bombé, menton levé : fier comme un paon (et plié en deux pour se baisser)
    m.torso.rotation.set(0, 0, 0.1 - duck * 1.0);
    m.head.rotation.set(0, 0, 0.15 + duck * 0.5 + Math.sin(p * 0.5) * 0.03);

    // bras gauche balance, bras droit tient la planche
    m.armL.shoulder.rotation.set(0.12, 0, -swing * 0.8 + air * 2.6);
    m.armL.elbow.rotation.set(0, 0, 0.3 + air * 0.3);
    m.armR.shoulder.rotation.set(-0.35, 0, 0.1);
    m.armR.elbow.rotation.set(0.4, 0, 0.6);
  }

  animateSurf(dt, t) {
    const m = this.m;
    m.body.rotation.set(0, -Math.PI / 2, 0);
    m.body.position.y = 0.08;

    const duck = this.ducking ? 1 : 0;
    const air = this.grounded ? 0 : 1;
    const crouch = 0.45 + duck * 0.8 + air * 0.5 + Math.sin(t * 3) * 0.04;
    const spread = 0.38;

    m.legL.hip.rotation.set(spread, 0, crouch);
    m.legR.hip.rotation.set(-spread, 0, crouch);
    m.legL.knee.rotation.z = -crouch * 2;
    m.legR.knee.rotation.z = -crouch * 2;
    m.hips.position.y = 0.1 + 0.86 * Math.cos(crouch) * Math.cos(spread);

    // baissé : penché vers l'avant de la planche, pas en dehors
    m.torso.rotation.set(-duck * 0.6, 0, -crouch * 0.35 - duck * 0.2);
    // la tête regarde vers l'avant (vers la droite de l'écran), menton fier
    m.head.rotation.set(0, 1.15, 0.12);

    const sway = Math.sin(t * 2.2) * 0.15;
    const armUp = this.boost > 0 ? 0.6 : 0;
    m.armL.shoulder.rotation.set(1.25 + sway - duck * 0.5 + air * 0.6 + armUp, 0, 0.2);
    m.armR.shoulder.rotation.set(-1.25 + sway + duck * 0.5 - air * 0.6 - armUp, 0, -0.2);
    m.armL.elbow.rotation.set(0.25, 0, 0.2);
    m.armR.elbow.rotation.set(-0.25, 0, 0.2);

    // la planche épouse la houle
    m.board.rotation.z = this.onRamp ? 0.35 : this.grounded ? Math.sin(t * 1.6 + this.x * 0.35) * 0.06 : this.vy * 0.02;
  }

  animateWin(t) {
    const m = this.m;
    const wt = this.winT;
    m.body.rotation.set(0, -Math.PI / 2, 0);
    m.body.position.y = 0;
    m.spin.rotation.set(0, 0, 0);
    // petits sauts de joie au début, puis la pose
    const hop = wt < 1.2 ? Math.abs(Math.sin(wt * 8)) * 0.4 : 0;
    m.root.position.y = hop;

    m.legL.hip.rotation.set(0.15, 0, 0);
    m.legR.hip.rotation.set(-0.15, 0, 0);
    m.legL.knee.rotation.z = 0;
    m.legR.knee.rotation.z = 0;
    m.hips.position.y = 0.95;
    m.torso.rotation.set(0, 0, 0.12);
    m.head.rotation.set(0, Math.sin(wt * 1.5) * 0.3, 0.2);

    const pump = Math.sin(wt * 6) * 0.15;
    if (Math.floor(wt / 2.5) % 2 === 0) {
      // double biceps
      m.armL.shoulder.rotation.set(1.45, 0, 0);
      m.armR.shoulder.rotation.set(-1.45, 0, 0);
      m.armL.elbow.rotation.set(1.7 + pump, 0, 0);
      m.armR.elbow.rotation.set(-1.7 - pump, 0, 0);
    } else {
      // shaka vers la caméra + main sur la hanche
      m.armR.shoulder.rotation.set(-0.5, 0, 1.4 + pump);
      m.armR.elbow.rotation.set(0, 0, 0.6);
      m.armL.shoulder.rotation.set(0.6, 0, -0.3);
      m.armL.elbow.rotation.set(0, 0, 1.8);
    }
  }
}
