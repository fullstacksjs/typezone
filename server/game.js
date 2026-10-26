import { purchase, offerOf } from '../shared/shop.js';
import { itemUse, applyItem } from '../shared/items.js';
import { PASSIVE_INCOME, PRESSURE_INCOME, SUDDEN_DEATH_DPS, ULT_MAX, AIRDROP } from '../shared/config.js';
import { IdSequence } from './match/ids.js';
import { EventLog } from './match/events.js';
import { MatchClock } from './match/clock.js';
import { Player } from './match/player.js';
import { Mine } from './match/mine.js';
import { Battlefield } from './match/battlefield.js';
import { AirdropSupply } from './match/airdrops.js';
import { runCommand } from './match/commands.js';

const SLOTS = ['p1', 'p2'];
const other = (slot) => (slot === 'p1' ? 'p2' : 'p1');

/** A viewer's copy of a snapshot: the opponent's items and claims keep their contents hidden. */
export function redact(snapshot, viewer) {
  const foe = other(viewer);
  const hide = (item) => ({ id: item.id, type: null });
  return {
    ...snapshot,
    players: { ...snapshot.players, [foe]: { ...snapshot.players[foe], items: snapshot.players[foe].items.map(hide) } },
    events: snapshot.events.map((e) => (e.e === 'claim' && e.slot === foe ? { ...e, item: hide(e.item) } : e)),
  };
}

/**
 * Authoritative match simulation. Clients report completed words; the game
 * validates them against its own state and advances the world every tick.
 *
 * Game composes the match from systems that each own one mechanic: the clock,
 * the mine, the battlefield and the airdrop supply. Options swap collaborators
 * for variants such as the tutorial: `Clock` builds the clock, `firstDrop` schedules
 * the first crate, and `halted(mob)` stops a mob in place.
 */
export class Game {
  constructor({ Clock = MatchClock, firstDrop = AIRDROP.first, halted } = {}) {
    const ids = new IdSequence();
    this.log = new EventLog();
    this.winner = null;
    this.players = { p1: new Player(), p2: new Player() };
    this.clock = new Clock(this.log);
    this.mine = new Mine({ ids, events: this.log });
    this.supply = new AirdropSupply({
      ids,
      events: this.log,
      first: firstDrop,
      reserved: () => ({ words: this.field.words(), active: this.field.activeWords() }),
    });
    this.field = new Battlefield({
      ids, events: this.log, players: this.players, clock: this.clock, halted, reserved: () => this.supply.words(),
    });
    for (const slot of SLOTS) this.mine.fill(this.players[slot]);
  }

  // ---------------------------------------------------------------- state views
  get time() { return this.clock.time; }

  set time(value) { this.clock.time = value; }

  get overtime() { return this.clock.overtime; }

  get mobs() { return this.field.mobs; }

  set mobs(mobs) { this.field.mobs = mobs; }

  get airdrop() { return this.supply.crate; }

  get nextDrop() { return this.supply.nextDrop; }

  get events() { return this.log.pending; }

  get ended() { return !!this.winner; }

  opponentOf(slot) { return this.players[other(slot)]; }

  emit(e) { this.log.emit(e); }

  // ---------------------------------------------------------------- commands
  /** Runs a wire action (`{ t, ... }`) through the command table. */
  apply(slot, action) { return runCommand(this, slot, action); }

  // ---------------------------------------------------------------- gather
  addOre(slot, allowRare = true) { this.mine.add(this.players[slot], allowRare); }

  gather(slot, oreId) {
    const p = this.players[slot];
    if (this.ended || p.mode !== 'gather') return false;
    return this.mine.gather(slot, p, oreId);
  }

  // ---------------------------------------------------------------- fight
  spawnMob(owner, type, at = 0) { return this.field.spawn(owner, type, at); }

  progress(slot, mobId, wi, typed) { this.field.progress(slot, mobId, wi, typed); }

  /** Defender finished word `wi` of a mob heading at their base. Returns 'armor', 'kill' or null. */
  hitMob(slot, mobId, wi) {
    const p = this.players[slot];
    if (this.ended || p.mode !== 'fight') return null;
    const mob = this.field.targetable(slot, mobId, wi);
    if (!mob) return null;
    p.typed(mob.words[wi]);
    return this.field.breakWord(slot, mob, 'type');
  }

  breakWord(slot, mob, cause) { return this.field.breakWord(slot, mob, cause); }

  miss(slot) { this.players[slot].miss(); }

  setMode(slot, mode) {
    if (mode !== 'gather' && mode !== 'fight') return false;
    this.players[slot].mode = mode;
    if (mode !== 'fight') this.supply.leftFight(slot);
    return true;
  }

  ultimate(slot) {
    const p = this.players[slot];
    if (this.ended || p.ult < ULT_MAX) return false;
    p.ult = 0;
    this.field.strike(slot);
    return true;
  }

  absX(mob) { return this.field.absX(mob); }

  speedOf(mob) { return this.field.speedOf(mob); }

  // ---------------------------------------------------------------- airdrops
  spawnAirdrop() { this.supply.drop(); }

  claimProgress(slot, id, typed) { this.supply.progress(slot, this.players[slot], id, typed); }

  claim(slot, id) {
    if (this.ended) return false;
    return this.supply.claim(slot, this.players[slot], id);
  }

  useItem(slot, id) {
    const p = this.players[slot];
    if (!itemUse(p, id, { ended: this.ended, suddenDeath: this.clock.suddenDeath }).available) return false;
    const item = applyItem(p, id);
    this.emit({ e: 'item', slot, type: item.type });
    return true;
  }

  // ---------------------------------------------------------------- shop
  buy(slot, item) {
    const p = this.players[slot];
    if (!purchase(p, item, { ended: this.ended }).available) return false;
    const offer = offerOf(item);
    offer.predict(p);
    offer.resolve(this, slot);
    return true;
  }

  /** Offer effect: a purchased mob marches at the opponent. */
  sendMob(slot, type) {
    this.players[slot].stats.mobsSent++;
    this.field.spawn(slot, type);
    this.emit({ e: 'send', slot, type });
  }

  /** Offer effect: announces a spell or upgrade. */
  castSpell(slot, spell) {
    this.players[slot].stats.spells++;
    this.emit({ e: 'spell', slot, spell });
  }

  // ---------------------------------------------------------------- tick
  update(dt) {
    if (this.ended) return;
    this.clock.advance(dt);
    const { suddenDeath } = this.clock;

    for (const slot of SLOTS) {
      const p = this.players[slot];
      const pressure = this.field.pressured(slot) ? PRESSURE_INCOME : 1;
      p.gold += PASSIVE_INCOME * dt * this.clock.incomeMultiplier * pressure;
      p.tick(dt);
      if (suddenDeath) p.crumble(SUDDEN_DEATH_DPS * dt);
      this.mine.tick(p, dt);
    }

    this.supply.tick(dt, { suddenDeath });
    this.field.advance(dt);
    this.decide();
  }

  decide() {
    const { p1, p2 } = this.players;
    if (p1.hp <= 0 && p2.hp <= 0) this.winner = p1.hp === p2.hp ? (Math.random() < 0.5 ? 'p1' : 'p2') : p1.hp > p2.hp ? 'p1' : 'p2';
    else if (p1.hp <= 0) this.winner = 'p2';
    else if (p2.hp <= 0) this.winner = 'p1';
  }

  forfeit(slot) {
    if (!this.winner) this.winner = other(slot);
  }

  // ---------------------------------------------------------------- output
  snapshot() {
    const players = Object.fromEntries(SLOTS.map((slot) => [
      slot, this.players[slot].snapshot({ pressured: this.field.pressured(slot) }),
    ]));
    return {
      winner: this.winner,
      time: +this.time.toFixed(2),
      overtime: this.overtime,
      suddenDeath: this.clock.suddenDeath,
      players,
      mobs: this.field.snapshot(),
      airdrop: this.supply.snapshot(),
      events: this.log.drain(),
    };
  }

  summary() {
    const stats = Object.fromEntries(SLOTS.map((slot) => [slot, this.players[slot].summary(this.time)]));
    return { winner: this.winner, time: Math.round(this.time), stats };
  }
}
