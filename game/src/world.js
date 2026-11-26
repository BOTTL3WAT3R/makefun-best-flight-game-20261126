// world.js — builds the Sable Coast: the patchwork fields, the River
// Sable, Port Mina town, the lighthouse point, the ring course and the
// hills on the horizon. Pure data, no DOM: given a seed it returns the
// same coast every time, and flight.js / render.js read it.

import { WORLD_HALF, RUNWAY, MISSION } from './config.js';
import { makeRng } from './random.js';

// The sea lies to the east: ground east of the coastline is water.
export const COAST_X = 1500;

// World axes: +X east, +Z south, -Z north. Heading 0 flies toward -Z.

function buildFields(rng) {
  // A patchwork of farm fields west of the coast, laid on a loose grid
  // with jitter so it reads as farmland, not graph paper. The runway
  // strip and the town plot are kept clear.
  const fields = [];
  const kinds = ['wheat', 'plough', 'meadow', 'orchard', 'grassA', 'grassB'];
  const cell = 420;
  for (let gx = -WORLD_HALF; gx < COAST_X - 120; gx += cell) {
    for (let gz = -WORLD_HALF; gz < WORLD_HALF; gz += cell) {
      const x = gx + rng.range(-26, 26);
      const z = gz + rng.range(-26, 26);
      const w = cell - rng.range(18, 60);
      const d = cell - rng.range(18, 60);
      if (Math.abs(x - RUNWAY.centerX) < 190 && Math.abs(z - RUNWAY.centerZ) < 480) continue;
      if (x > 620 && x < 1420 && z > 180 && z < 980) continue; // Port Mina plot
      if (Math.abs(z - riverZAt(x)) < 150) continue; // the river cuts through
      fields.push({ x, z, w, d, kind: rng.pick(kinds), shade: rng.range(-0.07, 0.07) });
    }
  }
  return fields;
}

// The River Sable runs south-to-north in a lazy S and empties into the
// sea at the north-east. Its centreline is a function of x so fields and
// the renderer agree on where the water is.
export function riverZAt(x) {
  return 1250 * Math.sin(x * 0.00042 + 0.6) - 500;
}

function buildRiver() {
  const segments = [];
  const step = 260;
  for (let x = -WORLD_HALF; x < COAST_X + 300; x += step) {
    segments.push({ x: x + step / 2, z: riverZAt(x + step / 2), halfWidth: 74 });
  }
  return segments;
}

function buildTown(rng) {
  // Port Mina: two streets of houses with pitched roofs, a church with a
  // tower, and a small harbour warehouse row near the shore.
  const buildings = [];
  const streetsX = [860, 1060, 1260];
  for (const sx of streetsX) {
    for (let z = 300; z < 940; z += 92) {
      if (rng.chance(0.14)) continue;
      buildings.push({
        x: sx + rng.range(-16, 16),
        z: z + rng.range(-12, 12),
        w: rng.range(30, 46),
        d: rng.range(28, 42),
        h: rng.range(11, 19),
        roof: rng.range(4, 7),
        tone: rng.range(-0.05, 0.08),
      });
    }
  }
  buildings.push({ x: 1060, z: 120, w: 34, d: 52, h: 17, roof: 6, tone: 0.02, tower: 34 });
  buildings.push({ x: 1380, z: 620, w: 90, d: 30, h: 13, roof: 3, tone: -0.02 });
  buildings.push({ x: 1380, z: 700, w: 70, d: 30, h: 11, roof: 3, tone: 0.03 });
  return buildings;
}

function buildHills(rng) {
  // Two rings of hills: a far silhouette range all around the horizon
  // (lower over the sea) and nearer wooded hills inland to the west.
  const far = [];
  const near = [];
  for (let a = 0; a < Math.PI * 2; a += 0.11) {
    const overSea = Math.sin(a) > 0.35;
    far.push({
      angle: a,
      dist: WORLD_HALF + rng.range(1500, 2600),
      height: overSea ? rng.range(60, 160) : rng.range(320, 640),
      width: rng.range(700, 1300),
    });
  }
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * 0.62 + i * 0.11 + rng.range(-0.03, 0.03);
    near.push({
      angle: a,
      dist: rng.range(2900, 3600),
      height: rng.range(150, 300),
      width: rng.range(620, 980),
    });
  }
  return { far, near };
}

function buildRingCourse(rng) {
  // A tour of the coast: out over the fields, across the river, a gate
  // off the lighthouse, one over Port Mina, then home. Each ring faces
  // the direction of travel so the pilot flies through its middle.
  const anchors = [
    { x: -260, z: -2350, alt: 210 },
    { x: -1150, z: -3050, alt: 300 },
    { x: -2050, z: -1900, alt: 260 },
    { x: -1500, z: -350, alt: 330 },
    { x: 250, z: 350, alt: 240 },
    { x: 1350, z: -500, alt: 200 },
    { x: 700, z: -1650, alt: 190 },
  ];
  const rings = anchors.slice(0, MISSION.ringCount).map((p, i, all) => {
    const prev = i === 0 ? { x: RUNWAY.centerX, z: RUNWAY.centerZ - 500 } : all[i - 1];
    const next = i === all.length - 1 ? { x: RUNWAY.centerX, z: RUNWAY.centerZ } : all[i + 1];
    const facing = Math.atan2(next.x - prev.x, -(next.z - prev.z));
    return { ...p, facing, index: i, jitter: rng.range(-14, 14) };
  });
  return rings;
}

function buildTrees(rng) {
  // Copses along the river banks and in field corners: from the air
  // they are the dark green punctuation that makes the coast read as
  // a real place rather than a quilt.
  const copses = [];
  for (let x = -3600; x < COAST_X - 200; x += 300) {
    if (rng.chance(0.72)) {
      copses.push({ x: x + rng.range(-50, 50), z: riverZAt(x) + rng.pick([-1, 1]) * rng.range(105, 150), r: rng.range(16, 30) });
    }
  }
  for (let i = 0; i < 20; i++) {
    const x = rng.range(-3800, 1100);
    const z = rng.range(-3800, 3800);
    if (Math.abs(x - RUNWAY.centerX) < 260 && Math.abs(z - RUNWAY.centerZ) < 560) continue;
    if (x > 560 && x < 1500 && z > 120 && z < 1040) continue;
    copses.push({ x, z, r: rng.range(13, 26) });
  }
  return copses;
}

function buildClouds(rng) {
  const clouds = [];
  for (let i = 0; i < 42; i++) {
    clouds.push({
      x: rng.range(-WORLD_HALF, WORLD_HALF + 900),
      z: rng.range(-WORLD_HALF, WORLD_HALF),
      alt: rng.range(420, 760),
      size: rng.range(120, 340),
      drift: rng.range(1.2, 3.4),
    });
  }
  return clouds;
}

export function buildWorld(seed) {
  const rng = makeRng(seed);
  return {
    seed,
    fields: buildFields(rng),
    river: buildRiver(),
    town: buildTown(rng),
    hills: buildHills(rng),
    rings: buildRingCourse(rng),
    trees: buildTrees(rng),
    clouds: buildClouds(rng),
    lighthouse: { x: 1560, z: -980, h: 46 },
    runway: { ...RUNWAY },
  };
}

// Ground height at a point: the plain is flat, the hills rise only in
// their skirts near the world edge, and the sea is a touch below.
export function groundHeightAt(world, x, z) {
  if (x > COAST_X + 60) return -2;
  let h = 0;
  for (const hill of world.hills.near) {
    const hx = Math.sin(hill.angle) * hill.dist;
    const hz = -Math.cos(hill.angle) * hill.dist;
    const dx = x - hx;
    const dz = z - hz;
    const d2 = dx * dx + dz * dz;
    const r = hill.width * 1.6;
    if (d2 < r * r) h = Math.max(h, hill.height * (1 - Math.sqrt(d2) / r) * 0.55);
  }
  return h;
}
