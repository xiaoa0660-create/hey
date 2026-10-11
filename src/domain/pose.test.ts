import test from "node:test";
import assert from "node:assert/strict";
import {
  groupsFromStrokes,
  HintStabilizer,
  mirroredPerson,
  poseHint,
  toPerson,
} from "./pose.ts";
import type { Landmark, Person, Target, Stroke } from "./session.ts";
function person(): Person {
  const p: Landmark[] = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.25,
    visibility: 0,
  }));
  for (const [i, x, y] of [
    [0, 0.5, 0.15],
    [7, 0.46, 0.17],
    [8, 0.54, 0.17],
    [11, 0.4, 0.35],
    [12, 0.6, 0.35],
    [13, 0.3, 0.45],
    [14, 0.7, 0.45],
    [15, 0.28, 0.25],
    [16, 0.72, 0.25],
    [23, 0.44, 0.68],
    [24, 0.56, 0.68],
  ])
    p[i] = { x, y, visibility: 0.95 };
  return toPerson(p)!;
}
const target = (p: Person): Target => ({
  id: "t",
  photoId: "p",
  revision: 1,
  aspect: 0.8,
  person: p,
  box: p.box,
  text: "",
  preparation: [],
  insights: [],
  mode: "partial",
  groups: ["left_arm"],
  features: [],
  ignoreContact: false,
  mirror: false,
});
const stroke = (
  x: number,
  y: number,
  tool: "paint" | "erase" = "paint",
): Stroke => ({ id: "s", tool, radius: 0.04, points: [{ x, y }] });
test("painting a wrist selects its arm, background selects nothing", () => {
  const p = person();
  assert.deepEqual(groupsFromStrokes(p, [stroke(0.28, 0.25)], 0.8), [
    "left_arm",
  ]);
  assert.deepEqual(groupsFromStrokes(p, [stroke(0.95, 0.9)], 0.8), []);
});
test("eraser removes only painted regions and later paint restores them", () => {
  const p = person(),
    s = [stroke(0.28, 0.25), stroke(0.28, 0.25, "erase")];
  assert.deepEqual(groupsFromStrokes(p, s, 0.8), []);
  assert.deepEqual(groupsFromStrokes(p, [...s, stroke(0.28, 0.25)], 0.8), [
    "left_arm",
  ]);
});
test("partial target is invariant to translation and uniform scaling", () => {
  const p = person();
  const shifted = toPerson(
    p.landmarks.map((q) => ({
      ...q,
      x: q.x * 0.8 + 0.15,
      y: q.y * 0.8 + 0.08,
    })),
  )!;
  assert.equal(poseHint(target(p), [shifted]).state, "hold");
  assert.equal(
    poseHint({ ...target(p), features: ["composition"] }, [shifted]).state,
    "adjust",
  );
});
test("occlusion, person loss and multiple people immediately suspend matching", () => {
  const p = person(),
    occluded = structuredClone(p);
  occluded.landmarks[15].visibility = 0.2;
  assert.equal(poseHint(target(p), [occluded]).state, "uncertain");
  assert.equal(poseHint(target(p), []).state, "lost");
  assert.equal(poseHint(target(p), [p, p]).key, "multiple");
});
test("mirroring swaps anatomical sides and restores on second application", () => {
  const p = person(),
    m = mirroredPerson(p);
  assert.equal(m.landmarks[15].x, 1 - p.landmarks[16].x);
  const twice = mirroredPerson(m);
  for (let i = 0; i < 33; i++)
    assert.ok(Math.abs(twice.landmarks[i].x - p.landmarks[i].x) < 1e-10);
  assert.equal(poseHint({ ...target(p), mirror: true }, [m]).state, "hold");
});
test("height-only choice removes lateral arm constraints from live hints", () => {
  const p = person(),
    c = structuredClone(p);
  c.landmarks[15].x += 0.15;
  c.landmarks[13].x += 0.15;
  assert.equal(poseHint(target(p), [c]).state, "adjust");
  assert.equal(
    poseHint({ ...target(p), ignoreContact: true }, [c]).state,
    "hold",
  );
});
test("success requires sustained frames, and loss clears green immediately", () => {
  const p = person(),
    s = new HintStabilizer(),
    hold = poseHint(target(p), [p]);
  assert.notEqual(s.update(hold, 0).state, "hold");
  assert.notEqual(s.update(hold, 700).state, "hold");
  assert.equal(s.update(hold, 1000).state, "hold");
  assert.equal(s.update(poseHint(target(p), []), 1100).state, "lost");
  assert.notEqual(s.update(hold, 1200).state, "hold");
});
test("arm labels follow displayed shoulder positions after a mirrored target", () => {
  const p = person(),
    c = structuredClone(p);
  c.landmarks[15].y += 0.2;
  assert.match(poseHint(target(p), [c]).text, /画面左侧手臂/);
  assert.match(
    poseHint({ ...target(p), mirror: true }, [mirroredPerson(c)]).text,
    /画面右侧手臂/,
  );
});
test("composition-only target never directs the subject's arm", () => {
  const p = person(),
    current = structuredClone(p);
  current.landmarks[15].y += 0.25;
  const hint = poseHint(
    { ...target(p), groups: [], features: ["composition"] },
    [current],
  );
  assert.equal(hint.state, "hold");
  assert.notEqual(hint.actor, "被拍的人");
});
test("frame adjustment directs the photographer before subject pose or occlusion", () => {
  const p = person(),
    current = structuredClone(p);
  current.box = { ...current.box, height: current.box.height * 0.65 };
  current.landmarks[15].visibility = 0.1;
  const hint = poseHint({ ...target(p), features: ["composition"] }, [current]);
  assert.equal(hint.actor, "拍摄的人");
  assert.equal(hint.key, "scale-in");
  assert.match(hint.detail, /对方先保持位置/);
  current.box = { ...p.box };
  assert.equal(
    poseHint({ ...target(p), features: ["composition"] }, [current]).state,
    "uncertain",
  );
});
