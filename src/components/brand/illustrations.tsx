// ภาพประกอบเวกเตอร์ (SVG) วาดเองให้เข้ากับโลโก้หงส์ทอง (โกดัง + กล่องสินค้า + รถเข็น + เส้นสีทอง)
// ใช้ SVG แทนรูปถ่ายสต็อก: คมชัดทุกขนาดจอ โหลดเร็ว สีตรงแบรนด์ และไม่มีปัญหาลิขสิทธิ์

/** ฉากโกดังสินค้าสำหรับแบนเนอร์ (พื้นหลังโปร่งใส ออกแบบให้วางบนพื้นสีฟ้าเข้ม) */
export function WarehouseScene({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 420 240" className={className} role="img" aria-label="ภาพประกอบโกดังสินค้าหงส์ทอง">
      {/* เมืองด้านหลัง */}
      <g fill="#FFFFFF" opacity="0.08">
        <rect x="18" y="96" width="34" height="110" rx="3" />
        <rect x="58" y="70" width="26" height="136" rx="3" />
        <rect x="320" y="84" width="30" height="122" rx="3" />
        <rect x="356" y="110" width="42" height="96" rx="3" />
      </g>
      {/* เส้นสีทองโค้งแบบโลโก้ */}
      <path d="M10 214 C 120 180, 260 176, 410 150" fill="none" stroke="#D4A017" strokeWidth="6" strokeLinecap="round" />
      <path d="M40 226 C 150 200, 270 196, 400 176" fill="none" stroke="#D4A017" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
      {/* ตัวโกดัง */}
      <path d="M96 196 V108 L196 52 L296 108 V196 Z" fill="#FFFFFF" opacity="0.95" />
      <path d="M86 112 L196 46 L306 112" fill="none" stroke="#D4A017" strokeWidth="8" strokeLinejoin="round" strokeLinecap="round" />
      <rect x="128" y="120" width="136" height="76" rx="4" fill="#164A85" />
      <g stroke="#FFFFFF" strokeOpacity="0.15" strokeWidth="2">
        <line x1="128" y1="136" x2="264" y2="136" />
        <line x1="128" y1="152" x2="264" y2="152" />
      </g>
      {/* กล่องสินค้า */}
      <g stroke="#B8860B" strokeWidth="1.5">
        <rect x="140" y="160" width="34" height="34" rx="2" fill="#D4A017" />
        <rect x="176" y="160" width="34" height="34" rx="2" fill="#E2B33A" />
        <rect x="158" y="128" width="34" height="32" rx="2" fill="#E2B33A" />
        <rect x="214" y="172" width="26" height="22" rx="2" fill="#D4A017" />
      </g>
      <g stroke="#FFFFFF" strokeOpacity="0.6" strokeWidth="1.5">
        <line x1="157" y1="160" x2="157" y2="172" />
        <line x1="193" y1="160" x2="193" y2="172" />
        <line x1="175" y1="128" x2="175" y2="138" />
      </g>
      {/* รถเข็น */}
      <g fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M300 128 h14 l14 52 h48 l12 -38 h-66" />
      </g>
      <g stroke="#FFFFFF" strokeWidth="3" opacity="0.8">
        <line x1="336" y1="150" x2="388" y2="150" />
        <line x1="352" y1="142" x2="356" y2="180" />
        <line x1="370" y1="142" x2="368" y2="180" />
      </g>
      <circle cx="338" cy="194" r="7" fill="#FFFFFF" />
      <circle cx="372" cy="194" r="7" fill="#FFFFFF" />
      {/* เส้นความเร็วสีทองหลังรถเข็น */}
      <g stroke="#D4A017" strokeWidth="4" strokeLinecap="round">
        <line x1="396" y1="132" x2="414" y2="128" />
        <line x1="398" y1="146" x2="416" y2="143" />
      </g>
      {/* ประกายดาว */}
      <g fill="#D4A017">
        <path d="M60 40 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
        <path d="M352 36 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" opacity="0.8" />
      </g>
    </svg>
  );
}

/** ลายจุดตกแต่งพื้นหลัง (ใช้ซ้อนหลังการ์ด) */
export function DotPattern({ className }: { className?: string }) {
  return (
    <svg className={className} aria-hidden>
      <defs>
        <pattern id="ht-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.5" fill="currentColor" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ht-dots)" />
    </svg>
  );
}
