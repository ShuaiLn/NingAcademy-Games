import { GameCanvas } from "@/components/game-canvas";
import { MultiplayerLobby } from "@/components/multiplayer-lobby";

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
          <span>WEBRTC HOST-P2P</span>
          <span lang="en">Release · {releaseChannel}</span>
        </div>
      </header>

      <MultiplayerLobby />

      <div className="section-divider">
        <span>或</span>
        <strong>完全本地单人练习</strong>
      </div>
      <GameCanvas />

      <section className="principles" aria-label="核心设计原则 / Core design principles">
        <article>
          <span>01</span>
          <h2>浏览器原生</h2>
          <p lang="en">Browser-native WebGL2</p>
        </article>
        <article>
          <span>02</span>
          <h2>Host 权威模拟</h2>
          <p lang="en">Host-authoritative star topology</p>
        </article>
        <article>
          <span>03</span>
          <h2>个人段位</h2>
          <p lang="en">Personal rank only</p>
        </article>
      </section>

      <p className="notice">
        多人身份只来自主站一次性票据与 HttpOnly Games session；Supabase 仅保存信令，游戏流量由浏览器之间的 RTCDataChannel 承担。
        <span lang="en">Host cheating is accepted; database membership and identity checks remain enforced.</span>
      </p>
    </main>
  );
}
