/**
 * Safe wrapper around the YouTube Playables SDK (`window.ytgame`).
 * Inside YouTube it uses the real SDK; elsewhere it falls back gracefully
 * so the same build can be hosted on any website for demos.
 */
(function () {
  const yt = typeof window.ytgame !== 'undefined' ? window.ytgame : null;
  const inEnv = !!(yt && yt.IN_PLAYABLES_ENV);
  const SAVE_KEY = 'skystack_save_v1';

  function safe(fn, fallback) {
    try { return fn(); } catch (e) { console.warn('[SDK]', e); return fallback; }
  }

  const SDK = {
    inEnv,

    /** Call as soon as the first frame is rendered. */
    firstFrameReady() { if (inEnv) safe(() => yt.game.firstFrameReady()); },

    /** Call only when the player can actually interact with the game. */
    gameReady() { if (inEnv) safe(() => yt.game.gameReady()); },

    async loadData() {
      try {
        const raw = inEnv ? await yt.game.loadData() : localStorage.getItem(SAVE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch (e) { console.warn('[SDK] loadData', e); return {}; }
    },

    async saveData(obj) {
      const raw = JSON.stringify(obj);
      try {
        if (inEnv) await yt.game.saveData(raw);
        else localStorage.setItem(SAVE_KEY, raw);
      } catch (e) { console.warn('[SDK] saveData', e); }
    },

    sendScore(value) {
      if (inEnv) safe(() => yt.engagement.sendScore({ value }));
    },

    isAudioEnabled() {
      return inEnv ? safe(() => yt.system.isAudioEnabled(), true) : true;
    },

    onAudioEnabledChange(cb) {
      if (inEnv) safe(() => yt.system.onAudioEnabledChange(cb));
    },

    /** Pause/resume: SDK inside YouTube, Page Visibility API elsewhere. */
    onPause(cb) {
      if (inEnv) safe(() => yt.system.onPause(cb));
      else document.addEventListener('visibilitychange', () => { if (document.hidden) cb(); });
    },
    onResume(cb) {
      if (inEnv) safe(() => yt.system.onResume(cb));
      else document.addEventListener('visibilitychange', () => { if (!document.hidden) cb(); });
    },

    async getLanguage() {
      if (inEnv) {
        try { return await yt.system.getLanguage(); } catch (e) { /* fall through */ }
      }
      return navigator.language || 'en';
    },

    get adsAvailable() { return inEnv && !!(yt && yt.ads); },

    async interstitial() {
      if (!SDK.adsAvailable) return;
      try { await yt.ads.requestInterstitialAd(); } catch (e) { console.warn('[SDK] interstitial', e); }
    },

    /** Resolves true if the reward should be granted. Simulated outside YouTube. */
    async rewarded(rewardId) {
      if (!inEnv) return new Promise((r) => setTimeout(() => r(true), 400));
      if (!SDK.adsAvailable) return false;
      try { return !!(await yt.ads.requestRewardedAd(rewardId)); }
      catch (e) { console.warn('[SDK] rewarded', e); return false; }
    },
  };

  window.SDK = SDK;
})();
