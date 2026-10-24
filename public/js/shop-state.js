import { purchase, applyPurchase } from '../../shared/shop.js';
import { itemUse, applyItem } from '../../shared/items.js';

/** Replay only purchases and item uses not yet processed in the authoritative frame. */
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
      this.player.mode = action.mode;
      if (action.use != null) {
        if (itemUse(this.player, action.use, this.context).available) applyItem(this.player, action.use);
      } else if (purchase(this.player, action.item, this.context).available) applyPurchase(this.player, action.item);
    }
  }

  get context() {
    return { ended: !!this.snapshot.winner, suddenDeath: this.snapshot.suddenDeath, tutorial: this.snapshot.tutorial };
  }

  buy(item, seq, mode = this.player.mode) {
    this.player.mode = mode;
    if (!purchase(this.player, item, this.context).available) return false;
    applyPurchase(this.player, item);
    this.pending.push({ item, seq, mode });
    return true;
  }

  use(id, seq, mode = this.player.mode) {
    this.player.mode = mode;
    if (!itemUse(this.player, id, this.context).available) return false;
    applyItem(this.player, id);
    this.pending.push({ use: id, seq, mode });
    return true;
  }
}
