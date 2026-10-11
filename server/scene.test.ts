import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.ts";
import { planScene } from "./scene-provider.ts";
import {
  LAKE_EXAMPLE,
  sceneRequestSchema,
  sceneResultSchema,
} from "../src/product/scene.ts";

test("scene contracts reject missing consent, detected bodies, unsafe bounds and mislabeled sizes", () => {
  assert.equal(
    sceneRequestSchema.safeParse({
      consent: false,
      image: "data:image/jpeg;base64,aGVsbG8=",
    }).success,
    false,
  );
  assert.equal(
    sceneRequestSchema.safeParse({
      consent: true,
      image: "https://example.com/private.jpg",
    }).success,
    false,
  );
  assert.equal(
    sceneResultSchema.safeParse({ ...LAKE_EXAMPLE, person: { landmarks: [] } })
      .success,
    false,
  );
  const invalid = structuredClone(LAKE_EXAMPLE);
  invalid.variants[0].box.x = 0.99;
  assert.equal(sceneResultSchema.safeParse(invalid).success, false);
  const mislabeled = structuredClone(LAKE_EXAMPLE);
  mislabeled.variants[1].box.height = 0.5;
  assert.equal(sceneResultSchema.safeParse(mislabeled).success, false);
  const duplicate = structuredClone(LAKE_EXAMPLE);
  duplicate.variants[1].id = "balanced";
  assert.equal(sceneResultSchema.safeParse(duplicate).success, false);
});
test("both scene provider adapters use the configured vision model and validate its reply", async () => {
  for (const provider of ["openai", "gemini"] as const) {
    const fake = async (url: unknown, options?: RequestInit) => {
      assert.ok(options?.signal);
      const data = JSON.parse(String(options?.body));
      if (provider === "openai") {
        assert.equal(data.model, "vision-example");
        assert.equal(
          data.messages[0].content[1].image_url.url,
          "data:image/jpeg;base64,aGVsbG8=",
        );
      } else {
        assert.match(String(url), /vision-example:generateContent$/);
        assert.equal(
          data.contents[0].parts[1].inlineData.mimeType,
          "image/jpeg",
        );
      }
      const output = JSON.stringify(LAKE_EXAMPLE);
      return new Response(
        JSON.stringify(
          provider === "openai"
            ? { choices: [{ message: { content: output } }] }
            : { candidates: [{ content: { parts: [{ text: output }] } }] },
        ),
      );
    };
    assert.deepEqual(
      await planScene(
        "data:image/jpeg;base64,aGVsbG8=",
        {
          provider,
          key: "test-only",
          model: "vision-example",
          base: "https://example.org/v1",
        },
        fake as typeof fetch,
      ),
      LAKE_EXAMPLE,
    );
  }
});
test("scene HTTP requires authorization and same origin, and does not accept unvalidated model output", async () => {
  let calls = 0;
  const app = createApp({
    runScene: async () => {
      calls++;
      return calls === 1 ? LAKE_EXAMPLE : { invented: "facts" };
    },
  });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  const url = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const payload = { consent: true, image: "data:image/jpeg;base64,aGVsbG8=" };
  const send = (value = payload, origin?: string) =>
    fetch(url + "/api/scene", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { origin } : {}),
      },
      body: JSON.stringify(value),
    });
  try {
    assert.equal((await send({ ...payload, consent: false })).status, 400);
    assert.equal(calls, 0);
    assert.equal(
      (await send(payload, "https://untrusted.example")).status,
      403,
    );
    assert.equal(calls, 0);
    const valid = await send();
    assert.equal(valid.status, 200);
    assert.deepEqual(await valid.json(), LAKE_EXAMPLE);
    const invalid = await send();
    assert.equal(invalid.status, 502);
    assert.match((await invalid.json()).error, /照片已保留/);
    const health = await (await fetch(url + "/api/health")).json();
    assert.equal(health.sceneConfigured, true);
  } finally {
    await new Promise<void>((resolve) => app.close(() => resolve()));
  }
});
