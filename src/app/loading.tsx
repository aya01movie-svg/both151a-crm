export default function Loading() {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gold/60 z-50">
      <div className="flex flex-col items-center gap-3">
        {/* MATTYクルクル演出 */}
        <div className="animate-spin text-5xl">🍞</div>
        <p className="text-navy font-black text-sm">よみこみ中…</p>
      </div>
    </div>
  );
}
