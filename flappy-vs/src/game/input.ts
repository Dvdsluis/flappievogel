export class Input {
    private down = new Set<string>();
    private pressedThisFrame = new Set<string>();

    constructor() {
        window.addEventListener(
            'keydown',
            (e) => {
                if (!this.down.has(e.code)) this.pressedThisFrame.add(e.code);
                this.down.add(e.code);
                const actionKeys = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'];
                if (actionKeys.includes(e.code)) e.preventDefault();
            },
            { passive: false }
        );
        window.addEventListener('keyup', (e) => this.down.delete(e.code));
    }

    beginFrame() {
        this.pressedThisFrame.clear();
    }

    endFrame() { /* symmetry with beginFrame */ }

    isDown(code: string) {
        return this.down.has(code);
    }

    wasPressed(code: string) {
        return this.pressedThisFrame.has(code);
    }

    getMovementDirection() {
        return {
            x: (this.isDown('ArrowRight') ? 1 : 0) + (this.isDown('ArrowLeft') ? -1 : 0),
            y: (this.isDown('ArrowDown') ? 1 : 0) + (this.isDown('ArrowUp') ? -1 : 0),
        };
    }

    // Optional: WASD movement helper without changing existing arrow behavior
    getWASDHorizontal() {
        return (this.isDown('KeyD') ? 1 : 0) + (this.isDown('KeyA') ? -1 : 0);
    }
}