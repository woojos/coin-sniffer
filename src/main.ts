import { AUTO, Game, Scale } from 'phaser';
import { TitleScene } from './scenes/TitleScene';

new Game({
  type: AUTO,
  parent: 'game',
  width: 800,
  height: 600,
  backgroundColor: '#1a1410',
  scale: { mode: Scale.FIT, autoCenter: Scale.CENTER_BOTH },
  scene: [TitleScene],
});
