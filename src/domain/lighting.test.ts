import test from "node:test";
import assert from "node:assert/strict";
import { activeLighting, lightingAdapted, regionLight } from "./lighting.ts";
import type { Target } from "./session.ts";

function pixels(
  width: number,
  height: number,
  value: (x: number, y: number) => number,
) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = value(x, y);
      data[i + 3] = 255;
    }
  return data;
}
test("person-region brightness excludes the bright background outside its rectangle", () => {
  const data = pixels(20, 20, (x) => (x < 10 ? 50 : 255));
  const reading = regionLight(data, 20, 20, {
    x: 0,
    y: 0,
    width: 0.5,
    height: 1,
  })!;
  assert.equal(reading.median, 50);
  assert.equal(reading.bright, 0);
  assert.equal(reading.samples, 200);
});
test("black and white fractions describe pixels without an aesthetic verdict", () => {
  const reading = regionLight(
    pixels(20, 20, (x) => (x < 5 ? 0 : x < 10 ? 255 : 100)),
    20,
    20,
    { x: 0, y: 0, width: 1, height: 1 },
  )!;
  assert.equal(reading.dark, 0.25);
  assert.equal(reading.bright, 0.25);
  assert.equal(reading.median, 100);
});
test("regions are clipped to actual image pixels and invalid or too small bounds are unavailable", () => {
  const data = pixels(20, 20, () => 120);
  assert.equal(
    regionLight(data, 20, 20, { x: -0.5, y: -0.5, width: 1, height: 1 })
      ?.samples,
    100,
  );
  for (const box of [
    { x: 2, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: 0.01, height: 0.01 },
    { x: NaN, y: 0, width: 1, height: 1 },
    { x: 0, y: 0, width: -1, height: 1 },
  ])
    assert.equal(regionLight(data, 20, 20, box), null);
  assert.equal(
    regionLight(data, 10, 10, { x: 0, y: 0, width: 1, height: 1 }),
    null,
  );
});
test("transparent pixels do not become fictional dark measurements", () => {
  assert.equal(
    regionLight(new Uint8ClampedArray(1600), 20, 20, {
      x: 0,
      y: 0,
      width: 1,
      height: 1,
    }),
    null,
  );
});
test("a stored light plan cannot generate guidance when lighting is deselected", () => {
  const target = {
    features: ["composition"],
    lighting: { reference: "night", setup: "overcast" },
  } as Target;
  assert.equal(activeLighting(target), null);
  target.features.push("light");
  assert.equal(activeLighting(target)?.title, "阴天漫射光");
  target.lighting!.setup = null;
  assert.equal(activeLighting(target), null);
});
test("an adapted scene is distinguished from the reference and manual unknowns", () => {
  assert.equal(lightingAdapted({ reference: "night", setup: "window" }), true);
  assert.equal(
    lightingAdapted({ reference: "window", setup: "window" }),
    false,
  );
  assert.equal(lightingAdapted({ reference: null, setup: "window" }), false);
});
