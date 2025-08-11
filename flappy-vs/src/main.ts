import GameEngine from './game/engine';
import TitleScene from './scenes/TitleScene';
import GameScene from './scenes/GameScene';
import VersusScene from './scenes/VersusScene';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
// Ensure canvas has size via CSS or set default
canvas.style.width = '100vw';
canvas.style.height = '100vh';

const engine = new GameEngine(canvas);

let current: 'title' | 'single' | 'versus' = 'title';
const setScene = (mode: typeof current) => {
	current = mode;
	switch (mode) {
		case 'title':
			engine.setScene(new TitleScene());
			break;
		case 'single':
			engine.setScene(new GameScene());
			break;
		case 'versus':
			engine.setScene(new VersusScene());
			break;
	}
};

setScene('title');

window.addEventListener('keydown', (e) => {
	if (current === 'title') {
		if (e.code === 'KeyS') setScene('single');
		if (e.code === 'KeyV') setScene('versus');
	} else if (e.code === 'Escape') {
		setScene('title');
	}
});

window.addEventListener('resize', () => engine.resizeToDisplay());