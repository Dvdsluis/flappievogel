export type EnemyVariant = 'drone' | 'bee' | 'tank' | 'kamikaze';

export class Enemy {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  health: number;
  variant: EnemyVariant;
  constructor(
    x: number,
    y: number,
    vx: number = -120,
    vy: number = 0,
    variant: EnemyVariant = 'drone'
  ) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.variant = variant;
    // Defaults by variant
    if (variant === 'tank') { this.width = 34; this.height = 26; this.health = 3; }
    else { this.width = 24; this.height = 18; this.health = 1; }
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  isOffScreen() { return this.x + this.width < -40; }
}
