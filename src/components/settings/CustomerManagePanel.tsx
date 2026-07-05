"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteCustomerAction, mergeCustomerAction } from "@/lib/actions/customers";
import type { Customer } from "@/types/database";

export function CustomerManagePanel({ customers }: { customers: Pick<Customer, "id" | "display_name" | "kana" | "visit_count">[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [search, setSearch] = useState("");

  // 削除
  function handleDelete(c: typeof customers[number]) {
    if (!confirm(`「${c.display_name}」を完全削除します。\n来店履歴・ボトル等もすべて削除されます。\n\nこの操作は取り消せません。本当に削除しますか？`)) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await deleteCustomerAction(c.id);
        setMessage({ type: "ok", text: `「${c.display_name}」を削除しました。` });
        router.refresh();
      } catch (e) {
        setMessage({ type: "err", text: e instanceof Error ? e.message : "削除に失敗しました。" });
      }
    });
  }

  // 統合: 選択 → 統合先選択
  const [mergeFrom, setMergeFrom] = useState<typeof customers[number] | null>(null);

  function handleMergeStart(c: typeof customers[number]) {
    setMergeFrom(c);
    setMessage(null);
  }

  function handleMergeConfirm(to: typeof customers[number]) {
    if (!mergeFrom || mergeFrom.id === to.id) return;
    if (!confirm(
      `「${mergeFrom.display_name}」のデータをすべて「${to.display_name}」へ移して、「${mergeFrom.display_name}」を削除します。\n\nこの操作は取り消せません。続けますか？`
    )) return;
    setMessage(null);
    startTransition(async () => {
      try {
        await mergeCustomerAction(mergeFrom.id, to.id);
        setMessage({ type: "ok", text: `「${mergeFrom.display_name}」→「${to.display_name}」へ統合しました。` });
        setMergeFrom(null);
        router.refresh();
      } catch (e) {
        setMessage({ type: "err", text: e instanceof Error ? e.message : "統合に失敗しました。" });
      }
    });
  }

  const filtered = customers.filter((c) =>
    c.display_name.includes(search) || (c.kana ?? "").includes(search)
  );

  return (
    <div className="flex flex-col gap-3">
      {message && (
        <p className={`text-sm font-bold p-3 rounded-app ${message.type === "ok" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"}`}>
          {message.text}
        </p>
      )}

      {mergeFrom && (
        <div className="p-3 rounded-app border-2 border-warn bg-warn/10">
          <p className="font-bold text-navy mb-1">
            「{mergeFrom.display_name}」の統合先を選択してください
          </p>
          <p className="text-xs text-navy/50 mb-2">
            選んだ顧客へすべてのデータが移り、「{mergeFrom.display_name}」は削除されます。
          </p>
          <button
            type="button"
            onClick={() => setMergeFrom(null)}
            className="text-xs text-navy/40 underline"
          >
            キャンセル
          </button>
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="顧客名・ふりがなで絞り込み"
        className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm focus:outline-none focus:border-gold"
      />

      <p className="text-xs text-navy/40">{filtered.length}件表示（全{customers.length}件）</p>

      <ul className="flex flex-col gap-2 max-h-[500px] overflow-y-auto">
        {filtered.map((c) => {
          const isMergeTarget = mergeFrom && mergeFrom.id !== c.id;
          const isMergeSource = mergeFrom?.id === c.id;
          return (
            <li
              key={c.id}
              className={`flex items-center gap-2 p-2 rounded-app border ${
                isMergeSource ? "border-warn bg-warn/5" : "border-navy/5 bg-white"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="font-bold text-navy text-sm truncate">{c.display_name}</p>
                {c.kana && <p className="text-xs text-navy/40 truncate">{c.kana}</p>}
                <p className="text-xs text-navy/30">来店{c.visit_count}回</p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                {isMergeTarget ? (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => handleMergeConfirm(c)}
                    className="px-2 py-1.5 rounded-app text-xs font-bold bg-warn text-white disabled:opacity-40"
                  >
                    ここへ統合
                  </button>
                ) : isMergeSource ? (
                  <span className="text-xs font-bold text-warn px-2">移動元</span>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={pending || !!mergeFrom}
                      onClick={() => handleMergeStart(c)}
                      className="px-2 py-1.5 rounded-app text-xs font-bold border border-navy/10 text-navy/60 disabled:opacity-40"
                    >
                      統合
                    </button>
                    <button
                      type="button"
                      disabled={pending || !!mergeFrom}
                      onClick={() => handleDelete(c)}
                      className="px-2 py-1.5 rounded-app text-xs font-bold bg-danger/10 text-danger border border-danger/20 disabled:opacity-40"
                    >
                      削除
                    </button>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
