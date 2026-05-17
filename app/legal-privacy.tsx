import React from 'react';
import { Linking, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { DIETKU_PRIVACY_URL } from '@/lib/legalLinks';

const sections = [
  {
    title: '1. Ringkasan',
    body:
      Platform.OS === 'ios'
        ? 'Kebijakan Privasi ini menjelaskan bagaimana DietKu mengumpulkan, menggunakan, menyimpan, dan melindungi data pengguna sesuai kebutuhan layanan dan ketentuan App Store.'
        : 'Kebijakan Privasi ini menjelaskan bagaimana DietKu mengumpulkan, menggunakan, menyimpan, dan melindungi data pengguna sesuai kebutuhan layanan dan ketentuan Google Play.',
  },
  {
    title: '2. Data yang Kami Kumpulkan',
    body:
      'Kami dapat mengumpulkan data akun (email), data profil (nama, usia, tinggi, berat, target), data nutrisi, riwayat berat badan, aktivitas, serta data komunitas seperti posting, komentar, dan pesan grup.',
  },
  {
    title: '3. Data Foto',
    body:
      'Foto makanan yang Anda unggah ke fitur komunitas diproses dan disimpan untuk menampilkan posting di grup terkait. Foto kemajuan pada fitur tertentu yang disimpan lokal tidak dikirim ke server.',
  },
  {
    title: '4. Tujuan Pemrosesan',
    body:
      'Data digunakan untuk menyediakan fitur aplikasi, sinkronisasi antar perangkat, personalisasi target nutrisi, analisis tren, moderasi komunitas, serta peningkatan kualitas layanan.',
  },
  {
    title: '5. Dasar Pemrosesan dan Persetujuan',
    body:
      'Dengan menggunakan aplikasi, Anda memberikan persetujuan pemrosesan data yang diperlukan untuk operasional DietKu. Untuk akses perangkat tertentu (kamera/media/notifikasi), izin diminta terpisah melalui sistem Android/iOS.',
  },
  {
    title: '6. Penyimpanan dan Keamanan',
    body:
      'Data disimpan menggunakan infrastruktur backend dan langkah keamanan yang wajar. Meski demikian, tidak ada sistem yang sepenuhnya bebas risiko.',
  },
  {
    title: '7. Berbagi Data',
    body:
      'Kami tidak menjual data pribadi Anda. Data dapat diproses oleh penyedia infrastruktur tepercaya yang membantu menjalankan layanan (misalnya backend/database/storage) sesuai kebutuhan teknis.',
  },
  {
    title: '8. Hak Pengguna',
    body:
      'Anda dapat mengubah data profil di aplikasi, menghapus konten komunitas milik Anda, dan berhenti menggunakan layanan kapan saja. Permintaan penghapusan akun/data dapat diajukan melalui kanal kontak resmi.',
  },
  {
    title: '9. Retensi Data',
    body:
      'Data disimpan selama akun aktif atau selama diperlukan untuk tujuan layanan, kepatuhan hukum, dan penyelesaian sengketa. Beberapa data komunitas dapat memiliki batas retensi tertentu.',
  },
  {
    title: '10. Privasi Anak',
    body:
      'Layanan ini tidak ditujukan khusus untuk anak di bawah batas usia yang berlaku menurut hukum. Jika ditemukan data yang dikirim tanpa persetujuan yang sah, data dapat dihapus.',
  },
  {
    title: '11. Perubahan Kebijakan',
    body:
      'Kebijakan ini dapat diperbarui sewaktu-waktu. Perubahan signifikan akan ditampilkan melalui pembaruan halaman ini.',
  },
  {
    title: '12. Kontak',
    body:
      'Untuk pertanyaan terkait privasi atau permintaan data, hubungi tim DietKu melalui kanal kontak resmi yang tersedia di aplikasi/halaman store.',
  },
];

export default function LegalPrivacyScreen() {
  const { theme } = useTheme();
  const supportEmail = 'support@dietku.app';
  const openWebPrivacy = async () => {
    const canOpen = await Linking.canOpenURL(DIETKU_PRIVACY_URL);
    if (!canOpen) return;
    await Linking.openURL(DIETKU_PRIVACY_URL);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Kebijakan Privasi',
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
        <Text style={[styles.title, { color: theme.text }]}>Kebijakan Privasi DietKu</Text>
        <Text style={[styles.meta, { color: theme.textTertiary }]}>Terakhir diperbarui: 27 Maret 2026</Text>
        <TouchableOpacity
          style={[styles.webLinkBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
          onPress={openWebPrivacy}
          activeOpacity={0.75}
        >
          <Text style={styles.webLinkText}>Buka versi web terbaru</Text>
          <Text style={styles.webLinkUrl} numberOfLines={1}>
            {DIETKU_PRIVACY_URL}
          </Text>
        </TouchableOpacity>

        {sections.map((section) => (
          <View key={section.title} style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>{section.body}</Text>
          </View>
        ))}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Kontak Privasi</Text>
          <Text style={[styles.sectionBody, { color: theme.textSecondary }]}>
            Untuk pertanyaan privasi atau permintaan data, hubungi: {supportEmail}
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
