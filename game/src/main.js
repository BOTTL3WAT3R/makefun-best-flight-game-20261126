// main.js — boots Skyharbor Run, runs the frame loop, and draws the
// title and result screens over render.js's scene. The simulation
// lives in flight.js, the coast in world.js; this file only wires
// input, audio and time together.

import { VIEW_WIDTH, VIEW_HEIGHT, PALETTE } from './config.js';
import { makeRng, seedFromQuery } from './random.js';
import { buildWorld } from './world.js';
import { createFlight, startSortie, stepFlight } from './flight.js';
import { drawScene } from './render.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { applyScene, shotNameFromQuery } from './scenes.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = VIEW_WIDTH;
canvas.height = VIEW_HEIGHT;

const seed = seedFromQuery(7);
const world = buildWorld(seed);
let state = createFlight(world);
const input = createInput(canvas);
const audio = createAudio();

const shot = shotNameFromQuery();
const staged = shot !== null;
if (staged) applyScene(state, world, shot);

// A whisper of life on staged frames: clouds still drift.
const cloudRng = makeRng(seed * 31 + 5);
void cloudRng;

function roundRectPath(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawTitle() {
  ctx.fillStyle = 'rgba(8,14,20,0.42)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd76a';
  ctx.font = '800 74px system-ui, sans-serif';
  ctx.fillText('SKYHARBOR RUN', VIEW_WIDTH / 2, 118);
  ctx.fillStyle = '#eaf4fb';
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText('Fly the Sable Coast mail run in the Kestrel K-7', VIEW_WIDTH / 2, 158);
  ctx.font = '500 19px system-ui, sans-serif';
  ctx.fillStyle = '#cfe3f2';
  ctx.fillText('Thread all 7 amber rings over the fields, the river and Port Mina —', VIEW_WIDTH / 2, 208);
  ctx.fillText('then bring her home and land on the north runway before the fuel runs dry.', VIEW_WIDTH / 2, 234);
  roundRectPath(VIEW_WIDTH / 2 - 330, 256, 660, 96, 12);
  ctx.fillStyle = 'rgba(10,17,24,0.72)';
  ctx.fill();
  ctx.fillStyle = '#eaf4fb';
  ctx.font = '600 18px system-ui, sans-serif';
  ctx.fillText('W / S or Shift / Ctrl — throttle      Arrows or mouse — steer', VIEW_WIDTH / 2, 284);
  ctx.fillText('F — flaps for a slow, steady approach      Watch the stall lamp', VIEW_WIDTH / 2, 312);
  ctx.fillText('Land gently on the runway: fast and hard bends the aeroplane', VIEW_WIDTH / 2, 340);
  ctx.fillStyle = '#ffd76a';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO FLY', VIEW_WIDTH / 2, 512);
  void PALETTE;
}

function drawResult() {
  const r = state.result;
  if (!r) return;
  ctx.fillStyle = 'rgba(8,14,20,0.45)';
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  roundRectPath(VIEW_WIDTH / 2 - 320, 190, 640, 250, 14);
  ctx.fillStyle = 'rgba(10,17,24,0.85)';
  ctx.fill();
  ctx.strokeStyle = state.phase === 'landed' ? PALETTE.good : PALETTE.warn;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = state.phase === 'landed' ? PALETTE.good : PALETTE.warn;
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText(r.grade.toUpperCase(), VIEW_WIDTH / 2, 258);
  ctx.fillStyle = '#fff';
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillText(r.title, VIEW_WIDTH / 2, 300);
  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillStyle = '#cfe3f2';
  ctx.fillText(r.detail, VIEW_WIDTH / 2, 336);
  ctx.fillStyle = '#ffd76a';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText(`SCORE ${r.score}`, VIEW_WIDTH / 2, 384);
  ctx.fillStyle = '#eaf4fb';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText('CLICK OR PRESS ENTER TO FLY AGAIN', VIEW_WIDTH / 2, 420);
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
  last = now;
  const t = now / 1000;

  const polled = input.poll(dt);
  const oneshot = input.consume();

  if (oneshot.confirm) {
    audio.start();
    if (state.phase === 'title') startSortie(state);
    else if (state.phase === 'landed' || state.phase === 'crashed') {
      state = createFlight(world);
      startSortie(state);
    }
  }

  if (!staged) {
    stepFlight(state, world, {
      pitch: polled.pitch,
      roll: polled.roll,
      throttleUp: polled.throttleUp,
      throttleDown: polled.throttleDown,
      flapsPressed: oneshot.flaps,
    }, dt);
    for (const c of world.clouds) {
      c.x += c.drift * dt;
      if (c.x > 5400) c.x = -5200;
    }
  } else {
    state.propSpin += dt * 14;
  }

  if (state.events && state.events.length) {
    for (const e of state.events) audio.handle(e);
    state.events.length = 0;
  }
  audio.update(state);

  drawScene(ctx, state, world, t);
  if (state.phase === 'title') drawTitle();
  if ((state.phase === 'landed' || state.phase === 'crashed') && state.result) drawResult();

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// For the maker's screenshot tooling and curious pilots.
window.__skyharbor = { get state() { return state; }, world };
