import React, { useEffect, useState } from 'react';
import {View, Text, FlatList, StyleSheet, ActivityIndicator, Alert, RefreshControl} from 'react-native';
import { Calendar } from 'react-native-calendars';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '@/constants/firebaseConfig';
import { Color } from '@/constants/Colors';

type Task = {
    id: string;
    title: string;
    dueDate: string;
    dueTime: string;
    priority: 'high' | 'medium' | 'low';
    isCompleted: boolean;
    hasLocation: boolean;
    hasWeather: boolean;
    userId: string;
    createdAt: any;
};

export default function CalendarTaskScreen() {
    const [selectedDate, setSelectedDate] = useState('');
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [markedDates, setMarkedDates] = useState<{[key: string]: any}>({});

    // Load tasks with dates that have tasks for calendar marking
    useEffect(() => {
        loadTaskDates();
    }, []);

    useEffect(() => {
        if (selectedDate) {
            fetchTasksForDate(selectedDate);
        }
    }, [selectedDate]);

    const loadTaskDates = async () => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const q = query(
                collection(db, 'tasks'),
                where('userId', '==', user.uid)
            );
            const querySnapshot = await getDocs(q);
            const dates: {[key: string]: any} = {};

            querySnapshot.docs.forEach((doc) => {
                const task = doc.data() as Task;
                if (task.dueDate && !dates[task.dueDate]) {
                    dates[task.dueDate] = {
                        marked: true,
                        dotColor: task.priority === 'high' ? '#FF3B30' :
                            task.priority === 'medium' ? '#FF9500' : '#34C759'
                    };
                }
            });

            setMarkedDates(dates);
        } catch (error) {
            console.error('Error loading task dates:', error);
        }
    };

    const fetchTasksForDate = async (date: string) => {
        const user = auth.currentUser;
        if (!user) return;

        setLoading(true);
        try {
            const q = query(
                collection(db, 'tasks'),
                where('userId', '==', user.uid),
                where('dueDate', '==', date)
            );
            const querySnapshot = await getDocs(q);
            const fetchedTasks: Task[] = querySnapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            } as Task));

            // Sort tasks by time and priority
            const sortedTasks = fetchedTasks.sort((a, b) => {
                // First by completion status
                if (a.isCompleted !== b.isCompleted) {
                    return a.isCompleted ? 1 : -1;
                }
                // Then by time
                return a.dueTime.localeCompare(b.dueTime);
            });

            setTasks(sortedTasks);
        } catch (error) {
            console.error('Error fetching tasks:', error);
            Alert.alert('Error', 'Failed to fetch tasks. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadTaskDates();
        if (selectedDate) {
            await fetchTasksForDate(selectedDate);
        }
        setRefreshing(false);
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return '#FF3B30';
            case 'medium': return '#FF9500';
            case 'low': return '#34C759';
            default: return '#007AFF';
        }
    };

    const formatTime = (timeString: string) => {
        const [hours, minutes] = timeString.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const currentMarkedDates = {
        ...markedDates,
        [selectedDate]: {
            ...markedDates[selectedDate],
            selected: true,
            selectedColor: Color.blue
        }
    };

    return (
        <View style={styles.container}>
            <Calendar
                onDayPress={(day) => setSelectedDate(day.dateString)}
                markedDates={currentMarkedDates}
                theme={{
                    selectedDayBackgroundColor: Color.blue,
                    todayTextColor: Color.blue,
                    arrowColor: Color.blue,
                }}
            />
            <Text style={styles.title}>
                Tasks on {selectedDate ? new Date(selectedDate).toLocaleDateString() : '...'}
            </Text>
            {loading ? (
                <ActivityIndicator size="large" color={Color.blue} style={styles.loader} />
            ) : tasks.length === 0 ? (
                <Text style={styles.emptyText}>No tasks for this date.</Text>
            ) : (
                <FlatList
                    data={tasks}
                    keyExtractor={(item) => item.id}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                    }
                    renderItem={({ item }) => (
                        <View style={[
                            styles.taskCard,
                            item.isCompleted && styles.completedTaskCard
                        ]}>
                            <View style={styles.taskHeader}>
                                <Text style={[
                                    styles.taskTitle,
                                    item.isCompleted && styles.completedText
                                ]}>
                                    {item.title}
                                </Text>
                                <View style={styles.taskIcons}>
                                    {item.hasLocation && <Text style={styles.icon}>📍</Text>}
                                    {item.hasWeather && <Text style={styles.icon}>🌤️</Text>}
                                    {item.isCompleted && <Text style={styles.icon}>✅</Text>}
                                </View>
                            </View>
                            <View style={styles.taskDetails}>
                                <Text style={styles.taskTime}>{formatTime(item.dueTime)}</Text>
                                <View style={styles.priorityContainer}>
                                    <View
                                        style={[
                                            styles.priorityDot,
                                            { backgroundColor: getPriorityColor(item.priority) }
                                        ]}
                                    />
                                    <Text style={[styles.priority, { color: getPriorityColor(item.priority) }]}>
                                        {item.priority.toUpperCase()}
                                    </Text>
                                </View>
                            </View>
                        </View>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Color.light,
        padding: 16
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginVertical: 10,
        textAlign: 'center'
    },
    loader: {
        marginTop: 20
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 20,
        color: '#888',
        fontSize: 16,
        fontStyle: 'italic'
    },
    taskCard: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        marginVertical: 6,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3
    },
    completedTaskCard: {
        opacity: 0.7,
        backgroundColor: '#f8f8f8'
    },
    taskHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8
    },
    taskTitle: {
        fontWeight: '600',
        fontSize: 16,
        flex: 1,
        marginRight: 8
    },
    completedText: {
        textDecorationLine: 'line-through',
        color: '#888'
    },
    taskIcons: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    icon: {
        fontSize: 16,
        marginLeft: 4
    },
    taskDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    taskTime: {
        fontSize: 14,
        color: '#666',
        fontWeight: '500'
    },
    priorityContainer: {
        flexDirection: 'row',
        alignItems: 'center'
    },
    priorityDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginRight: 6
    },
    priority: {
        fontSize: 12,
        fontWeight: '600'
    }
});