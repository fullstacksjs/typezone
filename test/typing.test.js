import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Tutorial } from '../server/tutorial.js';
import { TypingState } from '../public/js/typing-state.js';

function typeWord(state, word, nextSeq) {
  let result;
  for (const ch of word) result = state.type(ch, nextSeq());
  return result.action;
}

test('third tutorial ore stays hidden before processing and returns after rejection', () => {
  const game = new Tutorial();
  const state = new TypingState('p1');
  let seq = 0;
  const frame = (processed) => ({ ...game.snapshot(), processed: { p1: processed } });
  state.receive(frame(0));
  const ores = [...state.view.snap.players.p1.ores];
  const actions = ores.slice(0, 3).map((ore) => typeWord(state, ore.word, () => ++seq));
  assert.equal(state.view.snap.players.p1.ores.some((o) => o.id === ores[2].id), false);
  state.receive(frame(0));
  assert.equal(state.view.snap.players.p1.ores.some((o) => o.id === ores[2].id), false);
  for (const action of actions) game.apply('p1', action);
  state.receive(frame(seq));
  assert.equal(state.view.snap.tutorial.id, 'send');
  assert.equal(state.view.snap.players.p1.ores.some((o) => o.id === ores[2].id), true);
  assert.equal(state.view.lock, null);
});

import { Game } from '../server/game.js';
import { Room } from '../server/room.js';

function setupFight(type = 'knight') {
  const game = new Game();
  game.setMode('p1', 'fight');
  const mob = game.spawnMob('p2', type, 350);
  const state = new TypingState('p1');
  state.receive({ ...game.snapshot(), processed: { p1: 0 } });
  return { game, mob, state };
}

test('rapid armored words reconcile partial acceptance and emit kill feedback once', () => {
  const { game, mob, state } = setupFight();
  let seq = 0;
  const first = typeWord(state, mob.words[0], () => ++seq);
  const firstSeq = seq;
  assert.equal(state.view.lock.wi, 1);
  state.receive({ ...game.snapshot(), processed: { p1: 0 } });
  assert.equal(state.view.snap.mobs[0].wi, 1);
  const second = typeWord(state, mob.words[1], () => ++seq);
  assert.equal(state.view.snap.mobs.length, 0);
  game.hitMob('p1', first.id, first.wi);
  state.receive({ ...game.snapshot(), processed: { p1: firstSeq } });
  assert.equal(state.view.snap.mobs.length, 0);
  game.hitMob('p1', second.id, second.wi);
  const view = state.receive({ ...game.snapshot(), processed: { p1: seq } });
  assert.equal(view.snap.mobs.length, 0);
  assert.equal(view.snap.events.find((e) => e.e === 'kill').predicted, true);
  assert.equal(view.lock, null);
});

test('Lightning advances the authoritative word and invalidates partial typing', () => {
  const { game, mob, state } = setupFight('giant');
  state.type(mob.words[0][0], 1);
  game.players.p1.ult = 100;
  game.ultimate('p1');
  state.receive({ ...game.snapshot(), processed: { p1: 2 } });
  assert.equal(state.view.lock, null);
  assert.equal(state.view.snap.mobs[0].wi, 1);
  assert.equal(state.view.snap.mobs[0].words[1], mob.words[1]);
});

test('expiry, mob removal and rejected mode changes drop stale locks', () => {
  const game = new Game();
  const state = new TypingState('p1');
  const ore = game.players.p1.ores[0];
  ore.ttl = 0.01;
  state.receive(game.snapshot());
  state.type(ore.word[0], 1);
  game.update(0.02);
  state.receive(game.snapshot());
  assert.equal(state.view.lock, null);
  const mob = game.spawnMob('p2', 'knight');
  game.setMode('p1', 'fight');
  state.receive(game.snapshot());
  state.type(mob.words[0][0], 2);
  game.mobs = [];
  state.receive(game.snapshot());
  assert.equal(state.view.lock, null);
  const tutorial = new Tutorial();
  const lessonState = new TypingState('p1');
  lessonState.receive(tutorial.snapshot());
  lessonState.setMode('fight', 1);
  assert.equal(lessonState.view.mode, 'fight');
  tutorial.apply('p1', { t: 'mode', mode: 'fight' });
  lessonState.receive({ ...tutorial.snapshot(), processed: { p1: 1 } });
  assert.equal(lessonState.view.mode, 'gather');
});

test('target selection prefers nearest matching enemy and diamond ore', () => {
  const { game, mob, state } = setupFight('goblin');
  mob.words = ['apple'];
  const nearer = game.spawnMob('p2', 'goblin', 800);
  nearer.words = ['arrow'];
  state.receive(game.snapshot());
  assert.equal(state.type('a', 1).lock.id, nearer.id);
  state.drop();
  game.setMode('p1', 'gather');
  game.players.p1.ores = [
    { id: 100, word: 'apple' }, { id: 101, word: 'arrow', golden: true },
    { id: 102, word: 'alive', diamond: true },
  ];
  state.receive(game.snapshot());
  assert.equal(state.type('a', 2).lock.id, 102);
  assert.equal(state.type('z', 3).feedback, 'miss');
  assert.equal(state.view.snap.players.p1.combo, 0);
});

test('Room delivers processed rejection with its authoritative snapshot', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const messages = [];
  const ws = { OPEN: 1, readyState: 1, send: (data) => messages.push(JSON.parse(data)) };
  const room = new Room('TEST', { tutorial: true }, () => {});
  t.after(() => room.destroy());
  room.join(ws, 'Test');
  for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
  const state = new TypingState('p1');
  state.receive(room.snapshot());
  const ores = [...room.game.players.p1.ores];
  let seq = 0;
  const actions = ores.slice(0, 3).map((ore) => typeWord(state, ore.word, () => ++seq));
  t.mock.timers.tick(50);
  state.receive(messages.filter((m) => m.t === 'state').at(-1));
  assert.equal(state.view.snap.players.p1.ores.some((o) => o.id === ores[2].id), false);
  for (const action of actions) room.handle(ws, action);
  t.mock.timers.tick(50);
  const frame = messages.filter((m) => m.t === 'state').at(-1);
  assert.equal(frame.processed.p1, seq);
  state.receive(frame);
  assert.equal(state.view.snap.players.p1.ores.some((o) => o.id === ores[2].id), true);
});

test('input before the first frame is harmless', () => {
  const state = new TypingState('p1');
  assert.equal(state.setMode('fight', 1), null);
  assert.deepEqual(state.type('a', 2), {});
});
