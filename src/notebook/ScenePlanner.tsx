import { useState } from "react";
import { MapPin, Sun, ArrowRight } from "lucide-react";
import { LIGHT_RECIPES } from "../domain/lighting";
import type { LightStyle } from "../domain/lighting";
import { sceneAdvice } from "./experience";
import type { Scene } from "./experience";

export default function ScenePlanner({
  reference,
  initial,
  onApply,
}: {
  reference: LightStyle | null;
  initial?: Scene;
  onApply: (scene: Scene) => void;
}) {
  const [scene, setScene] = useState<Scene>(
    initial ?? {
      light: reference ?? "overcast",
      background: "clean",
      space: "open",
      approach: "here",
    },
  );
  const advice = sceneAdvice(scene, reference);
  return (
    <div className="nb-scene">
      <p className="nb-muted">
        看一眼周围，选出实际条件。下面的建议来自你选择的条件，不会自动判断现场照片。
      </p>
      <label className="nb-field">
        <span>
          <Sun size={16} /> 现在能找到什么光？
        </span>
        <select
          aria-label="现场光线"
          value={scene.light}
          onChange={(e) =>
            setScene({ ...scene, light: e.target.value as LightStyle })
          }
        >
          {Object.entries(LIGHT_RECIPES).map(([id, recipe]) => (
            <option key={id} value={id}>
              {recipe.title}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>背景</legend>
        <div className="nb-segments">
          {(
            [
              ["clean", "比较干净"],
              ["busy", "有路人或杂物"],
            ] as const
          ).map(([id, name]) => (
            <button
              key={id}
              aria-pressed={scene.background === id}
              onClick={() => setScene({ ...scene, background: id })}
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>活动空间</legend>
        <div className="nb-segments">
          {(
            [
              ["open", "可以走动"],
              ["tight", "只能原地拍"],
            ] as const
          ).map(([id, name]) => (
            <button
              key={id}
              aria-pressed={scene.space === id}
              onClick={() => setScene({ ...scene, space: id })}
            >
              {name}
            </button>
          ))}
        </div>
      </fieldset>
      {reference && reference !== scene.light && (
        <div className="nb-segments nb-approach" aria-label="现场取舍">
          <button
            aria-pressed={scene.approach === "here"}
            onClick={() => setScene({ ...scene, approach: "here" })}
          >
            就地拍<small>用眼前的条件</small>
          </button>
          <button
            aria-pressed={scene.approach === "closer"}
            onClick={() => setScene({ ...scene, approach: "closer" })}
          >
            更接近参考<small>愿意换位置或等光</small>
          </button>
        </div>
      )}
      <div className="nb-scene-recommendation" role="status">
        <span>
          <MapPin size={15} /> 现场方案
        </span>
        <h3>{advice.title}</h3>
        <p>{LIGHT_RECIPES[advice.setup].find}</p>
        <p>
          <b>被拍的人</b> · {advice.subject}
        </p>
        <p>
          <b>拿手机的人</b> · {advice.camera}
        </p>
        <small>{advice.tradeoff}</small>
      </div>
      <button className="button primary full" onClick={() => onApply(scene)}>
        用这个方案 <ArrowRight size={16} />
      </button>
    </div>
  );
}
