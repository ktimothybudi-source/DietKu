export type ScanLanguage = 'id' | 'en';

/** Map server/technical errors to user-facing copy. */
export function mapScanErrorToUserMessage(
  raw: string,
  language: ScanLanguage = 'id'
): string {
  const en = language === 'en';
  const lower = raw.toLowerCase();

  if (raw === 'MEAL_ANALYSIS_PARSE_FAILED' || lower.includes('parse_failed')) {
    return en
      ? 'Could not read the analysis. Please try again.'
      : 'Gagal membaca hasil analisis. Silakan coba lagi.';
  }
  if (raw === 'MEAL_ANALYSIS_VALIDATION_FAILED') {
    return en
      ? 'Analysis format was invalid. Please try again.'
      : 'Format hasil tidak valid. Silakan coba lagi.';
  }
  if (lower.includes('daily scan limit')) {
    return en ? 'Daily scan limit reached.' : 'Batas scan harian tercapai.';
  }
  if (lower.includes('rate limit')) {
    return en ? 'Too many requests. Please wait a moment.' : 'Terlalu banyak permintaan. Tunggu sebentar.';
  }
  if (lower.includes('payload too large') || lower.includes('terlalu besar')) {
    return en
      ? 'Image is too large. Try a photo from slightly farther away.'
      : 'Gambar terlalu besar. Coba foto dari jarak sedikit lebih jauh.';
  }
  if (lower.includes('network request failed') || lower.includes('network')) {
    return en
      ? 'Connection failed. Check your internet and try again.'
      : 'Koneksi gagal. Periksa internet dan coba lagi.';
  }
  if (lower.includes('terpotong') || lower.includes('truncat') || raw === 'MEAL_ANALYSIS_TRUNCATED') {
    return en
      ? 'Response was cut off (large meal). Tap Try Again.'
      : 'Respons terpotong (porsi banyak). Ketuk Coba Lagi.';
  }
  if (lower.includes('openai_not_configured')) {
    return en ? 'Server is not configured. Try again later.' : 'Server belum dikonfigurasi. Coba lagi nanti.';
  }

  return raw;
}
