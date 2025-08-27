import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';

interface LocationPickerScreenProps {
    navigation: any;
}

const LocationPickerScreen: React.FC<LocationPickerScreenProps> = ({ navigation }) => {
    const [searchText, setSearchText] = useState('');
    const [selectedLocation, setSelectedLocation] = useState('');

    const predefinedLocations = [
        '📍 Home',
        '🏢 Office',
        '🛒 Grocery Store',
        '🏥 Hospital',
        '🏫 University',
    ];

    const handleUseCurrentLocation = () => {
        // In a real app, you would use location services here
        Alert.alert('Location', 'Using current location');
        navigation.goBack();
    };

    const handleSaveLocation = () => {
        if (!selectedLocation && !searchText) {
            Alert.alert('Error', 'Please select or search for a location');
            return;
        }

        // In a real app, you would save the location to your task
        navigation.goBack();
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Choose Location</Text>
                <TouchableOpacity onPress={handleSaveLocation}>
                    <Text style={styles.saveButton}>Save</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Search for a location..."
                />

                <TouchableOpacity
                    style={styles.currentLocationButton}
                    onPress={handleUseCurrentLocation}
                >
                    <Text style={styles.currentLocationText}>📍 Use Current Location</Text>
                </TouchableOpacity>

                <Text style={styles.sectionTitle}>Quick Locations</Text>

                {predefinedLocations.map((location, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[
                            styles.locationItem,
                            selectedLocation === location && styles.selectedLocation
                        ]}
                        onPress={() => setSelectedLocation(location)}
                    >
                        <Text style={styles.locationText}>{location}</Text>
                    </TouchableOpacity>
                ))}
            </View>
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
    backButton: {
        color: '#007AFF',
        fontSize: 16,
    },
    saveButton: {
        color: '#007AFF',
        fontSize: 16,
        fontWeight: '600',
    },
    content: {
        padding: 16,
    },
    searchInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
        marginBottom: 16,
    },
    currentLocationButton: {
        padding: 16,
        backgroundColor: '#007AFF',
        borderRadius: 8,
        alignItems: 'center',
        marginBottom: 20,
    },
    currentLocationText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 12,
        color: '#333',
    },
    locationItem: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#ddd',
    },
    selectedLocation: {
        backgroundColor: '#e3f2fd',
        borderColor: '#007AFF',
    },
    locationText: {
        fontSize: 16,
        color: '#333',
    },
});

export default LocationPickerScreen;