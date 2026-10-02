import { describe, expect, it } from "vitest";
import { teamLeaveSections } from "../src/lib/leave/team";

const leave = (id: string, startDate: string, endDate: string, status = "approved", employeeName = "ก") => ({
  id,
  employeeName,
  startDate,
  endDate,
  status,
});

describe("teamLeaveSections", () => {
  const today = "2026-10-02";

  it("แยก ลาวันนี้ / กำลังจะลา (ใน 30 วัน) และไม่แสดงที่ถูกปฏิเสธหรือจบไปแล้ว", () => {
    const result = teamLeaveSections(
      [
        leave("now", "2026-10-01", "2026-10-03"),
        leave("soon", "2026-10-10", "2026-10-10", "pending"),
        leave("far", "2026-12-01", "2026-12-01"),
        leave("past", "2026-09-20", "2026-09-21"),
        leave("rejected", "2026-10-05", "2026-10-05", "rejected"),
      ],
      today,
    );
    expect(result.today.map((l) => l.id)).toEqual(["now"]);
    expect(result.upcoming.map((l) => l.id)).toEqual(["soon"]);
  });

  it("กำลังจะลาเรียงตามวันที่ แล้วตามชื่อ", () => {
    const result = teamLeaveSections(
      [leave("b", "2026-10-09", "2026-10-09", "approved", "สมชาย"), leave("a", "2026-10-09", "2026-10-09", "approved", "กมล"), leave("c", "2026-10-05", "2026-10-05")],
      today,
    );
    expect(result.upcoming.map((l) => l.id)).toEqual(["c", "a", "b"]);
  });
});
