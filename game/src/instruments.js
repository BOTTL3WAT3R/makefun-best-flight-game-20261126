// instruments.js — the Kestrel's lit cockpit and the HUD the brief asks
// for: altitude, speed and heading always readable, plus an artificial
// horizon, a fuel gauge, throttle and flap state, and stall/fuel lamps.
// Everything is drawn on the same canvas over render.js's scene.

import { VIEW_WIDTH, VIEW_HEIGHT, PALETTE, PLANE, MISSION } from './config.js';

const PANEL_H = 184;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function gaugeShell(ctx, cx, cy, r, label) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.gaugeFace;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r - 4, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = PALETTE.gaugeMark;
  ctx.font = `600 ${Math.round(r * 0.26)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + r * 0.62);
}

function ticks(ctx, cx, cy, r, from, to, count, labelEvery, fmt) {
  ctx.strokeStyle = PALETTE.gaugeMark;
  ctx.fillStyle = PALETTE.gaugeMark;
  ctx.font = `600 ${Math.round(r * 0.24)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= count; i++) {
    const a = from + ((to - from) * i) / count;
    const c = Math.cos(a);
    const s = Math.sin(a);
    ctx.beginPath();
    ctx.moveTo(cx + c * (r - 5), cy + s * (r - 5));
    ctx.lineTo(cx + c * (r - 11), cy + s * (r - 11));
    ctx.lineWidth = 2;
    ctx.stroke();
    if (fmt && i % labelEvery === 0) {
      ctx.fillText(fmt(i), cx + c * (r - 22), cy + s * (r - 22));
    }
  }
  ctx.textBaseline = 'alphabetic';
}

function needle(ctx, cx, cy, r, angle, colour = PALETTE.gaugeNeedle) {
  ctx.beginPath();
  ctx.moveTo(cx - Math.cos(angle) * 6, cy - Math.sin(angle) * 6);
  ctx.lineTo(cx + Math.cos(angle) * (r - 14), cy + Math.sin(angle) * (r - 14));
  ctx.strokeStyle = colour;
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 4.4, 0, Math.PI * 2);
  ctx.fillStyle = '#dfe7ee';
  ctx.fill();
}

// Dial angles run from 135 degrees (min) clockwise to 405 (max).
function dialAngle(frac) {
  return (135 + 270 * Math.min(1, Math.max(0, frac))) * (Math.PI / 180);
}

function drawAirspeed(ctx, cx, cy, r, state) {
  gaugeShell(ctx, cx, cy, r, 'KM/H');
  const start = 135 * (Math.PI / 180);
  const end = 405 * (Math.PI / 180);
  ticks(ctx, cx, cy, r, start, end, 8, 2, (i) => String(i * 40));
  // Stall band in red, cruise band in green.
  ctx.beginPath();
  ctx.arc(cx, cy, r - 8, dialAngle(0), dialAngle((PLANE.stallSpeed * 3.6) / 320));
  ctx.strokeStyle = PALETTE.warn;
  ctx.lineWidth = 4;
  ctx.stroke();
  needle(ctx, cx, cy, r, dialAngle((state.speed * 3.6) / 320));
}

function drawAltimeter(ctx, cx, cy, r, state) {
  gaugeShell(ctx, cx, cy, r, 'ALT m');
  const start = 135 * (Math.PI / 180);
  const end = 405 * (Math.PI / 180);
  ticks(ctx, cx, cy, r, start, end, 8, 2, (i) => String(i * 100));
  needle(ctx, cx, cy, r, dialAngle(state.alt / 800));
  ctx.fillStyle = PALETTE.gaugeMark;
  ctx.font = `700 ${Math.round(r * 0.3)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(String(Math.max(0, Math.round(state.alt))), cx, cy - r * 0.34);
}

function drawHorizon(ctx, cx, cy, r, state) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = PALETTE.gaugeFace;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.translate(cx, cy);
  ctx.rotate(-state.bank);
  const pitchPx = state.pitch * r * 0.55 + state.vspeed * 1.1;
  ctx.fillStyle = '#3a7cc2';
  ctx.fillRect(-r, -r + pitchPx, r * 2, r * 2);
  ctx.fillStyle = '#7a5a36';
  ctx.fillRect(-r, pitchPx, r * 2, r * 2);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r, pitchPx);
  ctx.lineTo(r, pitchPx);
  ctx.stroke();
  for (const off of [-18, 18]) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.4, pitchPx + off);
    ctx.lineTo(r * 0.4, pitchPx + off);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.stroke();
  }
  ctx.restore();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  // The fixed aircraft symbol.
  ctx.strokeStyle = PALETTE.gaugeNeedle;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.52, cy);
  ctx.lineTo(cx - r * 0.16, cy);
  ctx.lineTo(cx - r * 0.16, cy + 5);
  ctx.moveTo(cx + r * 0.52, cy);
  ctx.lineTo(cx + r * 0.16, cy);
  ctx.lineTo(cx + r * 0.16, cy + 5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.gaugeNeedle;
  ctx.fill();
  ctx.fillStyle = PALETTE.gaugeMark;
  ctx.font = `600 ${Math.round(r * 0.24)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('HORIZON', cx, cy + r + 14);
}

function drawCompass(ctx, cx, cy, w, state) {
  // A heading strip: the card slides under a fixed lubber line.
  const hdg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
  roundRect(ctx, cx - w / 2, cy - 17, w, 34, 8);
  ctx.fillStyle = PALETTE.gaugeFace;
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - w / 2 + 3, cy - 14, w - 6, 28);
  ctx.clip();
  ctx.fillStyle = PALETTE.gaugeMark;
  ctx.font = '700 15px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
  for (let d = -60; d <= 420; d += 15) {
    const rel = d - hdg;
    if (Math.abs(rel) > 58) continue;
    const x = cx + (rel / 58) * (w / 2 - 8);
    if (d % 45 === 0) {
      const key = ((d % 360) + 360) % 360;
      ctx.fillText(names[key] || String(key), x, cy + 5);
    } else {
      ctx.fillRect(x - 1, cy - 8, 2, 8);
    }
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.gaugeNeedle;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 21);
  ctx.lineTo(cx + 6, cy - 21);
  ctx.lineTo(cx, cy - 12);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.gaugeMark;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`HDG ${String(Math.round(hdg)).padStart(3, '0')}°`, cx, cy + 32);
}

function drawFuelAndThrottle(ctx, x, y, state) {
  // Fuel and throttle as two lit bars under the compass strip; the
  // whole block is laid out to end inside the panel.
  ctx.fillStyle = PALETTE.gaugeMark;
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('FUEL', x, y);
  roundRect(ctx, x, y + 5, 118, 12, 6);
  ctx.fillStyle = PALETTE.gaugeFace;
  ctx.fill();
  const frac = state.fuel / MISSION.startFuel;
  ctx.fillStyle = frac < 0.22 ? PALETTE.warn : PALETTE.good;
  if (frac > 0.01) {
    roundRect(ctx, x + 2, y + 7, Math.max(6, (118 - 4) * Math.min(1, frac)), 8, 4);
    ctx.fill();
  }
  ctx.fillStyle = PALETTE.gaugeMark;
  ctx.fillText('THROTTLE', x, y + 36);
  roundRect(ctx, x, y + 41, 118, 12, 6);
  ctx.fillStyle = PALETTE.gaugeFace;
  ctx.fill();
  ctx.fillStyle = PALETTE.gaugeNeedle;
  if (state.throttle > 0.01) {
    roundRect(ctx, x + 2, y + 43, (118 - 4) * state.throttle, 8, 4);
    ctx.fill();
  }
}

function lamp(ctx, x, y, label, on, colour) {
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.fillStyle = on ? colour : '#2c333d';
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.stroke();
  ctx.fillStyle = on ? colour : '#7d8894';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, x + 13, y + 4);
}

export function drawCockpit(ctx, state) {
  const y0 = VIEW_HEIGHT - PANEL_H;
  // The panel: a dark glareshield sweeping across the bottom of frame.
  ctx.beginPath();
  ctx.moveTo(0, VIEW_HEIGHT);
  ctx.lineTo(0, y0 + 34);
  ctx.quadraticCurveTo(VIEW_WIDTH / 2, y0 - 26, VIEW_WIDTH, y0 + 34);
  ctx.lineTo(VIEW_WIDTH, VIEW_HEIGHT);
  ctx.closePath();
  ctx.fillStyle = PALETTE.panel;
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();

  const cy = y0 + 94;
  drawAirspeed(ctx, 130, cy, 56, state);
  drawHorizon(ctx, 300, cy - 6, 52, state);
  drawAltimeter(ctx, 472, cy, 56, state);
  drawCompass(ctx, 660, cy - 36, 210, state);
  drawFuelAndThrottle(ctx, 596, cy + 24, state);
  lamp(ctx, 880, cy - 34, 'STALL', state.stall, PALETTE.warn);
  lamp(ctx, 880, cy - 4, 'FUEL LOW', state.fuel < MISSION.startFuel * 0.22, PALETTE.warn);
  lamp(ctx, 880, cy + 26, 'GEAR · FIXED', true, PALETTE.good);
  lamp(ctx, 1030, cy - 34, 'RING', state.nextRing < 7, PALETTE.gaugeNeedle);
  lamp(ctx, 1030, cy - 4, 'HOME', state.nextRing >= 7, PALETTE.good);
  lamp(ctx, 1030, cy + 26, 'FLAPS', state.flaps, PALETTE.gaugeNeedle);
  ctx.fillStyle = '#98a5b1';
  ctx.font = '600 12px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('KESTREL K-7 · SABLE COAST AIR MAIL', 1030, cy + 56);
}

function bearingTo(state, target) {
  const dx = target.x - state.x;
  const dz = target.z - state.z;
  const world = Math.atan2(dx, -dz);
  let rel = world - state.heading;
  while (rel > Math.PI) rel -= Math.PI * 2;
  while (rel < -Math.PI) rel += Math.PI * 2;
  return { rel, dist: Math.hypot(dx, dz, (target.alt || 0) - state.alt) };
}

export function drawHud(ctx, state, world, t) {
  // Top-left mission block and top-right score block: the big readable
  // numbers the brief asks for, kept off the middle of the view.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(10,16,22,0.55)';
  roundRect(ctx, 18, 16, 252, 104, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 21px system-ui, sans-serif';
  ctx.fillText(`ALT ${Math.max(0, Math.round(state.alt))} m`, 34, 48);
  ctx.fillText(`SPD ${Math.round(state.speed * 3.6)} km/h`, 34, 78);
  const hdg = ((state.heading * 180) / Math.PI % 360 + 360) % 360;
  ctx.fillText(`HDG ${String(Math.round(hdg)).padStart(3, '0')}°`, 34, 108);

  ctx.fillStyle = 'rgba(10,16,22,0.55)';
  roundRect(ctx, VIEW_WIDTH - 268, 16, 250, 104, 10);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = '700 21px system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`SCORE ${Math.round(state.score)}`, VIEW_WIDTH - 34, 48);
  ctx.fillText(`RINGS ${state.ringsPassed}/${world.rings.length}`, VIEW_WIDTH - 34, 78);
  ctx.fillText(`TIME ${state.time.toFixed(0)} s`, VIEW_WIDTH - 34, 108);
  ctx.textAlign = 'left';

  // A guide arrow and range to the next objective, top centre.
  const target = state.nextRing < world.rings.length
    ? world.rings[state.nextRing]
    : { x: world.runway.centerX, z: world.runway.centerZ, alt: 0 };
  const { rel, dist } = bearingTo(state, target);
  const cx = VIEW_WIDTH / 2;
  ctx.save();
  ctx.translate(cx, 44);
  ctx.rotate(Math.max(-1.1, Math.min(1.1, rel)));
  ctx.fillStyle = state.nextRing < world.rings.length ? PALETTE.ringNext : PALETTE.good;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.lineTo(10, 10);
  ctx.lineTo(0, 4);
  ctx.lineTo(-10, 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.textAlign = 'center';
  const label = state.nextRing < world.rings.length ? `RING ${state.nextRing + 1}` : 'LAND · RWY N';
  ctx.fillText(`${label} · ${Math.round(dist)} m`, cx, 82);

  // The sortie message banner, fading with its timer.
  if (state.message && state.messageT > 0) {
    ctx.globalAlpha = Math.min(1, state.messageT);
    ctx.fillStyle = 'rgba(10,16,22,0.66)';
    const w = ctx.measureText(state.message).width + 44;
    roundRect(ctx, cx - w / 2, VIEW_HEIGHT - PANEL_H - 52, w, 36, 9);
    ctx.fill();
    ctx.fillStyle = '#ffe9b0';
    ctx.font = '600 16px system-ui, sans-serif';
    ctx.fillText(state.message, cx, VIEW_HEIGHT - PANEL_H - 29);
    ctx.globalAlpha = 1;
  }
  void t;
}
