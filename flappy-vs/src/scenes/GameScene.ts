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
import { Settings } from '../game/settings';

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
    speed = 120;
    particles = new Particles();
    shakeT = 0;
    hintT = 4;
    bullets: Projectile[] = [];
    enemies: Enemy[] = [];
    powerUps: PowerUp[] = [];
    enemyTimer = 0;
    powerTimer = 5;
    private lastGapCenter: number | null = null;
    // Visual feedback for scoring
    private floats: Array<{x:number,y:number,text:string,ttl:number,vy:number}> = [];
    private static readonly KILL_POINTS = 2;
    private playerName: string | null = null;
    private hurtT = 0; // seconds remaining for hurt tint
    private combo = 0;
    private comboT = 0; // time left to keep combo alive
    private ended = false; // prevent repeated game-over prompts on mobile
    // Temporary effects
    private multishotT = 0; // triples shots horizontally
    private bigshotT = 0;   // larger bullets with +1 damage
    private slowmoT = 0;    // world slow factor active
    private magnetT = 0;    // attract powerups
    private rapidT = 0;     // reduce fire cooldown
    // Mobile support
    private mobileMoveX = 0; // -1..1 from touch zones
    private isTouch = 'ontouchstart' in window;
    private btnLeftDown = false;
    private btnRightDown = false;
    private btnShootDown = false;
    private btnRects: { left: {x:number,y:number,w:number,h:number}, right: {x:number,y:number,w:number,h:number}, shoot: {x:number,y:number,w:number,h:number} } | null = null;
    private restartRect: {x:number,y:number,w:number,h:number} | null = null;

    init(engine: GameEngine): void {
        this.renderer = new Renderer(engine.canvas, engine.ctx);
    // Reset core state
    this.obstacles = [];
    this.score = 0;
    this.timeToNext = 0;
    this.gameOver = false;
    this.paused = false;
    this.speed = 120;
    // Reset player to visible starting position and defaults
    this.player.x = 80;
    this.player.y = Math.max(0, (engine.canvas.height - this.player.height) * 0.5);
    this.player.vx = 0;
    this.player.vy = 0;
    this.player.hp = this.player.maxHp = 3;
    (this.player as any).fireCooldown = 0;
    // Clear entities/effects/overlays
    this.bullets = [];
    this.enemies = [];
    this.powerUps = [];
    this.enemyTimer = 2.5;
    this.powerTimer = 5;
    this.hintT = 4;
    this.shakeT = 0;
    this.floats = [];
    this.lastGapCenter = null;
    this.ended = false;
    // Reset touch button states
    this.btnLeftDown = this.btnRightDown = this.btnShootDown = false;
    this.restartRect = null;
    // Reset temporary effects
    this.multishotT = 0; this.bigshotT = 0; this.slowmoT = 0; this.magnetT = 0; this.rapidT = 0;
    // Helpers for on-screen touch buttons
    const updateButtonRects = () => {
        const w = engine.canvas.width, h = engine.canvas.height;
        const size = Math.max(60, Math.min(120, Math.floor(Math.min(w, h) * 0.14)));
        const pad = 24;
        this.btnRects = {
            left:  { x: pad, y: h - size - pad, w: size, h: size },
            right: { x: pad + size + 16, y: h - size - pad, w: size, h: size },
            shoot: { x: w - size - pad, y: h - size - pad, w: size, h: size },
        };
    };
    const updateRestartRect = () => {
        const w = engine.canvas.width, h = engine.canvas.height;
        const size = Math.max(64, Math.min(120, Math.floor(Math.min(w, h) * 0.16)));
        this.restartRect = { x: (w - size) / 2, y: h * 0.55, w: size, h: size };
    };
    const hitBtn = (which: 'left'|'right'|'shoot', x:number, y:number) => {
        if (!this.btnRects) return false;
        const r = this.btnRects[which];
        return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    };
    const recomputeTouchButtons = (te: TouchEvent) => {
        updateButtonRects();
        this.btnLeftDown = this.btnRightDown = this.btnShootDown = false;
        const rect = engine.canvas.getBoundingClientRect();
        const sx = engine.canvas.width / rect.width;
        const sy = engine.canvas.height / rect.height;
        for (let i = 0; i < te.touches.length; i++) {
            const t = te.touches.item(i)!;
            const x = (t.clientX - rect.left) * sx;
            const y = (t.clientY - rect.top) * sy;
            if (hitBtn('left', x, y)) this.btnLeftDown = true;
            else if (hitBtn('right', x, y)) this.btnRightDown = true;
            else if (hitBtn('shoot', x, y)) this.btnShootDown = true;
        }
    };
    const onPointer = (e: PointerEvent | MouseEvent | TouchEvent) => {
        // Game over: allow tapping the restart button
        if (this.gameOver) {
            if ((e as TouchEvent).touches !== undefined) {
                updateRestartRect();
                const te = e as TouchEvent;
                const rect = engine.canvas.getBoundingClientRect();
                const sx = engine.canvas.width / rect.width;
                const sy = engine.canvas.height / rect.height;
                for (let i = 0; i < te.touches.length; i++) {
                    const t = te.touches.item(i)!;
                    const x = (t.clientX - rect.left) * sx;
                    const y = (t.clientY - rect.top) * sy;
                    const r = this.restartRect!;
                    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                        this.init(engine);
                        return;
                    }
                }
            } else {
                // Pointer/click center area
                updateRestartRect();
                const r = this.restartRect!;
                const pe = e as PointerEvent;
                const rect = engine.canvas.getBoundingClientRect();
                const sx = engine.canvas.width / rect.width;
                const sy = engine.canvas.height / rect.height;
                const x = (pe.clientX - rect.left) * sx;
                const y = (pe.clientY - rect.top) * sy;
                if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
                    this.init(engine);
                    return;
                }
            }
            return;
        }
        // Touch events are flap; pointer uses button mapping
        if ((e as TouchEvent).touches !== undefined) {
            const te = e as TouchEvent;
            recomputeTouchButtons(te);
            if (this.btnLeftDown || this.btnRightDown || this.btnShootDown) {
                // Button touches: shoot if pressed, otherwise movement is handled elsewhere
                if (this.btnShootDown) this.fireWeapon();
                return;
            }
            // If touches are near the shoot corner, treat as shoot area to avoid accidental flap
            const cw = engine.canvas.width, ch = engine.canvas.height;
            const rect = engine.canvas.getBoundingClientRect();
            const sx = cw / rect.width, sy = ch / rect.height;
            let inShootCorner = false;
            for (let i = 0; i < te.touches.length; i++) {
                const t = te.touches.item(i)!;
                const x = (t.clientX - rect.left) * sx;
                const y = (t.clientY - rect.top) * sy;
                if (x > cw * 0.7 && y > ch * 0.6) { inShootCorner = true; break; }
            }
            if (inShootCorner) {
                this.fireWeapon();
                return;
            }
            const touches = te.touches?.length ?? 0;
            if (touches >= 2) {
                // two-finger shoot
                this.fireWeapon();
            } else {
                Physics.jump(this.player); Audio.flap();
                this.particles.burst(this.player.x + this.player.width * 0.2, this.player.y + this.player.height, Settings.reducedMotion ? 4 : 8, '#88ccff88');
            }
            return;
        }
        const btn = (e as PointerEvent).button ?? 0;
        const act = mapPointerButtonToAction(btn);
        if (act === 'flap') {
            Physics.jump(this.player); Audio.flap();
        } else if (act === 'shoot') {
            this.fireWeapon();
        }
    };
    engine.canvas.oncontextmenu = (e) => { e.preventDefault(); };
    engine.canvas.onpointerdown = onPointer as any;
    // Touch controls: on-screen buttons + zones
    const calcMobileMove = (te: TouchEvent) => {
        const rect = engine.canvas.getBoundingClientRect();
        let left = 0, right = 0;
        for (let i = 0; i < te.touches.length; i++) {
            const t = te.touches.item(i)!;
            const x = t.clientX - rect.left;
            if (x < rect.width * 0.45) left = 1; else if (x > rect.width * 0.55) right = 1;
        }
        this.mobileMoveX = right - left; // -1, 0, or 1
    };
    engine.canvas.ontouchstart = (te: TouchEvent) => { calcMobileMove(te); onPointer(te); };
    engine.canvas.ontouchmove = (te: TouchEvent) => { calcMobileMove(te); recomputeTouchButtons(te); };
    engine.canvas.ontouchend = (te: TouchEvent) => { calcMobileMove(te); recomputeTouchButtons(te); };
    try { const b = localStorage.getItem('best'); if (b) this.best = parseInt(b, 10) || 0; } catch {}
    try { this.playerName = Scoreboard.getPlayerName(); } catch { this.playerName = null; }
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.paused = true; });
    }

    // Fire weapon respecting cooldown and active power-ups
    private fireWeapon() {
        if (this.player.fireCooldown > 0) return;
        const bx = this.player.x + this.player.width;
        const by = this.player.y + this.player.height * 0.5 - 2;
        const mk = (dx:number, dy:number) => {
            const p = new Projectile(bx, by + dy, 360, dx, 'player');
            if (this.bigshotT > 0) { p.width = 14; p.damage = 2; }
            return p;
        };
    if (this.multishotT > 0) {
            this.bullets.push(mk(-40, -4));
            this.bullets.push(mk(  0,  0));
            this.bullets.push(mk( 40,  4));
        } else {
            this.bullets.push(mk(0, 0));
        }
    let cd = this.bigshotT>0 ? 0.22 : (this.multishotT>0 ? 0.2 : 0.18);
    if (this.rapidT > 0) cd = Math.max(0.08, cd * 0.55);
    this.player.fireCooldown = cd;
        Audio.beep(980, 0.05, 'square', 0.05);
    }

    update(dt: number, engine: GameEngine): void {
    const canvasH = engine.canvas.height;
    if (engine.input.wasPressed('KeyP')) this.paused = !this.paused;
    if (engine.input.wasPressed('KeyR')) this.init(engine);
    if (this.paused) return;
        // Global slow-mo
    const slowFactor = this.slowmoT > 0 ? 0.7 : 1.0;
    const gdt = dt * slowFactor;
        // Controls: flap (Space, ArrowUp, or W), left/right nudge (Arrows or A/D), shoot (J or Ctrl)
    if (engine.input.wasPressed('Space') || engine.input.wasPressed('ArrowUp') || engine.input.wasPressed('KeyW')) {
            Physics.jump(this.player); Audio.flap();
            this.particles.burst(this.player.x + this.player.width * 0.2, this.player.y + this.player.height, Settings.reducedMotion ? 4 : 8, '#88ccff88');
        }
    if (engine.input.isDown('KeyJ') || engine.input.isDown('ControlLeft') || engine.input.isDown('ControlRight') || this.btnShootDown) {
            this.fireWeapon();
        }
    const dir = engine.input.getMovementDirection();
    const wasdX = engine.input.getWASDHorizontal?.() ?? ((engine.input.isDown('KeyD') ? 1 : 0) + (engine.input.isDown('KeyA') ? -1 : 0));
    const btnX = (this.btnRightDown ? 1 : 0) - (this.btnLeftDown ? 1 : 0);
    this.player.vx = (dir.x + wasdX + this.mobileMoveX + btnX) * 80;
    Physics.applyGravity(this.player, gdt);
    this.player.update(gdt);

        // Boundaries
        this.player.y = Math.max(0, Math.min(canvasH - this.player.height, this.player.y));

        // Spawn obstacles (pipes) periodically
    this.timeToNext -= gdt;
        if (this.timeToNext <= 0) {
            // Progressive difficulty: start slow/wide, ramp up gently
            const progress = Math.min(1, this.score / 30); // 0..1 over first ~30 points
            this.speed = Math.min(280, 120 + progress * 140);
            const dynGap = Math.max(150, 230 - this.score * 2.2); // never below 150
            this.timeToNext = Math.max(1.1, 1.8 - this.score * 0.02);
            const gap = dynGap;
            const margin = 60; // keep away from extremes for fairness
            // Allowed center range for the gap
            const minCenter = margin + gap / 2;
            const maxCenter = canvasH - margin - gap / 2;
            // Limit how much the gap center can move between pipes
            const lastC = (this.lastGapCenter ?? (canvasH / 2));
            const maxStep = 140 + Math.min(100, this.score * 2); // ramps 140..240
            const low = Math.max(minCenter, lastC - maxStep);
            const high = Math.min(maxCenter, lastC + maxStep);
            const center = low <= high ? (low + Math.random() * (high - low)) : Math.min(maxCenter, Math.max(minCenter, lastC));
            const topHeight = Math.floor(center - gap / 2);
            this.lastGapCenter = center;
            const pipeW = 80;
            const x = engine.canvas.width + pipeW;
            // Represent pipes as two obstacles: top and bottom
            this.obstacles.push(new Obstacle(x, 0, pipeW, topHeight, this.speed));
            this.obstacles.push(new Obstacle(x, topHeight + gap, pipeW, canvasH - (topHeight + gap), this.speed));
        }

    // Update obstacles and score when passed
    for (const o of this.obstacles) o.update(gdt);
        // remove off-screen
        this.obstacles = this.obstacles.filter((o) => !o.isOffScreen());

        // collision with pipes
        for (const o of this.obstacles) {
            if (Physics.checkCollision(this.player, o)) {
                this.player.hp -= 1;
                Audio.hit();
                this.particles.burst(this.player.x + this.player.width/2, this.player.y + this.player.height/2, Settings.reducedMotion ? 6 : 12, '#ff7b72aa');
                this.shakeT = Settings.reducedMotion ? 0.0 : 0.2;
                this.hurtT = 0.35; // brief tint
                this.combo = 0; this.comboT = 0; // reset combo on hit
                // brief invuln by pushing player left slightly
                this.player.x -= 10;
                if (this.player.hp <= 0) this.finalizeGameOver();
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
    this.enemyTimer -= gdt;
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
            const ey = (minY < maxY) ? (minY + (maxY - minY) * (0.35 + Math.random()*0.3)) : (40 + Math.random() * (canvasH - 120));
            // Variant selection by score/time: start with drones, then bees, then tanks, finally kamikaze
            let variant: import('../entities/Enemy').EnemyVariant = 'drone';
            if (this.score > 6 && Math.random() < 0.5) variant = 'bee';
            if (this.score > 15 && Math.random() < 0.35) variant = 'tank';
            if (this.score > 25 && Math.random() < 0.25) variant = 'kamikaze';
            const baseSpeed = variant === 'tank' ? 90 : 120;
            const evx = - (baseSpeed + Math.random() * 60 + this.score * 1.2);
            const e = new Enemy(ex, ey, evx, 0, variant);
            (e as any).minY = isFinite(minY) ? minY : 20;
            (e as any).maxY = isFinite(maxY) ? maxY : canvasH - 40;
            (e as any).phase = Math.random() * Math.PI * 2;
            this.enemies.push(e);
            // Spawn cadence: later gets a bit busier but capped
            const base = 2.4 - Math.min(1.2, this.score * 0.03);
            this.enemyTimer = Math.max(0.8, base + (variant === 'tank' ? 0.3 : 0));
        }
    this.powerTimer -= gdt;
        if (this.powerTimer <= 0) {
            const types: Array<PowerUp['type']> = ['heal','rapid','shield','multishot','bigshot','slowmo','magnet'];
            const type = types[(Math.random() * types.length) | 0];
            this.powerUps.push(new PowerUp(engine.canvas.width + 20, 80 + Math.random() * (canvasH - 160), type));
            this.powerTimer = 8 + Math.random() * 6;
        }

        // Update bullets/enemies/power-ups
    for (const b of this.bullets) b.update(gdt);
        for (const e of this.enemies) {
            // Movement pattern per variant
            const phase = ((e as any).phase ?? 0) + performance.now() / 1000;
            if ((e as any).variant === 'kamikaze') {
                // Nudge towards player vertically
                const targetY = this.player.y - 6;
                const dy = targetY - e.y;
                e.vy = Math.max(-120, Math.min(120, dy * 2));
            } else if ((e as any).variant === 'bee') {
                e.vy = Math.sin(phase * 1.5) * 55;
            } else if ((e as any).variant === 'tank') {
                e.vy = Math.sin(phase * 0.6) * 24;
            } else {
                e.vy = Math.sin(phase) * 35; // drone
            }
            e.update(gdt);
            const minY = (e as any).minY ?? 20;
            const maxY = (e as any).maxY ?? (canvasH - 40);
            if (e.y < minY) e.y = minY;
            if (e.y + e.height > maxY) e.y = maxY - e.height;
        }
        for (const p of this.powerUps) {
            // Magnet attraction
            if (this.magnetT > 0) {
                const cx = this.player.x + this.player.width/2;
                const cy = this.player.y + this.player.height/2;
                const dx = cx - (p.x + p.width/2);
                const dy = cy - (p.y + p.height/2);
                const d2 = dx*dx + dy*dy;
                if (d2 < 200*200) { p.vx += Math.sign(dx) * 20; p.vy += Math.sign(dy) * 20; }
            }
            p.update(gdt);
        }
        this.bullets = this.bullets.filter(b => !b.isOffScreen(engine.canvas.width, canvasH) && b.active);
        this.enemies = this.enemies.filter(e => !e.isOffScreen());
        this.powerUps = this.powerUps.filter(p => !p.isOffScreen());

        // Bullet -> Enemy collisions
        const hitRect = (ax:number,ay:number,aw:number,ah:number, bx:number,by:number,bw:number,bh:number) => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
    for (const b of this.bullets) {
            for (const e of this.enemies) {
                if (!b.active) continue;
                if (hitRect(b.x,b.y,b.width,b.height, e.x,e.y,e.width,e.height)) {
                    // consume projectile on hit for clearer feedback
                    b.active = false;
                    e.health -= (b as any).damage ?? 1;
                    // small spark on hit
                    this.particles.burst(e.x + e.width/2, e.y + e.height/2, Settings.reducedMotion ? 6 : 10, '#ffd166aa');
                    if (e.health <= 0) {
                        // enemy destroyed: bigger explosion + kill score + shake
                        const cx = e.x + e.width/2, cy = e.y + e.height/2;
                        this.particles.burst(cx, cy, Settings.reducedMotion ? 10 : 22, '#ffb347aa');
                        this.particles.burst(cx, cy, Settings.reducedMotion ? 8 : 14, '#ff7b72aa');
                        e.x = -9999; // flagged; filtered later
                        // tougher enemies give a bit more
                        const bonus = ((e as any).variant === 'tank') ? GameScene.KILL_POINTS + 1 : GameScene.KILL_POINTS;
                        // combo logic: chain kills within window
                        const windowS = 2.2; // seconds
                        if (this.comboT > 0) this.combo++; else this.combo = 1;
                        this.comboT = windowS;
                        const comboBonus = Math.max(0, this.combo - 1); // +1 per extra chain
                        this.score += bonus + comboBonus;
                        this.floats.push({ x: cx, y: cy, text: `+${bonus}`, ttl: 0.9, vy: -32 });
                        if (comboBonus > 0) { this.floats.push({ x: cx + 14, y: cy - 18, text: `x${this.combo}`, ttl: 0.8, vy: -26 }); Audio.combo(this.combo); }
                        this.shakeT = Settings.reducedMotion ? 0.0 : Math.max(this.shakeT, 0.12);
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
                if (this.player.hp <= 0) this.finalizeGameOver();
            }
        }

        // Power-up pickup
        for (const p of this.powerUps) {
            if (hitRect(this.player.x,this.player.y,this.player.width,this.player.height, p.x,p.y,p.width,p.height)) {
                if (p.type === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1);
                if (p.type === 'rapid') this.rapidT = Math.max(this.rapidT, 8);
                if (p.type === 'shield') { this.player.maxHp = Math.min(5, this.player.maxHp + 1); this.player.hp = Math.min(this.player.maxHp, this.player.hp + 1); }
                if (p.type === 'multishot') this.multishotT = Math.max(this.multishotT, 8);
                if (p.type === 'bigshot') this.bigshotT = Math.max(this.bigshotT, 8);
                if (p.type === 'slowmo') this.slowmoT = Math.max(this.slowmoT, 4);
                if (p.type === 'magnet') this.magnetT = Math.max(this.magnetT, 8);
                this.particles.burst(p.x+p.width/2,p.y+p.height/2,14,'#7ee787aa');
                p.x = -9999;
            }
        }

    // Particles update & camera shake timer
    this.particles.update(gdt);
        this.shakeT = Math.max(0, this.shakeT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    if (this.comboT > 0) this.comboT = Math.max(0, this.comboT - dt);
    this.slowmoT = Math.max(0, this.slowmoT - dt);
    this.multishotT = Math.max(0, this.multishotT - dt);
    this.bigshotT = Math.max(0, this.bigshotT - dt);
    this.magnetT = Math.max(0, this.magnetT - dt);
    this.rapidT = Math.max(0, this.rapidT - dt);
    // Floating texts update
    for (const f of this.floats) { f.ttl -= dt; f.y += f.vy * dt; }
    this.floats = this.floats.filter(f => f.ttl > 0);
    this.hintT = Math.max(0, this.hintT - dt);
    }

    private finalizeGameOver() {
        if (this.ended) return;
        this.ended = true;
        this.gameOver = true;
        this.best = Math.max(this.best, this.score);
        try { localStorage.setItem('best', String(this.best)); } catch {}
        let name = Scoreboard.getPlayerName() || '';
        try {
            const entered = typeof window !== 'undefined' ? window.prompt('Name for high score?', name || 'Anon') : null;
            if (entered != null) { name = entered; Scoreboard.setPlayerName(name); }
        } catch {}
        Scoreboard.addScore(this.score, Date.now(), name);
        this.playerName = name;
    }

    render(ctx: CanvasRenderingContext2D, engine: GameEngine): void {
        const shake = this.shakeT > 0 ? (Math.random() - 0.5) * 8 : 0;
        ctx.save();
        ctx.translate(shake, shake);
        this.renderer.clear(1/60);
    for (const o of this.obstacles) this.renderer.drawObstacle(o);
    for (const e of this.enemies) this.renderer.drawEnemy(e);
    for (const p of this.powerUps) this.renderer.drawPowerUp(p);
        const playerColor = this.hurtT > 0 ? '#f87171' : '#58a6ff';
        this.renderer.drawPlayer(this.player, playerColor);
        // Player name label above character
        if (this.playerName) {
            const label = this.playerName.slice(0, 18);
            const cx = this.player.x + this.player.width / 2;
            let ty = this.player.y - 6;
            if (ty < 14) ty = this.player.y + this.player.height + 14; // avoid clipping at top
            ctx.save();
            ctx.textAlign = 'center';
            ctx.font = '600 12px system-ui';
            ctx.lineWidth = 3;
            ctx.strokeStyle = '#00000077';
            ctx.strokeText(label, cx, ty);
            ctx.fillStyle = '#cdd9e5';
            ctx.fillText(label, cx, ty);
            ctx.restore();
        }
    for (const b of this.bullets) this.renderer.drawProjectile(b);
        this.particles.render(ctx);
        this.hud.render(ctx, this.score, undefined, this.player.hp);
        // Tiny icons for active power-ups next to hearts
        {
            const iconList: Array<{active:boolean,color:string,glyph:string}> = [
                { active: this.rapidT > 0,     color: '#f7b84a', glyph: 'R' },
                { active: this.multishotT > 0, color: '#38bdf8', glyph: 'M' },
                { active: this.bigshotT > 0,   color: '#fb7185', glyph: 'B' },
                { active: this.slowmoT > 0,    color: '#a78bfa', glyph: '⌛' },
                { active: this.magnetT > 0,    color: '#f472b6', glyph: 'U' },
            ];
            const hp = this.player.hp ?? 0;
            let x = 16 + hp * 18 + 12; // after hearts row
            const y = 36; // hearts baseline
            for (const a of iconList) {
                if (!a.active) continue;
                ctx.save();
                ctx.globalAlpha = 0.95;
                const w = 12, h = 12, r = 3;
                ctx.fillStyle = a.color;
                ctx.beginPath(); ctx.roundRect(x, y + 2, w, h, r); ctx.fill();
                ctx.fillStyle = '#0f172a';
                ctx.font = '700 9px system-ui';
                const tw = ctx.measureText(a.glyph).width;
                ctx.fillText(a.glyph, x + (w - tw) / 2, y + 11);
                ctx.restore();
                x += w + 6;
            }
        }
        // Active power-up badges with timers
        const badges: Array<{label:string, t:number, d:number, color:string}> = [];
        if (this.rapidT > 0) badges.push({ label: 'Rapid', t: this.rapidT, d: 8, color: '#f7b84a' });
        if (this.multishotT > 0) badges.push({ label: 'Multi', t: this.multishotT, d: 8, color: '#38bdf8' });
        if (this.bigshotT > 0) badges.push({ label: 'Big', t: this.bigshotT, d: 8, color: '#fb7185' });
        if (this.slowmoT > 0) badges.push({ label: 'Slow', t: this.slowmoT, d: 4, color: '#a78bfa' });
        if (this.magnetT > 0) badges.push({ label: 'Mag', t: this.magnetT, d: 8, color: '#f472b6' });
        if (badges.length) {
            let bx = 16, by = 56;
            for (const b of badges) {
                const w = 74, h = 20, r = 8;
                ctx.save();
                ctx.globalAlpha = 0.9;
                ctx.fillStyle = '#0f172acc';
                ctx.beginPath(); ctx.roundRect(bx, by, w, h, r); ctx.fill();
                // progress
                const frac = Math.max(0, Math.min(1, b.t / b.d));
                ctx.fillStyle = b.color + 'aa';
                ctx.beginPath(); ctx.roundRect(bx+2, by+h-6, (w-4) * frac, 4, 3); ctx.fill();
                // label
                ctx.fillStyle = '#e8e8f0';
                ctx.font = '600 12px system-ui';
                ctx.fillText(b.label, bx + 8, by + 14);
                ctx.restore();
                bx += w + 8;
            }
        }
        // Combo indicator near score
        if (this.comboT > 0 && this.combo > 1) {
            ctx.save();
            ctx.fillStyle = '#ffd166';
            ctx.font = '700 14px system-ui';
            ctx.fillText(`Combo x${this.combo}`, 16, 46);
            ctx.restore();
        }
        // Floating texts render
        if (this.floats.length) {
            for (const f of this.floats) {
                const a = Math.max(0, Math.min(1, f.ttl / 0.9));
                ctx.save();
                ctx.globalAlpha = a;
                ctx.fillStyle = '#ffd166';
                ctx.font = '700 18px system-ui';
                ctx.fillText(f.text, f.x, f.y);
                ctx.restore();
            }
        }
        // On-screen buttons for touch devices
        if (this.isTouch) {
            // Ensure rects are up-to-date with current canvas size
            const w = engine.canvas.width, h = engine.canvas.height;
            const size = Math.max(60, Math.min(120, Math.floor(Math.min(w, h) * 0.14)));
            const pad = 24;
            this.btnRects = {
                left:  { x: pad, y: h - size - pad, w: size, h: size },
                right: { x: pad + size + 16, y: h - size - pad, w: size, h: size },
                shoot: { x: w - size - pad, y: h - size - pad, w: size, h: size },
            };
            const drawBtn = (r:{x:number,y:number,w:number,h:number}, active:boolean, label: 'L'|'R'|'S') => {
                ctx.save();
                ctx.globalAlpha = 0.5;
                ctx.fillStyle = active ? '#58a6ff' : '#0f172a';
                ctx.strokeStyle = '#58a6ff88';
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.roundRect(r.x, r.y, r.w, r.h, 16);
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = '#e8e8f0';
                ctx.font = '700 28px system-ui';
                const glyph = label === 'L' ? '\u25C0' : (label === 'R' ? '\u25B6' : '\u25CF');
                const tw = ctx.measureText(glyph).width;
                ctx.fillText(glyph, r.x + (r.w - tw) / 2, r.y + r.h / 2 + 10);
                ctx.restore();
            };
            drawBtn(this.btnRects.left, this.btnLeftDown, 'L');
            drawBtn(this.btnRects.right, this.btnRightDown, 'R');
            drawBtn(this.btnRects.shoot, this.btnShootDown, 'S');
        }
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
            ctx.fillText('Press R or tap the restart button', 40, 160);
            // Draw restart button (touch)
            const w = engine.canvas.width, h = engine.canvas.height;
            const size = Math.max(64, Math.min(120, Math.floor(Math.min(w, h) * 0.16)));
            const rx = (w - size) / 2, ry = h * 0.55;
            this.restartRect = { x: rx, y: ry, w: size, h: size };
            ctx.save();
            ctx.globalAlpha = 0.9;
            ctx.fillStyle = '#0f172a';
            ctx.strokeStyle = '#58a6ff88';
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.roundRect(rx, ry, size, size, 18);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#e8e8f0';
            ctx.font = '700 28px system-ui';
            ctx.fillText('⟲', rx + size/2 - 10, ry + size/2 + 12);
            ctx.restore();
        }
    }
}

export default GameScene;