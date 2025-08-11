/**
 * Manages global game settings persisted across sessions.
 * Current surface: reduced-motion preference.
 */
export class SettingsManager {
  private static readonly STORAGE_KEY = 'reducedMotion';
  private _reducedMotion = false;
  private _usingSystemPreference = true;

  constructor() {
    // Initialize from saved value or fall back to system preference
    try {
      const saved = localStorage.getItem(SettingsManager.STORAGE_KEY);
      if (saved != null) {
        this._reducedMotion = saved === '1';
        this._usingSystemPreference = false;
      } else if (typeof window !== 'undefined' && 'matchMedia' in window) {
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        this._reducedMotion = mql.matches;
        this._usingSystemPreference = true;
        // Track system changes only while no explicit user choice is saved
        try {
          mql.addEventListener?.('change', (e: MediaQueryListEvent) => {
            if (this._usingSystemPreference) {
              this._reducedMotion = e.matches;
            }
          });
        } catch { /* noop */ }
      }
    } catch { /* noop */ }
  }

  /** Whether reduced motion is currently enabled. */
  get reducedMotion() {
    return this._reducedMotion;
  }

  /**
   * Sets reduced motion and persists the explicit preference.
   * From now on, system preference changes won't override the explicit choice.
   */
  set reducedMotion(v: boolean) {
    this._reducedMotion = v;
    this._usingSystemPreference = false;
    try {
      localStorage.setItem(SettingsManager.STORAGE_KEY, v ? '1' : '0');
    } catch { /* noop */ }
  }

  /** Toggle reduced motion. */
  toggleReducedMotion() {
    this.reducedMotion = !this.reducedMotion;
  }
}

// Singleton instance used across the app
export const Settings = new SettingsManager();
