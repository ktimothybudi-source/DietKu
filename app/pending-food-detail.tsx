import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Bookmark,
  Camera,
  Check,
  Edit3,
  PlusCircle,
  RefreshCw,
  Share2,
  Star,
  Trash2,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

import { useNutrition } from '@/contexts/NutritionContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/lib/supabase';
import { indexStyles as styles } from '@/styles/indexStyles';
import {
  foodEntryToViewPending,
  mapAnalysisToEditedItems,
  type EditedFoodItem,
} from '@/utils/pendingFoodDetailHelpers';

function firstParam(v: string | string[] | undefined): string | undefined {
  if (v == null) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

function num(v: unknown): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export default function PendingFoodDetailScreen() {
  const params = useLocalSearchParams();
  const pendingId = firstParam(params.pendingId as string | string[] | undefined);
  const entryId = firstParam(params.entryId as string | string[] | undefined);
  const autoShown = firstParam(params.autoShown as string | string[] | undefined) === '1';

  const {
    dailyTargets,
    todayEntries,
    addFoodEntry,
    deleteFoodEntry,
    pendingEntries,
    removePendingEntry,
    retryPendingEntry,
    favorites,
    addToFavorites,
    removeFromFavorites,
    isFavorite,
  } = useNutrition();
  const { theme } = useTheme();
  const { l } = useLanguage();

  const entryForView = useMemo(
    () => (entryId ? todayEntries.find(e => e.id === entryId) : undefined),
    [entryId, todayEntries],
  );

  const resolvedPending = useMemo(() => {
    if (entryForView) {
      return foodEntryToViewPending(entryForView);
    }
    if (pendingId) {
      return pendingEntries.find(p => p.id === pendingId) ?? null;
    }
    return null;
  }, [entryForView, pendingId, pendingEntries]);

  const displayPhotoUri = resolvedPending?.permanentPhotoUri ?? resolvedPending?.photoUri;

  const [editedItems, setEditedItems] = useState<EditedFoodItem[]>([]);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [editItemName, setEditItemName] = useState('');
  const [editItemPortion, setEditItemPortion] = useState('');
  const [editItemCalories, setEditItemCalories] = useState('');
  const [editItemProtein, setEditItemProtein] = useState('');
  const [editItemCarbs, setEditItemCarbs] = useState('');
  const [editItemFat, setEditItemFat] = useState('');
  const [showAddItem, setShowAddItem] = useState(false);
  const [hasEdited, setHasEdited] = useState(false);
  const [showFavoriteToast, setShowFavoriteToast] = useState(false);
  const [favoriteToastMessage, setFavoriteToastMessage] = useState('');
  const [composedDetailItems, setComposedDetailItems] = useState<EditedFoodItem[] | null>(null);
  const [isSavingConfirm, setIsSavingConfirm] = useState(false);
  const saveInFlightRef = useRef(false);

  const goBackSafely = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, []);

  useEffect(() => {
    if (!pendingId && !entryId) {
      goBackSafely();
    }
  }, [pendingId, entryId, goBackSafely]);

  useEffect(() => {
    if ((pendingId || entryId) && !resolvedPending) {
      goBackSafely();
    }
  }, [pendingId, entryId, resolvedPending, goBackSafely]);

  useEffect(() => {
    if (!entryForView?.loggedMealId) {
      setComposedDetailItems(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('logged_meal_items')
        .select('food_name,grams,calories,protein,carbs,fat')
        .eq('logged_meal_id', entryForView.loggedMealId)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error || !data?.length) {
        setComposedDetailItems(null);
        return;
      }
      setComposedDetailItems(
        data.map((r: Record<string, unknown>) => ({
          name: String(r.food_name ?? ''),
          portion: `${num(r.grams)} g`,
          calories: Math.round(num(r.calories)),
          protein: Math.round(num(r.protein)),
          carbs: Math.round(num(r.carbs)),
          fat: Math.round(num(r.fat)),
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [entryForView?.loggedMealId]);

  useEffect(() => {
    if (!resolvedPending) return;
    if (entryId && entryForView?.loggedMealId) return;
    if (resolvedPending.status !== 'done' || !resolvedPending.analysis) return;
    setEditedItems(mapAnalysisToEditedItems(resolvedPending.analysis));
    setHasEdited(false);
    setEditingItemIndex(null);
    setShowAddItem(false);
  }, [resolvedPending?.id, resolvedPending?.status, entryId, entryForView?.loggedMealId]);

  useEffect(() => {
    if (!entryId || !entryForView?.loggedMealId) return;
    if (!composedDetailItems || composedDetailItems.length === 0) return;
    setEditedItems(composedDetailItems);
    setHasEdited(false);
    setEditingItemIndex(null);
    setShowAddItem(false);
  }, [composedDetailItems, entryId, entryForView?.loggedMealId]);

  const performCloseCleanup = useCallback(() => {
    if (autoShown && pendingId && !entryId) {
      removePendingEntry(pendingId);
    }
  }, [autoShown, pendingId, entryId, removePendingEntry]);

  const handleClose = useCallback(() => {
    if (hasEdited) {
      Alert.alert(l('Perubahan Belum Disimpan', 'Unsaved Changes'), l('Anda memiliki perubahan yang belum disimpan. Yakin ingin keluar?', 'You have unsaved changes. Are you sure you want to leave?'), [
        { text: l('Batal', 'Cancel'), style: 'cancel' },
        {
          text: l('Keluar', 'Leave'),
          style: 'destructive',
          onPress: () => {
            performCloseCleanup();
            goBackSafely();
          },
        },
      ]);
    } else {
      performCloseCleanup();
      goBackSafely();
    }
  }, [hasEdited, performCloseCleanup, goBackSafely]);

  const handleStartEditItem = (index: number) => {
    const item = editedItems[index];
    setShowAddItem(false);
    setEditingItemIndex(index);
    setEditItemName(item.name);
    setEditItemPortion(item.portion);
    setEditItemCalories(item.calories.toString());
    setEditItemProtein(item.protein.toString());
    setEditItemCarbs(item.carbs.toString());
    setEditItemFat(item.fat.toString());
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleSaveEditItem = () => {
    if (editingItemIndex === null) return;
    const updated = [...editedItems];
    updated[editingItemIndex] = {
      name: editItemName || 'Makanan',
      portion: editItemPortion || '1 porsi',
      calories: parseInt(editItemCalories) || 0,
      protein: parseInt(editItemProtein) || 0,
      carbs: parseInt(editItemCarbs) || 0,
      fat: parseInt(editItemFat) || 0,
    };
    setEditedItems(updated);
    setEditingItemIndex(null);
    setHasEdited(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const handleDeleteItem = (index: number) => {
    const updated = editedItems.filter((_, i) => i !== index);
    setEditedItems(updated);
    setEditingItemIndex(null);
    setHasEdited(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleAddNewItem = useCallback(() => {
    setEditingItemIndex(null);
    setShowAddItem(true);
    setEditItemName('');
    setEditItemPortion('');
    setEditItemCalories('');
    setEditItemProtein('');
    setEditItemCarbs('');
    setEditItemFat('');
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const handleSaveNewItem = () => {
    const newItem = {
      name: editItemName || 'Makanan Baru',
      portion: editItemPortion || '1 porsi',
      calories: parseInt(editItemCalories) || 0,
      protein: parseInt(editItemProtein) || 0,
      carbs: parseInt(editItemCarbs) || 0,
      fat: parseInt(editItemFat) || 0,
    };
    setEditedItems(prev => [...prev, newItem]);
    setShowAddItem(false);
    setHasEdited(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const getEditedTotals = () =>
    editedItems.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        protein: acc.protein + item.protein,
        carbs: acc.carbs + item.carbs,
        fat: acc.fat + item.fat,
        sugar: acc.sugar + (item.sugar ?? 0),
        fiber: acc.fiber + (item.fiber ?? 0),
        sodium: acc.sodium + (item.sodium ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 },
    );

  const handleConfirmEdited = async () => {
    if (saveInFlightRef.current || isSavingConfirm) return;
    if (!resolvedPending || editedItems.length === 0) return;
    saveInFlightRef.current = true;
    setIsSavingConfirm(true);
    const totals = getEditedTotals();
    const foodNames = editedItems.map(item => item.name).join(', ');

    try {
      if (entryId) {
        const saved = await addFoodEntry({
          name: foodNames,
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          sugar: Math.round(totals.sugar * 10) / 10,
          fiber: Math.round(totals.fiber * 10) / 10,
          sodium: Math.round(totals.sodium),
          photoUri: resolvedPending.photoUri || undefined,
        });
        if (!saved) {
          Alert.alert(l('Gagal simpan', 'Save failed'), l('Makanan belum tersimpan. Coba lagi.', 'Meal was not saved. Please try again.'));
          return;
        }
        deleteFoodEntry(entryId);
      } else if (pendingId) {
        const saved = await addFoodEntry({
          name: foodNames,
          calories: totals.calories,
          protein: totals.protein,
          carbs: totals.carbs,
          fat: totals.fat,
          sugar: Math.round(totals.sugar * 10) / 10,
          fiber: Math.round(totals.fiber * 10) / 10,
          sodium: Math.round(totals.sodium),
          photoUri: resolvedPending.photoUri || resolvedPending.permanentPhotoUri,
        });
        if (!saved) {
          Alert.alert(l('Gagal simpan', 'Save failed'), l('Makanan belum tersimpan. Coba lagi.', 'Meal was not saved. Please try again.'));
          return;
        }
        removePendingEntry(pendingId);
      }

      setHasEdited(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      goBackSafely();
    } finally {
      saveInFlightRef.current = false;
      setIsSavingConfirm(false);
    }
  };

  const handleSaveToFavorite = () => {
    if (!resolvedPending?.analysis) return;
    const analysis = resolvedPending.analysis;
    const mealName = analysis.items.map(i => i.name).join(', ');

    if (isFavorite(mealName)) {
      const favorite = favorites.find(f => f.name.toLowerCase().trim() === mealName.toLowerCase().trim());
      if (favorite) {
        removeFromFavorites(favorite.id);
        setFavoriteToastMessage('Dihapus dari Favorit');
        setShowFavoriteToast(true);
        setTimeout(() => setShowFavoriteToast(false), 2000);
      }
    } else {
      const avgCalories = Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2);
      const avgProtein = Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2);
      const avgCarbs = Math.round(analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0));
      const avgFat = Math.round(analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0));

      const added = addToFavorites({
        name: mealName,
        calories: avgCalories,
        protein: avgProtein,
        carbs: avgCarbs,
        fat: avgFat,
      });

      if (added) {
        setFavoriteToastMessage('Disimpan ke Favorit ⭐');
        setShowFavoriteToast(true);
        setTimeout(() => setShowFavoriteToast(false), 2000);
      }
    }
  };

  const handleRemovePending = () => {
    if (!resolvedPending || !pendingId) return;
    removePendingEntry(pendingId);
    goBackSafely();
  };

  const handleRetryPending = () => {
    if (!resolvedPending || !pendingId) return;
    retryPendingEntry(pendingId);
  };

  const handleSharePress = () => {
    if (!resolvedPending?.analysis) return;
    const analysis = resolvedPending.analysis;
    const mealName =
      analysis.items[0]?.name
        .replace(/\s*\/\s*/g, ' ')
        .replace(/\s+or\s+/gi, ' ')
        .replace(/about\s+/gi, '')
        .trim() || 'Makanan';
    const mealSubtitle = analysis.items
      .map(item => {
        const cleanName =
          item.name
            .replace(/\s*\/\s*/g, ', ')
            .replace(/\s+or\s+/gi, ', ')
            .replace(/about\s+/gi, '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)[0] || item.name;
        return cleanName;
      })
      .join(' • ');
    const avgCalories = Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2);
    const avgProtein = Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2);
    const avgCarbs = Math.round(analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0));
    const avgFat = Math.round(analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0));
    const photoUri = resolvedPending.photoUri;
    const timestamp = resolvedPending.timestamp.toString();

    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    goBackSafely();
    setTimeout(() => {
      router.push({
        pathname: '/story-share',
        params: {
          mealName,
          mealSubtitle,
          calories: avgCalories.toString(),
          protein: avgProtein.toString(),
          carbs: avgCarbs.toString(),
          fat: avgFat.toString(),
          photoUri,
          timestamp,
        },
      });
    }, 100);
  };

  const foodTitlesForDisplay = useMemo(() => {
    const analysis = resolvedPending?.analysis;
    if (!analysis?.items?.length) return null;
    const rowItems = editedItems.length > 0 ? editedItems : analysis.items;
    const isComposedSaved = !!entryForView?.loggedMealId;
    const mealLabel = entryForView?.name?.trim();
    const cleanTitle = (raw: string) =>
      raw
        .replace(/\s*\/\s*/g, ' ')
        .replace(/\s+or\s+/gi, ' ')
        .replace(/about\s+/gi, '')
        .trim();
    const title =
      isComposedSaved && mealLabel
        ? cleanTitle(mealLabel)
        : cleanTitle(rowItems[0]?.name || 'Makanan');
    const subtitle = rowItems
      .map(item => {
        const cleanName =
          item.name
            .replace(/\s*\/\s*/g, ', ')
            .replace(/\s+or\s+/gi, ', ')
            .replace(/about\s+/gi, '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)[0] || item.name;
        return cleanName;
      })
      .join(' • ');
    return { title, subtitle };
  }, [resolvedPending?.analysis, editedItems, entryForView?.loggedMealId, entryForView?.name]);

  if (!resolvedPending) {
    return null;
  }

  const showSaveFooter = resolvedPending.status === 'done' && !!resolvedPending.analysis;

  return (
    <SafeAreaView style={[styles.pendingModalScreen, { flex: 1, backgroundColor: theme.card }]} edges={['top', 'bottom', 'left', 'right']}>
      <View style={[styles.pendingModalContent, { flex: 1, backgroundColor: theme.card }]}>
        <View
          style={[
            styles.pendingModalHeader,
            {
              borderBottomColor: theme.border,
              paddingTop: 14,
            },
          ]}
        >
          <View style={styles.pendingModalTitleContainer}>
            <Text style={[styles.pendingModalTitle, { color: theme.text }]}>DietKu</Text>
            {resolvedPending.status !== 'done' || !resolvedPending.analysis ? (
              <Text style={[styles.pendingModalSubtitle, { color: theme.textSecondary }]} numberOfLines={2}>
                {resolvedPending.status === 'analyzing'
                  ? 'Menganalisis...'
                  : resolvedPending.status === 'error'
                    ? 'Gagal Analisis'
                    : 'Detail Makanan'}
              </Text>
            ) : null}
          </View>
          <View style={styles.pendingHeaderActions}>
            {resolvedPending.status === 'done' && resolvedPending.analysis && (
              <>
                <TouchableOpacity style={styles.shareHeaderButton} onPress={handleSharePress} activeOpacity={0.7}>
                  <Share2 size={18} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.favoriteButton} onPress={handleSaveToFavorite} activeOpacity={0.7}>
                  <Bookmark
                    size={22}
                    color={
                      isFavorite(resolvedPending.analysis.items.map(i => i.name).join(', '))
                        ? theme.primary
                        : theme.textSecondary
                    }
                    fill={
                      isFavorite(resolvedPending.analysis.items.map(i => i.name).join(', ')) ? theme.primary : 'transparent'
                    }
                  />
                </TouchableOpacity>
              </>
            )}
            <TouchableOpacity onPress={handleClose}>
              <X size={24} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1, minHeight: 0 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          enabled={Platform.OS === 'ios'}
        >
          <View style={styles.pendingModalScrollWrap} {...(Platform.OS === 'android' ? { collapsable: false } : {})}>
            <ScrollView
              style={[styles.pendingModalBody, { backgroundColor: theme.card, flex: 1, minHeight: 0 }]}
              contentContainerStyle={[
                styles.pendingModalBodyContent,
                (showAddItem || editingItemIndex !== null) && { paddingBottom: 56 },
              ]}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              nestedScrollEnabled={Platform.OS === 'android'}
              bounces={Platform.OS === 'ios'}
              {...(Platform.OS === 'android'
                ? {
                    overScrollMode: 'never' as const,
                    removeClippedSubviews: false,
                  }
                : {})}
            >
              {displayPhotoUri && resolvedPending.status !== 'done' ? (
                <ExpoImage
                  source={{ uri: displayPhotoUri }}
                  style={styles.pendingModalImage}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={0}
                />
              ) : resolvedPending.status !== 'done' ? (
                <View style={[styles.viewEntryImageContainer, { backgroundColor: theme.background }]}>
                  <Camera size={48} color={theme.textTertiary} />
                </View>
              ) : null}

              {resolvedPending.status === 'analyzing' && (
                <View style={styles.pendingAnalyzingState}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.pendingAnalyzingText, { color: theme.text }]}>{l('Menganalisis makanan Anda...', 'Analyzing your meal...')}</Text>
                  <Text style={[styles.pendingAnalyzingSubtext, { color: theme.textSecondary }]}>{l('Mohon tunggu sebentar', 'Please wait a moment')}</Text>
                </View>
              )}

              {resolvedPending.status === 'error' && (
                <View style={styles.pendingErrorState}>
                  <Text style={[styles.pendingErrorText, { color: theme.text }]}>{l('Gagal menganalisis foto', 'Failed to analyze photo')}</Text>
                  <Text style={[styles.pendingErrorSubtext, { color: theme.textSecondary }]}>
                    {resolvedPending.error || l('Terjadi kesalahan', 'An error occurred')}
                  </Text>
                  <View style={styles.pendingErrorButtons}>
                    <TouchableOpacity
                      style={[styles.pendingRetryButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={handleRetryPending}
                      activeOpacity={0.7}
                    >
                      <RefreshCw size={18} color={theme.text} />
                      <Text style={[styles.pendingRetryText, { color: theme.text }]}>{l('Coba Lagi', 'Try Again')}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.pendingDeleteButton, { backgroundColor: 'rgba(197, 48, 48, 0.08)' }]}
                      onPress={handleRemovePending}
                      activeOpacity={0.7}
                    >
                      <Trash2 size={18} color="#C53030" />
                      <Text style={styles.pendingDeleteText}>{l('Hapus', 'Delete')}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {resolvedPending.status === 'done' && resolvedPending.analysis && (
                <View style={styles.pendingResultState}>
                  {(() => {
                    const totals = getEditedTotals();
                    const displaySugar = Math.round(totals.sugar * 10) / 10;
                    const displayFiber = Math.round(totals.fiber * 10) / 10;
                    const displaySodium = Math.round(totals.sodium);
                    return (
                      <>
                        <View style={styles.pendingHeroImageWrap}>
                          {displayPhotoUri ? (
                            <ExpoImage
                              source={{ uri: displayPhotoUri }}
                              style={styles.pendingHeroImage}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={0}
                            />
                          ) : (
                            <View style={[styles.pendingHeroImageFallback, { backgroundColor: theme.card }]}>
                              <Camera size={36} color={theme.textTertiary} />
                            </View>
                          )}
                          <View style={styles.pendingImageCaloriesBadge}>
                            <Text style={styles.pendingCaloriesEmoji}>🔥</Text>
                            <Text style={[styles.pendingImageCaloriesValue, { color: '#FFFFFF' }]}>{totals.calories}</Text>
                            <Text style={styles.pendingImageCaloriesUnit}>kcal</Text>
                          </View>
                        </View>
                        {foodTitlesForDisplay ? (
                          <View style={styles.pendingFoodTitleBlock}>
                            <Text style={[styles.pendingFoodTitleMain, { color: theme.text }]} numberOfLines={2}>
                              {foodTitlesForDisplay.title}
                            </Text>
                            <Text
                              style={[styles.pendingFoodTitleSub, { color: theme.textSecondary }]}
                              numberOfLines={3}
                            >
                              {foodTitlesForDisplay.subtitle}
                            </Text>
                          </View>
                        ) : null}
                        <View style={[styles.pendingTotalCard, { backgroundColor: theme.background, borderColor: theme.border }]}>
                          <View style={[styles.premiumMaskSection, { borderRadius: 12 }]}>
                            <View style={styles.pendingStatsSection}>
                              <View style={styles.pendingMacros}>
                                <View style={styles.pendingMacro}>
                                  <Text style={styles.pendingMacroEmoji}>🥩</Text>
                                  <Text style={[styles.pendingMacroValue, { color: theme.text }]}>{totals.protein}g</Text>
                                  <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>Protein</Text>
                                </View>
                                <View style={styles.pendingMacro}>
                                  <Text style={styles.pendingMacroEmoji}>🌾</Text>
                                  <Text style={[styles.pendingMacroValue, { color: theme.text }]}>{totals.carbs}g</Text>
                                  <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>{l('Karbo', 'Carbs')}</Text>
                                </View>
                                <View style={styles.pendingMacro}>
                                  <Text style={styles.pendingMacroEmoji}>🥑</Text>
                                  <Text style={[styles.pendingMacroValue, { color: theme.text }]}>{totals.fat}g</Text>
                                  <Text style={[styles.pendingMacroLabel, { color: theme.textSecondary }]}>{l('Lemak', 'Fat')}</Text>
                                </View>
                              </View>
                              <View style={styles.pendingMicrosRow}>
                                <View style={styles.pendingMicro}>
                                  <Text style={[styles.pendingMicroValue, { color: theme.text }]}>{displaySugar}g</Text>
                                  <Text style={[styles.pendingMicroLabel, { color: theme.textSecondary }]}>{l('Gula', 'Sugar')}</Text>
                                </View>
                                <View style={styles.pendingMicro}>
                                  <Text style={[styles.pendingMicroValue, { color: theme.text }]}>{displayFiber}g</Text>
                                  <Text style={[styles.pendingMicroLabel, { color: theme.textSecondary }]}>{l('Serat', 'Fiber')}</Text>
                                </View>
                                <View style={styles.pendingMicro}>
                                  <Text style={[styles.pendingMicroValue, { color: theme.text }]}>{displaySodium}mg</Text>
                                  <Text style={[styles.pendingMicroLabel, { color: theme.textSecondary }]}>{l('Natrium', 'Sodium')}</Text>
                                </View>
                              </View>
                            </View>
                          </View>
                        </View>
                      </>
                    );
                  })()}

                  <View style={styles.itemsTitleRow}>
                    <Text style={[styles.pendingItemsTitle, { color: theme.text }]}>{l('Komponen Makanan', 'Food Components')}</Text>
                    <TouchableOpacity
                      style={[styles.addItemButton, { backgroundColor: theme.background, borderColor: theme.border }]}
                      onPress={handleAddNewItem}
                      activeOpacity={0.7}
                    >
                      <PlusCircle size={16} color={theme.primary} />
                      <Text style={styles.addItemButtonText}>{l('Tambah', 'Add')}</Text>
                    </TouchableOpacity>
                  </View>

                  {showAddItem && (
                    <View style={[styles.editItemCard, { backgroundColor: theme.background, borderColor: theme.primary }]}>
                      <Text style={[styles.editItemTitle, { color: theme.text }]}>{l('Tambah Item Baru', 'Add New Item')}</Text>
                      <View style={styles.editItemRow}>
                        <View style={styles.editItemField}>
                          <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Nama</Text>
                          <TextInput
                            style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            placeholder={l('Nama makanan', 'Food name')}
                            placeholderTextColor={theme.textTertiary}
                            value={editItemName}
                            onChangeText={setEditItemName}
                          />
                        </View>
                      </View>
                      <View style={styles.editItemRow}>
                        <View style={styles.editItemField}>
                          <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Porsi</Text>
                          <TextInput
                            style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            placeholder={l('1 porsi', '1 serving')}
                            placeholderTextColor={theme.textTertiary}
                            value={editItemPortion}
                            onChangeText={setEditItemPortion}
                          />
                        </View>
                      </View>
                      <View style={styles.editItemRowMulti}>
                        <View style={styles.editItemFieldSmall}>
                          <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Kalori</Text>
                          <TextInput
                            style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            placeholder="0"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                            value={editItemCalories}
                            onChangeText={setEditItemCalories}
                          />
                        </View>
                        <View style={styles.editItemFieldSmall}>
                          <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Protein</Text>
                          <TextInput
                            style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            placeholder="0"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                            value={editItemProtein}
                            onChangeText={setEditItemProtein}
                          />
                        </View>
                      </View>
                      <View style={styles.editItemRowMulti}>
                        <View style={styles.editItemFieldSmall}>
                          <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Karbo</Text>
                          <TextInput
                            style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            placeholder="0"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                            value={editItemCarbs}
                            onChangeText={setEditItemCarbs}
                          />
                        </View>
                        <View style={styles.editItemFieldSmall}>
                          <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Lemak</Text>
                          <TextInput
                            style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                            placeholder="0"
                            placeholderTextColor={theme.textTertiary}
                            keyboardType="numeric"
                            value={editItemFat}
                            onChangeText={setEditItemFat}
                          />
                        </View>
                      </View>
                    </View>
                  )}

                  {editedItems.map((item, index) =>
                    editingItemIndex === index ? (
                      <View key={index} style={[styles.editItemCard, { backgroundColor: theme.background, borderColor: theme.primary }]}>
                        <Text style={[styles.editItemTitle, { color: theme.text }]}>{l('Edit Item', 'Edit Item')}</Text>
                        <View style={styles.editItemRow}>
                          <View style={styles.editItemField}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Nama</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder={l('Nama makanan', 'Food name')}
                              placeholderTextColor={theme.textTertiary}
                              value={editItemName}
                              onChangeText={setEditItemName}
                            />
                          </View>
                        </View>
                        <View style={styles.editItemRow}>
                          <View style={styles.editItemField}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Porsi</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder={l('1 porsi', '1 serving')}
                              placeholderTextColor={theme.textTertiary}
                              value={editItemPortion}
                              onChangeText={setEditItemPortion}
                            />
                          </View>
                        </View>
                        <View style={styles.editItemRowMulti}>
                          <View style={styles.editItemFieldSmall}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Kalori</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="0"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={editItemCalories}
                              onChangeText={setEditItemCalories}
                            />
                          </View>
                          <View style={styles.editItemFieldSmall}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Protein</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="0"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={editItemProtein}
                              onChangeText={setEditItemProtein}
                            />
                          </View>
                        </View>
                        <View style={styles.editItemRowMulti}>
                          <View style={styles.editItemFieldSmall}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Karbo</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="0"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={editItemCarbs}
                              onChangeText={setEditItemCarbs}
                            />
                          </View>
                          <View style={styles.editItemFieldSmall}>
                            <Text style={[styles.editItemLabel, { color: theme.textSecondary }]}>Lemak</Text>
                            <TextInput
                              style={[styles.editItemInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
                              placeholder="0"
                              placeholderTextColor={theme.textTertiary}
                              keyboardType="numeric"
                              value={editItemFat}
                              onChangeText={setEditItemFat}
                            />
                          </View>
                        </View>
                      </View>
                    ) : (
                      <TouchableOpacity
                        key={index}
                        style={[styles.pendingItemCard, { backgroundColor: theme.background, borderColor: theme.border }]}
                        onPress={() => handleStartEditItem(index)}
                        activeOpacity={0.7}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.pendingItemName, { color: theme.text }]}>
                            {item.name
                              .replace(/\s*\/\s*/g, ' ')
                              .replace(/\s+or\s+/gi, ' ')
                              .replace(/about\s+/gi, '')
                              .trim()}
                          </Text>
                          <Text style={[styles.pendingItemPortion, { color: theme.textSecondary }]}>
                            {item.portion.replace(/about\s+/gi, '').replace(/approximately\s+/gi, '').trim()}
                          </Text>
                        </View>
                        <View style={styles.itemRightSection}>
                          <Text style={[styles.pendingItemCalories, { color: theme.textTertiary }]}>{item.calories} kcal</Text>
                          <Edit3 size={14} color={theme.textTertiary} />
                        </View>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
              )}
            </ScrollView>

            {showSaveFooter && (
              <View
                style={[
                  styles.pendingModalFooter,
                  {
                    backgroundColor: theme.card,
                    borderTopColor: theme.border,
                  },
                ]}
              >
                {(showAddItem || editingItemIndex !== null) && (
                  <View style={styles.pendingModalFormToolbar}>
                    <TouchableOpacity
                      onPress={() => {
                        if (showAddItem) setShowAddItem(false);
                        else setEditingItemIndex(null);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.editItemCancelText, { color: theme.textSecondary }]}>Batal</Text>
                    </TouchableOpacity>
                    {editingItemIndex !== null && (
                      <TouchableOpacity
                        style={[styles.editItemDeleteBtn, { backgroundColor: 'rgba(197, 48, 48, 0.08)' }]}
                        onPress={() => handleDeleteItem(editingItemIndex)}
                        activeOpacity={0.7}
                      >
                        <Trash2 size={16} color="#C53030" />
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                <TouchableOpacity
                  style={[styles.confirmEditedButton, isSavingConfirm && { opacity: 0.72 }]}
                  onPress={() => {
                    if (isSavingConfirm) return;
                    if (showAddItem) {
                      handleSaveNewItem();
                      return;
                    }
                    if (editingItemIndex !== null) {
                      handleSaveEditItem();
                      return;
                    }
                    handleConfirmEdited();
                  }}
                  disabled={isSavingConfirm}
                  activeOpacity={0.8}
                >
                  {isSavingConfirm ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Check size={20} color="#FFFFFF" />
                  )}
                  <Text style={styles.confirmEditedText}>{isSavingConfirm ? 'Menyimpan...' : 'Simpan'}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>

      {showFavoriteToast && (
        <View style={[styles.favoriteToast, favoriteToastMessage.includes('Dihapus') && { backgroundColor: '#6B7280' }]}>
          <Star
            size={16}
            color={favoriteToastMessage.includes('Dihapus') ? '#FFFFFF' : '#FFC107'}
            fill={favoriteToastMessage.includes('Dihapus') ? 'transparent' : '#FFC107'}
          />
          <Text style={styles.favoriteToastText}>{favoriteToastMessage}</Text>
        </View>
      )}
    </SafeAreaView>
  );
}
