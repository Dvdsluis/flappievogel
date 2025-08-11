import GameEngine, { IScene } from '../game/engine';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { HUD } from '../entities/HUD';
import { Physics } from '../game/physics';
import { Renderer } from '../game/renderer';
import { Audio } from '../game/audio';
import { Particles } from '../game/particles';

export class GameScene implements IScene {
    player = new Player(80, 150, 26, 26);
    obstacles: Obstacle[] = [];
    hud = new HUD();
    renderer!: Renderer;
    timeToNext = 0;
    score = 0;
    best = 0;
    gameOver = false;
    paused = false;
    speed = 140;
    particles = new Particles();
    shakeT = 0;

    init(engine: GameEngine): void {
        this.renderer = new Renderer(engine.canvas, engine.ctx);
    this.obstacles = [];
    this.score = 0;
    this.timeToNext = 0;
    this.gameOver = false;
    this.paused = false;
    this.speed = 140;
    const touch = () => { if (!this.gameOver) { Physics.jump(this.player); Audio.flap(); } };
    engine.canvas.ontouchstart = touch;
    engine.canvas.onpointerdown = touch;
    try { const b = localStorage.getItem('best'); if (b) this.best = parseInt(b, 10) || 0; } catch {}
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.paused = true; });
    }

    update(dt: number, engine: GameEngine): void {
    const canvasH = engine.canvas.height;
    if (engine.input.wasPressed('KeyP')) this.paused = !this.paused;
    if (engine.input.wasPressed('KeyR')) this.init(engine);
    if (this.paused) return;
        // Controls: up to flap, left/right to nudge
        if (engine.input.wasPressed('Space') || engine.input.wasPressed('ArrowUp')) {
            Physics.jump(this.player); Audio.flap();
            this.particles.burst(this.player.x + this.player.width * 0.2, this.player.y + this.player.height, 8, '#88ccff88');
        }
        const dir = engine.input.getMovementDirection();
        this.player.vx = dir.x * 80;
        Physics.applyGravity(this.player, dt);
        this.player.update(dt);

        // Boundaries
        this.player.y = Math.max(0, Math.min(canvasH - this.player.height, this.player.y));

        // Spawn obstacles (pipes) periodically
        this.timeToNext -= dt;
        if (this.timeToNext <= 0) {
            // ramp difficulty
            this.speed = Math.min(260, this.speed + 2);
            const dynGap = Math.max(120, 180 - this.score * 2);
            this.timeToNext = Math.max(1.0, 1.6 - this.score * 0.02);
            const gap = dynGap;
            const minTop = 40;
            const maxTop = canvasH - gap - 40;
            const topHeight = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
            const pipeW = 80;
            const x = engine.canvas.width + pipeW;
            // Represent pipes as two obstacles: top and bottom
            this.obstacles.push(new Obstacle(x, 0, pipeW, topHeight, this.speed));
            this.obstacles.push(new Obstacle(x, topHeight + gap, pipeW, canvasH - (topHeight + gap), this.speed));
        }

        // Update obstacles and score when passed
    for (const o of this.obstacles) o.update(dt);
        // remove off-screen
        this.obstacles = this.obstacles.filter((o) => !o.isOffScreen());

        // collision
        for (const o of this.obstacles) {
            if (Physics.checkCollision(this.player, o)) {
                this.gameOver = true;
                this.best = Math.max(this.best, this.score);
                try { localStorage.setItem('best', String(this.best)); } catch {}
                Audio.hit();
                this.particles.burst(this.player.x + this.player.width/2, this.player.y + this.player.height/2, 16, '#ff7b72aa');
                this.shakeT = 0.3;
            }
        }

        // scoring: when player's x just passes the vertical center between a pair
        for (let i = 0; i < this.obstacles.length; i += 2) {
            const top = this.obstacles[i];
            const centerX = top.x + top.width / 2;
            if (!this.gameOver && centerX < this.player.x && (top as any).counted !== true) {
                (top as any).counted = true;
                this.score += 1;
                this.player.passObstacle();
                Audio.score();
            }
        }

        // Particles update & camera shake timer
        this.particles.update(dt);
        this.shakeT = Math.max(0, this.shakeT - dt);
    }

    render(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
        const shake = this.shakeT > 0 ? (Math.random() - 0.5) * 8 : 0;
        ctx.save();
        ctx.translate(shake, shake);
        this.renderer.clear(1/60);
        for (const o of this.obstacles) this.renderer.drawObstacle(o);
        this.renderer.drawPlayer(this.player, '#58a6ff');
        this.particles.render(ctx);
        this.hud.render(ctx, this.score);
        ctx.restore();
        if (this.paused) {
            ctx.fillStyle = '#00000088';
            ctx.fillRect(0, 0, engine.canvas.width, engine.canvas.height);
            ctx.fillStyle = '#e8e8f0';
            ctx.font = '700 28px system-ui';
            ctx.fillText('Paused (P). R = Restart, Esc = Title', 40, 120);
        }
        if (this.gameOver) {
            ctx.fillStyle = '#00000088';
            ctx.fillRect(0, 0, engine.canvas.width, engine.canvas.height);
            ctx.fillStyle = '#e8e8f0';
            ctx.font = '700 28px system-ui';
            ctx.fillText(`Game Over — Score ${this.score}  Best ${this.best}`, 40, 120);
            ctx.font = '500 18px system-ui';
            ctx.fillText('Press R to restart or Esc for Title', 40, 160);
        }
    }
}

export default GameScene;