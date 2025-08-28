import React, { useMemo, useState } from 'react';
import {View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform, ActivityIndicator,} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { auth, db } from '@/constants/firebaseConfig';
import { collection, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { scheduleTaskAlarms, cancelTaskAlarms, scheduleUmbrellaAlert } from '@/services/NotificationService';
import { startGeofenceForTask } from '@/services/GeofenceService';
import { willLikelyRainOnDate } from '@/services/WeatherService';

let router: { back: () => void } | null = null;
try {
    router = require('expo-router').router;
} catch {
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
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    if (mo < 1 || mo > 12) return null;
    const maxDay = new Date(y, mo, 0).getDate();
    if (d < 1 || d > maxDay) return null;
    return new Date(y, mo - 1, d);
};
const parseHM = (s: string, base: Date) => {
    const m = s.match(/^(\d{2}):(\d{2})$/);
    if (!m) return null;
    const h = +m[1], mm = +m[2];
    if (h < 0 || h > 23 || mm < 0 || mm > 59) return null;
    const t = new Date(base);
    t.setHours(h, mm, 0, 0);
    return t;
};
const maskYMD = (raw: string) => {
    const only = raw.replace(/\D/g, '').slice(0, 8);
    if (only.length <= 4) return only;
    if (only.length <= 6) return `${only.slice(0, 4)}-${only.slice(4)}`;
    return `${only.slice(0, 4)}-${only.slice(4, 6)}-${only.slice(6)}`;
};
const maskHM = (raw: string) => {
    const only = raw.replace(/\D/g, '').slice(0, 4);
    if (only.length <= 2) return only;
    return `${only.slice(0, 2)}:${only.slice(2)}`;
};

interface AddEditTaskScreenProps {
    navigation: any;
    route: any;
}

type Priority = 'high' | 'medium' | 'low';
type PickedLocation = { description: string; lat: number; lng: number } | undefined;

export default function AddEditTaskScreen({ navigation, route }: AddEditTaskScreenProps) {
    const existingTask = route?.params?.task;
    const isEditing = !!existingTask;

    const [title, setTitle] = useState(existingTask?.title || '');

    // Initial date/time from task or defaults
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

    const [dueDate, setDueDate] = useState<Date>(initDate);
    const [dueTime, setDueTime] = useState<Date>(initTime);
    const [dueDateInput, setDueDateInput] = useState<string>(fmtYMD(initDate));
    const [dueTimeInput, setDueTimeInput] = useState<string>(fmtHM(initTime));

    const [priority, setPriority] = useState<Priority>(existingTask?.priority || 'medium');
    const [hasLocation, setHasLocation] = useState<boolean>(existingTask?.hasLocation ?? false);
    const [hasWeather, setHasWeather] = useState<boolean>(existingTask?.hasWeather ?? false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [saving, setSaving] = useState(false);

    const pickedLocation: PickedLocation = route?.params?.pickedLocation;

    /** --------- Web-friendly text inputs (controlled) ---------- */
    const onChangeDateText = (text: string) => {
        const masked = maskYMD(text);
        setDueDateInput(masked);
        const parsed = parseYMD(masked);
        if (parsed) setDueDate(parsed);
    };
    const onChangeTimeText = (text: string) => {
        const masked = maskHM(text);
        setDueTimeInput(masked);
        const parsed = parseHM(masked, dueTime);
        if (parsed) setDueTime(parsed);
    };

    /** --------- Native pickers (iOS/Android) ---------- */
    const onDateChange = (_: any, selected?: Date) => {
        if (Platform.OS === 'android') setShowDatePicker(false);
        if (selected) {
            setDueDate(selected);
            setDueDateInput(fmtYMD(selected));
        }
    };
    const onTimeChange = (_: any, selected?: Date) => {
        if (Platform.OS === 'android') setShowTimePicker(false);
        if (selected) {
            setDueTime(selected);
            setDueTimeInput(fmtHM(selected));
        }
    };

    const goBack = () => {
        if (router) router.back();
        else if (navigation?.goBack) navigation.goBack();
    };

    const saveToFirestoreAndSchedule = async () => {
        if (saving) return;
        setSaving(true);

        try {
            const user = auth.currentUser;
            if (!user) { Alert.alert('Error', 'Not signed in'); return; }
            if (!title.trim()) { Alert.alert('Error', 'Please enter a task title'); return; }

            const id = existingTask?.id || doc(collection(db, 'tasks')).id;

            // make YYYY-MM-DD and HH:mm strings from your controlled states
            const dueDateStr = dueDate.toISOString().split('T')[0];
            const dueTimeStr = dueTime.toTimeString().slice(0, 5);

            const taskDoc: any = {
                id,
                userId: user.uid,
                title: title.trim(),
                dueDate: dueDateStr,
                dueTime: dueTimeStr,
                priority,
                isCompleted: existingTask?.isCompleted ?? false,
                hasLocation,
                hasWeather,
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

            // 1) Save first — if this fails, bail
            if (isEditing) await updateDoc(ref, taskDoc);
            else await setDoc(ref, taskDoc);

            // 2) Best-effort extras — never block saving  ⬇️  (THIS is the block you asked about)

            let notifIds: Record<string, string> = {};
            try {
                if (existingTask?.notificationIds) {
                    await cancelTaskAlarms(existingTask.notificationIds);
                }
                const scheduled = await scheduleTaskAlarms({
                    id,
                    title: taskDoc.title,
                    dueDate: taskDoc.dueDate,
                    dueTime: taskDoc.dueTime,
                });

                // keep only truthy ids
                notifIds = Object.fromEntries(
                    Object.entries(scheduled).filter(([_, v]) => typeof v === 'string' && v.length > 0)
                );
            } catch (e) {
                console.warn('[Save] notifications failed:', e);
            }

            let geofenceId: string | undefined;
            try {
                if (taskDoc.location) {
                    geofenceId = await startGeofenceForTask({
                        id,
                        title: taskDoc.title,
                        location: taskDoc.location,
                    });
                }
            } catch (e) {
                console.warn('[Save] geofence failed:', e);
            }

            // ---- Firestore UPDATE: write only defined fields (no undefined nesting) ----
            const patch: any = {};
            if (notifIds.minus6)   patch['notificationIds.minus6']   = notifIds.minus6;
            if (notifIds.minus1)   patch['notificationIds.minus1']   = notifIds.minus1;
            if (notifIds.minus5min) patch['notificationIds.minus5min'] = notifIds.minus5min;
            if (geofenceId)        patch.geofenceId = geofenceId;

            if (Object.keys(patch).length) await updateDoc(ref, patch);

            // OPTIONAL umbrella alert — only if you want weather-based heads-up
            try {
                if (taskDoc.hasWeather && taskDoc.location) {
                    const rainy = await willLikelyRainOnDate(
                        taskDoc.location.lat,
                        taskDoc.location.lng,
                        taskDoc.dueDate
                    );
                    if (rainy) {
                        const umbId = await scheduleUmbrellaAlert({
                            id,
                            title: taskDoc.title,
                            dueDate: taskDoc.dueDate,
                        });
                        if (umbId) {
                            notifIds = { ...notifIds, umbrella: umbId };
                        }
                    }
                }
            } catch (e) {
                console.warn('[Save] umbrella failed:', e);
            }
            // Update Firestore only with defined fields (avoid undefined write errors)
            const updates: any = {};
            if (Object.keys(notifIds).length) updates.notificationIds = notifIds;
            if (geofenceId) updates.geofenceId = geofenceId;

            if (Object.keys(updates).length) {
                await updateDoc(ref, updates);
            }

            // 4) Done
            Alert.alert('Saved', 'Your task has been saved.');
            if (router) router.back(); else navigation?.goBack?.();
        } catch (err: any) {
            console.error('[Save] failed:', err);
            Alert.alert('Save failed', err?.message ?? 'Could not save task.');
        } finally {
            setSaving(false);
        }
    };


    const handleDelete = () =>
        Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => goBack() },
        ]);

    return (
        <View style={styles.container}>
            {/* Header */}
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

            {/* Form */}
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

                {/* Due Date */}
                <View style={styles.inputGroup}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.label}>Due Date</Text>
                        {Platform.OS !== 'android' && (
                            <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                                <Text style={{ color: '#007AFF', fontWeight: '600' }}>Pick date</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <TextInput
                        style={styles.textInput}
                        placeholder="YYYY-MM-DD"
                        value={dueDateInput}
                        onChangeText={onChangeDateText}
                        returnKeyType="done"
                        inputMode="numeric"
                    />
                </View>

                {/* Due Time */}
                <View style={styles.inputGroup}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.label}>Due Time</Text>
                        {Platform.OS !== 'android' && (
                            <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                                <Text style={{ color: '#007AFF', fontWeight: '600' }}>Pick time</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                    <TextInput
                        style={styles.textInput}
                        placeholder="HH:mm"
                        value={dueTimeInput}
                        onChangeText={onChangeTimeText}
                        keyboardType="number-pad"
                        returnKeyType="done"
                    />
                </View>

                {/* Priority */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Priority</Text>
                    <View style={styles.priorityContainer}>
                        {(['high', 'medium', 'low'] as const).map((p) => (
                            <TouchableOpacity
                                key={p}
                                style={[styles.priorityButton, priority === p && styles.selectedPriority]}
                                onPress={() => setPriority(p)}
                            >
                                <Text style={[styles.priorityText, priority === p && styles.selectedPriorityText]}>
                                    {p.toUpperCase()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Location toggle + picker */}
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
                                if (Platform.OS === 'web') {
                                    const el = document.activeElement as HTMLElement | null;
                                    el?.blur?.();
                                }
                                navigation?.navigate?.('LocationPicker');
                                // router?.push?.('/LocationPicker'); // if using expo-router
                            }}
                        >
                            <Text style={styles.locationButtonText}>
                                {pickedLocation ? `📍 ${pickedLocation.description}` : '📍 Choose Location'}
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Weather toggle */}
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

            {/* Native pickers (iOS/Android) */}
            {Platform.OS !== 'android' && showDatePicker && (
                <DateTimePicker value={dueDate} mode="date" display="default" onChange={onDateChange} />
            )}
            {Platform.OS !== 'android' && showTimePicker && (
                <DateTimePicker value={dueTime} mode="time" display="default" onChange={onTimeChange} />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: { fontSize: 18, fontWeight: 'bold' },
    cancelButton: { color: '#FF3B30', fontSize: 16 },
    saveButton: { color: '#007AFF', fontSize: 16, fontWeight: '600' },

    form: { padding: 16 },
    inputGroup: { marginBottom: 20 },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },

    label: { fontSize: 16, fontWeight: '500', marginBottom: 8, color: '#333' },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },

    priorityContainer: { flexDirection: 'row', gap: 8 },
    priorityButton: {
        flex: 1,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    selectedPriority: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
    priorityText: { color: '#333' },
    selectedPriorityText: { color: '#fff' },

    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    toggle: { width: 52, height: 32, borderRadius: 16, backgroundColor: '#ddd', justifyContent: 'center', padding: 2 },
    toggleActive: { backgroundColor: '#007AFF' },
    toggleThumb: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleThumbActive: { transform: [{ translateX: 20 }] },

    locationButton: {
        marginTop: 8,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
    },
    locationButtonText: { color: '#007AFF', fontSize: 16 },

    deleteButton: {
        marginTop: 20,
        padding: 16,
        backgroundColor: '#FF3B30',
        borderRadius: 10,
        alignItems: 'center',
    },
    deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});