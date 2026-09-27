import Link from "next/link";
import { getCurrentEmployee } from "@/lib/auth/current-user";
import { roleLabel } from "@/lib/permissions";

export default async function HomePage() {
  // ไม่มีทาง null ในหน้านี้ตามปกติ เพราะ layout.tsx เช็คและกันไว้ให้แล้ว
  // แต่ TypeScript ไม่รู้ จึงต้องเช็คอีกชั้น (cache() ทำให้เรียกซ้ำแทบไม่มีต้นทุนเพิ่ม)
  const employee = await getCurrentEmployee();
  if (!employee) return null;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-[#5B6B7B]">สวัสดี</p>
        <h1 className="text-xl font-semibold text-[#1A1A1A]">{employee.fullName}</h1>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-[#5B6B7B]">รหัสพนักงาน</dt>
            <dd className="font-medium text-[#1A1A1A]">{employee.employeeCode}</dd>
          </div>
          <div>
            <dt className="text-[#5B6B7B]">แผนก</dt>
            <dd className="font-medium text-[#1A1A1A]">{employee.deptName}</dd>
          </div>
          <div>
            <dt className="text-[#5B6B7B]">สิทธิ์</dt>
            <dd className="font-medium text-[#1A1A1A]">{roleLabel(employee.role)}</dd>
          </div>
        </dl>
      </div>

      <Link
        href="/attendance"
        className="block rounded-2xl bg-[#1E5FA8] p-6 text-center font-medium text-white shadow-sm transition-colors hover:bg-[#1E5FA8]/90"
      >
        เช็คอิน / เช็คเอาท์
      </Link>

      <div className="rounded-2xl border border-dashed border-[#5B6B7B]/30 bg-white/60 p-6 text-center text-sm text-[#5B6B7B]">
        วันหยุด วันลาคงเหลือ จะแสดงที่นี่ (ยังไม่ได้ทำ)
      </div>
    </div>
  );
}