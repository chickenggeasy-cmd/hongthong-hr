"use client";

import { useCallback, useId, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import { FloatingPanel, useDismiss, useFloatingPosition } from "./floating";

// ช่องเลือกรายการ (แทน <select> ของเบราว์เซอร์ที่หน้าตาธรรมดาและแต่งไม่ได้)
// ใช้ในฟอร์มได้เหมือน <select>: ส่งค่าผ่าน <input type="hidden" name=...>
// ใช้แบบควบคุมเอง (value + onChange) หรือปล่อยให้จำเอง (defaultValue) ก็ได้
// คีย์บอร์ด: Enter/Space/ลูกศร เปิด · ลูกศรขึ้นลงเลื่อน · Enter เลือก · Esc ปิด · พิมพ์ตัวอักษรเพื่อกระโดดไปรายการ

export type SelectOption = {
  value: string;
  label: string;
  description?: string;
  icon?: ReactNode;
  disabled?: boolean;
};

export function SelectField({
  id,
  name,
  options,
  value: controlledValue,
  defaultValue,
  onChange,
  placeholder = "เลือก…",
  ariaLabel,
  disabled = false,
  required = false,
  className = "",
}: {
  id?: string;
  name?: string;
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const autoId = useId();
  const buttonId = id ?? `select-${autoId}`;
  const listId = `${buttonId}-list`;
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? (required ? "" : (options[0]?.value ?? "")));
  const [invalid, setInvalid] = useState(false);
  const value = controlledValue ?? uncontrolled;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const typeahead = useRef({ text: "", at: 0 });

  const selectedIndex = options.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;
  const hasDescriptions = options.some((o) => o.description);
  const rowHeight = hasDescriptions ? 60 : 46;
  // รายการกว้างอย่างน้อยเท่าช่อง และไม่แคบกว่า 15rem (ช่องเล็กอย่าง "จำนวนชั่วโมง" จะได้อ่านคำอธิบายครบ)
  const position = useFloatingPosition(buttonRef, open, {
    preferredHeight: Math.min(options.length * rowHeight + 12, 320),
    minWidth: hasDescriptions ? 240 : 180,
  });

  const close = useCallback(() => setOpen(false), []);
  const dismissRefs = useMemo(() => [buttonRef, panelRef], []);
  useDismiss(open, dismissRefs, close);

  const openList = () => {
    if (disabled) return;
    setActive(selectedIndex >= 0 ? selectedIndex : firstEnabled(options, 0, 1));
    setOpen(true);
  };

  const choose = (index: number) => {
    const option = options[index];
    if (!option || option.disabled) return;
    if (controlledValue === undefined) setUncontrolled(option.value);
    onChange?.(option.value);
    setInvalid(false);
    setOpen(false);
    buttonRef.current?.focus();
  };

  const scrollIntoView = (index: number) => {
    panelRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`)?.scrollIntoView({ block: "nearest" });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;
    const key = event.key;
    if (!open) {
      if (key === "ArrowDown" || key === "ArrowUp" || key === "Enter" || key === " ") {
        event.preventDefault();
        openList();
      }
      return;
    }
    if (key === "ArrowDown" || key === "ArrowUp") {
      event.preventDefault();
      const next = firstEnabled(options, active + (key === "ArrowDown" ? 1 : -1), key === "ArrowDown" ? 1 : -1);
      setActive(next);
      scrollIntoView(next);
    } else if (key === "Home" || key === "End") {
      event.preventDefault();
      const next = key === "Home" ? firstEnabled(options, 0, 1) : firstEnabled(options, options.length - 1, -1);
      setActive(next);
      scrollIntoView(next);
    } else if (key === "Enter" || key === " ") {
      event.preventDefault();
      choose(active);
    } else if (key === "Tab") {
      setOpen(false);
    } else if (key.length === 1) {
      // พิมพ์ตัวอักษร: กระโดดไปรายการที่ขึ้นต้นด้วยตัวอักษรนั้น (พิมพ์ต่อเนื่องภายใน 0.8 วิ = ค้นต่อ)
      const now = Date.now();
      typeahead.current = { text: (now - typeahead.current.at < 800 ? typeahead.current.text : "") + key.toLowerCase(), at: now };
      const found = options.findIndex((o) => !o.disabled && o.label.toLowerCase().startsWith(typeahead.current.text));
      if (found >= 0) {
        setActive(found);
        scrollIntoView(found);
      }
    }
  };

  return (
    <>
      {name && required ? (
        // ต้องเลือก: ใช้ช่องที่ซ่อนด้วยสายตาแต่เบราว์เซอร์ยังตรวจ required ได้ (type=hidden ตรวจไม่ได้)
        <span className="relative block h-0">
          <input
            tabIndex={-1}
            aria-hidden
            name={name}
            value={value}
            required
            onChange={() => undefined}
            onInvalid={(event) => {
              event.preventDefault();
              setInvalid(true);
              buttonRef.current?.focus();
            }}
            className="pointer-events-none absolute left-4 top-6 h-px w-px opacity-0"
          />
        </span>
      ) : name ? (
        <input type="hidden" name={name} value={value} />
      ) : null}
      <button
        ref={buttonRef}
        id={buttonId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
        className={`ht-input group flex w-full items-center gap-2.5 text-left disabled:cursor-not-allowed disabled:opacity-60 ${
          open ? "border-[#1E5FA8]/60 bg-white shadow-[0_0_0_4px_rgb(30_95_168/0.12)]" : ""
        } ${invalid ? "border-[#D64545]/60 shadow-[0_0_0_4px_rgb(214_69_69/0.1)]" : ""} ${className}`}
      >
        {selected?.icon ? <span className="flex shrink-0 text-[#1E5FA8]">{selected.icon}</span> : null}
        <span className={`min-w-0 flex-1 truncate ${selected ? "text-[#1A1A1A]" : "text-[#5B6B7B]"}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[#5B6B7B] transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] group-hover:text-[#1E5FA8] ${
            open ? "rotate-180 text-[#1E5FA8]" : ""
          }`}
          aria-hidden
        />
      </button>
      {invalid ? <p className="mt-1 text-xs text-[#D64545]">กรุณาเลือก{ariaLabel ?? "รายการ"}</p> : null}

      {position ? (
        <FloatingPanel position={position} panelRef={panelRef} id={listId} role="listbox" label={ariaLabel}>
          <ul className="ht-scroll-thin overflow-y-auto p-1.5" style={{ maxHeight: position.maxHeight }}>
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isActive = index === active;
              return (
                <li
                  key={option.value}
                  id={`${listId}-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={option.disabled || undefined}
                  onPointerEnter={() => !option.disabled && setActive(index)}
                  onClick={() => choose(index)}
                  style={{ animationDelay: `${Math.min(index, 8) * 22}ms` }}
                  className={`ht-option flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 ${
                    option.disabled ? "cursor-not-allowed opacity-45" : ""
                  } ${isActive && !option.disabled ? "bg-[#EAF3FC]" : ""} ${isSelected ? "text-[#1E5FA8]" : "text-[#1A1A1A]"}`}
                >
                  {option.icon ? (
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                        isSelected ? "bg-[#1E5FA8] text-white" : "bg-[#EAF3FC] text-[#1E5FA8]"
                      }`}
                    >
                      {option.icon}
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate ${isSelected ? "font-semibold" : "font-medium"}`}>{option.label}</span>
                    {option.description ? <span className="mt-0.5 block truncate text-xs text-[#5B6B7B]">{option.description}</span> : null}
                  </span>
                  <Check
                    className={`h-4 w-4 shrink-0 text-[#1E5FA8] transition-all duration-200 ${isSelected ? "scale-100 opacity-100" : "scale-50 opacity-0"}`}
                    aria-hidden
                  />
                </li>
              );
            })}
          </ul>
        </FloatingPanel>
      ) : null}
    </>
  );
}

/** หารายการที่เลือกได้ถัดไปในทิศทางที่กำหนด (ข้ามรายการที่ปิดไว้) */
function firstEnabled(options: SelectOption[], start: number, direction: 1 | -1): number {
  const n = options.length;
  if (n === 0) return 0;
  for (let i = 0; i < n; i++) {
    const index = (((start + i * direction) % n) + n) % n;
    if (!options[index].disabled) return index;
  }
  return 0;
}
