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
  MapPin,
  Check,
  ChevronRight,
  Clock,
  Heart,
  Utensils,
  User,
  Navigation,
  Edit3,
  MessageCircle,
  Link,
  Share2,
  Image as ImageIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useTheme } from '@/contexts/ThemeContext';
import {
  StoryShareData,
  IncludeOptions,
  HealthRating,
  HEALTH_RATINGS,
} from '@/types/storyShare';
import { LOCATION_PRESETS } from '@/constants/storyShare';
import { ANIMATION_DURATION, SPRING_CONFIG } from '@/constants/animations';

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

  const [customMealName, setCustomMealName] = useState(storyData.mealName);
  const [isEditingName, setIsEditingName] = useState(false);
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
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const locationSheetAnim = useRef(new Animated.Value(0)).current;
  const shareSheetAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: ANIMATION_DURATION.slow,
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
      ...SPRING_CONFIG.default,
    }).start();
  };

  const closeLocationSheet = () => {
    Animated.timing(locationSheetAnim, {
      toValue: 0,
      duration: ANIMATION_DURATION.standard,
      useNativeDriver: true,
    }).start(() => {
      setShowLocationSheet(false);
    });
  };

  const openShareSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowShareSheet(true);
    Animated.spring(shareSheetAnim, {
      toValue: 1,
      useNativeDriver: true,
      ...SPRING_CONFIG.default,
    }).start();
  };

  const closeShareSheet = () => {
    Animated.timing(shareSheetAnim, {
      toValue: 0,
      duration: ANIMATION_DURATION.standard,
      useNativeDriver: true,
    }).start(() => {
      setShowShareSheet(false);
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
    
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: ANIMATION_DURATION.standard,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.95,
        duration: ANIMATION_DURATION.standard,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)');
      }
    });
  };

  const handleShareInstagram = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      const healthInfo = HEALTH_RATINGS.find(r => r.id === healthRating);
      let message = `${customMealName} - ${storyData.calories} kcal 🔥`;
      if (includeOptions.macros) {
        message += `\n💪 ${storyData.protein}g protein • 🍞 ${storyData.carbs}g carbs • 🥑 ${storyData.fat}g fat`;
      }
      if (includeOptions.healthRating && healthInfo) {
        message += `\n${healthInfo.icon} ${healthInfo.label}`;
      }
      if (includeOptions.location && locationName) {
        message += `\n📍 ${locationName}`;
      }
      if (showWatermark) {
        message += '\n\nTracked with DietKu';
      }
      
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
        message: `${customMealName} - ${storyData.calories} kcal 🔥${showWatermark ? '\n\nTracked with DietKu' : ''}`,
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

  const renderShareSheet = () => {
    if (!showShareSheet) return null;

    return (
      <View style={styles.sheetOverlay}>
        <TouchableOpacity
          style={styles.sheetBackdrop}
          onPress={closeShareSheet}
          activeOpacity={1}
        />
        <Animated.View
          style={[
            styles.shareSheet,
            {
              transform: [{
                translateY: shareSheetAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [400, 0],
                }),
              }],
            },
          ]}
        >
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetTitle}>Share to</Text>

          <View style={styles.shareGrid}>
            <TouchableOpacity style={styles.shareAppItem} onPress={() => { closeShareSheet(); handleShareInstagram(); }}>
              <LinearGradient
                colors={['#833AB4', '#E1306C', '#F77737']}
                style={styles.shareAppIcon}
              >
                <Text style={styles.shareAppEmoji}>📸</Text>
              </LinearGradient>
              <Text style={styles.shareAppLabel}>Instagram{"\n"}Story</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareAppItem} onPress={() => { closeShareSheet(); handleShareInstagram(); }}>
              <LinearGradient
                colors={['#833AB4', '#E1306C', '#F77737']}
                style={styles.shareAppIcon}
              >
                <MessageCircle size={24} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.shareAppLabel}>Instagram{"\n"}Messages</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareAppItem} onPress={() => { closeShareSheet(); handleMoreOptions(); }}>
              <View style={[styles.shareAppIcon, { backgroundColor: '#25D366' }]}>
                <Text style={styles.shareAppEmoji}>💬</Text>
              </View>
              <Text style={styles.shareAppLabel}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareAppItem} onPress={() => { closeShareSheet(); handleMoreOptions(); }}>
              <View style={[styles.shareAppIcon, { backgroundColor: '#34C759' }]}>
                <MessageCircle size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareAppLabel}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareAppItem} onPress={() => { closeShareSheet(); handleSaveImage(); }}>
              <View style={[styles.shareAppIcon, styles.shareAppIconOutline]}>
                <ImageIcon size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareAppLabel}>Save{"\n"}Image</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareAppItem} onPress={() => { closeShareSheet(); handleMoreOptions(); }}>
              <View style={[styles.shareAppIcon, styles.shareAppIconOutline]}>
                <Link size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareAppLabel}>Copy{"\n"}Link</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareAppItem} onPress={() => { closeShareSheet(); handleMoreOptions(); }}>
              <View style={[styles.shareAppIcon, styles.shareAppIconOutline]}>
                <Share2 size={24} color="#FFFFFF" />
              </View>
              <Text style={styles.shareAppLabel}>More</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    );
  };

  const hasAnyPills = includeOptions.healthRating && currentHealthRating;

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

      {(includeOptions.location && locationName) || includeOptions.time ? (
        <View style={styles.topInfoContainer}>
          {includeOptions.time && (
            <View style={styles.topInfoPill}>
              <Text style={styles.topInfoText}>🕐 {formatTime(storyData.timestamp)}</Text>
            </View>
          )}
          {includeOptions.location && locationName && (
            <View style={styles.topInfoPill}>
              <Text style={styles.topInfoText}>📍 {locationName}</Text>
            </View>
          )}
        </View>
      ) : null}

      <View style={[
        styles.previewContent,
        !includeOptions.name && !includeOptions.macros && !hasAnyPills && styles.previewContentMinimal
      ]}>
        {includeOptions.name && (
          <Text style={[
            styles.previewMealName,
            !includeOptions.macros && !hasAnyPills && styles.previewMealNameLarge
          ]}>
            {customMealName}
          </Text>
        )}

        <View style={styles.caloriesBlock}>
          <Text style={[
            styles.previewCalories,
            !includeOptions.name && !includeOptions.macros && styles.previewCaloriesHero
          ]}>
            {storyData.calories}
            <Text style={styles.previewCaloriesUnit}> kcal</Text>
          </Text>
          
          {showWatermark && (
            <View style={styles.trackedByContainer}>
              <Text style={styles.trackedByText}>
                Tracked with <Text style={styles.trackedByBrand}>DietKu</Text>
              </Text>
            </View>
          )}
        </View>

        {includeOptions.macros && (
          <View style={[
            styles.macroChips,
            !hasAnyPills && styles.macroChipsSpaced
          ]}>
            <View style={styles.macroChip}>
              <Text style={styles.macroChipText}>💪 {storyData.protein}g</Text>
            </View>
            <View style={styles.macroChip}>
              <Text style={styles.macroChipText}>🍞 {storyData.carbs}g</Text>
            </View>
            <View style={styles.macroChip}>
              <Text style={styles.macroChipText}>🥑 {storyData.fat}g</Text>
            </View>
          </View>
        )}

        {hasAnyPills && (
          <View style={styles.previewPills}>
            {includeOptions.healthRating && currentHealthRating && (
              <View style={[styles.previewPill, { backgroundColor: `${currentHealthRating.color}20` }]}>
                <Text style={styles.previewPillText}>
                  {currentHealthRating.icon} {currentHealthRating.label}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>
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
      
      <TouchableOpacity
        style={styles.toggleRow}
        onPress={() => toggleOption('name')}
        activeOpacity={0.7}
      >
        <View style={styles.toggleLeft}>
          <View style={[styles.toggleIcon, includeOptions.name && styles.toggleIconActive]}>
            <User size={18} color={includeOptions.name ? '#FFFFFF' : '#666'} />
          </View>
          <View style={styles.toggleTextContainer}>
            <Text style={styles.toggleLabel}>Meal Name</Text>
            {isEditingName ? (
              <TextInput
                style={styles.nameEditInput}
                value={customMealName}
                onChangeText={setCustomMealName}
                onBlur={() => setIsEditingName(false)}
                onSubmitEditing={() => setIsEditingName(false)}
                autoFocus
                placeholder="Enter meal name"
                placeholderTextColor="#666"
              />
            ) : (
              <TouchableOpacity 
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setIsEditingName(true);
                }}
                style={styles.nameEditTouchable}
              >
                <Text style={styles.toggleSubtitle}>{customMealName}</Text>
                <Edit3 size={12} color="#10B981" style={styles.editIcon} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <View style={[styles.toggleCheck, includeOptions.name && styles.toggleCheckActive]}>
          {includeOptions.name && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
        </View>
      </TouchableOpacity>
      
      {renderToggleRow(
        'macros',
        <Utensils size={18} color={includeOptions.macros ? '#FFFFFF' : '#666'} />,
        'Macros',
        `${storyData.protein}g P • ${storyData.carbs}g C • ${storyData.fat}g F`,
        undefined,
        true
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
        },
        true
      )}
      
      {renderToggleRow(
        'time',
        <Clock size={18} color={includeOptions.time ? '#FFFFFF' : '#666'} />,
        'Time',
        formatTime(storyData.timestamp),
        undefined,
        true
      )}

      <TouchableOpacity
        style={styles.watermarkRow}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setShowWatermark(!showWatermark);
        }}
        activeOpacity={0.7}
      >
        <Text style={styles.watermarkLabel}>Show Tracked with DietKu</Text>
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
            onPress={async () => {
              try {
                setIsLoadingLocation(true);
                
                if (Platform.OS === 'web') {
                  // Web geolocation
                  if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(
                      async (position) => {
                        const { latitude, longitude } = position.coords;
                        try {
                          const response = await fetch(
                            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
                          );
                          const data = await response.json();
                          const locationStr = data.address?.city || data.address?.town || data.address?.village || data.display_name?.split(',')[0] || 'Current Location';
                          selectLocation(locationStr);
                        } catch {
                          selectLocation('Current Location');
                        }
                        setIsLoadingLocation(false);
                      },
                      (error) => {
                        console.log('Web location error:', error);
                        Alert.alert('Location Error', 'Unable to get your location. Please enable location access.');
                        setIsLoadingLocation(false);
                      }
                    );
                  } else {
                    Alert.alert('Location Error', 'Location is not supported on this browser.');
                    setIsLoadingLocation(false);
                  }
                } else {
                  // Native location with expo-location
                  const { status } = await Location.requestForegroundPermissionsAsync();
                  
                  if (status !== 'granted') {
                    Alert.alert(
                      'Location Permission Required',
                      'Please allow location access to use this feature.',
                      [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
                      ]
                    );
                    setIsLoadingLocation(false);
                    return;
                  }
                  
                  const location = await Location.getCurrentPositionAsync({
                    accuracy: Location.Accuracy.Balanced,
                  });
                  
                  const [address] = await Location.reverseGeocodeAsync({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                  });
                  
                  if (address) {
                    const locationStr = address.city || address.subregion || address.region || address.district || 'Current Location';
                    selectLocation(locationStr);
                  } else {
                    selectLocation('Current Location');
                  }
                  setIsLoadingLocation(false);
                }
                
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              } catch (error) {
                console.log('Location error:', error);
                Alert.alert('Location Error', 'Unable to get your location. Please try again.');
                setIsLoadingLocation(false);
              }
            }}
            activeOpacity={0.7}
            disabled={isLoadingLocation}
          >
            <View style={styles.locationOptionIcon}>
              <Navigation size={20} color="#10B981" />
            </View>
            <Text style={styles.locationOptionText}>
              {isLoadingLocation ? 'Getting location...' : 'Use current location'}
            </Text>
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

        <Animated.View style={[styles.header, { paddingTop: insets.top + 8, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={handleClose}
            activeOpacity={0.7}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Share Story</Text>
          <TouchableOpacity
            style={styles.headerShareButton}
            onPress={openShareSheet}
            activeOpacity={0.7}
          >
            <Share2 size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </Animated.View>

        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
          <ScrollView
            style={styles.scrollContent}
            contentContainerStyle={[styles.scrollContentContainer, { paddingBottom: insets.bottom + 40 }]}
            showsVerticalScrollIndicator={false}
          >
            {renderPreview()}

            {renderIncludePanel()}
          </ScrollView>
        </Animated.View>

        {renderLocationSheet()}
        {renderShareSheet()}
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
    paddingHorizontal: 20,
  },
  previewContainer: {
    aspectRatio: 9 / 16,
    width: SCREEN_WIDTH - 80,
    alignSelf: 'center',
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1a1a2e',
    marginBottom: 24,
  },
  headerShareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topInfoContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  topInfoPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  topInfoText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  previewGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  previewContent: {
    position: 'absolute',
    bottom: 40,
    left: 20,
    right: 20,
  },
  previewContentMinimal: {
    bottom: 60,
    alignItems: 'center',
  },
  previewMealName: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
    flexWrap: 'wrap',
  },
  previewMealNameLarge: {
    fontSize: 32,
    marginBottom: 8,
  },
  caloriesBlock: {
    marginBottom: 12,
  },
  previewCalories: {
    fontSize: 52,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  previewCaloriesHero: {
    fontSize: 64,
  },
  trackedByContainer: {
    marginTop: 4,
  },
  trackedByText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  trackedByBrand: {
    fontWeight: '700' as const,
    color: '#10B981',
  },
  previewCaloriesUnit: {
    fontSize: 24,
    fontWeight: '500' as const,
  },
  macroChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  macroChipsSpaced: {
    marginBottom: 0,
  },
  macroChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
  toggleTextContainer: {
    flex: 1,
    flexShrink: 1,
  },
  nameEditInput: {
    fontSize: 13,
    color: '#10B981',
    marginTop: 2,
    paddingVertical: 4,
    paddingHorizontal: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#10B981',
  },
  nameEditTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  editIcon: {
    marginLeft: 6,
  },
  includePanel: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
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
    flexShrink: 1,
    flexWrap: 'wrap',
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
  shareSheet: {
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
  shareGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  shareAppItem: {
    alignItems: 'center',
    width: (SCREEN_WIDTH - 40 - 48) / 4,
  },
  shareAppIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  shareAppIconOutline: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  shareAppEmoji: {
    fontSize: 24,
  },
  shareAppLabel: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: '#999',
    textAlign: 'center' as const,
    lineHeight: 14,
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
