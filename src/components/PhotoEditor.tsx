import { useRef, useState } from "react";
import type { CSSProperties, PointerEvent, KeyboardEvent } from "react";
import { ArrowRight, Check, Crop, Scan, Move, ChevronDown } from "lucide-react";
import type { Photo, Rect } from "../lib/types";
import {
  aspectOf,
  boundRect,
  initialCrop,
  recrop,
  resizeCrop,
  clamp,
} from "../lib/geometry";
import PhotoView from "./PhotoView";
import Modal from "./Modal";

export default function PhotoEditor({
  photo,
  onSave,
  onClose,
  reference = false,
  initialTab = "subject",
}: {
  photo: Photo;
  onSave: (p: Photo) => void;
  onClose: () => void;
  reference?: boolean;
  initialTab?: "crop" | "subject";
}) {
  const [draft, setDraft] = useState<Photo>(photo),
    [tab, setTab] = useState(initialTab),
    [crop, setCrop] = useState(photo.crop);
  const stage = useRef<HTMLDivElement>(null),
    cropBasis = useRef(photo),
    drag = useRef<{ x: number; y: number; rect: Rect; corner: string } | null>(
      null,
    );
  function changeCrop(next: Rect) {
    setCrop(next);
    setDraft(recrop(cropBasis.current, next));
  }
  function openCrop() {
    if (tab !== "crop") cropBasis.current = draft;
    setTab("crop");
  }
  function moveCrop(r: Rect, dx: number, dy: number): Rect {
    return {
      ...r,
      x: clamp(r.x + dx, 0, 1 - r.width),
      y: clamp(r.y + dy, 0, 1 - r.height),
    };
  }
  function chooseAspect(ratio: number) {
    changeCrop(initialCrop(photo.width, photo.height, ratio));
  }
  function down(e: PointerEvent, corner = "move") {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, rect: crop, corner };
  }
  function move(e: PointerEvent) {
    if (!drag.current || !stage.current) return;
    const r = stage.current.getBoundingClientRect(),
      d = drag.current,
      dx = (e.clientX - d.x) / r.width,
      dy = (e.clientY - d.y) / r.height;
    changeCrop(
      d.corner === "move"
        ? moveCrop(d.rect, dx, dy)
        : resizeCrop(d.rect, d.corner, dx, dy),
    );
  }
  function key(e: KeyboardEvent, corner = "move") {
    if (!e.key.startsWith("Arrow")) return;
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 0.02 : 0.005,
      dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
      dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    changeCrop(
      corner === "move"
        ? moveCrop(crop, dx, dy)
        : resizeCrop(crop, corner, dx, dy),
    );
  }
  function changeBox(rect: Rect) {
    setDraft((p) => ({
      ...p,
      subject: { ...rect, source: "manual", confirmed: false },
    }));
  }
  const ratio = aspectOf(draft);
  return (
    <Modal
      title={tab === "crop" ? "留住你想要的画面" : "框住画面里的人物"}
      onClose={onClose}
      wide
    >
      <div className="editor-tabs">
        <button className={tab === "crop" ? "selected" : ""} onClick={openCrop}>
          <Crop size={15} /> 01 裁切画幅
        </button>
        <button
          className={tab === "subject" ? "selected" : ""}
          onClick={() => setTab("subject")}
        >
          <Scan size={15} /> 02 确认人物
        </button>
      </div>
      <p className="editor-description">
        {tab === "crop"
          ? "移动取景框，拖动角点缩放。参考和试拍会使用相同画幅。"
          : "拖动框与四个角点，让它贴合照片中可见的人物。我们会按你确认的范围比较构图。"}
      </p>
      <div className="editor-body">
        {tab === "crop" ? (
          <div
            className="crop-editor"
            ref={stage}
            style={
              {
                aspectRatio: photo.width / photo.height,
                "--original-aspect": photo.width / photo.height,
              } as CSSProperties
            }
          >
            <img src={photo.url} alt="待裁切的原始照片" draggable={false} />
            <div
              className="crop-selection"
              role="group"
              tabIndex={0}
              aria-label="裁切框，可用方向键移动"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
              }}
              onPointerDown={down}
              onPointerMove={move}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onKeyDown={key}
            >
              <span className="crop-grid" />
              <Move size={24} />
              {["nw", "ne", "sw", "se"].map((c, i) => (
                <button
                  className={`resize-handle ${c}`}
                  key={c}
                  aria-label={`调整裁切框${["左上", "右上", "左下", "右下"][i]}角`}
                  onPointerDown={(e) => down(e, c)}
                  onPointerMove={move}
                  onPointerUp={() => (drag.current = null)}
                  onKeyDown={(e) => key(e, c)}
                />
              ))}
            </div>
          </div>
        ) : (
          <PhotoView
            photo={draft}
            editable
            onBoxChange={changeBox}
            label="确认人物框"
            className="editor-photo"
          />
        )}
        <div className="editor-controls">
          <div className="editor-tip">
            <span className="eyebrow">A LITTLE CLOSER</span>
            <h3>
              {tab === "crop"
                ? "画幅一致，才能好好比较。"
                : "你来确认，我们来指路。"}
            </h3>
            <p>
              {tab === "crop"
                ? "照片会保持原有比例。框外的部分不会出现在最终保存的照片里。"
                : "把头部、肩膀和可见身体都框进来，不用包含椅子或桌面。只比较你选中的这一个人。"}
            </p>
          </div>
          {tab === "crop" && reference && (
            <div className="aspect-options" aria-label="选择裁切比例">
              {[
                { label: "原图", value: photo.width / photo.height },
                { label: "3:4", value: 0.75 },
                { label: "4:5", value: 0.8 },
              ].map((a) => (
                <button
                  key={a.label}
                  className={
                    Math.abs(ratio - a.value) < 0.005 ? "selected" : ""
                  }
                  onClick={() => chooseAspect(a.value)}
                >
                  {a.label}
                </button>
              ))}
            </div>
          )}
          {tab === "crop" && !reference && (
            <span className="basis-tag">画幅已与参考照片保持一致</span>
          )}
          {tab === "subject" && (
            <details className="fine-tune">
              <summary>
                精细调整 <ChevronDown size={14} />
              </summary>
              {(["x", "y", "width", "height"] as const).map((k, i) => (
                <label key={k}>
                  {["左右位置", "上下位置", "人物框宽度", "人物框高度"][i]}
                  <input
                    type="range"
                    aria-label={
                      [
                        "人物框左右位置",
                        "人物框上下位置",
                        "人物框宽度",
                        "人物框高度",
                      ][i]
                    }
                    min={k === "width" || k === "height" ? 0.04 : 0}
                    max={
                      k === "x"
                        ? 1 - draft.subject.width
                        : k === "y"
                          ? 1 - draft.subject.height
                          : k === "width"
                            ? 1 - draft.subject.x
                            : 1 - draft.subject.y
                    }
                    step="0.005"
                    value={draft.subject[k]}
                    onChange={(e) =>
                      changeBox(
                        boundRect({
                          ...draft.subject,
                          [k]: clamp(Number(e.target.value)),
                        }),
                      )
                    }
                  />
                </label>
              ))}
            </details>
          )}
          <div className="editor-next">
            {tab === "crop" ? (
              <button
                className="button primary full"
                onClick={() => setTab("subject")}
              >
                继续确认人物 <ArrowRight size={17} />
              </button>
            ) : (
              <button
                className="button primary full"
                onClick={() =>
                  onSave({
                    ...draft,
                    subject: {
                      ...draft.subject,
                      source: "manual",
                      confirmed: true,
                    },
                  })
                }
              >
                确认这个人物框 <Check size={17} />
              </button>
            )}
            <span className="micro-copy">照片在当前设备内处理</span>
          </div>
        </div>
      </div>
    </Modal>
  );
}
