export class Physics {
    static gravity = 900; // px/s^2
    static jumpVelocity = -300; // px/s

    static applyGravity(entity: { vy: number }, dt: number) {
        entity.vy += Physics.gravity * dt;
    }

    static jump(entity: { vy: number }) {
        entity.vy = Physics.jumpVelocity;
    }

    static checkCollision(
        player: { x: number; y: number; width: number; height: number },
        obstacle: { x: number; y: number; width: number; height: number }
    ): boolean {
        return !(
            player.x + player.width < obstacle.x ||
            player.x > obstacle.x + obstacle.width ||
            player.y + player.height < obstacle.y ||
            player.y > obstacle.y + obstacle.height
        );
    }
}