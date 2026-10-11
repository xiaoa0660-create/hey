import { useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  ChevronDown,
  Download,
  Expand,
  ImagePlus,
  Layers2,
  LoaderCircle,
  MoveHorizontal,
  Scan,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type { CSSProperties } from "react";
import type { Goal, Photo, Side } from "./lib/types";
import { GOALS, SIDES } from "./lib/types";
import { aspectOf, changed, makeGuide } from "./lib/geometry";
import {
  downloadCanvas,
  exportGuide,
  photoCanvas,
  readPhoto,
  releasePhoto,
  releasePhotos,
} from "./lib/images";
import { samplePhoto } from "./lib/sample";
import PhotoView, { CropImage } from "./components/PhotoView";
import PhotoEditor from "./components/PhotoEditor";
import Modal from "./components/Modal";

type Stage = "landing" | "reference" | "capture" | "guidance" | "compare";
type Slot = "reference" | "current" | "retake";
type Edit = { photo: Photo; slot: Slot; tab: "crop" | "subject" };
const sampleRef = samplePhoto("reference");

export default function App() {
  const [stage, setStage] = useState<Stage>("landing");
  const [reference, setReference] = useState<Photo | null>(null);
  const [shots, setShots] = useState<Photo[]>([]);
  const [retake, setRetake] = useState<Photo | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [side, setSide] = useState<Side>("left");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [modal, setModal] = useState<"about" | "reference" | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preference, setPreference] = useState<"before" | "after" | null>(null);
  const [compareMode, setCompareMode] = useState<"pair" | "slider">("pair");
  const [slider, setSlider] = useState(50);
  const fileInput = useRef<HTMLInputElement>(null),
    cameraInput = useRef<HTMLInputElement>(null);
  const uploadSlot = useRef<Slot>("reference"),
    requestId = useRef(0);
  const current = shots.at(-1);
  const activeGoal = goal ?? "position";
  const goalName =
    goal === "negative_space" ? `${SIDES[side]}留白` : GOALS[activeGoal].label;
  const guide =
    reference && current && goal
      ? makeGuide(reference.subject, current.subject, goal, side)
      : null;
  const comparison =
    reference && current && retake && goal
      ? changed(reference.subject, current.subject, retake.subject, goal, side)
      : null;
  const sampleMode = !!reference?.sample;
  const comparisonText =
    comparison?.direction === "closer"
      ? `${goalName}，更接近你想要的了。`
      : comparison?.direction === "further"
        ? `这次的${goalName}，离参考更远了一点。`
        : comparison?.matched
          ? "这次的构图，已经很接近参考。"
          : `两张的${goalName}差别不大。`;
  const activeStep = stage === "reference" ? 0 : stage === "compare" ? 2 : 1;

  function go(next: Stage) {
    setStage(next);
    setNotice("");
    setError("");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function clear() {
    requestId.current++;
    releasePhotos();
    setBusy("");
    setReference(null);
    setShots([]);
    setRetake(null);
    setGoal(null);
    setPreference(null);
    setEdit(null);
    setModal(null);
    go("landing");
  }
  function startSample() {
    clear();
    setReference(samplePhoto("reference"));
    setSide("left");
    go("reference");
  }
  function chooseFile(slot: Slot, camera = false) {
    uploadSlot.current = slot;
    (camera ? cameraInput : fileInput).current?.click();
  }
  async function upload(file?: File) {
    if (!file) return;
    const slot = uploadSlot.current,
      id = ++requestId.current;
    setBusy("正在读取照片…");
    setError("");
    setNotice("");
    try {
      const photo = await readPhoto(
        file,
        slot === "reference" || !reference ? undefined : aspectOf(reference),
      );
      if (id !== requestId.current) {
        releasePhoto(photo);
        return;
      }
      setEdit({ photo, slot, tab: "crop" });
    } catch (e) {
      if (id === requestId.current)
        setError(
          e instanceof Error ? e.message : "照片没有读取成功，请换一张试试。",
        );
    } finally {
      if (id === requestId.current) setBusy("");
    }
  }
  function saveEdit(photo: Photo) {
    if (!edit) return;
    if (edit.slot === "reference") {
      setReference(photo);
      setShots([]);
      setRetake(null);
      setPreference(null);
      go("reference");
    } else if (edit.slot === "current") {
      setShots((s) => (s.length ? [...s.slice(0, -1), photo] : [photo]));
      setRetake(null);
      setPreference(null);
      go("guidance");
    } else {
      setRetake(photo);
      setPreference(null);
      go("compare");
    }
    setEdit(null);
  }
  function firstSample() {
    setShots([samplePhoto("first")]);
    go("guidance");
  }
  function nextSample() {
    setRetake(samplePhoto("retake"));
    setPreference(null);
    setSlider(50);
    go("compare");
  }
  function continueShooting() {
    if (retake) setShots((s) => [...s, retake]);
    setRetake(null);
    setPreference(null);
    go("guidance");
  }
  async function saveGuide() {
    if (!reference || !current || !guide || !goal) return;
    setBusy("正在生成指引卡…");
    setError("");
    try {
      await exportGuide(reference, current, guide, goal, side);
      setNotice("拍摄指引卡已生成，请在下载中查看。");
    } catch {
      setError("指引卡暂时没有导出成功，请重试。照片仍保留在当前页面。");
    } finally {
      setBusy("");
    }
  }
  async function savePhoto(photo: Photo, label: string) {
    setBusy("正在保存照片…");
    setError("");
    try {
      await downloadCanvas(
        await photoCanvas(photo),
        `照着拍-${label}.jpg`,
        true,
      );
      setNotice("这张照片，留住了。已生成不含标注的照片，请在下载中查看。");
    } catch {
      setError("照片暂时没有保存成功，请重试。");
    } finally {
      setBusy("");
    }
  }

  const basis = (
    <p className="basis-note">
      <Scan size={13} />
      {sampleMode && current?.sample !== false
        ? "示例体验 · 生成素材的不同裁切，用于演示构图"
        : "按你确认的人物框生成 · 照片仅在当前浏览器处理"}
    </p>
  );
  function referencePeek() {
    return (
      reference && (
        <button
          className="reference-peek"
          aria-label={`心里的那张参考 · ${goalName}`}
          onClick={() => setModal("reference")}
        >
          <span className="peek-image">
            <CropImage photo={reference} alt="参考照片缩略图" />
          </span>
          <span>
            心里的那张参考<small>{goalName}</small>
          </span>
          <Expand size={15} />
        </button>
      )
    );
  }
  function frameTools(photo: Photo, slot: Slot) {
    return (
      <div className="frame-tools">
        <button onClick={() => setEdit({ photo, slot, tab: "subject" })}>
          <Scan size={15} />
          人物框不准？调整一下
        </button>
        <button
          aria-label="调整照片裁切"
          onClick={() => setEdit({ photo, slot, tab: "crop" })}
        >
          <SlidersHorizontal size={15} />
          <span>裁切</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <input
        ref={fileInput}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="image/*"
        aria-label="选择照片文件"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        className="sr-only"
        tabIndex={-1}
        type="file"
        accept="image/*"
        capture="environment"
        aria-label="拍摄照片"
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <header className="site-header">
        <button
          className="brand"
          onClick={() =>
            stage === "landing"
              ? window.scrollTo({ top: 0, behavior: "smooth" })
              : go("landing")
          }
          aria-label="照着拍首页"
        >
          <Scan strokeWidth={1.5} />
          <span>
            照着拍<span className="brand-dot">.</span>
          </span>
        </button>
        <span className="header-note">好照片，离你只差一点点。</span>
        <div className="header-actions">
          {stage !== "landing" && (
            <button className="text-button" onClick={clear}>
              新一组照片
            </button>
          )}
          <button className="about-button" onClick={() => setModal("about")}>
            {stage === "landing" ? "怎么用" : "使用说明"}
            <ArrowUpRightIcon />
          </button>
        </div>
      </header>

      {stage === "landing" ? (
        <main className="landing page-enter">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow hero-eyebrow">
                <span /> FOR THE PHOTO YOU HAVE IN MIND
              </div>
              <h1>
                把你想拍的，
                <br />
                <span>讲清楚。</span>
              </h1>
              <p className="hero-description">
                你心里有一张照片。
                <br />
                让拍照的人，也看见你的想法。
              </p>
              <p className="hero-how">
                选一张参考，试拍一张，得到下一步怎么拍。
              </p>
              <div className="hero-actions">
                <button
                  className="button primary"
                  onClick={() => chooseFile("reference")}
                >
                  <ImagePlus size={18} />
                  选一张参考图
                  <ArrowRight size={18} />
                </button>
                <button className="sample-button" onClick={startSample}>
                  <span className="tiny-preview">
                    <CropImage photo={sampleRef} alt="咖啡馆示例缩略图" />
                  </span>
                  用咖啡馆示例试试
                  <ArrowRight size={17} />
                </button>
              </div>
              <p className="privacy-note">
                <ShieldCheck size={14} />
                照片只留在你的浏览器里
              </p>
            </div>
            <div className="hero-visual">
              <div className="photo-index">
                <span>FIELD NOTES / 001</span>
                <span>窗边，好好留白</span>
              </div>
              <div className="hero-photo-wrap">
                <PhotoView
                  photo={sampleRef}
                  goal="negative_space"
                  overlay={false}
                  label="窗边的咖啡馆人像参考"
                />
                <div className="hero-thirds" />
                <div className="hero-target">
                  <span>人，靠右一点</span>
                  <i />
                </div>
                <div className="hero-space">
                  <span>
                    给窗边
                    <br />
                    留一点空间
                  </span>
                  <ArrowRight size={44} strokeWidth={1} />
                </div>
                <span className="photo-caption">
                  <span className="live-dot" />
                  心里的那张照片
                </span>
              </div>
              <div className="floating-note">
                <span className="note-icon">
                  <MoveHorizontal size={22} />
                </span>
                <div>
                  <span>拍摄的人，先做这一件事</span>
                  <p>让人物靠右，留住窗边的光。</p>
                </div>
                <Check size={18} />
              </div>
              <p className="hero-image-note">构图示意 · AI 生成素材</p>
            </div>
          </section>
          <section className="experience-strip">
            <div className="strip-intro">
              <span className="eyebrow">LESS GUESSING. MORE KEEPERS.</span>
              <h2>
                少一点「不是这样」，
                <br />
                多一张「就这张」。
              </h2>
            </div>
            <div className="mini-step">
              <span className="step-num">01</span>
              <div>
                <h3>选你喜欢的</h3>
                <p>
                  是人的位置，还是窗边的留白？
                  <br />
                  你来决定这张照片的重点。
                </p>
              </div>
            </div>
            <div className="mini-step">
              <span className="step-num">02</span>
              <div>
                <h3>一次，只调整一点</h3>
                <p>
                  把「感觉不太对」，
                  <br />
                  变成朋友听得懂的一步。
                </p>
              </div>
            </div>
            <div className="mini-step">
              <span className="step-num">03</span>
              <div>
                <h3>留下你喜欢的</h3>
                <p>
                  再拍一张，看看变化。
                  <br />
                  哪张更好，你说了算。
                </p>
              </div>
            </div>
          </section>
          {reference && (
            <button
              className="resume-button"
              onClick={() =>
                go(retake ? "compare" : current ? "guidance" : "reference")
              }
            >
              继续刚才的照片
              <ArrowRight size={16} />
            </button>
          )}
        </main>
      ) : (
        <main className="workspace page-enter" key={stage}>
          <div className="workspace-top">
            <button
              className="back-button"
              onClick={() =>
                go(
                  stage === "reference"
                    ? "landing"
                    : stage === "capture" || stage === "guidance"
                      ? "reference"
                      : "guidance",
                )
              }
            >
              <ArrowLeft size={17} />
              <span>上一步</span>
            </button>
            <nav className="stepper" aria-label="拍摄进度">
              {["参考与目标", "试拍与调整", "对比与保存"].map((label, i) => (
                <span
                  key={label}
                  className={
                    i === activeStep ? "active" : i < activeStep ? "done" : ""
                  }
                  aria-current={i === activeStep ? "step" : undefined}
                >
                  <i>{i < activeStep ? <Check size={12} /> : `0${i + 1}`}</i>
                  <span>{label}</span>
                </span>
              ))}
            </nav>
            <span className="mode-label">
              {sampleMode ? "示例体验" : "我的照片"}
            </span>
          </div>

          {stage === "reference" && reference && (
            <section className="reference-layout">
              <div className="reference-photo-column">
                <div className="frame-heading">
                  <span>THE REFERENCE</span>
                  <span>你的参考照片</span>
                </div>
                <PhotoView
                  photo={reference}
                  goal={activeGoal}
                  side={side}
                  overlay={!!goal}
                  label="参考照片"
                />
                {frameTools(reference, "reference")}
              </div>
              <div className="reference-content">
                <span className="eyebrow">01 / FIND YOUR FOCUS</span>
                <h1>
                  这张图，
                  <br />
                  你最想借鉴什么？
                </h1>
                <p className="section-description">
                  喜欢可以很具体。
                  <br />
                  先选一个，这次就照着它来。
                </p>
                <div className="goal-options">
                  {(Object.keys(GOALS) as Goal[]).map((g, i) => (
                    <button
                      className={`goal-option ${goal === g ? "selected" : ""}`}
                      aria-pressed={goal === g}
                      key={g}
                      onClick={() => {
                        setGoal(g);
                        setPreference(null);
                      }}
                    >
                      <span className={`goal-glyph glyph-${g}`}>
                        <i />
                        <b />
                      </span>
                      <span>
                        <strong>{GOALS[g].label}</strong>
                        <small>{GOALS[g].description}</small>
                      </span>
                      <span className="goal-check">
                        {goal === g ? <Check size={13} /> : `0${i + 1}`}
                      </span>
                    </button>
                  ))}
                </div>
                {goal === "negative_space" && (
                  <div className="side-selector">
                    <span>想保留哪一侧？</span>
                    <div>
                      {(Object.keys(SIDES) as Side[]).map((s) => (
                        <button
                          key={s}
                          aria-pressed={side === s}
                          className={side === s ? "selected" : ""}
                          onClick={() => {
                            setSide(s);
                            setPreference(null);
                          }}
                        >
                          {SIDES[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <button
                  className="button primary full"
                  disabled={!goal}
                  onClick={() =>
                    go(retake ? "compare" : current ? "guidance" : "capture")
                  }
                >
                  {current ? "按这个目标继续" : "照这个目标试拍"}
                  <ArrowRight size={18} />
                </button>
                <button
                  className="text-button change-reference"
                  onClick={() => chooseFile("reference")}
                >
                  <ImagePlus size={14} />
                  换一张参考图
                </button>
                {basis}
              </div>
            </section>
          )}

          {stage === "capture" && reference && (
            <section className="capture-layout">
              <div className="capture-reference">
                <div className="frame-heading">
                  <span>THE REFERENCE</span>
                  <span>{goalName}</span>
                </div>
                <PhotoView
                  photo={reference}
                  goal={activeGoal}
                  side={side}
                  label="本次拍摄的参考照片"
                />
                <p className="photo-footnote">心里的那张照片，先记住它。</p>
              </div>
              <div className="capture-content">
                <span className="eyebrow">02 / GIVE IT A SHOT</span>
                <h1>
                  先拍一张，
                  <br />
                  找找感觉。
                </h1>
                <p className="section-description">
                  把手机交给朋友，试着拍下眼前这一刻。
                  <br />
                  我们一起看看，离你想要的还差哪一点。
                </p>
                <div className="upload-zone">
                  <div className="upload-icon">
                    <Camera strokeWidth={1.3} size={32} />
                  </div>
                  <h3>从一张试拍开始</h3>
                  <p>单人照片，看得清人物就好。</p>
                  <button
                    className="button primary full"
                    onClick={() =>
                      sampleMode ? firstSample() : chooseFile("current")
                    }
                  >
                    {sampleMode ? "看看示例的第一次试拍" : "选一张试拍照片"}
                    <ArrowRight size={18} />
                  </button>
                  <div className="upload-secondary">
                    {sampleMode && (
                      <button onClick={() => chooseFile("current")}>
                        <ImagePlus size={15} />
                        用自己的照片
                      </button>
                    )}
                    <button onClick={() => chooseFile("current", true)}>
                      <Camera size={15} />
                      现在拍一张
                    </button>
                  </div>
                  <p className="file-help">
                    JPG、PNG、WebP 等浏览器可读格式 · 最大 35 MB
                    <br />
                    拍照不可用时，可以从相册选择。
                  </p>
                </div>
                {basis}
              </div>
            </section>
          )}

          {stage === "guidance" && reference && current && guide && (
            <section className="guidance-layout">
              <div className="guidance-photos">
                <div className="desktop-reference">
                  <div className="frame-heading">
                    <span>REFERENCE</span>
                    <span>你的参考</span>
                  </div>
                  <PhotoView
                    photo={reference}
                    goal={activeGoal}
                    side={side}
                    label="参考构图"
                  />
                </div>
                <div className="current-photo">
                  <div className="frame-heading">
                    <span>
                      YOUR SHOT / {String(shots.length).padStart(2, "0")}
                    </span>
                    <span>这张试拍</span>
                  </div>
                  <PhotoView
                    photo={current}
                    goal={activeGoal}
                    side={side}
                    guide={guide}
                    label="试拍照片与拍摄指引"
                  />
                  <div className="overlay-legend">
                    <span>
                      <i className="legend-current" />
                      当前人物
                    </span>
                    <span>
                      <i className="legend-target" />
                      目标示意
                    </span>
                  </div>
                  {frameTools(current, "current")}
                </div>
                <div className="mobile-reference">{referencePeek()}</div>
              </div>
              <div className="guidance-content">
                <span className="goal-tag">
                  <span />
                  你选的目标 · {goalName}
                </span>
                <h1>
                  下一步，
                  <br />
                  先做这一件事。
                </h1>
                <div
                  className={`instruction-card ${guide.matched ? "matched" : ""}`}
                >
                  <span className="instruction-label">
                    <Camera size={16} />
                    {guide.matched ? "这张，已经很接近" : "拍摄的人"}
                  </span>
                  <h2>{guide.action}</h2>
                  <details>
                    <summary>
                      为什么这样拍
                      <ChevronDown size={15} />
                    </summary>
                    <p>{guide.reason}</p>
                  </details>
                </div>
                {!guide.matched && (
                  <p className="arrow-explanation">
                    <MoveHorizontal size={15} />
                    标注表示人物在最终画面中的目标位置。
                  </p>
                )}
                <div className="guidance-actions">
                  <button
                    className="button primary full"
                    onClick={() =>
                      sampleMode && current.sample
                        ? nextSample()
                        : chooseFile("retake")
                    }
                  >
                    {sampleMode && current.sample
                      ? "看看调整后的一张"
                      : "再拍一张"}
                    <ArrowRight size={18} />
                  </button>
                  {guide.matched && (
                    <button
                      className="button secondary full"
                      onClick={() =>
                        void savePhoto(current, `第${shots.length}张`)
                      }
                    >
                      <Download size={16} />
                      就留这张，保存照片
                    </button>
                  )}
                  <div className="inline-actions">
                    <button onClick={() => chooseFile("retake")}>
                      <ImagePlus size={15} />
                      选择重拍照片
                    </button>
                    <button onClick={() => chooseFile("retake", true)}>
                      <Camera size={15} />
                      现在拍摄
                    </button>
                  </div>
                  <button
                    className="guide-download"
                    onClick={() => void saveGuide()}
                    disabled={!!busy}
                  >
                    <Download size={16} />
                    保存拍摄指引卡<span>给朋友看</span>
                  </button>
                </div>
                {basis}
              </div>
            </section>
          )}

          {stage === "compare" &&
            reference &&
            current &&
            retake &&
            comparison && (
              <section className="compare-section">
                <div className="compare-heading">
                  <div>
                    <span className="eyebrow">03 / THE ONE TO KEEP</span>
                    <h1>{comparisonText}</h1>
                    <p>
                      {comparison.direction === "further"
                        ? "构图的接近程度，只是一个参考。你仍然可以留下更喜欢的那张。"
                        : "构图有了答案，喜欢还得问你自己。哪一张，更接近你心里的感觉？"}
                    </p>
                  </div>
                  <div className="compare-toggle" aria-label="比较方式">
                    <button
                      aria-pressed={compareMode === "pair"}
                      className={compareMode === "pair" ? "selected" : ""}
                      onClick={() => setCompareMode("pair")}
                    >
                      <Layers2 size={16} />
                      并列
                    </button>
                    <button
                      aria-pressed={compareMode === "slider"}
                      className={compareMode === "slider" ? "selected" : ""}
                      onClick={() => setCompareMode("slider")}
                    >
                      <MoveHorizontal size={16} />
                      滑动
                    </button>
                  </div>
                </div>
                <div className="compare-layout">
                  <div className="comparison-photos">
                    {compareMode === "pair" ? (
                      <div className="comparison-pair">
                        <div
                          className={
                            preference === "before" ? "preferred-photo" : ""
                          }
                        >
                          <div className="frame-heading">
                            <span>BEFORE</span>
                            <span>
                              {shots.length === 1 ? "第一次试拍" : "上一次试拍"}
                            </span>
                          </div>
                          <PhotoView
                            photo={current}
                            goal={activeGoal}
                            side={side}
                            label="之前的试拍"
                          />
                          <button
                            className={`preference-button ${preference === "before" ? "selected" : ""}`}
                            aria-pressed={preference === "before"}
                            onClick={() => {
                              setPreference("before");
                              setNotice("");
                            }}
                          >
                            {preference === "before" ? (
                              <Check size={16} />
                            ) : (
                              <span className="radio-dot" />
                            )}
                            我更喜欢之前那张
                          </button>
                          {frameTools(current, "current")}
                        </div>
                        <div
                          className={
                            preference === "after" ? "preferred-photo" : ""
                          }
                        >
                          <div className="frame-heading">
                            <span>AFTER</span>
                            <span>这次拍摄</span>
                          </div>
                          <PhotoView
                            photo={retake}
                            goal={activeGoal}
                            side={side}
                            label="这次拍摄"
                          />
                          <button
                            className={`preference-button ${preference === "after" ? "selected" : ""}`}
                            aria-pressed={preference === "after"}
                            onClick={() => {
                              setPreference("after");
                              setNotice("");
                            }}
                          >
                            {preference === "after" ? (
                              <Check size={16} />
                            ) : (
                              <span className="radio-dot" />
                            )}
                            我更喜欢这张
                          </button>
                          {frameTools(retake, "retake")}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div
                          className="slider-comparison"
                          style={
                            {
                              aspectRatio: aspectOf(current),
                              "--photo-aspect": aspectOf(current),
                            } as CSSProperties
                          }
                        >
                          <PhotoView
                            photo={current}
                            overlay={false}
                            label="滑动比较：之前的试拍"
                          />
                          <div
                            className="slider-after"
                            style={{ clipPath: `inset(0 0 0 ${slider}%)` }}
                          >
                            <PhotoView
                              photo={retake}
                              overlay={false}
                              label="滑动比较：这次拍摄"
                            />
                          </div>
                          <span className="slider-label before">之前</span>
                          <span className="slider-label after">这次</span>
                          <div
                            className="slider-divider"
                            style={{ left: `${slider}%` }}
                          >
                            <MoveHorizontal size={20} />
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={slider}
                            onChange={(e) => setSlider(Number(e.target.value))}
                            aria-label="拖动查看两张照片"
                          />
                        </div>
                        <div className="slider-preferences">
                          <button
                            className={`preference-button ${preference === "before" ? "selected" : ""}`}
                            aria-pressed={preference === "before"}
                            onClick={() => setPreference("before")}
                          >
                            {preference === "before" && <Check size={15} />}
                            我更喜欢之前那张
                          </button>
                          <button
                            className={`preference-button ${preference === "after" ? "selected" : ""}`}
                            aria-pressed={preference === "after"}
                            onClick={() => setPreference("after")}
                          >
                            {preference === "after" && <Check size={15} />}
                            我更喜欢这张
                          </button>
                        </div>
                      </>
                    )}
                    {basis}
                  </div>
                  <aside className="compare-summary">
                    {referencePeek()}
                    <div className="result-note">
                      <span className="eyebrow">YOUR EYE. YOUR CHOICE.</span>
                      <h2>
                        {preference
                          ? "喜欢，就留住它。"
                          : "留哪一张，\n你说了算。"}
                      </h2>
                      <p>
                        {preference === "before"
                          ? "已经选中之前的试拍。我们会保存这一张的裁切画面。"
                          : preference === "after"
                            ? "已经选中这次拍摄。我们会保存这一张的裁切画面。"
                            : "先选一张更喜欢的。保存的照片保留当前裁切，不含人物框和构图线。"}
                      </p>
                    </div>
                    <button
                      className="button primary full"
                      disabled={!preference || !!busy}
                      onClick={() =>
                        preference &&
                        void savePhoto(
                          preference === "before" ? current : retake,
                          preference === "before"
                            ? `第${shots.length}张`
                            : `第${shots.length + 1}张`,
                        )
                      }
                    >
                      <Download size={17} />
                      保存这张照片
                    </button>
                    <button
                      className="button secondary full"
                      onClick={continueShooting}
                    >
                      还想调整
                      <ArrowRight size={17} />
                    </button>
                    <button
                      className="text-button change-goal"
                      onClick={() => go("reference")}
                    >
                      换一个构图目标
                    </button>
                    <p className="comparison-basis">
                      本次只比较{goalName}。<br />
                      接近参考的程度，不是照片的好坏评分。
                    </p>
                  </aside>
                </div>
              </section>
            )}
        </main>
      )}
      <footer className="site-footer">
        <span>
          照着拍<span className="footer-dot"> · </span>让喜欢，有迹可循。
        </span>
        <span>一张参考。一步调整。一张喜欢的照片。</span>
        <span>MADE FOR LITTLE MOMENTS</span>
      </footer>
      {(error || notice || busy) && (
        <div
          className={`status-toast ${error ? "error" : ""}`}
          role={error ? "alert" : "status"}
          aria-live="polite"
        >
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : error ? (
            <ImagePlus size={18} />
          ) : (
            <Check size={18} />
          )}
          <span>{error || busy || notice}</span>
          {!busy && (
            <button
              aria-label="关闭提示"
              onClick={() => {
                setError("");
                setNotice("");
              }}
            >
              <X size={17} />
            </button>
          )}
        </div>
      )}
      {edit && (
        <PhotoEditor
          key={edit.photo.id}
          photo={edit.photo}
          reference={edit.slot === "reference"}
          initialTab={edit.tab}
          onSave={saveEdit}
          onClose={() => setEdit(null)}
        />
      )}
      {modal === "reference" && reference && (
        <Modal title="心里的那张参考" onClose={() => setModal(null)}>
          <PhotoView
            photo={reference}
            goal={activeGoal}
            side={side}
            label="放大的参考照片"
          />
          <p className="modal-caption">你选的目标 · {goalName}</p>
        </Modal>
      )}
      {modal === "about" && (
        <Modal title="把喜欢，变成下一步。" onClose={() => setModal(null)}>
          <div className="about-content">
            <p>
              朋友知道你想拍照，却不一定知道你心里那张照片的样子。「照着拍」帮你把参考图里的一个构图偏好，讲成可以执行的一步。
            </p>
            {[
              "选一张参考，选出最想借鉴的构图。",
              "上传试拍，确认人物框，得到一条指引。",
              "照着调整，再拍一张，留下你喜欢的。",
            ].map((t, i) => (
              <div className="about-step" key={t}>
                <span>0{i + 1}</span>
                <p>{t}</p>
              </div>
            ))}
            <div className="about-note">
              <ShieldCheck size={19} />
              <div>
                <strong>你的照片，留在你这里。</strong>
                <p>
                  当前版本在浏览器内处理照片，由你确认人物框，再计算构图差异。没有接入
                  AI
                  人物识别，也不会上传照片。刷新页面会清空会话，请先保存喜欢的照片。
                </p>
              </div>
            </div>
            <p className="about-sample">
              咖啡馆示例使用同一张 AI
              生成素材的不同裁切展示构图变化，不代表真实现场重拍。首版面向单人照片，暂不提供实时取景、姿势或灯光分析。
            </p>
            <button
              className="button primary full"
              onClick={() => setModal(null)}
            >
              知道了
              <Check size={17} />
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function ArrowUpRightIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M4 12 12 4M4 4h8v8" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
