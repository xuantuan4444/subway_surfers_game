import { AudioPool } from '../audio/AudioPool.js';

const SFX_PATH = './audio/sfx/';
const MUSIC_PATH = './audio/music/';

export class AudioManager {
  constructor() {
    this.context = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.masterGain = null;
    this.buffers = {};
    this.musicSource = null;
    this.currentMusic = null;
    this._muted = false;
    this._sfxPool = null;
    this._initialized = false;
    this._loadQueue = [];
    this._loadCount = 0;
    this._totalToLoad = 0;
    this._onReady = null;
    this._resumeHandler = null;
  }

  init() {
    if (this._initialized) return;
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);
    this.musicGain = this.context.createGain();
    this.musicGain.connect(this.masterGain);
    this.sfxGain = this.context.createGain();
    this.sfxGain.connect(this.masterGain);
    this._sfxPool = new AudioPool(this.context, 16);
    this._initialized = true;
    this._resumeHandler = () => this._resumeContext();
    window.addEventListener('click', this._resumeHandler, { once: true });
    window.addEventListener('keydown', this._resumeHandler, { once: true });
    window.addEventListener('touchstart', this._resumeHandler, { once: true });
    return this;
  }

  _resumeContext() {
    if (this.context && this.context.state === 'suspended') {
      this.context.resume();
    }
  }

  loadManifest(manifest) {
    const entries = [];
    for (const [name, path] of Object.entries(manifest.sfx || {})) {
      entries.push({ name, url: SFX_PATH + path, type: 'sfx' });
    }
    for (const [name, path] of Object.entries(manifest.music || {})) {
      entries.push({ name, url: MUSIC_PATH + path, type: 'music' });
    }
    this._totalToLoad = entries.length;
    this._loadCount = 0;
    return Promise.all(entries.map(entry => this._loadOne(entry)));
  }

  _loadOne(entry) {
    return fetch(entry.url)
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load ${entry.url}`);
        return res.arrayBuffer();
      })
      .then(data => this.context.decodeAudioData(data))
      .then(buffer => {
        this.buffers[entry.name] = buffer;
        this._loadCount++;
        return entry.name;
      })
      .catch(err => {
        console.warn(`[Audio] ${entry.name} load failed:`, err.message);
        this._loadCount++;
        return null;
      });
  }

  play(name, options = {}) {
    if (!this._initialized) return null;
    const buffer = this.buffers[name];
    if (!buffer) return null;

    let lastNode = this.context.createGain();
    lastNode.gain.value = options.volume ?? 1;

    if (options.filter) {
      const filter = this.context.createBiquadFilter();
      filter.type = options.filter.type || 'lowpass';
      filter.frequency.value = options.filter.frequency ?? 2000;
      filter.Q.value = options.filter.Q ?? 1;
      lastNode.connect(filter);
      lastNode = filter;
    }

    if (options.compressor) {
      const comp = this.context.createDynamicsCompressor();
      if (options.compressor.threshold != null) comp.threshold.value = options.compressor.threshold;
      if (options.compressor.knee != null) comp.knee.value = options.compressor.knee;
      if (options.compressor.ratio != null) comp.ratio.value = options.compressor.ratio;
      if (options.compressor.attack != null) comp.attack.value = options.compressor.attack;
      if (options.compressor.release != null) comp.release.value = options.compressor.release;
      lastNode.connect(comp);
      lastNode = comp;
    }

    lastNode.connect(this.sfxGain);
    return this._sfxPool.acquire(buffer, lastNode, options.loop ?? false);
  }

  playRandom(prefix, options = {}) {
    const keys = Object.keys(this.buffers).filter(k => k.startsWith(prefix));
    if (keys.length === 0) return null;
    const name = keys[Math.floor(Math.random() * keys.length)];
    return this.play(name, options);
  }

  stopAllSfx() {
    if (this._sfxPool) this._sfxPool.stopAll();
  }

  playMusic(name) {
    if (!this._initialized) return;
    this.stopMusic();
    const buffer = this.buffers[name];
    if (!buffer) return;
    this.currentMusic = name;
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(this.musicGain);
    source.start(0);
    this.musicSource = source;
  }

  stopMusic(fadeOut = 0) {
    if (!this.musicSource) return;
    if (fadeOut > 0) {
      const current = this.musicSource;
      const gain = this.musicGain;
      const startGain = gain.gain.value;
      const startTime = this.context.currentTime;
      const step = () => {
        const elapsed = this.context.currentTime - startTime;
        const t = Math.min(elapsed / fadeOut, 1);
        gain.gain.value = startGain * (1 - t);
        if (t < 1) requestAnimationFrame(step);
        else {
          try { current.stop(); } catch (_) {}
          try { current.disconnect(); } catch (_) {}
          gain.gain.value = startGain;
        }
      };
      step();
    } else {
      try { this.musicSource.stop(); } catch (_) {}
      try { this.musicSource.disconnect(); } catch (_) {}
    }
    this.musicSource = null;
    this.currentMusic = null;
  }

  setMusicVolume(v) {
    if (this.musicGain) this.musicGain.gain.value = v;
  }

  setSfxVolume(v) {
    if (this.sfxGain) this.sfxGain.gain.value = v;
  }

  setMasterVolume(v) {
    if (this.masterGain) this.masterGain.gain.value = v;
  }

  mute() {
    this._muted = true;
    this.setMasterVolume(0);
  }

  unmute() {
    this._muted = false;
    this.setMasterVolume(1);
  }

  toggleMute() {
    this._muted ? this.unmute() : this.mute();
    return this._muted;
  }

  isMuted() {
    return this._muted;
  }

  getLoadProgress() {
    if (this._totalToLoad === 0) return 1;
    return this._loadCount / this._totalToLoad;
  }

  dispose() {
    this.stopMusic();
    this.stopAllSfx();
    if (this.context) this.context.close();
    this._initialized = false;
    if (this._resumeHandler) {
      window.removeEventListener('click', this._resumeHandler);
      window.removeEventListener('keydown', this._resumeHandler);
      window.removeEventListener('touchstart', this._resumeHandler);
    }
  }
}
