import { describe, expect, it } from "vitest";
import { addDays } from "../src/lib/date";
import { bangkokDateTime } from "../src/lib/ot/logic";
import { isWorkingDay } from "../src/lib/leave/logic";
import {
  canFinalize,
  computePayslip,
  monthsBetween,
  overQuotaLeaveDates,
  payrollCycle,
  periodForDate,
  readPayrollSettings,
  type PayrollSettings,
  type PayslipInput,
} from "../src/lib/payroll/logic";
import { toSettingsRecord } from "../src/lib/settings";

// งวด 2026-10 = 26 ก.ย. (เสาร์) ถึง 25 ต.ค. 2026 (อาทิตย์)
// วันอาทิตย์ในงวด: 27 ก.ย., 4, 11, 18, 25 ต.ค. · วันหยุดนักขัตฤกษ์: 13, 23 ต.ค.
// → วันทำงาน 30 − 5 − 2 = 23 วัน
const settings: PayrollSettings = {
  dailyRate: 550,
  lateDeductionPerMinute: 2.5,
  otHourlyRate: 150,
  workStartTime: "09:00",
  workEndTime: "17:00",
  monthlyQuotaDays: 4,
  overQuotaDeduction: 250,
  socialSecurityRatePercent: 5,
  socialSecurityMaxAmount: 750,
  cutoffDay: 25,
};
const holidays = new Set(["2026-10-13", "2026-10-23"]);
const cycle = payrollCycle("2026-10", 25);

function workingDaysOfCycle(): string[] {
  const days: string[] = [];
  for (let d = cycle.start; d <= cycle.end; d = addDays(d, 1)) if (isWorkingDay(d, holidays)) days.push(d);
  return days;
}

/** เช็คอินทุกวันทำงาน (ยกเว้นวันที่ระบุ) เวลา checkInTime เวลาไทย */
function attendance(checkInTime = "08:55", skip: string[] = [], overrides: Record<string, string> = {}) {
  return workingDaysOfCycle()
    .filter((d) => !skip.includes(d))
    .map((d) => ({ type: "check_in", recordedAt: bangkokDateTime(d, overrides[d] ?? checkInTime).toISOString() }));
}

function input(partial: Partial<PayslipInput> = {}): PayslipInput {
  return {
    cycle,
    today: "2026-10-31",
    employedFrom: "2020-01-01",
    holidays,
    attendance: attendance(),
    approvedLeaves: [],
    approvedOts: [],
    settings,
    ...partial,
  };
}

describe("รอบเงินเดือน", () => {
  it("ตัดรอบวันที่ 25: นับ 26 เดือนก่อน ถึง 25 เดือนนี้", () => {
    expect(payrollCycle("2026-10", 25)).toEqual({ start: "2026-09-26", end: "2026-10-25" });
    expect(payrollCycle("2027-01", 25)).toEqual({ start: "2026-12-26", end: "2027-01-25" });
  });

  it("วันที่หลังวันตัดรอบ อยู่ในงวดของเดือนถัดไป", () => {
    expect(periodForDate("2026-10-25", 25)).toBe("2026-10");
    expect(periodForDate("2026-10-26", 25)).toBe("2026-11");
    expect(periodForDate("2026-12-31", 25)).toBe("2027-01");
  });

  it("ปิดงวดได้หลังพ้นวันตัดรอบเท่านั้น", () => {
    expect(canFinalize(cycle, "2026-10-25")).toBe(false);
    expect(canFinalize(cycle, "2026-10-26")).toBe(true);
  });

  it("เดือนปฏิทินที่งวดคาบเกี่ยว", () => {
    expect(monthsBetween(cycle.start, cycle.end)).toEqual(["2026-09", "2026-10"]);
  });
});

describe("readPayrollSettings", () => {
  it("ค่าขาดไปแม้แต่ค่าเดียว → null (ไม่คำนวณด้วยค่าไม่ครบ)", () => {
    expect(readPayrollSettings(toSettingsRecord([{ key: "wage.daily_rate", value: "550" }]))).toBeNull();
  });
});

describe("computePayslip", () => {
  it("มาครบทุกวัน ไม่สาย: ได้ค่าจ้างวันทำงาน + วันหยุดนักขัตฤกษ์", () => {
    const result = computePayslip(input());
    expect(result.workingDays).toBe(23);
    expect(result.workedDays).toBe(23);
    expect(result.paidHolidayDays).toBe(2);
    expect(result.absentDays).toBe(0);
    expect(result.basePay).toBe(25 * 550);
    // ประกันสังคม 5% ของ 13,750 = 687.5 → ปัดเป็น 688
    expect(result.socialSecurity).toBe(688);
    expect(result.netPay).toBe(13750 - 688);
  });

  it("มาสาย: นับเป็นนาทีเต็ม เริ่มนับนาทีที่ 1 หลังเวลาเข้างาน", () => {
    const result = computePayslip(
      input({ attendance: attendance("08:55", [], { "2026-10-01": "09:10", "2026-10-02": "09:00" }) }),
    );
    expect(result.lateDays).toBe(1);
    expect(result.lateMinutes).toBe(10);
    expect(result.lateDeduction).toBe(25);
    expect(result.days.find((d) => d.date === "2026-10-01")?.checkIn).toBe("09:10");
  });

  it("หักมาสายต่อวันไม่เกินค่าจ้าง 1 วัน", () => {
    const result = computePayslip(input({ attendance: attendance("08:55", [], { "2026-10-01": "20:00" }) }));
    expect(result.lateMinutes).toBe(660);
    expect(result.lateDeduction).toBe(550);
  });

  it("ขาดงาน: ไม่ได้ค่าจ้างวันนั้น", () => {
    const result = computePayslip(input({ attendance: attendance("08:55", ["2026-10-01", "2026-10-02"]) }));
    expect(result.absentDays).toBe(2);
    expect(result.workedDays).toBe(21);
    expect(result.basePay).toBe(23 * 550);
  });

  it("ลา: ไม่ได้ค่าจ้าง ลาเกินโควตาของเดือนหักวันละ 250", () => {
    // ลา 5–9 ต.ค. (จ–ศ) = 5 วัน โควตา 4 → วันที่ 9 เกิน
    const leaveDays = ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
    const result = computePayslip(
      input({
        attendance: attendance("08:55", leaveDays),
        approvedLeaves: [{ startDate: "2026-10-05", endDate: "2026-10-09" }],
      }),
    );
    expect(result.leaveDays).toBe(5);
    expect(result.overQuotaDays).toBe(1);
    expect(result.leavePenalty).toBe(250);
    expect(result.days.find((d) => d.date === "2026-10-09")?.overQuota).toBe(true);
    expect(result.basePay).toBe((23 - 5 + 2) * 550);
  });

  it("โควตานับทั้งเดือนปฏิทิน รวมวันลาที่อยู่นอกงวดในเดือนเดียวกัน", () => {
    // ลา 26–30 ต.ค. (นอกงวดนี้) ไม่กระทบ แต่ลา 1–2 ก.ย. + 28–30 ก.ย. = 5 วันในเดือน ก.ย. → 30 ก.ย. เกิน
    const result = computePayslip(
      input({
        attendance: attendance("08:55", ["2026-09-28", "2026-09-29", "2026-09-30"]),
        approvedLeaves: [
          { startDate: "2026-09-01", endDate: "2026-09-02" },
          { startDate: "2026-09-28", endDate: "2026-09-30" },
          { startDate: "2026-10-26", endDate: "2026-10-30" },
        ],
      }),
    );
    expect(result.leaveDays).toBe(3);
    expect(result.overQuotaDays).toBe(1);
  });

  it("วันหยุดนักขัตฤกษ์ที่อยู่ในช่วงลา ได้ค่าจ้างตามปกติ ไม่นับเป็นวันลา", () => {
    const result = computePayslip(
      input({
        attendance: attendance("08:55", ["2026-10-12", "2026-10-14"]),
        approvedLeaves: [{ startDate: "2026-10-12", endDate: "2026-10-14" }],
      }),
    );
    expect(result.leaveDays).toBe(2);
    expect(result.paidHolidayDays).toBe(2);
  });

  it("OT: จ่ายชั่วโมงเต็มที่ทำจริง ไม่เกินที่อนุมัติ", () => {
    const logs = [
      ...attendance(),
      { type: "check_out", recordedAt: bangkokDateTime("2026-10-01", "19:30").toISOString() },
      { type: "check_out", recordedAt: bangkokDateTime("2026-10-02", "22:00").toISOString() },
    ];
    const result = computePayslip(
      input({
        attendance: logs,
        approvedOts: [
          { workDate: "2026-10-01", hours: 3 }, // ทำจริง 2 ชม. 30 นาที → 2
          { workDate: "2026-10-02", hours: 2 }, // ทำจริง 5 ชม. → อนุมัติแค่ 2
          { workDate: "2026-10-05", hours: 2 }, // ไม่มีเช็คเอาท์ → 0
        ],
      }),
    );
    expect(result.otHours).toBe(4);
    expect(result.otPay).toBe(600);
  });

  it("คำนวณก่อนสิ้นงวด: วันที่ยังไม่ถึงไม่นับเป็นขาดงาน", () => {
    const result = computePayslip(input({ today: "2026-10-02" }));
    expect(result.days.filter((d) => d.status === "future").length).toBe(23);
    expect(result.absentDays).toBe(0);
  });

  it("เริ่มงานกลางงวด: วันก่อนเริ่มงานไม่นับ", () => {
    const result = computePayslip(input({ employedFrom: "2026-10-12" }));
    expect(result.days.filter((d) => d.status === "not_employed").length).toBe(16);
    expect(result.paidHolidayDays).toBe(2);
    expect(result.absentDays).toBe(0);
  });

  it("ลาออกกลางงวด: วันหลังวันทำงานวันสุดท้ายไม่นับ (ไม่เป็นขาดงาน ไม่ได้ค่าจ้างวันหยุดหลังลาออก)", () => {
    const result = computePayslip(input({ employedUntil: "2026-10-09" }));
    // ทำงาน 26 ก.ย.–9 ต.ค.: วันทำงาน 26,28,29,30 ก.ย. + 1,2,3,5,6,7,8,9 ต.ค. = 12 วัน
    expect(result.workedDays).toBe(12);
    expect(result.paidHolidayDays).toBe(0);
    expect(result.absentDays).toBe(0);
    expect(result.days.filter((d) => d.status === "not_employed").length).toBe(16);
  });

  it("ประกันสังคมไม่เกินเพดาน", () => {
    const result = computePayslip(input({ settings: { ...settings, dailyRate: 1000 } }));
    expect(result.socialSecurity).toBe(750);
  });

  it("เงินสุทธิไม่ติดลบ", () => {
    const result = computePayslip(
      input({
        attendance: [],
        approvedLeaves: [{ startDate: "2026-09-28", endDate: "2026-10-22" }],
      }),
    );
    expect(result.netPay).toBeGreaterThanOrEqual(0);
  });

  it("เงินไม่มีเศษทศนิยมเพี้ยน", () => {
    const result = computePayslip(
      input({ attendance: attendance("08:55", [], { "2026-10-01": "09:03", "2026-10-02": "09:07" }) }),
    );
    expect(result.lateDeduction).toBe(25);
    expect(Number.isInteger(Math.round(result.netPay * 100))).toBe(true);
  });
});

describe("overQuotaLeaveDates", () => {
  it("วันลาซ้ำกันจากหลายคำขอ นับครั้งเดียว", () => {
    const result = overQuotaLeaveDates(
      [
        { startDate: "2026-10-05", endDate: "2026-10-07" },
        { startDate: "2026-10-07", endDate: "2026-10-08" },
      ],
      ["2026-10"],
      4,
      holidays,
    );
    expect(result.size).toBe(0);
  });
});
