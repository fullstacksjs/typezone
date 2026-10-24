import { MOBS, SPELLS, ITEMS, ITEM_KEY } from '../../shared/config.js';
import { sfx } from './audio.js';
import { showAlert, floatGold } from './ui.js';

const other = (slot) => (slot === 'p1' ? 'p2' : 'p1');

/**
 * Turns authoritative frames into the match's sound, particles and alerts:
 * the events each frame carries, plus the opponent's live typing on our mobs
 * and the crate. Local typing feedback stays with the input handler.
 */
export class MatchFeedback {
  constructor(renderer) {
    this.renderer = renderer;
    this.reset(null, {});
  }

  /** Forget per-match tracking; `names` maps slots to display names. */
  reset(you, names) {
    this.you = you;
    this.names = names;
    this.oppTyped = new Map(); // mobId -> last seen opponent progress on our mobs
    this.oppDropTyped = 0; // last seen opponent progress on the airdrop
  }

  get opp() { return other(this.you); }

  /** `snap` is the predicted frame; `mode` the predicted local mode. */
  receive(snap, mode) {
    this.rivalTyping(snap);
    for (const e of snap.events) this.event(e, mode);
  }

  /** Opponent chipping away at our mobs or the crate: fire their bolts. */
  rivalTyping(snap) {
    const ids = new Set(snap.mobs.map((m) => m.id));
    for (const m of snap.mobs) {
      if (m.owner !== this.you) continue;
      if (m.typed > (this.oppTyped.get(m.id) ?? 0)) this.renderer.bolt(this.opp, m.id);
      this.oppTyped.set(m.id, m.typed);
    }
    for (const id of this.oppTyped.keys()) if (!ids.has(id)) this.oppTyped.delete(id);
    const rival = snap.airdrop?.typed[this.opp] ?? 0;
    if (rival > this.oppDropTyped) this.renderer.bolt(this.opp, snap.airdrop.id);
    this.oppDropTyped = rival;
  }

  event(e, mode) {
    const { renderer } = this;
    const mine = e.slot === this.you;
    const rival = this.names[this.opp];
    switch (e.e) {
      case 'gather':
        if (mine) {
          floatGold(`+${e.gold}◆`, e.golden || e.diamond);
          sfx.coin(e.golden, e.diamond);
        }
        break;
      case 'kill': {
        // The killer's target was coming at them: our kills land on the defend road, theirs on the attack road.
        const color = mine ? '#2F6FE0' : '#E8681C';
        if (!e.predicted) renderer.burstAtWorld(e.x, mine, color, 16);
        if (e.type === 'slime') renderer.burstAtWorld(e.x, mine, '#8EE07A', 24, 220);
        if (mine) renderer.killAtWorld(e.x, mine, `+${e.bounty}◆`);
        if (!mine) sfx.enemyHit();
        break;
      }
      case 'armor':
        if (!mine) sfx.enemyHit();
        break;
      case 'send':
        if (mine) sfx.send();
        else showAlert(`${rival} sent a ${MOBS[e.type].name}!`, 'info', 1400, 1, e.type);
        break;
      case 'baseHit':
        renderer.shake(mine ? 14 : 4);
        renderer.flashBase(mine ? this.you : this.opp);
        renderer.floatAtBase(mine ? 'me' : 'opp', `−${e.dmg}`, '#C2183A', 40);
        if (mine) sfx.baseHit();
        else sfx.enemyHit();
        break;
      case 'spell': {
        sfx.spell();
        if (e.spell === 'fog' && !mine) showAlert('You have been FOGGED!', 'danger', 1600, 3, 'fog');
        else if (e.spell === 'frost') {
          showAlert(mine ? 'Frost slows the invaders' : `${rival} froze their side`, mine ? 'mine' : 'info', 1400, 2, 'frost');
        } else if (!mine) {
          showAlert(`${rival} cast ${SPELLS[e.spell].name}`, 'info', 1200, 1, e.spell);
        }
        break;
      }
      case 'airdrop': {
        const fighting = mode === 'fight';
        sfx.airdrop();
        showAlert(fighting ? 'AIRDROP incoming! Type its word to claim it' : 'AIRDROP incoming! Switch to Fight to claim it',
          'mine', 2200, 2, 'crate', fighting ? '' : 'Tab');
        break;
      }
      case 'claim':
        if (mine) {
          // Only the winner learns what was inside.
          const def = ITEMS[e.item.type];
          sfx.claim();
          showAlert(`You got ${def.name}!`, 'mine', 2000, 2, e.item.type, `${def.desc} · press ${ITEM_KEY}`);
        } else {
          showAlert(`${rival} grabbed the airdrop`, 'info', 1600, 2, 'crate');
        }
        break;
      case 'airdropLost':
        showAlert('The airdrop was lost', 'info', 1200, 1, 'crate');
        break;
      case 'item':
        if (e.type === 'heal') {
          sfx.spell();
          renderer.healBase(e.slot);
          renderer.floatAtBase(mine ? 'me' : 'opp', `+${ITEMS.heal.amount}`, '#5BB33A', 34);
          if (!mine) showAlert(`${rival} used ${ITEMS.heal.name}`, 'info', 1200, 1, 'heal');
        }
        break;
      case 'ult':
        renderer.lightning(e.targets, mine);
        sfx.ult();
        if (!mine) showAlert(`${rival} called down LIGHTNING!`, 'info', 1500, 2, 'bolt');
        break;
      case 'overtime':
        showAlert('OVERTIME! Mobs keep speeding up, income doubled', 'danger', 3000, 4, 'flame');
        break;
      case 'suddenDeath':
        showAlert('SUDDEN DEATH! Both bases crumble, no healing', 'danger', 3500, 5, 'skull');
        break;
      default:
    }
  }
}
