"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateCustomerAction } from "@/lib/actions/customers";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import type { Customer } from "@/types/database";

export function CustomerEditForm({ customer }: { customer: Customer }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(customer.display_name);
  const [kana, setKana] = useState(customer.kana ?? "");
  const [realName, setRealName] = useState(customer.real_name ?? "");
  const [birthday, setBirthday] = useState(customer.birthday ?? "");
  const [memo, setMemo] = useState(customer.memo ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("登録名を入力してください。");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await updateCustomerAction(customer.id, {
          display_name: displayName.trim(),
          kana: kana.trim(),
          real_name: realName.trim(),
          birthday,
          memo: memo.trim(),
        });
        router.push(`/customers/${customer.id}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "更新に失敗しました。");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <TextField
        label="登録名（必須）"
        value={displayName}
        onChange={(e) => setDisplayName(e.target.value)}
        required
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="ふりがな" value={kana} onChange={(e) => setKana(e.target.value)} />
        <TextField label="本名（任意）" value={realName} onChange={(e) => setRealName(e.target.value)} />
      </div>
      <TextField
        label="誕生日"
        type="date"
        value={birthday}
        onChange={(e) => setBirthday(e.target.value)}
      />
      <label className="block">
        <span className="block text-sm font-bold text-navy/70 mb-1.5">メモ</span>
        <textarea
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          rows={3}
          className="w-full rounded-app border-2 border-navy/10 bg-white px-4 py-3 text-base text-navy focus:outline-none focus:border-gold"
        />
      </label>
      {error && <p className="text-danger text-sm font-bold">{error}</p>}
      <div className="flex gap-3">
        <Button type="submit" variant="gold" disabled={pending} fullWidth>
          {pending ? "保存中…" : "保存"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push(`/customers/${customer.id}`)}
        >
          キャンセル
        </Button>
      </div>
    </form>
  );
}
