class AudioManager {
  private ctx: AudioContext | null = null;
  private _muted = false;

  get muted() { return this._muted; }
  set muted(v: boolean) { this._muted = v; try { localStorage.setItem('mute', v ? '1' : '0'); } catch {}
  }

  private ensure() {
    if (!this.ctx) this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  beep(freq: number, duration = 0.08, type: OscillatorType = 'sine', gain = 0.05) {
    if (this._muted) return;
    this.ensure();
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.value = gain;
    osc.connect(g).connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + duration);
  }

  flap() { this.beep(660, 0.05, 'square', 0.05); }
  score() { this.beep(880, 0.08, 'triangle', 0.06); }
  hit() { this.beep(120, 0.15, 'sawtooth', 0.08); }
  combo(n: number) { if (this._muted) return; const f = 900 + Math.min(4, n) * 80; this.beep(f, 0.05, 'triangle', 0.05); }
}

export const Audio = new AudioManager();
try { Audio.muted = (localStorage.getItem('mute') === '1'); } catch {}
