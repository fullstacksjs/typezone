import { purchase } from '../shared/shop.js';
import { LANE_LENGTH, MOBS, SPELLS, BASE_HP, ULT_MAX, BOT_LEVELS, SUDDEN_DEATH_AT } from '../shared/config.js';

const SEND_WEIGHTS = [['goblin', 4], ['knight', 3], ['slime', 3], ['giant', 1.5]];

function weightedPick(entries) {
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [v, w] of entries) {
    if ((r -= w) <= 0) return v;
  }
  return entries[0][0];
}

/**
 * A simulated typist. It "types" at a fixed characters-per-second budget,
 * switching between gathering and defending depending on the threat level.
 */
export class Bot {
  constructor(game, slot, level = 'normal') {
    this.game = game;
    this.slot = slot;
    this.cfg = BOT_LEVELS[level] ?? BOT_LEVELS.normal;
    this.budget = 0;
    this.oreId = null;
    this.oreTyped = 0;
    this.switchDelay = 0;
    this.shopTimer = 2;
    this.saveFor = 'goblin';
  }

  get me() {
    return this.game.players[this.slot];
  }

  threats() {
    return this.game.mobs
      .filter((m) => m.target === this.slot)
      .sort((a, b) => b.d - a.d);
  }

  update(dt) {
    const game = this.game;
    if (game.winner) return;
    const me = this.me;
    const threats = this.threats();

    // Decide which mode we want to be in.
    const urgent = threats.some((m) => m.d > LANE_LENGTH * 0.4) || threats.length >= 3;
    const want = urgent ? 'fight' : 'gather';
    if (want !== me.mode) {
      if (this.switchDelay <= 0) this.switchDelay = this.cfg.reaction * (0.6 + Math.random() * 0.8);
      this.switchDelay -= dt;
      if (this.switchDelay <= 0) {
        game.setMode(this.slot, want);
        this.oreId = null;
      }
    }

    this.budget = Math.min(this.budget + this.cfg.cps * dt, 4);
    while (this.budget >= 1) {
      this.budget -= 1;
      if (Math.random() > this.cfg.accuracy) {
        game.miss(this.slot);
        continue;
      }
      if (me.mode === 'fight') this.typeFight(threats);
      else this.typeGather();
    }

    this.shopTimer -= dt;
    if (this.shopTimer <= 0) {
      this.shopTimer = 0.8 + Math.random() * 1.6;
      this.shop(threats);
    }
  }

  typeFight(threats) {
    const mob = threats.find((m) => this.game.mobs.includes(m));
    if (!mob) return;
    const word = mob.words[mob.wi];
    const typed = mob.typed + 1;
    if (typed >= word.length) this.game.hitMob(this.slot, mob.id, mob.wi);
    else this.game.progress(this.slot, mob.id, mob.wi, typed);
  }

  typeGather() {
    const ores = this.me.ores;
    let ore = ores.find((o) => o.id === this.oreId);
    if (!ore) {
      ore = ores.find((o) => o.diamond) ?? ores.find((o) => o.golden) ?? ores[(Math.random() * ores.length) | 0];
      if (!ore) return;
      this.oreId = ore.id;
      this.oreTyped = 0;
    }
    this.oreTyped++;
    if (this.oreTyped >= ore.word.length) {
      this.game.gather(this.slot, ore.id);
      this.oreId = null;
    }
  }

  shop(threats) {
    const game = this.game;
    const me = this.me;
    const legal = (item) => purchase(me, item, {
      ended: !!game.winner, suddenDeath: game.time >= SUDDEN_DEATH_AT,
    }).available;
    if (me.ult >= ULT_MAX && threats.length >= 3) return game.ultimate(this.slot);
    if (me.hp < BASE_HP * 0.5 && legal('repair') && Math.random() < 0.5) {
      return game.buy(this.slot, 'repair');
    }
    if (threats.length >= 4 && legal('frost')) {
      return game.buy(this.slot, 'frost');
    }
    for (const upgrade of ['luck', 'drill']) {
      const useful = upgrade === 'luck' ? game.time < 150 : Object.values(me.charges).some((c) => c.n === 0);
      if (useful && legal(upgrade) && Math.random() < 0.25) return game.buy(this.slot, upgrade);
    }
    if (legal('pickaxe') && me.pickaxe < 2 && game.time < 120 && Math.random() < 0.4) {
      return game.buy(this.slot, 'pickaxe');
    }
    if (legal('fog') && me.gold >= SPELLS.fog.cost + 30 && Math.random() < 0.08) {
      return game.buy(this.slot, 'fog');
    }
    if (!legal(this.saveFor)) {
      const available = SEND_WEIGHTS.filter(([type]) => legal(type));
      if (!available.length) return;
      this.saveFor = weightedPick(available);
    }
    if (legal(this.saveFor)) {
      game.buy(this.slot, this.saveFor);
      this.saveFor = weightedPick(SEND_WEIGHTS);
    }
  }
}
