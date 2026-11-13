import { describe, expect, it } from 'vitest';
import { createRun } from './run';
import { walkTo } from './testing/walk';

describe('visited areas', () => {
  it('start with only the start Room visited', () => {
    const { visited, level } = createRun({ seed: 3 }).state();
    expect(visited).toEqual({ rooms: [level.mainPath[0]], corridors: [] });
  });

  it('grow as the Miner enters a Corridor and then the Room beyond it', () => {
    const run = createRun({ seed: 3 });
    const { level } = run.state();
    const [start, next] = level.mainPath;
    const corridor = level.corridors.find((c) => c.from === start && c.to === next)!;

    walkTo(run, corridor.tiles[0]!);
    expect(run.state().visited).toEqual({ rooms: [start], corridors: [corridor.id] });

    const nextRoom = level.rooms[next!]!;
    walkTo(run, { x: nextRoom.x + 1, y: nextRoom.y + 1 });
    expect(run.state().visited.rooms).toEqual([start, next]);
  });

  it('never marks an area visited before the Miner reaches it', () => {
    const run = createRun({ seed: 3 });
    const { level } = run.state();
    walkTo(run, level.endGate);
    const { visited } = run.state();
    const sideRooms = level.rooms.filter((r) => r.kind === 'side').map((r) => r.id);
    for (const id of sideRooms) expect(visited.rooms).not.toContain(id);
    expect([...visited.rooms].sort()).toEqual([...level.mainPath].sort());
  });
});
