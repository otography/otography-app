import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree, Zen_Kaku_Gothic_New } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";

// 見出し(英語): "Music is passed on" などの大見出し用
const headingEn = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-heading-en",
  display: "swap",
});
// 本文(英語): ナビ・ボタン・本文コピー用
const bodyEn = Figtree({
  subsets: ["latin"],
  weight: "variable",
  variable: "--font-body-en",
  display: "swap",
});
// 日本語(見出し・本文・ラベル共通): 混植時のフォールバック先
const jp = Zen_Kaku_Gothic_New({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-jp",
  display: "swap",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: "otooto",
  description: "Music is passed on in words.",
};

// iOS 26 Safari の Liquid Glass ツールバーにコンテンツを透過させるため cover が必須
export const viewport: Viewport = {
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body
        className={`${headingEn.variable} ${bodyEn.variable} ${jp.variable} ${geistMono.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
