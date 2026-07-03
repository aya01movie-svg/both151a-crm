import { Star } from "lucide-react";

/** お気に入り（第25章）。ON/OFFのみで、ONのときだけ★を表示する（読み取り専用の表示箇所で使用）。 */
export function FavoriteStars({ favorite, size = 14 }: { favorite: boolean; size?: number }) {
  if (!favorite) return null;
  return (
    <span className="inline-flex text-gold" aria-label="お気に入り">
      <Star size={size} fill="currentColor" strokeWidth={0} />
    </span>
  );
}
