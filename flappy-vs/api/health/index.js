// Simple health endpoint to verify negotiate envs are present
module.exports = async function (context, req) {
  const endpointVal = process.env.WEB_PUBSUB_ENDPOINT;
  const keyVal = process.env.WEB_PUBSUB_KEY;
  const connStr = process.env.WEB_PUBSUB_CONNECTION_STRING;
  const isConnString = (s) => /endpoint=/i.test(String(s || '')) && /accesskey=/i.test(String(s || ''));
  const hasConn = isConnString(connStr) || isConnString(keyVal);
  const hasEndpoint = !!endpointVal || hasConn; // conn string implies endpoint present
  const hasKey = !!keyVal || hasConn; // conn string implies key present
  const hub = process.env.WEB_PUBSUB_HUB || 'game';

  const ok = hasConn || (!!endpointVal && !!keyVal);
  const mode = hasConn ? 'connectionString' : (!!endpointVal && !!keyVal ? 'endpoint+key' : 'missing');

  const body = { ok, endpointSet: hasEndpoint, keySet: hasKey, hub, mode };
  context.res = {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  };
};
