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
    const myId = this.rt.id;
    // Leader: first client decides spawn timing (tie-break by id later)
    this.isLeader = myId < 'm'; // cheap pseudo-random leader across two peers
    // Presence join
    this.rt.send({ type: 'join', id: myId, roomId: this.roomId, name: this.name });
    // Receive
    this.rt.onMessage((m: RTMessage) => {
      if (m.type === 'state' && m.id !== myId) {
        this.remoteHistory.push({ t: m.t, x: m.x, y: m.y, vy: m.vy, score: m.score, hp: m.hp, name: m.name });
        if (this.remoteHistory.length > 30) this.remoteHistory.shift();
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
      }
    });
    this.rt.onDisconnected(() => {
      this.toast = { text: 'Online: disconnected', t: 3 };
    });
  }

  update(dt: number, engine: GameEngine) {
    if (this.paused) return;
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
    this.renderer.drawPlayer(this.p1, '#58a6ff');
    this.renderer.drawPlayer(this.p2, '#ff7b72');
    // draw obstacles
    for (const o of this.obstacles) this.renderer.drawObstacle(o);
    this.hud.render(ctx, this.s1, this.s2);
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
