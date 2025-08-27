import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true, shouldPlaySound: false, shouldSetBadge: false,
    }),
});

export async function requestNotificationPermission() {
    if (Platform.OS === 'web') return;           // <-- guard
    const settings = await Notifications.getPermissionsAsync();
    if (settings.status !== 'granted') await Notifications.requestPermissionsAsync();
}

export async function ensureNotificationChannel() {
    if (Platform.OS !== 'android') return;
    await Notifications.setNotificationChannelAsync('tasks', {
        name: 'Task Alerts',
        importance: Notifications.AndroidImportance.HIGH,
    });
}

export function toTaskDate(task: { dueDate: string; dueTime: string }) {
    const [y,m,d] = task.dueDate.split('-').map(Number);
    const [H,M] = task.dueTime.split(':').map(Number);
    return new Date(y, m - 1, d, H, M, 0, 0);
}

function minusHours(date: Date, hours: number) {
    return new Date(date.getTime() - hours * 3600_000);
}

export async function scheduleTaskAlarms(task: { id: string; title: string; dueDate: string; dueTime: string }) {
    if (Platform.OS === 'web') return {};        // <-- no-op on web
    await requestNotificationPermission();
    await ensureNotificationChannel();

    const dueAt = toTaskDate(task);
    const ids: { minus24?: string; minus6?: string; minus1?: string } = {};

    const schedule = async (when: Date, subtitle: string) => {
        if (when.getTime() <= Date.now()) return undefined;
        return Notifications.scheduleNotificationAsync({
            content: { title: 'Task Reminder', body: `${task.title} — ${subtitle}` },
            trigger: when,
        });
    };

    ids.minus24 = await schedule(minusHours(dueAt, 24), '24 hours to go');
    ids.minus6  = await schedule(minusHours(dueAt, 6),  '6 hours to go');
    ids.minus1  = await schedule(minusHours(dueAt, 1),  '1 hour to go');

    return ids;
}

export async function scheduleUmbrellaAlert(task: { id: string; title: string; dueDate: string }) {
    if (Platform.OS === 'web') return undefined; // <-- no-op on web
    const [y,m,d] = task.dueDate.split('-').map(Number);
    const when = new Date(y, m - 1, d, 8, 0, 0);
    if (when.getTime() <= Date.now()) return undefined;

    return Notifications.scheduleNotificationAsync({
        content: { title: 'Weather Heads-Up', body: `Looks rainy on "${task.title}". Bring an umbrella ☔️` },
        trigger: when,
    });
}

export async function cancelTaskAlarms(ids?: { [k: string]: string | undefined }) {
    if (!ids || Platform.OS === 'web') return;   // <-- guard web
    await Promise.all(Object.values(ids).filter(Boolean).map((id) =>
        Notifications.cancelScheduledNotificationAsync(id!)
    ));
}