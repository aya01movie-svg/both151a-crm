"use client";

import { useActionState } from "react";
import { createCustomerAction, type CreateCustomerState } from "@/lib/actions/customers";
import { TextField } from "@/components/ui/TextField";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";

const initialState: CreateCustomerState = { error: null };

export function NewCustomerForm() {
  const [state, formAction, pending] = useActionState(
    createCustomerAction,
    initialState
  );

  return (
    <Card className="max-w-2xl">
      <CardTitle>基本情報</CardTitle>
      <form action={formAction} className="flex flex-col gap-4">
        <TextField
          label="登録名（必須・ニックネーム/本名/会社名など自由入力）"
          name="display_name"
          required
          autoFocus
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="ふりがな" name="kana" />
          <TextField label="本名（任意）" name="real_name" />
        </div>
        <TextField label="誕生日" name="birthday" type="date" />
        <TextField label="別名（同伴者名などをカンマ区切りで）" name="aliases" placeholder="例：社長、田中さん" />

        <label className="block">
          <span className="block text-sm font-bold text-navy/70 mb-1.5">メモ</span>
          <textarea
            name="memo"
            rows={3}
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
