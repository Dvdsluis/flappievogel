// Azure Functions (HTTP) - returns a Web PubSub client access URL
import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';

// This function expects that SWA injects a connection URL, or that you set
// WEB_PUBSUB_CLIENT_URL in your environment. For production, prefer generating
// a client access URL with a short-lived token from the server key.

export async function negotiate(req: HttpRequest, ctx: InvocationContext): Promise<HttpResponseInit> {
  const url = process.env.WEB_PUBSUB_CLIENT_URL;
  if (!url) {
    return { status: 500, jsonBody: { error: 'Missing WEB_PUBSUB_CLIENT_URL' } };
  }
  return { jsonBody: { url } };
}

app.http('negotiate', {
  route: 'negotiate',
  methods: ['GET'],
  authLevel: 'anonymous',
  handler: negotiate,
});
