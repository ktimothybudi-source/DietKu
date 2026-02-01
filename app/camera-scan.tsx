import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  ScrollView,
  Modal,
  Pressable,
  Linking,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { X, HelpCircle, Zap, ZapOff, MoreVertical, Share2, Bookmark, Plus, Minus } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { analyzeMealPhoto } from '@/utils/photoAnalysis';
import { MealAnalysis } from '@/types/nutrition';
import { useNutrition } from '@/contexts/NutritionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ScreenState = 'camera' | 'analyzing' | 'results';
type FlashMode = 'off' | 'auto' | 'on';

export default function CameraScanScreen() {
  const insets = useSafeAreaInsets();
  const { addFoodEntry } = useNutrition();

  const [screenState, setScreenState] = useState<ScreenState>('camera');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<MealAnalysis | null>(null);
  const [servings, setServings] = useState(1);

  const scrollViewRef = useRef<ScrollView>(null);
  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();

  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [helpOpen, setHelpOpen] = useState(false);

  const logo = useMemo(() => require('@/assets/images/icon.png'), []);

  const ensureCameraPermission = async () => {
    if (permission?.granted) return true;
    const res = await requestPermission();
    return !!res?.granted;
  };

  const openSettings = async () => {
    try {
      await Linking.openSettings();
    } catch {
      // no-op
    }
  };

  const analyzeBase64 = async (base64: string) => {
    setAnalysis(null);
    setScreenState('analyzing');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await analyzeMealPhoto(base64);
      setAnalysis(result);
      setScreenState('results');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Photo analysis error:', error);
      setScreenState('camera');
    }
  };

  const handleTakePhoto = async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;

    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      });

      if (!photo?.uri) return;

      setPhotoUri(photo.uri);

      if (!photo.base64) {
        console.error('No base64 returned from camera');
        setScreenState('camera');
        return;
      }

      await analyzeBase64(photo.base64);
    } catch (error) {
      console.error(error);
      setScreenState('camera');
    }
  };

  const cycleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlashMode((prev) => (prev === 'off' ? 'auto' : prev === 'auto' ? 'on' : 'off'));
  };

  const handleDone = () => {
    if (!analysis) return;

    const avgCalories =
      Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2) * servings;
    const avgProtein =
      Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2) * servings;

    const avgCarbs =
      analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0) * servings;

    const avgFat =
      analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0) * servings;

    const foodNames = analysis.items.map((item) => item.name).join(', ');

    addFoodEntry({
      name: foodNames,
      calories: Math.round(avgCalories),
      protein: Math.round(avgProtein),
      carbs: Math.round(avgCarbs),
      fat: Math.round(avgFat),
    });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    router.back();
  };

  // ---------------- CAMERA SCREEN ----------------
  if (screenState === 'camera') {
    const granted = !!permission?.granted;
    const canAsk = permission?.status !== 'denied';

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />

        <View style={styles.cameraRoot}>
          {granted ? (
            <CameraView
              ref={cameraRef}
              style={StyleSheet.absoluteFill}
              facing="back"
              flash={flashMode as any}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.permissionPlaceholder]}>
              <Text style={styles.permissionTitle}>Kamera butuh izin</Text>
              <Text style={styles.permissionSub}>
                {permission?.status === 'denied'
                  ? 'Izin kamera ditolak. Aktifkan dari Settings.'
                  : 'Izinkan kamera untuk memindai makanan.'}
              </Text>

              <View style={{ height: 18 }} />

              {canAsk ? (
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={async () => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    await requestPermission();
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={styles.permissionButtonText}>Izinkan</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.permissionButton}
                  onPress={openSettings}
                  activeOpacity={0.9}
                >
                  <Text style={styles.permissionButtonText}>Buka Settings</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Overlay */}
          <View style={styles.overlay}>
            {/* Top header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.back();
                }}
                activeOpacity={0.9}
              >
                <X size={26} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.brandPill}>
                <Image source={logo} style={styles.brandLogo} />
                <Text style={styles.brandTitle}>DietKu</Text>
              </View>

              <TouchableOpacity
                style={styles.headerIconButton}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setHelpOpen(true);
                }}
                activeOpacity={0.9}
              >
                <HelpCircle size={26} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Focus frame */}
            <View pointerEvents="none" style={styles.focusFrameWrap}>
              <View style={styles.focusFrame}>
                <View style={[styles.corner, styles.tl]} />
                <View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} />
                <View style={[styles.corner, styles.br]} />
              </View>
            </View>

            {/* Bottom controls */}
            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 18 }]}>
              <TouchableOpacity
                style={styles.flashButton}
                onPress={cycleFlash}
                activeOpacity={0.9}
                disabled={!granted}
              >
                {flashMode === 'off' ? (
                  <ZapOff size={28} color="#FFFFFF" />
                ) : (
                  <Zap size={28} color="#FFFFFF" />
                )}
                <Text style={styles.flashLabel}>
                  {flashMode === 'off' ? 'Off' : flashMode === 'auto' ? 'Auto' : 'On'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.shutterOuter, !granted && { opacity: 0.55 }]}
                onPress={handleTakePhoto}
                activeOpacity={0.9}
                disabled={!granted}
              >
                <View style={styles.shutterInner} />
              </TouchableOpacity>

              {/* Spacer to keep shutter centered */}
              <View style={{ width: 78 }} />
            </View>
          </View>

          {/* Help modal */}
          <Modal
            visible={helpOpen}
            transparent
            animationType="fade"
            onRequestClose={() => setHelpOpen(false)}
          >
            <Pressable style={styles.modalBackdrop} onPress={() => setHelpOpen(false)}>
              <Pressable style={styles.modalCard} onPress={() => {}}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Cara pakai kamera</Text>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={() => setHelpOpen(false)}
                    activeOpacity={0.9}
                  >
                    <X size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  <Text style={styles.modalBullet}>• Arahkan kamera ke makanan, usahakan penuh di frame.</Text>
                  <Text style={styles.modalBullet}>• Tekan tombol putih untuk ambil foto.</Text>
                  <Text style={styles.modalBullet}>• Gunakan Flash jika ruangan gelap.</Text>
                  <Text style={styles.modalBullet}>• Tips: cahaya cukup, foto tidak blur.</Text>
                </View>

                <View style={styles.modalFooter}>
                  <TouchableOpacity
                    style={styles.modalPrimary}
                    onPress={() => setHelpOpen(false)}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.modalPrimaryText}>Oke</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </Pressable>
          </Modal>
        </View>
      </>
    );
  }

  // ---------------- ANALYZING SCREEN ----------------
  if (screenState === 'analyzing') {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.analyzingContainer}>
          <ActivityIndicator size="large" color="#10B981" />
          <Text style={styles.analyzingText}>Menganalisis makanan Anda...</Text>
          <Text style={styles.analyzingSubtext}>Mohon tunggu</Text>
        </View>
      </>
    );
  }

  // ---------------- RESULTS SCREEN ----------------
  if (screenState === 'results' && photoUri) {
    if (!analysis) {
      return (
        <>
          <Stack.Screen options={{ headerShown: false }} />
          <View style={styles.resultsContainer}>
            <View style={[styles.resultsTopBar, { paddingTop: insets.top + 12 }]}>
              <TouchableOpacity style={styles.resultButton} onPress={() => router.back()} activeOpacity={0.9}>
                <X size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <Text style={styles.resultsTitle}>Nutrisi</Text>
              <View style={styles.resultButtonGroup} />
            </View>

            <View style={styles.resultsImageContainer}>
              <Image source={{ uri: photoUri }} style={styles.resultsImage} />
            </View>

            <View style={{ padding: 24 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '600' }}>
                Foto tersimpan, analisis belum dijalankan
              </Text>
              <Text style={{ color: '#888', marginTop: 8 }}>
                Coba ambil foto ulang.
              </Text>
            </View>
          </View>
        </>
      );
    }

    const avgCalories =
      Math.round((analysis.totalCaloriesMin + analysis.totalCaloriesMax) / 2) * servings;
    const avgProtein =
      Math.round((analysis.totalProteinMin + analysis.totalProteinMax) / 2) * servings;

    const avgCarbs =
      analysis.items.reduce((sum, item) => sum + (item.carbsMin + item.carbsMax) / 2, 0) * servings;

    const avgFat =
      analysis.items.reduce((sum, item) => sum + (item.fatMin + item.fatMax) / 2, 0) * servings;

    const currentTime = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    const mainFoodName = analysis.items.map((i) => i.name).join(' with ');

    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.resultsContainer}>
          <View style={[styles.resultsTopBar, { paddingTop: insets.top + 12 }]}>
            <TouchableOpacity
              style={styles.resultButton}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.back();
              }}
              activeOpacity={0.9}
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>

            <Text style={styles.resultsTitle}>Nutrisi</Text>

            <View style={styles.resultButtonGroup}>
              <TouchableOpacity style={styles.resultButton} activeOpacity={0.9}>
                <Share2 size={24} color="#FFFFFF" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.resultButton} activeOpacity={0.9}>
                <MoreVertical size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.resultsImageContainer}>
            <Image source={{ uri: photoUri }} style={styles.resultsImage} />
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.resultsContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}
          >
            <View style={styles.resultsCard}>
              <View style={styles.handleBar} />
              <View style={styles.timeRow}>
                <Bookmark size={20} color="#888" />
                <Text style={styles.timeText}>{currentTime}</Text>
              </View>

              <View style={styles.foodNameRow}>
                <Text style={styles.foodNameText}>{mainFoodName}</Text>
                <View style={styles.servingControls}>
                  <TouchableOpacity
                    style={styles.servingButton}
                    onPress={() => {
                      if (servings > 1) {
                        setServings(servings - 1);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      }
                    }}
                    activeOpacity={0.9}
                  >
                    <Minus size={20} color="#888" />
                  </TouchableOpacity>
                  <Text style={styles.servingText}>{servings}</Text>
                  <TouchableOpacity
                    style={styles.servingButton}
                    onPress={() => {
                      setServings(servings + 1);
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    }}
                    activeOpacity={0.9}
                  >
                    <Plus size={20} color="#888" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.caloriesSection}>
                <View style={styles.flameIcon}>
                  <Text style={styles.flameEmoji}>🔥</Text>
                </View>
                <View>
                  <Text style={styles.caloriesLabel}>Kalori</Text>
                  <Text style={styles.caloriesValue}>{avgCalories}</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.macroCardsContainer}>
                <View style={styles.macroCard}>
                  <Text style={styles.macroIcon}>🥩</Text>
                  <Text style={styles.macroLabel}>Protein</Text>
                  <Text style={styles.macroValue}>{Math.round(avgProtein)}g</Text>
                </View>

                <View style={styles.macroCard}>
                  <Text style={styles.macroIcon}>🌾</Text>
                  <Text style={styles.macroLabel}>Karbo</Text>
                  <Text style={styles.macroValue}>{Math.round(avgCarbs)}g</Text>
                </View>

                <View style={styles.macroCard}>
                  <Text style={styles.macroIcon}>🥑</Text>
                  <Text style={styles.macroLabel}>Lemak</Text>
                  <Text style={styles.macroValue}>{Math.round(avgFat)}g</Text>
                </View>
              </ScrollView>

              <View style={styles.paginationDots}>
                <View style={[styles.dot, styles.dotActive]} />
                <View style={styles.dot} />
              </View>

              <View style={styles.ingredientsSection}>
                <Text style={styles.ingredientsTitle}>Bahan</Text>
                <TouchableOpacity activeOpacity={0.9}>
                  <Text style={styles.addMoreText}>+ Tambah</Text>
                </TouchableOpacity>
              </View>

              {analysis.items.map((item, index) => (
                <View key={index} style={styles.ingredientItem}>
                  <View style={styles.ingredientInfo}>
                    <Text style={styles.ingredientName}>{item.name}</Text>
                    <Text style={styles.ingredientCalories}>
                      {Math.round(((item.caloriesMin + item.caloriesMax) / 2) * servings)} cal
                    </Text>
                  </View>
                  <Text style={styles.ingredientPortion}>{item.portion}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.resultsFooter, { paddingBottom: insets.bottom + 16 }]}>
            <TouchableOpacity
              style={styles.fixButton}
              onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
              activeOpacity={0.9}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.fixButtonText}>Perbaiki</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.doneButton} onPress={handleDone} activeOpacity={0.95}>
              <Text style={styles.doneButtonText}>Selesai</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  return null;
}

const FOCUS_SIZE = 230;
const CORNER = 34;
const STROKE = 3;

const styles = StyleSheet.create({
  cameraRoot: {
    flex: 1,
    backgroundColor: '#000000',
  },

  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },

  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  headerIconButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  brandPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.34)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  brandLogo: {
    width: 28,
    height: 28,
    borderRadius: 8,
    marginRight: 10,
  },

  brandTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 0.2,
  },

  focusFrameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  focusFrame: {
    width: FOCUS_SIZE,
    height: FOCUS_SIZE,
  },

  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: 'rgba(255,255,255,0.85)',
  },

  tl: {
    left: 0,
    top: 0,
    borderLeftWidth: STROKE,
    borderTopWidth: STROKE,
    borderTopLeftRadius: 10,
  },

  tr: {
    right: 0,
    top: 0,
    borderRightWidth: STROKE,
    borderTopWidth: STROKE,
    borderTopRightRadius: 10,
  },

  bl: {
    left: 0,
    bottom: 0,
    borderLeftWidth: STROKE,
    borderBottomWidth: STROKE,
    borderBottomLeftRadius: 10,
  },

  br: {
    right: 0,
    bottom: 0,
    borderRightWidth: STROKE,
    borderBottomWidth: STROKE,
    borderBottomRightRadius: 10,
  },

  bottomBar: {
    paddingHorizontal: 22,
    paddingTop: 12,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.10)',
  },

  flashButton: {
    width: 78,
    height: 78,
    borderRadius: 39,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },

  flashLabel: {
    marginTop: 4,
    fontSize: 11,
    color: 'rgba(255,255,255,0.85)',
    fontWeight: '800',
  },

  shutterOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(255,255,255,0.96)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
  },

  shutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderWidth: 3,
    borderColor: '#000000',
  },

  // Permission UI
  permissionPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0A0A0A',
  },

  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },

  permissionSub: {
    color: '#AAAAAA',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },

  permissionButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#10B981',
  },

  permissionButtonText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // Help modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
  },

  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#1F1F1F',
    overflow: 'hidden',
  },

  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#1F1F1F',
  },

  modalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  modalClose: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1B1B1B',
    alignItems: 'center',
    justifyContent: 'center',
  },

  modalBody: {
    padding: 16,
  },

  modalBullet: {
    color: '#DDDDDD',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },

  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1F1F1F',
  },

  modalPrimary: {
    backgroundColor: '#10B981',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },

  modalPrimaryText: {
    color: '#FFFFFF',
    fontWeight: '900',
  },

  // Existing screens (unchanged)
  analyzingContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  analyzingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  analyzingSubtext: {
    fontSize: 14,
    color: '#888',
    marginTop: 6,
  },

  resultsContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  resultsTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#0A0A0A',
  },
  resultsImageContainer: {
    height: 300,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 20,
    overflow: 'hidden',
  },
  resultsImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#1A1A1A',
  },
  resultButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultButtonGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  resultsContent: {
    flex: 1,
  },
  resultsCard: {
    backgroundColor: '#0A0A0A',
    paddingHorizontal: 24,
    paddingTop: 24,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: '#2A2A2A',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  timeText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  foodNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  foodNameText: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    lineHeight: 32,
  },
  servingControls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
    gap: 16,
  },
  servingButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  servingText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    minWidth: 24,
    textAlign: 'center',
  },
  caloriesSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 24,
  },
  flameIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  flameEmoji: {
    fontSize: 28,
  },
  caloriesLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  caloriesValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  macroCardsContainer: {
    marginBottom: 16,
  },
  macroCard: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    minWidth: 110,
    alignItems: 'center',
  },
  macroIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  macroLabel: {
    fontSize: 14,
    color: '#888',
    marginBottom: 4,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  paginationDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#2A2A2A',
  },
  dotActive: {
    backgroundColor: '#10B981',
  },
  ingredientsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  ingredientsTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  addMoreText: {
    fontSize: 16,
    color: '#888',
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1A1A1A',
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  ingredientCalories: {
    fontSize: 14,
    color: '#888',
  },
  ingredientPortion: {
    fontSize: 16,
    color: '#888',
  },
  resultsFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 16,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#1A1A1A',
  },
  fixButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  fixButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  doneButton: {
    flex: 2,
    paddingVertical: 16,
    borderRadius: 24,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
