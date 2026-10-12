import test from "node:test";
import assert from "node:assert/strict";
import { createNetlifyHandler } from "../netlify/functions/vision.ts";
import { LAKE_EXAMPLE } from "../src/product/scene.ts";

const event = (path: string, body: object | null = null, origin = "https://example.netlify.app") => ({
  path,
  httpMethod: body ? "POST" : "GET",
  headers: { host: "example.netlify.app", origin, "content-type": "application/json" },
  body: body ? JSON.stringify(body) : null,
  isBase64Encoded: false,
});
type Result = { statusCode: number; body: string; headers: Record<string, string> };

test("Netlify health and scene redirects reuse the existing API, including consent and same-origin checks", async () => {
  let calls = 0;
  const handler = createNetlifyHandler({
    runScene: async () => { calls++; return LAKE_EXAMPLE; },
    run: async () => ({ draft: {}, insights: [], explanation: "完成" }),
  });
  const health = await handler(event("/.netlify/functions/vision/health")) as Result;
  assert.equal(health.statusCode, 200);
  assert.equal(JSON.parse(health.body).sceneConfigured, true);
  const payload = { consent: true, image: "data:image/jpeg;base64,aGVsbG8=" };
  const successful = await handler(event("/.netlify/functions/vision/scene", payload)) as Result;
  assert.equal(successful.statusCode, 200);
  assert.deepEqual(JSON.parse(successful.body), LAKE_EXAMPLE);
  const denied = await handler(event("/.netlify/functions/vision/scene", { ...payload, consent: false })) as Result;
  assert.equal(denied.statusCode, 400);
  const foreign = await handler(event("/.netlify/functions/vision/scene", payload, "https://foreign.example")) as Result;
  assert.equal(foreign.statusCode, 403);
  assert.equal(calls, 1);
  const direct = await handler(event("/api/health")) as Result;
  assert.equal(direct.statusCode, 200);
});

test("Netlify unconfigured and invalid model replies keep photos in the manual flow", async () => {
  const unconfigured = createNetlifyHandler();
  const payload = { consent: true, image: "data:image/jpeg;base64,aGVsbG8=" };
  const absent = await unconfigured(event("/.netlify/functions/vision/scene", payload)) as Result;
  assert.equal(absent.statusCode, 503);
  assert.match(JSON.parse(absent.body).error, /照片已保留/);
  const invalid = createNetlifyHandler({ runScene: async () => ({ invented: "facts" }) });
  const failed = await invalid(event("/.netlify/functions/vision/scene", payload)) as Result;
  assert.equal(failed.statusCode, 502);
  assert.match(JSON.parse(failed.body).error, /照片已保留/);
});
