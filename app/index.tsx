import { useEffect } from 'react';
import { router } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { profile, isLoading, authState } = useNutrition();

  useEffect(() => {
    if (isLoading) return;

    console.log('Index routing check:', { profile: !!profile, isSignedIn: authState.isSignedIn, email: authState.email });

    // If user has a profile OR is signed in, go to main app
    // User is signed in means they completed onboarding at some point
    if (profile || authState.isSignedIn) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }, [profile, isLoading, authState.isSignedIn]);

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
