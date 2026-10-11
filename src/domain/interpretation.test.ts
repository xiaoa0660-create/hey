import test from "node:test";
import assert from "node:assert/strict";
import {
  parseLocalEdit,
  localInsights,
  canConfirm,
  describeTarget,
} from "./interpretation.ts";
import type { TargetDraft } from "./session.ts";
const draft: TargetDraft = {
  mode: "whole",
  groups: ["left_arm", "right_arm"],
  features: ["composition", "styling", "light"],
  ignoreContact: false,
  mirror: false,
};
test("editing the generated whole brief preserves unrelated preparation and composition targets", () => {
  const base = {
    ...draft,
    ignoreContact: true,
    mirror: true,
    features: [...draft.features, "color" as const],
  };
  const value = describeTarget(base).replace("保留参考色调", "保留参考的暖色");
  const result = parseLocalEdit(value, base, ["left_arm", "right_arm"]);
  assert.ok(result.ok);
  assert.deepEqual(
    [...result.draft.features].sort(),
    [...base.features].sort(),
  );
  assert.equal(result.draft.mirror, true);
});
test("editable brief changes actual constraints, including ignoring contact", () => {
  const result = parseLocalEdit(
    "只学抬手，不要手贴脸；保留参考的暖色，背景自由。",
    draft,
    ["left_arm", "right_arm"],
  );
  assert.ok(result.ok);
  assert.deepEqual(result.draft.features, ["color"]);
  assert.equal(result.draft.ignoreContact, true);
  assert.deepEqual(result.draft.groups, ["left_arm", "right_arm"]);
});
test("unknown instructions do not silently confirm old targets", () => {
  const result = parseLocalEdit("把焦距设成 85mm，替我变成夕阳", draft, [
    "left_arm",
  ]);
  assert.equal(result.ok, false);
  assert.deepEqual(draft.features, ["composition", "styling", "light"]);
});
test("cannot request a missing arm", () =>
  assert.equal(parseLocalEdit("只学右臂", draft, ["left_arm"]).ok, false));
test("background-only selection without confirmed person cannot proceed", () =>
  assert.equal(
    canConfirm({ ...draft, groups: [], features: [] }, null, false),
    false,
  ));
test("unknown optical facts remain unknown and non-live", () => {
  const result = localInsights({ x: 0.2, y: 0.1, width: 0.5, height: 0.7 });
  for (const id of ["viewpoint", "focus", "light"]) {
    const i = result.find((i) => i.id === id)!;
    assert.equal(i.confidence, "unknown");
    assert.equal(i.support, "preparation");
  }
});
