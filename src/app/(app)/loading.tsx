// ระหว่างโหลดข้อมูลหน้าใหม่: โครงหน้าจางๆ แทนหน้าว่าง (เมนูด้านข้างยังกดได้)
export default function Loading() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="กำลังโหลด">
      <div className="h-[120px] animate-pulse rounded-[1.75rem] bg-gradient-to-br from-[#1E5FA8]/40 to-[#0F2D52]/30" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="ht-card h-32 animate-pulse p-6">
            <div className="h-10 w-10 rounded-xl bg-[#EAF3FC]" />
            <div className="mt-4 h-3 w-1/2 rounded-full bg-[#EAF3FC]" />
          </div>
        ))}
      </div>
      <div className="ht-card h-64 animate-pulse" />
    </div>
  );
}
