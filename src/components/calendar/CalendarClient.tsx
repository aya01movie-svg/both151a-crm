"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, History } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/Card";
import { yen } from "@/lib/date";
import type { CalendarMonthData } from "@/lib/data/calendar";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

const STATUS_LABEL: Record<string, string> = {
  reserved: "予約中",
  visited: "来店済み",
};

function calendarLink(year: number, month: number): string {
  return `/calendar?year=${year}&month=${month}`;
}

export function CalendarClient({ data }: { data: CalendarMonthData }) {
  const { year, month, days } = data;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;

  const [selectedDate, setSelectedDate] = useState<string | null>(
    year === today.getFullYear() && month === today.getMonth() + 1 ? todayStr : null
  );

  const firstDay = new Date(year, month - 1, 1);
  const startWeekday = firstDay.getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const prevMonthDate = new Date(year, month - 2, 1);
  const nextMonthDate = new Date(year, month, 1);
  const lastYearDate = new Date(year - 1, month - 1, 1);

  const cells: (string | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }

  const selectedDay = selectedDate ? days[selectedDate] : null;

  return (
    <div>
      {/* ナビゲーション */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={calendarLink(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1)}
            className="btn-base px-3 min-h-11 bg-white border-2 border-navy/10 text-navy"
          >
            <ChevronLeft size={20} />
          </Link>
          <h2 className="text-xl font-black text-navy w-36 text-center">
            {year}年{month}月
          </h2>
          <Link
            href={calendarLink(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1)}
            className="btn-base px-3 min-h-11 bg-white border-2 border-navy/10 text-navy"
          >
            <ChevronRight size={20} />
          </Link>
        </div>
        <div className="flex gap-2">
          <Link
            href={calendarLink(lastYearDate.getFullYear(), lastYearDate.getMonth() + 1)}
            className="btn-base px-3 min-h-11 bg-white border-2 border-navy/10 text-navy text-sm font-bold gap-1.5"
          >
            <History size={16} />去年
          </Link>
          <Link
            href={calendarLink(today.getFullYear(), today.getMonth() + 1)}
            className="btn-base px-4 min-h-11 bg-gold text-navy font-bold text-sm"
          >
            今日へ
          </Link>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <Card className="mb-4 p-3">
        {/* 曜日ヘッダー */}
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={`text-center text-xs font-bold py-1 ${
                i === 0 ? "text-danger" : i === 6 ? "text-info" : "text-navy/40"
              }`}
            >
              {w}
            </div>
          ))}
        </div>

        {/* 日付グリッド */}
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((dateStr, idx) => {
            if (!dateStr) return <div key={`empty-${idx}`} />;
            const [dy, dm, dd] = dateStr.split("-").map(Number);
            const dayOfWeek = new Date(dy, dm - 1, dd).getDay();
            const isSunday   = dayOfWeek === 0;
            const isSaturday = dayOfWeek === 6;
            const isToday    = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const day        = days[dateStr];
            const dayNum     = dd;

            const textColor =
              isSunday || (day?.isHoliday)
                ? "text-danger font-black"
                : isSaturday
                ? "text-info font-black"
                : "text-navy/70";

            const bgClass = isSelected
              ? "border-gold bg-gold/20"
              : isToday
              ? "border-navy bg-white"
              : day?.isClosedDay
              ? "border-danger/20 bg-[#fff0f0]"
              : "border-navy/5 bg-white hover:border-navy/20";

            const eventsList = day?.events || [];
            const hasContent =
              (day?.visits?.length ?? 0) > 0 ||
              (day?.reservations?.length ?? 0) > 0 ||
              (day?.birthdays?.length ?? 0) > 0 ||
              eventsList.some(ev => ev.title.includes("🚫")) ||
              day?.isHoliday ||
              day?.isClosedDay;

            return (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}
                className={`text-left rounded-app border-2 p-1.5 flex flex-col items-center min-h-[72px] transition-colors ${bgClass}`}
              >
                {/* 日付数字を大きく太字にし上部へ固定 */}
                <span className={`text-xl font-black w-full text-center mb-1 leading-none ${textColor}${isToday ? " bg-navy/10 rounded-full" : ""}`}>
                  {dayNum}
                </span>
                <div className="w-full flex flex-col gap-0.5 items-center">
                  {day?.isClosedDay && (
                    <span className="text-xs font-bold text-danger">休</span>
                  )}
                  {day?.isHoliday && !day?.isClosedDay && (
                    <span className="text-xs font-bold text-danger/70">祝</span>
                  )}
                  {/* スタッフ休み(🚫)のみ表示 */}
                  {eventsList.filter(ev => ev.title.includes("🚫")).map((ev) => (
                    <span key={ev.id} className="text-[11px] font-black leading-tight text-navy truncate w-full text-center">{ev.title}</span>
                  ))}
                  {(day?.visits?.length ?? 0) > 0 && (
                    <span className="text-xs font-black text-success">来{day?.visits?.length}</span>
                  )}
                  {(day?.reservations?.length ?? 0) > 0 && (
                    <span className="text-xs font-black text-info">予{day?.reservations?.length}</span>
                  )}
                  {(day?.birthdays?.length ?? 0) > 0 && (
                    <span className="text-xs font-black text-[#7a4fa3]">誕</span>
                  )}
                  {!hasContent && <span className="text-[10px] text-navy/20">-</span>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

      {/* 選択日の詳細 */}
      {selectedDay && (
        <div className="flex flex-col gap-4">
          <Card>
            <CardTitle className="text-lg">
              {selectedDate?.replace(/-/g, "/")} の詳細
            </CardTitle>

            {/* 来店一覧 */}
            <p className="text-xs font-bold text-navy/50 mb-2">来店</p>
            {selectedDay.visits.length === 0 && (
              <p className="text-navy/40 text-base mb-3">来店はありません。</p>
            )}
            <ul className="flex flex-col gap-2 mb-4">
              {selectedDay.visits.map((v) => (
                <li key={v.id} className="rounded-app bg-navy/3 border border-navy/5 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-navy text-base">
                      {v.hasChampagne && <span className="mr-1">🍾</span>}
                      {v.customerName}
                    </p>
                    <p className="text-sm font-bold text-navy/60">{yen(v.amount)}</p>
                  </div>
                  <p className="text-xs text-navy/40 mt-0.5">{v.time}</p>
                  {v.companionNames.length > 0 && (
                    <p className="text-xs text-navy/40 mt-0.5">同伴：{v.companionNames.join("、")}</p>
                  )}
                </li>
              ))}
            </ul>

            {/* 予約一覧 */}
            <p className="text-xs font-bold text-navy/50 mb-2">予約</p>
            {selectedDay.reservations.length === 0 && (
              <p className="text-navy/40 text-base mb-3">予約はありません。</p>
            )}
            <ul className="flex flex-col gap-2 mb-4">
              {selectedDay.reservations.map((r) => (
                <li key={r.id} className="rounded-app bg-info/5 border border-info/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-black text-navy text-base">{r.customerName}</p>
                    <span className="text-xs text-info font-bold">{STATUS_LABEL[r.status] ?? r.status}</span>
                  </div>
                  <p className="text-xs text-navy/40 mt-0.5">{r.time}</p>
                  {r.companionNames.length > 0 && (
                    <p className="text-xs text-navy/40">同伴：{r.companionNames.join("、")}</p>
                  )}
                  {r.memo && <p className="text-xs text-navy/40">メモ：{r.memo}</p>}
                </li>
              ))}
            </ul>

            {/* 誕生日 */}
            {selectedDay.birthdays.length > 0 && (
              <>
                <p className="text-xs font-bold text-navy/50 mb-2">誕生日</p>
                <ul className="flex flex-col gap-1.5 mb-4">
                  {selectedDay.birthdays.map((b) => (
                    <li key={b.id} className="text-base font-bold text-[#7a4fa3]">
                      🎂 {b.customerName}
                    </li>
                  ))}
                </ul>
              </>
            )}

            {/* イベント・休日 (詳細欄では店イベ等も全て表示します) */}
            {(selectedDay.isHoliday || selectedDay.isClosedDay || selectedDay.events.length > 0) && (
              <>
                <p className="text-xs font-bold text-navy/50 mb-2">イベント・休日</p>
                <ul className="flex flex-col gap-1.5">
                  {selectedDay.isClosedDay && (
                    <li className="text-base font-bold text-danger">
                      🎌 店休日{selectedDay.closedNote ? ` - ${selectedDay.closedNote}` : ""}
                    </li>
                  )}
                  {selectedDay.isHoliday && (
                    <li className="text-base font-bold text-danger/80">
                      ㊗️ {selectedDay.holidayName}（祝日）
                    </li>
                  )}
                  {selectedDay.events.map((ev) => (
                    <li key={ev.id} className="text-base text-navy">
                      {ev.emoji} {ev.title}
                      {ev.url && (
                        <a href={ev.url} target="_blank" rel="noopener noreferrer"
                           className="text-xs text-info underline ml-2">
                          🔗 詳細
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}