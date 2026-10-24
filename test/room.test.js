import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Room } from '../server/room.js';

function setup(t, options = { tutorial: true }) {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const messages = [];
  const ws = { OPEN: 1, readyState: 1, send: (data) => messages.push(JSON.parse(data)) };
  let removed = false;
  const room = new Room('TEST', options, () => { removed = true; });
  t.after(() => room.destroy());
  room.join(ws, 'Test');
  return { room, ws, messages, removed: () => removed };
}
function start(t) {
  for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
}

test('leaving during countdown cancels the old room', (t) => {
  const { room, ws, messages, removed } = setup(t);
  room.leave(ws);
  start(t);
  assert.equal(removed(), true);
  assert.equal(messages.some((m) => m.t === 'start'), false);
  assert.equal(room.game, null);
});

test('disconnect during a lesson stops snapshot delivery and releases the room', (t) => {
  const { room, ws, messages, removed } = setup(t);
  start(t);
  t.mock.timers.tick(50);
  assert.equal(messages.at(-1).tutorial.id, 'mine');
  room.leave(ws);
  const count = messages.length;
  t.mock.timers.tick(10000);
  assert.equal(messages.length, count);
  assert.equal(removed(), true);
});

test('completed tutorial stays on battlefield and practice starts without restrictions', (t) => {
  const { room, ws, messages, removed } = setup(t);
  start(t);
  let seq = 0;
  const send = (action) => room.handle(ws, { ...action, seq: ++seq });
  for (let i = 0; i < 2; i++) send({ t: 'gather', id: room.game.players.p1.ores[0].id });
  send({ t: 'buy', item: 'goblin' });
  send({ t: 'mode', mode: 'fight' });
  send({ t: 'hit', id: room.game.mobs.find((m) => m.target === 'p1').id, wi: 0 });
  send({ t: 'ult' });
  send({ t: 'mode', mode: 'gather' });
  send({ t: 'buy', item: 'pickaxe' });
  t.mock.timers.tick(50);
  const final = messages.at(-1);
  assert.equal(final.tutorial.id, 'done');
  assert.equal(final.processed.p1, seq);
  assert.equal(room.state, 'playing');
  assert.equal(messages.some((m) => m.t === 'end'), false);
  t.mock.timers.tick(50);
  assert.equal(messages.at(-1).tutorial.id, 'done', 'completion keeps broadcast cadence');
  room.leave(ws);
  assert.equal(removed(), true);
  const count = messages.length;
  const practice = new Room('NEXT', { bot: 'easy' }, () => {});
  t.after(() => practice.destroy());
  practice.join(ws, 'Test');
  start(t);
  assert.equal(practice.game.snapshot().tutorial, undefined);
  assert.equal(practice.snapshot().processed.p1, 0);
  practice.handle(ws, { t: 'mode', mode: 'fight', seq: 1 });
  assert.equal(practice.game.players.p1.mode, 'fight');
  assert.equal(room.game.lesson.id, 'done');
  assert.ok(messages.length > count);
});
