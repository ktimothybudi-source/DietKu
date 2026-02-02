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
