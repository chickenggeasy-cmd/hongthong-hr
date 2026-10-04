// เสียงแจ้งเตือน "ติ๊ง-ต่อง" สังเคราะห์ด้วย Web Audio (ไม่ต้องมีไฟล์เสียง โหลดเร็ว ไม่มีลิขสิทธิ์)
// เบราว์เซอร์ไม่ยอมเล่นเสียงจนกว่าผู้ใช้จะแตะ/คลิกหน้าเว็บสักครั้ง จึง "ปลดล็อก" ไว้ตั้งแต่การแตะครั้งแรก

const SOUND_PREF_KEY = "ht-notify-sound";

let context: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  context ??= new Ctor();
  return context;
}

/** เรียกครั้งเดียวตอนหน้าเว็บโหลด: แตะ/คลิก/กดปุ่มครั้งแรกจะเปิดระบบเสียงไว้ให้ */
export function unlockAudioOnFirstGesture(): () => void {
  const unlock = () => {
    const ctx = audioContext();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  };
  const events = ["pointerdown", "keydown", "touchstart"] as const;
  for (const e of events) window.addEventListener(e, unlock, { once: true, passive: true });
  return () => {
    for (const e of events) window.removeEventListener(e, unlock);
  };
}

/** เล่นเสียงแจ้งเตือนสั้นๆ 2 โน้ต (เงียบไปเฉยๆ ถ้าเบราว์เซอร์ยังไม่ให้เล่น) */
export function playChime(): void {
  const ctx = audioContext();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();

  const start = ctx.currentTime + 0.02;
  // B5 → E6 ไล่ขึ้น ฟังเป็นมิตร ไม่ตกใจ
  const notes: [frequency: number, offset: number][] = [
    [987.77, 0],
    [1318.51, 0.14],
  ];
  for (const [frequency, offset] of notes) {
    const t = start + offset;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.16, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    gain.connect(ctx.destination);

    // เสียงหลัก + เสียงประสานเบาๆ ให้ฟังกลมขึ้น
    for (const [type, mult, level] of [
      ["sine", 1, 1],
      ["triangle", 2, 0.12],
    ] as const) {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(frequency * mult, t);
      g.gain.value = level;
      osc.connect(g).connect(gain);
      osc.start(t);
      osc.stop(t + 0.6);
    }
  }
}

/** เปิด/ปิดเสียง จำไว้ในเครื่องนี้ (ค่าเริ่มต้น: เปิด) */
export function readSoundPreference(): boolean {
  try {
    return window.localStorage.getItem(SOUND_PREF_KEY) !== "off";
  } catch {
    return true;
  }
}

export function writeSoundPreference(on: boolean): void {
  try {
    window.localStorage.setItem(SOUND_PREF_KEY, on ? "on" : "off");
  } catch {
    // โหมดส่วนตัว/บล็อกการเก็บข้อมูล: ใช้ค่าในหน่วยความจำไปก่อน
  }
}
