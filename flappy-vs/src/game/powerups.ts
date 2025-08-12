import type { PowerType } from '../entities/PowerUp';

export type PowerUpKey = PowerType;

export const POWERUPS: Record<PowerUpKey, {
  color: string;
  glyph: string;
  label: string;
  duration?: number; // seconds for timed effects
  cooldownMul?: number; // multiplier applied to weapon cooldown
  description: string;
}> = {
  heal:       { color: '#7ee787', glyph: '+',  label: 'Heal',  description: 'Gain 1 heart' },
  shield:     { color: '#8b8efb', glyph: 'S',  label: 'Shield',description: '+1 max heart and heal' },
  rapid:      { color: '#f7b84a', glyph: 'R',  label: 'Rapid', description: 'Shorter cooldown', duration: 8,  cooldownMul: 0.55 },
  multishot:  { color: '#38bdf8', glyph: 'M',  label: 'Multi', description: 'Fires 3 bullets',  duration: 8 },
  bigshot:    { color: '#fb7185', glyph: 'B',  label: 'Big',   description: 'Bigger bullets, +1 dmg', duration: 8 },
  slowmo:     { color: '#a78bfa', glyph: '⌛', label: 'Slow',  description: 'World slows briefly', duration: 3.5 },
  magnet:     { color: '#f472b6', glyph: 'U',  label: 'Mag',   description: 'Pulls pickups nearby', duration: 8 },
};

// Simple weighted pick with gentle ramping by score
export function pickPowerUp(score: number, rng: () => number = Math.random): PowerUpKey {
  // Base weights
  let w = {
    heal: 2.2,
    shield: 1.6,
    rapid: 1.2,
    multishot: 1.0,
    bigshot: 0.9,
    slowmo: 0.9,
    magnet: 1.0,
  } as Record<PowerUpKey, number>;

  if (score < 5) {
    w.multishot *= 0.3; w.bigshot *= 0.3; w.slowmo *= 0.4; w.magnet *= 0.5;
    w.heal *= 1.3; w.shield *= 1.2;
  } else if (score < 15) {
    const t = (score - 5) / 10; // 0..1
    w.multishot *= (0.3 + 0.7 * t);
    w.bigshot   *= (0.3 + 0.7 * t);
    w.slowmo    *= (0.4 + 0.6 * t);
    w.magnet    *= (0.5 + 0.5 * t);
  } else {
    // later tilt slightly towards skill-based effects
    w.rapid *= 1.1; w.multishot *= 1.15; w.bigshot *= 1.1;
  }
  const entries = Object.entries(w) as Array<[PowerUpKey, number]>
    .filter(([k, val]) => val > 0);
  const total = entries.reduce((s, [, val]) => s + val, 0);
  let r = rng() * total;
  for (const [key, val] of entries) { r -= val; if (r <= 0) return key; }
  return entries[entries.length - 1][0];
}
