import { Redirect } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

export default function Index() {
  const { profile, isLoading, authState } = useNutrition();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  console.log('Index routing check:', { profile: !!profile, isSignedIn: authState.isSignedIn, email: authState.email });

  if (profile || authState.isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/onboarding" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
