"use client";

import { useActionState } from "react";
import { createCustomerAction, type CreateCustomerState } from "@/lib/actions/customers";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { useState } from "react";

const initialState: CreateCustomerState = { error: null };

export function NewCustomerForm() {
  const [state, formAction, pending] = useActionState(
    createCustomerAction,
    initialState
  );

  // 誕生日: 月/日のみ（西暦は聞かない）
  const [birthdayMonth, setBirthdayMonth] = useState("");
  const [birthdayDay, setBirthdayDay] = useState("");
  // 内部保存形式: 2000-MM-DD（西暦は2000固定）
  const birthdayValue = birthdayMonth && birthdayDay
    ? `2000-${birthdayMonth}-${birthdayDay}`
    : "";

  return (
    <Card className="max-w-2xl">
      <CardTitle>新規顧客登録</CardTitle>
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="birthday" value={birthdayValue} />

        {/* 登録名（必須） */}
        <TextField
          label="登録名（必須）"
          name="display_name"
          required
          autoFocus
          placeholder="ニックネーム・本名・会社名など"
        />

        {/* ふりがな */}
        <TextField
          label="ふりがな（検索に使います）"
          name="kana"
          placeholder="例：やまだ"
        />

        {/* 本名 ※検索対象になります */}
        <TextField
          label="本名（任意・検索対象になります）"
          name="real_name"
          placeholder="例：山田太郎"
        />

        {/* 誕生日（月/日のみ） */}
        <div>
          <span className="block text-sm font-bold text-navy/70 mb-1.5">誕生日（任意）</span>
          <div className="flex items-center gap-2">
            <select
              value={birthdayMonth}
              onChange={(e) => setBirthdayMonth(e.target.value)}
              className="min-h-12 rounded-app border-2 border-navy/10 bg-white px-3 text-base text-navy focus:outline-none focus:border-gold"
            >
              <option value="">月を選択</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={String(m).padStart(2, "0")}>{m}月</option>
              ))}
            </select>
            <select
              value={birthdayDay}
              onChange={(e) => setBirthdayDay(e.target.value)}
              className="min-h-12 rounded-app border-2 border-navy/10 bg-white px-3 text-base text-navy focus:outline-none focus:border-gold"
            >
              <option value="">日を選択</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d).padStart(2, "0")}>{d}日</option>
              ))}
            </select>
            {birthdayMonth && birthdayDay && (
              <button
                type="button"
                onClick={() => { setBirthdayMonth(""); setBirthdayDay(""); }}
                className="text-xs text-navy/30 underline"
              >
                クリア
              </button>
            )}
          </div>
        </div>

        {/* 別名 ※検索対象になります */}
        <div>
          <TextField
            label="別名・呼び名（任意・検索対象になります）"
            name="aliases"
            placeholder="例：社長、田中さん　複数ある場合は読点で区切る"
          />
          <p className="text-xs text-navy/40 mt-1">
            別名でも検索でヒットするようになります。「社長」「田中さん」など呼び方が複数あるときに便利です。
          </p>
        </div>

        {/* メモ */}
        <label className="block">
          <span className="block text-sm font-bold text-navy/70 mb-1.5">メモ</span>
          <textarea
            name="memo"
            rows={3}
            placeholder="注意事項・好み・連絡先など"
            className="w-full rounded-app border-2 border-navy/10 bg-white px-4 py-3 text-base text-navy placeholder:text-navy/30 focus:outline-none focus:border-gold transition-colors"
          />
        </label>

        {state.error && (
          <p role="alert" className="text-danger text-sm font-bold">
            {state.error}
          </p>
        )}

        <Button type="submit" variant="gold" disabled={pending} className="mt-2">
          {pending ? "保存中…" : "保存"}
        </Button>
      </form>
    </Card>
  );
}
