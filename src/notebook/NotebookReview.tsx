import { useState } from "react";
import type { Capture } from "../domain/session";
import { canAdjustFraming } from "../domain/collaboration";
import { NEXT_CHANGES, nextTarget } from "./experience";
import type { NotebookTarget, NextChange } from "./experience";

export default function NotebookReview({
  target,
  capture,
  onFeedback,
}: {
  target: NotebookTarget;
  capture: Capture;
  onFeedback: (next: NotebookTarget) => void;
}) {
  const [keep, setKeep] = useState<string[]>([]),
    [change, setChange] = useState<NextChange | null>(null);
  let next: NotebookTarget | null = null,
    error = "";
  if (change) {
    try {
      next = nextTarget(target, capture, change, keep);
    } catch (e) {
      error = (e as Error).message;
    }
  }
  return (
    <section className="nb-review" aria-label="下一张只改一点">
      <span className="nb-kicker">一起看看这一张</span>
      <h2>喜欢的留下，只改一点。</h2>
      <p>把手机给镜头前的朋友看看。这里由你们判断，不给长相或审美打分。</p>
      <h3>
        已经喜欢哪些？ <small>可选</small>
      </h3>
      <div className="nb-keep">
        {["构图", "动作", "光线", "背景"].map((k) => (
          <button
            key={k}
            aria-pressed={keep.includes(k)}
            onClick={() =>
              setKeep((v) =>
                v.includes(k) ? v.filter((s) => s !== k) : [...v, k],
              )
            }
          >
            {keep.includes(k) ? "✓ " : "+ "}
            {k}
          </button>
        ))}
      </div>
      <h3>下一张最想改什么？</h3>
      <div className="nb-feedback">
        {NEXT_CHANGES.map((item) => (
          <button
            key={item.id}
            aria-pressed={change === item.id}
            disabled={
              ["smaller", "larger"].includes(item.id) &&
              !canAdjustFraming(target, capture)
            }
            onClick={() => setChange(change === item.id ? null : item.id)}
          >
            <b>{item.label}</b>
            <small>{item.detail}</small>
          </button>
        ))}
      </div>
      {!canAdjustFraming(target, capture) && (
        <small>
          人物范围不稳定，暂时不能自动调整大小。可以返回目标页手动确认。
        </small>
      )}
      {change && (
        <div className="nb-next-change" role="status">
          <p>{error || next?.notebook?.retryTip}</p>
          {keep.length > 0 && (
            <small>
              你希望保留：{keep.join("、")}
              。改变光线或角度可能牵动画面，拍前请再看一眼。
            </small>
          )}
          <button
            className="button primary full"
            disabled={!next}
            onClick={() => next && onFeedback(next)}
          >
            只改这一点，继续拍 →
          </button>
        </div>
      )}
    </section>
  );
}
