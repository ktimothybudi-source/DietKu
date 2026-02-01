import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Platform,
} from "react-native";
import * as Haptics from "expo-haptics";

interface WheelDatePickerProps {
  day: number;
  month: number; // 1-12
  year: number;
  onDayChange: (day: number) => void;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  compact?: boolean;
  minYear?: number;
  maxYear?: number;
}

const MONTHS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const px = (v: number) => Math.round(v); // important for perfect centering

export default function WheelDatePicker({
  day,
  month,
  year,
  onDayChange,
  onMonthChange,
  onYearChange,
  compact = true,
  minYear = 1920,
  maxYear,
}: WheelDatePickerProps) {
  const ITEM_HEIGHT = compact ? 38 : 46;
  const VISIBLE_ITEMS = compact ? 3 : 5;
  const PADDING_ITEMS = Math.floor(VISIBLE_ITEMS / 2);
  const SPACER_HEIGHT = ITEM_HEIGHT * PADDING_ITEMS;
  const containerHeight = ITEM_HEIGHT * VISIBLE_ITEMS;
  const CENTER_OFFSET = (containerHeight - ITEM_HEIGHT) / 2;

  const currentYear = new Date().getFullYear();
  const resolvedMaxYear = maxYear ?? currentYear;

  const years = useMemo(
    () => Array.from({ length: resolvedMaxYear - minYear + 1 }, (_, i) => minYear + i),
    [minYear, resolvedMaxYear]
  );

  const daysInMonth = useMemo(() => new Date(year, month, 0).getDate(), [year, month]);
  const days = useMemo(() => Array.from({ length: daysInMonth }, (_, i) => i + 1), [daysInMonth]);

  const monthRef = useRef<FlatList<any> | null>(null);
  const dayRef = useRef<FlatList<any> | null>(null);
  const yearRef = useRef<FlatList<any> | null>(null);

  // Center-aware math that matches the overlay, rounded to whole pixels
  const offsetFromIndex = useCallback(
    (i: number) => px(SPACER_HEIGHT + i * ITEM_HEIGHT - CENTER_OFFSET),
    [ITEM_HEIGHT, SPACER_HEIGHT, CENTER_OFFSET]
  );

  const indexFromOffset = useCallback(
    (y: number) => Math.round((y - SPACER_HEIGHT + CENTER_OFFSET) / ITEM_HEIGHT),
    [ITEM_HEIGHT, SPACER_HEIGHT, CENTER_OFFSET]
  );

  const scrollToIndex = useCallback(
    (ref: React.RefObject<FlatList<any> | null>, index: number, animated: boolean) => {
      ref.current?.scrollToOffset({ offset: offsetFromIndex(index), animated });
    },
    [offsetFromIndex]
  );

  const getItemLayout = useCallback(
    (_: any, index: number) => ({
      length: ITEM_HEIGHT,
      offset: px(SPACER_HEIGHT + ITEM_HEIGHT * index - CENTER_OFFSET),
      index,
    }),
    [ITEM_HEIGHT, SPACER_HEIGHT, CENTER_OFFSET]
  );

  const hapticCommit = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  }, []);

  // Keep day valid when month/year changes
  useEffect(() => {
    const safeDay = clamp(day, 1, daysInMonth);
    if (safeDay !== day) onDayChange(safeDay);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daysInMonth]);

  // Local indices for highlight
  const [currentMonthIndex, setCurrentMonthIndex] = useState(clamp(month - 1, 0, 11));
  const [currentDayIndex, setCurrentDayIndex] = useState(clamp(day - 1, 0, daysInMonth - 1));
  const [currentYearIndex, setCurrentYearIndex] = useState(() => {
    const yi = years.indexOf(year);
    return yi !== -1 ? yi : 0;
  });

  // Prevent double end snapping
  const monthHasMomentum = useRef(false);
  const dayHasMomentum = useRef(false);
  const yearHasMomentum = useRef(false);

  // Strong native snapping targets, exact offsets per item
  const monthSnapOffsets = useMemo(() => MONTHS.map((_, i) => offsetFromIndex(i)), [offsetFromIndex]);
  const daySnapOffsets = useMemo(() => days.map((_, i) => offsetFromIndex(i)), [days, offsetFromIndex]);
  const yearSnapOffsets = useMemo(() => years.map((_, i) => offsetFromIndex(i)), [years, offsetFromIndex]);

  // Sync scroll positions (initial + prop updates)
  useEffect(() => {
    const mi = clamp(month - 1, 0, 11);
    const di = clamp(day - 1, 0, daysInMonth - 1);
    const yi = years.indexOf(year);

    setCurrentMonthIndex(mi);
    setCurrentDayIndex(di);
    if (yi !== -1) setCurrentYearIndex(yi);

    const t = setTimeout(() => {
      if (monthRef.current) scrollToIndex(monthRef, mi, false);
      if (dayRef.current) scrollToIndex(dayRef, di, false);
      if (yi !== -1 && yearRef.current) scrollToIndex(yearRef, yi, false);
    }, 0);

    return () => clearTimeout(t);
  }, [month, day, year, years, daysInMonth, scrollToIndex]);

  // Hard snap: whatever is in the green row gets forced to the exact center offset
  const hardSnapToCenter = useCallback(
    (
      ref: React.RefObject<FlatList<any> | null>,
      rawOffsetY: number,
      minIndex: number,
      maxIndex: number
    ) => {
      const i = clamp(indexFromOffset(rawOffsetY), minIndex, maxIndex);
      const targetOffset = offsetFromIndex(i);

      // Force exact center, then "lock" animation to make it obvious
      ref.current?.scrollToOffset({ offset: targetOffset, animated: false });
      requestAnimationFrame(() => {
        ref.current?.scrollToOffset({ offset: targetOffset, animated: true });
      });

      return i;
    },
    [indexFromOffset, offsetFromIndex]
  );

  const commitMonth = useCallback(
    (offsetY: number) => {
      const i = hardSnapToCenter(monthRef, offsetY, 0, 11);
      setCurrentMonthIndex(i);
      const newMonth = i + 1;
      if (newMonth !== month) {
        hapticCommit();
        onMonthChange(newMonth);
      }
    },
    [hardSnapToCenter, month, onMonthChange, hapticCommit]
  );

  const commitDay = useCallback(
    (offsetY: number) => {
      const i = hardSnapToCenter(dayRef, offsetY, 0, days.length - 1);
      setCurrentDayIndex(i);
      const newDay = i + 1;
      if (newDay !== day) {
        hapticCommit();
        onDayChange(newDay);
      }
    },
    [hardSnapToCenter, day, days.length, onDayChange, hapticCommit]
  );

  const commitYear = useCallback(
    (offsetY: number) => {
      const i = hardSnapToCenter(yearRef, offsetY, 0, years.length - 1);
      setCurrentYearIndex(i);
      const newYear = years[i];
      if (newYear !== year) {
        hapticCommit();
        onYearChange(newYear);
      }
    },
    [hardSnapToCenter, year, years, onYearChange, hapticCommit]
  );

  // Highlight only during scroll (no snapping here)
  const onMonthScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = clamp(indexFromOffset(e.nativeEvent.contentOffset.y), 0, 11);
      setCurrentMonthIndex(i);
    },
    [indexFromOffset]
  );

  const onDayScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = clamp(indexFromOffset(e.nativeEvent.contentOffset.y), 0, days.length - 1);
      setCurrentDayIndex(i);
    },
    [indexFromOffset, days.length]
  );

  const onYearScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const i = clamp(indexFromOffset(e.nativeEvent.contentOffset.y), 0, years.length - 1);
      setCurrentYearIndex(i);
    },
    [indexFromOffset, years.length]
  );

  // Momentum begin flags
  const onMonthMomentumBegin = useCallback(() => {
    monthHasMomentum.current = true;
  }, []);
  const onDayMomentumBegin = useCallback(() => {
    dayHasMomentum.current = true;
  }, []);
  const onYearMomentumBegin = useCallback(() => {
    yearHasMomentum.current = true;
  }, []);

  // End drag: snap only if no momentum
  const onMonthEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (monthHasMomentum.current) return;
      commitMonth(e.nativeEvent.contentOffset.y);
    },
    [commitMonth]
  );

  const onDayEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (dayHasMomentum.current) return;
      commitDay(e.nativeEvent.contentOffset.y);
    },
    [commitDay]
  );

  const onYearEndDrag = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (yearHasMomentum.current) return;
      commitYear(e.nativeEvent.contentOffset.y);
    },
    [commitYear]
  );

  // Momentum end: always snap and reset flag
  const onMonthMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      monthHasMomentum.current = false;
      commitMonth(e.nativeEvent.contentOffset.y);
    },
    [commitMonth]
  );

  const onDayMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      dayHasMomentum.current = false;
      commitDay(e.nativeEvent.contentOffset.y);
    },
    [commitDay]
  );

  const onYearMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      yearHasMomentum.current = false;
      commitYear(e.nativeEvent.contentOffset.y);
    },
    [commitYear]
  );

  const Spacer = useMemo(() => <View style={{ height: SPACER_HEIGHT }} />, [SPACER_HEIGHT]);

  const renderTextItem = (label: string | number, selected: boolean) => (
    <View style={[styles.item, { height: ITEM_HEIGHT }]}>
      <Text
        numberOfLines={1}
        style={[
          styles.text,
          compact && styles.textCompact,
          selected && styles.textSelected,
          selected && compact && styles.textSelectedCompact,

          // THIS is what fixes your screenshot: force glyphs to vertically center
          {
            height: ITEM_HEIGHT,
            lineHeight: ITEM_HEIGHT,
            textAlign: "center",
            ...(Platform.OS === "android" ? { includeFontPadding: false as any } : null),
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );

  const listProps = {
    showsVerticalScrollIndicator: false,
    decelerationRate: "fast" as const,
    bounces: false,
    overScrollMode: "never" as const,
    ListHeaderComponent: Spacer,
    ListFooterComponent: Spacer,
    getItemLayout,
    initialNumToRender: 12,
    windowSize: 7,
    maxToRenderPerBatch: 12,
    updateCellsBatchingPeriod: 16,
    removeClippedSubviews: false,
    snapToAlignment: "center" as const,
    disableIntervalMomentum: true,
    scrollEventThrottle: 16,
  };

  return (
    <View style={[styles.container, { height: containerHeight }]}>
      <View style={[styles.row, { height: containerHeight }]}>
        <View style={styles.col}>
          <FlatList
            ref={monthRef}
            data={MONTHS}
            keyExtractor={(_, i) => `m-${i}`}
            renderItem={({ item, index }) => renderTextItem(item, index === currentMonthIndex)}
            onScroll={onMonthScroll}
            onMomentumScrollBegin={onMonthMomentumBegin}
            onScrollEndDrag={onMonthEndDrag}
            onMomentumScrollEnd={onMonthMomentumEnd}
            snapToOffsets={monthSnapOffsets}
            {...listProps}
          />
        </View>

        <View style={styles.col}>
          <FlatList
            ref={dayRef}
            data={days}
            keyExtractor={(item) => `d-${item}`}
            renderItem={({ item, index }) => renderTextItem(item, index === currentDayIndex)}
            onScroll={onDayScroll}
            onMomentumScrollBegin={onDayMomentumBegin}
            onScrollEndDrag={onDayEndDrag}
            onMomentumScrollEnd={onDayMomentumEnd}
            snapToOffsets={daySnapOffsets}
            {...listProps}
          />
        </View>

        <View style={styles.col}>
          <FlatList
            ref={yearRef}
            data={years}
            keyExtractor={(item) => `y-${item}`}
            renderItem={({ item, index }) => renderTextItem(item, index === currentYearIndex)}
            onScroll={onYearScroll}
            onMomentumScrollBegin={onYearMomentumBegin}
            onScrollEndDrag={onYearEndDrag}
            onMomentumScrollEnd={onYearMomentumEnd}
            snapToOffsets={yearSnapOffsets}
            {...listProps}
          />
        </View>
      </View>

      {/* Selection overlay (your green highlighted rectangle) */}
      <View
        pointerEvents="none"
        style={[
          styles.selection,
          {
            top: SPACER_HEIGHT,
            height: ITEM_HEIGHT,
            backgroundColor: "rgba(16, 185, 129, 0.08)",
            borderTopColor: "rgba(16, 185, 129, 0.25)",
          },
        ]}
      />
      <View
        pointerEvents="none"
        style={[
          styles.selectionBottom,
          {
            top: SPACER_HEIGHT + ITEM_HEIGHT,
            backgroundColor: "rgba(16, 185, 129, 0.25)",
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: "relative", justifyContent: "center" },
  row: { flexDirection: "row" },
  col: { flex: 1 },
  item: { justifyContent: "center", alignItems: "center", paddingHorizontal: 10 },
  text: { fontSize: 16, color: "#777", fontWeight: "500" },
  textCompact: { fontSize: 14 },
  textSelected: { color: "#FFFFFF", fontWeight: "700", fontSize: 18 },
  textSelectedCompact: { fontSize: 16 },
  selection: { position: "absolute", left: 0, right: 0, borderTopWidth: 1 },
  selectionBottom: { position: "absolute", left: 0, right: 0, height: 1 },
});
