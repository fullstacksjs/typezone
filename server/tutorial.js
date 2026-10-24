import { lessonAt, tutorialPolicy } from '../shared/tutorial-policy.js';
import { Game } from './game.js';
import { SPELLS, ULT_MAX } from '../shared/config.js';

/** A private, action-driven lesson using the normal match simulation. */
export class Tutorial extends Game {
  constructor() {
    super();
    this.step = 0;
    this.mined = 0;
  }

  get lesson() { return lessonAt(this.step); }

  allows(slot, action) {
    return tutorialPolicy(this.lesson, this.players[slot].mode, slot).allows(action);
  }

  progress(slot, id, wi, typed) {
    if (this.allows(slot, { t: 'progress' })) super.progress(slot, id, wi, typed);
  }

  miss(slot) {
    if (this.allows(slot, { t: 'miss' })) super.miss(slot);
  }

  gather(slot, id) {
    if (!this.allows(slot, { t: 'gather' })) return;
    const before = this.players.p1.stats.chars;
    super.gather(slot, id);
    if (this.players.p1.stats.chars > before && ++this.mined === 2) this.step++;
  }

  buy(slot, item) {
    if (!this.allows(slot, { t: 'buy', item })) return false;
    if (!super.buy(slot, item)) return false;
    this.step++;
    if (item === 'goblin') this.spawnMob('p2', 'goblin', 350, 1);
    return true;
  }

  setMode(slot, mode) {
    if (!this.allows(slot, { t: 'mode', mode })) return;
    super.setMode(slot, mode);
    if (this.lesson.id === 'switch') this.step++;
  }

  hitMob(slot, id, wi) {
    if (!this.allows(slot, { t: 'hit' })) return;
    const before = this.players.p1.stats.mobsKilled;
    super.hitMob(slot, id, wi);
    if (this.players.p1.stats.mobsKilled === before) return;
    this.step++;
    this.players.p1.ult = ULT_MAX;
    this.spawnMob('p2', 'goblin', 350, 0);
    this.spawnMob('p2', 'goblin', 400, 2);
  }

  ultimate(slot) {
    if (!this.allows(slot, { t: 'ult' }) || this.players.p1.ult < ULT_MAX) return;
    super.ultimate(slot);
    this.step++;
    this.players.p1.gold = Math.max(this.players.p1.gold, SPELLS.pickaxe.costs[0]);
  }

  speedOf(mob) {
    if (mob.target === 'p1' && mob.d >= 450) return 0;
    return super.speedOf(mob);
  }

  update(dt) {
    // Lessons have no overtime or time limit.
    this.time = 0;
    if (!tutorialPolicy(this.lesson, this.players.p1.mode).complete) super.update(dt);
  }

  snapshot() {
    return { ...super.snapshot(), tutorial: {
      ...this.lesson, mined: this.mined,
    } };
  }
}
