import { LANE_LENGTH } from '../../shared/config.js';

/** Owns targets and pending completions. No drawing, audio or transport. */
export class TypingState {
  constructor(you) {
    this.you = you;
    this.pending = [];
    this.lock = null;
    this.predictedKills = new Set();
  }

  receive(snapshot) {
    this.snapshot = snapshot;
    this.pending = this.pending.filter((a) => a.seq > (snapshot.processed?.[this.you] ?? 0));
    this.rebuild();
    if (this.lock) {
      const { snap, mode } = this.view;
      const target = this.lock.kind === 'ore'
        ? snap.players[this.you].ores.find((o) => o.id === this.lock.id && mode === 'gather')
        : snap.mobs.find((m) => m.id === this.lock.id && m.wi === this.lock.wi && mode === 'fight');
      if (!target) this.drop();
    }
    this.view.snap.events = snapshot.events.map((e) => {
      if (e.e === 'kill' && e.slot === this.you && this.predictedKills.delete(e.mobId)) return { ...e, predicted: true };
      return e;
    });
    const ids = new Set(snapshot.mobs.map((m) => m.id));
    for (const id of this.predictedKills) if (!ids.has(id)) this.predictedKills.delete(id);
    return this.view;
  }

  rebuild() {
    const snap = structuredClone(this.snapshot);
    const player = snap.players[this.you];
    for (const a of this.pending) {
      if (a.t === 'mode') player.mode = a.mode;
      if (a.t === 'miss') player.combo = 0;
      if (a.t === 'gather' && player.mode === 'gather') player.ores = player.ores.filter((o) => o.id !== a.id);
      if (a.t === 'hit' && player.mode === 'fight') {
        const mob = snap.mobs.find((m) => m.id === a.id);
        if (mob && mob.wi === a.wi) {
          mob.wi++;
          mob.typed = 0;
          if (mob.wi === mob.words.length) snap.mobs = snap.mobs.filter((m) => m.id !== a.id);
        }
      }
    }
    this.view = { snap, mode: player.mode, lock: this.lock };
  }

  drop() {
    this.lock = null;
    if (this.view) this.view.lock = null;
  }

  setMode(mode, seq) {
    if (!['gather', 'fight'].includes(mode) || mode === this.view.mode) return null;
    this.drop();
    const action = { t: 'mode', mode, seq };
    this.pending.push(action);
    this.rebuild();
    return action;
  }

  target(ch) {
    const { snap, mode } = this.view;
    if (mode === 'fight') {
      const distance = (m) => this.you === 'p1' ? m.x : LANE_LENGTH - m.x;
      const mob = snap.mobs.filter((m) => m.target === this.you && m.words[m.wi]?.[0] === ch)
        .sort((a, b) => distance(a) - distance(b))[0];
      return mob && { kind: 'mob', id: mob.id, wi: mob.wi, typed: 0, word: mob.words[mob.wi] };
    }
    const priority = (o) => o.diamond ? 2 : o.golden ? 1 : 0;
    const ore = snap.players[this.you].ores.filter((o) => o.word[0] === ch)
      .sort((a, b) => priority(b) - priority(a))[0];
    return ore && { kind: 'ore', id: ore.id, wi: 0, typed: 0, word: ore.word };
  }

  type(ch, seq) {
    if (!this.view || this.snapshot.winner) return {};
    this.lock ??= this.target(ch) ?? null;
    if (!this.lock || this.lock.word[this.lock.typed] !== ch) {
      const action = { t: 'miss', seq };
      this.pending.push(action);
      this.rebuild();
      return { action, feedback: 'miss' };
    }
    const lock = { ...this.lock, typed: this.lock.typed + 1 };
    this.lock = lock;
    this.view.lock = lock;
    if (lock.typed < lock.word.length) {
      return { lock, action: lock.kind === 'mob' ? { t: 'progress', id: lock.id, wi: lock.wi, typed: lock.typed, seq } : null };
    }
    const action = { t: lock.kind === 'ore' ? 'gather' : 'hit', id: lock.id, wi: lock.wi, seq };
    const mob = this.view.snap.mobs.find((m) => m.id === lock.id);
    const armor = lock.kind === 'mob' && lock.wi + 1 < mob.words.length;
    const feedback = lock.kind === 'ore' ? 'gather' : armor ? 'armor' : 'kill';
    if (feedback === 'kill') this.predictedKills.add(lock.id);
    this.pending.push(action);
    this.lock = armor ? { ...lock, wi: lock.wi + 1, typed: 0, word: mob.words[lock.wi + 1] } : null;
    this.rebuild();
    return { action, feedback, lock };
  }
}
