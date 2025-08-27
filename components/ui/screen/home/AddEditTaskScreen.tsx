import React, {useMemo, useState} from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, ActivityIndicator } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth, db } from '@/constants/firebaseConfig';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { scheduleTaskAlarms, cancelTaskAlarms, scheduleUmbrellaAlert } from '@/services/NotificationService';
import { startGeofenceForTask } from '@/services/GeofenceService';
import { willLikelyRainOnDate } from '@/services/WeatherService';

// ✅ Support expo-router (if you're using it)
let router: { back: () => void } | null = null;
try {
    router = require('expo-router').router;
} catch (_) {
    router = null;
}
const fmtYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};
const fmtHM = (d: Date) => {
    const H = String(d.getHours()).padStart(2, '0');
    const M = String(d.getMinutes()).padStart(2, '0');
    return `${H}:${M}`;
};
const parseYMD = (s: string) => {
    const [y, m, d] = s.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};
const parseHM = (s: string, base: Date) => {
    const [h, m] = s.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const t = new Date(base);
    t.setHours(h, m, 0, 0);
    return t;
};

interface AddEditTaskScreenProps { navigation: any; route: any; }

type PickedLocation = { description: string; lat: number; lng: number } | undefined;

export default function AddEditTaskScreen({ navigation, route }: AddEditTaskScreenProps) {
    const existingTask = route?.params?.task;
    const isEditing = !!existingTask;

    const [title, setTitle] = useState(existingTask?.title || '');

    const initDate = useMemo(
        () => (existingTask?.dueDate ? parseYMD(existingTask.dueDate) ?? new Date() : new Date()),
        [existingTask?.dueDate]
    );

    const initTime = useMemo(
        () =>
            existingTask?.dueTime
                ? parseHM(existingTask.dueTime, new Date()) ?? new Date('2000-01-01T09:00:00')
                : new Date('2000-01-01T09:00:00'),
        [existingTask?.dueTime]
    );

    const formatYMDInput = (raw: string) => {
        const only = raw.replace(/\D/g, '').slice(0, 8); // max 8 digits
        if (only.length <= 4) return only;                        // YYYY
        if (only.length <= 6) return `${only.slice(0,4)}-${only.slice(4)}`;            // YYYY-MM
        return `${only.slice(0,4)}-${only.slice(4,6)}-${only.slice(6,8)}`;            // YYYY-MM-DD
    };

    const isValidYMD = (y: number, m: number, d: number) => {
        if (m < 1 || m > 12) return false;
        const maxDay = new Date(y, m, 0).getDate(); // last day of month
        return d >= 1 && d <= maxDay;
    };

    const handleDueDateChange = (text: string) => {
        const formatted = formatYMDInput(text);
        setDueDateInput(formatted);

        // When complete, try to set the Date state
        const m = formatted.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
            const y = +m[1], mo = +m[2], d = +m[3];
            if (isValidYMD(y, mo, d)) {
                setDueDate(new Date(y, mo - 1, d));
            }
        }
    };

    const [dueDate, setDueDate] = useState(initDate);
    const [dueTime, setDueTime] = useState(initTime);
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(existingTask?.priority || 'medium');
    const [hasLocation, setHasLocation] = useState<boolean>(existingTask?.hasLocation ?? false);
    const [hasWeather, setHasWeather] = useState<boolean>(existingTask?.hasWeather ?? false);

    const [dueDateInput, setDueDateInput] = useState(
        `${dueDate.getFullYear()}-${String(dueDate.getMonth()+1).padStart(2,'0')}-${String(dueDate.getDate()).padStart(2,'0')}`
    );

    const [dueTimeInput, setDueTimeInput] = useState(
        `${String(dueTime.getHours()).padStart(2,'0')}:${String(dueTime.getMinutes()).padStart(2,'0')}`
    );

    const formatHMInput = (raw: string) => {
        const only = raw.replace(/\D/g, '').slice(0, 4); // HHMM max
        if (only.length <= 2) return only;                  // HH
        return `${only.slice(0, 2)}:${only.slice(2)}`;      // HH:MM
    };


    const isValidHM = (h: number, m: number) => h >= 0 && h <= 23 && m >= 0 && m <= 59;

    const handleDueTimeChange = (text: string) => {
        const formatted = formatHMInput(text);
        setDueTimeInput(formatted);

        const m = formatted.match(/^(\d{2}):(\d{2})$/);
        if (m) {
            const h = +m[1], min = +m[2];
            if (isValidHM(h, min)) {
                const t = new Date(dueTime);
                t.setHours(h, min, 0, 0);
                setDueTime(t);
            }
        }
    };

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [saving, setSaving] = useState(false);

    const pickedLocation = route?.params?.pickedLocation as { description: string; lat: number; lng: number } | undefined;

    const onDateChange = (_: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) setDueDate(selectedDate);
    };
    const onTimeChange = (_: any, selectedTime?: Date) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedTime) setDueTime(selectedTime);
    };

    const goBack = () => {
        if (router) router.back();
        else if (navigation?.goBack) navigation.goBack();
    };

    const saveToFirestoreAndSchedule = async () => {
        console.log('[Save] pressed'); // ✅ prove onPress fires
        if (saving) return;
        setSaving(true);

        try {
            const user = auth.currentUser;
            console.log('[Save] currentUser:', user?.uid);
            if (!user) { Alert.alert('Error', 'Not signed in'); return; }
            if (!title.trim()) { Alert.alert('Error', 'Please enter a task title'); return; }

            const id = existingTask?.id || doc(collection(db, 'tasks')).id;
            const dueDateStr = dueDate.toISOString().split('T')[0];
            const dueTimeStr = dueTime.toTimeString().slice(0, 5);

            const taskDoc: any = {
                id, userId: user.uid, title: title.trim(),
                dueDate: dueDateStr, dueTime: dueTimeStr,
                priority, isCompleted: existingTask?.isCompleted ?? false,
                hasLocation, hasWeather,
                createdAt: existingTask?.createdAt || serverTimestamp(),
            };

            if (hasLocation && pickedLocation) {
                taskDoc.location = {
                    description: pickedLocation.description,
                    lat: pickedLocation.lat,
                    lng: pickedLocation.lng,
                    radius: 1000,
                };
            }

            const ref = doc(db, 'tasks', id);

            // 1) Save first — if this fails, we alert and bail.
            if (isEditing) {
                console.log('[Save] updateDoc:', id, taskDoc);
                await updateDoc(ref, taskDoc);
            } else {
                console.log('[Save] setDoc:', id, taskDoc);
                await setDoc(ref, taskDoc);
            }

            // 2) Best-effort extras — never block saving.
            let notifIds: any = {};
            try {
                if (existingTask?.notificationIds) await cancelTaskAlarms(existingTask.notificationIds);
                notifIds = await scheduleTaskAlarms(taskDoc);
            } catch (e) { console.warn('[Save] notifications failed:', e); }

            let geofenceId: string | undefined;
            try {
                if (Platform.OS !== 'web' && taskDoc.location) {
                    geofenceId = await startGeofenceForTask({ id, title: taskDoc.title, location: taskDoc.location });
                }
            } catch (e) { console.warn('[Save] geofence failed:', e); }

            try {
                if (taskDoc.hasWeather && taskDoc.location) {
                    const rainy = await willLikelyRainOnDate(taskDoc.location.lat, taskDoc.location.lng, taskDoc.dueDate);
                    if (rainy) {
                        const umbrellaId = await scheduleUmbrellaAlert(taskDoc);
                        if (umbrellaId) notifIds = { ...notifIds, umbrella: umbrellaId };
                    }
                }
            } catch (e) { console.warn('[Save] umbrella failed:', e); }

            try {
                if ((notifIds && Object.keys(notifIds).length) || geofenceId) {
                    await updateDoc(ref, { notificationIds: notifIds, geofenceId });
                }
            } catch (e) { console.warn('[Save] update IDs failed:', e); }

            Alert.alert('Saved', 'Your task has been saved.');
            console.log('[Save] success, navigating back');
            //goBack();
        } catch (err: any) {
            console.error('[Save] failed:', err);
            Alert.alert('Save failed', err?.message ?? 'Could not save task. Check your connection and rules.');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = () => {
        Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => goBack() },
        ]);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack} accessibilityRole="button">
                    <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>

                <Text style={styles.headerTitle}>{isEditing ? 'Edit Task' : 'Add Task'}</Text>

                <TouchableOpacity
                    onPress={saveToFirestoreAndSchedule}
                    accessibilityRole="button"
                    disabled={saving}
                    style={{ opacity: saving ? 0.5 : 1 }}
                >
                    <Text style={styles.saveButton}>{saving ? 'Saving…' : 'Save'}</Text>
                </TouchableOpacity>
            </View>

            {saving && (
                <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
                    <ActivityIndicator />
                </View>
            )}

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Task Title</Text>
                    <TextInput
                        style={styles.textInput}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Enter task title"
                        returnKeyType="done"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Due Date</Text>
                    <TextInput
                        style={[styles.textInput, { marginTop: 8 }]}
                        placeholder="YYYY-MM-DD"
                        value={dueDateInput}
                        onChangeText={handleDueDateChange}
                        returnKeyType="done"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Due Time</Text>
                    <TextInput
                        style={[styles.textInput, { marginTop: 8 }]}
                        placeholder="HH:mm"
                        value={dueTimeInput}                 // <- controlled
                        onChangeText={handleDueTimeChange}   // <- live sync + validation
                        keyboardType="number-pad"
                        returnKeyType="done"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Priority</Text>
                    <View style={styles.priorityContainer}>
                        {(['high', 'medium', 'low'] as const).map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.priorityButton, priority === p && styles.selectedPriority]}
                                onPress={() => setPriority(p)}
                            >
                                <Text style={[styles.priorityText, priority === p && styles.selectedPriorityText]}>{p.toUpperCase()}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <View style={styles.toggleRow}>
                        <Text style={styles.label}>Location-based</Text>
                        <TouchableOpacity
                            style={[styles.toggle, hasLocation && styles.toggleActive]}
                            onPress={() => setHasLocation(!hasLocation)}
                        >
                            <View style={[styles.toggleThumb, hasLocation && styles.toggleThumbActive]} />
                        </TouchableOpacity>
                    </View>
                    {hasLocation && (
                        <TouchableOpacity
                            style={styles.locationButton}
                            onPress={() => {
                                // blur active element for web a11y (optional)
                                if (Platform.OS === 'web') {
                                    const el = document.activeElement as HTMLElement | null;
                                    if (el?.blur) el.blur();
                                }
                                navigation.navigate?.('LocationPicker');
                            }}
                        >
                            <Text style={styles.locationButtonText}>
                                {pickedLocation ? `📍 ${pickedLocation.description}` : '📍 Choose Location'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <View style={styles.toggleRow}>
                        <Text style={styles.label}>Weather-dependent</Text>
                        <TouchableOpacity
                            style={[styles.toggle, hasWeather && styles.toggleActive]}
                            onPress={() => setHasWeather(!hasWeather)}
                        >
                            <View style={[styles.toggleThumb, hasWeather && styles.toggleThumbActive]} />
                        </TouchableOpacity>
                    </View>
                </View>

                {isEditing && (
                    <TouchableOpacity style={styles.deleteButton} onPress={handleDelete}>
                        <Text style={styles.deleteButtonText}>Delete Task</Text>
                    </TouchableOpacity>
                )}
            </View>

            {Platform.OS !== 'web' && showDatePicker && (
                <DateTimePicker value={dueDate} mode="date" display="default" onChange={onDateChange} />
            )}
            {Platform.OS !== 'web' && showTimePicker && (
                <DateTimePicker value={dueTime} mode="time" display="default" onChange={onTimeChange} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0',
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    cancelButton: { color: '#FF3B30', fontSize: 16 },
    saveButton: { color: '#007AFF', fontSize: 16, fontWeight: '600' },
    form: { padding: 16 },
    inputGroup: { marginBottom: 20 },
    label: { fontSize: 16, fontWeight: '500', marginBottom: 8, color: '#333' },
    textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: '#fff' },
    dateTimeButton: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, backgroundColor: '#fff' },
    priorityContainer: { flexDirection: 'row', gap: 8 },
    priorityButton: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center', backgroundColor: '#fff' },
    selectedPriority: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
    priorityText: { color: '#333' },
    selectedPriorityText: { color: '#fff' },
    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    toggle: { width: 50, height: 30, borderRadius: 15, backgroundColor: '#ddd', justifyContent: 'center', padding: 2 },
    toggleActive: { backgroundColor: '#007AFF' },
    toggleThumb: {
        width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 2, elevation: 2,
    },
    toggleThumbActive: { transform: [{ translateX: 20 }] },
    locationButton: { marginTop: 8, padding: 12, backgroundColor: '#fff', borderRadius: 8, borderWidth: 1, borderColor: '#ddd', alignItems: 'center' },
    locationButtonText: { color: '#007AFF', fontSize: 16 },
    deleteButton: { marginTop: 20, padding: 16, backgroundColor: '#FF3B30', borderRadius: 8, alignItems: 'center' },
    deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
