"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { checkInOrOut, type CheckInState } from "./actions";
import type { AttendanceType } from "@/lib/attendance/logic";

const initialState: CheckInState = { error: null, success: false };

export function CheckInForm({ nextType }: { nextType: AttendanceType }) {
  const [state, dispatch, pending] = useActionState(checkInOrOut, initialState);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  // เก็บไฟล์รูปไว้ใน state เอง เพราะ React ล้างช่องเลือกไฟล์ทุกครั้งหลังส่งฟอร์ม
  // ถ้าพึ่งช่อง input อย่างเดียว ส่งไม่ผ่านแล้วกดใหม่ รูปจะหายไปโดยที่ยังเห็นรูปตัวอย่างอยู่
  const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      // เรียกผ่าน callback (ไม่ setState ตรงๆ ใน effect) เหมือนกรณีขอตำแหน่งไม่สำเร็จ
      queueMicrotask(() => setLocationError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setCoords({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setLocationError("กรุณาอนุญาตให้เข้าถึงตำแหน่ง แล้วลองใหม่"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  // คืนหน่วยความจำของรูปตัวอย่างเมื่อเปลี่ยนรูป/ออกจากหน้า
  useEffect(() => {
    return () => {
      if (photo) URL.revokeObjectURL(photo.previewUrl);
    };
  }, [photo]);

  function clearPhoto() {
    setPhoto(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // ล้างรูปเมื่อบันทึกสำเร็จ (ปรับ state ระหว่าง render ตามที่ React แนะนำ แทนการ setState ใน useEffect)
  const [handledState, setHandledState] = useState(state);
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) setPhoto(null);
  }

  function submit(formData: FormData) {
    // แนบรูปจาก state (ถ้ามี) แทนค่าจากช่อง input
    if (photo) formData.set("photo", photo.file);
    else formData.delete("photo");
    dispatch(formData);
  }

  const label = nextType === "check_in" ? "เช็คอิน" : "เช็คเอาท์";
  const canSubmit = coords !== null && !pending;

  return (
    <form action={submit} className="space-y-4 rounded-3xl border border-[#1E5FA8]/5 bg-white p-6 shadow-sm">
      <div>
        <p className="text-sm text-[#5B6B7B]">การดำเนินการถัดไป</p>
        <p className="text-lg font-semibold text-[#1A1A1A]">{label}</p>
      </div>

      <input type="hidden" name="latitude" value={coords?.lat ?? ""} />
      <input type="hidden" name="longitude" value={coords?.lng ?? ""} />

      {locationError ? (
        <p className="rounded-lg bg-[#D64545]/10 px-3 py-2 text-sm text-[#D64545]">{locationError}</p>
      ) : coords === null ? (
        <p className="text-sm text-[#5B6B7B]">กำลังขอตำแหน่งของคุณ...</p>
      ) : (
        <p className="text-sm text-[#2E9E5B]">ระบุตำแหน่งแล้ว</p>
      )}

      <div>
        <p className="mb-1.5 text-sm font-medium text-[#1A1A1A]">
          ถ่ายรูปยืนยันตัวตน <span className="font-normal text-[#5B6B7B]">(ไม่บังคับ)</span>
        </p>
        {/* ซ่อนช่องเลือกไฟล์ของเบราว์เซอร์ (ข้อความ "No file chosen" ไม่ตรงกับรูปที่เก็บไว้ใน state) ใช้ปุ่มของเราแทน */}
        <input
          ref={fileInputRef}
          id="photo"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) setPhoto({ file, previewUrl: URL.createObjectURL(file) });
          }}
          className="sr-only"
        />
        <label
          htmlFor="photo"
          className="inline-block cursor-pointer rounded-lg bg-[#EAF3FC] px-3 py-2 text-sm text-[#1E5FA8] transition-colors hover:bg-[#1E5FA8]/10"
        >
          {photo ? "เปลี่ยนรูป" : "เลือก / ถ่ายรูป"}
        </label>
        {photo ? (
          <div className="mt-3 flex items-end gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element -- ตัวอย่างรูปที่ยังไม่ได้อัปโหลด ไม่ใช่รูปจากเว็บ */}
            <img src={photo.previewUrl} alt="ตัวอย่างรูปที่เลือก" className="h-40 w-40 rounded-lg object-cover" />
            <button
              type="button"
              onClick={clearPhoto}
              disabled={pending}
              className="rounded-lg border border-[#D64545]/40 px-3 py-1.5 text-sm text-[#D64545] transition-colors hover:bg-[#D64545]/10 disabled:opacity-50"
            >
              ลบรูป
            </button>
          </div>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-[#D64545]/10 px-3 py-2 text-sm text-[#D64545]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg bg-[#2E9E5B]/10 px-3 py-2 text-sm text-[#2E9E5B]">
          {state.resultType === "check_in" ? "เช็คอิน" : "เช็คเอาท์"}สำเร็จ ห่างจากบริษัท{" "}
          {state.distanceMeters !== undefined ? Math.round(state.distanceMeters) : "-"} เมตร
        </p>
      ) : null}

      <button
        type="submit"
        disabled={!canSubmit}
        className="w-full rounded-lg bg-[#1E5FA8] py-2.5 font-medium text-white transition-colors hover:bg-[#1E5FA8]/90 disabled:opacity-50"
      >
        {pending ? "กำลังบันทึก..." : label}
      </button>
    </form>
  );
}
