import type { MetadataRoute } from "next";

// ทำให้ "เพิ่มไปยังหน้าจอหลัก" บนมือถือได้ เปิดแล้วเต็มจอเหมือนแอป (ต้องเปิดผ่าน HTTPS)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "หงส์ทอง · ระบบพนักงาน",
    short_name: "หงส์ทอง",
    description: "ลงเวลา ลา OT และเงินเดือนพนักงาน หงส์ทอง Cash & Carry",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "th",
    background_color: "#EAF3FC",
    theme_color: "#0F2D52",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
