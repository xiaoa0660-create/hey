import { useEffect, useState } from "react";
import type { Photo } from "../lib/types";
import type { Capture, Target } from "../domain/session";
import { activeLighting, regionLight } from "../domain/lighting";
import type { RegionLight } from "../domain/lighting";
import { photoCanvas } from "../lib/images";

export default function LightReview({
  reference,
  capture,
  target,
  onEdit,
}: {
  reference: Photo;
  capture: Capture;
  target: Target;
  onEdit: () => void;
}) {
  const [readings, setReadings] = useState<{
    reference: RegionLight;
    capture: RegionLight;
  } | null>(null);
  const [pending, setPending] = useState(true);
  const enabled =
    target.features.includes("light") || target.features.includes("exposure");
  useEffect(() => {
    let cancelled = false;
    setReadings(null);
    setPending(true);
    const box =
      target.person?.box ??
      (reference.subject.confirmed ? reference.subject : null);
    if (!enabled || !box || !capture.framing) {
      setPending(false);
      return;
    }
    void Promise.all([
      photoCanvas(reference, 256),
      photoCanvas(capture.photo, 256),
    ])
      .then(([a, b]) => {
        const ref = regionLight(
          a.getContext("2d")!.getImageData(0, 0, a.width, a.height).data,
          a.width,
          a.height,
          box,
        );
        const shot = regionLight(
          b.getContext("2d")!.getImageData(0, 0, b.width, b.height).data,
          b.width,
          b.height,
          capture.framing!,
        );
        if (!cancelled && ref && shot)
          setReadings({ reference: ref, capture: shot });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reference, capture, target, enabled]);
  if (!enabled) return null;
  const recipe = activeLighting(target);
  return (
    <section className="v4-light-review" aria-label="拍后明暗对照">
      <span className="eyebrow">LIGHT, BEFORE FILTERS</span>
      <h2>先看光，再决定要不要调色。</h2>
      {readings ? (
        <>
          <div className="v4-light-meters">
            {(
              [
                ["参考", readings.reference],
                ["原片", readings.capture],
              ] as const
            ).map(([label, r]) => (
              <div key={label}>
                <span>
                  {label}
                  <b>暗 ← → 亮</b>
                </span>
                <div
                  className="v4-light-ramp"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={255}
                  aria-valuenow={r.median}
                  aria-label={`${label}人物框亮度中位数`}
                >
                  <i style={{ left: `${(r.median / 255) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p>
            标记表示人物范围的明暗。衣服与背景也会影响结果；请重点看看脸部是否保留了你想要的细节。
          </p>
          <details>
            <summary>这项对照怎么看？</summary>
            <p>
              取人物框像素的亮度中位数，不是脸部曝光评分。参考与原片使用各自的人物范围。
            </p>
            <p>
              原片框内约 {Math.round(readings.capture.dark * 100)}%
              像素接近黑色，
              {Math.round(readings.capture.bright * 100)}%
              接近白色。深色衣服、夜景和逆光本来就可能有较大的明暗差。
            </p>
          </details>
        </>
      ) : (
        <p>
          {pending
            ? "正在读取两张图的人物范围…"
            : "这次没有获得足够可靠的人物范围，先直接对照原片与参考，不生成明暗数值。"}
        </p>
      )}
      <details>
        <summary>脸太暗或太亮，下一张怎么改？</summary>
        <p>
          {recipe?.exposure ??
            "先让人物朝向现有亮处，再看脸部细节；不要只依据全图亮度判断曝光。"}
        </p>
        <button className="v2-text-link" onClick={onEdit}>
          回到用光方案调整 →
        </button>
      </details>
    </section>
  );
}
