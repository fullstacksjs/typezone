import { Game } from './game.js';
import { SPELLS, ULT_MAX } from '../shared/config.js';

const STEPS = [
  { id: 'mine', title: 'Type an ore word', key: 'A–Z' },
  { id: 'send', title: 'Send a goblin', key: '1', item: 'goblin', cue: 'Send' },
  { id: 'switch', title: 'Switch to Fight', key: 'Tab', focus: 'mode-key', cue: 'Fight' },
  { id: 'defend', title: 'Type the enemy word', key: 'A–Z' },
  { id: 'lightning', title: 'Fire Lightning', key: 'Enter', focus: 'ult', cue: 'Fire' },
  { id: 'upgrade', title: 'Upgrade your Pickaxe', key: '8', item: 'pickaxe', cue: '+25% gold' },
  { id: 'done', title: 'You are ready to play' },
];

/** A private, action-driven lesson using the normal match simulation. */
export class Tutorial extends Game {
  constructor() {
    super();
    this.step = 0;
    this.mined = 0;
  }

  get lesson() { return STEPS[this.step]; }

  gather(slot, id) {
    if (slot !== 'p1' || this.lesson.id !== 'mine') return;
    const before = this.players.p1.stats.chars;
    super.gather(slot, id);
    if (this.players.p1.stats.chars > before && ++this.mined === 2) this.step++;
  }

  buy(slot, item) {
    if (slot !== 'p1' || item !== this.lesson.item) return false;
    if (this.lesson.id === 'upgrade' && this.players.p1.mode !== 'gather') return false;
    if (!super.buy(slot, item)) return false;
    this.step++;
    if (item === 'goblin') this.spawnMob('p2', 'goblin', 350, 1);
    return true;
  }

  setMode(slot, mode) {
    if (slot !== 'p1') return;
    const expected = this.lesson.id === 'switch' ? 'fight' : this.lesson.id === 'upgrade' ? 'gather' : null;
    if (mode !== expected) return;
    super.setMode(slot, mode);
    if (this.lesson.id === 'switch') this.step++;
  }

  hitMob(slot, id, wi) {
    if (slot !== 'p1' || this.lesson.id !== 'defend') return;
    const before = this.players.p1.stats.mobsKilled;
    super.hitMob(slot, id, wi);
    if (this.players.p1.stats.mobsKilled === before) return;
    this.step++;
    this.players.p1.ult = ULT_MAX;
    this.spawnMob('p2', 'goblin', 350, 0);
    this.spawnMob('p2', 'goblin', 400, 2);
  }

  ultimate(slot) {
    if (slot !== 'p1' || this.lesson.id !== 'lightning' || this.players.p1.ult < ULT_MAX) return;
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
    if (this.lesson.id !== 'done') super.update(dt);
  }

  snapshot() {
    return { ...super.snapshot(), tutorial: {
      ...this.lesson, step: this.step + 1, total: STEPS.length - 1, mined: this.mined,
    } };
  }
}
