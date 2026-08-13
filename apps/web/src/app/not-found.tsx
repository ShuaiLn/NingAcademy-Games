import Link from "next/link";

export default function NotFound(): React.JSX.Element {
  return (
    <main className="message-page">
      <p>页面不存在</p>
      <h1 lang="en">Page not found</h1>
      <Link href="/">返回游戏入口 / Return home</Link>
    </main>
  );
}
