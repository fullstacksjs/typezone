import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { Bot } from '../server/bot.js';
import { MOBS, SPELLS, LANE_LENGTH, BASE_HP, ULT_MAX, START_GOLD, ORE_COUNT } from '../shared/config.js';

test('gathering an ore pays gold, builds combo and replaces the ore', () => {
  const g = new Game();
  const p = g.players.p1;
  const ore = p.ores[0];
  g.gather('p1', ore.id);
  assert.equal(p.combo, 1);
  assert.ok(p.gold > START_GOLD);
  assert.equal(p.ores.length, ORE_COUNT);
  assert.ok(!p.ores.some((o) => o.id === ore.id));
});

test('gathering is rejected in fight mode', () => {
  const g = new Game();
  g.setMode('p1', 'fight');
  g.gather('p1', g.players.p1.ores[0].id);
  assert.equal(g.players.p1.gold, START_GOLD);
});

test('miss resets combo', () => {
  const g = new Game();
  g.gather('p1', g.players.p1.ores[0].id);
  g.miss('p1');
  assert.equal(g.players.p1.combo, 0);
  assert.equal(g.players.p1.stats.misses, 1);
});

test('buying a mob spends gold and spawns it heading at the opponent', () => {
  const g = new Game();
  g.players.p1.gold = 100;
  assert.ok(g.buy('p1', 'knight'));
  assert.equal(g.players.p1.gold, 100 - MOBS.knight.cost);
  assert.equal(g.mobs.length, 1);
  assert.equal(g.mobs[0].target, 'p2');
  assert.equal(g.mobs[0].words.length, 2);
  assert.ok(!g.buy('p1', 'slimelet'), 'hidden mobs are not purchasable');
  g.players.p1.gold = 0;
  assert.ok(!g.buy('p1', 'goblin'));
});

test('knights need both words; only the target can hit, in fight mode, with the right word index', () => {
  const g = new Game();
  const mob = g.spawnMob('p1', 'knight');
  g.hitMob('p2', mob.id, 0); // still gathering
  assert.equal(mob.wi, 0);
  g.setMode('p2', 'fight');
  g.setMode('p1', 'fight');
  g.hitMob('p1', mob.id, 0); // owner can't kill own mob
  assert.equal(mob.wi, 0);
  g.hitMob('p2', mob.id, 1); // wrong index
  assert.equal(mob.wi, 0);
  g.hitMob('p2', mob.id, 0);
  assert.equal(mob.wi, 1);
  assert.equal(g.mobs.length, 1);
  g.hitMob('p2', mob.id, 1);
  assert.equal(g.mobs.length, 0);
  assert.equal(g.players.p2.stats.mobsKilled, 1);
  assert.equal(g.players.p2.gold, START_GOLD + Math.round(MOBS.knight.cost * 0.5 * 1.2));
});

test('slimes split into slimelets when killed', () => {
  const g = new Game();
  g.setMode('p2', 'fight');
  const mob = g.spawnMob('p1', 'slime', 500);
  g.hitMob('p2', mob.id, 0);
  const kids = g.mobs.filter((m) => m.type === 'slimelet');
  assert.equal(kids.length, MOBS.slime.splits.count);
  assert.ok(kids.every((k) => k.target === 'p2' && k.d < 500));
});

test('mobs that reach the base deal damage and can end the game', () => {
  const g = new Game();
  const mob = g.spawnMob('p1', 'giant', LANE_LENGTH - 1);
  g.players.p2.combo = 5;
  g.update(0.1);
  assert.equal(g.players.p2.hp, BASE_HP - MOBS.giant.damage);
  assert.equal(g.players.p2.combo, 0, 'getting hit breaks your combo');
  assert.ok(!g.mobs.includes(mob));
  g.players.p2.hp = 1;
  g.spawnMob('p1', 'goblin', LANE_LENGTH - 1);
  g.update(0.1);
  assert.equal(g.winner, 'p1');
});

test('frost slows mobs heading at the caster', () => {
  const g = new Game();
  const a = g.spawnMob('p1', 'goblin');
  g.update(1);
  const normal = a.d;
  g.players.p2.gold = 100;
  g.buy('p2', 'frost');
  const b = g.spawnMob('p1', 'goblin');
  g.update(1);
  assert.ok(Math.abs(b.d - normal * SPELLS.frost.slow) < 1e-6);
});

test('fog hits the opponent, repair heals, pickaxe upgrades', () => {
  const g = new Game();
  g.players.p1.gold = 1000;
  g.buy('p1', 'fog');
  assert.equal(g.players.p2.fog, SPELLS.fog.duration);
  assert.ok(!g.buy('p1', 'repair'), 'cannot repair at full hp');
  g.players.p1.hp = 50;
  g.buy('p1', 'repair');
  assert.equal(g.players.p1.hp, 50 + SPELLS.repair.amount);
  for (let i = 0; i < 10; i++) g.buy('p1', 'pickaxe');
  assert.equal(g.players.p1.pickaxe, SPELLS.pickaxe.costs.length);
});

test('lightning strips a word from every incoming mob', () => {
  const g = new Game();
  const gob = g.spawnMob('p1', 'goblin');
  const kn = g.spawnMob('p1', 'knight');
  const mine = g.spawnMob('p2', 'goblin');
  g.ultimate('p2');
  assert.equal(g.mobs.length, 3, 'needs a full charge');
  g.players.p2.ult = ULT_MAX;
  g.ultimate('p2');
  assert.ok(!g.mobs.includes(gob));
  assert.equal(kn.wi, 1);
  assert.ok(g.mobs.includes(mine), 'own mobs are untouched');
  assert.equal(g.players.p2.ult, 0);
});

test('incoming mobs avoid first-letter collisions when possible', () => {
  const g = new Game();
  for (let i = 0; i < 6; i++) g.spawnMob('p1', 'goblin');
  const firsts = g.mobs.map((m) => m.words[0][0]);
  assert.equal(new Set(firsts).size, firsts.length);
});

test('snapshot reports absolute positions from each owner', () => {
  const g = new Game();
  g.spawnMob('p1', 'goblin', 100);
  g.spawnMob('p2', 'goblin', 100);
  const snap = g.snapshot();
  assert.equal(snap.mobs[0].x, 100);
  assert.ok(snap.mobs[0].vx > 0);
  assert.equal(snap.mobs[1].x, LANE_LENGTH - 100);
  assert.ok(snap.mobs[1].vx < 0);
});

test('bot vs bot plays a full match to completion', () => {
  const g = new Game();
  const bots = [new Bot(g, 'p1', 'hard'), new Bot(g, 'p2', 'easy')];
  let steps = 0;
  while (!g.winner && steps < 20 * 60 * 15) {
    for (const b of bots) b.update(0.05);
    g.update(0.05);
    g.snapshot();
    steps++;
  }
  assert.ok(g.winner, `no winner after ${g.time.toFixed(0)}s`);
  const s = g.summary();
  assert.ok(s.stats.p1.mobsSent > 0 && s.stats.p2.mobsSent > 0);
  assert.ok(s.stats.p1.wpm > 0);
});


test('bounties use defender combo and pickaxe, including Lightning and slimelets', () => {
  for (const cause of ['type', 'ult']) {
    const g = new Game();
    const p = g.players.p2;
    p.combo = 5;
    p.pickaxe = 2;
    g.players.p1.pickaxe = 4;
    for (const type of ['goblin', 'slimelet']) {
      const mob = g.spawnMob('p1', type);
      const before = p.gold;
      g.breakWord('p2', mob, cause);
      const expected = Math.round((type === 'slimelet' ? 6 : 20) * 0.5 * 1.5 * 1.5);
      assert.equal(p.gold - before, expected);
      assert.equal(g.events.at(-1).bounty, expected);
    }
  }
});

test('pressure income starts at three incoming mobs and stacks with overtime', () => {
  for (const overtime of [false, true]) {
    const g = new Game();
    if (overtime) g.time = 150;
    g.spawnMob('p2', 'goblin'); // outgoing mobs do not count
    g.spawnMob('p1', 'goblin');
    g.spawnMob('p1', 'goblin');
    const p = g.players.p2;
    let before = p.gold;
    g.update(1);
    assert.ok(Math.abs(p.gold - before - 0.6 * (overtime ? 2 : 1)) < 1e-8);
    g.spawnMob('p1', 'goblin');
    before = p.gold;
    g.update(1);
    assert.ok(Math.abs(p.gold - before - 0.9 * (overtime ? 2 : 1)) < 1e-8);
    assert.equal(g.snapshot().players.p2.pressured, true);
    g.mobs = [];
    assert.equal(g.snapshot().players.p2.pressured, false);
  }
});

test('mob charges start full, reject empty purchases, refill sequentially and cap', () => {
  for (const type of ['goblin', 'knight', 'slime', 'giant']) {
    const g = new Game();
    const p = g.players.p1;
    p.gold = 10000;
    const def = MOBS[type];
    for (let i = 0; i < def.charges; i++) assert.equal(g.buy('p1', type), true);
    const before = p.gold;
    assert.equal(g.buy('p1', type), false);
    assert.equal(p.gold, before);
    g.mobs = [];
    g.update(def.recharge / 2);
    assert.equal(p.charges[type].n, 0);
    assert.equal(g.snapshot().players.p1.charges[type].progress, 0.5);
    g.update(def.recharge / 2);
    assert.equal(p.charges[type].n, 1);
    g.update(def.recharge * 10);
    assert.deepEqual(p.charges[type], { n: def.charges, t: 0 });
    g.update(1);
    g.buy('p1', type);
    assert.equal(p.charges[type].t, 0, 'no recharge banked at full charges');
    assert.equal(g.players.p2.charges[type].n, def.charges);
  }
});

test('slimelets move at 72 and split behind the parent even near the gate', () => {
  const g = new Game();
  const mob = g.spawnMob('p1', 'slime', 990, 1);
  g.breakWord('p2', mob, 'type');
  assert.deepEqual(g.mobs.map((m) => m.d), [970, 945]);
  assert.ok(g.mobs.every((m) => g.speedOf(m) === 72));
});


