import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Share,
  Alert,
  Dimensions,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Instagram,
  Download,
  MoreHorizontal,
  MapPin,
  Check,
  ChevronRight,
  Clock,
  Heart,
  Utensils,
  User,
  Navigation,
  Edit3,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import {
  StoryShareData,
  IncludeOptions,
  HealthRating,
  HEALTH_RATINGS,
} from '@/types/storyShare';
import { LOCATION_PRESETS } from '@/constants/storyShare';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function StoryShareScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{
    mealName?: string;
    mealSubtitle?: string;
    calories?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
    photoUri?: string;
    timestamp?: string;
    healthRating?: string;
  }>();

  const storyData: StoryShareData = {
    mealName: params.mealName || 'Delicious Meal',
    mealSubtitle: params.mealSubtitle,
    calories: parseInt(params.calories || '0'),
    protein: parseInt(params.protein || '0'),
    carbs: parseInt(params.carbs || '0'),
    fat: parseInt(params.fat || '0'),
    photoUri: params.photoUri,
    timestamp: parseInt(params.timestamp || Date.now().toString()),
  };

  const [includeOptions, setIncludeOptions] = useState<IncludeOptions>({
    macros: true,
    healthRating: true,
    location: false,
    time: false,
    name: true,
  });
  const healthRating: HealthRating = (params.healthRating as HealthRating) || 'sehat';
  const [locationName, setLocationName] = useState<string>('');
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [showWatermark, setShowWatermark] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const locationSheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleOption = (key: keyof IncludeOptions) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (key === 'location' && !includeOptions.location) {
      setShowLocationSheet(true);
      openLocationSheet();
    } else {
      setIncludeOptions(prev => ({ ...prev, [key]: !prev[key] }));
    }
  };



  const openLocationSheet = () => {
    setShowLocationSheet(true);
    Animated.spring(locationSheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeLocationSheet = () => {
    Animated.timing(locationSheetAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setShowLocationSheet(false);
    });
  };

  const selectLocation = (name: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setLocationName(name);
    setIncludeOptions(prev => ({ ...prev, location: true }));
    closeLocationSheet();
  };

  const handleCustomLocation = () => {
    if (customLocationInput.trim()) {
      selectLocation(customLocationInput.trim());
      setCustomLocationInput('');
    }
  };

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const handleShareInstagram = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const healthInfo = HEALTH_RATINGS.find(r => r.id === healthRating);
      let message = `${storyData.mealName} - ${storyData.calories} kcal 🔥`;
      if (includeOptions.macros) {
        message += `\n💪 ${storyData.protein}g protein • 🍞 ${storyData.carbs}g carbs • 🥑 ${storyData.fat}g fat`;
      }
      if (includeOptions.healthRating && healthInfo) {
        message += `\n${healthInfo.icon} ${healthInfo.label}`;
      }
      if (includeOptions.location && locationName) {
        message += `\n📍 ${locationName}`;
      }
      message += '\n\nTracked with DietKu';
      
      await Share.share({ message });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const handleSaveImage = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Save Image',
      'Image save feature coming soon. For now, you can take a screenshot.',
      [{ text: 'OK' }]
    );
  };

  const handleMoreOptions = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `${storyData.mealName} - ${storyData.calories} kcal 🔥\n\nTracked with DietKu`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };

  const currentHealthRating = HEALTH_RATINGS.find(r => r.id === healthRating);

  const renderPreview = () => (
    <View style={styles.previewContainer}>
      {storyData.photoUri ? (
        <Image
          source={{ uri: storyData.photoUri }}
          style={styles.previewImage}
          resizeMode="cover"
        />
      ) : (
        <LinearGradient
          colors={['#1a1a2e', '#16213e', '#0f0f23']}
          style={styles.previewImage}
        />
      )}
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.4, 1]}
        style={styles.previewGradient}
      />

      <View style={styles.previewContent}>
        {includeOptions.name && (
          <Animated.Text 
            style={[
              styles.previewMealName,
              { opacity: includeOptions.name ? 1 : 0 }
            ]}
          >
            {storyData.mealName}
          </Animated.Text>
        )}

        <Text style={styles.previewCalories}>
          {storyData.calories}
          <Text style={styles.previewCaloriesUnit}> kcal</Text>
        </Text>

        {includeOptions.macros && (
          <View style={styles.macroChips}>
            <View style={[styles.macroChip, { backgroundColor: 'rgba(239, 68, 68, 0.2)' }]}>
              <Text style={styles.macroChipText}>💪 {storyData.protein}g</Text>
            </View>
            <View style={[styles.macroChip, { backgroundColor: 'rgba(245, 158, 11, 0.2)' }]}>
              <Text style={styles.macroChipText}>🍞 {storyData.carbs}g</Text>
            </View>
            <View style={[styles.macroChip, { backgroundColor: 'rgba(139, 92, 246, 0.2)' }]}>
              <Text style={styles.macroChipText}>🥑 {storyData.fat}g</Text>
            </View>
          </View>
        )}

        <View style={styles.previewPills}>
          {includeOptions.healthRating && currentHealthRating && (
            <View style={[styles.previewPill, { backgroundColor: `${currentHealthRating.color}20` }]}>
              <Text style={styles.previewPillText}>
                {currentHealthRating.icon} {currentHealthRating.label}
              </Text>
            </View>
          )}

          {includeOptions.location && locationName && (
            <View style={[styles.previewPill, { backgroundColor: 'rgba(236, 72, 153, 0.2)' }]}>
              <Text style={styles.previewPillText}>📍 {locationName}</Text>
            </View>
          )}

          {includeOptions.time && (
            <View style={[styles.previewPill, { backgroundColor: 'rgba(99, 102, 241, 0.2)' }]}>
              <Text style={styles.previewPillText}>🕐 {formatTime(storyData.timestamp)}</Text>
            </View>
          )}
        </View>
      </View>

      {showWatermark && (
        <View style={styles.previewWatermark}>
          <Text style={styles.previewWatermarkText}>DietKu</Text>
        </View>
      )}
    </View>
  );

  const renderToggleRow = (
    key: keyof IncludeOptions,
    icon: React.ReactNode,
    label: string,
    subtitle?: string,
    onTap?: () => void,
    showHighlight?: boolean
  ) => {
    const isActive = includeOptions[key];
    return (
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={onTap || (() => toggleOption(key))}
        activeOpacity={0.7}
      >
        <View style={styles.toggleLeft}>
          <View style={[styles.toggleIcon, showHighlight && isActive && styles.toggleIconActive]}>
            {icon}
          </View>
          <View>
            <Text style={styles.toggleLabel}>{label}</Text>
            {subtitle && <Text style={styles.toggleSubtitle}>{subtitle}</Text>}
          </View>
        </View>
        <View style={[styles.toggleCheck, isActive && styles.toggleCheckActive]}>
          {isActive && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    );
  };

  const renderIncludePanel = () => (
    <View style={styles.includePanel}>
      <Text style={styles.includePanelTitle}>Include On Story</Text>
      
      {renderToggleRow(
        'name',
        <User size={18} color={includeOptions.name ? '#FFFFFF' : '#666'} />,
        'Meal Name',
        storyData.mealName,
        undefined,
        true
      )}
      
      {renderToggleRow(
        'macros',
        <Utensils size={18} color={includeOptions.macros ? '#FFFFFF' : '#666'} />,
        'Macros',
        `${storyData.protein}g P • ${storyData.carbs}g C • ${storyData.fat}g F`
      )}
      
      {renderToggleRow(
        'healthRating',
        <Heart size={18} color={includeOptions.healthRating ? '#FFFFFF' : '#666'} />,
        'Health Rating',
        currentHealthRating?.label,
        undefined,
        true
      )}
      
      {renderToggleRow(
        'location',
        <MapPin size={18} color={includeOptions.location ? '#FFFFFF' : '#666'} />,
        'Location',
        locationName || 'Tap to add',
        () => {
          if (includeOptions.location) {
            openLocationSheet();
          } else {
            toggleOption('location');
          }
        }
      )}
      
      {renderToggleRow(
        'time',
        <Clock size={18} color={includeOptions.time ? '#FFFFFF' : '#666'} />,
        'Time',
        formatTime(storyData.timestamp)
      )}

      <TouchableOpacity
        style={styles.watermarkRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowWatermark(!showWatermark);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.watermarkLabel}>Show DietKu watermark</Text>
        <View style={[styles.toggleCheck, showWatermark && styles.toggleCheckActive]}>
          {showWatermark && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
    </View>
  );

  const renderLocationSheet = () => {
    if (!showLocationSheet) return null;

    return (
      <View style={styles.sheetOverlay}>
        <TouchableOpacity
          style={styles.sheetBackdrop}
          onPress={closeLocationSheet}
          activeOpacity={1}
        />
        <Animated.View
          style={[
            styles.locationSheet,
            {
              transform: [{
                translateY: locationSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [400, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Add Location</Text>

          <TouchableOpacity
            style={styles.locationOption}
            onPress={() => {
              if (Platform.OS !== 'web') {
                Alert.alert('Location', 'Using current location feature coming soon');
              }
              selectLocation('Current Location');
            }}
            activeOpacity={0.7}
          >
            <View style={styles.locationOptionIcon}>
              <Navigation size={20} color="#10B981" />
            </View>
            <Text style={styles.locationOptionText}>Use current location</Text>
            <ChevronRight size={20} color="#666" />
          </TouchableOpacity>

          <View style={styles.customLocationRow}>
            <View style={styles.customLocationIcon}>
              <Edit3 size={18} color="#EC4899" />
            </View>
            <TextInput
              style={styles.customLocationInput}
              placeholder="Enter custom location..."
              placeholderTextColor="#666"
              value={customLocationInput}
              onChangeText={setCustomLocationInput}
              onSubmitEditing={handleCustomLocation}
              returnKeyType="done"
            />
            {customLocationInput.trim() && (
              <TouchableOpacity onPress={handleCustomLocation}>
                <Text style={styles.addLocationBtn}>Add</Text>
              </TouchableOpacity>
            )}
          </View>

          <Text style={styles.presetsTitle}>Quick Select</Text>
          <View style={styles.presetsGrid}>
            {LOCATION_PRESETS.map((preset) => (
              <TouchableOpacity
                key={preset.id}
                style={styles.presetChip}
                onPress={() => selectLocation(preset.name)}
                activeOpacity={0.7}
              >
                <Text style={styles.presetIcon}>{preset.icon}</Text>
                <Text style={styles.presetText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {locationName && (
            <TouchableOpacity
              style={styles.removeLocationBtn}
              onPress={() => {
                setLocationName('');
                setIncludeOptions(prev => ({ ...prev, location: false }));
                closeLocationSheet();
              }}
            >
              <Text style={styles.removeLocationText}>Remove Location</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.container}>
        <LinearGradient
          colors={['#0a0a0f', '#12121a', '#0a0a0f']}
          style={StyleSheet.absoluteFill}
        />

        <Animated.View style={[styles.header, { paddingTop: insets.top + 8, opacity: fadeAnim }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Story</Text>
          <View style={{ width: 44 }} />
        </Animated.View>

        <ScrollView
          style={styles.scrollContent}
          contentContainerStyle={[styles.scrollContentContainer, { paddingBottom: insets.bottom + 200 }]}
          showsVerticalScrollIndicator={false}
        >
          {renderPreview()}
          {renderIncludePanel()}
        </ScrollView>

        <Animated.View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16, opacity: fadeAnim }]}>
          <TouchableOpacity style={styles.shareButton} onPress={handleShareInstagram}>
            <LinearGradient
              colors={['#833AB4', '#E1306C', '#F77737']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.shareGradient}
            >
              <Instagram size={22} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Share to Instagram</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleSaveImage}>
              <Download size={20} color="#FFFFFF" />
              <Text style={styles.secondaryButtonText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryButton} onPress={handleMoreOptions}>
              <MoreHorizontal size={20} color="#FFFFFF" />
              <Text style={styles.secondaryButtonText}>More</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {renderLocationSheet()}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0f',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    paddingHorizontal: 16,
  },
  previewContainer: {
    aspectRatio: 9 / 16,
    width: SCREEN_WIDTH - 32,
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    marginBottom: 20,
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  previewContent: {
    position: 'absolute',
    bottom: 60,
    left: 20,
    right: 20,
  },
  previewMealName: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  previewCalories: {
    fontSize: 56,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    marginBottom: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  previewCaloriesUnit: {
    fontSize: 24,
    fontWeight: '500' as const,
  },
  macroChips: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  macroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  macroChipText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  previewPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  previewPill: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  previewPillText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  previewWatermark: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    opacity: 0.4,
  },
  previewWatermarkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  includePanel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 20,
    padding: 16,
  },
  includePanelTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  toggleIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleIconActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
  },
  toggleLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#FFFFFF',
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 2,
  },
  toggleCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCheckActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  watermarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 14,
  },
  watermarkLabel: {
    fontSize: 14,
    color: '#999',
  },
  bottomActions: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: 'rgba(10,10,15,0.95)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  shareButton: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
  },
  shareGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#999',
  },
  sheetOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  locationSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1a1a24',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  sheetTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 24,
  },
  locationOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  locationOptionIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  locationOptionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500' as const,
    color: '#FFFFFF',
  },
  customLocationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    marginBottom: 20,
  },
  customLocationIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(236, 72, 153, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  customLocationInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 8,
  },
  addLocationBtn: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#10B981',
    paddingHorizontal: 12,
  },
  presetsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  presetsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 24,
  },
  presetIcon: {
    fontSize: 16,
  },
  presetText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#FFFFFF',
  },
  removeLocationBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  removeLocationText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#EF4444',
  },
});
