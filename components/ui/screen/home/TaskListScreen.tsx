import React, { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    FlatList,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ActivityIndicator,
} from 'react-native';
import {collection, query, where, onSnapshot, doc, updateDoc, deleteDoc, orderBy, Timestamp,} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '@/constants/firebaseConfig';
import { Calendar, DateData } from 'react-native-calendars';

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

/* --------- Local Y-M-D helper to avoid UTC date shifts ---------- */
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

    const todayStr = useMemo(() => fmtYMD(new Date()), []);

    // Live auth + live Firestore with dynamic query per filter/selectedDate
    useEffect(() => {
        let unsubTasks: undefined | (() => void);
        let currentUid: string | null = null;

        const unsubAuth = onAuthStateChanged(auth, (user) => {
            if (!user) {
                currentUid = null;
                setTasks([]);
                setLoading(false);
                if (unsubTasks) unsubTasks();
                return;
            }

            currentUid = user.uid;
            setLoading(true);

            const constraints: any[] = [where('userId', '==', user.uid)];

            if (selectedDate) {
                // Specific calendar date
                constraints.push(where('dueDate', '==', selectedDate));
                constraints.push(orderBy('createdAt', 'desc')); // may require index
            } else if (filter === 'today') {
                constraints.push(where('dueDate', '==', todayStr));
                constraints.push(orderBy('createdAt', 'desc')); // may require index
            } else if (filter === 'overdue') {
                // overdue = before today and not completed
                constraints.push(where('dueDate', '<', todayStr));
                constraints.push(where('isCompleted', '==', false));
                constraints.push(orderBy('dueDate', 'asc'));
            } else {
                constraints.push(orderBy('createdAt', 'desc'));
            }

            const q = query(collection(db, 'tasks'), ...constraints,orderBy('createdAt', 'desc') );

            if (unsubTasks) unsubTasks();
            unsubTasks = onSnapshot(
                q,
                (qs) => {
                    const fetched: Task[] = [];
                    qs.forEach((d) => fetched.push({ id: d.id, ...(d.data() as any) }));
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
    }, [filter, selectedDate, todayStr]);

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

    // Counts are based on the currently fetched scope (server-filtered) or you can compute via todayStr
    const allCount = tasks.length;
    const todayCount = tasks.filter((t) => t.dueDate === todayStr).length;
    const overdueCount = tasks.filter((t) => t.dueDate < todayStr && !t.isCompleted).length;

    // Calendar marked dates use current tasks (you can keep a separate "all tasks" listener if you prefer)
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
            onPress={() => navigation.navigate('AddEditTask', { task: item })}
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
                <Text style={styles.headerTitle}>My Tasks</Text>
                <TouchableOpacity style={styles.addButton} onPress={() => navigation.navigate('AddEditTask')}>
                    <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
            </View>

            {/* Calendar + clear-date helper */}
            <View style={{ backgroundColor: '#fff' }}>
                <Calendar
                    markedDates={marks as any}
                    onDayPress={(day: DateData) => {
                        setSelectedDate((prev) => (prev === day.dateString ? null : day.dateString));
                    }}
                    theme={{ selectedDayBackgroundColor: '#007AFF' }}
                />
                {selectedDate && (
                    <TouchableOpacity
                        onPress={() => setSelectedDate(null)}
                        style={{ alignSelf: 'flex-end', padding: 12 }}
                    >
                        <Text style={{ color: '#007AFF', fontWeight: '600' }}>Clear date</Text>
                    </TouchableOpacity>
                )}
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
                    <Text style={[styles.filterText, filter === 'today' && styles.activeFilterText]}>
                        Today ({todayCount})
                    </Text>
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
            {tasks.length === 0 ? (
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
                    data={tasks}
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
