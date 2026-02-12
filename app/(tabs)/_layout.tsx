import { Tabs } from "expo-router";
import { Flame, User, BarChart3 } from "lucide-react-native";
import React from "react";
import { Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";

export default function TabLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  
  const tabBarHeight = Platform.select({
    ios: 49 + insets.bottom,
    android: 56 + Math.max(insets.bottom, 8),
    default: 56,
  });
  
  const tabBarPaddingBottom = Platform.select({
    ios: insets.bottom > 0 ? insets.bottom : 8,
    android: Math.max(insets.bottom, 8),
    default: 8,
  });
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.tabBarInactive,
        headerShown: true,
        headerStyle: {
          backgroundColor: theme.background,
        },
        headerTintColor: theme.text,
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: theme.tabBar,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingBottom: tabBarPaddingBottom,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500" as const,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "DietKu",
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Flame size={21} color={color} fill={focused ? color : 'transparent'} />
          ),
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analitik",
          tabBarLabel: "Analitik",
          tabBarIcon: ({ color }) => <BarChart3 size={21} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarLabel: "Profil",
          tabBarIcon: ({ color }) => <User size={21} color={color} />,
        }}
      />
    </Tabs>
  );
}
