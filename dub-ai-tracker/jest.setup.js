// jest.setup.js -- Mock all native modules for DUB_AI Tracker test suite

// Variables prefixed with "mock" are allowed in jest.mock() factory functions
const mockStore = new Map();
const mockSecureStore = new Map();

// ============================================================
// AsyncStorage -- in-memory Map implementation
// ============================================================
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn((key) => {
    const val = mockStore.get(key);
    return Promise.resolve(val !== undefined ? val : null);
  }),
  setItem: jest.fn((key, value) => {
    mockStore.set(key, value);
    return Promise.resolve();
  }),
  removeItem: jest.fn((key) => {
    mockStore.delete(key);
    return Promise.resolve();
  }),
  multiGet: jest.fn((keys) => {
    const result = keys.map((k) => [k, mockStore.get(k) ?? null]);
    return Promise.resolve(result);
  }),
  multiRemove: jest.fn((keys) => {
    keys.forEach((k) => mockStore.delete(k));
    return Promise.resolve();
  }),
  getAllKeys: jest.fn(() => {
    return Promise.resolve([...mockStore.keys()]);
  }),
  clear: jest.fn(() => {
    mockStore.clear();
    return Promise.resolve();
  }),
}));

// ============================================================
// expo-secure-store
// ============================================================
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn((key) => Promise.resolve(mockSecureStore.get(key) ?? null)),
  setItemAsync: jest.fn((key, value) => {
    mockSecureStore.set(key, value);
    return Promise.resolve();
  }),
  deleteItemAsync: jest.fn((key) => {
    mockSecureStore.delete(key);
    return Promise.resolve();
  }),
}));

// ============================================================
// expo-local-authentication
// ============================================================
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: jest.fn(() => Promise.resolve(true)),
  isEnrolledAsync: jest.fn(() => Promise.resolve(true)),
  supportedAuthenticationTypesAsync: jest.fn(() => Promise.resolve([1])),
  authenticateAsync: jest.fn(() => Promise.resolve({ success: true })),
  AuthenticationType: {
    FINGERPRINT: 1,
    FACIAL_RECOGNITION: 2,
    IRIS: 3,
  },
}));

// ============================================================
// expo-crypto
// ============================================================
jest.mock('expo-crypto', () => {
  let randomCounter = 0;
  return {
    digestStringAsync: jest.fn((algo, data) => Promise.resolve(`hash_${data}`)),
    getRandomBytesAsync: jest.fn((n) => {
      // Deterministic distinct bytes across calls so salts differ per "user"
      randomCounter = (randomCounter + 1) & 0xff;
      const bytes = new Uint8Array(n);
      for (let i = 0; i < n; i++) bytes[i] = (randomCounter + i) & 0xff;
      return Promise.resolve(bytes);
    }),
    CryptoDigestAlgorithm: {
      SHA256: 'SHA-256',
    },
  };
});

// ============================================================
// expo-haptics
// ============================================================
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'Light', Medium: 'Medium', Heavy: 'Heavy' },
  NotificationFeedbackType: { Success: 'Success', Error: 'Error', Warning: 'Warning' },
}));

// ============================================================
// expo-camera
// ============================================================
jest.mock('expo-camera', () => ({
  Camera: {
    requestCameraPermissionsAsync: jest.fn(() =>
      Promise.resolve({ status: 'granted' })
    ),
  },
  CameraView: 'CameraView',
  useCameraPermissions: jest.fn(() => [{ granted: true }, jest.fn()]),
}));

// ============================================================
// expo-notifications
// ============================================================
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  requestPermissionsAsync: jest.fn(() => Promise.resolve({ status: 'granted' })),
  scheduleNotificationAsync: jest.fn(() => Promise.resolve('mock-notif-id')),
  cancelScheduledNotificationAsync: jest.fn(() => Promise.resolve()),
  cancelAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve()),
  getAllScheduledNotificationsAsync: jest.fn(() => Promise.resolve([])),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve()),
  AndroidImportance: { DEFAULT: 3, LOW: 2, HIGH: 4 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
  setBadgeCountAsync: jest.fn(() => Promise.resolve()),
}));

// ============================================================
// expo-file-system
// ============================================================
jest.mock('expo-file-system', () => ({
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  readAsStringAsync: jest.fn(() => Promise.resolve('')),
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
  deleteAsync: jest.fn(() => Promise.resolve()),
  getInfoAsync: jest.fn(() => Promise.resolve({ exists: false })),
  makeDirectoryAsync: jest.fn(() => Promise.resolve()),
}));

// ============================================================
// expo-print
// ============================================================
jest.mock('expo-print', () => ({
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: '/mock/report.pdf' })),
  printAsync: jest.fn(() => Promise.resolve()),
}));

// ============================================================
// expo-sharing
// ============================================================
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

// ============================================================
// expo-clipboard
// ============================================================
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(() => Promise.resolve()),
  getStringAsync: jest.fn(() => Promise.resolve('')),
}));

// ============================================================
// expo-image-picker
// ============================================================
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(() =>
    Promise.resolve({ canceled: true, assets: [] })
  ),
  launchCameraAsync: jest.fn(() =>
    Promise.resolve({ canceled: true, assets: [] })
  ),
  requestMediaLibraryPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  requestCameraPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted' })
  ),
  MediaTypeOptions: { Images: 'Images' },
}));

// ============================================================
// expo-linking
// ============================================================
jest.mock('expo-linking', () => ({
  openURL: jest.fn(() => Promise.resolve()),
  canOpenURL: jest.fn(() => Promise.resolve(true)),
  createURL: jest.fn((path) => `exp://mock/${path}`),
}));

// ============================================================
// react-native-health
// ============================================================
jest.mock('react-native-health', () => ({
  default: {
    initHealthKit: jest.fn((opts, cb) => cb(null)),
    getAuthStatus: jest.fn((opts, cb) => cb(null, { permissions: { read: [], write: [] } })),
  },
  HealthKitDataType: {},
}));

// ============================================================
// react-native-health-connect
// ============================================================
jest.mock('react-native-health-connect', () => ({
  initialize: jest.fn(() => Promise.resolve(true)),
  requestPermission: jest.fn(() => Promise.resolve([])),
  readRecords: jest.fn(() => Promise.resolve([])),
  getSdkStatus: jest.fn(() => Promise.resolve(3)),
  SdkAvailabilityStatus: { SDK_AVAILABLE: 3 },
}));

// ============================================================
// react-native-aes-crypto
// ============================================================
jest.mock('react-native-aes-crypto', () => ({
  pbkdf2: jest.fn((password, salt, iterations, keyLength, hash) =>
    Promise.resolve(`derived_key_${password}_${salt}`)
  ),
  encrypt: jest.fn((text, key, iv, algo) =>
    Promise.resolve(`encrypted_${text}`)
  ),
  decrypt: jest.fn((ciphertext, key, iv, algo) => {
    const match = ciphertext.match(/^encrypted_(.+)$/);
    return Promise.resolve(match ? match[1] : 'decrypted');
  }),
  randomKey: jest.fn((length) =>
    Promise.resolve('a'.repeat(length * 2))
  ),
}));

// ============================================================
// react-native-reanimated
// ============================================================
jest.mock('react-native-reanimated', () => {
  return {
    default: { call: () => {}, Value: jest.fn(), event: jest.fn(), add: jest.fn(), eq: jest.fn(), set: jest.fn(), cond: jest.fn(), interpolate: jest.fn(), Extrapolate: { CLAMP: 'clamp' } },
    useSharedValue: jest.fn((init) => ({ value: init })),
    useAnimatedStyle: jest.fn(() => ({})),
    withTiming: jest.fn((val) => val),
    withSpring: jest.fn((val) => val),
    withRepeat: jest.fn((val) => val),
    withSequence: jest.fn((val) => val),
    withDelay: jest.fn((delay, val) => val),
    Easing: { linear: jest.fn(), ease: jest.fn(), bezier: jest.fn(() => jest.fn()) },
    FadeIn: { duration: jest.fn(() => ({})) },
    FadeOut: { duration: jest.fn(() => ({})) },
    SlideInRight: { duration: jest.fn(() => ({})) },
    SlideOutLeft: { duration: jest.fn(() => ({})) },
    Layout: {},
    cancelAnimation: jest.fn(),
    createAnimatedComponent: jest.fn((comp) => comp),
  };
});

// ============================================================
// react-native-svg
// ============================================================
jest.mock('react-native-svg', () => {
  const mockSvgElements = [
    'Svg', 'Circle', 'Rect', 'Path', 'Line', 'Text', 'G',
    'Defs', 'LinearGradient', 'Stop', 'ClipPath', 'Polygon',
    'Polyline', 'Ellipse', 'TSpan', 'ForeignObject',
  ];
  const mockSvg = {};
  mockSvgElements.forEach((name) => {
    mockSvg[name] = name;
  });
  mockSvg.default = 'Svg';
  return mockSvg;
});

// ============================================================
// react-native-gesture-handler
// ============================================================
jest.mock('react-native-gesture-handler', () => {
  const View = require('react-native').View;
  return {
    GestureHandlerRootView: View,
    Swipeable: View,
    DrawerLayout: View,
    State: {},
    ScrollView: View,
    PanGestureHandler: View,
    TapGestureHandler: View,
    FlingGestureHandler: View,
    ForceTouchGestureHandler: View,
    LongPressGestureHandler: View,
    NativeViewGestureHandler: View,
    PinchGestureHandler: View,
    RotationGestureHandler: View,
    BaseButton: View,
    RectButton: View,
    BorderlessButton: View,
    Directions: {},
    gestureHandlerRootHOC: jest.fn((component) => component),
  };
});

// NativeAnimatedHelper mock removed -- not needed for RN 0.83+

// ============================================================
// @expo/vector-icons
// ============================================================
jest.mock('@expo/vector-icons', () => {
  const mockIconFn = (name) => {
    const component = (props) => require('react').createElement('Text', props, props.name);
    component.displayName = name;
    return component;
  };
  return {
    Ionicons: mockIconFn('Ionicons'),
    MaterialIcons: mockIconFn('MaterialIcons'),
    MaterialCommunityIcons: mockIconFn('MaterialCommunityIcons'),
    FontAwesome: mockIconFn('FontAwesome'),
    FontAwesome5: mockIconFn('FontAwesome5'),
    Feather: mockIconFn('Feather'),
    AntDesign: mockIconFn('AntDesign'),
    Entypo: mockIconFn('Entypo'),
    EvilIcons: mockIconFn('EvilIcons'),
    Foundation: mockIconFn('Foundation'),
    Octicons: mockIconFn('Octicons'),
    SimpleLineIcons: mockIconFn('SimpleLineIcons'),
    Zocial: mockIconFn('Zocial'),
    createIconSet: jest.fn(() => mockIconFn('Custom')),
    createIconSetFromFontello: jest.fn(() => mockIconFn('Fontello')),
    createIconSetFromIcoMoon: jest.fn(() => mockIconFn('IcoMoon')),
  };
});

// ============================================================
// expo-linear-gradient
// ============================================================
jest.mock('expo-linear-gradient', () => {
  const View = require('react-native').View;
  return {
    LinearGradient: View,
  };
});

// ============================================================
// expo-tracking-transparency
// ============================================================
jest.mock('expo-tracking-transparency', () => ({
  getTrackingPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' })
  ),
  requestTrackingPermissionsAsync: jest.fn(() =>
    Promise.resolve({ status: 'granted', granted: true, canAskAgain: true, expires: 'never' })
  ),
}));

// ============================================================
// expo-router (prevent route crashes in tests)
// ============================================================
jest.mock('expo-router', () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() })),
  useLocalSearchParams: jest.fn(() => ({})),
  useSegments: jest.fn(() => []),
  useFocusEffect: jest.fn((cb) => {
    const { useEffect } = require('react');
    useEffect(() => { cb(); }, []);
  }),
  Link: 'Link',
  Stack: { Screen: 'Screen' },
  Tabs: { Screen: 'Screen' },
}));

// ============================================================
// react-native Platform mock
// ============================================================
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((obj) => obj.ios ?? obj.default),
}));

// Also inject Platform into the react-native module for `import { Platform } from 'react-native'`
const RN = require('react-native');
if (!RN.Platform || !RN.Platform.OS) {
  RN.Platform = { OS: 'ios', select: (obj) => obj.ios ?? obj.default };
}
if (!RN.UIManager) {
  RN.UIManager = { setLayoutAnimationEnabledExperimental: undefined };
}
if (!RN.LayoutAnimation) {
  RN.LayoutAnimation = {
    configureNext: jest.fn(),
    Presets: { easeInEaseOut: {} },
  };
}

// ============================================================
// Global fetch mock
// ============================================================
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
    status: 200,
  })
);

// Expose stores globally so setupFilesAfterEnv can clear them between tests
global.__mockStore = mockStore;
global.__mockSecureStore = mockSecureStore;
