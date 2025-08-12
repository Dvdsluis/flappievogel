// Secure negotiate endpoint: returns a short-lived client access URL for Azure Web PubSub
const { WebPubSubServiceClient } = require('@azure/web-pubsub');

module.exports = async function (context, req) {
  const connStr = process.env.WEB_PUBSUB_CONNECTION_STRING; // optional full connection string
  const endpoint = process.env.WEB_PUBSUB_ENDPOINT; // e.g., https://<name>.webpubsub.azure.com
  const hub = process.env.WEB_PUBSUB_HUB || 'game';
  const keyOrMaybeConn = process.env.WEB_PUBSUB_KEY; // primary key (preferred), or sometimes a full connection string by mistake

  try {
    let service;
  if (connStr) {
      service = new WebPubSubServiceClient(connStr, hub);
    } else if (keyOrMaybeConn && /^endpoint=/i.test(String(keyOrMaybeConn))) {
      // If WEB_PUBSUB_KEY actually contains a connection string
      service = new WebPubSubServiceClient(keyOrMaybeConn, hub);
    } else if (endpoint && keyOrMaybeConn) {
      service = new WebPubSubServiceClient(endpoint, hub, { key: keyOrMaybeConn });
    } else {
      context.res = {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Missing configuration. Provide WEB_PUBSUB_CONNECTION_STRING or (WEB_PUBSUB_ENDPOINT and WEB_PUBSUB_KEY).' })
      };
      return;
    }

    const token = await service.getClientAccessToken({
      roles: [
        'webpubsub.joinLeaveGroup',
        'webpubsub.sendToGroup',
        'webpubsub.joinGroup',
        'webpubsub.sendToAll'
      ],
      expiresIn: 60 * 60 // 1 hour
    });
    context.res = {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: token.url, hub })
    };
  } catch (e) {
    context.log('negotiate error', e?.message || e);
    context.res = {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'negotiate failed', detail: String(e?.message || e) })
    };
  }
};
