import path from "node:path";
import type { ReactNode } from "react";
import { Document, Font, Page, StyleSheet, Text as PdfText, View, renderToBuffer } from "@react-pdf/renderer";
import { formatThaiDate } from "@/lib/date";
import { formatBaht, periodLabel } from "@/lib/payroll/logic";
import { payslipLines, payslipStats, type PayslipRecord } from "@/lib/payroll/payslip-view";

// สร้างไฟล์ PDF สลิปเงินเดือน (ใช้ฝั่งเซิร์ฟเวอร์เท่านั้น)
// ฟอนต์ Sarabun (Google Fonts, สัญญาอนุญาต OFL) เก็บในโปรเจกต์ เพราะฟอนต์มาตรฐานของ PDF ไม่มีภาษาไทย

const FONT_DIR = path.join(process.cwd(), "src/lib/export/fonts");
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered) return;
  Font.register({
    family: "Sarabun",
    fonts: [
      { src: path.join(FONT_DIR, "Sarabun-Regular.ttf") },
      { src: path.join(FONT_DIR, "Sarabun-Bold.ttf"), fontWeight: "bold" },
    ],
  });
  // ภาษาไทยไม่เว้นวรรคระหว่างคำ ต้องบอกตัวจัดบรรทัดว่าตัดตรงไหนได้ ไม่งั้นข้อความยาวจะล้นหาย
  const segmenter = new Intl.Segmenter("th", { granularity: "word" });
  Font.registerHyphenationCallback((word) => [...segmenter.segment(word)].map((s) => s.segment));
  fontsRegistered = true;
}

/**
 * แก้บั๊กของ @react-pdf กับสระ "ำ": ไลบรารีนับเป็น 1 ตัวอักษรแต่วาดเป็น 2 ส่วน ทำให้ตัวอักษรท้ายข้อความหายไป
 * ตัวละ 1 ตัวต่อ "ำ" หนึ่งตัว จึงแยกเป็นนิคหิต + สระอา (หน้าตาเหมือนเดิม) ก่อนส่งเข้า PDF
 */
export function fixThaiForPdf(text: string): string {
  return text.replace(/\u0E33/g, "\u0E4D\u0E32");
}

/** Text ที่ผ่าน fixThaiForPdf() เสมอ ใช้แทน Text ของ react-pdf ทุกที่ในไฟล์นี้ */
type PdfStyle = Parameters<typeof StyleSheet.create>[0][string];

function Text({ style, children }: { style?: PdfStyle | PdfStyle[]; children: ReactNode }) {
  const content = [children].flat().filter((c) => c !== null && c !== undefined && c !== false).join("");
  return <PdfText style={style}>{fixThaiForPdf(content)}</PdfText>;
}

const BLUE = "#1E5FA8";
const GOLD = "#D4A017";
const GRAY = "#5B6B7B";

const styles = StyleSheet.create({
  page: { fontFamily: "Sarabun", fontSize: 10, padding: 32, color: "#1A1A1A" },
  goldBar: { height: 4, width: 48, backgroundColor: GOLD, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "bold", color: BLUE },
  muted: { color: GRAY },
  box: { borderWidth: 1, borderColor: "#D9E3EE", borderRadius: 6, padding: 10, marginTop: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  sectionTitle: { fontWeight: "bold", marginBottom: 4 },
  statRow: { flexDirection: "row", marginTop: 12, gap: 6 },
  stat: { flex: 1, backgroundColor: "#EAF3FC", borderRadius: 6, padding: 6 },
  net: { flexDirection: "row", justifyContent: "space-between", marginTop: 12, padding: 10, backgroundColor: BLUE, color: "#FFFFFF", borderRadius: 6 },
});

export type PayslipPdfData = {
  payslip: PayslipRecord;
  period: string;
  cycleStart: string;
  cycleEnd: string;
};

function PayslipDocument({ data }: { data: PayslipPdfData }) {
  const { payslip } = data;
  const { earnings, deductions } = payslipLines(payslip);
  const totalEarnings = earnings.reduce((sum, line) => sum + line.amount, 0);
  const totalDeductions = deductions.reduce((sum, line) => sum + line.amount, 0);

  return (
    <Document title={fixThaiForPdf(`สลิปเงินเดือน ${payslip.employee_code} ${data.period}`)} author="Hongthong">
      <Page size="A5" orientation="landscape" style={styles.page}>
        <View style={styles.goldBar} />
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>สลิปเงินเดือน</Text>
            <Text style={styles.muted}>บริษัท หงส์ทอง จำกัด</Text>
          </View>
          <View>
            <Text style={{ fontWeight: "bold", textAlign: "right" }}>งวด {periodLabel(data.period)}</Text>
            <Text style={[styles.muted, { textAlign: "right" }]}>
              {formatThaiDate(data.cycleStart)} – {formatThaiDate(data.cycleEnd)}
            </Text>
          </View>
        </View>

        <View style={styles.box}>
          <Text style={{ fontWeight: "bold" }}>{payslip.full_name}</Text>
          <Text style={styles.muted}>
            รหัสพนักงาน {payslip.employee_code} · {payslip.dept_name}
          </Text>
        </View>

        <View style={styles.statRow}>
          {payslipStats(payslip).map((stat) => (
            <View key={stat.label} style={styles.stat}>
              <Text style={styles.muted}>{stat.label}</Text>
              <Text style={{ fontWeight: "bold" }}>{stat.value} วัน</Text>
            </View>
          ))}
        </View>

        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>รายได้</Text>
            {earnings.map((line) => (
              <View key={line.label} style={styles.row}>
                <Text>{line.label}</Text>
                <Text>{formatBaht(line.amount)}</Text>
              </View>
            ))}
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: "#D9E3EE", marginTop: 4 }]}>
              <Text style={{ fontWeight: "bold" }}>รวมรายได้</Text>
              <Text style={{ fontWeight: "bold" }}>{formatBaht(totalEarnings)}</Text>
            </View>
          </View>
          <View style={[styles.box, { flex: 1 }]}>
            <Text style={styles.sectionTitle}>รายการหัก</Text>
            {deductions.map((line) => (
              <View key={line.label} style={styles.row}>
                <Text>{line.label}</Text>
                <Text>{formatBaht(line.amount)}</Text>
              </View>
            ))}
            <View style={[styles.row, { borderTopWidth: 1, borderTopColor: "#D9E3EE", marginTop: 4 }]}>
              <Text style={{ fontWeight: "bold" }}>รวมรายการหัก</Text>
              <Text style={{ fontWeight: "bold" }}>{formatBaht(totalDeductions)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.net}>
          <Text style={{ fontWeight: "bold", fontSize: 12 }}>รับสุทธิ</Text>
          <Text style={{ fontWeight: "bold", fontSize: 12 }}>{formatBaht(Number(payslip.net_pay))} บาท</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderPayslipPdf(data: PayslipPdfData): Promise<Buffer> {
  registerFonts();
  return renderToBuffer(<PayslipDocument data={data} />);
}
