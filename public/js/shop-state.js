import { purchase, applyPurchase } from '../../shared/shop.js';

/** Replay only purchases not yet processed in the authoritative frame. */
export class ShopPrediction {
  constructor(you) { this.you = you; this.pending = []; }

  receive(snapshot) {
    this.snapshot = snapshot;
    this.pending = this.pending.filter((action) => action.seq > (snapshot.processed?.[this.you] ?? 0));
    this.rebuild();
  }

  rebuild() {
    this.player = structuredClone(this.snapshot.players[this.you]);
    for (const action of this.pending) {
      if (purchase(this.player, action.item, this.context).available) applyPurchase(this.player, action.item);
    }
  }

  get context() {
    return { ended: !!this.snapshot.winner, suddenDeath: this.snapshot.suddenDeath, tutorial: this.snapshot.tutorial };
  }

  buy(item, seq, mode = this.player.mode) {
    this.player.mode = mode;
    if (!purchase(this.player, item, this.context).available) return false;
    applyPurchase(this.player, item);
    this.pending.push({ item, seq });
    return true;
  }
}
