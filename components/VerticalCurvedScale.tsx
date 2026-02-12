import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, PanResponder } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Svg, Path } from 'react-native-svg';

interface VerticalCurvedScaleProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  recommendedMin: number;
  recommendedMax: number;
  unit: string;
  label: string;
  step?: number;
}

export default function VerticalCurvedScale({
  value,
  onChange,
  min,
  max,
  recommendedMin,
  recommendedMax,
  unit,
  label,
  step = 0.1,
}: VerticalCurvedScaleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const lastHapticValue = useRef(value);

  const normalizeValue = (val: number) => {
    return Math.max(min, Math.min(max, Math.round(val / step) * step));
  };

  const getPositionForValue = (val: number) => {
    const range = max - min;
    const position = ((val - min) / range) * 300;
    return 300 - position;
  };

  const getValueForPosition = (position: number) => {
    const range = max - min;
    const val = ((300 - position) / 300) * range + min;
    return normalizeValue(val);
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
        const currentPosition = getPositionForValue(value);
        let newPosition = currentPosition + gestureState.dy;
        
        const resistance = 0.3;
        if (newPosition < 0) {
          newPosition = newPosition * resistance;
        } else if (newPosition > 300) {
          newPosition = 300 + (newPosition - 300) * resistance;
        }
        
        newPosition = Math.max(-30, Math.min(330, newPosition));
        const newValue = getValueForPosition(newPosition);
        
        if (newValue !== value) {
          onChange(newValue);
          
          if (Math.abs(newValue - lastHapticValue.current) >= step * 2) {
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

  const handlePosition = getPositionForValue(value);
  const isInRecommended = value >= recommendedMin && value <= recommendedMax;

  const renderCurvedPath = () => {
    const centerX = 100;
    const curveAmount = 40;
    
    const pathData = `
      M ${centerX - curveAmount} 0
      Q ${centerX} 150 ${centerX - curveAmount} 300
    `;

    return (
      <Svg width={200} height={300} style={styles.svgContainer}>
        <Path
          d={pathData}
          stroke="#2A2A2A"
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
        />
        
        <Path
          d={pathData}
          stroke="#6C63FF"
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          opacity={0.3}
          strokeDasharray="10,10"
        />
      </Svg>
    );
  };

  const renderTicks = () => {
    const ticks = [];
    const tickCount = 10;
    
    for (let i = 0; i <= tickCount; i++) {
      const position = (300 / tickCount) * i;
      const val = getValueForPosition(position);
      const isRecommended = val >= recommendedMin && val <= recommendedMax;
      
      ticks.push(
        <View
          key={i}
          style={[
            styles.tickContainer,
            { top: position },
          ]}
        >
          <View
            style={[
              styles.tick,
              isRecommended && styles.tickRecommended,
            ]}
          />
          {i % 2 === 0 && (
            <Text style={[styles.tickLabel, isRecommended && styles.tickLabelRecommended]}>
              {val.toFixed(1)}
            </Text>
          )}
        </View>
      );
    }
    
    return ticks;
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.valueDisplay}>
          <Text style={styles.valueText}>{value.toFixed(1)}</Text>
          <Text style={styles.unitText}>{unit}</Text>
        </View>
        <Text style={styles.labelText}>{label}</Text>
        {!isInRecommended && (
          <View style={styles.recommendedBadge}>
            <Text style={styles.recommendedText}>
              Direkomendasikan: {recommendedMin.toFixed(1)} - {recommendedMax.toFixed(1)} {unit}
            </Text>
          </View>
        )}
        {isInRecommended && (
          <View style={styles.recommendedBadgeActive}>
            <Text style={styles.recommendedTextActive}>
              ✓ Dalam Rentang yang Direkomendasikan
            </Text>
          </View>
        )}
      </View>

      <View style={styles.scaleContainer}>
        <View style={styles.ticksColumn}>
          {renderTicks()}
        </View>

        <View style={styles.curveColumn}>
          {renderCurvedPath()}
          
          <View
            style={[
              styles.handle,
              { top: handlePosition },
              isDragging && styles.handleDragging,
            ]}
            {...panResponder.panHandlers}
          >
            <View style={[styles.handleInner, isInRecommended && styles.handleRecommended]}>
              <View style={styles.handleArrowUp} />
              <View style={styles.handleArrowDown} />
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  valueDisplay: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 8,
  },
  valueText: {
    fontSize: 64,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  unitText: {
    fontSize: 28,
    fontWeight: '600' as const,
    color: '#666',
  },
  labelText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 12,
    textAlign: 'center',
  },
  recommendedBadge: {
    backgroundColor: '#1A1A1A',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  recommendedText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
  },
  recommendedBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  recommendedTextActive: {
    fontSize: 12,
    color: '#6C63FF',
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  scaleContainer: {
    flexDirection: 'row',
    height: 300,
    alignItems: 'center',
  },
  ticksColumn: {
    width: 80,
    height: 300,
    position: 'relative',
    marginRight: 10,
  },
  tickContainer: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -10,
  },
  tick: {
    width: 16,
    height: 2,
    backgroundColor: '#2A2A2A',
  },
  tickRecommended: {
    backgroundColor: '#6C63FF',
    width: 20,
  },
  tickLabel: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500' as const,
  },
  tickLabelRecommended: {
    color: '#6C63FF',
  },
  curveColumn: {
    width: 200,
    height: 300,
    position: 'relative',
  },
  svgContainer: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  handle: {
    position: 'absolute',
    left: 50,
    width: 60,
    height: 60,
    marginLeft: -30,
    marginTop: -30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  handleDragging: {
    transform: [{ scale: 1.15 }],
  },
  handleInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#111111',
    borderWidth: 3,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  handleRecommended: {
    borderColor: '#6C63FF',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  handleArrowUp: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderBottomWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#666',
  },
  handleArrowDown: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#666',
  },

});
