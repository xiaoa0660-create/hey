import test from "node:test";
import assert from "node:assert/strict";
import { nextTarget, sceneAdvice } from "./experience.ts";
import type { NotebookTarget, Scene } from "./experience.ts";
import type { Capture } from "../domain/session.ts";

const target: NotebookTarget = {
  id: "first",
  photoId: "reference",
  revision: 1,
  aspect: 0.8,
  mode: "partial",
  groups: ["right_arm"],
  features: ["composition", "color"],
  ignoreContact: true,
  mirror: true,
  person: null,
  box: { x: 0.3, y: 0.1, width: 0.4, height: 0.8 },
  text: "保留参考",
  preparation: [],
  insights: [],
  lighting: { reference: "window", setup: "window" },
  notebook: { motion: "none" },
};
const capture = {
  targetId: "first",
  framing: { x: 0.35, y: 0.15, width: 0.3, height: 0.6 },
} as Capture;
const scene: Scene = {
  light: "overcast",
  background: "busy",
  space: "tight",
  approach: "here",
};
test("scene tradeoff uses actual light for here, requested light only after choosing to relocate", () => {
  assert.equal(sceneAdvice(scene, "window").setup, "overcast");
  assert.equal(sceneAdvice(scene, "window").moving, false);
  assert.match(sceneAdvice(scene, "window").tradeoff, /不会与参考完全一样/);
  const closer = sceneAdvice({ ...scene, approach: "closer" }, "window");
  assert.equal(closer.setup, "window");
  assert.equal(closer.moving, true);
  assert.match(closer.tradeoff, /需要找新的位置/);
  assert.match(sceneAdvice(scene, "window").subject, /不安排走动/);
});
test("no reference and matching light never invent a need to relocate", () => {
  assert.equal(
    sceneAdvice({ ...scene, approach: "closer" }, null).setup,
    "overcast",
  );
  assert.equal(
    sceneAdvice({ ...scene, approach: "closer" }, "overcast").moving,
    false,
  );
});
test("natural movement clears fixed pose constraints without losing geometry, light or mirror", () => {
  const next = nextTarget(target, capture, "natural", ["构图", "光线"]);
  assert.deepEqual(next.groups, []);
  assert.equal(next.notebook?.motion, "turn");
  assert.match(next.text, /不跟随姿势/);
  assert.match(next.text, /只改动作/);
  assert.deepEqual(next.box, target.box);
  assert.deepEqual(next.lighting, target.lighting);
  assert.equal(next.mirror, true);
  assert.notEqual(next.id, target.id);
  assert.deepEqual(target.groups, ["right_arm"]);
});
test("locked preference conflicts are rejected instead of silently changed", () => {
  assert.throws(
    () => nextTarget(target, capture, "natural", ["动作"]),
    /已经选为保留/,
  );
  assert.throws(
    () => nextTarget(target, capture, "smaller", ["构图"]),
    /已经选为保留/,
  );
  assert.throws(
    () => nextTarget(target, capture, "dark", ["光线"]),
    /已经选为保留/,
  );
});
test("framing feedback uses measured capture, preserves motion metadata and input", () => {
  const next = nextTarget(
    { ...target, notebook: { motion: "hands", scene } },
    capture,
    "smaller",
    ["动作"],
  );
  assert.ok(Math.abs(next.box.height - 0.6 * 0.86) < 1e-8);
  assert.equal(next.notebook?.motion, "hands");
  assert.deepEqual(next.notebook?.scene, scene);
  assert.equal(target.box.height, 0.8);
});
test("subjective darkness and clutter feedback does not invent measurements or change raw exposure", () => {
  for (const change of ["dark", "clutter"] as const) {
    const next = nextTarget(target, capture, change, []);
    assert.deepEqual(next.box, target.box);
    assert.deepEqual(next.lighting, target.lighting);
    assert.deepEqual(next.features, target.features);
    assert.ok(next.notebook?.retryTip);
    assert.equal(next.adjustment, undefined);
  }
});
