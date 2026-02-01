import { Tabs } from "expo-router";
import { Flame, User, BarChart3 } from "lucide-react-native";
import React from "react";
import { useTheme } from "@/contexts/ThemeContext";

export default function TabLayout() {
  const { theme } = useTheme();
  
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
          height: 88,
          paddingBottom: 32,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600" as const,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dietku",
          tabBarLabel: "Dietku",
          tabBarIcon: ({ color }) => <Flame size={22} color={color} fill={color} />,
        }}
      />
      <Tabs.Screen
        name="analytics"
        options={{
          title: "Analitik",
          tabBarLabel: "Analitik",
          tabBarIcon: ({ color }) => <BarChart3 size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarLabel: "Profil",
          tabBarIcon: ({ color }) => <User size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}
