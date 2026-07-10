const DB_NAME = "both151a-offline";
const DB_VERSION = 2;
const STORE = "pending-writes";
const CUSTOMER_CACHE_STORE = "customer-cache";
const META_STORE = "meta";

export type PendingWriteKind = "visit" | "reservation" | "note";

export type PendingWrite = {
  id: string;
  kind: PendingWriteKind;
  /** FormDataは直接保存できないため [key, value] のタプル列に変換して保存する */
  entries: [string, string][];
  createdAt: string;
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(CUSTOMER_CACHE_STORE)) {
        const store = db.createObjectStore(CUSTOMER_CACHE_STORE, { keyPath: "id" });
        // last_visit_at の新しい順に取り出せるようにする（1000件優先度の確認・整理に使う）
        store.createIndex("last_visit_at", "last_visit_at");
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function formDataToEntries(formData: FormData): [string, string][] {
  return Array.from(formData.entries()).map(([k, v]) => [k, String(v)]);
}

export function entriesToFormData(entries: [string, string][]): FormData {
  const fd = new FormData();
  for (const [k, v] of entries) fd.append(k, v);
  return fd;
}

export async function dbAddPendingWrite(write: PendingWrite): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(write);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbListPendingWrites(): Promise<PendingWrite[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as PendingWrite[]);
    req.onerror = () => reject(req.error);
  });
}

export async function dbRemovePendingWrite(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ============================================================
// 顧客検索キャッシュ（オフライン検索用・第9章・第19章・第38章）
// ============================================================

export type CachedCustomer = {
  id: string;
  display_name: string;
  kana: string | null;
  real_name: string | null;
  memo: string | null;
  favorite: boolean;
  rank: string;
  last_visit_at: string | null;
  visit_count: number;
  aliases: string[];
  tags: string[];
  receiptNames: string[];
  /** 検索用に小文字化・結合済みの文字列（毎回結合しないよう事前計算しておく） */
  searchBlob: string;
};

/** キャッシュ全件を置き換える（同期のたびに最新1000件で丸ごと入れ替える）。 */
export async function dbReplaceCustomerCache(records: CachedCustomer[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(CUSTOMER_CACHE_STORE, "readwrite");
    const store = tx.objectStore(CUSTOMER_CACHE_STORE);
    store.clear();
    for (const record of records) store.put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetAllCachedCustomers(): Promise<CachedCustomer[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOMER_CACHE_STORE, "readonly");
    const req = tx.objectStore(CUSTOMER_CACHE_STORE).getAll();
    req.onsuccess = () => resolve(req.result as CachedCustomer[]);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGetCustomerCacheCount(): Promise<number> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CUSTOMER_CACHE_STORE, "readonly");
    const req = tx.objectStore(CUSTOMER_CACHE_STORE).count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbSetMeta(key: string, value: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readwrite");
    tx.objectStore(META_STORE).put({ key, value });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbGetMeta(key: string): Promise<string | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, "readonly");
    const req = tx.objectStore(META_STORE).get(key);
    req.onsuccess = () => resolve(req.result ? (req.result.value as string) : null);
    req.onerror = () => reject(req.error);
  });
}
