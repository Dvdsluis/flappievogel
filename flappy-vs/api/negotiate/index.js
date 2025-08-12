// Secure negotiate endpoint: returns a short-lived client access URL for Azure Web PubSub
const { WebPubSubServiceClient } = require('@azure/web-pubsub');

module.exports = async function (context, req) {
  const endpoint = process.env.WEB_PUBSUB_ENDPOINT; // e.g., https://<name>.webpubsub.azure.com
  const hub = process.env.WEB_PUBSUB_HUB || 'game';
  const key = process.env.WEB_PUBSUB_KEY; // primary key from Keys

  if (!endpoint || !key) {
    context.res = { status: 500, jsonBody: { error: 'Missing WEB_PUBSUB_ENDPOINT or WEB_PUBSUB_KEY' } };
    return;
  }
  try {
    const service = new WebPubSubServiceClient(endpoint, hub, { key });
    const token = await service.getClientAccessToken({
      roles: [
        'webpubsub.joinLeaveGroup',
        'webpubsub.sendToGroup',
        'webpubsub.joinGroup',
        'webpubsub.sendToAll'
      ],
      expiresIn: 60 * 60 // 1 hour
    });
    context.res = { jsonBody: { url: token.url } };
  } catch (e) {
    context.log('negotiate error', e);
    context.res = { status: 500, jsonBody: { error: 'negotiate failed' } };
  }
};
