import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/layout/ServiceWorkerRegister";

export const metadata: Metadata = {
  title: "きゃってぃー",
  description: "きゃってぃー",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icons/cat-icon-96.png", sizes: "96x96", type: "image/png" },
      { url: "/icons/cat-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/cat-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/cat-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
  robots: {
    // 検索エンジンに登録されないようにする
    index: false,
    follow: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#16213e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
