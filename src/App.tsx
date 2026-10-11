import { useRef, useState } from "react";
import { Camera, ImagePlus, LoaderCircle, ShieldCheck } from "lucide-react";
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
import ShootingBrief from "./components/ShootingBrief";
import "./v2.css";
import "./together.css";

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
          <span className="header-note">你想要的，一起拍出来。</span>
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
            confirmedTarget={target}
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
            if (capture) releasePhoto(capture.photo);
            setCapture(c);
            go("result");
          }}
        />
      )}
      {stage === "result" && reference && capture && target && (
        <PhotoResult
          reference={reference}
          capture={capture}
          target={target}
          onRetry={() => setPrep(true)}
          onFeedback={(next) => {
            setTarget(next);
            setPrep(true);
          }}
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
      {prep && target && reference && (
        <Modal title="把想法交给帮你拍照的人。" onClose={() => setPrep(false)}>
          <ShootingBrief
            reference={reference}
            target={target}
            onStart={() => {
              setPrep(false);
              go("camera");
            }}
            onEdit={() => {
              setPrep(false);
              go("reference");
            }}
          />
        </Modal>
      )}
      {about && (
        <Modal title="你想要的，一起拍出来。" onClose={() => setAbout(false)}>
          <div className="v2-modal-copy">
            <p>
              照着拍帮助被拍者和拍摄者一起完成一张满意的照片：先选最在意的感觉，把目标交给同伴，拍完再一起决定下一张改哪里。一部手机就可以开始。
            </p>
            <p>
              默认由拍摄者调整人物位置和大小，动作自由。需要时再加入有限的手臂动作参考；相机每次只指导一方，语音提醒由你主动点击播放。不会给长相或审美打分。
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
