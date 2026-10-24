/** Events emitted during a tick, drained into the next snapshot. */
export class EventLog {
  constructor() { this.pending = []; }

  emit(event) { this.pending.push(event); }

  drain() {
    const events = this.pending;
    this.pending = [];
    return events;
  }
}
