import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Svg, Path, Circle, G } from 'react-native-svg';

interface ArcScaleProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  step?: number;
}

export default function ArcScale({ value, onChange, min, max, unit, step = 1 }: ArcScaleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const rotationAnim = useRef(new Animated.Value(0)).current;
  const lastHapticValue = useRef(value);

  const normalizeValue = (val: number) => {
    return Math.max(min, Math.min(max, Math.round(val / step) * step));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, gestureState) => {
        const sensitivity = 0.3;
        const delta = gestureState.dx * sensitivity;
        const newValue = normalizeValue(value + delta * step);
        
        if (newValue !== value && newValue >= min && newValue <= max) {
          onChange(newValue);
          
          if (Math.abs(newValue - lastHapticValue.current) >= step) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            lastHapticValue.current = newValue;
          }
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        setIsDragging(false);
        
        const velocity = -gestureState.vx;
        const inertiaDistance = velocity * 20;
        const finalValue = normalizeValue(value + inertiaDistance * step);
        
        if (finalValue !== value) {
          Animated.spring(rotationAnim, {
            toValue: 0,
            useNativeDriver: true,
            tension: 50,
            friction: 7,
          }).start();
          onChange(finalValue);
        }
      },
    })
  ).current;

  const renderArcTicks = () => {
    const ticks = [];
    const totalTicks = 40;
    const radius = 140;
    const centerX = 175;
    const centerY = 200;
    const startAngle = -135;
    const endAngle = 135;
    const angleRange = endAngle - startAngle;

    for (let i = 0; i <= totalTicks; i++) {
      const angle = startAngle + (angleRange * i) / totalTicks;
      const radian = (angle * Math.PI) / 180;
      
      const isMajorTick = i % 5 === 0;
      const tickLength = isMajorTick ? 20 : 12;
      const tickWidth = isMajorTick ? 3 : 2;
      const tickOpacity = isMajorTick ? 0.6 : 0.3;
      
      const x1 = centerX + radius * Math.cos(radian);
      const y1 = centerY + radius * Math.sin(radian);
      const x2 = centerX + (radius - tickLength) * Math.cos(radian);
      const y2 = centerY + (radius - tickLength) * Math.sin(radian);

      ticks.push(
        <Path
          key={i}
          d={`M ${x1} ${y1} L ${x2} ${y2}`}
          stroke="#10B981"
          strokeWidth={tickWidth}
          opacity={tickOpacity}
          strokeLinecap="round"
        />
      );
    }

    return ticks;
  };

  const renderIndicator = () => {
    const radius = 140;
    const centerX = 175;
    const centerY = 200;
    const angle = 0;
    const radian = (angle * Math.PI) / 180;
    
    const x = centerX + (radius - 10) * Math.cos(radian);
    const y = centerY + (radius - 10) * Math.sin(radian);

    return (
      <G>
        <Circle
          cx={x}
          cy={y}
          r={10}
          fill="#10B981"
        />
        <Circle
          cx={x}
          cy={y}
          r={5}
          fill="#0A0A0A"
        />
      </G>
    );
  };

  const rotation = ((value - min) / (max - min)) * 270 - 135;

  return (
    <View style={styles.container}>
      <View style={styles.valueDisplay}>
        <Text style={styles.valueText}>{value}</Text>
        <Text style={styles.unitText}>{unit}</Text>
      </View>

      <View style={styles.arcContainer} {...panResponder.panHandlers}>
        <Svg width={350} height={250} viewBox="0 0 350 250">
          <G rotation={rotation} origin="175, 200">
            {renderArcTicks()}
          </G>
          {renderIndicator()}
        </Svg>
      </View>

      <View style={styles.rangeDisplay}>
        <Text style={styles.rangeText}>{min}</Text>
        <Text style={styles.rangeText}>{max}</Text>
      </View>

      {isDragging && (
        <View style={styles.dragHint}>
          <View style={styles.dragHintDot} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  valueDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 20,
  },
  valueText: {
    fontSize: 64,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  unitText: {
    fontSize: 32,
    fontWeight: '600' as const,
    color: '#666',
  },
  arcContainer: {
    width: 350,
    height: 250,
  },
  rangeDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: 280,
    marginTop: 10,
  },
  rangeText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
  dragHint: {
    position: 'absolute',
    top: 40,
    right: 20,
  },
  dragHintDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
  },
});
