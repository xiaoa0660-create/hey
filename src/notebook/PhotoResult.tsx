import type { NotebookTarget as Target } from "./experience";
import NotebookReview from "./NotebookReview";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  RefreshCw,
  SlidersHorizontal,
} from "lucide-react";
import type { Photo } from "../lib/types";
import type { Capture } from "../domain/session";
import { CropImage } from "../components/PhotoView";
import { aspectOf } from "../lib/geometry";
import { downloadCanvas, photoCanvas } from "../lib/images";
import { tonedCanvas } from "../lib/imaging";
import LightReview from "../components/LightReview";
import { LIGHT_RECIPES } from "../domain/lighting";
const initial = { warmth: 0, brightness: 0, contrast: 0, strength: 1 };
export default function PhotoResult({
  reference,
  capture,
  target,
  onFeedback,
  onRetry,
  onEdit,
  onHome,
}: {
  reference: Photo;
  capture: Capture;
  target: Target;
  onFeedback: (target: Target) => void;
  onRetry: () => void;
  onEdit: () => void;
  onHome: () => void;
}) {
  const toneStyle = target.lighting?.reference ?? target.lighting?.setup;
  const toneRecipe = toneStyle ? LIGHT_RECIPES[toneStyle] : null;
  const [adjust, setAdjust] = useState(initial),
    [toning, setToning] = useState(false),
    [preview, setPreview] = useState(false),
    [status, setStatus] = useState(""),
    [busy, setBusy] = useState(false),
    canvas = useRef<HTMLCanvasElement>(null),
    version = useRef(0);
  useEffect(() => {
    const id = ++version.current;
    if (!preview) return;
    const timer = setTimeout(
      () =>
        void tonedCanvas(capture.photo, adjust)
          .then((result) => {
            if (id !== version.current || !canvas.current) return;
            canvas.current.width = result.width;
            canvas.current.height = result.height;
            canvas.current.getContext("2d")!.drawImage(result, 0, 0);
          })
          .catch(() => setStatus("预览没有更新，原片仍完整保留。")),
      100,
    );
    return () => {
      clearTimeout(timer);
      version.current++;
    };
  }, [adjust, preview, capture]);
  async function save(effect = false) {
    setBusy(true);
    setStatus("");
    try {
      await downloadCanvas(
        effect
          ? await tonedCanvas(capture.photo, adjust)
          : await photoCanvas(capture.photo),
        effect ? "照着拍-调色成片.jpg" : "照着拍-原片.jpg",
        true,
      );
      setStatus(
        effect
          ? "调色成片已导出，原片未改变。"
          : "原片已导出，请在浏览器下载中查看。",
      );
    } catch {
      setStatus("照片没有导出成功，请重试。当前拍摄仍保留在页面里。");
    } finally {
      setBusy(false);
    }
  }
  async function comparison() {
    setBusy(true);
    try {
      const [a, b] = await Promise.all([
          photoCanvas(reference, 600),
          photoCanvas(capture.photo, 600),
        ]),
        c = document.createElement("canvas");
      c.width = 1260;
      c.height = Math.round(600 / aspectOf(reference)) + 130;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#f5f3ed";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#273f35";
      ctx.font = "24px sans-serif";
      ctx.fillText("照着拍 · 我的参考", 20, 40);
      ctx.fillText("我的拍摄 · 原片", 640, 40);
      ctx.drawImage(a, 20, 65, 600, c.height - 85);
      ctx.drawImage(b, 640, 65, 600, c.height - 85);
      await downloadCanvas(c, "照着拍-参考与原片.jpg", true);
      setStatus("对比图已导出。");
    } catch {
      setStatus("对比图导出失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="v2-result page-enter">
      <div className="v2-page-heading">
        <button className="v2-back" onClick={onEdit}>
          <ArrowLeft size={16} /> 返回拍法
        </button>
        <span className="eyebrow">第 3 步 · 一起看看这一张</span>
        <h1>喜欢的留下，只改一点。</h1>
        <p>把手机交回镜头前的你。一起看看，哪些已经喜欢，哪里还想改一点。</p>
      </div>
      <div className="v2-result-grid">
        <figure>
          <div
            className="v2-result-photo"
            style={{ aspectRatio: aspectOf(reference) }}
          >
            <CropImage photo={reference} alt="拍摄参考" />
          </div>
          <figcaption>
            {target.notebook?.source === "scene"
              ? "开始时的风景"
              : "想照着拍的照片"}
          </figcaption>
        </figure>
        <figure>
          <div
            className="v2-result-photo"
            style={{ aspectRatio: aspectOf(capture.photo) }}
          >
            <CropImage photo={capture.photo} alt="刚刚拍下的原片" />
            {preview && <canvas ref={canvas} className="v2-tone-preview" />}
            <span className="v2-result-label">
              {preview ? "调色预览" : "拍摄原片"}
            </span>
          </div>
          <figcaption>
            你拍下的这一刻{" "}
            <span>
              {capture.width} × {capture.height}
              {capture.mirrored ? " · 镜像" : ""}
            </span>
          </figcaption>
        </figure>
      </div>
      <div className="v2-result-actions">
        <button className="button secondary" onClick={onRetry}>
          <RefreshCw size={17} /> 再拍一张
        </button>
        <button
          className="button primary"
          onClick={() => void save()}
          disabled={busy}
        >
          <Download size={17} /> 导出原片
        </button>
        <button className="v2-text-link" onClick={() => setToning((v) => !v)}>
          <SlidersHorizontal size={17} /> 微调一下颜色
        </button>
      </div>
      {target.notebook?.source !== "scene" && (
        <LightReview
          reference={reference}
          capture={capture}
          target={target}
          onEdit={onEdit}
        />
      )}
      {target.notebook?.source === "scene" && (
        <p className="zp-scene-review">
          场景图里没有人物，不比较它与成片的人脸亮度。一起看看脸部细节、地平线和头顶的空间。
        </p>
      )}
      <NotebookReview
        key={capture.id}
        target={target}
        capture={capture}
        onFeedback={onFeedback}
      />
      {toning && (
        <section className="v2-toning">
          <div>
            <span className="eyebrow">拍后调色 · 保留原片</span>
            <h2>只加一点，你喜欢的色彩。</h2>
            <p>冷暖、明暗与对比度在拍后调整；不会改变光源方向或覆盖原片。</p>
          </div>
          <div className="v2-tone-sliders">
            {toneRecipe && (
              <button
                className="v4-tone-recipe"
                onClick={() => {
                  setAdjust({ ...toneRecipe.tone });
                  setPreview(true);
                }}
              >
                试试参考色调 · {toneRecipe.title}
                <span>编辑预设，可继续微调；保留原片</span>
              </button>
            )}
            {(
              [
                ["warmth", "冷暖"],
                ["brightness", "明暗"],
                ["contrast", "对比度"],
                ["strength", "效果强度"],
              ] as const
            ).map(([id, label]) => (
              <label key={id}>
                {label}
                <span>
                  {id === "strength"
                    ? `${Math.round(adjust[id] * 100)}%`
                    : adjust[id]}
                </span>
                <input
                  aria-label={label}
                  type="range"
                  min={id === "strength" ? 0 : -40}
                  max={id === "strength" ? 1 : 40}
                  step={id === "strength" ? 0.05 : 1}
                  value={adjust[id]}
                  onChange={(e) => {
                    setAdjust((a) => ({ ...a, [id]: +e.target.value }));
                    setPreview(true);
                  }}
                />
              </label>
            ))}
            <div className="v2-tone-actions">
              <button onClick={() => setPreview((v) => !v)}>
                {preview ? "查看原片" : "查看效果"}
              </button>
              <button
                onClick={() => {
                  setAdjust(initial);
                  setPreview(false);
                }}
              >
                恢复原片
              </button>
              <button
                className="button primary"
                disabled={busy}
                onClick={() => void save(true)}
              >
                导出调色成片 <Download size={15} />
              </button>
            </div>
          </div>
        </section>
      )}
      <p className="v2-download-status" role="status">
        {status ||
          "原片不包含骨架、箭头或文字辅助线。最近拍摄保留在本次会话；保存到拍摄小卡后，刷新也能找回。"}
      </p>
      <div className="v2-result-bottom">
        <button onClick={() => void comparison()} disabled={busy}>
          导出参考对比图 <Download size={14} />
        </button>
        <button onClick={onHome}>
          换一张灵感，继续拍 <ArrowRight size={15} />
        </button>
      </div>
    </main>
  );
}
