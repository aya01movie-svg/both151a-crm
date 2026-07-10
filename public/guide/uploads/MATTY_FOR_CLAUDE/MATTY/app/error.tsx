"use client";

import { useEffect } from "react";

/**
 * RC2追加: 想定外のエラーが発生した場合でも「真っ白画面」にならないよう、
 * アプリ全体の共通エラーバウンダリを追加する。
 * これはあくまで保険であり、根本原因（Hydration Error等）は個別に修正済み。
 */
export default function Error({
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
    <div className="min-h-screen flex items-center justify-center bg-beige px-4">
      <div className="card-base p-8 max-w-md text-center">
        <h1 className="text-lg font-black text-navy mb-2">
          エラーが発生しました
        </h1>
        <p className="text-navy/60 text-sm mb-6">
          画面の表示中に問題が発生しました。入力中のデータは自動保存されている場合があります。もう一度お試しください。
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="btn-base px-6 bg-navy text-white"
          >
            再試行
          </button>
          <a href="/dashboard" className="btn-base px-6 bg-white text-navy border-2 border-navy/10">
            ホームへ戻る
          </a>
        </div>
      </div>
    </div>
  );
}
