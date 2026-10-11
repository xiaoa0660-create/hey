import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import { createApp } from "./app.ts";
import { requestSchema, validateResult } from "./schema.ts";
import { interpret, modelConfig } from "./provider.ts";
const input = requestSchema.parse({
  consent: true,
  image: "data:image/jpeg;base64,aGVsbG8=",
  text: "只学左臂",
  availableGroups: ["left_arm"],
  personBox: { x: 0.2, y: 0.1, width: 0.5, height: 0.7 },
  draft: {
    mode: "partial",
    groups: ["left_arm"],
    features: [],
    ignoreContact: false,
    mirror: false,
  },
  selection: [],
});
test("request requires consent, valid coordinates and bounded images", () => {
  assert.equal(
    requestSchema.safeParse({ ...input, consent: false }).success,
    false,
  );
  assert.equal(
    requestSchema.safeParse({
      ...input,
      image: "https://internal.invalid/photo",
    }).success,
    false,
  );
  assert.equal(
    requestSchema.safeParse({ ...input, text: "x".repeat(2001) }).success,
    false,
  );
});
test("model output is validated and cannot invent capability levels", () => {
  const output = {
    draft: input.draft,
    insights: [
      {
        id: "light",
        summary: "观察现场光线",
        evidence: "光源不确定",
        confidence: "unknown",
      },
    ],
    explanation: "建议",
  };
  assert.equal(
    validateResult(output, input).insights[0].support,
    "preparation",
  );
  assert.throws(() =>
    validateResult(
      { ...output, draft: { ...input.draft, groups: ["right_arm"] } },
      input,
    ),
  );
  assert.throws(() =>
    validateResult({ ...output, hardware: { exposure: 10 } }, input),
  );
});
test("unconfigured model has no fabricated default model name", () => {
  assert.equal(modelConfig({}), null);
  assert.equal(
    modelConfig({ VISION_PROVIDER: "gemini", GEMINI_API_KEY: "test" }),
    null,
  );
});
test("provider sends only configured model with abort deadline and parses structured output", async () => {
  let observed = false;
  const response = { draft: input.draft, insights: [], explanation: "完成" };
  const fake = async (url: unknown, options?: RequestInit) => {
    assert.equal(url, "https://example.org/v1/chat/completions");
    assert.ok(options?.signal);
    assert.equal(JSON.parse(String(options?.body)).model, "configured-model");
    observed = true;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(response) } }],
      }),
      { status: 200 },
    );
  };
  const result = await interpret(
    input,
    {
      provider: "openai",
      base: "https://example.org/v1",
      key: "test-only",
      model: "configured-model",
    },
    fake as typeof fetch,
  );
  assert.equal(result.explanation, "完成");
  assert.ok(observed);
});
test("HTTP rejects malformed requests, enforces body limits and returns model errors safely", async (t) => {
  const app = createApp({
    run: async () => {
      throw new Error("secret-upstream-detail");
    },
  });
  app.listen(0, "127.0.0.1");
  await once(app, "listening");
  t.after(() => app.close());
  const base = `http://127.0.0.1:${(app.address() as AddressInfo).port}`;
  const post = (body: unknown) =>
    fetch(base + "/api/interpret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  assert.equal((await post({})).status, 400);
  const failed = await post(input);
  assert.equal(failed.status, 502);
  assert.ok(!(await failed.text()).includes("secret-upstream-detail"));
  assert.equal(
    (await post({ ...input, text: "a".repeat(3_600_000) })).status,
    413,
  );
  const health = await fetch(base + "/api/health").then((r) => r.json());
  assert.equal(health.configured, true);
});

test("Gemini adapter uses inline image, configured model and strict result validation", async () => {
  const fake = async (url: unknown, options?: RequestInit) => {
    assert.equal(
      url,
      "https://example.org/v1beta/models/configured-model:generateContent",
    );
    const body = JSON.parse(String(options?.body));
    assert.equal(body.contents[0].parts[1].inlineData.mimeType, "image/jpeg");
    assert.ok(body.contents[0].parts[0].text.includes("personBox"));
    return new Response(
      JSON.stringify({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    draft: input.draft,
                    insights: [],
                    explanation: "解读完成",
                  }),
                },
              ],
            },
          },
        ],
      }),
    );
  };
  assert.equal(
    (
      await interpret(
        input,
        {
          provider: "gemini",
          base: "https://example.org/v1beta",
          key: "test-only",
          model: "configured-model",
        },
        fake as typeof fetch,
      )
    ).explanation,
    "解读完成",
  );
});
