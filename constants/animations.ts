import { Animated, Easing } from 'react-native';

export const ANIMATION_DURATION = {
  instant: 100,
  quick: 150,
  standard: 200,
  medium: 250,
  slow: 300,
  slower: 400,
} as const;

export const SPRING_CONFIG = {
  default: {
    tension: 65,
    friction: 11,
  },
  gentle: {
    tension: 50,
    friction: 10,
  },
  bouncy: {
    tension: 80,
    friction: 8,
  },
  stiff: {
    tension: 100,
    friction: 12,
  },
} as const;

export const createFadeIn = (
  animValue: Animated.Value,
  duration: number = ANIMATION_DURATION.standard
) => {
  return Animated.timing(animValue, {
    toValue: 1,
    duration,
    useNativeDriver: true,
  });
};

export const createFadeOut = (
  animValue: Animated.Value,
  duration: number = ANIMATION_DURATION.standard
) => {
  return Animated.timing(animValue, {
    toValue: 0,
    duration,
    useNativeDriver: true,
  });
};

export const createSpringAnimation = (
  animValue: Animated.Value,
  toValue: number,
  config: keyof typeof SPRING_CONFIG = 'default'
) => {
  return Animated.spring(animValue, {
    toValue,
    useNativeDriver: true,
    ...SPRING_CONFIG[config],
  });
};

export const createSlideUp = (
  animValue: Animated.Value,
  config: keyof typeof SPRING_CONFIG = 'default'
) => {
  return Animated.spring(animValue, {
    toValue: 1,
    useNativeDriver: true,
    ...SPRING_CONFIG[config],
  });
};

export const createSlideDown = (
  animValue: Animated.Value,
  duration: number = ANIMATION_DURATION.standard
) => {
  return Animated.timing(animValue, {
    toValue: 0,
    duration,
    useNativeDriver: true,
  });
};

export const createButtonPress = (animValue: Animated.Value) => {
  return Animated.sequence([
    Animated.timing(animValue, {
      toValue: 0.92,
      duration: ANIMATION_DURATION.instant,
      useNativeDriver: true,
    }),
    Animated.timing(animValue, {
      toValue: 1,
      duration: ANIMATION_DURATION.quick,
      useNativeDriver: true,
    }),
  ]);
};

export const createPulseLoop = (
  animValue: Animated.Value,
  minValue: number = 1,
  maxValue: number = 1.08,
  duration: number = 1200
) => {
  return Animated.loop(
    Animated.sequence([
      Animated.timing(animValue, {
        toValue: maxValue,
        duration,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
      Animated.timing(animValue, {
        toValue: minValue,
        duration,
        useNativeDriver: true,
        easing: Easing.inOut(Easing.ease),
      }),
    ])
  );
};

export const createValueAnimation = (
  animValue: Animated.Value,
  toValue: number,
  duration: number = ANIMATION_DURATION.medium
) => {
  return Animated.timing(animValue, {
    toValue,
    duration,
    useNativeDriver: false,
  });
};
