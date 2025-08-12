// Minimal Web PubSub client for Versus Online
import { WebPubSubClient } from '@azure/web-pubsub-client';

export type RTMessage =
  | { type: 'join'; id: string; roomId: string; name?: string }
  | { type: 'leave'; id: string; roomId: string }
  | { type: 'state'; id: string; t: number; x: number; y: number; vy: number; score: number; hp: number; name?: string }
  | { type: 'spawn'; id: string; t: number; w: number; gap: number; topH: number; speed: number };

export class Realtime {
  private client: WebPubSubClient | null = null;
  private group: string | null = null;
  private connected = false;
  public readonly id: string;
  private onDisc: Array<() => void> = [];
  private onErr: Array<(e: any) => void> = [];

  constructor(private negotiateUrl: string) {
    this.id = Math.random().toString(36).slice(2, 8);
  }

  async connect(roomId: string): Promise<void> {
    const res = await fetch(this.negotiateUrl, { credentials: 'include' });
    if (!res.ok) throw new Error('negotiate failed');
  const { url } = await res.json();
  const client = new WebPubSubClient(url);
    this.client = client;
    this.group = `room:${roomId}`;
    client.on('connected', () => {
      this.connected = true;
    });
    client.on('disconnected', () => {
      this.connected = false; this.onDisc.forEach((f) => f());
    });
    client.on('stopped', () => {
      this.connected = false; this.onDisc.forEach((f) => f());
    });
    await client.start();
    await client.joinGroup(this.group);
    this.connected = true;
  }

  onMessage(handler: (msg: RTMessage) => void) {
    this.client?.on('group-message', ({ message }) => {
      try { handler(JSON.parse(String(message.data)) as RTMessage); } catch {}
    });
  }

  onDisconnected(handler: () => void) { this.onDisc.push(handler); }
  onError(handler: (e: any) => void) { this.onErr.push(handler); }

  async send(msg: RTMessage) {
    if (!this.client || !this.connected || !this.group) return;
    try {
      await this.client.sendToGroup(this.group, JSON.stringify(msg), 'text');
    } catch (e) {
      this.onErr.forEach((f) => f(e));
    }
  }
}
