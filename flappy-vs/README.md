# Flappy VS Game

## Overview
Flappy VS is a multiplayer game inspired by the classic Flappy Bird. Players navigate their characters through a series of obstacles by moving up and down, left and right. The game features a local versus mode where two players can compete against each other.

## Features
- Simple yet effective graphics using vector and shell designs.
- Intuitive controls for movement: players can move their characters up, down, left, and right.
- Local versus mode for competitive gameplay.
- Engaging gameplay mechanics similar to Flappy Bird.

## Project Structure
```
flappy-vs
├── public
│   └── index.html          # Main HTML entry point
├── src
│   ├── main.ts             # Main entry point of the TypeScript application
│   ├── game
│   │   ├── engine.ts       # Game engine managing the game loop and state
│   │   ├── renderer.ts      # Responsible for rendering game entities
│   │   ├── physics.ts       # Handles physics calculations
│   │   └── input.ts         # Manages user input
│   ├── modes
│   │   ├── Singleplayer.ts  # Implements single-player mode
│   │   └── VersusLocal.ts   # Implements local versus mode
│   ├── scenes
│   │   ├── TitleScene.ts    # Title screen and navigation
│   │   ├── GameScene.ts      # Main gameplay logic for single-player
│   │   └── VersusScene.ts    # Main gameplay logic for versus mode
│   ├── entities
│   │   ├── Player.ts         # Represents the player character
│   │   ├── Obstacle.ts       # Represents obstacles
│   │   └── HUD.ts            # Manages the heads-up display
│   └── styles
│       └── main.css          # CSS styles for the game
├── tests
│   ├── collision.test.ts     # Unit tests for collision detection
│   └── scoring.test.ts       # Unit tests for scoring system
├── package.json              # npm configuration file
├── tsconfig.json             # TypeScript configuration file
├── vite.config.ts            # Vite configuration file
└── README.md                 # Project documentation
```

## Setup Instructions
1. Clone the repository:
   ```
   git clone <repository-url>
   cd flappy-vs
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000` to play the game.

## Gameplay Instructions
- Use the arrow keys to control your character's movement.
- Avoid obstacles and try to score points by navigating through them.
- In versus mode, compete against another player to see who can score the highest.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.