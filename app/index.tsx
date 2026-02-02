import { useEffect, useState } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { profile, isLoading, authState } = useNutrition();
  const rootNavigationState = useRootNavigationState();
  const [hasNavigated, setHasNavigated] = useState(false);

  const isNavigationReady = rootNavigationState?.key != null;

  useEffect(() => {
    if (isLoading || hasNavigated || !isNavigationReady) return;

    console.log('Index routing check:', { profile: !!profile, isSignedIn: authState.isSignedIn, email: authState.email, isNavigationReady });

    setHasNavigated(true);
    
    if (profile || authState.isSignedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
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
