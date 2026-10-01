const PAGE_SIZE = 1000; // Supabase คืนได้สูงสุด 1,000 แถวต่อครั้ง ต้องดึงเป็นหน้าๆ

/**
 * ดึงข้อมูลให้ครบทุกแถว (เช่น ประวัติเช็คอินทั้งบริษัททั้งเดือน ซึ่งเกิน 1,000 แถวได้ง่าย)
 * คืน null ถ้าหน้าใดหน้าหนึ่ง error (ไม่คืนข้อมูลครึ่งๆ กลางๆ)
 * query ต้องมี .order() เสมอ ไม่งั้นลำดับระหว่างหน้าไม่แน่นอน อาจได้แถวซ้ำ/ตกหล่น
 */
export async function fetchAllRows<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[] | null> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await fetchPage(from, from + PAGE_SIZE - 1);
    if (error || !data) return null;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}
