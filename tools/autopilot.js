// Pilote automatique : joue le niveau entier avec la vraie physique du jeu (sans rendu)
// et rapporte les collectibles manqués et les chutes.
// Usage : dans la console du navigateur, sur la page du jeu : await import('/tools/autopilot.js').then(m => m.run())
export function run(game = window.game) {
  const g = game;
  g.start();
  const p = g.player;
  const inp = g.input;
  const LANES = [-2.4, 0, 2.4];
  const log = [];
  const crash = g.crash.bind(g);
  g.crash = () => { log.push(`chute x=${p.x.toFixed(1)} couloir ${p.lane}`); crash(); };

  const rockAhead = (lane) => g.hazards.some((h) => h.kind === 'rock' && !h.smashed && h.lane === lane && h.x - p.x > -1.6 && h.x - p.x < 7);

  for (let f = 0; f < 60 * 300 && g.state === 'play'; f++) {
    inp.held.clear();
    if (p.mode === 'surf' || p.mode === 'walk') {
      // cible : prochain collectible, ou la prochaine vague si elle vient avant
      const next = g.pickups.filter((it) => !it.taken && it.x > p.x - 0.3).sort((a, b) => a.x - b.x)[0];
      const wave = g.waves.find((w) => w.x + 1.1 > p.x);
      let target = next ? next.lane : 1;
      if (wave && (!next || wave.x - 2.4 < next.x) && wave.x - p.x < 40) target = wave.lane;
      if (p.boost <= 0 && rockAhead(target)) {
        target = [0, 1, 2].filter((l) => !rockAhead(l)).sort((a, b) => Math.abs(a - target) - Math.abs(b - target))[0];
      }
      // comme un joueur prudent : on n'entre pas dans un couloir où un obstacle arrive à hauteur
      const step = target < p.lane ? p.lane - 1 : p.lane + 1;
      const busy = g.hazards.some((h) => !h.smashed && h.lane === step && Math.abs(h.x - p.x) < h.len + 1.5);
      if (p.lane !== target && !busy && Math.abs(p.z - LANES[p.lane]) < 0.4) inp.hits.add(target < p.lane ? 'up' : 'down');

      for (const h of g.hazards) {
        if (h.smashed || p.boost > 0) continue;
        const dx = h.x - p.x;
        if (dx < -(h.len + 0.4) || dx > 15) continue;
        if (h.lane !== 'all' && Math.abs(LANES[h.lane] - p.z) > 1.3) continue;
        if (h.y0 > 1) {
          if (dx < h.len + 2.5) inp.held.add('duck');
        } else if (h.kind !== 'rock' && p.grounded && dx > 0 && dx < p.speed * 0.36 + 0.2) {
          inp.hits.add('jump');
        }
      }
    }
    g.update(1 / 60);
    inp.endFrame();
    if (p.mode === 'crash') {
      for (let k = 0; k < 120 && p.mode === 'crash'; k++) g.update(1 / 60);
    }
  }
  const missed = g.pickups.filter((i) => !i.taken).map((i) => `${i.kind}@${i.x.toFixed(1)}/c${i.lane}${i.bonus ? ' (arc)' : ''}`);
  return { etat: g.state, collectes: `${g.shells}/${g.totalShells}`, canettesManquees: g.pickups.filter((i) => i.kind === 'boost' && !i.taken).length, chutes: log, manques: missed };
}
