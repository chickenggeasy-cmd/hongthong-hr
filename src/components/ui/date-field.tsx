"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { FloatingPanel, useDismiss, useFloatingPosition } from "./floating";
import { bangkokToday, isSunday, isValidDateOnly, type DateOnly } from "@/lib/date";
import {
  initialMonth,
  isSelectable,
  monthGrid,
  monthTitle,
  moveFocus,
  shiftMonth,
  shortThaiDate,
  THAI_WEEKDAYS_SHORT,
} from "@/lib/ui/calendar";

// ช่องเลือกวันที่แบบปฏิทินภาษาไทย (พ.ศ.) แทน <input type="date"> ที่ขึ้น mm/dd/yyyy ตามภาษาเบราว์เซอร์
// ส่งค่าในฟอร์มเป็น YYYY-MM-DD เหมือนเดิม (Server Action ไม่ต้องแก้)
// วันอาทิตย์ = ตัวสีเทา, วันหยุดนักขัตฤกษ์ (ถ้าส่ง holidays มา) = จุดสีแดงใต้วันที่

export function DateField({
  id,
  name,
  value: controlledValue,
  defaultValue,
  onChange,
  min,
  max,
  required = false,
  holidays,
  placeholder = "เลือกวันที่",
  ariaLabel,
  className = "",
}: {
  id?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  min?: DateOnly;
  max?: DateOnly;
  required?: boolean;
  holidays?: ReadonlySet<DateOnly>;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const autoId = useId();
  const buttonId = id ?? `date-${autoId}`;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const value = controlledValue ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const today = useMemo(() => bangkokToday(), []);
  const [month, setMonth] = useState(() => initialMonth(value, today, min));
  const [focusDate, setFocusDate] = useState<DateOnly>(value || today);
  const [slide, setSlide] = useState<"next" | "prev" | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const position = useFloatingPosition(buttonRef, open, { preferredHeight: 392, minWidth: 312 });
  const close = useCallback(() => setOpen(false), []);
  const dismissRefs = useMemo(() => [buttonRef, panelRef], []);
  useDismiss(open, dismissRefs, close);

  const days = useMemo(() => monthGrid(month), [month]);
  const canPrev = !min || shiftMonth(month, -1) >= min.slice(0, 7);
  const canNext = !max || shiftMonth(month, 1) <= max.slice(0, 7);

  const openCalendar = () => {
    const start = initialMonth(value, today, min);
    setMonth(start);
    setSlide(null);
    const focus = isValidDateOnly(value) ? value : isSelectable(today, min, max) ? today : (min ?? today);
    setFocusDate(focus);
    setOpen(true);
    // โฟกัสวันที่ในปฏิทินหลังวาดเสร็จ (ใช้คีย์บอร์ดเลือกต่อได้ทันที)
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${focus}"]`)?.focus());
  };

  const goMonth = (delta: number) => {
    setSlide(delta > 0 ? "next" : "prev");
    setMonth((m) => shiftMonth(m, delta));
  };

  const choose = (date: DateOnly) => {
    if (!isSelectable(date, min, max)) return;
    if (controlledValue === undefined) setUncontrolled(date);
    onChange?.(date);
    setInvalid(false);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const clear = () => {
    if (controlledValue === undefined) setUncontrolled("");
    onChange?.("");
  };

  const onGridKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!event.key.startsWith("Arrow")) return;
    event.preventDefault();
    const next = moveFocus(focusDate, event.key, min, max);
    setFocusDate(next);
    if (next.slice(0, 7) !== month) goMonth(next > focusDate ? 1 : -1);
    requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());
  };

  const display = isValidDateOnly(value) ? shortThaiDate(value) : "";

  return (
    <div className="relative">
      {/* ช่องจริงที่ส่งไปกับฟอร์ม: ซ่อนแต่ยังให้เบราว์เซอร์ตรวจ required ได้ (type=hidden ตรวจไม่ได้) */}
      {name ? (
        <input
          tabIndex={-1}
          aria-hidden
          name={name}
          value={value}
          required={required}
          onChange={() => undefined}
          onInvalid={(event) => {
            event.preventDefault();
            setInvalid(true);
            buttonRef.current?.focus();
          }}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      ) : null}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={ariaLabel ? `${ariaLabel}${display ? ` ${display}` : ""}` : undefined}
        onClick={() => (open ? setOpen(false) : openCalendar())}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" && !open) {
            event.preventDefault();
            openCalendar();
          }
        }}
        className={`ht-input group flex w-full items-center gap-2.5 text-left ${
          open ? "border-[#1E5FA8]/60 bg-white shadow-[0_0_0_4px_rgb(30_95_168/0.12)]" : ""
        } ${invalid ? "border-[#D64545]/60 shadow-[0_0_0_4px_rgb(214_69_69/0.1)]" : ""} ${className}`}
      >
        <CalendarDays
          className={`h-[18px] w-[18px] shrink-0 transition-colors ${open || display ? "text-[#1E5FA8]" : "text-[#5B6B7B] group-hover:text-[#1E5FA8]"}`}
          aria-hidden
        />
        <span className={`min-w-0 flex-1 truncate ${display ? "text-[#1A1A1A]" : "text-[#5B6B7B]"}`}>{display || placeholder}</span>
        {display && !required ? (
          <span
            role="button"
            tabIndex={-1}
            aria-label="ล้างวันที่"
            onClick={(event) => {
              event.stopPropagation();
              clear();
            }}
            className="-m-1 flex h-7 w-7 items-center justify-center rounded-lg text-[#5B6B7B] hover:bg-[#EAF3FC]"
          >
            <X className="h-4 w-4" aria-hidden />
          </span>
        ) : null}
      </button>
      {invalid ? <p className="mt-1 text-xs text-[#D64545]">กรุณาเลือกวันที่</p> : null}

      {position ? (
        <FloatingPanel position={position} panelRef={panelRef} role="dialog" label={ariaLabel ?? "เลือกวันที่"} className="p-3">
          <div className="flex items-center justify-between gap-2 px-1 pb-2">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              disabled={!canPrev}
              aria-label="เดือนก่อนหน้า"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#0F2D52] transition-colors hover:bg-[#EAF3FC] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <p key={month} className="ht-fade text-[15px] font-bold text-[#0F2D52]" aria-live="polite">
              {monthTitle(month)}
            </p>
            <button
              type="button"
              onClick={() => goMonth(1)}
              disabled={!canNext}
              aria-label="เดือนถัดไป"
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[#0F2D52] transition-colors hover:bg-[#EAF3FC] disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="grid grid-cols-7 pb-1 text-center text-xs font-medium text-[#5B6B7B]">
            {THAI_WEEKDAYS_SHORT.map((d, i) => (
              <span key={d} className={i === 0 ? "text-[#D64545]/70" : ""}>
                {d}
              </span>
            ))}
          </div>

          <div
            ref={gridRef}
            key={month}
            role="grid"
            onKeyDown={onGridKey}
            className={`grid grid-cols-7 gap-0.5 ${slide === "next" ? "ht-slide-next" : slide === "prev" ? "ht-slide-prev" : ""}`}
          >
            {days.map(({ date, inMonth }) => {
              const selectable = isSelectable(date, min, max);
              const selected = date === value;
              const isToday = date === today;
              const holiday = holidays?.has(date);
              const sunday = isSunday(date);
              return (
                <button
                  key={date}
                  type="button"
                  data-date={date}
                  tabIndex={date === focusDate ? 0 : -1}
                  disabled={!selectable}
                  aria-pressed={selected}
                  aria-label={`${shortThaiDate(date)}${holiday ? " วันหยุด" : ""}`}
                  onClick={() => choose(date)}
                  className={`relative flex h-10 items-center justify-center rounded-xl text-sm tabular-nums outline-none transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[#1E5FA8]/50 ${
                    selected
                      ? "bg-gradient-to-br from-[#2A6FBF] to-[#164A85] font-bold text-white shadow-[0_6px_14px_-6px_rgb(30_95_168/0.8)]"
                      : selectable
                        ? `hover:bg-[#EAF3FC] active:scale-95 ${inMonth ? (sunday ? "text-[#5B6B7B]" : "text-[#1A1A1A]") : "text-[#5B6B7B]/50"}`
                        : "cursor-not-allowed text-[#5B6B7B]/30"
                  } ${isToday && !selected ? "font-bold text-[#1E5FA8] ring-1 ring-inset ring-[#1E5FA8]/40" : ""}`}
                >
                  {Number(date.slice(8))}
                  {holiday ? (
                    <span className={`absolute bottom-1 h-1 w-1 rounded-full ${selected ? "bg-white" : "bg-[#D64545]"}`} aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[#1E5FA8]/10 px-1 pt-2 text-xs text-[#5B6B7B]">
            <span className="flex items-center gap-1.5">
              {holidays?.size ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-[#D64545]" aria-hidden /> วันหยุดบริษัท
                </>
              ) : null}
            </span>
            {isSelectable(today, min, max) ? (
              <button type="button" onClick={() => choose(today)} className="rounded-lg px-2.5 py-1.5 font-medium text-[#1E5FA8] hover:bg-[#EAF3FC]">
                วันนี้
              </button>
            ) : null}
          </div>
        </FloatingPanel>
      ) : null}
    </div>
  );
}
