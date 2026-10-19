/**
 * Sky Stack — tap to drop the sliding block and build the tallest tower.
 * Logical play area is 360 wide; the view scales to fit any screen.
 */
(function () {
  const W = 360;          // logical width
  const H = 640;          // logical reference height
  const BH = 26;          // block height
  const BASE_W = 200;     // starting block width
  const PERFECT_PX = 5;   // tolerance for a "perfect" drop

  const I18N = {
    en: {
      tap: 'Tap to start', best: 'Best', gameOver: 'Game Over', cont: 'Continue ▶ (Ad)',
      again: 'Play again', perfect: 'PERFECT', newBest: 'NEW BEST!',
    },
    zh: {
      tap: '点击开始', best: '最高', gameOver: '游戏结束', cont: '看广告继续 ▶',
      again: '再玩一次', perfect: '完美', newBest: '新纪录！',
    },
  };
  let T = I18N.en;

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const ui = {
    hud: $('hud'), score: $('score'), combo: $('combo'), mute: $('muteBtn'),
    menu: $('menu'), tap: $('tapToStart'), menuBest: $('menuBest'),
    over: $('over'), overTitle: $('overTitle'), overScore: $('overScore'), overBest: $('overBest'),
    newBest: $('newBest'), cont: $('continueBtn'), again: $('againBtn'),
  };

  // ---------- View ----------
  let cw = 0, ch = 0, dpr = 1, scale = 1, ox = 0, viewH = H, groundY = H - 100;
  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = window.innerWidth; ch = window.innerHeight;
    canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    scale = Math.min(cw / W, ch / H);
    ox = (cw - W * scale) / 2;
    viewH = ch / scale;
    groundY = viewH - 100;
    if (blocks.length) camT = targetCam();
  }

  // ---------- State ----------
  let state = 'menu';            // menu | playing | over
  let blocks = [], moving = null, debris = [], particles = [], texts = [];
  let score = 0, best = 0, combo = 0, continued = false, gamesPlayed = 0;
  let cam = 0, camT = 0, shake = 0, flash = 0;
  let paused = false, sdkAudio = true, userMuted = false, busy = false;

  const stars = Array.from({ length: 70 }, () => ({
    x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.4, a: Math.random() * 0.6 + 0.4,
  }));

  const hue = (i) => (195 + i * 8) % 360;
  const color = (i, l = 58) => `hsl(${hue(i)}, 72%, ${l}%)`;
  const sy = (wy) => groundY - (wy - cam);  // world-y (up) -> logical screen-y (down)
  const topOf = (lvl) => (lvl + 1) * BH;

  function targetCam() {
    const top = topOf(blocks[blocks.length - 1].lvl);
    return Math.max(0, top - viewH * 0.55 + 100);
  }

  function reset() {
    blocks = [{ x: (W - BASE_W) / 2, w: BASE_W, lvl: 0 }];
    debris = []; particles = []; texts = [];
    score = 0; combo = 0; continued = false;
    cam = camT = 0;
    spawn();
    updateHud();
  }

  function spawn() {
    const prev = blocks[blocks.length - 1];
    const lvl = prev.lvl + 1;
    const fromLeft = lvl % 2 === 1;
    const lo = -40, hi = W - prev.w + 40;
    moving = {
      x: fromLeft ? lo : hi, w: prev.w, lvl,
      dir: fromLeft ? 1 : -1,
      speed: Math.min(150 + lvl * 6, 430),
    };
  }

  // ---------- Gameplay ----------
  function drop() {
    if (!moving) return;
    const prev = blocks[blocks.length - 1];
    const m = moving;
    const dx = m.x - prev.x;
    const top = topOf(m.lvl);

    if (Math.abs(dx) <= PERFECT_PX) {
      combo++;
      let x = prev.x, w = prev.w;
      if (combo >= 3 && w < BASE_W) {          // reward streaks by growing back
        const grow = Math.min(10, BASE_W - w);
        w += grow; x = Math.max(0, Math.min(W - w, x - grow / 2));
      }
      blocks.push({ x, w, lvl: m.lvl });
      burst(x + w / 2, top, m.lvl);
      flash = 1;
      texts.push({ text: combo > 1 ? `${T.perfect} x${combo}` : T.perfect, x: W / 2, wy: top + 30, life: 1 });
      Sound.perfect(combo);
    } else {
      const left = Math.max(m.x, prev.x);
      const right = Math.min(m.x + m.w, prev.x + prev.w);
      const overlap = right - left;
      if (overlap <= 0) {
        debris.push(makeDebris(m.x, m.w, top, m.lvl, dx < 0 ? -1 : 1));
        moving = null;
        return gameOver();
      }
      combo = 0;
      blocks.push({ x: left, w: overlap, lvl: m.lvl });
      const cutLeft = m.x < prev.x;
      debris.push(makeDebris(cutLeft ? m.x : right, m.w - overlap, top, m.lvl, cutLeft ? -1 : 1));
      shake = 4;
      Sound.place(); Sound.cut();
    }

    score = m.lvl;
    camT = targetCam();
    spawn();
    updateHud();
  }

  function makeDebris(x, w, top, lvl, dir) {
    return { x, w, wy: top, vy: 0, vx: dir * 70, rot: 0, vr: dir * 2.5, lvl };
  }

  function burst(x, wy, lvl) {
    for (let i = 0; i < 16; i++) {
      const a = Math.random() * Math.PI * 2, s = 80 + Math.random() * 160;
      particles.push({ x, wy, vx: Math.cos(a) * s, vy: Math.sin(a) * s + 120, life: 1, lvl });
    }
  }

  async function gameOver() {
    state = 'over';
    gamesPlayed++;
    shake = 12;
    Sound.fail();
    const isNew = score > best;
    if (isNew) { best = score; SDK.saveData({ best }); }
    SDK.sendScore(score);

    ui.hud.classList.add('hidden');
    ui.overScore.textContent = score;
    ui.overBest.textContent = `${T.best}: ${best}`;
    ui.newBest.classList.toggle('hidden', !isNew || score === 0);
    ui.cont.classList.toggle('hidden', continued || score < 3);
    ui.cont.disabled = ui.again.disabled = false;
    setTimeout(() => { if (state === 'over') ui.over.classList.remove('hidden'); }, 650);
  }

  async function onContinue() {
    if (busy) return;
    busy = true; ui.cont.disabled = ui.again.disabled = true;
    Sound.click();
    const ok = await SDK.rewarded('continue');
    busy = false;
    if (!ok) { ui.cont.classList.add('hidden'); ui.again.disabled = false; return; }
    continued = true; combo = 0;
    debris = [];
    ui.over.classList.add('hidden');
    ui.hud.classList.remove('hidden');
    state = 'playing';
    spawn();
    updateHud();
  }

  async function onAgain() {
    if (busy) return;
    busy = true; ui.cont.disabled = ui.again.disabled = true;
    Sound.click();
    if (gamesPlayed % 3 === 0) await SDK.interstitial();  // natural break, not every game
    busy = false;
    ui.over.classList.add('hidden');
    startGame();
  }

  function startGame() {
    Sound.unlock();
    reset();
    state = 'playing';
    ui.menu.classList.add('hidden');
    ui.hud.classList.remove('hidden');
  }

  function updateHud() {
    ui.score.textContent = score;
    ui.combo.textContent = combo >= 2 ? `${T.perfect} x${combo}` : '';
  }

  function applyAudio() {
    const on = sdkAudio && !userMuted;
    Sound.setEnabled(on);
    ui.mute.textContent = on ? '🔊' : '🔇';
  }

  // ---------- Loop ----------
  let last = 0, rafId = 0;
  function frame(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    update(dt);
    render();
    rafId = requestAnimationFrame(frame);
  }
  function startLoop() { if (!rafId) { last = performance.now(); rafId = requestAnimationFrame(frame); } }
  function stopLoop() { cancelAnimationFrame(rafId); rafId = 0; }

  function update(dt) {
    if (state === 'playing' && moving) {
      moving.x += moving.dir * moving.speed * dt;
      const lo = -40, hi = W - moving.w + 40;
      if (moving.x < lo) { moving.x = lo; moving.dir = 1; }
      if (moving.x > hi) { moving.x = hi; moving.dir = -1; }
    }
    if (state === 'menu') camT = 0;

    for (const d of debris) {
      d.vy -= 1100 * dt; d.wy += d.vy * dt; d.x += d.vx * dt; d.rot += d.vr * dt;
    }
    debris = debris.filter((d) => d.wy > cam - 400);

    for (const p of particles) {
      p.vy -= 600 * dt; p.x += p.vx * dt; p.wy += p.vy * dt; p.life -= dt * 1.6;
    }
    particles = particles.filter((p) => p.life > 0);

    for (const tx of texts) { tx.wy += 40 * dt; tx.life -= dt * 1.2; }
    texts = texts.filter((tx) => tx.life > 0);

    cam += (camT - cam) * Math.min(1, dt * 6);
    shake = Math.max(0, shake - dt * 30);
    flash = Math.max(0, flash - dt * 3);
  }

  // ---------- Render ----------
  function lerp(a, b, k) { return a + (b - a) * k; }
  function mixRgb(c1, c2, k) {
    return `rgb(${Math.round(lerp(c1[0], c2[0], k))},${Math.round(lerp(c1[1], c2[1], k))},${Math.round(lerp(c1[2], c2[2], k))})`;
  }

  function drawBlock(x, top, w, lvl) {
    const y = sy(top);
    ctx.fillStyle = color(lvl);
    ctx.fillRect(x, y, w, BH);
    ctx.fillStyle = color(lvl, 72);
    ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(x, y + BH - 4, w, 4);
  }

  function render() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Sky: day -> night as the tower grows
    const k = Math.min(1, cam / 1800);
    const g = ctx.createLinearGradient(0, 0, 0, ch);
    g.addColorStop(0, mixRgb([79, 163, 224], [8, 10, 36], k));
    g.addColorStop(1, mixRgb([196, 232, 255], [44, 30, 92], k));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, cw, ch);

    // Stars fade in with height
    const starAlpha = Math.min(1, cam / 900);
    if (starAlpha > 0.02) {
      ctx.fillStyle = '#fff';
      for (const s of stars) {
        ctx.globalAlpha = s.a * starAlpha;
        const y = (s.y * ch + cam * scale * 0.15) % ch;
        ctx.beginPath(); ctx.arc(s.x * cw, y, s.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // World
    const sx = (Math.random() - 0.5) * shake, syk = (Math.random() - 0.5) * shake;
    ctx.translate(ox + sx, syk);
    ctx.scale(scale, scale);

    // Pedestal
    const gy = sy(0);
    ctx.fillStyle = 'rgba(20, 24, 60, 0.85)';
    ctx.fillRect((W - BASE_W) / 2 - 20, gy, BASE_W + 40, viewH - gy + 400);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect((W - BASE_W) / 2 - 20, gy, BASE_W + 40, 4);

    // Placed blocks (only visible ones)
    for (const b of blocks) {
      const y = sy(topOf(b.lvl));
      if (y > viewH + BH || y < -BH * 2) continue;
      drawBlock(b.x, topOf(b.lvl), b.w, b.lvl);
    }

    // Perfect flash outline on top block
    if (flash > 0 && blocks.length) {
      const b = blocks[blocks.length - 1];
      ctx.strokeStyle = `rgba(255,255,255,${flash})`;
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x - 2, sy(topOf(b.lvl)) - 2, b.w + 4, BH + 4);
    }

    // Moving block
    if (moving && state === 'playing') {
      ctx.shadowColor = color(moving.lvl, 70);
      ctx.shadowBlur = 14;
      drawBlock(moving.x, topOf(moving.lvl), moving.w, moving.lvl);
      ctx.shadowBlur = 0;
    }

    // Falling debris
    for (const d of debris) {
      ctx.save();
      ctx.translate(d.x + d.w / 2, sy(d.wy) + BH / 2);
      ctx.rotate(d.rot);
      ctx.fillStyle = color(d.lvl, 50);
      ctx.fillRect(-d.w / 2, -BH / 2, d.w, BH);
      ctx.restore();
    }

    // Particles
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = color(p.lvl, 80);
      ctx.fillRect(p.x - 3, sy(p.wy) - 3, 6, 6);
    }
    ctx.globalAlpha = 1;

    // Floating texts
    ctx.textAlign = 'center';
    ctx.font = '800 22px -apple-system, "PingFang SC", sans-serif';
    for (const tx of texts) {
      ctx.globalAlpha = Math.max(0, tx.life);
      ctx.fillStyle = '#ffe27a';
      ctx.fillText(tx.text, tx.x, sy(tx.wy));
    }
    ctx.globalAlpha = 1;
  }

  // ---------- Input ----------
  function onPointer(e) {
    if (paused || busy) return;
    if (e.target.closest && e.target.closest('button')) return;
    if (state === 'menu') { startGame(); return; }
    if (state === 'playing') drop();
  }
  window.addEventListener('pointerdown', onPointer);
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' && e.code !== 'Enter') return;
    e.preventDefault();
    if (paused || busy) return;
    if (state === 'menu') startGame();
    else if (state === 'playing') drop();
  });
  ui.cont.addEventListener('click', onContinue);
  ui.again.addEventListener('click', onAgain);
  ui.mute.addEventListener('click', () => { userMuted = !userMuted; applyAudio(); Sound.click(); });
  window.addEventListener('resize', resize);
  document.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- Boot ----------
  async function boot() {
    resize();
    reset();
    render();
    SDK.firstFrameReady();             // first frame is on screen

    sdkAudio = SDK.isAudioEnabled();
    applyAudio();
    SDK.onAudioEnabledChange((on) => { sdkAudio = on; applyAudio(); });
    SDK.onPause(() => { paused = true; stopLoop(); Sound.pause(); });
    SDK.onResume(() => { paused = false; Sound.resume(); startLoop(); });

    const [lang, data] = await Promise.all([SDK.getLanguage(), SDK.loadData()]);
    T = String(lang || 'en').toLowerCase().startsWith('zh') ? I18N.zh : I18N.en;
    best = (data && data.best) | 0;

    ui.tap.textContent = T.tap;
    ui.menuBest.textContent = best > 0 ? `${T.best}: ${best}` : '';
    ui.overTitle.textContent = T.gameOver;
    ui.newBest.textContent = T.newBest;
    ui.cont.textContent = T.cont;
    ui.again.textContent = T.again;

    startLoop();
    SDK.gameReady();                   // player can interact now
  }

  boot();
})();
