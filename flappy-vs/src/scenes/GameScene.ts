import GameEngine, { IScene } from '../game/engine';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { HUD } from '../entities/HUD';
import { Physics } from '../game/physics';
import { Renderer } from '../game/renderer';
import { Audio } from '../game/audio';
import { Particles } from '../game/particles';
import { mapPointerButtonToAction } from '../game/controls';
import { Projectile } from '../entities/Projectile';
import { Enemy } from '../entities/Enemy';
import { PowerUp } from '../entities/PowerUp';
import { Scoreboard } from '../game/scoreboard';

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
    hintT = 4;
    bullets: Projectile[] = [];
    enemies: Enemy[] = [];
    powerUps: PowerUp[] = [];
    enemyTimer = 0;
    powerTimer = 5;

    init(engine: GameEngine): void {
        this.renderer = new Renderer(engine.canvas, engine.ctx);
    this.obstacles = [];
    this.score = 0;
    this.timeToNext = 0;
    this.gameOver = false;
    this.paused = false;
    this.speed = 140;
    this.player.hp = this.player.maxHp = 3;
    this.bullets = [];
    this.enemies = [];
    this.powerUps = [];
    this.enemyTimer = 0;
    this.powerTimer = 5;
    this.hintT = 4;
    const onPointer = (e: PointerEvent | MouseEvent | TouchEvent) => {
        if (this.gameOver) return;
        // Touch events are flap; pointer uses button mapping
        if ((e as TouchEvent).touches !== undefined) {
            Physics.jump(this.player); Audio.flap();
            return;
        }
        const btn = (e as PointerEvent).button ?? 0;
        const act = mapPointerButtonToAction(btn);
        if (act === 'flap') {
            Physics.jump(this.player); Audio.flap();
        } else if (act === 'shoot' && this.player.fireCooldown === 0) {
            const bx = this.player.x + this.player.width;
            const by = this.player.y + this.player.height * 0.5 - 2;
            this.bullets.push(new Projectile(bx, by, 360, 0, 'player'));
            this.player.fireCooldown = 0.18;
            Audio.beep(980, 0.05, 'square', 0.05);
        }
    };
    engine.canvas.oncontextmenu = (e) => { e.preventDefault(); };
    engine.canvas.ontouchstart = onPointer as any;
    engine.canvas.onpointerdown = onPointer as any;
    try { const b = localStorage.getItem('best'); if (b) this.best = parseInt(b, 10) || 0; } catch {}
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.paused = true; });
    }

    update(dt: number, engine: GameEngine): void {
    const canvasH = engine.canvas.height;
    if (engine.input.wasPressed('KeyP')) this.paused = !this.paused;
    if (engine.input.wasPressed('KeyR')) this.init(engine);
    if (this.paused) return;
        // Controls: flap (Space, ArrowUp, or W), left/right nudge (Arrows or A/D), shoot (J or Ctrl)
    if (engine.input.wasPressed('Space') || engine.input.wasPressed('ArrowUp') || engine.input.wasPressed('KeyW')) {
            Physics.jump(this.player); Audio.flap();
            this.particles.burst(this.player.x + this.player.width * 0.2, this.player.y + this.player.height, 8, '#88ccff88');
        }
    if ((engine.input.isDown('KeyJ') || engine.input.isDown('ControlLeft') || engine.input.isDown('ControlRight')) && this.player.fireCooldown === 0) {
            const bx = this.player.x + this.player.width;
            const by = this.player.y + this.player.height * 0.5 - 2;
            this.bullets.push(new Projectile(bx, by, 360, 0, 'player'));
            this.player.fireCooldown = 0.18; // rapid if power-up later
            Audio.beep(980, 0.05, 'square', 0.05);
        }
    const dir = engine.input.getMovementDirection();
    const wasdX = engine.input.getWASDHorizontal?.() ?? ((engine.input.isDown('KeyD') ? 1 : 0) + (engine.input.isDown('KeyA') ? -1 : 0));
    this.player.vx = (dir.x + wasdX) * 80;
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

        // collision with pipes
        for (const o of this.obstacles) {
            if (Physics.checkCollision(this.player, o)) {
                this.player.hp -= 1;
                Audio.hit();
                this.particles.burst(this.player.x + this.player.width/2, this.player.y + this.player.height/2, 12, '#ff7b72aa');
                this.shakeT = 0.2;
                // brief invuln by pushing player left slightly
                this.player.x -= 10;
                if (this.player.hp <= 0) {
                    this.gameOver = true;
                    this.best = Math.max(this.best, this.score);
                    try { localStorage.setItem('best', String(this.best)); } catch {}
                    Scoreboard.addScore(this.score);
                }
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

        // Enemies and power-ups spawn
        this.enemyTimer -= dt;
        if (this.enemyTimer <= 0) {
            // Try to spawn inside the latest pipe gap
            let gapTop = 40, gapBottom = canvasH - 40;
            if (this.obstacles.length >= 2) {
                // choose the pair with the largest x (furthest right)
                let bestIdx = 0;
                let bestX = -Infinity;
                for (let i = 0; i < this.obstacles.length - 1; i += 2) {
                    const top = this.obstacles[i];
                    if (top.x > bestX) { bestX = top.x; bestIdx = i; }
                }
                const top = this.obstacles[bestIdx];
                const bottom = this.obstacles[bestIdx + 1];
                gapTop = top.height;
                gapBottom = bottom.y;
            }
            const margin = 12;
            const minY = Math.max(0, gapTop + margin);
            const maxY = Math.min(canvasH - 20, gapBottom - margin - 18);
            const ex = engine.canvas.width + 40;
            const ey = (minY < maxY) ? (minY + (maxY - minY) * 0.5) : (40 + Math.random() * (canvasH - 120));
            const evx = - (120 + Math.random() * 60 + this.score);
            const e = new Enemy(ex, ey, evx, 0);
            (e as any).minY = isFinite(minY) ? minY : 20;
            (e as any).maxY = isFinite(maxY) ? maxY : canvasH - 40;
            (e as any).phase = Math.random() * Math.PI * 2;
            this.enemies.push(e);
            this.enemyTimer = 1.8 - Math.min(1.2, this.score * 0.01);
        }
        this.powerTimer -= dt;
        if (this.powerTimer <= 0) {
            const types: Array<PowerUp['type']> = ['heal','rapid','shield'];
            const type = types[(Math.random() * types.length) | 0];
            this.powerUps.push(new PowerUp(engine.canvas.width + 20, 80 + Math.random() * (canvasH - 160), type));
            this.powerTimer = 8 + Math.random() * 6;
        }

        // Update bullets/enemies/power-ups
        for (const b of this.bullets) b.update(dt);
        for (const e of this.enemies) {
            // vertical oscillation constrained to spawn band
            const phase = ((e as any).phase ?? 0) + performance.now() / 1000;
            const amp = 35;
            e.vy = Math.sin(phase) * amp;
            e.update(dt);
            const minY = (e as any).minY ?? 20;
            const maxY = (e as any).maxY ?? (canvasH - 40);
            if (e.y < minY) e.y = minY;
            if (e.y + e.height > maxY) e.y = maxY - e.height;
        }
        for (const p of this.powerUps) p.update(dt);
        this.bullets = this.bullets.filter(b => !b.isOffScreen(engine.canvas.width, canvasH) && b.active);
        this.enemies = this.enemies.filter(e => !e.isOffScreen());
        this.powerUps = this.powerUps.filter(p => !p.isOffScreen());

        // Bullet -> Enemy collisions
        const hitRect = (ax:number,ay:number,aw:number,ah:number, bx:number,by:number,bw:number,bh:number) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
        for (const b of this.bullets) {
            for (const e of this.enemies) {
                if (!b.active) continue;
                if (hitRect(b.x,b.y,b.width,b.height, e.x,e.y,e.width,e.height)) {
                    b.active = true; // continue thru but mark enemy as hit
                    e.health -= 1;
                    this.particles.burst(e.x + e.width/2, e.y + e.height/2, 8, '#ffd166aa');
                    if (e.health <= 0) {
                        // remove enemy and score
                        e.x = -9999; // flagged; filtered later
                        this.score += 1;
                        Audio.score();
                    }
                }
            }
        }
        this.enemies = this.enemies.filter(e => e.x > -9000);

        // Enemy -> Player collisions (damage)
        for (const e of this.enemies) {
            if (hitRect(this.player.x,this.player.y,this.player.width,this.player.height, e.x,e.y,e.width,e.height)) {
                this.player.hp -= 1; Audio.hit(); this.particles.burst(e.x+e.width/2,e.y+e.height/2,10,'#ff7b72aa'); e.x = -9999;
                if (this.player.hp <= 0) {
                    this.gameOver = true; this.best = Math.max(this.best, this.score); try { localStorage.setItem('best', String(this.best)); } catch {}
                    Scoreboard.addScore(this.score);
                }
            }
        }

        // Power-up pickup
        for (const p of this.powerUps) {
            if (hitRect(this.player.x,this.player.y,this.player.width,this.player.height, p.x,p.y,p.width,p.height)) {
                if (p.type === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
                if (p.type === 'rapid') this.player.fireCooldown = Math.min(this.player.fireCooldown, 0.08);
                if (p.type === 'shield') this.player.maxHp = Math.min(5, this.player.maxHp + 1); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
                this.particles.burst(p.x+p.width/2,p.y+p.height/2,14,'#7ee787aa');
                p.x = -9999;
            }
        }

    // Particles update & camera shake timer
        this.particles.update(dt);
        this.shakeT = Math.max(0, this.shakeT - dt);
    this.hintT = Math.max(0, this.hintT - dt);
    }

    render(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
        const shake = this.shakeT > 0 ? (Math.random() - 0.5) * 8 : 0;
        ctx.save();
        ctx.translate(shake, shake);
        this.renderer.clear(1/60);
    for (const o of this.obstacles) this.renderer.drawObstacle(o);
    for (const e of this.enemies) this.renderer.drawEnemy(e);
    for (const p of this.powerUps) this.renderer.drawPowerUp(p);
        this.renderer.drawPlayer(this.player, '#58a6ff');
    for (const b of this.bullets) this.renderer.drawProjectile(b);
        this.particles.render(ctx);
        this.hud.render(ctx, this.score, undefined, this.player.hp);
        if (this.hintT > 0) {
            const a = Math.min(0.8, this.hintT / 4);
            ctx.save();
            ctx.globalAlpha = a;
            ctx.fillStyle = '#00000088';
            ctx.fillRect(20, 70, 520, 56);
            ctx.fillStyle = '#e8e8f0';
            ctx.font = '600 16px system-ui';
            ctx.fillText('Flap: Space/ArrowUp/W or Click • Move: Arrows or A/D • Shoot: Right Click or Ctrl/J (hold)', 28, 100);
            ctx.restore();
        }
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