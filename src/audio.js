// Generative audio, zero files: low drone bed + vinyl crackle, motion-reactive
// filter, soft bell on flower open. Built only after a user gesture (ENTER).
export class AudioEngine {
  constructor() { this.ctx = null; this.muted = false; }

  start() {
    if (this.ctx) { this.ctx.resume(); return; }
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = ctx.createGain(); this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // drone: two detuned saws through a slow-breathing lowpass
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass'; this.filter.frequency.value = 190; this.filter.Q.value = 2.5;
    const droneGain = ctx.createGain(); droneGain.gain.value = 0.05;
    for (const f of [54, 54.6, 108.4]) {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(this.filter); o.start();
    }
    this.filter.connect(droneGain); droneGain.connect(this.master);
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain(); lfoGain.gain.value = 55;
    lfo.connect(lfoGain); lfoGain.connect(this.filter.frequency); lfo.start();

    // vinyl bed: looping filtered noise + random pops/scratches
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.5;
    const noise = ctx.createBufferSource(); noise.buffer = buf; noise.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2600; bp.Q.value = 0.6;
    this.crackleGain = ctx.createGain(); this.crackleGain.gain.value = 0.011;
    noise.connect(bp); bp.connect(this.crackleGain); this.crackleGain.connect(this.master);
    noise.start();
    this._popTimer = setInterval(() => this._pop(), 400);
  }

  _pop() { // vinyl pop / scratch tick
    if (!this.ctx || this.muted || Math.random() < 0.45) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = 'square';
    o.frequency.value = 900 + Math.random() * 2400;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.02 + Math.random() * 0.025, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.02 + Math.random() * 0.05);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 0.09);
  }

  // avatar speed 0..~8 → drone opens up, crackle rises slightly
  motion(speed) {
    if (!this.ctx) return;
    const s = Math.min(1, Math.abs(speed) / 8);
    this.filter.frequency.setTargetAtTime(190 + s * 620, this.ctx.currentTime, 0.4);
    this.crackleGain.gain.setTargetAtTime(0.011 + s * 0.012, this.ctx.currentTime, 0.4);
  }

  flowerTone() { // soft bell: root + fifth, long decay
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [f, v] of [[523.25, 0.10], [784, 0.05], [1046.5, 0.03]]) {
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(v, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
      o.connect(g); g.connect(this.master); o.start(t); o.stop(t + 3);
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
  }
}
