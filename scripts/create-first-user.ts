/**
 * สร้างผู้ใช้คนแรก (ใช้ตอนพัฒนา/ทดสอบ)
 *
 * ตัวอย่าง:
 *   npx tsx scripts/create-first-user.ts --national-id 1234567890121
 *   npx tsx scripts/create-first-user.ts --dept 01 --name "Test Finance" --national-id 1234567890121
 *
 * --dept        รหัสแผนก (ค่าเริ่มต้น 20 = หัวหน้าแผนก HR)
 * --name        ชื่อ-นามสกุล (ค่าเริ่มต้น "Test HR Admin")
 * --national-id เลขบัตรประชาชน 13 หลัก (ต้องผ่าน checksum) ใช้เลขทดสอบเท่านั้น
 *
 * ต้องมี .env.local ที่มี NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NATIONAL_ID_PEPPER
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  deriveLoginPassword,
  employeeEmail,
  hashNationalId,
  isValidThaiNationalId,
  normalizeNationalId,
} from "../src/lib/auth/national-id";

function fail(message: string): never {
  console.error(`\n❌ ${message}\n`);
  process.exit(1);
}

// อ่าน .env.local เอง (ตัด BOM ถ้ามี) เพื่อไม่พึ่งเวอร์ชัน Node
function loadEnvLocal(): void {
  let text: string;
  try {
    text = readFileSync(".env.local", "utf8").replace(/^\uFEFF/, "");
  } catch {
    fail("ไม่พบไฟล์ .env.local (ต้องรันคำสั่งจากโฟลเดอร์รากของโปรเจกต์)");
  }
  for (const line of text.split(/\r?\n/)) {
    if (line.trim().startsWith("#")) continue;
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) fail(`.env.local ยังไม่มีค่า ${name}`);
  return value;
}

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const url = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");

  const deptCode = arg("dept") ?? "20";
  const fullName = arg("name") ?? "Test HR Admin";
  const nationalId = normalizeNationalId(arg("national-id") ?? "");
  if (!isValidThaiNationalId(nationalId)) {
    fail("เลขบัตรประชาชนไม่ถูกต้อง (ต้อง 13 หลักและผ่านการตรวจหลักตรวจสอบ) ใส่ด้วย --national-id");
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) ลงทะเบียนพนักงาน (สร้างรหัส 8 หลัก + เก็บเลขบัตรแบบแฮช ในทรานแซกชันเดียว)
  const reg = await supabase.rpc("register_employee", {
    p_dept_code: deptCode,
    p_full_name: fullName,
    p_national_id_hash: hashNationalId(nationalId),
  });
  if (reg.error) {
    if (reg.error.code === "23505") fail("เลขบัตรนี้ถูกลงทะเบียนไว้แล้ว");
    fail(`ลงทะเบียนพนักงานไม่สำเร็จ: ${reg.error.message}`);
  }
  const row = Array.isArray(reg.data) ? reg.data[0] : reg.data;
  if (!row?.new_id || !row?.new_employee_code) fail("ฟังก์ชัน register_employee ส่งข้อมูลกลับมาไม่ครบ");
  const employeeId: string = row.new_id;
  const employeeCode: string = row.new_employee_code;

  // ถ้าขั้นต่อไปพลาด ให้ล้างแถวพนักงานที่เพิ่งสร้าง (เลขบัตรจะได้ไม่ค้างเป็น "ซ้ำ")
  const rollbackEmployee = async () => {
    const del = await supabase.from("employees").delete().eq("id", employeeId);
    if (del.error) console.error(`⚠️  ล้างแถวพนักงาน ${employeeCode} ไม่สำเร็จ: ${del.error.message}`);
  };

  // 2) สร้างผู้ใช้ใน Supabase Auth (อีเมลสมมติ + รหัสผ่านที่คำนวณจากรหัสพนักงาน+เลขบัตร)
  const created = await supabase.auth.admin.createUser({
    email: employeeEmail(employeeCode),
    password: deriveLoginPassword(employeeCode, nationalId),
    email_confirm: true,
    user_metadata: { employee_code: employeeCode },
  });
  if (created.error || !created.data.user) {
    await rollbackEmployee();
    fail(
      `สร้างผู้ใช้ใน Supabase Auth ไม่สำเร็จ: ${created.error?.message ?? "ไม่ทราบสาเหตุ"}\n` +
        "   (ล้างข้อมูลพนักงานที่เพิ่งสร้างให้แล้ว ส่งข้อความนี้มาให้ผมดูได้)",
    );
  }
  const authUserId = created.data.user.id;

  // 3) ผูกผู้ใช้ Auth เข้ากับพนักงาน
  const link = await supabase.from("employees").update({ auth_user_id: authUserId }).eq("id", employeeId);
  if (link.error) {
    await supabase.auth.admin.deleteUser(authUserId);
    await rollbackEmployee();
    fail(`ผูกผู้ใช้กับพนักงานไม่สำเร็จ: ${link.error.message} (ล้างข้อมูลที่เพิ่งสร้างให้แล้ว)`);
  }

  console.log("\n✅ สร้างผู้ใช้สำเร็จ");
  console.log(`   รหัสพนักงาน : ${employeeCode}`);
  console.log(`   แผนก        : ${deptCode}`);
  console.log(`   ชื่อ         : ${fullName}`);
  console.log(`   เลขบัตร      : ${"*".repeat(9)}${nationalId.slice(-4)}`);
  console.log("   ล็อกอินด้วย  : รหัสพนักงานข้างบน + เลขบัตรที่ใส่ตอนสร้าง\n");
}

main().catch((err) => fail(`เกิดข้อผิดพลาดที่ไม่คาดคิด: ${err instanceof Error ? err.message : String(err)}`));