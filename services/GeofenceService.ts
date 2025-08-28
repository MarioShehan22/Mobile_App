import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { ensureLocationPermissions } from '@/services/permissions';

export const GEOFENCE_TASK = 'task-geofencing';

type GeofenceTaskData = {
    eventType: Location.GeofencingEventType;
    region: Location.LocationRegion; // { identifier, latitude, longitude, radius }
};

// Make sure this file is imported once on app startup so the task is defined.
//@ts-ignore
TaskManager.defineTask(GEOFENCE_TASK, ({ data, error }) => {
    if (error) return;

    const { eventType, region } = (data || {}) as GeofenceTaskData;
    if (!region) return;

    // We stored JSON in identifier when starting the geofence
    let payload: { taskId?: string; title?: string } = {};
    try {
        //@ts-ignore
        payload = JSON.parse(region.identifier);
    } catch {}

    // Prefer checking the event type
    if (eventType === Location.GeofencingEventType.Enter) {
        return Notifications.scheduleNotificationAsync({
            content: {
                title: 'You’re nearby',
                body: `You are close to: ${payload.title ?? 'task location'}`,
            },
            trigger: null,
        });
    }

    return;
});

export async function requestLocationPermissions() {
    if (Platform.OS === 'web') return false;
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return false;
    const bg = await Location.requestBackgroundPermissionsAsync();
    return bg.status === 'granted';
}

export async function startGeofenceForTask(task: {
    id: string; title: string; location: { lat: number; lng: number; radius?: number }
}) {
    if (Platform.OS === 'web') return undefined;

    const ok = await ensureLocationPermissions({ needsBackground: true });
    if (!ok) return;

    const radius = task.location.radius ?? 1000; // 1km default

    const identifier = JSON.stringify({ taskId: task.id, title: task.title }).slice(0, 200);

    await Location.startGeofencingAsync(GEOFENCE_TASK, [
        {
            identifier,
            latitude: task.location.lat,
            longitude: task.location.lng,
            radius,
            notifyOnEnter: true,
            notifyOnExit: false,
        },
    ]);

    return identifier;
}

export async function stopAllGeofences() {
    if (Platform.OS === 'web') return;
    const started = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK);
    if (started) await Location.stopGeofencingAsync(GEOFENCE_TASK);
}
