import { ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/context/ThemeContext';

SplashScreen.preventAutoHideAsync();

export const unstable_settings = {
  anchor: '(tabs)',
};

function AppShell() {
  const { colorScheme, isReady } = useTheme();

  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  if (!isReady) return null;

  return (
    <NavThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="workouts/[workoutId]" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        <Stack.Screen name="workouts/template" options={{ headerShown: false }} />
        <Stack.Screen name="workouts/new-template" options={{ headerShown: false }} />
        <Stack.Screen name="workouts/exercise-picker" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="exercises/[exerciseId]" options={{ headerShown: false, presentation: 'modal' }} />
        <Stack.Screen name="add-exercise" options={{ headerShown: false }} />
        <Stack.Screen name="settings" options={{ headerShown: false }} />
        <Stack.Screen name="program-select" options={{ headerShown: false }} />
        <Stack.Screen name="history/[workoutId]" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
