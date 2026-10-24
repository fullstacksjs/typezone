import { TICK_MS, COUNTDOWN_SECONDS, BOT_LEVELS } from '../shared/config.js';
import { Game, redact } from './game.js';
import { Bot } from './bot.js';
import { Tutorial } from './tutorial.js';

const BOT_NAMES = { easy: 'Bot (Easy)', normal: 'Bot (Normal)', hard: 'Bot (Hard)' };

/** A 1v1 room: lobby, countdown, match loop and rematches. */
export class Room {
  constructor(code, { bot = null, tutorial = false } = {}, onEmpty) {
    this.code = code;
    this.onEmpty = onEmpty;
    this.seats = { p1: null, p2: null }; // { ws, name } | { bot: true, name }
    this.state = 'waiting';
    this.game = null;
    this.processed = { p1: 0, p2: 0 };
    this.bot = null;
    this.tutorial = tutorial;
    this.botLevel = bot && BOT_LEVELS[bot] ? bot : bot ? 'normal' : null;
    this.rematch = new Set();
    this.timer = null;
    if (this.botLevel) this.seats.p2 = { bot: true, name: BOT_NAMES[this.botLevel] };
    if (tutorial) this.seats.p2 = { bot: true, name: 'Tutorial guide' };
  }

  get full() {
    return this.seats.p1 && this.seats.p2;
  }

  slotOf(ws) {
    return Object.keys(this.seats).find((s) => this.seats[s]?.ws === ws) ?? null;
  }

  send(ws, msg) {
    if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
  }

  broadcast(msg) {
    const data = JSON.stringify(msg);
    for (const seat of Object.values(this.seats)) {
      if (seat?.ws && seat.ws.readyState === seat.ws.OPEN) seat.ws.send(data);
    }
  }

  lobbyInfo() {
    return {
      t: 'lobby',
      code: this.code,
      state: this.state,
      practice: !!this.botLevel || this.tutorial,
      players: Object.fromEntries(
        Object.entries(this.seats).map(([s, seat]) => [s, seat ? { name: seat.name, bot: !!seat.bot } : null]),
      ),
    };
  }

  join(ws, name) {
    const slot = this.seats.p1 ? 'p2' : 'p1';
    this.seats[slot] = { ws, name };
    this.send(ws, { t: 'joined', code: this.code, you: slot });
    if (this.full) this.startCountdown();
    else this.broadcast(this.lobbyInfo());
  }

  leave(ws) {
    const slot = this.slotOf(ws);
    if (!slot) return;
    this.seats[slot] = null;
    this.rematch.delete(slot);
    const humansLeft = Object.values(this.seats).some((s) => s?.ws);
    if (!humansLeft) return this.destroy();

    if (this.state === 'playing' && this.game) {
      this.game.forfeit(slot);
      this.finish('forfeit');
    } else if (this.state === 'countdown') {
      clearTimeout(this.timer);
      this.state = 'waiting';
    }
    this.broadcast({ t: 'opponentLeft' });
    this.broadcast(this.lobbyInfo());
  }

  destroy() {
    clearTimeout(this.timer);
    clearInterval(this.loop);
    this.onEmpty();
  }

  startCountdown() {
    this.state = 'countdown';
    this.rematch.clear();
    this.broadcast(this.lobbyInfo());
    let n = COUNTDOWN_SECONDS;
    const step = () => {
      if (this.state !== 'countdown') return;
      if (n === 0) return this.startMatch();
      this.broadcast({ t: 'countdown', n });
      n--;
      this.timer = setTimeout(step, 1000);
    };
    step();
  }

  startMatch() {
    this.state = 'playing';
    this.processed = { p1: 0, p2: 0 };
    this.game = this.tutorial ? new Tutorial() : new Game();
    this.bot = this.botLevel ? new Bot(this.game, 'p2', this.botLevel) : null;
    this.broadcast({
      t: 'start',
      tutorial: this.tutorial,
      names: { p1: this.seats.p1?.name, p2: this.seats.p2?.name },
    });
    let last = performance.now();
    this.loop = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.25);
      last = now;
      this.bot?.update(dt);
      this.game.update(dt);
      this.broadcastState();
      if (this.game.winner) this.finish('base');
    }, TICK_MS);
  }

  snapshot() {
    return { ...this.game.snapshot(), processed: { ...this.processed } };
  }

  /** Each seat gets its own view so hidden airdrop contents stay hidden. */
  broadcastState() {
    const snapshot = this.snapshot();
    for (const [slot, seat] of Object.entries(this.seats)) {
      if (seat?.ws) this.send(seat.ws, { t: 'state', ...redact(snapshot, slot) });
    }
  }

  finish(reason) {
    if (this.state !== 'playing') return;
    clearInterval(this.loop);
    this.state = 'ended';
    this.broadcastState();
    this.broadcast({ t: 'end', reason, ...this.game.summary() });
    this.broadcast(this.lobbyInfo());
  }

  handle(ws, msg) {
    const slot = this.slotOf(ws);
    if (!slot) return;

    if (msg.t === 'rematch') {
      if (this.state !== 'ended' || !this.full) return;
      this.rematch.add(slot);
      if (this.botLevel) this.rematch.add('p2');
      this.broadcast({ t: 'rematch', votes: [...this.rematch] });
      if (this.rematch.size === 2) this.startCountdown();
      return;
    }

    if (this.state !== 'playing') return;
    const g = this.game;
    // WebSocket delivery is ordered. This watermark means processed, not accepted.
    if (Number.isSafeInteger(msg.seq) && msg.seq > 0) {
      if (msg.seq <= this.processed[slot]) return;
      this.processed[slot] = msg.seq;
    }
    switch (msg.t) {
      case 'mode': return g.setMode(slot, msg.mode);
      case 'gather': return g.gather(slot, msg.id);
      case 'progress': return g.progress(slot, msg.id, msg.wi, msg.typed);
      case 'hit': return g.hitMob(slot, msg.id, msg.wi);
      case 'miss': return g.miss(slot);
      case 'buy': return g.buy(slot, String(msg.item));
      case 'ult': return g.ultimate(slot);
      case 'dropProgress': return g.claimProgress(slot, msg.id, msg.typed);
      case 'claim': return g.claim(slot, msg.id);
      case 'use': return g.useItem(slot, msg.id);
      default:
    }
  }
}
