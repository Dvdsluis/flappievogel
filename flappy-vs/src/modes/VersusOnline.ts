import GameEngine, { IScene } from '../game/engine';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { HUD } from '../entities/HUD';
import { Renderer } from '../game/renderer';
import { Physics } from '../game/physics';
import { Audio } from '../game/audio';
import { Particles } from '../game/particles';
import { PowerUp, type PowerType } from '../entities/PowerUp';
import { Projectile } from '../entities/Projectile';
import { POWERUPS, pickPowerUp } from '../game/powerups';
import { mapPointerButtonToAction } from '../game/controls';
import { Settings } from '../game/settings';
import { Realtime, RTMessage } from '../net/realtime';

export class VersusOnline implements IScene {
  p1 = new Player(80, 140, 26, 26);
  p2 = new Player(120, 220, 26, 26);
  obstacles: Obstacle[] = [];
  hud = new HUD();
  renderer!: Renderer;
  s1 = 0; s2 = 0;
  speed = 140; timeToNext = 0; paused = false;
  rt: Realtime | null = null;
  roomId: string;
  name: string;
  // gameplay extras
  bullets: Projectile[] = [];
  enemyBullets: Projectile[] = [];
  powerups: PowerUp[] = [];
  multishotUntil = 0;
  bigshotUntil = 0;
  slowmoUntil = 0;
  magnetUntil = 0;
  // mobile helpers
  private isTouch = 'ontouchstart' in window;
  private mobileMoveX = 0; // -1..1 from screen halves
  private shootingHeld = false; // mouse or keyboard held
  private touchShootHeld = false; // touch gesture held
  private hintT = 4; // seconds to show controls hint
  // touch buttons (optional UI like single player)
  private btnRects: { left: {x:number,y:number,w:number,h:number}, right: {x:number,y:number,w:number,h:number}, shoot: {x:number,y:number,w:number,h:number} } | null = null;
  private btnLeftDown = false; private btnRightDown = false; private btnShootDown = false;
  private lefty = false; // mirror shoot corner for left-handed players
  private lastLeftCornerTap = 0;
  // gamepad
  private prevPadButtons: boolean[] = [];
  // net smoothing
  private remoteHistory: Array<{t:number,x:number,y:number,vy:number,score:number,hp:number,name?:string}> = [];
  private sendAccum = 0; // throttle to ~25Hz
  private toast: { text: string; t: number } | null = null;
  private isLeader = false; // simple leader: first to spawn obstacles
  private remoteId: string | null = null;
  private remoteName: string | undefined;
  private reconnecting = false;
  private retries = 0;
  private unloadHandler: ((e: BeforeUnloadEvent) => void) | null = null;
  private waiting = true;
  private bothReady = false;
  private gameStarted = false;
  private presenceAccum = 0;
  private myId: string | null = null;
  private lastMsgAt = 0; // timestamp of last received message for heartbeat
  // Countdown + FX
  private starting = false;
  private startAt = 0; // ms timestamp
  private lastCountdownSecond = 0;
  private trailAccum = 0;
  private particles = new Particles();
  private remoteParticles = new Particles();
  // UI floaters (e.g., +1)
  private floaters: Array<{ text: string; x: number; y: number; vy: number; t: number; life: number; color?: string }> = [];
  // Camera shake
  private shakeT = 0; private shakeTotal = 0; private shakeAmp = 0;
  // Pre-start queues (avoid spawning during countdown on follower)
  private queuedSpawns: Array<{ x:number; topH:number; gap:number; speed:number; w:number }>=[];
  private queuedPowerSpawns: Array<{ pid:string; kind:PowerType; x:number; y:number; vx:number }>=[];

  constructor(roomId: string, name: string) { this.roomId = roomId; this.name = name; }

  async init(engine: GameEngine) {
    this.renderer = new Renderer(engine.canvas, engine.ctx);
    const negotiateUrl = '/api/negotiate';
    this.rt = new Realtime(negotiateUrl);
    try {
      await this.rt.connect(this.roomId);
    } catch (e) {
  this.toast = { text: 'Online: failed to connect', t: 3 };
      return;
    }
  const myId = this.rt.id; this.myId = myId;
  // Receive first to avoid missing early presence
  this.rt.onMessage((m: RTMessage) => {
      this.lastMsgAt = performance.now();
      if (m.type === 'state' && m.id !== myId) {
        this.remoteHistory.push({ t: m.t, x: m.x, y: m.y, vy: m.vy, score: m.score, hp: m.hp, name: m.name });
        if (this.remoteHistory.length > 30) this.remoteHistory.shift();
        this.remoteName = m.name || this.remoteName;
      } else if (m.type === 'spawn' && this.isLeader === false) {
        // follower applies leader spawns
        const h = engine.canvas.height;
        const w = m.w ?? 80;
        const x = engine.canvas.width + w;
        const topH = m.topH;
        const gap = m.gap;
        this.speed = m.speed;
        // If we haven't started, queue to apply on start to avoid pre-game obstacles
        if (this.waiting || this.starting || !this.gameStarted) {
          this.queuedSpawns.push({ x, topH, gap, speed: this.speed, w });
        } else {
          this.obstacles.push(new Obstacle(x, 0, w, topH, this.speed));
          this.obstacles.push(new Obstacle(x, topH + gap, w, h - (topH + gap), this.speed));
        }
      } else if (m.type === 'join' && m.id !== myId) {
        this.remoteId = m.id; this.remoteName = m.name;
        // Elect leader deterministically: lowest id
        this.isLeader = (myId < m.id);
        this.toast = { text: `${m.name || 'Opponent'} joined`, t: 2.5 };
        this.bothReady = true;
    if (this.isLeader && this.waiting) {
          // Leader schedules a synchronized start ~2s in the future
          setTimeout(() => {
            const delayMs = 2200; // add small buffer
            // Compute an absolute wall-clock start time; followers adjust from their local clock
            const startAtEpoch = Date.now() + delayMs;
            this.rt?.send({ type: 'start', id: myId, roomId: this.roomId, t: performance.now(), startAt: startAtEpoch, delayMs });
            // Leader also uses epoch to align with follower and avoid starting too early
            const localDelay = Math.max(400, startAtEpoch - Date.now());
            this.startAt = performance.now() + localDelay;
            this.waiting = false;
            this.starting = true;
            this.gameStarted = false;
            this.lastCountdownSecond = 4; // force first tick
          }, 600);
        }
      } else if (m.type === 'start') {
    // Prefer absolute startAt epoch; fallback to delayMs
    const startEpoch = (m as any).startAt as number | undefined;
    if (typeof startEpoch === 'number' && isFinite(startEpoch)) {
      const remainMs = Math.max(300, startEpoch - Date.now());
      this.startAt = performance.now() + remainMs;
    } else {
      const delayMs = typeof (m as any).delayMs === 'number' ? (m as any).delayMs : 1500;
      this.startAt = performance.now() + delayMs;
    }
        this.waiting = false;
        this.starting = true;
        this.gameStarted = false;
        this.lastCountdownSecond = 4; // force first tick
      } else if (m.type === 'leave' && m.id !== myId) {
        this.toast = { text: 'Opponent left', t: 3 };
        this.waiting = true; this.bothReady = false; this.remoteId = null;
      } else if (m.type === 'shoot' && m.id !== myId) {
        const b = new Projectile(m.x, m.y, m.vx, m.vy, 'p2');
        if ((m as any).w) b.width = (m as any).w as number; if ((m as any).h) b.height = (m as any).h as number; if ((m as any).color) b.color = (m as any).color as string;
        this.enemyBullets.push(b);
      } else if (m.type === 'powerSpawn') {
        const kind = (m as any).kind as PowerType;
        const pu = new PowerUp(m.x, m.y, kind);
        pu.vx = m.vx;
        (pu as any).pid = (m as any).pid;
        // Queue pre-start; apply once the game starts
        if (this.waiting || this.starting || !this.gameStarted) {
          this.queuedPowerSpawns.push({ pid: (m as any).pid as string, kind, x: m.x, y: m.y, vx: m.vx });
        } else {
          this.powerups.push(pu);
        }
      } else if (m.type === 'pickup') {
        const pid = (m as any).pid as string;
        const idx = this.powerups.findIndex(p => (p as any).pid === pid);
        if (idx >= 0) this.powerups.splice(idx, 1);
      }
    });
  // Show connected toast and status
  this.toast = { text: `Connected • Room ${this.roomId} • ${this.rt.getTransport().toUpperCase()}`, t: 2.5 };
  // Presence join and waiting room
  this.rt.send({ type: 'join', id: myId, roomId: this.roomId, name: this.name });
    this.rt.onDisconnected(() => {
      this.toast = { text: 'Online: disconnected', t: 3 };
      if (!this.reconnecting && this.retries < 2) {
        this.reconnecting = true; this.retries++;
        setTimeout(() => this.reconnect(negotiateUrl), 1500);
      }
    });
    // Leave on unload
    this.unloadHandler = (e: BeforeUnloadEvent) => {
      try { this.rt?.send({ type: 'leave', id: myId, roomId: this.roomId }); } catch {}
    };
    window.addEventListener('beforeunload', this.unloadHandler);

    // Pointer controls: Left-click = flap, Right-click = shoot
  // Load preferences
  try { const l = localStorage.getItem('lefty'); this.lefty = l === '1'; } catch {}
  // Avoid browser gestures on touch devices
    try { (engine.canvas.style as any).touchAction = 'none'; } catch {}
    const onPointer = (e: PointerEvent) => {
      if (this.waiting || this.starting) { e.preventDefault(); return; }
      // Prevent default for context menu on canvas
      if (e.button === 2) e.preventDefault();
      const act = mapPointerButtonToAction(e.button ?? 0);
      if (act === 'flap') {
        Physics.jump(this.p1); Audio.flap();
        this.particles.burst(this.p1.x + this.p1.width * 0.2, this.p1.y + this.p1.height * 0.7, 10, '#9bd1ff');
      } else if (act === 'shoot') {
        // Immediate shot + start held shooting
        const baseCd = 0.35;
        if (this.p1.fireCooldown <= 0) {
          this.fireBullet(this.p1, 'p1', engine);
          this.p1.fireCooldown = baseCd * (this.isRapid() ? 0.55 : 1);
        }
        this.shootingHeld = true;
      }
    };
    engine.canvas.onpointerdown = onPointer as any;
    engine.canvas.oncontextmenu = (e) => { e.preventDefault(); };
    engine.canvas.onpointerup = (e: PointerEvent) => { if ((e.button ?? 0) === 2) this.shootingHeld = false; };

    // Touch controls: tap = flap, two-finger or bottom-right corner = shoot, screen halves for left/right nudge
    const calcMobileMove = (te: TouchEvent) => {
      const rect = engine.canvas.getBoundingClientRect();
      let left = 0, right = 0;
      for (let i = 0; i < te.touches.length; i++) {
        const t = te.touches.item(i)!;
        const x = t.clientX - rect.left;
        if (x < rect.width * 0.45) left = 1; else if (x > rect.width * 0.55) right = 1;
      }
      this.mobileMoveX = right - left;
    };
    const updateButtonRects = () => {
      const w = engine.canvas.width, h = engine.canvas.height;
      const size = Math.max(60, Math.min(120, Math.floor(Math.min(w, h) * 0.14)));
      const pad = 24;
      this.btnRects = {
        left:  { x: pad, y: h - size - pad, w: size, h: size },
        right: { x: pad + size + 16, y: h - size - pad, w: size, h: size },
        shoot: { x: (this.lefty ? pad : (w - size - pad)), y: h - size - pad, w: size, h: size },
      };
    };
    const hitBtn = (which: 'left'|'right'|'shoot', x:number, y:number) => {
      if (!this.btnRects) return false;
      const r = this.btnRects[which];
      return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
    };
    const onTouch = (te: TouchEvent) => {
      // During waiting/countdown, allow UI feedback and lefty toggle but block actions
      const isPreGame = this.waiting || this.starting;
      // Shooting if two fingers, or a touch in the bottom-right corner
      const cw = engine.canvas.width, ch = engine.canvas.height;
      const rect = engine.canvas.getBoundingClientRect();
      const sx = cw / rect.width, sy = ch / rect.height;
      updateButtonRects();
      // Reset button states
      this.btnLeftDown = this.btnRightDown = this.btnShootDown = false;
      // Determine button press hits
      for (let i = 0; i < te.touches.length; i++) {
        const t = te.touches.item(i)!;
        const x = (t.clientX - rect.left) * sx;
        const y = (t.clientY - rect.top) * sy;
        if (hitBtn('left', x, y)) this.btnLeftDown = true;
        else if (hitBtn('right', x, y)) this.btnRightDown = true;
        else if (hitBtn('shoot', x, y)) this.btnShootDown = true;
      }
      // Double-tap bottom-left corner toggles lefty (allowed pre-game too)
      if (te.touches.length === 1) {
        const t = te.touches.item(0)!;
        const x = (t.clientX - rect.left) * sx;
        const y = (t.clientY - rect.top) * sy;
        if (x < cw * 0.2 && y > ch * 0.8) {
          const now = performance.now();
          if (now - this.lastLeftCornerTap < 500) {
            this.lefty = !this.lefty; this.toast = { text: `Left-handed ${this.lefty ? 'ON' : 'OFF'}`, t: 2.2 };
            try { localStorage.setItem('lefty', this.lefty ? '1' : '0'); } catch {}
          }
          this.lastLeftCornerTap = now;
        }
      }
      if (isPreGame) { return; }
      let inShootCorner = false;
      for (let i = 0; i < te.touches.length; i++) {
        const t = te.touches.item(i)!;
        const x = (t.clientX - rect.left) * sx;
        const y = (t.clientY - rect.top) * sy;
        const shootRight = !this.lefty;
        const inCorner = shootRight ? (x > cw * 0.7 && y > ch * 0.6) : (x < cw * 0.3 && y > ch * 0.6);
        if (inCorner) { inShootCorner = true; break; }
      }
      if (te.touches.length >= 2 || inShootCorner || this.btnShootDown) {
        const baseCd = 0.35;
        if (this.p1.fireCooldown <= 0) {
          this.fireBullet(this.p1, 'p1', engine);
          this.p1.fireCooldown = baseCd * (this.isRapid() ? 0.55 : 1);
        }
        this.touchShootHeld = true;
        return;
      }
      // Otherwise tap = flap
      Physics.jump(this.p1); Audio.flap();
      try { navigator.vibrate?.(10); } catch {}
      this.particles.burst(this.p1.x + this.p1.width * 0.2, this.p1.y + this.p1.height * 0.7, 10, '#9bd1ff');
    };
    engine.canvas.ontouchstart = (te: TouchEvent) => { te.preventDefault(); calcMobileMove(te); onTouch(te); };
    engine.canvas.ontouchmove = (te: TouchEvent) => { te.preventDefault(); calcMobileMove(te); };
    engine.canvas.ontouchend = (te: TouchEvent) => { te.preventDefault(); calcMobileMove(te); this.touchShootHeld = false; };
  }

  dispose(): void {
    try {
      if (this.rt && this.myId) {
        this.rt.send({ type: 'leave', id: this.myId, roomId: this.roomId });
      }
    } catch {}
    try { if (this.unloadHandler) window.removeEventListener('beforeunload', this.unloadHandler); } catch {}
    try { this.rt?.close(); } catch {}
  }

  private async reconnect(negotiateUrl: string) {
    const prev = this.rt; const myName = this.name;
    this.rt = new Realtime(negotiateUrl);
    try {
      await this.rt.connect(this.roomId);
      const myId = this.rt.id;
      this.toast = { text: 'Online: reconnected', t: 2.5 };
      // rewire handlers
      this.rt.onMessage((m: RTMessage) => {
        this.lastMsgAt = performance.now();
        if (m.type === 'state' && m.id !== myId) {
          this.remoteHistory.push({ t: m.t, x: m.x, y: m.y, vy: m.vy, score: m.score, hp: m.hp, name: m.name });
          if (this.remoteHistory.length > 30) this.remoteHistory.shift();
          this.remoteName = m.name || this.remoteName;
        } else if (m.type === 'spawn' && this.isLeader === false) {
          const h = (this as any).renderer.canvas.height;
          const w = 80; const x = (this as any).renderer.canvas.width + w;
          const topH = m.topH; const gap = m.gap; this.speed = m.speed;
          this.obstacles.push(new Obstacle(x, 0, w, topH, this.speed));
          this.obstacles.push(new Obstacle(x, topH + gap, w, h - (topH + gap), this.speed));
        } else if (m.type === 'join' && m.id !== myId) {
          this.remoteId = m.id; this.remoteName = m.name; this.isLeader = (myId < m.id);
        } else if (m.type === 'leave' && m.id !== myId) {
          this.toast = { text: 'Opponent left', t: 3 };
        }
      });
      this.rt.onDisconnected(() => {
        this.toast = { text: 'Online: disconnected', t: 3 };
      });
      this.rt.send({ type: 'join', id: this.rt.id, roomId: this.roomId, name: myName });
    } catch (e) {
      this.toast = { text: 'Online: reconnection failed', t: 3 };
    } finally {
      this.reconnecting = false;
      // best-effort cleanup old client
      try { void prev; } catch {}
    }
  }

  update(dt: number, engine: GameEngine) {
    // Global pause handling first
    if (engine.input.wasPressed('Escape') || engine.input.wasPressed('KeyP')) this.paused = !this.paused;
    if (this.paused) {
      if (engine.input.wasPressed('KeyR')) { /* soft reset: just clear scores and obstacles */ this.s1 = this.s2 = 0; this.obstacles = []; this.powerups = []; this.bullets = []; this.enemyBullets = []; this.paused = false; }
      // Return to title on Enter/T handled in render overlay prompt
      return;
    }
    // Update floaters
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.t -= dt; f.y += f.vy * dt;
      if (f.t <= 0) this.floaters.splice(i, 1);
    }
    // Decay camera shake
    if (this.shakeT > 0) this.shakeT = Math.max(0, this.shakeT - dt);
    if (this.waiting) {
      // Periodic presence while waiting so peers that joined late can see us
      if (this.rt && this.myId) {
        this.presenceAccum += dt;
        if (this.presenceAccum >= 1.0) {
          this.presenceAccum = 0;
          this.rt.send({ type: 'join', id: this.myId, roomId: this.roomId, name: this.name });
        }
      }
      // Show simple waiting room background and hint via render()
      return;
    }
  // Pre-game synchronized countdown
    if (this.starting) {
      const now = performance.now();
      const remain = Math.max(0, this.startAt - now);
      const sec = Math.ceil(remain / 1000);
      if (sec !== this.lastCountdownSecond) {
        this.lastCountdownSecond = sec;
        if (sec > 0) {
          // beep high to low as it counts down
          const f = 800 - (3 - Math.min(3, sec)) * 120;
          Audio.beep(f, 0.08, 'triangle', 0.06);
        } else {
          Audio.beep(1000, 0.1, 'square', 0.07);
        }
      }
      if (remain <= 0) {
        this.starting = false;
        this.gameStarted = true;
        // Flush queued spawns and powerups
        const h = engine.canvas.height;
        for (const s of this.queuedSpawns) {
          const x = engine.canvas.width + (s.w ?? 80);
          const w = s.w ?? 80;
          this.speed = s.speed;
          this.obstacles.push(new Obstacle(x, 0, w, s.topH, this.speed));
          this.obstacles.push(new Obstacle(x, s.topH + s.gap, w, h - (s.topH + s.gap), this.speed));
        }
        this.queuedSpawns = [];
        for (const qp of this.queuedPowerSpawns) {
          const pu = new PowerUp(qp.x, qp.y, qp.kind);
          pu.vx = qp.vx; (pu as any).pid = qp.pid;
          this.powerups.push(pu);
        }
        this.queuedPowerSpawns = [];
      } else {
        // small ambient particles while waiting to go
        this.particles.update(dt);
        this.remoteParticles.update(dt);
        return; // block gameplay until countdown ends
      }
    }
    // local input (block during waiting or starting)
    if (!this.waiting && !this.starting && (engine.input.wasPressed('Space') || engine.input.wasPressed('ArrowUp'))) {
      Physics.jump(this.p1); Audio.flap();
      try { navigator.vibrate?.(10); } catch {}
      // Spark burst on flap
      this.particles.burst(this.p1.x + this.p1.width * 0.2, this.p1.y + this.p1.height * 0.7, 10, '#9bd1ff');
    }
    // Gamepad support
    const pads = (navigator as any).getGamepads ? (navigator as any).getGamepads() : [];
    const pad = pads && pads[0];
    let padX = 0;
    if (pad && pad.connected) {
      const ax = (pad.axes && pad.axes[0]) || 0;
      const dead = 0.2; padX = Math.abs(ax) > dead ? ax : 0;
      // A (0) flap on press
      const buttons = pad.buttons || [];
      const prev = this.prevPadButtons;
      const isPressed = (i:number) => !!(buttons[i] && buttons[i].pressed);
      const wasPressed = (i:number) => !!(prev[i]);
      // Flap on rising edge of A / Cross
      if (isPressed(0) && !wasPressed(0)) { Physics.jump(this.p1); Audio.flap(); try { navigator.vibrate?.(10); } catch {} }
      // Shoot when B(1) or X(2) held
  if (!this.waiting && !this.starting && (isPressed(1) || isPressed(2))) this.shootingHeld = true; else if (!isPressed(1) && !isPressed(2)) this.shootingHeld = false;
      // Store current
      this.prevPadButtons = buttons.map((b:any)=>!!b.pressed);
    }
    const dir = engine.input.getMovementDirection();
  const wasdX = (engine.input as any).getWASDHorizontal ? (engine.input as any).getWASDHorizontal() : 0;
    const btnX = (this.btnRightDown ? 1 : 0) - (this.btnLeftDown ? 1 : 0);
    this.p1.vx = (dir.x + wasdX + this.mobileMoveX + btnX + padX) * 80;
    // shooting (hold supported for mouse, keyboard, and touch)
    const baseCd = 0.35; // seconds
    const shootKeysDown = engine.input.isDown('ControlLeft') || engine.input.isDown('ControlRight') || engine.input.isDown('KeyJ') || engine.input.isDown('ShiftLeft') || engine.input.isDown('KeyF');
  const wantShoot = (!this.waiting && !this.starting) && (this.shootingHeld || this.touchShootHeld || !!shootKeysDown);
    if (wantShoot && this.p1.fireCooldown <= 0) {
      this.fireBullet(this.p1, 'p1', engine);
      try { navigator.vibrate?.(5); } catch {}
      this.p1.fireCooldown = baseCd * (this.isRapid() ? 0.55 : 1);
    }
    Physics.applyGravity(this.p1, dt); this.p1.update(dt);
    // bounds
    const h = engine.canvas.height; this.p1.y = Math.max(0, Math.min(h - this.p1.height, this.p1.y));
    // send compact input/state occasionally
  if (this.rt) {
      this.sendAccum += dt;
      const interval = 1/25; // 25 Hz
      if (this.sendAccum >= interval) {
        this.sendAccum = 0;
        const msg: RTMessage = { type: 'state', id: this.rt.id, t: performance.now(), x: this.p1.x, y: this.p1.y, vy: this.p1.vy, score: this.s1, hp: this.p1.hp, name: this.name };
        this.rt.send(msg);
      }
    }

    // Interpolate remote player with 100ms buffer
    const now = performance.now();
    const targetT = now - 100; // ms
    while (this.remoteHistory.length >= 2 && this.remoteHistory[1].t <= targetT) {
      this.remoteHistory.shift();
    }
    const a = this.remoteHistory[0];
    const b = this.remoteHistory[1];
    if (a && b) {
      const t = (targetT - a.t) / Math.max(1, b.t - a.t);
      const lerp = (u:number,v:number,s:number)=>u+(v-u)*Math.max(0,Math.min(1,s));
      this.p2.x = lerp(a.x, b.x, t);
      this.p2.y = lerp(a.y, b.y, t);
      this.p2.vy = lerp(a.vy, b.vy, t);
      this.s2 = Math.max(a.score, b.score);
    } else if (a) { // hold last
      this.p2.x = a.x; this.p2.y = a.y; this.p2.vy = a.vy; this.s2 = a.score;
    }

    // Soft exhaust-like trail for both players
    this.trailAccum += dt;
    const spawnTrail = (x:number, y:number, color:string) => {
      this.particles.spawn(x, y, { vx: -40 + Math.random()*20, vy: 20 + Math.random()*20, size: 2.2, color: color+'cc', life: 0.35, g: 150 });
    };
    if (this.trailAccum >= 0.05) {
      this.trailAccum = 0;
      spawnTrail(this.p1.x - 4, this.p1.y + this.p1.height * 0.6, '#7cc1ff');
      this.remoteParticles.spawn(this.p2.x - 4, this.p2.y + this.p2.height * 0.6, { vx: -30 + Math.random()*20, vy: 20 + Math.random()*15, size: 2.2, color: '#ff9da0cc', life: 0.35, g: 150 });
    }

    this.particles.update(dt);
    this.remoteParticles.update(dt);
  // Decrease hint timer
  this.hintT = Math.max(0, this.hintT - dt);

    // Spawn pipes; leader sends spawn events, follower consumes them above
    this.timeToNext -= dt;
    if (this.timeToNext <= 0) {
      this.speed = Math.min(260, this.speed + 2);
      const gap = Math.max(130, 180 - Math.max(this.s1, this.s2) * 2);
      this.timeToNext = Math.max(1.0, 1.7 - Math.max(this.s1, this.s2) * 0.02);
      const minTop = 40;
      const maxTop = h - gap - 40;
      const topH = Math.floor(Math.random() * (maxTop - minTop + 1)) + minTop;
      const w = 80; const x = engine.canvas.width + w;
      if (this.isLeader && this.gameStarted) {
        // spawn locally and broadcast
        this.obstacles.push(new Obstacle(x, 0, w, topH, this.speed));
        this.obstacles.push(new Obstacle(x, topH + gap, w, h - (topH + gap), this.speed));
        this.rt?.send({ type: 'spawn', id: this.rt.id, t: performance.now(), w, gap, topH, speed: this.speed });
        // power-up chance
        if (Math.random() < 0.3) {
          const kind = pickPowerUp(Math.max(this.s1, this.s2));
          const pu = new PowerUp(x + 140, Math.max(24, Math.min(h - 40, topH + gap * 0.5 - 8)), kind);
          pu.vx = -Math.max(100, this.speed * 0.7);
          const pid = `${Date.now()}-${Math.random().toString(36).slice(2,6)}`;
          (pu as any).pid = pid;
          this.powerups.push(pu);
          this.rt?.send({ type: 'powerSpawn', id: this.rt.id, t: performance.now(), pid, kind, x: pu.x, y: pu.y, vx: pu.vx });
        }
      }
    }
    for (const o of this.obstacles) o.update(dt);
    this.obstacles = this.obstacles.filter((o) => !o.isOffScreen());
    // Update power-ups
    for (const pu of this.powerups) pu.update(dt);
    this.powerups = this.powerups.filter(p => !p.isOffScreen());
    // Update bullets
    for (const b of this.bullets) b.update(dt);
    for (const b of this.enemyBullets) b.update(dt);
    const W = engine.canvas.width, H = engine.canvas.height;
    const hit = (b: Projectile, o: Obstacle) => Physics.checkCollision({ x: b.x, y: b.y, width: b.width, height: b.height } as any, o);
    for (const b of this.bullets) {
      for (const o of this.obstacles) {
        if (hit(b, o)) {
          b.active = false; Audio.combo(1);
          // Impact sparks
          const cx = b.x + b.width * 0.5, cy = b.y + b.height * 0.5;
          this.particles.burst(cx, cy, 6, (b.color as string) || '#ffd166');
        }
      }
    }
    for (const b of this.enemyBullets) {
      for (const o of this.obstacles) {
        if (hit(b, o)) { b.active = false; this.particles.burst(b.x + b.width * 0.5, b.y + b.height * 0.5, 4, '#ff7b72'); }
      }
    }
    this.bullets = this.bullets.filter(b => b.active && !b.isOffScreen(W,H));
    this.enemyBullets = this.enemyBullets.filter(b => b.active && !b.isOffScreen(W,H));
    // Pickups for local player
  for (let i = 0; i < this.powerups.length; i++) {
      const pu = this.powerups[i];
      if (Physics.checkCollision(this.p1, pu)) {
        this.applyPowerUp(pu.type);
        const pid = (pu as any).pid as string | undefined;
        if (pid) this.rt?.send({ type: 'pickup', id: this.rt!.id, t: performance.now(), pid });
    // Sparkle burst on pickup
    const colorMap: Record<string,string> = { heal:'#7ee787', rapid:'#f7b84a', shield:'#8b8efb', multishot:'#38bdf8', bigshot:'#fb7185', slowmo:'#a78bfa', magnet:'#f472b6' };
    this.particles.burst(pu.x + pu.width/2, pu.y + pu.height/2, 12, colorMap[pu.type] || '#ffffff');
    this.powerups.splice(i, 1); i--;
        Audio.score();
      }
    }
    // Collisions and scoring similar to single-player
    // collision with pipes for p1
  for (const o of this.obstacles) {
      if ((Physics as any).checkCollision && (Physics as any).checkCollision(this.p1, o)) {
        this.p1.hp = Math.max(0, (this.p1.hp ?? 3) - 1);
        Audio.hit();
    // Camera shake on hit
    this.triggerShake(4, 0.25);
        if (this.p1.hp <= 0) { this.paused = true; this.toast = { text: 'You crashed!', t: 3 }; }
      }
    }
    // scoring when passing pipe centers (pairs at i, i+1)
    for (let i = 0; i < this.obstacles.length; i += 2) {
      const top = this.obstacles[i];
      const centerX = top.x + top.width / 2;
      if ((top as any).counted !== true && centerX < this.p1.x) {
        (top as any).counted = true; this.s1 += 1; Audio.score();
        // +1 floater near HUD
        this.floaters.push({ text: '+1', x: 56, y: 28, vy: -20, t: 1.0, life: 1.0, color: '#7ee787' });
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, engine: GameEngine) {
    ctx.save();
    // 1) World (no shake)
    this.renderer.clear(1/60);
    if (this.waiting) {
      // Waiting room screen
      ctx.fillStyle = '#e8e8f0';
      ctx.font = '700 24px system-ui';
  const msg = this.bothReady ? 'Found opponent! Starting…' : `Waiting in room ${this.roomId}…`;
      const w = ctx.measureText(msg).width;
      ctx.fillText(msg, Math.max(20, (engine.canvas.width - w)/2), 120);
      ctx.font = '600 14px system-ui';
      ctx.fillStyle = '#94a3b8';
      const sub = 'Share the code with your friend. Game starts when they join.';
      const sw = ctx.measureText(sub).width;
      ctx.fillText(sub, Math.max(20, (engine.canvas.width - sw)/2), 150);
      // If there was a connection error, surface it
      const err = this.rt?.getLastError?.();
      if (err) {
        ctx.fillStyle = '#fca5a5';
        ctx.font = '600 13px system-ui';
        const ew = ctx.measureText(err).width;
        ctx.fillText(err, Math.max(20, (engine.canvas.width - ew)/2), 170);
      }
  // Connected players indicator
  const players = 1 + (this.remoteId ? 1 : 0);
  const info = `Connected players: ${players}/2`;
  ctx.fillStyle = '#cdd9e5'; ctx.font = '700 14px system-ui';
  const iw = ctx.measureText(info).width;
  const ix = Math.max(20, (engine.canvas.width - iw)/2);
  const iy = 180;
  ctx.fillText(info, ix + 18, iy);
  // Heartbeat dot next to info
  const now = performance.now();
  const age = now - this.lastMsgAt;
  let color = '#ef4444'; // red (stale)
  if (age < 2000) color = '#22c55e'; // green
  else if (age < 5000) color = '#facc15'; // yellow
  const pulse = 0.6 + 0.4 * Math.sin(now / 250);
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(ix + 8, iy - 4, 5 * pulse, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
    }
    // Countdown overlay
    if (this.starting) {
      const remain = Math.max(0, this.startAt - performance.now());
      const sec = Math.ceil(remain / 1000);
      ctx.fillStyle = '#e8e8f0';
      ctx.font = '800 54px system-ui';
      const label = sec > 0 ? String(sec) : 'GO!';
      const w = ctx.measureText(label).width;
      ctx.fillText(label, (engine.canvas.width - w)/2, engine.canvas.height * 0.35);
    }
    // 2) Foreground (players, bullets, particles) with gentle shake
    ctx.save();
    if (this.shakeT > 0 && this.shakeTotal > 0) {
      const k = this.shakeT / this.shakeTotal;
      // Base amplitude is small for comfort
      const base = this.shakeAmp * (0.5 + 0.5 * k);
      const maxAmp = 4;
      const amp = (typeof (Settings as any)?.reducedMotion !== 'undefined' && (Settings as any).reducedMotion) ? 0 : Math.min(maxAmp, base);
      if (amp > 0) {
        const ox = (Math.random() * 2 - 1) * amp;
        const oy = (Math.random() * 2 - 1) * amp;
        ctx.translate(ox, oy);
      }
    }
    this.renderer.drawPlayer(this.p1, '#58a6ff');
    this.renderer.drawPlayer(this.p2, '#ff7b72');
    for (const b of this.bullets) this.renderer.drawProjectile(b);
    for (const b of this.enemyBullets) this.renderer.drawProjectile(b);
    for (const pu of this.powerups) this.renderer.drawPowerUp(pu);
    // Magnet visual trail/attraction overlay
    if (performance.now() < this.magnetUntil) {
      ctx.save(); ctx.globalAlpha = 0.6;
      for (const pu of this.powerups) {
        const cx = pu.x + pu.width/2, cy = pu.y + pu.height/2;
        const dx = (this.p1.x + this.p1.width/2) - cx;
        const dy = (this.p1.y + this.p1.height/2) - cy;
        const len = Math.max(1, Math.hypot(dx, dy));
        const ux = dx / len, uy = dy / len;
        ctx.fillStyle = '#f472b6aa';
        for (let i = 1; i <= 2; i++) {
          const px = cx + ux * i * 8;
          const py = cy + uy * i * 8;
          ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI*2); ctx.fill();
        }
      }
      ctx.restore();
    }
  // Render particles above players
  this.particles.render(ctx);
  this.remoteParticles.render(ctx);
  ctx.restore(); // end foreground shake
  // draw obstacles
  for (const o of this.obstacles) this.renderer.drawObstacle(o);
  // 3) HUD (no shake)
  this.hud.render(ctx, this.s1, this.s2);
  // HUD status: show fire cooldown and active effects for P1
  const cdFrac = this.p1.fireCooldown > 0 ? Math.min(1, this.p1.fireCooldown / 0.35) : 0;
  const effects: Array<{label:string;color?:string;remain?:number}> = [];
  const now = performance.now();
  if (now < this.multishotUntil) effects.push({ label: 'Multi', color: '#38bdf8', remain: (this.multishotUntil - now)/1000 });
  if (now < this.bigshotUntil) effects.push({ label: 'Big', color: '#fb7185', remain: (this.bigshotUntil - now)/1000 });
  if (now < this.slowmoUntil) effects.push({ label: 'Slow', color: '#a78bfa', remain: (this.slowmoUntil - now)/1000 });
  if (now < this.magnetUntil) effects.push({ label: 'Mag', color: '#f472b6', remain: (this.magnetUntil - now)/1000 });
  this.hud.renderStatus(ctx, 16, 52, cdFrac, effects);
  // Names above players
  ctx.fillStyle = '#cdd9e5'; ctx.font = '700 12px system-ui';
  if (this.name) ctx.fillText(this.name, this.p1.x, Math.max(12, this.p1.y - 6));
  if (this.remoteName) ctx.fillText(this.remoteName, this.p2.x, Math.max(12, this.p2.y - 6));
  // Connection overlay
  ctx.fillStyle = '#94a3b8'; ctx.font = '600 12px system-ui';
  const role = this.isLeader ? 'Leader' : 'Follower';
  const players = 1 + (this.remoteId ? 1 : 0);
  const overlay = `Online • Room ${this.roomId} • ${role} • Players ${players}/2`;
  ctx.fillText(overlay, 32, engine.canvas.height - 8);
  // Heartbeat dot at bottom-left
  const now2 = performance.now();
  const age2 = now2 - this.lastMsgAt;
  let color2 = '#ef4444';
  if (age2 < 2000) color2 = '#22c55e';
  else if (age2 < 5000) color2 = '#facc15';
  const pulse2 = 0.6 + 0.4 * Math.sin(now2 / 250);
  ctx.save();
  ctx.fillStyle = color2;
  ctx.beginPath(); ctx.arc(16, engine.canvas.height - 12, 5 * pulse2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
    // Touch on-screen buttons
    if (this.isTouch) {
      // Ensure rects are sized
      const w = engine.canvas.width, h = engine.canvas.height;
      const size = Math.max(60, Math.min(120, Math.floor(Math.min(w, h) * 0.14)));
      const pad = 24;
      this.btnRects = {
        left:  { x: pad, y: h - size - pad, w: size, h: size },
        right: { x: pad + size + 16, y: h - size - pad, w: size, h: size },
        shoot: { x: (this.lefty ? pad : (w - size - pad)), y: h - size - pad, w: size, h: size },
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
      drawBtn(this.btnRects.shoot, this.btnShootDown || this.touchShootHeld, 'S');
    }
    // Brief controls hint
    if (this.hintT > 0) {
      const a = Math.min(0.8, this.hintT / 4);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = '#00000088';
      ctx.fillRect(20, 70, 560, 56);
      ctx.fillStyle = '#e8e8f0';
      ctx.font = '600 16px system-ui';
      ctx.fillText('Flap: Click/Space/ArrowUp • Move: ←/→ or A/D • Shoot: Right Click or Ctrl/J (hold)', 28, 100);
      ctx.restore();
      // Pause overlay when paused
      if (this.paused) {
        ctx.fillStyle = '#00000088';
        ctx.fillRect(0, 0, engine.canvas.width, engine.canvas.height);
        const mw = Math.min(460, engine.canvas.width - 40);
        const mh = 190; const mx = (engine.canvas.width - mw)/2; const my = Math.max(60, engine.canvas.height*0.3);
        ctx.fillStyle = '#0f172ae6'; ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 12); ctx.fill();
        ctx.strokeStyle = '#58a6ff55'; ctx.stroke();
        ctx.fillStyle = '#e8e8f0'; ctx.font = '800 22px system-ui'; ctx.fillText('Paused', mx + 16, my + 36);
        ctx.font = '600 15px system-ui';
        ctx.fillText('R: Reset Round', mx + 16, my + 76);
        ctx.fillText('Esc/P: Resume', mx + 16, my + 102);
        ctx.fillText('Open a new tab to return to menu', mx + 16, my + 128);
      }
    }
    // Floaters (+1 etc.)
    for (const f of this.floaters) {
      const a = Math.max(0, f.t / f.life);
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = f.color || '#e8e8f0';
      ctx.font = '700 16px system-ui';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    }
    // Toasts
    if (this.toast) {
      this.toast.t -= 1/60;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, this.toast.t / 3));
      ctx.fillStyle = '#000000aa';
      const msg = this.toast.text;
      ctx.font = '700 16px system-ui';
      const w = ctx.measureText(msg).width + 20;
      ctx.fillRect(20, 20, w, 34);
      ctx.fillStyle = '#e8e8f0';
      ctx.fillText(msg, 30, 42);
      ctx.restore();
      if (this.toast.t <= 0) this.toast = null;
    }
  ctx.restore();
  }

  private isRapid() {
    const now = performance.now();
    return now < this.multishotUntil || now < this.bigshotUntil; // piggyback; treat as rapid window
  }

  private fireBullet(p: Player, owner: 'p1' | 'p2', engine: GameEngine) {
    const nowMs = performance.now();
    const y = p.y + p.height * 0.5 - 2;
    const baseV = 420;
    const color = owner === 'p1' ? '#ffd166' : '#ff7b72';
    const sizeMul = performance.now() < this.bigshotUntil ? 1.6 : 1.0;
  if (owner === 'p1' && sizeMul > 1.0) this.triggerShake(1.2, 0.12);
    const mk = (vx: number, vy: number) => {
      const b = new Projectile(p.x + p.width, y, vx, vy, owner);
      b.color = color; b.width = 10 * sizeMul; b.height = 4 * sizeMul;
      this.bullets.push(b);
      this.rt?.send({ type: 'shoot', id: this.rt!.id, t: nowMs, x: b.x, y: b.y, vx: b.vx, vy: b.vy, w: b.width, h: b.height, color });
    };
    const multishot = performance.now() < this.multishotUntil;
    if (multishot) { mk(baseV, -40); mk(baseV, 0); mk(baseV, 40); } else { mk(baseV, 0); }
  }

  private triggerShake(amp: number, dur: number) {
    this.shakeAmp = amp; this.shakeT = dur; this.shakeTotal = dur;
  }

  private applyPowerUp(type: PowerType) {
    const now = performance.now();
    const p = POWERUPS[type]; if (!p) return;
    if (type === 'heal') { this.p1.hp = Math.min(this.p1.maxHp, this.p1.hp + 1); }
    else if (type === 'shield') { this.p1.maxHp += 1; this.p1.hp = Math.min(this.p1.maxHp, this.p1.hp + 1); }
    else if (type === 'rapid') { /* reuse multishot window to mark rapid */ this.multishotUntil = now + (p.duration ?? 6) * 1000; }
    else if (type === 'multishot') { this.multishotUntil = now + (p.duration ?? 6) * 1000; }
    else if (type === 'bigshot') { this.bigshotUntil = now + (p.duration ?? 6) * 1000; }
    else if (type === 'slowmo') { this.slowmoUntil = now + (p.duration ?? 3) * 1000; this.speed = Math.max(100, this.speed * 0.8); }
    else if (type === 'magnet') { this.magnetUntil = now + (p.duration ?? 6) * 1000; }
  }
}

export default VersusOnline;
