import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

interface AddEditTaskScreenProps {
    navigation: any;
    route: any;
}

const AddEditTaskScreen: React.FC<AddEditTaskScreenProps> = ({ navigation, route }) => {
    const existingTask = route.params?.task;
    const isEditing = !!existingTask;

    const [title, setTitle] = useState(existingTask?.title || '');
    const [dueDate, setDueDate] = useState(new Date(existingTask?.dueDate || new Date()));
    const [dueTime, setDueTime] = useState(new Date(`2000-01-01 ${existingTask?.dueTime || '09:00'}`));
    const [priority, setPriority] = useState<'high' | 'medium' | 'low'>(existingTask?.priority || 'medium');
    const [hasLocation, setHasLocation] = useState(existingTask?.hasLocation || false);
    const [hasWeather, setHasWeather] = useState(existingTask?.hasWeather || false);

    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);

    const handleSave = () => {
        if (!title.trim()) {
            Alert.alert('Error', 'Please enter a task title');
            return;
        }

        const taskData = {
            id: existingTask?.id || Date.now().toString(),
            title: title.trim(),
            dueDate: dueDate.toISOString().split('T')[0],
            dueTime: dueTime.toTimeString().slice(0, 5),
            priority,
            isCompleted: existingTask?.isCompleted || false,
            hasLocation,
            hasWeather,
        };

        // In a real app, you would save this to your state management or database
        console.log('Saving task:', taskData);
        navigation.goBack();
    };

    const handleDelete = () => {
        Alert.alert(
            'Delete Task',
            'Are you sure you want to delete this task?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => {
                        // In a real app, you would delete from your state management or database
                        navigation.goBack();
                    }}
            ]
        );
    };

    const onDateChange = (event: any, selectedDate?: Date) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setDueDate(selectedDate);
        }
    };

    const onTimeChange = (event: any, selectedTime?: Date) => {
        setShowTimePicker(Platform.OS === 'ios');
        if (selectedTime) {
            setDueTime(selectedTime);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{isEditing ? 'Edit Task' : 'Add Task'}</Text>
                <TouchableOpacity onPress={handleSave}>
                    <Text style={styles.saveButton}>Save</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Task Title</Text>
                    <TextInput
                        style={styles.textInput}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Enter task title"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Due Date</Text>
                    <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Text>{dueDate.toDateString()}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Due Time</Text>
                    <TouchableOpacity
                        style={styles.dateTimeButton}
                        onPress={() => setShowTimePicker(true)}
                    >
                        <Text>{dueTime.toTimeString().slice(0, 5)}</Text>
                    </TouchableOpacity>
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
                                <Text style={[styles.priorityText, priority === p && styles.selectedPriorityText]}>
                                    {p.charAt(0).toUpperCase() + p.slice(1)}
                                </Text>
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
                            onPress={() => navigation.navigate('LocationPicker')}
                        >
                            <Text style={styles.locationButtonText}>📍 Choose Location</Text>
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

            {showDatePicker && (
                <DateTimePicker
                    value={dueDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                />
            )}

            {showTimePicker && (
                <DateTimePicker
                    value={dueTime}
                    mode="time"
                    display="default"
                    onChange={onTimeChange}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#f5f5f5',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#e0e0e0',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold',
    },
    cancelButton: {
        color: '#FF3B30',
        fontSize: 16,
    },
    saveButton: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    form: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 8,
        color: '#333',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    dateTimeButton: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        backgroundColor: '#fff',
    },
    priorityContainer: {
        flexDirection: 'row',
        gap: 8,
    },
    priorityButton: {
        flex: 1,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    selectedPriority: {
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
    },
    priorityText: {
        color: '#333',
    },
    selectedPriorityText: {
        color: '#fff',
    },
    toggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    toggle: {
        width: 50,
        height: 30,
        borderRadius: 15,
        backgroundColor: '#ddd',
        justifyContent: 'center',
        padding: 2,
    },
    toggleActive: {
        backgroundColor: '#007AFF',
    },
    toggleThumb: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#fff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    toggleThumbActive: {
        transform: [{ translateX: 20 }],
    },
    locationButton: {
        marginTop: 8,
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#ddd',
        alignItems: 'center',
    },
    locationButtonText: {
        color: '#007AFF',
        fontSize: 16,
    },
    deleteButton: {
        marginTop: 20,
        padding: 16,
        backgroundColor: '#FF3B30',
        borderRadius: 8,
        alignItems: 'center',
    },
    deleteButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default AddEditTaskScreen;