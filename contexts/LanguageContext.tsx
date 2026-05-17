import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useState, useEffect, useCallback } from 'react';

const LANGUAGE_KEY = 'app_language';

export type Language = 'id' | 'en';

export const translations = {
  id: {
    intro: {
      title: 'Pelacakan Nutrisi\ndengan AI',
      subtitle: 'Ambil foto, dapatkan info nutrisi instan. Tanpa input manual, tanpa tebakan—hanya pelacakan yang simpel dan cerdas.',
      start: 'Mulai',
      haveAccount: 'Sudah punya akun? Masuk',
    },
    dateOfBirth: {
      title: 'Kapan tanggal lahir Anda?',
      subtitle: 'Ini membantu kami menghitung kebutuhan kalori Anda',
      continue: 'Lanjutkan',
    },
    sex: {
      title: 'Apa jenis kelamin Anda?',
      subtitle: 'Kami akan menggunakan ini untuk membuat rencana khusus Anda',
      male: 'Pria',
      female: 'Wanita',
      next: 'Selanjutnya',
    },
    height: {
      title: 'Berapa tinggi badan Anda?',
      next: 'Selanjutnya',
    },
    weight: {
      title: 'Berapa berat badan Anda saat ini?',
      next: 'Selanjutnya',
    },
    goal: {
      title: 'Apa yang ingin Anda capai?',
      gain: 'Menambah Berat Badan',
      gainDesc: 'Bangun otot dan tingkatkan massa tubuh',
      maintain: 'Mempertahankan Berat Badan',
      maintainDesc: 'Jaga berat badan sehat yang stabil',
      lose: 'Menurunkan Berat Badan',
      loseDesc: 'Kurangi lemak dan capai berat sehat',
      next: 'Selanjutnya',
    },
    signIn: {
      title: 'Masuk ke Akun Anda',
      subtitle: 'Sinkronkan data Anda di semua perangkat',
      email: 'Email',
      password: 'Kata Sandi',
      showPassword: 'Tampilkan kata sandi',
      hidePassword: 'Sembunyikan kata sandi',
      signIn: 'Masuk',
      orContinueWith: 'Atau lanjutkan dengan',
      googleSignIn: 'Masuk dengan Google',
      skip: 'Lewati untuk sekarang',
      noAccount: 'Belum punya akun?',
      signUp: 'Daftar',
    },
    subscription: {
      title: 'Jadikan 2026 tahun di mana Anda akhirnya konsisten',
      subtitle: 'Menghitung kalori itu sulit. Mengambil foto itu mudah.',
      yearly: 'Tahunan',
      monthly: 'Bulanan',
      yearlyPrice: 'Rp 129.000/tahun',
      monthlyPrice: 'Rp 39.000/bulan',
      monthlyEquiv: '~Rp 10.750/bulan',
      startTransformation: 'Mulai Transformasi Saya',
      trial: 'Mulai gratis 3 hari • Penagihan dimulai setelah percobaan',
      annualTrialLead: 'Mulai gratis 3 hari',
      annualTrialDetail: 'Penagihan dimulai setelah percobaan',
      annualCtaSubline: 'Paket tahunan',
    },
    tabs: {
      dashboard: 'Dashboard',
      progress: 'Kemajuan',
      community: 'Komunitas',
      profile: 'Profil',
    },
    languagePicker: {
      title: 'Bahasa',
      subtitle: 'Pilih bahasa yang ingin Anda gunakan',
      indonesiaName: 'Indonesia',
      indonesiaNative: 'Bahasa Indonesia',
      englishName: 'English',
      englishNative: 'English (US)',
    },
    profile: {
      title: 'Profil',
      account: 'Akun',
      settings: 'Pengaturan',
      connectedAs: 'Terhubung sebagai',
      notSignedIn: 'Belum masuk',
      signIn: 'Masuk',
      signOut: 'Keluar',
      signOutTitle: 'Keluar',
      signOutMessage: 'Apakah Anda yakin ingin keluar?',
      cancel: 'Batal',
      language: 'Bahasa',
      theme: 'Tema',
      darkMode: 'Gelap',
      invites: 'Undangan & kode',
      personalInfo: 'Informasi Pribadi',
      name: 'Nama',
      age: 'Usia',
      yearsSuffix: 'tahun',
    },
  },
  en: {
    intro: {
      title: 'AI-Powered\nNutrition Tracking',
      subtitle: 'Take a photo, get instant nutrition info. No manual input, no guessing—just simple, smart tracking.',
      start: 'Get Started',
      haveAccount: 'Already have an account? Sign in',
    },
    dateOfBirth: {
      title: 'When is your birthday?',
      subtitle: 'This helps us calculate your calorie needs',
      continue: 'Continue',
    },
    sex: {
      title: 'What is your sex?',
      subtitle: 'We will use this to create your personalized plan',
      male: 'Male',
      female: 'Female',
      next: 'Next',
    },
    height: {
      title: 'What is your height?',
      next: 'Next',
    },
    weight: {
      title: 'What is your current weight?',
      next: 'Next',
    },
    goal: {
      title: 'What do you want to achieve?',
      gain: 'Gain Weight',
      gainDesc: 'Build muscle and increase body mass',
      maintain: 'Maintain Weight',
      maintainDesc: 'Keep a stable healthy weight',
      lose: 'Lose Weight',
      loseDesc: 'Reduce fat and achieve a healthy weight',
      next: 'Next',
    },
    signIn: {
      title: 'Sign In to Your Account',
      subtitle: 'Sync your data across all devices',
      email: 'Email',
      password: 'Password',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      signIn: 'Sign In',
      orContinueWith: 'Or continue with',
      googleSignIn: 'Sign in with Google',
      skip: 'Skip for now',
      noAccount: "Don't have an account?",
      signUp: 'Sign Up',
    },
    subscription: {
      title: 'Make 2026 the year you finally stay consistent',
      subtitle: 'Counting calories is hard. Taking photos is easy.',
      yearly: 'Yearly',
      monthly: 'Monthly',
      yearlyPrice: 'Rp 129,000/year',
      monthlyPrice: 'Rp 35,000/month',
      monthlyEquiv: '~Rp 10,750/mo equiv.',
      startTransformation: 'Start My Transformation',
      trial: 'Start free for 3 days • Billing starts after trial',
      annualTrialLead: 'Start free for 3 days',
      annualTrialDetail: 'Billing starts after trial',
      annualCtaSubline: 'Yearly plan',
    },
    tabs: {
      dashboard: 'Dashboard',
      progress: 'Progress',
      community: 'Community',
      profile: 'Profile',
    },
    languagePicker: {
      title: 'Language',
      subtitle: 'Choose the language you want to use',
      indonesiaName: 'Indonesian',
      indonesiaNative: 'Bahasa Indonesia',
      englishName: 'English',
      englishNative: 'English (US)',
    },
    profile: {
      title: 'Profile',
      account: 'Account',
      settings: 'Settings',
      connectedAs: 'Connected as',
      notSignedIn: 'Not signed in',
      signIn: 'Sign In',
      signOut: 'Sign Out',
      signOutTitle: 'Sign Out',
      signOutMessage: 'Are you sure you want to sign out?',
      cancel: 'Cancel',
      language: 'Language',
      theme: 'Theme',
      darkMode: 'Dark',
      invites: 'Invites & code',
      personalInfo: 'Personal Information',
      name: 'Name',
      age: 'Age',
      yearsSuffix: 'years',
    },
  },
};

export const [LanguageProvider, useLanguage] = createContextHook(() => {
  const [language, setLanguage] = useState<Language>('id');

  const languageQuery = useQuery({
    queryKey: ['app_language'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(LANGUAGE_KEY);
      return (stored as Language) || 'id';
    },
  });

  const saveLanguageMutation = useMutation({
    mutationFn: async (lang: Language) => {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      return lang;
    },
    onSuccess: (data) => {
      setLanguage(data);
    },
  });

  useEffect(() => {
    if (languageQuery.data !== undefined) {
      setLanguage(languageQuery.data);
    }
  }, [languageQuery.data]);

  const toggleLanguage = () => {
    const newLang = language === 'id' ? 'en' : 'id';
    saveLanguageMutation.mutate(newLang);
  };

  const t = translations[language];
  const l = useCallback(
    (idText: string, enText: string) => (language === 'id' ? idText : enText),
    [language]
  );

  return {
    language,
    setLanguage: (lang: Language) => saveLanguageMutation.mutate(lang),
    toggleLanguage,
    t,
    l,
    isLoading: languageQuery.isLoading,
  };
});
