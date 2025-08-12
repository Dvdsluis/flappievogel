import GameEngine, { IScene } from '../game/engine';
import { Player } from '../entities/Player';
import { Obstacle } from '../entities/Obstacle';
import { HUD } from '../entities/HUD';
import { Renderer } from '../game/renderer';
import { Physics } from '../game/physics';
import { Audio } from '../game/audio';
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
  private presenceAccum = 0;
  private myId: string | null = null;
  private lastMsgAt = 0; // timestamp of last received message for heartbeat

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
        const w = 80;
        const x = engine.canvas.width + w;
        const topH = m.topH;
        const gap = m.gap;
        this.speed = m.speed;
        this.obstacles.push(new Obstacle(x, 0, w, topH, this.speed));
        this.obstacles.push(new Obstacle(x, topH + gap, w, h - (topH + gap), this.speed));
      } else if (m.type === 'join' && m.id !== myId) {
        this.remoteId = m.id; this.remoteName = m.name;
        // Elect leader deterministically: lowest id
        this.isLeader = (myId < m.id);
        this.toast = { text: `${m.name || 'Opponent'} joined`, t: 2.5 };
        this.bothReady = true;
        if (this.isLeader && this.waiting) {
          // leader sends start
          setTimeout(() => {
            this.rt?.send({ type: 'start', id: myId, roomId: this.roomId, t: performance.now() });
            this.waiting = false;
          }, 800);
        }
      } else if (m.type === 'start') {
        this.waiting = false;
      } else if (m.type === 'leave' && m.id !== myId) {
        this.toast = { text: 'Opponent left', t: 3 };
        this.waiting = true; this.bothReady = false; this.remoteId = null;
      }
    });
  // Show connected toast and status
  this.toast = { text: `Connected • Room ${this.roomId}`, t: 2.5 };
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
    if (this.paused) return;
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
    // local input
    if (engine.input.wasPressed('Space') || engine.input.wasPressed('ArrowUp')) { Physics.jump(this.p1); Audio.flap(); }
    const dir = engine.input.getMovementDirection(); this.p1.vx = dir.x * 80;
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
      if (this.isLeader) {
        // spawn locally and broadcast
        this.obstacles.push(new Obstacle(x, 0, w, topH, this.speed));
        this.obstacles.push(new Obstacle(x, topH + gap, w, h - (topH + gap), this.speed));
        this.rt?.send({ type: 'spawn', id: this.rt.id, t: performance.now(), w, gap, topH, speed: this.speed });
      }
    }
    for (const o of this.obstacles) o.update(dt);
    this.obstacles = this.obstacles.filter((o) => !o.isOffScreen());
  }

  render(ctx: CanvasRenderingContext2D, engine: GameEngine) {
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
    this.renderer.drawPlayer(this.p1, '#58a6ff');
    this.renderer.drawPlayer(this.p2, '#ff7b72');
    // draw obstacles
    for (const o of this.obstacles) this.renderer.drawObstacle(o);
    this.hud.render(ctx, this.s1, this.s2);
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
  }
}

export default VersusOnline;
