"use client";

export default function GlobalError({ reset }: { reset: () => void }): React.JSX.Element {
  return (
    <html lang="zh-CN">
      <body>
        <main className="message-page">
          <p>游戏页面暂时无法显示</p>
          <h1 lang="en">The game preview could not load</h1>
          <button type="button" onClick={reset}>
            重试 / Try again
          </button>
        </main>
      </body>
    </html>
  );
}
