import React, { useRef, useEffect, useMemo } from "react";
import { View, Text, StyleSheet, PanResponder, Animated } from "react-native";
import * as Haptics from "expo-haptics";

interface HeightScaleProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  isImperial: boolean;
  step?: number;
}

export default function HeightScale({
  value,
  onChange,
  min,
  max,
  isImperial,
  step = 1,
}: HeightScaleProps) {
  const animatedValue = useRef(new Animated.Value(0)).current;

  // Always-current value for responder callbacks (avoids stale closure)
  const valueRef = useRef(value);
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const lastHapticValue = useRef(value);

  // Gesture state
  const baseValueRef = useRef(value); // value at touch start
  const remainderPxRef = useRef(0); // leftover pixels that didn’t make a full step

  const tickSpacing = 8; // px per "step" tick (must match renderTicks spacing)
  const sensitivity = 0.35; // < 1 = less sensitive; tune this
  const jitterPx = 2; // ignore tiny micro jitter

  const normalizeValue = (val: number) =>
    Math.max(min, Math.min(max, Math.round(val / step) * step));

  const formatHeight = (val: number) => {
    if (isImperial) {
      const feet = Math.floor(val / 12);
      const inches = val % 12;
      return `${feet}' ${inches}"`;
    }
    return `${val} cm`;
  };

  const snapBack = () => {
    Animated.spring(animatedValue, {
      toValue: 0,
      useNativeDriver: true,
      speed: 20,
      bounciness: 0,
    }).start();
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

          // Reset gesture state on each touch to prevent jumps
          remainderPxRef.current = 0;
          baseValueRef.current = valueRef.current;

          animatedValue.setValue(0);
        },

        onPanResponderMove: (_, gestureState) => {
          // Ignore tiny jitter
          if (Math.abs(gestureState.dy) < jitterPx) return;

          // Convert drag to pixels (scaled)
          const deltaPx = gestureState.dy * sensitivity;

          // Visual movement (optional clamp)
          const clamped = Math.max(-120, Math.min(120, deltaPx));
          animatedValue.setValue(clamped);

          // Accumulate pixels and convert to steps
          remainderPxRef.current += deltaPx;

          // When we cross half a tick, commit a step (in value units)
          if (Math.abs(remainderPxRef.current) >= tickSpacing / 2) {
            const stepsMoved = Math.round(remainderPxRef.current / tickSpacing);

            // Drag down (dy positive) should reduce height, drag up increases height
            const next = normalizeValue(baseValueRef.current - stepsMoved * step);

            if (next !== valueRef.current) {
              onChange(next);
              valueRef.current = next; // keep responder in sync immediately
              baseValueRef.current = next;

              // remove the committed portion but keep any extra remainder for smoothness
              remainderPxRef.current -= stepsMoved * tickSpacing;

              if (Math.abs(next - lastHapticValue.current) >= step) {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                lastHapticValue.current = next;
              }
            } else {
              // If we hit min/max, discard extra remainder to avoid “pressure” building up
              remainderPxRef.current = 0;
              baseValueRef.current = valueRef.current;
            }
          }
        },

        onPanResponderRelease: () => {
          remainderPxRef.current = 0;
          baseValueRef.current = valueRef.current;
          snapBack();
        },

        onPanResponderTerminate: () => {
          remainderPxRef.current = 0;
          baseValueRef.current = valueRef.current;
          snapBack();
        },
      }),
    [animatedValue, min, max, step]
  );

  const renderTicks = () => {
    const ticks = [];
    const visibleRange = 60;

    const startValue = Math.max(min, value - visibleRange / 2);
    const endValue = Math.min(max, value + visibleRange / 2);

    for (let i = startValue; i <= endValue; i += step) {
      const offset = (value - i) * tickSpacing;
      const distance = Math.abs(i - value);

      const opacity = Math.max(0.05, 1 - distance / 20);
      const isMajor = i % (isImperial ? 12 : 10) === 0;

      const translateY = animatedValue.interpolate({
        inputRange: [-120, 0, 120],
        outputRange: [-120 + offset, offset, 120 + offset],
        extrapolate: "clamp",
      });

      ticks.push(
        <Animated.View
          key={i}
          style={[
            styles.tickContainer,
            {
              transform: [{ translateY }],
              opacity,
            },
          ]}
        >
          <View style={[styles.tick, isMajor ? styles.tickMajor : styles.tickMinor]} />
          {isMajor && (
            <Text style={[styles.tickLabel, i === value && styles.tickLabelActive]}>
              {isImperial ? `${Math.floor(i / 12)}' ${i % 12}"` : `${i}`}
            </Text>
          )}
        </Animated.View>
      );
    }

    return ticks;
  };

  return (
    <View style={styles.container}>
      <View style={styles.valueDisplay}>
        <Text style={styles.valueText} accessibilityLabel={`Current height is ${formatHeight(value)}`}>
          {formatHeight(value)}
        </Text>
      </View>

      <View style={styles.scaleContainer} {...panResponder.panHandlers}>
        <View style={styles.indicator}>
          <View style={styles.indicatorLine} />
        </View>

        <View style={styles.ticksContainer}>{renderTicks()}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 20,
  },
  valueDisplay: {
    marginBottom: 30,
  },
  valueText: {
    fontSize: 64,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  scaleContainer: {
    width: 280,
    height: 200,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  indicator: {
    position: "absolute",
    zIndex: 10,
    width: 280,
    height: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  indicatorLine: {
    width: 60,
    height: 4,
    backgroundColor: "#6C63FF",
    borderRadius: 2,
  },
  ticksContainer: {
    width: 280,
    height: 200,
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  tickContainer: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    width: 280,
  },
  tick: {
    height: 2,
    backgroundColor: "#2A2A2A",
  },
  tickMinor: {
    width: 20,
  },
  tickMajor: {
    width: 30,
    backgroundColor: "#555",
  },
  tickLabel: {
    fontSize: 14,
    color: "#AAA",
    fontWeight: "500",
    minWidth: 40,
  },
  tickLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});
