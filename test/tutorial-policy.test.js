import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial } from '../server/tutorial.js';
import { tutorialPolicy } from '../shared/tutorial-policy.js';
import { purchase } from '../shared/shop.js';

test('guidance and buying agree on Gather before the Pickaxe lesson', () => {
  const game = new Tutorial();
  for (let i = 0; i < 2; i++) game.gather('p1', game.players.p1.ores[0].id);
  game.buy('p1', 'goblin');
  game.setMode('p1', 'fight');
  const enemy = game.mobs.find((m) => m.target === 'p1');
  game.hitMob('p1', enemy.id, 0);
  game.ultimate('p1');
  let lesson = game.snapshot().tutorial;
  let policy = tutorialPolicy(lesson, 'fight');
  assert.equal(policy.guidance.focus, 'mode-key');
  assert.equal(policy.guidance.title, 'Back to Gather');
  assert.equal(policy.allows({ t: 'buy', item: 'pickaxe' }), false);
  assert.equal(purchase(game.players.p1, 'pickaxe', { tutorial: lesson }).available, false);
  assert.equal(game.buy('p1', 'pickaxe'), false);
  assert.equal(policy.allows({ t: 'mode', mode: 'gather' }), true);
  game.setMode('p1', 'gather');
  policy = tutorialPolicy(lesson, 'gather');
  assert.equal(policy.guidance.item, 'pickaxe');
  assert.equal(policy.allows({ t: 'buy', item: 'pickaxe' }), true);
  assert.ok(game.buy('p1', 'pickaxe'));
  assert.equal(tutorialPolicy(game.snapshot().tutorial, 'gather').complete, true);
});

function perform(game, action, slot = 'p1') {
  switch (action.t) {
    case 'gather': return game.gather(slot, action.id);
    case 'buy': return game.buy(slot, action.item);
    case 'mode': return game.setMode(slot, action.mode);
    case 'hit': return game.hitMob(slot, action.id, action.wi);
    case 'ult': return game.ultimate(slot);
    case 'progress': return game.progress(slot, action.id, action.wi, 1);
    case 'miss': return game.miss(slot);
  }
}

function nextAction(game) {
  const enemy = game.mobs.find((m) => m.target === 'p1');
  switch (game.lesson.id) {
    case 'mine': return { t: 'gather', id: game.players.p1.ores[0].id };
    case 'send': return { t: 'buy', item: 'goblin' };
    case 'switch': return { t: 'mode', mode: 'fight' };
    case 'defend': return { t: 'hit', id: enemy.id, wi: enemy.wi };
    case 'lightning': return { t: 'ult' };
    case 'upgrade': return game.players.p1.mode === 'fight' ? { t: 'mode', mode: 'gather' } : { t: 'buy', item: 'pickaxe' };
  }
}

export function completeTutorial(game) {
  for (let i = 0; i < 10 && game.lesson.id !== 'done'; i++) perform(game, nextAction(game));
  assert.equal(game.lesson.id, 'done');
}

test('every lesson shares enforcement, guidance and shop permissions', () => {
  const game = new Tutorial();
  const anchors = { mine: 'ore', send: 'control', switch: 'control', defend: 'enemy', lightning: 'control', upgrade: 'control' };
  while (game.lesson.id !== 'done') {
    const lesson = game.snapshot().tutorial;
    const policy = tutorialPolicy(lesson, game.players.p1.mode);
    const action = nextAction(game);
    assert.equal(policy.guidance.anchor, anchors[lesson.id]);
    assert.ok(policy.allows(action));
    const denied = [
      { t: 'buy', item: 'knight' }, { t: 'mode', mode: 'invalid' },
      { t: 'gather', id: -1 }, { t: 'hit', id: -1, wi: 0 }, { t: 'ult' },
      { t: 'progress', id: -1, wi: 0 }, { t: 'miss' },
    ];
    for (const invalid of denied) {
      assert.equal(tutorialPolicy(lesson, game.players.p2.mode, 'p2').allows(invalid), false);
      const before = JSON.stringify(game.summary());
      perform(game, invalid, 'p2');
      assert.equal(JSON.stringify(game.summary()), before);
      if (!policy.allows(invalid)) {
        const state = JSON.stringify(game.snapshot());
        perform(game, invalid);
        assert.equal(JSON.stringify(game.snapshot()), state);
      }
    }
    for (const item of ['goblin', 'pickaxe', 'frost']) {
      const available = purchase(game.players.p1, item, { tutorial: lesson }).available;
      assert.equal(available, policy.allows({ t: 'buy', item }));
    }
    perform(game, action);
  }
  const done = tutorialPolicy(game.snapshot().tutorial, game.players.p1.mode);
  assert.equal(done.guidance.anchor, 'complete');
  for (const t of ['type', 'gather', 'hit', 'mode', 'buy', 'ult', 'progress', 'miss']) assert.equal(done.allows({ t }), false);
  const final = game.snapshot();
  game.update(100);
  assert.deepEqual(game.snapshot(), final);
  assert.equal(game.winner, null);
});
