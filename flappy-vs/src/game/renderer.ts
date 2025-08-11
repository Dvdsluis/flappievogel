import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/Enemy';
import { PowerUp } from '../entities/PowerUp';

export class Renderer {
    private t = 0;
    private cloudOffset = 0;
    constructor(public canvas: HTMLCanvasElement, public ctx: CanvasRenderingContext2D) {}

    clear(dt: number = 0) {
        const { ctx } = this;
        const w = this.canvas.width, h = this.canvas.height;
        this.t += dt;
        this.cloudOffset = (this.cloudOffset + dt * 20) % (w + 200);

        // Sky gradient
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0f1630');
        g.addColorStop(1, '#0b1022');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Clouds (simple rounded rectangles drifting)
        const drawCloud = (x: number, y: number, s: number) => {
            ctx.fillStyle = '#ffffff14';
            ctx.beginPath();
            ctx.roundRect(x, y, 120 * s, 40 * s, 20 * s);
            ctx.fill();
        };
        for (let i = 0; i < 4; i++) {
            const x = w - ((this.cloudOffset + i * 180) % (w + 200));
            const y = 40 + (i * 45) % (h * 0.5);
            drawCloud(x, y, 1);
        }

        // Ground strip
        ctx.fillStyle = '#1a2446';
        ctx.fillRect(0, h - 20, w, 20);
        ctx.fillStyle = '#111a36';
        for (let x = 0; x < w; x += 16) ctx.fillRect(x, h - 22, 8, 2);
    }

    // Vector “bird”
    drawBird(p: Player, color: string) {
        const { ctx } = this;
        const r = Math.min(p.width, p.height) / 2;
        const cx = p.x + r, cy = p.y + r;
        const wingPhase = Math.sin(this.t * 10) * 0.6; // flap

        // body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        // belly
        ctx.fillStyle = '#ffffff88';
        ctx.beginPath();
        ctx.arc(cx - r * 0.2, cy + r * 0.1, r * 0.7, Math.PI * 0.1, Math.PI * 1.2);
        ctx.fill();

        // wing
        ctx.save();
        ctx.translate(cx - r * 0.2, cy);
        ctx.rotate(-0.8 + wingPhase);
        ctx.fillStyle = '#00000022';
        ctx.beginPath();
        ctx.ellipse(0, 0, r * 0.9, r * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // beak
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.moveTo(cx + r * 0.9, cy);
        ctx.lineTo(cx + r * 1.4, cy - r * 0.2);
        ctx.lineTo(cx + r * 0.9, cy + r * 0.2);
        ctx.closePath();
        ctx.fill();

        // eye
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(cx + r * 0.2, cy - r * 0.3, r * 0.22, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(cx + r * 0.25, cy - r * 0.3, r * 0.1, 0, Math.PI * 2);
        ctx.fill();
    }

    drawPlayer(p: Player, color: string = '#58a6ff') {
        this.drawBird(p, color);
    }

    drawObstacle(o: Obstacle) {
        const { ctx } = this;
        // shaded pipe
        const grad = ctx.createLinearGradient(o.x, o.y, o.x + o.width, o.y);
        grad.addColorStop(0, '#2bc072');
        grad.addColorStop(1, '#3be688');
        ctx.fillStyle = grad;
        ctx.fillRect(o.x, o.y, o.width, o.height);
        ctx.fillStyle = '#ffffff18';
        ctx.fillRect(o.x + 6, o.y, 6, o.height); // highlight stripe
    }

    drawHUD(text: string) {
        this.ctx.fillStyle = '#e8e8f0';
        this.ctx.font = '700 24px system-ui, sans-serif';
        this.ctx.fillText(text, 16, 32);
    }

    drawProjectile(b: Projectile, color: string = '#ffd166') {
        const { ctx } = this;
        ctx.fillStyle = color;
        ctx.fillRect(b.x, b.y, b.width, b.height);
    }

    drawEnemy(e: Enemy) {
        const { ctx } = this;
        ctx.fillStyle = '#ff7b72';
        ctx.beginPath();
        ctx.ellipse(e.x + e.width/2, e.y + e.height/2, e.width/2, e.height/2, 0, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = '#00000055';
        ctx.fillRect(e.x + 2, e.y + 2, e.width - 4, 3); // simple band
    }

    drawPowerUp(p: PowerUp) {
        const { ctx } = this;
        const colors: Record<string,string> = { heal: '#7ee787', rapid: '#f7b84a', shield: '#8b8efb' };
        ctx.fillStyle = colors[p.type] || '#f7b84a';
        ctx.beginPath();
        ctx.roundRect(p.x, p.y, p.width, p.height, 4);
        ctx.fill();
    }
}