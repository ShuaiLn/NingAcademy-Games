import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "NingAcademy 游戏 | Learning FPS",
  description: "NingAcademy 浏览器 3D FPS 学习游戏开发预览。",
  robots: {
    follow: false,
    index: false,
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#071021",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>): React.JSX.Element {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
