export interface MotivationalMessage {
  text: string;
  emoji?: string;
}

export const morningMessages: MotivationalMessage[] = [
  { text: "Pagi yang cerah untuk memulai hari sehat!", emoji: "🌅" },
  { text: "Sarapan yang baik = energi sepanjang hari", emoji: "☀️" },
  { text: "Langkah kecil hari ini, perubahan besar besok", emoji: "🌱" },
  { text: "Tubuhmu akan berterima kasih hari ini", emoji: "💪" },
  { text: "Mulai harimu dengan penuh semangat!", emoji: "✨" },
];

export const afternoonMessages: MotivationalMessage[] = [
  { text: "Tetap konsisten, kamu sudah di jalur yang benar", emoji: "🎯" },
  { text: "Jangan lupa minum air ya!", emoji: "💧" },
  { text: "Istirahat sejenak itu penting", emoji: "🌿" },
  { text: "Kamu sudah melakukan yang terbaik hari ini", emoji: "⭐" },
  { text: "Setiap pilihan sehat adalah kemenangan", emoji: "🏆" },
];

export const eveningMessages: MotivationalMessage[] = [
  { text: "Makan malam yang seimbang untuk tidur nyenyak", emoji: "🌙" },
  { text: "Kamu hebat sudah melewati hari ini!", emoji: "🌟" },
  { text: "Besok adalah kesempatan baru", emoji: "🌈" },
  { text: "Tubuhmu butuh istirahat yang cukup", emoji: "😴" },
  { text: "Refleksikan pencapaianmu hari ini", emoji: "💫" },
];

export const progressMessages = {
  onTrack: [
    { text: "Kamu di jalur yang tepat! Pertahankan!", emoji: "🔥" },
    { text: "Progress yang luar biasa hari ini!", emoji: "💪" },
    { text: "Konsistensi adalah kunci, dan kamu punya itu!", emoji: "🏅" },
  ],
  underTarget: [
    { text: "Masih ada ruang untuk makan sehat", emoji: "🥗" },
    { text: "Jangan lupa penuhi kebutuhan nutrisimu", emoji: "🍎" },
    { text: "Tubuhmu butuh bahan bakar yang cukup", emoji: "⚡" },
  ],
  overTarget: [
    { text: "Tidak apa-apa, besok selalu ada kesempatan baru", emoji: "🌱" },
    { text: "Satu hari tidak menentukan perjalananmu", emoji: "💚" },
    { text: "Yang penting adalah kembali ke track", emoji: "🎯" },
  ],
  proteinGoal: [
    { text: "Protein tercukupi! Otot-ototmu senang!", emoji: "💪" },
    { text: "Target protein tercapai, kerja bagus!", emoji: "🥩" },
  ],
  streakMessages: [
    { text: "Streak-mu luar biasa! Terus semangat!", emoji: "🔥" },
    { text: "Konsistensi adalah superpower-mu!", emoji: "⚡" },
    { text: "Streak yang menakjubkan! Jangan putus!", emoji: "🏆" },
  ],
};

export const getTimeBasedMessage = (): MotivationalMessage => {
  const hour = new Date().getHours();
  let messages: MotivationalMessage[];
  
  if (hour >= 5 && hour < 11) {
    messages = morningMessages;
  } else if (hour >= 11 && hour < 17) {
    messages = afternoonMessages;
  } else {
    messages = eveningMessages;
  }
  
  return messages[Math.floor(Math.random() * messages.length)];
};

export interface CalorieFeedback {
  text: string;
  emoji: string;
  type: 'over' | 'under' | 'ontrack';
}

export const getCalorieFeedback = (
  caloriesOver: number,
  goal: 'fat_loss' | 'maintenance' | 'muscle_gain',
  targetCalories: number
): CalorieFeedback | null => {
  const percentOver = (caloriesOver / targetCalories) * 100;
  
  if (caloriesOver > 0 && percentOver >= 5) {
    if (goal === 'fat_loss') {
      const messages = [
        { text: `${caloriesOver} kcal lebih - tidak apa-apa, yang penting tetap semangat! 🌟`, emoji: "🌱" },
        { text: `Lebih ${caloriesOver} kcal hari ini. Besok kesempatan baru untuk kembali fokus! 💚`, emoji: "🌈" },
        { text: `+${caloriesOver} kcal - satu hari tidak mendefinisikan perjalananmu! 🙌`, emoji: "💪" },
        { text: `Kamu sudah tracking dengan baik! (+${caloriesOver} kcal) Itu yang penting 📊`, emoji: "⭐" },
      ];
      return { ...messages[Math.floor(Math.random() * messages.length)], type: 'over' };
    } else if (goal === 'muscle_gain') {
      const messages = [
        { text: `+${caloriesOver} kcal - surplus untuk pertumbuhan otot! 💪`, emoji: "🔥" },
        { text: `${caloriesOver} kcal ekstra untuk energi dan pemulihan! 🏋️`, emoji: "💪" },
        { text: `Lebih ${caloriesOver} kcal - bahan bakar untuk ototmu! 🎯`, emoji: "⚡" },
      ];
      return { ...messages[Math.floor(Math.random() * messages.length)], type: 'over' };
    } else {
      const messages = [
        { text: `+${caloriesOver} kcal hari ini - tetap pantau terus ya! 📊`, emoji: "🌱" },
        { text: `Lebih ${caloriesOver} kcal - seimbangkan besok dengan lebih ringan 🌿`, emoji: "💚" },
      ];
      return { ...messages[Math.floor(Math.random() * messages.length)], type: 'over' };
    }
  }
  
  const caloriesUnder = Math.abs(caloriesOver);
  const percentUnder = (caloriesUnder / targetCalories) * 100;
  
  if (caloriesOver < 0 && percentUnder >= 30) {
    if (goal === 'fat_loss') {
      const messages = [
        { text: `Masih ${caloriesUnder} kcal tersisa - defisit yang bagus! 🎯`, emoji: "✨" },
        { text: `${caloriesUnder} kcal di bawah target - progres yang luar biasa! 🌟`, emoji: "💪" },
        { text: `Sisa ${caloriesUnder} kcal - kamu di jalur yang tepat! 🔥`, emoji: "🏆" },
      ];
      return { ...messages[Math.floor(Math.random() * messages.length)], type: 'under' };
    } else if (goal === 'muscle_gain') {
      const messages = [
        { text: `Masih ${caloriesUnder} kcal lagi - otot butuh nutrisi untuk tumbuh! 🥗`, emoji: "💪" },
        { text: `${caloriesUnder} kcal tersisa - jangan lupa snack protein! 🍳`, emoji: "🌱" },
        { text: `Kurang ${caloriesUnder} kcal - tambah makanan untuk dukung pertumbuhanmu! 🎯`, emoji: "⚡" },
      ];
      return { ...messages[Math.floor(Math.random() * messages.length)], type: 'under' };
    } else {
      const messages = [
        { text: `${caloriesUnder} kcal tersisa - pastikan tubuh cukup energi ya! 🌿`, emoji: "💚" },
        { text: `Masih ${caloriesUnder} kcal - dengarkan tubuhmu jika lapar 🍎`, emoji: "🌱" },
      ];
      return { ...messages[Math.floor(Math.random() * messages.length)], type: 'under' };
    }
  }
  
  return null;
};

export const getProgressMessage = (
  caloriesProgress: number,
  proteinProgress: number,
  streak: number
): MotivationalMessage => {
  if (streak >= 7) {
    const streakMsgs = progressMessages.streakMessages;
    return streakMsgs[Math.floor(Math.random() * streakMsgs.length)];
  }
  
  if (proteinProgress >= 90) {
    const proteinMsgs = progressMessages.proteinGoal;
    return proteinMsgs[Math.floor(Math.random() * proteinMsgs.length)];
  }
  
  if (caloriesProgress > 110) {
    const overMsgs = progressMessages.overTarget;
    return overMsgs[Math.floor(Math.random() * overMsgs.length)];
  }
  
  if (caloriesProgress >= 70 && caloriesProgress <= 110) {
    const onTrackMsgs = progressMessages.onTrack;
    return onTrackMsgs[Math.floor(Math.random() * onTrackMsgs.length)];
  }
  
  const underMsgs = progressMessages.underTarget;
  return underMsgs[Math.floor(Math.random() * underMsgs.length)];
};
