import { useEffect, useState } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { profile, isLoading, authState } = useNutrition();
  const rootNavigationState = useRootNavigationState();
  const [hasNavigated, setHasNavigated] = useState(false);

  useEffect(() => {
    if (isLoading || hasNavigated) return;
    
    // Wait for navigation to be ready
    if (!rootNavigationState?.key) return;

    console.log('Index routing check:', { profile: !!profile, isSignedIn: authState.isSignedIn, email: authState.email });

    setHasNavigated(true);
    
    // If user has a profile OR is signed in, go to main app
    if (profile || authState.isSignedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }, [profile, isLoading, authState.isSignedIn, rootNavigationState?.key, hasNavigated]);

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
