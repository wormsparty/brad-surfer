// Description du niveau « Brad's Beach ».
// Axe x : progression gauche → droite. Axe z : couloirs (0 = fond, 2 = devant).

export const LANES = [-2.4, 0, 2.4];
export const START_X = 2;
export const WATER_START = 44; // fin du sable : Brad pose sa planche à l'eau
export const WATER_END = 860; // l'autre rive
export const FINISH_X = 874;
export const CHECKPOINTS = [START_X, 200, 380, 560, 720];

export const GRAVITY = 25;
export const JUMP_VY = 9;
export const WAVE_VY = 12;
export const WAVE_TOP = 1.5;
export const BOOST_TIME = 3.0;
export const BOOST_MULT = 1.5;

export function speedAt(x) {
  if (x < WATER_START || x > WATER_END) return 6.5;
  const t = (x - WATER_START) / (WATER_END - WATER_START);
  return 12 + 4.5 * t;
}

// Trajectoire après une vague (vitesse normale) : liste de points [x, y] jusqu'à l'atterrissage.
export function waveFlight(waveX) {
  const dt = 1 / 240;
  let x = waveX + 1.1;
  let y = WAVE_TOP;
  let vy = WAVE_VY;
  const pts = [[x, y]];
  while (y > 0) {
    x += speedAt(x) * dt;
    vy -= GRAVITY * dt;
    y += vy * dt;
    pts.push([x, Math.max(0, y)]);
  }
  return pts;
}

// Portion du parcours couverte par le boost d'une canette ramassée en x.
export function boostEnd(canX) {
  let x = canX;
  for (let t = 0; t < BOOST_TIME; t += 1 / 60) x += speedAt(x) * BOOST_MULT / 60;
  return x;
}

// Hauteur de la rampe de vague selon la distance au sommet (dx = x - vague.x).
export function waveHeight(dx) {
  if (dx < -2.4 || dx > 1.1) return 0;
  return ((dx + 2.4) / 3.5) * WAVE_TOP;
}

// Boîtes de collision : len = demi-longueur en x, [y0, y1] = hauteur.
// « all » = occupe les trois couloirs.
export const KINDS = {
  sandcastle: { len: 0.5, y0: 0, y1: 0.8 },
  crab: { len: 0.35, y0: 0, y1: 0.6 },
  net: { len: 0.12, y0: 1.65, y1: 2.5, all: true },
  buoy: { len: 0.4, y0: 0, y1: 0.95 },
  fin: { len: 0.45, y0: 0, y1: 0.9 },
  rock: { len: 1.0, y0: 0, y1: 3.2 },
  log: { len: 0.36, y0: 0, y1: 0.7, all: true },
  gull: { len: 0.35, y0: 1.65, y1: 2.5 },
  pier: { len: 0.3, y0: 1.65, y1: 4, all: true },
};

const L = (lanes) => (lanes === 'all' ? ['all'] : [...String(lanes)].map(Number));

// [x, type, couloirs] — couloirs : 'all' ou chaîne de chiffres ("02" = fond + devant)
const HAZARDS = [
  // --- la plage, à pied
  [18, 'sandcastle', '1'],
  [25, 'crab', '0'],
  [25, 'crab', '2'],
  [34, 'net', 'all'],

  // --- section A : échauffement
  [70, 'buoy', '1'],
  [86, 'rock', '1'],
  [100, 'buoy', '0'], [100, 'buoy', '2'],
  [116, 'gull', '1'],
  [130, 'wave', '1'],
  [156, 'fin', '01'],
  [170, 'pier', 'all'],
  [190, 'rock', '01'],

  // --- section B
  [214, 'log', 'all'],
  [228, 'rock', '1'], [228, 'buoy', '2'],
  [242, 'gull', '01'],
  [256, 'wave', '2'],
  [282, 'fin', '2'], [282, 'rock', '0'],
  [296, 'pier', 'all'],
  [310, 'buoy', '012'],
  [324, 'rock', '02'],
  [338, 'gull', '1'], [338, 'fin', '0'], [338, 'rock', '2'],
  [352, 'wave', '0'],
  [374, 'log', 'all'],

  // --- section C : ça accélère
  [394, 'rock', '12'],
  [405, 'fin', '0'],
  [418, 'pier', 'all'],
  [429, 'buoy', '1'],
  [441, 'rock', '02'],
  [453, 'gull', '012'],
  [466, 'wave', '1'],
  [490, 'log', 'all'],
  [502, 'rock', '0'], [502, 'fin', '1'],
  [514, 'rock', '1'], [514, 'gull', '2'],
  [526, 'fin', '012'],
  [538, 'pier', 'all'],
  [550, 'rock', '12'],

  // --- section D
  [574, 'wave', '2'],
  [598, 'rock', '01'],
  [609, 'gull', '2'], [609, 'buoy', '1'],
  [621, 'log', 'all'],
  [632, 'rock', '2'], [632, 'fin', '0'],
  [644, 'pier', 'all'],
  [655, 'rock', '01'],
  [667, 'buoy', '2'], [667, 'rock', '1'],
  [680, 'wave', '0'],
  [705, 'fin', '012'],
  [713, 'gull', '01'], [713, 'rock', '2'],

  // --- section E : le grand final
  [736, 'rock', '02'],
  [747, 'rock', '1'], [747, 'buoy', '0'],
  [759, 'pier', 'all'],
  [770, 'log', 'all'],
  [784, 'wave', '1'],
  [808, 'rock', '02'],
  [819, 'fin', '1'], [819, 'gull', '0'],
  [831, 'buoy', '012'],
  [842, 'gull', '12'], [842, 'rock', '0'],
];

// Coquillages : [x de départ, couloir, nombre, espacement]
// Coquillages : [x de départ, couloir, nombre, espacement]
// Règle : un seul chemin doit permettre de TOUT ramasser (vérifié par tools/check-level.mjs).
const SHELL_LINES = [
  [8, 1, 4, 1.6],
  [21, 1, 3, 1.4],
  [29, 1, 3, 1.4],
  [56, 1, 5, 2.2],
  [84, 0, 4, 2],
  [108, 1, 4, 2],
  [148, 2, 5, 2],
  [178, 1, 5, 2],
  [204, 1, 4, 2],
  [235, 0, 3, 2],
  [274, 1, 4, 2],
  [302, 1, 3, 2],
  [318, 1, 5, 2],
  [398, 0, 2, 2],
  [436, 1, 5, 2],
  [484, 1, 2, 2],
  [520, 0, 2, 2],
  [545, 0, 5, 2],
  [593, 2, 3, 2],
  [614, 0, 2, 2],
  [648, 2, 4, 2],
  [699, 0, 2, 2],
  [726, 1, 5, 2],
  [752, 2, 3, 2],
  [804, 1, 3, 2],
  [836, 1, 3, 2],
  [845, 1, 6, 2],
];

// Tutoriel : touches 3D animées flottant au-dessus du fond de la piste,
// une seule fois par geste, au premier obstacle concerné. Ils restent en place : on les revoit après une chute.
// [x, geste] — geste : 'space' (sauter) | 'shift' (se baisser) | 'updown' (couloir)
export const TUTORIAL_CUES = [
  [17, 'space'],
  [32, 'shift'],
  [84, 'updown'],
];

// Canettes de boost : [x, couloir] — placées sur le chemin des coquillages
const BOOSTS = [[176, 1], [370, 0], [603, 2], [812, 1]];

export function buildLevel() {
  const hazards = [];
  const waves = [];
  for (const [x, kind, lanes] of HAZARDS) {
    if (kind === 'wave') {
      waves.push({ x, lane: Number(lanes) });
      continue;
    }
    const spec = KINDS[kind];
    const lanesList = spec.all ? ['all'] : L(lanes);
    for (const lane of lanesList) hazards.push({ x, kind, lane, ...spec });
  }

  const pickups = [];
  for (const [x0, lane, n, gap] of SHELL_LINES) {
    for (let i = 0; i < n; i++) pickups.push({ kind: 'shell', x: x0 + i * gap, lane, y: 0.9 });
  }
  // un arc au-dessus de chaque vague, posé sur la trajectoire réelle du saut
  for (const w of waves) {
    const pts = waveFlight(w.x);
    for (const f of [0.18, 0.36, 0.54, 0.72]) {
      const [x, y] = pts[Math.round(f * (pts.length - 1))];
      pickups.push({ kind: 'shell', x, lane: w.lane, y: y + 0.9, bonus: true });
    }
  }
  for (const [x, lane] of BOOSTS) pickups.push({ kind: 'boost', x, lane, y: 1.0 });

  return { hazards, waves, pickups };
}
