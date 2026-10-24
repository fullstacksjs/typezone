import { BASE_HP, START_GOLD, MOBS, ULT_MAX, comboMultiplier } from '../../shared/config.js';
import { PICKAXE, DRILL } from '../../shared/shop.js';

/**
 * One side's authoritative state. Fields stay plain so shared rules can treat
 * server players and snapshot players alike; methods own the state transitions.
 */
export class Player {
  constructor() {
    this.hp = BASE_HP;
    this.gold = START_GOLD;
    this.combo = 0;
    this.bestCombo = 0;
    this.mode = 'gather';
    this.pickaxe = 0;
    this.luck = 0;
    this.drill = 0;
    this.frostCd = 0;
    this.items = [];
    this.charges = Object.fromEntries(Object.entries(MOBS).filter(([, def]) => !def.hidden)
      .map(([type, def]) => [type, { n: def.charges, t: 0 }]));
    this.frost = 0;
    this.fog = 0;
    this.ult = 0;
    this.ores = [];
    this.stats = {
      chars: 0, misses: 0, goldEarned: 0, mobsSent: 0, mobsKilled: 0, damageDealt: 0, spells: 0, airdrops: 0,
    };
  }

  /** Multiplier for gold from gathering and bounties. */
  get rewardMultiplier() { return comboMultiplier(this.combo) * PICKAXE.multiplier(this); }

  /** A cleanly typed word: extends the streak and counts its characters. */
  typed(word) {
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.stats.chars += word.length;
  }

  miss() {
    this.combo = 0;
    this.stats.misses++;
  }

  earn(gold) {
    this.gold += gold;
    this.stats.goldEarned += gold;
  }

  chargeUlt(amount) { this.ult = Math.min(ULT_MAX, this.ult + amount); }

  takeHit(damage) {
    this.hp = Math.max(0, this.hp - damage);
    this.combo = 0;
  }

  crumble(damage) { this.hp = Math.max(0, this.hp - damage); }

  tick(dt) {
    this.frostCd = Math.max(0, this.frostCd - dt);
    this.frost = Math.max(0, this.frost - dt);
    this.fog = Math.max(0, this.fog - dt);
    this.recharge(dt);
  }

  recharge(dt) {
    for (const [type, charge] of Object.entries(this.charges)) {
      const def = MOBS[type];
      if (charge.n >= def.charges) continue;
      // Store elapsed base recharge seconds so upgrades preserve percentage progress.
      charge.t += dt / DRILL.scale(this);
      while (charge.t >= def.recharge && charge.n < def.charges) {
        charge.t -= def.recharge;
        charge.n++;
      }
      if (charge.n === def.charges) charge.t = 0;
    }
  }

  snapshot({ pressured }) {
    return {
      hp: Math.ceil(this.hp),
      gold: Math.floor(this.gold),
      combo: this.combo,
      mode: this.mode,
      pickaxe: this.pickaxe,
      luck: this.luck,
      drill: this.drill,
      frostCd: +this.frostCd.toFixed(2),
      items: this.items.map((it) => ({ ...it })),
      pressured,
      charges: Object.fromEntries(Object.entries(this.charges).map(([type, charge]) => [type, {
        n: charge.n,
        progress: charge.t / MOBS[type].recharge,
        recharge: DRILL.recharge(this, type),
      }])),
      frost: +this.frost.toFixed(2),
      fog: +this.fog.toFixed(2),
      ult: this.ult,
      ores: this.ores.map((o) => ({ id: o.id, word: o.word, golden: o.golden, diamond: o.diamond, ttl: o.ttl == null ? null : +o.ttl.toFixed(2) })),
    };
  }

  summary(time) {
    const minutes = Math.max(time / 60, 1 / 60);
    const { chars, misses } = this.stats;
    return {
      ...this.stats,
      bestCombo: this.bestCombo,
      hp: this.hp,
      wpm: Math.round(chars / 5 / minutes),
      accuracy: chars + misses === 0 ? 100 : Math.round((chars / (chars + misses)) * 100),
    };
  }
}
