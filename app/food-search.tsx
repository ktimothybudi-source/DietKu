import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Keyboard,
  Alert,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { Search, X, ChevronLeft, Flame, Drumstick, Droplets, Wheat } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useNutrition } from '@/contexts/NutritionContext';
import { searchFoods } from '@/lib/foodsApi';
import { FoodSearchResult, formatNutrientRange, getAverageFromRange } from '@/types/food';

const DEBOUNCE_DELAY = 300;

export default function FoodSearchScreen() {
  const { theme } = useTheme();
  const { addFoodEntry } = useNutrition();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    setError(null);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        console.log('[FoodSearch] Searching for:', query);
        const searchResults = await searchFoods(query, 50);
        setResults(searchResults);
        setHasSearched(true);
        console.log('[FoodSearch] Got', searchResults.length, 'results');
      } catch (err) {
        console.error('[FoodSearch] Search error:', err);
        setError('Gagal mencari makanan. Coba lagi.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, DEBOUNCE_DELAY);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery('');
    setResults([]);
    setError(null);
    setHasSearched(false);
    inputRef.current?.focus();
  }, []);

  const handleSelectFood = useCallback((food: FoodSearchResult) => {
    const avgCalories = getAverageFromRange(food.caloriesMin, food.caloriesMax);
    const avgProtein = getAverageFromRange(food.proteinMin, food.proteinMax);
    const avgCarbs = getAverageFromRange(food.carbsMin, food.carbsMax);
    const avgFat = getAverageFromRange(food.fatMin, food.fatMax);
    
    console.log('[FoodSearch] Selected food:', food.name, 'calories:', food.caloriesMin, '-', food.caloriesMax);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    const hasRange = food.caloriesMin !== food.caloriesMax || 
                     food.proteinMin !== food.proteinMax ||
                     food.carbsMin !== food.carbsMax ||
                     food.fatMin !== food.fatMax;
    
    const calRange = formatNutrientRange(food.caloriesMin, food.caloriesMax);
    const proteinRange = formatNutrientRange(food.proteinMin, food.proteinMax);
    const carbsRange = formatNutrientRange(food.carbsMin, food.carbsMax);
    const fatRange = formatNutrientRange(food.fatMin, food.fatMax);
    
    const message = hasRange
      ? `${food.name}\n\n📊 Rentang Nutrisi:\n• Kalori: ${calRange} kcal\n• Protein: ${proteinRange}g\n• Karbo: ${carbsRange}g\n• Lemak: ${fatRange}g\n\n✅ Nilai rata-rata akan ditambahkan:\n• ${avgCalories} kcal • ${avgProtein}g protein\n• ${avgCarbs}g karbo • ${avgFat}g lemak`
      : `${food.name}\n\n• ${avgCalories} kcal\n• ${avgProtein}g protein\n• ${avgCarbs}g karbo\n• ${avgFat}g lemak`;

    Alert.alert(
      'Tambah Makanan',
      message,
      [
        {
          text: 'Batal',
          style: 'cancel',
        },
        {
          text: 'Tambah',
          onPress: () => {
            addFoodEntry({
              name: food.name,
              calories: avgCalories,
              protein: avgProtein,
              carbs: avgCarbs,
              fat: avgFat,
              photoUri: food.image || undefined,
            });

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            router.back();
          },
        },
      ]
    );
  }, [addFoodEntry]);

  const handleGoBack = useCallback(() => {
    Keyboard.dismiss();
    router.back();
  }, []);

  const renderNutrientValue = (min: number, max: number, unit: string = '') => {
    if (min === max) {
      return `${min}${unit}`;
    }
    return `${min}-${max}${unit}`;
  };

  const renderFoodItem = useCallback(({ item }: { item: FoodSearchResult }) => (
    <TouchableOpacity
      style={[styles.foodItem, { backgroundColor: theme.card, borderColor: theme.border }]}
      onPress={() => handleSelectFood(item)}
      activeOpacity={0.7}
      testID={`food-item-${item.id}`}
    >
      {item.image ? (
        <Image
          source={{ uri: item.image }}
          style={styles.foodImage}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.foodImagePlaceholder, { backgroundColor: theme.background }]}>
          <Flame size={20} color={theme.textTertiary} />
        </View>
      )}
      
      <View style={styles.foodInfo}>
        <Text style={[styles.foodName, { color: theme.text }]} numberOfLines={2}>
          {item.name}
        </Text>
        
        <View style={styles.macroRow}>
          <View style={styles.macroItem}>
            <Flame size={12} color="#EF4444" />
            <Text style={[styles.macroText, { color: theme.textSecondary }]}>
              {renderNutrientValue(item.caloriesMin, item.caloriesMax, ' kcal')}
            </Text>
          </View>
          
          <View style={styles.macroItem}>
            <Drumstick size={12} color="#10B981" />
            <Text style={[styles.macroText, { color: theme.textSecondary }]}>
              {renderNutrientValue(item.proteinMin, item.proteinMax, 'g')}
            </Text>
          </View>
          
          <View style={styles.macroItem}>
            <Wheat size={12} color="#3B82F6" />
            <Text style={[styles.macroText, { color: theme.textSecondary }]}>
              {renderNutrientValue(item.carbsMin, item.carbsMax, 'g')}
            </Text>
          </View>
          
          <View style={styles.macroItem}>
            <Droplets size={12} color="#F59E0B" />
            <Text style={[styles.macroText, { color: theme.textSecondary }]}>
              {renderNutrientValue(item.fatMin, item.fatMax, 'g')}
            </Text>
          </View>
        </View>
      </View>
      
      <ChevronLeft 
        size={20} 
        color={theme.textTertiary} 
        style={{ transform: [{ rotate: '180deg' }] }} 
      />
    </TouchableOpacity>
  ), [theme, handleSelectFood]);

  const renderEmptyState = useMemo(() => {
    if (isLoading) return null;

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyTitle, { color: '#EF4444' }]}>Terjadi Kesalahan</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>{error}</Text>
        </View>
      );
    }

    if (hasSearched && results.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.card }]}>
            <Search size={32} color={theme.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Tidak Ditemukan</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Tidak ada makanan yang cocok dengan &ldquo;{searchQuery}&rdquo;
          </Text>
        </View>
      );
    }

    if (!hasSearched) {
      return (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.card }]}>
            <Search size={32} color={theme.textTertiary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>Cari Makanan</Text>
          <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
            Ketik nama makanan untuk mencari
          </Text>
        </View>
      );
    }

    return null;
  }, [isLoading, error, hasSearched, results.length, searchQuery, theme]);

  const keyExtractor = useCallback((item: FoodSearchResult) => item.id.toString(), []);

  return (
    <>
      <Stack.Screen
        options={{
          headerShown: false,
          presentation: 'card',
          animation: 'slide_from_right',
        }}
      />

      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8, backgroundColor: theme.background }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.card }]}
            onPress={handleGoBack}
            activeOpacity={0.7}
            testID="back-button"
          >
            <ChevronLeft size={24} color={theme.text} />
          </TouchableOpacity>

          <View style={[styles.searchContainer, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Search size={20} color={theme.textSecondary} />
            <TextInput
              ref={inputRef}
              style={[styles.searchInput, { color: theme.text }]}
              placeholder="Cari makanan..."
              placeholderTextColor={theme.textTertiary}
              value={searchQuery}
              onChangeText={handleSearch}
              autoFocus
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              testID="search-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={handleClearSearch}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                testID="clear-search-button"
              >
                <X size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {isLoading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
              Mencari makanan...
            </Text>
          </View>
        )}

        {!isLoading && (results.length > 0 ? (
          <FlatList
            data={results}
            renderItem={renderFoodItem}
            keyExtractor={keyExtractor}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 16 }
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            testID="food-list"
          />
        ) : (
          renderEmptyState
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    height: '100%',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  foodImage: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  foodImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodInfo: {
    flex: 1,
    gap: 6,
  },
  foodName: {
    fontSize: 15,
    fontWeight: '600' as const,
    lineHeight: 20,
  },
  macroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  macroText: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});
