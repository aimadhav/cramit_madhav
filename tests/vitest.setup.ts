import { vi } from 'vitest';

Object.defineProperty(globalThis, '__DEV__', {
  configurable: true,
  value: true,
  writable: true,
});

// Mock React Native
vi.mock('react-native', () => ({
  TurboModuleRegistry: {
    get: vi.fn(),
    getEnforcing: vi.fn(),
  },
  Platform: {
    OS: 'ios',
    select: vi.fn((objs) => objs.ios),
  },
  StyleSheet: {
    create: vi.fn((styles) => styles),
  },
  Alert: {
    alert: vi.fn(),
  },
}));

vi.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      scheme: 'cramit',
    },
  },
}));

vi.mock('@sentry/react-native', () => ({
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  init: vi.fn(),
  setUser: vi.fn(),
  wrap: vi.fn((component) => component),
}));

// Mock Expo SecureStore
vi.mock('expo-secure-store', () => ({
  setItemAsync: vi.fn(() => Promise.resolve()),
  getItemAsync: vi.fn(() => Promise.resolve(null)),
  deleteItemAsync: vi.fn(() => Promise.resolve()),
}));

// Mock Expo WebBrowser
vi.mock('expo-web-browser', () => ({
  maybeCompleteAuthSession: vi.fn(),
  openAuthSessionAsync: vi.fn(),
}));

// Mock Expo Auth Session
vi.mock('expo-auth-session', () => ({
  makeRedirectUri: vi.fn(() => 'myapp://redirect'),
}));

// Mock AsyncStorage
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(() => Promise.resolve(null)),
    setItem: vi.fn(() => Promise.resolve()),
    removeItem: vi.fn(() => Promise.resolve()),
    clear: vi.fn(() => Promise.resolve()),
  },
}));

// Mock Expo SQLite
vi.mock('expo-sqlite', () => ({
  openDatabaseSync: vi.fn(() => ({
    execSync: vi.fn(),
    prepareSync: vi.fn(() => ({
      get: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
      finalize: vi.fn(),
    })),
  })),
}));
