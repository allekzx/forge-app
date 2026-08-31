// Fallback for using MaterialIcons on Android and web.

import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { SymbolViewProps, SymbolWeight } from 'expo-symbols';
import { ComponentProps } from 'react';
import { OpaqueColorValue, type StyleProp, type TextStyle } from 'react-native';

type IconMapping = Record<SymbolViewProps['name'], ComponentProps<typeof MaterialIcons>['name']>;
type IconSymbolName = keyof typeof MAPPING;

/**
 * Add your SF Symbols to Material Icons mappings here.
 * - see Material Icons in the [Icons Directory](https://icons.expo.fyi).
 * - see SF Symbols in the [SF Symbols](https://developer.apple.com/sf-symbols/) app.
 */
const MAPPING = {
  'house.fill': 'home',
  'paperplane.fill': 'send',
  'chevron.left.forwardslash.chevron.right': 'code',
  'chevron.right': 'chevron-right',
  'chevron.left': 'chevron-left',
  'chevron.up': 'keyboard-arrow-up',
  'chevron.down': 'keyboard-arrow-down',
  'scalemass.fill': 'fitness-center',
  'plus.circle.fill': 'add-circle',
  'plus.circle': 'add-circle-outline',
  'plus': 'add',
  'chart.bar.fill': 'bar-chart',
  'gear': 'settings',
  'checkmark.circle.fill': 'check-circle',
  'checkmark': 'check',
  'clock.arrow.circlepath': 'history',
  'clock.fill': 'access-time',
  'bell.fill': 'notifications',
  'magnifyingglass': 'search',
  'slider.horizontal.3': 'tune',
  'line.3.horizontal.decrease.circle': 'filter-list',
  'camera.fill': 'camera-alt',
  'folder': 'folder',
  'ellipsis': 'more-horiz',
  'person.fill': 'person',
  'list.bullet': 'format-list-bulleted',
  'timer': 'timer',
  'dumbbell.fill': 'fitness-center',
  'xmark.circle.fill': 'cancel',
  'xmark': 'close',
  'trash': 'delete-outline',
  'play.fill': 'play-arrow',
  'pencil': 'edit',
  'trophy.fill': 'emoji-events',
  'flame.fill': 'local-fire-department',
  'flame': 'local-fire-department',
  'sun.max.fill': 'wb-sunny',
  'moon.fill': 'nightlight-round',
  'minus.circle.fill': 'remove-circle',
  'minus.circle': 'remove-circle-outline',
  'circle': 'radio-button-unchecked',
  'link': 'link',
} as IconMapping;

/**
 * An icon component that uses native SF Symbols on iOS, and Material Icons on Android and web.
 * This ensures a consistent look across platforms, and optimal resource usage.
 * Icon `name`s are based on SF Symbols and require manual mapping to Material Icons.
 */
export function IconSymbol({
  name,
  size = 24,
  color,
  style,
}: {
  name: IconSymbolName;
  size?: number;
  color: string | OpaqueColorValue;
  style?: StyleProp<TextStyle>;
  weight?: SymbolWeight;
}) {
  return <MaterialIcons color={color} size={size} name={MAPPING[name]} style={style} />;
}
