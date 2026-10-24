import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../server/game.js';
import { ShopPrediction } from '../public/js/shop-state.js';

test('rapid Pickaxe purchases predict cumulative prices and reconcile once', () => {
  const game = new Game();
  game.players.p1.gold = 200;
  const shop = new ShopPrediction('p1');
  shop.receive({ ...game.snapshot(), processed: { p1: 0 } });
  assert.ok(shop.buy('pickaxe', 1));
  assert.ok(shop.buy('pickaxe', 2));
  assert.equal(shop.player.gold, 90);
  assert.equal(shop.player.pickaxe, 2);
  shop.receive({ ...game.snapshot(), processed: { p1: 0 } });
  assert.equal(shop.player.gold, 90, 'an earlier frame retains both predictions');
  game.buy('p1', 'pickaxe');
  game.buy('p1', 'pickaxe');
  shop.receive({ ...game.snapshot(), processed: { p1: 2 } });
  assert.equal(shop.player.gold, 90);
  assert.equal(shop.player.pickaxe, 2);
});

import { Bot } from '../server/bot.js';
import { SUDDEN_DEATH_AT } from '../shared/config.js';

test('bot keeps a forbidden Heal in sudden death and makes a useful purchase', (t) => {
  t.mock.method(Math, 'random', () => 0);
  const game = new Game();
  game.time = SUDDEN_DEATH_AT;
  Object.assign(game.players.p1, { hp: 20, gold: 200, pickaxe: 4, luck: 3, drill: 3, items: [{ id: 900, type: 'heal' }] });
  new Bot(game, 'p1').shop([]);
  assert.equal(game.players.p2.fog, 7);
  assert.equal(game.players.p1.items.length, 1);
});

import { purchase } from '../shared/shop.js';
import { Room } from '../server/room.js';

test('pending purchases enforce the next price and upgrade cap', () => {
  for (const [gold, level] of [[100, 0], [500, 3]]) {
    const game = new Game();
    Object.assign(game.players.p1, { gold, pickaxe: level });
    const shop = new ShopPrediction('p1');
    shop.receive(game.snapshot());
    assert.ok(shop.buy('pickaxe', 1));
    assert.equal(shop.buy('pickaxe', 2), false);
  }
});

test('all callers share charge, cooldown, health, end and tutorial legality', () => {
  const game = new Game();
  const p = game.players.p1;
  p.gold = 1000;
  for (const item of ['unknown', 'slimelet', 'constructor', '__proto__']) {
    assert.equal(purchase(p, item).available, false);
    assert.equal(game.buy('p1', item), false);
  }
  p.hp = 50;
  assert.equal(purchase(p, 'repair').available, false);
  assert.ok(game.buy('p1', 'frost'));
  assert.equal(purchase(p, 'frost').available, false);
  p.charges.goblin.n = 0;
  assert.equal(purchase(p, 'goblin').available, false);
  assert.equal(purchase(p, 'fog', { ended: true }).available, false);
  assert.equal(purchase(p, 'pickaxe', { tutorial: { id: 'send', item: 'goblin' } }).available, false);
  p.mode = 'fight';
  assert.equal(purchase(p, 'pickaxe', { tutorial: { id: 'upgrade', item: 'pickaxe' } }).available, false);
});

test('Room watermark resolves accepted and rejected shop predictions', () => {
  const room = new Room('TEST', {}, () => {});
  const ws = { OPEN: 1, readyState: 1, send() {} };
  room.seats.p1 = { ws, name: 'Test' };
  room.state = 'playing';
  room.game = new Game();
  room.game.players.p1.gold = 200;
  const shop = new ShopPrediction('p1');
  shop.receive(room.snapshot());
  assert.ok(shop.buy('pickaxe', 1));
  room.handle(ws, { t: 'buy', item: 'pickaxe', seq: 1 });
  shop.receive(room.snapshot());
  assert.equal(shop.player.gold, 160);
  assert.equal(shop.player.pickaxe, 1);
  assert.ok(shop.buy('pickaxe', 2));
  room.game.players.p1.gold = 0;
  room.handle(ws, { t: 'buy', item: 'pickaxe', seq: 2 });
  shop.receive(room.snapshot());
  assert.equal(shop.player.gold, 0);
  assert.equal(shop.player.pickaxe, 1);
  room.handle(ws, { t: 'buy', item: 'pickaxe', seq: 1 });
  assert.equal(room.snapshot().processed.p1, 2);
});

test('an earlier Fight frame retains a purchase made after predicted Gather', () => {
  const game = new Game();
  Object.assign(game.players.p1, { gold: 100, mode: 'fight' });
  const frame = { ...game.snapshot(), tutorial: { id: 'upgrade', item: 'pickaxe' }, processed: { p1: 0 } };
  const shop = new ShopPrediction('p1');
  shop.receive(frame);
  assert.ok(shop.buy('pickaxe', 2, 'gather'));
  shop.receive(frame);
  assert.equal(shop.player.gold, 60);
  assert.equal(shop.player.pickaxe, 1);
});

test('bot keeps saving for a charged expensive mob when funds are short', (t) => {
  t.mock.method(Math, 'random', () => 0.9);
  const game = new Game();
  game.players.p1.gold = 20;
  const bot = new Bot(game, 'p1');
  bot.saveFor = 'giant';
  bot.shop([]);
  assert.equal(game.players.p1.gold, 20);
  assert.equal(bot.saveFor, 'giant');
});
