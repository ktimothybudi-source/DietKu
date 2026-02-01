import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  PanResponder,
} from 'react-native';
import * as Haptics from 'expo-haptics';

interface CircularDialProps {
  min: number;
  max: number;
  initialValue: number;
  onValueChange: (value: number) => void;
  unit?: string;
  step?: number;
}

export default function CircularDial({
  min,
  max,
  initialValue,
  onValueChange,
  unit = '',
  step = 1,
}: CircularDialProps) {
  const [value, setValue] = useState(initialValue);
  const lastValue = useRef(initialValue);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        const sensitivity = 0.5;
        const delta = -gestureState.dy * sensitivity;
        const newValue = Math.max(min, Math.min(max, value + Math.round(delta * step)));
        
        if (newValue !== lastValue.current) {
          setValue(newValue);
          onValueChange(newValue);
          lastValue.current = newValue;
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      },
    })
  ).current;

  const progress = (value - min) / (max - min);

  return (
    <View style={styles.container}>
      <View style={styles.dialContainer} {...panResponder.panHandlers}>
        <View style={styles.track}>
          <View
            style={[
              styles.progressTrack,
              {
                height: `${progress * 100}%`,
              },
            ]}
          />
        </View>
        
        <View style={styles.valueContainer}>
          <Text style={styles.value}>{value}</Text>
          {unit && <Text style={styles.unit}>{unit}</Text>}
        </View>
      </View>
      
      <Text style={styles.hint}>Swipe up or down</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: 20,
  },
  dialContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#111111',
    borderWidth: 3,
    borderColor: '#2A2A2A',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  track: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    top: 0,
    justifyContent: 'flex-end',
  },
  progressTrack: {
    width: '100%',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  valueContainer: {
    alignItems: 'center',
    zIndex: 1,
  },
  value: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  unit: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#888',
    marginTop: 4,
  },
  hint: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500' as const,
  },
});
