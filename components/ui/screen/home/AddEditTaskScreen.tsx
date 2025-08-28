// components/ui/screen/home/AddEditTaskScreen.tsx
import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Platform,
    ActivityIndicator,
} from 'react-native';
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

type Priority = 'high' | 'medium' | 'low';
type PickedLocation = { description: string; lat: number; lng: number } | undefined;

interface AddEditTaskScreenProps {
    navigation: any;
    route: any;
}

/** Best-effort parse ONLY for background features. Never blocks saving. */
function tryMakeDate(dateStr?: string, timeStr?: string): Date | null {
    if (!dateStr || !timeStr) return null;
    const [y, m, d] = (dateStr || '').split('-').map(Number);
    const [H, M] = (timeStr || '').split(':').map(Number);
    if ([y, m, d, H, M].some((n) => Number.isNaN(n))) return null;
    const dt = new Date(y, (m ?? 1) - 1, d ?? 1, H ?? 0, M ?? 0, 0, 0);
    return Number.isNaN(dt.getTime()) ? null : dt;
}

export default function AddEditTaskScreen({ navigation, route }: AddEditTaskScreenProps) {
    const existingTask = route?.params?.task;
    const isEditing = !!existingTask;

    const [title, setTitle] = useState(existingTask?.title || '');

    // Raw strings (NO validation/masking)
    const [dueDateInput, setDueDateInput] = useState<string>(existingTask?.dueDate ?? '');
    const [dueTimeInput, setDueTimeInput] = useState<string>(existingTask?.dueTime ?? '');

    const [priority, setPriority] = useState<Priority>(existingTask?.priority || 'medium');
    const [hasLocation, setHasLocation] = useState<boolean>(existingTask?.hasLocation ?? false);
    const [hasWeather, setHasWeather] = useState<boolean>(existingTask?.hasWeather ?? false);
    const [saving, setSaving] = useState(false);

    const pickedLocation: PickedLocation = route?.params?.pickedLocation;

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

            // Save EXACTLY what was typed
            const taskDoc: any = {
                id,
                userId: user.uid,
                title: title.trim(),
                dueDate: (dueDateInput ?? '').trim(),   // <-- raw
                dueTime: (dueTimeInput ?? '').trim(),   // <-- raw
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

            // 1) Save first — never blocked by parsing
            if (isEditing) await updateDoc(ref, taskDoc);
            else await setDoc(ref, taskDoc);

            // 2) Best-effort background features (skip silently if unparsable)
            let notifIds: Record<string, string> = {};
            try {
                const dt = tryMakeDate(taskDoc.dueDate, taskDoc.dueTime);
                if (existingTask?.notificationIds) {
                    await cancelTaskAlarms(existingTask.notificationIds);
                }
                if (dt) {
                    const scheduled = await scheduleTaskAlarms({
                        id,
                        title: taskDoc.title,
                        dueDate: taskDoc.dueDate,
                        dueTime: taskDoc.dueTime,
                    });
                    // keep only defined keys
                    notifIds = Object.fromEntries(
                        Object.entries(scheduled).filter(([_, v]) => typeof v === 'string' && v.length > 0)
                    );
                }
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

            // Optional umbrella alert (only if dueDate looks parseable & you want this)
            try {
                if (taskDoc.hasWeather && taskDoc.location) {
                    const dt = tryMakeDate(taskDoc.dueDate, '08:00'); // check date only
                    if (dt) {
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
                }
            } catch (e) {
                console.warn('[Save] umbrella failed:', e);
            }

            // Patch Firestore with only defined fields (avoid undefined nesting)
            const patch: any = {};
            if (notifIds.minus6)    patch['notificationIds.minus6']    = notifIds.minus6;
            if (notifIds.minus1)    patch['notificationIds.minus1']    = notifIds.minus1;
            if (notifIds.minus5min) patch['notificationIds.minus5min'] = notifIds.minus5min;
            if (notifIds.umbrella)  patch['notificationIds.umbrella']  = notifIds.umbrella;
            if (geofenceId)         patch.geofenceId = geofenceId;

            if (Object.keys(patch).length) await updateDoc(ref, patch);

            Alert.alert('Saved', 'Your task has been saved.');
            goBack();
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

                {/* Raw Due Date */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Due Date</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="YYYY-MM-DD (saved as typed)"
                        value={dueDateInput}
                        onChangeText={setDueDateInput}  // <- no validation
                        returnKeyType="done"
                    />
                </View>

                {/* Raw Due Time */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Due Time</Text>
                    <TextInput
                        style={styles.textInput}
                        placeholder="HH:mm (saved as typed)"
                        value={dueTimeInput}
                        onChangeText={setDueTimeInput} // <- no validation
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
                                if (Platform.OS === 'web') (document.activeElement as HTMLElement | null)?.blur?.();
                                navigation?.navigate?.('LocationPicker');
                            }}
                        >
                            <Text style={styles.locationButtonText}>
                                {route?.params?.pickedLocation
                                    ? `📍 ${route.params.pickedLocation.description}`
                                    : '📍 Choose Location'}
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
    textInput: {
        borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12,
        fontSize: 16, backgroundColor: '#fff',
    },

    priorityContainer: { flexDirection: 'row', gap: 8 },
    priorityButton: {
        flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#ddd',
        alignItems: 'center', backgroundColor: '#fff',
    },
    selectedPriority: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
    priorityText: { color: '#333' },
    selectedPriorityText: { color: '#fff' },

    toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    toggle: { width: 52, height: 32, borderRadius: 16, backgroundColor: '#ddd', justifyContent: 'center', padding: 2 },
    toggleActive: { backgroundColor: '#007AFF' },
    toggleThumb: {
        width: 28, height: 28, borderRadius: 14, backgroundColor: '#fff',
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2,
    },
    toggleThumbActive: { transform: [{ translateX: 20 }] },

    locationButton: {
        marginTop: 8, padding: 12, backgroundColor: '#fff', borderRadius: 10,
        borderWidth: 1, borderColor: '#ddd', alignItems: 'center',
    },
    locationButtonText: { color: '#007AFF', fontSize: 16 },

    deleteButton: { marginTop: 20, padding: 16, backgroundColor: '#FF3B30', borderRadius: 10, alignItems: 'center' },
    deleteButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});