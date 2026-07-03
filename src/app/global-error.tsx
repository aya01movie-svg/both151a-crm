"use client";

import { useEffect } from "react";

/** RC2追加: ルートレイアウト自体で例外が起きた場合の最終防波堤。 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="ja">
      <body>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f6f1e7",
            fontFamily: "system-ui, sans-serif",
            padding: 24,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              padding: 32,
              maxWidth: 360,
              textAlign: "center",
            }}
          >
            <h1 style={{ fontSize: 18, fontWeight: 900, color: "#16213e", marginBottom: 8 }}>
              エラーが発生しました
            </h1>
            <p style={{ fontSize: 14, color: "rgba(22,33,62,0.6)", marginBottom: 24 }}>
              アプリの読み込み中に問題が発生しました。再読み込みしてください。
            </p>
            <button
              onClick={reset}
              style={{
                minHeight: 48,
                padding: "0 24px",
                background: "#16213e",
                color: "#fff",
                borderRadius: 12,
                border: "none",
                fontWeight: 700,
              }}
            >
              再試行
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
