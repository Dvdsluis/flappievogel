import GameEngine, { IScene } from '../game/engine';
import GameScene from './GameScene';
import VersusScene from './VersusScene';
import { Audio } from '../game/audio';

export class TitleScene implements IScene {
    init(engine: GameEngine): void {
        engine.canvas.focus();
    }
    update(_dt: number, engine: GameEngine): void {
    if (engine.input.wasPressed('KeyS')) engine.setScene(new GameScene());
    if (engine.input.wasPressed('KeyV')) engine.setScene(new VersusScene());
    if (engine.input.wasPressed('KeyM')) Audio.muted = !Audio.muted;
        const ctx = engine.ctx;
        ctx.fillStyle = '#0f1220';
        ctx.fillRect(0, 0, engine.canvas.width, engine.canvas.height);
        ctx.fillStyle = '#e8e8f0';
        ctx.font = '700 42px system-ui, sans-serif';
        ctx.fillText('Flappy VS', 40, 100);
        ctx.font = '500 20px system-ui, sans-serif';
        ctx.fillText('Press [S] for Singleplayer', 40, 180);
        ctx.fillText('Press [V] for Versus (Local)', 40, 210);
    ctx.fillText('Controls: Arrow keys (P1), WASD (P2 up/down)', 40, 250);
    ctx.fillText(`M to ${Audio.muted ? 'Unmute' : 'Mute'} • Esc returns here`, 40, 280);
    }
    render(): void {}
}

export default TitleScene;