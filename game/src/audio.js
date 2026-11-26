// audio.js — every sound in Skyharbor Run is synthesised with
// WebAudio: the engine's growl follows the throttle, the wind follows
// the speed, and rings, stalls and touchdowns get their own voices.
// Nothing is loaded; the graph is built on the first user gesture.

export function createAudio() {
  let ctx = null;
  let engineOsc = null;
  let engineGain = null;
  let windGain = null;
  let windFilter = null;
  let windSource = null;
  let started = false;

  function start() {
    if (started) return;
    started = true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      ctx = null;
      return;
    }
    // Engine: two detuned saws through a lowpass, gain by throttle.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    const engineOsc2 = ctx.createOscillator();
    engineOsc2.type = 'square';
    engineOsc2.frequency.value = 28;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(ctx.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise through a bandpass, gain by airspeed.
    const len = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    windSource = ctx.createBufferSource();
    windSource.buffer = buffer;
    windSource.loop = true;
    windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 640;
    windFilter.Q.value = 0.7;
    windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(ctx.destination);
    windSource.start();
  }

  function update(state) {
    if (!ctx || !engineGain) return;
    const t = ctx.currentTime;
    const rpm = 50 + state.throttle * 65 + state.speed * 0.24;
    engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    engineGain.gain.setTargetAtTime(state.phase === 'flying' ? 0.015 + state.throttle * 0.05 : 0.008, t, 0.1);
    windGain.gain.setTargetAtTime(Math.min(0.075, state.speed * 0.0009), t, 0.15);
    // The wind's pitch climbs with the airspeed, so a dive sounds
    // faster before the needle says so.
    if (windFilter) windFilter.frequency.setTargetAtTime(420 + state.speed * 9, t, 0.2);
  }

  function blip(freqA, freqB, dur, type = 'sine', gain = 0.12, when = 0) {
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqA, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqB), t0 + dur);
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noiseBurst(dur, gain = 0.22, freq = 300) {
    if (!ctx) return;
    const t0 = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter);
    filter.connect(g);
    g.connect(ctx.destination);
    src.start(t0);
  }

  return {
    start,
    update,
    handle(event) {
      if (!ctx) return;
      if (event === 'ring') {
        blip(880, 880, 0.14, 'sine', 0.14);
        blip(1318, 1318, 0.22, 'sine', 0.12, 0.1);
      } else if (event === 'stall-start') {
        blip(220, 180, 0.3, 'square', 0.07);
      } else if (event === 'touchdown') {
        noiseBurst(0.25, 0.1, 500);
      } else if (event === 'crash' || event === 'splash') {
        noiseBurst(0.7, 0.3, 240);
        blip(120, 40, 0.6, 'sawtooth', 0.16);
      } else if (event === 'win') {
        blip(523, 523, 0.16, 'triangle', 0.13);
        blip(659, 659, 0.16, 'triangle', 0.13, 0.14);
        blip(784, 784, 0.3, 'triangle', 0.13, 0.28);
      }
    },
  };
}
