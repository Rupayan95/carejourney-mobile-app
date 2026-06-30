import { Platform, TextStyle, ViewStyle } from 'react-native';

/**
 * NH-Care–style design tokens. Single source of truth for colors, spacing,
 * radius, shadow, and typography across the app. Import from '@/theme' via
 * relative path: `import { colors, spacing } from '../../src/theme'`.
 */

export const colors = {
  // Brand (teal/blue)
  primary: '#0E7490',
  primaryDeep: '#0B5566',
  primaryTint: '#E2F1F5',
  secondary: '#103D5C',

  // Surfaces
  bg: '#F2F6F9',
  surface: '#FFFFFF',
  surfaceAlt: '#F7FAFC',

  // Text
  ink: '#15242E',
  inkSoft: '#4F6271',
  inkFaint: '#8497A6',

  // Lines
  border: '#E1E8EE',
  borderSoft: '#EEF2F6',

  // Semantic
  success: '#2E9E6B',
  successTint: '#E2F3EB',
  warning: '#C77A12',
  warningTint: '#FBEFD8',
  danger: '#D24A43',
  dangerTint: '#FAE3E1',
  info: '#2C7BE5',
  infoTint: '#E4EEFC',

  white: '#FFFFFF',
} as const;

/** Map a domain status string to a {color, tint} pair for badges. */
export function statusColors(status?: string): { color: string; tint: string } {
  switch ((status ?? '').toLowerCase()) {
    case 'confirmed':
    case 'active':
    case 'paid':
    case 'dispensed':
      return { color: colors.primary, tint: colors.primaryTint };
    case 'completed':
    case 'filled':
      return { color: colors.success, tint: colors.successTint };
    case 'in_progress':
    case 'pending':
    case 'urgent':
    case 'partial':
      return { color: colors.warning, tint: colors.warningTint };
    case 'cancelled':
    case 'canceled':
    case 'overdue':
    case 'failed':
      return { color: colors.danger, tint: colors.dangerTint };
    case 'scheduled':
      return { color: colors.info, tint: colors.infoTint };
    case 'draft':
    default:
      return { color: colors.inkFaint, tint: colors.borderSoft };
  }
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 14,
  pill: 999,
} as const;

export const font = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

type ShadowStyle = Pick<
  ViewStyle,
  'shadowColor' | 'shadowOffset' | 'shadowOpacity' | 'shadowRadius' | 'elevation'
>;

function makeShadow(elevation: number, opacity: number, radiusPx: number): ShadowStyle {
  return Platform.select<ShadowStyle>({
    android: { elevation },
    default: {
      shadowColor: '#0B2533',
      shadowOffset: { width: 0, height: Math.ceil(elevation / 2) },
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
    },
  })!;
}

export const shadow = {
  card: makeShadow(2, 0.06, 8),
  header: makeShadow(4, 0.1, 10),
  fab: makeShadow(6, 0.18, 12),
} as const;

export const type = {
  h1: { fontFamily: font.bold, fontSize: 26, color: colors.ink } as TextStyle,
  h2: { fontFamily: font.bold, fontSize: 20, color: colors.ink } as TextStyle,
  title: { fontFamily: font.semibold, fontSize: 16, color: colors.ink } as TextStyle,
  body: { fontFamily: font.regular, fontSize: 14, color: colors.ink } as TextStyle,
  bodyStrong: { fontFamily: font.semibold, fontSize: 14, color: colors.ink } as TextStyle,
  label: { fontFamily: font.medium, fontSize: 13, color: colors.inkSoft } as TextStyle,
  caption: { fontFamily: font.regular, fontSize: 12, color: colors.inkFaint } as TextStyle,
  overline: {
    fontFamily: font.semibold,
    fontSize: 10,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: colors.inkFaint,
  } as TextStyle,
} as const;
