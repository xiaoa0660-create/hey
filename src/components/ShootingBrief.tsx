import { ArrowRight, Camera, Check, UserRound } from "lucide-react";
import type { Photo } from "../lib/types";
import type { Target } from "../domain/session";
import { priorities, PRIORITIES, shootingBrief } from "../domain/collaboration";
import { CropImage } from "./PhotoView";

export default function ShootingBrief({
  reference,
  target,
  onStart,
  onEdit,
}: {
  reference: Photo;
  target: Target;
  onStart: () => void;
  onEdit: () => void;
}) {
  const brief = shootingBrief(target);
  return (
    <div className="v3-handoff" data-testid="handoff-card">
      <div className="v3-handoff-intro">
        <div
          className="v3-handoff-photo"
          style={{
            aspectRatio: target.aspect,
            transform: target.mirror ? "scaleX(-1)" : undefined,
          }}
        >
          <CropImage photo={reference} alt="这次共同的拍摄参考" />
        </div>
        <div>
          <span className="eyebrow">ONE PHOTO. TWO OF YOU.</span>
          <h3>这张照片，我们这样拍。</h3>
          <div className="v3-priority-tags">
            {priorities(target).map((id) => (
              <span key={id}>
                <Check size={12} />
                {PRIORITIES.find((p) => p.id === id)!.title}
              </span>
            ))}
            {target.mirror && <span>镜像参考</span>}
          </div>
          <p>
            {brief.freePose
              ? "只保留在意的感觉，动作由你决定。"
              : "先把画面调好，再按需参考动作。"}
          </p>
        </div>
      </div>
      {target.adjustment && (
        <p className="v3-retry-note" data-testid="handoff-adjustment">
          {target.adjustment.note}
        </p>
      )}
      <div className="v3-role-cards">
        <section>
          <span>
            <UserRound size={16} /> 给镜头前的你
          </span>
          <p>{brief.subject}</p>
        </section>
        <section>
          <span>
            <Camera size={16} /> 给拿手机的你
          </span>
          <p>{brief.camera}</p>
        </section>
      </div>
      {brief.mood.length > 0 && (
        <details className="v3-brief-notes">
          <summary>一起看一下拍前建议</summary>
          {brief.mood.map((i) => (
            <p key={i.id}>
              <strong>{i.title}</strong> · {i.summary}
            </p>
          ))}
        </details>
      )}
      <p className="v3-handoff-instruction">
        现在把手机交给帮你拍照的人。接过手机后，按下面的按钮开始。
      </p>
      <button className="button primary full" onClick={onStart}>
        我来拍，打开相机 <ArrowRight size={17} />
      </button>
      <button className="v2-text-link" onClick={onEdit}>
        还想改一下目标
      </button>
    </div>
  );
}
