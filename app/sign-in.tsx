import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Svg, Path } from 'react-native-svg';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const { t } = useLanguage();
  const { signIn } = useNutrition();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  useEffect(() => {
    const handleDeepLink = async (url: string) => {
      console.log('Deep link received:', url);
      if (url.includes('#access_token=')) {
        const params = new URLSearchParams(url.split('#')[1]);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        
        if (accessToken && refreshToken) {
          console.log('Setting Supabase session from OAuth callback');
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          
          if (error) {
            console.error('Error setting session:', error);
            Alert.alert('Error', 'Gagal masuk dengan Google');
          } else {
            console.log('Google sign in successful, navigating to main app');
            router.replace('/(tabs)');
          }
        }
      }
    };

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

  const handleSignIn = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Mohon masukkan email dan password');
      return;
    }

    setIsSigningIn(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      console.log('Sign in attempt:', { email });
      await signIn(email.trim(), password);
      
      console.log('Sign in successful, navigating to main app');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Sign in error:', error);
      if (error instanceof Error && error.message === 'INVALID_CREDENTIALS') {
        Alert.alert(
          'Login Gagal',
          'Email atau password salah. Silakan coba lagi.',
          [{ text: 'OK' }]
        );
      } else if (error instanceof Error && error.message.includes('Email not confirmed')) {
        Alert.alert(
          'Email Belum Dikonfirmasi',
          'Silakan cek email Anda untuk mengkonfirmasi akun.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', 'Gagal masuk. Silakan coba lagi.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsGoogleSigningIn(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
        Alert.alert('Error', 'Gagal memulai login Google. Silakan coba lagi.');
        setIsGoogleSigningIn(false);
        return;
      }

      console.log('Opening OAuth URL:', data.url);
      
      if (data.url) {
        const result = await WebBrowser.openAuthSessionAsync(
          data.url,
          redirectUrl
        );

        console.log('WebBrowser result:', result);

        if (result.type === 'success' && result.url) {
          const url = result.url;
          if (url.includes('#access_token=')) {
            const params = new URLSearchParams(url.split('#')[1]);
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
                Alert.alert('Error', 'Gagal masuk dengan Google');
                setIsGoogleSigningIn(false);
              } else {
                console.log('Google sign in successful, checking profile completeness');
                await checkProfileAndNavigate();
                setIsGoogleSigningIn(false);
              }
            }
          }
        } else if (result.type === 'cancel') {
          console.log('User cancelled OAuth flow');
        }
      }
    } catch (error) {
      console.error('Google sign in error:', error);
      Alert.alert('Error', 'Gagal masuk dengan Google. Silakan coba lagi.');
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  const checkProfileAndNavigate = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/(tabs)');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('Profile data after OAuth:', profile);

      const isProfileComplete = profile && 
        profile.height && 
        profile.weight && 
        profile.goal && 
        profile.activity_level;

      if (isProfileComplete) {
        console.log('Profile is complete, navigating to tabs');
        router.replace('/(tabs)');
      } else {
        console.log('Profile incomplete, redirecting to onboarding');
        router.replace('/onboarding?mode=complete');
      }
    } catch (error) {
      console.error('Error checking profile:', error);
      router.replace('/(tabs)');
    }
  };

  const handleBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingTop: insets.top + 20 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity style={styles.backButton} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={24} color="#666666" />
        </TouchableOpacity>

        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.iconCircle}>
              <Svg width="64" height="64" viewBox="0 0 24 24" fill="none">
                <Path
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  fill="#6C63FF"
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
                onChangeText={setEmail}
                placeholder="nama@email.com"
                placeholderTextColor="#999999"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSigningIn}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>{t.signIn.password}</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#999999"
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isSigningIn}
              />
            </View>

            <TouchableOpacity
              style={[styles.signInButton, isSigningIn && styles.signInButtonDisabled]}
              onPress={handleSignIn}
              activeOpacity={0.8}
              disabled={isSigningIn}
            >
              <Text style={styles.signInButtonText}>
                {isSigningIn ? 'Memproses...' : t.signIn.signIn}
              </Text>
              {!isSigningIn && <ArrowRight size={20} color="#FFFFFF" />}
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t.signIn.orContinueWith}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, (isSigningIn || isGoogleSigningIn) && styles.googleButtonDisabled]}
              onPress={handleGoogleSignIn}
              activeOpacity={0.7}
              disabled={isSigningIn || isGoogleSigningIn}
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

            <View style={styles.footer}>
              <Text style={styles.footerText}>Belum punya akun? </Text>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.replace('/onboarding');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.footerLink}>Daftar Sekarang</Text>
              </TouchableOpacity>
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
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6E6E82',
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    marginBottom: 20,
    alignSelf: 'flex-start',
    padding: 4,
  },
  content: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(108, 99, 255, 0.08)',
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
    flex: 1,
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
  signInButton: {
    backgroundColor: '#6C63FF',
    borderRadius: 28,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
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
    color: '#6C63FF',
  },
});
