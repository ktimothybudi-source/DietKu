import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Share,
  Alert,
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import {
  X,
  Instagram,
  Download,
  Link2,
  MoreHorizontal,
  MapPin,
  Clock,
  User,
  Sparkles,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useNutrition } from '@/contexts/NutritionContext';
import StoryCard from '@/components/StoryCard';
import {
  StoryShareData,
  StoryShareSettings,
  StorySticker,
  StoryTemplate,
  StickerType,
} from '@/types/storyShare';
import {
  HEALTH_RATING_CONFIG,
  STICKER_CONFIG,
  TEMPLATE_CONFIG,
  HEALTH_RATING_ORDER,
  DEFAULT_SHARE_SETTINGS,
} from '@/constants/storyShare';


const CARD_PREVIEW_SCALE = 0.35;
const CARD_PREVIEW_WIDTH = 1080 * CARD_PREVIEW_SCALE;
const CARD_PREVIEW_HEIGHT = 1920 * CARD_PREVIEW_SCALE;

interface DraggableSticker {
  sticker: StorySticker;
  pan: Animated.ValueXY;
  scale: Animated.Value;
}

export default function StoryShareScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { profile, streakData, foodLog } = useNutrition();
  const params = useLocalSearchParams<{
    mealName?: string;
    mealSubtitle?: string;
    calories?: string;
    protein?: string;
    carbs?: string;
    fat?: string;
    photoUri?: string;
    timestamp?: string;
  }>();

  const [settings, setSettings] = useState<StoryShareSettings>({
    ...DEFAULT_SHARE_SETTINGS,
  });
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [draggableStickers, setDraggableStickers] = useState<DraggableSticker[]>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [showStickerTray, setShowStickerTray] = useState(false);

  const templateScrollRef = useRef<ScrollView>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

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

  const weeklyData = React.useMemo(() => {
    const entries = Object.values(foodLog).flat();
    const totalCalories = entries.reduce((sum, e) => sum + e.calories, 0);
    const totalProtein = entries.reduce((sum, e) => sum + e.protein, 0);
    const days = Object.keys(foodLog).length || 1;
    
    return {
      avgCalories: Math.round(totalCalories / days),
      avgProtein: Math.round(totalProtein / days),
      totalMeals: entries.length,
      streakDays: streakData.currentStreak,
      bestDay: '',
    };
  }, [foodLog, streakData]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  };

  const handleTemplateSelect = (template: StoryTemplate) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, template }));
  };

  const handleToggle = (key: keyof StoryShareSettings) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleHealthRatingCycle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const currentIndex = HEALTH_RATING_ORDER.indexOf(settings.healthRating);
    const nextIndex = (currentIndex + 1) % HEALTH_RATING_ORDER.length;
    setSettings(prev => ({ ...prev, healthRating: HEALTH_RATING_ORDER[nextIndex] }));
  };

  const handleAddSticker = (type: StickerType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newSticker: StorySticker = {
      id: Date.now().toString(),
      type,
      x: CARD_PREVIEW_WIDTH / 2 - 50,
      y: CARD_PREVIEW_HEIGHT / 2 - 20,
      scale: 1,
      style: 'filled',
    };

    const pan = new Animated.ValueXY({ x: newSticker.x, y: newSticker.y });
    const scale = new Animated.Value(1);

    setDraggableStickers(prev => [...prev, { sticker: newSticker, pan, scale }]);
    setSettings(prev => ({
      ...prev,
      stickers: [...prev.stickers, newSticker],
    }));
    setShowStickerTray(false);
  };

  const handleStickerStyleCycle = (stickerId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const styleOptions: ('filled' | 'outline' | 'blurred')[] = ['filled', 'outline', 'blurred'];
    
    setSettings(prev => ({
      ...prev,
      stickers: prev.stickers.map(s => {
        if (s.id === stickerId) {
          const currentIndex = styleOptions.indexOf(s.style);
          const nextIndex = (currentIndex + 1) % styleOptions.length;
          return { ...s, style: styleOptions[nextIndex] };
        }
        return s;
      }),
    }));
  };

  const handleRemoveSticker = (stickerId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setDraggableStickers(prev => prev.filter(d => d.sticker.id !== stickerId));
    setSettings(prev => ({
      ...prev,
      stickers: prev.stickers.filter(s => s.id !== stickerId),
    }));
    setSelectedStickerId(null);
  };

  const handleSetLocation = (location: string) => {
    setSettings(prev => ({ ...prev, location, showLocation: true }));
    setShowLocationInput(false);
  };

  const handleShareInstagram = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Bagikan ke Instagram',
      'Fitur ekspor gambar akan segera hadir. Untuk saat ini, Anda dapat mengambil screenshot dan membagikannya.',
      [{ text: 'OK' }]
    );
  };

  const handleSaveImage = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Alert.alert(
      'Simpan Gambar',
      'Fitur simpan gambar akan segera hadir. Untuk saat ini, Anda dapat mengambil screenshot.',
      [{ text: 'OK' }]
    );
  };

  const handleShare = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await Share.share({
        message: `${storyData.mealName} - ${storyData.calories} kcal 🔥\n\nTracked with DietKu`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  };

  const createPanResponder = useCallback((draggable: DraggableSticker) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setSelectedStickerId(draggable.sticker.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        draggable.pan.setOffset({
          x: (draggable.pan.x as any)._value,
          y: (draggable.pan.y as any)._value,
        });
        draggable.pan.setValue({ x: 0, y: 0 });
        Animated.spring(draggable.scale, {
          toValue: 1.1,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: Animated.event(
        [null, { dx: draggable.pan.x, dy: draggable.pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        draggable.pan.flattenOffset();
        Animated.spring(draggable.scale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
      },
    });
  }, []);

  const renderTemplateCarousel = () => (
    <View style={styles.templateSection}>
      <ScrollView
        ref={templateScrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.templateList}
        snapToInterval={80}
        decelerationRate="fast"
      >
        {(Object.keys(TEMPLATE_CONFIG) as StoryTemplate[]).map((template) => {
          const isActive = settings.template === template;
          return (
            <TouchableOpacity
              key={template}
              style={[
                styles.templateItem,
                isActive && styles.templateItemActive,
                { borderColor: isActive ? '#10B981' : theme.border },
              ]}
              onPress={() => handleTemplateSelect(template)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.templatePreview,
                { backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : theme.background }
              ]}>
                <Text style={styles.templateEmoji}>
                  {template === 'minimal' ? '✨' : 
                   template === 'health_hero' ? '💚' : 
                   template === 'restaurant' ? '📍' : '📊'}
                </Text>
              </View>
              <Text style={[
                styles.templateName,
                { color: isActive ? '#10B981' : theme.text }
              ]}>
                {TEMPLATE_CONFIG[template].name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderToggleChips = () => (
    <View style={styles.toggleSection}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.toggleList}
      >
        <TouchableOpacity
          style={[
            styles.toggleChip,
            settings.showMacros && styles.toggleChipActive,
            { borderColor: settings.showMacros ? '#10B981' : theme.border }
          ]}
          onPress={() => handleToggle('showMacros')}
          activeOpacity={0.7}
        >
          <Sparkles size={14} color={settings.showMacros ? '#10B981' : theme.textSecondary} />
          <Text style={[
            styles.toggleChipText,
            { color: settings.showMacros ? '#10B981' : theme.textSecondary }
          ]}>Macros</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleChip,
            settings.showHealthRating && styles.toggleChipActive,
            { 
              borderColor: settings.showHealthRating 
                ? HEALTH_RATING_CONFIG[settings.healthRating].color 
                : theme.border,
              backgroundColor: settings.showHealthRating 
                ? HEALTH_RATING_CONFIG[settings.healthRating].bgColor 
                : 'transparent',
            }
          ]}
          onPress={() => settings.showHealthRating ? handleHealthRatingCycle() : handleToggle('showHealthRating')}
          onLongPress={() => handleToggle('showHealthRating')}
          activeOpacity={0.7}
        >
          <Text style={[
            styles.toggleChipText,
            { color: settings.showHealthRating ? HEALTH_RATING_CONFIG[settings.healthRating].color : theme.textSecondary }
          ]}>
            {settings.showHealthRating ? HEALTH_RATING_CONFIG[settings.healthRating].label : 'Health Rating'}
          </Text>
          {settings.showHealthRating && (
            <ChevronRight size={12} color={HEALTH_RATING_CONFIG[settings.healthRating].color} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleChip,
            settings.showLocation && styles.toggleChipActive,
            { borderColor: settings.showLocation ? '#10B981' : theme.border }
          ]}
          onPress={() => settings.showLocation ? handleToggle('showLocation') : setShowLocationInput(true)}
          activeOpacity={0.7}
        >
          <MapPin size={14} color={settings.showLocation ? '#10B981' : theme.textSecondary} />
          <Text style={[
            styles.toggleChipText,
            { color: settings.showLocation ? '#10B981' : theme.textSecondary }
          ]}>
            {settings.location || 'Location'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleChip,
            settings.showTime && styles.toggleChipActive,
            { borderColor: settings.showTime ? '#10B981' : theme.border }
          ]}
          onPress={() => handleToggle('showTime')}
          activeOpacity={0.7}
        >
          <Clock size={14} color={settings.showTime ? '#10B981' : theme.textSecondary} />
          <Text style={[
            styles.toggleChipText,
            { color: settings.showTime ? '#10B981' : theme.textSecondary }
          ]}>Time</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleChip,
            settings.showUserName && styles.toggleChipActive,
            { borderColor: settings.showUserName ? '#10B981' : theme.border }
          ]}
          onPress={() => handleToggle('showUserName')}
          activeOpacity={0.7}
        >
          <User size={14} color={settings.showUserName ? '#10B981' : theme.textSecondary} />
          <Text style={[
            styles.toggleChipText,
            { color: settings.showUserName ? '#10B981' : theme.textSecondary }
          ]}>Name</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );

  const renderStickerTray = () => (
    <Animated.View 
      style={[
        styles.stickerTray,
        { backgroundColor: theme.card, borderTopColor: theme.border }
      ]}
    >
      <View style={styles.stickerTrayHeader}>
        <Text style={[styles.stickerTrayTitle, { color: theme.text }]}>Stickers</Text>
        <TouchableOpacity onPress={() => setShowStickerTray(false)}>
          <X size={20} color={theme.textSecondary} />
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stickerList}
      >
        {(Object.keys(STICKER_CONFIG) as StickerType[]).map((type) => (
          <TouchableOpacity
            key={type}
            style={[styles.stickerOption, { backgroundColor: theme.background, borderColor: theme.border }]}
            onPress={() => handleAddSticker(type)}
            activeOpacity={0.7}
          >
            <Text style={styles.stickerOptionEmoji}>{STICKER_CONFIG[type].emoji}</Text>
            <Text style={[styles.stickerOptionLabel, { color: theme.text }]} numberOfLines={1}>
              {STICKER_CONFIG[type].label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </Animated.View>
  );

  const renderLocationModal = () => {
    if (!showLocationInput) return null;

    const presetLocations = ['Homemade', 'Restaurant', 'Cafe', 'Office'];

    return (
      <View style={styles.locationOverlay}>
        <TouchableOpacity 
          style={styles.locationBackdrop} 
          onPress={() => setShowLocationInput(false)}
          activeOpacity={1}
        />
        <View style={[styles.locationModal, { backgroundColor: theme.card }]}>
          <Text style={[styles.locationModalTitle, { color: theme.text }]}>Tambah Lokasi</Text>
          
          <View style={styles.locationPresets}>
            {presetLocations.map((loc) => (
              <TouchableOpacity
                key={loc}
                style={[styles.locationPreset, { backgroundColor: theme.background, borderColor: theme.border }]}
                onPress={() => handleSetLocation(loc)}
                activeOpacity={0.7}
              >
                <Text style={[styles.locationPresetText, { color: theme.text }]}>{loc}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.locationCustom, { borderColor: theme.border }]}
            onPress={() => {
              handleSetLocation('My Location');
            }}
            activeOpacity={0.7}
          >
            <MapPin size={16} color={theme.textSecondary} />
            <Text style={[styles.locationCustomText, { color: theme.textSecondary }]}>
              Masukkan lokasi kustom...
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={[styles.container, { backgroundColor: '#0a0a0a' }]}>
        <LinearGradient
          colors={['#0a0a0a', '#1a1a2e', '#0a0a0a']}
          style={StyleSheet.absoluteFill}
        />

        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={styles.headerTitle}>Story Share</Text>
          
          <View style={styles.headerRight} />
        </View>

        <Animated.View 
          style={[
            styles.previewContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.cardWrapper}>
            <StoryCard
              data={storyData}
              settings={settings}
              weeklyData={weeklyData}
              userName={profile?.name}
              scale={CARD_PREVIEW_SCALE}
            />
            
            {draggableStickers.map((draggable) => {
              const panResponder = createPanResponder(draggable);
              const config = STICKER_CONFIG[draggable.sticker.type];
              const stickerSettings = settings.stickers.find(s => s.id === draggable.sticker.id);
              const style = stickerSettings?.style || 'filled';
              const isSelected = selectedStickerId === draggable.sticker.id;
              
              return (
                <Animated.View
                  key={draggable.sticker.id}
                  style={[
                    styles.draggableSticker,
                    style === 'filled' && styles.stickerFilled,
                    style === 'outline' && styles.stickerOutline,
                    style === 'blurred' && styles.stickerBlurred,
                    isSelected && styles.stickerSelected,
                    {
                      transform: [
                        { translateX: draggable.pan.x },
                        { translateY: draggable.pan.y },
                        { scale: draggable.scale },
                      ],
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <TouchableOpacity
                    onPress={() => handleStickerStyleCycle(draggable.sticker.id)}
                    onLongPress={() => handleRemoveSticker(draggable.sticker.id)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.stickerContent}>
                      <Text style={styles.stickerEmoji}>{config.emoji}</Text>
                      <Text style={[
                        styles.stickerLabel,
                        style !== 'filled' && styles.stickerLabelLight
                      ]}>{config.label}</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>

        <View style={styles.controlsContainer}>
          {renderTemplateCarousel()}
          {renderToggleChips()}

          <TouchableOpacity
            style={[styles.addStickerButton, { backgroundColor: theme.card, borderColor: theme.border }]}
            onPress={() => setShowStickerTray(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.addStickerEmoji}>🏷️</Text>
            <Text style={[styles.addStickerText, { color: theme.text }]}>Tambah Sticker</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.watermarkToggle, { borderColor: theme.border }]}
            onPress={() => handleToggle('showWatermark')}
            activeOpacity={0.7}
          >
            <View style={[
              styles.watermarkCheckbox,
              settings.showWatermark && styles.watermarkCheckboxActive
            ]}>
              {settings.showWatermark && <Text style={styles.checkmark}>✓</Text>}
            </View>
            <Text style={[styles.watermarkText, { color: theme.textSecondary }]}>
              Tampilkan watermark DietKu
            </Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.shareActions, { paddingBottom: insets.bottom + 16 }]}>
          <TouchableOpacity
            style={styles.primaryShareButton}
            onPress={handleShareInstagram}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={['#833AB4', '#E1306C', '#F77737']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.instagramGradient}
            >
              <Instagram size={20} color="#FFFFFF" />
              <Text style={styles.primaryShareText}>Share to Instagram</Text>
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.secondaryActions}>
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={handleSaveImage}
              activeOpacity={0.7}
            >
              <Download size={18} color={theme.text} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <Link2 size={18} color={theme.text} />
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.secondaryButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={handleShare}
              activeOpacity={0.7}
            >
              <MoreHorizontal size={18} color={theme.text} />
            </TouchableOpacity>
          </View>
        </View>

        {showStickerTray && renderStickerTray()}
        {renderLocationModal()}
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  headerRight: {
    width: 40,
  },
  previewContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  cardWrapper: {
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 20,
  },
  controlsContainer: {
    paddingHorizontal: 16,
    gap: 12,
  },
  templateSection: {
    marginBottom: 4,
  },
  templateList: {
    paddingHorizontal: 4,
    gap: 12,
  },
  templateItem: {
    alignItems: 'center',
    padding: 8,
    borderRadius: 16,
    borderWidth: 2,
    width: 72,
  },
  templateItemActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  templatePreview: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  templateEmoji: {
    fontSize: 22,
  },
  templateName: {
    fontSize: 11,
    fontWeight: '600' as const,
  },
  toggleSection: {
    marginBottom: 4,
  },
  toggleList: {
    paddingHorizontal: 4,
    gap: 8,
  },
  toggleChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  toggleChipActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  toggleChipText: {
    fontSize: 13,
    fontWeight: '500' as const,
  },
  addStickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  addStickerEmoji: {
    fontSize: 16,
  },
  addStickerText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  watermarkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  watermarkCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkCheckboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  watermarkText: {
    fontSize: 13,
  },
  shareActions: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 12,
  },
  primaryShareButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  instagramGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
  },
  primaryShareText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  secondaryActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  secondaryButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  stickerTray: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    paddingTop: 16,
    paddingBottom: 32,
  },
  stickerTrayHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  stickerTrayTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
  stickerList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  stickerOption: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    width: 80,
  },
  stickerOptionEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  stickerOptionLabel: {
    fontSize: 10,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  draggableSticker: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 16,
    zIndex: 100,
  },
  stickerFilled: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  stickerOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  stickerBlurred: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  stickerSelected: {
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  stickerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stickerEmoji: {
    fontSize: 14,
  },
  stickerLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  stickerLabelLight: {
    color: '#FFFFFF',
  },
  locationOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
  },
  locationBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  locationModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  locationModalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    marginBottom: 20,
    textAlign: 'center',
  },
  locationPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  locationPreset: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  locationPresetText: {
    fontSize: 14,
    fontWeight: '500' as const,
  },
  locationCustom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  locationCustomText: {
    fontSize: 14,
  },
});
