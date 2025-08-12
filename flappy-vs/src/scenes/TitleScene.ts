import GameEngine, { IScene } from '../game/engine';
import GameScene from './GameScene';
import VersusScene from './VersusScene';
import VersusOnline from '../modes/VersusOnline';
import { Audio } from '../game/audio';
import { Scoreboard } from '../game/scoreboard';
import { Settings } from '../game/settings';

export class TitleScene implements IScene {
    private t = 0;
    // Online modal state and helpers
    private onlineModalOpen = false;
    private modalCreateBtn: {x:number,y:number,w:number,h:number} | null = null;
    private modalJoinBtn: {x:number,y:number,w:number,h:number} | null = null;
    private modalCancelBtn: {x:number,y:number,w:number,h:number} | null = null;
    private launchOnline(engine: GameEngine) { this.onlineModalOpen = true; }
    // clickable button hit boxes
    private btnS: {x:number,y:number,w:number,h:number} | null = null;
    private btnV: {x:number,y:number,w:number,h:number} | null = null;
    private btnVO: {x:number,y:number,w:number,h:number} | null = null;
    private btnEditName: {x:number,y:number,w:number,h:number} | null = null;
    onResize?(engine: GameEngine): void {
        engine.ctx.setTransform(1,0,0,1,0,0);
    }
    init(engine: GameEngine): void {
        engine.canvas.focus();
        // Mobile-friendly: tap to start Singleplayer, two-finger tap for Versus
        let started = false;
        const cleanup = () => {
            engine.canvas.onpointerdown = null;
            engine.canvas.ontouchstart = null;
            engine.canvas.onclick = null;
            document.removeEventListener('touchstart', onDocTouchStart as any);
            document.removeEventListener('pointerdown', onDocPointerDown as any);
            document.removeEventListener('click', onDocClick as any);
        };
        const startNow = (versus: boolean, online = false) => {
            if (versus && online) {
                // Open modal; don't mark started or cleanup yet
                this.launchOnline(engine);
                return;
            }
            if (started) return; started = true; cleanup();
            engine.setScene(versus ? new VersusScene() : new GameScene());
        };
        const onPointerDown = (e: PointerEvent) => {
            // Check for button clicks on desktop
            if (this.btnS || this.btnV || this.btnEditName) {
                const rect = engine.canvas.getBoundingClientRect();
                const sx = engine.canvas.width / rect.width;
                const sy = engine.canvas.height / rect.height;
                const x = (e.clientX - rect.left) * sx;
                const y = (e.clientY - rect.top) * sy;
                // If online modal is open, handle modal buttons first
                if (this.onlineModalOpen) {
                    const hit = (b: any) => b && x>=b.x && x<=b.x+b.w && y>=b.y && y<=b.y+b.h;
                    if (hit(this.modalCreateBtn)) {
                        // Prompt for name then create room
                        const current = Scoreboard.getPlayerName() || 'Anon';
                        const name = typeof window !== 'undefined' ? (window.prompt('Your name', current) || current) : current;
                        Scoreboard.setPlayerName(name);
                        const rid = Math.random().toString(36).slice(2, 6).toUpperCase();
                        if (typeof window !== 'undefined') { try { window.alert(`Room code: ${rid}\nShare this code with your friend to join.`);} catch {} }
                        if (started) return; started = true; cleanup();
                        engine.setScene(new VersusOnline(rid.toLowerCase(), name));
                        return;
                    }
                    if (hit(this.modalJoinBtn)) {
                        const current = Scoreboard.getPlayerName() || 'Anon';
                        const name = typeof window !== 'undefined' ? (window.prompt('Your name', current) || current) : current;
                        Scoreboard.setPlayerName(name);
                        const code = typeof window !== 'undefined' ? window.prompt('Enter room code to join', '') : '';
                        const room = (code || '').trim();
                        if (!room) { this.onlineModalOpen = false; return; }
                        if (started) return; started = true; cleanup();
                        engine.setScene(new VersusOnline(room.toLowerCase(), name));
                        return;
                    }
                    if (hit(this.modalCancelBtn)) { this.onlineModalOpen = false; return; }
                    // Click outside the modal does nothing
                    return;
                }
                if (this.btnS && x>=this.btnS.x && x<=this.btnS.x+this.btnS.w && y>=this.btnS.y && y<=this.btnS.y+this.btnS.h) return startNow(false);
                if (this.btnV && x>=this.btnV.x && x<=this.btnV.x+this.btnV.w && y>=this.btnV.y && y<=this.btnV.y+this.btnV.h) return startNow(true);
                if (this.btnVO && x>=this.btnVO.x && x<=this.btnVO.x+this.btnVO.w && y>=this.btnVO.y && y<=this.btnVO.y+this.btnVO.h) return startNow(true, true);
                if (this.btnEditName && x>=this.btnEditName.x && x<=this.btnEditName.x+this.btnEditName.w && y>=this.btnEditName.y && y<=this.btnEditName.y+this.btnEditName.h) {
                    // Prompt to edit name
                    try {
                        const current = Scoreboard.getPlayerName() || 'Anon';
                        const entered = typeof window !== 'undefined' ? window.prompt('Your name', current) : null;
                        if (entered != null) Scoreboard.setPlayerName(entered);
                    } catch {}
                    return; // don't start the game
                }
            }
            startNow(false);
        };
        const onTouchStart = (e: TouchEvent) => {
            const touches = e.touches?.length ?? 0;
            startNow(touches >= 2);
        };
        const onClick = (e: MouseEvent) => startNow(false);
    const onDocPointerDown = (e: PointerEvent) => startNow(false);
        const onDocTouchStart = (e: TouchEvent) => {
            const touches = e.touches?.length ?? 0;
            startNow(touches >= 2);
        };
        const onDocClick = (e: MouseEvent) => startNow(false);

        engine.canvas.onpointerdown = onPointerDown as any;
        engine.canvas.ontouchstart = onTouchStart as any;
        engine.canvas.onclick = onClick as any;
        document.addEventListener('pointerdown', onDocPointerDown, { passive: true });
        document.addEventListener('touchstart', onDocTouchStart, { passive: true });
        document.addEventListener('click', onDocClick, { passive: true });
    }
    update(dt: number, engine: GameEngine): void {
        this.t += dt;
        // Scene transitions and toggles
        if (engine.input.wasPressed('KeyS')) engine.setScene(new GameScene());
        if (engine.input.wasPressed('KeyV')) engine.setScene(new VersusScene());
    if (engine.input.wasPressed('KeyO')) { this.launchOnline(engine); }
    if (engine.input.wasPressed('Escape') && this.onlineModalOpen) { this.onlineModalOpen = false; }
    if (engine.input.wasPressed('KeyM')) Audio.muted = !Audio.muted;
    if (engine.input.wasPressed('KeyR')) Settings.toggleReducedMotion();
    if (engine.input.wasPressed('KeyC')) Scoreboard.clear();

    // Background gradient
        const { ctx } = engine;
        const w = engine.canvas.width;
        const h = engine.canvas.height;
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#0b1023');
        g.addColorStop(1, '#1a2247');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Subtle stars
        ctx.save();
        ctx.globalAlpha = 0.2;
        for (let i = 0; i < 60; i++) {
            const x = (i * 91) % w;
            const y = (i * 53) % h;
            ctx.fillStyle = i % 2 ? '#d0e0ff' : '#a0b8ff';
            ctx.fillRect(x, (y + (Math.sin(this.t + i) * 2 + 2) | 0), 2, 2);
        }
        ctx.restore();

    // Floating centered title
    const bob = Math.sin(this.t * 2) * 6;
    ctx.textBaseline = 'top';
    const title = 'CrappBird';
    ctx.font = '900 72px system-ui, ui-sans-serif, -apple-system, Segoe UI';
    const tw = ctx.measureText(title).width;
    const tx = Math.max(24, (w - tw) / 2);
    const ty = 56 + bob;
    // Title gradient and glow
    const tg = ctx.createLinearGradient(tx, ty, tx, ty + 72);
    tg.addColorStop(0, '#e6f0ff');
    tg.addColorStop(1, '#9cc9ff');
    ctx.save();
    ctx.shadowColor = '#3b82f6aa';
    ctx.shadowBlur = 18;
    ctx.fillStyle = tg;
    ctx.fillText(title, tx, ty);
    ctx.restore();
    // Accent underline
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(tx, ty + 72 + 6);
    ctx.lineTo(tx + Math.min(520, tw * 0.65), ty + 72 + 6);
    ctx.stroke();

    // Little animated bird next to the title
    const birdX = tx - 80, birdY = ty + 10; // position left of the title
    const r = 18;
    const wingPhase = Math.sin(this.t * 10) * 0.6;
    // body
    ctx.fillStyle = '#58a6ff';
    ctx.beginPath(); ctx.arc(birdX, birdY, r, 0, Math.PI * 2); ctx.fill();
    // belly
    ctx.fillStyle = '#ffffffaa';
    ctx.beginPath(); ctx.arc(birdX - r * 0.2, birdY + r * 0.1, r * 0.7, Math.PI * 0.1, Math.PI * 1.2); ctx.fill();
    // wing
    ctx.save();
    ctx.translate(birdX - r * 0.2, birdY);
    ctx.rotate(-0.8 + wingPhase);
    ctx.fillStyle = '#00000022';
    ctx.beginPath(); ctx.ellipse(0, 0, r * 0.9, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // beak
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.moveTo(birdX + r * 0.9, birdY);
    ctx.lineTo(birdX + r * 1.4, birdY - r * 0.2);
    ctx.lineTo(birdX + r * 0.9, birdY + r * 0.2);
    ctx.closePath(); ctx.fill();
    // eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(birdX + r * 0.2, birdY - r * 0.3, r * 0.22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(birdX + r * 0.25, birdY - r * 0.3, r * 0.1, 0, Math.PI * 2); ctx.fill();

        // Vignette for depth
        ctx.save();
        const vg = ctx.createRadialGradient(w/2, h/2, Math.min(w,h)*0.2, w/2, h/2, Math.max(w,h)*0.6);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.35)');
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();

        // Cards with options
        // Play buttons card (centered)
        const cardW = Math.min(560, w - 64);
        const cardY = 170;
        const cardX = (w - cardW) / 2;
        ctx.fillStyle = '#0f172ae6';
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, 150, 14);
        ctx.fill();
        ctx.fillStyle = '#cdd9e5';
        ctx.font = '700 22px system-ui';
        ctx.fillText('Play', cardX + 16, cardY + 16);
        // Buttons
    const btnW = 180, btnH = 44, gap = 18;
    const bx = cardX + 16, by = cardY + 56;
        const drawBtn = (x:number, y:number, label:string, icon?:string) => {
            ctx.fillStyle = '#15223f';
            ctx.strokeStyle = '#58a6ffaa';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect(x, y, btnW, btnH, 10); ctx.fill(); ctx.stroke();
            if (icon) { ctx.fillStyle = '#9cc9ff'; ctx.font = '700 18px system-ui'; ctx.fillText(icon, x + 12, y + 28); }
            ctx.fillStyle = '#e8e8f0'; ctx.font = '600 18px system-ui';
            ctx.fillText(label, x + (icon ? 36 : 14), y + 28);
        };
        drawBtn(bx, by, 'S — Singleplayer', '🎮');
        drawBtn(bx + btnW + gap, by, 'V — Versus (Local)', '🤝');
        drawBtn(bx + (btnW + gap) * 2, by, 'O — Versus (Online)', '🌐');
    this.btnS = { x: bx, y: by, w: btnW, h: btnH };
    this.btnV = { x: bx + btnW + gap, y: by, w: btnW, h: btnH };
    this.btnVO = { x: bx + (btnW + gap) * 2, y: by, w: btnW, h: btnH };

        // Controls summary
    const cY = cardY + 170;
    const cW = Math.min(760, w - 64);
    const cX = (w - cW) / 2;
    ctx.fillStyle = '#0f172acc';
    ctx.beginPath();
    ctx.roundRect(cX, cY, cW, 160, 14);
    ctx.fill();
        ctx.fillStyle = '#cdd9e5';
        ctx.font = '700 20px system-ui';
    ctx.fillText('Controls', cX + 16, cY + 16);
        ctx.font = '500 16px system-ui';
    let y = cY + 46;
    ctx.fillText('Singleplayer: Flap = Space/ArrowUp/W or Click/Tap • Move = ArrowLeft/Right or A/D • Shoot = Right Click or Ctrl/J (hold)', cX + 16, y);
        y += 28;
    ctx.fillText('Versus (Local): P1 = Arrows + Space • P2 = W (flap), S (nudge down)', cX + 16, y);
        y += 28;
    ctx.fillText(`Online: O — create or join room • Mute = M (${Audio.muted ? 'Muted' : 'Sound on'}) • Reduced motion = R (${Settings.reducedMotion ? 'On' : 'Off'}) • Esc returns here`, cX + 16, y);

        // Power-ups quick guide
        const pY = cY + 170;
        const pW = Math.min(760, w - 64);
        const pX = (w - pW) / 2;
        ctx.fillStyle = '#0f172acc';
        ctx.beginPath();
        ctx.roundRect(pX, pY, pW, 130, 14);
        ctx.fill();
        ctx.fillStyle = '#cdd9e5';
        ctx.font = '700 20px system-ui';
        ctx.fillText('Power-ups', pX + 16, pY + 16);
        ctx.font = '500 14px system-ui';
        let py = pY + 44;
        const list = [
            ['+ Heal', 'gain 1 heart'],
            ['R Rapid', 'shorter cooldown'],
            ['S Shield', '+1 max heart and heal'],
            ['M Multishot', 'fires 3 bullets'],
            ['B Bigshot', 'bigger bullets, +1 dmg'],
            ['⌛ Slowmo', 'world slows briefly'],
            ['U Magnet', 'pulls pickups nearby'],
        ];
        for (const [k,v] of list) { ctx.fillText(`${k} — ${v}`, pX + 16, py); py += 20; }

        // Top scores (bottom center)
        const top = Scoreboard.getTop(5);
        if (top.length) {
            const boxW = Math.min(420, w - 40);
            const boxH = 28 + top.length * 22 + 20;
            const bx = (w - boxW) / 2;
            const by = h - boxH - 80;
            ctx.fillStyle = '#0f172acc';
            ctx.beginPath(); ctx.roundRect(bx, by, boxW, boxH, 10); ctx.fill();
            ctx.fillStyle = '#cdd9e5';
            ctx.font = '700 16px system-ui';
            ctx.fillText('Top Scores', bx + 12, by + 20);
            ctx.font = '500 14px system-ui';
            for (let i = 0; i < top.length; i++) {
                const s = top[i];
                const label = `${i + 1}. ${(s.name || 'Anon').slice(0,18)} — ${s.score}`;
                ctx.fillText(label, bx + 12, by + 44 + i * 22);
            }
            ctx.font = '400 12px system-ui';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Press C to clear • Name is saved locally', bx + 12, by + boxH - 10);
            // Edit name button (small)
            const btnW = 92, btnH = 22;
            const ex = bx + boxW - btnW - 10, ey = by + 10;
            ctx.fillStyle = '#15223f';
            ctx.strokeStyle = '#58a6ff88';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.roundRect(ex, ey, btnW, btnH, 6); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e8e8f0'; ctx.font = '600 12px system-ui';
            ctx.fillText('Edit name', ex + 12, ey + 15);
            this.btnEditName = { x: ex, y: ey, w: btnW, h: btnH };
        }

        // Pulse prompt
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
        ctx.save();
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillStyle = '#7dd3fc';
        ctx.font = '700 18px system-ui';
    const prompt = 'Tap to start • Starts easy, ramps up • Two-finger tap for Versus (S/V)';
    const pw = ctx.measureText(prompt).width;
    ctx.fillText(prompt, Math.max(20, (w - pw) / 2), h - 60);
        ctx.restore();

        // Online modal overlay (create/join)
        if (this.onlineModalOpen) {
            // backdrop
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.fillRect(0, 0, w, h);
            // card
            const mw = Math.min(420, w - 40);
            const mh = 200;
            const mx = (w - mw) / 2;
            const my = Math.max(60, h * 0.25);
            ctx.fillStyle = '#0f172ae6';
            ctx.beginPath(); ctx.roundRect(mx, my, mw, mh, 12); ctx.fill();
            ctx.strokeStyle = '#58a6ff55'; ctx.stroke();
            ctx.fillStyle = '#cdd9e5';
            ctx.font = '700 20px system-ui';
            ctx.fillText('Online Match', mx + 16, my + 16);
            ctx.font = '500 14px system-ui';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('Create a room to host, or join with a code from a friend.', mx + 16, my + 44);
            // buttons
            const bw = (mw - 16*3) / 2;
            const bh = 40;
            const byBtn = my + mh - bh - 20;
            // Create
            ctx.fillStyle = '#15223f';
            ctx.strokeStyle = '#58a6ffaa';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect(mx + 16, byBtn, bw, bh, 10); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e8e8f0'; ctx.font = '600 16px system-ui';
            ctx.fillText('Create Room', mx + 16 + 14, byBtn + 26);
            this.modalCreateBtn = { x: mx + 16, y: byBtn, w: bw, h: bh };
            // Join
            ctx.fillStyle = '#15223f';
            ctx.strokeStyle = '#58a6ffaa';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect(mx + 16*2 + bw, byBtn, bw, bh, 10); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#e8e8f0'; ctx.font = '600 16px system-ui';
            ctx.fillText('Join Room', mx + 16*2 + bw + 14, byBtn + 26);
            this.modalJoinBtn = { x: mx + 16*2 + bw, y: byBtn, w: bw, h: bh };
            // Cancel link
            ctx.fillStyle = '#9cc9ff'; ctx.font = '600 14px system-ui';
            const cancel = 'Cancel (Esc)';
            const cw = ctx.measureText(cancel).width;
            const cx = mx + mw - cw - 16;
            const cy = my + 16;
            ctx.fillText(cancel, cx, cy + 2);
            this.modalCancelBtn = { x: cx - 6, y: cy - 6, w: cw + 12, h: 24 };
            ctx.restore();
        } else {
            this.modalCreateBtn = this.modalJoinBtn = this.modalCancelBtn = null;
        }
    }
    render(): void {}
}

export default TitleScene;