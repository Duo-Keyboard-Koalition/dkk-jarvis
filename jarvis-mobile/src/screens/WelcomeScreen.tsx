import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppStore } from '../store/appStore';
import { colors, shadows, typography, borderRadius, gradients, animations } from '../utils/theme';

interface WelcomeScreenProps {
  onStart: () => void;
}

export default function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  const arrowOffset = new Animated.Value(0);
  const { setPermission } = useAppStore();

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(arrowOffset, {
          toValue: animations.arrowBounce.to,
          duration: animations.arrowBounce.duration,
          useNativeDriver: true,
        }),
        Animated.timing(arrowOffset, {
          toValue: animations.arrowBounce.from,
          duration: animations.arrowBounce.duration,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [arrowOffset]);

  // Request permissions on mount
  useEffect(() => {
    requestPermissions();
  }, []);

  const requestPermissions = async () => {
    try {
      const { Camera } = await import('expo-camera');
      const { status } = await Camera.requestCameraPermissionsAsync();
      setPermission(status === 'granted');
    } catch (error) {
      console.warn('Permission request failed:', error);
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={gradients.background}
        style={styles.background}
      >
        {/* Grid pattern overlay - SVG-like using View */}
        <View style={styles.gridOverlay} />

        {/* Glow effects */}
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />
      </LinearGradient>

      <View style={styles.content}>
        <Text style={styles.title}>
          WELCOME TO{' '}
          <Text style={styles.titleAccent}>JARVIS AR ASSISTANT</Text>
        </Text>

        {/* Cyan accent bar with glow */}
        <View style={styles.accentBar} />

        <Text style={styles.subtitle}>
          Click the{' '}
          <Text style={styles.subtitleAccent}>AR START</Text>
          {' '}button below to begin your immersive experience.
        </Text>

        <Text style={styles.footer}>
          Powered by Gemini AI · 2025
        </Text>

        {/* Animated arrow */}
        <Animated.View
          style={[
            styles.arrowContainer,
            { transform: [{ translateY: arrowOffset }] },
          ]}
        >
          <Text style={styles.arrow}>↓</Text>
        </Animated.View>

        {/* Start button */}
        <TouchableOpacity
          style={styles.buttonContainer}
          onPress={onStart}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Text style={styles.buttonText}>START AR</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFillObject,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.18,
    backgroundColor: 'transparent',
  },
  glowTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: colors.cyanGlow,
    borderRadius: borderRadius.full,
  },
  glowBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 300,
    backgroundColor: colors.magentaGlow,
    borderRadius: borderRadius.full,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  title: {
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
    fontWeight: typography.fontWeight.black,
    fontSize: typography.fontSize.xxl,
    color: colors.cyan,
    textAlign: 'center',
    letterSpacing: 2,
    ...shadows.cyanGlow,
  },
  titleAccent: {
    color: colors.magenta,
    ...shadows.magentaGlow,
  },
  accentBar: {
    width: 240,
    height: 6,
    borderRadius: borderRadius.sm,
    marginVertical: 24,
    backgroundColor: colors.transparent,
    borderWidth: 1,
    borderColor: colors.cyan,
    ...shadows.cyanGlow,
  },
  subtitle: {
    color: colors.neutral90,
    fontSize: typography.fontSize.md,
    textAlign: 'center',
    fontWeight: typography.fontWeight.medium,
    marginTop: 16,
  },
  subtitleAccent: {
    color: colors.cyan,
    fontWeight: typography.fontWeight.bold,
  },
  footer: {
    color: colors.neutral90,
    fontSize: typography.fontSize.sm,
    opacity: 0.7,
    marginTop: 32,
    letterSpacing: 1,
  },
  arrowContainer: {
    position: 'absolute',
    bottom: 100,
  },
  arrow: {
    fontSize: 56,
    color: colors.cyan,
    fontWeight: typography.fontWeight.black,
    ...shadows.cyanStrong,
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 40,
  },
  buttonGradient: {
    width: 200,
    height: 60,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.cyanGlow,
  },
  buttonText: {
    color: colors.neutral90,
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 2,
  },
});
