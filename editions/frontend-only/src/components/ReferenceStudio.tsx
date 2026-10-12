import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Brush,
  Check,
  Crop,
  Camera,
  Eraser,
  FlipHorizontal2,
  Hand,
  LoaderCircle,
  Redo2,
  RotateCw,
  Sparkles,
  Trash2,
  Undo2,
  UserRound,
} from "lucide-react";
import type { Photo } from "../lib/types";
import type { Template } from "../lib/catalog";
import type {
  Feature,
  Group,
  Person,
  Stroke,
  Target,
  TargetDraft,
  Insight,
} from "../domain/session";
import { GROUPS, FEATURES, SUPPORT, CONFIDENCE } from "../domain/session";
import { groupsFromStrokes, usableGroups } from "../domain/pose";
import {
  canConfirm,
  describeTarget,
  localInsights,
  parseLocalEdit,
  preparation,
} from "../domain/interpretation";
import type { ImageStats } from "../domain/interpretation";
import { PoseClient } from "../lib/pose-client";
import { photoCanvas } from "../lib/images";
import { imageStats, referenceData, rotatePhoto } from "../lib/imaging";
import { aspectOf } from "../lib/geometry";
import SelectionCanvas from "./SelectionCanvas";
import PhotoEditor from "./PhotoEditor";
import Modal from "./Modal";
import { priorities, PRIORITIES } from "../domain/collaboration";
import type { Priority } from "../domain/collaboration";
import LightPlanner from "./LightPlan";
import { LIGHT_RECIPES } from "../domain/lighting";
import type { LightChoice } from "../domain/lighting";

export default function ReferenceStudio({
  photo,
  template,
  confirmedTarget,
  onPhoto,
  onBack,
  onConfirm,
}: {
  photo: Photo;
  template?: Template;
  confirmedTarget?: Target | null;
  onPhoto: (p: Photo) => void;
  onBack: () => void;
  onConfirm: (t: Target) => void;
}) {
  const [lighting, setLighting] = useState<LightChoice>({
    reference: template?.light ?? null,
    setup: template?.light ?? null,
  });
  const [people, setPeople] = useState<Person[]>([]),
    [selected, setSelected] = useState<number | null>(null),
    [detecting, setDetecting] = useState(true),
    [detectError, setDetectError] = useState(""),
    [attempt, setAttempt] = useState(0);
  const [strokes, setStrokes] = useState<Stroke[]>([]),
    [future, setFuture] = useState<Stroke[]>([]),
    [tool, setTool] = useState<"paint" | "erase" | "pan">("paint"),
    [radius, setRadius] = useState(0.045);
  const [mode, setMode] = useState<"partial" | "whole">("partial"),
    [features, setFeatures] = useState<Feature[]>(["composition"]),
    [wholeFeatures, setWholeFeatures] = useState<Feature[]>(
      Object.keys(FEATURES) as Feature[],
    ),
    [mirror, setMirror] = useState(false),
    [ignoreContact, setIgnoreContact] = useState(false);
  const [stats, setStats] = useState<ImageStats>(),
    [override, setOverride] = useState<TargetDraft | null>(null),
    [edited, setEdited] = useState<string | null>(null),
    [editError, setEditError] = useState(""),
    [cloudInsights, setCloudInsights] = useState<Insight[] | null>(null),
    [cloudNote, setCloudNote] = useState("");
  const [custom, setCustom] = useState(false),
    [priorityNote, setPriorityNote] = useState(""),
    [crop, setCrop] = useState(false),
    [cloud, setCloud] = useState(false),
    [cloudBusy, setCloudBusy] = useState(false),
    [configured, setConfigured] = useState<boolean | null>(null),
    [cloudError, setCloudError] = useState(""),
    [rotation, setRotation] = useState(false),
    [geometryChange, setGeometryChange] = useState<"crop" | "rotate" | null>(
      null,
    );
  const revision = useRef(0),
    request = useRef<AbortController | null>(null);
  const person = selected === null ? null : (people[selected] ?? null),
    available = usableGroups(person);
  const paintedGroups = useMemo(
    () => groupsFromStrokes(person, strokes, aspectOf(photo)),
    [person, strokes, photo],
  );
  const base: TargetDraft = {
    mode,
    groups: mode === "whole" ? available : paintedGroups,
    features: mode === "whole" ? wholeFeatures : features,
    mirror,
    ignoreContact,
  };
  const draft = override ?? base,
    box =
      confirmedTarget?.photoId === photo.id
        ? confirmedTarget.box
        : (person?.box ?? photo.subject);
  const activeAdjustment =
    confirmedTarget?.adjustment &&
    (confirmedTarget.adjustment.feedback === "free-pose"
      ? draft.groups.length === 0
      : draft.features.includes("composition"))
      ? confirmedTarget.adjustment
      : undefined;
  const selectedPriorities = priorities(draft);
  const insights =
    cloudInsights ??
    localInsights(box, stats, template?.notes).map((i) =>
      i.id === "composition" && !person && !photo.subject.confirmed
        ? {
            ...i,
            confidence: "unknown" as const,
            evidence: "还没有确认人物范围；请先识别人像或手动框选。",
          }
        : i,
    );
  const readyToConfirm =
    canConfirm(draft, person, photo.subject.confirmed) &&
    (!draft.features.includes("light") || !!lighting.setup) &&
    !(people.length > 1 && selected === null);
  const text = edited ?? describeTarget(draft),
    dirty = edited !== null;
  useEffect(() => {
    let cancelled = false;
    const client = new PoseClient();
    setDetecting(true);
    setDetectError("");
    setPeople([]);
    setSelected(null);
    void photoCanvas(photo, 1000)
      .then((c) => client.detect(c))
      .then((result) => {
        if (cancelled) return;
        setPeople(result.people);
        setSelected(result.people.length === 1 ? 0 : null);
        if (!result.people.length)
          setDetectError(
            "暂时没找到清晰的人体。可以换张照片，或手动确认人物框，只学构图。",
          );
      })
      .catch(() => {
        if (!cancelled)
          setDetectError(
            "人体检测暂不可用。可以重试，或手动确认人物框后仅作构图参考。",
          );
      })
      .finally(() => {
        if (!cancelled) setDetecting(false);
        client.dispose();
      });
    void imageStats(photo)
      .then((s) => {
        if (!cancelled) setStats(s);
      })
      .catch(() => {
        if (!cancelled) setStats(undefined);
      });
    return () => {
      cancelled = true;
      client.dispose();
    };
  }, [photo, attempt]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    if (!confirmedTarget || confirmedTarget.photoId !== photo.id) return;
    const { mode, groups, features, ignoreContact, mirror } = confirmedTarget;
    setOverride({ mode, groups, features, ignoreContact, mirror });
    if (confirmedTarget.lighting) setLighting(confirmedTarget.lighting);
    setEdited(null);
    revision.current = confirmedTarget.revision;
  }, [confirmedTarget?.id]);
  function changed(resetText = false) {
    revision.current++;
    request.current?.abort();
    setCloudBusy(false);
    setOverride(null);
    if (resetText) setEdited(null);
    setEditError("");
    setCloudInsights(null);
    setCloudNote("");
    setPriorityNote("");
  }
  function priority(id: Priority) {
    const selected = selectedPriorities.includes(id);
    if (!selected && selectedPriorities.length >= 2) {
      setPriorityNote("先保留最在意的两项，取消一项后再选择。");
      return;
    }
    const next: TargetDraft = {
      ...draft,
      groups: [...draft.groups],
      features: [...draft.features],
    };
    if (id === "composition")
      next.features = selected
        ? next.features.filter((f) => f !== "composition")
        : [...next.features, "composition"];
    if (id === "pose")
      next.groups = selected ? [] : available.filter((g) => GROUPS[g].live);
    if (id === "mood")
      next.features = selected
        ? next.features.filter((f) => f === "composition")
        : [...next.features, "light", "color"];
    request.current?.abort();
    setCloudBusy(false);
    revision.current++;
    setOverride(next);
    setFeatures(next.features);
    setWholeFeatures(next.features);
    setPriorityNote("");
    setCloudNote("");
  }
  function addStroke(s: Stroke) {
    if (strokes.length >= 60) {
      setCloudNote("选区已达到 60 笔。请先撤销或清空部分笔迹再继续。");
      return;
    }
    changed();
    setStrokes((old) => [...old, s]);
    setFuture([]);
  }
  function feature(f: Feature) {
    changed();
    const setter = mode === "whole" ? setWholeFeatures : setFeatures;
    setter((old) =>
      old.includes(f) ? old.filter((v) => v !== f) : [...old, f],
    );
  }
  function applyEdit() {
    const parsed = parseLocalEdit(text, draft, available);
    if (parsed.ok) {
      revision.current++;
      setOverride(parsed.draft);
      setEdited(null);
      setEditError("");
      setCloudNote("修改已应用。下方列出的目标将用于拍摄。");
    } else setEditError(parsed.message);
  }
  function confirm() {
    if (dirty || !readyToConfirm) return;
    const actualInsights = insights.map((i) =>
      i.id === "light" && lighting.setup
        ? {
            ...i,
            summary: LIGHT_RECIPES[lighting.setup].find,
            confidence: "inferred" as const,
            evidence: "来自你确认的现场用光方案，不是相机自动识别的光源方向。",
          }
        : i,
    );
    onConfirm({
      ...draft,
      id: crypto.randomUUID(),
      photoId: photo.id,
      revision: revision.current,
      aspect: aspectOf(photo),
      person,
      box,
      text: describeTarget(draft),
      insights: actualInsights,
      lighting: { ...lighting },
      preparation: preparation(draft, actualInsights),
      ...(activeAdjustment ? { adjustment: activeAdjustment } : {}),
    });
  }
  async function openCloud() {
    setCloud(true);
    setCloudError("");
    setConfigured(null);
    if (import.meta.env.VITE_FRONTEND_ONLY === "true") {
      setConfigured(false);
      return;
    }
    try {
      const r = await fetch("/api/health");
      if (!r.ok) throw new Error();
      const d = await r.json();
      setConfigured(d.configured === true);
    } catch {
      setConfigured(false);
    }
  }
  async function analyze() {
    if (!configured) return;
    const controller = new AbortController();
    request.current?.abort();
    request.current = controller;
    const version = revision.current;
    setCloudBusy(true);
    setCloudError("");
    try {
      const response = await fetch("/api/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          consent: true,
          image: await referenceData(photo),
          text,
          draft,
          availableGroups: available,
          personBox: person || photo.subject.confirmed ? box : null,
          selection: strokes.map(({ id, ...s }) => s),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (version !== revision.current || controller.signal.aborted) return;
      setOverride(data.draft);
      setEdited(null);
      setEditError("");
      setCloudInsights(
        localInsights(box, stats, template?.notes).map(
          (i) => data.insights.find((j: Insight) => j.id === i.id) ?? i,
        ),
      );
      setCloudNote(data.explanation || "深度解读已完成。请检查目标后再确认。");
      setCloud(false);
    } catch (e) {
      if (!controller.signal.aborted)
        setCloudError(
          e instanceof Error ? e.message : "解读没有成功，请重试。",
        );
    } finally {
      if (request.current === controller) setCloudBusy(false);
    }
  }
  function requestGeometry(action: "crop" | "rotate") {
    if (strokes.length || dirty || override) {
      setGeometryChange(action);
      return;
    }
    if (action === "crop") setCrop(true);
    else void rotate();
  }
  function setOption(key: "mirror" | "ignoreContact", value: boolean) {
    revision.current++;
    request.current?.abort();
    setCloudBusy(false);
    setOverride({ ...draft, [key]: value });
    if (key === "mirror") setMirror(value);
    else setIgnoreContact(value);
  }
  async function rotate() {
    setRotation(true);
    try {
      const next = await rotatePhoto(photo);
      changed();
      setStrokes([]);
      setFuture([]);
      onPhoto(next);
    } catch {
      setDetectError("旋转没有成功，原图已保留。");
    } finally {
      setRotation(false);
    }
  }
  return (
    <main className="v2-studio page-enter">
      <div className="v2-page-heading">
        <button className="v2-back" onClick={onBack}>
          <ArrowLeft size={16} /> 换一张参考
        </button>
        <span className="eyebrow">01 / YOUR WISH, OUR PLAN</span>
        <h1>这张照片，你最在意什么？</h1>
        <p>先选一两项。把想要的讲清楚，再把手机交给帮你拍照的人。</p>
      </div>
      <div className="v3-priorities" aria-label="这次最在意的目标">
        {PRIORITIES.map((p) => (
          <button
            key={p.id}
            aria-pressed={selectedPriorities.includes(p.id)}
            className={selectedPriorities.includes(p.id) ? "selected" : ""}
            disabled={p.id === "pose" && !available.some((g) => GROUPS[g].live)}
            onClick={() => priority(p.id)}
          >
            <span className="v3-priority-check">
              {selectedPriorities.includes(p.id) && <Check size={15} />}
            </span>
            <span>
              <strong>{p.title}</strong>
              <small>{p.detail}</small>
              <em>{p.role}</em>
            </span>
          </button>
        ))}
      </div>
      {priorityNote && (
        <p className="v3-priority-note" role="status">
          {priorityNote}
        </p>
      )}
      <div className="v2-studio-grid">
        <section className="v2-reference-panel">
          <div className="v2-reference-title">
            <span>
              你的参考 <small>{photo.sample ? "原创示例" : "个人导入"}</small>
            </span>
            <div>
              <button
                aria-label="裁切与人物框"
                onClick={() => requestGeometry("crop")}
              >
                <Crop size={17} />
              </button>
              <button
                aria-label="顺时针旋转参考"
                disabled={rotation}
                onClick={() => requestGeometry("rotate")}
              >
                <RotateCw size={17} />
              </button>
            </div>
          </div>
          <SelectionCanvas
            photo={photo}
            strokes={strokes}
            onStroke={addStroke}
            tool={custom ? tool : "pan"}
            radius={radius}
            people={people}
            selected={selected}
            onSelect={(i) => {
              changed();
              setSelected(i);
              setStrokes([]);
              setFuture([]);
            }}
            groups={draft.groups}
            whole={mode === "whole"}
          />
          <div className="v2-draw-tools" aria-label="涂抹工具" hidden={!custom}>
            {(
              [
                ["paint", Brush, "画笔"],
                ["erase", Eraser, "橡皮"],
                ["pan", Hand, "移动"],
              ] as const
            ).map(([value, Icon, name]) => (
              <button
                key={value}
                className={tool === value ? "active" : ""}
                disabled={mode === "whole"}
                aria-pressed={tool === value}
                aria-label={name}
                onClick={() => setTool(value)}
              >
                <Icon size={17} />
              </button>
            ))}
            <label>
              <span>粗细</span>
              <input
                aria-label="画笔粗细"
                type="range"
                min=".015"
                max=".09"
                step=".005"
                value={radius}
                onChange={(e) => setRadius(+e.target.value)}
              />
            </label>
            <button
              aria-label="撤销涂抹"
              disabled={!strokes.length}
              onClick={() => {
                changed();
                setFuture((f) => [strokes.at(-1)!, ...f]);
                setStrokes((s) => s.slice(0, -1));
              }}
            >
              <Undo2 size={17} />
            </button>
            <button
              aria-label="重做涂抹"
              disabled={!future.length}
              onClick={() => {
                changed();
                setStrokes((s) => [...s, future[0]]);
                setFuture((f) => f.slice(1));
              }}
            >
              <Redo2 size={17} />
            </button>
            <button
              aria-label="清空涂抹"
              disabled={!strokes.length}
              onClick={() => {
                changed();
                setStrokes([]);
                setFuture([]);
              }}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="v2-detection-status" role="status">
            {detecting ? (
              <>
                <LoaderCircle size={15} className="spin" />{" "}
                正在本机识别人物与动作…
              </>
            ) : detectError ? (
              <>
                <span>{detectError}</span>
                <button onClick={() => setAttempt((a) => a + 1)}>
                  重试检测
                </button>
              </>
            ) : people.length > 1 ? (
              <span>识别到 {people.length} 个人，请先点选一个人物框。</span>
            ) : (
              <>
                <Check size={15} /> 已识别人像 ·{" "}
                {available.filter((g) => GROUPS[g].live).length
                  ? `可跟随${available
                      .filter((g) => GROUPS[g].live)
                      .map((g) => GROUPS[g].short)
                      .join("、")}`
                  : "手臂不清晰，可跟随构图"}
              </>
            )}
          </div>
          <p className="v2-small">
            {custom
              ? "涂抹只选择想参考的动作。裁切、旋转或换人物后需要重新确认目标。"
              : "先看人物位置和留白。想选某个动作，可以打开下方的精细调整。"}
          </p>
        </section>
        <section className="v2-target-panel">
          {template && (
            <div className="v4-reference-story">
              <span className="eyebrow">这张参考，值得学在哪里</span>
              <p>{template.story}</p>
              <small>
                {template.difficulty} · {LIGHT_RECIPES[template.light].effect}
              </small>
            </div>
          )}
          <div className="v3-goal-overview">
            <span className="eyebrow">A SHARED PICTURE</span>
            <h2>
              {draft.features.includes("composition")
                ? "先把画面，拍到一起。"
                : "只跟随你在意的感觉。"}
            </h2>
            <p>
              <Camera size={16} />
              <span>
                <strong>拿手机的人</strong>
                {draft.features.includes("composition")
                  ? "按人物位置和大小调整取景。"
                  : "构图自由，对照参考决定画面。"}
              </span>
            </p>
            <p>
              <UserRound size={16} />
              <span>
                <strong>镜头前的人</strong>
                {draft.groups.length
                  ? "需要时参考选中的动作，其余自然发挥。"
                  : "动作自由，先舒服地站好。"}
              </span>
            </p>
            {activeAdjustment && (
              <small data-testid="reference-adjustment">
                {activeAdjustment.note}
              </small>
            )}
          </div>
          <LightPlanner
            choice={lighting}
            enabled={draft.features.includes("light")}
            onChange={(next) => {
              setLighting(next);
              revision.current++;
              request.current?.abort();
              setCloudBusy(false);
            }}
            onEnable={() => {
              const next = {
                ...draft,
                features: draft.features.includes("light")
                  ? draft.features.filter((f) => f !== "light")
                  : [...draft.features, "light" as const],
              };
              setOverride(next);
              setFeatures(next.features);
              setWholeFeatures(next.features);
              revision.current++;
              request.current?.abort();
              setCloudBusy(false);
            }}
          />
          <details
            className="v3-fine-details"
            open={custom}
            onToggle={(e) => setCustom(e.currentTarget.open)}
          >
            <summary>
              精细调整（可选）<span>涂抹动作 · 修改文字 · 更多感觉</span>
            </summary>
            <div className="v2-mode-switch" aria-label="学习模式">
              <button
                aria-pressed={mode === "partial"}
                className={mode === "partial" ? "active" : ""}
                onClick={() => {
                  changed();
                  setMode("partial");
                  setFeatures([]);
                }}
              >
                只学涂抹的部分
              </button>
              <button
                aria-pressed={mode === "whole"}
                className={mode === "whole" ? "active" : ""}
                onClick={() => {
                  changed();
                  setMode("whole");
                  setWholeFeatures(Object.keys(FEATURES) as Feature[]);
                }}
              >
                整张照片复刻
              </button>
            </div>
            <p className="v2-mode-description">
              {mode === "partial"
                ? "只跟随选中的相对动作，默认不限制站位和远近。"
                : "纳入可识别的动作与画面要素；你可以逐项取消。"}
            </p>
            <div className="v2-target-intro">
              <span className="eyebrow">YOUR SHOOTING BRIEF</span>
              <h2>
                {draft.groups.length
                  ? "这一点，我们一起拍出来。"
                  : "先选一个，你喜欢的细节。"}
              </h2>
              <div className="v2-group-chips" data-testid="selected-groups">
                {draft.groups.length ? (
                  draft.groups.map((g) => (
                    <span key={g}>
                      <Check size={13} />
                      {GROUPS[g].label}
                      <small>{GROUPS[g].live ? "实时" : "参考"}</small>
                    </span>
                  ))
                ) : (
                  <p>在照片的人物身上轻涂一下。涂到背景不会创建动作。</p>
                )}
              </div>
            </div>
            <div className="v2-interpretation">
              <div className="v2-inline-heading">
                <label htmlFor="interpretation">我理解你想拍的是</label>
                <span>{cloudInsights ? "深度解读" : "本地解读"}</span>
              </div>
              <textarea
                id="interpretation"
                value={text}
                rows={4}
                onChange={(e) => {
                  request.current?.abort();
                  setEdited(e.target.value);
                  setEditError("");
                  revision.current++;
                }}
              />
              <div className="v2-edit-actions">
                <button
                  onClick={() => {
                    setEdited(
                      "只学抬手，不要手贴脸；保留参考的暖色，背景自由。",
                    );
                    setEditError("");
                  }}
                >
                  试试：只学抬手，不要手贴脸
                </button>
                {dirty && (
                  <button className="v2-apply" onClick={applyEdit}>
                    应用修改 <Check size={14} />
                  </button>
                )}
              </div>
              {dirty && (
                <p className="v2-small">
                  修改后先点“应用修改”。较复杂的要求可用深度解读。
                </p>
              )}
              {editError && (
                <p className="v2-error" role="alert">
                  {editError}
                </p>
              )}
              {(dirty || override) && (
                <button
                  className="v2-text-link"
                  onClick={() => {
                    changed(true);
                  }}
                >
                  恢复自动解读
                </button>
              )}
            </div>
            <div className="v2-inline-heading">
              <h3>还想保留哪些感觉？</h3>
              <button onClick={() => void openCloud()}>
                <Sparkles size={14} /> 深度解读
              </button>
            </div>
            <div className="v2-feature-list">
              {insights.map((insight) => (
                <details
                  key={insight.id}
                  className={
                    draft.features.includes(insight.id) ? "selected" : ""
                  }
                >
                  <summary>
                    <label onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={draft.features.includes(insight.id)}
                        onChange={() => {
                          if (override) {
                            const next = {
                              ...override,
                              features: override.features.includes(insight.id)
                                ? override.features.filter(
                                    (f) => f !== insight.id,
                                  )
                                : [...override.features, insight.id],
                            };
                            setOverride(next);
                            request.current?.abort();
                            setCloudBusy(false);
                            revision.current++;
                          } else feature(insight.id);
                        }}
                      />
                      <span>{insight.title}</span>
                    </label>
                    <small>{SUPPORT[insight.support]}</small>
                  </summary>
                  <p>{insight.summary}</p>
                  <span className="v2-evidence">
                    {CONFIDENCE[insight.confidence]} · {insight.evidence}
                  </span>
                </details>
              ))}
            </div>
            <div className="v2-extra-options">
              <label>
                <input
                  type="checkbox"
                  checked={draft.ignoreContact}
                  onChange={(e) => setOption("ignoreContact", e.target.checked)}
                />{" "}
                只学手臂高度，不要求手贴脸
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={draft.mirror}
                  onChange={(e) => setOption("mirror", e.target.checked)}
                />
                <FlipHorizontal2 size={14} /> 镜像学习（左右动作互换）
              </label>
            </div>
          </details>
          <div className="v2-confirm-card">
            <span className="eyebrow">交给同伴的拍摄目标</span>
            <p data-testid="target-summary">{describeTarget(draft)}</p>
            {cloudNote && <small role="status">{cloudNote}</small>}
            <button
              className="button primary full"
              onClick={confirm}
              disabled={dirty || detecting || !readyToConfirm}
            >
              确认目标，交给拍摄者 <ArrowRight size={17} />
            </button>
            {dirty ? (
              <small>文字还没有应用，先确认修改。</small>
            ) : !readyToConfirm ? (
              <small>
                {draft.features.includes("light") && !lighting.setup
                  ? "先在用光方案里选择现场光线。"
                  : "先选一个目标；构图需要确认人物范围，动作需要识别可用部位。"}
              </small>
            ) : (
              <small>下一步是两个人的目标卡，确认后才打开相机。</small>
            )}
          </div>
        </section>
      </div>
      {geometryChange && (
        <Modal title="重新调整参考画面" onClose={() => setGeometryChange(null)}>
          <div className="v2-modal-copy">
            <p>
              调整画幅或方向会清空当前涂抹和解读，需要重新确认拍摄目标。原来的参考图片会保留。
            </p>
            <button
              className="button primary full"
              onClick={() => {
                const action = geometryChange;
                setGeometryChange(null);
                if (action === "crop") setCrop(true);
                else void rotate();
              }}
            >
              继续调整
            </button>
            <button
              className="v2-text-link"
              onClick={() => setGeometryChange(null)}
            >
              保留当前选区
            </button>
          </div>
        </Modal>
      )}
      {crop && (
        <PhotoEditor
          photo={photo}
          reference
          initialTab="crop"
          onClose={() => setCrop(false)}
          onSave={(p) => {
            changed();
            setStrokes([]);
            setFuture([]);
            onPhoto({ ...p, id: crypto.randomUUID() });
            setCrop(false);
          }}
        />
      )}
      {cloud && (
        <Modal
          title="多读懂一点这张参考"
          onClose={() => {
            request.current?.abort();
            setCloudBusy(false);
            setCloud(false);
          }}
        >
          <div className="v2-modal-copy">
            <Sparkles size={26} />
            <p>
              深度解读会把当前裁切后的参考缩略图、涂抹选区和这段文字发送给配置的模型服务。不会发送相机视频。
            </p>
            <p>
              服务端不保存图片。模型服务商的数据处理方式以其政策为准；请只发送你愿意分享的参考。
            </p>
            {configured === null ? (
              <p>正在检查解读服务…</p>
            ) : !configured ? (
              <p className="v2-callout">
                深度解读还未配置。涂抹识别、目标开关和本地相机仍可使用。
              </p>
            ) : null}
            {cloudError && (
              <p role="alert" className="v2-error">
                {cloudError}
              </p>
            )}
            <button
              className="button primary full"
              disabled={!configured || cloudBusy}
              onClick={() => void analyze()}
            >
              {cloudBusy ? (
                <>
                  <LoaderCircle size={17} className="spin" /> 正在解读…
                </>
              ) : (
                <>
                  同意发送，开始解读 <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </Modal>
      )}
    </main>
  );
}
