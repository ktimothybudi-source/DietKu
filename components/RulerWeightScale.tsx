import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';

interface RulerWeightScaleProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  step?: number;
}

export default function RulerWeightScale({
  value,
  onChange,
  min,
  max,
  unit,
  step = 0.5,
}: RulerWeightScaleProps) {
  const [, setIsDragging] = useState(false);
  const scrollOffset = useRef(0);
  const lastHapticValue = useRef(value);
  const velocityX = useRef(0);

  const normalizeValue = (val: number) => {
    // Snap to step and clamp to range
    const snapped = Math.round(val / step) * step;
    return Math.max(min, Math.min(max, snapped));
  };

  const panResponder = useRef(
  PanResponder.create({
    // Don't capture taps
    onStartShouldSetPanResponder: () => false,
    // Capture only when there's movement
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 2; // threshold so tiny jitters don't count
    },
    onPanResponderGrant: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      scrollOffset.current = 0;
      velocityX.current = 0;
    },
    onPanResponderMove: (_, gestureState) => {
      velocityX.current = gestureState.vx;
      const sensitivity = 0.08;
      const delta = -gestureState.dx * sensitivity; // inverted direction
      const newValue = normalizeValue(value + delta * step);

      if (newValue !== value) {
        onChange(newValue);

        if (Math.abs(newValue - lastHapticValue.current) >= step) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          lastHapticValue.current = newValue;
        }
      }
    },
    onPanResponderRelease: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const inertia = -velocityX.current * 15;
      const finalValue = normalizeValue(value + inertia);
      if (finalValue !== value) {
        onChange(finalValue);
      }
    },
  })
).current;

  const renderTicks = () => {
    const ticks = [];
    const visibleRange = 20;
    const tickSpacing = 20;

    const startValue = Math.max(min, value - visibleRange / 2);
    const endValue = Math.min(max, value + visibleRange / 2);

    for (let i = startValue; i <= endValue; i += step) {
      // Flip offset so higher values render to the LEFT
      const offset = (i - value) * tickSpacing;
      const distance = Math.abs(i - value);
      const opacity = Math.max(0.15, 1 - distance / 12);
      const isMajor = i % 5 === 0;

      ticks.push(
        <View
          key={i}
          style={[
            styles.tickContainer,
            { transform: [{ translateX: offset }], opacity },
          ]}
        >
          <View style={[styles.tick, isMajor ? styles.tickMajor : styles.tickMinor]} />
          {isMajor && <Text style={styles.tickLabel}>{i}</Text>}
        </View>
      );
    }

    return ticks;
  };

  return (
    <View style={styles.container}>
      <View style={styles.valueDisplay}>
        <Text style={styles.valueText}>{value.toFixed(1)}</Text>
        <Text style={styles.unitText}>{unit}</Text>
      </View>

      <View style={styles.rulerContainer} {...panResponder.panHandlers}>
        <View style={styles.indicator}>
          <View style={styles.indicatorLine} />
          <View style={styles.indicatorTriangle} />
        </View>

        <View style={styles.ticksContainer}>{renderTicks()}</View>
      </View>
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
    marginBottom: 40,
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
  rulerContainer: {
    width: '100%',
    height: 120,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicator: {
    position: 'absolute',
    zIndex: 10,
    alignItems: 'center',
  },
  indicatorLine: {
    width: 3,
    height: 50,
    backgroundColor: '#6C63FF',
    borderRadius: 2,
  },
  indicatorTriangle: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#6C63FF',
    marginTop: -1,
  },
  ticksContainer: {
    width: '100%',
    height: 80,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    position: 'relative',
  },
  tickContainer: {
    position: 'absolute',
    alignItems: 'center',
    gap: 8,
  },
  tick: {
    backgroundColor: '#2A2A2A',
    width: 2,
  },
  tickMinor: {
    height: 25,
  },
  tickMajor: {
    height: 40,
    backgroundColor: '#3A3A3A',
    width: 3,
  },
  tickLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
});
