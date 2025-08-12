// Simple health endpoint to verify negotiate envs are present
module.exports = async function (context, req) {
  const endpoint = !!process.env.WEB_PUBSUB_ENDPOINT;
  const key = !!process.env.WEB_PUBSUB_KEY;
  const hub = process.env.WEB_PUBSUB_HUB || 'game';
  context.res = { jsonBody: { ok: endpoint && key, endpointSet: endpoint, keySet: key, hub } };
};
