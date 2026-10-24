import { tutorialPolicy } from '../../shared/tutorial-policy.js';
import { ULT_MAX } from '../../shared/config.js';
import { TypingState } from './typing-state.js';
import { ShopPrediction } from './shop-state.js';

/**
 * The local player's side of one match: the action sequence, both predictors
 * and the merged view the HUD, canvas and tutorial draw. Commands return the
 * wire action to send, or null when the input is refused locally. No transport,
 * DOM, audio or drawing.
 *
 * Construct a new session on countdown, match start, end, disconnect or exit.
 */
export class MatchSession {
  constructor(you) {
    this.you = you;
    this.seq = 0;
    this.shop = new ShopPrediction(you);
    this.typing = new TypingState(you);
    this.view = null; // { snap, mode, lock }
  }

  get snap() { return this.view?.snap ?? null; }

  get mode() { return this.view?.mode ?? 'gather'; }

  get lock() { return this.view?.lock ?? null; }

  /** The local player as predicted: purchases, item uses, typing and mode. */
  get me() { return this.snap?.players[this.you] ?? null; }

  get policy() { return tutorialPolicy(this.snap?.tutorial, this.mode); }

  receive(snapshot) {
    this.shop.receive(snapshot);
    this.typing.receive(snapshot);
    this.compose();
    return this.view;
  }

  /** One typed character. Returns the typing result (`action`, `feedback`, `lock`) or null if refused. */
  type(ch) {
    if (!this.snap || !this.policy.allows({ t: 'type' })) return null;
    const result = this.typing.type(ch, ++this.seq);
    this.compose();
    return result;
  }

  setMode(mode) {
    if (!this.snap || !this.policy.allows({ t: 'mode', mode })) return null;
    const action = this.typing.setMode(mode, this.seq + 1);
    if (!action) return null;
    this.seq++;
    this.compose();
    return action;
  }

  buy(item) {
    if (!this.snap || !this.shop.buy(item, this.seq + 1, this.mode)) return null;
    this.compose();
    return { t: 'buy', item, seq: ++this.seq };
  }

  /** Uses the item held in supply slot `index`. */
  use(index) {
    const item = this.me?.items[index];
    if (!item || !this.shop.use(item.id, this.seq + 1, this.mode)) return null;
    this.compose();
    return { t: 'use', id: item.id, seq: ++this.seq };
  }

  /** Lightning is not predicted; the next frame shows its strikes. */
  ultimate() {
    if (!this.snap || !this.policy.allows({ t: 'ult' }) || this.me.ult < ULT_MAX) return null;
    return { t: 'ult', seq: ++this.seq };
  }

  dropLock() {
    this.typing.drop();
    this.compose();
  }

  /** The typing view's frame, with the local player's shop prediction layered in. */
  compose() {
    const view = this.typing.view;
    if (!view) return;
    const typed = view.snap.players[this.you];
    this.view = {
      snap: {
        ...view.snap,
        players: {
          ...view.snap.players,
          [this.you]: { ...this.shop.player, ores: typed.ores, mode: view.mode, combo: typed.combo },
        },
      },
      mode: view.mode,
      lock: view.lock,
    };
  }
}
