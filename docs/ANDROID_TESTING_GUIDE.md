# Android Testing Guide for Windows

## Quick Start: Test on Your Physical Android Device

### Option 1: Expo Go (Easiest - Recommended)

1. **Install Expo Go** on your Android phone:
   - Download from [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)

2. **Start the development server**:
   ```bash
   cd C:\Users\darcy\repos\6-DKK\DKK-Dark-Room\dkk-jarvis\jarvis-mobile
   npm start
   ```

3. **Scan the QR code**:
   - Open Expo Go app
   - Tap "Scan QR Code"
   - Scan the QR code shown in your terminal

4. **App loads on your phone!** 🎉

---

### Option 2: Android Studio Emulator (Advanced)

#### Step 1: Install Android Studio

1. Download from: https://developer.android.com/studio
2. Install with default settings
3. During installation, ensure **Android Virtual Device (AVD)** is selected

#### Step 2: Create a Virtual Device

1. Open **Android Studio**
2. Go to **Tools > Device Manager**
3. Click **Create Device**
4. Select a phone (e.g., Pixel 7)
5. Download and select a system image (Android 13 or 14)
6. Click **Finish**

#### Step 3: Start the Emulator

1. In Device Manager, click ▶️ next to your device
2. Wait for emulator to boot (first time takes 2-3 minutes)

#### Step 4: Run Expo on Emulator

```bash
cd C:\Users\darcy\repos\6-DKK\DKK-Dark-Room\dkk-jarvis\jarvis-mobile
npm run android
```

---

### Option 3: Windows Subsystem for Android (WSA)

**Note:** Microsoft is discontinuing WSA support in 2025, but it still works if already installed.

1. Check if installed: Open Start Menu, search for "Amazon Appstore"
2. If available, install Android apps via Amazon Appstore
3. For Expo Go, use **WSA Pacman** or **WSA Sideloader** to install APK

---

## Recommended Setup for Development

### Best Experience: Physical Device + USB Debugging

1. **Enable Developer Options** on your Android phone:
   - Settings > About Phone
   - Tap "Build Number" 7 times
   - Go back to Settings > System > Developer Options
   - Enable **USB Debugging**

2. **Connect via USB** to your PC

3. **Run directly**:
   ```bash
   npm run android
   ```

This gives you:
- ✅ Fastest development cycle
- ✅ Hot reload works instantly
- ✅ Real camera/microphone testing
- ✅ Accurate performance testing

---

## Troubleshooting

### "No Android device found"

1. Make sure USB Debugging is enabled
2. Try a different USB cable (some are charge-only)
3. Install Android USB drivers from your phone manufacturer

### "App crashes on startup"

1. Make sure Expo Go is updated
2. Check that your phone is on the same WiFi as your PC
3. Try: `npm start -- --tunnel`

### "Camera permission denied"

1. Go to Settings > Apps > Expo Go > Permissions
2. Enable Camera and Microphone
3. Restart the app

### "Slow loading on emulator"

Emulators are slower than physical devices. For best results:
- Allocate more RAM to emulator (4GB recommended)
- Use a **Physical Device** or **Pixel Emulator** with hardware acceleration

---

## Current Development Server

Your Expo dev server should be running. Look for output like:

```
┌────────────────────────────────────────────────────┐
│                                                    │
│   Your Expo dev server is up and running!          │
│                                                    │
│   Scan this QR code to open the project with       │
│   Expo Go on your device                           │
│                                                    │
│   ████  ████  ████  ████  ████                     │
│   ████  ████  ████  ████  ████   ← QR Code         │
│   ████  ████  ████  ████  ████                     │
│                                                    │
│   Press a │ Open Android                           │
│   Press i │ Open iOS                               │
│   Press w │ Open in browser                        │
│                                                    │
└────────────────────────────────────────────────────┘
```

---

## Next Steps

1. **Test on your phone** using Expo Go (Option 1)
2. Once comfortable, set up **Android Studio emulator** for additional testing
3. For production builds, we'll use **EAS Build** (Expo Application Services)

---

## Useful Commands

```bash
# Start dev server
npm start

# Open on Android (emulator or connected device)
npm run android

# Open on iOS simulator (macOS only)
npm run ios

# Open in web browser
npm run web

# Start with tunnel mode (for remote testing)
npm start -- --tunnel

# Clear cache and restart
npm start -- --clear
```

---

## Resources

- [Expo Documentation](https://docs.expo.dev/)
- [Android Studio Download](https://developer.android.com/studio)
- [Expo Go App (Android)](https://play.google.com/store/apps/details?id=host.exp.exponent)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
