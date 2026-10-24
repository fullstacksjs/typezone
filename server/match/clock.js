import { OVERTIME_AT, OVERTIME_INCOME, SUDDEN_DEATH_AT, overtimeSpeed } from '../../shared/config.js';

/** Match time and its phases: overtime speeds mobs and doubles income, sudden death crumbles bases. */
export class MatchClock {
  constructor(events) {
    this.events = events;
    this.time = 0;
  }

  get overtime() { return this.time >= OVERTIME_AT; }

  get suddenDeath() { return this.time >= SUDDEN_DEATH_AT; }

  get incomeMultiplier() { return this.overtime ? OVERTIME_INCOME : 1; }

  get speedMultiplier() { return overtimeSpeed(this.time); }

  advance(dt) {
    const before = this.time;
    this.time += dt;
    if (before < OVERTIME_AT && this.time >= OVERTIME_AT) this.events.emit({ e: 'overtime' });
    if (before < SUDDEN_DEATH_AT && this.time >= SUDDEN_DEATH_AT) this.events.emit({ e: 'suddenDeath' });
  }
}

/** A clock that never advances, so a lesson has no overtime or time limit. */
export class FrozenClock extends MatchClock {
  advance() {}
}
