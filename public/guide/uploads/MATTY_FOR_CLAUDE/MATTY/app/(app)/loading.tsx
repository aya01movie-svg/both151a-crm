// v1.2パフォーマンス改善:
// 旧 src/app/loading.tsx は画面全体を覆う不透明なオーバーレイだったため、
// 遷移するたびにヘッダー・ナビゲーションごと一瞬消えて視覚的に重く感じられていた。
// (app) レイアウト配下では AppShell（ヘッダー・ナビ）がページ間で維持されたまま
// コンテンツ領域だけがこの軽量スケルトンに差し替わるため、体感速度が改善する。
export default function AppLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <div className="animate-spin text-4xl select-none">🍞</div>
      <p className="text-navy/40 font-bold text-sm">読み込み中…</p>
    </div>
  );
}
