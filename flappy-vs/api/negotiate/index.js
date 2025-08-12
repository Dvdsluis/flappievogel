// Minimal negotiate endpoint for SWA API
module.exports = async function (context, req) {
  const url = process.env.WEB_PUBSUB_CLIENT_URL;
  if (!url) {
    context.res = { status: 500, jsonBody: { error: 'Missing WEB_PUBSUB_CLIENT_URL' } };
    return;
  }
  context.res = { jsonBody: { url } };
};
