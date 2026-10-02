import { isValidDateOnly } from "../date";
import { dbErrorMessage } from "../approvals/logic";

// ตรวจข้อมูลก่อนแก้ไขพนักงาน / บันทึกลาออก (ฐานข้อมูลตรวจซ้ำใน update_employee() / set_employee_status())

export function validateEmployeeEdit(fullName: string, deptCode: string): string | null {
  const name = fullName.trim();
  if (name.length < 2) return "กรุณากรอกชื่อ-นามสกุล";
  if (name.length > 200) return "ชื่อยาวเกินไป";
  if (!/^\d{2}$/.test(deptCode)) return "กรุณาเลือกแผนก";
  return null;
}

export function validateResignDate(resignedOn: string): string | null {
  return isValidDateOnly(resignedOn) ? null : "กรุณาระบุวันทำงานวันสุดท้าย";
}

const EMPLOYEE_ERROR_MESSAGES: Record<string, string> = {
  "employee.forbidden": "คุณไม่มีสิทธิ์แก้ไขข้อมูลพนักงาน",
  "employee.invalid_name": "กรุณากรอกชื่อ-นามสกุล",
  "employee.invalid_dept": "แผนกไม่ถูกต้อง หรือถูกปิดใช้งาน",
  "employee.not_found": "ไม่พบพนักงาน",
  "employee.self": "บันทึกลาออกให้ตัวเองไม่ได้ กรุณาให้ HR/การเงินคนอื่นทำ",
};

export function employeeErrorMessage(dbMessage: string | null | undefined): string {
  return dbErrorMessage(dbMessage, EMPLOYEE_ERROR_MESSAGES);
}

export type EmployeeFilter = { query: string; deptCode: string; status: "active" | "resigned" | "all" };

type FilterableEmployee = { employee_code: string; full_name: string; dept_code: string; status: string };

/** กรองรายชื่อพนักงานตามคำค้น (ชื่อ/รหัส) แผนก และสถานะ */
export function filterEmployees<T extends FilterableEmployee>(employees: readonly T[], filter: EmployeeFilter): T[] {
  const query = filter.query.trim().toLowerCase();
  return employees.filter(
    (e) =>
      (filter.status === "all" || e.status === filter.status) &&
      (!filter.deptCode || e.dept_code === filter.deptCode) &&
      (!query || e.full_name.toLowerCase().includes(query) || e.employee_code.includes(query)),
  );
}
