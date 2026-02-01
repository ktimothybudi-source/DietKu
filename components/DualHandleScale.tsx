import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';

interface DualHandleScaleProps {
  currentWeight: number;
  desiredWeight: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit: string;
  step?: number;
}

export default function DualHandleScale({
  currentWeight,
  desiredWeight,
  onChange,
  min,
  max,
  unit,
  step = 1,
}: DualHandleScaleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastHapticValue = useRef(desiredWeight);

  const displayRange = 30;
  const displayMin = Math.max(min, currentWeight - displayRange / 2);
  const displayMax = Math.min(max, currentWeight + displayRange / 2);

  const normalizeValue = (val: number) => {
    return Math.max(min, Math.min(max, Math.round(val / step) * step));
  };

  const getPositionForValue = (value: number) => {
    const range = displayMax - displayMin;
    const position = ((value - displayMin) / range) * 280;
    return position;
  };

  const getValueForPosition = (position: number) => {
    const range = displayMax - displayMin;
    const value = (position / 280) * range + displayMin;
    return normalizeValue(value);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      },
      onPanResponderMove: (_, gestureState) => {
        const sensitivity = 0.6;
        const currentPosition = getPositionForValue(desiredWeight);
        const newPosition = Math.max(0, Math.min(280, currentPosition + gestureState.dx * sensitivity));
        const newValue = getValueForPosition(newPosition);
        
        if (newValue !== desiredWeight) {
          onChange(newValue);
          
          if (Math.abs(newValue - lastHapticValue.current) >= step) {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            lastHapticValue.current = newValue;
          }
        }
      },
      onPanResponderRelease: () => {
        setIsDragging(false);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
    })
  ).current;

  const currentPosition = getPositionForValue(currentWeight);
  const desiredPosition = getPositionForValue(desiredWeight);
  const delta = desiredWeight - currentWeight;
  const isGaining = delta > 0;

  const renderTicks = () => {
    const ticks = [];
    const tickCount = 28;
    const range = displayMax - displayMin;
    
    for (let i = 0; i <= tickCount; i++) {
      const value = displayMin + (range * i) / tickCount;
      const isMajor = Math.round(value) % 5 === 0;
      const isCenter = Math.abs(value - currentWeight) < 0.5;
      
      ticks.push(
        <View
          key={i}
          style={[
            styles.tick,
            { left: (280 / tickCount) * i },
            isMajor ? styles.tickMajor : styles.tickMinor,
            isCenter && styles.tickCenter,
          ]}
        />
      );
    }
    return ticks;
  };

  return (
    <View style={styles.container}>
      <View style={styles.valueDisplayContainer}>
        <View style={styles.valueRow}>
          <View style={styles.valueBlock}>
            <Text style={styles.valueLabel}>Sekarang</Text>
            <Text style={styles.valueTextSmall}>{currentWeight}</Text>
          </View>
          <Text style={styles.arrowText}>→</Text>
          <View style={styles.valueBlock}>
            <Text style={styles.valueLabel}>Target</Text>
            <Text style={styles.valueTextLarge}>{desiredWeight}</Text>
          </View>
        </View>
      </View>

      <View style={styles.scaleContainer}>
        <View style={styles.scaleTrack}>
          {renderTicks()}
          
          <View
            style={[
              styles.rangeHighlight,
              {
                left: Math.min(currentPosition, desiredPosition),
                width: Math.abs(desiredPosition - currentPosition),
              },
            ]}
          />

          <View
            style={[styles.handle, styles.handleCurrent, { left: currentPosition }]}
          >
            <View style={styles.handleDot} />
          </View>

          <View
            style={[
              styles.handle,
              styles.handleDesired,
              { left: desiredPosition },
              isDragging && styles.handleDragging,
            ]}
            {...panResponder.panHandlers}
          >
            <View style={[styles.handleDot, styles.handleDotActive]} />
          </View>
        </View>

        <View style={styles.labelRow}>
          <Text style={styles.labelText}>{displayMin.toFixed(0)}</Text>
          <Text style={styles.labelTextCenter}>{currentWeight}</Text>
          <Text style={styles.labelText}>{displayMax.toFixed(0)}</Text>
        </View>
      </View>

      <View style={styles.deltaDisplay}>
        <Text style={styles.deltaText}>
          {isGaining ? 'Menambah' : 'Menurunkan'} {Math.abs(delta).toFixed(1)} {unit}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  valueDisplayContainer: {
    marginBottom: 30,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  valueBlock: {
    alignItems: 'center',
  },
  valueLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
  },
  valueTextSmall: {
    fontSize: 32,
    fontWeight: '600' as const,
    color: '#888',
  },
  valueTextLarge: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: '#10B981',
  },
  arrowText: {
    fontSize: 24,
    color: '#666',
  },
  scaleContainer: {
    width: '100%',
    paddingHorizontal: 35,
    marginBottom: 30,
  },
  scaleTrack: {
    height: 60,
    position: 'relative',
    justifyContent: 'center',
  },
  tick: {
    position: 'absolute',
    width: 2,
    backgroundColor: '#2A2A2A',
    bottom: 20,
  },
  tickMinor: {
    height: 12,
  },
  tickMajor: {
    height: 20,
    backgroundColor: '#3A3A3A',
  },
  tickCenter: {
    height: 24,
    backgroundColor: '#10B981',
    width: 3,
  },
  rangeHighlight: {
    position: 'absolute',
    height: 4,
    backgroundColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 2,
    bottom: 28,
  },
  handle: {
    position: 'absolute',
    width: 50,
    height: 50,
    marginLeft: -25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleCurrent: {
    zIndex: 1,
  },
  handleDesired: {
    zIndex: 2,
  },
  handleDragging: {
    transform: [{ scale: 1.1 }],
  },
  handleDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#666',
    borderWidth: 3,
    borderColor: '#0A0A0A',
  },
  handleDotActive: {
    backgroundColor: '#10B981',
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 4,
  },
  labelRow: {
    marginTop: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 0,
  },
  labelText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500' as const,
  },
  labelTextCenter: {
    fontSize: 14,
    color: '#10B981',
    fontWeight: '700' as const,
  },
  deltaDisplay: {
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  deltaText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#10B981',
  },
});
