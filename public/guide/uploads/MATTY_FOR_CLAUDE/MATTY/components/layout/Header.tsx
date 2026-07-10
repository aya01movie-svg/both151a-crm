import Image from "next/image";
import { logout } from "@/lib/auth/actions";
import { toJstDateString } from "@/lib/date";
import { PageTitle } from "./PageTitle";

type HeaderProps = {
  staffName: string;
};

/** 令和年変換（西暦→令和） */
function toReiwa(year: number): string {
  const reiwa = year - 2018;
  if (reiwa <= 0) return `${year}`;
  return `令和${reiwa}年`;
}

/** 日付バー用: 「2026年(令和8年)7月6日(月)」形式 */
function formatDateBar(isoDateStr: string): string {
  const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
  const [y, m, d] = isoDateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const dow = WEEKDAY_JA[date.getDay()];
  return `${y}年(${toReiwa(y)})${m}月${d}日(${dow})`;
}

/**
 * 画面上部の共通ヘッダー。
 * 背景透過版MATTYアイコン + ヘッダー下に本日の日付バーを表示。
 */
export function Header({ staffName }: HeaderProps) {
  const todayStr = toJstDateString(new Date().toISOString());
  const dateLabel = formatDateBar(todayStr);

  return (
    <div className="shrink-0">
      {/* メインヘッダー */}
      <header className="bg-gold text-navy-dark min-h-[68px] flex items-center justify-between px-4 md:px-6 border-b border-black/10 py-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* 背景透過アイコン: 黄色背景と馴染む */}
          <Image
            src="/icons/matty-transparent-96.png"
            alt=""
            width={68}
            height={68}
            className="shrink-0"
          />
          <span className="font-black text-xl tracking-tight shrink-0">MATTY</span>
          <PageTitle />
        </div>
        <form action={logout} className="flex items-center gap-3 shrink-0">
          <span className="text-sm text-navy-dark/70 hidden sm:inline">
            {staffName}
          </span>
          <button
            type="submit"
            className="text-sm font-bold text-navy-dark border border-navy-dark/30 rounded-app px-3 py-2 hover:bg-black/5"
          >
            ログアウト
          </button>
        </form>
      </header>

      {/* 日付バー: 背景なし・文字のみ */}
      <div className="py-1 text-center border-b border-black/5">
        <p className="text-navy-dark/80 font-bold text-sm md:text-base tracking-wide">
          {dateLabel}
        </p>
      </div>
    </div>
  );
}