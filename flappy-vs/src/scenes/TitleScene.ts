import GameEngine, { IScene } from '../game/engine';
import GameScene from './GameScene';
import VersusScene from './VersusScene';
import { Audio } from '../game/audio';

export class TitleScene implements IScene {
    private t = 0;
    onResize?(engine: GameEngine): void {
        engine.ctx.setTransform(1,0,0,1,0,0);
    }
    init(engine: GameEngine): void {
        engine.canvas.focus();
    }
    update(dt: number, engine: GameEngine): void {
        this.t += dt;
        // Scene transitions and toggles
        if (engine.input.wasPressed('KeyS')) engine.setScene(new GameScene());
        if (engine.input.wasPressed('KeyV')) engine.setScene(new VersusScene());
        if (engine.input.wasPressed('KeyM')) Audio.muted = !Audio.muted;

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

        // Floating title
        const bob = Math.sin(this.t * 2) * 6;
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '800 64px system-ui, ui-sans-serif, -apple-system, Segoe UI';
        ctx.textBaseline = 'top';
        ctx.fillText('Flappy VS', 40, 80 + bob);

        // Accent underline
        ctx.strokeStyle = '#58a6ff';
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.moveTo(40, 80 + bob + 64 + 8);
        ctx.lineTo(280, 80 + bob + 64 + 8);
        ctx.stroke();

        // Cards with options
        ctx.fillStyle = '#0f172a88';
        const cardY = 180;
        ctx.fillRect(32, cardY, Math.min(520, w - 64), 150);
        ctx.fillStyle = '#cdd9e5';
        ctx.font = '700 22px system-ui';
        ctx.fillText('Play', 48, cardY + 16);
        ctx.font = '500 18px system-ui';
        ctx.fillText('S — Singleplayer', 48, cardY + 52);
        ctx.fillText('V — Versus (Local)', 48, cardY + 80);

        // Controls summary
        const cY = cardY + 170;
        ctx.fillStyle = '#0f172a88';
        ctx.fillRect(32, cY, Math.min(620, w - 64), 160);
        ctx.fillStyle = '#cdd9e5';
        ctx.font = '700 20px system-ui';
        ctx.fillText('Controls', 48, cY + 16);
        ctx.font = '500 16px system-ui';
        let y = cY + 46;
    ctx.fillText('Singleplayer: Flap = Space/ArrowUp/W or Click/Tap • Move = ArrowLeft/Right or A/D • Shoot = Right Click or Ctrl/J (hold)', 48, y);
        y += 28;
        ctx.fillText('Versus: P1 = Arrows + Space • P2 = W (flap), S (nudge down)', 48, y);
        y += 28;
        ctx.fillText(`Mute = M (${Audio.muted ? 'Muted' : 'Sound on'}) • Esc returns here`, 48, y);

        // Pulse prompt
        const pulse = 0.5 + 0.5 * Math.sin(this.t * 3);
        ctx.save();
        ctx.globalAlpha = 0.6 + 0.4 * pulse;
        ctx.fillStyle = '#58a6ff';
        ctx.font = '700 18px system-ui';
        ctx.fillText('Press S or V to start — Click/Tap flaps', 40, h - 60);
        ctx.restore();
    }
    render(): void {}
}

export default TitleScene;