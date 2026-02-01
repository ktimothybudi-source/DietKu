import { useEffect } from 'react';
import { router } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { profile, isLoading } = useNutrition();

  useEffect(() => {
    if (isLoading) return;

    if (profile) {
      router.replace('/(tabs)');
    } else {
      router.replace('/onboarding');
    }
  }, [profile, isLoading]);

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
