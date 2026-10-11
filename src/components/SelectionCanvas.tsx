import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { CropImage } from "./PhotoView";
import type { Photo } from "../lib/types";
import { aspectOf, clamp } from "../lib/geometry";
import type { Stroke, Person, Group, Point } from "../domain/session";
import { GROUPS } from "../domain/session";
export default function SelectionCanvas({
  photo,
  strokes,
  onStroke,
  tool,
  radius,
  people,
  selected,
  onSelect,
  groups,
  whole,
}: {
  photo: Photo;
  strokes: Stroke[];
  onStroke: (s: Stroke) => void;
  tool: "paint" | "erase" | "pan";
  radius: number;
  people: Person[];
  selected: number | null;
  onSelect: (n: number) => void;
  groups: Group[];
  whole: boolean;
}) {
  const content = useRef<HTMLDivElement>(null),
    ink = useRef<HTMLCanvasElement>(null),
    pointers = useRef(new Map<number, Point>()),
    draft = useRef<Stroke | null>(null),
    pinch = useRef<{
      distance: number;
      zoom: number;
      center: Point;
      pan: Point;
    } | null>(null);
  const [working, setWorking] = useState<Stroke | null>(null),
    [zoom, setZoom] = useState(1),
    [pan, setPan] = useState({ x: 0, y: 0 });
  const aspect = aspectOf(photo);
  useEffect(() => {
    const c = ink.current;
    if (!c) return;
    c.width = 1000;
    c.height = Math.round(1000 / aspect);
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, c.width, c.height);
    if (whole) return;
    for (const s of [...strokes, ...(working ? [working] : [])]) {
      ctx.globalCompositeOperation =
        s.tool === "erase" ? "destination-out" : "source-over";
      ctx.strokeStyle = "#d7eb9a";
      ctx.fillStyle = "#d7eb9a";
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.lineWidth = s.radius * 2000;
      ctx.beginPath();
      s.points.forEach((p, i) =>
        i
          ? ctx.lineTo(p.x * c.width, p.y * c.height)
          : ctx.moveTo(p.x * c.width, p.y * c.height),
      );
      if (s.points.length === 1) {
        ctx.arc(
          s.points[0].x * c.width,
          s.points[0].y * c.height,
          s.radius * 1000,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else ctx.stroke();
    }
  }, [strokes, working, whole, aspect]);
  function point(e: PointerEvent) {
    const b = content.current!.getBoundingClientRect();
    return {
      x: clamp((e.clientX - b.left) / b.width),
      y: clamp((e.clientY - b.top) / b.height),
    };
  }
  function down(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom,
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        pan,
      };
      draft.current = null;
      setWorking(null);
      return;
    }
    if (selected === null || whole || tool === "pan") return;
    draft.current = {
      id: crypto.randomUUID(),
      tool,
      radius,
      points: [point(e)],
    };
    setWorking(draft.current);
  }
  function move(e: PointerEvent) {
    const previous = pointers.current.get(e.pointerId);
    if (!previous) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()],
        p = pinch.current;
      setZoom(
        clamp(
          (p.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / Math.max(1, p.distance),
          1,
          3,
        ),
      );
      setPan({
        x: clamp(p.pan.x + (a.x + b.x) / 2 - p.center.x, -180, 180),
        y: clamp(p.pan.y + (a.y + b.y) / 2 - p.center.y, -180, 180),
      });
      return;
    }
    if (pinch.current) return;
    if (tool === "pan") {
      setPan((p) => ({
        x: clamp(p.x + e.clientX - previous.x, -180, 180),
        y: clamp(p.y + e.clientY - previous.y, -180, 180),
      }));
      return;
    }
    if (draft.current) {
      draft.current = {
        ...draft.current,
        points: [
          ...(draft.current.points.length >= 600
            ? draft.current.points.filter((_, i) => i % 2 === 0)
            : draft.current.points),
          point(e),
        ],
      };
      setWorking(draft.current);
    }
  }
  function end(e: PointerEvent, cancel = false) {
    pointers.current.delete(e.pointerId);
    if (draft.current && !cancel) onStroke(draft.current);
    draft.current = null;
    setWorking(null);
    if (!pointers.current.size) pinch.current = null;
  }
  const person = selected === null ? null : people[selected];
  return (
    <div className="v2-selection-wrap">
      <div
        className="v2-selection"
        data-testid="selection-canvas"
        style={{ aspectRatio: aspect }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={(e) => end(e)}
        onPointerCancel={(e) => end(e, true)}
      >
        <div
          ref={content}
          className="v2-selection-content"
          style={{
            transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`,
          }}
        >
          <CropImage photo={photo} alt="这次想参考的画面" />
          <canvas ref={ink} className="v2-ink" />
          <svg
            className="v2-skeleton"
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            {person &&
              groups.map((g) => (
                <g key={g}>
                  {GROUPS[g].joints.map((j, i, a) => {
                    const p = person.landmarks[j],
                      last = i ? person.landmarks[a[i - 1]] : null;
                    return (
                      <g key={j}>
                        {last && (
                          <line
                            x1={last.x * 1000}
                            y1={last.y * 1000}
                            x2={p.x * 1000}
                            y2={p.y * 1000}
                          />
                        )}
                        <circle cx={p.x * 1000} cy={p.y * 1000} r="6" />
                      </g>
                    );
                  })}
                </g>
              ))}
          </svg>
          {people.length > 1 &&
            people.map((p, i) => (
              <button
                key={i}
                className={`v2-person-box ${selected === i ? "selected" : ""}`}
                style={{
                  left: `${p.box.x * 100}%`,
                  top: `${p.box.y * 100}%`,
                  width: `${p.box.width * 100}%`,
                  height: `${p.box.height * 100}%`,
                }}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSelect(i)}
              >
                人物 {i + 1}
                {selected === i ? " · 已选" : ""}
              </button>
            ))}
        </div>
        <span className="v2-canvas-label">
          {whole
            ? "整图参考"
            : tool === "erase"
              ? "擦除选区"
              : tool === "pan"
                ? "拖动查看"
                : "涂一下，学这一点"}
        </span>
      </div>
      <div className="v2-canvas-footer">
        <span>
          {tool === "pan" ? "拖动查看 · 双指缩放" : "单指涂抹 · 双指缩放"}
        </span>
        <div>
          <button
            aria-label="缩小参考"
            onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
          >
            −
          </button>
          <button
            onClick={() => {
              setZoom(1);
              setPan({ x: 0, y: 0 });
            }}
            aria-label="重置参考缩放"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            aria-label="放大参考"
            onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
          >
            ＋
          </button>
        </div>
      </div>
    </div>
  );
}
