export class Enemy {
  x: number;
  y: number;
  width: number = 24;
  height: number = 18;
  vx: number;
  vy: number;
  health: number = 1;
  constructor(x: number, y: number, vx: number = -120, vy: number = 0) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  isOffScreen() { return this.x + this.width < -40; }
}
