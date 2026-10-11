import { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Bookmark,
  Camera,
  Check,
  Compass,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Search,
  Sun,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { Photo } from "../lib/types";
import type { Capture } from "../domain/session";
import { readPhoto, releasePhoto, releasePhotos } from "../lib/images";
import { TEMPLATES, templatePhoto } from "../lib/catalog";
import type { Template } from "../lib/catalog";
import { LIGHT_RECIPES } from "../domain/lighting";
import Modal from "../components/Modal";
import PhotoEditor from "../components/PhotoEditor";
import ShootingBrief from "../components/ShootingBrief";
import ReferenceStudio from "./ReferenceStudio";
import GuidedCamera from "./GuidedCamera";
import PhotoResult from "./PhotoResult";
import ScenePlanner from "./ScenePlanner";
import { MOTIONS } from "./experience";
import type { NotebookTarget, Scene } from "./experience";
import { deleteCard, listCards, restoreCard, saveCard } from "./storage";
import type { SavedCard } from "./storage";

const filters = ["推荐", "咖啡馆", "街拍", "出游", "夜景", "画作"];
const categories: Record<string, string[]> = {
  咖啡馆: ["window"],
  街拍: ["city", "garden", "architecture"],
  出游: ["dusk", "meadow"],
  夜景: ["rain"],
  画作: ["painting"],
};
const titles: Record<string, string> = {
  window: "咖啡馆别只拍咖啡，窗边这样坐就很好看",
  city: "不会摆姿势？借一点街角的阳光",
  dusk: "海边日落，把风也拍进照片里",
  rain: "下雨也有好照片，借橱窗的一盏灯",
  garden: "路过这面墙，想给你拍张照",
  architecture: "人小一点，让建筑替你讲故事",
  meadow: "等风来，顺便伸一个懒腰",
  painting: "周末在家，试试油画里的安静姿态",
};
type Shot = { capture: Capture; target: NotebookTarget };
function SavedImage({ card }: { card: SavedCard }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const value = URL.createObjectURL(
      card.capture?.photo.blob ?? card.reference.blob,
    );
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [card]);
  return url ? <img src={url} alt={card.title} /> : null;
}
export default function NotebookApp() {
  const [stage, setStage] = useState<
    "home" | "reference" | "camera" | "result"
  >("home");
  const [tab, setTab] = useState<"discover" | "favorites" | "mine">("discover");
  const [filter, setFilter] = useState("推荐"),
    [query, setQuery] = useState(""),
    [searching, setSearching] = useState(false);
  const [note, setNote] = useState<Template | null>(null),
    [start, setStart] = useState(false),
    [sceneEntry, setSceneEntry] = useState(false);
  const [initialScene, setInitialScene] = useState<Scene>(),
    [reference, setReference] = useState<Photo | null>(null),
    [template, setTemplate] = useState<Template>();
  const [target, setTarget] = useState<NotebookTarget | null>(null),
    [shots, setShots] = useState<Shot[]>([]),
    [selectedShot, setSelectedShot] = useState(0);
  const [upload, setUpload] = useState<Photo | null>(null),
    [prep, setPrep] = useState(false),
    [busy, setBusy] = useState(false),
    [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [cards, setCards] = useState<SavedCard[]>([]),
    [deleting, setDeleting] = useState<SavedCard | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);
  const input = useRef<HTMLInputElement>(null),
    request = useRef(0);
  useEffect(() => {
    try {
      const value: unknown = JSON.parse(
        localStorage.getItem("zhaozhepai-notebook-favorites") ?? "[]",
      );
      if (Array.isArray(value))
        setFavorites(
          value.filter(
            (v): v is string =>
              typeof v === "string" && TEMPLATES.some((t) => t.id === v),
          ),
        );
    } catch {
      setError("收藏记录读取失败，仍可浏览和拍摄。");
    }
    void refreshCards();
    return () => {
      request.current++;
      releasePhotos();
    };
  }, []);
  async function refreshCards() {
    try {
      setCards((await listCards()).sort((a, b) => b.updated - a.updated));
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function go(next: typeof stage) {
    setStage(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function home(next: typeof tab = "discover") {
    request.current++;
    setBusy(false);
    setPrep(false);
    setReference(null);
    setTarget(null);
    setShots([]);
    setTemplate(undefined);
    setInitialScene(undefined);
    setError("");
    setMessage("");
    releasePhotos();
    setTab(next);
    go("home");
  }
  function favorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((v) => v !== id)
      : [...favorites, id];
    try {
      localStorage.setItem(
        "zhaozhepai-notebook-favorites",
        JSON.stringify(next),
      );
      setFavorites(next);
    } catch {
      setError("这次收藏没有保存成功，请检查浏览器是否允许本地存储。");
    }
  }
  async function choose(t: Template, scene?: Scene) {
    const id = ++request.current;
    setBusy(true);
    setError("");
    try {
      const photo = await templatePhoto(t);
      if (id !== request.current) {
        releasePhoto(photo);
        return;
      }
      releasePhotos();
      setReference(photo);
      setTemplate(t);
      setTarget(null);
      setShots([]);
      setInitialScene(scene);
      setNote(null);
      setSceneEntry(false);
      setStart(false);
      setMessage("");
      go("reference");
    } catch {
      setError("这张参考没有打开，请重试或导入自己的照片。");
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
      if (id === request.current) {
        setUpload(photo);
        setStart(false);
      } else releasePhoto(photo);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      if (id === request.current) setBusy(false);
    }
  }
  async function save(plan: NotebookTarget, capture?: Capture) {
    if (!reference || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await saveCard(reference, plan, template?.id, capture);
      await refreshCards();
      setMessage("已保存到「我的小卡」，刷新后也能找回。");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  function restore(card: SavedCard) {
    request.current++;
    releasePhotos();
    const restored = restoreCard(card);
    setReference(restored.reference);
    setTarget(restored.target);
    setTemplate(TEMPLATES.find((t) => t.id === card.templateId));
    setInitialScene(restored.target.notebook?.scene);
    setShots(
      restored.capture
        ? [{ capture: restored.capture, target: restored.captureTarget }]
        : [],
    );
    setSelectedShot(0);
    setMessage("已恢复参考与拍摄方案，可以继续调整或开拍。");
    setError("");
    go("reference");
  }
  const current = shots[selectedShot];
  const visible = TEMPLATES.filter(
    (t) =>
      (tab !== "favorites" || favorites.includes(t.id)) &&
      (tab !== "discover" ||
        filter === "推荐" ||
        categories[filter]?.includes(t.id)) &&
      (!query.trim() ||
        `${titles[t.id]} ${t.subtitle} ${t.tag} ${t.story}`.includes(
          query.trim(),
        )),
  );
  return (
    <>
      <aside className="nb-desktop">
        <span className="nb-wordmark">
          照着拍<span> / 笔记版</span>
        </span>
        <h1>
          收藏的好照片，
          <br />
          这次真的拍出来。
        </h1>
        <p>
          把参考变成两个人都看得懂的拍法。
          <br />
          一个选喜欢，一个帮忙拍。
        </p>
        <a href="./compare.html">
          对比两个版本 <ArrowUpRight size={16} />
        </a>
        <div className="nb-desktop-note">
          <span>01 选一张喜欢的参考</span>
          <span>02 看现场，约好怎么拍</span>
          <span>03 拍一张，只改一点</span>
        </div>
      </aside>
      <div className="v4-phone-shell notebook-app">
        <div className={stage === "camera" ? "v2-app camera-active" : "v2-app"}>
          {stage !== "camera" && (
            <header className="nb-header">
              <button
                className="nb-logo"
                onClick={() => home()}
                aria-label="照着拍笔记版首页"
              >
                照着拍<span>一起拍好看</span>
              </button>
              <div>
                {stage === "home" ? (
                  <button
                    aria-label="搜索拍法笔记"
                    onClick={() => setSearching((v) => !v)}
                  >
                    <Search size={22} />
                  </button>
                ) : (
                  <button aria-label="返回发现" onClick={() => home()}>
                    <Compass size={22} />
                  </button>
                )}
                <a href="./compare.html" aria-label="对比两个版本">
                  A/B
                </a>
              </div>
            </header>
          )}
          <input
            ref={input}
            className="sr-only"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="导入自己的参考"
            onChange={(e) => {
              void importFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          {busy && (
            <div className="nb-toast" role="status">
              <LoaderCircle className="spin" size={16} /> 正在准备参考…
            </div>
          )}
          {error && (
            <div className="nb-alert" role="alert">
              {error}
              <button aria-label="关闭提示" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}
          {message && stage !== "camera" && (
            <p className="nb-message" role="status">
              <Check size={15} />
              {message}
            </p>
          )}
          {stage === "home" && (
            <main className="nb-home">
              {searching && tab !== "mine" && (
                <label className="nb-search">
                  <Search size={16} />
                  <input
                    autoFocus
                    aria-label="搜索关键词"
                    placeholder="搜场景、光线，或一种感觉"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button aria-label="清空搜索" onClick={() => setQuery("")}>
                      <X size={16} />
                    </button>
                  )}
                </label>
              )}
              {tab === "discover" && (
                <>
                  <nav className="nb-categories" aria-label="拍摄场景">
                    {filters.map((f) => (
                      <button
                        key={f}
                        aria-pressed={f === filter}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                  </nav>
                  {!query && filter === "推荐" && (
                    <section className="nb-quick-start">
                      <div>
                        <span className="nb-kicker">
                          把「喜欢」变成「会拍」
                        </span>
                        <h2>参考有了，然后呢？</h2>
                        <p>带上你存的那张图，剩下的一起想。</p>
                        <button onClick={() => input.current?.click()}>
                          导入我的参考 <ArrowUpRight size={14} />
                        </button>
                      </div>
                      <div className="nb-mini-photo">
                        <img
                          src="./images/cafe-editorial.png"
                          alt="窗边咖啡馆参考"
                        />
                        <span>
                          <Sun size={12} /> 从一束窗光开始
                        </span>
                      </div>
                    </section>
                  )}
                  <div className="nb-feed-heading">
                    <span>
                      {filter === "推荐" ? "今天想拍什么感觉" : `${filter}拍法`}
                    </span>
                    <small>选图 · 看拍法 · 一起拍</small>
                  </div>
                </>
              )}
              {tab === "favorites" && (
                <div className="nb-page-title">
                  <span className="nb-kicker">下次就这样拍</span>
                  <h1>
                    我的收藏 <small>{favorites.length}</small>
                  </h1>
                  <p>先把喜欢的留住，等一个有光的下午。</p>
                </div>
              )}
              {tab !== "mine" && (
                <>
                  <div className="nb-waterfall">
                    {[0, 1].map((column) => (
                      <div className="nb-column" key={column}>
                        {visible
                          .filter((_, i) => i % 2 === column)
                          .map((t) => (
                            <article
                              className={`nb-note-card nb-note-${t.id}`}
                              key={t.id}
                            >
                              <button
                                className="nb-note-open"
                                onClick={() => setNote(t)}
                                aria-label={`查看拍法：${titles[t.id]}`}
                              >
                                <div className="nb-note-image">
                                  <img
                                    loading="lazy"
                                    src={`./images/${t.image}`}
                                    alt={t.subtitle}
                                  />
                                  <span>{t.tag}</span>
                                </div>
                                <h3>{titles[t.id]}</h3>
                              </button>
                              <div className="nb-note-meta">
                                <span>
                                  <i>照</i>
                                  {t.difficulty}
                                </span>
                                <button
                                  aria-label={`${favorites.includes(t.id) ? "取消收藏" : "收藏"}：${titles[t.id]}`}
                                  aria-pressed={favorites.includes(t.id)}
                                  onClick={() => favorite(t.id)}
                                >
                                  <Bookmark
                                    size={17}
                                    fill={
                                      favorites.includes(t.id)
                                        ? "currentColor"
                                        : "none"
                                    }
                                  />
                                </button>
                              </div>
                            </article>
                          ))}
                      </div>
                    ))}
                  </div>
                  {!visible.length && (
                    <div className="nb-empty">
                      <Bookmark size={30} />
                      <h2>
                        {query
                          ? "还没有找到这类拍法"
                          : "给下次拍照，留一点灵感"}
                      </h2>
                      <p>
                        {query
                          ? "试试“窗边”“夜景”或“街角”。"
                          : "点参考卡片上的收藏，就能在这里找到。"}
                      </p>
                      <button
                        onClick={() => {
                          setQuery("");
                          setFilter("推荐");
                          setTab("discover");
                        }}
                      >
                        去看看参考 →
                      </button>
                    </div>
                  )}
                  <p className="nb-feed-end">
                    原创生成参考 · 拍法经过编辑整理
                    <br />
                    不用拍得一模一样，喜欢就好。
                  </p>
                </>
              )}
              {tab === "mine" && (
                <>
                  <div className="nb-page-title">
                    <span className="nb-kicker">带着自己的拍法出门</span>
                    <h1>
                      我的拍摄小卡 <small>{cards.length}/12</small>
                    </h1>
                    <p>参考、现场方案和一张拍摄结果，放在一起。</p>
                  </div>
                  <div className="nb-local-note">
                    只保存在当前浏览器。换设备不会同步，清理网站数据会删除；重要原片请另行导出。
                  </div>
                  {cards.length ? (
                    <div className="nb-saved-list">
                      {cards.map((card) => (
                        <article key={card.id}>
                          <button
                            className="nb-saved-open"
                            onClick={() => restore(card)}
                          >
                            <SavedImage card={card} />
                            <div>
                              <small>
                                {card.capture ? "含拍摄结果" : "已备好拍法"} ·{" "}
                                {new Date(card.updated).toLocaleDateString(
                                  "zh-CN",
                                )}
                              </small>
                              <h3>{card.title}</h3>
                              <p>
                                {
                                  MOTIONS[
                                    card.target.notebook?.motion ?? "none"
                                  ].title
                                }
                              </p>
                              <b>继续这次拍摄 →</b>
                            </div>
                          </button>
                          <button
                            className="nb-delete"
                            aria-label={`删除小卡：${card.title}`}
                            onClick={() => setDeleting(card)}
                          >
                            <Trash2 size={17} />
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="nb-empty">
                      <Camera size={34} />
                      <h2>下一次，不用从头想</h2>
                      <p>
                        选好参考和方案后，点「保存拍摄小卡」。
                        <br />
                        拍完还可以把满意的一张放进去。
                      </p>
                      <button onClick={() => setTab("discover")}>
                        从一张参考开始 →
                      </button>
                    </div>
                  )}
                  <div className="nb-about">
                    <h3>两个人，一张喜欢的照片。</h3>
                    <p>
                      实时人物与构图检测在本机完成。光线选择和动作脚本是拍摄建议；仅在主动同意深度解读时发送参考缩略图。
                    </p>
                    <a href="./compare.html">看看原来的暖色版本 ↗</a>
                  </div>
                </>
              )}
            </main>
          )}
          {reference && (
            <div hidden={stage !== "reference"}>
              {shots.length > 0 && (
                <button
                  className="nb-resume-shot"
                  onClick={() => {
                    setSelectedShot(shots.length - 1);
                    go("result");
                  }}
                >
                  查看已保存或刚拍下的照片 →
                </button>
              )}
              <ReferenceStudio
                key={reference.id}
                photo={reference}
                template={template}
                initialScene={initialScene}
                confirmedTarget={target}
                onBack={() => home()}
                onPhoto={(p) => {
                  setReference(p);
                  setTarget(null);
                  shots.forEach((s) => releasePhoto(s.capture.photo));
                  setShots([]);
                }}
                onConfirm={(t) => {
                  setTarget(t);
                  setMessage("");
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
              onPrevious={
                shots.length
                  ? () => {
                      setSelectedShot(shots.length - 1);
                      go("result");
                    }
                  : undefined
              }
              onCapture={(capture) => {
                const next = [...shots, { capture, target }];
                if (next.length > 6) releasePhoto(next.shift()!.capture.photo);
                setShots(next);
                setSelectedShot(next.length - 1);
                go("result");
              }}
            />
          )}
          {stage === "result" && reference && current && (
            <>
              <div className="nb-filmstrip" aria-label="本次最近拍摄">
                {shots.map((shot, i) => (
                  <button
                    key={shot.capture.id}
                    aria-label={`查看第 ${i + 1} 张`}
                    aria-pressed={i === selectedShot}
                    onClick={() => setSelectedShot(i)}
                  >
                    <img src={shot.capture.photo.url} alt={`第 ${i + 1} 张`} />
                    <span>{i + 1}</span>
                  </button>
                ))}
                <small>
                  最近 {shots.length} 张<br />
                  点一下比较
                </small>
              </div>
              <PhotoResult
                key={current.capture.id}
                reference={reference}
                capture={current.capture}
                target={current.target}
                onRetry={() => {
                  setTarget(current.target);
                  go("camera");
                }}
                onFeedback={(next) => {
                  setTarget(next);
                  go("camera");
                }}
                onEdit={() => {
                  setTarget(current.target);
                  go("reference");
                }}
                onHome={() => home()}
              />
              <div className="nb-save-result">
                <button
                  className="button primary full"
                  disabled={saving}
                  onClick={() => void save(current.target, current.capture)}
                >
                  <Bookmark size={17} />{" "}
                  {saving ? "正在保存…" : "把这一张存进拍摄小卡"}
                </button>
                <small>小卡保存长边约 1600px 的照片，原片请单独导出。</small>
              </div>
            </>
          )}
          {stage === "home" && (
            <nav className="nb-bottom-nav" aria-label="主导航">
              <button
                aria-current={tab === "discover" ? "page" : undefined}
                onClick={() => {
                  setTab("discover");
                  setQuery("");
                }}
              >
                <Compass size={23} />
                <span>发现</span>
              </button>
              <button
                aria-current={tab === "favorites" ? "page" : undefined}
                onClick={() => {
                  setTab("favorites");
                  setQuery("");
                }}
              >
                <Bookmark size={22} />
                <span>收藏</span>
              </button>
              <button
                className="nb-nav-camera"
                aria-label="开始拍摄"
                onClick={() => setStart(true)}
              >
                <Camera size={26} />
              </button>
              <button
                aria-current={tab === "mine" ? "page" : undefined}
                onClick={() => {
                  setTab("mine");
                  setQuery("");
                  void refreshCards();
                }}
              >
                <UserRound size={23} />
                <span>我的小卡</span>
              </button>
            </nav>
          )}
          {note && (
            <Modal title="拍法笔记" onClose={() => setNote(null)}>
              <article className="nb-detail">
                <img
                  className="nb-detail-image"
                  src={`./images/${note.image}`}
                  alt={note.subtitle}
                />
                <div className="nb-detail-body">
                  <span className="nb-kicker">照着拍编辑部 · 原创生成参考</span>
                  <h2>{titles[note.id]}</h2>
                  <p>{note.story}</p>
                  <div className="nb-tags">
                    <span>#{note.tag}</span>
                    <span>#{note.difficulty}</span>
                    <span>#朋友帮我拍</span>
                  </div>
                  <h3>这张的关键，只有三件事</h3>
                  <ol>
                    <li>
                      <b>先找光</b>
                      <p>{LIGHT_RECIPES[note.light].find}</p>
                    </li>
                    <li>
                      <b>拿手机的人</b>
                      <p>{LIGHT_RECIPES[note.light].camera}</p>
                    </li>
                    <li>
                      <b>镜头前的人</b>
                      <p>{LIGHT_RECIPES[note.light].moment}</p>
                    </li>
                  </ol>
                  <p className="nb-local-note">
                    {LIGHT_RECIPES[note.light].limitation}
                  </p>
                </div>
                <div className="nb-detail-actions">
                  <button
                    aria-pressed={favorites.includes(note.id)}
                    onClick={() => favorite(note.id)}
                  >
                    <Bookmark size={20} />
                    {favorites.includes(note.id) ? "已收藏" : "收藏拍法"}
                  </button>
                  <button
                    className="button primary"
                    disabled={busy}
                    onClick={() => void choose(note)}
                  >
                    照着这张拍 <ArrowUpRight size={17} />
                  </button>
                </div>
              </article>
            </Modal>
          )}
          {start && (
            <Modal title="今天，从哪里开始？" onClose={() => setStart(false)}>
              <div className="nb-start-options">
                <button onClick={() => input.current?.click()}>
                  <ImagePlus size={26} />
                  <span>
                    <b>我有一张喜欢的参考</b>
                    <small>导入照片，把喜欢的变成拍法</small>
                  </span>
                  <ArrowUpRight size={20} />
                </button>
                <button
                  onClick={() => {
                    setStart(false);
                    setSceneEntry(true);
                  }}
                >
                  <MapPin size={26} />
                  <span>
                    <b>没有参考，就在这里拍</b>
                    <small>看看现场的光，找一张适合的拍法</small>
                  </span>
                  <ArrowUpRight size={20} />
                </button>
              </div>
            </Modal>
          )}
          {sceneEntry && (
            <Modal
              title="就在这里，找个好拍法"
              onClose={() => setSceneEntry(false)}
            >
              <ScenePlanner
                reference={null}
                onApply={(scene) => {
                  const t =
                    TEMPLATES.find((t) => t.light === scene.light) ??
                    TEMPLATES[5];
                  void choose(t, scene);
                }}
              />
              <p className="nb-muted">
                会按你选的光线匹配一张编辑参考；仍可在下一步调整。
              </p>
            </Modal>
          )}
          {upload && (
            <PhotoEditor
              photo={upload}
              reference
              initialTab="crop"
              onClose={() => {
                releasePhoto(upload);
                setUpload(null);
              }}
              onSave={(p) => {
                setReference(p);
                setTemplate(undefined);
                setTarget(null);
                setShots([]);
                setInitialScene(undefined);
                setUpload(null);
                go("reference");
              }}
            />
          )}
          {prep && reference && target && (
            <Modal
              title="约好怎么拍，再把手机交给同伴"
              onClose={() => setPrep(false)}
            >
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
              {target.notebook?.motion !== "none" &&
                target.notebook?.motion && (
                  <p className="nb-brief-motion">
                    动作约定：{MOTIONS[target.notebook.motion].title}
                    。相机里会分别提示两个人。
                  </p>
                )}
              <button
                className="nb-save-plan"
                disabled={saving}
                onClick={() => void save(target)}
              >
                <Bookmark size={17} />
                {saving ? "正在保存…" : "先保存拍摄小卡，下次再拍"}
              </button>
              <small className="nb-muted">
                保存在当前浏览器，可以从「我的小卡」继续。
              </small>
              {message && (
                <p className="nb-message" role="status">
                  {message}
                </p>
              )}
              {error && <p role="alert">{error}</p>}
            </Modal>
          )}
          {deleting && (
            <Modal title="删除这张拍摄小卡？" onClose={() => setDeleting(null)}>
              <p className="nb-muted">
                只删除「{deleting.title}
                」在当前浏览器的小卡。已下载的照片不会受影响。
              </p>
              <button
                className="button primary full"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  try {
                    await deleteCard(deleting.id);
                    setDeleting(null);
                    await refreshCards();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                删除这张小卡
              </button>
            </Modal>
          )}
        </div>
      </div>
    </>
  );
}
