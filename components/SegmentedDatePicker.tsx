import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

const ITEM_HEIGHT = 60;
const HEIGHT = 240;

// Generate years (example: 1920–2026)
const years = Array.from({ length: 107 }, (_, i) => 1920 + i);

export default function YearWheelPicker({
  initialYear = 2000,
  onYearChange,
}: {
  initialYear?: number;
  onYearChange: (year: number) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [selectedYear, setSelectedYear] = useState(initialYear);
  const [selectedIndex, setSelectedIndex] = useState(years.indexOf(initialYear));

  const paddingItems = Math.floor((HEIGHT - ITEM_HEIGHT) / ITEM_HEIGHT / 2);

  // Scroll to initial year
  useEffect(() => {
    const index = years.indexOf(initialYear);
    if (index !== -1 && scrollRef.current) {
      setTimeout(() => {
        scrollRef.current?.scrollTo({
          y: index * ITEM_HEIGHT + paddingItems * ITEM_HEIGHT,
          animated: false,
        });
      }, 100);
    }
  }, [initialYear]);

  const snapToIndex = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    const paddingOffset = paddingItems * ITEM_HEIGHT;
    const index = Math.round((offsetY - paddingOffset) / ITEM_HEIGHT);

    const alignedY = index * ITEM_HEIGHT + paddingOffset;
    scrollRef.current?.scrollTo({ y: alignedY, animated: true });

    setSelectedIndex(index);
    const year = years[index];
    setSelectedYear(year);
    onYearChange(year);
  };

  const renderItem = (year: number, index: number) => {
    const isSelected = index === selectedIndex;
    const distance = Math.abs(selectedIndex - index);
    const opacity = Math.max(0.3, 1 - distance * 0.25);
    const scale = Math.max(0.8, 1 - distance * 0.1);

    return (
      <View
        key={index}
        style={[
          styles.item,
          { height: ITEM_HEIGHT, opacity, transform: [{ scale }] },
        ]}
      >
        <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
          {year}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Highlight overlay */}
      <View style={styles.highlightContainer}>
        <View style={styles.highlight} />
      </View>

      {/* Year scroll wheel */}
      <ScrollView
        ref={scrollRef}
        snapToInterval={ITEM_HEIGHT}
        snapToAlignment="center"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        onMomentumScrollEnd={snapToIndex}
        contentContainerStyle={{
          paddingTop: paddingItems * ITEM_HEIGHT,
          paddingBottom: paddingItems * ITEM_HEIGHT,
        }}
      >
        {years.map((y, i) => renderItem(y, i))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: HEIGHT,
    width: '100%',
    position: 'relative',
  },
  highlightContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    pointerEvents: 'none',
    zIndex: 1,
  },
  highlight: {
    width: '100%',
    height: ITEM_HEIGHT,
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#10B981',
    borderRadius: 12,
  },
  item: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemText: {
    fontSize: 32,
    fontWeight: '600',
    color: '#666',
  },
  itemTextSelected: {
    fontSize: 40,
    fontWeight: '700',
    color: '#10B981', // changed to green to match highlight
  },
});
