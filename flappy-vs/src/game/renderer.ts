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
        // Softer, cooler pipe with rounded edges and subtle shading
        const x = o.x, y = o.y, w = o.width, h = o.height;
        ctx.save();
        // Body gradient (desaturated teal)
        const grad = ctx.createLinearGradient(x, y, x + w, y);
        grad.addColorStop(0, '#1e7755');
        grad.addColorStop(1, '#2a9a6d');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, y, w, h, Math.min(8, w * 0.25));
        ctx.fill();
        // Subtle rim light and shadow
        const inner = ctx.createLinearGradient(x, y, x + w, y);
        inner.addColorStop(0, 'rgba(255,255,255,0.10)');
        inner.addColorStop(0.2, 'rgba(255,255,255,0.03)');
        inner.addColorStop(0.8, 'rgba(0,0,0,0.08)');
        inner.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = inner;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, Math.min(8, w * 0.25)); ctx.fill();
        // Faint vertical banding for texture
        ctx.globalAlpha = 0.06;
        ctx.fillStyle = '#ffffff';
        for (let i = 4; i < w; i += 10) {
            ctx.fillRect(x + i, y, 1, h);
        }
        ctx.globalAlpha = 1;
        // Top lip (cap)
        const capH = Math.min(10, h * 0.1);
        const capGrad = ctx.createLinearGradient(x, y, x, y + capH);
        capGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
        capGrad.addColorStop(1, 'rgba(255,255,255,0.05)');
        ctx.fillStyle = capGrad;
        ctx.beginPath(); ctx.roundRect(x - 2, y - 2, w + 4, capH + 4, 6); ctx.fill();
        ctx.restore();
    }

    drawHUD(text: string) {
        this.ctx.fillStyle = '#e8e8f0';
        this.ctx.font = '700 24px system-ui, sans-serif';
        this.ctx.fillText(text, 16, 32);
    }

    drawProjectile(b: Projectile, color: string = '#ffd166') {
        const { ctx } = this;
    // Glow + rounded projectile
    const c = b.color || color;
    ctx.save();
    ctx.shadowColor = c + 'aa';
    ctx.shadowBlur = 10;
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.roundRect(b.x, b.y, b.width, b.height, Math.min(6, b.height/2));
    ctx.fill();
    // Motion hint (streak)
    ctx.globalAlpha = 0.35;
    ctx.shadowBlur = 0;
    ctx.fillStyle = c;
    ctx.fillRect(b.x - Math.min(16, b.width * 2), b.y + b.height * 0.25, Math.min(16, b.width * 2), b.height * 0.5);
    ctx.restore();
    }

    drawEnemy(e: Enemy) {
        const { ctx } = this;
        const variant = (e as any).variant || 'drone';
        ctx.save();
        if (variant === 'tank') {
            // Body with metallic gradient and outline
            const grad = ctx.createLinearGradient(e.x, e.y, e.x, e.y + e.height);
            grad.addColorStop(0, '#d86a6a');
            grad.addColorStop(1, '#a83e3e');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.roundRect(e.x, e.y, e.width, e.height, 4); ctx.fill();
            ctx.lineWidth = 2; ctx.strokeStyle = '#00000055'; ctx.stroke();
            // Treads
            ctx.fillStyle = '#0f172a88'; ctx.fillRect(e.x + 3, e.y + e.height - 6, e.width - 6, 5);
            // Turret
            ctx.fillStyle = '#7f1d1d'; ctx.fillRect(e.x + e.width - 8, e.y + e.height/2 - 2, 10, 4);
        } else if (variant === 'bee') {
            // Body
            ctx.fillStyle = '#ffd166';
            ctx.beginPath(); ctx.ellipse(e.x + e.width/2, e.y + e.height/2, e.width/2, e.height/2, 0, 0, Math.PI*2); ctx.fill();
            // Stripes
            ctx.fillStyle = '#00000066';
            ctx.fillRect(e.x + 4, e.y + 4, e.width - 8, 3);
            ctx.fillRect(e.x + 4, e.y + 9, e.width - 8, 3);
            // Wings (buzz)
            const buzz = Math.sin(this.t * 30) * 0.4;
            ctx.fillStyle = '#ffffff88';
            ctx.save();
            ctx.translate(e.x + e.width/2 - 4, e.y + 2);
            ctx.rotate(-0.6 + buzz);
            ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.translate(e.x + e.width/2 + 4, e.y + 2);
            ctx.rotate(0.6 - buzz);
            ctx.beginPath(); ctx.ellipse(0, 0, 6, 3, 0, 0, Math.PI*2); ctx.fill();
            ctx.restore();
            // Eye
            ctx.fillStyle = '#111827'; ctx.beginPath(); ctx.arc(e.x + e.width - 6, e.y + 6, 2, 0, Math.PI*2); ctx.fill();
        } else if (variant === 'kamikaze') {
            // Pulsing glow orb
            const pulse = 0.6 + 0.4 * Math.sin(this.t * 6);
            ctx.shadowColor = '#ff3b30aa'; ctx.shadowBlur = 18 * pulse;
            ctx.fillStyle = '#ff7b72';
            ctx.beginPath(); ctx.ellipse(e.x + e.width/2, e.y + e.height/2, e.width/2, e.height/2, 0, 0, Math.PI*2); ctx.fill();
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#ffffffaa';
            ctx.beginPath(); ctx.arc(e.x + e.width/2 + 3, e.y + e.height/2 - 2, 3, 0, Math.PI*2); ctx.fill();
        } else { // drone
            // Body with subtle highlight
            const grad = ctx.createLinearGradient(e.x, e.y, e.x, e.y + e.height);
            grad.addColorStop(0, '#ff8a82');
            grad.addColorStop(1, '#ff6a60');
            ctx.fillStyle = grad;
            ctx.beginPath(); ctx.ellipse(e.x + e.width/2, e.y + e.height/2, e.width/2, e.height/2, 0, 0, Math.PI*2); ctx.fill();
            // Eyelight bar
            ctx.fillStyle = '#00000055'; ctx.fillRect(e.x + 2, e.y + 2, e.width - 4, 3);
            // Blinking status LED
            const blink = (Math.floor(this.t * 4) % 2) === 0 ? 1 : 0;
            ctx.globalAlpha = 0.6 + 0.4 * blink; ctx.fillStyle = '#38bdf8';
            ctx.beginPath(); ctx.arc(e.x + e.width - 6, e.y + e.height - 6, 2, 0, Math.PI*2); ctx.fill();
            ctx.globalAlpha = 1;
        }
        ctx.restore();
    }

    drawPowerUp(p: PowerUp) {
        const { ctx } = this;
        const colors: Record<string,string> = {
            heal: '#7ee787', rapid: '#f7b84a', shield: '#8b8efb',
            multishot: '#38bdf8', bigshot: '#fb7185', slowmo: '#a78bfa', magnet: '#f472b6'
        };
        const base = colors[p.type] || '#f7b84a';
        // Bobbing and pulsing
        const bob = Math.sin(this.t * 3 + (p.x + p.y) * 0.01) * 2;
        const pulse = 0.75 + 0.25 * Math.sin(this.t * 4 + (p.x) * 0.03);
        const x = p.x, y = p.y + bob, w = p.width, h = p.height;
        // Outer glow
        ctx.save();
        ctx.shadowColor = base + 'aa';
        ctx.shadowBlur = 14 * pulse;
        // Gradient fill
        const grad = ctx.createLinearGradient(x, y, x, y + h);
        grad.addColorStop(0, base);
        grad.addColorStop(1, '#ffffff55');
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.roundRect(x, y, w, h, 6); ctx.fill();
        // Outline
        ctx.lineWidth = 2; ctx.strokeStyle = '#0f172a66'; ctx.stroke();
        // Glyphs per type
        ctx.shadowBlur = 0; ctx.fillStyle = '#0f172a';
        const cx = x + w/2, cy = y + h/2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(1.0 + (pulse-1)*0.5, 1.0 + (pulse-1)*0.5);
        // Draw simple icons
        if ((p as any).type === 'heal') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-2, -6, 4, 12);
            ctx.fillRect(-6, -2, 12, 4);
        } else if ((p as any).type === 'shield') {
            ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.beginPath();
            ctx.moveTo(0, -6); ctx.quadraticCurveTo(8, -4, 8, 2); ctx.quadraticCurveTo(0, 8, 0, 10);
            ctx.quadraticCurveTo(0, 8, -8, 2); ctx.quadraticCurveTo(-8, -4, 0, -6); ctx.stroke();
        } else if ((p as any).type === 'multishot') {
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(-6, -2, 4, 4); ctx.fillRect(-1, -2, 4, 4); ctx.fillRect(4, -2, 4, 4);
        } else if ((p as any).type === 'rapid') {
            ctx.fillStyle = '#0f172a';
            ctx.beginPath(); ctx.moveTo(-5, -6); ctx.lineTo(1, 0); ctx.lineTo(-3, 0); ctx.lineTo(5, 6); ctx.closePath(); ctx.fill();
        } else if ((p as any).type === 'bigshot') {
            ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.roundRect(-4, -3, 8, 6, 3); ctx.fill();
        } else if ((p as any).type === 'slowmo') {
            ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI*2); ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 2; ctx.stroke();
            ctx.fillRect(-1, -4, 2, 4); ctx.fillRect(-1, 0, 2, 4);
        } else if ((p as any).type === 'magnet') {
            ctx.strokeStyle = '#0f172a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 6, Math.PI*0.2, Math.PI*0.8); ctx.stroke();
            ctx.beginPath(); ctx.arc(0, 0, 6, -Math.PI*0.8, -Math.PI*0.2); ctx.stroke();
        } else {
            ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(0, 0, 3, 0, Math.PI*2); ctx.fill();
        }
        ctx.restore();
        ctx.restore();
    }
}