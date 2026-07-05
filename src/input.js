// Input router: capability probe picks a mode; every mode emits the same events.
//   steer {x:-1..1, y:-1..1} · dive (±amount) · pick · halt
export class InputRouter {
  constructor() {
    this._h = { steer: [], dive: [], pick: [], halt: [], close: [], divestart: [], divehold: [] };
    this.mode = 'keys';
  }
  on(ev, cb) { this._h[ev].push(cb); }
  emit(ev, arg) { for (const cb of this._h[ev]) cb(arg); }

  attachKeyboardMouse(canvas) {
    const keys = {};
    const send = () => {
      const x = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
      const y = (keys.ArrowDown || keys.KeyS ? 1 : 0) - (keys.ArrowUp || keys.KeyW ? 1 : 0);
      this.emit('steer', { x, y });
    };
    addEventListener('keydown', e => {
      if (e.repeat) return;
      keys[e.code] = 1; send();
      if (e.code === 'KeyE' || e.code === 'Space') this.emit('pick');
      if (e.code === 'Escape') this.emit('halt');
    });
    addEventListener('keyup', e => { keys[e.code] = 0; send(); });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      this.emit('dive', e.deltaY > 0 ? 0.9 : -0.9);
    }, { passive: false });
    canvas.addEventListener('click', () => this.emit('pick'));
  }

  // on-screen pads: hold to act, release to stop
  attachButtons() {
    const $ = id => document.getElementById(id);
    $('pad').classList.remove('hidden');
    const steer = { x: 0, y: 0 };
    const hold = (id, down, up) => {
      const el = $(id);
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        try { el.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
        down();
      });
      const end = () => up && up();
      el.addEventListener('pointerup', end);
      el.addEventListener('pointercancel', end);
    };
    const send = () => this.emit('steer', { ...steer });
    hold('pad-fwd',   () => { steer.y = -1; send(); }, () => { steer.y = 0; send(); });
    hold('pad-back',  () => { steer.y = 1; send(); },  () => { steer.y = 0; send(); });
    hold('pad-left',  () => { steer.x = -1; send(); }, () => { steer.x = 0; send(); });
    hold('pad-right', () => { steer.x = 1; send(); },  () => { steer.x = 0; send(); });
    let diveIv = null;
    const diveHold = dir => () => { clearInterval(diveIv); diveIv = setInterval(() => this.emit('dive', dir * 0.28), 70); };
    const diveEnd = () => clearInterval(diveIv);
    hold('pad-dive', diveHold(1), diveEnd);
    hold('pad-rise', diveHold(-1), diveEnd);
    hold('pad-pick', () => this.emit('pick'));
  }

  attachTouch(canvas) {
    let drag = null, pinchD = null, moved = false;
    canvas.addEventListener('touchstart', e => {
      moved = false;
      if (e.touches.length === 1) drag = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      if (e.touches.length === 2) pinchD = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    }, { passive: true });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault(); moved = true;
      if (e.touches.length === 1 && drag) {
        const dx = (e.touches[0].clientX - drag.x) / (innerWidth * 0.3);
        const dy = (e.touches[0].clientY - drag.y) / (innerHeight * 0.3);
        this.emit('steer', { x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });
      } else if (e.touches.length === 2 && pinchD != null) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        this.emit('dive', (d - pinchD) * -0.02);
        pinchD = d;
      }
    }, { passive: false });
    canvas.addEventListener('touchend', e => {
      if (e.touches.length === 0) {
        if (!moved) this.emit('pick');
        drag = null; pinchD = null;
        this.emit('steer', { x: 0, y: 0 });
      }
    });
  }
}
