import React from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { useTheme } from '@/contexts/ThemeContext';
import { ChevronLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useSubscription } from '@/contexts/SubscriptionContext';

const items = [
  Platform.OS === 'ios'
    ? 'Fitur Pulihkan Pembelian digunakan untuk memulihkan akses pembelian/langganan yang valid pada Apple ID yang sama.'
    : 'Fitur Pulihkan Pembelian digunakan untuk memulihkan akses pembelian/langganan yang valid pada akun Google Play yang sama.',
  'Pemulihan tidak membuat pembelian baru dan tidak melakukan penagihan ulang.',
  Platform.OS === 'ios'
    ? 'Pembelian harus berasal dari aplikasi DietKu resmi di App Store.'
    : 'Pembelian harus berasal dari aplikasi DietKu resmi di Google Play.',
  Platform.OS === 'ios'
    ? 'Pastikan Anda login dengan Apple ID yang sama saat melakukan pembelian sebelumnya.'
    : 'Pastikan Anda login dengan akun Google yang sama saat melakukan pembelian sebelumnya.',
  'Jika status tidak langsung berubah, tunggu beberapa menit lalu coba lagi dengan koneksi internet stabil.',
  Platform.OS === 'ios'
    ? 'Jika tetap gagal, hubungi dukungan dengan menyertakan email akun, waktu transaksi, dan bukti pembelian dari App Store.'
    : 'Jika tetap gagal, hubungi dukungan dengan menyertakan email akun, waktu transaksi, dan bukti pembelian dari Google Play.',
];

export default function LegalRestorePurchaseScreen() {
  const { theme } = useTheme();
  const { restorePurchases, purchaseBusy } = useSubscription();
  const supportEmail = 'support@dietku.app';

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Pulihkan Pembelian',
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
        <Text style={[styles.title, { color: theme.text }]}>Pulihkan Pembelian DietKu</Text>
        <Text style={[styles.meta, { color: theme.textTertiary }]}>
          {Platform.OS === 'ios' ? 'Informasi untuk pengguna App Store' : 'Informasi untuk pengguna Google Play'}
        </Text>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {items.map((item) => (
            <View key={item} style={styles.row}>
              <Text style={[styles.bullet, { color: theme.primary }]}>•</Text>
              <Text style={[styles.text, { color: theme.textSecondary }]}>{item}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Catatan Penting</Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Saat ini, jika fitur langganan belum aktif di versi aplikasi Anda, tombol ini hanya menampilkan informasi.
            {Platform.OS === 'ios'
              ? ' Setelah langganan diaktifkan, proses pemulihan akan mengikuti sistem billing App Store.'
              : ' Setelah langganan diaktifkan, proses pemulihan akan mengikuti sistem billing Google Play.'}
          </Text>
          <Text style={[styles.text, { color: theme.textSecondary }]}>
            Butuh bantuan pembelian? Hubungi: {supportEmail}
          </Text>
          <TouchableOpacity
            style={[styles.restoreButton, purchaseBusy && styles.restoreButtonDisabled]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              void restorePurchases();
            }}
            disabled={purchaseBusy}
            activeOpacity={0.85}
          >
            <Text style={styles.restoreButtonText}>
              {purchaseBusy ? 'Memulihkan...' : 'Pulihkan Pembelian Sekarang'}
            </Text>
          </TouchableOpacity>
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
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 14, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bullet: { fontSize: 16, lineHeight: 18, marginTop: 1 },
  text: { flex: 1, fontSize: 13, lineHeight: 19 },
  headerBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  headerBackText: { fontSize: 15, fontWeight: '600' },
  restoreButton: {
    marginTop: 4,
    borderRadius: 12,
    backgroundColor: '#22C55E',
    paddingVertical: 12,
    alignItems: 'center',
  },
  restoreButtonDisabled: { opacity: 0.6 },
  restoreButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
