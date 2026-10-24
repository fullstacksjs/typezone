import { lessonAt, tutorialPolicy } from '../shared/tutorial-policy.js';
import { Game } from './game.js';
import { FrozenClock } from './match/clock.js';
import { runCommand } from './match/commands.js';
import { PICKAXE } from '../shared/shop.js';
import { ULT_MAX } from '../shared/config.js';

const HOLD_LINE = 450; // enemies stop before reaching the learner's base

/**
 * What finishes each lesson, and what the next lesson needs set up. `passed`
 * sees the action and the real match's result, so progress follows accepted
 * commands, never Game's internal statistics.
 */
const SCRIPT = {
  mine: { passed: (action, result, tutorial) => action.t === 'gather' && result && ++tutorial.mined === 2 },
  send: {
    passed: (action, result) => action.t === 'buy' && result,
    next: (game) => game.spawnMob('p2', 'goblin', 350, 1),
  },
  switch: { passed: (action, result) => action.t === 'mode' && result },
  defend: {
    passed: (action, result) => action.t === 'hit' && result === 'kill',
    next: (game) => {
      game.players.p1.ult = ULT_MAX;
      game.spawnMob('p2', 'goblin', 350, 0);
      game.spawnMob('p2', 'goblin', 400, 2);
    },
  },
  lightning: {
    passed: (action, result) => action.t === 'ult' && result,
    next: (game) => {
      const p = game.players.p1;
      p.gold = Math.max(p.gold, PICKAXE.cost(p));
    },
  },
  upgrade: { passed: (action, result) => action.t === 'buy' && result },
};

/**
 * A private, action-driven lesson. It decorates a normal Game configured with
 * tutorial collaborators: a frozen clock, no crates and a hold line for enemies.
 * Each action passes the lesson policy, runs on the real match through the
 * shared command table, and the lesson script advances from the result.
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

  // ---------------------------------------------------------------- commands
  /** Runs a permitted wire action on the match. Denied actions return false. */
  apply(slot, action) {
    if (!this.allows(slot, action)) return false;
    const result = runCommand(this.game, slot, action);
    const lesson = SCRIPT[this.lesson.id];
    if (lesson?.passed(action, result, this)) {
      this.step++;
      lesson.next?.(this.game);
    }
    return result;
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
