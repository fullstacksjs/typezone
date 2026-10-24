import { tutorialPolicy } from './tutorial-policy.js';
import { MOBS, SPELLS } from './config.js';

export function itemCost(item, player) {
  const mob = Object.hasOwn(MOBS, item) && MOBS[item];
  const spell = Object.hasOwn(SPELLS, item) && SPELLS[item];
  if (mob) return mob.hidden ? null : mob.cost;
  return spell ? (spell.costs ? spell.costs[player?.[item] ?? 0] ?? null : spell.cost) : null;
}

/** Works with authoritative players and snapshot players. */
export function purchase(player, item, { ended = false, tutorial = null } = {}) {
  const cost = itemCost(item, player);
  const permitted = tutorialPolicy(tutorial, player.mode).allows({ t: 'buy', item });
  const available = cost != null && !ended && permitted && player.gold >= cost
    && (!MOBS[item] || player.charges[item]?.n > 0)
    && !(item === 'frost' && player.frostCd > 0);
  return { cost, available };
}

/** Apply only predictable player changes; match effects remain authoritative. */
export function applyPurchase(player, item) {
  player.gold -= itemCost(item, player);
  if (MOBS[item]) player.charges[item].n--;
  const spell = SPELLS[item];
  if (spell?.costs) player[item]++;
  if (item === 'frost') { player.frost = spell.duration; player.frostCd = spell.cooldown; }
  if (item === 'drill') {
    for (const [type, charge] of Object.entries(player.charges)) {
      if ('recharge' in charge) charge.recharge = MOBS[type].recharge * (1 - player.drill * SPELLS.drill.reduction);
    }
  }
}
