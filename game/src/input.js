// input.js — keyboard and mouse for the Kestrel. flight.js consumes a
// plain input object: pitch and roll in -1..1, throttle held up/down,
// and one-shot flags (flaps, confirm) that main.js clears each frame.
//
//   Arrow keys or A/D and W/S ... steer and work the throttle
//   ArrowUp / ArrowDown ......... pitch (or W/S when A/D steer)
//   Shift / Control ............. throttle up / down
//   F ........................... flaps
//   Enter or Space .............. confirm (start, restart)
//   Mouse ....................... steer toward the pointer, wheel = throttle

export function createInput(canvas) {
  const keys = new Set();
  const input = {
    pitch: 0,
    roll: 0,
    throttleUp: false,
    throttleDown: false,
    flapsPressed: false,
    confirmPressed: false,
    mouseSteer: false,
    mouseX: 0.5,
    mouseY: 0.5,
  };

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    if (e.repeat) return;
    keys.add(e.code);
    if (e.code === 'KeyF') input.flapsPressed = true;
    if (e.code === 'Enter' || e.code === 'Space') input.confirmPressed = true;
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = (e.clientX - rect.left) / rect.width;
    input.mouseY = (e.clientY - rect.top) / rect.height;
    input.mouseSteer = true;
  });
  canvas.addEventListener('mouseleave', () => {
    input.mouseSteer = false;
  });
  canvas.addEventListener('mousedown', () => {
    input.confirmPressed = true;
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (e.deltaY < 0) input.throttleUpPulse = 0.12;
    else input.throttleDownPulse = 0.12;
  }, { passive: false });

  // Recompute the continuous axes from the held keys (and the mouse)
  // once per frame; one-shot flags are left for the caller to consume.
  input.poll = (dt) => {
    let pitch = 0;
    let roll = 0;
    if (keys.has('ArrowLeft') || keys.has('KeyA')) roll -= 1;
    if (keys.has('ArrowRight') || keys.has('KeyD')) roll += 1;
    if (keys.has('ArrowUp')) pitch += 1;
    if (keys.has('ArrowDown')) pitch -= 1;
    // W/S work the throttle (A/D steer, so the pair never fights the
    // pitch keys); PageUp/PageDown are the same levers for keyboards
    // where holding Shift is awkward.
    input.throttleUp = keys.has('ShiftLeft') || keys.has('ShiftRight') || keys.has('KeyW') || keys.has('PageUp') || (input.throttleUpPulse || 0) > 0;
    input.throttleDown = keys.has('ControlLeft') || keys.has('ControlRight') || keys.has('KeyS') || keys.has('PageDown') || (input.throttleDownPulse || 0) > 0;
    if (input.throttleUpPulse) input.throttleUpPulse = Math.max(0, input.throttleUpPulse - dt);
    if (input.throttleDownPulse) input.throttleDownPulse = Math.max(0, input.throttleDownPulse - dt);
    if (input.mouseSteer && roll === 0 && pitch === 0) {
      roll = Math.max(-1, Math.min(1, (input.mouseX - 0.5) * 2.4));
      pitch = Math.max(-1, Math.min(1, (0.52 - input.mouseY) * 2.2));
    }
    input.pitch = pitch;
    input.roll = roll;
    return input;
  };

  input.consume = () => {
    const out = { flaps: input.flapsPressed, confirm: input.confirmPressed };
    input.flapsPressed = false;
    input.confirmPressed = false;
    return out;
  };

  return input;
}
