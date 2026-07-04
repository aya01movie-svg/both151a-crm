import { redirect, notFound } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { getCustomerDetail, recordCustomerView } from "@/lib/data/customers";
import { getCustomerTimeline } from "@/lib/data/timeline";
import { AppShell } from "@/components/layout/AppShell";
import { Card, CardTitle } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { RankBadge } from "@/components/customers/RankBadge";
import { RankSelector } from "@/components/customers/RankSelector";
import { FavoriteToggle } from "@/components/customers/FavoriteToggle";
import { BottleStatusBadge } from "@/components/customers/BottleStatusBadge";
import { BottleAddForm } from "@/components/customers/BottleAddForm";
import { NoteForm } from "@/components/customers/NoteForm";
import { CautionToggle } from "@/components/customers/CautionToggle";
import { InvalidateNoteButton } from "@/components/customers/InvalidateNoteButton";
import { HideCustomerButton } from "@/components/customers/HideCustomerButton";
import { CustomerTimeline } from "@/components/customers/CustomerTimeline";
import { daysSince, formatDate, formatDateTime, yen } from "@/lib/date";
import { computePace } from "@/lib/pace";

const PAYMENT_LABEL: Record<string, string> = {
  cash: "現金",
  credit: "カード",
  other: "その他",
};

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ visitSaved?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { id } = await params;
  const { visitSaved } = await searchParams;
  const detail = await getCustomerDetail(id);
  if (!detail) notFound();
  const timelineEvents = await getCustomerTimeline(id);

  // 最近見た顧客（第36章）に記録する。表示をブロックしないよう待たない。
  void recordCustomerView(id);

  const { customer, visits, bottles, champagnes, notes, cautionRegisteredByName } = detail;
  const pace = computePace(customer);

  return (
    <AppShell title="顧客詳細" staffName={profile.display_name} role={profile.role}>
      {visitSaved === "1" && (
        <div className="mb-4 rounded-app border-2 border-success bg-success/10 p-4">
          <p className="font-black text-success mb-1">✓ 来店を保存しました</p>
          <p className="text-sm text-navy/60">
            この来店でボトルを追加しますか？下の「ボトル追加」からすぐに登録できます。
          </p>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 基本情報 */}
        <Card>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h1 className="text-2xl font-black text-navy">{customer.display_name}</h1>
            <FavoriteToggle customerId={customer.id} favorite={customer.favorite} size={24} />
            {customer.caution_level === "banned" && (
              <span className="text-xs font-bold text-white bg-danger rounded-full px-2.5 py-1">
                ⛔ 出禁
              </span>
            )}
            {customer.caution_level === "caution" && (
              <span className="text-xs font-bold text-white bg-warn rounded-full px-2.5 py-1">
                ⚠️ 注意
              </span>
            )}
          </div>
          {customer.hidden && (
            <p className="text-xs font-bold text-white bg-navy/60 rounded-app px-2 py-1 mb-2 inline-block">
              この顧客は無効化されています
            </p>
          )}
          <div className="flex items-center gap-3 mb-2">
            <a href={`/customers/${customer.id}/edit`} className="text-xs text-info underline">
              編集
            </a>
            <HideCustomerButton customerId={customer.id} hidden={customer.hidden} />
          </div>
          <div className="flex items-center gap-2 mb-4">
            {profile.role === "admin" ? (
              <RankSelector customerId={customer.id} currentRank={customer.rank} />
            ) : (
              <RankBadge rank={customer.rank} />
            )}
            {pace.label !== "-" && (
              <span className="text-xs font-bold text-navy/50 bg-navy/5 rounded-full px-2.5 py-1">
                {pace.label}ペース
              </span>
            )}
            {customer.kana && <span className="text-navy/40 text-sm">{customer.kana}</span>}
          </div>

          <dl className="grid grid-cols-2 gap-y-3 text-sm mb-4">
            <dt className="text-navy/50">累計来店</dt>
            <dd className="font-black text-lg text-right">{customer.visit_count}回</dd>
            <dt className="text-navy/50">今月来店</dt>
            <dd className="font-black text-lg text-right">{customer.month_visit_count}回</dd>
            <dt className="text-navy/50">最終来店</dt>
            <dd className="font-bold text-right">
              {customer.last_visit_at ? `${daysSince(customer.last_visit_at)}日前` : "-"}
            </dd>
            <dt className="text-navy/50">累計売上</dt>
            <dd className="font-black text-right">{yen(customer.total_amount)}</dd>
            <dt className="text-navy/50">今月売上</dt>
            <dd className="font-bold text-right">{yen(customer.month_amount)}</dd>
            <dt className="text-navy/50">累計チップ</dt>
            <dd className="font-black text-right">{yen(customer.total_tip)}</dd>
            <dt className="text-navy/50">今月チップ</dt>
            <dd className="font-bold text-right">{yen(customer.month_tip)}</dd>
          </dl>

          {customer.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {customer.tags.map((t) => (
                <span
                  key={t.id}
                  className="text-xs font-bold text-navy/60 bg-navy/5 rounded-full px-2.5 py-1"
                >
                  {t.name}
                </span>
              ))}
            </div>
          )}

          {customer.memo && (
            <p className="text-sm text-navy/60 bg-beige rounded-app p-3 mb-4 whitespace-pre-wrap">
              {customer.memo}
            </p>
          )}

          <div className="mb-4">
            <CautionToggle
              customerId={customer.id}
              level={customer.caution_level}
              reason={customer.caution_reason}
              registeredAt={customer.caution_registered_at}
              registeredByName={cautionRegisteredByName}
            />
          </div>

          <div className="flex gap-2">
            <LinkButton href={`/visits/new?customer=${customer.id}`} variant="gold" fullWidth>
              来店
            </LinkButton>
            <LinkButton href={`/reservations?customer=${customer.id}`} variant="navy" fullWidth>
              予約
            </LinkButton>
          </div>
        </Card>

        {/* 来店履歴 */}
        <Card>
          <CardTitle>来店履歴</CardTitle>
          {visits.length === 0 && (
            <p className="text-navy/40 text-sm">来店履歴はまだありません。</p>
          )}
          <ul className="flex flex-col gap-3 max-h-[420px] overflow-y-auto">
            {visits.map((v) => (
              <li key={v.id} className="border-b border-navy/5 pb-3 last:border-0">
                <div className="flex justify-between text-sm font-bold text-navy">
                  <span>{formatDateTime(v.visited_at)}</span>
                  <span>{v.role === "primary" ? yen(v.amount) : "同伴"}</span>
                </div>
                {v.role === "companion" && v.companionOfName && (
                  <p className="text-xs font-bold text-info">
                    代表者：{v.companionOfName}様の同伴
                  </p>
                )}
                {v.role === "primary" && v.companionNames.length > 0 && (
                  <p className="text-xs text-navy/50">
                    同伴：{v.companionNames.join("、")}
                  </p>
                )}
                <div className="flex justify-between text-xs text-navy/50 mt-0.5">
                  <span>
                    Tip {yen(v.tip)}・{PAYMENT_LABEL[v.payment_method]}
                    {v.seat_type ? `・${v.seat_type === "counter" ? "カウンター" : "BOX"}` : ""}
                  </span>
                  <span>{v.people_count}名</span>
                </div>
                {v.memo && (
                  <p className="text-xs text-navy/50 mt-1 whitespace-pre-wrap">{v.memo}</p>
                )}
              </li>
            ))}
          </ul>
        </Card>

        {/* ボトル + メモ履歴 */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle>ボトル</CardTitle>
            {bottles.length === 0 && (
              <p className="text-navy/40 text-sm">登録されたボトルはありません。</p>
            )}
            <ul className="flex flex-col gap-2">
              {bottles.map((b) => (
                <li key={b.id} className="flex items-center justify-between gap-2 border-b border-navy/5 pb-2 last:border-0">
                  <div className="min-w-0">
                    <p className="font-bold text-navy truncate">
                      {b.bottle_type && <span>{b.bottle_type}</span>}
                      {b.bottle_type && b.bottle_name && b.bottle_name !== b.bottle_type && (
                        <span className="text-navy/40 font-normal">（{b.bottle_name}）</span>
                      )}
                      {!b.bottle_type && b.bottle_name}
                      {b.quantity > 1 && (
                        <span className="text-navy/40 font-normal text-xs ml-1">×{b.quantity}</span>
                      )}
                    </p>
                    <p className="text-xs text-navy/40">
                      期限 {b.status === "kept" ? formatDate(b.expiry_date) : "対象外"}
                    </p>
                    {b.memo && <p className="text-xs text-navy/30">{b.memo}</p>}
                  </div>
                  <BottleStatusBadge bottle={b} />
                </li>
              ))}
            </ul>
            <p className="text-xs text-navy/30 mt-1">
              期限変更・状態変更は<a href="/bottles" className="underline">ボトル管理</a>から行えます。
            </p>
            <BottleAddForm customerId={customer.id} autoOpen={visitSaved === "1"} />
          </Card>

          {champagnes.length > 0 && (
            <Card>
              <CardTitle>シャンパン</CardTitle>
              <ul className="flex flex-col gap-2">
                {champagnes.map((c) => (
                  <li key={c.id} className="border-b border-navy/5 pb-2 last:border-0">
                    <p className="font-bold text-navy">
                      {c.name}
                      {c.quantity > 1 && (
                        <span className="text-navy/40 font-normal text-xs ml-1">×{c.quantity}</span>
                      )}
                    </p>
                    <p className="text-xs text-navy/40">{formatDate(c.created_at)}</p>
                    {c.memo && <p className="text-xs text-navy/30">{c.memo}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardTitle>メモ履歴</CardTitle>
            {notes.length === 0 && (
              <p className="text-navy/40 text-sm">メモはまだありません。</p>
            )}
            <ul className="flex flex-col gap-2 max-h-52 overflow-y-auto">
              {notes.map((n) => (
                <li key={n.id} className="text-sm border-b border-navy/5 pb-2 last:border-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-navy/40 text-xs mb-0.5">
                      {formatDateTime(n.created_at)}
                      {n.authorName ? `・${n.authorName}` : ""}
                    </p>
                    {profile.role === "admin" && (
                      <InvalidateNoteButton noteId={n.id} customerId={customer.id} />
                    )}
                  </div>
                  <p className="text-navy whitespace-pre-wrap">{n.note}</p>
                </li>
              ))}
            </ul>
            <NoteForm customerId={customer.id} />
          </Card>
        </div>
      </div>

      <div className="mt-4">
        <CustomerTimeline events={timelineEvents} />
      </div>
    </AppShell>
  );
}
