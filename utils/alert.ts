import { Alert as RNAlert } from 'react-native';

// Native (iOS/Android): thin re-export of React Native's own Alert.
// See utils/alert.web.ts for the web counterpart — react-native-web's
// Alert.alert() is a no-op stub, so every confirm/destructive dialog in the
// app needs to go through this module instead of importing Alert directly
// from 'react-native'.
export const Alert = RNAlert;
