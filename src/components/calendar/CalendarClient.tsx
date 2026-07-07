// 上部ナビゲーション以降の月合計2マスを削除し、グリッド部分の修正を行います（抜粋）
// ※ 113行目付近の <div className="grid grid-cols-2 gap-3 mb-4">...</div> を丸ごと削除してください。

// 151行目付近の map のリターン部分を以下に置き換えます
            const hasContent =
              (day?.visits.length ?? 0) > 0 ||
              (day?.reservations.length ?? 0) > 0 ||
              (day?.birthdays.length ?? 0) > 0 ||
              (day?.events.some(ev => ev.title.includes("🚫"))) ||
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
                  {day?.events.filter(ev => ev.title.includes("🚫")).map((ev) => (
                    <span key={ev.id} className="text-[11px] font-black leading-tight text-navy truncate w-full text-center">{ev.title}</span>
                  ))}
                  {(day?.visits.length ?? 0) > 0 && (
                    <span className="text-xs font-black text-success">来{day!.visits.length}</span>
                  )}
                  {(day?.reservations.length ?? 0) > 0 && (
                    <span className="text-xs font-black text-info">予{day!.reservations.length}</span>
                  )}
                  {(day?.birthdays.length ?? 0) > 0 && (
                    <span className="text-xs font-black text-[#7a4fa3]">誕</span>
                  )}
                  {!hasContent && <span className="text-[10px] text-navy/20">-</span>}
                </div>
              </button>
            );