import { tutorialPolicy } from './tutorial-policy.js';
import { BASE_HP, ITEMS, ITEM_SLOTS } from './config.js';

/** A player may race for an airdrop only from Fight mode with a free slot. */
export function canClaim(player) {
  return player.mode === 'fight' && player.items.length < ITEM_SLOTS;
}

/** Works with authoritative players and the owner's snapshot player. Opponent items have no type. */
export function itemUse(player, id, { ended = false, suddenDeath = false, tutorial = null } = {}) {
  const item = player.items.find((it) => it.id === id) ?? null;
  const def = item && Object.hasOwn(ITEMS, item.type) && ITEMS[item.type];
  const permitted = tutorialPolicy(tutorial, player.mode).allows({ t: 'use' });
  const available = !!def && !ended && permitted
    && !(item.type === 'heal' && (player.hp >= BASE_HP || suddenDeath));
  return { item, available };
}

/** Apply only predictable player changes; events remain authoritative. */
export function applyItem(player, id) {
  const idx = player.items.findIndex((it) => it.id === id);
  const [item] = player.items.splice(idx, 1);
  if (item.type === 'heal') player.hp = Math.min(BASE_HP, player.hp + ITEMS.heal.amount);
  return item;
}
