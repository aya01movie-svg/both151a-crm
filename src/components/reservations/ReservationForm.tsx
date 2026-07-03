"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { saveReservationAction } from "@/lib/actions/reservations";
import { createTagQuick } from "@/lib/actions/tags";
import { PersonAutocompleteField } from "@/components/visits/PersonAutocompleteField";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { toDateTimeLocalValue } from "@/lib/date";
import { enqueueWrite } from "@/lib/offline/queue";
import type { Tag } from "@/types/database";

const initialState = { error: null, success: false };

export function ReservationForm({
  tags,
  presetCustomer,
}: {
  tags: Tag[];
  presetCustomer: { id: string; display_name: string } | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(saveReservationAction, initialState);

  const [representativeId, setRepresentativeId] = useState<string | null>(
    presetCustomer?.id ?? null
  );
  const [representativeCaution, setRepresentativeCaution] = useState<
    "none" | "caution" | "banned"
  >("none");
  const [representativeName, setRepresentativeName] = useState(
    presetCustomer?.display_name ?? ""
  );
  const [representativeKana, setRepresentativeKana] = useState("");
  const [companions, setCompanions] = useState<{ name: string; kana: string }[]>([]);
  const [reservedAt, setReservedAt] = useState(toDateTimeLocalValue(new Date()));
  const [peopleCount, setPeopleCount] = useState(1);
  const [bottlePlan, setBottlePlan] = useState(false);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const [memo, setMemo] = useState("");
  const [offlineMessage, setOfflineMessage] = useState<string | null>(null);
  const [localTags, setLocalTags] = useState(tags);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagCreating, setTagCreating] = useState(false);
  const [, startTagTransition] = useTransition();

  useEffect(() => {
    if (state.success) {
      router.refresh();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- サーバーアクション結果への反応として意図的にフォームをリセットする
      setRepresentativeId(null);
      setRepresentativeCaution("none");
      setRepresentativeName("");
      setRepresentativeKana("");
      setCompanions([]);
      setPeopleCount(1);
      setBottlePlan(false);
      setTagIds([]);
      setMemo("");
    }
  }, [state.success, router]);

  const isNewCustomer = !representativeId;

  function addCompanion() {
    setCompanions((cs) => {
      if (cs.length >= 10) return cs;
      const next = [...cs, { name: "", kana: "" }];
      setPeopleCount(next.length + 1);
      return next;
    });
  }

  function removeCompanion(index: number) {
    setCompanions((cs) => {
      const next = cs.filter((_, i) => i !== index);
      setPeopleCount(next.length + 1);
      return next;
    });
  }

  // RC3修正: <form action={formAction}> による標準的な送信に戻す。
  // onSubmitは「オフライン時のみ」介入する。
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (typeof navigator === "undefined" || navigator.onLine) {
      setOfflineMessage(null);
      return; // オンライン: action={formAction} にそのまま任せる
    }

    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | undefined;
    const formData = new FormData(e.currentTarget, submitter);
    await enqueueWrite("reservation", formData);
    setRepresentativeId(null);
    setRepresentativeCaution("none");
    setRepresentativeName("");
    setRepresentativeKana("");
    setCompanions([]);
    setPeopleCount(1);
    setBottlePlan(false);
    setTagIds([]);
    setMemo("");
    setOfflineMessage("オフラインのため端末に保存しました。復旧後に自動送信されます。");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
  }

  return (
    <Card>
      <CardTitle>予約登録</CardTitle>
      <form
        action={formAction}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-4"
      >
        <input type="hidden" name="customer_id" value={representativeId ?? ""} />
        <input type="hidden" name="is_new_customer" value={isNewCustomer ? "1" : "0"} />
        <input type="hidden" name="new_customer_name" value={representativeName} />
        <input type="hidden" name="new_customer_kana" value={representativeKana} />
        <input type="hidden" name="bottle_plan" value={bottlePlan ? "1" : "0"} />
        {companions
          .filter((c) => c.name.trim())
          .map((c, i) => (
            <input key={`name-${i}`} type="hidden" name="companion_names" value={c.name.trim()} />
          ))}
        {companions
          .filter((c) => c.name.trim())
          .map((c, i) => (
            <input key={`kana-${i}`} type="hidden" name="companion_kanas" value={c.kana.trim()} />
          ))}
        {tagIds.map((id) => (
          <input key={id} type="hidden" name="tag_ids" value={id} />
        ))}

        <label className="block">
          <span className="block text-sm font-bold text-navy/70 mb-1.5">予約日時</span>
          <input
            type="datetime-local"
            name="reserved_at"
            value={reservedAt}
            onChange={(e) => setReservedAt(e.target.value)}
            required
            className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
          />
        </label>

        {representativeId ? (
          <div className="rounded-app border-2 border-navy/10 bg-beige px-4 py-2">
            <div className="flex items-center justify-between min-h-10">
              <span className="font-bold text-navy">{representativeName}</span>
              <button
                type="button"
                onClick={() => {
                  setRepresentativeId(null);
                  setRepresentativeCaution("none");
                }}
                className="text-sm text-navy/50 underline"
              >
                変更
              </button>
            </div>
            {representativeCaution === "banned" && (
              <p className="text-danger text-xs font-bold">⛔ この顧客は出禁に設定されています</p>
            )}
            {representativeCaution === "caution" && (
              <p className="text-warn text-xs font-bold">⚠️ この顧客は注意対象に設定されています</p>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <PersonAutocompleteField
              label="代表者"
              placeholder="代表者名を入力（候補表示）"
              value={representativeName}
              onChangeText={setRepresentativeName}
              onSelect={(c) => {
                setRepresentativeId(c.id);
                setRepresentativeName(c.display_name);
                setRepresentativeCaution(c.caution_level ?? "none");
              }}
            />
            {representativeName.trim() && (
              <input
                type="text"
                value={representativeKana}
                onChange={(e) => setRepresentativeKana(e.target.value)}
                placeholder="ふりがな（新規登録の場合・任意）"
                className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
              />
            )}
          </div>
        )}

        <div>
          <span className="block text-sm font-bold text-navy/70 mb-1.5">同伴者</span>
          <div className="flex flex-col gap-2">
            {companions.map((c, i) => (
              <div key={i} className="flex flex-col gap-1 rounded-app border-2 border-navy/5 p-2">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <PersonAutocompleteField
                      placeholder={`同伴者${i + 1}`}
                      value={c.name}
                      compact
                      onChangeText={(text) =>
                        setCompanions((cs) =>
                          cs.map((cur, idx) => (idx === i ? { ...cur, name: text } : cur))
                        )
                      }
                      onSelect={(sel) =>
                        setCompanions((cs) =>
                          cs.map((cur, idx) =>
                            idx === i ? { ...cur, name: sel.display_name } : cur
                          )
                        )
                      }
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCompanion(i)}
                    className="shrink-0 w-12 min-h-12 flex items-center justify-center rounded-app border-2 border-navy/10 text-navy/40 hover:bg-navy/5 active:bg-navy/10"
                  >
                    <X size={18} />
                  </button>
                </div>
                {c.name.trim() && (
                  <input
                    type="text"
                    value={c.kana}
                    onChange={(e) =>
                      setCompanions((cs) =>
                        cs.map((cur, idx) => (idx === i ? { ...cur, kana: e.target.value } : cur))
                      )
                    }
                    placeholder="ふりがな（新規登録の場合・任意）"
                    className="w-full min-h-10 rounded-app border-2 border-navy/10 bg-white px-3 text-xs text-navy focus:outline-none focus:border-gold"
                  />
                )}
              </div>
            ))}
            {companions.length < 10 && (
              <button
                type="button"
                onClick={addCompanion}
                className="flex items-center justify-center gap-1 min-h-12 rounded-app border-2 border-dashed border-navy/20 text-navy/50 text-sm font-bold hover:bg-navy/5 active:bg-navy/10"
              >
                <Plus size={16} /> 追加
              </button>
            )}
          </div>
        </div>

        <label className="block">
          <span className="block text-sm font-bold text-navy/70 mb-1.5">
            人数（代表者+同伴者で自動計算、手入力でも変更可）
          </span>
          <input
            type="number"
            name="people_count"
            min={1}
            value={peopleCount}
            onChange={(e) => setPeopleCount(Number(e.target.value) || 1)}
            required
            className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
          />
        </label>

        <label className="flex items-center gap-2 min-h-12">
          <input
            type="checkbox"
            checked={bottlePlan}
            onChange={(e) => setBottlePlan(e.target.checked)}
            className="w-5 h-5 accent-gold"
          />
          <span className="font-bold text-navy/70 text-sm">ボトル予定あり</span>
        </label>

        <div>
          <span className="block text-sm font-bold text-navy/70 mb-1.5">タグ</span>
          <div className="flex flex-wrap gap-2 items-center">
            {localTags.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() =>
                  setTagIds((ids) =>
                    ids.includes(t.id) ? ids.filter((id) => id !== t.id) : [...ids, t.id]
                  )
                }
                className={`px-3 py-2 rounded-app text-sm font-bold border-2 transition-colors ${
                  tagIds.includes(t.id)
                    ? "bg-gold border-gold text-navy-dark"
                    : "bg-white border-navy/10 text-navy/60 active:bg-navy/5"
                }`}
              >
                {t.name}
              </button>
            ))}
            {addingTag ? (
              <span className="inline-flex items-center gap-1">
                <input
                  autoFocus
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="新しいタグ名"
                  className="min-h-10 rounded-app border-2 border-navy/10 bg-white px-2 text-sm text-navy focus:outline-none focus:border-gold w-32"
                />
                <button
                  type="button"
                  disabled={tagCreating}
                  onClick={() => {
                    if (!newTagName.trim()) return;
                    setTagCreating(true);
                    startTagTransition(async () => {
                      try {
                        const created = await createTagQuick(newTagName);
                        setLocalTags((prev) =>
                          prev.some((t) => t.id === created.id)
                            ? prev
                            : [...prev, { ...created, color: null, created_at: new Date().toISOString() }]
                        );
                        setTagIds((ids) => [...ids, created.id]);
                        setNewTagName("");
                        setAddingTag(false);
                      } catch {
                        // 失敗時は何もしない
                      } finally {
                        setTagCreating(false);
                      }
                    });
                  }}
                  className="min-h-10 px-2 rounded-app bg-navy text-white text-xs font-bold disabled:opacity-50"
                >
                  追加
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddingTag(false);
                    setNewTagName("");
                  }}
                  className="min-h-10 px-2 rounded-app border-2 border-navy/10 text-navy/50 text-xs"
                >
                  ×
                </button>
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setAddingTag(true)}
                className="px-3 py-2 rounded-app text-sm font-bold border-2 border-dashed border-navy/20 text-navy/50 hover:bg-navy/5"
              >
                <Plus size={14} className="inline -mt-0.5" /> 新しいタグ
              </button>
            )}
          </div>
        </div>

        <label className="block">
          <span className="block text-sm font-bold text-navy/70 mb-1.5">メモ</span>
          <textarea
            name="memo"
            rows={2}
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            className="w-full rounded-app border-2 border-navy/10 bg-white px-4 py-3 text-base text-navy focus:outline-none focus:border-gold"
          />
        </label>

        {state.error && <p className="text-danger text-sm font-bold">{state.error}</p>}
        {state.success && (
          <p className="text-success text-sm font-bold">予約を保存しました。</p>
        )}
        {offlineMessage && (
          <p className="text-warn text-sm font-bold">{offlineMessage}</p>
        )}

        <Button type="submit" variant="navy" disabled={pending}>
          {pending ? "保存中…" : "予約保存"}
        </Button>
      </form>
    </Card>
  );
}
