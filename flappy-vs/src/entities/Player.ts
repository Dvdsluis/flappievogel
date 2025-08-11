export class Player {
    x: number;
    y: number;
    width: number;
    height: number;
    vx = 0;
    vy = 0;
    private _score = 0;
    name?: string;

    constructor(x: number = 50, y: number = 50, width: number = 28, height: number = 28, speed?: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        // speed is unused; kept to keep older calls compatible
    }

    setPosition(x: number, y: number) {
        this.x = x;
        this.y = y;
    }

    passObstacle() {
    this._score += 1;
    }

    update(dt: number) {
        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    get score() {
        return Math.max(0, this._score);
    }
    set score(v: number) {
        this._score = Math.max(0, v);
    }
}