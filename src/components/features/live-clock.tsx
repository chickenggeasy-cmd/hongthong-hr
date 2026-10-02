"use client";

import { useEffect, useState } from "react";

function bangkokTime(date: Date): string {
  return date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Bangkok" });
}

/** นาฬิกาเวลาไทยที่เดินทุกวินาที (ค่าเริ่มต้นมาจากเซิร์ฟเวอร์ กันหน้ากระพริบตอนโหลด) */
export function LiveClock({ initialIso }: { initialIso: string }) {
  const [now, setNow] = useState(() => new Date(initialIso));
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <time dateTime={now.toISOString()} className="tabular-nums" suppressHydrationWarning>
      {bangkokTime(now)}
    </time>
  );
}
