import { type GameObjects, Scene } from 'phaser';
import { createRun, type Direction, type Level, type Run, type Tile, type VisitedAreas } from '../core/run';
import { MINER_TUNING } from '../data/tuning';

const TILE_PX = 32;

const COLOURS = {
  darkness: 0x000000,
  floor: 0x5a4632,
  wall: 0x2a1e14,
  miner: 0x6fa8dc,
  facing: 0xffffff,
  startGate: 0x4caf50,
  endGate: 0xf2c14e,
} as const;

const KEY_DIRECTIONS: Readonly<Record<string, Direction>> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

const FACING_OFFSET: Readonly<Record<Direction, { x: number; y: number }>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export class PlayScene extends Scene {
  private run!: Run;
  /** Held direction keys in the order they were pressed; the last one wins. */
  private heldKeys: string[] = [];
  private levelGraphics!: GameObjects.Graphics;
  private miner!: GameObjects.Rectangle;
  private facingMarker!: GameObjects.Rectangle;
  private drawnVisitKey = '';

  constructor() {
    super('Play');
  }

  create(): void {
    const seed = Math.floor(Math.random() * 2 ** 32);
    console.info(`Level seed: ${seed}`);
    this.run = createRun({ seed });
    this.heldKeys = [];
    this.drawnVisitKey = '';

    const { level } = this.run.state();
    this.cameras.main.setBackgroundColor(COLOURS.darkness);
    this.levelGraphics = this.add.graphics();
    const minerPx = MINER_TUNING.size * TILE_PX;
    this.miner = this.add.rectangle(0, 0, minerPx, minerPx, COLOURS.miner);
    this.facingMarker = this.add.rectangle(0, 0, minerPx / 4, minerPx / 4, COLOURS.facing);
    this.cameras.main.setBounds(0, 0, level.width * TILE_PX, level.height * TILE_PX);
    this.cameras.main.startFollow(this.miner, true);

    this.wireDirectionKeys();
    this.render();
  }

  override update(_time: number, delta: number): void {
    const lastKey = this.heldKeys[this.heldKeys.length - 1];
    this.run.update({ direction: lastKey ? (KEY_DIRECTIONS[lastKey] ?? null) : null }, delta);
    this.render();
  }

  private wireDirectionKeys(): void {
    const keyboard = this.input.keyboard!;
    keyboard.addCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT');
    const onDown = (event: KeyboardEvent): void => {
      if (!(event.code in KEY_DIRECTIONS) || event.repeat) return;
      this.heldKeys = [...this.heldKeys.filter((code) => code !== event.code), event.code];
    };
    const onUp = (event: KeyboardEvent): void => {
      this.heldKeys = this.heldKeys.filter((code) => code !== event.code);
    };
    // Key-up events are lost while the window is unfocused, so forget held keys then.
    const onBlur = (): void => {
      this.heldKeys = [];
    };
    keyboard.on('keydown', onDown);
    keyboard.on('keyup', onUp);
    this.game.events.on('blur', onBlur);
    this.events.once('shutdown', () => {
      keyboard.off('keydown', onDown);
      keyboard.off('keyup', onUp);
      this.game.events.off('blur', onBlur);
    });
  }

  private render(): void {
    const { level, miner, visited } = this.run.state();
    const visitKey = `${visited.rooms.join(',')}|${visited.corridors.join(',')}`;
    if (visitKey !== this.drawnVisitKey) {
      this.drawLevel(level, visited);
      this.drawnVisitKey = visitKey;
    }

    this.miner.setPosition(miner.x * TILE_PX, miner.y * TILE_PX);
    const offset = FACING_OFFSET[miner.facing];
    const reach = (MINER_TUNING.size * TILE_PX) / 2;
    this.facingMarker.setPosition(this.miner.x + offset.x * reach, this.miner.y + offset.y * reach);
  }

  /** Draws only visited areas and the walls around them; everything else stays dark. */
  private drawLevel(level: Level, visited: VisitedAreas): void {
    const lit = new Map<string, Tile>();
    for (const id of visited.rooms) {
      const room = level.rooms[id]!;
      for (let y = room.y; y < room.y + room.height; y++) {
        for (let x = room.x; x < room.x + room.width; x++) lit.set(`${x},${y}`, { x, y });
      }
    }
    for (const id of visited.corridors) {
      for (const tile of level.corridors[id]!.tiles) lit.set(`${tile.x},${tile.y}`, tile);
    }

    const g = this.levelGraphics.clear();
    for (const { x, y } of lit.values()) {
      g.fillStyle(COLOURS.floor).fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (level.floor[y + dy]?.[x + dx] === false) {
            g.fillStyle(COLOURS.wall).fillRect((x + dx) * TILE_PX, (y + dy) * TILE_PX, TILE_PX, TILE_PX);
          }
        }
      }
    }

    for (const [gate, colour] of [
      [level.startGate, COLOURS.startGate],
      [level.endGate, COLOURS.endGate],
    ] as const) {
      if (lit.has(`${gate.x},${gate.y}`)) {
        g.lineStyle(3, colour).strokeRect(gate.x * TILE_PX + 3, gate.y * TILE_PX + 3, TILE_PX - 6, TILE_PX - 6);
      }
    }
  }
}
