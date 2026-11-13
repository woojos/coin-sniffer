import { Scene } from 'phaser';

export class TitleScene extends Scene {
  constructor() {
    super('Title');
  }

  create(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 3, 'Coin Sniffer', {
        fontFamily: 'monospace',
        fontSize: '56px',
        color: '#f2c14e',
      })
      .setOrigin(0.5);

    // Full menu navigation comes in a later ticket; for now Enter or Space starts a Run.
    this.add
      .text(width / 2, height / 2 + 40, '> Play', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const keyboard = this.input.keyboard!;
    const play = (): void => {
      this.scene.start('Play');
    };
    keyboard.once('keydown-ENTER', play);
    keyboard.once('keydown-SPACE', play);
  }
}
