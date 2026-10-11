import { useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  ImagePlus,
  LoaderCircle,
  ShieldCheck,
} from "lucide-react";
import type { Photo } from "./lib/types";
import type { Capture, Target } from "./domain/session";
import { readPhoto, releasePhotos, releasePhoto } from "./lib/images";
import { templatePhoto } from "./lib/catalog";
import type { Template } from "./lib/catalog";
import InspirationHome from "./components/InspirationHome";
import ReferenceStudio from "./components/ReferenceStudio";
import GuidedCamera from "./components/GuidedCamera";
import PhotoResult from "./components/PhotoResult";
import PhotoEditor from "./components/PhotoEditor";
import Modal from "./components/Modal";
import "./v2.css";

export default function App() {
  const [stage, setStage] = useState<
      "home" | "reference" | "camera" | "result"
    >("home"),
    [reference, setReference] = useState<Photo | null>(null),
    [template, setTemplate] = useState<Template>(),
    [target, setTarget] = useState<Target | null>(null),
    [capture, setCapture] = useState<Capture | null>(null),
    [upload, setUpload] = useState<Photo | null>(null),
    [prep, setPrep] = useState(false),
    [about, setAbout] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null),
    request = useRef(0);
  function go(next: typeof stage) {
    setStage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function home() {
    request.current++;
    setBusy(false);
    setReference(null);
    setTarget(null);
    setCapture(null);
    setError("");
    setTemplate(undefined);
    releasePhotos();
    go("home");
  }
  async function choose(t: Template) {
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const photo = await templatePhoto(t);
      if (id !== request.current) return;
      setReference(photo);
      setTemplate(t);
      setTarget(null);
      setCapture(null);
      go("reference");
    } catch {
      setError("这张参考没能打开，请重试或导入自己的照片。");
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const photo = await readPhoto(file);
      if (id === request.current) setUpload(photo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "照片没有打开，请重试。");
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  return (
    <div className={stage === "camera" ? "v2-app camera-active" : "v2-app"}>
      {stage !== "camera" && (
        <header className="site-header">
          <button className="brand" onClick={home} aria-label="照着拍首页">
            <Camera strokeWidth={1.5} />
            <span>
              照着拍<span className="brand-dot">.</span>
            </span>
          </button>
          <span className="header-note">一点参考，很多可能。</span>
          <nav className="header-actions">
            <button className="about-button" onClick={() => setAbout(true)}>
              关于照着拍
            </button>
            <button
              className="v2-header-upload"
              onClick={() => input.current?.click()}
            >
              <ImagePlus size={16} /> 我的参考
            </button>
          </nav>
        </header>
      )}
      <input
        className="sr-only"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        ref={input}
        aria-label="导入参考照片"
        onChange={(e) => {
          void importFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {error && (
        <div className="v2-global-alert" role="alert">
          {error}
          <button onClick={() => setError("")}>关闭</button>
        </div>
      )}
      {busy && (
        <div className="v2-loading" role="status">
          <LoaderCircle className="spin" size={18} /> 正在准备你的参考…
        </div>
      )}
      {stage === "home" && (
        <InspirationHome
          onChoose={(t) => void choose(t)}
          onUpload={() => input.current?.click()}
        />
      )}
      {reference && (
        <div hidden={stage !== "reference"}>
          <ReferenceStudio
            key={reference.id}
            photo={reference}
            template={template}
            onPhoto={(p) => {
              setReference(p);
              setTarget(null);
              setCapture(null);
            }}
            onBack={home}
            onConfirm={(t) => {
              setTarget(t);
              setPrep(true);
            }}
          />
        </div>
      )}
      {stage === "camera" && reference && target && (
        <GuidedCamera
          reference={reference}
          target={target}
          onBack={() => go("reference")}
          onCapture={(c) => {
            setCapture(c);
            go("result");
          }}
        />
      )}
      {stage === "result" && reference && capture && (
        <PhotoResult
          reference={reference}
          capture={capture}
          onRetry={() => go("camera")}
          onEdit={() => go("reference")}
          onHome={home}
        />
      )}
      {stage !== "camera" && (
        <footer className="v2-footer">
          <span>
            照着拍 <small>FRAME YOUR OWN MOMENT.</small>
          </span>
          <span>
            <ShieldCheck size={14} /> 相机画面本地处理 · 参考图按需发送
          </span>
        </footer>
      )}
      {upload && (
        <PhotoEditor
          photo={upload}
          initialTab="crop"
          reference
          onClose={() => {
            releasePhoto(upload);
            setUpload(null);
          }}
          onSave={(p) => {
            setReference(p);
            setTemplate(undefined);
            setTarget(null);
            setCapture(null);
            setUpload(null);
            go("reference");
          }}
        />
      )}
      {prep && target && (
        <Modal
          title="按下快门前，准备这几件小事。"
          onClose={() => setPrep(false)}
        >
          <div className="v2-preparation">
            <span className="eyebrow">A MOMENT BEFORE THE MOMENT</span>
            <ul>
              {target.preparation.map((item, i) => (
                <li key={i}>
                  <Check size={16} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <p>
              手臂与构图可获得有限的实时指导；其他建议由你在现场取舍。任何时候都可以按快门。
            </p>
            <button
              className="button primary full"
              onClick={() => {
                setPrep(false);
                go("camera");
              }}
            >
              准备好了，打开相机 <ArrowRight size={17} />
            </button>
            <button className="v2-text-link" onClick={() => setPrep(false)}>
              回去调整跟随要素
            </button>
          </div>
        </Modal>
      )}
      {about && (
        <Modal title="一点参考，很多可能。" onClose={() => setAbout(false)}>
          <div className="v2-modal-copy">
            <p>
              照着拍帮你把“就这个感觉”，变成更具体的拍摄目标。涂选动作、确认目标，再带着参考进入相机。
            </p>
            <p>
              实时检测在你的浏览器中运行，只比较有限的手臂动作和构图。不评分长相或审美，也不承诺一比一复刻。
            </p>
            <p>
              照片在当前会话中处理，刷新会清空。只有你主动请求深度解读时，才会向配置的模型服务发送参考缩略图、选区和文字。
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
