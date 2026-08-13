import { GameCanvas } from "@/components/game-canvas";

const releaseChannel = process.env.NEXT_PUBLIC_RELEASE_CHANNEL ?? "development";

export default function HomePage(): React.JSX.Element {
  return (
    <main className="landing">
      <header className="hero">
        <div>
          <p className="brand">NINGACADEMY // GAME LAB</p>
          <h1>
            学习，生存，突破
            <span lang="en">Learn. Survive. Advance.</span>
          </h1>
        </div>
        <div className="release-badge">
          <span>UNVERIFIED 本地练习</span>
          <span lang="en">Local practice · {releaseChannel}</span>
        </div>
      </header>

      <GameCanvas />

      <section className="principles" aria-label="核心设计原则 / Core design principles">
        <article>
          <span>01</span>
          <h2>浏览器原生</h2>
          <p lang="en">Browser-native WebGL2</p>
        </article>
        <article>
          <span>02</span>
          <h2>本地权威模拟</h2>
          <p lang="en">LocalAuthority practice slice</p>
        </article>
        <article>
          <span>03</span>
          <h2>个人段位</h2>
          <p lang="en">Personal rank only</p>
        </article>
      </section>

      <p className="notice">
        当前页面不连接 NingAcademy 主站、Supabase 或生产游戏服务器；所有成绩仅存在于当前页面内存。
        <span lang="en">No main-site, Supabase, or production connection; results remain local and unverified.</span>
      </p>
    </main>
  );
}
