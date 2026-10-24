import { tutorialPolicy } from './tutorial-policy.js';
import { MOBS, SPELLS } from './config.js';

/**
 * A purchasable offer. Subclasses describe price, readiness and effects, so a new
 * mob, spell or upgrade is one new entry in OFFERS rather than a branch in every caller.
 *
 * `predict` holds only predictable player changes and works with authoritative and
 * snapshot players alike. `resolve` holds authoritative match effects on the server.
 */
class Offer {
  constructor(id, def) {
    this.id = id;
    this.def = def;
  }

  cost() { return this.def.cost; }

  /** Seconds before the offer can be bought again. */
  cooldown() { return 0; }

  ready(player) { return !(this.cooldown(player) > 0); }

  predict(player) { player.gold -= this.cost(player); }

  resolve(match, slot) { match.castSpell(slot, this.id); }
}

class MobOffer extends Offer {
  ready(player) { return player.charges[this.id]?.n > 0; }

  predict(player) {
    super.predict(player);
    player.charges[this.id].n--;
  }

  resolve(match, slot) { match.sendMob(slot, this.id); }
}

/** A tiered upgrade whose level is stored on the player under its id. */
class UpgradeOffer extends Offer {
  level(player) { return player[this.id] ?? 0; }

  cost(player) { return this.def.costs[this.level(player)] ?? null; }

  predict(player) {
    super.predict(player);
    player[this.id]++;
  }
}

class Pickaxe extends UpgradeOffer {
  /** Gold multiplier applied to gathering and bounties. */
  multiplier(player) { return 1 + this.level(player) * this.def.bonus; }
}

class Luck extends UpgradeOffer {
  odds(player) {
    const level = this.level(player);
    return { golden: this.def.golden[level], diamond: this.def.diamond[level] };
  }
}

class DrillSergeant extends UpgradeOffer {
  /** Recharge time scale; progress is stored in base seconds so upgrades preserve its percentage. */
  scale(player) { return 1 - this.level(player) * this.def.reduction; }

  recharge(player, type) { return MOBS[type].recharge * this.scale(player); }

  predict(player) {
    super.predict(player);
    for (const [type, charge] of Object.entries(player.charges)) {
      if ('recharge' in charge) charge.recharge = this.recharge(player, type);
    }
  }
}

class Frost extends Offer {
  cooldown(player) { return player.frostCd; }

  predict(player) {
    super.predict(player);
    player.frost = this.def.duration;
    player.frostCd = this.def.cooldown;
  }

  /** Speed multiplier for mobs attacking a frosted player. */
  slow(player) { return player.frost > 0 ? this.def.slow : 1; }
}

class Fog extends Offer {
  resolve(match, slot) {
    match.opponentOf(slot).fog = this.def.duration;
    super.resolve(match, slot);
  }
}

export const PICKAXE = new Pickaxe('pickaxe', SPELLS.pickaxe);
export const LUCK = new Luck('luck', SPELLS.luck);
export const DRILL = new DrillSergeant('drill', SPELLS.drill);
export const FROST = new Frost('frost', SPELLS.frost);

export const OFFERS = Object.freeze({
  ...Object.fromEntries(Object.entries(MOBS).filter(([, def]) => !def.hidden).map(([id, def]) => [id, new MobOffer(id, def)])),
  frost: FROST,
  fog: new Fog('fog', SPELLS.fog),
  pickaxe: PICKAXE,
  luck: LUCK,
  drill: DRILL,
});

export function offerOf(item) {
  return Object.hasOwn(OFFERS, item) ? OFFERS[item] : null;
}

export function itemCost(item, player) {
  return offerOf(item)?.cost(player) ?? null;
}

/** Works with authoritative players and snapshot players. */
export function purchase(player, item, { ended = false, tutorial = null } = {}) {
  const offer = offerOf(item);
  const cost = offer?.cost(player) ?? null;
  const permitted = tutorialPolicy(tutorial, player.mode).allows({ t: 'buy', item });
  const available = cost != null && !ended && permitted && player.gold >= cost && offer.ready(player);
  return { cost, available };
}

/** Apply only predictable player changes; match effects remain authoritative. */
export function applyPurchase(player, item) {
  offerOf(item).predict(player);
}
