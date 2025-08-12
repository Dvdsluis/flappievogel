# Versus Online (MVP)

This adds a simple peer-vs-peer online mode using Azure Web PubSub.

What it does
- Each client sends its own position/velocity/score to a shared group (room:<code>ROOM</code>) at ~60 Hz (low bandwidth).
- The other client renders your remote bird and score.
- No server authority; this is an MVP for friendly duels.

How to run locally
1. npm install
2. npm run dev
3. Press O on the title screen (or click "Versus (Online)"). You'll be prompted for a name and a room code.
4. Share the room code with a friend. Both players enter the same code.

Azure setup
1. Create Azure Web PubSub (Standard) in your subscription.
2. In the resource, go to "Keys" and click "Generate client URL" with JSON WebSocket on. Copy the Client URL.
3. In Azure Static Web App (or local .env for API), set env var:
   - WEB_PUBSUB_CLIENT_URL = <the client URL>
4. Deploy. The negotiate endpoint will return { url } to the client.

Notes
- This MVP uses JSON text messages; you can switch to binary later.
- For more than 2 players, keep the same group mechanics; add identities.
- If you need server-authoritative physics, add a Function that relays state snapshots on a heartbeat.
