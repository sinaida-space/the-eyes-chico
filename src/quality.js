// One dial every module reads. Tiers: 2 high, 1 medium, 0 low.
const TABLE = [
  { name: 'LOW',    eyes: 36,  poppies: 900,  particles: 900,  skySteps: 64, skyRes: 288, pixelRatio: 1,   post: false, sphereSeg: 16 },
  { name: 'MEDIUM', eyes: 70,  poppies: 2200, particles: 2000, skySteps: 70, skyRes: 448, pixelRatio: 1.5, post: true,  sphereSeg: 24 },
  { name: 'HIGH',   eyes: 110, poppies: 4200, particles: 3200, skySteps: 100, skyRes: 640, pixelRatio: 2,  post: true,  sphereSeg: 32 },
];

export class Quality {
  constructor() {
    this.isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)
      || (navigator.maxTouchPoints > 1 && Math.min(screen.width, screen.height) < 820);
    const forced = new URLSearchParams(location.search).get('tier');
    let saved = null;
    try { saved = localStorage.getItem('eyes-tier'); } catch (e) { /* storage blocked */ }
    this.forced = forced !== null;
    if (forced !== null) this.tier = +forced;
    else if (saved !== null) this.tier = +saved;
    else this.tier = this.detect();
    this.tier = Math.max(0, Math.min(2, this.tier | 0));
    // FPS governor state
    this._samples = [];
    this._cooldown = 0;
    this.onDowngrade = null;
  }

  detect() {
    if (this.isMobile) return 0;
    // probe GPU name via a throwaway context
    let gpu = '';
    try {
      const c = document.createElement('canvas');
      const gl = c.getContext('webgl2') || c.getContext('webgl');
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
    } catch (e) { /* no webgl — main.js will show an error anyway */ }
    if (/(intel|iris|uhd|hd graphics)/i.test(gpu) && !/(arc)/i.test(gpu)) return 1;
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) return 1;
    return 2;
  }

  get p() { return TABLE[this.tier]; }
  get canHands() { // hand tracking only where the GPU can afford a second model
    return !this.isMobile && this.tier >= 1 && !!(navigator.mediaDevices?.getUserMedia);
  }

  // called each frame with delta time; steps tier down under sustained low FPS
  govern(dt) {
    if (this.tier === 0) return;
    this._cooldown -= dt;
    this._samples.push(dt);
    if (this._samples.length < 120) return;
    const avg = this._samples.reduce((a, b) => a + b, 0) / this._samples.length;
    this._samples.length = 0;
    const target = this.isMobile ? 1 / 24 : 1 / 42; // hysteresis threshold
    if (avg > target && this._cooldown <= 0) {
      this.tier--;
      this._cooldown = 12; // don't cascade
      console.warn('[quality] sustained low fps — stepping down to', this.p.name);
      if (this.onDowngrade) this.onDowngrade(this.tier);
    }
  }

  persist(allowed) {
    if (!allowed) return;
    try { localStorage.setItem('eyes-tier', String(this.tier)); } catch (e) {}
  }
}
