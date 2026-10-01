import ExcelJS from "exceljs";

// สร้างไฟล์ Excel (.xlsx) จากตาราง ใช้ร่วมกันทุกรายงาน (ฝั่งเซิร์ฟเวอร์)

export type ExcelColumn<T> = {
  header: string;
  value: (row: T) => string | number | null;
  width?: number;
  numFmt?: string; // เช่น "#,##0.00" สำหรับเงิน
};

export type ExcelSheet<T> = { name: string; columns: ExcelColumn<T>[]; rows: readonly T[] };

/** ชีตที่แปลงค่าเป็นตารางแล้ว (ไม่ผูกกับชนิดแถว) รวมหลายชีตในไฟล์เดียวได้ */
export type PreparedSheet = {
  name: string;
  columns: { header: string; width?: number; numFmt?: string }[];
  cells: (string | number | null)[][];
};

export const MONEY_FORMAT = "#,##0.00";

/** แปลงแถวเป็นตาราง (TypeScript ตรวจชนิดแถวกับคอลัมน์ให้ตรงนี้) */
export function sheet<T>(definition: ExcelSheet<T>): PreparedSheet {
  return {
    name: definition.name,
    columns: definition.columns.map(({ header, width, numFmt }) => ({ header, width, numFmt })),
    cells: definition.rows.map((row) => definition.columns.map((c) => c.value(row))),
  };
}

export async function buildWorkbook(sheets: readonly PreparedSheet[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hongthong HR";
  workbook.created = new Date();

  for (const prepared of sheets) {
    const ws = workbook.addWorksheet(prepared.name.slice(0, 31)); // Excel จำกัดชื่อชีต 31 ตัวอักษร
    ws.columns = prepared.columns.map((c, i) => ({ header: c.header, key: String(i), width: c.width ?? 16 }));
    for (const row of prepared.cells) ws.addRow(row);
    prepared.columns.forEach((c, i) => {
      if (c.numFmt) ws.getColumn(i + 1).numFmt = c.numFmt;
    });
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E5FA8" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

/** Response สำหรับดาวน์โหลดไฟล์ Excel */
export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
