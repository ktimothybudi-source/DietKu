import { CameraView, useCameraPermissions } from 'expo-camera';
import React, { useMemo, useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Modal,
  Pressable,
  Linking,
  Animated,
} from 'react-native';
import { Stack, router } from 'expo-router';
import { X, HelpCircle, Zap, ZapOff, ImageIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNutrition } from '@/contexts/NutritionContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type FlashMode = 'off' | 'auto' | 'on';

export default function CameraScanScreen() {
  const insets = useSafeAreaInsets();
  const { addPendingEntry } = useNutrition();

  const cameraRef = useRef<CameraView>(null);

  const [permission, requestPermission] = useCameraPermissions();

  const [flashMode, setFlashMode] = useState<FlashMode>('off');
  const [helpOpen, setHelpOpen] = useState(false);
  const [showHelper, setShowHelper] = useState(false);

  const logo = useMemo(() => require('@/assets/images/icon.png'), []);

  const shutterScale = useRef(new Animated.Value(1)).current;
  const cornerPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    checkHelperText();
    startCornerPulse();
  }, []);

  const checkHelperText = async () => {
    try {
      const seen = await AsyncStorage.getItem('camera_helper_seen');
      if (!seen) {
        setShowHelper(true);
        await AsyncStorage.setItem('camera_helper_seen', 'true');
        setTimeout(() => setShowHelper(false), 4000);
      }
    } catch {
      // no-op
    }
  };

  const startCornerPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(cornerPulse, {
          toValue: 1.08,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(cornerPulse, {
          toValue: 1,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

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

  const handleTakePhoto = async () => {
    const ok = await ensureCameraPermission();
    if (!ok) return;

    if (!cameraRef.current) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    Animated.sequence([
      Animated.timing(shutterScale, {
        toValue: 0.92,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(shutterScale, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      });

      if (!photo?.uri || !photo.base64) {
        console.error('No photo or base64 returned from camera');
        return;
      }

      addPendingEntry(photo.uri, photo.base64);
      router.back();
    } catch (error) {
      console.error(error);
    }
  };

  const handleGalleryPick = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.uri && asset.base64) {
          addPendingEntry(asset.uri, asset.base64);
          router.back();
        }
      }
    } catch (error) {
      console.error('Gallery picker error:', error);
    }
  };

  const cycleFlash = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFlashMode((prev) => (prev === 'off' ? 'auto' : prev === 'auto' ? 'on' : 'off'));
  };

  // ---------------- CAMERA SCREEN ----------------
  {
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
              {showHelper && (
                <Text style={styles.helperText}>Posisikan makanan di dalam area</Text>
              )}
              <View style={styles.focusFrame}>
                <Animated.View 
                  style={[
                    styles.corner, 
                    styles.tl,
                    { transform: [{ scale: cornerPulse }] }
                  ]} 
                />
                <Animated.View 
                  style={[
                    styles.corner, 
                    styles.tr,
                    { transform: [{ scale: cornerPulse }] }
                  ]} 
                />
                <Animated.View 
                  style={[
                    styles.corner, 
                    styles.bl,
                    { transform: [{ scale: cornerPulse }] }
                  ]} 
                />
                <Animated.View 
                  style={[
                    styles.corner, 
                    styles.br,
                    { transform: [{ scale: cornerPulse }] }
                  ]} 
                />
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
                <View style={flashMode !== 'off' ? styles.flashGlow : undefined}>
                  {flashMode === 'off' ? (
                    <ZapOff size={22} color="rgba(255,255,255,0.75)" strokeWidth={1.5} />
                  ) : (
                    <Zap size={22} color="#FFFFFF" strokeWidth={2} fill={flashMode === 'on' ? '#FFFFFF' : 'transparent'} />
                  )}
                </View>
              </TouchableOpacity>

              <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
                <TouchableOpacity
                  style={[styles.shutterOuter, !granted && { opacity: 0.55 }]}
                  onPress={handleTakePhoto}
                  activeOpacity={0.9}
                  disabled={!granted}
                >
                  <View style={styles.shutterInner} />
                </TouchableOpacity>
              </Animated.View>

              <TouchableOpacity
                style={styles.galleryButton}
                onPress={handleGalleryPick}
                activeOpacity={0.9}
              >
                <ImageIcon size={22} color="rgba(255,255,255,0.75)" strokeWidth={1.5} />
              </TouchableOpacity>
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
}

const FOCUS_SIZE = 288;
const CORNER = 36;
const STROKE = 2;

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
    width: 48,
    height: 48,
    borderRadius: 24,
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
    fontWeight: '900' as const,
    letterSpacing: 0.2,
  },
  focusFrameWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helperText: {
    position: 'absolute',
    top: '45%',
    color: 'rgba(255,255,255,0.60)',
    fontSize: 13,
    fontWeight: '500' as const,
    textAlign: 'center',
    marginBottom: 16,
  },
  focusFrame: {
    width: FOCUS_SIZE,
    height: FOCUS_SIZE,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: 'rgba(255,255,255,0.90)',
  },
  tl: {
    left: 0,
    top: 0,
    borderLeftWidth: STROKE,
    borderTopWidth: STROKE,
    borderTopLeftRadius: 12,
  },
  tr: {
    right: 0,
    top: 0,
    borderRightWidth: STROKE,
    borderTopWidth: STROKE,
    borderTopRightRadius: 12,
  },
  bl: {
    left: 0,
    bottom: 0,
    borderLeftWidth: STROKE,
    borderBottomWidth: STROKE,
    borderBottomLeftRadius: 12,
  },
  br: {
    right: 0,
    bottom: 0,
    borderRightWidth: STROKE,
    borderBottomWidth: STROKE,
    borderBottomRightRadius: 12,
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
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  flashGlow: {
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  galleryButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,0,0,0.40)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  shutterOuter: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 7,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  shutterInner: {
    width: '100%',
    height: '100%',
    borderRadius: 40,
    backgroundColor: '#FFFFFF',
    borderWidth: 3,
    borderColor: '#000000',
  },
  permissionPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#0A0A0A',
  },
  permissionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900' as const,
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
    fontWeight: '900' as const,
  },
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
    fontWeight: '900' as const,
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
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
    fontWeight: '900' as const,
  },
});
