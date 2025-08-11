export class SettingsManager {
  private _reducedMotion = false;

  constructor() {
    try {
      const saved = localStorage.getItem('reducedMotion');
      if (saved != null) {
        this._reducedMotion = saved === '1';
      } else if (typeof window !== 'undefined' && 'matchMedia' in window) {
        this._reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch {}
  }

  get reducedMotion() { return this._reducedMotion; }
  set reducedMotion(v: boolean) {
    this._reducedMotion = v;
    try { localStorage.setItem('reducedMotion', v ? '1' : '0'); } catch {}
  }

  toggleReducedMotion() { this.reducedMotion = !this.reducedMotion; }
}

export const Settings = new SettingsManager();
