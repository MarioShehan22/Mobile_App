import React, { useEffect, useMemo, useState } from 'react';
import {View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Platform,} from 'react-native';
import {collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, Timestamp,} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/constants/firebaseConfig';
import {ensureNotificationChannels, requestNotificationPermission} from "@/services/NotificationService";
import * as Notifications from 'expo-notifications';

type Priority = 'high' | 'medium' | 'low';

interface Task {
    id: string;
    title: string;
    dueDate: string; // 'YYYY-MM-DD'
    dueTime: string; // 'HH:mm'
    priority: Priority;
    isCompleted: boolean;
    hasLocation: boolean;
    hasWeather: boolean;
    location?: { description: string; lat: number; lng: number; radius?: number };
    notificationIds?: { minus24?: string; minus6?: string; minus1?: string; umbrella?: string };
    geofenceId?: string;
    userId: string;
    createdAt?: Timestamp;
}

interface TaskListScreenProps {
    navigation: any;
}

/** Local Y-M-D helper to avoid UTC date shifts */
const fmtYMD = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

export default function TaskListScreen({ navigation }: TaskListScreenProps) {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'today' | 'overdue'>('all');
    const [selectedDate, setSelectedDate] = useState<string | null>(null);

    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 30_000); // update every 30s
        return () => clearInterval(id);
    }, []);

    const timeLabel = useMemo(
        () => now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        [now]
    );
    const dateLabel = useMemo(
        () => now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
        [now]
    );

    const todayStr = useMemo(() => fmtYMD(new Date()), []);

    async function testLocalIn10s() {
        await requestNotificationPermission();
        await ensureNotificationChannels();
        await Notifications.scheduleNotificationAsync({
            content: { title: 'Software Engineering Theory Exam', body: 'The exam is in 1 hour' },
            //@ts-ignore
            trigger: Platform.select({
                ios:    { seconds: 10 },
                android:{ channelId: 'tasks', seconds: 10 }, // ensure you created 'tasks' channel
            }),
        });
    }

    useEffect(() => {
        let unsubTasks: undefined | (() => void);

        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (!user) {
                setTasks([]);
                setLoading(false);
                if (unsubTasks) unsubTasks();
                return;
            }

            setLoading(true);

            // Simple index: userId equality + createdAt order
            const q = query(
                collection(db, 'tasks'),
                where('userId', '==', user.uid)
            );

            if (unsubTasks) unsubTasks();
            unsubTasks = onSnapshot(
                q,
                (qs) => {
                    const fetched: Task[] = [];
                    qs.forEach((d) => fetched.push({ id: d.id, ...(d.data() as any) }));

                    // sort by createdAt desc on the client
                    fetched.sort((a, b) => {
                        const av = (a.createdAt as any)?.toMillis?.() ?? 0;
                        const bv = (b.createdAt as any)?.toMillis?.() ?? 0;
                        return bv - av;
                    });

                    setTasks(fetched);
                    setLoading(false);
                },
                (err) => {
                    console.error('Error fetching tasks:', err);
                    setLoading(false);
                    Alert.alert('Error', 'Failed to fetch tasks. Check your connection and rules.');
                }
            );
        });

        return () => {
            unsubAuth();
            if (unsubTasks) unsubTasks();
        };
    }, []);

    /** Client-side filters to avoid composite indexes */
    const baseFiltered = useMemo(() => {
        switch (filter) {
            case 'today':
                return tasks.filter((t) => t.dueDate === todayStr);
            case 'overdue':
                return tasks.filter((t) => t.dueDate < todayStr && !t.isCompleted);
            default:
                return tasks;
        }
    }, [tasks, filter, todayStr]);

    const visibleTasks = useMemo(
        () => (selectedDate ? baseFiltered.filter((t) => t.dueDate === selectedDate) : baseFiltered),
        [baseFiltered, selectedDate]
    );

    /** Counts always based on the full task list */
    const allCount = tasks.length;
    const todayCount = tasks.filter((t) => t.dueDate === todayStr).length;
    const overdueCount = tasks.filter((t) => t.dueDate < todayStr && !t.isCompleted).length;

    /** Calendar marks from *all* tasks; selected date highlighted */
    const marks = useMemo(() => {
        const map: Record<string, { marked: boolean; dotColor?: string; selected?: boolean }> = {};
        tasks.forEach((t) => {
            map[t.dueDate] = {
                ...(map[t.dueDate] || { marked: true }),
                dotColor: t.isCompleted ? '#9acd32' : '#007AFF',
            };
        });
        if (selectedDate) {
            map[selectedDate] = { ...(map[selectedDate] || { marked: true }), selected: true };
        }
        return map;
    }, [tasks, selectedDate]);

    const getPriorityColor = (priority: Priority | string) => {
        switch (priority) {
            case 'high':
                return '#FF3B30';
            case 'medium':
                return '#FF9500';
            case 'low':
                return '#34C759';
            default:
                return '#007AFF';
        }
    };

    const toggleTaskComplete = async (id: string) => {
        try {
            const task = tasks.find((t) => t.id === id);
            if (task) {
                const taskRef = doc(db, 'tasks', id);
                await updateDoc(taskRef, { isCompleted: !task.isCompleted });
            }
        } catch (error) {
            console.error('Error updating task:', error);
            Alert.alert('Error', 'Failed to update task. Please try again.');
        }
    };

    const deleteTask = (id: string) => {
        Alert.alert('Delete Task', 'Are you sure you want to delete this task?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'tasks', id));
                    } catch (error) {
                        console.error('Error deleting task:', error);
                        Alert.alert('Error', 'Failed to delete task. Please try again.');
                    }
                },
            },
        ]);
    };

    const formatTime = (timeString: string) => {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours, 10);
        if (Number.isNaN(hour)) return timeString;
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const today = new Date();
        const iso = (d: Date) => fmtYMD(d);
        const yest = new Date(today);
        yest.setDate(today.getDate() - 1);
        const tomo = new Date(today);
        tomo.setDate(today.getDate() + 1);
        if (dateString === iso(today)) return 'Today';
        if (dateString === iso(yest)) return 'Yesterday';
        if (dateString === iso(tomo)) return 'Tomorrow';
        return date.toLocaleDateString();
    };

    const renderTask = ({ item }: { item: Task }) => (
        <TouchableOpacity
            style={[styles.taskItem, item.isCompleted && styles.completedTaskItem]}
            onPress={() => navigation?.navigate?.('AddEditTask', { task: item })}
            onLongPress={() => deleteTask(item.id)}
        >
            <View style={styles.taskContent}>
                <TouchableOpacity
                    style={[styles.checkbox, item.isCompleted && styles.checkboxCompleted]}
                    onPress={() => toggleTaskComplete(item.id)}
                >
                    {item.isCompleted && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>

                <View style={styles.taskDetails}>
                    <Text style={[styles.taskTitle, item.isCompleted && styles.completedTask]}>{item.title}</Text>
                    <Text style={styles.taskTime}>
                        {formatDate(item.dueDate)} at {formatTime(item.dueTime)}
                    </Text>
                </View>

                <View style={styles.taskIcons}>
                    <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.priority) }]} />
                    {item.hasLocation && <Text style={styles.icon}>📍</Text>}
                    {item.hasWeather && <Text style={styles.icon}>🌤️</Text>}
                </View>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#007AFF" />
                <Text style={styles.loadingText}>Loading tasks...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <Text style={styles.headerTitle}>My Tasks</Text>
                    <Text style={styles.headerSub}>{dateLabel}</Text>
                </View>

                <TouchableOpacity
                    style={[styles.addButton, { marginRight: 8, backgroundColor: '#34C759' }]}
                    onPress={testLocalIn10s}
                >
                    <Text style={styles.addButtonText}>🔔</Text>
                </TouchableOpacity>

                <View style={styles.headerRight}>
                    <TouchableOpacity style={styles.timePill} disabled>
                        <Text style={styles.timePillText}>{timeLabel}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.addButton}
                        onPress={() => navigation?.navigate?.('AddEditTask')}
                    >
                        <Text style={styles.addButtonText}>+</Text>
                    </TouchableOpacity>
                </View>
            </View>


            {/* Filters */}
            <View style={styles.filterContainer}>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'all' && styles.activeFilter]}
                    onPress={() => setFilter('all')}
                >
                    <Text style={[styles.filterText, filter === 'all' && styles.activeFilterText]}>All ({allCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'today' && styles.activeFilter]}
                    onPress={() => setFilter('today')}
                >
                    <Text style={[styles.filterText, filter === 'today' && styles.activeFilterText]}>Today ({todayCount})</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterButton, filter === 'overdue' && styles.activeFilter]}
                    onPress={() => setFilter('overdue')}
                >
                    <Text style={[styles.filterText, filter === 'overdue' && styles.activeFilterText]}>
                        Overdue ({overdueCount})
                    </Text>
                </TouchableOpacity>
            </View>

            {/* List */}
            {visibleTasks.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>
                        {selectedDate
                            ? 'No tasks on this date'
                            : filter === 'all'
                                ? 'No tasks yet'
                                : filter === 'today'
                                    ? 'No tasks for today'
                                    : 'No overdue tasks'}
                    </Text>
                    <Text style={styles.emptySubtext}>
                        {filter === 'all'
                            ? 'Tap the + button to add your first task'
                            : filter === 'today'
                                ? "Great! You're all caught up for today"
                                : "You're up to date!"}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={visibleTasks}
                    keyExtractor={(item) => item.id}
                    renderItem={renderTask}
                    style={styles.taskList}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5f5f5' },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },
    loadingText: { marginTop: 10, fontSize: 16, color: '#666' },

    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: { fontSize: 20, fontWeight: 'bold' },
    headerLeft: { flexDirection: 'column' },
    headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    headerSub: { marginTop: 4, color: '#666', fontSize: 13, fontWeight: '500' },
    timePill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#eef3ff',
        borderWidth: 1,
        borderColor: '#d6e2ff',
    },
    timePillText: { color: '#007AFF', fontWeight: '600', fontSize: 13 },
    addButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#007AFF',
        justifyContent: 'center',
        alignItems: 'center',
    },
    addButtonText: { color: '#fff', fontSize: 24, fontWeight: 'bold' },

    filterContainer: {
        flexDirection: 'row',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
        backgroundColor: '#f0f0f0',
    },
    activeFilter: { backgroundColor: '#007AFF' },
    filterText: { color: '#666', fontSize: 14, fontWeight: '500' },
    activeFilterText: { color: '#fff' },

    taskList: { flex: 1, padding: 16 },
    taskItem: {
        backgroundColor: '#fff',
        borderRadius: 12,
        marginBottom: 8,
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    completedTaskItem: { opacity: 0.7 },
    taskContent: { flexDirection: 'row', alignItems: 'center', padding: 16 },

    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#007AFF',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxCompleted: { backgroundColor: '#007AFF' },
    checkmark: { color: '#fff', fontSize: 14, fontWeight: 'bold' },

    taskDetails: { flex: 1 },
    taskTitle: { fontSize: 16, fontWeight: '500', marginBottom: 4, color: '#333' },
    completedTask: { textDecorationLine: 'line-through', color: '#999' },
    taskTime: { fontSize: 14, color: '#666' },

    taskIcons: { flexDirection: 'row', alignItems: 'center' },
    priorityDot: { width: 12, height: 12, borderRadius: 6, marginRight: 8 },
    icon: { fontSize: 16, marginLeft: 4 },

    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
    emptyText: { fontSize: 18, fontWeight: '600', color: '#666', textAlign: 'center', marginBottom: 8 },
    emptySubtext: { fontSize: 14, color: '#999', textAlign: 'center', lineHeight: 20 },
});