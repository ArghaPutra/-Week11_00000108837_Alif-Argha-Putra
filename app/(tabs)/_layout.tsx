import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        tabBarButton: HapticTab,
        title: route.name === 'index' ? 'Home' : route.name === 'explore' ? 'Explore' : route.name,
        tabBarIcon: ({ color }) => {
          const iconName = route.name === 'index' ? 'house.fill' : 'paperplane.fill';
          return <IconSymbol size={28} name={iconName} color={color} />;
        },
      })}
    />
  );
}
