import { Input } from './input';

export interface IScene {
    init(engine: GameEngine): void;
    update(dt: number, engine: GameEngine): void;
    render(ctx: CanvasRenderingContext2D, engine: GameEngine): void;
    onResize?(engine: GameEngine): void;
}

export class GameEngine {
    public canvas: HTMLCanvasElement;
    public ctx: CanvasRenderingContext2D;
    private lastTime = 0;
    private running = false;
    private scene: IScene | null = null;
    public input: Input;

    constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available');
    this.ctx = ctx;
    this.input = new Input();
    this.resizeToDisplay();
    }

    resizeToDisplay() {
        const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
        const rect = this.canvas.getBoundingClientRect();
        const width = Math.floor(rect.width * dpr) || 800;
        const height = Math.floor(rect.height * dpr) || 600;
        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
        }
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.scene?.onResize?.(this);
    }

    setScene(scene: IScene) {
        this.scene = scene;
        scene.init(this);
        if (!this.running) {
            this.running = true;
            this.lastTime = performance.now();
            requestAnimationFrame(this.loop);
        }
    }

    private loop = (now: number) => {
        if (!this.running || !this.scene) return;
        const dt = Math.min(1 / 30, (now - this.lastTime) / 1000);
        this.lastTime = now;
        this.input.beginFrame();
        this.scene.update(dt, this);
        this.scene.render(this.ctx, this);
        this.input.endFrame();
        requestAnimationFrame(this.loop);
    };
}

export default GameEngine;