import { describe, expect, it } from "vitest";
import { avatarPath, avatarUrl, centerSquare, detectImageType, initialOf } from "../src/lib/profile/photo";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => Array.from(s).map((c) => c.charCodeAt(0));

describe("รูปโปรไฟล์", () => {
  it("ดูชนิดรูปจากเนื้อไฟล์ ไม่เชื่อนามสกุล", () => {
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(detectImageType(bytes(...ascii("RIFF"), 0, 0, 0, 0, ...ascii("WEBP")))).toBe("image/webp");
    expect(detectImageType(bytes(...ascii("<svg onload=alert(1)>")))).toBeNull();
    expect(detectImageType(bytes(...ascii("GIF89a")))).toBeNull();
    expect(detectImageType(bytes())).toBeNull();
  });

  it("path อยู่ในโฟลเดอร์ของพนักงานเสมอ", () => {
    expect(avatarPath("emp-1", "image/jpeg", "a1b2")).toBe("emp-1/a1b2.jpg");
    expect(avatarPath("emp-1", "image/webp", "../../x")).toBe("emp-1/x.webp");
  });

  it("ลิงก์รูปเปลี่ยนเมื่อเปลี่ยนรูป", () => {
    expect(avatarUrl("emp-1", null)).toBeNull();
    expect(avatarUrl("emp-1", "emp-1/a1b2.jpg")).toBe("/avatar/emp-1?v=a1b2");
  });

  it("ตัวอักษรแทนรูป", () => {
    expect(initialOf("สมชาย ใจดี")).toBe("ส");
    expect(initialOf("เกศินี")).toBe("ก");
    expect(initialOf("  test hr")).toBe("T");
    expect(initialOf("")).toBe("");
  });
});

describe("ครอปรูปเป็นสี่เหลี่ยมจัตุรัส", () => {
  it("รูปแนวนอน: ตัดซ้ายขวาเท่ากัน", () => {
    expect(centerSquare(1600, 900)).toEqual({ sx: 350, sy: 0, size: 900 });
  });
  it("รูปแนวตั้ง: เก็บส่วนบนมากกว่า (หน้าคน)", () => {
    expect(centerSquare(900, 1600)).toEqual({ sx: 0, sy: 245, size: 900 });
  });
  it("รูปจัตุรัสอยู่แล้ว", () => {
    expect(centerSquare(500, 500)).toEqual({ sx: 0, sy: 0, size: 500 });
  });
});
