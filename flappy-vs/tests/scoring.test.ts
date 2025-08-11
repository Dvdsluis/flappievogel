import { calculateScore } from '../src/game/scoring';
import { Player } from '../src/entities/Player';

describe('Scoring System', () => {
    let player: Player;

    beforeEach(() => {
        player = new Player();
    });

    test('initial score should be zero', () => {
        expect(player.score).toBe(0);
    });

    test('score should increase when an obstacle is passed', () => {
        player.passObstacle();
        expect(player.score).toBe(1);
    });

    test('score should increase correctly after multiple obstacles', () => {
        player.passObstacle();
        player.passObstacle();
        expect(player.score).toBe(2);
    });

    test('score should not decrease', () => {
        player.passObstacle();
        player.score = -1; // Simulate an invalid score
        expect(player.score).toBeGreaterThanOrEqual(0);
    });

    test('calculateScore should return correct score', () => {
        const score = calculateScore(5); // Assuming 5 is the number of obstacles passed
        expect(score).toBe(5);
    });
});