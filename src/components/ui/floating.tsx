"use client";

import { useCallback, useEffect, useLayoutEffect, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

// ส่วนกลางของกล่องที่ลอยออกมาจากช่องกรอก (รายการตัวเลือก / ปฏิทิน)
// วาดผ่าน portal ไปที่ <body> เพื่อไม่ให้ถูกการ์ดหรือเมนูที่มี overflow/transform ตัดขอบ
// จัดตำแหน่งใต้ช่องกรอก ถ้าที่ด้านล่างไม่พอจะพลิกขึ้นด้านบนเอง

export type FloatingPosition = { left: number; top: number; width: number; placement: "bottom" | "top"; maxHeight: number };

const GAP = 8;
const MARGIN = 12;

export function useFloatingPosition(
  anchorRef: RefObject<HTMLElement | null>,
  open: boolean,
  { preferredHeight, minWidth = 0 }: { preferredHeight: number; minWidth?: number },
): FloatingPosition | null {
  const [position, setPosition] = useState<FloatingPosition | null>(null);

  const update = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;
    const width = Math.min(Math.max(rect.width, minWidth), viewportW - MARGIN * 2);
    const left = Math.min(Math.max(rect.left, MARGIN), viewportW - width - MARGIN);
    const below = viewportH - rect.bottom - GAP - MARGIN;
    const above = rect.top - GAP - MARGIN;
    const placement = below >= Math.min(preferredHeight, 260) || below >= above ? "bottom" : "top";
    const maxHeight = Math.max(160, Math.min(preferredHeight, placement === "bottom" ? below : above));
    const top = placement === "bottom" ? rect.bottom + GAP : rect.top - GAP - maxHeight;
    setPosition({ left, top, width, placement, maxHeight });
  }, [anchorRef, preferredHeight, minWidth]);

  useLayoutEffect(() => {
    if (open) update();
  }, [open, update]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true); // true = ฟังการเลื่อนของทุกกล่องที่เลื่อนได้ด้วย
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, update]);

  return open ? position : null;
}

/** ปิดกล่องเมื่อคลิก/แตะนอกช่องกรอกและนอกกล่อง หรือกด Esc */
export function useDismiss(open: boolean, refs: RefObject<HTMLElement | null>[], onDismiss: () => void) {
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (refs.some((ref) => ref.current?.contains(target))) return;
      onDismiss();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    document.addEventListener("pointerdown", onPointer, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, refs, onDismiss]);
}

/** กล่องลอย + อนิเมชันเปิด (ขยายจากด้านที่ติดช่องกรอก) */
export function FloatingPanel({
  position,
  panelRef,
  children,
  className = "",
  id,
  role,
  label,
}: {
  position: FloatingPosition;
  panelRef: RefObject<HTMLDivElement | null>;
  children: ReactNode;
  className?: string;
  id?: string;
  role?: string;
  label?: string;
}) {
  return createPortal(
    <div
      ref={panelRef}
      id={id}
      role={role}
      aria-label={label}
      style={{ left: position.left, top: position.top, width: position.width, maxHeight: position.maxHeight }}
      className={`ht-float-panel fixed z-[70] overflow-hidden rounded-2xl border border-[#1E5FA8]/12 bg-white/98 shadow-[0_24px_48px_-18px_rgb(15_45_82/0.45),0_2px_6px_rgb(15_45_82/0.06)] backdrop-blur ${
        position.placement === "bottom" ? "origin-top" : "origin-bottom"
      } ${className}`}
    >
      {children}
    </div>,
    document.body,
  );
}
