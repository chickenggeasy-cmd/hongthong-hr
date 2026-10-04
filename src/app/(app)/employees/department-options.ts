import type { SelectOption } from "@/components/ui/select-field";

/** รายการแผนกสำหรับช่องเลือก: ชื่อแผนกเด่น รหัสแผนกเป็นคำอธิบายรอง */
export function departmentOptions(departments: { code: string; name: string }[]): SelectOption[] {
  return departments.map((d) => ({ value: d.code, label: d.name, description: `แผนก ${d.code}` }));
}
