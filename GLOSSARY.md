# Coin Sniffer

A single-player, top-down 2D browser game in which a miner walks through randomly generated corridors collecting coins while fighting off monsters.

## Language

**Miner**:
The player character. Walks, cannot dig, and fights with a Weapon.
_Avoid_: Player character, hero, avatar

**Corridor**:
A randomly generated walkable passage the Miner moves through.
_Avoid_: Level, map, tunnel

**Coin**:
A collectable item lying on the floor of a Corridor, worth its Denomination.
_Avoid_: Gold, treasure, pickup

**Denomination**:
The value a Coin is worth; Coins come in several Denominations.
_Avoid_: Tier, type

**Monster**:
A hostile creature that attacks the Miner and can be fought.
_Avoid_: Enemy, mob

**Weapon**:
What the Miner fights with, defined by parameters such as attack strength. The Miner starts with a sword.
_Avoid_: Gear, equipment

**Life**:
The Miner's remaining health. The Run ends when it reaches zero.
_Avoid_: HP, health bar

**Run**:
One endless play session, from start until the Miner's Life reaches zero.
_Avoid_: Game, round, level

**Score**:
The total Denomination value of Coins the Miner collected during a Run.
_Avoid_: Points, gold total

**High Scores**:
The locally kept list of the ten best Scores across Runs.
_Avoid_: Leaderboard, rankings
