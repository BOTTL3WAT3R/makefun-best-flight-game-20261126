// flight.js — the Kestrel K-7's flight model and the sortie's rules:
// take off from Skyharbor, thread the ring course, mind the fuel, and
// put it back on the runway. Pure simulation, no DOM: main.js feeds it
// input and a timestep, render.js draws what it says, audio.js listens
// to its events.

import { PLANE, MISSION, RUNWAY } from './config.js';
import { groundHeightAt } from './world.js';

const DEG = Math.PI / 180;

export function createFlight(world) {
  return {
    phase: 'title', // title -> flying -> landed | crashed
    // Position and attitude. Altitude is metres above the plain.
    x: RUNWAY.centerX,
    z: RUNWAY.centerZ + RUNWAY.length / 2 - 40, // at the south threshold
    alt: 0,
    heading: 0, // toward -Z
    bank: 0,
    pitch: 0, // visual nose attitude, -1..1 of travel
    speed: 0,
    throttle: 0,
    vspeed: 0,
    flaps: false,
    onGround: true,
    // Sortie state.
    fuel: MISSION.startFuel,
    damage: 0,
    ringsPassed: 0,
    nextRing: 0,
    score: 0,
    time: 0,
    stall: false,
    gearWarning: false,
    result: null, // { grade, title, detail, score } once down
    events: [], // ring | stall-start | touchdown | crash | splash | win
    message: '',
    messageT: 0,
    propSpin: 0,
  };
}

function say(state, text, seconds = 3.2) {
  state.message = text;
  state.messageT = seconds;
}

export function startSortie(state) {
  state.phase = 'flying';
  say(state, 'Throttle up — lift her off and chase the amber ring.', 4);
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function angleDelta(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

function overRunway(state) {
  const dx = Math.abs(state.x - RUNWAY.centerX);
  const dz = Math.abs(state.z - RUNWAY.centerZ);
  return dx <= RUNWAY.width / 2 + 4 && dz <= RUNWAY.length / 2;
}

function touchdownGrade(state) {
  const sink = Math.abs(state.vspeed);
  const aligned = Math.abs(angleDelta(state.heading, RUNWAY.heading)) < 22 * DEG;
  if (!overRunway(state)) return null;
  if (!aligned) return { grade: 'Off-heading', bonus: 40 };
  if (sink <= MISSION.perfectTouchdown.maxSink && state.speed <= MISSION.perfectTouchdown.maxSpeed)
    return { grade: 'Grease job', bonus: 400 };
  if (sink <= MISSION.smoothTouchdown.maxSink && state.speed <= MISSION.smoothTouchdown.maxSpeed)
    return { grade: 'Smooth', bonus: 250 };
  return { grade: 'Firm', bonus: 100 };
}

function crash(state, why) {
  state.phase = 'crashed';
  state.damage = 100;
  state.events.push('crash');
  state.result = {
    grade: 'Crashed',
    title: why,
    detail: `Rings ${state.ringsPassed} of ${MISSION.ringCount} · score ${Math.round(state.score)}`,
    score: Math.round(state.score),
  };
}

function finishLanding(state, grade) {
  state.phase = 'landed';
  state.onGround = true;
  state.alt = groundHeightAt(state.world, state.x, state.z);
  state.events.push('touchdown');
  const fuelBonus = Math.round(state.fuel) * 4;
  const complete = state.ringsPassed >= MISSION.ringCount;
  const total = Math.round(state.score) + grade.bonus + (complete ? fuelBonus : 0);
  state.events.push(complete ? 'win' : 'touchdown');
  state.result = {
    grade: grade.grade,
    title: complete ? 'Mail delivered — sortie complete' : 'Down early — course unfinished',
    detail:
      `Rings ${state.ringsPassed} of ${MISSION.ringCount} · landing ${grade.grade} (+${grade.bonus})` +
      (complete ? ` · fuel bonus +${fuelBonus}` : '') +
      ` · ${state.time.toFixed(0)} s aloft`,
    score: total,
  };
  state.score = total;
}

export function stepFlight(state, world, input, dt) {
  state.world = world;
  if (state.phase !== 'flying') return state;
  state.time += dt;
  if (state.messageT > 0) state.messageT -= dt;

  // Throttle and fuel.
  if (input.throttleUp) state.throttle = clamp(state.throttle + PLANE.throttleRate * dt, 0, 1);
  if (input.throttleDown) state.throttle = clamp(state.throttle - PLANE.throttleRate * dt, 0, 1);
  if (input.flapsPressed) {
    state.flaps = !state.flaps;
    say(state, state.flaps ? 'Flaps down — slower, steadier.' : 'Flaps up.', 1.6);
  }
  const burn = PLANE.fuelBurnAtIdle + (PLANE.fuelBurnAtFull - PLANE.fuelBurnAtIdle) * state.throttle;
  state.fuel = Math.max(0, state.fuel - burn * dt);
  if (state.fuel <= 0) state.throttle = 0;

  // Roll and pitch ease toward the pilot's hands.
  const targetBank = input.roll * PLANE.maxBankDeg * DEG;
  const bankStep = PLANE.bankRateDeg * DEG * dt;
  state.bank += clamp(targetBank - state.bank, -bankStep, bankStep);
  const targetPitch = input.pitch;
  state.pitch += clamp(targetPitch - state.pitch, -dt * 2.4, dt * 2.4);

  // Heading follows bank; a wing down is a turn. Bank is negative to
  // port (roll input -1), and heading grows toward starboard, so the
  // turn term takes the bank's own sign: left bank, heading falls.
  const speedFactor = clamp(state.speed / PLANE.cruiseSpeed, 0.25, 1.25);
  state.heading += Math.sin(state.bank) * PLANE.turnRateAtBank * speedFactor * dt * 1.9;

  // Speed: the engine pulls, drag and the climb push back.
  const thrust = state.throttle * PLANE.accel;
  const drag = PLANE.drag * state.speed * state.speed;
  const climbCost = state.pitch * 5.2 * (state.pitch > 0 ? 1 : 0.55);
  state.speed = clamp(state.speed + (thrust - drag - climbCost) * dt, 0, PLANE.maxSpeed);
  if (state.onGround && !state.flaps) state.speed = clamp(state.speed, 0, PLANE.maxSpeed);

  // Vertical speed: pitch asks, lift and the stall decide.
  const lift = clamp(state.speed / PLANE.stallSpeed, 0, 1.3);
  const wasStalled = state.stall;
  state.stall = !state.onGround && state.speed < PLANE.stallSpeed + 3;
  if (state.stall && !wasStalled) state.events.push('stall-start');
  let climb = state.pitch * PLANE.climbAtCruise * Math.min(1, lift);
  climb -= PLANE.sinkAtIdle * (1 - state.throttle * 0.72) * (state.flaps ? 0.62 : 1);
  if (state.stall) climb -= 6.5;
  if (state.onGround) climb = Math.max(0, climb);
  state.vspeed = climb;
  state.alt += state.vspeed * dt;

  // Travel.
  const vx = Math.sin(state.heading) * state.speed;
  const vz = -Math.cos(state.heading) * state.speed;
  state.x += vx * dt;
  state.z += vz * dt;
  state.propSpin += dt * (2 + state.throttle * 38 + state.speed * 0.22);

  const ground = groundHeightAt(world, state.x, state.z);
  const overSea = ground < 0;

  if (state.alt <= ground) {
    state.alt = ground;
    if (!state.onGround) {
      // Touchdown moment: judge it.
      if (overSea) {
        state.events.push('splash');
        crash(state, 'Ditched in the Sable Sea');
        return state;
      }
      const grade = touchdownGrade(state);
      if (grade && Math.abs(state.vspeed) <= MISSION.smoothTouchdown.maxSink + 1.4 && state.speed <= 58) {
        finishLanding(state, grade);
        return state;
      }
      if (Math.abs(state.vspeed) > 7.5 || state.speed > 62) {
        crash(state, grade ? 'Too fast, too hard — the gear folded' : 'Came down off the field');
        return state;
      }
      state.damage = Math.min(100, state.damage + 12);
      say(state, 'Rough arrival — the Kestrel is bent but flying.', 3);
    }
    state.onGround = state.speed < PLANE.stallSpeed + 6 || state.alt <= ground;
    if (state.speed >= PLANE.stallSpeed + 6 && state.pitch > 0.25) state.onGround = false;
  } else if (state.alt > ground + 1.2) {
    state.onGround = false;
  }

  // Buildings are unforgiving.
  if (!state.onGround) {
    for (const b of world.town) {
      if (state.alt < b.h + (b.tower || b.roof) && Math.abs(state.x - b.x) < b.w / 2 && Math.abs(state.z - b.z) < b.d / 2) {
        crash(state, 'Clipped a Port Mina rooftop');
        return state;
      }
    }
    if (state.alt < world.lighthouse.h && Math.abs(state.x - world.lighthouse.x) < 9 && Math.abs(state.z - world.lighthouse.z) < 9) {
      crash(state, 'Flew into the lighthouse');
      return state;
    }
  }

  // Rings: flying through the middle of the next amber ring banks it.
  const ring = world.rings[state.nextRing];
  if (ring) {
    const dx = state.x - ring.x;
    const dz = state.z - ring.z;
    const dy = state.alt - ring.alt;
    const dist = Math.sqrt(dx * dx + dz * dz + dy * dy);
    if (dist < MISSION.ringRadius + 10) {
      state.ringsPassed += 1;
      state.nextRing += 1;
      state.score += MISSION.ringPoints + Math.max(0, 40 - Math.round(dist));
      state.events.push('ring');
      if (state.nextRing >= world.rings.length) {
        say(state, 'Course complete — bring her home to Skyharbor and land north.', 5);
      } else {
        say(state, `Ring ${state.ringsPassed} banked. Next ring marked amber.`, 2.4);
      }
    }
  }

  // World edge: turn the pilot around gently rather than losing them.
  const edge = 4300;
  if (Math.abs(state.x) > edge || Math.abs(state.z) > edge) {
    say(state, 'Open water and empty sky that way — head back to the coast.', 2.5);
    state.heading += angleDelta(Math.atan2(-state.x, state.z), state.heading) * dt * 0.4;
  }

  return state;
}
