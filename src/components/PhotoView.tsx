import { useId, useRef } from "react";
import type { CSSProperties, PointerEvent, KeyboardEvent } from "react";
import type { Photo, Goal, Side, Guide, Rect } from "../lib/types";
import { aspectOf, center, boundRect, resizeRect } from "../lib/geometry";

type Props = {
  photo: Photo;
  goal?: Goal;
  side?: Side;
  guide?: Guide;
  overlay?: boolean;
  editable?: boolean;
  onBoxChange?: (box: Rect) => void;
  label?: string;
  className?: string;
};
export function CropImage({ photo, alt }: { photo: Photo; alt: string }) {
  const c = photo.crop;
  return (
    <img
      draggable={false}
      className="cropped-image"
      src={photo.url}
      alt={alt}
      style={{
        width: `${100 / c.width}%`,
        height: `${100 / c.height}%`,
        left: `${(-100 * c.x) / c.width}%`,
        top: `${(-100 * c.y) / c.height}%`,
      }}
    />
  );
}
export default function PhotoView({
  photo,
  goal = "position",
  side = "left",
  guide,
  overlay = true,
  editable = false,
  onBoxChange,
  label,
  className = "",
}: Props) {
  const id = useId().replaceAll(":", ""),
    el = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    x: number;
    y: number;
    box: Rect;
    corner: string;
  } | null>(null);
  const b = photo.subject,
    c = center(b),
    target = guide?.target,
    t = target ? center(target) : c;
  function down(
    e: PointerEvent<HTMLDivElement | HTMLButtonElement>,
    corner = "move",
  ) {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, box: { ...b }, corner };
  }
  function move(e: PointerEvent) {
    if (!drag.current || !el.current || !onBoxChange) return;
    const box = el.current.getBoundingClientRect(),
      d = drag.current,
      dx = (e.clientX - d.x) / box.width,
      dy = (e.clientY - d.y) / box.height;
    onBoxChange(
      d.corner === "move"
        ? boundRect({ ...d.box, x: d.box.x + dx, y: d.box.y + dy })
        : resizeRect(d.box, d.corner, dx, dy),
    );
  }
  function key(e: KeyboardEvent, corner = "move") {
    if (!e.key.startsWith("Arrow") || !onBoxChange) return;
    e.preventDefault();
    e.stopPropagation();
    const step = e.shiftKey ? 0.02 : 0.005;
    const dx =
        e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0,
      dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
    onBoxChange(
      corner === "move"
        ? boundRect({ ...b, x: b.x + dx, y: b.y + dy })
        : resizeRect(b, corner, dx, dy),
    );
  }
  const boxStyle: CSSProperties = {
    left: `${b.x * 100}%`,
    top: `${b.y * 100}%`,
    width: `${b.width * 100}%`,
    height: `${b.height * 100}%`,
  };
  return (
    <div
      ref={el}
      className={`photo-view ${className} ${editable ? "editing" : ""}`}
      style={
        {
          aspectRatio: aspectOf(photo),
          "--photo-aspect": aspectOf(photo),
        } as CSSProperties
      }
    >
      <CropImage photo={photo} alt={label ?? "拍摄照片"} />
      {overlay && (
        <>
          <svg
            className="photo-overlay"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <marker
                id={`arrow-${id}`}
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto-start-reverse"
              >
                <path
                  d="M 1 1 L 7 5 L 1 9"
                  fill="none"
                  stroke="#D7EB9A"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </marker>
            </defs>
            {[1 / 3, 2 / 3].map((n) => (
              <g key={n} className="thirds">
                <line x1={n * 1000} x2={n * 1000} y1="0" y2="1000" />
                <line y1={n * 1000} y2={n * 1000} x1="0" x2="1000" />
              </g>
            ))}
            {goal === "negative_space" && (
              <rect
                className="space-tint"
                x={side === "right" ? (b.x + b.width) * 1000 : 0}
                y="0"
                width={
                  side === "left"
                    ? b.x * 1000
                    : side === "right"
                      ? (1 - b.x - b.width) * 1000
                      : 1000
                }
                height={side === "top" ? b.y * 1000 : 1000}
              />
            )}
            {!editable && (
              <rect
                x={b.x * 1000}
                y={b.y * 1000}
                width={b.width * 1000}
                height={b.height * 1000}
                className="subject-outline"
              />
            )}
            {goal === "scale" && (
              <line
                className="scale-line"
                x1={(b.x + 0.015) * 1000}
                x2={(b.x + 0.015) * 1000}
                y1={b.y * 1000}
                y2={(b.y + b.height) * 1000}
              />
            )}
            {target && !guide?.matched && (
              <rect
                className="target-outline"
                x={target.x * 1000}
                y={target.y * 1000}
                width={target.width * 1000}
                height={target.height * 1000}
              />
            )}
            {(guide?.kind === "move" || guide?.kind === "space") && (
              <line
                className="direction-line"
                x1={c.x * 1000}
                y1={c.y * 1000}
                x2={t.x * 1000}
                y2={t.y * 1000}
                markerEnd={`url(#arrow-${id})`}
              />
            )}
          </svg>
          {goal === "position" && !editable && (
            <span
              className="center-dot"
              style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
            />
          )}
          {goal === "negative_space" && !editable && (
            <span className={`space-label ${side}`}>
              {side === "top"
                ? "上方空间"
                : side === "left"
                  ? "左侧空间"
                  : "右侧空间"}
            </span>
          )}
        </>
      )}
      {editable && (
        <div
          className="editable-box"
          style={boxStyle}
          tabIndex={0}
          role="group"
          aria-label="人物框，可用方向键移动"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
          onKeyDown={key}
        >
          <span className="box-caption">拖动人物框</span>
          {(["nw", "ne", "sw", "se"] as const).map((corner, i) => (
            <button
              key={corner}
              type="button"
              className={`resize-handle ${corner}`}
              aria-label={`调整人物框${["左上", "右上", "左下", "右下"][i]}角`}
              onPointerDown={(e) => down(e, corner)}
              onPointerMove={move}
              onPointerUp={() => (drag.current = null)}
              onKeyDown={(e) => key(e, corner)}
            />
          ))}
        </div>
      )}
      <span className="viewfinder-corner tl" />
      <span className="viewfinder-corner tr" />
      <span className="viewfinder-corner bl" />
      <span className="viewfinder-corner br" />
    </div>
  );
}
