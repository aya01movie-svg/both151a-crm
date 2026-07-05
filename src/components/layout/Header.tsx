import Image from "next/image";
import { logout } from "@/lib/auth/actions";

type HeaderProps = {
  title: string;
  staffName: string;
};

/**
 * 画面上部の共通ヘッダー。
 * MATTYブランドのアイコン＋アプリ名＋画面名を表示する。
 * 背景色はブランドカラー（--color-brand・globals.css）を使用しており、
 * アイコンのデザインが変わった場合はそちらの1箇所を変更すれば追従する。
 */
export function Header({ title, staffName }: HeaderProps) {
  return (
    <header className="bg-gold text-navy-dark h-16 flex items-center justify-between px-4 md:px-6 shrink-0 border-b border-black/10">
      <div className="flex items-center gap-3 min-w-0">
        <Image
          src="/icons/matty-icon-96.png"
          alt=""
          width={36}
          height={36}
          className="rounded-full shrink-0"
        />
        <span className="font-black text-lg tracking-tight shrink-0">MATTY</span>
        <span className="text-navy-dark/70 text-sm truncate hidden sm:inline">
          {title}
        </span>
      </div>
      <form action={logout} className="flex items-center gap-3 shrink-0">
        <span className="text-sm text-navy-dark/80 hidden sm:inline">
          ログイン中：{staffName}
        </span>
        <button
          type="submit"
          className="text-sm font-bold text-navy-dark border border-navy-dark/30 rounded-app px-3 py-2 hover:bg-black/5"
        >
          ログアウト
        </button>
      </form>
    </header>
  );
}
