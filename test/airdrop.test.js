import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, redact } from '../server/game.js';
import { Tutorial } from '../server/tutorial.js';
import { Bot } from '../server/bot.js';
import { Room } from '../server/room.js';
import { TypingState } from '../public/js/typing-state.js';
import { ShopPrediction } from '../public/js/shop-state.js';
import { AIRDROP, ITEM_SLOTS, ITEMS, BASE_HP, SUDDEN_DEATH_AT } from '../shared/config.js';

function dropped() {
  const g = new Game();
  g.update(AIRDROP.first);
  g.setMode('p1', 'fight');
  g.setMode('p2', 'fight');
  return g;
}

test('a crate falls at the scheduled time and its contents never reach a snapshot', () => {
  const g = new Game();
  g.update(AIRDROP.first - 1);
  assert.equal(g.snapshot().airdrop, null);
  g.update(1);
  const snap = g.snapshot();
  assert.ok(snap.airdrop.word.length >= AIRDROP.len[0]);
  assert.ok(Object.hasOwn(ITEMS, g.airdrop.item));
  assert.equal(JSON.stringify(snap).includes(`"${g.airdrop.item}"`), false);
  assert.deepEqual(snap.events.map((e) => e.e), ['airdrop']);
});

test('an unclaimed crate is lost after its fall time and the next one is scheduled', () => {
  const g = dropped();
  g.snapshot();
  g.update(AIRDROP.fall);
  const snap = g.snapshot();
  assert.equal(snap.airdrop, null);
  assert.ok(snap.events.some((e) => e.e === 'airdropLost'));
  assert.ok(g.nextDrop >= AIRDROP.interval[0] && g.nextDrop <= AIRDROP.interval[1]);
});

test('the first claim wins the race and the loser is rejected', () => {
  const g = dropped();
  const { id, word } = g.airdrop;
  g.claimProgress('p1', id, word.length - 1);
  assert.equal(g.claim('p2', id), true);
  assert.equal(g.claim('p1', id), false);
  assert.equal(g.players.p1.items.length, 0);
  assert.equal(g.players.p2.items.length, 1);
  assert.equal(g.players.p2.stats.airdrops, 1);
  assert.equal(g.airdrop, null);
});

test('claiming requires Fight mode and a free slot', () => {
  const g = dropped();
  const { id } = g.airdrop;
  g.setMode('p1', 'gather');
  assert.equal(g.claim('p1', id), false);
  g.setMode('p1', 'fight');
  g.players.p1.items = Array.from({ length: ITEM_SLOTS }, (_, i) => ({ id: 900 + i, type: 'heal' }));
  assert.equal(g.claim('p1', id), false);
  assert.equal(g.claim('p2', id), true);
});

test('only the winner learns what was inside', () => {
  const g = dropped();
  g.snapshot();
  const type = g.airdrop.item;
  g.claim('p2', g.airdrop.id);
  const snap = g.snapshot();
  const theirs = redact(snap, 'p1');
  assert.equal(theirs.players.p2.items[0].type, null);
  assert.equal(theirs.events.find((e) => e.e === 'claim').item.type, null);
  assert.equal(JSON.stringify(theirs).includes(`"${type}"`), false);
  const mine = redact(snap, 'p2');
  assert.equal(mine.players.p2.items[0].type, type);
  assert.equal(mine.events.find((e) => e.e === 'claim').item.type, type);
});

test('room sends each seat its own redacted state', (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const seat = () => {
    const messages = [];
    return { messages, ws: { OPEN: 1, readyState: 1, send: (data) => messages.push(JSON.parse(data)) } };
  };
  const a = seat();
  const b = seat();
  const room = new Room('TEST', {}, () => {});
  t.after(() => room.destroy());
  room.join(a.ws, 'A');
  room.join(b.ws, 'B');
  for (let i = 0; i < 3; i++) t.mock.timers.tick(1000);
  room.game.players.p1.items.push({ id: 900, type: 'heal' });
  t.mock.timers.tick(50);
  const last = (s) => s.messages.filter((m) => m.t === 'state').at(-1);
  assert.equal(last(a).players.p1.items[0].type, 'heal');
  assert.equal(last(b).players.p1.items[0].type, null);
});

test('no crates fall in a lesson or during sudden death', () => {
  const lesson = new Tutorial();
  lesson.update(AIRDROP.first + 1);
  assert.equal(lesson.airdrop, null);
  const g = new Game();
  g.time = SUDDEN_DEATH_AT;
  g.update(AIRDROP.first + 1);
  assert.equal(g.airdrop, null);
});

test('typing the crate word predicts a claim and a lost race releases the lock', () => {
  const g = dropped();
  const state = new TypingState('p1');
  state.receive({ ...g.snapshot(), processed: { p1: 0 } });
  const { id, word } = g.airdrop;
  let seq = 0;
  const first = state.type(word[0], ++seq);
  assert.deepEqual(first.action, { t: 'dropProgress', id, typed: 1, seq: 1 });
  assert.equal(state.view.lock.kind, 'drop');
  g.claim('p2', id);
  state.receive({ ...g.snapshot(), processed: { p1: 0 } });
  assert.equal(state.view.lock, null);
  assert.equal(state.view.snap.airdrop, null);
});

test('a completed crate word sends a claim and hides the crate until processed', () => {
  const g = dropped();
  const state = new TypingState('p1');
  state.receive({ ...g.snapshot(), processed: { p1: 0 } });
  const { id, word } = g.airdrop;
  let result;
  let seq = 0;
  for (const ch of word) result = state.type(ch, ++seq);
  assert.deepEqual(result.action, { t: 'claim', id, wi: 0, seq });
  assert.equal(result.feedback, 'claim');
  state.receive({ ...g.snapshot(), processed: { p1: 0 } });
  assert.equal(state.view.snap.airdrop, null, 'an earlier frame keeps the prediction');
  g.claim('p1', id);
  state.receive({ ...g.snapshot(), processed: { p1: seq } });
  assert.equal(state.view.snap.players.p1.items.length, 1);
});

test('the crate word is not a target from Gather mode', () => {
  const g = dropped();
  g.setMode('p1', 'gather');
  const state = new TypingState('p1');
  state.receive({ ...g.snapshot(), processed: { p1: 0 } });
  const target = state.target(g.airdrop.word[0]);
  assert.notEqual(target?.kind, 'drop');
});

test('using Heal is predicted and reconciles once processed', () => {
  const g = new Game();
  const p = g.players.p1;
  p.hp = 50;
  p.items.push({ id: 900, type: 'heal' });
  const shop = new ShopPrediction('p1');
  shop.receive({ ...g.snapshot(), processed: { p1: 0 } });
  assert.ok(shop.use(900, 1));
  assert.equal(shop.player.hp, 50 + ITEMS.heal.amount);
  assert.equal(shop.player.items.length, 0);
  assert.equal(shop.use(900, 2), false);
  shop.receive({ ...g.snapshot(), processed: { p1: 0 } });
  assert.equal(shop.player.hp, 50 + ITEMS.heal.amount);
  g.useItem('p1', 900);
  shop.receive({ ...g.snapshot(), processed: { p1: 1 } });
  assert.equal(shop.player.hp, 50 + ITEMS.heal.amount);
  assert.ok(shop.player.hp <= BASE_HP);
});

test('the bot leaves the mine to race for a crate and heals when hurt', () => {
  const g = new Game();
  const bot = new Bot(g, 'p2', 'hard');
  g.update(AIRDROP.first);
  for (let i = 0; i < 400 && g.airdrop; i++) {
    bot.update(0.05);
    g.update(0.05);
  }
  assert.equal(g.players.p2.items.length, 1);
  g.players.p2.hp = 30;
  bot.shopTimer = 0;
  bot.update(0.05);
  assert.equal(g.players.p2.items.length, 0);
  assert.equal(g.players.p2.hp, 30 + ITEMS.heal.amount);
});
