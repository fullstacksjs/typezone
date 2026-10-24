import { AIRDROP } from '../../shared/config.js';
import { canClaim, rollItem } from '../../shared/items.js';
import { pickWord } from '../../shared/words.js';

const between = ([lo, hi]) => lo + Math.random() * (hi - lo);

/**
 * Crates raced for from Fight mode. Contents stay here until claimed.
 * `reserved` supplies the field's words; `first: Infinity` disables crates.
 */
export class AirdropSupply {
  constructor({ ids, events, reserved = () => ({ words: [], active: [] }), first = AIRDROP.first }) {
    this.ids = ids;
    this.events = events;
    this.reserved = reserved;
    this.crate = null;
    this.nextDrop = first;
  }

  /** Words a new mob must avoid so the crate stays distinguishable. */
  words() { return this.crate ? [this.crate.word] : []; }

  drop() {
    // Both players race from Fight mode, so avoid every word either of them could be typing there.
    const { words, active } = this.reserved();
    const word = pickWord(AIRDROP.len[0], AIRDROP.len[1], new Set(active.map((w) => w[0])), new Set(words));
    this.crate = { id: this.ids.next(), word, item: rollItem(), ttl: AIRDROP.fall, typed: { p1: 0, p2: 0 } };
    this.events.emit({ e: 'airdrop', id: this.crate.id });
  }

  close() {
    this.crate = null;
    this.nextDrop = between(AIRDROP.interval);
  }

  /** A crate can only be raced from Fight mode; leaving it resets that player's progress. */
  leftFight(slot) {
    if (this.crate) this.crate.typed[slot] = 0;
  }

  progress(slot, player, id, typed) {
    const crate = this.crate;
    if (!crate || crate.id !== id || !canClaim(player)) return;
    crate.typed[slot] = Math.max(0, Math.min(typed | 0, crate.word.length));
  }

  /** First valid claim wins; later claims find no crate. */
  claim(slot, player, id) {
    const crate = this.crate;
    if (!crate || crate.id !== id || !canClaim(player)) return false;
    player.typed(crate.word);
    player.stats.airdrops++;
    const item = { id: this.ids.next(), type: crate.item };
    player.items.push(item);
    this.close();
    this.events.emit({ e: 'claim', slot, dropId: id, item });
    return true;
  }

  tick(dt, { suddenDeath }) {
    if (this.crate) {
      this.crate.ttl -= dt;
      if (this.crate.ttl <= 0) {
        this.events.emit({ e: 'airdropLost', id: this.crate.id });
        this.close();
      }
    } else if (!suddenDeath) {
      // Healing is disabled in sudden death, so crates stop falling.
      this.nextDrop -= dt;
      if (this.nextDrop <= 0) this.drop();
    }
  }

  /** The crate's contents never leave the server. */
  snapshot() {
    const crate = this.crate;
    return crate && { id: crate.id, word: crate.word, ttl: +crate.ttl.toFixed(2), typed: { ...crate.typed } };
  }
}
