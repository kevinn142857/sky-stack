/** Tiny procedural sound engine (no asset files needed). */
(function () {
  let ctx = null, master = null;
  let enabled = true, paused = false;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = enabled ? 0.5 : 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended' && enabled && !paused) ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type = 'sine', vol = 0.3, slide = 0) {
    if (!enabled || paused) return;
    const c = ensure();
    if (!c) return;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  window.Sound = {
    unlock: ensure,
    setEnabled(v) {
      enabled = v;
      if (master) master.gain.value = v ? 0.5 : 0;
      if (ctx) { if (v && !paused) ctx.resume(); else if (!v) ctx.suspend(); }
    },
    pause() { paused = true; if (ctx && ctx.state === 'running') ctx.suspend(); },
    resume() { paused = false; if (ctx && enabled) ctx.resume(); },

    place() { tone(260, 0.1, 'triangle', 0.25); },
    perfect(combo) {
      const f = 523.25 * Math.pow(2, Math.min(combo, 12) / 12);
      tone(f, 0.18, 'triangle', 0.35);
      tone(f * 1.5, 0.25, 'sine', 0.15);
    },
    cut() { tone(200, 0.14, 'square', 0.1, 0.5); },
    fail() { tone(320, 0.6, 'sawtooth', 0.18, 0.2); },
    click() { tone(660, 0.06, 'sine', 0.15); },
  };
})();
