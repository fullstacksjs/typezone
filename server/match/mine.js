import { ORE_COUNT, ORE_LEN, GOLD_PER_CHAR, GOLDEN_MULT, GOLDEN_TTL, DIAMOND_MULT, DIAMOND_TTL, ULT_PER_ORE } from '../../shared/config.js';
import { LUCK } from '../../shared/shop.js';
import { pickWord } from '../../shared/words.js';

const GRADES = {
  plain: { len: ORE_LEN, mult: 1, ttl: null },
  golden: { len: [6, 9], mult: GOLDEN_MULT, ttl: GOLDEN_TTL },
  diamond: { len: [8, 11], mult: DIAMOND_MULT, ttl: DIAMOND_TTL },
};

const gradeOf = (ore) => (ore.diamond ? GRADES.diamond : ore.golden ? GRADES.golden : GRADES.plain);

/** Gather mode: each player's ore words, their grades, payouts and expiry. */
export class Mine {
  constructor({ ids, events, random = () => Math.random() }) {
    this.ids = ids;
    this.events = events;
    this.random = random;
  }

  fill(player) {
    for (let i = 0; i < ORE_COUNT; i++) this.add(player, false);
  }

  add(player, allowRare = true) {
    const { golden: goldenOdds, diamond: diamondOdds } = LUCK.odds(player);
    const roll = allowRare ? this.random() : 1;
    const diamond = roll < diamondOdds;
    const golden = !diamond && roll < diamondOdds + goldenOdds;
    const grade = gradeOf({ golden, diamond });
    const avoid = new Set(player.ores.map((o) => o.word[0]));
    const exclude = new Set(player.ores.map((o) => o.word));
    const word = pickWord(grade.len[0], grade.len[1], avoid, exclude);
    player.ores.push({ id: this.ids.next(), word, golden, diamond, ttl: grade.ttl });
  }

  /** Mines a completed ore; returns false if it does not exist. */
  gather(slot, player, oreId) {
    const idx = player.ores.findIndex((o) => o.id === oreId);
    if (idx < 0) return false;
    const [ore] = player.ores.splice(idx, 1);
    player.typed(ore.word);
    const gold = Math.round(ore.word.length * GOLD_PER_CHAR * player.rewardMultiplier * gradeOf(ore).mult);
    player.earn(gold);
    player.chargeUlt(ULT_PER_ORE);
    this.events.emit({ e: 'gather', slot, gold, golden: ore.golden, diamond: ore.diamond, oreId });
    this.add(player);
    return true;
  }

  /** Rare ores crumble and are replaced by plain ones. */
  tick(player, dt) {
    for (const ore of [...player.ores]) {
      if (ore.ttl == null) continue;
      ore.ttl -= dt;
      if (ore.ttl <= 0) {
        player.ores.splice(player.ores.indexOf(ore), 1);
        this.add(player, false);
      }
    }
  }
}
