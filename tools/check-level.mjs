// Vérifie qu'on peut ramasser TOUS les collectibles en une seule partie, sans se faire toucher.
// Usage : node tools/check-level.mjs
import { buildLevel, waveFlight, boostEnd, speedAt } from '../src/level.js';

const { hazards, waves, pickups } = buildLevel();
const MIN_SWITCH = 3.5; // distance minimale pour changer d'un couloir (≈ 0,25 s à pleine vitesse)
const CLEAR = 1.2; // marge autour d'un obstacle
const problems = [];
const name = (p) => `${p.kind}@${p.x.toFixed(1)}/c${p.lane}`;

for (const p of pickups) {
  for (const h of hazards) {
    const sameLane = h.lane === 'all' || h.lane === p.lane;
    // obstacle bas qu'on saute : autour du sommet du saut (±0,2 s), on passerait au-dessus
    const margin = h.y1 < 1.2 ? Math.max(CLEAR, 0.2 * speedAt(h.x) + 0.3) : CLEAR;
    if (sameLane && Math.abs(h.x - p.x) < h.len + margin) problems.push(`${name(p)} est sur ${h.kind}@${h.x}/c${h.lane}`);
  }
  for (const w of waves) {
    // un coquillage au sol dans la rampe d'une vague serait survolé
    if (!p.bonus && w.lane === p.lane && p.x > w.x - 2.6 && p.x < w.x + 14) problems.push(`${name(p)} est dans la trajectoire de la vague @${w.x}`);
  }
}

// Chemin : on parcourt les collectibles dans l'ordre et on vérifie chaque changement de couloir.
// Chaque vague ajoute un passage obligé : être dans son couloir du pied de la rampe à la crête.
const ramps = waves.flatMap((w) => [
  { kind: 'rampe', x: w.x - 2.4, lane: w.lane },
  { kind: 'crete', x: w.x + 1.1, lane: w.lane },
]);
const sorted = [...pickups, ...ramps].sort((a, b) => a.x - b.x);
for (let i = 1; i < sorted.length; i++) {
  const a = sorted[i - 1];
  const b = sorted[i];
  if (a.lane === b.lane) {
    // un rocher entre deux collectibles du même couloir : il faut avoir le temps d'esquiver puis revenir
    for (const h of hazards) {
      if (h.kind === 'rock' && h.lane === a.lane && h.x > a.x && h.x < b.x && b.x - a.x < 2 * MIN_SWITCH + 2 * (h.len + CLEAR)) {
        problems.push(`${name(a)} -> ${name(b)} : rocher @${h.x} trop serré pour l'esquiver`);
      }
    }
    continue;
  }
  const gap = b.x - a.x;
  if (gap < MIN_SWITCH * Math.abs(a.lane - b.lane)) {
    problems.push(`${name(a)} -> ${name(b)} : changement de couloir impossible (écart ${gap.toFixed(1)})`);
    continue;
  }
  // les couloirs traversés doivent être libres d'obstacles infranchissables (rochers) pendant le changement
  const lo = Math.min(a.lane, b.lane);
  const hi = Math.max(a.lane, b.lane);
  for (let l = lo; l <= hi; l++) {
    if (l === a.lane) continue;
    const blocked = hazards.filter((h) => h.kind === 'rock' && h.lane === l && h.x > a.x - 1 && h.x < b.x + 1);
    const free = blocked.every((h) => h.x - h.len - CLEAR > a.x + MIN_SWITCH || h.x + h.len + CLEAR < b.x - MIN_SWITCH);
    if (!free) problems.push(`${name(a)} -> ${name(b)} : couloir ${l} bouché par un rocher`);
  }
}

// Les vagues : rien au sol pendant le vol (on le survolerait), et pas de vague pendant un boost
// (le saut serait plus long et l'arc raté).
for (const w of waves) {
  const pts = waveFlight(w.x);
  const landX = pts.at(-1)[0];
  for (const p of pickups) {
    if (!p.bonus && p.x > w.x - 2.6 && p.x < landX + 1) {
      problems.push(`${name(p)} survolé par le saut de la vague @${w.x} (atterrissage ${landX.toFixed(1)})`);
    }
  }
  for (const t of pickups.filter((p) => p.kind === 'boost')) {
    const end = boostEnd(t.x);
    if (w.x - 2.4 > t.x && w.x - 2.4 < end + 2) problems.push(`vague @${w.x} pendant le boost du ${name(t)} (jusqu'à ${end.toFixed(0)})`);
  }
}

// fin de boost : pas juste devant un obstacle (on n'aurait pas le temps de réagir)
for (const t of pickups.filter((p) => p.kind === 'boost')) {
  const end = boostEnd(t.x);
  for (const h of hazards) {
    if (end > h.x - 6 && end < h.x + h.len) problems.push(`le boost du ${name(t)} finit à ${end.toFixed(0)}, juste devant ${h.kind}@${h.x}`);
  }
}

const shells = pickups.filter((p) => p.kind === 'shell').length;
console.log(`${shells} coquillages, ${pickups.length - shells} canettes, ${hazards.length} obstacles, ${waves.length} vagues`);
console.log(problems.length ? problems.join('\n') : 'OK : tout est ramassable en une partie');
process.exit(problems.length ? 1 : 0);
