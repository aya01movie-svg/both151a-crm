"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { yen } from "@/lib/date";
import type { CalendarMonthData } from "@/lib/data/calendar";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const STATUS_LABEL: Record<string, string> = {
  reserved: "予約中",
  visited:  "来店済み",
};

function calLink(y: number, m: number) {
  return `/dashboard?year=${y}&month=${m}`;
}

const YEAR_RANGE_START = 2020;

export function CalendarClient({ data }: { data: CalendarMonthData }) {
  const { year, month, days } = data;
  const today    = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
  const thisYear = today.getFullYear();

  const [selectedDate, setSelectedDate] = useState<string | null>(
    year === today.getFullYear() && month === today.getMonth()+1 ? todayStr : null
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickYear, setPickYear] = useState(year);

  const startWeekday = new Date(year, month-1, 1).getDay();
  const daysInMonth  = new Date(year, month, 0).getDate();
  const prev = new Date(year, month-2, 1);
  const next = new Date(year, month, 1);
  const isCurrentMonth = year === thisYear && month === today.getMonth()+1;
  const yearOptions: number[] = [];
  for (let y = YEAR_RANGE_START; y <= thisYear; y++) yearOptions.push(y);

  const cells: (string|null)[] = [];
  for (let i=0; i<startWeekday; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2,"0")}-${String(d).padStart(2,"0")}`);
  }

  const selectedDay = selectedDate ? days[selectedDate] : null;

  return (
    <div>
      {/* ── 月ナビ ─────────────────────── */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <Link href={calLink(prev.getFullYear(), prev.getMonth()+1)}
              className="btn-base px-3 min-h-10 bg-white border-2 border-navy/10 text-navy shrink-0">
          <ChevronLeft size={20} />
        </Link>

        <button type="button"
          onClick={() => { setPickYear(year); setPickerOpen(true); }}
          className="text-xl font-black text-navy px-2 py-1 rounded-app hover:bg-navy/5">
          {year}年{month}月
        </button>

        <div className="flex items-center gap-2 shrink-0">
          {!isCurrentMonth && (
            <Link href={calLink(thisYear, today.getMonth()+1)}
                  className="btn-base px-3 min-h-10 bg-navy/5 border-2 border-navy/10 text-navy text-sm font-bold">
              今月
            </Link>
          )}
          <Link href={calLink(next.getFullYear(), next.getMonth()+1)}
                className="btn-base px-3 min-h-10 bg-white border-2 border-navy/10 text-navy">
            <ChevronRight size={20} />
          </Link>
        </div>
      </div>

      {/* ── 年月選択ポップアップ ─────────── */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-4"
             onClick={() => setPickerOpen(false)}>
          <div className="w-full max-w-sm rounded-app bg-white p-4 max-h-[80vh] overflow-y-auto"
               onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-base font-black text-navy">年月を選択</p>
              <button type="button" onClick={() => setPickerOpen(false)}
                className="text-navy/40 text-sm font-bold px-2 py-1">✕</button>
            </div>

            {/* 年選択 */}
            <div className="flex flex-wrap gap-1.5 mb-4">
              {yearOptions.map((y) => (
                <button key={y} type="button"
                  onClick={() => setPickYear(y)}
                  className={`px-3 py-1.5 rounded-app text-sm font-bold border-2 ${
                    y===pickYear ? "bg-navy text-white border-navy" : "border-navy/10 text-navy/60"
                  }`}>
                  {y}年
                </button>
              ))}
            </div>

            {/* 月選択 */}
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {Array.from({length:12},(_,i)=>i+1).map((m) => (
                <Link key={m} href={calLink(pickYear, m)}
                  onClick={() => setPickerOpen(false)}
                  className={`text-center py-2.5 rounded-app text-sm font-bold border-2 ${
                    pickYear===year && m===month ? "bg-gold text-navy border-gold" : "border-navy/10 text-navy/70"
                  }`}>
                  {m}月
                </Link>
              ))}
            </div>

            <Link href={calLink(thisYear, today.getMonth()+1)}
              onClick={() => setPickerOpen(false)}
              className="btn-base min-h-11 w-full bg-navy/5 border-2 border-navy/10 text-navy text-sm font-bold">
              今月に戻る
            </Link>
          </div>
        </div>
      )}

      {/* ── カレンダーグリッド ─────────── */}
      <Card className="mb-4 p-2">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div key={w} className={`text-center text-sm font-bold py-1 ${
              i===0 ? "text-danger" : i===6 ? "text-info" : "text-navy/40"
            }`}>{w}</div>
          ))}
        </div>

        {/* 日付マス */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((dateStr, idx) => {
            if (!dateStr) return <div key={`e${idx}`} />;
            const [dy,dm,dd] = dateStr.split("-").map(Number);
            const dow      = new Date(dy,dm-1,dd).getDay();
            const isSun    = dow===0;
            const isSat    = dow===6;
            const isToday  = dateStr===todayStr;
            const isSel    = dateStr===selectedDate;
            const day      = days[dateStr];

            const numColor = isSun||(day?.isHoliday) ? "text-danger" : isSat ? "text-info" : "text-navy";

            const bg = isSel
              ? "border-gold bg-gold/20"
              : isToday
              ? "border-navy/60 bg-navy/5"
              : day?.isClosedDay
              ? "border-danger/20 bg-[#fff0f0]"
              : "border-navy/5 bg-white";

            // カレンダーに表示するのは: 来店・予約・誕生日・店休日・祝日のみ
            // 一般イベントは表示しない
            const hasVisit      = (day?.visits.length ?? 0) > 0;
            const hasRes        = (day?.reservations.length ?? 0) > 0;
            const hasBirthday   = (day?.birthdays.length ?? 0) > 0;
            const hasStaffClose = day?.isClosedDay;
            const hasHoliday    = day?.isHoliday && !day.isClosedDay;
            const hasStaff      = (day?.staffEvents.length ?? 0) > 0;
            const hasContent    = hasVisit || hasRes || hasBirthday || hasStaffClose || hasHoliday || hasStaff;

            return (
              <button key={dateStr} type="button"
                onClick={() => setSelectedDate(dateStr===selectedDate ? null : dateStr)}
                className={`flex flex-col items-stretch text-left rounded border-2 p-0.5 min-h-[72px] transition-colors hover:border-gold/60 ${bg}`}
              >
                {/* 日付数字 — 予定の有無に関わらず常にマス上部へ固定表示する。
                    flex-col + shrink-0 で明示的に高さを固定し、インジケーターの
                    数が増減しても数字の位置がずれないようにする。 */}
                <span className={`block shrink-0 text-xl font-black leading-tight text-center ${numColor}${isToday ? " underline decoration-2" : ""}`}>
                  {dd}
                </span>
                {/* インジケーター — 来店・予約・誕生日・スタッフ休みのみ（一般イベント・祝日バッジは表示しない） */}
                <div className="flex flex-col items-center gap-0.5 mt-0.5">
                  {hasStaffClose && <span className="text-xs font-black text-danger leading-none">休</span>}
                  {hasStaff     && day.staffEvents.slice(0,2).map(s => (
                    <span key={s.id} className="text-sm leading-none">{s.emoji}</span>
                  ))}
                  {hasVisit     && <span className="text-xs font-black text-success leading-none">来{day.visits.length}</span>}
                  {hasRes       && <span className="text-xs font-black text-info leading-none">予{day.reservations.length}</span>}
                  {hasBirthday  && <span className="text-sm leading-none">🎂</span>}
                  {!hasContent  && <span className="text-[9px] text-navy/15 leading-none">–</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ── 選択日の詳細 ─────────────────── */}
      {selectedDay && (
        <Card>
          <CardTitle className="text-base mb-3">
            {selectedDate?.replace(/-/g,"/")} の詳細
          </CardTitle>

          {/* 来店 */}
          {selectedDay.visits.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-success mb-2">来店</p>
              <ul className="flex flex-col gap-2">
                {selectedDay.visits.map((v) => (
                  <li key={v.id} className="rounded-app border border-success/20 bg-success/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/customers/${v.customerId}`}
                            className="font-black text-navy text-lg underline decoration-navy/20 hover:decoration-navy">
                        {v.hasChampagne && <span className="mr-1">🍾</span>}
                        {v.customerName}
                      </Link>
                      <p className="text-base font-black text-navy">{yen(v.amount)}</p>
                    </div>
                    {v.companionNames.length > 0 && (
                      <p className="text-sm font-bold text-navy/60 mt-1">
                        同伴：{v.companionNames.join("、")}
                      </p>
                    )}
                    <div className="mt-1.5">
                      <Link href={`/visits/${v.id}/edit`} className="text-xs text-info underline">
                        この来店を修正
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 予約 */}
          {selectedDay.reservations.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-black text-info mb-2">予約</p>
              <ul className="flex flex-col gap-2">
                {selectedDay.reservations.map((r) => (
                  <li key={r.id} className="rounded-app border border-info/20 bg-info/5 px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <Link href={`/customers/${r.customerId}`}
                            className="font-black text-navy text-lg underline decoration-navy/20 hover:decoration-navy">
                        {r.customerName}
                      </Link>
                      <span className="text-sm font-bold text-info">{STATUS_LABEL[r.status]??r.status}</span>
                    </div>
                    {r.companionNames.length>0 && (
                      <p className="text-sm font-bold text-navy/60 mt-1">同伴：{r.companionNames.join("、")}</p>
                    )}
                    {r.memo && <p className="text-xs text-navy/40 mt-1">メモ：{r.memo}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 誕生日 */}
          {selectedDay.birthdays.length > 0 && (
            <div className="mb-3">
              <p className="text-xs font-black text-[#7a4fa3] mb-2">誕生日</p>
              <ul className="flex flex-col gap-1.5">
                {selectedDay.birthdays.map((b) => (
                  <li key={b.id} className="text-base font-black text-[#7a4fa3]">
                    🎂 <Link href={`/customers/${b.customerId}`} className="underline decoration-[#7a4fa3]/30 hover:decoration-[#7a4fa3]">
                      {b.customerName}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 店休日・祝日・スタッフ欠席 */}
          {(selectedDay.isHoliday || selectedDay.isClosedDay || selectedDay.staffEvents.length > 0) && (
            <div>
              <p className="text-xs font-black text-danger mb-2">休日・スタッフ</p>
              <ul className="flex flex-col gap-1.5">
                {selectedDay.isClosedDay && (
                  <li className="text-base font-black text-danger">
                    🚫 店休日{selectedDay.closedNote ? ` — ${selectedDay.closedNote}` : ""}
                  </li>
                )}
                {selectedDay.isHoliday && !selectedDay.isClosedDay && (
                  <li className="text-base font-black text-danger/80">
                    🔴 {selectedDay.holidayName}（祝日）
                  </li>
                )}
                {selectedDay.staffEvents.map((s) => (
                  <li key={s.id} className="text-base font-bold text-navy/70 flex items-center gap-0.5">
                    <span>{s.emoji}</span>
                    {s.url ? (
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline text-danger">{s.title}</a>
                    ) : (
                      <span className="text-danger">{s.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}