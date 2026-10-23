import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial } from '../server/tutorial.js';
import { BASE_HP, ULT_MAX } from '../shared/config.js';

function mine(g) {
  g.gather('p1', g.players.p1.ores[0].id);
}

test('tutorial requires each action and supplies resources through completion', () => {
  const g = new Tutorial();
  const p = g.players.p1;
  assert.equal(g.lesson.id, 'mine');
  assert.equal(g.buy('p1', 'goblin'), false);
  g.setMode('p1', 'fight');
  assert.equal(p.mode, 'gather');
  g.gather('p1', -1);
  assert.equal(g.mined, 0);
  mine(g);
  assert.equal(g.snapshot().tutorial.mined, 1);
  mine(g);
  assert.equal(g.lesson.id, 'send');
  assert.equal(g.buy('p1', 'knight'), false);
  assert.ok(g.buy('p1', 'goblin'));
  assert.equal(p.stats.mobsSent, 1);
  assert.equal(g.lesson.id, 'switch');
  const enemy = g.mobs.find((m) => m.target === 'p1');
  g.hitMob('p1', enemy.id, 0);
  assert.ok(g.mobs.includes(enemy));
  g.setMode('p1', 'fight');
  assert.equal(g.lesson.id, 'defend');
  g.hitMob('p1', -1, 0);
  assert.equal(g.lesson.id, 'defend');
  g.hitMob('p1', enemy.id, 0);
  assert.equal(g.lesson.id, 'lightning');
  assert.equal(p.ult, ULT_MAX);
  assert.equal(g.mobs.filter((m) => m.target === 'p1').length, 2);
  g.ultimate('p1');
  assert.equal(g.lesson.id, 'upgrade');
  assert.equal(g.mobs.filter((m) => m.target === 'p1').length, 0);
  assert.equal(p.ult, 0);
  assert.equal(g.buy('p1', 'pickaxe'), false, 'must return to Gather');
  g.setMode('p1', 'gather');
  assert.ok(g.buy('p1', 'pickaxe'));
  assert.equal(p.pickaxe, 1);
  assert.equal(g.snapshot().tutorial.id, 'done');
  assert.equal(g.buy('p1', 'pickaxe'), false);
});

test('tutorial enemies stop safely and waiting never triggers overtime', () => {
  const g = new Tutorial();
  mine(g);
  mine(g);
  g.buy('p1', 'goblin');
  for (let i = 0; i < 7200; i++) g.update(0.25);
  assert.equal(g.players.p1.hp, BASE_HP);
  assert.equal(g.winner, null);
  assert.equal(g.overtime, false);
  const enemy = g.mobs.find((m) => m.target === 'p1');
  assert.ok(enemy);
  assert.equal(g.speedOf(enemy), 0);
  g.setMode('p1', 'fight');
  g.hitMob('p1', enemy.id, 0);
  assert.equal(g.lesson.id, 'lightning');
});

test('opponent actions cannot advance the private tutorial', () => {
  const g = new Tutorial();
  g.gather('p2', g.players.p2.ores[0].id);
  g.setMode('p2', 'fight');
  assert.equal(g.buy('p2', 'goblin'), false);
  g.ultimate('p2');
  assert.equal(g.mined, 0);
  assert.equal(g.step, 0);
  assert.equal(g.players.p2.mode, 'gather');
});
