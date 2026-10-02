"use client";

import { useActionState, useMemo, useState } from "react";
import { Pencil, Search, UserCheck, UserX } from "lucide-react";
import { setEmployeeStatus, updateEmployee, type EmployeeActionState } from "./actions";
import { filterEmployees, type EmployeeFilter } from "@/lib/employees/logic";

export type DirectoryEmployee = {
  id: string;
  employee_code: string;
  full_name: string;
  dept_code: string;
  dept_name: string;
  role_label: string;
  status: string;
  resigned_on: string | null;
  resigned_label: string | null;
};

const initialState: EmployeeActionState = { error: null, success: false };

const inputClass =
  "w-full rounded-xl border border-[#5B6B7B]/25 bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-[#1E5FA8] focus:ring-4 focus:ring-[#1E5FA8]/15";

function Message({ state }: { state: EmployeeActionState }) {
  if (state.error) return <p role="alert" className="text-sm text-[#D64545]">{state.error}</p>;
  if (state.success && state.message) return <p role="status" className="text-sm text-[#2E9E5B]">{state.message}</p>;
  return null;
}

function EditPanel({
  employee,
  departments,
  isSelf,
  today,
}: {
  employee: DirectoryEmployee;
  departments: { code: string; name: string }[];
  isSelf: boolean;
  today: string;
}) {
  const [editState, editAction, editing] = useActionState(updateEmployee, initialState);
  const [statusState, statusAction, changing] = useActionState(setEmployeeStatus, initialState);
  const resigned = employee.status === "resigned";

  return (
    <div className="mt-3 grid gap-4 rounded-2xl bg-[#F7FAFD] p-4 md:grid-cols-2">
      <form action={editAction} className="space-y-2">
        <p className="text-sm font-semibold text-[#1A1A1A]">แก้ไขข้อมูล</p>
        <input type="hidden" name="employeeId" value={employee.id} />
        <input name="fullName" defaultValue={employee.full_name} required aria-label="ชื่อ-นามสกุล" className={inputClass} />
        <select name="deptCode" defaultValue={employee.dept_code} aria-label="แผนก" className={inputClass}>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
        <p className="text-xs text-[#5B6B7B]">ย้ายแผนกแล้วรหัสพนักงานยังเป็นเลขเดิม (ใช้ล็อกอิน)</p>
        <button
          type="submit"
          disabled={editing}
          className="rounded-xl bg-[#1E5FA8] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1E5FA8]/90 disabled:opacity-50"
        >
          {editing ? "กำลังบันทึก..." : "บันทึก"}
        </button>
        <Message state={editState} />
      </form>

      <form action={statusAction} className="space-y-2">
        <p className="text-sm font-semibold text-[#1A1A1A]">สถานะการทำงาน</p>
        <input type="hidden" name="employeeId" value={employee.id} />
        {isSelf ? (
          <p className="text-sm text-[#5B6B7B]">บันทึกลาออกให้ตัวเองไม่ได้</p>
        ) : resigned ? (
          <>
            <p className="text-sm text-[#5B6B7B]">ลาออกแล้ว (วันสุดท้าย {employee.resigned_label})</p>
            <button
              type="submit"
              name="action"
              value="reactivate"
              disabled={changing}
              className="flex items-center gap-1.5 rounded-xl border border-[#2E9E5B]/40 px-4 py-2 text-sm font-medium text-[#2E9E5B] transition-colors hover:bg-[#2E9E5B]/10 disabled:opacity-50"
            >
              <UserCheck className="h-4 w-4" aria-hidden />
              กลับเข้าทำงาน
            </button>
          </>
        ) : (
          <>
            <label className="block text-xs text-[#5B6B7B]" htmlFor={`resign-${employee.id}`}>
              วันทำงานวันสุดท้าย (เงินเดือนงวดนั้นคิดถึงวันนี้)
            </label>
            <input id={`resign-${employee.id}`} type="date" name="resignedOn" defaultValue={today} required className={inputClass} />
            <button
              type="submit"
              name="action"
              value="resign"
              disabled={changing}
              onClick={(event) => {
                if (!window.confirm(`ยืนยันบันทึกลาออก: ${employee.full_name}?\nพนักงานจะเข้าระบบไม่ได้ทันที`)) event.preventDefault();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-[#D64545]/40 px-4 py-2 text-sm font-medium text-[#D64545] transition-colors hover:bg-[#D64545]/10 disabled:opacity-50"
            >
              <UserX className="h-4 w-4" aria-hidden />
              บันทึกลาออก
            </button>
          </>
        )}
        <Message state={statusState} />
      </form>
    </div>
  );
}

export function EmployeeDirectory({
  employees,
  departments,
  currentEmployeeId,
  today,
}: {
  employees: DirectoryEmployee[];
  departments: { code: string; name: string }[];
  currentEmployeeId: string;
  today: string;
}) {
  const [filter, setFilter] = useState<EmployeeFilter>({ query: "", deptCode: "", status: "active" });
  const [openId, setOpenId] = useState<string | null>(null);
  const shown = useMemo(() => filterEmployees(employees, filter), [employees, filter]);
  const counts = {
    active: employees.filter((e) => e.status === "active").length,
    resigned: employees.filter((e) => e.status === "resigned").length,
    all: employees.length,
  };

  return (
    <section className="rounded-3xl border border-[#1E5FA8]/5 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-48 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5B6B7B]" aria-hidden />
          <input
            value={filter.query}
            onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
            placeholder="ค้นหาชื่อ หรือรหัสพนักงาน"
            aria-label="ค้นหาพนักงาน"
            className={`${inputClass} pl-9`}
          />
        </div>
        <select
          value={filter.deptCode}
          onChange={(e) => setFilter((f) => ({ ...f, deptCode: e.target.value }))}
          aria-label="กรองแผนก"
          className={`${inputClass} w-auto`}
        >
          <option value="">ทุกแผนก</option>
          {departments.map((d) => (
            <option key={d.code} value={d.code}>
              {d.code} — {d.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex gap-1" role="tablist" aria-label="สถานะ">
        {(
          [
            ["active", "ทำงานอยู่"],
            ["resigned", "ลาออกแล้ว"],
            ["all", "ทั้งหมด"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter.status === value}
            onClick={() => setFilter((f) => ({ ...f, status: value }))}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              filter.status === value ? "bg-[#1E5FA8] text-white" : "bg-[#EAF3FC] text-[#1E5FA8] hover:bg-[#1E5FA8]/10"
            }`}
          >
            {label} ({counts[value]})
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="py-10 text-center text-sm text-[#5B6B7B]">ไม่พบพนักงานตามเงื่อนไข</p>
      ) : (
        <ul className="mt-3 divide-y divide-[#5B6B7B]/10">
          {shown.map((e) => (
            <li key={e.id} className="py-3">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-semibold ${
                    e.status === "active" ? "bg-[#EAF3FC] text-[#1E5FA8]" : "bg-[#5B6B7B]/10 text-[#5B6B7B]"
                  }`}
                  aria-hidden
                >
                  {e.full_name.trim().slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[#1A1A1A]">
                    {e.full_name}
                    {e.id === currentEmployeeId ? <span className="ml-1 text-xs font-normal text-[#5B6B7B]">(คุณ)</span> : null}
                  </p>
                  <p className="truncate text-xs text-[#5B6B7B]">
                    {e.employee_code} · {e.dept_name} · {e.role_label}
                  </p>
                </div>
                {e.status === "resigned" ? (
                  <span className="rounded-full bg-[#D64545]/10 px-2 py-0.5 text-xs text-[#D64545]">ลาออก {e.resigned_label}</span>
                ) : null}
                <button
                  type="button"
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                  aria-expanded={openId === e.id}
                  className="flex items-center gap-1 rounded-full border border-[#1E5FA8]/20 px-3 py-1 text-sm text-[#1E5FA8] transition-colors hover:bg-[#EAF3FC]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  {openId === e.id ? "ปิด" : "จัดการ"}
                </button>
              </div>
              {openId === e.id ? (
                <EditPanel employee={e} departments={departments} isSelf={e.id === currentEmployeeId} today={today} />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
