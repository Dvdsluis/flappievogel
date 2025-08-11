import { Player } from '../src/entities/Player';
import { Obstacle } from '../src/entities/Obstacle';
import { Physics } from '../src/game/physics';

describe('Collision Detection', () => {
    let player: Player;
    let obstacle: Obstacle;

    beforeEach(() => {
        player = new Player(50, 50); // Initial position of the player
        obstacle = new Obstacle(100, 50, 20, 20); // Position and size of the obstacle
    });

    test('should detect collision when player intersects with obstacle', () => {
        player.setPosition(90, 50); // Move player to intersect with obstacle
        const isColliding = Physics.checkCollision(player, obstacle);
        expect(isColliding).toBe(true);
    });

    test('should not detect collision when player is not intersecting with obstacle', () => {
        player.setPosition(10, 50); // Move player away from obstacle
        const isColliding = Physics.checkCollision(player, obstacle);
        expect(isColliding).toBe(false);
    });
});