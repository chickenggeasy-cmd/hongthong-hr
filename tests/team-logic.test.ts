import { describe, expect, it } from "vitest";
import { bangkokDateTime } from "../src/lib/ot/logic";
import { bangkokClock, bangkokDayRange, todayStatus, type TodayInput } from "../src/lib/team/logic";

const day = "2026-10-01";
const at = (time: string) => bangkokDateTime(day, time);
const log = (type: string, time: string) => ({ type, recordedAt: at(time).toISOString() });
const base: TodayInput = { now: at("12:00"), isWorkingDay: true, onApprovedLeave: false, workStartTime: "09:00", logs: [] };

describe("todayStatus", () => {
  it("เช็คอินตรงเวลา → ทำงานอยู่", () => {
    expect(todayStatus({ ...base, logs: [log("check_in", "08:59")] }).status).toBe("working");
    expect(todayStatus({ ...base, logs: [log("check_in", "09:00")] }).status).toBe("working");
  });

  it("เช็คอินหลังเวลาเข้างาน 1 นาทีขึ้นไป → มาสาย", () => {
    expect(todayStatus({ ...base, logs: [log("check_in", "09:01")] }).status).toBe("late");
  });

  it("รายการล่าสุดเป็นเช็คเอาท์ → เลิกงานแล้ว", () => {
    const result = todayStatus({ ...base, logs: [log("check_out", "17:05"), log("check_in", "08:50")] });
    expect(result.status).toBe("checked_out");
    expect(bangkokClock(result.checkInAt)).toBe("08:50");
    expect(bangkokClock(result.checkOutAt)).toBe("17:05");
  });

  it("ยังไม่เช็คอิน: ก่อนเวลา = ยังไม่เข้างาน, เลยเวลา = ยังไม่มา", () => {
    expect(todayStatus({ ...base, now: at("08:30") }).status).toBe("not_yet");
    expect(todayStatus({ ...base, now: at("09:30") }).status).toBe("absent");
  });

  it("ลาที่อนุมัติแล้ว / วันหยุด", () => {
    expect(todayStatus({ ...base, onApprovedLeave: true }).status).toBe("on_leave");
    expect(todayStatus({ ...base, isWorkingDay: false }).status).toBe("day_off");
  });
});

describe("bangkokDayRange", () => {
  it("วันตามเวลาไทย = 17:00 UTC ของวันก่อน ถึง 17:00 UTC", () => {
    expect(bangkokDayRange(day)).toEqual({ from: "2026-09-30T17:00:00.000Z", to: "2026-10-01T17:00:00.000Z" });
  });
});
