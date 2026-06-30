import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

export function Icon({
  name,
  size = 20,
  color = colors.ink,
  style,
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: any;
}) {
  return <Ionicons name={name} size={size} color={color} style={style} />;
}
