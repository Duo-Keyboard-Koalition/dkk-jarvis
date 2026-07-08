# JARVIS AR Assistant - React Native Mobile App

A React Native mobile application for JARVIS AR Assistant, built with Expo.

## 🎯 Vision

**The Ultimate Networking Assistant**

JARVIS for networking is designed to revolutionize how professionals connect at events. When you scan someone's face, JARVIS will:

1. **Recognize** the person instantly
2. **Connect** you with their profile from the DKK platform
3. **Recall** past conversations and context
4. **Map** conversation topics to the person for intelligent follow-ups

## Features

- 🎥 AR camera view with 3D rendering
- 🎨 Cyberpunk-themed UI
- 🔘 Voice recording controls
- 📱 iOS and Android support
- ✨ Native performance

## Tech Stack

- **React Native** with Expo SDK 54
- **TypeScript** for type safety
- **expo-camera** for camera access
- **expo-gl** for 3D rendering with Three.js
- **expo-av** for audio recording/playback
- **Zustand** for state management
- **Three.js** for 3D graphics

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator
- Expo Go app (for testing on physical device)

### Installation

```bash
cd jarvis-mobile
npm install
```

### Running the App

```bash
# Start the development server
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android

# Run on web browser
npm run web
```

### Building for Production

```bash
# Build for iOS
eas build --platform ios

# Build for Android
eas build --platform android
```

## Project Structure

```
jarvis-mobile/
├── App.tsx                 # Main app entry
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── ARScene.tsx    # AR camera view with 3D
│   │   └── ControlTray.tsx # Control buttons
│   ├── screens/           # Screen components
│   │   └── WelcomeScreen.tsx
│   ├── store/             # Zustand state management
│   │   └── appStore.ts
│   ├── hooks/             # Custom React hooks
│   └── utils/             # Utility functions
└── assets/                # Images and fonts
```

## Configuration

### Camera & Microphone Permissions

The app requires camera and microphone permissions:

- **iOS**: Configured in `app.json` under `ios.infoPlist`
- **Android**: Configured in `app.json` under `android.permissions`

### Customization

Edit `app.json` to change:
- App name and slug
- Bundle identifier
- App icon and splash screen
- Theme colors

## Next Steps

To add AI functionality:
1. Integrate your preferred AI API (the original Gemini code has been removed)
2. Add voice recognition using `expo-speech` or a third-party service
3. Implement real-time audio streaming

## Troubleshooting

### Camera not working
- Ensure permissions are granted in device settings
- Try rebuilding the app after permission changes

### 3D rendering issues
- Make sure your device supports WebGL
- Try running on a physical device instead of emulator

## License

MIT

## 📚 Documentation

For detailed guides and planning documents, see the `docs/` folder at the repository root:

- **[Android Testing Guide](../docs/ANDROID_TESTING_GUIDE.md)** - How to test on Android devices and emulators
- **[Future Roadmap](../docs/FUTURE_ROADMAP.md)** - Complete vision and technical architecture
