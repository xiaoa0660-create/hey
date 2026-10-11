import { Check, Sun, Camera, UserRound } from "lucide-react";
import { LIGHT_RECIPES, lightingAdapted } from "../domain/lighting";
import type { LightChoice, LightRecipe, LightStyle } from "../domain/lighting";

export function LightDiagram({ recipe }: { recipe: LightRecipe }) {
  const [x, y] = recipe.position;
  return (
    <svg
      className="v4-light-diagram"
      viewBox="0 0 300 210"
      role="img"
      aria-label={`${recipe.source}、被拍者和手机的位置示意；俯视图，不代表测量位置`}
    >
      <rect x="1" y="1" width="298" height="208" rx="12" fill="#ecebe0" />
      <path d={`M${x},${y} L132,96 L166,110 Z`} fill="#ddbb6480" />
      <path d={`M${x},${y} L150,105`} stroke="#b69445" strokeDasharray="4 4" />
      <circle cx={x} cy={y} r="13" fill="#d8b56c" />
      <text x={x} y={y - 21} textAnchor="middle">
        {recipe.source}
      </text>
      <circle cx="150" cy="105" r="17" fill="#697c62" />
      <path d="M141 116 L150 125 L159 116" fill="#d7eb9a" />
      <text x="184" y="109">
        被拍者
      </text>
      <path d="M150 148 L150 131" stroke="#697c62" strokeDasharray="3 3" />
      <rect x="140" y="154" width="20" height="28" rx="4" fill="#273f35" />
      <circle cx="146" cy="161" r="2" fill="#d7eb9a" />
      <text x="176" y="172">
        手机
      </text>
      <text x="15" y="195" className="v4-diagram-label">
        俯视示意 · 按现场调整
      </text>
    </svg>
  );
}

export function LightInstructions({
  choice,
  compact = false,
}: {
  choice: LightChoice;
  compact?: boolean;
}) {
  if (!choice.setup) return null;
  const recipe = LIGHT_RECIPES[choice.setup];
  return (
    <div className="v4-light-instructions" data-testid="light-instructions">
      <div className="v4-light-title">
        <Sun size={17} />
        <strong>{recipe.title}</strong>
        <span>现场用光建议</span>
      </div>
      {lightingAdapted(choice) && (
        <p className="v4-adaptation">
          现场改用{recipe.title}
          ，保留原来的构图与动作选择；光影效果会与参考不同。
        </p>
      )}
      {!compact && <LightDiagram recipe={recipe} />}
      <ol className="v4-light-steps">
        <li>
          <Sun size={16} />
          <div>
            <strong>先找到光</strong>
            <p>{recipe.find}</p>
          </div>
        </li>
        <li>
          <UserRound size={16} />
          <div>
            <strong>被拍者站这里</strong>
            <p>{recipe.subject}</p>
          </div>
        </li>
        <li>
          <Camera size={16} />
          <div>
            <strong>拍摄者这样取景</strong>
            <p>{recipe.camera}</p>
          </div>
        </li>
      </ol>
      <details className="v4-technique">
        <summary>再看明暗、背景和拍摄时机</summary>
        <p>
          <b>明暗</b>
          {recipe.exposure}
        </p>
        <p>
          <b>背景与景深</b>
          {recipe.background}
        </p>
        <p>
          <b>动作瞬间</b>
          {recipe.moment}
        </p>
        <p className="v4-light-limit">{recipe.limitation}</p>
      </details>
    </div>
  );
}

export default function LightPlanner({
  choice,
  enabled,
  onChange,
  onEnable,
}: {
  choice: LightChoice;
  enabled: boolean;
  onChange: (choice: LightChoice) => void;
  onEnable: () => void;
}) {
  const recipe = choice.setup ? LIGHT_RECIPES[choice.setup] : null;
  return (
    <section className="v4-light-planner" aria-label="现场用光方案">
      <span className="eyebrow">02 / FIND YOUR LIGHT</span>
      <h2>这束光，现场怎么找？</h2>
      <p className="v4-light-intro">
        {choice.reference
          ? `这张参考的编辑拍法：${LIGHT_RECIPES[choice.reference].title}。先看现场有没有相近的光。`
          : "选择你现场能找到的光，我们把两个人的站位讲清楚。个人照片的光向不会被自动猜定。"}
      </p>
      <button
        className={`v4-enable-light ${enabled ? "selected" : ""}`}
        aria-pressed={enabled}
        onClick={onEnable}
      >
        <span className="v3-priority-check">
          {enabled && <Check size={14} />}
        </span>
        {enabled ? "已加入这次拍摄目标" : "把光影加入这次拍摄"}
      </button>
      {enabled ? (
        <>
          <div className="v4-scene-label">
            现场有什么光？<small>条件不同，也可以换一种拍法</small>
          </div>
          <div className="v4-scene-options" aria-label="选择现场光线">
            {(Object.entries(LIGHT_RECIPES) as [LightStyle, LightRecipe][]).map(
              ([id, item]) => (
                <button
                  key={id}
                  aria-pressed={choice.setup === id}
                  onClick={() => onChange({ ...choice, setup: id })}
                >
                  <span style={{ background: item.palette[0] }} />
                  {item.title}
                </button>
              ),
            )}
          </div>
          {recipe ? (
            <LightInstructions choice={choice} />
          ) : (
            <p className="v4-light-intro" role="status">
              先选一种现场光线，再确认拍摄目标。
            </p>
          )}
        </>
      ) : (
        <p className="v4-light-intro">
          {recipe?.effect ?? "窗边、阴天、日落或夜景，都有各自的拍法。"}
          。启用后，拍摄时也能随时查看站位。
        </p>
      )}
    </section>
  );
}
