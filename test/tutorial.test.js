import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial } from '../server/tutorial.js';
import { BASE_HP, ULT_MAX } from '../shared/config.js';

function mine(g) {
  g.apply('p1', { t: 'gather', id: g.players.p1.ores[0].id });
}

test('tutorial requires each action and supplies resources through completion', () => {
  const g = new Tutorial();
  const p = g.players.p1;
  assert.equal(g.lesson.id, 'mine');
  assert.equal(g.apply('p1', { t: 'buy', item: 'goblin' }), false);
  g.apply('p1', { t: 'mode', mode: 'fight' });
  assert.equal(p.mode, 'gather');
  g.apply('p1', { t: 'gather', id: -1 });
  assert.equal(g.mined, 0);
  mine(g);
  assert.equal(g.snapshot().tutorial.mined, 1);
  mine(g);
  assert.equal(g.lesson.id, 'send');
  assert.equal(g.apply('p1', { t: 'buy', item: 'knight' }), false);
  assert.ok(g.apply('p1', { t: 'buy', item: 'goblin' }));
  assert.equal(p.stats.mobsSent, 1);
  assert.equal(g.lesson.id, 'switch');
  const enemy = g.mobs.find((m) => m.target === 'p1');
  g.apply('p1', { t: 'hit', id: enemy.id, wi: 0 });
  assert.ok(g.mobs.includes(enemy));
  g.apply('p1', { t: 'mode', mode: 'fight' });
  assert.equal(g.lesson.id, 'defend');
  g.apply('p1', { t: 'hit', id: -1, wi: 0 });
  assert.equal(g.lesson.id, 'defend');
  g.apply('p1', { t: 'hit', id: enemy.id, wi: 0 });
  assert.equal(g.lesson.id, 'lightning');
  assert.equal(p.ult, ULT_MAX);
  assert.equal(g.mobs.filter((m) => m.target === 'p1').length, 2);
  g.apply('p1', { t: 'ult' });
  assert.equal(g.lesson.id, 'upgrade');
  assert.equal(g.mobs.filter((m) => m.target === 'p1').length, 0);
  assert.equal(p.ult, 0);
  assert.equal(g.apply('p1', { t: 'buy', item: 'pickaxe' }), false, 'must return to Gather');
  g.apply('p1', { t: 'mode', mode: 'gather' });
  assert.ok(g.apply('p1', { t: 'buy', item: 'pickaxe' }));
  assert.equal(p.pickaxe, 1);
  assert.equal(g.snapshot().tutorial.id, 'done');
  assert.equal(g.apply('p1', { t: 'buy', item: 'pickaxe' }), false);
});

test('tutorial enemies stop safely and waiting never triggers overtime', () => {
  const g = new Tutorial();
  mine(g);
  mine(g);
  g.apply('p1', { t: 'buy', item: 'goblin' });
  for (let i = 0; i < 7200; i++) g.update(0.25);
  assert.equal(g.players.p1.hp, BASE_HP);
  assert.equal(g.winner, null);
  assert.equal(g.overtime, false);
  const enemy = g.mobs.find((m) => m.target === 'p1');
  assert.ok(enemy);
  assert.equal(g.speedOf(enemy), 0);
  g.apply('p1', { t: 'mode', mode: 'fight' });
  g.apply('p1', { t: 'hit', id: enemy.id, wi: 0 });
  assert.equal(g.lesson.id, 'lightning');
});

test('opponent actions cannot advance the private tutorial', () => {
  const g = new Tutorial();
  g.apply('p2', { t: 'gather', id: g.players.p2.ores[0].id });
  g.apply('p2', { t: 'mode', mode: 'fight' });
  assert.equal(g.apply('p2', { t: 'buy', item: 'goblin' }), false);
  g.apply('p2', { t: 'ult' });
  assert.equal(g.mined, 0);
  assert.equal(g.step, 0);
  assert.equal(g.players.p2.mode, 'gather');
});
