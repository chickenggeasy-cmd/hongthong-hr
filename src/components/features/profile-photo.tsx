"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, Trash2, X } from "lucide-react";
import { cropAvatar } from "@/lib/profile/crop-avatar";
import { initialOf } from "@/lib/profile/photo";
import { removeProfilePhoto, updateProfilePhoto, type ProfilePhotoState } from "@/app/(app)/profile-actions";

// รูปโปรไฟล์: วงกลมรูปจริง (หรือตัวอักษรแรกของชื่อถ้ายังไม่ตั้ง) + กดแล้วเปิดหน้าต่างเปลี่ยนรูป
// ใช้ทั้งการ์ดผู้ใช้ด้านล่างของเมนู และแถบบนบนมือถือ

const SIZES = { sm: "h-9 w-9 text-sm", md: "h-10 w-10", lg: "h-32 w-32 text-5xl" } as const;

/** วงกลมรูปโปรไฟล์ (ตกแต่ง ชื่ออยู่ข้างๆ อยู่แล้ว โปรแกรมอ่านหน้าจอจึงข้าม) */
export function AvatarImage({ name, photoUrl, size = "md" }: { name: string; photoUrl: string | null; size?: keyof typeof SIZES }) {
  const [failed, setFailed] = useState<string | null>(null);
  const showPhoto = photoUrl && failed !== photoUrl;
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#F0C75E] to-[#D4A017] font-bold text-[#0F2D52] ring-2 ring-white/25 ${SIZES[size]}`}
      aria-hidden
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element -- รูปจาก route ของเราเอง (ต้องล็อกอิน) ไม่ผ่านตัวย่อรูปของ Next
        <img key={photoUrl} src={photoUrl} alt="" onError={() => setFailed(photoUrl)} className="ht-fade h-full w-full object-cover" />
      ) : (
        initialOf(name)
      )}
    </span>
  );
}

/** ปุ่มรูปโปรไฟล์: ชี้แล้วขึ้นไอคอนกล้อง กดแล้วเปิดหน้าต่างเปลี่ยนรูป */
export function AvatarButton({
  name,
  photoUrl,
  size = "md",
  className = "",
}: {
  name: string;
  photoUrl: string | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="เปลี่ยนรูปโปรไฟล์"
        aria-label="เปลี่ยนรูปโปรไฟล์"
        className={`group relative shrink-0 rounded-full outline-none transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)] hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#F0C75E] active:scale-95 ${className}`}
      >
        <AvatarImage name={name} photoUrl={photoUrl} size={size} />
        <span className="absolute inset-0 flex items-center justify-center rounded-full bg-[#0B2340]/55 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-4 w-4 text-white" aria-hidden />
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#1E5FA8] ring-2 ring-white">
          <Camera className="h-2.5 w-2.5 text-white" aria-hidden />
        </span>
      </button>
      {open ? <ProfilePhotoDialog name={name} photoUrl={photoUrl} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

const initialState: ProfilePhotoState = { error: null, success: false, photoUrl: null };

function ProfilePhotoDialog({ name, photoUrl, onClose }: { name: string; photoUrl: string | null; onClose: () => void }) {
  const router = useRouter();
  const [saveState, saveAction, saving] = useActionState(updateProfilePhoto, initialState);
  const [removeState, removeAction, removing] = useActionState(removeProfilePhoto, initialState);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const busy = saving || removing || preparing;

  // บันทึก/ลบสำเร็จ: โหลดข้อมูลหน้าใหม่ (รูปในเมนูเปลี่ยนตาม) แล้วปิดหน้าต่าง (ปรับ state ระหว่าง render ตามที่ React แนะนำ)
  const [handled, setHandled] = useState({ saveState, removeState });
  if (handled.saveState !== saveState || handled.removeState !== removeState) {
    const done = (handled.saveState !== saveState && saveState.success) || (handled.removeState !== removeState && removeState.success);
    setHandled({ saveState, removeState });
    if (done) {
      router.refresh();
      onClose();
    }
  }

  // ปิดด้วย Esc + ล็อกการเลื่อนหน้าข้างหลัง + คืนหน่วยความจำของรูปตัวอย่าง
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [busy, onClose]);
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    setPickError(null);
    setPreparing(true);
    const cropped = await cropAvatar(file);
    setPreparing(false);
    if (!cropped) {
      input.value = "";
      setPickError("เปิดรูปนี้ไม่ได้ ลองเลือกรูปอื่น (JPG หรือ PNG)");
      return;
    }
    // ใส่รูปที่ครอปแล้วกลับเข้าช่อง เพื่อให้ฟอร์มส่งไฟล์เล็กไปแทนไฟล์ต้นฉบับ
    const transfer = new DataTransfer();
    transfer.items.add(cropped);
    input.files = transfer.files;
    setPreview(URL.createObjectURL(cropped));
  };

  const error = pickError ?? saveState.error ?? removeState.error;
  const shown = preview ?? photoUrl;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="รูปโปรไฟล์">
      <div className="ht-fade absolute inset-0 bg-[#0B2340]/55 backdrop-blur-[2px]" onClick={() => !busy && onClose()} />
      <div className="ht-sheet relative w-full max-w-sm overflow-hidden rounded-t-[1.75rem] bg-white pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_30px_80px_-20px_rgb(11_35_64/0.6)] sm:rounded-[1.75rem] sm:pb-6">
        {/* หัวสีน้ำเงิน + รูปวงกลมลอยทับขอบ */}
        <div className="relative h-28 bg-gradient-to-br from-[#1E5FA8] via-[#174D8C] to-[#0F2D52]">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#F0C75E]/80 to-transparent" aria-hidden />
          <div className="ht-blob pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#5BA4E6]/30 blur-2xl" aria-hidden />
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="ปิด"
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-white/80 transition-colors hover:bg-white/15 hover:text-white"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="-mt-16 flex flex-col items-center px-6">
          <div className="relative">
            <span className="absolute -inset-1.5 rounded-full bg-gradient-to-br from-[#F0C75E] via-white to-[#1E5FA8]/60" aria-hidden />
            <span key={shown ?? "none"} className="ht-pop relative block rounded-full ring-4 ring-white">
              <AvatarImage name={name} photoUrl={shown} size="lg" />
            </span>
            {preparing ? (
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-white/70">
                <Loader2 className="h-8 w-8 animate-spin text-[#1E5FA8]" aria-hidden />
              </span>
            ) : null}
          </div>
          <p className="mt-4 text-lg font-bold text-[#0F2D52]">{name}</p>
          <p className="text-sm text-[#5B6B7B]">{preview ? "ดูตัวอย่างก่อนบันทึก" : "เลือกรูปที่เป็นตัวคุณ เปลี่ยนได้ตลอด"}</p>

          <form action={saveAction} className="mt-5 w-full space-y-2.5">
            <input ref={fileRef} type="file" name="photo" accept="image/*" onChange={onPick} className="sr-only" tabIndex={-1} />
            {preview ? (
              <>
                <button type="submit" disabled={busy} className="ht-btn-primary flex w-full items-center justify-center gap-2 py-3">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                  {saving ? "กำลังบันทึก..." : "บันทึกรูปนี้"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                  className="w-full rounded-2xl py-2.5 text-sm font-medium text-[#1E5FA8] transition-colors hover:bg-[#EAF3FC]"
                >
                  เลือกรูปอื่น
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => fileRef.current?.click()}
                className="ht-btn-primary flex w-full items-center justify-center gap-2 py-3"
              >
                <ImagePlus className="h-5 w-5" aria-hidden />
                {photoUrl ? "เปลี่ยนรูป" : "เลือกรูป"}
              </button>
            )}
          </form>

          {photoUrl && !preview ? (
            <form action={removeAction} className="mt-1 w-full">
              <button
                type="submit"
                disabled={busy}
                onClick={(event) => {
                  if (!window.confirm("ลบรูปโปรไฟล์? จะกลับไปใช้ตัวอักษรแรกของชื่อแทน")) event.preventDefault();
                }}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl py-2.5 text-sm font-medium text-[#D64545] transition-colors hover:bg-[#D64545]/8"
              >
                {removing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
                ลบรูป
              </button>
            </form>
          ) : null}

          {error ? (
            <p role="alert" className="mt-3 w-full rounded-xl bg-[#D64545]/10 px-3 py-2 text-center text-sm text-[#D64545]">
              {error}
            </p>
          ) : null}
          <p className="mt-3 text-center text-xs text-[#5B6B7B]">ระบบตัดรูปเป็นวงกลมให้อัตโนมัติ</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
