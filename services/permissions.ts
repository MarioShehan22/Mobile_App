// services/permissions.ts
import * as Location from 'expo-location';
import { Alert, Linking, Platform } from 'react-native';

type EnsureOpts = {
    needsBackground?: boolean; // true for geofencing
    rationaleTitle?: string;
    rationaleBody?: string;
};

export async function ensureLocationPermissions(opts: EnsureOpts = {}): Promise<boolean> {
    const {
        needsBackground = true,
        rationaleTitle = 'Allow location access',
        rationaleBody =
            'We use your location to remind you when you’re near a task location. You can change this anytime in Settings.',
    } = opts;

    if (Platform.OS === 'web') return false;

    // Optional pre-prompt you control (your “OK”)
    // You can skip this if you already explain elsewhere.
    const proceed = await new Promise<boolean>((resolve) => {
        Alert.alert(rationaleTitle, rationaleBody, [
            { text: 'Not now', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continue', onPress: () => resolve(true) },
        ]);
    });
    if (!proceed) return false;

    // 1) Foreground
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') {
        // iOS/Android both: user declined
        return false;
    }

    if (!needsBackground) return true;

    // 2) Background (needed for geofencing)
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status === 'granted') return true;

    // Some OS versions don’t show another prompt; you must guide user to Settings.
    // This applies to **both iOS and Android**.
    if (!bg.canAskAgain) {
        Alert.alert(
            'Enable background location',
            'To trigger reminders near a task, enable “Allow all the time” / “Always Allow” in Settings.',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Open Settings', onPress: () => Linking.openSettings() },
            ]
        );
    } else {
        Alert.alert(
            'Background location needed',
            'Please choose “Allow all the time” (Android) or “Always” (iOS) so geofencing works when the app is closed.'
        );
    }

    return false;
}