import '@testing-library/jest-native/extend-expect';
import 'whatwg-fetch';
import { jest } from '@jest/globals';

// --- React Native bridge bits that often need stubbing
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper', () => ({}));

// --- Expo Router (optional)
jest.mock('expo-router', () => ({
    useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
    router: { push: jest.fn(), back: jest.fn() },
}));

// --- Expo Location
jest.mock('expo-location', () => ({
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    requestBackgroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    getCurrentPositionAsync: jest.fn(async () => ({
        coords: { latitude: 6.9271, longitude: 79.8612 },
    })),
    reverseGeocodeAsync: jest.fn(async () => [
        { name: 'Road', street: 'Galle Rd', city: 'Colombo', region: 'Western' },
    ]),
    hasStartedGeofencingAsync: jest.fn(async () => false),
    startGeofencingAsync: jest.fn(async () => {}),
    stopGeofencingAsync: jest.fn(async () => {}),
    GeofencingEventType: { Enter: 1, Exit: 2 },
    GeofencingRegionState: { Inside: 1, Outside: 2, Unknown: 0 },
}));

// --- Expo Notifications
jest.mock('expo-notifications', () => ({
    scheduleNotificationAsync: jest.fn(async () => ({ identifier: 'notif-1' })),
    cancelScheduledNotificationAsync: jest.fn(async () => {}),
    setNotificationHandler: jest.fn(),
}));

// --- Firebase: mock the specific functions your screens call

// Mock auth object returned by "@/constants/firebaseConfig"
jest.mock('@/constants/firebaseConfig', () => {
    return {
        app: {},
        auth: { currentUser: { uid: 'test-uid' } },
        db: {},
    };
});

// Firestore functions used in your components/services
jest.mock('firebase/firestore', () => {
    const listeners: Array<(qs: any) => void> = [];

    const fakeDoc = (id: string, data: any) => ({
        id,
        data: () => data,
    });

    const api: any = {
        // creators
        collection: jest.fn((db, path) => ({ __path: path })),
        doc: jest.fn((db, path, id) => ({ __path: `${path}/${id}`, id })),
        // queries
        query: jest.fn((...args) => ({ __query: args })),
        where: jest.fn((f, op, v) => ({ where: [f, op, v] })),
        orderBy: jest.fn((f, dir) => ({ orderBy: [f, dir] })),
        // realtime
        onSnapshot: jest.fn((q: any, cb: any, errCb?: any) => {
            listeners.push(cb);
            // default empty snapshot
            cb({
                forEach: (fn: any) => {},
            });
            return jest.fn(); // unsubscribe
        }),
        // document ops
        setDoc: jest.fn(async () => {}),
        updateDoc: jest.fn(async () => {}),
        deleteDoc: jest.fn(async () => {}),
        addDoc: jest.fn(async (colRef, data) => ({ id: 'loc-1', ...data })),
        getDocs: jest.fn(async () => ({
            forEach: (fn: any) => {},
        })),
        serverTimestamp: jest.fn(() => new Date()),
        Timestamp: { now: () => ({ seconds: Date.now() / 1000 }) },

        // helpers for tests to push snapshots
        __pushTasksSnapshot: (items: any[]) => {
            const qs = {
                forEach: (fn: any) => items.map((it, i) => fn(fakeDoc(it.id ?? `id-${i}`, it))),
            };
            listeners.forEach((cb) => cb(qs));
        },
    };

    return api;
});
