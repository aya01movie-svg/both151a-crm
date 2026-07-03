"use client";

import { useActionState, useEffect, useState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";

const initialState: LoginState = { error: null };
const EMAIL_STORAGE_KEY = "both151a:remembered-email";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState);

  // RC2修正: メールアドレスのみ端末に記憶し、パスワードは毎回入力させる。
  // ハイドレーションずれを避けるため、初期値は空のまま描画し、マウント後に復元する。
  const [email, setEmail] = useState("");
  const [rememberEmail, setRememberEmail] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(EMAIL_STORAGE_KEY);
      if (saved) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント後の外部ストレージ復元のため意図的
        setEmail(saved);
        setRememberEmail(true);
      }
    } catch {
      // 保存領域が使えない場合は無視する
    }
  }, []);

  function handleSubmit() {
    try {
      if (rememberEmail && email.trim()) {
        localStorage.setItem(EMAIL_STORAGE_KEY, email.trim());
      } else {
        localStorage.removeItem(EMAIL_STORAGE_KEY);
      }
    } catch {
      // 保存領域が使えない場合は無視する（ログイン自体は通常通り行う）
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-beige">
      <header className="bg-navy text-white h-16 flex items-center px-4 md:px-6">
        <span className="font-black text-lg tracking-tight">
          both151&apos;A CRM
        </span>
        <span className="text-white/70 text-sm ml-3 hidden sm:inline">
          ログイン画面
        </span>
      </header>

      <div className="flex-1 flex flex-col items-center px-4 pt-6 md:pt-10">
        <p className="text-navy/60 text-sm mb-6 self-start md:self-center">
          スタッフごとにメール・パスワードでログイン
        </p>

        <div className="card-base w-full max-w-md p-8">
          <h1 className="text-2xl font-black text-center text-navy">
            ログイン
          </h1>
          <p className="text-center text-navy/50 text-sm mt-1 mb-6">
            スタッフアカウントで情報共有
          </p>

          <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
            <TextField
              label="メールアドレス"
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="パスワード"
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />

            <label className="flex items-center gap-2 min-h-8">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="w-5 h-5 accent-gold"
              />
              <span className="text-sm font-bold text-navy/60">
                メールアドレスを保存する（パスワードは保存されません）
              </span>
            </label>

            {state.error && (
              <p role="alert" className="text-danger text-sm font-bold">
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              variant="gold"
              fullWidth
              disabled={pending}
              className="mt-2"
            >
              {pending ? "ログイン中…" : "ログイン"}
            </Button>
          </form>

          <p className="text-center text-danger text-xs font-bold mt-5">
            未ログインでは顧客情報を表示しない
          </p>
        </div>
      </div>
    </div>
  );
}
