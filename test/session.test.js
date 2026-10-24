import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { Tutorial } from '../server/tutorial.js';
import { MatchSession } from '../public/js/session.js';
import { ULT_MAX } from '../shared/config.js';

const frame = (game, processed = 0) => ({ ...game.snapshot(), processed: { p1: processed } });

test('session commands share one increasing sequence and refusals consume none', () => {
  const game = new Game();
  game.players.p1.gold = 500;
  const session = new MatchSession('p1');
  assert.equal(session.buy('goblin'), null, 'no frame yet');
  session.receive(frame(game));
  const ore = session.me.ores[0];
  const typed = [...ore.word].map((ch) => session.type(ch).action).filter(Boolean);
  const buy = session.buy('goblin');
  assert.equal(session.buy('nothing'), null);
  assert.equal(session.ultimate(), null);
  const mode = session.setMode('fight');
  assert.equal(session.setMode('fight'), null);
  const seqs = [...typed, buy, mode].map((a) => a.seq);
  assert.ok(seqs.every((seq, i) => i === 0 || seq > seqs[i - 1]), 'sent actions are ordered');
  assert.deepEqual(seqs.slice(-3), [ore.word.length, ore.word.length + 1, ore.word.length + 2], 'refusals leave no gap');
  assert.equal(session.seq, mode.seq);
  assert.equal(typed.at(-1).t, 'gather');
  assert.deepEqual(buy, { t: 'buy', item: 'goblin', seq: buy.seq });
});

test('the view layers purchase prediction onto the typing view until processed', () => {
  const game = new Game();
  const session = new MatchSession('p1');
  session.receive(frame(game));
  const gold = session.me.gold;
  const ore = session.me.ores[0];
  for (const ch of ore.word) session.type(ch);
  const buy = session.buy('goblin');
  const mode = session.setMode('fight');
  const check = () => {
    assert.ok(session.me.gold < gold, 'purchase predicted');
    assert.equal(session.me.charges.goblin.n, game.players.p1.charges.goblin.n - 1);
    assert.equal(session.me.ores.some((o) => o.id === ore.id), false, 'gather predicted');
    assert.equal(session.mode, 'fight');
  };
  check();
  session.receive(frame(game));
  check();
  for (const action of [{ t: 'gather', id: ore.id }, buy, mode]) game.apply('p1', action);
  session.receive(frame(game, mode.seq));
  assert.equal(session.me.gold, Math.floor(game.players.p1.gold));
  assert.equal(session.mode, 'fight');
});

test('lightning needs a full charge and the lesson refuses input locally', () => {
  const game = new Game();
  const session = new MatchSession('p1');
  session.receive(frame(game));
  assert.equal(session.ultimate(), null);
  game.players.p1.ult = ULT_MAX;
  session.receive(frame(game));
  assert.equal(session.ultimate().t, 'ult');

  const lesson = new MatchSession('p1');
  lesson.receive(frame(new Tutorial()));
  assert.equal(lesson.buy('goblin'), null, 'mine lesson comes first');
  assert.equal(lesson.setMode('fight'), null);
  assert.equal(lesson.policy.allows({ t: 'type' }), true);
  assert.equal(lesson.seq, 0);
});

test('Game.apply runs wire actions and ignores unknown ones', () => {
  const game = new Game();
  assert.equal(game.apply('p1', { t: 'mode', mode: 'fight' }), true);
  assert.equal(game.players.p1.mode, 'fight');
  const before = JSON.stringify(game.snapshot());
  assert.equal(game.apply('p1', { t: 'snapshot' }), undefined);
  assert.equal(game.apply('p1', { t: 'constructor' }), undefined);
  assert.equal(game.apply('p1', { t: 'buy', item: { toString: () => 'pickaxe' } }), false, 'item ids are coerced');
  assert.equal(JSON.stringify(game.snapshot()), before);
});
