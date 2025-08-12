export type PowerType = 'heal' | 'rapid' | 'shield' | 'multishot' | 'bigshot' | 'slowmo' | 'magnet';

export class PowerUp {
  x: number;
  y: number;
  width: number = 16;
  height: number = 16;
  vx: number = -80;
  vy: number = 0;
  type: PowerType;
  constructor(x: number, y: number, type: PowerType) {
    this.x = x; this.y = y; this.type = type;
  }
  update(dt: number) { this.x += this.vx * dt; this.y += this.vy * dt; }
  isOffScreen() { return this.x + this.width < -40; }
}
