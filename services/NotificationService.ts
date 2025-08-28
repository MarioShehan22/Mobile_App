import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Show alerts in foreground too (both iOS & Android)
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
        // keep TS happy on newer SDKs:
        shouldShowBanner: true,
        shouldShowList: true,
    }),
});

// 1) ALWAYS ask permission (Android 13+ needs it)
export async function requestNotificationPermission() {
    const current = await Notifications.getPermissionsAsync();
    if (current.status !== 'granted' && current.canAskAgain) {
        await Notifications.requestPermissionsAsync();
    }
}

// 2) Create a usable default channel (and an extra "tasks" channel)
export async function ensureNotificationChannels() {
    if (Platform.OS !== 'android') return;

    // default channel – many APIs fall back to this name
    await Notifications.setNotificationChannelAsync('default', {
        name: 'Default',
        importance: Notifications.AndroidImportance.DEFAULT,
    });

    // your "tasks" channel (higher priority)
    await Notifications.setNotificationChannelAsync('tasks', {
        name: 'Task Alerts',
        description: 'Reminders and task-related alerts',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 300, 150, 300],
        lightColor: '#007AFF',
    });
}

// Small helper: ensure the date is in the future (at least +5s)
function futureDate(d: Date) {
    const min = Date.now() + 5000;
    return new Date(Math.max(d.getTime(), min));
}

export function toTaskDate(task: { dueDate: string; dueTime: string }) {
    const [y, m, d] = task.dueDate.split('-').map(Number);
    const [H, M] = task.dueTime.split(':').map(Number);
    return new Date(y, m - 1, d, H, M, 0, 0);
}

function minus(date: Date, ms: number) {
    return new Date(date.getTime() - ms);
}

export async function scheduleTaskAlarms(task: {
    id: string; title: string; dueDate: string; dueTime: string;
}) {
    await requestNotificationPermission();
    await ensureNotificationChannels();

    const dueAt = toTaskDate(task);
    const ids: Record<string, string> = {};

    const schedule = async (when: Date, subtitle: string) => {
        //const at = futureDate(when);
        return Notifications.scheduleNotificationAsync({
            content: {
                title: `⏰ ${task.title}`,
                categoryIdentifier: 'TASK_REMINDER',
                sound: 'default',
            },
            // IMPORTANT: use object trigger; add channelId for Android
            // @ts-ignore types accept channelId on Android
            trigger: { seconds: 5 * 60, channelId: Platform.OS === 'android' ? 'tasks' : undefined },
        });
    };

    const dayMs = 24 * 60 * 60 * 1000;
    const hourMs = 60 * 60 * 1000;
    const min5Ms = 5 * 60 * 1000;

    // 6 hours before
    const id6 = await schedule(minus(dueAt, 6 * hourMs), '6 hours to go');
    if (id6) ids.minus6 = id6;

    // 1 hour before
    const id1 = await schedule(minus(dueAt, 1 * hourMs), '1 hour to go');
    if (id1) ids.minus1 = id1;

    // 5 minutes before
    const id5 = await schedule(minus(dueAt, min5Ms), '5 minutes to go');
    if (id5) ids.minus5min = id5;

    return ids;
}

export async function scheduleUmbrellaAlert(task: {
    id: string; title: string; dueDate: string;
}) {
    await requestNotificationPermission();
    await ensureNotificationChannels();

    const [y, m, d] = task.dueDate.split('-').map(Number);
    const when = futureDate(new Date(y, m - 1, d, 8, 0, 0));

    return Notifications.scheduleNotificationAsync({
        content: {
            title: 'Weather Heads-Up',
            body: `Looks rainy on "${task.title}". Bring an umbrella ☔️`,
        },
        // @ts-ignore
        trigger: Platform.OS === 'android'
            ? { channelId: 'tasks', date: when }
            : { date: when },
    });
}

export async function cancelTaskAlarms(ids?: Record<string, string | undefined>) {
    if (!ids) return;
    await Promise.all(
        Object.values(ids)
            .filter((id): id is string => !!id)
            .map((id) => Notifications.cancelScheduledNotificationAsync(id))
    );
}