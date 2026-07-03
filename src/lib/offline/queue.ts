import {
  dbAddPendingWrite,
  dbListPendingWrites,
  dbRemovePendingWrite,
  formDataToEntries,
  entriesToFormData,
  type PendingWriteKind,
} from "./db";

type Listener = (count: number) => void;
const listeners = new Set<Listener>();

async function notifyListeners() {
  try {
    const count = (await dbListPendingWrites()).length;
    listeners.forEach((l) => l(count));
  } catch {
    // IndexedDB未対応環境などでは通知をスキップする
  }
}

/** 保留中の書き込み件数の変化を購読する（オフラインバナー表示用）。 */
export function subscribePendingCount(listener: Listener): () => void {
  listeners.add(listener);
  void notifyListeners();
  return () => {
    listeners.delete(listener);
  };
}

/**
 * 通信断時に書き込みを端末へ一時保存する（第38章）。
 * 通信復旧後、flushQueue() で自動的にSupabaseへ同期される。
 */
export async function enqueueWrite(kind: PendingWriteKind, formData: FormData): Promise<void> {
  await dbAddPendingWrite({
    id: `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    kind,
    entries: formDataToEntries(formData),
    createdAt: new Date().toISOString(),
  });
  await notifyListeners();
}

export async function getPendingCount(): Promise<number> {
  try {
    return (await dbListPendingWrites()).length;
  } catch {
    return 0;
  }
}

type Handlers = Record<PendingWriteKind, (formData: FormData) => Promise<unknown>>;

/**
 * 保留中の書き込みを順番に再送信する。
 * 失敗した時点で停止する（まだ通信が不安定な可能性があるため、次回オンライン復帰時に再試行）。
 * 第38章「競合が発生した場合は最後に保存された内容を採用し、監査ログに両方の変更を残す」は
 * DB側の監査ログトリガー（004）が各書き込みを個別に記録することで担保する。
 */
export async function flushQueue(handlers: Handlers): Promise<number> {
  let synced = 0;
  try {
    const items = await dbListPendingWrites();
    // 登録された順に同期する
    items.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    for (const item of items) {
      try {
        await handlers[item.kind](entriesToFormData(item.entries));
        await dbRemovePendingWrite(item.id);
        synced++;
      } catch {
        break; // まだ送信できない場合はここで打ち切り、次回の同期タイミングに任せる
      }
    }
  } catch {
    // IndexedDB未対応環境では何もしない
  } finally {
    await notifyListeners();
  }
  return synced;
}
