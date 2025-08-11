import GameEngine, { IScene } from '../game/engine';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { HUD } from '../entities/HUD';
import { Physics } from '../game/physics';
import { Renderer } from '../game/renderer';
import { Audio } from '../game/audio';
import { Particles } from '../game/particles';

export class VersusScene implements IScene {
    p1 = new Player(80, 140, 26, 26);
    p2 = new Player(120, 220, 26, 26);
    obstacles: Obstacle[] = [];
    hud = new HUD();
    renderer!: Renderer;
    timeToNext = 0;
    s1 = 0;
    s2 = 0;
    paused = false;
    speed = 140;
    particles = new Particles();
    shakeT = 0;

    init(engine: GameEngine): void {
        this.renderer = new Renderer(engine.canvas, engine.ctx);
    this.obstacles = [];
    this.timeToNext = 0;
    this.s1 = 0;
    this.s2 = 0;
    this.paused = false;
    this.speed = 140;
    const touch = () => { Physics.jump(this.p1); Audio.flap(); };
    engine.canvas.ontouchstart = touch;
    engine.canvas.onpointerdown = touch;
    }

    update(dt: number, engine: GameEngine): void {
        const h = engine.canvas.height;
    if (engine.input.wasPressed('KeyP')) this.paused = !this.paused;
    if (engine.input.wasPressed('KeyR')) this.init(engine);
    if (this.paused) return;
        // Controls: P1 arrows/space; P2 W/S
    if (engine.input.wasPressed('Space') || engine.input.wasPressed('ArrowUp')) { Physics.jump(this.p1); Audio.flap(); this.particles.burst(this.p1.x, this.p1.y+this.p1.height, 6, '#88ccff88'); }
    if (engine.input.wasPressed('KeyW')) { Physics.jump(this.p2); Audio.flap(); this.particles.burst(this.p2.x, this.p2.y+this.p2.height, 6, '#ffb08888'); }
        const dir1 = engine.input.getMovementDirection();
        this.p1.vx = dir1.x * 80;
        this.p2.vx = 0; // only up/down for P2 per requirement
        this.p2.vy += (engine.input.isDown('KeyS') ? 1 : 0) * 300 * dt; // nudge down if S held

        Physics.applyGravity(this.p1, dt);
        Physics.applyGravity(this.p2, dt);
        this.p1.update(dt);
        this.p2.update(dt);
        this.p1.y = Math.max(0, Math.min(h - this.p1.height, this.p1.y));
        this.p2.y = Math.max(0, Math.min(h - this.p2.height, this.p2.y));

        // Pipes
        this.timeToNext -= dt;
        if (this.timeToNext <= 0) {
            this.speed = Math.min(260, this.speed + 2);
            const gap = Math.max(130, 180 - Math.max(this.s1, this.s2) * 2);
            this.timeToNext = Math.max(1.0, 1.7 - Math.max(this.s1, this.s2) * 0.02);
            const minTop = 40;
            const maxTop = h - gap - 40;
            const topH = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
            const w = 80;
            const x = engine.canvas.width + w;
            this.obstacles.push(new Obstacle(x, 0, w, topH, this.speed));
            this.obstacles.push(new Obstacle(x, topH + gap, w, h - (topH + gap), this.speed));
        }
        for (const o of this.obstacles) o.update(dt);
        this.obstacles = this.obstacles.filter((o) => !o.isOffScreen());

        // Collisions reset round
        for (const o of this.obstacles) {
            if (Physics.checkCollision(this.p1, o) || Physics.checkCollision(this.p2, o)) {
                Audio.hit();
                this.particles.burst((this.p1.x+this.p2.x)/2, (this.p1.y+this.p2.y)/2, 16, '#ff7b72aa');
                this.shakeT = 0.25;
                this.init(engine);
                return;
            }
        }

        // Scoring per pair
        for (let i = 0; i < this.obstacles.length; i += 2) {
            const top = this.obstacles[i];
            const centerX = top.x + top.width / 2;
            if (centerX < this.p1.x && (top as any).p1c !== true) {
                (top as any).p1c = true;
                this.s1 += 1;
                this.p1.passObstacle();
                Audio.score();
            }
            if (centerX < this.p2.x && (top as any).p2c !== true) {
                (top as any).p2c = true;
                this.s2 += 1;
        this.p2.passObstacle();
        Audio.score();
            }
        }
    }

    render(ctx: CanvasRenderingContext2D, _engine: GameEngine): void {
    const shake = this.shakeT > 0 ? (Math.random() - 0.5) * 8 : 0;
    ctx.save();
    ctx.translate(shake, shake);
    this.renderer.clear(1/60);
        for (const o of this.obstacles) this.renderer.drawObstacle(o);
        this.renderer.drawPlayer(this.p1, '#58a6ff');
        this.renderer.drawPlayer(this.p2, '#ff7b72');
    this.particles.render(ctx);
    this.hud.render(ctx, this.s1, this.s2);
    ctx.restore();
        if (this.paused) {
            ctx.fillStyle = '#00000088';
            ctx.fillRect(0, 0, _engine.canvas.width, _engine.canvas.height);
            ctx.fillStyle = '#e8e8f0';
            ctx.font = '700 28px system-ui';
            ctx.fillText('Paused (P). R = Restart, Esc = Title', 40, 120);
        }
    }
}

export default VersusScene;