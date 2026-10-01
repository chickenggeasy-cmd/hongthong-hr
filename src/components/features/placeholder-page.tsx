export function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm">
      <h1 className="text-lg font-semibold text-[#1A1A1A]">{title}</h1>
      <p className="mt-1 text-sm text-[#5B6B7B]">หน้านี้ยังไม่ได้พัฒนา</p>
    </div>
  );
}