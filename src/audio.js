// Sons synthétisés en WebAudio : aucun fichier à charger.

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

// Progression E – C#m – A – B, 16 croches par mesure
const CHORDS = [[52, 56, 59], [49, 52, 56], [45, 49, 52], [47, 51, 54]];
const BASS_PATTERN = [0, 0, 12, 0, 7, 0, 12, 7, 0, 0, 12, 0, 7, 12, 7, 5];
const LEAD = [
  [76, -1, 71, -1, 76, 78, 80, -1, 78, -1, 76, -1, 71, -1, -1, -1],
  [73, -1, 76, -1, 80, -1, 78, 76, 73, -1, -1, -1, 71, 73, 76, -1],
  [69, -1, 73, -1, 76, -1, 81, -1, 80, 78, 76, -1, 73, -1, -1, -1],
  [71, -1, 75, -1, 78, -1, 83, -1, 81, -1, 78, -1, 75, 78, 83, -1],
];

export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicOn = false;
    this.step = 0;
    this.nextTime = 0;
  }

  init() {
    if (this.ctx) {
      this.ctx.resume();
      return;
    }
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.45;
    this.master.connect(ctx.destination);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.master);
    this.music = ctx.createGain();
    this.music.gain.value = 0.22;
    this.music.connect(this.master);

    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this.startOcean();
    setInterval(() => this.schedule(), 25);
  }

  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.45;
  }

  tone(freq, dur, { type = 'square', vol = 0.15, slide = null, delay = 0, out = this.sfx } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  noise(dur, { vol = 0.2, freq = 1000, q = 1, type = 'bandpass', delay = 0, out = this.sfx, slide = null } = {}) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (slide) f.frequency.exponentialRampToValueAtTime(slide, t + dur);
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + dur + 0.02);
  }

  startOcean() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500;
    const g = ctx.createGain();
    g.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.035;
    lfo.connect(lfoGain).connect(g.gain);
    src.connect(f).connect(g).connect(this.master);
    src.start();
    lfo.start();
  }

  play(name) {
    switch (name) {
      case 'jump':
        this.tone(220, 0.18, { slide: 660, vol: 0.12 });
        break;
      case 'land':
        this.noise(0.25, { vol: 0.25, freq: 600, slide: 200 });
        break;
      case 'shell':
        this.tone(1318, 0.08, { type: 'triangle', vol: 0.15 });
        this.tone(1760, 0.14, { type: 'triangle', vol: 0.15, delay: 0.06 });
        break;
      case 'wave':
        this.noise(0.6, { vol: 0.3, freq: 400, slide: 3000, q: 2 });
        break;
      case 'boost':
        this.tone(200, 0.5, { type: 'sawtooth', slide: 1600, vol: 0.12 });
        this.tone(300, 0.5, { type: 'square', slide: 2400, vol: 0.06, delay: 0.05 });
        break;
      case 'smash':
        this.noise(0.3, { vol: 0.35, freq: 1500, q: 0.5 });
        this.tone(160, 0.2, { slide: 60, vol: 0.15 });
        break;
      case 'hit':
        this.noise(0.6, { vol: 0.45, freq: 800, slide: 150, q: 0.7 });
        this.tone(330, 0.5, { type: 'sawtooth', slide: 60, vol: 0.15 });
        break;
      case 'checkpoint':
        [0, 4, 7, 12, 16].forEach((n, i) => this.tone(NOTE(76 + n), 0.15, { type: 'triangle', vol: 0.14, delay: i * 0.07 }));
        break;
      case 'start':
        this.tone(NOTE(64), 0.1, { vol: 0.12 });
        this.tone(NOTE(76), 0.25, { vol: 0.12, delay: 0.1 });
        break;
      case 'win':
        [64, 68, 71, 76, 71, 76, 80, 83].forEach((n, i) => this.tone(NOTE(n), 0.22, { type: 'square', vol: 0.12, delay: i * 0.11 }));
        break;
      case 'medal':
        [72, 76, 79, 84, 88, 91, 96].forEach((n, i) => this.tone(NOTE(n), 0.3, { type: 'triangle', vol: 0.13, delay: i * 0.07 }));
        [84, 88, 91].forEach((n) => this.tone(NOTE(n), 1.2, { type: 'square', vol: 0.05, delay: 0.55 }));
        break;
      case 'gameover':
        [67, 63, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.35, { type: 'triangle', vol: 0.15, delay: i * 0.22 }));
        break;
    }
  }

  setMusic(on) {
    if (on && !this.musicOn && this.ctx) {
      this.nextTime = this.ctx.currentTime + 0.05;
      this.step = 0;
    }
    this.musicOn = on;
  }

  schedule() {
    if (!this.musicOn || !this.ctx) return;
    const stepDur = 60 / 152 / 2;
    while (this.nextTime < this.ctx.currentTime + 0.12) {
      const bar = Math.floor(this.step / 16) % 4;
      const s = this.step % 16;
      const t = this.nextTime - this.ctx.currentTime;
      const root = CHORDS[bar][0] - 12;
      this.tone(NOTE(root + BASS_PATTERN[s]), stepDur * 0.9, { type: 'triangle', vol: 0.5, delay: t, out: this.music });
      const lead = LEAD[bar][s];
      if (lead > 0) this.tone(NOTE(lead), stepDur * 1.6, { type: 'square', vol: 0.12, delay: t, out: this.music });
      if (s % 4 === 2) {
        for (const n of CHORDS[bar]) this.tone(NOTE(n + 12), stepDur * 0.5, { type: 'sawtooth', vol: 0.04, delay: t, out: this.music });
      }
      if (s % 8 === 0) this.tone(120, 0.12, { type: 'sine', slide: 40, vol: 0.6, delay: t, out: this.music });
      if (s % 8 === 4) this.noise(0.12, { vol: 0.35, freq: 2000, q: 0.6, delay: t, out: this.music });
      this.noise(0.03, { vol: 0.12, freq: 8000, type: 'highpass', delay: t, out: this.music });
      this.nextTime += stepDur;
      this.step++;
    }
  }
}
