import serverless from "serverless-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { createApp } from "../../server/app.ts";

type NetlifyEvent = {
  path: string;
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  isBase64Encoded?: boolean;
  queryStringParameters?: Record<string, string> | null;
  requestContext?: { identity?: { sourceIp?: string }; requestId?: string };
};

/** Keep exactly the same API validation/fallbacks as the standalone Node server. */
export function createNetlifyHandler(options: Parameters<typeof createApp>[0] = {}) {
  const app = createApp(options);
  const bridge = serverless((req: IncomingMessage, res: ServerResponse) => {
    app.emit("request", req, res);
  });
  return async (event: NetlifyEvent, context: object = {}) => {
    const prefix = "/.netlify/functions/vision";
    const suffix = event.path.startsWith(prefix) ? event.path.slice(prefix.length) : event.path;
    const path = event.path.startsWith(prefix) && !suffix.startsWith("/api/")
      ? `/api${suffix}` : suffix;
    return bridge({
      ...event,
      path,
      body: event.body ?? "",
      requestContext: {
        ...event.requestContext,
        identity: { sourceIp: event.requestContext?.identity?.sourceIp ?? event.headers["x-nf-client-connection-ip"] ?? "local" },
      },
    }, context);
  };
}

export const handler = createNetlifyHandler();
