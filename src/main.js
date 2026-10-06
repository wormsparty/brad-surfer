import * as THREE from 'three';
import { PS1Renderer, mat } from './ps1.js';
import { World, waterHeight } from './world.js';
import { Player } from './player.js';
import { Sound } from './audio.js';
import { LaneGuides } from './lanes.js';
import * as M from './models.js';
import {
  LANES, START_X, WATER_START, WATER_END, FINISH_X, CHECKPOINTS, TUTORIAL_CUES, BOOST_TIME, buildLevel, waveHeight,
} from './level.js';

// Écran tactile (téléphone, tablette) : boutons à l'écran et textes adaptés.
const IS_TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
document.body.classList.toggle('touch', IS_TOUCH);

// ---------------------------------------------------------------- Clavier et tactile

const KEYMAP = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump',
  ShiftLeft: 'duck', ShiftRight: 'duck', KeyC: 'duck',
  KeyP: 'pause', Escape: 'pause',
  KeyM: 'mute',
  Enter: 'enter', NumpadEnter: 'enter',
};

class Input {
  constructor() {
    this.held = new Set();
    this.hits = new Set();
    addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      e.preventDefault();
      if (!e.repeat) this.hits.add(a);
      this.held.add(a);
    });
    addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.held.delete(a);
    });
    addEventListener('blur', () => this.held.clear());

    // boutons tactiles : appui = touche enfoncée, maintenue tant que le doigt reste posé
    for (const btn of document.querySelectorAll('#touch-controls button')) {
      const a = btn.dataset.action;
      const release = () => {
        this.held.delete(a);
        btn.classList.remove('active');
      };
      btn.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        try { btn.setPointerCapture(e.pointerId); } catch { /* pointeur synthétique */ }
        this.hits.add(a);
        this.held.add(a);
        btn.classList.add('active');
      });
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
    }
    addEventListener('contextmenu', (e) => e.preventDefault());
  }

  // action ponctuelle venant d'un bouton ou d'un toucher d'écran
  tap(a) { this.hits.add(a); }
  pressed(a) { return this.hits.has(a); }
  down(a) { return this.held.has(a); }
  endFrame() { this.hits.clear(); }
}

// ---------------------------------------------------------------- Particules

class Particles {
  constructor(scene, count = 160) {
    this.pool = [];
    const geo = new THREE.TetrahedronGeometry(0.12, 0);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(geo, mat(0xffffff));
      m.visible = false;
      scene.add(m);
      this.pool.push({ m, v: new THREE.Vector3(), life: 0, grav: 18 });
    }
    this.i = 0;
  }
  emit(x, y, z, vx, vy, vz, { color = 0xffffff, life = 0.6, size = 1, grav = 18 } = {}) {
    const p = this.pool[this.i++ % this.pool.length];
    p.m.material = mat(color);
    p.m.position.set(x, y, z);
    p.m.scale.setScalar(size);
    p.m.visible = true;
    p.v.set(vx, vy, vz);
    p.life = life;
    p.grav = grav;
  }
  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      p.v.y -= p.grav * dt;
      p.m.position.addScaledVector(p.v, dt);
      p.m.rotation.x += dt * 8;
      p.m.rotation.y += dt * 6;
      if (p.life <= 0) p.m.visible = false;
    }
  }
}

// ---------------------------------------------------------------- Jeu

const $ = (id) => document.getElementById(id);
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

class Game {
  constructor() {
    this.ps1 = new PS1Renderer($('game'));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.5, 1000);
    this.ps1.resize(this.camera);
    addEventListener('resize', () => this.ps1.resize(this.camera));

    this.world = new World(this.scene);
    this.player = new Player(this.scene);
    this.particles = new Particles(this.scene);
    this.lanes = new LaneGuides(this.scene);
    this.input = new Input();
    this.screenShownAt = 0;
    this.bindTouchScreens();
    this.sound = new Sound();

    this.buildLevel();
    this.state = 'title';
    this.time = 0;
    this.camPos = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.shake = 0;
    this.toTitle();

    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  buildLevel() {
    const { hazards, waves, pickups } = buildLevel();
    const builders = {
      sandcastle: () => M.createSandcastle(),
      crab: () => M.createCrab(),
      net: () => M.createNet(),
      buoy: () => M.createBuoy(),
      fin: () => M.createFin(),
      rock: (h) => M.createRock(Math.floor(h.x) * 3 + h.lane),
      log: () => M.createLog(),
      gull: () => M.createGull(),
      pier: () => M.createPier(),
    };
    this.hazards = hazards.map((h) => {
      const obj = builders[h.kind](h);
      obj.position.set(h.x, 0, h.lane === 'all' ? 0 : LANES[h.lane]);
      this.scene.add(obj);
      return { ...h, obj, phase: h.x * 0.7, smashed: false, smashV: new THREE.Vector3() };
    });
    this.waves = waves.map((w) => {
      const obj = M.createWave();
      obj.position.set(w.x, -0.2, LANES[w.lane]);
      this.scene.add(obj);
      return { ...w, obj };
    });
    this.pickups = pickups.map((p) => {
      const obj = p.kind === 'shell' ? M.createShell() : M.createBoostCan();
      obj.position.set(p.x, p.y, LANES[p.lane]);
      this.scene.add(obj);
      return { ...p, obj, taken: false };
    });
    this.totalShells = this.pickups.filter((p) => p.kind === 'shell').length;
    this.cues = TUTORIAL_CUES.map(([x, kind]) => {
      const obj = M.createTutorialCue(kind, IS_TOUCH);
      obj.position.set(x, 3.8, -4.8);
      this.scene.add(obj);
      return { obj, x };
    });
    this.checkpointObjs = CHECKPOINTS.slice(1).map((x) => {
      const obj = M.createCheckpointFlag();
      obj.position.set(x, 0, 0);
      this.scene.add(obj);
      return obj;
    });
  }

  resetLevel() {
    for (const h of this.hazards) {
      h.smashed = false;
      h.obj.visible = true;
      h.obj.rotation.set(0, 0, 0);
      h.obj.position.set(h.x, 0, h.lane === 'all' ? 0 : LANES[h.lane]);
    }
    for (const p of this.pickups) {
      p.taken = false;
      p.obj.visible = true;
    }
    this.score = 0;
    this.shells = 0;
    this.lives = 3;
    this.checkpoint = START_X;
    this.winTimer = -1;
    this.perfect = false;
    this.player.m.medal.visible = false;
    this.player.reset(START_X);
  }

  toTitle() {
    this.resetLevel();
    this.state = 'title';
    this.player.mode = 'win';
    this.player.winT = 10;
    this.showScreen('title');
    $('hud').classList.add('hidden');
  }

  start() {
    // sur mobile : plein écran et paysage quand le navigateur le permet
    if (IS_TOUCH && !document.fullscreenElement && document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation?.lock?.('landscape'))
        .catch(() => {});
    }
    this.sound.init();
    this.sound.play('start');
    this.sound.setMusic(true);
    this.resetLevel();
    this.state = 'play';
    this.showScreen(null);
    $('hud').classList.remove('hidden');
    this.updateHud();
    this.popup('GO BRAD, GO!', 'gold');
  }

  showScreen(name) {
    for (const s of ['title', 'pause', 'over', 'win']) $('screen-' + s).classList.toggle('hidden', s !== name);
    $('touch-controls').classList.toggle('hidden', !IS_TOUCH || name !== null);
    $('pause-btn').classList.toggle('hidden', name !== null);
    this.screenShownAt = performance.now();
  }

  // toucher un écran (titre, pause, fin) = Entrée ; un court délai évite de relancer
  // la partie par un toucher qui était destiné aux boutons de jeu
  bindTouchScreens() {
    for (const s of ['title', 'pause', 'over', 'win']) {
      $('screen-' + s).addEventListener('pointerdown', (e) => {
        if (e.target.closest('button') || performance.now() - this.screenShownAt < 600) return;
        this.input.tap('enter');
      });
    }
    $('pause-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.input.tap('pause');
    });
    $('mute-btn').addEventListener('pointerdown', (e) => {
      e.preventDefault();
      this.sound.toggleMute();
      $('mute-btn').textContent = this.sound.muted ? 'SOUND: OFF' : 'SOUND: ON';
    });
  }

  popup(text, color = '') {
    const el = document.createElement('div');
    el.className = 'popup ' + color;
    el.textContent = text;
    const n = $('popups').children.length;
    el.style.top = 30 + n * 7 + '%';
    $('popups').appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  addScore(n) {
    this.score += n;
  }

  updateHud() {
    $('score').textContent = String(this.score).padStart(6, '0');
    $('shell-count').textContent = `${this.shells}/${this.totalShells}`;
    $('lives').innerHTML = [0, 1, 2].map((i) => `<div class="heart ${i < this.lives ? '' : 'lost'}"></div>`).join('');
    const p = Math.min(1, Math.max(0, (this.player.x - START_X) / (FINISH_X - START_X)));
    $('progress-fill').style.width = p * 100 + '%';
    $('progress-dude').style.left = p * 100 + '%';
    $('boost').classList.toggle('hidden', this.player.boost <= 0);
  }

  rampAt = (x, z) => {
    for (const w of this.waves) {
      if (Math.abs(z - LANES[w.lane]) > 1.0) continue;
      const h = waveHeight(x - w.x);
      if (h > 0) return h;
    }
    return 0;
  };

  // ------------------------------------------------------------ boucle
  frame(now) {
    const dt = Math.min(1 / 30, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;

    const inp = this.input;
    if (inp.pressed('mute')) this.sound.toggleMute();

    if (this.state === 'title') {
      if (inp.pressed('enter') || inp.pressed('jump')) this.start();
    } else if (this.state === 'play') {
      // téléphone tenu en portrait (message « tourne ton téléphone ») : on met en pause
      const portrait = IS_TOUCH && innerHeight > innerWidth;
      if (inp.pressed('pause') || portrait) {
        this.state = 'pause';
        this.showScreen('pause');
        this.sound.setMusic(false);
      } else {
        this.update(dt);
      }
    } else if (this.state === 'pause') {
      if (inp.pressed('pause') || inp.pressed('enter')) {
        this.state = 'play';
        this.showScreen(null);
        this.sound.setMusic(true);
      }
    } else if (this.state === 'over' || this.state === 'win') {
      if (inp.pressed('enter')) this.start();
      if (this.state === 'win') this.player.update(dt, inp, this.rampAt);
      this.confetti(dt);
    }

    const paused = this.state === 'pause';
    if (!paused) {
      this.animateObjects(dt);
      this.particles.update(dt);
      this.player.animate(dt, this.time, this.playerWaterY());
      this.lanes.visible = this.state !== 'title' && this.player.mode !== 'win';
      this.lanes.update(this.player, this.time);
      this.world.update(this.time, this.camera.position.x);
    }
    this.updateCamera(paused ? 0 : dt);
    this.ps1.render(this.scene, this.camera);
    inp.endFrame();
    requestAnimationFrame((t) => this.frame(t));
  }

  playerWaterY() {
    const p = this.player;
    if (p.x < WATER_START || p.x > WATER_END) return 0;
    return waterHeight(p.x, p.z, this.time) + 0.08;
  }

  update(dt) {
    const p = this.player;
    const events = p.update(dt, this.input, this.rampAt);

    for (const e of events) {
      switch (e) {
        case 'jump': this.sound.play('jump'); break;
        case 'land':
          this.sound.play('land');
          if (p.mode === 'surf') this.splash(14);
          break;
        case 'wave':
          this.sound.play('wave');
          this.addScore(50);
          this.popup('WAVE! +50', 'cyan');
          this.splash(20);
          break;
        case 'enterWater':
          this.sound.play('wave');
          this.popup('SURF TIME!', 'cyan');
          break;
        case 'arrive':
          this.sound.play('land');
          this.popup('LAND HO!', 'gold');
          break;
        case 'win': this.win(); break;
      }
    }

    if (p.mode === 'crash') {
      if (p.crashT > 1.4) this.afterCrash();
    } else {
      this.collide();
    }

    // checkpoints
    for (const cp of CHECKPOINTS) {
      if (cp > this.checkpoint && p.x >= cp) {
        this.checkpoint = cp;
        this.addScore(100);
        this.sound.play('checkpoint');
        this.popup('CHECKPOINT!', 'pink');
      }
    }

    // gerbe d'eau derrière la planche
    if (p.mode === 'surf' && p.grounded && Math.random() < dt * 40) {
      const sp = p.speed;
      this.particles.emit(
        p.x - 0.9, p.y + 0.1, p.z + (Math.random() - 0.5) * 0.5,
        -sp * 0.15 - Math.random() * 2, 2 + Math.random() * 3, (Math.random() - 0.5) * 3,
        { color: Math.random() < 0.7 ? 0xffffff : 0x9ff6ff, life: 0.5 },
      );
      if (p.boost > 0) {
        this.particles.emit(p.x - 0.5, p.y + 1, p.z, -sp * 0.4, 1, 0, { color: 0x4af3ff, life: 0.35, grav: 0, size: 1.4 });
      }
    }

    this.updateHud();
  }

  collide() {
    const p = this.player;
    for (const h of this.hazards) {
      if (h.smashed) continue;
      const dx = Math.abs(p.x - h.x);
      if (dx > h.len + 0.3) continue;
      if (h.lane !== 'all' && Math.abs(p.z - LANES[h.lane]) > 1.1) continue;
      if (p.y >= h.y1 || p.y + p.height <= h.y0) continue;
      if (p.boost > 0) {
        this.smash(h);
      } else if (p.invuln <= 0) {
        this.popup('OUCH!', 'red');
        this.crash();
        return;
      }
    }
    for (const it of this.pickups) {
      if (it.taken) continue;
      if (Math.abs(p.x - it.x) > 0.8) continue;
      if (Math.abs(p.z - LANES[it.lane]) > 1.1) continue;
      if (Math.abs(p.y + p.height / 2 - it.y) > 1.2) continue;
      it.taken = true;
      it.obj.visible = false;
      if (it.kind === 'shell') {
        this.shells++;
        this.addScore(it.bonus ? 20 : 10);
        this.sound.play('shell');
        for (let i = 0; i < 5; i++) this.particles.emit(it.x, it.y, LANES[it.lane], (Math.random() - 0.5) * 4, 3 + Math.random() * 3, (Math.random() - 0.5) * 4, { color: 0xff9ec4, life: 0.4 });
      } else {
        p.boost = BOOST_TIME;
        this.sound.play('boost');
        this.popup('ENERGY BOOST!', 'cyan');
      }
    }
  }

  smash(h) {
    h.smashed = true;
    h.smashV.set(8 + Math.random() * 4, 8 + Math.random() * 4, (Math.random() - 0.5) * 10);
    this.addScore(50);
    this.sound.play('smash');
    this.popup('SMASH! +50', 'cyan');
    this.shake = 0.3;
  }

  crash() {
    this.player.crash();
    this.sound.play('hit');
    this.shake = 0.6;
    this.splash(30);
  }

  afterCrash() {
    this.lives--;
    if (this.lives <= 0) {
      this.state = 'over';
      this.sound.setMusic(false);
      this.sound.play('gameover');
      $('over-stats').innerHTML = `SCORE ${this.score}<br>SHELLS ${this.shells}/${this.totalShells}`;
      this.showScreen('over');
      this.updateHud();
      return;
    }
    this.player.reset(this.checkpoint);
    this.player.invuln = 2;
    this.popup(`${this.lives} ${this.lives > 1 ? 'LIVES' : 'LIFE'} LEFT`, 'pink');
  }

  win() {
    this.sound.setMusic(false);
    this.sound.play('win');
    this.state = 'win';
    const lifeBonus = this.lives * 500;
    const perfect = this.shells === this.totalShells;
    const shellBonus = perfect ? 1000 : 0;
    this.perfect = perfect;
    $('medal').classList.toggle('hidden', !perfect);
    $('medal-count').textContent = `${this.shells}/${this.totalShells} SHELLS`;
    this.player.m.medal.visible = perfect;
    if (perfect) setTimeout(() => this.sound.play('medal'), 1500);
    const total = this.score + lifeBonus + shellBonus;
    const row = (a, b) => `<div class="row"><span>${a}</span><span>${b}</span></div>`;
    $('win-stats').innerHTML =
      row('SCORE', this.score) +
      row('SHELLS', `${this.shells}/${this.totalShells}`) +
      row('LIVES BONUS', `+${lifeBonus}`) +
      (shellBonus ? row('ALL SHELLS!', `+${shellBonus}`) : '') +
      `<div class="row total"><span>TOTAL</span><span>${total}</span></div>`;
    this.score = total;
    this.updateHud();
    setTimeout(() => {
      if (this.state === 'win') this.showScreen('win');
    }, 2200);
  }

  confetti(dt) {
    if (this.state !== 'win' || Math.random() > dt * 60) return;
    const colors = this.perfect ? [0xffe14a, 0xffd23a, 0xfff4a0, 0xffffff] : [0xff3d7f, 0xffe14a, 0x2ee8ff, 0x7cff6a, 0xff7a1a];
    const p = this.player;
    this.particles.emit(
      p.x + (Math.random() - 0.5) * 10, 7, p.z + (Math.random() - 0.5) * 6,
      (Math.random() - 0.5) * 2, -1, (Math.random() - 0.5) * 2,
      { color: colors[Math.floor(Math.random() * colors.length)], life: 3, grav: 1.5, size: 1.3 },
    );
  }

  splash(n) {
    const p = this.player;
    if (p.x < WATER_START || p.x > WATER_END) return;
    for (let i = 0; i < n; i++) {
      this.particles.emit(
        p.x + (Math.random() - 0.5), 0.1, p.z + (Math.random() - 0.5),
        (Math.random() - 0.5) * 6, 3 + Math.random() * 5, (Math.random() - 0.5) * 6,
        { color: Math.random() < 0.6 ? 0xffffff : 0x9ff6ff, life: 0.7 },
      );
    }
  }

  animateObjects(dt) {
    const t = this.time;
    const camX = this.camera.position.x;
    for (const h of this.hazards) {
      const o = h.obj;
      if (Math.abs(h.x - camX) > 120) continue;
      if (h.smashed) {
        if (!o.visible) continue;
        h.smashV.y -= 25 * dt;
        o.position.addScaledVector(h.smashV, dt);
        o.rotation.x += dt * 8;
        o.rotation.z += dt * 6;
        if (o.position.y < -10) o.visible = false;
        continue;
      }
      const wy = h.x > WATER_START && h.x < WATER_END ? waterHeight(h.x, o.position.z, t) : 0;
      switch (h.kind) {
        case 'buoy':
          o.position.y = wy - 0.05;
          o.rotation.z = Math.sin(t * 2 + h.phase) * 0.12;
          break;
        case 'fin':
          o.position.y = wy - 0.1;
          o.position.x = h.x + Math.sin(t * 1.5 + h.phase) * 0.4;
          o.rotation.y = Math.sin(t * 1.5 + h.phase) * 0.2;
          break;
        case 'log':
          o.position.y = wy - 0.15;
          o.rotation.x = Math.sin(t * 1.2 + h.phase) * 0.03;
          break;
        case 'rock':
          o.position.y = -0.3;
          break;
        case 'gull':
          o.position.y = 2.1 + Math.sin(t * 3 + h.phase) * 0.08;
          o.userData.shadow.position.y = (h.x > WATER_START ? 0.22 : 0.08) - o.position.y;
          for (const w of o.userData.wings) w.pivot.rotation.x = w.side * Math.sin(t * 14 + h.phase) * 0.7;
          break;
        case 'crab':
          o.position.z = LANES[h.lane] + Math.sin(t * 4 + h.phase) * 0.3;
          o.rotation.y = Math.sin(t * 8) * 0.15;
          break;
      }
    }
    for (const it of this.pickups) {
      if (it.taken || Math.abs(it.x - camX) > 100) continue;
      (it.obj.userData.spin ?? it.obj).rotation.y = t * 3 + it.x;
      it.obj.position.y = it.y + Math.sin(t * 4 + it.x) * 0.1;
      if (it.obj.userData.sparkles) it.obj.userData.sparkles.rotation.y = -t * 6;
    }
    for (const w of this.waves) {
      w.obj.position.y = -0.2 + Math.sin(t * 2 + w.x) * 0.05;
      w.obj.scale.y = 1 + Math.sin(t * 3 + w.x) * 0.04;
    }
    for (const c of this.cues) {
      if (Math.abs(c.x - camX) > 60) continue;
      c.obj.userData.animate(t);
      c.obj.position.y = 3.8 + Math.sin(t * 2 + c.x) * 0.12;
    }
    for (const c of this.checkpointObjs) c.position.y = Math.sin(t * 1.6 + c.position.x) * 0.06;
  }

  updateCamera(dt) {
    const p = this.player;
    const pos = new THREE.Vector3();
    const look = new THREE.Vector3();
    if (this.state === 'title') {
      // Brad posé sur le tiers droit de l'écran, le titre à gauche
      const a = Math.sin(this.time * 0.3) * 0.5;
      pos.set(p.x - 1.5 + a, 2.0 + a * 0.3, p.z + 6.5);
      look.set(p.x - 3.4 + a, 1.7, p.z);
    } else if (p.mode === 'win') {
      // Brad sur le tiers gauche, le tableau des scores à droite
      pos.set(p.x + 1.5, 2.0, p.z + 6.5);
      look.set(p.x + 3.4, 1.5, p.z);
    } else {
      const lift = Math.max(0, p.y) * 0.35;
      pos.set(p.x + 3, 6.2 + lift, 14.5);
      look.set(p.x + 7, 0.9 + lift, -0.8);
    }
    if (dt === 0 || this.camPos.lengthSq() === 0 || this.state === 'title') {
      this.camPos.copy(pos);
      this.camLook.copy(look);
    } else {
      const k = p.mode === 'win' ? 2 : 8;
      this.camPos.set(damp(this.camPos.x, pos.x, 20, dt), damp(this.camPos.y, pos.y, k * 0.5, dt), damp(this.camPos.z, pos.z, k, dt));
      this.camLook.set(damp(this.camLook.x, look.x, 20, dt), damp(this.camLook.y, look.y, k * 0.5, dt), damp(this.camLook.z, look.z, k, dt));
    }
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt);
      const s = this.shake * 0.5;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
    }
    this.camera.lookAt(this.camLook);
  }
}

// les panneaux sont peints avec la police pixel : on attend qu'elle soit chargée
Promise.race([document.fonts.load('20px "Press Start 2P"'), new Promise((r) => setTimeout(r, 1500))])
  .finally(() => { window.game = new Game(); });
