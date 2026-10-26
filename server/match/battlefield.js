import { LANE_LENGTH, MOBS, BOUNTY_SHARE, PRESSURE_MOBS, ULT_PER_KILL, ULT_PER_ARMOR } from '../../shared/config.js';
import { FROST } from '../../shared/shop.js';
import { pickWord } from '../../shared/words.js';

const other = (slot) => (slot === 'p1' ? 'p2' : 'p1');

/**
 * Fight mode: mobs on the roads, their words, movement, kills and base hits.
 * `reserved` supplies words other Fight targets hold; `halted` lets a caller stop mobs in place.
 */
export class Battlefield {
  constructor({ ids, events, players, clock, reserved = () => [], halted = () => false }) {
    this.ids = ids;
    this.events = events;
    this.players = players;
    this.clock = clock;
    this.reserved = reserved;
    this.halted = halted;
    this.mobs = [];
  }

  find(mobId) { return this.mobs.find((m) => m.id === mobId) ?? null; }

  incoming(slot) { return this.mobs.filter((m) => m.target === slot); }

  pressured(slot) { return this.incoming(slot).length >= PRESSURE_MOBS; }

  /** Every word on the field, for targets that must not collide with mobs. */
  words() { return this.mobs.flatMap((m) => m.words); }

  activeWords() { return this.mobs.map((m) => m.words[m.wi]).filter(Boolean); }

  spawn(owner, type, at = 0) {
    const def = MOBS[type];
    const target = other(owner);
    const incoming = this.incoming(target);
    const avoid = new Set(incoming.map((m) => m.words[m.wi]?.[0]));
    const exclude = new Set(incoming.flatMap((m) => m.words));
    for (const word of this.reserved()) {
      avoid.add(word[0]);
      exclude.add(word);
    }
    const words = [];
    for (let i = 0; i < def.words; i++) {
      const w = pickWord(def.len[0], def.len[1], i === 0 ? avoid : new Set(), exclude);
      words.push(w);
      exclude.add(w);
    }
    const mob = {
      id: this.ids.next(), type, owner, target, d: at, words, wi: 0, typed: 0,
    };
    this.mobs.push(mob);
    return mob;
  }

  /** The mob attacking `slot` whose current word is `wi`, or null. */
  targetable(slot, mobId, wi) {
    const mob = this.find(mobId);
    return mob && mob.target === slot && mob.wi === wi ? mob : null;
  }

  progress(slot, mobId, wi, typed) {
    const mob = this.targetable(slot, mobId, wi);
    if (mob) mob.typed = Math.max(0, Math.min(typed | 0, mob.words[wi].length));
  }

  /** Strips the mob's current word for the defender. Returns 'armor' or 'kill'. */
  breakWord(slot, mob, cause) {
    const defender = this.players[slot];
    mob.wi++;
    mob.typed = 0;
    if (mob.wi < mob.words.length) {
      if (cause === 'type') defender.chargeUlt(ULT_PER_ARMOR);
      this.events.emit({ e: 'armor', slot, mobId: mob.id, cause });
      return 'armor';
    }
    const def = MOBS[mob.type];
    this.mobs.splice(this.mobs.indexOf(mob), 1);
    const bounty = Math.round((def.bountyCost ?? def.cost) * BOUNTY_SHARE * defender.rewardMultiplier);
    defender.earn(bounty);
    defender.stats.mobsKilled++;
    if (cause === 'type') defender.chargeUlt(ULT_PER_KILL);
    this.events.emit({ e: 'kill', slot, mobId: mob.id, type: mob.type, x: this.absX(mob), bounty, cause });
    if (def.splits) {
      for (let i = 0; i < def.splits.count; i++) {
        this.spawn(mob.owner, def.splits.into, Math.max(0, mob.d - 20 - i * 25));
      }
    }
    return 'kill';
  }

  /** Lightning: strips one word off every mob attacking `slot`. */
  strike(slot) {
    const struck = this.incoming(slot);
    this.events.emit({ e: 'ult', slot, targets: struck.map((m) => ({ x: this.absX(m) })) });
    for (const mob of struck) this.breakWord(slot, mob, 'ult');
  }

  absX(mob) { return mob.owner === 'p1' ? mob.d : LANE_LENGTH - mob.d; }

  speedOf(mob) {
    if (this.halted(mob)) return 0;
    return MOBS[mob.type].speed * FROST.slow(this.players[mob.target]) * this.clock.speedMultiplier;
  }

  advance(dt) {
    for (const mob of [...this.mobs]) {
      mob.d += this.speedOf(mob) * dt;
      if (mob.d < LANE_LENGTH) continue;
      const dmg = MOBS[mob.type].damage;
      this.players[mob.target].takeHit(dmg);
      this.players[mob.owner].stats.damageDealt += dmg;
      this.mobs.splice(this.mobs.indexOf(mob), 1);
      this.events.emit({ e: 'baseHit', slot: mob.target, dmg, mobId: mob.id });
    }
  }

  snapshot() {
    return this.mobs.map((m) => ({
      id: m.id,
      type: m.type,
      owner: m.owner,
      target: m.target,
      x: +this.absX(m).toFixed(1),
      vx: +((m.owner === 'p1' ? 1 : -1) * this.speedOf(m)).toFixed(1),
      words: m.words,
      wi: m.wi,
      typed: m.typed,
    }));
  }
}
