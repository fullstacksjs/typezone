import { tutorialPolicy } from './tutorial-policy.js';
import { BASE_HP, ITEMS, ITEM_SLOTS } from './config.js';

/**
 * A kind of airdrop item. Subclasses add their own use conditions and predictable
 * effect, so a new item is one entry in ITEM_KINDS plus its config.
 */
class ItemKind {
  constructor(type, def) {
    this.type = type;
    this.def = def;
  }

  /** Extra conditions beyond ownership, match end and tutorial permission. */
  usable() { return true; }

  apply() {}
}

class Heal extends ItemKind {
  usable(player, { suddenDeath }) { return player.hp < BASE_HP && !suddenDeath; }

  apply(player) { player.hp = Math.min(BASE_HP, player.hp + this.def.amount); }
}

const KINDS = { heal: Heal };

export const ITEM_KINDS = Object.freeze(Object.fromEntries(
  Object.entries(ITEMS).map(([type, def]) => [type, new KINDS[type](type, def)]),
));

export function kindOf(type) {
  return Object.hasOwn(ITEM_KINDS, type) ? ITEM_KINDS[type] : null;
}

/** Weighted random item type for a new crate. */
export function rollItem(random = Math.random) {
  const kinds = Object.values(ITEM_KINDS);
  let r = random() * kinds.reduce((sum, kind) => sum + kind.def.weight, 0);
  for (const kind of kinds) if ((r -= kind.def.weight) <= 0) return kind.type;
  return kinds[0].type;
}

/** A player may race for an airdrop only from Fight mode with a free slot. */
export function canClaim(player) {
  return player.mode === 'fight' && player.items.length < ITEM_SLOTS;
}

/** Works with authoritative players and the owner's snapshot player. Opponent items have no type. */
export function itemUse(player, id, { ended = false, suddenDeath = false, tutorial = null } = {}) {
  const item = player.items.find((it) => it.id === id) ?? null;
  const kind = item && kindOf(item.type);
  const permitted = tutorialPolicy(tutorial, player.mode).allows({ t: 'use' });
  const available = !!kind && !ended && permitted && kind.usable(player, { suddenDeath });
  return { item, available };
}

/** Apply only predictable player changes; events remain authoritative. */
export function applyItem(player, id) {
  const idx = player.items.findIndex((it) => it.id === id);
  const [item] = player.items.splice(idx, 1);
  kindOf(item.type).apply(player);
  return item;
}
