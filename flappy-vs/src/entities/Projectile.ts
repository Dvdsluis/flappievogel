export class Projectile {
  x: number;
  y: number;
  width: number = 10;
  height: number = 4;
  vx: number;
  vy: number;
  owner: 'p1' | 'p2' | 'player';
  active = true;
  damage = 1;
  color?: string;
  constructor(x: number, y: number, vx: number, vy: number, owner: 'p1' | 'p2' | 'player' = 'player') {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy; this.owner = owner;
  }
  update(dt: number) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
  }
  isOffScreen(w: number, h: number) {
    return this.x > w + 20 || this.x + this.width < -20 || this.y > h + 20 || this.y + this.height < -20;
  }
}
