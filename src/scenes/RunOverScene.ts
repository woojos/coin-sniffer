import { Scene } from 'phaser';

export interface RunOverData {
  readonly score: number;
  readonly levelNumber: number;
}

/** Shown when the Miner's Life reaches zero. Initials, Play again and Title options come in a later ticket. */
export class RunOverScene extends Scene {
  constructor() {
    super('RunOver');
  }

  create(data: RunOverData): void {
    const { width, height } = this.scale;
    const text = (y: number, content: string, size: number, color: string) =>
      this.add.text(width / 2, y, content, { fontFamily: 'monospace', fontSize: `${size}px`, color }).setOrigin(0.5);

    text(height / 3, 'Game Over', 56, '#d64545');
    text(height / 2, `Score: ${data.score}`, 32, '#f2c14e');
    text(height / 2 + 44, `Level reached: ${data.levelNumber}`, 24, '#ffffff');
    text(height - 80, 'Press Enter', 20, '#aaaaaa');

    this.input.keyboard!.once('keydown-ENTER', () => {
      this.scene.start('Title');
    });
  }
}
