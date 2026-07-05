// Terminal chrome: boot log, consent, HUD, question bubble, exit screen.
const $ = id => document.getElementById(id);

const BOOT_LINES = [
  'SIN.AI.DA BIOS v5.0 — cold boot',
  'MEM CHECK ............... 640K OK (nobody will ever need more)',
  'MOUNTING /dev/field ..... OK',
  'GROWING 50 QUESTIONS .... OK',
  'CALIBRATING EYES ........ ALL OF THEM',
  'LOADING NEBULA .......... OK',
  'C:\\> run the_eyes_chico.exe',
];

export class UI {
  constructor() {
    this.consented = null; // null = undecided, true/false
    this.storageOK = false;
    this.initFullscreen();
  }

  // ---- fullscreen ----
  initFullscreen() {
    const root = document.documentElement;
    const supported = root.requestFullscreen || root.webkitRequestFullscreen;
    const btns = [$('btn-fs'), $('btn-fs-hud')].filter(Boolean);
    if (!supported) { btns.forEach(b => b.classList.add('hidden')); return; } // iPhone Safari
    const isFs = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
    const toggle = () => {
      if (isFs()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      else (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
    };
    const label = () => {
      if ($('btn-fs')) $('btn-fs').textContent = isFs() ? '⛶ EXIT FULLSCREEN' : '⛶ FULLSCREEN';
      if ($('btn-fs-hud')) $('btn-fs-hud').textContent = isFs() ? '⛶✕' : '⛶';
    };
    btns.forEach(b => b.onclick = toggle);
    addEventListener('fullscreenchange', label);
    addEventListener('webkitfullscreenchange', label);
  }

  // ---- consent ----
  initConsent() {
    let prev = null;
    try { prev = localStorage.getItem('eyes-consent'); } catch (e) {}
    if (prev === 'yes') { this.consented = true; this.storageOK = true; return Promise.resolve(); }
    if (prev === 'no') { this.consented = false; return Promise.resolve(); }
    $('consent').classList.remove('hidden');
    return new Promise(res => {
      $('consent-yes').onclick = () => {
        this.consented = true; this.storageOK = true;
        try { localStorage.setItem('eyes-consent', 'yes'); } catch (e) {}
        $('consent').classList.add('hidden'); res();
      };
      $('consent-no').onclick = () => {
        this.consented = false;
        try { localStorage.clear(); } catch (e) {}
        $('consent').classList.add('hidden'); res();
      };
    });
  }

  // ---- splash ----
  async runBoot(tierName, canHands, weak = false) {
    const log = $('bootlog');
    for (const line of BOOT_LINES) {
      const el = document.createElement('div');
      log.appendChild(el);
      // background tabs throttle timers — don't make a hidden tab type for 30s
      if (!document.hidden) {
        for (let i = 0; i <= line.length; i += 6) {
          el.textContent = line.slice(0, i);
          await new Promise(r => setTimeout(r, 14));
        }
        await new Promise(r => setTimeout(r, 70));
      }
      el.textContent = line;
    }
    $('tier-report').textContent =
      `detected tier: ${tierName}` + (canHands ? ' · camera available for hand tracking' : ' · touch/keyboard mode');
    if (weak) {
      const w = document.createElement('p');
      w.innerHTML = 'C:\\&gt; weak GPU detected — you will get the ESSENTIAL version: fewer eyes, '
        + 'a calmer sky, the same ritual. we do not recommend the full version on this machine, '
        + 'but you can <a href="?tier=2">try it anyway →</a>';
      w.style.color = '#c1121f';
      $('tier-report').after(w);
    }
    if (canHands) { $('controls-hand').classList.remove('hidden'); $('btn-enter-hands').classList.remove('hidden'); }
    $('splash-body').classList.remove('hidden');
  }

  // touch users choose swipe vs on-screen buttons on the splash
  initTouchChoice(saved) {
    this.touchMode = saved === 'buttons' ? 'buttons' : 'swipe';
    $('touch-choice').classList.remove('hidden');
    const upd = () => {
      $('tc-swipe').classList.toggle('dim', this.touchMode !== 'swipe');
      $('tc-buttons').classList.toggle('dim', this.touchMode !== 'buttons');
    };
    $('tc-swipe').onclick = () => { this.touchMode = 'swipe'; upd(); };
    $('tc-buttons').onclick = () => { this.touchMode = 'buttons'; upd(); };
    upd();
  }

  waitForEnter() {
    return new Promise(res => {
      $('btn-enter').onclick = () => res('fallback');
      $('btn-enter-hands').onclick = () => res('hands');
      addEventListener('keydown', function onk(e) {
        if (e.code === 'Enter') { removeEventListener('keydown', onk); res('fallback'); }
      });
    });
  }

  hideSplash() { $('splash').classList.add('hidden'); $('hud').classList.remove('hidden'); }
  showSplash() { $('splash').classList.remove('hidden'); $('hud').classList.add('hidden'); }

  // ---- HUD ----
  setCounter(n, total) { $('counter').textContent = `${n}/${total}`; }
  setLegend(t) { $('legend').textContent = t; }
  setHint(t) { $('hint').textContent = t; }
  get glyphEl() { return $('gesture-glyph'); }
  onMute(cb) {
    let m = false;
    $('btn-mute').onclick = () => { m = !m; $('btn-mute').textContent = m ? 'SOUND: OFF' : 'SOUND: ON'; cb(m); };
  }
  onExit(cb) { $('btn-exit').onclick = cb; }

  // ---- question bubble ----
  showQuestion(text) {
    $('bubble-text').textContent = text;
    $('bubble').classList.remove('hidden');
    const cloud = $('bubble-cloud');
    cloud.classList.remove('sinking');
    return new Promise(res => {
      setTimeout(() => { // grace so the opening tap doesn't close it
        let closed = false;
        const close = () => {
          if (closed) return;
          closed = true;
          removeEventListener('pointerdown', close); removeEventListener('keydown', close);
          this._closeBubble = null;
          cloud.classList.add('sinking'); // into the abyss
          setTimeout(() => {
            $('bubble').classList.add('hidden');
            cloud.classList.remove('sinking');
            res();
          }, 660);
        };
        $('bubble-close').onclick = close;
        addEventListener('pointerdown', close); addEventListener('keydown', close);
        this._closeBubble = close;
      }, 600);
    });
  }
  closeBubble() { if (this._closeBubble) this._closeBubble(); }
  get bubbleOpen() { return !$('bubble').classList.contains('hidden'); }

  finale() {
    this.setHint('50/50 — the field has asked you everything it knows. sit with it.');
  }

  // ---- exit ----
  showExit(count, total) {
    $('exit-count').textContent = `questions faced: ${count}/${total}. the rest will wait.`;
    $('exit-screen').classList.remove('hidden');
    $('hud').classList.add('hidden');
    return new Promise(res => {
      $('btn-return').onclick = () => {
        $('exit-screen').classList.add('hidden');
        $('hud').classList.remove('hidden');
        res('field');
      };
      $('btn-welcome').onclick = () => {
        $('exit-screen').classList.add('hidden');
        res('welcome');
      };
    });
  }
}
