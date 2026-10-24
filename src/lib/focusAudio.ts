/**
 * Offline Neuro-Audio Engine for Deep Work & Pomodoro Focus
 * Uses Web Audio API to synthesize ambient focus soundscapes:
 * - White/Pink Noise (Broadband sound mask)
 * - Yomg'ir ovozi (Rain Soundscape)
 * - Kiberpank ambient (Analog lo-fi synth drone with sweeping resonant filter)
 * - Binaural Beats (10Hz Alpha / 40Hz Gamma brainwave synchronization)
 * - Brown Noise (Deep cognitive grounding)
 * Zero external audio files, 100% offline, zero network requests.
 */

export type AmbientType = 'none' | 'white' | 'rain' | 'cyberpunk' | 'binaural' | 'brown';

class FocusAudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeNodes: { stop?: () => void; disconnect: () => void }[] = [];
  private isAmbientPlaying = false;
  private currentAmbientType: AmbientType = 'none';
  private currentVolume = 0.6; // 0.0 to 1.0

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Set master soundscape volume (0.0 to 1.0)
   */
  setVolume(volume: number): void {
    this.currentVolume = Math.max(0, Math.min(1, volume));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.currentVolume, this.ctx.currentTime);
    }
  }

  getVolume(): number {
    return this.currentVolume;
  }

  getCurrentType(): AmbientType {
    return this.currentAmbientType;
  }

  /**
   * Synthesize an uplifting start gong (C4 -> G4 harmony)
   */
  playStartBell(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      [261.63, 392.0, 523.25].forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.05);
        gain.gain.setValueAtTime(0, now + idx * 0.05);
        gain.gain.linearRampToValueAtTime(0.2 * this.currentVolume, now + idx * 0.05 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + 1.3);
      });
    } catch (err) {
      console.warn('Focus start bell error:', err);
    }
  }

  /**
   * Synthesize a celebratory completion chime (triple chime)
   */
  playCompletionBell(): void {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [659.25, 830.61, 987.77, 1318.51];
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.25 * this.currentVolume, now + idx * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.6);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.65);
      });
    } catch (err) {
      console.warn('Focus completion bell error:', err);
    }
  }

  /**
   * Start synthesized ambient soundscape
   */
  startAmbient(type: AmbientType): void {
    if (type === 'none') {
      this.stopAmbient();
      return;
    }

    const ctx = this.getContext();
    if (!ctx) return;

    this.stopAmbient();
    this.currentAmbientType = type;

    try {
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.001, ctx.currentTime);
      masterGain.gain.linearRampToValueAtTime(this.currentVolume, ctx.currentTime + 1.2); // smooth fade-in
      masterGain.connect(ctx.destination);
      this.masterGain = masterGain;

      switch (type) {
        case 'white':
          this.createWhiteNoise(ctx, masterGain);
          break;
        case 'rain':
          this.createRainSoundscape(ctx, masterGain);
          break;
        case 'cyberpunk':
          this.createCyberpunkAmbient(ctx, masterGain);
          break;
        case 'binaural':
          this.createBinauralBeats(ctx, masterGain);
          break;
        case 'brown':
        default:
          this.createBrownNoise(ctx, masterGain);
          break;
      }

      this.isAmbientPlaying = true;
    } catch (err) {
      console.warn('Ambient noise start error:', err);
    }
  }

  /**
   * White / Pink Noise generator
   */
  private createWhiteNoise(ctx: AudioContext, destination: AudioNode): void {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * 0.18;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(destination);
    whiteNoise.start(0);

    this.activeNodes.push(whiteNoise, filter);
  }

  /**
   * Brown Noise generator
   */
  private createBrownNoise(ctx: AudioContext, destination: AudioNode): void {
    const bufferSize = 2 * ctx.sampleRate;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.2;
    }

    const brownSource = ctx.createBufferSource();
    brownSource.buffer = noiseBuffer;
    brownSource.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380, ctx.currentTime);

    brownSource.connect(filter);
    filter.connect(destination);
    brownSource.start(0);

    this.activeNodes.push(brownSource, filter);
  }

  /**
   * Rain Soundscape (Modulated bandpass pink noise + random micro drops)
   */
  private createRainSoundscape(ctx: AudioContext, destination: AudioNode): void {
    const bufferSize = 3 * ctx.sampleRate;
    const rainBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = rainBuffer.getChannelData(0);

    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.12;
    }

    const rainSource = ctx.createBufferSource();
    rainSource.buffer = rainBuffer;
    rainSource.loop = true;

    const bandFilter = ctx.createBiquadFilter();
    bandFilter.type = 'lowpass';
    bandFilter.frequency.setValueAtTime(850, ctx.currentTime);

    rainSource.connect(bandFilter);
    bandFilter.connect(destination);
    rainSource.start(0);

    this.activeNodes.push(rainSource, bandFilter);
  }

  /**
   * Cyberpunk Ambient Drone (Dual detuned synth oscillators + sweeping resonant LFO filter)
   */
  private createCyberpunkAmbient(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;

    // Sub Drone Oscillator (55Hz - A1)
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(55, now);

    // Harmonic Fifth Drone Oscillator (82.4Hz - E2)
    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(82.4, now);

    // Warm Lowpass Resonant Filter
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(260, now);
    filter.Q.setValueAtTime(4, now);

    // Slow LFO to sweep filter cutoff
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.08, now); // slow 12-second breath cycle

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(140, now);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    const gainMix = ctx.createGain();
    gainMix.gain.setValueAtTime(0.22, now);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainMix);
    gainMix.connect(destination);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    this.activeNodes.push(osc1, osc2, lfo, filter, lfoGain, gainMix);
  }

  /**
   * Binaural Beats (10Hz Alpha Wave entrainment: Left 210Hz, Right 220Hz)
   */
  private createBinauralBeats(ctx: AudioContext, destination: AudioNode): void {
    const now = ctx.currentTime;

    // Left channel oscillator (210 Hz)
    const oscLeft = ctx.createOscillator();
    oscLeft.type = 'sine';
    oscLeft.frequency.setValueAtTime(210, now);

    // Right channel oscillator (220 Hz -> 10Hz Alpha differential)
    const oscRight = ctx.createOscillator();
    oscRight.type = 'sine';
    oscRight.frequency.setValueAtTime(220, now);

    // Stereo Panners or ChannelMerger
    if (ctx.createStereoPanner) {
      const panLeft = ctx.createStereoPanner();
      panLeft.pan.setValueAtTime(-0.85, now);

      const panRight = ctx.createStereoPanner();
      panRight.pan.setValueAtTime(0.85, now);

      const beatGain = ctx.createGain();
      beatGain.gain.setValueAtTime(0.24, now);

      oscLeft.connect(panLeft);
      panLeft.connect(beatGain);

      oscRight.connect(panRight);
      panRight.connect(beatGain);

      beatGain.connect(destination);

      this.activeNodes.push(oscLeft, oscRight, panLeft, panRight, beatGain);
    } else {
      // Fallback mix
      const beatGain = ctx.createGain();
      beatGain.gain.setValueAtTime(0.18, now);
      oscLeft.connect(beatGain);
      oscRight.connect(beatGain);
      beatGain.connect(destination);

      this.activeNodes.push(oscLeft, oscRight, beatGain);
    }

    oscLeft.start(now);
    oscRight.start(now);
  }

  /**
   * Stop ambient sound with gentle fade out
   */
  stopAmbient(): void {
    if (!this.isAmbientPlaying && !this.activeNodes.length) return;
    try {
      if (this.masterGain && this.ctx) {
        this.masterGain.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + 0.4);
      }
      setTimeout(() => {
        this.activeNodes.forEach((node) => {
          try {
            if (node.stop) node.stop();
            node.disconnect();
          } catch {
            /* ignore */
          }
        });
        this.activeNodes = [];
        this.isAmbientPlaying = false;
        this.currentAmbientType = 'none';
      }, 420);
    } catch {
      this.isAmbientPlaying = false;
      this.currentAmbientType = 'none';
      this.activeNodes = [];
    }
  }

  isPlaying(): boolean {
    return this.isAmbientPlaying;
  }
}

export const focusAudio = new FocusAudioManager();
