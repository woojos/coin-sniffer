import { type GameObjects, Math as PhaserMath, Scene } from 'phaser';
import {
  createRun,
  type Coin,
  type Denomination,
  type Direction,
  type Level,
  type Monster,
  type Run,
  type SwingState,
  type Tile,
  type VisitedAreas,
  type Weapon,
} from '../core/run';
import { tileKey } from '../core/tile';
import { FACING_ANGLE, halfArc } from '../core/swing';
import { MINER_TUNING, MONSTER_TUNING } from '../data/tuning';

const TILE_PX = 32;

const COLOURS = {
  darkness: 0x000000,
  floor: 0x5a4632,
  wall: 0x2a1e14,
  miner: 0x6fa8dc,
  facing: 0xffffff,
  startGate: 0x4caf50,
  endGate: 0xf2c14e,
  crawler: 0xc0392b,
  monsterHit: 0xffffff,
  swing: 0xe8e8e8,
  lifeBar: 0xd64545,
  lifeBarBack: 0x3a1010,
  hud: '#f2c14e',
} as const;

/** Bronze, silver, gold, ruby and diamond: colour, size and shape all differ, so value reads at a glance. */
const COIN_LOOKS: Readonly<Record<Denomination, { colour: number; radius: number; shape: 'disc' | 'gem' }>> = {
  1: { colour: 0xcd7f32, radius: 5, shape: 'disc' },
  5: { colour: 0xd8d8d8, radius: 6, shape: 'disc' },
  10: { colour: 0xffd700, radius: 7, shape: 'disc' },
  25: { colour: 0xe0115f, radius: 8, shape: 'gem' },
  100: { colour: 0xb9f2ff, radius: 10, shape: 'gem' },
};

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

const LIFE_BAR = { x: 16, y: 56, width: 200, height: 14 } as const;

/** How long the Miner stays visible, then hidden, while he flashes after a hit. */
const FLASH_MS = 100;

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
  private swingHeld = false;
  /** Set on every fresh Swing key press and cleared after the next update, so a tap shorter than a frame still counts. */
  private swingTapped = false;
  private levelGraphics!: GameObjects.Graphics;
  private coinGraphics!: GameObjects.Graphics;
  private monsterGraphics!: GameObjects.Graphics;
  private swingGraphics!: GameObjects.Graphics;
  private lifeBar!: GameObjects.Graphics;
  private hudText!: GameObjects.Text;
  /** Floor tiles of visited areas, by tile key. */
  private lit = new Map<string, Tile>();
  private miner!: GameObjects.Rectangle;
  private facingMarker!: GameObjects.Rectangle;
  private drawnLevel: Level | null = null;
  private drawnVisitKey = '';
  private drawnCoinKey = '';

  constructor() {
    super('Play');
  }

  create(): void {
    const seed = Math.floor(Math.random() * 2 ** 32);
    console.info(`Run seed: ${seed}`);
    this.run = createRun({ seed });
    this.heldKeys = [];
    this.swingHeld = false;
    this.swingTapped = false;
    this.drawnLevel = null;
    this.drawnVisitKey = '';
    this.drawnCoinKey = '';

    this.cameras.main.setBackgroundColor(COLOURS.darkness);
    this.levelGraphics = this.add.graphics();
    this.coinGraphics = this.add.graphics();
    this.monsterGraphics = this.add.graphics();
    this.swingGraphics = this.add.graphics();
    const minerPx = MINER_TUNING.size * TILE_PX;
    this.miner = this.add.rectangle(0, 0, minerPx, minerPx, COLOURS.miner);
    this.facingMarker = this.add.rectangle(0, 0, minerPx / 4, minerPx / 4, COLOURS.facing);
    this.cameras.main.startFollow(this.miner, true);
    this.hudText = this.add
      .text(16, 12, '', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: COLOURS.hud,
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(1);
    this.lifeBar = this.add.graphics().setScrollFactor(0).setDepth(1);

    this.wireDirectionKeys();
    this.render();
  }

  override update(_time: number, delta: number): void {
    const lastKey = this.heldKeys[this.heldKeys.length - 1];
    const direction = lastKey ? (KEY_DIRECTIONS[lastKey] ?? null) : null;
    this.run.update({ direction, swing: this.swingHeld || this.swingTapped }, delta);
    this.swingTapped = false;
    this.render();
    const { status, score, levelNumber } = this.run.state();
    if (status === 'over') this.scene.start('RunOver', { score, levelNumber });
  }

  private wireDirectionKeys(): void {
    const keyboard = this.input.keyboard!;
    keyboard.addCapture('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE');
    const onDown = (event: KeyboardEvent): void => {
      if (event.code === 'Space' && !event.repeat) {
        this.swingHeld = true;
        this.swingTapped = true;
      }
      if (!(event.code in KEY_DIRECTIONS) || event.repeat) return;
      this.heldKeys = [...this.heldKeys.filter((code) => code !== event.code), event.code];
    };
    const onUp = (event: KeyboardEvent): void => {
      if (event.code === 'Space') this.swingHeld = false;
      this.heldKeys = this.heldKeys.filter((code) => code !== event.code);
    };
    // Key-up events are lost while the window is unfocused, so forget held keys then.
    const onBlur = (): void => {
      this.heldKeys = [];
      this.swingHeld = false;
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
    const { level, levelNumber, miner, life, invulnerableMs, weapon, swing, visited, coins, monsters, score } =
      this.run.state();
    if (level !== this.drawnLevel) {
      this.cameras.main.setBounds(0, 0, level.width * TILE_PX, level.height * TILE_PX);
      this.drawnLevel = level;
      this.drawnVisitKey = '';
      this.drawnCoinKey = '';
    }
    const visitKey = `${visited.rooms.join(',')}|${visited.corridors.join(',')}`;
    if (visitKey !== this.drawnVisitKey) {
      this.lit = litTiles(level, visited);
      this.drawLevel(level);
      this.drawnVisitKey = visitKey;
    }
    const coinKey = `${visitKey}|${coins.length}`;
    if (coinKey !== this.drawnCoinKey) {
      this.drawCoins(coins);
      this.drawnCoinKey = coinKey;
    }
    this.drawMonsters(monsters);
    this.hudText.setText(`Level ${levelNumber}   Score: ${score}`);
    this.drawLifeBar(life);

    this.miner.setPosition(miner.x * TILE_PX, miner.y * TILE_PX);
    const offset = FACING_OFFSET[miner.facing];
    const reach = (MINER_TUNING.size * TILE_PX) / 2;
    this.facingMarker.setPosition(this.miner.x + offset.x * reach, this.miner.y + offset.y * reach);
    const hidden = invulnerableMs > 0 && Math.floor(invulnerableMs / FLASH_MS) % 2 === 1;
    this.miner.setVisible(!hidden);
    this.facingMarker.setVisible(!hidden);
    this.drawSwing(swing, weapon);
  }

  /** Sweeps the Swing's arc in front of the Miner, filling in as the hit approaches. */
  private drawSwing(swing: SwingState | null, weapon: Weapon): void {
    const g = this.swingGraphics.clear();
    if (swing === null) return;
    const half = halfArc(weapon);
    const start = FACING_ANGLE[swing.facing] - half;
    g.fillStyle(COLOURS.swing, 0.25 + 0.35 * swing.progress)
      .slice(this.miner.x, this.miner.y, weapon.reach * TILE_PX, start, start + 2 * half * swing.progress)
      .fillPath();
  }

  /** Draws Monsters in visited areas only; Monsters in the dark stay hidden. */
  private drawMonsters(monsters: readonly Monster[]): void {
    const g = this.monsterGraphics.clear();
    const size = MONSTER_TUNING.crawler.size * TILE_PX;
    for (const monster of monsters) {
      if (!this.lit.has(tileKey({ x: Math.floor(monster.x), y: Math.floor(monster.y) }))) continue;
      const cx = monster.x * TILE_PX;
      const cy = monster.y * TILE_PX;
      g.fillStyle(monster.flashMs > 0 ? COLOURS.monsterHit : COLOURS.crawler).fillCircle(cx, cy, size / 2);
      g.lineStyle(2, 0x000000, 0.6).strokeCircle(cx, cy, size / 2);
    }
  }

  private drawLifeBar(life: number): void {
    const { x, y, width, height } = LIFE_BAR;
    const g = this.lifeBar.clear();
    g.fillStyle(COLOURS.lifeBarBack).fillRect(x, y, width, height);
    g.fillStyle(COLOURS.lifeBar).fillRect(x, y, (width * life) / MINER_TUNING.life, height);
    g.lineStyle(2, 0x000000).strokeRect(x, y, width, height);
  }

  /** Draws only visited areas and the walls around them; everything else stays dark. */
  private drawLevel(level: Level): void {
    const lit = this.lit;
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
      if (lit.has(tileKey(gate))) {
        g.lineStyle(3, colour).strokeRect(gate.x * TILE_PX + 3, gate.y * TILE_PX + 3, TILE_PX - 6, TILE_PX - 6);
      }
    }
  }

  /** Draws uncollected Coins in visited areas only; Coins in the dark stay hidden. */
  private drawCoins(coins: readonly Coin[]): void {
    const g = this.coinGraphics.clear();
    for (const coin of coins) {
      if (!this.lit.has(tileKey(coin))) continue;
      const { colour, radius, shape } = COIN_LOOKS[coin.denomination];
      const cx = (coin.x + 0.5) * TILE_PX;
      const cy = (coin.y + 0.5) * TILE_PX;
      g.fillStyle(colour);
      if (shape === 'disc') {
        g.fillCircle(cx, cy, radius).lineStyle(1, 0x000000, 0.5).strokeCircle(cx, cy, radius);
      } else {
        const points = [
          new PhaserMath.Vector2(cx, cy - radius),
          new PhaserMath.Vector2(cx + radius, cy),
          new PhaserMath.Vector2(cx, cy + radius),
          new PhaserMath.Vector2(cx - radius, cy),
        ];
        g.fillPoints(points, true).lineStyle(2, 0xffffff, 0.8).strokePoints(points, true);
      }
    }
  }
}

/** Floor tiles of the visited Rooms and Corridors, by tile key. */
function litTiles(level: Level, visited: VisitedAreas): Map<string, Tile> {
  const lit = new Map<string, Tile>();
  const light = (tile: Tile): void => {
    lit.set(tileKey(tile), tile);
  };
  for (const id of visited.rooms) {
    const room = level.rooms[id]!;
    for (let y = room.y; y < room.y + room.height; y++) {
      for (let x = room.x; x < room.x + room.width; x++) light({ x, y });
    }
  }
  for (const id of visited.corridors) level.corridors[id]!.tiles.forEach(light);
  return lit;
}
