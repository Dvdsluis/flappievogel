import GameEngine from './game/engine';
import TitleScene from './scenes/TitleScene';
import GameScene from './scenes/GameScene';
import VersusScene from './scenes/VersusScene';
import VersusOnline from './modes/VersusOnline';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
// Ensure canvas has size via CSS or set default
canvas.style.width = '100vw';
canvas.style.height = '100vh';

const engine = new GameEngine(canvas);

let current: 'title' | 'single' | 'versus' | 'versusOnline' = 'title';
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
		case 'versusOnline': {
			const name = 'Anon';
			const room = 'test';
			engine.setScene(new VersusOnline(room, name));
			break;
		}
	}
};

setScene('title');

window.addEventListener('keydown', (e) => {
	if (current === 'title') {
		if (e.code === 'KeyS') setScene('single');
		if (e.code === 'KeyV') setScene('versus');
	if (e.code === 'KeyO') setScene('versusOnline');
	} else if (e.code === 'Escape') {
		setScene('title');
	}
});

window.addEventListener('resize', () => engine.resizeToDisplay());