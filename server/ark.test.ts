import test from "node:test";
import assert from "node:assert/strict";
import { modelConfig, interpret } from "./provider.ts";
import { planScene } from "./scene-provider.ts";
import { requestArkText } from "./ark.ts";
import { LAKE_EXAMPLE } from "../src/product/scene.ts";
import { requestSchema } from "./schema.ts";

const image = "data:image/jpeg;base64,aGVsbG8=";
const config = modelConfig({
  VISION_PROVIDER: "ark",
  VISION_MODEL: "doubao-seed-2-1-pro-260915",
  VISION_API_KEY: "test-only",
})!;
const completed = (text: string) => ({
  status: "completed",
  output: [
    { type: "reasoning", content: [{ type: "output_text", text: "not the answer" }] },
    { type: "message", role: "assistant", content: [{ type: "output_text", text }] },
  ],
});

test("Ark requires an explicit model and key, and defaults to the official v3 base", () => {
  assert.equal(config.base, "https://ark.cn-beijing.volces.com/api/v3");
  assert.equal(modelConfig({ VISION_PROVIDER: "ark", VISION_API_KEY: "test-only" }), null);
  assert.equal(modelConfig({ VISION_PROVIDER: "ark", VISION_MODEL: config.model }), null);
});

test("Ark scene request uses image input and final Responses text, with no stored conversation", async () => {
  const fake = async (url: unknown, options?: RequestInit) => {
    assert.equal(url, "https://ark.cn-beijing.volces.com/api/v3/responses");
    assert.equal((options?.headers as Record<string, string>).Authorization, "Bearer test-only");
    assert.ok(options?.signal);
    const body = JSON.parse(String(options?.body));
    assert.equal(body.model, config.model);
    assert.deepEqual(body.input[0].content[1], { type: "input_image", image_url: image });
    assert.equal(body.input[0].content[0].type, "input_text");
    assert.deepEqual(body.thinking, { type: "disabled" });
    assert.deepEqual(body.text, { format: { type: "json_object" } });
    assert.equal(body.store, false);
    assert.equal(body.stream, false);
    assert.equal(body.max_output_tokens, 2400);
    return Response.json(completed(JSON.stringify(LAKE_EXAMPLE)));
  };
  assert.deepEqual(await planScene(image, config, fake as typeof fetch), LAKE_EXAMPLE);
  await assert.rejects(planScene(image, config, (async () => Response.json(completed('{"invented":"facts"}'))) as typeof fetch));
});

test("Ark reference interpretation preserves the existing contract validation", async () => {
  const input = requestSchema.parse({
    consent: true, image, text: "只学左臂", availableGroups: ["left_arm"],
    personBox: { x: 0.2, y: 0.1, width: 0.5, height: 0.7 },
    draft: { mode: "partial", groups: ["left_arm"], features: [], ignoreContact: false, mirror: false },
    selection: [],
  });
  const output = { draft: input.draft, insights: [], explanation: "完成" };
  assert.equal((await interpret(input, config, (async () => Response.json(completed(JSON.stringify(output)))) as typeof fetch)).explanation, "完成");
  await assert.rejects(interpret(input, config, (async () => Response.json(completed(JSON.stringify({ ...output, draft: { ...input.draft, groups: ["right_arm"] } })))) as typeof fetch));
});

test("Ark never treats incomplete, failed, refused or reasoning-only output as a successful answer", async () => {
  for (const value of [
    { ...completed("{}"), status: "incomplete" },
    { ...completed("{}"), status: "failed", error: { message: "private detail" } },
    { status: "completed", output: [{ type: "reasoning", content: [{ type: "output_text", text: "{}" }] }] },
    { status: "completed", output: [{ type: "message", role: "assistant", content: [{ type: "refusal" }] }] },
    completed("x".repeat(30001)),
  ]) {
    await assert.rejects(requestArkText(image, "test", config, 2400, (async () => Response.json(value)) as typeof fetch));
  }
  await assert.rejects(requestArkText(image, "test", config, 2400, (async () => new Response("private detail", { status: 401 })) as typeof fetch), /暂不可用/);
});
