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
  Dimensions,
  Image,
  TextInput,
  KeyboardAvoidingView,
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
  Undo2,
  Redo2,
  Type,
  Sticker,
  AlignLeft,
  AlignCenter,
  AlignRight,
  MapPin,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/contexts/ThemeContext';
import { useNutrition } from '@/contexts/NutritionContext';
import {
  CanvasElement,
  StoryShareData,
  StickerType,
  StickerCategory,
} from '@/types/storyShare';
import {
  STICKER_CATEGORIES,
  STICKER_CONFIG,
  TEXT_STYLES,
  COLOR_OPTIONS,
} from '@/constants/storyShare';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CANVAS_SCALE = SCREEN_WIDTH / 1080;

interface DraggableElement {
  element: CanvasElement;
  pan: Animated.ValueXY;
  scale: Animated.Value;
}

export default function StoryShareScreen() {
  useTheme();
  const insets = useSafeAreaInsets();
  useNutrition();
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

  const [elements, setElements] = useState<DraggableElement[]>([]);
  const [history, setHistory] = useState<CanvasElement[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [showStickerTray, setShowStickerTray] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<StickerCategory>('macros');
  const [showWatermark, setShowWatermark] = useState(true);
  const [newTextContent, setNewTextContent] = useState('');
  const [selectedTextStyle, setSelectedTextStyle] = useState('default');
  const [selectedColor, setSelectedColor] = useState('#FFFFFF');
  const [textAlignment, setTextAlignment] = useState<'left' | 'center' | 'right'>('center');
  const [showLocationInput, setShowLocationInput] = useState(false);
  const [locationText, setLocationText] = useState('');
  const [showCenterGuide, setShowCenterGuide] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const stickerTrayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const mealName = storyData.mealName;
    const calories = storyData.calories;
    
    const initialElements: CanvasElement[] = [
      {
        id: 'meal_name_default',
        type: 'meal_name',
        x: 540,
        y: 1400,
        scale: 1,
        rotation: 0,
        style: 'filled',
        content: mealName,
      },
      {
        id: 'calories_default',
        type: 'calories',
        x: 540,
        y: 1520,
        scale: 1,
        rotation: 0,
        style: 'filled',
        content: `${calories} kcal`,
      },
    ];

    const draggables = initialElements.map(el => ({
      element: el,
      pan: new Animated.ValueXY({ x: el.x * CANVAS_SCALE, y: el.y * CANVAS_SCALE }),
      scale: new Animated.Value(el.scale),
    }));

    setElements(draggables);
    setHistory([initialElements]);
    setHistoryIndex(0);

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveToHistory = useCallback((newElements: CanvasElement[]) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newElements);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  const handleUndo = () => {
    if (historyIndex > 0) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prevElements = history[historyIndex - 1];
      const draggables = prevElements.map(el => ({
        element: el,
        pan: new Animated.ValueXY({ x: el.x * CANVAS_SCALE, y: el.y * CANVAS_SCALE }),
        scale: new Animated.Value(el.scale),
      }));
      setElements(draggables);
      setHistoryIndex(historyIndex - 1);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const nextElements = history[historyIndex + 1];
      const draggables = nextElements.map(el => ({
        element: el,
        pan: new Animated.ValueXY({ x: el.x * CANVAS_SCALE, y: el.y * CANVAS_SCALE }),
        scale: new Animated.Value(el.scale),
      }));
      setElements(draggables);
      setHistoryIndex(historyIndex + 1);
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

  const toggleStickerTray = (show: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowStickerTray(show);
    setShowTextEditor(false);
    Animated.spring(stickerTrayAnim, {
      toValue: show ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const toggleTextEditor = (show: boolean) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowTextEditor(show);
    setShowStickerTray(false);
    setNewTextContent('');
  };

  const handleAddSticker = (type: StickerType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (type === 'add_location') {
      setShowLocationInput(true);
      toggleStickerTray(false);
      return;
    }

    const config = STICKER_CONFIG[type];
    let content = config.label;
    
    if (type === 'protein') content = `${storyData.protein}g Protein`;
    if (type === 'carbs') content = `${storyData.carbs}g Carbs`;
    if (type === 'fat') content = `${storyData.fat}g Fat`;

    const newElement: CanvasElement = {
      id: Date.now().toString(),
      type: 'sticker',
      x: 540,
      y: 800,
      scale: 1,
      rotation: 0,
      style: 'filled',
      stickerType: type,
      content,
    };

    const draggable: DraggableElement = {
      element: newElement,
      pan: new Animated.ValueXY({ x: newElement.x * CANVAS_SCALE, y: newElement.y * CANVAS_SCALE }),
      scale: new Animated.Value(1),
    };

    setElements(prev => [...prev, draggable]);
    saveToHistory([...elements.map(e => e.element), newElement]);
    toggleStickerTray(false);
  };

  const handleAddText = () => {
    if (!newTextContent.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newElement: CanvasElement = {
      id: Date.now().toString(),
      type: 'text',
      x: 540,
      y: 960,
      scale: 1,
      rotation: 0,
      style: 'filled',
      content: newTextContent,
      fontStyle: selectedTextStyle as 'default' | 'bold' | 'light',
      color: selectedColor,
    };

    const draggable: DraggableElement = {
      element: newElement,
      pan: new Animated.ValueXY({ x: newElement.x * CANVAS_SCALE, y: newElement.y * CANVAS_SCALE }),
      scale: new Animated.Value(1),
    };

    setElements(prev => [...prev, draggable]);
    saveToHistory([...elements.map(e => e.element), newElement]);
    toggleTextEditor(false);
  };

  const handleAddLocation = () => {
    if (!locationText.trim()) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const newElement: CanvasElement = {
      id: Date.now().toString(),
      type: 'sticker',
      x: 540,
      y: 800,
      scale: 1,
      rotation: 0,
      style: 'filled',
      stickerType: 'add_location',
      content: locationText,
    };

    const draggable: DraggableElement = {
      element: newElement,
      pan: new Animated.ValueXY({ x: newElement.x * CANVAS_SCALE, y: newElement.y * CANVAS_SCALE }),
      scale: new Animated.Value(1),
    };

    setElements(prev => [...prev, draggable]);
    saveToHistory([...elements.map(e => e.element), newElement]);
    setShowLocationInput(false);
    setLocationText('');
  };

  const handleElementStyleCycle = (elementId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const styleOptions: ('filled' | 'outline' | 'blur')[] = ['filled', 'outline', 'blur'];
    
    setElements(prev => prev.map(d => {
      if (d.element.id === elementId) {
        const currentIndex = styleOptions.indexOf(d.element.style);
        const nextIndex = (currentIndex + 1) % styleOptions.length;
        return {
          ...d,
          element: { ...d.element, style: styleOptions[nextIndex] },
        };
      }
      return d;
    }));
  };

  const handleRemoveElement = (elementId: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    const newElements = elements.filter(d => d.element.id !== elementId);
    setElements(newElements);
    saveToHistory(newElements.map(e => e.element));
    setSelectedElementId(null);
  };

  const createPanResponder = useCallback((draggable: DraggableElement) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setSelectedElementId(draggable.element.id);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        draggable.pan.setOffset({
          x: (draggable.pan.x as any)._value,
          y: (draggable.pan.y as any)._value,
        });
        draggable.pan.setValue({ x: 0, y: 0 });
        Animated.spring(draggable.scale, {
          toValue: 1.05,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderMove: (_, gestureState) => {
        draggable.pan.setValue({ x: gestureState.dx, y: gestureState.dy });
        
        const currentX = (draggable.pan.x as any)._offset + gestureState.dx;
        const centerX = SCREEN_WIDTH / 2;
        const threshold = 10;
        
        if (Math.abs(currentX - centerX) < threshold) {
          setShowCenterGuide(true);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } else {
          setShowCenterGuide(false);
        }
      },
      onPanResponderRelease: () => {
        draggable.pan.flattenOffset();
        setShowCenterGuide(false);
        Animated.spring(draggable.scale, {
          toValue: 1,
          useNativeDriver: true,
        }).start();
        
        const currentX = (draggable.pan.x as any)._value;
        const centerX = SCREEN_WIDTH / 2;
        const threshold = 15;
        
        if (Math.abs(currentX - centerX) < threshold) {
          Animated.spring(draggable.pan.x, {
            toValue: centerX,
            useNativeDriver: false,
          }).start();
        }
      },
    });
  }, []);

  const handleShareInstagram = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await Share.share({
        message: `${storyData.mealName} - ${storyData.calories} kcal 🔥\n\nTracked with DietKu`,
      });
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

  const renderCanvasElement = (draggable: DraggableElement) => {
    const panResponder = createPanResponder(draggable);
    const { element } = draggable;
    const isSelected = selectedElementId === element.id;

    const getElementStyle = () => {
      if (element.style === 'filled') {
        return styles.elementFilled;
      } else if (element.style === 'outline') {
        return styles.elementOutline;
      } else {
        return styles.elementBlur;
      }
    };

    const renderContent = () => {
      if (element.type === 'meal_name') {
        return (
          <Text style={[styles.mealNameText, element.style !== 'filled' && styles.textLight]}>
            {element.content}
          </Text>
        );
      }
      
      if (element.type === 'calories') {
        return (
          <Text style={[styles.caloriesText, element.style !== 'filled' && styles.textLight]}>
            {element.content}
          </Text>
        );
      }
      
      if (element.type === 'sticker' && element.stickerType) {
        const config = STICKER_CONFIG[element.stickerType];
        return (
          <View style={styles.stickerInner}>
            <Text style={styles.stickerIcon}>{config.icon}</Text>
            <Text style={[
              styles.stickerText,
              element.style !== 'filled' && styles.textLight,
            ]}>
              {element.content || config.label}
            </Text>
          </View>
        );
      }
      
      if (element.type === 'text') {
        const fontWeight = element.fontStyle === 'bold' ? 'bold' : element.fontStyle === 'light' ? '300' : 'normal';
        return (
          <Text style={[
            styles.customText,
            { color: element.color || '#FFFFFF', fontWeight: fontWeight as any },
          ]}>
            {element.content}
          </Text>
        );
      }
      
      return null;
    };

    return (
      <Animated.View
        key={element.id}
        style={[
          styles.canvasElement,
          getElementStyle(),
          isSelected && styles.elementSelected,
          {
            transform: [
              { translateX: Animated.subtract(draggable.pan.x, SCREEN_WIDTH / 2) },
              { translateY: draggable.pan.y },
              { scale: draggable.scale },
            ],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          onPress={() => handleElementStyleCycle(element.id)}
          onLongPress={() => handleRemoveElement(element.id)}
          activeOpacity={0.9}
          delayLongPress={500}
        >
          {renderContent()}
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderStickerTray = () => (
    <Animated.View
      style={[
        styles.bottomSheet,
        {
          transform: [{
            translateY: stickerTrayAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [400, 0],
            }),
          }],
          opacity: stickerTrayAnim,
        },
      ]}
    >
      <View style={styles.sheetHandle} />
      
      <View style={styles.sheetHeader}>
        <Text style={styles.sheetTitle}>Stickers</Text>
        <TouchableOpacity onPress={() => toggleStickerTray(false)}>
          <X size={22} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryTabs}
        contentContainerStyle={styles.categoryTabsContent}
      >
        {STICKER_CATEGORIES.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryTab,
              selectedCategory === cat.id && styles.categoryTabActive,
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Text style={[
              styles.categoryTabText,
              selectedCategory === cat.id && styles.categoryTabTextActive,
            ]}>
              {cat.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.stickerGrid}
      >
        {STICKER_CATEGORIES.find(c => c.id === selectedCategory)?.stickers.map(type => {
          const config = STICKER_CONFIG[type];
          return (
            <TouchableOpacity
              key={type}
              style={[styles.stickerItem, { backgroundColor: config.bgColor }]}
              onPress={() => handleAddSticker(type)}
              activeOpacity={0.7}
            >
              <Text style={styles.stickerItemIcon}>{config.icon}</Text>
              <Text style={[styles.stickerItemLabel, { color: config.color }]}>
                {config.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </Animated.View>
  );

  const renderTextEditor = () => {
    if (!showTextEditor) return null;

    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.textEditorOverlay}
      >
        <TouchableOpacity
          style={styles.textEditorBackdrop}
          onPress={() => toggleTextEditor(false)}
          activeOpacity={1}
        />
        <View style={styles.textEditorSheet}>
          <View style={styles.sheetHandle} />
          
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add Text</Text>
            <TouchableOpacity onPress={handleAddText}>
              <Text style={styles.doneButton}>Done</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.textInput}
            placeholder="Type something..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={newTextContent}
            onChangeText={setNewTextContent}
            multiline
            autoFocus
          />

          <View style={styles.textOptions}>
            <View style={styles.fontStyles}>
              {TEXT_STYLES.map(style => (
                <TouchableOpacity
                  key={style.id}
                  style={[
                    styles.fontStyleBtn,
                    selectedTextStyle === style.id && styles.fontStyleBtnActive,
                  ]}
                  onPress={() => setSelectedTextStyle(style.id)}
                >
                  <Text style={[
                    styles.fontStyleText,
                    { fontWeight: style.fontWeight },
                    selectedTextStyle === style.id && styles.fontStyleTextActive,
                  ]}>
                    Aa
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.colorOptions}>
              {COLOR_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.id}
                  style={[
                    styles.colorBtn,
                    { backgroundColor: opt.color },
                    selectedColor === opt.color && styles.colorBtnActive,
                  ]}
                  onPress={() => setSelectedColor(opt.color)}
                />
              ))}
            </View>

            <View style={styles.alignOptions}>
              <TouchableOpacity
                style={[styles.alignBtn, textAlignment === 'left' && styles.alignBtnActive]}
                onPress={() => setTextAlignment('left')}
              >
                <AlignLeft size={18} color={textAlignment === 'left' ? '#10B981' : '#666'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alignBtn, textAlignment === 'center' && styles.alignBtnActive]}
                onPress={() => setTextAlignment('center')}
              >
                <AlignCenter size={18} color={textAlignment === 'center' ? '#10B981' : '#666'} />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.alignBtn, textAlignment === 'right' && styles.alignBtnActive]}
                onPress={() => setTextAlignment('right')}
              >
                <AlignRight size={18} color={textAlignment === 'right' ? '#10B981' : '#666'} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    );
  };

  const renderLocationInput = () => {
    if (!showLocationInput) return null;

    const presets = ['Homemade', 'Restaurant', 'Cafe', 'Office', 'Gym'];

    return (
      <View style={styles.locationOverlay}>
        <TouchableOpacity
          style={styles.locationBackdrop}
          onPress={() => setShowLocationInput(false)}
          activeOpacity={1}
        />
        <View style={styles.locationSheet}>
          <View style={styles.sheetHandle} />
          
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>Add Location</Text>
            <TouchableOpacity onPress={handleAddLocation}>
              <Text style={styles.doneButton}>Add</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.locationInputRow}>
            <MapPin size={20} color="#EC4899" />
            <TextInput
              style={styles.locationInput}
              placeholder="Enter location..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={locationText}
              onChangeText={setLocationText}
              autoFocus
            />
          </View>

          <View style={styles.locationPresets}>
            {presets.map(preset => (
              <TouchableOpacity
                key={preset}
                style={styles.locationPreset}
                onPress={() => setLocationText(preset)}
              >
                <Text style={styles.locationPresetText}>{preset}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      
      <View style={styles.container}>
        {storyData.photoUri ? (
          <Image
            source={{ uri: storyData.photoUri }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        ) : (
          <LinearGradient
            colors={['#1a1a2e', '#16213e', '#0f0f23']}
            style={StyleSheet.absoluteFill}
          />
        )}
        
        <LinearGradient
          colors={['rgba(0,0,0,0.4)', 'transparent', 'rgba(0,0,0,0.7)']}
          locations={[0, 0.3, 1]}
          style={styles.gradientOverlay}
        />

        {showCenterGuide && (
          <View style={styles.centerGuide} pointerEvents="none" />
        )}

        <Animated.View style={[styles.topBar, { paddingTop: insets.top + 8, opacity: fadeAnim }]}>
          <TouchableOpacity 
            style={styles.iconButton} 
            onPress={handleClose}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <X size={24} color="#FFFFFF" />
          </TouchableOpacity>
          
          <View style={styles.historyButtons}>
            <TouchableOpacity
              style={[styles.iconButton, historyIndex <= 0 && styles.iconButtonDisabled]}
              onPress={handleUndo}
              disabled={historyIndex <= 0}
            >
              <Undo2 size={22} color={historyIndex > 0 ? '#FFFFFF' : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.iconButton, historyIndex >= history.length - 1 && styles.iconButtonDisabled]}
              onPress={handleRedo}
              disabled={historyIndex >= history.length - 1}
            >
              <Redo2 size={22} color={historyIndex < history.length - 1 ? '#FFFFFF' : 'rgba(255,255,255,0.3)'} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        <View style={styles.canvas}>
          {elements.map(renderCanvasElement)}
        </View>

        {showWatermark && (
          <View style={[styles.watermark, { bottom: insets.bottom + 140 }]}>
            <Text style={styles.watermarkText}>DietKu</Text>
          </View>
        )}

        <Animated.View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, opacity: fadeAnim }]}>
          <View style={styles.toolButtons}>
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => toggleStickerTray(true)}
            >
              <Sticker size={22} color="#FFFFFF" />
              <Text style={styles.toolButtonText}>Sticker</Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={styles.toolButton}
              onPress={() => toggleTextEditor(true)}
            >
              <Type size={22} color="#FFFFFF" />
              <Text style={styles.toolButtonText}>Text</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.shareRow}>
            <TouchableOpacity style={styles.shareButton} onPress={handleShareInstagram}>
              <LinearGradient
                colors={['#833AB4', '#E1306C', '#F77737']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shareGradient}
              >
                <Instagram size={20} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>Share to Instagram</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.secondaryRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleSaveImage}>
              <Download size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={handleShare}>
              <MoreHorizontal size={20} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.watermarkToggle}
              onPress={() => setShowWatermark(!showWatermark)}
            >
              <View style={[styles.checkbox, showWatermark && styles.checkboxActive]}>
                {showWatermark && <Text style={styles.checkmark}>✓</Text>}
              </View>
              <Text style={styles.watermarkToggleText}>Watermark</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {showStickerTray && renderStickerTray()}
        {renderTextEditor()}
        {renderLocationInput()}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  backgroundImage: {
    ...StyleSheet.absoluteFillObject,
  },
  gradientOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  centerGuide: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2 - 1,
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: 'rgba(16, 185, 129, 0.6)',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 1000,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonDisabled: {
    opacity: 0.5,
  },
  historyButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  canvas: {
    flex: 1,
    alignItems: 'center',
  },
  canvasElement: {
    position: 'absolute',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    zIndex: 10,
  },
  elementFilled: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  elementOutline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  elementBlur: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  elementSelected: {
    borderWidth: 2,
    borderColor: '#10B981',
    borderStyle: 'dashed',
  },
  mealNameText: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#1a1a2e',
    textAlign: 'center',
  },
  caloriesText: {
    fontSize: 36,
    fontWeight: '800' as const,
    color: '#1a1a2e',
    textAlign: 'center',
  },
  textLight: {
    color: '#FFFFFF',
  },
  stickerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stickerIcon: {
    fontSize: 18,
  },
  stickerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#1a1a2e',
  },
  customText: {
    fontSize: 20,
    textAlign: 'center',
  },
  watermark: {
    position: 'absolute',
    right: 20,
    opacity: 0.25,
  },
  watermarkText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    gap: 12,
    zIndex: 1000,
  },
  toolButtons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
  },
  toolButton: {
    alignItems: 'center',
    gap: 4,
  },
  toolButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
  shareRow: {
    marginTop: 8,
  },
  shareButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  shareGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
  },
  shareButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  secondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  secondaryBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 8,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  checkmark: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '700' as const,
  },
  watermarkToggleText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20,20,30,0.95)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    zIndex: 200,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  doneButton: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#10B981',
  },
  categoryTabs: {
    marginBottom: 16,
  },
  categoryTabsContent: {
    paddingHorizontal: 20,
    gap: 8,
  },
  categoryTab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  categoryTabActive: {
    backgroundColor: '#10B981',
  },
  categoryTabText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: 'rgba(255,255,255,0.6)',
  },
  categoryTabTextActive: {
    color: '#FFFFFF',
  },
  stickerGrid: {
    paddingHorizontal: 20,
    gap: 12,
  },
  stickerItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    minWidth: 100,
  },
  stickerItemIcon: {
    fontSize: 28,
    marginBottom: 6,
  },
  stickerItemLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  textEditorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
  },
  textEditorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  textEditorSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20,20,30,0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  textInput: {
    fontSize: 18,
    color: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  textOptions: {
    paddingHorizontal: 20,
    gap: 16,
  },
  fontStyles: {
    flexDirection: 'row',
    gap: 12,
  },
  fontStyleBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fontStyleBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  fontStyleText: {
    fontSize: 18,
    color: '#FFFFFF',
  },
  fontStyleTextActive: {
    color: '#10B981',
  },
  colorOptions: {
    flexDirection: 'row',
    gap: 12,
  },
  colorBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorBtnActive: {
    borderColor: '#10B981',
    borderWidth: 3,
  },
  alignOptions: {
    flexDirection: 'row',
    gap: 8,
  },
  alignBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  alignBtnActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
  },
  locationOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 300,
  },
  locationBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  locationSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(20,20,30,0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
  },
  locationInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 16,
  },
  locationInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
  },
  locationPresets: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  locationPreset: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  locationPresetText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500' as const,
  },
});
