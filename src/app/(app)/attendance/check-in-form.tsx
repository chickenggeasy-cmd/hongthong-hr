"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { checkInOrOut, type CheckInState } from "./actions";
import type { AttendanceType } from "@/lib/attendance/logic";

const initialState: CheckInState = { error: null, success: false };

export function CheckInForm({ nextType }: { nextType: AttendanceType }) {
  const [state, formAction, pending] = useActionState(checkInOrOut, initialState);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setLocationError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => setCoords({ lat: position.coords.latitude, lng: position.coords.longitude }),
      () => setLocationError("กรุณาอนุญาตให้เข้าถึงตำแหน่ง แล้วลองใหม่"),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }, []);

  useEffect(() => {
    if (state.success) {
      formRef.current?.reset();
      setPhotoPreview(null);
    }
  }, [state.success]);

  const label = nextType === "check_in" ? "เช็คอิน" : "เช็คเอาท์";
  const canSubmit = coords !== null && photoPreview !== null && !pending;

  return (
    <form ref={formRef} action={formAction} className="space-y-4 rounded-2xl bg-white p-6 shadow-sm">
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
        <label htmlFor="photo" className="mb-1.5 block text-sm font-medium text-[#1A1A1A]">
          ถ่ายรูปยืนยันตัวตน
        </label>
        <input
          id="photo"
          name="photo"
          type="file"
          accept="image/*"
          capture="user"
          required
          onChange={(event) => {
            const file = event.target.files?.[0];
            setPhotoPreview(file ? URL.createObjectURL(file) : null);
          }}
          className="block w-full text-sm text-[#5B6B7B] file:mr-3 file:rounded-lg file:border-0 file:bg-[#EAF3FC] file:px-3 file:py-2 file:text-[#1E5FA8]"
        />
        {photoPreview ? (
          // eslint-disable-next-line @next/next/no-img-element -- ใช้ตัวอย่างรูปที่ยังไม่ได้อัปโหลด ไม่ใช่รูปจากเว็บ
          <img src={photoPreview} alt="ตัวอย่างรูปที่ถ่าย" className="mt-3 h-40 w-40 rounded-lg object-cover" />
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="rounded-lg bg-[#D64545]/10 px-3 py-2 text-sm text-[#D64545]">
          {state.error}
        </p>
      ) : null}
      {state.success ? (
        <p role="status" className="rounded-lg bg-[#2E9E5B]/10 px-3 py-2 text-sm text-[#2E9E5B]">
          {state.resultType === "check_in" ? "เช็คอิน" : "เช็คเอาท์"}สำเร็จ ห่างจากมหาวิทยาลัย{" "}
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