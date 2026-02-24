/**
 * JARVIS Mobile Theme
 * Migrated from web styling - Cyberpunk/Neon aesthetic
 */

import { ColorValue } from 'react-native';

export const colors = {
  // Primary accent colors
  cyan: '#00fff7',
  magenta: '#ff00ea',
  red: '#ff4600',
  red400: '#ff9c7a',
  red600: '#e03c00',
  red700: '#bd3000',

  // Blue variants
  blue400: '#80c1ff',
  blue500: '#1f94ff',
  blue800: '#0f3557',

  // Green variants
  green500: '#0d9c53',
  green700: '#025022',

  // Neutral colors (dark theme)
  neutral0: '#000000',
  neutral5: '#181a1b',
  neutral10: '#1c1f21',
  neutral15: '#232729',
  neutral20: '#2a2f31',
  neutral30: '#404547',
  neutral50: '#707577',
  neutral60: '#888d8f',
  neutral80: '#c3c6c7',
  neutral90: '#e1e2e3',

  // Gradient backgrounds
  gradientStart: '#1a0033',
  gradientMiddle: '#0f0020',
  gradientEnd: '#000000',

  // Transparency
  transparent: 'transparent',
  overlayDark: 'rgba(0, 0, 0, 0.8)',
  cyanGlow: 'rgba(0, 255, 247, 0.1)',
  magentaGlow: 'rgba(255, 0, 234, 0.1)',
} as const satisfies Record<string, ColorValue>;

export const shadows = {
  cyanGlow: {
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  magentaGlow: {
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  cyanStrong: {
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 24,
    elevation: 12,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const borderRadius = {
  sm: 4,
  md: 8,
  lg: 16,
  xl: 18,
  xxl: 27,
  full: 9999,
};

export const typography = {
  // Font families (React Native will use system fonts)
  fontFamily: {
    mono: 'Space Mono',
    display: 'System', // Fallback for Orbitron-like display font
  },
  fontWeight: {
    regular: '400' as const,
    medium: '600' as const,
    bold: '700' as const,
    black: '900' as const,
  },
  fontSize: {
    xs: 11,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 24,
    xxl: 32,
    xxxl: 48,
  },
};

export const animations = {
  arrowBounce: {
    from: 0,
    to: 18,
    duration: 600,
  },
  opacityPulse: {
    duration: 3000,
    easing: 'ease-in',
  },
  fastTransition: 200,
  slowTransition: 600,
};

export const gradients = {
  primary: [colors.cyan, colors.magenta] as const,
  background: [colors.gradientStart, colors.gradientMiddle, colors.gradientEnd] as const,
  danger: [colors.red, colors.magenta] as const,
  success: [colors.cyan, colors.green500] as const,
  accentBar: [colors.cyan, colors.magenta] as const,
};

export const borders = {
  cyan: {
    borderColor: colors.cyan,
    borderWidth: 2,
  },
  neutral30: {
    borderColor: colors.neutral30,
    borderWidth: 1,
  },
};
