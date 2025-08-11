export class Obstacle {
    constructor(
        public x: number,
        public y: number,
        public width: number,
        public height: number,
        public speed: number = 120
    ) {}

    update(dt: number) {
        this.x -= this.speed * dt;
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }
}