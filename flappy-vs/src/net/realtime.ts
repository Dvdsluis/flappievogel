// Minimal Web PubSub client for Versus Online
import { WebPubSubClient } from '@azure/web-pubsub-client';

export type RTMessage =
  | { type: 'join'; id: string; roomId: string; name?: string }
  | { type: 'leave'; id: string; roomId: string }
  | { type: 'state'; id: string; t: number; x: number; y: number; vy: number; score: number; hp: number; name?: string }
  | { type: 'spawn'; id: string; t: number; w: number; gap: number; topH: number; speed: number }
  | { type: 'start'; id: string; roomId: string; t: number };

export class Realtime {
  private client: WebPubSubClient | null = null;
  private group: string | null = null;
  private connected = false;
  public readonly id: string;
  private onDisc: Array<() => void> = [];
  private onErr: Array<(e: any) => void> = [];
  private mode: 'azure' | 'local' = 'azure';
  private bc: BroadcastChannel | null = null;

  constructor(private negotiateUrl: string) {
    this.id = Math.random().toString(36).slice(2, 8);
  }

  async connect(roomId: string): Promise<void> {
    this.group = `room:${roomId}`;
    try {
      const res = await fetch(this.negotiateUrl, { credentials: 'include' });
      if (!res.ok) throw new Error('negotiate failed');
      const { url } = await res.json();
      if (!url) throw new Error('no url');
      const client = new WebPubSubClient(url);
      this.client = client;
      this.mode = 'azure';
      client.on('connected', () => { this.connected = true; });
      client.on('disconnected', () => { this.connected = false; this.onDisc.forEach((f) => f()); });
      client.on('stopped', () => { this.connected = false; this.onDisc.forEach((f) => f()); });
      // Always register group-message before join to avoid missing early messages
      client.on('group-message', ({ message }) => {
        try { this.onMsgHandler?.(JSON.parse(String(message.data)) as any); } catch {}
      });
      await client.start();
      await client.joinGroup(this.group);
      this.connected = true;
    } catch (e) {
      // Local fallback only for localhost/dev
      const host = (typeof window !== 'undefined' && window.location.hostname) || '';
      const isLocal = host === 'localhost' || host === '127.0.0.1' || host.endsWith('.local');
      if (!isLocal) {
        // In production, surface the error to caller
        throw e;
      }
      try {
        this.mode = 'local';
        this.bc = new BroadcastChannel(this.group!);
        this.bc.onmessage = (ev) => {
          const data = ev.data; // expect RTMessage JSON object
          try { this.onMsgHandler?.(data as RTMessage); } catch {}
        };
        this.connected = true;
      } catch (e2) {
        throw e; // rethrow original negotiate error if BC not available
      }
    }
  }

  private onMsgHandler: ((msg: RTMessage) => void) | null = null;
  onMessage(handler: (msg: RTMessage) => void) {
    this.onMsgHandler = handler;
  }

  onDisconnected(handler: () => void) { this.onDisc.push(handler); }
  onError(handler: (e: any) => void) { this.onErr.push(handler); }

  async send(msg: RTMessage) {
    if (!this.client || !this.connected || !this.group) return;
    try {
      if (this.mode === 'azure') {
        await this.client.sendToGroup(this.group, JSON.stringify(msg), 'text');
      } else if (this.mode === 'local' && this.bc) {
        this.bc.postMessage(msg);
      }
    } catch (e) {
      this.onErr.forEach((f) => f(e));
    }
  }

  close() {
    try { this.bc?.close(); } catch {}
  }

  getTransport() { return this.mode; }
}
