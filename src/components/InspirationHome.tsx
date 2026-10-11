import { useState } from "react";
import { ArrowRight, ImagePlus, MoveUpRight, ScanLine } from "lucide-react";
import { TEMPLATES } from "../lib/catalog";
import type { Template } from "../lib/catalog";
export default function InspirationHome({
  onChoose,
  onUpload,
}: {
  onChoose: (t: Template) => void;
  onUpload: () => void;
}) {
  const [category, setCategory] = useState("all");
  return (
    <main className="v2-home page-enter">
      <section className="v2-hero">
        <div className="v2-hero-copy">
          <span className="eyebrow">A LITTLE GUIDANCE. A PHOTO YOU LOVE.</span>
          <h1>
            把你想拍的，
            <br />
            <span>讲清楚。</span>
          </h1>
          <p>
            看到喜欢的照片，不必再说“就这个感觉”。
            <br />
            涂出想学的动作，我们陪你一步一步拍。
          </p>
          <button className="button primary" onClick={onUpload}>
            <ImagePlus size={18} /> 从一张参考开始 <ArrowRight size={18} />
          </button>
          <button
            className="v2-text-link"
            onClick={() => onChoose(TEMPLATES[1])}
          >
            先用一张示例试试 <MoveUpRight size={15} />
          </button>
          <div className="v2-hero-foot">
            <span>01 选一张</span>
            <i />
            <span>02 涂一下</span>
            <i />
            <span>03 照着拍</span>
          </div>
        </div>
        <button
          className="v2-hero-photo"
          onClick={() => onChoose(TEMPLATES[0])}
          aria-label="体验窗边坐姿参考"
        >
          <img
            src={`${import.meta.env.BASE_URL}images/cafe-editorial.png`}
            alt="窗边自然光下的咖啡馆人像"
          />
          <span className="v2-photo-kicker">THE AFTERNOON SERIES / 01</span>
          <div className="v2-hero-bracket" />
          <span className="v2-note">
            <ScanLine size={19} /> 这一点留白，刚刚好。
          </span>
          <span className="v2-photo-caption">
            有参考，也有自己的样子。
            <ArrowRight size={22} />
          </span>
        </button>
      </section>
      <section className="v2-gallery" id="inspiration">
        <div className="v2-section-heading">
          <div>
            <span className="eyebrow">A PLACE TO START</span>
            <h2>今天，想拍什么感觉？</h2>
          </div>
          <p>从一个动作开始，也可以从一整张照片开始。</p>
        </div>
        <div className="v2-tabs" aria-label="参考分类">
          {[
            ["all", "全部灵感"],
            ["daily", "日常人像"],
            ["idol", "Idol 灵感"],
            ["painting", "画作姿态"],
          ].map(([id, name]) => (
            <button
              key={id}
              aria-pressed={category === id}
              className={category === id ? "active" : ""}
              onClick={() => setCategory(id)}
            >
              {name}
            </button>
          ))}
          <span>4 张原创示例 · 12 个练习入口</span>
        </div>
        {category === "idol" ? (
          <div className="v2-idol">
            <span className="eyebrow">YOUR INSPIRATION, YOUR WAY</span>
            <h2>
              喜欢的那一帧，
              <br />
              可以是你的拍摄起点。
            </h2>
            <p>
              导入你自己的舞台截图或收藏照片。先选清楚一个人，再涂出想学的动作。
            </p>
            <button className="button primary" onClick={onUpload}>
              <ImagePlus size={17} /> 导入我的参考
            </button>
            <small>仅用于个人参考 · 不提供明星身份识别或换脸</small>
          </div>
        ) : (
          <div className="v2-card-grid">
            {TEMPLATES.filter(
              (t) => category === "all" || t.category === category,
            ).map((t, index) => (
              <button
                className="v2-template"
                key={t.id}
                onClick={() => onChoose(t)}
              >
                <div className="v2-template-image">
                  <img
                    loading="lazy"
                    src={`${import.meta.env.BASE_URL}images/${t.image}`}
                    alt={t.title}
                  />
                  <span>{t.tag}</span>
                  <b>
                    <ArrowRight size={20} />
                  </b>
                </div>
                <div className="v2-template-meta">
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{t.title}</h3>
                    <p>{t.subtitle}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        <p className="v2-small gallery-note">
          示例照片与油画为原创生成素材；“同图练习”复用同一张图。每次打开都会实际检测可用动作。
        </p>
      </section>
      <section className="v2-promise">
        <span className="eyebrow">MADE FOR YOUR MOMENTS</span>
        <h2>
          参考给方向，
          <br />
          照片留给你。
        </h2>
        <p>
          不用成为摄影师，也不用摆出一模一样的自己。
          <br />
          只把最喜欢的那一点，带进你的照片里。
        </p>
      </section>
    </main>
  );
}
