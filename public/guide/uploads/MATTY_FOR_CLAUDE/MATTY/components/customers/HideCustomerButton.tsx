"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCustomerHiddenAction } from "@/lib/actions/customers";

export function HideCustomerButton({
  customerId,
  hidden,
}: {
  customerId: string;
  hidden: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    const confirmMsg = hidden
      ? "この顧客を復元しますか？"
      : "この顧客を無効化（非表示）しますか？データは削除されません。一覧・検索から見えなくなります。";
    if (!confirm(confirmMsg)) return;
    startTransition(async () => {
      await setCustomerHiddenAction(customerId, !hidden);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      disabled={pending}
      onClick={handleClick}
      className="text-xs text-navy/40 underline disabled:opacity-40"
    >
      {hidden ? "復元する" : "この顧客を無効化"}
    </button>
  );
}
