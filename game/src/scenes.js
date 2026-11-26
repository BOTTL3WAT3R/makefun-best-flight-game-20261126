// scenes.js — staged, deterministic frames for the maker's own
// screenshots (?shot=start|play|approach|end&seed=N). Each scene places
// the Kestrel in a real game state — the same state flight.js produces
// in play — and the renderer draws it exactly as it draws live play.

import { RUNWAY, MISSION } from './config.js';

function baseFlying(state) {
  state.phase = 'flying';
  state.onGround = false;
  return state;
}

export function applyScene(state, world, name) {
  if (name === 'start') {
    // On the threshold at dawn, engine idling, course ahead: the title
    // screen is drawn over this live scene by main.js. The nose is
    // angled a few degrees off the centreline so the strip runs out
    // from behind the aeroplane and reads in the cover frame.
    state.phase = 'title';
    state.heading = 0.38;
    state.throttle = 0.12;
    state.propSpin = 3;
    return state;
  }
  if (name === 'play') {
    // Mid-course: two rings banked, the third ahead and above the
    // port wing over the fields — placed 330 m out along the ring's
    // own facing, offset to starboard, so the ring reads in frame
    // instead of hiding behind the aeroplane.
    baseFlying(state);
    const ring = world.rings[2];
    const back = 330;
    const side = 110;
    state.x = ring.x - Math.sin(ring.facing) * back + Math.cos(ring.facing) * side;
    state.z = ring.z + Math.cos(ring.facing) * back + Math.sin(ring.facing) * side;
    state.alt = ring.alt - 22;
    // Fly the course line itself (not aimed at the ring) so the ring
    // sits off the aeroplane's shoulder in frame.
    state.heading = ring.facing;
    state.bank = -0.18;
    state.pitch = 0.08;
    state.speed = 56;
    state.throttle = 0.72;
    state.vspeed = 1.2;
    state.fuel = 57;
    state.ringsPassed = 2;
    state.nextRing = 2;
    state.score = 342;
    state.time = 86;
    state.propSpin = 9;
    return state;
  }
  if (name === 'approach') {
    // The sortie flown: on final for the north runway, flaps down,
    // the strip filling the windscreen.
    baseFlying(state);
    // Offset a wingspan to starboard of the centreline so the strip
    // ahead reads beside the aeroplane, not behind it.
    state.x = RUNWAY.centerX + 120;
    state.z = RUNWAY.centerZ + RUNWAY.length / 2 + 360;
    state.alt = 30;
    state.heading = 0;
    state.bank = 0.02;
    state.pitch = -0.06;
    state.speed = 32;
    state.throttle = 0.24;
    state.vspeed = -1.5;
    state.flaps = true;
    state.fuel = 19;
    state.ringsPassed = MISSION.ringCount;
    state.nextRing = MISSION.ringCount;
    state.score = 1210;
    state.time = 231;
    state.propSpin = 6;
    return state;
  }
  if (name === 'end') {
    // Rolled to a stop on the runway: the result panel is drawn over
    // this scene by main.js.
    state.phase = 'landed';
    state.x = RUNWAY.centerX;
    state.z = RUNWAY.centerZ - 60;
    state.alt = 0;
    state.heading = 0;
    state.speed = 0;
    state.throttle = 0;
    state.onGround = true;
    state.ringsPassed = MISSION.ringCount;
    state.nextRing = MISSION.ringCount;
    state.fuel = 17;
    state.time = 246;
    state.score = 1762;
    state.result = {
      grade: 'Grease job',
      title: 'Mail delivered — sortie complete',
      detail: `Rings ${MISSION.ringCount} of ${MISSION.ringCount} · landing Grease job (+400) · fuel bonus +68 · 246 s aloft`,
      score: 1762,
    };
    return state;
  }
  return state;
}

export function shotNameFromQuery() {
  try {
    return new URLSearchParams(window.location.search).get('shot');
  } catch {
    return null;
  }
}
