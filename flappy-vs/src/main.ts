import GameEngine from './game/engine';
import TitleScene from './scenes/TitleScene';
import GameScene from './scenes/GameScene';
import VersusScene from './scenes/VersusScene';

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
// Ensure canvas has size via CSS or set default
canvas.style.width = '100vw';
canvas.style.height = '100vh';

const engine = new GameEngine(canvas);

let current: any = 'title';
const setTitle = () => {
	current = 'title';
	engine.setScene(new TitleScene());
};
const setSingle = () => {
	current = 'single';
	engine.setScene(new GameScene());
};
const setVersus = () => {
	current = 'versus';
	engine.setScene(new VersusScene());
};

setTitle();

window.addEventListener('keydown', (e) => {
	if (current === 'title') {
		if (e.code === 'KeyS') setSingle();
		if (e.code === 'KeyV') setVersus();
	} else if (e.code === 'Escape') {
		setTitle();
	}
});

window.addEventListener('resize', () => engine.resizeToDisplay());