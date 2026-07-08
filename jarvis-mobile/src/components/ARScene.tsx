import React, { useRef, useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { GLView } from 'expo-gl';
import { Scene, PerspectiveCamera, BoxGeometry, MeshBasicMaterial, Mesh } from 'three';
import { useAppStore } from '../store/appStore';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, borderRadius, typography, shadows } from '../utils/theme';

interface ARSceneProps {
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
}

export default function ARScene({ onSessionStart, onSessionEnd }: ARSceneProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const { setSessionActive } = useAppStore();
  const [showAR, setShowAR] = useState(false);
  const meshRef = useRef<Mesh | null>(null);

  useEffect(() => {
    if (permission?.granted && !showAR) {
      setShowAR(true);
      onSessionStart?.();
      setSessionActive(true);
    }
  }, [permission]);

  useEffect(() => {
    return () => {
      setSessionActive(false);
      onSessionEnd?.();
    };
  }, []);

  const handleEndSession = () => {
    setShowAR(false);
    setSessionActive(false);
    onSessionEnd?.();
  };

  const onGLContextCreate = async (gl: any) => {
    const { drawingBufferWidth, drawingBufferHeight } = gl;

    const scene = new Scene();
    const camera = new PerspectiveCamera(75, drawingBufferWidth / drawingBufferHeight, 0.1, 1000);
    camera.position.z = 5;

    // Create a rotating cube
    const geometry = new BoxGeometry(1, 1, 1);
    const material = new MeshBasicMaterial({
      color: 0x00fff7,
      wireframe: true,
    });
    const cube = new Mesh(geometry, material);
    meshRef.current = cube;
    scene.add(cube);

    const render = () => {
      gl.render((gl: any) => {
        if (meshRef.current) {
          meshRef.current.rotation.x += 0.01;
          meshRef.current.rotation.y += 0.01;
        }
      }, scene, camera);
      gl.endFrameEXP();
      requestAnimationFrame(render);
    };

    render();
  };

  if (!permission) {
    return <View style={styles.container} />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>
            Camera permission is required for AR features
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermission}
          >
            <LinearGradient
              colors={gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Grant Permission</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing="back">
        {showAR && (
          <GLView
            style={styles.glView}
            onContextCreate={onGLContextCreate}
          />
        )}
      </CameraView>

      {/* Control overlay */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.endButton}
          onPress={handleEndSession}
        >
          <LinearGradient
            colors={gradients.danger}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.endButtonGradient}
          >
            <Text style={styles.buttonText}>END SESSION</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* Cyberpunk border */}
      <View style={styles.borderTop} />
      <View style={styles.borderBottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral0,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    backgroundColor: colors.gradientMiddle,
  },
  permissionText: {
    color: colors.neutral90,
    fontSize: typography.fontSize.lg,
    textAlign: 'center',
    marginBottom: 24,
  },
  permissionButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    ...shadows.cyanGlow,
  },
  buttonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: borderRadius.full,
  },
  buttonText: {
    color: colors.neutral90,
    fontSize: typography.fontSize.md,
    fontWeight: typography.fontWeight.bold,
    letterSpacing: 1,
  },
  camera: {
    flex: 1,
  },
  glView: {
    flex: 1,
    backgroundColor: colors.transparent,
  },
  controls: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  endButton: {
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    ...shadows.magentaGlow,
  },
  endButtonGradient: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: borderRadius.full,
  },
  borderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.cyan,
    shadowColor: colors.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
  borderBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: colors.magenta,
    shadowColor: colors.magenta,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 4,
  },
});
