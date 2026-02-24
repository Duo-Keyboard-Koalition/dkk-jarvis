import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { colors, gradients, borderRadius, shadows } from '../utils/theme';

interface ControlTrayProps {
  isRecording: boolean;
  onToggleRecording: () => void;
  onEndSession?: () => void;
}

export default function ControlTray({
  isRecording,
  onToggleRecording,
  onEndSession
}: ControlTrayProps) {
  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        {/* Record button */}
        <TouchableOpacity
          style={styles.button}
          onPress={onToggleRecording}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={isRecording ? gradients.danger : gradients.success}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.buttonGradient}
          >
            <Ionicons
              name={isRecording ? 'stop' : 'mic'}
              size={24}
              color={colors.neutral0}
            />
          </LinearGradient>
        </TouchableOpacity>

        {/* End session button */}
        {onEndSession && (
          <TouchableOpacity
            style={styles.button}
            onPress={onEndSession}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={gradients.danger}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Ionicons name="close" size={24} color={colors.neutral0} />
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.overlayDark,
    borderTopWidth: 1,
    borderTopColor: colors.cyan,
    paddingVertical: 16,
    paddingHorizontal: 24,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  button: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  buttonGradient: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    ...shadows.cyanGlow,
  },
});
