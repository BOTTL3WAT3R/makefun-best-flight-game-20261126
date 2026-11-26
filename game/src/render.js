// render.js — draws the Sable Coast from the chase camera behind the
// Kestrel: sky, hills, patchwork fields, the river, Port Mina, the ring
// course and the home runway, all projected from world.js data with a
// plain perspective divide. The aeroplane itself is drawn as a detailed
// canvas sprite that banks and pitches with flight.js's state.

import { VIEW_WIDTH, VIEW_HEIGHT, PALETTE, RUNWAY } from './config.js';
import { COAST_X } from './world.js';
import { drawCockpit, drawHud } from './instruments.js';

const FOCAL = 830; // px, for a ~75 degree horizontal field of view
const NEAR = 7;

function shade(hex, amt) {
  const n = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, (n >> 16) + amt * 255));
  const g = Math.min(255, Math.max(0, ((n >> 8) & 0xff) + amt * 255));
  const b = Math.min(255, Math.max(0, (n & 0xff) + amt * 255));
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

// A camera is rebuilt each frame from the flight state. It rides a
// few metres above the aeroplane's own altitude — a chase camera on
// the fin — so the ground plane reads below the horizon even when
// the Kestrel is sitting on it.
export function makeCamera(state) {
  const h = state.heading;
  return {
    x: state.x,
    z: state.z,
    alt: state.alt + 7,
    fx: Math.sin(h),
    fz: -Math.cos(h),
    rx: Math.cos(h),
    rz: Math.sin(h),
    bank: state.bank,
    pitch: state.pitch,
    horizonY: VIEW_HEIGHT * 0.54 + state.pitch * 46 - Math.abs(state.bank) * 12,
  };
}

// World point -> screen point, or null when behind the camera.
export function project(cam, wx, wy, wz) {
  const dx = wx - cam.x;
  const dz = wz - cam.z;
  const cx = dx * cam.rx + dz * cam.rz;
  const cz = dx * cam.fx + dz * cam.fz;
  if (cz < NEAR) return null;
  return projectParts(cam, cx, wy - cam.alt, cz);
}

// Like project, but for ground features that may cross the camera
// plane (the runway under the aeroplane, the field it sits in): the
// point is pulled onto the near plane instead of dropped, so a big
// ground polygon never vanishes whole as the camera passes over it.
export function projectGround(cam, wx, wy, wz) {
  const dx = wx - cam.x;
  const dz = wz - cam.z;
  let cx = dx * cam.rx + dz * cam.rz;
  let cz = dx * cam.fx + dz * cam.fz;
  let cy = wy - cam.alt;
  if (cz < NEAR) {
    if (cz > 0.5) {
      const k = NEAR / cz;
      cx *= k;
      cy *= k;
    } else {
      cx = Math.max(-4200, Math.min(4200, cx));
    }
    cz = NEAR;
  }
  return projectParts(cam, cx, cy, cz);
}

function projectParts(cam, cx, cy, cz) {
  const s = FOCAL / cz;
  let sx = VIEW_WIDTH / 2 + cx * s;
  let sy = cam.horizonY - cy * s;
  // Roll the world a little against the bank so turns feel flown.
  const roll = cam.bank * 0.42;
  const ox = sx - VIEW_WIDTH / 2;
  const oy = sy - cam.horizonY;
  sx = VIEW_WIDTH / 2 + ox * Math.cos(roll) - oy * Math.sin(roll);
  sy = cam.horizonY + ox * Math.sin(roll) + oy * Math.cos(roll);
  return { x: sx, y: sy, scale: s, depth: cz };
}

function poly(ctx, pts, fill) {
  if (pts.some((p) => p === null)) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function groundQuad(ctx, cam, x, z, w, d, fill) {
  const hw = w / 2;
  const hd = d / 2;
  poly(ctx, [
    projectGround(cam, x - hw, 0, z - hd),
    projectGround(cam, x + hw, 0, z - hd),
    projectGround(cam, x + hw, 0, z + hd),
    projectGround(cam, x - hw, 0, z + hd),
  ], fill);
}

function drawSky(ctx, cam, t) {
  const g = ctx.createLinearGradient(0, 0, 0, cam.horizonY + 90);
  g.addColorStop(0, PALETTE.skyTop);
  g.addColorStop(0.62, PALETTE.skyMid);
  g.addColorStop(1, PALETTE.skyHorizon);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_WIDTH, VIEW_HEIGHT);
  // The morning sun, fixed off the port bow.
  const sun = project(cam, cam.x + cam.fx * 6000 - cam.rx * 2600, 1500, cam.z + cam.fz * 6000 - cam.rz * 2600);
  if (sun) {
    const rg = ctx.createRadialGradient(sun.x, sun.y, 4, sun.x, sun.y, 120);
    rg.addColorStop(0, 'rgba(255,246,200,0.95)');
    rg.addColorStop(0.25, 'rgba(255,238,170,0.55)');
    rg.addColorStop(1, 'rgba(255,238,170,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(sun.x - 130, sun.y - 130, 260, 260);
  }
  void t;
}

function drawHillSilhouettes(ctx, cam, hills, colour, lift) {
  // Far hills are drawn as a rolling silhouette pinned to the horizon:
  // each hill contributes a soft peak at its bearing.
  ctx.beginPath();
  ctx.moveTo(-60, cam.horizonY + 4);
  const steps = 42;
  for (let i = 0; i <= steps; i++) {
    const sx = (i / steps) * (VIEW_WIDTH + 120) - 60;
    // bearing of this screen column
    const cx = (sx - VIEW_WIDTH / 2) / FOCAL;
    const bearing = Math.atan2(cx * cam.rx + cam.fx, cx * cam.rz + cam.fz);
    let top = cam.horizonY + 4;
    for (const hill of hills) {
      let d = bearing - hill.angle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      const half = hill.width / hill.dist;
      if (Math.abs(d) < half) {
        const bump = Math.cos((d / half) * (Math.PI / 2));
        const y = cam.horizonY - hill.height * (FOCAL / hill.dist) * bump * lift + 4;
        if (y < top) top = y;
      }
    }
    ctx.lineTo(sx, top);
  }
  ctx.lineTo(VIEW_WIDTH + 60, cam.horizonY + 6);
  ctx.closePath();
  ctx.fillStyle = colour;
  ctx.fill();
}

function drawGroundBase(ctx, cam) {
  // The coastal plain to the horizon, then the sea east of the coast.
  ctx.fillStyle = PALETTE.grassA;
  ctx.fillRect(0, cam.horizonY - 2, VIEW_WIDTH, VIEW_HEIGHT - cam.horizonY + 2);
  const a = project(cam, COAST_X, 0, cam.z - 4000);
  const b = project(cam, COAST_X, 0, cam.z + 4000);
  if (a && b) {
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(VIEW_WIDTH + 80, cam.horizonY - 2);
    ctx.lineTo(VIEW_WIDTH + 80, VIEW_HEIGHT);
    ctx.lineTo(b.x, b.y);
    ctx.closePath();
    ctx.fillStyle = PALETTE.sea;
    ctx.fill();
    // The sandy shore line.
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineWidth = 7;
    ctx.strokeStyle = PALETTE.sand;
    ctx.stroke();
  }
}

function drawBuilding(ctx, cam, b) {
  const top = b.h + (b.tower || b.roof);
  const base = [
    projectGround(cam, b.x - b.w / 2, 0, b.z - b.d / 2),
    projectGround(cam, b.x + b.w / 2, 0, b.z - b.d / 2),
    projectGround(cam, b.x + b.w / 2, 0, b.z + b.d / 2),
    projectGround(cam, b.x - b.w / 2, 0, b.z + b.d / 2),
  ];
  const roofPts = base.map((p, i) => projectGround(cam, b.x + (i === 1 || i === 2 ? b.w / 2 : -b.w / 2), b.h, b.z + (i >= 2 ? b.d / 2 : -b.d / 2)));
  poly(ctx, [base[0], base[1], roofPts[1], roofPts[0]], shade(PALETTE.townWall, b.tone - 0.05));
  poly(ctx, [base[1], base[2], roofPts[2], roofPts[1]], shade(PALETTE.townWall, b.tone - 0.14));
  poly(ctx, [base[2], base[3], roofPts[3], roofPts[2]], shade(PALETTE.townWall, b.tone - 0.09));
  poly(ctx, [base[3], base[0], roofPts[0], roofPts[3]], shade(PALETTE.townWall, b.tone));
  // Pitched roof: a ridge line above the top face.
  const ridgeA = project(cam, b.x, top, b.z - b.d / 4);
  const ridgeB = project(cam, b.x, top, b.z + b.d / 4);
  if (ridgeA && ridgeB) {
    poly(ctx, [roofPts[0], roofPts[1], ridgeB, ridgeA], shade(PALETTE.townRoof, 0.02));
    poly(ctx, [roofPts[3], roofPts[2], ridgeB, ridgeA], shade(PALETTE.townRoof, -0.1));
    if (b.tower) {
      poly(ctx, [ridgeA, ridgeB, project(cam, b.x, top + 7, b.z)], PALETTE.townRoof);
    }
  }
}

function drawCopse(ctx, cam, copse) {
  // A tree cluster from the air: a dark canopy disc with a lit top,
  // squashed by the projection like everything else on the ground.
  const p = projectGround(cam, copse.x, 0, copse.z);
  const r = copse.r * p.scale;
  if (r < 1.5 || r > 700) return;
  ctx.fillStyle = shade(PALETTE.fieldOrchard, -0.16);
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, r, r * 0.4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(PALETTE.fieldOrchard, -0.04);
  ctx.beginPath();
  ctx.ellipse(p.x - r * 0.18, p.y - r * 0.22, r * 0.72, r * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawRunway(ctx, cam) {
  const { centerX, centerZ, length, width } = RUNWAY;
  groundQuad(ctx, cam, centerX, centerZ, width + 26, length + 60, PALETTE.sand);
  groundQuad(ctx, cam, centerX, centerZ, width, length, PALETTE.runway);
  // Threshold bars and centreline dashes.
  for (let i = 0; i < 6; i++) {
    const z = centerZ - length / 2 + 26 + i * 0; // threshold at the north end
    groundQuad(ctx, cam, centerX - width / 2 + 5 + i * (width - 8) / 5, z, 2.4, 16, PALETTE.runwayMark);
  }
  for (let z = centerZ - length / 2 + 60; z < centerZ + length / 2 - 30; z += 46) {
    groundQuad(ctx, cam, centerX, z, 1.7, 22, PALETTE.runwayMark);
  }
  // Edge lights.
  ctx.fillStyle = '#ffd76a';
  for (let z = centerZ - length / 2; z <= centerZ + length / 2; z += 62) {
    for (const sx of [-1, 1]) {
      const p = project(cam, centerX + sx * (width / 2 + 3), 1, z);
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1.2, p.scale * 1.1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

function drawRing(ctx, cam, ring, status, t) {
  const pts = [];
  const N = 30;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const lx = Math.cos(a) * 26;
    const ly = Math.sin(a) * 26;
    // The ring stands vertical, facing its direction of travel.
    const wx = ring.x + lx * Math.cos(ring.facing);
    const wz = ring.z - lx * Math.sin(ring.facing);
    pts.push(project(cam, wx, ring.alt + ly, wz));
  }
  if (pts.some((p) => p === null)) return;
  const colour = status === 'next' ? PALETTE.ringNext : status === 'done' ? PALETTE.ringDone : PALETTE.ringLater;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (const p of pts) ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = colour;
  ctx.lineWidth = status === 'next' ? 7 + Math.sin(t * 5) * 1.4 : 4;
  ctx.globalAlpha = status === 'later' ? 0.55 : 0.95;
  ctx.shadowColor = colour;
  ctx.shadowBlur = status === 'next' ? 16 : 0;
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 1;
}

function drawCloud(ctx, cam, c) {
  const p = project(cam, c.x, c.alt, c.z);
  if (!p) return;
  const r = c.size * p.scale;
  // A cloud the camera is inside of would fill the frame as a white
  // sheet; let it pass unseen instead.
  if (r < 3 || r > 300 || p.depth < 380) return;
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  for (const [ox, oy, orad] of [[0, 0, 1], [-0.7, 0.16, 0.66], [0.72, 0.14, 0.7], [0.1, -0.3, 0.6]]) {
    ctx.beginPath();
    ctx.ellipse(p.x + ox * r, p.y + oy * r * 0.5, orad * r, orad * r * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

export function drawPlane(ctx, state, t) {
  // The Kestrel from behind-quarter: it sits low in frame, banks with
  // the turn, bobs with the vertical speed, and its prop is a blur disc.
  const cx = VIEW_WIDTH / 2;
  const cy = VIEW_HEIGHT * 0.60 + state.pitch * -26 + Math.sin(t * 2.1) * (state.onGround ? 0 : 2.5);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(state.bank * 0.85);
  const s = 1.55; // sprite scale
  ctx.scale(s, s);
  // Shadow of the wing line, then the airframe.
  ctx.fillStyle = PALETTE.planeBody;
  // Main wing.
  ctx.beginPath();
  ctx.moveTo(-118, 6);
  ctx.lineTo(-30, -6);
  ctx.lineTo(30, -6);
  ctx.lineTo(118, 6);
  ctx.lineTo(112, 16);
  ctx.lineTo(-112, 16);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.fillRect(-118, 6, 16, 10);
  ctx.fillRect(102, 6, 16, 10);
  // Ailerons deflect with the roll.
  ctx.fillStyle = shade(PALETTE.planeBody, -0.12);
  const ail = state.bank * 14;
  ctx.fillRect(-112, 16, 62, 5 + Math.max(0, ail * 0.12));
  ctx.fillRect(50, 16, 62, 5 + Math.max(0, -ail * 0.12));
  // Fuselage.
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.ellipse(0, 2, 21, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(PALETTE.planeBody, 0.1);
  ctx.beginPath();
  ctx.ellipse(0, 10, 15, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  // Tailplane and fin (seen from behind, the fin points down-screen in
  // chase view as the tail sits above the fuselage line).
  ctx.fillStyle = PALETTE.planeBody;
  ctx.beginPath();
  ctx.moveTo(-44, -22);
  ctx.lineTo(0, -30);
  ctx.lineTo(44, -22);
  ctx.lineTo(40, -15);
  ctx.lineTo(-40, -15);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(-4, -46);
  ctx.lineTo(6, -46);
  ctx.lineTo(8, -26);
  ctx.lineTo(-6, -26);
  ctx.closePath();
  ctx.fillStyle = PALETTE.planeTrim;
  ctx.fill();
  // Canopy.
  const cg = ctx.createLinearGradient(0, -20, 0, 2);
  cg.addColorStop(0, '#bfe3f2');
  cg.addColorStop(1, '#4d7fa3');
  ctx.fillStyle = cg;
  ctx.beginPath();
  ctx.ellipse(0, -8, 11.5, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(20,30,40,0.55)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  // Propeller: a translucent disc with two blurred blades.
  const spin = state.propSpin;
  ctx.save();
  ctx.translate(0, 16);
  ctx.fillStyle = 'rgba(30,30,34,0.16)';
  ctx.beginPath();
  ctx.ellipse(0, 0, 30, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.rotate(spin);
  ctx.fillStyle = 'rgba(25,25,30,0.5)';
  ctx.fillRect(-2.6, -29, 5.2, 58);
  ctx.restore();
  ctx.fillStyle = '#2b2b30';
  ctx.beginPath();
  ctx.arc(0, 16, 4.6, 0, Math.PI * 2);
  ctx.fill();
  // Fixed gear: two legs and wheels below the wing.
  ctx.strokeStyle = '#33383f';
  ctx.lineWidth = 3.4;
  ctx.beginPath();
  ctx.moveTo(-13, 22);
  ctx.lineTo(-26, 40);
  ctx.moveTo(13, 22);
  ctx.lineTo(26, 40);
  ctx.stroke();
  ctx.fillStyle = '#1d2126';
  for (const wx of [-27, 27]) {
    ctx.beginPath();
    ctx.ellipse(wx, 43, 6.4, 8, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Navigation lights: port red, starboard green.
  ctx.fillStyle = '#ff4040';
  ctx.beginPath(); ctx.arc(-117, 10, 3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#3dff7a';
  ctx.beginPath(); ctx.arc(117, 10, 3, 0, Math.PI * 2); ctx.fill();
  // Flap hint: a dropped trailing edge when the flaps are down.
  if (state.flaps) {
    ctx.fillStyle = shade(PALETTE.planeBody, -0.2);
    ctx.fillRect(-30, 15, 60, 6);
  }
  ctx.restore();
}

export function drawScene(ctx, state, world, t) {
  const cam = makeCamera(state);
  drawSky(ctx, cam, t);
  drawHillSilhouettes(ctx, cam, world.hills.far, PALETTE.hillFar, 0.8);
  drawGroundBase(ctx, cam);

  // Painter's order: gather ground features, draw far to near.
  const items = [];
  for (const f of world.fields) items.push({ kind: 'field', o: f, depth: dist2(cam, f.x, f.z) });
  for (const seg of world.river) items.push({ kind: 'river', o: seg, depth: dist2(cam, seg.x, seg.z) });
  for (const b of world.town) items.push({ kind: 'building', o: b, depth: dist2(cam, b.x, b.z) });
  for (const tr of world.trees) items.push({ kind: 'trees', o: tr, depth: dist2(cam, tr.x, tr.z) });
  items.push({ kind: 'runway', o: world.runway, depth: dist2(cam, world.runway.centerX, world.runway.centerZ) });
  items.sort((a, b) => b.depth - a.depth);
  const fieldColours = {
    wheat: PALETTE.fieldWheat, plough: PALETTE.fieldPlough, meadow: PALETTE.fieldMeadow,
    orchard: PALETTE.fieldOrchard, grassA: PALETTE.grassA, grassB: PALETTE.grassB,
  };
  for (const item of items) {
    if (item.kind === 'field') groundQuad(ctx, cam, item.o.x, item.o.z, item.o.w, item.o.d, shade(fieldColours[item.o.kind], item.o.shade));
    else if (item.kind === 'river') groundQuad(ctx, cam, item.o.x, item.o.z, 300, item.o.halfWidth * 2, PALETTE.sea);
    else if (item.kind === 'building') drawBuilding(ctx, cam, item.o);
    else if (item.kind === 'trees') drawCopse(ctx, cam, item.o);
    else if (item.kind === 'runway') drawRunway(ctx, cam);
  }

  // The lighthouse on its point.
  const lh = world.lighthouse;
  const lb = project(cam, lh.x, 0, lh.z);
  const lt = project(cam, lh.x, lh.h, lh.z);
  if (lb && lt) {
    ctx.fillStyle = '#f4efe2';
    ctx.fillRect(lt.x - 3 * lt.scale * 2, lt.y, 6 * lt.scale * 2, lb.y - lt.y);
    ctx.fillStyle = '#c33';
    ctx.fillRect(lt.x - 3 * lt.scale * 2, lt.y + (lb.y - lt.y) * 0.4, 6 * lt.scale * 2, (lb.y - lt.y) * 0.18);
    ctx.fillStyle = '#ffd76a';
    ctx.beginPath();
    ctx.arc(lt.x, lt.y - 2, Math.max(2, lt.scale * 3), 0, Math.PI * 2);
    ctx.fill();
  }

  drawHillSilhouettes(ctx, cam, world.hills.near, PALETTE.hillNear, 1.5);

  world.rings.forEach((ring, i) => {
    drawRing(ctx, cam, ring, i < state.nextRing ? 'done' : i === state.nextRing ? 'next' : 'later', t);
  });

  const sortedClouds = [...world.clouds].sort((a, b) => dist2(cam, b.x, b.z) - dist2(cam, a.x, a.z));
  for (const c of sortedClouds) drawCloud(ctx, cam, c);

  drawPlane(ctx, state, t);
  drawCockpit(ctx, state);
  drawHud(ctx, state, world, t);
}

function dist2(cam, x, z) {
  const dx = x - cam.x;
  const dz = z - cam.z;
  return dx * dx + dz * dz;
}
