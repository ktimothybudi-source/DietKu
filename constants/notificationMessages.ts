/**
 * Indonesian push / local notification copy for DietKu.
 * Used for daily food-scan reminders and group activity alerts.
 */

export type NotificationCopy = {
  title: string;
  body: string;
};

/** Daily meal / food-scan reminders — “jangan lupa scan makanan”. */
export const SCAN_REMINDER_MESSAGES: NotificationCopy[] = [
  {
    title: 'Jangan lupa scan makananmu 📸',
    body: 'Ambil foto makananmu biar kalorinya tercatat dengan akurat!',
  },
  {
    title: 'Sudah makan hari ini? 🍽️',
    body: 'Yuk scan dulu sebelum lupa. Tracking konsisten = hasil lebih cepat.',
  },
  {
    title: 'Waktunya catat makanan 🔥',
    body: 'Buka kamera DietKu dan scan piringmu sekarang.',
  },
  {
    title: 'Jangan lewati log hari ini ✨',
    body: 'Beberapa detik scan foto = data nutrisi yang lengkap.',
  },
  {
    title: 'Makan dulu, scan dulu 👀',
    body: 'Ingat, setiap makanan yang terlewat sulit ditrack kembali.',
  },
  {
    title: 'Halo, sudah scan belum? 🙋',
    body: 'Ayo update food log kamu biar progress tetap on track.',
  },
  {
    title: 'Saatnya scan sarapan/makanan 🌅',
    body: 'Mulai dari sekarang biar sisa harinya lebih mudah diatur.',
  },
  {
    title: 'Reminder DietKu 💚',
    body: 'Jangan lupa foto dan catat makananmu hari ini ya!',
  },
  {
    title: 'Piring sudah kosong? 📸',
    body: 'Kalau sudah makan, langsung scan biar tidak terlupa.',
  },
  {
    title: 'Konsistensi dimulai hari ini 💪',
    body: 'Scan makananmu sekarang — kecil, tapi berdampak besar.',
  },
  {
    title: 'Log makananmu masih menunggu ⏳',
    body: 'Buka DietKu dan catat apa yang kamu makan.',
  },
  {
    title: 'Hey, jangan skip tracking! 🚫',
    body: 'Scan makanan membantu kamu paham pola makan harian.',
  },
];

/** Evening / streak style reminders. */
export const STREAK_REMINDER_MESSAGES: NotificationCopy[] = [
  {
    title: 'Streak kamu masih aman 💪',
    body: 'Yuk log makananmu sebelum hari berakhir!',
  },
  {
    title: 'Jaga streak-mu tetap hidup 🔥',
    body: 'Masih sempat catat makanan hari ini. Ayo selesaikan!',
  },
  {
    title: 'Hampir tutup hari 🌙',
    body: 'Cek dulu — sudah semua makananmu di-log belum?',
  },
  {
    title: 'Satu langkah lagi 🏅',
    body: 'Scan atau catat makanan terakhir biar streak tidak putus.',
  },
  {
    title: 'Jangan biarkan streak hilang 😮‍💨',
    body: 'Buka DietKu dan lengkapi log harianmu sekarang.',
  },
  {
    title: 'Progress hari ini menunggu 📊',
    body: 'Log makanan malam biar ringkasan harimu lengkap.',
  },
];

/** Midday check-ins. */
export const MIDDAY_REMINDER_MESSAGES: NotificationCopy[] = [
  {
    title: 'Sudah makan siang? 🍱',
    body: 'Scan makan siangmu biar kalori siang tetap terpantau.',
  },
  {
    title: 'Check-in siang DietKu ☀️',
    body: 'Jangan lupa catat camilan atau makan siangnya ya!',
  },
  {
    title: 'Energi tengah hari ⚡',
    body: 'Ambil foto makananmu supaya tracking tetap akurat.',
  },
  {
    title: 'Separuh hari sudah lewat 🕐',
    body: 'Bagaimana log makananmu sejauh ini? Yuk update.',
  },
];

/**
 * Templates for when a group member scans / logs food.
 * Placeholders: {name}, {food}, {calories}
 */
export const COMMUNITY_SCAN_MESSAGES: NotificationCopy[] = [
  {
    title: '{name} baru saja scan makanan 📸',
    body: '{food} · {calories} kkal — lihat di grup komunitasmu!',
  },
  {
    title: '{name} lagi nge-log makanan 🍽️',
    body: 'Baru catat {food} ({calories} kkal). Cek feed grupmu!',
  },
  {
    title: 'Update dari {name} 🔥',
    body: 'Baru scan {food} — {calories} kkal. Lihat post-nya di komunitas.',
  },
  {
    title: '{name} baru makan! 😋',
    body: '{food} ({calories} kkal) sudah di-log. Yuk lihat detailnya.',
  },
  {
    title: 'Ada post baru di grup 👥',
    body: '{name} scan {food} · {calories} kkal. Buka DietKu untuk melihat.',
  },
  {
    title: '{name} konsisten logging 💪',
    body: 'Baru saja: {food} ({calories} kkal). Support teman grupmu!',
  },
];

/** Daily local reminder slots (device local time). */
export const DAILY_REMINDER_SLOTS: {
  id: string;
  hour: number;
  minute: number;
  pool: 'scan' | 'midday' | 'streak';
}[] = [
  { id: 'reminder-morning', hour: 8, minute: 0, pool: 'scan' },
  { id: 'reminder-midday', hour: 12, minute: 30, pool: 'midday' },
  { id: 'reminder-afternoon', hour: 15, minute: 30, pool: 'scan' },
  { id: 'reminder-evening', hour: 19, minute: 0, pool: 'scan' },
  { id: 'reminder-streak', hour: 20, minute: 30, pool: 'streak' },
];

function poolFor(kind: 'scan' | 'midday' | 'streak'): NotificationCopy[] {
  if (kind === 'midday') return MIDDAY_REMINDER_MESSAGES;
  if (kind === 'streak') return STREAK_REMINDER_MESSAGES;
  return SCAN_REMINDER_MESSAGES;
}

/** Deterministic pick so the same slot re-schedules with a stable daily message. */
export function pickDailyReminderMessage(
  pool: 'scan' | 'midday' | 'streak',
  slotId: string,
  date: Date = new Date()
): NotificationCopy {
  const messages = poolFor(pool);
  const daySeed = date.getFullYear() * 1000 + date.getMonth() * 50 + date.getDate();
  const slotSeed = slotId.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const index = Math.abs(daySeed + slotSeed) % messages.length;
  return messages[index];
}

export function formatCommunityScanMessage(
  displayName: string,
  foodName: string,
  calories: number,
  indexSeed?: number
): NotificationCopy {
  const seed =
    indexSeed ??
    Math.abs(
      displayName.split('').reduce((a, c) => a + c.charCodeAt(0), 0) +
        foodName.length +
        Math.round(calories)
    );
  const template = COMMUNITY_SCAN_MESSAGES[seed % COMMUNITY_SCAN_MESSAGES.length];
  const name = displayName.trim() || 'Teman grup';
  const food = foodName.trim() || 'makanan';
  const cals = String(Math.round(calories) || 0);

  return {
    title: template.title
      .replace(/\{name\}/g, name)
      .replace(/\{food\}/g, food)
      .replace(/\{calories\}/g, cals),
    body: template.body
      .replace(/\{name\}/g, name)
      .replace(/\{food\}/g, food)
      .replace(/\{calories\}/g, cals),
  };
}

/** All reminder copy flattened (for docs / debugging). */
export const ALL_REMINDER_MESSAGES: NotificationCopy[] = [
  ...SCAN_REMINDER_MESSAGES,
  ...MIDDAY_REMINDER_MESSAGES,
  ...STREAK_REMINDER_MESSAGES,
];
