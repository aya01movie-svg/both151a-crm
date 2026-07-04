import Image from "next/image";
import { logout } from "@/lib/auth/actions";

type HeaderProps = {
  title: string;
  staffName: string;
};

/**
 * 画面上部の共通ヘッダー。
 * 「きゃってぃー」ブランドのアイコン＋アプリ名＋画面名を表示する。
 */
export function Header({ title, staffName }: HeaderProps) {
  return (
    <header className="bg-navy text-white h-16 flex items-center justify-between px-4 md:px-6 shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <Image
          src="/icons/cat-icon-96.png"
          alt=""
          width={32}
          height={32}
          className="rounded-full shrink-0"
        />
        <span className="font-black text-lg tracking-tight shrink-0">きゃってぃー</span>
        <span className="text-white/70 text-sm truncate hidden sm:inline">
          {title}
        </span>
      </div>
      <form action={logout} className="flex items-center gap-3 shrink-0">
        <span className="text-sm text-white/80 hidden sm:inline">
          ログイン中：{staffName}
        </span>
        <button
          type="submit"
          className="text-sm font-bold text-white/90 border border-white/30 rounded-app px-3 py-2 hover:bg-white/10"
        >
          ログアウト
        </button>
      </form>
    </header>
  );
}
