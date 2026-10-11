import test from "node:test";
import assert from "node:assert/strict";
import { applyFeedback, displayBox, shootingBrief } from "./collaboration.ts";
import type { Capture, Target } from "./session.ts";

const target: Target = {
  id: "first",
  photoId: "ref",
  revision: 1,
  aspect: 0.8,
  mode: "partial",
  groups: ["right_arm"],
  features: ["composition", "color"],
  ignoreContact: true,
  mirror: false,
  person: null,
  box: { x: 0.3, y: 0.1, width: 0.4, height: 0.8 },
  text: "",
  preparation: ["保留暖色"],
  insights: [],
};
const capture = {
  targetId: "first",
  framing: { x: 0.35, y: 0.15, width: 0.3, height: 0.6 },
} as Capture;
test("feedback scales measured frame rather than old reference and preserves other choices", () => {
  const next = applyFeedback(target, capture, "smaller");
  assert.ok(Math.abs(next.box.height - 0.6 * 0.86) < 1e-9);
  assert.ok(Math.abs(next.box.x + next.box.width / 2 - 0.5) < 1e-9);
  assert.deepEqual(next.groups, target.groups);
  assert.deepEqual(next.features, target.features);
  assert.equal(next.ignoreContact, true);
  assert.notEqual(next.id, target.id);
  assert.equal(next.revision, 2);
  assert.equal(target.box.height, 0.8);
});
test("mirrored feedback preserves displayed position and stays inside the frame", () => {
  const mirrored = {
    ...target,
    mirror: true,
    box: { x: 0.1, y: 0.2, width: 0.3, height: 0.6 },
  };
  const before = displayBox(mirrored),
    next = applyFeedback(mirrored, capture, "background"),
    after = displayBox(next);
  assert.equal(next.mirror, true);
  assert.ok(
    Math.abs(before.x + before.width / 2 - after.x - after.width / 2) < 1e-9,
  );
  assert.ok(
    after.x >= 0 &&
      after.y >= 0 &&
      after.x + after.width <= 1 &&
      after.y + after.height <= 1,
  );
  assert.match(next.adjustment!.note, /背景内容请在现场自行确认/);
});
test("subject can opt out of pose without losing framing, mood or mirror", () => {
  const next = applyFeedback({ ...target, mirror: true }, capture, "free-pose");
  assert.deepEqual(next.groups, []);
  assert.deepEqual(next.features, target.features);
  assert.deepEqual(next.box, target.box);
  assert.equal(next.mirror, true);
  assert.equal(shootingBrief(next).freePose, true);
  assert.match(shootingBrief(next).subject, /动作自由/);
});
test("missing capture measurement falls back explicitly, unknown framing is not invented", () => {
  const next = applyFeedback(target, {} as Capture, "smaller");
  assert.match(next.adjustment!.note, /按原目标微调/);
  assert.throws(
    () =>
      applyFeedback(
        { ...target, features: ["color"] },
        {} as Capture,
        "smaller",
      ),
    /没有可靠的人物范围/,
  );
});
test("enlargement that cannot fit preserves existing target and asks for a new position", () => {
  assert.throws(
    () =>
      applyFeedback(
        { ...target, box: { x: 0, y: 0, width: 0.1, height: 0.2 } },
        capture,
        "larger",
      ),
    /没有足够空间/,
  );
  assert.equal(target.box.height, 0.8);
});
