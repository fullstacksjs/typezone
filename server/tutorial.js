import { lessonAt, tutorialPolicy } from '../shared/tutorial-policy.js';
import { Game } from './game.js';
import { FrozenClock } from './match/clock.js';
import { PICKAXE } from '../shared/shop.js';
import { ULT_MAX } from '../shared/config.js';

const HOLD_LINE = 450; // enemies stop before reaching the learner's base

/**
 * A private, action-driven lesson. It decorates a normal Game configured with
 * tutorial collaborators: a frozen clock, no crates and a hold line for enemies.
 * Each command passes the lesson policy, runs on the real match, and advances the
 * lesson from the command's result.
 */
export class Tutorial {
  constructor() {
    this.game = new Game({
      Clock: FrozenClock,
      firstDrop: Infinity,
      halted: (mob) => mob.target === 'p1' && mob.d >= HOLD_LINE,
    });
    this.step = 0;
    this.mined = 0;
  }

  get lesson() { return lessonAt(this.step); }

  get complete() { return tutorialPolicy(this.lesson, this.players.p1.mode).complete; }

  allows(slot, action) {
    return tutorialPolicy(this.lesson, this.players[slot].mode, slot).allows(action);
  }

  // ---------------------------------------------------------------- match views
  get players() { return this.game.players; }

  get mobs() { return this.game.mobs; }

  get airdrop() { return this.game.airdrop; }

  get time() { return this.game.time; }

  get overtime() { return this.game.overtime; }

  get winner() { return this.game.winner; }

  speedOf(mob) { return this.game.speedOf(mob); }

  spawnMob(...args) { return this.game.spawnMob(...args); }

  // ---------------------------------------------------------------- commands
  progress(slot, id, wi, typed) {
    if (this.allows(slot, { t: 'progress' })) this.game.progress(slot, id, wi, typed);
  }

  miss(slot) {
    if (this.allows(slot, { t: 'miss' })) this.game.miss(slot);
  }

  gather(slot, id) {
    if (!this.allows(slot, { t: 'gather' }) || !this.game.gather(slot, id)) return false;
    if (++this.mined === 2) this.step++;
    return true;
  }

  buy(slot, item) {
    if (!this.allows(slot, { t: 'buy', item }) || !this.game.buy(slot, item)) return false;
    this.step++;
    if (item === 'goblin') this.game.spawnMob('p2', 'goblin', 350, 1);
    return true;
  }

  setMode(slot, mode) {
    if (!this.allows(slot, { t: 'mode', mode }) || !this.game.setMode(slot, mode)) return false;
    if (this.lesson.id === 'switch') this.step++;
    return true;
  }

  hitMob(slot, id, wi) {
    if (!this.allows(slot, { t: 'hit' })) return null;
    const result = this.game.hitMob(slot, id, wi);
    if (result !== 'kill') return result;
    this.step++;
    this.players.p1.ult = ULT_MAX;
    this.game.spawnMob('p2', 'goblin', 350, 0);
    this.game.spawnMob('p2', 'goblin', 400, 2);
    return result;
  }

  ultimate(slot) {
    if (!this.allows(slot, { t: 'ult' }) || !this.game.ultimate(slot)) return false;
    this.step++;
    this.players.p1.gold = Math.max(this.players.p1.gold, PICKAXE.cost(this.players.p1));
    return true;
  }

  claimProgress(slot, id, typed) {
    if (this.allows(slot, { t: 'claim' })) this.game.claimProgress(slot, id, typed);
  }

  claim(slot, id) {
    return this.allows(slot, { t: 'claim' }) && this.game.claim(slot, id);
  }

  useItem(slot, id) {
    return this.allows(slot, { t: 'use' }) && this.game.useItem(slot, id);
  }

  // ---------------------------------------------------------------- lifecycle
  update(dt) {
    if (!this.complete) this.game.update(dt);
  }

  forfeit(slot) { this.game.forfeit(slot); }

  snapshot() {
    return { ...this.game.snapshot(), tutorial: { ...this.lesson, mined: this.mined } };
  }

  summary() { return this.game.summary(); }
}
