export type Particle = {
  x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: string; g?: number;
};

export class Particles {
  pool: Particle[] = [];
  active: Particle[] = [];

  spawn(x: number, y: number, opts?: Partial<Particle>) {
    const p = this.pool.pop() || ({ x, y, vx: 0, vy: 0, life: 0.5, maxLife: 0.5, size: 3, color: '#fff' } as Particle);
    p.x = x; p.y = y;
    p.vx = opts?.vx ?? (Math.random() * 80 - 40);
    p.vy = opts?.vy ?? (Math.random() * -80);
    p.life = opts?.life ?? 0.5;
    p.maxLife = p.life;
    p.size = opts?.size ?? 3;
    p.color = opts?.color ?? '#ffffff88';
    p.g = opts?.g ?? 200;
    this.active.push(p);
  }

  burst(x: number, y: number, n: number, baseColor: string) {
    for (let i = 0; i < n; i++) this.spawn(x, y, { color: baseColor, size: 2 + Math.random() * 2, life: 0.4 + Math.random() * 0.3 });
  }

  update(dt: number) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.vy += (p.g || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.pool.push(p);
        this.active.splice(i, 1);
      }
    }
  }

  render(ctx: CanvasRenderingContext2D) {
    for (const p of this.active) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color.replace(/\d?\.?\d*\)$/,'') || p.color;
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
