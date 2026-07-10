import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * manifest.webmanifest と sw.js は「今すぐ最新を見てほしい」ファイルのため、
   * ブラウザやCDNにキャッシュされて更新が反映されないことを防ぐ。
   * （Androidの画面向き固定が manifest.webmanifest 更新後も直らなかった原因の一つ。
   * 　なお、既にインストール済みのPWA（WebAPK）自体は端末側で一度生成されると
   * 　このヘッダーだけでは即時更新されないため、アンインストール→再インストールが必要）
   */
  async headers() {
    return [
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
      {
        source: "/sw.js",
        headers: [{ key: "Cache-Control", value: "no-cache, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;
