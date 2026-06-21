/**
 * audio.js — Audio Manager untuk Kanji Duel
 *
 * Load otomatis dari index.html. Digunakan oleh client.js untuk play BGM
 * & SFX berdasarkan state game.
 *
 * File-file audio yang diharapkan (lihat README/petunjuk di akhir):
 *   /audio/bgm/bgm-lobby.mp3     — musik lobby (calm)
 *   /audio/bgm/bgm-room.mp3      — musik menunggu (suspenseful)
 *   /audio/bgm/bgm-battle.mp3    — musik battle (intense)
 *   /audio/bgm/bgm-victory.mp3   — menang (cheerful)
 *   /audio/bgm/bgm-defeat.mp3    — kalah (somber)
 *
 *   /audio/sfx/sfx-click.mp3     — button click
 *   /audio/sfx/sfx-correct.mp3   — jawaban benar
 *   /audio/sfx/sfx-wrong.mp3     — jawaban salah
 *   /audio/sfx/sfx-shield.mp3    — shield aktif
 *   /audio/sfx/sfx-explosion.mp3 — bom meledak
 *   /audio/sfx/sfx-tick.mp3      — timer warning
 *   /audio/sfx/sfx-victory.mp3   — match won
 *   /audio/sfx/sfx-defeat.mp3    — match lost
 *
 * CATATAN: File audio TIDAK termasuk di repo. User harus menyediakan
 * file .mp3 sendiri. Jika file tidak ada, sistem tetap jalan (tanpa suara).
 */

const AudioManager = {
  ctx: null,
  enabled: true,
  muted: false,
  volume: 0.6,
  sfxVolume: 0.8,
  currentBGM: null,
  audioCache: {},

  /**
   * Mengatur ekstensi audio yang akan dipanggil (bisa mp3 atau wav)
   */
  ext: '.wav',

  /**
   * Inisialisasi Audio Context (perlu user gesture di mobile).
   * Dipanggil saat user melakukan klik pertama.
   */
  init() {
    if (this.ctx) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
    } catch (err) {
      console.warn('[Audio] Web Audio API tidak tersedia:', err);
    }

    // Load saved preferences
    try {
      const saved = JSON.parse(localStorage.getItem('kd_audio') || '{}');
      this.muted = saved.muted ?? false;
      this.volume = saved.volume ?? 0.6;
      this.sfxVolume = saved.sfxVolume ?? 0.8;
    } catch (e) {
      // ignore
    }
  },

  /**
   * Unlock audio context (harus dipanggil dari user gesture)
   */
  unlock() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch((e) => console.warn('[Audio] resume failed:', e));
    }
  },

  /**
   * Save preferences
   */
  savePrefs() {
    try {
      localStorage.setItem('kd_audio', JSON.stringify({
        muted: this.muted,
        volume: this.volume,
        sfxVolume: this.sfxVolume,
      }));
    } catch (e) {
      // ignore
    }
  },

  /**
   * Toggle mute
   */
  toggleMute() {
    this.muted = !this.muted;
    this.savePrefs();
    if (this.currentBGM) {
      this.currentBGM.volume = this.muted ? 0 : this.volume;
    }
    return this.muted;
  },

  /**
   * Set volume (0-1)
   */
  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    this.savePrefs();
    if (this.currentBGM && !this.muted) {
      this.currentBGM.volume = this.volume;
    }
  },

  /**
   * Play BGM (loop). Path relatif ke root.
   * Otomatis fade-out BGM sebelumnya.
   */
  playBGM(path) {
    if (!this.enabled) return;
    this.init();

    // Stop BGM sebelumnya dengan fade
    if (this.currentBGM && !this.currentBGM.paused) {
      const oldBGM = this.currentBGM;
      const fadeOut = setInterval(() => {
        if (oldBGM.volume > 0.05) {
          oldBGM.volume = Math.max(0, oldBGM.volume - 0.05);
        } else {
          clearInterval(fadeOut);
          oldBGM.pause();
          oldBGM.currentTime = 0;
        }
      }, 50);
    }

    try {
      const audio = new Audio(path);
      audio.loop = true;
      audio.volume = 0; // start silent, fade in
      audio.play().then(() => {
        // Fade in
        const fadeIn = setInterval(() => {
          if (audio.volume < this.volume - 0.05 && !this.muted) {
            audio.volume = Math.min(this.volume, audio.volume + 0.05);
          } else {
            clearInterval(fadeIn);
            if (this.muted) audio.volume = 0;
          }
        }, 50);
      }).catch((err) => {
        // File tidak ada — diam saja, tidak masalah
        console.log(`[Audio] BGM '${path}' tidak dapat diputar:`, err.message);
      });
      this.currentBGM = audio;
    } catch (err) {
      console.log(`[Audio] Error membuat audio untuk '${path}':`, err);
    }
  },

  /**
   * Stop BGM dengan fade out
   */
  stopBGM() {
    if (!this.currentBGM) return;
    const bgm = this.currentBGM;
    const fade = setInterval(() => {
      if (bgm.volume > 0.05) {
        bgm.volume = Math.max(0, bgm.volume - 0.05);
      } else {
        clearInterval(fade);
        bgm.pause();
        bgm.currentTime = 0;
      }
    }, 50);
    this.currentBGM = null;
  },

  /**
   * Play SFX (one-shot). Bisa dipanggil berkali-kali tanpa overlap.
   */
  playSFX(path) {
    if (!this.enabled || this.muted) return;
    this.init();
    try {
      const audio = new Audio(path);
      audio.volume = this.sfxVolume;
      audio.play().catch((err) => {
        // File tidak ada — diam saja
        console.warn(`[Audio] SFX '${path}' tidak dapat diputar:`, err.message);
      });
    } catch (err) {
      console.warn(`[Audio] Error SFX '${path}':`, err);
    }
  },

  /**
   * Helper untuk mendapatkan base path yang dinamis 
   * agar tidak error saat berada di sub-folder tanpa trailing slash
   */
  getBasePath() {
    // Di lingkungan server, pakai absolute path yang diambil dari nama subfolder
    let path = window.location.pathname;
    
    // Jika path berakhiran file (misal index.html), potong ke foldernya
    if (path.match(/\.[a-zA-Z0-9]+$/)) {
      path = path.substring(0, path.lastIndexOf('/'));
    }
    
    // Pastikan diakhiri dengan slash
    if (!path.endsWith('/')) {
      path += '/';
    }
    
    return path;
  },

  /**
   * Helper: play SFX by short name (e.g. 'click', 'correct')
   * Otomatis lookup ke /audio/sfx/sfx-{name}.mp3
   */
  sfx(name) {
    const fullPath = this.getBasePath() + `audio/sfx/sfx-${name}${this.ext}`;
    console.log('[Audio] Memutar SFX:', fullPath);
    this.playSFX(fullPath);
  },

  /**
   * Helper: play BGM by short name
   */
  bgm(name) {
    const fullPath = this.getBasePath() + `audio/bgm/bgm-${name}${this.ext}`;
    console.log('[Audio] Memutar BGM:', fullPath);
    this.playBGM(fullPath);
  },

  /**
   * Get state untuk UI binding
   */
  getState() {
    return {
      muted: this.muted,
      volume: this.volume,
    };
  },
};

// Expose global
window.AudioManager = AudioManager;
