export default function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gold/50 z-50">
      <div className="flex flex-col items-center gap-3">
        <div className="animate-spin text-5xl select-none">🍞</div>
        <p className="text-navy font-black text-sm">読み込み中…</p>
      </div>
    </div>
  );
}
