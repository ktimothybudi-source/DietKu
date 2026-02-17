import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Animated,
  TextInput,
  Platform,
  Image,
  KeyboardAvoidingView,
  Keyboard,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Goal, ActivityLevel, Sex } from '@/types/nutrition';
import { ArrowRight, ArrowLeft, Sparkles, Globe, Footprints, Heart } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Svg, Path, Circle, G } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ANIMATION_DURATION, SPRING_CONFIG } from '@/constants/animations';
import * as WebBrowser from 'expo-web-browser';
import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onboardingStyles as styles } from '@/styles/onboardingStyles';

WebBrowser.maybeCompleteAuthSession();

export default function OnboardingScreen() {
  const { saveProfile, profile, signUp, authState } = useNutrition();
  const { language, toggleLanguage, t } = useLanguage();
  const { enableNotifications } = useNotifications();
  const insets = useSafeAreaInsets();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const isCompleteMode = mode === 'complete';

  const [step, setStep] = useState(mode === 'complete' ? 1 : 0);
  const [isInteracting] = useState(false);

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const progressAnim = useRef(new Animated.Value(0)).current;

  const scrollRef = useRef<ScrollView>(null);

  const [birthDate, setBirthDate] = useState(new Date(1995, 5, 15));
  const [showDatePicker, setShowDatePicker] = useState(Platform.OS === 'ios');
  const [sex, setSex] = useState<Sex | null>(null);

  const [height, setHeight] = useState(170);
  const [heightText, setHeightText] = useState('170');

  const [weight, setWeight] = useState(70);
  const [weightText, setWeightText] = useState('70');

  const [dreamWeight, setDreamWeight] = useState(65);
  const [dreamWeightText, setDreamWeightText] = useState('65');

  const [weeklyWeightChange, setWeeklyWeightChange] = useState(0.5);
  const [weeklyWeightChangeText, setWeeklyWeightChangeText] = useState('0.5');

  const [activityLevel, setActivityLevel] = useState<ActivityLevel | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<'lose' | 'gain' | 'maintain' | null>(null);
  const [motivations, setMotivations] = useState<string[]>([]);
  const [dietType, setDietType] = useState<string | null>(null);

  const [showLoading, setShowLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Analyzing your data');
  const circularProgress = useRef(new Animated.Value(0)).current;

  const introScaleAnim = useRef(new Animated.Value(0)).current;
  const introTextAnim = useRef(new Animated.Value(0)).current;
  const introCtaAnim = useRef(new Animated.Value(0)).current;

  // HIDDEN: Subscription features
  // const [showSubscription, setShowSubscription] = useState(false);
  // const [selectedSubscription, setSelectedSubscription] = useState<'yearly' | 'monthly'>('yearly');
  // const subscriptionSlideAnim = useRef(new Animated.Value(1000)).current;

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInPasswordConfirm, setSignInPasswordConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [userName, setUserName] = useState('');
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);

  const totalSteps = 17;

  // Y positions for inputs
  const heightY = useRef(0);
  const weightY = useRef(0);
  const dreamWeightY = useRef(0);
  const weeklyWeightChangeY = useRef(0);
  const signInEmailY = useRef(0);
  const signInPasswordY = useRef(0);

  const scrollToY = useCallback((y: number) => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    });
  }, []);

  useEffect(() => {
    const progress = step > 0 ? step / totalSteps : 0;
    Animated.timing(progressAnim, {
      toValue: progress,
      duration: ANIMATION_DURATION.medium,
      useNativeDriver: false,
    }).start();
  }, [step, progressAnim]);

  useEffect(() => {
    if (!showLoading) {
      circularProgress.setValue(0);
      setLoadingMessage('Analyzing your data');
      return;
    }

    const messages = [
      { text: 'Menganalisis data Anda', duration: 2000 },
      { text: 'Menghitung target Anda', duration: 2000 },
      { text: 'Menyesuaikan preferensi', duration: 2000 },
      { text: 'Mengoptimalkan rencana Anda', duration: 2500 },
      { text: 'Menyelesaikan detail', duration: 2500 },
    ];

    let currentMessageIndex = 0;
    let totalElapsed = 0;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const updateMessage = () => {
      if (currentMessageIndex >= messages.length) return;

      const current = messages[currentMessageIndex];
      setLoadingMessage(current.text);

      const progressEnd = (totalElapsed + current.duration) / 10000;

      Animated.timing(circularProgress, {
        toValue: progressEnd,
        duration: current.duration,
        useNativeDriver: false,
      }).start();

      totalElapsed += current.duration;
      currentMessageIndex++;

      if (currentMessageIndex < messages.length) {
        timeouts.push(setTimeout(updateMessage, current.duration));
      } else {
        timeouts.push(
          setTimeout(async () => {
            setShowLoading(false);
            
            // If completing profile for existing Google OAuth user
            if (isCompleteMode && authState.isSignedIn) {
              console.log('Complete mode: Saving profile for Google OAuth user');
              const today = new Date();
              const age = today.getFullYear() - birthDate.getFullYear() -
                (today.getMonth() < birthDate.getMonth() ||
                (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);
              const calculatedGoal = dreamWeight < weight ? 'fat_loss' : dreamWeight > weight ? 'muscle_gain' : 'maintenance';
              
              saveProfile({
                name: userName || undefined,
                age,
                sex: sex || 'male',
                height,
                weight,
                goalWeight: dreamWeight,
                goal: calculatedGoal,
                activityLevel: activityLevel || 'moderate',
                weeklyWeightChange,
              });
              
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace('/(tabs)');
              return;
            }
            
            setStep(prev => prev + 1);
          }, current.duration)
        );
      }
    };

    updateMessage();

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [showLoading, circularProgress, isCompleteMode, authState.isSignedIn, birthDate, dreamWeight, weight, sex, height, activityLevel, weeklyWeightChange, userName, saveProfile]);

  useEffect(() => {
    if (step !== 0) return;

    Animated.stagger(ANIMATION_DURATION.standard, [
      Animated.spring(introScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        ...SPRING_CONFIG.gentle,
      }),
      Animated.timing(introTextAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION.slower,
        useNativeDriver: true,
      }),
      Animated.timing(introCtaAnim, {
        toValue: 1,
        duration: ANIMATION_DURATION.slower,
        useNativeDriver: true,
      }),
    ]).start();
  }, [step, introScaleAnim, introTextAnim, introCtaAnim]);

  const animateTransition = useCallback(
    (forward: boolean, callback: () => void) => {
      Keyboard.dismiss();

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: ANIMATION_DURATION.standard,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: forward ? -20 : 20,
          duration: ANIMATION_DURATION.standard,
          useNativeDriver: true,
        }),
      ]).start(() => {
        callback();
        slideAnim.setValue(forward ? 20 : -20);

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: ANIMATION_DURATION.medium,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: 0,
            duration: ANIMATION_DURATION.medium,
            useNativeDriver: true,
          }),
        ]).start();
      });
    },
    [fadeAnim, slideAnim]
  );

  const handleNext = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    if (step === 13) {
      Keyboard.dismiss();
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION.slow,
        useNativeDriver: true,
      }).start(() => {
        setShowLoading(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: ANIMATION_DURATION.slower,
          useNativeDriver: true,
        }).start();
      });
      return;
    }

    animateTransition(true, () => setStep(s => s + 1));
  }, [step, fadeAnim, animateTransition]);

  const handleBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    animateTransition(false, () => setStep(s => Math.max(0, s - 1)));
  }, [animateTransition]);

  const handleComplete = useCallback(() => {
    console.log('handleComplete called:', { sex, activityLevel });
    
    // Use defaults if somehow missing
    const finalSex = sex || 'male';
    const finalActivityLevel = activityLevel || 'moderate';
    
    if (!sex || !activityLevel) {
      console.warn('handleComplete: Using defaults for missing data', { sex, activityLevel, finalSex, finalActivityLevel });
    }

    console.log('handleComplete: Proceeding to sign-in step');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleNext();
  }, [sex, activityLevel, handleNext]);

  const [isCreatingAccount, setIsCreatingAccount] = useState(false);

  // HIDDEN: Subscription features
  // const openSubscription = useCallback(() => {
  //   Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  //   setShowSubscription(true);
  //   Animated.spring(subscriptionSlideAnim, {
  //     toValue: 0,
  //     useNativeDriver: true,
  //     ...SPRING_CONFIG.default,
  //   }).start();
  // }, [subscriptionSlideAnim]);

  const handleSignIn = useCallback(async () => {
    if (!signInEmail.trim() || !signInPassword.trim() || !firstName.trim() || !lastName.trim()) {
      Alert.alert('Error', 'Mohon isi semua field');
      return;
    }

    if (signInPassword.length < 6) {
      Alert.alert('Error', 'Password minimal 6 karakter');
      return;
    }

    if (signInPassword !== signInPasswordConfirm) {
      Alert.alert('Error', 'Password tidak cocok');
      return;
    }

    setIsCreatingAccount(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear() -
        (today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);

      const calculatedGoal = dreamWeight < weight ? 'fat_loss' : dreamWeight > weight ? 'muscle_gain' : 'maintenance';

      await signUp(signInEmail.trim(), signInPassword, {
        name: `${firstName.trim()} ${lastName.trim()}`,
        age,
        birthDate,
        sex: sex || 'male',
        height,
        weight,
        goalWeight: dreamWeight,
        goal: calculatedGoal,
        activityLevel: activityLevel || 'moderate',
        weeklyWeightChange,
      });

      console.log('Account created successfully');
      // HIDDEN: Skip subscription, go directly to next step
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      handleNext();
    } catch (error) {
      console.error('Sign up error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        if (error.message.includes('already registered') || error.message.includes('already been registered')) {
          Alert.alert('Email Sudah Terdaftar', 'Email ini sudah digunakan. Silakan gunakan email lain atau masuk dengan akun yang ada.');
        } else if (error.message.includes('Invalid email')) {
          Alert.alert('Email Tidak Valid', 'Masukkan alamat email yang valid.');
        } else if (error.message.includes('Password')) {
          Alert.alert('Password Tidak Valid', error.message);
        } else {
          Alert.alert('Error', `Gagal membuat akun: ${error.message}`);
        }
      } else {
        Alert.alert('Error', 'Gagal membuat akun. Silakan coba lagi.');
      }
    } finally {
      setIsCreatingAccount(false);
    }
  }, [signInEmail, signInPassword, signInPasswordConfirm, firstName, lastName, signUp, birthDate, sex, height, weight, dreamWeight, activityLevel, weeklyWeightChange, handleNext]);

  const handleGoogleSignIn = useCallback(async () => {
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
              } else {
                console.log('Google sign in successful');
                // HIDDEN: Skip subscription, go directly to next step
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                handleNext();
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
  }, [handleNext]);

  // HIDDEN: Subscription features
  // const handleSkipSignIn = useCallback(() => {
  //   openSubscription();
  // }, [openSubscription]);

  const handleEnableHealthConnect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      AsyncStorage.setItem('health_connect_enabled', 'true');
    } catch (e) {
      console.log('Error saving health connect preference:', e);
    }
    handleNext();
  }, [handleNext]);

  const handleSkipHealthConnect = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    handleNext();
  }, [handleNext]);

  const handleEnableNotifications = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await enableNotifications();
    router.replace('/(tabs)');
  }, [enableNotifications]);

  const handleSkipNotifications = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/(tabs)');
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const AnimatedCircle = useMemo(() => Animated.createAnimatedComponent(Circle), []);

  const renderIntro = () => (
    <View style={styles.introContainer}>
      <TouchableOpacity
        style={styles.languageToggle}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          toggleLanguage();
        }}
        activeOpacity={0.7}
      >
        <Globe size={16} color="#6C63FF" />
        <Text style={styles.languageText}>{language === 'id' ? 'ID' : 'EN'}</Text>
      </TouchableOpacity>

      <Animated.View
        style={[
          styles.introImageHero,
          {
            transform: [{ scale: introScaleAnim }],
            opacity: introScaleAnim,
          },
        ]}
      >
        <Image source={require('../assets/images/intro.png')} style={styles.introImageLarge} resizeMode="cover" />
        <View style={styles.introFloatingBadge}>
          <Sparkles size={12} color="#FFFFFF" />
          <Text style={styles.introFloatingBadgeText}>AI-Powered</Text>
        </View>
      </Animated.View>

      <View style={styles.introHeroSection}>
        <Animated.View
          style={[
            styles.introTextSection,
            {
              opacity: introTextAnim,
              transform: [
                {
                  translateY: introTextAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [30, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.introBrandTitle}>DietKu</Text>
          <Text style={styles.introTagline}>
            Pantau nutrisi dengan AI, capai tujuanmu, dan transformasi hidupmu.
          </Text>
        </Animated.View>
      </View>

      <Animated.View
        style={[
          styles.introCtaSection,
          {
            opacity: introCtaAnim,
            transform: [
              {
                translateY: introCtaAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [40, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity style={styles.introPrimaryButton} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.introPrimaryButtonText}>Mulai Perjalananmu</Text>
          <View style={styles.introButtonIconCircle}>
            <ArrowRight size={16} color="#6C63FF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.introSignInLink}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push('/sign-in');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.introSignInText}>Sudah punya akun? </Text>
          <Text style={styles.introSignInTextBold}>Masuk</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );

  const renderDateOfBirth = () => {
    const monthNames = [
      'Januari',
      'Februari',
      'Maret',
      'April',
      'Mei',
      'Juni',
      'Juli',
      'Agustus',
      'September',
      'Oktober',
      'November',
      'Desember',
    ];
    const formattedDate = `${birthDate.getDate()} ${monthNames[birthDate.getMonth()]} ${birthDate.getFullYear()}`;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>Kapan tanggal lahir Anda?</Text>
          <Text style={styles.questionSubtitle}>Ini membantu kami menghitung kebutuhan kalori Anda</Text>
        </View>

        <View style={styles.inputSection}>
          {Platform.OS === 'android' && (
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setShowDatePicker(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.dateButtonText}>{formattedDate}</Text>
            </TouchableOpacity>
          )}

          {showDatePicker && (
            <DateTimePicker
              value={birthDate}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event, selectedDate) => {
                if (Platform.OS === 'android') setShowDatePicker(false);
                if (selectedDate) setBirthDate(selectedDate);
              }}
              maximumDate={new Date()}
              minimumDate={new Date(1900, 0, 1)}
              textColor="#000000"
              style={Platform.OS === 'ios' ? styles.iosDatePicker : undefined}
            />
          )}
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Lanjutkan</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSex = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>Apa jenis kelamin Anda?</Text>
        <Text style={styles.questionSubtitle}>Kami akan menggunakan ini untuk membuat rencana khusus Anda</Text>
      </View>

      <View style={styles.genderOptions}>
        <TouchableOpacity
          style={[styles.genderCard, sex === 'male' && styles.genderCardActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSex('male');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.genderIconCircle, sex === 'male' && styles.genderIconCircleActive]}>
            <Svg width="60" height="60" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="12" r="5" stroke={sex === 'male' ? '#6C63FF' : '#999999'} strokeWidth="2" />
              <Path
                d="M17 7L22 2M22 2h-5M22 2v5"
                stroke={sex === 'male' ? '#6C63FF' : '#999999'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={[styles.genderText, sex === 'male' && styles.genderTextActive]}>Pria</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.genderCard, sex === 'female' && styles.genderCardActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setSex('female');
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.genderIconCircle, sex === 'female' && styles.genderIconCircleActive]}>
            <Svg width="60" height="60" viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="9" r="5" stroke={sex === 'female' ? '#6C63FF' : '#999999'} strokeWidth="2" />
              <Path
                d="M12 14v8M9 19h6"
                stroke={sex === 'female' ? '#6C63FF' : '#999999'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={[styles.genderText, sex === 'female' && styles.genderTextActive]}>Wanita</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !sex && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!sex}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Selanjutnya</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderHeight = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>Berapa tinggi badan Anda?</Text>
      </View>

      <View style={styles.inputSection}>
        <View
          onLayout={(e) => {
            heightY.current = e.nativeEvent.layout.y;
          }}
          style={styles.inputWrapper}
        >
          <TextInput
            style={styles.numberInput}
            value={heightText}
            onFocus={() => scrollToY(heightY.current)}
            onChangeText={(text) => {
              setHeightText(text);
              const num = parseFloat(text);
              if (!Number.isNaN(num) && num >= 120 && num <= 240) setHeight(num);
            }}
            keyboardType="number-pad"
            placeholder="170"
            placeholderTextColor="#666"
            selectTextOnFocus
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <Text style={styles.inputUnit}>cm</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Selanjutnya</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderWeight = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>Berapa berat badan Anda saat ini?</Text>
      </View>

      <View style={styles.inputSection}>
        <View
          onLayout={(e) => {
            weightY.current = e.nativeEvent.layout.y;
          }}
          style={styles.inputWrapper}
        >
          <TextInput
            style={styles.numberInput}
            value={weightText}
            onFocus={() => scrollToY(weightY.current)}
            onChangeText={(text) => {
              setWeightText(text);
              const num = parseFloat(text);
              if (!Number.isNaN(num) && num >= 40 && num <= 200) setWeight(num);
            }}
            keyboardType="decimal-pad"
            placeholder="70"
            placeholderTextColor="#666"
            selectTextOnFocus
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <Text style={styles.inputUnit}>kg</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Selanjutnya</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderGoalSelection = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={[styles.questionTitle, { maxWidth: '100%' }]}>Apa yang ingin Anda capai?</Text>
      </View>

      <View style={styles.optionsList}>
        <TouchableOpacity
          style={[styles.goalCard, selectedGoal === 'gain' && styles.goalCardActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedGoal('gain');
          }}
          activeOpacity={0.7}
        >
          <View style={styles.goalIconContainer}>
            <Text style={styles.goalIcon}>💪</Text>
          </View>
          <View style={styles.goalTextContainer}>
            <Text style={[styles.goalCardTitle, selectedGoal === 'gain' && styles.goalCardTitleActive]}>
              Menambah Berat Badan
            </Text>
            <Text style={styles.goalCardDesc}>Bangun otot dan tingkatkan massa tubuh</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.goalCard, selectedGoal === 'maintain' && styles.goalCardActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedGoal('maintain');
          }}
          activeOpacity={0.7}
        >
          <View style={styles.goalIconContainer}>
            <Text style={styles.goalIcon}>⚖️</Text>
          </View>
          <View style={styles.goalTextContainer}>
            <Text style={[styles.goalCardTitle, selectedGoal === 'maintain' && styles.goalCardTitleActive]}>
              Mempertahankan Berat Badan
            </Text>
            <Text style={styles.goalCardDesc}>Jaga berat badan sehat yang stabil</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.goalCard, selectedGoal === 'lose' && styles.goalCardActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSelectedGoal('lose');
          }}
          activeOpacity={0.7}
        >
          <View style={styles.goalIconContainer}>
            <Text style={styles.goalIcon}>🎯</Text>
          </View>
          <View style={styles.goalTextContainer}>
            <Text style={[styles.goalCardTitle, selectedGoal === 'lose' && styles.goalCardTitleActive]}>
              Menurunkan Berat Badan
            </Text>
            <Text style={styles.goalCardDesc}>Kurangi lemak dan capai berat sehat</Text>
          </View>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !selectedGoal && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!selectedGoal}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Selanjutnya</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderLongTermResults = () => (
    <View style={styles.stepContainer}>
      <View style={styles.reassuranceContainer}>
        <View style={styles.reassuranceIconCircle}>
          <Svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <Path
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              stroke="#6C63FF"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
        <Text style={styles.reassuranceTitle}>DietKu menciptakan{'\n'}hasil jangka panjang</Text>
        <Text style={styles.reassuranceSubtitle}>
          Kami fokus pada perubahan berkelanjutan, bukan diet kilat. Konsistensi mengalahkan kesempurnaan.
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Lanjutkan</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderDreamWeight = () => {
    const isInvalidForGoal = 
      (selectedGoal === 'gain' && dreamWeight < weight) ||
      (selectedGoal === 'lose' && dreamWeight > weight);

    const getValidationMessage = () => {
      if (selectedGoal === 'gain' && dreamWeight < weight) {
        return 'Untuk menambah berat badan, target harus lebih tinggi dari berat saat ini.';
      }
      if (selectedGoal === 'lose' && dreamWeight > weight) {
        return 'Untuk menurunkan berat badan, target harus lebih rendah dari berat saat ini.';
      }
      return '';
    };

    return (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>Berapa berat badan yang Anda inginkan?</Text>
        <Text style={styles.questionSubtitle}>Tap angka target untuk mengubah</Text>
      </View>

      <View style={styles.inputSection}>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Saat Ini</Text>
            <View style={styles.weightValueRow}>
              <Text style={styles.comparisonValueNum}>{weight}</Text>
              <Text style={styles.comparisonUnitInline}>kg</Text>
            </View>
          </View>

          <ArrowRight size={22} color="#666" />

          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Target</Text>
            <View
              onLayout={(e) => {
                dreamWeightY.current = e.nativeEvent.layout.y;
              }}
              style={styles.weightValueRow}
            >
              <TextInput
                style={styles.targetWeightInput}
                value={dreamWeightText}
                onFocus={() => scrollToY(dreamWeightY.current)}
                onChangeText={(text) => {
                  setDreamWeightText(text);
                  const num = parseFloat(text);
                  if (!Number.isNaN(num) && num >= 40 && num <= 200) setDreamWeight(num);
                }}
                keyboardType="decimal-pad"
                placeholder="65"
                placeholderTextColor="#999"
                selectTextOnFocus
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              <Text style={styles.comparisonUnitInline}>kg</Text>
            </View>
            <View style={styles.inlineHintLine} />
          </View>
        </View>

        {isInvalidForGoal && (
          <View style={styles.validationWarning}>
            <Text style={styles.validationWarningText}>{getValidationMessage()}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.primaryButton, isInvalidForGoal && styles.primaryButtonDisabled]} 
        onPress={handleNext} 
        disabled={isInvalidForGoal}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Selanjutnya</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
  };

  const renderActivityLevel = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>Pilih tingkat aktivitas</Text>
        <Text style={styles.questionSubtitle}>Kami akan menggunakan informasi ini untuk membuat rencana khusus Anda</Text>
      </View>

      <View style={styles.optionsList}>
        <TouchableOpacity
          style={[styles.activityCard, activityLevel === 'low' && styles.activityCardActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActivityLevel('low');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.activityCardTitle, activityLevel === 'low' && styles.activityCardTitleActive]}>
            🚶 Minimal
          </Text>
          <Text style={styles.activityCardDesc}>Sempurna untuk mereka yang memiliki gaya hidup kurang aktif.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.activityCard, activityLevel === 'moderate' && styles.activityCardActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActivityLevel('moderate');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.activityCardTitle, activityLevel === 'moderate' && styles.activityCardTitleActive]}>
            🏃 Sedang
          </Text>
          <Text style={styles.activityCardDesc}>Dirancang untuk mereka yang berolahraga secara teratur.</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.activityCard, activityLevel === 'high' && styles.activityCardActive]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActivityLevel('high');
          }}
          activeOpacity={0.7}
        >
          <Text style={[styles.activityCardTitle, activityLevel === 'high' && styles.activityCardTitleActive]}>
            🔥 Sangat Aktif
          </Text>
          <Text style={styles.activityCardDesc}>
            Cocok untuk atlet, penggemar fitness, atau individu dengan rutinitas sangat aktif.
          </Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !activityLevel && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!activityLevel}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Selanjutnya</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderWeeklyWeightChange = () => {
    const isGaining = dreamWeight > weight;

    const minRec = 0.2;
    const maxRec = 1.0;

    const parsed = parseFloat(weeklyWeightChangeText);
    const hasNumber = !Number.isNaN(parsed);

    const isOutOfRange = hasNumber && (parsed < minRec || parsed > maxRec);
    const showWarning = hasNumber && isOutOfRange;

    const clampToRecommended = () => {
      const next = Math.min(maxRec, Math.max(minRec, hasNumber ? parsed : weeklyWeightChange));
      const normalized = Number.isFinite(next) ? next : 0.5;
      const text = normalized.toString();

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setWeeklyWeightChange(normalized);
      setWeeklyWeightChangeText(text);

      Keyboard.dismiss();
    };

    let warningText = '';
    if (showWarning) {
      if (parsed < minRec) {
        warningText = `Terlalu rendah. Disarankan minimal ${minRec} kg per minggu.`;
      } else {
        warningText = `Terlalu tinggi. Disarankan maksimal ${maxRec} kg per minggu.`;
      }
    }

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>Target {isGaining ? 'naik' : 'turun'} per minggu</Text>
          <Text style={styles.questionSubtitle}>Disarankan: {minRec} - {maxRec} kg per minggu</Text>
        </View>

        <View style={styles.inputSection}>
          <View
            onLayout={(e) => {
              weeklyWeightChangeY.current = e.nativeEvent.layout.y;
            }}
            style={[styles.inputWrapper, showWarning && styles.inputWrapperWarning]}
          >
            <TextInput
              style={[styles.numberInput, showWarning && styles.numberInputWarning]}
              value={weeklyWeightChangeText}
              onFocus={() => scrollToY(weeklyWeightChangeY.current)}
              onChangeText={(text) => {
                setWeeklyWeightChangeText(text);
                const num = parseFloat(text);
                if (!Number.isNaN(num)) setWeeklyWeightChange(num);
              }}
              keyboardType="decimal-pad"
              placeholder="0.5"
              placeholderTextColor="#666"
              selectTextOnFocus
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <Text style={[styles.inputUnit, showWarning && styles.inputUnitWarning]}>kg</Text>
          </View>

          {showWarning && (
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationTitle}>Rekomendasi</Text>
              <Text style={styles.recommendationText}>{warningText}</Text>
              <TouchableOpacity style={styles.recommendationButton} onPress={clampToRecommended} activeOpacity={0.85}>
                <Text style={styles.recommendationButtonText}>Gunakan nilai rekomendasi</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !hasNumber && styles.primaryButtonDisabled]}
          onPress={handleNext}
          disabled={!hasNumber}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Selanjutnya</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderReassurance = () => {
    const weightDiff = Math.abs(dreamWeight - weight);
    const isGaining = dreamWeight > weight;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.reassuranceContainer}>
          <View style={styles.reassuranceIconCircle}>
            <Svg width="64" height="64" viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke="#6C63FF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
          <Text style={styles.reassuranceTitle}>✓ Itu target{'\n'}yang realistis</Text>
          <Text style={styles.reassuranceSubtitle}>
            {isGaining ? 'Menambah' : 'Menurunkan'} {weightDiff.toFixed(1)} kg dapat dicapai dengan konsistensi dan dedikasi.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Lanjutkan</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderMotivations = () => {
    const motivationOptions = [
      { id: 'energy', label: '⚡ Energi lebih baik' },
      { id: 'consistency', label: '🎯 Konsistensi' },
      { id: 'health', label: '❤️ Perbaikan kesehatan' },
      { id: 'feeling', label: '😊 Merasa lebih baik setiap hari' },
      { id: 'confidence', label: '✨ Meningkatkan kepercayaan diri' },
      { id: 'lifestyle', label: '🌱 Gaya hidup lebih sehat' },
    ];

    const toggleMotivation = (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMotivations(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));
    };

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>Apa yang ingin Anda capai?</Text>
          <Text style={styles.questionSubtitle}>Pilih semua yang sesuai</Text>
        </View>

        <View style={styles.optionsList}>
          {motivationOptions.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[styles.activityCard, motivations.includes(option.id) && styles.activityCardActive]}
              onPress={() => toggleMotivation(option.id)}
              activeOpacity={0.7}
            >
              <Text style={[styles.activityCardTitle, motivations.includes(option.id) && styles.activityCardTitleActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, motivations.length === 0 && styles.primaryButtonDisabled]}
          onPress={handleNext}
          disabled={motivations.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Lanjutkan</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderDietType = () => {
    const dietOptions = [
      { id: 'none', label: '🍽️ Tidak ada diet khusus' },
      { id: 'vegetarian', label: '🥗 Vegetarian' },
      { id: 'vegan', label: '🌱 Vegan' },
      { id: 'keto', label: '🥑 Keto' },
      { id: 'paleo', label: '🍖 Paleo' },
      { id: 'halal', label: '☪️ Halal' },
    ];

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>Apakah Anda menjalani{'\n'}diet khusus?</Text>
        </View>

        <View style={styles.optionsList}>
          {dietOptions.map(option => (
            <TouchableOpacity
              key={option.id}
              style={[styles.activityCard, dietType === option.id && styles.activityCardActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setDietType(option.id);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.activityCardTitle, dietType === option.id && styles.activityCardTitleActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !dietType && styles.primaryButtonDisabled]}
          onPress={handleNext}
          disabled={!dietType}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>Lanjutkan</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  // HIDDEN: Third carousel step
  /* 
  const renderThanks = () => (
    <View style={styles.stepContainer}>
      <View style={styles.reassuranceContainer}>
        <View style={styles.reassuranceIconCircle}>
          <Svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <Path
              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
              fill="#6C63FF"
            />
          </Svg>
        </View>
        <Text style={styles.reassuranceTitle}>Terima kasih sudah{'\n'}mempercayai kami</Text>
        <Text style={styles.reassuranceSubtitle}>
          Kami di sini untuk mendukung perjalanan Anda menuju kesehatan yang lebih baik.
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>Lanjutkan</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
  */

  const renderHealthConnect = () => (
    <View style={styles.stepContainer}>
      <View style={styles.reassuranceContainer}>
        <View style={[styles.reassuranceIconCircle, { backgroundColor: 'rgba(59, 130, 246, 0.12)' }]}> 
          <Footprints size={48} color="#3B82F6" />
        </View>
        <Text style={styles.reassuranceTitle}>Lacak langkah{'\n'}& aktivitas Anda</Text>
        <Text style={styles.reassuranceSubtitle}>
          Hubungkan dengan Apple Health atau Google Fit untuk melacak langkah dan kalori terbakar secara otomatis.
        </Text>
      </View>

      <View style={styles.healthFeatures}>
        <View style={styles.healthFeatureRow}>
          <View style={styles.healthFeatureDot}>
            <Footprints size={16} color="#3B82F6" />
          </View>
          <Text style={styles.healthFeatureText}>Langkah harian otomatis</Text>
        </View>
        <View style={styles.healthFeatureRow}>
          <View style={[styles.healthFeatureDot, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}> 
            <Heart size={16} color="#EF4444" />
          </View>
          <Text style={styles.healthFeatureText}>Kalori terbakar dari aktivitas</Text>
        </View>
      </View>

      <View style={styles.notificationButtons}>
        <TouchableOpacity style={[styles.primaryButton, { backgroundColor: '#3B82F6' }]} onPress={handleEnableHealthConnect} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Hubungkan Sekarang</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipHealthConnect} activeOpacity={0.7}>
          <Text style={styles.skipButtonText}>Nanti saja</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderNotificationPermission = () => (
    <View style={styles.stepContainer}>
      <View style={styles.reassuranceContainer}>
        <View style={styles.reassuranceIconCircle}>
          <Text style={{ fontSize: 64 }}>🔔</Text>
        </View>
        <Text style={styles.reassuranceTitle}>Tetap konsisten{'\n'}dengan reminder</Text>
        <Text style={styles.reassuranceSubtitle}>
          Izinkan notifikasi untuk pengingat harian yang membantu Anda tetap on track.
        </Text>
      </View>

      <View style={styles.notificationButtons}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleEnableNotifications} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Aktifkan Notifikasi</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipNotifications} activeOpacity={0.7}>
          <Text style={styles.skipButtonText}>Lewati untuk sekarang</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLoading = () => {
    const circumference = 2 * Math.PI * 60;
    const strokeDashoffset = circularProgress.interpolate({
      inputRange: [0, 1],
      outputRange: [circumference, 0],
    });

    return (
      <View style={styles.loadingContainer}>
        <View style={styles.circularProgressContainer}>
          <Svg width="140" height="140" viewBox="0 0 140 140">
            <Circle cx="70" cy="70" r="60" stroke="#E5E5E5" strokeWidth="8" fill="none" />
            <G rotation="-90" originX="70" originY="70">
              <AnimatedCircle
                cx="70"
                cy="70"
                r="60"
                stroke="#6C63FF"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </G>
          </Svg>
          <View style={styles.circularProgressTextContainer}>
            <Sparkles size={32} color="#6C63FF" />
          </View>
        </View>
        <Text style={styles.loadingTitle}>Membuat rencana{'\n'}khusus Anda</Text>
        <Text style={styles.loadingSubtext}>{loadingMessage}...</Text>
      </View>
    );
  };

  const renderFinal = () => {
    if (!sex || !activityLevel) return null;

    const calculatedGoal: Goal =
      dreamWeight < weight ? 'fat_loss' : dreamWeight > weight ? 'muscle_gain' : 'maintenance';

    const today = new Date();
    const age =
      today.getFullYear() -
      birthDate.getFullYear() -
      (today.getMonth() < birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate())
        ? 1
        : 0);

    const weightDiff = Math.abs(dreamWeight - weight);
    const weeksNeeded = Math.ceil(weightDiff / weeklyWeightChange);
    const projectedDate = new Date();
    projectedDate.setDate(projectedDate.getDate() + weeksNeeded * 7);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const formattedDate = `${projectedDate.getDate()} ${monthNames[projectedDate.getMonth()]} ${projectedDate.getFullYear()}`;

    const bmr =
      sex === 'male'
        ? 10 * weight + 6.25 * height - 5 * age + 5
        : 10 * weight + 6.25 * height - 5 * age - 161;

    const activityMultipliers = { low: 1.2, moderate: 1.55, high: 1.9 } as const;
    const tdee = bmr * activityMultipliers[activityLevel];

    const goalCalories =
      calculatedGoal === 'fat_loss' ? tdee - 500 : calculatedGoal === 'muscle_gain' ? tdee + 300 : tdee;

    const proteinCals = weight * 2.2 * 4;
    const fatCals = goalCalories * 0.25;

    const proteinPercent = Math.round((proteinCals / goalCalories) * 100);
    const fatPercent = Math.round((fatCals / goalCalories) * 100);
    const carbsPercent = 100 - proteinPercent - fatPercent;

    return (
      <ScrollView
        style={styles.finalScrollView}
        contentContainerStyle={[styles.finalScrollContent, { paddingBottom: 40 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      >
        <View style={styles.finalPlanContainer}>
          <Text style={styles.finalPlanTitle}>Selamat! Rencana Anda Siap! 🎉</Text>

          <View style={styles.projectionBanner}>
            <Text style={styles.projectionLabel}>Anda akan mencapai</Text>
            <Text style={styles.projectionWeight}>{dreamWeight} kg</Text>
            <Text style={styles.projectionDate}>pada {formattedDate}</Text>
          </View>

          <View style={styles.donutChartContainer}>
            <Svg width={200} height={200} viewBox="0 0 200 200">
              <G rotation="-90" originX="100" originY="100">
                <Circle
                  cx="100"
                  cy="100"
                  r="70"
                  stroke="#FF9F43"
                  strokeWidth="22"
                  fill="none"
                  strokeDasharray={`${(carbsPercent / 100) * 439.8} 439.8`}
                />
                <Circle
                  cx="100"
                  cy="100"
                  r="70"
                  stroke="#6C63FF"
                  strokeWidth="22"
                  fill="none"
                  strokeDasharray={`${(proteinPercent / 100) * 439.8} 439.8`}
                  strokeDashoffset={-((carbsPercent / 100) * 439.8)}
                />
                <Circle
                  cx="100"
                  cy="100"
                  r="70"
                  stroke="#4ECDC4"
                  strokeWidth="22"
                  fill="none"
                  strokeDasharray={`${(fatPercent / 100) * 439.8} 439.8`}
                  strokeDashoffset={-(((carbsPercent + proteinPercent) / 100) * 439.8)}
                />
              </G>
            </Svg>
            <View style={styles.donutCenter}>
              <Text style={styles.donutCenterValue}>{Math.round(goalCalories)}</Text>
              <Text style={styles.donutCenterLabel}>kkal/hari</Text>
            </View>
          </View>

          <View style={styles.macroLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9F43' }]} />
              <Text style={styles.legendText}>Karbo {carbsPercent}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#6C63FF' }]} />
              <Text style={styles.legendText}>Protein {proteinPercent}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4ECDC4' }]} />
              <Text style={styles.legendText}>Lemak {fatPercent}%</Text>
            </View>
          </View>

          <View style={styles.tipsSection}>
            <Text style={styles.tipsSectionTitle}>Cara mencapai target 🎯</Text>

            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Text style={styles.tipIcon}>📸</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Lacak makanan Anda</Text>
                <Text style={styles.tipDesc}>Foto setiap makanan untuk hasil terbaik</Text>
              </View>
            </View>

            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Text style={styles.tipIcon}>🔥</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Ikuti kalori harian</Text>
                <Text style={styles.tipDesc}>Konsistensi adalah kunci kesuksesan</Text>
              </View>
            </View>

            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Text style={styles.tipIcon}>⚖️</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>Seimbangkan makro Anda</Text>
                <Text style={styles.tipDesc}>Perhatikan protein, karbo, dan lemak</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleComplete} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>Mulai Sekarang</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </ScrollView>
    );
  };

  // HIDDEN: Subscription modal
  /* 
  const renderSubscription = () => {
    const yearlyPrice = 'Rp 349.000 / tahun';
    const yearlyEquiv = 'Rp 29.000 / bulan';
    const monthlyPrice = 'Rp 59.000 / bulan';

    return (
      <View style={styles.subscriptionOverlay}>
        <TouchableOpacity
          style={styles.subscriptionBackdrop}
          onPress={() => {
            setShowSubscription(false);
            router.replace('/(tabs)');
          }}
          activeOpacity={1}
        />
        <Animated.View
          style={[
            styles.subscriptionModal,
            {
              paddingBottom: 40 + insets.bottom,
              transform: [{ translateY: subscriptionSlideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.subscriptionClose}
            onPress={() => {
              setShowSubscription(false);
              router.replace('/(tabs)');
            }}
            activeOpacity={0.7}
          >
            <Svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <Path d="M18 6L6 18M6 6l12 12" stroke="#666666" strokeWidth="2" strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          <Image
            source={require('../assets/images/subscription.jpg')}
            style={styles.subscriptionHeroImage}
            resizeMode="cover"
          />

          <Text style={styles.subscriptionTitle}>{t.subscription.title}</Text>
          <Text style={styles.subscriptionSubtitle}>{t.subscription.subtitle}</Text>

          <TouchableOpacity
            style={[
              styles.subscriptionPriceCard,
              selectedSubscription === 'yearly' && styles.subscriptionPriceCardActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedSubscription('yearly');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.subscriptionPriceRow}>
              <View>
                <Text style={styles.subscriptionPlanLabel}>Tahunan</Text>
                <Text style={styles.subscriptionPlanPrice}>{yearlyPrice}</Text>
                <Text style={styles.subscriptionMonthlyEquiv}>{yearlyEquiv}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.subscriptionPriceCard,
              selectedSubscription === 'monthly' && styles.subscriptionPriceCardActive,
            ]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedSubscription('monthly');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.subscriptionPriceRow}>
              <View>
                <Text style={styles.subscriptionPlanLabel}>Bulanan</Text>
                <Text style={styles.subscriptionPlanPrice}>{monthlyPrice}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subscriptionButton}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setShowSubscription(false);
              setStep(18);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.subscriptionButtonText}>{t.subscription.startTransformation}</Text>
            <Text style={styles.subscriptionButtonSubtext}>{t.subscription.trial}</Text>
          </TouchableOpacity>

          <View style={styles.subscriptionFooter}>
            <Text style={styles.subscriptionFooterLink}>Ketentuan Layanan</Text>
            <Text style={styles.subscriptionFooterDivider}>|</Text>
            <Text style={styles.subscriptionFooterLink}>Kebijakan Privasi</Text>
            <Text style={styles.subscriptionFooterDivider}>|</Text>
            <Text style={styles.subscriptionFooterLink}>Pulihkan Pembelian</Text>
          </View>
        </Animated.View>
      </View>
    );
  };
  */

  const renderThankYouName = () => (
    <View style={styles.stepContainer}>
      <View style={styles.thankYouContainer}>
        <View style={styles.thankYouIconCircle}>
          <Text style={styles.thankYouEmoji}>🎉</Text>
        </View>
        <Text style={styles.thankYouTitle}>Terima Kasih!</Text>
        <Text style={styles.thankYouSubtitle}>
          Terima kasih telah bergabung dengan DietKu. Kami siap menemani perjalanan sehatmu.
        </Text>
      </View>

      <View style={styles.nameInputSection}>
        <Text style={styles.nameInputLabel}>Nama Kamu</Text>
        <TextInput
          style={styles.nameInput}
          value={userName}
          onChangeText={setUserName}
          placeholder="Masukkan nama Anda"
          placeholderTextColor="#999999"
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={() => {
            if (userName.trim()) {
              Keyboard.dismiss();
            }
          }}
        />
        <Text style={styles.nameInputHelper}>Nama ini akan digunakan untuk sapaan personal di aplikasi.</Text>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !userName.trim() && styles.primaryButtonDisabled]}
        onPress={() => {
          if (!userName.trim()) return;
          
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          
          if (profile) {
            saveProfile({
              ...profile,
              name: userName.trim(),
            });
          }

          handleNext();
        }}
        disabled={!userName.trim()}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Lanjutkan</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderSignIn = () => (
    <View style={styles.stepContainer}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <Path
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              fill="#6C63FF"
            />
          </Svg>
        </View>
        <Text style={styles.signInTitle}>Simpan Progress Anda</Text>
        <Text style={styles.signInSubtitle}>Masuk untuk menyinkronkan data di semua perangkat</Text>
      </View>

      <View style={styles.signInForm}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nama Depan</Text>
          <TextInput
            style={styles.signInInput}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Nama depan"
            placeholderTextColor="#999999"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Nama Belakang</Text>
          <TextInput
            style={styles.signInInput}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Nama belakang"
            placeholderTextColor="#999999"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View
          onLayout={(e) => {
            signInEmailY.current = e.nativeEvent.layout.y;
          }}
          style={styles.inputGroup}
        >
          <Text style={styles.inputLabel}>Email</Text>
          <TextInput
            style={styles.signInInput}
            value={signInEmail}
            onFocus={() => scrollToY(signInEmailY.current)}
            onChangeText={setSignInEmail}
            placeholder="nama@email.com"
            placeholderTextColor="#999999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
            onSubmitEditing={() => {
              scrollToY(signInPasswordY.current);
            }}
          />
        </View>

        <View
          onLayout={(e) => {
            signInPasswordY.current = e.nativeEvent.layout.y;
          }}
          style={styles.inputGroup}
        >
          <Text style={styles.inputLabel}>Password</Text>
          <TextInput
            style={styles.signInInput}
            value={signInPassword}
            onFocus={() => scrollToY(signInPasswordY.current)}
            onChangeText={setSignInPassword}
            placeholder="••••••••"
            placeholderTextColor="#999999"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Ketik Ulang Password</Text>
          <TextInput
            style={styles.signInInput}
            value={signInPasswordConfirm}
            onChangeText={setSignInPasswordConfirm}
            placeholder="••••••••"
            placeholderTextColor="#999999"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />
        </View>

        <TouchableOpacity 
          style={[styles.primaryButton, isCreatingAccount && styles.primaryButtonDisabled]} 
          onPress={handleSignIn} 
          activeOpacity={0.8}
          disabled={isCreatingAccount}
        >
          <Text style={styles.primaryButtonText}>{isCreatingAccount ? 'Membuat akun...' : 'Daftar'}</Text>
          {!isCreatingAccount && <ArrowRight size={20} color="#FFFFFF" />}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>atau</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity style={styles.googleButton} onPress={handleGoogleSignIn} activeOpacity={0.7} disabled={isGoogleSigningIn}>
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
          <Text style={styles.googleButtonText}>{isGoogleSigningIn ? 'Memproses...' : 'Lanjutkan dengan Google'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderStep = () => {
    if (showLoading) return renderLoading();

    switch (step) {
      case 0:
        return renderIntro();
      case 1:
        return renderDateOfBirth();
      case 2:
        return renderSex();
      case 3:
        return renderHeight();
      case 4:
        return renderWeight();
      case 5:
        return renderGoalSelection();
      case 6:
        return renderLongTermResults();
      case 7:
        return renderDreamWeight();
      case 8:
        return renderActivityLevel();
      case 9:
        return renderWeeklyWeightChange();
      case 10:
        return renderReassurance();
      case 11:
        return renderMotivations();
      case 12:
        return renderDietType();
      case 13:
        // HIDDEN: Third carousel (renderThanks)
        return renderFinal();
      case 14:
        return renderFinal();
      case 15:
        return renderSignIn();
      case 16:
        return renderThankYouName();
      case 17:
        return renderHealthConnect();
      case 18:
        return renderNotificationPermission();
      default:
        return renderIntro();
    }
  };

  const contentPaddingBottom = Platform.OS === 'android' 
    ? Math.max(24, insets.bottom) + 16 
    : Math.max(20, insets.bottom);
  const contentPaddingTop = Platform.OS === 'android' ? 24 : insets.top + 8;
  const ScreenWrapper = Platform.OS === 'ios' ? KeyboardAvoidingView : View;

  // Step 14 (renderFinal) has its own ScrollView, so we use View to avoid nested scroll issues on iOS
  const useViewWrapper = step === 14;

  const renderContent = () => (
    <>
      {step > 0 && !showLoading && (
        <TouchableOpacity style={styles.backButtonTop} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={24} color="#666666" />
        </TouchableOpacity>
      )}

      {step > 0 && step <= totalSteps && !showLoading && (
        <View style={styles.progressBarContainer}>
          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        </View>
      )}

      <Animated.View style={[styles.contentWrapper, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
        {renderStep()}
      </Animated.View>
    </>
  );

  return (
    <ScreenWrapper
      style={styles.container}
      {...(Platform.OS === 'ios' ? { behavior: 'padding', keyboardVerticalOffset: 0 } : {})}
    >
      {useViewWrapper ? (
        <View style={[styles.scrollContent, { paddingBottom: contentPaddingBottom, paddingTop: contentPaddingTop, flex: 1 }]}>
          {renderContent()}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: contentPaddingBottom, paddingTop: contentPaddingTop }]}
          showsVerticalScrollIndicator={false}
          scrollEnabled={step === 15 && !showLoading}
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        >
          {renderContent()}
        </ScrollView>
      )}

      {/* HIDDEN: Subscription modal */}
      {/* {showSubscription && renderSubscription()} */}
    </ScreenWrapper>
  );
}

