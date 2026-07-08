import { create } from 'zustand';

interface AppState {
  isSessionActive: boolean;
  isRecording: boolean;
  hasPermission: boolean;
  setSessionActive: (active: boolean) => void;
  setRecording: (recording: boolean) => void;
  setPermission: (hasPermission: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  isSessionActive: false,
  isRecording: false,
  hasPermission: false,
  setSessionActive: (active) => set({ isSessionActive: active }),
  setRecording: (recording) => set({ isRecording: recording }),
  setPermission: (hasPermission) => set({ hasPermission }),
}));
