class AudioEngine {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this._reminderAudio = null;
    this._reminderUrl = this._assetUrl('gong.mp3');
    this._timerAudio = null;
    this._timerLastAt = 0;

    this._ambientSounds = {};
    this._ambientActive = null;
    this._ambientVolume = 0.3;
  }

  _assetUrl(filename) {
    return new URL(`../assets/${filename}`, window.location.href).toString();
  }

  init() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playGong(duration = 2.0, volume = 0.3) {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(528, now);
    osc1.frequency.exponentialRampToValueAtTime(520, now + duration);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1056, now);
    osc2.frequency.exponentialRampToValueAtTime(1040, now + duration);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration);
    osc2.stop(now + duration);
  }

  playTick() {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.1);
  }

  _getReminderAudio() {
    if (!this._reminderAudio) {
      this._reminderAudio = new Audio(this._reminderUrl);
      this._reminderAudio.volume = 0.5;
      this._reminderAudio.preload = 'auto';
    }
    return this._reminderAudio;
  }

  _getTimerAudio() {
    if (!this._timerAudio) {
      this._timerAudio = new Audio(this._reminderUrl);
      this._timerAudio.volume = 0.35;
      this._timerAudio.preload = 'auto';
    }
    return this._timerAudio;
  }

  playReminder() {
    if (!this.enabled) return;
    const audio = this._getReminderAudio();
    audio.currentTime = 0;
    audio.play().catch(() => this._playReminderFallback());
  }

  playTimerTick() {
    if (!this.enabled) return;
    const now = Date.now();
    if (now - this._timerLastAt < 400) return;
    this._timerLastAt = now;
    const audio = this._getTimerAudio();
    audio.currentTime = 0;
    audio.play().catch(() => this.playTick());
  }

  _playReminderFallback() {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [0, 0.3, 0.6].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(600 + delay * 100, now + delay);
      gain.gain.setValueAtTime(0.15, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.25);
    });
  }

  playSuccess() {
    if (!this.enabled) return;
    this.init();
    const ctx = this.ctx;
    const now = ctx.currentTime;

    [0, 0.15, 0.3].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime([523, 659, 784][i], now + delay);
      gain.gain.setValueAtTime(0.15, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + delay);
      osc.stop(now + delay + 0.3);
    });
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  _getAmbientAudio(type) {
    if (!this._ambientSounds[type]) {
      const urlMap = {
        rain: this._assetUrl('ambient-rain.mp3'),
        forest: this._assetUrl('ambient-forest.mp3'),
      };
      const audio = new Audio(urlMap[type] || urlMap.rain);
      audio.loop = true;
      audio.volume = this._ambientVolume;
      this._ambientSounds[type] = audio;
    }
    return this._ambientSounds[type];
  }

  playAmbient(type) {
    if (!this.enabled) return;
    this.stopAmbient();
    const audio = this._getAmbientAudio(type);
    audio.play().then(() => {
      this._ambientActive = type;
    }).catch(() => {
      if (this._ambientSounds[type]) {
        delete this._ambientSounds[type];
      }
      this._ambientActive = null;
    });
  }

  stopAmbient() {
    Object.values(this._ambientSounds).forEach((audio) => {
      if (!audio) return;
      audio.pause();
      audio.currentTime = 0;
    });
    this._ambientActive = null;
  }

  setAmbientVolume(volume) {
    this._ambientVolume = Math.max(0, Math.min(1, volume));
    Object.values(this._ambientSounds).forEach((audio) => {
      if (audio) audio.volume = this._ambientVolume;
    });
  }

  getAmbientVolume() {
    return this._ambientVolume;
  }

  getAmbientActive() {
    return this._ambientActive;
  }
}

window.audioEngine = new AudioEngine();
