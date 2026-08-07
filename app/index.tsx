import { Redirect } from 'expo-router';
import { useNutrition } from '@/contexts/NutritionContext';

export default function AppEntryScreen() {
  const { authState, authInitialized } = useNutrition();

  if (!authInitialized) {
    return null;
  }

  if (authState.isSignedIn) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/onboarding" />;
}
