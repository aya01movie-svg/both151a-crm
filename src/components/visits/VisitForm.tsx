"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Plus } from "lucide-react";
import { saveVisitAction, getLastVisitInfoAction } from "@/lib/actions/visits";
import { initialSaveVisitState } from "@/lib/actions/visits-state";
import { createTagQuick } from "@/lib/actions/tags";
import { PersonAutocompleteField } from "./PersonAutocompleteField";
import { Button } from "@/components/ui/Button";
import { Card, CardTitle } from "@/components/ui/Card";
import { toDateTimeLocalValue } from "@/lib/date";
import { enqueueWrite } from "@/lib/offline/queue";
import type { Tag } from "@/types/database";
import type { LastVisitInfo } from "@/lib/data/visits";

const DRAFT_KEY = "both151a:visit-draft:v3";

type InitialCustomer = {
  id: string;
  display_name: string;
  caution_level?: "none" | "caution" | "banned";
  lastVisitInfo: LastVisitInfo | null;
} | null;

type InitialReservation = {
  id: string;
  peopleCount: number;
  companionNames: string[];
  bottlePlan: boolean;
  tagIds: string[];
  memo: string | null;
} | null;

type CompanionEntry = { name: string; kana: string };

type DraftShape = {
  representativeId: string | null;
  representativeCaution: "none" | "caution" | "banned";
  representativeName: string;
  representativeKana: string;
  representativeBirthday: string;
  companions: CompanionEntry[];
  visitedAt: string;
  peopleCount: number;
  seatType: "counter" | "box" | null;
  amount: string;
  tip: string;
  paymentMethod: "cash" | "credit" | "other";
  receiptRequired: boolean;
  receiptName: string;
  tagIds: string[];
  memo: string;
};

function blankDraft(
  initialCustomer: InitialCustomer,
  initialReservation?: InitialReservation | null
): DraftShape {
  const info = initialCustomer?.lastVisitInfo;
  const companionNames = initialReservation?.companionNames ?? info?.companionNames ?? [];
  const companions = companionNames.map((name) => ({ name, kana: "" }));
  return {
    representativeId: initialCustomer?.id ?? null,
    representativeCaution: initialCustomer?.caution_level ?? "none",
    representativeName: initialCustomer?.display_name ?? "",
    representativeKana: "",
    representativeBirthday: "",
    companions,
    visitedAt: toDateTimeLocalValue(new Date()),
    peopleCount: initialReservation?.peopleCount ?? Math.max(1, companions.length + 1),
    seatType: info?.seat_type ?? null,
    amount: "",
    tip: "",
    paymentMethod: info?.payment_method ?? "cash",
    receiptRequired: info?.receipt_required ?? false,
    receiptName: info?.receipt_name ?? "",
    tagIds: initialReservation?.tagIds ?? (info?.tags ?? []).map((t) => t.id),
    memo: initialReservation?.memo ?? info?.memo ?? "",
  };
}

export function VisitForm({
  tags,
  initialCustomer,
  initialReservation = null,
}: {
  tags: Tag[];
  initialCustomer: InitialCustomer;
  initialReservation?: InitialReservation;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    saveVisitAction,
    initialSaveVisitState
  );

  const [draft, setDraft] = useState<DraftShape>(() =>
    blankDraft(initialCustomer, initialReservation)
  );
  const [message, setMessage] = useState<string | null>(null);
  const hasRestoredRef = useRef(false);
  const submittedRef = useRef(false);
  const [localTags, setLocalTags] = useState(tags);
  const [addingTag, setAddingTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [tagCreating, setTagCreating] = useState(false);
  const [, startTagTransition] = useTransition();
  const [copyingLastVisit, setCopyingLastVisit] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  useEffect(() => {
    if (hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    if (initialCustomer || initialReservation) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as DraftShape;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- マウント後の外部ストレージ復元のため意図的
        setDraft(parsed);
        setMessage("前回の入力内容を復元しました。");
      }
    } catch {
      // 破損した下書きは無視する
    }
  }, [initialCustomer, initialReservation]);

  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    } catch {
      // 保存領域が使えない場合は無視
    }
  }, [draft]);

  // RC8修正: 「保存」時は保存確認メッセージを一瞬出して即遷移するのではなく、
  // すぐに顧客詳細へ遷移し、確認メッセージは遷移先の画面（クエリパラメータ経由）で
  // 表示する。これにより文言が読めないまま画面が切り替わる問題を解消する。
  useEffect(() => {
    if (!state.success) return;
    submittedRef.current = false;
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // no-op
    }
    if (state.intent === "save") {
      router.push(`/customers/${state.customerId}?visitSaved=1`);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- サーバーアクション結果への反応として意図的
      setDraft(blankDraft(null));
      setMessage("保存しました。続けて次の来店を登録できます。");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success, state.intent, state.customerId]);

  useEffect(() => {
    if (state.error) submittedRef.current = false;
  }, [state.error]);

  const isNewCustomer = !draft.representativeId;

  function updateCompanion(index: number, patch: Partial<CompanionEntry>) {
    setDraft((d) => {
      const next = [...d.companions];
      next[index] = { ...next[index], ...patch };
      return { ...d, companions: next };
    });
  }

  function addCompanion() {
    setDraft((d) => {
      if (d.companions.length >= 10) return d;
      const companions = [...d.companions, { name: "", kana: "" }];
      return { ...d, companions, peopleCount: companions.length + 1 };
    });
  }

  function removeCompanion(index: number) {
    setDraft((d) => {
      const companions = d.companions.filter((_, i) => i !== index);
      return { ...d, companions, peopleCount: companions.length + 1 };
    });
  }

  function toggleTag(tagId: string) {
    setDraft((d) => ({
      ...d,
      tagIds: d.tagIds.includes(tagId)
        ? d.tagIds.filter((id) => id !== tagId)
        : [...d.tagIds, tagId],
    }));
  }

  // レビュー指摘: 前回来店をコピー（カウンター/BOX・支払方法・タグ・同伴者・
  // 領収書宛名・前回メモを引き継ぐ。会計金額・チップは毎回変わるため空欄のまま）
  // RC8修正: 代表者としての来店だけでなく、同伴者としての来店履歴も候補に含める
  // （getLastVisitInfo側で対応済み）。
  async function copyLastVisit() {
    if (!draft.representativeId) return;
    setCopyingLastVisit(true);
    setCopyMessage(null);
    try {
      const info = await getLastVisitInfoAction(draft.representativeId);
      if (!info || !info.hasHistory) {
        setCopyMessage("この顧客の来店履歴が見つかりませんでした。");
        return;
      }
      setDraft((d) => ({
        ...d,
        seatType: info.seat_type,
        paymentMethod: info.payment_method,
        receiptRequired: info.receipt_required,
        receiptName: info.receipt_name ?? "",
        tagIds: info.tags.map((t) => t.id),
        companions: info.companionNames.map((name) => ({ name, kana: "" })),
        peopleCount: Math.max(1, info.companionNames.length + 1),
        memo: info.memo ?? "",
      }));
      setLocalTags((prev) => {
        const existingIds = new Set(prev.map((t) => t.id));
        const additions = info.tags.filter((t) => !existingIds.has(t.id));
        return additions.length > 0 ? [...prev, ...additions] : prev;
      });
      setCopyMessage("前回の来店内容をコピーしました。");
    } catch {
      setCopyMessage("コピーに失敗しました。");
    } finally {
      setCopyingLastVisit(false);
    }
  }

  // RC3修正: <form action={formAction}> による標準的な送信に戻す。
  // onSubmitは「オフライン時のみ」「二重送信防止のみ」介入する。
  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (submittedRef.current) {
      e.preventDefault();
      return;
    }

    if (typeof navigator === "undefined" || navigator.onLine) {
      submittedRef.current = true;
      return; // オンライン: action={formAction} にそのまま任せる
    }

    // 第38章: 通信がない場合は端末に一時保存し、通信復旧後にSyncManagerが自動同期する
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as
      | HTMLButtonElement
      | undefined;
    const formData = new FormData(e.currentTarget, submitter);
    await enqueueWrite("visit", formData);
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      // no-op
    }
    setDraft(blankDraft(null));
    setMessage("オフラインのため端末に保存しました。復旧後に自動送信されます。");
  }

  // RC6修正: Enterキーでの誤送信を防ぐ。Ctrl+Enter（または⌘+Enter）または
  // 保存ボタンのクリックのみを送信トリガーとする。
  function handleKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA") return;
    if (e.ctrlKey || e.metaKey) return;
    e.preventDefault();
  }

  const validCompanions = draft.companions.filter((c) => c.name.trim());

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      onKeyDown={handleKeyDown}
      className="grid grid-cols-1 lg:grid-cols-2 gap-4"
    >
      {/* hidden: 代表者確定情報 */}
      <input type="hidden" name="customer_id" value={draft.representativeId ?? ""} />
      <input type="hidden" name="is_new_customer" value={isNewCustomer ? "1" : "0"} />
      <input type="hidden" name="new_customer_name" value={draft.representativeName} />
      <input type="hidden" name="new_customer_kana" value={draft.representativeKana} />
      <input type="hidden" name="new_customer_birthday" value={draft.representativeBirthday} />
      {initialReservation && (
        <input type="hidden" name="reservation_id" value={initialReservation.id} />
      )}
      {validCompanions.map((c, i) => (
        <input key={`name-${i}`} type="hidden" name="companion_names" value={c.name.trim()} />
      ))}
      {validCompanions.map((c, i) => (
        <input key={`kana-${i}`} type="hidden" name="companion_kanas" value={c.kana.trim()} />
      ))}
      {draft.tagIds.map((id) => (
        <input key={id} type="hidden" name="tag_ids" value={id} />
      ))}
      <input type="hidden" name="seat_type" value={draft.seatType ?? ""} />
      <input type="hidden" name="receipt_required" value={draft.receiptRequired ? "1" : "0"} />
      <input type="hidden" name="payment_method" value={draft.paymentMethod} />

      {/* 基本情報 */}
      <Card>
        <CardTitle>基本情報</CardTitle>
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="block text-sm font-bold text-navy/70 mb-1.5">
              来店日時（過去・未来日も可）
            </span>
            <input
              type="datetime-local"
              name="visited_at"
              value={draft.visitedAt}
              onChange={(e) => setDraft((d) => ({ ...d, visitedAt: e.target.value }))}
              required
              className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
            />
          </label>

          <div>
            {draft.representativeId ? (
              <div className="rounded-app border-2 border-navy/10 bg-beige px-4 py-2">
                <div className="flex items-center justify-between min-h-10">
                  <span className="font-bold text-navy">{draft.representativeName}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft((d) => ({ ...d, representativeId: null, representativeCaution: "none" }))
                    }
                    className="text-sm text-navy/50 underline"
                  >
                    変更
                  </button>
                </div>
                {draft.representativeCaution === "banned" && (
                  <p className="text-danger text-xs font-bold">⛔ この顧客は出禁に設定されています</p>
                )}
                {draft.representativeCaution === "caution" && (
                  <p className="text-warn text-xs font-bold">⚠️ この顧客は注意対象に設定されています</p>
                )}
                <button
                  type="button"
                  disabled={copyingLastVisit}
                  onClick={copyLastVisit}
                  className="mt-1.5 text-xs font-bold text-gold-dark underline disabled:opacity-50"
                >
                  {copyingLastVisit ? "確認中…" : "前回来店をコピー"}
                </button>
                {copyMessage && (
                  <p className="text-xs text-navy/50 mt-0.5">{copyMessage}</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <PersonAutocompleteField
                  label="代表者（候補から選択、なければ新規登録されます）"
                  placeholder="代表者名を入力"
                  value={draft.representativeName}
                  onChangeText={(text) =>
                    setDraft((d) => ({ ...d, representativeName: text, representativeId: null }))
                  }
                  onSelect={(c) =>
                    setDraft((d) => ({
                      ...d,
                      representativeId: c.id,
                      representativeName: c.display_name,
                      representativeCaution: c.caution_level ?? "none",
                    }))
                  }
                />
                {draft.representativeName.trim() && (
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={draft.representativeKana}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, representativeKana: e.target.value }))
                      }
                      placeholder="ふりがな（新規登録の場合・任意）"
                      className="w-full min-h-11 rounded-app border-2 border-navy/10 bg-white px-3 text-sm text-navy focus:outline-none focus:border-gold"
                    />
                    <div>
                      <span className="block text-xs font-bold text-navy/50 mb-1">誕生日（新規登録・任意）</span>
                      <div className="flex items-center gap-2">
                        <select
                          value={draft.representativeBirthday.slice(5, 7) || ""}
                          onChange={(e) => {
                            const d = draft.representativeBirthday.slice(8, 10) || "01";
                            setDraft((prev) => ({ ...prev, representativeBirthday: e.target.value ? `2000-${e.target.value}-${d}` : "" }));
                          }}
                          className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-2 text-sm text-navy focus:outline-none focus:border-gold"
                        >
                          <option value="">月</option>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map((mn) => (
                            <option key={mn} value={String(mn).padStart(2, "0")}>{mn}月</option>
                          ))}
                        </select>
                        <select
                          value={draft.representativeBirthday.slice(8, 10) || ""}
                          onChange={(e) => {
                            const mo = draft.representativeBirthday.slice(5, 7) || "01";
                            setDraft((prev) => ({ ...prev, representativeBirthday: e.target.value ? `2000-${mo}-${e.target.value}` : "" }));
                          }}
                          className="min-h-11 rounded-app border-2 border-navy/10 bg-white px-2 text-sm text-navy focus:outline-none focus:border-gold"
                        >
                          <option value="">日</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((dd) => (
                            <option key={dd} value={String(dd).padStart(2, "0")}>{dd}日</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            className={
              draft.peopleCount >= 2
                ? "rounded-app border-2 border-gold/50 bg-gold/5 p-3"
                : ""
            }
          >
            <span className="block text-sm font-bold text-navy/70 mb-1.5">
              同伴者（最大10名まで追加・候補表示。候補にない名前は保存時に新規顧客登録されます）
            </span>
            <div className="flex flex-col gap-2">
              {draft.companions.map((c, i) => (
                <div key={i} className="flex flex-col gap-1 rounded-app border-2 border-navy/5 p-2">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <PersonAutocompleteField
                        placeholder={`同伴者${i + 1}`}
                        value={c.name}
                        compact
                        onChangeText={(text) => updateCompanion(i, { name: text })}
                        onSelect={(sel) => updateCompanion(i, { name: sel.display_name })}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCompanion(i)}
                      aria-label="同伴者を削除"
                      className="shrink-0 w-12 min-h-12 flex items-center justify-center rounded-app border-2 border-navy/10 text-navy/40 hover:bg-navy/5 active:bg-navy/10"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  {c.name.trim() && (
                    <input
                      type="text"
                      value={c.kana}
                      onChange={(e) => updateCompanion(i, { kana: e.target.value })}
                      placeholder="ふりがな（新規登録の場合・任意）"
                      className="w-full min-h-10 rounded-app border-2 border-navy/10 bg-white px-3 text-xs text-navy focus:outline-none focus:border-gold"
                    />
                  )}
                </div>
              ))}
              {draft.companions.length < 10 && (
                <button
                  type="button"
                  onClick={addCompanion}
                  className="flex items-center justify-center gap-1 min-h-12 rounded-app border-2 border-dashed border-navy/20 text-navy/50 text-sm font-bold hover:bg-navy/5 active:bg-navy/10"
                >
                  <Plus size={16} /> 同伴者を追加
                </button>
              )}
            </div>

            <label className="block mt-3">
              <span className="block text-sm font-bold text-navy/70 mb-1.5">
                人数（代表者+同伴者で自動計算、手入力でも変更可）
              </span>
              <input
                type="number"
                name="people_count"
                min={1}
                value={draft.peopleCount}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, peopleCount: Number(e.target.value) || 1 }))
                }
                required
                className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
              />
            </label>
          </div>

          <div>
            <span className="block text-sm font-bold text-navy/70 mb-1.5">席タイプ</span>
            <div className="flex gap-2">
              {(["counter", "box"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    setDraft((d) => ({ ...d, seatType: d.seatType === v ? null : v }))
                  }
                  className={`btn-base flex-1 border-2 transition-colors ${
                    draft.seatType === v
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-navy border-navy/10 active:bg-navy/5"
                  }`}
                >
                  {v === "counter" ? "カウンター" : "BOX"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="block text-sm font-bold text-navy/70 mb-1.5">タグ</span>
            <div className="flex flex-wrap gap-2 items-center">
              {localTags.length === 0 && !addingTag && (
                <p className="text-navy/30 text-sm">タグが未登録です。</p>
              )}
              {localTags.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  className={`px-3 py-2 rounded-app text-sm font-bold border-2 transition-colors ${
                    draft.tagIds.includes(t.id)
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
                          setDraft((d) => ({ ...d, tagIds: [...d.tagIds, created.id] }));
                          setNewTagName("");
                          setAddingTag(false);
                        } catch {
                          // 失敗時は何もしない（管理者権限の問題等）
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
              rows={3}
              value={draft.memo}
              onChange={(e) => setDraft((d) => ({ ...d, memo: e.target.value }))}
              className="w-full rounded-app border-2 border-navy/10 bg-white px-4 py-3 text-base text-navy focus:outline-none focus:border-gold"
            />
          </label>
        </div>
      </Card>

      {/* 会計 */}
      <Card>
        <CardTitle>会計</CardTitle>
        <div className="flex flex-col gap-4">
          <label className="block">
            <span className="block text-sm font-bold text-navy/70 mb-1.5">会計金額</span>
            <input
              type="number"
              name="amount"
              min={0}
              value={draft.amount}
              onChange={(e) => setDraft((d) => ({ ...d, amount: e.target.value }))}
              placeholder="0"
              required
              className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
            />
          </label>

          <label className="block">
            <span className="block text-sm font-bold text-navy/70 mb-1.5">チップ</span>
            <input
              type="number"
              name="tip"
              min={0}
              value={draft.tip}
              onChange={(e) => setDraft((d) => ({ ...d, tip: e.target.value }))}
              placeholder="0"
              className="w-full min-h-14 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
            />
          </label>

          <div>
            <span className="block text-sm font-bold text-navy/70 mb-1.5">支払い方法</span>
            <div className="grid grid-cols-3 gap-2">
              {(["cash", "credit", "other"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, paymentMethod: v }))}
                  className={`btn-base border-2 transition-colors ${
                    draft.paymentMethod === v
                      ? "bg-navy text-white border-navy"
                      : "bg-white text-navy border-navy/10 active:bg-navy/5"
                  }`}
                >
                  {v === "cash" ? "現金" : v === "credit" ? "クレジット" : "その他"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 min-h-12">
              <input
                type="checkbox"
                checked={draft.receiptRequired}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, receiptRequired: e.target.checked }))
                }
                className="w-5 h-5 accent-gold"
              />
              <span className="font-bold text-navy/70 text-sm">領収書が必要</span>
            </label>
            {draft.receiptRequired && (
              <div className="mt-1">
                <input
                  type="text"
                  name="receipt_name"
                  value={draft.receiptName}
                  onChange={(e) => setDraft((d) => ({ ...d, receiptName: e.target.value }))}
                  placeholder="宛名（必須）"
                  required
                  className="w-full min-h-12 rounded-app border-2 border-navy/10 bg-white px-4 text-base text-navy focus:outline-none focus:border-gold"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {["株式会社", "(株)"].map((word) => (
                    <button
                      key={word}
                      type="button"
                      onClick={() =>
                        setDraft((d) => ({ ...d, receiptName: d.receiptName + word }))
                      }
                      className="px-2 py-1 rounded-full text-xs font-bold border border-navy/10 text-navy/50 hover:bg-navy/5"
                    >
                      + {word}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-navy/40 bg-beige rounded-app p-2">
            ボトルの登録は保存後の顧客詳細画面から行えます（顧客詳細に「ボトルを追加しますか？」の案内が表示されます）。
          </p>

          {state.error && (
            <p role="alert" className="text-danger text-sm font-bold">
              {state.error}
            </p>
          )}
          {message && !state.error && (
            <p className="text-success text-sm font-bold">{message}</p>
          )}

          <div className="flex gap-3">
            <Button
              type="submit"
              name="intent"
              value="save"
              variant="navy"
              fullWidth
              disabled={pending}
            >
              {pending ? "保存中…" : "保存"}
            </Button>
            <Button
              type="submit"
              name="intent"
              value="save_and_continue"
              variant="gold"
              fullWidth
              disabled={pending}
            >
              保存して続ける
            </Button>
          </div>
        </div>
      </Card>
    </form>
  );
}
