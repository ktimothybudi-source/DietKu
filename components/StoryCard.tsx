import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  StoryShareData, 
  StoryShareSettings, 
  StorySticker,
  WeeklyRecapData 
} from '@/types/storyShare';
import { HEALTH_RATING_CONFIG, STICKER_CONFIG, MEAL_TIME_LABELS } from '@/constants/storyShare';

interface StoryCardProps {
  data: StoryShareData;
  settings: StoryShareSettings;
  weeklyData?: WeeklyRecapData;
  userName?: string;
  scale?: number;
}

const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;

export default function StoryCard({ 
  data, 
  settings, 
  weeklyData,
  userName,
  scale = 0.18 
}: StoryCardProps) {
  const getMealTimeLabel = () => {
    const hour = new Date(data.timestamp).getHours();
    if (hour >= 5 && hour < 11) return MEAL_TIME_LABELS.breakfast;
    if (hour >= 11 && hour < 16) return MEAL_TIME_LABELS.lunch;
    if (hour >= 16 && hour < 21) return MEAL_TIME_LABELS.dinner;
    return MEAL_TIME_LABELS.snack;
  };

  const getTimeString = () => {
    return new Date(data.timestamp).toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const renderSticker = (sticker: StorySticker) => {
    const config = STICKER_CONFIG[sticker.type];
    const stickerStyles = [
      styles.sticker,
      sticker.style === 'filled' && styles.stickerFilled,
      sticker.style === 'outline' && styles.stickerOutline,
      sticker.style === 'blurred' && styles.stickerBlurred,
    ];

    return (
      <View
        key={sticker.id}
        style={[
          stickerStyles,
          {
            position: 'absolute',
            left: sticker.x * scale,
            top: sticker.y * scale,
            transform: [{ scale: sticker.scale * scale }],
          },
        ]}
      >
        <Text style={styles.stickerEmoji}>{config.emoji}</Text>
        <Text style={styles.stickerLabel}>{config.label}</Text>
      </View>
    );
  };

  const renderMinimalTemplate = () => (
    <View style={[styles.card, { width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }]}>
      {data.photoUri ? (
        <Image source={{ uri: data.photoUri }} style={styles.backgroundImage} />
      ) : (
        <View style={styles.placeholderBg} />
      )}
      
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.5, 1]}
        style={styles.gradient}
      />

      <View style={styles.contentContainer}>
        {settings.showTime && (
          <View style={styles.timeContainer}>
            <Text style={styles.mealTimeLabel}>{getMealTimeLabel()}</Text>
            <Text style={styles.timeText}>{getTimeString()}</Text>
          </View>
        )}

        {settings.showUserName && userName && (
          <Text style={styles.userGreeting}>{userName}&apos;s meal</Text>
        )}

        <View style={styles.mainContent}>
          <Text style={styles.mealName} numberOfLines={2}>{data.mealName}</Text>
          {data.mealSubtitle && (
            <Text style={styles.mealSubtitle} numberOfLines={1}>{data.mealSubtitle}</Text>
          )}
          
          <Text style={styles.caloriesLarge}>{data.calories}</Text>
          <Text style={styles.caloriesLabel}>kcal</Text>

          {settings.showMacros && (
            <View style={styles.macroChips}>
              <View style={styles.macroChip}>
                <Text style={styles.macroValue}>{data.protein}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroDivider} />
              <View style={styles.macroChip}>
                <Text style={styles.macroValue}>{data.carbs}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroDivider} />
              <View style={styles.macroChip}>
                <Text style={styles.macroValue}>{data.fat}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>
          )}

          {settings.showHealthRating && (
            <View style={[
              styles.healthPill,
              { backgroundColor: HEALTH_RATING_CONFIG[settings.healthRating].bgColor }
            ]}>
              <Text style={[
                styles.healthPillText,
                { color: HEALTH_RATING_CONFIG[settings.healthRating].color }
              ]}>
                {HEALTH_RATING_CONFIG[settings.healthRating].label}
              </Text>
            </View>
          )}

          {settings.showLocation && settings.location && (
            <View style={styles.locationPill}>
              <Text style={styles.locationText}>📍 {settings.location}</Text>
            </View>
          )}
        </View>

        {settings.showWatermark && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>DietKu</Text>
          </View>
        )}
      </View>

      {settings.stickers.map(renderSticker)}
    </View>
  );

  const renderHealthHeroTemplate = () => (
    <View style={[styles.card, { width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }]}>
      {data.photoUri ? (
        <Image source={{ uri: data.photoUri }} style={styles.backgroundImage} />
      ) : (
        <View style={styles.placeholderBg} />
      )}
      
      <LinearGradient
        colors={['rgba(0,0,0,0.4)', 'rgba(0,0,0,0.2)', 'rgba(0,0,0,0.8)']}
        locations={[0, 0.4, 1]}
        style={styles.gradient}
      />

      <View style={styles.contentContainer}>
        <View style={styles.healthHeroTop}>
          {settings.showHealthRating && (
            <View style={[
              styles.healthPillLarge,
              { backgroundColor: HEALTH_RATING_CONFIG[settings.healthRating].bgColor }
            ]}>
              <Text style={[
                styles.healthPillTextLarge,
                { color: HEALTH_RATING_CONFIG[settings.healthRating].color }
              ]}>
                {HEALTH_RATING_CONFIG[settings.healthRating].label}
              </Text>
            </View>
          )}
          <Text style={styles.healthScoreLabel}>Skor Kesehatan</Text>
        </View>

        <View style={styles.mainContent}>
          <Text style={styles.mealNameMedium} numberOfLines={2}>{data.mealName}</Text>
          
          <Text style={styles.caloriesMedium}>{data.calories} kcal</Text>

          {settings.showMacros && (
            <View style={styles.macroRow}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValueMedium}>{data.protein}g</Text>
                <Text style={styles.macroLabelSmall}>P</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValueMedium}>{data.carbs}g</Text>
                <Text style={styles.macroLabelSmall}>C</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValueMedium}>{data.fat}g</Text>
                <Text style={styles.macroLabelSmall}>F</Text>
              </View>
            </View>
          )}

          {settings.showTime && (
            <Text style={styles.timeSmall}>{getMealTimeLabel()} • {getTimeString()}</Text>
          )}
        </View>

        {settings.showWatermark && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>DietKu</Text>
          </View>
        )}
      </View>

      {settings.stickers.map(renderSticker)}
    </View>
  );

  const renderRestaurantTemplate = () => (
    <View style={[styles.card, { width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }]}>
      {data.photoUri ? (
        <Image source={{ uri: data.photoUri }} style={styles.backgroundImage} />
      ) : (
        <View style={styles.placeholderBg} />
      )}
      
      <LinearGradient
        colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.85)']}
        locations={[0, 0.35, 1]}
        style={styles.gradient}
      />

      <View style={styles.contentContainer}>
        <View style={styles.restaurantTop}>
          {settings.showLocation && settings.location && (
            <View style={styles.locationPillLarge}>
              <Text style={styles.locationIcon}>📍</Text>
              <Text style={styles.locationTextLarge}>{settings.location}</Text>
            </View>
          )}
          {settings.showTime && (
            <Text style={styles.timeTopSmall}>{getMealTimeLabel()}</Text>
          )}
        </View>

        <View style={styles.mainContent}>
          <Text style={styles.mealNameSmall} numberOfLines={2}>{data.mealName}</Text>
          {data.mealSubtitle && (
            <Text style={styles.mealSubtitleSmall} numberOfLines={1}>{data.mealSubtitle}</Text>
          )}
          
          <View style={styles.caloriesRow}>
            <Text style={styles.caloriesMedium}>{data.calories}</Text>
            <Text style={styles.caloriesUnitMedium}>kcal</Text>
          </View>

          {settings.showMacros && (
            <View style={styles.macroChipsSmall}>
              <View style={styles.macroChipSmall}>
                <Text style={styles.macroValueSmall}>{data.protein}g P</Text>
              </View>
              <View style={styles.macroChipSmall}>
                <Text style={styles.macroValueSmall}>{data.carbs}g C</Text>
              </View>
              <View style={styles.macroChipSmall}>
                <Text style={styles.macroValueSmall}>{data.fat}g F</Text>
              </View>
            </View>
          )}

          {settings.showHealthRating && (
            <View style={[
              styles.healthPillSmall,
              { backgroundColor: HEALTH_RATING_CONFIG[settings.healthRating].bgColor }
            ]}>
              <Text style={[
                styles.healthPillTextSmall,
                { color: HEALTH_RATING_CONFIG[settings.healthRating].color }
              ]}>
                {HEALTH_RATING_CONFIG[settings.healthRating].label}
              </Text>
            </View>
          )}
        </View>

        {settings.showWatermark && (
          <View style={styles.watermark}>
            <Text style={styles.watermarkText}>DietKu</Text>
          </View>
        )}
      </View>

      {settings.stickers.map(renderSticker)}
    </View>
  );

  const renderWeeklyRecapTemplate = () => (
    <View style={[styles.card, styles.weeklyCard, { width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }]}>
      <LinearGradient
        colors={['#1a1a2e', '#16213e', '#0f3460']}
        style={styles.weeklyGradient}
      />

      <View style={styles.contentContainer}>
        <View style={styles.weeklyHeader}>
          <Text style={styles.weeklyTitle}>Ringkasan Mingguan</Text>
          <Text style={styles.weeklySubtitle}>DietKu</Text>
        </View>

        <View style={styles.weeklyStats}>
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatValue}>{weeklyData?.avgCalories || data.calories}</Text>
            <Text style={styles.weeklyStatLabel}>Rata-rata kcal/hari</Text>
          </View>
          
          <View style={styles.weeklyStatDivider} />
          
          <View style={styles.weeklyStat}>
            <Text style={styles.weeklyStatValue}>{weeklyData?.avgProtein || data.protein}g</Text>
            <Text style={styles.weeklyStatLabel}>Rata-rata Protein</Text>
          </View>
        </View>

        <View style={styles.weeklyBadges}>
          {weeklyData?.streakDays && weeklyData.streakDays > 0 && (
            <View style={styles.weeklyBadge}>
              <Text style={styles.weeklyBadgeEmoji}>🔥</Text>
              <Text style={styles.weeklyBadgeValue}>{weeklyData.streakDays}</Text>
              <Text style={styles.weeklyBadgeLabel}>Hari Beruntun</Text>
            </View>
          )}
          {weeklyData?.totalMeals && (
            <View style={styles.weeklyBadge}>
              <Text style={styles.weeklyBadgeEmoji}>🍽️</Text>
              <Text style={styles.weeklyBadgeValue}>{weeklyData.totalMeals}</Text>
              <Text style={styles.weeklyBadgeLabel}>Total Makanan</Text>
            </View>
          )}
        </View>

        {settings.showWatermark && (
          <View style={styles.watermarkWeekly}>
            <Text style={styles.watermarkTextWeekly}>DietKu</Text>
          </View>
        )}
      </View>

      {settings.stickers.map(renderSticker)}
    </View>
  );

  switch (settings.template) {
    case 'health_hero':
      return renderHealthHeroTemplate();
    case 'restaurant':
      return renderRestaurantTemplate();
    case 'weekly_recap':
      return renderWeeklyRecapTemplate();
    default:
      return renderMinimalTemplate();
  }
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  weeklyCard: {
    backgroundColor: '#1a1a2e',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
    width: '100%',
    height: '100%',
  },
  placeholderBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
  },
  gradient: {
    ...StyleSheet.absoluteFillObject,
  },
  weeklyGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  contentContainer: {
    flex: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  timeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mealTimeLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: 'rgba(255,255,255,0.9)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  timeText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
  },
  userGreeting: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  mainContent: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  mealName: {
    fontSize: 32,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
    lineHeight: 38,
  },
  mealNameMedium: {
    fontSize: 26,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 32,
  },
  mealNameSmall: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
    lineHeight: 28,
  },
  mealSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
  },
  mealSubtitleSmall: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 12,
  },
  caloriesLarge: {
    fontSize: 72,
    fontWeight: '800' as const,
    color: '#FFFFFF',
    lineHeight: 80,
  },
  caloriesLabel: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: 20,
    marginTop: -8,
  },
  caloriesMedium: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  caloriesRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginBottom: 12,
  },
  caloriesUnitMedium: {
    fontSize: 18,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.7)',
  },
  macroChips: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  macroChip: {
    flex: 1,
    alignItems: 'center',
  },
  macroDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  macroLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 2,
  },
  macroRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 12,
  },
  macroItem: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  macroValueMedium: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  macroLabelSmall: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
  },
  macroChipsSmall: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  macroChipSmall: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  macroValueSmall: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  healthPill: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginBottom: 12,
  },
  healthPillText: {
    fontSize: 14,
    fontWeight: '600' as const,
  },
  healthPillLarge: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 32,
  },
  healthPillTextLarge: {
    fontSize: 24,
    fontWeight: '700' as const,
  },
  healthPillSmall: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  healthPillTextSmall: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  locationPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  locationText: {
    fontSize: 13,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
  locationPillLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 20,
  },
  locationIcon: {
    fontSize: 18,
  },
  locationTextLarge: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  watermark: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    opacity: 0.25,
  },
  watermarkText: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 1,
  },
  watermarkWeekly: {
    alignSelf: 'center',
    opacity: 0.3,
    marginTop: 24,
  },
  watermarkTextWeekly: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  healthHeroTop: {
    alignItems: 'center',
    paddingTop: 40,
  },
  healthScoreLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  timeSmall: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
  },
  restaurantTop: {
    alignItems: 'center',
    paddingTop: 20,
  },
  timeTopSmall: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  weeklyHeader: {
    alignItems: 'center',
    paddingTop: 40,
  },
  weeklyTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  weeklySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  weeklyStats: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 40,
    paddingHorizontal: 20,
  },
  weeklyStat: {
    flex: 1,
    alignItems: 'center',
  },
  weeklyStatDivider: {
    width: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 20,
  },
  weeklyStatValue: {
    fontSize: 42,
    fontWeight: '800' as const,
    color: '#FFFFFF',
  },
  weeklyStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
    textAlign: 'center',
  },
  weeklyBadges: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 40,
  },
  weeklyBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  weeklyBadgeEmoji: {
    fontSize: 28,
    marginBottom: 8,
  },
  weeklyBadgeValue: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  weeklyBadgeLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  sticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
  },
  stickerFilled: {
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  stickerOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.8)',
  },
  stickerBlurred: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  stickerEmoji: {
    fontSize: 16,
  },
  stickerLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
});
