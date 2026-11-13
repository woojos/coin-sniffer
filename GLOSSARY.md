# Coin Sniffer

A single-player, top-down 2D browser game in which a miner walks through randomly generated levels collecting coins while fighting off monsters.

## Language

**Miner**:
The player character. Walks, cannot dig, and fights with a Weapon.
_Avoid_: Player character, hero, avatar

**Level**:
A randomly generated stage made of a few Rooms linked by Corridors, entered through a Gate and left through another. Each successive Level has more valuable Coins and stronger Monsters.
_Avoid_: Map, stage, floor

**Room**:
An open area within a Level where Coins lie and Monsters wait.
_Avoid_: Chamber, cave

**Main Path**:
The route of Rooms from a Level's start Gate to its end Gate.
_Avoid_: Critical path, track

**Side Room**:
An optional dead-end Room off the Main Path.
_Avoid_: Branch, secret room

**Corridor**:
A walkable passage connecting Rooms within a Level.
_Avoid_: Tunnel, hallway

**Gate**:
The doorway at the start or the end of a Level. Passing through the end Gate leads to the next Level.
_Avoid_: Door, exit, portal

**Coin**:
A collectable item lying on the floor of a Corridor, worth its Denomination.
_Avoid_: Gold, treasure, pickup

**Denomination**:
The value a Coin is worth; Coins come in several Denominations.
_Avoid_: Tier, type

**Monster**:
A hostile creature that attacks the Miner and can be fought.
_Avoid_: Enemy, mob

**Crawler**:
A slow Monster that attacks only in melee.

**Spitter**:
A Monster that keeps its distance and shoots at the Miner.

**Charger**:
A Monster that waits, then dashes at the Miner.

**Weapon**:
What the Miner fights with, defined by parameters such as attack strength. The Miner starts with a sword.
_Avoid_: Gear, equipment

**Swing**:
One use of the Weapon, hitting Monsters in a short arc in front of the Miner.
_Avoid_: Attack, slash

**Life**:
The Miner's remaining health. The Run ends when it reaches zero.
_Avoid_: HP, health bar

**Run**:
One play session, a sequence of Levels from the first until the Miner's Life reaches zero.
_Avoid_: Game, round

**Score**:
The total Denomination value of Coins the Miner collected during a Run.
_Avoid_: Points, gold total

**High Scores**:
The locally kept list of the ten best Scores across Runs.
_Avoid_: Leaderboard, rankings
