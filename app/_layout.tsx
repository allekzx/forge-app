import { ThemeProvider as NavThemeProvider, DarkTheme, DefaultTheme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/context/ThemeContext';

SplashScreen.preventAutoHideAsync();

// Joue le son des notifications en foreground sans afficher de bannière
// eslint-disable-next-line @typescript-eslint/no-require-imports
const _Notifs = Platform.OS !== 'web' ? (require('expo-notifications') as typeof import('expo-notifications')) : null;
_Notifs?.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Canal dédié au son du minuteur de repos : sur Android 8+, le son d'une notification
// est figé à la création du canal et ne peut pas être changé via `content.sound` seul.
// Le canal "fallback" par défaut d'expo-notifications n'embarque pas notre wav custom.
if (Platform.OS === 'android') {
  _Notifs?.setNotificationChannelAsync('rest-timer', {
    name: 'Minuteur de repos',
    importance: _Notifs.AndroidImportance.HIGH,
    sound: 'timer_end.wav',
    vibrationPattern: [0, 250, 250, 250],
  }).catch(() => {});
}

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
