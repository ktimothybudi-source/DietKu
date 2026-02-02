import { useEffect, useState } from 'react';
import { router, useNavigationContainerRef } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { profile, isLoading, authState } = useNutrition();
  const navigationRef = useNavigationContainerRef();
  const [isNavigationReady, setIsNavigationReady] = useState(false);
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    if (navigationRef?.isReady()) {
      setIsNavigationReady(true);
    }
  }, [navigationRef]);

  useEffect(() => {
    if (isLoading || hasNavigated || !isNavigationReady) return;

    console.log('Index routing check:', { profile: !!profile, isSignedIn: authState.isSignedIn, email: authState.email });

    setHasNavigated(true);
    
    // Small delay to ensure layout is fully mounted
    const timer = setTimeout(() => {
      if (profile || authState.isSignedIn) {
        router.replace('/(tabs)');
      } else {
        router.replace('/onboarding');
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [profile, isLoading, authState.isSignedIn, authState.email, isNavigationReady, hasNavigated]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#10B981" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
