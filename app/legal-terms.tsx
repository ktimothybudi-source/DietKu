import React from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { DIETKU_TERMS_URL } from '@/lib/legalLinks';

const sections = [
  {
    title: '1. Persetujuan Pengguna',
    body:
      'Dengan mengakses atau menggunakan DietKu, Anda menyetujui Ketentuan Layanan ini. Jika Anda tidak setuju, mohon untuk tidak menggunakan aplikasi.',
  },
  {
    title: '2. Layanan DietKu',
    body:
      'DietKu menyediakan fitur pelacakan nutrisi, berat badan, aktivitas, komunitas, dan analisis makanan. Informasi dalam aplikasi bersifat edukatif dan bukan pengganti nasihat medis profesional.',
  },
  {
    title: '3. Akun dan Keamanan',
    body:
      'Anda bertanggung jawab menjaga kerahasiaan akun, email, dan kata sandi Anda. Anda wajib memberikan data yang akurat dan memperbaruinya jika berubah.',
  },
  {
    title: '4. Konten Pengguna',
    body:
      'Anda bertanggung jawab atas konten yang Anda unggah, termasuk foto makanan, komentar, dan pesan komunitas. Dilarang mengunggah konten yang melanggar hukum, menyesatkan, atau merugikan pihak lain.',
  },
  {
    title: '5. Penggunaan yang Dilarang',
    body:
      'Dilarang menggunakan aplikasi untuk spam, penyalahgunaan sistem, percobaan akses ilegal, penipuan, atau aktivitas yang dapat mengganggu pengguna lain maupun infrastruktur layanan.',
  },
  {
    title: '6. Privasi dan Data',
    body:
      'Penggunaan data pribadi diatur dalam Kebijakan Privasi DietKu. Dengan menggunakan aplikasi, Anda juga menyetujui praktik pemrosesan data sebagaimana dijelaskan dalam Kebijakan Privasi.',
  },
  {
    title: '7. Pembelian dan Langganan',
    body:
      Platform.OS === 'ios'
        ? 'Jika ada fitur berbayar/langganan, detail harga, penagihan, perpanjangan, dan pembatalan mengikuti ketentuan App Store dan ditampilkan sebelum transaksi.'
        : 'Jika ada fitur berbayar/langganan, detail harga, penagihan, perpanjangan, dan pembatalan mengikuti ketentuan Google Play dan ditampilkan sebelum transaksi.',
  },
  {
    title: '8. Pembatasan Tanggung Jawab',
    body:
      'DietKu tidak menjamin hasil kesehatan tertentu. Keputusan diet, olahraga, dan medis tetap menjadi tanggung jawab pengguna. Konsultasikan dengan tenaga medis untuk kondisi khusus.',
  },
  {
    title: '9. Perubahan Layanan',
    body:
      'Kami dapat menambah, mengubah, atau menghentikan fitur tertentu sewaktu-waktu demi perbaikan layanan, keamanan, atau kepatuhan hukum.',
  },
  {
    title: '10. Perubahan Ketentuan',
    body:
      'Ketentuan Layanan ini dapat diperbarui dari waktu ke waktu. Versi terbaru akan tersedia di halaman ini, dan tanggal pembaruan akan disesuaikan.',
  },
  {
    title: '11. Hukum yang Berlaku',
    body:
      'Ketentuan ini ditafsirkan berdasarkan hukum yang berlaku di Republik Indonesia.',
  },
  {
    title: '12. Kontak',
    body:
      'Untuk pertanyaan terkait ketentuan ini, silakan hubungi tim DietKu melalui kanal kontak resmi yang tersedia di aplikasi/halaman store.',
  },
];

export default function LegalTermsScreen() {
  const { theme } = useTheme();
  const supportEmail = 'support@dietku.app';
  const openWebTerms = async () => {
    const canOpen = await Linking.canOpenURL(DIETKU_TERMS_URL);
    if (!canOpen) return;
    await Linking.openURL(DIETKU_TERMS_URL);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Ketentuan Layanan',
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.text,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              style={styles.headerBack}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (router.canGoBack()) {
                  router.back();
                } else {
                  router.replace('/(tabs)/profile');
                }
              }}
            >
              <ChevronLeft size={18} color={theme.text} />
              <Text style={[styles.headerBackText, { color: theme.text }]}>Kembali</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.background }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.title, { color: theme.text }]}>Ketentuan Layanan DietKu</Text>
        <Text style={[styles.meta, { color: theme.textTertiary }]}>Terakhir diperbarui: 27 Maret 2026</Text>
        <TouchableOpacity
          style={[styles.webLinkBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={openWebTerms}
          activeOpacity={0.75}
        >
          <Text style={styles.webLinkText}>Buka versi web terbaru</Text>
          <Text style={styles.webLinkUrl} numberOfLines={1}>
            {DIETKU_TERMS_URL}
          </Text>
        </TouchableOpacity>

        {sections.map((section) => (
          <View key={section.title} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{section.body}</Text>
          </View>
        ))}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Kontak Dukungan</Text>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>
            Untuk pertanyaan hukum dan layanan, hubungi kami di: {supportEmail}
          </Text>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28, gap: 10 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  meta: { fontSize: 12, marginBottom: 4 },
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  sectionBody: { fontSize: 13, lineHeight: 19 },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBackText: { fontSize: 15, fontWeight: '600' },
  webLinkBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
    marginBottom: 4,
  },
  webLinkText: { fontSize: 13, fontWeight: '700', color: '#22C55E' },
  webLinkUrl: { fontSize: 12, color: '#6E6E82' },
});
