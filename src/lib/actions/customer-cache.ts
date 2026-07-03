"use server";

import { getCustomerCacheData, type CustomerCacheRecord } from "@/lib/data/customer-cache";

/** クライアント（オフライン検索キャッシュの同期処理）から呼び出す。 */
export async function fetchCustomerCacheAction(): Promise<CustomerCacheRecord[]> {
  return getCustomerCacheData();
}
