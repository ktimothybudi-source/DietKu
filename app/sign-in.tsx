import React, { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Mail } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Svg, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { supabase } from '@/lib/supabase';
import { stashPendingReferralCode } from '@/lib/pendingReferralCode';
import { peekPendingGroupInviteCode } from '@/lib/pendingGroupInviteCode';

WebBrowser.maybeCompleteAuthSession();

/** Toggle to show Google OAuth on the sign-in screen. */
const SHOW_GOOGLE_SIGN_IN = true;

const FORM_MAX_WIDTH = 440;

export default function SignInScreen() {
  const params = useLocalSearchParams<{ ref?: string | string[] }>();
  const { t, l } = useLanguage();
  const { signIn } = useNutrition();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const formPad = Math.max(16, (windowWidth - FORM_MAX_WIDTH) / 2);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [isSigningIn, setIsSigningIn] = useState<boolean>(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState<boolean>(false);
  const [isResending, setIsResending] = useState<boolean>(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);

  useEffect(() => {
    const rawRef = params.ref;
    const refStr = typeof rawRef === 'string' ? rawRef : rawRef?.[0];
    if (refStr?.trim()) {
      void stashPendingReferralCode(refStr);
    }
  }, [params.ref]);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      console.log('Auth state changed in sign-in screen:', event);
      if (event === 'SIGNED_IN') {
        await checkProfileAndNavigate();
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  const checkProfileAndNavigate = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        console.log('No user found after auth, navigating to tabs');
        router.replace('/(tabs)');
        return;
      }

      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Profile fetch error during navigation:', error);
      }

      console.log('Profile data after auth:', profile);

      const isProfileComplete = Boolean(
        profile?.height && profile?.weight && profile?.goal && profile?.activity_level
      );

      if (isProfileComplete) {
        console.log('Profile is complete, navigating to tabs');
        try {
          const pendingGroupCode = await peekPendingGroupInviteCode();
          if (pendingGroupCode) {
            router.replace(`/browse-groups?code=${encodeURIComponent(pendingGroupCode)}`);
            return;
          }
        } catch {
          // fall through to tabs
        }
        router.replace('/(tabs)');
        return;
      }

      console.log('Profile incomplete, redirecting to onboarding');
      router.replace('/onboarding?mode=complete');
    } catch (error) {
      console.error('Error checking profile:', error);
      router.replace('/(tabs)');
    }
  };

  const handleResendVerification = async (targetEmail?: string) => {
    const emailToUse = targetEmail ?? unverifiedEmail ?? email.trim();

    if (!emailToUse) {
      Alert.alert(l('Error', 'Error'), l('Masukkan email kamu dulu ya.', 'Please enter your email first.'));
      return;
    }

    setIsResending(true);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailToUse,
      });

      if (error) {
        console.error('Resend verification error:', error);
        Alert.alert(l('Error', 'Error'), l('Gagal kirim ulang email. Coba lagi nanti.', 'Failed to resend email. Please try again later.'));
        return;
      }

      Alert.alert(
        l('Email Terkirim', 'Email Sent'),
        l(
          `Link verifikasi sudah dikirim ke ${emailToUse}. Cek inbox atau folder spam kamu.`,
          `Verification link has been sent to ${emailToUse}. Check your inbox or spam folder.`
        )
      );
    } catch (error) {
      console.error('Unexpected resend verification error:', error);
      Alert.alert(l('Error', 'Error'), l('Gagal kirim ulang email. Coba lagi nanti.', 'Failed to resend email. Please try again later.'));
    } finally {
      setIsResending(false);
    }
  };

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert(l('Error', 'Error'), l('Mohon masukkan email dan password', 'Please enter email and password'));
      return;
    }

    setIsSigningIn(true);
    setUnverifiedEmail(null);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('Sign in attempt:', { email: email.trim() });
      await signIn(email.trim(), password);
      console.log('Sign in successful, checking profile and navigating');
      await checkProfileAndNavigate();
    } catch (error) {
      console.error('Sign in error:', error);

      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        Alert.alert(l('Login Gagal', 'Login Failed'), l('Email atau password salah. Silakan coba lagi.', 'Incorrect email or password. Please try again.'));
        return;
      }

      if (error instanceof Error && error.message.includes('Email not confirmed')) {
        const trimmedEmail = email.trim();
        setUnverifiedEmail(trimmedEmail);
        Alert.alert(
          l('Email Belum Dikonfirmasi', 'Email Not Verified'),
          l(
            'Kami sudah kirim link verifikasi ke email kamu. Cek inbox atau folder spam ya!',
            'We already sent a verification link to your email. Please check your inbox or spam folder.'
          ),
          [
            {
              text: l('Kirim Ulang', 'Resend'),
              onPress: () => {
                void handleResendVerification(trimmedEmail);
              },
            },
            { text: 'OK' },
          ]
        );
        return;
      }

      Alert.alert(l('Error', 'Error'), l('Gagal masuk. Silakan coba lagi.', 'Failed to sign in. Please try again.'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleSigningIn(true);
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      console.log('Starting Google OAuth flow');

      const redirectUrl = makeRedirectUri({
        scheme: 'rork-app',
        path: 'auth/callback',
      });
      console.log('Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: false,
        },
      });

      if (error) {
        console.error('Google OAuth error:', error);
        Alert.alert(l('Error', 'Error'), l('Gagal memulai login Google. Silakan coba lagi.', 'Failed to start Google login. Please try again.'));
        return;
      }

      console.log('Opening OAuth URL:', data.url);

      if (!data.url) {
        Alert.alert(l('Error', 'Error'), l('URL login Google tidak tersedia.', 'Google login URL is unavailable.'));
        return;
      }

      const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);
      console.log('WebBrowser result:', result);

      if (result.type === 'success' && result.url && result.url.includes('#access_token=')) {
        const params = new URLSearchParams(result.url.split('#')[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          console.log('Setting Supabase session from OAuth callback');
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            console.error('Error setting session:', sessionError);
            Alert.alert(l('Error', 'Error'), l('Gagal masuk dengan Google', 'Failed to sign in with Google'));
            return;
          }

          console.log('Google sign in successful, checking profile completeness');
          await checkProfileAndNavigate();
          return;
        }
      }

      if (result.type === 'cancel') {
        console.log('User cancelled OAuth flow');
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      Alert.alert(l('Error', 'Error'), l('Gagal masuk dengan Google. Silakan coba lagi.', 'Failed to sign in with Google. Please try again.'));
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const handleBack = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/onboarding');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={insets.top + 12}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 20,
            paddingBottom: Math.max(56, insets.bottom + 32),
            paddingHorizontal: formPad,
          },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        testID="sign-in-scroll-view"
      >
        <View style={styles.narrowWrap}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={handleBack}
          activeOpacity={0.7}
          testID="sign-in-back-button"
        >
          <ArrowLeft size={24} color="#666666" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  fill="#22C55E"
                />
              </Svg>
            </View>
            <Text style={styles.title}>{t.signIn.title}</Text>
            <Text style={styles.subtitle}>{t.signIn.subtitle}</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.signIn.email}</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={(value: string) => {
                  setEmail(value);
                  setUnverifiedEmail(null);
                }}
                placeholder={l('nama@email.com', 'name@email.com')}
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSigningIn}
                testID="sign-in-email-input"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.signIn.password}</Text>
              <View style={styles.passwordField}>
                <TextInput
                  style={styles.passwordInput}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  placeholderTextColor="#999999"
                  secureTextEntry={!passwordVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isSigningIn}
                  testID="sign-in-password-input"
                />
                <TouchableOpacity
                  style={styles.passwordToggle}
                  onPress={() => setPasswordVisible((v) => !v)}
                  disabled={isSigningIn}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel={
                    passwordVisible ? t.signIn.hidePassword : t.signIn.showPassword
                  }
                  testID="sign-in-password-visibility-toggle"
                >
                  {passwordVisible ? (
                    <EyeOff size={22} color="#666666" />
                  ) : (
                    <Eye size={22} color="#666666" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.signInButton,
                isSigningIn && styles.signInButtonDisabled,
                styles.signInButtonElevated,
              ]}
              onPress={handleSignIn}
              activeOpacity={0.8}
              disabled={isSigningIn}
              testID="sign-in-submit-button"
            >
              <Text style={styles.signInButtonText}>
                {isSigningIn ? 'Memproses...' : t.signIn.signIn}
              </Text>
              {!isSigningIn && <ArrowRight size={20} color="#FFFFFF" />}
            </TouchableOpacity>

            {unverifiedEmail && (
              <View style={styles.verificationBanner} testID="sign-in-verification-banner">
                <Mail size={18} color="#C27A00" />
                <Text style={styles.verificationBannerText}>Email belum diverifikasi.</Text>
                <TouchableOpacity
                  onPress={() => {
                    void handleResendVerification();
                  }}
                  disabled={isResending}
                  activeOpacity={0.7}
                  testID="sign-in-resend-button"
                >
                  <Text style={styles.verificationBannerLink}>
                    {isResending ? 'Mengirim...' : 'Kirim ulang'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {SHOW_GOOGLE_SIGN_IN && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>{t.signIn.orContinueWith}</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[
                    styles.googleButton,
                    (isSigningIn || isGoogleSigningIn) && styles.googleButtonDisabled,
                  ]}
                  onPress={handleGoogleSignIn}
                  activeOpacity={0.7}
                  disabled={isSigningIn || isGoogleSigningIn}
                  testID="sign-in-google-button"
                >
                  <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                    <Path
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      fill="#4285F4"
                    />
                    <Path
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      fill="#34A853"
                    />
                    <Path
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                      fill="#FBBC05"
                    />
                    <Path
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                      fill="#EA4335"
                    />
                  </Svg>
                  <Text style={styles.googleButtonText}>
                    {isGoogleSigningIn ? 'Memproses...' : t.signIn.googleSignIn}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <View style={styles.footer}>
              <Text style={styles.footerText}>Belum punya akun? </Text>
              <TouchableOpacity
                onPress={() => {
                  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace('/onboarding');
                }}
                activeOpacity={0.7}
                testID="sign-in-sign-up-link"
              >
                <Text style={styles.footerLink}>Daftar Sekarang</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F4F1',
  },
  scrollContent: {
    flexGrow: 1,
  },
  narrowWrap: {
    width: '100%',
    maxWidth: FORM_MAX_WIDTH,
    alignSelf: 'center',
  },
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
    padding: 4,
  },
  content: {
    flexGrow: 0,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(34, 197, 94, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1A1A2E',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#6E6E82',
    textAlign: 'center',
    lineHeight: 24,
  },
  form: {
    flexGrow: 0,
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1A1A2E',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEEDF2',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 16,
    color: '#1A1A2E',
  },
  passwordField: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEEDF2',
    borderRadius: 24,
    paddingRight: 8,
  },
  passwordInput: {
    flex: 1,
    paddingLeft: 20,
    paddingVertical: 16,
    paddingRight: 8,
    fontSize: 16,
    color: '#1A1A2E',
  },
  passwordToggle: {
    padding: 10,
  },
  signInButton: {
    backgroundColor: '#22C55E',
    borderRadius: 28,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  signInButtonElevated: {
    zIndex: 20,
    elevation: 20,
    position: 'relative',
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  verificationBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFF7E6',
    borderWidth: 1,
    borderColor: '#F0C36D',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 12,
  },
  verificationBannerText: {
    flex: 1,
    fontSize: 14,
    color: '#7A4D00',
  },
  verificationBannerLink: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#C27A00',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#EEEDF2',
  },
  dividerText: {
    fontSize: 14,
    color: '#AEAEB8',
    marginHorizontal: 16,
  },
  googleButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#EEEDF2',
    borderRadius: 28,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#1A1A2E',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    paddingBottom: 32,
  },
  footerText: {
    fontSize: 15,
    color: '#6E6E82',
  },
  footerLink: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#22C55E',
  },
});
