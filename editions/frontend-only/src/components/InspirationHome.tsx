import { useState } from "react";
import {
  ArrowRight,
  Camera,
  ImagePlus,
  MoveUpRight,
  ScanLine,
  UserRound,
} from "lucide-react";
import { TEMPLATES } from "../lib/catalog";
import type { Template } from "../lib/catalog";
import { LIGHT_RECIPES } from "../domain/lighting";
export default function InspirationHome({
  onChoose,
  onUpload,
}: {
  onChoose: (t: Template) => void;
  onUpload: () => void;
}) {
  const [category, setCategory] = useState("all");
  const [light, setLight] = useState("all");
  const filtered = TEMPLATES.filter(
    (t) =>
      (category === "all" || t.category === category) &&
      (light === "all" || t.light === light),
  );
  return (
    <main className="v2-home page-enter">
      <section className="v2-hero">
        <div className="v2-hero-copy">
          <span className="eyebrow">ONE PHOTO. TWO OF YOU.</span>
          <h1>
            你想要的，
            <br />
            <span>一起拍出来。</span>
          </h1>
          <p>
            你选喜欢的画面，同伴照着目标拍。
            <br />
            少一点来回解释，多一张两个人都喜欢的照片。
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
            <span>01 说清想法</span>
            <i />
            <span>02 交给同伴</span>
            <i />
            <span>03 一起调整</span>
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
      <section className="v3-together" aria-label="两个人，分工刚刚好">
        <div>
          <UserRound size={23} strokeWidth={1.5} />
          <span>
            <strong>镜头前的你</strong>
            <p>选想要的感觉，决定哪里满意、哪里还想改。</p>
          </span>
        </div>
        <span className="v3-together-plus">＋</span>
        <div>
          <Camera size={23} strokeWidth={1.5} />
          <span>
            <strong>拿手机的你</strong>
            <p>看清目标和下一步，帮对方把想法拍出来。</p>
          </span>
        </div>
      </section>
      <section className="v2-gallery" id="inspiration">
        <div className="v2-section-heading">
          <div>
            <span className="eyebrow">A PLACE TO START</span>
            <h2>今天，想拍什么感觉？</h2>
          </div>
          <p>喜欢构图、动作还是氛围？只保留你在意的。</p>
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
          <span>8 张独立参考 · 每张都有用光与站位方案</span>
        </div>
        {category !== "idol" && (
          <div className="v4-light-filters" aria-label="按光线找灵感">
            {[
              ["all", "所有光线"],
              ["window", "窗边柔光"],
              ["hard", "日光树影"],
              ["side", "傍晚侧光"],
              ["backlight", "落日逆光"],
              ["overcast", "阴天"],
              ["night", "夜景"],
            ].map(([id, label]) => (
              <button
                key={id}
                aria-pressed={light === id}
                onClick={() => setLight(id)}
              >
                {label}
              </button>
            ))}
          </div>
        )}
        {category === "idol" ? (
          <div className="v2-idol">
            <span className="eyebrow">YOUR INSPIRATION, YOUR WAY</span>
            <h2>
              喜欢的那一帧，
              <br />
              可以是你的拍摄起点。
            </h2>
            <p>
              导入你自己的舞台截图或收藏照片。选好人物和最在意的感觉，再把目标交给同伴。
            </p>
            <button className="button primary" onClick={onUpload}>
              <ImagePlus size={17} /> 导入我的参考
            </button>
            <small>仅用于个人参考 · 不提供明星身份识别或换脸</small>
          </div>
        ) : (
          <div className="v2-card-grid">
            {filtered.map((t, index) => (
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
                    <small className="v4-template-difficulty">
                      {t.difficulty}
                    </small>
                    <span className="v4-palette" aria-label="参考配色">
                      {LIGHT_RECIPES[t.light].palette.map((color) => (
                        <i key={color} style={{ background: color }} />
                      ))}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
        {category !== "idol" && !filtered.length && (
          <div className="v4-gallery-empty">
            <p>这个分类暂时没有相同光线的参考。</p>
            <button onClick={() => setLight("all")}>
              查看这个分类的全部参考 →
            </button>
          </div>
        )}
        <p className="v2-small gallery-note">
          参考为原创 AI
          生成素材，用光方案由编辑整理。导入自己的照片，也可以开始。
        </p>
      </section>
      <section className="v2-promise">
        <span className="eyebrow">MADE FOR YOUR MOMENTS</span>
        <h2>
          一个人的想法，
          <br />
          两个人的默契。
        </h2>
        <p>
          先说清最在意的，再一次调整一点。
          <br />
          喜欢这一张，才是你们共同的标准。
        </p>
      </section>
    </main>
  );
}
