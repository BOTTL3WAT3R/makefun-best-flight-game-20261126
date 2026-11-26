// random.js — a small seeded random generator (mulberry32) so the coast,
// the ring course and the screenshot scenes are the same on every load
// for a given seed. The game never calls Math.random for world building.

export function makeRng(seed) {
  let state = (seed >>> 0) || 1;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    range(min, max) {
      return min + next() * (max - min);
    },
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    pick(list) {
      return list[Math.floor(next() * list.length)];
    },
    chance(p) {
      return next() < p;
    },
  };
}

// A stable numeric seed from the page query (?seed=) or the default
// sortie. Screenshot scenes pin this so their frames are reproducible.
// A word works too (?seed=dawn-patrol): it is hashed, so a named
// sortie is the same coast every time it is flown.
export function seedFromQuery(fallback = 7) {
  try {
    const raw = new URLSearchParams(window.location.search).get('seed');
    if (raw === null || raw === '') return fallback;
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && String(n) === raw.trim()) return n;
    let h = 2166136261;
    for (let i = 0; i < raw.length; i++) {
      h ^= raw.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) % 100000;
  } catch {
    return fallback;
  }
}
