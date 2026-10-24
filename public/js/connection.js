/**
 * One WebSocket to the server at a time. Callbacks from a replaced or closed
 * socket are ignored, so a stale connection can never touch the current match.
 */
export class Connection {
  constructor({ onMessage, onDrop }) {
    this.onMessage = onMessage;
    this.onDrop = onDrop; // the server closed the current socket
    this.ws = null;
  }

  /** Resolves once a socket is open, reusing the current one if it is. */
  open() {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) return resolve(this.ws);
      const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`);
      ws.onopen = () => resolve(ws);
      ws.onerror = () => reject(new Error('Could not reach the server.'));
      ws.onmessage = (ev) => { if (this.ws === ws) this.onMessage(JSON.parse(ev.data)); };
      ws.onclose = () => {
        if (this.ws !== ws) return;
        this.ws = null;
        this.onDrop();
      };
      this.ws = ws;
    });
  }

  send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(msg));
  }

  /** Closes on purpose; no drop is reported. */
  close() {
    const { ws } = this;
    this.ws = null;
    ws?.close();
  }
}
