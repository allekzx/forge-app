import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

import { Fonts, Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useColors } from '@/hooks/use-colors';

// Conditional requires : éliminés du bundle web par Metro au build time
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Haptics = Platform.OS !== 'web' ? (require('expo-haptics') as typeof import('expo-haptics')) : null;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications = Platform.OS !== 'web' ? (require('expo-notifications') as typeof import('expo-notifications')) : null;

type Props = {
  initialDuration: number;
  onFinish: () => void;
  onSkip: () => void;
  onAdjust: (newTotal: number) => void;
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function RestTimer({ initialDuration, onFinish, onSkip, onAdjust }: Props) {
  const colorScheme = useColorScheme();
  const colors = useColors();

  const [remaining, setRemaining] = useState(initialDuration);
  const [total, setTotal] = useState(initialDuration);
  const [editMode, setEditMode] = useState(false);
  const [editValue, setEditValue] = useState('');

  const finishedRef = useRef(false);
  const notifIdRef = useRef<string | null>(null);
  // Quand le timer finit naturellement, on laisse la notification se déclencher pour jouer le son
  const cancelOnUnmountRef = useRef(true);

  // Horodatage absolu de fin : permet de recalculer le temps restant après une mise en
  // veille du téléphone, là où un simple décompte par setTimeout/setInterval se gèlerait.
  const endTimeRef = useRef(Date.now() + initialDuration * 1000);
  const totalRef = useRef(initialDuration);

  // Keep a stable ref to onFinish so the countdown effect doesn't depend on it
  // (avoids resetting the timeout every time the parent re-renders)
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;

  // React Native built-in Animated (web-compatible, no reanimated)
  const barProgress = useRef(new Animated.Value(1)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);

  const cancelNotif = async () => {
    if (notifIdRef.current) {
      await Notifications?.cancelScheduledNotificationAsync(notifIdRef.current).catch(() => {});
      notifIdRef.current = null;
    }
  };

  const scheduleNotif = async (seconds: number) => {
    await cancelNotif();
    try {
      const id = await Notifications?.scheduleNotificationAsync({
        content: {
          title: 'Repos terminé !',
          body: 'Prêt pour le prochain set ?',
          sound: 'timer_end.wav',
        },
        trigger: {
          type: Notifications!.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: Math.max(1, Math.round(seconds)),
          repeats: false,
          channelId: 'rest-timer',
        },
      });
      if (id) notifIdRef.current = id;
    } catch {}
  };

  const startAnimation = (durationSeconds: number, fromFull = false) => {
    animationRef.current?.stop();
    if (fromFull) barProgress.setValue(1);
    animationRef.current = Animated.timing(barProgress, {
      toValue: 0,
      duration: Math.max(100, durationSeconds * 1000),
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animationRef.current.start();
  };

  // Recalcule le temps restant à partir de l'horodatage absolu de fin, et resynchronise
  // la barre de progression. Utilisé au tick normal et au retour au premier plan.
  const syncFromEndTime = () => {
    const next = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000));
    setRemaining(next);
    if (next > 0) {
      barProgress.setValue(next / totalRef.current);
      startAnimation(next);
    } else {
      animationRef.current?.stop();
      barProgress.setValue(0);
    }
    return next;
  };

  useEffect(() => {
    startAnimation(initialDuration, true);
    scheduleNotif(initialDuration);
    return () => {
      animationRef.current?.stop();
      if (cancelOnUnmountRef.current) cancelNotif();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recale le chrono quand l'app revient au premier plan (écran verrouillé pendant le repos) :
  // les timers JS sont gelés en arrière-plan, donc `remaining` peut être obsolète.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') syncFromEndTime();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      if (!finishedRef.current) {
        finishedRef.current = true;
        cancelOnUnmountRef.current = false; // laisser la notification sonner
        Haptics?.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onFinishRef.current();
      }
      return;
    }
    const id = setTimeout(() => {
      setRemaining(Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000)));
    }, 1000);
    return () => clearTimeout(id);
  }, [remaining]);

  const handleAdjust = (delta: number) => {
    const newRemaining = Math.max(5, remaining + delta);
    const newTotal = Math.max(5, total + delta, newRemaining);
    endTimeRef.current = Date.now() + newRemaining * 1000;
    totalRef.current = newTotal;
    setRemaining(newRemaining);
    setTotal(newTotal);
    onAdjust(newTotal);
    startAnimation(newRemaining);
    scheduleNotif(newRemaining);
  };

  const confirmEdit = () => {
    const val = parseInt(editValue, 10);
    if (!isNaN(val)) {
      const clamped = Math.min(600, Math.max(5, val));
      endTimeRef.current = Date.now() + clamped * 1000;
      totalRef.current = clamped;
      setRemaining(clamped);
      setTotal(clamped);
      onAdjust(clamped);
      startAnimation(clamped, true);
      scheduleNotif(clamped);
    }
    setEditMode(false);
    setEditValue('');
  };

  const handleSkip = () => {
    cancelNotif();
    onSkip();
  };

  const bgColor = colorScheme === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const adjustBg = colorScheme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

  const barWidth = barProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { backgroundColor: bgColor, borderColor: colors.border }]}>
      <View style={styles.top}>
        <Text style={[styles.label, { color: colors.icon }]}>REPOS</Text>
        {editMode ? (
          <TextInput
            style={[styles.time, styles.timeInput, { color: colors.success }]}
            keyboardType="number-pad"
            value={editValue}
            onChangeText={setEditValue}
            onSubmitEditing={confirmEdit}
            onBlur={confirmEdit}
            autoFocus
            maxLength={3}
            selectTextOnFocus
          />
        ) : (
          <TouchableOpacity onPress={() => { setEditValue(String(remaining)); setEditMode(true); }}>
            <Text style={[styles.time, { color: colors.success }]}>{formatDuration(remaining)}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={[styles.barBg, { backgroundColor: adjustBg }]}>
        <Animated.View style={[styles.barFill, { width: barWidth, backgroundColor: colors.tint }]} />
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.adjustBtn, { backgroundColor: adjustBg }]} onPress={() => handleAdjust(-30)}>
          <Text style={[styles.adjustText, { color: colors.text }]}>-30s</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.skipBtn, { borderColor: colors.icon }]} onPress={handleSkip}>
          <Text style={[styles.skipText, { color: colors.icon }]}>Passer</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.adjustBtn, { backgroundColor: adjustBg }]} onPress={() => handleAdjust(30)}>
          <Text style={[styles.adjustText, { color: colors.text }]}>+30s</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: Radius.md, borderWidth: StyleSheet.hairlineWidth, padding: 12, marginBottom: 6, gap: 8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  time: { fontSize: 22, fontWeight: 'bold', fontFamily: Fonts?.mono, fontVariant: ['tabular-nums'] },
  timeInput: { minWidth: 60, textAlign: 'right', padding: 0 },
  barBg: { height: 4, borderRadius: 0, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 0 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  adjustBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm, minHeight: 36 },
  adjustText: { fontSize: 14, fontWeight: '600', fontFamily: Fonts?.mono, fontVariant: ['tabular-nums'] },
  skipBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1, minHeight: 36 },
  skipText: { fontSize: 14, fontWeight: '600', letterSpacing: 0.4, textTransform: 'uppercase' },
});
