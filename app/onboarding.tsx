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
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useNotifications } from '@/contexts/NotificationContext';
import { Goal, ActivityLevel, Sex } from '@/types/nutrition';
import { ArrowRight, ArrowLeft, Eye, EyeOff, Sparkles, Gift } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Svg, Path, Circle, G } from 'react-native-svg';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ResizeMode, Video } from 'expo-av';
import { ANIMATION_DURATION, SPRING_CONFIG } from '@/constants/animations';
import { onboardingStyles as styles } from '@/styles/onboardingStyles';
import { calculateTDEE } from '@/utils/nutritionCalculations';
import PaywallReferralSection, { type PaywallReferralSectionHandle } from '@/components/PaywallReferralSection';
import { stashPendingReferralCode } from '@/lib/pendingReferralCode';

const WEEKLY_DEFAULT_LOSS_KG = 0.5;
const WEEKLY_DEFAULT_GAIN_KG = 0.3;
const MINIMUM_AGE = 13;

export default function OnboardingScreen() {
  const { saveProfile, profile, signUp, authState } = useNutrition();
  const { t, l } = useLanguage();
  const { enableNotifications } = useNotifications();
  const insets = useSafeAreaInsets();
  const { mode, ref: referralLinkRef } = useLocalSearchParams<{ mode?: string; ref?: string | string[] }>();
  const isCompleteMode = mode === 'complete';
  const refFromOnboardingLink =
    typeof referralLinkRef === 'string' ? referralLinkRef : referralLinkRef?.[0] ?? null;

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
  const [mainObstacle, setMainObstacle] = useState<string | null>(null);
  const [hasCoach, setHasCoach] = useState<'yes' | 'no' | null>(null);
  const [usedTrackingApp, setUsedTrackingApp] = useState<'yes' | 'no' | null>(null);
  const [dietType, setDietType] = useState<string | null>(null);

  const [showLoading, setShowLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Analyzing your data');
  const circularProgress = useRef(new Animated.Value(0)).current;

  const introScaleAnim = useRef(new Animated.Value(0)).current;
  const introTextAnim = useRef(new Animated.Value(0)).current;
  const introCtaAnim = useRef(new Animated.Value(0)).current;
  const optionEnterAnims = useRef(Array.from({ length: 6 }, () => new Animated.Value(1))).current;
  const insightCardAnim = useRef(new Animated.Value(0)).current;
  const insightLineAnim = useRef(new Animated.Value(0)).current;
  const insightBarsAnim = useRef(new Animated.Value(0)).current;

  // HIDDEN: Subscription features
  // const [showSubscription, setShowSubscription] = useState(false);
  // const [selectedSubscription, setSelectedSubscription] = useState<'yearly' | 'monthly'>('yearly');
  // const subscriptionSlideAnim = useRef(new Animated.Value(1000)).current;

  const [signInEmail, setSignInEmail] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInPasswordConfirm, setSignInPasswordConfirm] = useState('');
  const [showSignInPassword, setShowSignInPassword] = useState(false);
  const [showSignInPasswordConfirm, setShowSignInPasswordConfirm] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const totalSteps = 20;

  const referralRef = useRef<PaywallReferralSectionHandle | null>(null);

  // Y positions for inputs
  const heightY = useRef(0);
  const weightY = useRef(0);
  const dreamWeightY = useRef(0);
  const weeklyWeightChangeY = useRef(0);
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
              
              const nameFromSignUp = `${firstName.trim()} ${lastName.trim()}`.trim();
              saveProfile({
                name: nameFromSignUp || profile?.name || undefined,
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
  }, [showLoading, circularProgress, isCompleteMode, authState.isSignedIn, birthDate, dreamWeight, weight, sex, height, activityLevel, weeklyWeightChange, firstName, lastName, profile?.name, saveProfile]);

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

  useEffect(() => {
    if (refFromOnboardingLink?.trim()) void stashPendingReferralCode(refFromOnboardingLink.trim());
  }, [refFromOnboardingLink]);

  useEffect(() => {
    const optionCountByStep: Record<number, number> = {
      2: 2,
      5: 3,
      8: 3,
      11: 6,
      12: 5,
      13: 2,
      14: 2,
      15: 6,
    };
    const activeCount = optionCountByStep[step];
    if (!activeCount || showLoading) return;

    optionEnterAnims.forEach((anim, index) => {
      anim.setValue(index < activeCount ? 0 : 1);
    });

    Animated.stagger(
      75,
      optionEnterAnims.slice(0, activeCount).map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [step, showLoading, optionEnterAnims]);

  useEffect(() => {
    if (showLoading || ![6, 10, 16].includes(step)) return;

    insightCardAnim.setValue(0);
    insightLineAnim.setValue(0);
    insightBarsAnim.setValue(0);

    Animated.sequence([
      Animated.timing(insightCardAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.stagger(120, [
        Animated.timing(insightLineAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: false,
        }),
        Animated.timing(insightBarsAnim, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [step, showLoading, insightCardAnim, insightLineAnim, insightBarsAnim]);

  const getOptionEnterStyle = useCallback(
    (index: number) => {
      const anim = optionEnterAnims[index] ?? optionEnterAnims[optionEnterAnims.length - 1];
      return {
        opacity: anim,
        transform: [
          {
            translateY: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [14, 0],
            }),
          },
          {
            scale: anim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.985, 1],
            }),
          },
        ],
      };
    },
    [optionEnterAnims]
  );

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

    // Age gate warning: inform users, but do not hard-block navigation.
    if (step === 1) {
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear() -
        (today.getMonth() < birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() && today.getDate() < birthDate.getDate()) ? 1 : 0);

      if (age < MINIMUM_AGE) {
        Alert.alert(
          'Usia tidak memenuhi syarat',
          `Anda harus berusia minimal ${MINIMUM_AGE} tahun untuk menggunakan aplikasi ini.`
        );
      }
    }

    // Show fake loading right before the final plan page.
    if (step === 16) {
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
  }, [step, birthDate, fadeAnim, animateTransition]);

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
      Alert.alert(l('Error', 'Error'), l('Mohon isi semua field', 'Please fill in all fields'));
      return;
    }

    if (signInPassword.length < 6) {
      Alert.alert(l('Error', 'Error'), l('Password minimal 6 karakter', 'Password must be at least 6 characters'));
      return;
    }

    if (signInPassword !== signInPasswordConfirm) {
      Alert.alert(l('Error', 'Error'), l('Password tidak cocok', 'Passwords do not match'));
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
          Alert.alert(l('Email Sudah Terdaftar', 'Email Already Registered'), l('Email ini sudah digunakan. Silakan gunakan email lain atau masuk dengan akun yang ada.', 'This email is already used. Please use another email or sign in with your existing account.'));
        } else if (error.message.includes('Invalid email')) {
          Alert.alert(l('Email Tidak Valid', 'Invalid Email'), l('Masukkan alamat email yang valid.', 'Please enter a valid email address.'));
        } else if (error.message.includes('Password')) {
          Alert.alert(l('Password Tidak Valid', 'Invalid Password'), error.message);
        } else {
          Alert.alert(l('Error', 'Error'), l(`Gagal membuat akun: ${error.message}`, `Failed to create account: ${error.message}`));
        }
      } else {
        Alert.alert(l('Error', 'Error'), l('Gagal membuat akun. Silakan coba lagi.', 'Failed to create account. Please try again.'));
      }
    } finally {
      setIsCreatingAccount(false);
    }
  }, [signInEmail, signInPassword, signInPasswordConfirm, firstName, lastName, signUp, birthDate, sex, height, weight, dreamWeight, activityLevel, weeklyWeightChange, handleNext]);

  // HIDDEN: Subscription features
  // const handleSkipSignIn = useCallback(() => {
  //   openSubscription();
  // }, [openSubscription]);

  const handleEnableNotifications = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await enableNotifications();
    router.replace('/onboarding-subscription?from=onboarding');
  }, [enableNotifications]);

  const handleSkipNotifications = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace('/onboarding-subscription?from=onboarding');
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  const AnimatedCircle = useMemo(() => Animated.createAnimatedComponent(Circle), []);
  const AnimatedPath = useMemo(() => Animated.createAnimatedComponent(Path), []);

  const renderIntro = () => (
    <View style={styles.introContainer}>
      <Text
        style={{
          textAlign: 'center',
          fontSize: 40,
          fontWeight: '800',
          color: '#111827',
          letterSpacing: -1,
          marginTop: 8,
          marginBottom: 10,
        }}
      >
        {l('DietKu', 'DietKu')}
      </Text>

      <Animated.View
        style={[
          styles.introImageHero,
          {
            transform: [{ scale: introScaleAnim }],
            opacity: introScaleAnim,
          },
        ]}
      >
        <Video
          source={require('../assets/videos/subscription-preview.mp4')}
          style={styles.introImageLarge}
          resizeMode={ResizeMode.CONTAIN}
          shouldPlay
          isLooping
          isMuted
          useNativeControls={false}
        />
        <View style={styles.introFloatingBadge}>
          <Sparkles size={12} color="#FFFFFF" />
          <Text style={styles.introFloatingBadgeText}>{l('Teknologi AI', 'Teknologi AI')}</Text>
        </View>
      </Animated.View>

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
          <Text style={styles.introPrimaryButtonText}>{l('Mulai Perjalananmu', 'Start Your Journey')}</Text>
          <View style={styles.introButtonIconCircle}>
            <ArrowRight size={16} color="#22C55E" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.introSignInLink}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.replace('/sign-in');
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.introSignInText}>{l('Sudah punya akun? ', 'Already have an account? ')}</Text>
          <Text style={styles.introSignInTextBold}>{l('Masuk', 'Sign In')}</Text>
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
          <Text style={styles.questionTitle}>{l('Kapan tanggal lahir Anda?', 'When is your date of birth?')}</Text>
          <Text style={styles.questionSubtitle}>{l('Ini membantu kami menghitung kebutuhan kalori Anda', 'This helps us calculate your calorie needs')}</Text>
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
          <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderSex = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>{l('Apa jenis kelamin Anda?', 'What is your sex?')}</Text>
        <Text style={styles.questionSubtitle}>{l('Kami akan menggunakan ini untuk membuat rencana khusus Anda', 'We use this to create your personalized plan')}</Text>
      </View>

      <View style={styles.genderOptions}>
        <Animated.View style={[styles.genderOptionWrapper, getOptionEnterStyle(0)]}>
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
                <Circle cx="12" cy="12" r="5" stroke={sex === 'male' ? '#22C55E' : '#999999'} strokeWidth="2" />
                <Path
                  d="M17 7L22 2M22 2h-5M22 2v5"
                  stroke={sex === 'male' ? '#22C55E' : '#999999'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={[styles.genderText, sex === 'male' && styles.genderTextActive]}>{l('Pria', 'Male')}</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={[styles.genderOptionWrapper, getOptionEnterStyle(1)]}>
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
                <Circle cx="12" cy="9" r="5" stroke={sex === 'female' ? '#22C55E' : '#999999'} strokeWidth="2" />
                <Path
                  d="M12 14v8M9 19h6"
                  stroke={sex === 'female' ? '#22C55E' : '#999999'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
            <Text style={[styles.genderText, sex === 'female' && styles.genderTextActive]}>{l('Wanita', 'Female')}</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !sex && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!sex}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{l("Selanjutnya", "Next")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderHeight = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>{l('Berapa tinggi badan Anda?', 'What is your height?')}</Text>
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
            placeholder={l('170', '170')}
            placeholderTextColor="#666"
            selectTextOnFocus
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <Text style={styles.inputUnit}>{l('cm', 'cm')}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>{l("Selanjutnya", "Next")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderWeight = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>{l('Berapa berat badan Anda saat ini?', 'What is your current weight?')}</Text>
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
            placeholder={l('70', '70')}
            placeholderTextColor="#666"
            selectTextOnFocus
            returnKeyType="done"
            blurOnSubmit
            onSubmitEditing={() => Keyboard.dismiss()}
          />
          <Text style={styles.inputUnit}>{l('kg', 'kg')}</Text>
        </View>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>{l("Selanjutnya", "Next")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderGoalSelection = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={[styles.questionTitle, { maxWidth: '100%' }]}>{l('Apa yang ingin Anda capai?', 'What do you want to achieve?')}</Text>
      </View>

      <View style={styles.optionsList}>
        <Animated.View style={getOptionEnterStyle(0)}>
          <TouchableOpacity
            style={[styles.goalCard, selectedGoal === 'gain' && styles.goalCardActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedGoal('gain');
              setWeeklyWeightChange(WEEKLY_DEFAULT_GAIN_KG);
              setWeeklyWeightChangeText(String(WEEKLY_DEFAULT_GAIN_KG));
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
              <Text style={styles.goalCardDesc}>{l('Bangun otot dan tingkatkan massa tubuh', 'Build muscle and increase body mass')}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={getOptionEnterStyle(1)}>
          <TouchableOpacity
            style={[styles.goalCard, selectedGoal === 'maintain' && styles.goalCardActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedGoal('maintain');
              setWeeklyWeightChange(WEEKLY_DEFAULT_LOSS_KG);
              setWeeklyWeightChangeText(String(WEEKLY_DEFAULT_LOSS_KG));
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
              <Text style={styles.goalCardDesc}>{l('Jaga berat badan sehat yang stabil', 'Maintain a stable healthy weight')}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={getOptionEnterStyle(2)}>
          <TouchableOpacity
            style={[styles.goalCard, selectedGoal === 'lose' && styles.goalCardActive]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setSelectedGoal('lose');
              setWeeklyWeightChange(WEEKLY_DEFAULT_LOSS_KG);
              setWeeklyWeightChangeText(String(WEEKLY_DEFAULT_LOSS_KG));
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
              <Text style={styles.goalCardDesc}>{l('Kurangi lemak dan capai berat sehat', 'Reduce fat and reach a healthy weight')}</Text>
            </View>
          </TouchableOpacity>
        </Animated.View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !selectedGoal && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!selectedGoal}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{l("Selanjutnya", "Next")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderLongTermResults = () => {
    const lineDashOffset = insightLineAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [560, 0],
    });

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>{l('DietKu bantu hasil jangka panjang', 'DietKu supports long-term results')}</Text>
        </View>

        <View style={premiumStyles.insightPageMain}>
          <Animated.View
            style={[
              premiumStyles.insightCard,
              {
                opacity: insightCardAnim,
                transform: [
                  {
                    translateY: insightCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={premiumStyles.insightCardHeaderRow}>
              <Text style={premiumStyles.insightCardTitle}>{l('Tren 3 bulan', '3-month trend')}</Text>
              <Text style={premiumStyles.insightCardHint}>{l('DietKu vs cara biasa', 'DietKu vs usual way')}</Text>
            </View>
            <Svg width="100%" height="178" viewBox="0 0 360 178">
              <Path d="M18 30H342M18 88H342M18 146H342" stroke="#E5E7EB" strokeDasharray="5 6" strokeWidth="1" />
              <AnimatedPath
                d="M18 122 C 70 130, 120 116, 168 94 C 214 74, 270 54, 342 30"
                stroke="#22C55E"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={560}
                strokeDashoffset={lineDashOffset}
              />
              <AnimatedPath
                d="M18 106 C 84 100, 128 124, 178 138 C 224 148, 278 132, 342 102"
                stroke="#9CA3AF"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={560}
                strokeDashoffset={lineDashOffset}
              />
              <Path d="M18 148H342" stroke="#111827" strokeWidth="2.5" />
              <Path d="M18 122a5 5 0 110 0.1M168 94a5 5 0 110 0.1M342 30a5 5 0 110 0.1" fill="#22C55E" />
            </Svg>
            <View style={premiumStyles.insightAxisRow}>
              <Text style={premiumStyles.insightAxisLabel}>{l('Minggu 2', 'Week 2')}</Text>
              <Text style={premiumStyles.insightAxisLabel}>{l('Minggu 6', 'Week 6')}</Text>
              <Text style={premiumStyles.insightAxisLabel}>{l('Minggu 12', 'Week 12')}</Text>
            </View>
          </Animated.View>

          <Text style={premiumStyles.insightSubheadline}>
            Perubahan stabil lebih mudah dipertahankan daripada hasil instan.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

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
        <Text style={styles.questionTitle}>{l('Berapa berat badan yang Anda inginkan?', 'What is your target weight?')}</Text>
        <Text style={styles.questionSubtitle}>{l('Tap angka target untuk mengubah', 'Tap the target number to edit')}</Text>
      </View>

      <View style={styles.inputSection}>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>{l('Saat Ini', 'Current')}</Text>
            <View style={styles.weightValueRow}>
              <Text style={styles.comparisonValueNum}>{weight}</Text>
              <Text style={styles.comparisonUnitInline}>{l('kg', 'kg')}</Text>
            </View>
          </View>

          <ArrowRight size={22} color="#666" />

          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>{l('Target', 'Target')}</Text>
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
                placeholder={l('65', '65')}
                placeholderTextColor="#999"
                selectTextOnFocus
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={() => Keyboard.dismiss()}
              />
              <Text style={styles.comparisonUnitInline}>{l('kg', 'kg')}</Text>
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
        <Text style={styles.primaryButtonText}>{l("Selanjutnya", "Next")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
  };

  const renderActivityLevel = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>{l('Pilih tingkat aktivitas', 'Choose activity level')}</Text>
        <Text style={styles.questionSubtitle}>{l('Kami akan menggunakan informasi ini untuk membuat rencana khusus Anda', 'We use this to create your personalized plan')}</Text>
      </View>

      <View style={styles.optionsList}>
        <Animated.View style={getOptionEnterStyle(0)}>
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
            <Text style={styles.activityCardDesc}>{l('Sempurna untuk mereka yang memiliki gaya hidup kurang aktif.', 'Perfect for people with a less active lifestyle.')}</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={getOptionEnterStyle(1)}>
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
            <Text style={styles.activityCardDesc}>{l('Dirancang untuk mereka yang berolahraga secara teratur.', 'Designed for people who exercise regularly.')}</Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={getOptionEnterStyle(2)}>
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
        </Animated.View>
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !activityLevel && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!activityLevel}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{l("Selanjutnya", "Next")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderWeeklyWeightChange = () => {
    const isGaining = dreamWeight > weight;

    const minRec = 0.2;
    const maxRec = isGaining ? 0.5 : 1.0;

    const parsed = parseFloat(weeklyWeightChangeText);
    const hasNumber = !Number.isNaN(parsed);

    const isOutOfRange = hasNumber && (parsed < minRec || parsed > maxRec);
    const showWarning = hasNumber && isOutOfRange;

    const clampToRecommended = () => {
      const next = Math.min(maxRec, Math.max(minRec, hasNumber ? parsed : weeklyWeightChange));
      const fallback = isGaining ? WEEKLY_DEFAULT_GAIN_KG : WEEKLY_DEFAULT_LOSS_KG;
      const normalized = Number.isFinite(next) ? next : fallback;
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
              placeholder={isGaining ? String(WEEKLY_DEFAULT_GAIN_KG) : String(WEEKLY_DEFAULT_LOSS_KG)}
              placeholderTextColor="#666"
              selectTextOnFocus
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            <Text style={[styles.inputUnit, showWarning && styles.inputUnitWarning]}>{l('kg', 'kg')}</Text>
          </View>

          {showWarning && (
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationTitle}>{l('Rekomendasi', 'Recommendation')}</Text>
              <Text style={styles.recommendationText}>{warningText}</Text>
              <TouchableOpacity style={styles.recommendationButton} onPress={clampToRecommended} activeOpacity={0.85}>
                <Text style={styles.recommendationButtonText}>{l('Gunakan nilai rekomendasi', 'Use recommended value')}</Text>
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
          <Text style={styles.primaryButtonText}>{l("Selanjutnya", "Next")}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderReassurance = () => {
    const weightDiff = Math.abs(dreamWeight - weight);
    const isGaining = dreamWeight > weight;
    const lineDashOffset = insightLineAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [500, 0],
    });
    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>{l('Target kamu realistis dan bisa dicapai', 'Your target is realistic and achievable')}</Text>
        </View>

        <View style={premiumStyles.insightPageMain}>
          <Animated.View
            style={[
              premiumStyles.insightCard,
              {
                opacity: insightCardAnim,
                transform: [
                  {
                    translateY: insightCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={premiumStyles.insightCardTitle}>{l('Proyeksi transformasi', 'Transformation projection')}</Text>
            <Svg width="100%" height="160" viewBox="0 0 350 160">
              <Path d="M16 28H334M16 78H334M16 128H334" stroke="#E5E7EB" strokeDasharray="5 6" strokeWidth="1" />
              <AnimatedPath
                d="M16 112 C 72 108, 118 102, 174 82 C 220 64, 272 44, 334 30"
                stroke="#A16207"
                strokeWidth="4"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={500}
                strokeDashoffset={lineDashOffset}
              />
              <Path d="M16 130H334" stroke="#111827" strokeWidth="2.5" />
              <Path d="M16 112a5 5 0 110 0.1M96 106a5 5 0 110 0.1M174 82a5 5 0 110 0.1M334 30a6 6 0 110 0.1" fill="#111827" />
            </Svg>
            <View style={premiumStyles.insightAxisRow}>
              <Text style={premiumStyles.insightAxisLabel}>{l('4 hari', '4 days')}</Text>
              <Text style={premiumStyles.insightAxisLabel}>{l('10 hari', '10 days')}</Text>
              <Text style={premiumStyles.insightAxisLabel}>{l('5 minggu', '5 weeks')}</Text>
            </View>
          </Animated.View>

          <Text style={premiumStyles.insightSubheadline}>
            {isGaining ? 'Naik' : 'Turun'}{' '}
            <Text style={premiumStyles.insightHighlightValue}>{weightDiff.toFixed(1)} kg</Text>{' '}
            biasanya terlihat jelas dalam beberapa minggu.
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderConsistencyEdge = () => {
    const selfDots = 3;
    const dietkuDots = 8;

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>{l('Dengan support yang tepat, hasilnya lebih konsisten', 'With the right support, results are more consistent')}</Text>
        </View>

        <View style={premiumStyles.insightPageMain}>
          <Animated.View
            style={[
              premiumStyles.insightMiniCompareCard,
              {
                opacity: insightCardAnim,
                transform: [
                  {
                    translateY: insightCardAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [16, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={premiumStyles.insightMiniCompareTitle}>{l('Konsistensi mingguan', 'Weekly consistency')}</Text>
            <View style={premiumStyles.dotCompareRow}>
              <View style={premiumStyles.dotCompareCol}>
                <Text style={premiumStyles.insightBarTopLabel}>{l('Sendiri', 'On your own')}</Text>
                <View style={premiumStyles.dotGrid}>
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <View
                      key={`self-dot-${idx}`}
                      style={[
                        premiumStyles.dotCell,
                        idx < selfDots ? premiumStyles.dotCellMutedOn : premiumStyles.dotCellOff,
                      ]}
                    />
                  ))}
                </View>
                <Text style={premiumStyles.insightBarBottomLabel}>28%</Text>
              </View>
              <View style={premiumStyles.dotCompareCol}>
                <Text style={premiumStyles.insightBarTopLabel}>{l('Dengan DietKu', 'With DietKu')}</Text>
                <View style={premiumStyles.dotGrid}>
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <View
                      key={`dietku-dot-${idx}`}
                      style={[
                        premiumStyles.dotCell,
                        idx < dietkuDots ? premiumStyles.dotCellStrongOn : premiumStyles.dotCellOff,
                      ]}
                    />
                  ))}
                </View>
                <Text style={premiumStyles.insightBarBottomLabel}>1.8x</Text>
              </View>
            </View>
          </Animated.View>

          <Text style={premiumStyles.insightSubheadline}>
            {l('Tracking harian + target personal membuat progres lebih stabil.', 'Daily tracking + personalized targets make progress more stable.')}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderMotivations = () => {
    const motivationOptions = [
      { id: 'energy', label: l('⚡ Energi lebih baik', '⚡ Better energy') },
      { id: 'consistency', label: l('🎯 Konsistensi', '🎯 Consistency') },
      { id: 'health', label: l('❤️ Perbaikan kesehatan', '❤️ Health improvement') },
      { id: 'feeling', label: l('😊 Merasa lebih baik setiap hari', '😊 Feeling better every day') },
      { id: 'confidence', label: l('✨ Meningkatkan kepercayaan diri', '✨ Better confidence') },
      { id: 'lifestyle', label: l('🌱 Gaya hidup lebih sehat', '🌱 Healthier lifestyle') },
    ];

    const toggleMotivation = (id: string) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMotivations(prev => (prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]));
    };

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>{l('Apa yang ingin Anda capai?', 'What do you want to achieve?')}</Text>
          <Text style={styles.questionSubtitle}>{l('Pilih semua yang sesuai', 'Select all that apply')}</Text>
        </View>

        <View style={styles.optionsList}>
          {motivationOptions.map((option, index) => (
            <Animated.View key={option.id} style={getOptionEnterStyle(index)}>
              <TouchableOpacity
                style={[styles.activityCard, motivations.includes(option.id) && styles.activityCardActive]}
                onPress={() => toggleMotivation(option.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.activityCardTitle, motivations.includes(option.id) && styles.activityCardTitleActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, motivations.length === 0 && styles.primaryButtonDisabled]}
          onPress={handleNext}
          disabled={motivations.length === 0}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderMainObstacle = () => {
    const obstacleOptions = [
      { id: 'consistency', label: l('🎯 Sulit konsisten setiap hari', '🎯 Hard to stay consistent every day') },
      { id: 'eating_pattern', label: l('🍽️ Pola makan belum teratur', '🍽️ Eating pattern is still irregular') },
      { id: 'support', label: l('🤝 Kurang dukungan lingkungan', '🤝 Lack of support from environment') },
      { id: 'time', label: l('⏰ Waktu sangat terbatas', '⏰ Very limited time') },
      { id: 'planning', label: l('🧩 Bingung menyusun menu', '🧩 Confused about meal planning') },
    ];

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>{l('Apa hambatan terbesar Anda saat ini?', 'What is your biggest obstacle right now?')}</Text>
          <Text style={styles.questionSubtitle}>{l('Pilih satu yang paling sering membuat Anda mundur', 'Choose the one that holds you back most often')}</Text>
        </View>

        <View style={styles.optionsList}>
          {obstacleOptions.map((option, index) => (
            <Animated.View key={option.id} style={getOptionEnterStyle(index)}>
              <TouchableOpacity
                style={[styles.activityCard, mainObstacle === option.id && styles.activityCardActive]}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMainObstacle(option.id);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.activityCardTitle, mainObstacle === option.id && styles.activityCardTitleActive]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            </Animated.View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !mainObstacle && styles.primaryButtonDisabled]}
          onPress={handleNext}
          disabled={!mainObstacle}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCoachStatus = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>{l('Saat ini Anda didampingi coach atau nutritionist?', 'Are you currently guided by a coach or nutritionist?')}</Text>
      </View>

      <View style={styles.optionsList}>
        {[
          { id: 'yes' as const, label: l('✅ Ya, saat ini didampingi', '✅ Yes, currently guided') },
          { id: 'no' as const, label: l('👤 Belum, saya jalan sendiri', '👤 Not yet, I am on my own') },
        ].map((option, index) => (
          <Animated.View key={option.id} style={getOptionEnterStyle(index)}>
            <TouchableOpacity
              style={[styles.activityCard, hasCoach === option.id && styles.activityCardActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setHasCoach(option.id);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.activityCardTitle, hasCoach === option.id && styles.activityCardTitleActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !hasCoach && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!hasCoach}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderTrackingAppExperience = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={styles.questionTitle}>{l('Pernah mencoba aplikasi hitung kalori lain sebelumnya?', 'Have you used other calorie tracking apps before?')}</Text>
      </View>

      <View style={styles.optionsList}>
        {[
          { id: 'yes' as const, label: l('📱 Pernah, sudah coba beberapa', '📱 Yes, I have tried several') },
          { id: 'no' as const, label: l('🌱 Belum pernah, ini yang pertama', '🌱 Never, this is my first') },
        ].map((option, index) => (
          <Animated.View key={option.id} style={getOptionEnterStyle(index)}>
            <TouchableOpacity
              style={[styles.activityCard, usedTrackingApp === option.id && styles.activityCardActive]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setUsedTrackingApp(option.id);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.activityCardTitle, usedTrackingApp === option.id && styles.activityCardTitleActive]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          </Animated.View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.primaryButton, !usedTrackingApp && styles.primaryButtonDisabled]}
        onPress={handleNext}
        disabled={!usedTrackingApp}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderDietType = () => {
    const dietOptions = [
      { id: 'none', label: l('🍽️ Tidak ada diet khusus', '🍽️ No special diet') },
      { id: 'vegetarian', label: '🥗 Vegetarian' },
      { id: 'vegan', label: '🌱 Vegan' },
      { id: 'keto', label: '🥑 Keto' },
      { id: 'paleo', label: '🍖 Paleo' },
      { id: 'halal', label: '☪️ Halal' },
    ];

    return (
      <View style={styles.stepContainer}>
        <View style={styles.questionContainer}>
          <Text style={styles.questionTitle}>{l('Apakah Anda menjalani\ndiet khusus?', 'Do you follow a specific diet?')}</Text>
        </View>

        <View style={styles.optionsList}>
          {dietOptions.map((option, index) => (
            <Animated.View key={option.id} style={getOptionEnterStyle(index)}>
              <TouchableOpacity
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
            </Animated.View>
          ))}
        </View>

        <TouchableOpacity
          style={[styles.primaryButton, !dietType && styles.primaryButtonDisabled]}
          onPress={handleNext}
          disabled={!dietType}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
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
              fill="#22C55E"
            />
          </Svg>
        </View>
        <Text style={styles.reassuranceTitle}>Terima kasih sudah{'\n'}mempercayai kami</Text>
        <Text style={styles.reassuranceSubtitle}>
          Kami di sini untuk mendukung perjalanan Anda menuju kesehatan yang lebih baik.
        </Text>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={handleNext} activeOpacity={0.8}>
        <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
  */

  const renderReferralOptional = () => (
    <View style={styles.stepContainer}>
      <View style={styles.questionContainer}>
        <Text style={[styles.questionTitle, { textAlign: 'center' }]}>
          {l('Kode undangan', 'Referral code')}
        </Text>
        <View style={[styles.reassuranceIconCircle, { alignSelf: 'center', marginTop: 14, marginBottom: 10 }]}>
          <Gift size={36} color="#22C55E" strokeWidth={2.2} />
        </View>
        <Text style={[styles.questionSubtitle, { textAlign: 'center' }]}>
          {l('Opsional. Masukkan kode untuk dapat trial tambahan.', 'Optional. Enter a code to get bonus trial time.')}
        </Text>
      </View>

      <PaywallReferralSection
        ref={referralRef}
        variant="light"
        forModal
        modalIntro=""
        hideRedeemButton
        consumePendingOnMount
        deepLinkRef={refFromOnboardingLink}
        textPrimary="#1A1A2E"
        textSecondary="#6E6E82"
        borderColor="#E5E5EA"
        inputBg="#F5F5F7"
        accentColor="#22C55E"
      />

      <TouchableOpacity
        style={styles.primaryButton}
        onPress={async () => {
          // Best-effort redeem: users should still be able to continue onboarding.
          await referralRef.current?.redeemIfFilled('onboarding_continue');
          handleNext();
        }}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{l('Lanjutkan', 'Continue')}</Text>
        <ArrowRight size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  const renderNotificationPermission = () => (
    <View style={styles.stepContainer}>
      <View style={styles.reassuranceContainer}>
        <View style={styles.reassuranceIconCircle}>
          <Text style={{ fontSize: 64 }}>🔔</Text>
        </View>
        <Text style={styles.reassuranceTitle}>{l('Tetap konsisten\ndengan reminder', 'Stay consistent\nwith reminders')}</Text>
        <Text style={styles.reassuranceSubtitle}>
          {l('Izinkan notifikasi untuk pengingat harian yang membantu Anda tetap on track.', 'Enable notifications for daily reminders that keep you on track.')}
        </Text>
      </View>

      <View style={styles.notificationButtons}>
        <TouchableOpacity style={styles.primaryButton} onPress={handleEnableNotifications} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{l('Aktifkan Notifikasi', 'Enable Notifications')}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.skipButton} onPress={handleSkipNotifications} activeOpacity={0.7}>
          <Text style={styles.skipButtonText}>{l('Lewati untuk sekarang', 'Skip for now')}</Text>
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
                stroke="#22C55E"
                strokeWidth="8"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
            </G>
          </Svg>
          <View style={styles.circularProgressTextContainer}>
            <Sparkles size={32} color="#22C55E" />
          </View>
        </View>
        <Text style={styles.loadingTitle}>{l('Membuat rencana\nkhusus Anda', 'Creating your\npersonalized plan')}</Text>
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

    const tdee = calculateTDEE(weight, height, age, sex, activityLevel);

    const goalCalories =
      calculatedGoal === 'fat_loss' ? tdee - 500 : calculatedGoal === 'muscle_gain' ? tdee + 300 : tdee;

    const proteinCals = weight * 2.2 * 4;
    const fatCals = goalCalories * 0.25;

    const proteinPercent = Math.round((proteinCals / goalCalories) * 100);
    const fatPercent = Math.round((fatCals / goalCalories) * 100);
    const carbsPercent = 100 - proteinPercent - fatPercent;

    return (
      <View style={[styles.finalScrollContent, { paddingBottom: 40 + insets.bottom }]}> 
        <View style={styles.finalPlanContainer}>
          <Text style={styles.finalPlanTitle}>{l('Selamat! Rencana Anda Siap! 🎉', 'Congrats! Your Plan Is Ready! 🎉')}</Text>

          <View style={styles.projectionBanner}>
            <Text style={styles.projectionLabel}>{l('Anda akan mencapai', 'You will reach')}</Text>
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
                  stroke="#22C55E"
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
              <Text style={styles.donutCenterLabel}>{l('kkal/hari', 'kcal/day')}</Text>
            </View>
          </View>

          <View style={styles.macroLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#FF9F43' }]} />
              <Text style={styles.legendText}>Karbo {carbsPercent}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#22C55E' }]} />
              <Text style={styles.legendText}>Protein {proteinPercent}%</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4ECDC4' }]} />
              <Text style={styles.legendText}>Lemak {fatPercent}%</Text>
            </View>
          </View>

          <View style={styles.tipsSection}>
            <Text style={styles.tipsSectionTitle}>{l('Cara mencapai target 🎯', 'How to reach your target 🎯')}</Text>

            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Text style={styles.tipIcon}>📸</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{l('Lacak makanan Anda', 'Track your meals')}</Text>
                <Text style={styles.tipDesc}>{l('Foto setiap makanan untuk hasil terbaik', 'Photo every meal for best results')}</Text>
              </View>
            </View>

            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Text style={styles.tipIcon}>🔥</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{l('Ikuti kalori harian', 'Follow daily calories')}</Text>
                <Text style={styles.tipDesc}>{l('Konsistensi adalah kunci kesuksesan', 'Consistency is the key to success')}</Text>
              </View>
            </View>

            <View style={styles.tipCard}>
              <View style={styles.tipIconCircle}>
                <Text style={styles.tipIcon}>⚖️</Text>
              </View>
              <View style={styles.tipContent}>
                <Text style={styles.tipTitle}>{l('Seimbangkan makro Anda', 'Balance your macros')}</Text>
                <Text style={styles.tipDesc}>{l('Perhatikan protein, karbo, dan lemak', 'Pay attention to protein, carbs, and fat')}</Text>
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={handleComplete} activeOpacity={0.8}>
          <Text style={styles.primaryButtonText}>{l("Lanjutkan", "Continue")}</Text>
          <ArrowRight size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    );
  };

  // HIDDEN: Subscription modal
  /* 
  const renderSubscription = () => {
    const yearlyPrice = 'Rp 129.000 / tahun';
    const yearlyEquiv = 'Rp 10.750 / bulan';
    const monthlyPrice = 'Rp 39.000 / bulan';

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
                <Text style={styles.subscriptionPlanLabel}>{l('Tahunan', 'Yearly')}</Text>
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
                <Text style={styles.subscriptionPlanLabel}>{l('Bulanan', 'Monthly')}</Text>
                <Text style={styles.subscriptionPlanPrice}>{monthlyPrice}</Text>
              </View>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.subscriptionButton}
            onPress={() => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              setShowSubscription(false);
              setStep(20);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.subscriptionButtonText}>{t.subscription.startTransformation}</Text>
            <Text style={styles.subscriptionButtonSubtext}>{t.subscription.trial}</Text>
          </TouchableOpacity>

          <View style={styles.subscriptionFooter}>
            <Text style={styles.subscriptionFooterLink}>{l('Ketentuan Layanan', 'Terms of Service')}</Text>
            <Text style={styles.subscriptionFooterDivider}>|</Text>
            <Text style={styles.subscriptionFooterLink}>{l('Kebijakan Privasi', 'Privacy Policy')}</Text>
            <Text style={styles.subscriptionFooterDivider}>|</Text>
            <Text style={styles.subscriptionFooterLink}>{l('Pulihkan Pembelian', 'Restore Purchases')}</Text>
          </View>
        </Animated.View>
      </View>
    );
  };
  */

  const renderSignIn = () => (
    <View style={[styles.stepContainer, styles.stepContainerSignIn]}>
      <View style={styles.header}>
        <View style={styles.iconCircle}>
          <Svg width="64" height="64" viewBox="0 0 24 24" fill="none">
            <Path
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              fill="#22C55E"
            />
          </Svg>
        </View>
        <Text style={styles.signInTitle}>{l('Simpan Progress Anda', 'Save Your Progress')}</Text>
        <Text style={styles.signInSubtitle}>{l('Masuk untuk menyinkronkan data di semua perangkat', 'Sign in to sync data across all devices')}</Text>
      </View>

      <View style={[styles.signInForm, styles.signInFormNatural]}>
        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{l('Nama Depan', 'First Name')}</Text>
          <TextInput
            style={styles.signInInput}
            value={firstName}
            onChangeText={setFirstName}
            placeholder={l('Nama depan', 'First name')}
            placeholderTextColor="#999999"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{l('Nama Belakang', 'Last Name')}</Text>
          <TextInput
            style={styles.signInInput}
            value={lastName}
            onChangeText={setLastName}
            placeholder={l('Nama belakang', 'Last name')}
            placeholderTextColor="#999999"
            autoCapitalize="words"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{l('Email', 'Email')}</Text>
          <TextInput
            style={styles.signInInput}
            value={signInEmail}
            onChangeText={setSignInEmail}
            placeholder={l('nama@email.com', 'name@email.com')}
            placeholderTextColor="#999999"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="next"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{l('Password', 'Password')}</Text>
          <View style={styles.signInPasswordRow}>
            <TextInput
              style={styles.signInPasswordInput}
              value={signInPassword}
              onChangeText={setSignInPassword}
              placeholder={l('••••••••', '••••••••')}
              placeholderTextColor="#999999"
              secureTextEntry={!showSignInPassword}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              editable={!isCreatingAccount}
            />
            <TouchableOpacity
              style={styles.signInPasswordToggle}
              onPress={() => setShowSignInPassword((v) => !v)}
              disabled={isCreatingAccount}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                showSignInPassword ? t.signIn.hidePassword : t.signIn.showPassword
              }
            >
              {showSignInPassword ? (
                <EyeOff size={22} color="#666666" />
              ) : (
                <Eye size={22} color="#666666" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>{l('Ketik Ulang Password', 'Re-enter Password')}</Text>
          <View style={styles.signInPasswordRow}>
            <TextInput
              style={styles.signInPasswordInput}
              value={signInPasswordConfirm}
              onChangeText={setSignInPasswordConfirm}
              placeholder={l('••••••••', '••••••••')}
              placeholderTextColor="#999999"
              secureTextEntry={!showSignInPasswordConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              editable={!isCreatingAccount}
            />
            <TouchableOpacity
              style={styles.signInPasswordToggle}
              onPress={() => setShowSignInPasswordConfirm((v) => !v)}
              disabled={isCreatingAccount}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={
                showSignInPasswordConfirm ? t.signIn.hidePassword : t.signIn.showPassword
              }
            >
              {showSignInPasswordConfirm ? (
                <EyeOff size={22} color="#666666" />
              ) : (
                <Eye size={22} color="#666666" />
              )}
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity 
          style={[styles.primaryButton, isCreatingAccount && styles.primaryButtonDisabled]} 
          onPress={handleSignIn} 
          activeOpacity={0.8}
          disabled={isCreatingAccount}
        >
          <Text style={styles.primaryButtonText}>{isCreatingAccount ? l('Membuat akun...', 'Creating account...') : l('Daftar', 'Sign Up')}</Text>
          {!isCreatingAccount && <ArrowRight size={20} color="#FFFFFF" />}
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{l('atau', 'or')}</Text>
          <View style={styles.dividerLine} />
        </View>

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
        return renderMainObstacle();
      case 13:
        return renderCoachStatus();
      case 14:
        return renderTrackingAppExperience();
      case 15:
        return renderDietType();
      case 16:
        return renderConsistencyEdge();
      case 17:
        return renderFinal();
      case 18:
        return renderSignIn();
      case 19:
        return renderReferralOptional();
      case 20:
        return renderNotificationPermission();
      default:
        return renderIntro();
    }
  };

  const isSignUpStep = step === 18;
  const isIntroStep = step === 0;
  const contentPaddingBottom = isSignUpStep
    ? Math.max(28, insets.bottom) + 36
    : isIntroStep
      ? Platform.OS === 'android'
        ? Math.max(12, insets.bottom) + 10
        : Math.max(14, insets.bottom) + 6
      : Platform.OS === 'android'
        ? Math.max(24, insets.bottom) + 24
        : Math.max(20, insets.bottom) + 8;
  const contentPaddingTop = Platform.OS === 'android' ? 52 : insets.top + 34;
  const ScreenWrapper =
    Platform.OS === 'ios' && !isSignUpStep ? KeyboardAvoidingView : View;

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

      <Animated.View
        style={[
          styles.contentWrapper,
          isSignUpStep && styles.contentWrapperSignUp,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
        {renderStep()}
      </Animated.View>
    </>
  );

  return (
    <ScreenWrapper
      style={[styles.container, step === 0 && { backgroundColor: '#EEEDEB' }]}
      {...(Platform.OS === 'ios' && !isSignUpStep
        ? { behavior: 'height' as const, keyboardVerticalOffset: insets.top + 12 }
        : {})}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: contentPaddingBottom, paddingTop: contentPaddingTop },
          step === 0 && { backgroundColor: '#EEEDEB' },
        ]}
        showsVerticalScrollIndicator={false}
        scrollEnabled={!showLoading}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        automaticallyAdjustKeyboardInsets={isSignUpStep && Platform.OS === 'ios'}
      >
        {renderContent()}
      </ScrollView>

      {/* HIDDEN: Subscription modal */}
      {/* {showSubscription && renderSubscription()} */}
    </ScreenWrapper>
  );
}

const premiumStyles = StyleSheet.create({
  insightPageMain: {
    flex: 1,
    justifyContent: 'center',
  },
  insightCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#EEF0F3',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  insightCardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  insightCardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#111827',
  },
  insightCardHint: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  insightAxisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 8,
  },
  insightAxisLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600' as const,
  },
  insightFootnote: {
    fontSize: 13,
    lineHeight: 18,
    color: '#374151',
    textAlign: 'center',
  },
  insightSubheadline: {
    fontSize: 16,
    lineHeight: 24,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 14,
    paddingHorizontal: 6,
  },
  insightHighlightValue: {
    color: '#22C55E',
    fontWeight: '800' as const,
  },
  insightMiniCompareCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EEF0F3',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  insightMiniCompareTitle: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#111827',
    textAlign: 'center',
    marginBottom: 12,
  },
  insightBarsRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    gap: 20,
  },
  dotCompareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  dotCompareCol: {
    flex: 1,
    alignItems: 'center',
  },
  dotGrid: {
    width: 98,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 10,
  },
  dotCell: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dotCellOff: {
    backgroundColor: '#E5E7EB',
  },
  dotCellMutedOn: {
    backgroundColor: '#9CA3AF',
  },
  dotCellStrongOn: {
    backgroundColor: '#111827',
  },
  insightBarColumn: {
    flex: 1,
    alignItems: 'center',
  },
  insightBarTopLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  insightBarTrack: {
    width: 72,
    height: 110,
    borderRadius: 18,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: '#F3F4F6',
    marginBottom: 8,
  },
  insightBarFillSoft: {
    width: '100%',
    height: 44,
    borderRadius: 18,
    backgroundColor: '#D1D5DB',
  },
  insightBarFillStrong: {
    width: '100%',
    height: 96,
    borderRadius: 18,
    backgroundColor: '#111827',
  },
  insightBarBottomLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#111827',
  },
});

