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
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={calendarLink(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1)}
            className="btn-base px-3 min-h-10 bg-white border-2 border-navy/10 text-navy"
          >
            <ChevronLeft size={18} />
          </Link>
          <h2 className="text-lg font-black text-navy w-32 text-center">
            {year}年{month}月
          </h2>
          <Link
            href={calendarLink(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1)}
            className="btn-base px-3 min-h-10 bg-white border-2 border-navy/10 text-navy"
          >
            <ChevronRight size={18} />
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={calendarLink(lastYearDate.getFullYear(), lastYearDate.getMonth() + 1)}
            className="btn-base px-3 min-h-10 bg-white border-2 border-navy/10 text-navy text-sm inline-flex items-center gap-1"
          >
            <History size={16} /> 去年
          </Link>
          <Link
            href={calendarLink(today.getFullYear(), today.getMonth() + 1)}
            className="btn-base px-3 min-h-10 bg-gold text-navy-dark text-sm"
          >
            今日へ
          </Link>
        </div>
      </div>

      <Card className="mb-4">
        <p className="text-sm text-navy/50">
          今月合計売上 <span className="font-black text-navy">{yen(data.monthTotalAmount)}</span>
          <span className="mx-2">/</span>
          今月合計チップ <span className="font-black text-navy">{yen(data.monthTotalTip)}</span>
        </p>
      </Card>

      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`text-center text-xs font-bold py-1 ${
              i === 0 ? "text-danger" : i === 6 ? "text-info" : "text-navy/50"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((dateStr, i) => {
          if (!dateStr) return <div key={`empty-${i}`} />;
          const day = days[dateStr];
          const dayNum = Number(dateStr.slice(8, 10));
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          const hasContent =
            day.visits.length > 0 ||
            day.reservations.length > 0 ||
            day.birthdays.length > 0 ||
            day.bottleExpiries.length > 0 ||
            day.events.length > 0 ||
            day.isHoliday ||
            day.isClosedDay;

          const [dy, dm, dd] = dateStr.split("-").map(Number);
          const dayOfWeek = new Date(dy, dm - 1, dd).getDay();
          const isSunday = dayOfWeek === 0;
          const isSaturday = dayOfWeek === 6;

          // 曜日色・祝日色は「今日」「選択中」よりも優先して表示する
          // （当日が日曜でも赤、当日が土曜でも青にする）
          const textColorClass =
            isSunday || day.isHoliday
              ? "text-danger font-black"
              : isSaturday
              ? "text-info font-black"
              : isToday
              ? "text-navy"
              : "text-navy/60";

          const dayNumColor = isToday
            ? `${textColorClass} bg-navy/10 rounded-full px-1.5`
            : textColorClass;

          return (
            <button
              key={dateStr}
              type="button"
              onClick={() => setSelectedDate(dateStr)}
              className={`text-left rounded-app border-2 p-1.5 min-h-[70px] transition-colors ${
                isSelected
                  ? "border-gold bg-gold/10"
                  : isToday
                  ? "border-navy bg-white"
                  : day.isClosedDay
                  ? "border-danger/20 bg-[#fff0f0] hover:border-danger/30"
                  : "border-navy/5 bg-white hover:border-navy/20"
              }`}
            >
              <span className={`text-xs ${dayNumColor}`}>
                {dayNum}
              </span>
              <div className="mt-1 flex flex-col gap-0.5">
                {day.isClosedDay && (
                  <span className="text-[10px] font-bold text-danger truncate">🚫休</span>
                )}
                {day.isHoliday && !day.isClosedDay && (
                  <span className="text-[10px] font-bold text-danger/70 truncate">🔴祝</span>
                )}
                {day.events.slice(0, 2).map((ev) => (
                  <span key={ev.id} className="text-[10px] font-bold text-navy/60 truncate">
                    {ev.emoji}
                  </span>
                ))}
                {day.visits.length > 0 && (
                  <span className="text-[10px] font-bold text-success truncate">
                    来{day.visits.length}件
                  </span>
                )}
                {day.reservations.length > 0 && (
                  <span className="text-[10px] font-bold text-info truncate">
                    予{day.reservations.length}件
                  </span>
                )}
                {day.birthdays.length > 0 && (
                  <span className="text-[10px] font-bold text-[#7a4fa3] truncate">
                    🎂{day.birthdays.length}
                  </span>
                )}
                {day.bottleExpiries.length > 0 && (
                  <span className="text-[10px] font-bold text-warn truncate">
                    🍷{day.bottleExpiries.length}
                  </span>
                )}
                {!hasContent && <span className="text-[10px] text-navy/20">-</span>}
              </div>
            </button>
          );
        })}
      </div>

      {selectedDay && (
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardTitle>{selectedDate} の来店</CardTitle>
            {selectedDay.visits.length === 0 && (
              <p className="text-navy/40 text-sm">来店はありません。</p>
            )}
            <ul className="flex flex-col gap-1.5">
              {selectedDay.visits.map((v) => (
                <li key={v.id} className="text-sm border-b border-navy/5 pb-1">
                  <div className="flex justify-between">
                    <span className="font-bold text-navy">
                      {v.time} {v.customerName}
                    </span>
                    <span className="text-navy/50">
                      {yen(v.amount)}（Tip {yen(v.tip)}）
                    </span>
                  </div>
                  {v.companionNames.length > 0 && (
                    <p className="text-xs text-navy/40">同伴：{v.companionNames.join("、")}</p>
                  )}
                </li>
              ))}
            </ul>
            {selectedDay.visits.length > 0 && (
              <p className="text-xs text-navy/40 mt-2">
                合計 {yen(selectedDay.totalAmount)}・チップ {yen(selectedDay.totalTip)}
              </p>
            )}
          </Card>

          <Card>
            <CardTitle>{selectedDate} の予約・誕生日・ボトル期限</CardTitle>
            <p className="text-xs font-bold text-navy/50 mb-1">予約</p>
            {selectedDay.reservations.length === 0 && (
              <p className="text-navy/40 text-sm mb-2">予約はありません。</p>
            )}
            <ul className="flex flex-col gap-1 mb-3">
              {selectedDay.reservations.map((r) => (
                <li key={r.id} className="text-sm mb-1">
                  <div>
                    {r.time} {r.customerName}
                    <span className="text-navy/40 ml-2 text-xs">
                      ({STATUS_LABEL[r.status] ?? r.status})
                    </span>
                  </div>
                  {r.companionNames.length > 0 && (
                    <p className="text-xs text-navy/40">同伴：{r.companionNames.join("、")}</p>
                  )}
                  {r.memo && <p className="text-xs text-navy/40">メモ：{r.memo}</p>}
                </li>
              ))}
            </ul>

            <p className="text-xs font-bold text-navy/50 mb-1">誕生日</p>
            {selectedDay.birthdays.length === 0 && (
              <p className="text-navy/40 text-sm mb-2">対象者はいません。</p>
            )}
            <ul className="flex flex-col gap-1 mb-3">
              {selectedDay.birthdays.map((b) => (
                <li key={b.id} className="text-sm">🎂 {b.customerName}</li>
              ))}
            </ul>

            <p className="text-xs font-bold text-navy/50 mb-1">ボトル期限</p>
            {selectedDay.bottleExpiries.length === 0 && (
              <p className="text-navy/40 text-sm mb-2">対象のボトルはありません。</p>
            )}
            <ul className="flex flex-col gap-1 mb-3">
              {selectedDay.bottleExpiries.map((b) => (
                <li key={b.id} className="text-sm">
                  🍷 {b.customerName}（{b.bottleLabel}）
                </li>
              ))}
            </ul>

            {(selectedDay.isHoliday || selectedDay.isClosedDay || selectedDay.events.length > 0) && (
              <>
                <p className="text-xs font-bold text-navy/50 mb-1">イベント・休日</p>
                <ul className="flex flex-col gap-1.5">
                  {selectedDay.isClosedDay && (
                    <li className="text-sm font-bold text-danger">
                      🚫 店休日{selectedDay.closedNote ? ` — ${selectedDay.closedNote}` : ""}
                    </li>
                  )}
                  {selectedDay.isHoliday && (
                    <li className="text-sm font-bold text-danger/80">
                      🔴 {selectedDay.holidayName}（祝日）
                    </li>
                  )}
                  {selectedDay.events.map((ev) => (
                    <li key={ev.id} className="text-sm text-navy">
                      <p>{ev.emoji} {ev.title}</p>
                      {ev.url && (
                        <a
                          href={ev.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-info underline"
                        >
                          🔗 詳細を見る
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
