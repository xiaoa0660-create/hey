import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  Eye,
  EyeOff,
  FlipHorizontal2,
  LoaderCircle,
  RefreshCw,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Photo } from "../lib/types";
import type { Capture, LiveHint, Person, Target } from "../domain/session";
import { GROUPS } from "../domain/session";
import {
  HintStabilizer,
  poseHint,
  targetGroups,
  targetPerson,
} from "../domain/pose";
import { PoseClient } from "../lib/pose-client";
import { capturedPhoto, drawCameraFrame } from "../lib/imaging";
import { releasePhoto } from "../lib/images";
import { CropImage } from "./PhotoView";

const waiting: LiveHint = {
  key: "waiting",
  state: "reference",
  actor: "当前状态",
  text: "相机准备好后，让一个人进入画面。",
  detail: "随时可以按快门，拍下你喜欢的一刻。",
};
type ZoomCap = { min: number; max: number; step: number };
export default function GuidedCamera({
  reference,
  target,
  onBack,
  onCapture,
}: {
  reference: Photo;
  target: Target;
  onBack: () => void;
  onCapture: (capture: Capture) => void;
}) {
  const video = useRef<HTMLVideoElement>(null),
    stream = useRef<MediaStream | null>(null),
    client = useRef<PoseClient | null>(null),
    generation = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    stabilizer = useRef(new HintStabilizer());
  const [facing, setFacing] = useState<"user" | "environment">("environment"),
    [mirrored, setMirrored] = useState(false),
    [attempt, setAttempt] = useState(0),
    [ready, setReady] = useState(false),
    [starting, setStarting] = useState(true),
    [error, setError] = useState(""),
    [paused, setPaused] = useState(false),
    [overlay, setOverlay] = useState(true),
    [peek, setPeek] = useState(false),
    [hint, setHint] = useState<LiveHint>(waiting),
    [current, setCurrent] = useState<Person | null>(null),
    [saving, setSaving] = useState(false),
    [modelError, setModelError] = useState(""),
    [zoom, setZoom] = useState(1),
    [zoomCap, setZoomCap] = useState<ZoomCap | null>(null),
    [cameraNote, setCameraNote] = useState(""),
    [performanceNote, setPerformanceNote] = useState("");
  function stop() {
    generation.current++;
    if (timer.current) clearTimeout(timer.current);
    client.current?.dispose();
    client.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    stabilizer.current.reset();
  }
  useEffect(() => {
    stop();
    const gen = generation.current;
    setReady(false);
    setCurrent(null);
    setHint(waiting);
    setError("");
    setModelError("");
    setZoomCap(null);
    setStarting(!paused);
    setCameraNote("");
    setPerformanceNote("");
    if (paused) return;
    const valid = () => generation.current === gen;
    async function start() {
      try {
        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
          throw new Error(
            "需要在 HTTPS 网页或本机开发地址中打开相机。请返回参考页，稍后从正式链接进入。",
          );
        const media = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (!valid()) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        stream.current = media;
        const track = media.getVideoTracks()[0],
          settings = track.getSettings(),
          isMirror = settings.facingMode
            ? settings.facingMode === "user"
            : facing === "user";
        setMirrored(isMirror);
        if (settings.facingMode && settings.facingMode !== facing)
          setCameraNote("此设备没有切换到请求的镜头，正在使用可用相机。");
        const caps = track.getCapabilities?.() as MediaTrackCapabilities & {
          zoom?: ZoomCap;
        };
        if (caps?.zoom && caps.zoom.max > caps.zoom.min) {
          setZoomCap(caps.zoom);
          setZoom(
            (settings as MediaTrackSettings & { zoom?: number }).zoom ??
              caps.zoom.min,
          );
        }
        track.onended = () => {
          if (valid()) {
            stop();
            setReady(false);
            setCurrent(null);
            setHint(waiting);
            setError("相机已断开，请重新连接后重试。");
          }
        };
        const el = video.current;
        if (!el) return;
        el.srcObject = media;
        await el.play();
        if (!valid()) return;
        setReady(true);
        setStarting(false);
        const detector = new PoseClient();
        client.current = detector;
        async function loop() {
          if (!valid() || !video.current || document.hidden) return;
          const before = performance.now();
          const staleTimer = setTimeout(() => {
            if (!valid()) return;
            stabilizer.current.reset();
            setCurrent(null);
            setHint({
              key: "stale",
              state: "uncertain",
              actor: "当前状态",
              text: "检测暂时没有跟上，先自然保持。",
              detail: "已暂停上一条提示，仍然可以按快门。",
            });
          }, 1600);
          try {
            const frame = drawCameraFrame(
                video.current,
                target.aspect,
                isMirror,
                640,
              ),
              result = await detector.detect(frame, true, before);
            if (!valid()) return;
            setCurrent(result.people.length === 1 ? result.people[0] : null);
            setHint(
              stabilizer.current.update(
                poseHint(target, result.people),
                performance.now(),
              ),
            );
            if (result.durationMs > 180)
              setPerformanceNote(
                "此设备检测较慢，已降低更新频率；快门仍可随时使用。",
              );
            const interval =
              result.durationMs > 180
                ? 450
                : result.durationMs > 90
                  ? 250
                  : 160;
            timer.current = setTimeout(
              () => void loop(),
              Math.max(30, interval - (performance.now() - before)),
            );
          } catch {
            if (valid()) {
              setCurrent(null);
              setModelError(
                "实时人体检测暂不可用。可以对照参考拍摄，或重试检测。",
              );
              setHint({
                key: "unavailable",
                state: "reference",
                actor: "当前状态",
                text: "对照参考，喜欢时就按快门。",
                detail: "当前没有实时动作判断。",
              });
            }
          } finally {
            clearTimeout(staleTimer);
          }
        }
        void loop();
      } catch (e) {
        if (!valid()) return;
        stop();
        setReady(false);
        setCurrent(null);
        const name = e instanceof DOMException ? e.name : "";
        setError(
          name === "NotAllowedError"
            ? "相机权限没有开启。请在浏览器的站点设置中允许相机，再点击重试。"
            : name === "NotFoundError"
              ? "没有找到摄像头。请连接摄像头，或稍后用手机打开。"
              : name === "NotReadableError"
                ? "相机可能被其他应用占用。关闭其他相机应用后重试。"
                : e instanceof Error
                  ? e.message
                  : "相机没有启动，请重试。",
        );
        setStarting(false);
      }
    }
    void start();
    return stop;
  }, [facing, attempt, paused, target]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        stop();
        setPaused(true);
        setReady(false);
        setCurrent(null);
        setHint(waiting);
      }
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  async function shutter() {
    if (!video.current || !ready || saving) return;
    const generationAtCapture = generation.current;
    setSaving(true);
    try {
      const frame = drawCameraFrame(video.current, target.aspect, mirrored),
        photo = await capturedPhoto(frame);
      if (generation.current !== generationAtCapture) {
        releasePhoto(photo);
        return;
      }
      stop();
      onCapture({
        id: crypto.randomUUID(),
        photo,
        targetId: target.id,
        mirrored,
        width: photo.width,
        height: photo.height,
        takenAt: Date.now(),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "这次没有拍摄成功，请重试。");
    } finally {
      setSaving(false);
    }
  }
  async function changeZoom(value: number) {
    const track = stream.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({
        advanced: [{ zoom: value } as MediaTrackConstraintSet],
      });
      setZoom(value);
      setCameraNote("");
    } catch {
      setCameraNote("此相机没有应用变焦，已保留当前取景。");
    }
  }
  const ref = targetPerson(target),
    groups = targetGroups(target),
    box = target.mirror
      ? { ...target.box, x: 1 - target.box.x - target.box.width }
      : target.box;
  function aligned(p: Person) {
    if (target.features.includes("composition") || !current) return p.landmarks;
    const c = current.landmarks,
      r = p.landmarks,
      rs = Math.max(0.06, Math.hypot(r[11].x - r[12].x, r[11].y - r[12].y)),
      cs = Math.max(0.06, Math.hypot(c[11].x - c[12].x, c[11].y - c[12].y)),
      scale = cs / rs;
    return r.map((q) => ({
      ...q,
      x: (q.x - (r[11].x + r[12].x) / 2) * scale + (c[11].x + c[12].x) / 2,
      y: (q.y - (r[11].y + r[12].y) / 2) * scale + (c[11].y + c[12].y) / 2,
    }));
  }
  const guide = ref ? aligned(ref) : null;
  return (
    <main className="v2-camera page-enter">
      <div className="v2-camera-top">
        <button onClick={onBack}>
          <ArrowLeft size={17} /> 调整目标
        </button>
        <span>02 / FIND YOUR MOMENT</span>
        <button
          onClick={() => setOverlay((v) => !v)}
          aria-label={overlay ? "隐藏辅助线" : "显示辅助线"}
        >
          {overlay ? <Eye size={20} /> : <EyeOff size={20} />}
        </button>
      </div>
      <div className="v2-camera-layout">
        <div
          className="v2-viewfinder"
          style={
            {
              aspectRatio: target.aspect,
              "--capture-aspect": target.aspect,
            } as CSSProperties
          }
        >
          <video
            ref={video}
            playsInline
            muted
            autoPlay
            style={{ transform: mirrored ? "scaleX(-1)" : undefined }}
            aria-label="实时相机画面"
          />
          {overlay && ready && (
            <svg
              className="v2-camera-overlay"
              viewBox="0 0 1000 1000"
              preserveAspectRatio="none"
              aria-label="拍摄辅助线"
            >
              <defs>
                <marker
                  id="live-arrow"
                  viewBox="0 0 10 10"
                  refX="7"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto"
                >
                  <path
                    d="M1 1L7 5L1 9"
                    fill="none"
                    stroke="#d7eb9a"
                    strokeWidth="1.5"
                  />
                </marker>
              </defs>
              {target.features.includes("composition") && (
                <rect
                  x={box.x * 1000}
                  y={box.y * 1000}
                  width={box.width * 1000}
                  height={box.height * 1000}
                  className="v2-target-box"
                />
              )}
              {guide &&
                groups
                  .filter((g) => GROUPS[g].live)
                  .map((g) => (
                    <polyline
                      key={g}
                      points={GROUPS[g].joints
                        .map((j) => `${guide[j].x * 1000},${guide[j].y * 1000}`)
                        .join(" ")}
                      className="v2-target-arm"
                    />
                  ))}
              {hint.arrow && (
                <line
                  x1={hint.arrow.from.x * 1000}
                  y1={hint.arrow.from.y * 1000}
                  x2={hint.arrow.to.x * 1000}
                  y2={hint.arrow.to.y * 1000}
                  className="v2-live-arrow"
                  markerEnd="url(#live-arrow)"
                />
              )}
            </svg>
          )}
          <button
            className={`v2-reference-peek ${peek ? "expanded" : ""}`}
            onClick={() => setPeek((v) => !v)}
            aria-label={peek ? "缩小参考图" : "放大参考图"}
            style={{ aspectRatio: target.aspect }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                transform: target.mirror ? "scaleX(-1)" : undefined,
              }}
            >
              <CropImage photo={reference} alt="参考小窗" />
            </div>
            <span>参考 {target.mirror ? "· 镜像" : ""}</span>
          </button>
          {ready && (
            <span className="v2-viewfinder-label">
              {mirrored ? "前置镜像 · " : ""}辅助线不会存入照片
            </span>
          )}
          {(starting || error || paused) && (
            <div className="v2-camera-state">
              {starting ? (
                <>
                  <LoaderCircle className="spin" size={26} />
                  <h2>正在打开相机…</h2>
                  <p>浏览器可能会询问你是否允许使用相机。</p>
                </>
              ) : paused ? (
                <>
                  <Camera size={30} />
                  <h2>相机已暂停</h2>
                  <p>离开页面时，我们停止了相机。回来后可以继续。</p>
                  <button
                    className="button lime"
                    onClick={() => setPaused(false)}
                  >
                    继续拍摄
                  </button>
                </>
              ) : (
                <>
                  <Camera size={30} />
                  <h2>还差一点，就能开始。</h2>
                  <p role="alert">{error}</p>
                  <button
                    className="button lime"
                    onClick={() => {
                      setError("");
                      setAttempt((n) => n + 1);
                    }}
                  >
                    重试相机
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        <aside className="v2-camera-guide">
          <span className="eyebrow">ONE THING AT A TIME</span>
          <div className={`v2-live-hint ${hint.state}`} aria-live="polite">
            <span>{hint.actor}</span>
            <h1>{hint.text}</h1>
            <p>{hint.detail}</p>
          </div>
          <details className="v2-camera-brief">
            <summary>这次，跟随这些目标</summary>
            <p>{target.text}</p>
            <small>绿色虚线是参考姿态。左右方向按当前画面显示。</small>
          </details>
          {modelError && (
            <div className="v2-camera-warning">
              <p>{modelError}</p>
              <button onClick={() => setAttempt((n) => n + 1)}>
                <RefreshCw size={13} /> 重试检测
              </button>
            </div>
          )}
          {performanceNote && <p className="v2-small">{performanceNote}</p>}
          {cameraNote && (
            <p role="status" className="v2-small">
              {cameraNote}
            </p>
          )}
          {zoomCap && (
            <label className="v2-zoom">
              镜头变焦 {zoom.toFixed(1)}×
              <input
                aria-label="镜头变焦"
                type="range"
                min={zoomCap.min}
                max={zoomCap.max}
                step={zoomCap.step || 0.1}
                value={zoom}
                onChange={(e) => void changeZoom(+e.target.value)}
              />
            </label>
          )}
          <div className="v2-camera-controls">
            <button
              onClick={() => {
                setFacing((f) => (f === "user" ? "environment" : "user"));
                setPaused(false);
              }}
              aria-label="切换前后相机"
              disabled={starting || saving}
            >
              <FlipHorizontal2 size={24} />
            </button>
            <button
              className="v2-shutter"
              onClick={() => void shutter()}
              disabled={!ready || saving}
              aria-label="拍下这一张"
            >
              {saving ? <LoaderCircle className="spin" size={22} /> : <span />}
            </button>
            <button onClick={() => setPeek((p) => !p)} aria-label="查看参考">
              <Eye size={24} />
            </button>
          </div>
          <p className="v2-camera-footer">随时按快门，不必等到“完美”。</p>
        </aside>
      </div>
    </main>
  );
}
