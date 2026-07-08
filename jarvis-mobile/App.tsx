import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';
import WelcomeScreen from './src/screens/WelcomeScreen';
import ARScene from './src/components/ARScene';
import ControlTray from './src/components/ControlTray';
import { useAppStore } from './src/store/appStore';
import { colors } from './src/utils/theme';

export default function App() {
  const [showAR, setShowAR] = useState(false);
  const { isRecording, setRecording } = useAppStore();

  const handleStartSession = () => {
    setShowAR(true);
  };

  const handleEndSession = () => {
    setShowAR(false);
    setRecording(false);
  };

  const handleToggleRecording = () => {
    setRecording(!isRecording);
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {!showAR ? (
        <WelcomeScreen onStart={handleStartSession} />
      ) : (
        <>
          <ARScene
            onSessionStart={handleStartSession}
            onSessionEnd={handleEndSession}
          />
          <ControlTray
            isRecording={isRecording}
            onToggleRecording={handleToggleRecording}
            onEndSession={handleEndSession}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.neutral0,
  },
});
