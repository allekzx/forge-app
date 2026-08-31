// Web counterpart to utils/alert.ts.
//
// react-native-web's own Alert.alert() is a no-op stub (it does nothing at
// all — no dialog, no callback), which silently breaks every confirm and
// destructive action in the app on web: delete buttons look like they do
// nothing, and the "pause/discard workout" guard in the live workout screen
// never resolves, permanently blocking navigation away from that screen.
//
// This re-implements the same Alert.alert(title, message, buttons) signature
// on top of window.alert/window.confirm so every existing call site keeps
// working unchanged once it imports Alert from '@/utils/alert' instead of
// 'react-native'.
type AlertButton = {
  text?: string;
  onPress?: ((value?: string) => any) | Function;
  style?: 'default' | 'cancel' | 'destructive';
};

function alert(title: string | null | undefined, message?: string | null, buttons?: AlertButton[]): void {
  const text = [title, message].filter(Boolean).join('\n\n');
  const list = buttons && buttons.length > 0 ? buttons : undefined;

  if (!list || list.length === 1) {
    window.alert(text);
    list?.[0]?.onPress?.();
    return;
  }

  const cancelBtn = list.find(b => b.style === 'cancel');
  const confirmBtn = list.find(b => b.style === 'destructive') ?? list.find(b => b !== cancelBtn) ?? list[list.length - 1];

  if (window.confirm(text)) {
    confirmBtn?.onPress?.();
  } else {
    cancelBtn?.onPress?.();
  }
}

export const Alert = { alert };
