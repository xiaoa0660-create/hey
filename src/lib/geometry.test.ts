import test from "node:test";
import assert from "node:assert/strict";
import {
  aspectOf,
  boundRect,
  center,
  changed,
  distance,
  initialCrop,
  makeGuide,
  recrop,
  resizeCrop,
  resizeRect,
  space,
  validRect,
} from "./geometry.ts";
import type { Goal, Photo, Rect, Side, Subject } from "./types.ts";

const subject = (r: Partial<Rect> = {}): Subject => ({
  x: 0.35,
  y: 0.2,
  width: 0.3,
  height: 0.6,
  source: "manual",
  confirmed: true,
  ...r,
});
const close = (a: number, b: number) =>
  assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);
const ref = subject();

for (const goal of ["position", "scale", "negative_space"] as Goal[]) {
  test(`identical boxes produce no forced action: ${goal}`, () => {
    const result = makeGuide(ref, ref, goal, "left");
    assert.equal(result.matched, true);
    assert.equal(result.kind, "matched");
  });
}
for (const [box, direction] of [
  [{ x: 0.1 }, "right"],
  [{ x: 0.6 }, "left"],
  [{ y: 0 }, "down"],
  [{ y: 0.4 }, "up"],
] as const) {
  test(`position points ${direction} in final image`, () => {
    const shot = subject(box),
      guide = makeGuide(ref, shot, "position", "left");
    assert.equal(guide.direction, direction);
    assert.ok(validRect(guide.target));
    assert.ok(
      distance(ref, guide.target, "position", "left") <
        distance(ref, shot, "position", "left"),
    );
  });
}
test("position adjusts the dominant axis only", () => {
  const shot = subject({ x: 0.12, y: 0.08 });
  const guide = makeGuide(ref, shot, "position", "left");
  assert.equal(guide.target.y, shot.y);
  close(center(guide.target).x, center(ref).x);
});
test("scale uses visible height rather than width", () => {
  assert.equal(
    makeGuide(ref, subject({ width: 0.5 }), "scale", "left").matched,
    true,
  );
  const large = makeGuide(
    ref,
    subject({ y: 0.05, height: 0.9 }),
    "scale",
    "left",
  );
  const small = makeGuide(ref, subject({ height: 0.4 }), "scale", "left");
  assert.equal(large.direction, "out");
  assert.equal(small.direction, "in");
  close(large.target.height, ref.height);
  close(small.target.height, ref.height);
});
for (const side of ["left", "right", "top"] as Side[]) {
  test(`space target really matches selected ${side} edge`, () => {
    const shot = subject(side === "top" ? { y: 0.05 } : { x: 0.1 });
    const guide = makeGuide(ref, shot, "negative_space", side);
    close(space(guide.target, side), space(ref, side));
    assert.ok(validRect(guide.target));
    assert.equal(guide.direction, side === "top" ? "down" : "right");
  });
}
test("large subject gets a shrink action before an impossible translation", () => {
  const target = subject({ x: 0.7, width: 0.2 });
  const shot = subject({ x: 0.1, width: 0.8 });
  for (const goal of ["position", "negative_space"] as Goal[]) {
    const guide = makeGuide(target, shot, goal, "left");
    assert.equal(guide.kind, "scale");
    assert.equal(guide.direction, "out");
    assert.ok(validRect(guide.target));
    assert.ok(guide.target.width < shot.width);
  }
});
test("comparison reports improvement, worsening and no meaningful change", () => {
  assert.equal(
    changed(
      ref,
      subject({ x: 0.1 }),
      subject({ x: 0.3 }),
      "negative_space",
      "left",
    ).direction,
    "closer",
  );
  assert.equal(
    changed(
      ref,
      subject({ x: 0.3 }),
      subject({ x: 0.1 }),
      "negative_space",
      "left",
    ).direction,
    "further",
  );
  assert.equal(
    changed(ref, ref, subject({ x: 0.351 }), "position", "left").direction,
    "similar",
  );
  assert.equal(
    changed(ref, subject({ x: 0.1 }), ref, "position", "left").matched,
    true,
  );
});
test("small differences stay inside a configured tolerance", () => {
  assert.equal(
    makeGuide(ref, subject({ x: 0.36 }), "position", "left").matched,
    true,
  );
  assert.equal(
    makeGuide(ref, subject({ height: 0.61 }), "scale", "left").matched,
    true,
  );
});
test("missing confirmation, nonfinite and out-of-frame inputs cannot produce guidance", () => {
  assert.throws(() =>
    makeGuide(ref, { ...ref, confirmed: false }, "position", "left"),
  );
  for (const r of [{ x: -0.1 }, { y: NaN }, { width: 1.2 }, { height: 0 }]) {
    assert.throws(() => makeGuide(ref, subject(r), "position", "left"));
  }
});
test("portrait and landscape sources yield the same selected output aspect", () => {
  for (const [width, height] of [
    [1600, 900],
    [900, 1600],
  ]) {
    for (const aspect of [0.75, 0.8, width / height]) {
      const crop = initialCrop(width, height, aspect);
      assert.ok(validRect(crop));
      close((width * crop.width) / (height * crop.height), aspect);
    }
  }
});
test("recrop converts from original coordinates into the new image plane", () => {
  const p: Photo = {
    id: "a",
    url: "",
    name: "",
    width: 1000,
    height: 1000,
    sample: false,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    subject: subject({ x: 0.4, y: 0.3, width: 0.2, height: 0.4 }),
  };
  const next = recrop(p, { x: 0.25, y: 0, width: 0.5, height: 1 });
  close(next.subject.x, 0.3);
  close(next.subject.width, 0.4);
  close(next.subject.y, 0.3);
  assert.equal(next.subject.confirmed, false);
  close(aspectOf(next), 0.5);
});
test("subject outside the new crop requires reconfirmation of a valid fresh box", () => {
  const p: Photo = {
    id: "a",
    url: "",
    name: "",
    width: 1000,
    height: 1000,
    sample: false,
    crop: { x: 0, y: 0, width: 1, height: 1 },
    subject: subject({ x: 0.7, width: 0.2 }),
  };
  const next = recrop(p, { x: 0, y: 0, width: 0.3, height: 1 });
  assert.ok(validRect(next.subject));
  assert.equal(next.subject.confirmed, false);
});
test("drag and resize keep both boxes and crop handles inside the image", () => {
  for (const corner of ["nw", "ne", "sw", "se"])
    for (const dx of [-2, -0.31, 0, 0.31, 2])
      for (const dy of [-2, -0.31, 0, 0.31, 2]) {
        const start = { x: 0.15, y: 0.12, width: 0.6, height: 0.75 };
        assert.ok(validRect(resizeRect(start, corner, dx, dy)));
        const crop = resizeCrop(start, corner, dx, dy);
        assert.ok(validRect(crop), JSON.stringify(crop));
        close(crop.width / crop.height, start.width / start.height);
        assert.ok(
          validRect(boundRect({ ...start, x: start.x + dx, y: start.y + dy })),
        );
      }
});
