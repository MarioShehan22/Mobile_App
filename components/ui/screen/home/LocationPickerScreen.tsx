import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import { placesAutocomplete, placeDetails, reverseGeocode, Suggestion, PlaceResolved } from '@/services/GooglePlaces';
import { auth, db } from '@/constants/firebaseConfig';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

interface LocationPickerScreenProps { navigation: any; route?: any; }

export default function LocationPickerScreen({ navigation }: LocationPickerScreenProps) {
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [selected, setSelected] = useState<PlaceResolved | null>(null);
    const [loading, setLoading] = useState(false);
    const debounceId = useRef<any>(null);

    // Optional: bias suggestions to current area (faster relevant results)
    const [nearby, setNearby] = useState<{ lat: number; lng: number } | null>(null);
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({});
                setNearby({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            } catch {}
        })();
    }, []);

    const runSearch = async (text: string) => {
        if (text.trim().length < 2) { setSuggestions([]); return; }
        try {
            setLoading(true);
            const list = await placesAutocomplete(text.trim(), nearby || undefined);
            setSuggestions(list);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Search error', e.message || 'Failed to search places');
        } finally {
            setLoading(false);
        }
    };

    const onChangeQuery = (text: string) => {
        setQuery(text);
        setSelected(null);
        if (debounceId.current) clearTimeout(debounceId.current);
        debounceId.current = setTimeout(() => runSearch(text), 400);
    };

    const pickSuggestion = async (s: Suggestion) => {
        try {
            setLoading(true);
            const det = await placeDetails(s.place_id);
            setSelected(det);
            setQuery(det.description);
            setSuggestions([]);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Place error', e.message || 'Could not resolve place');
        } finally {
            setLoading(false);
        }
    };

    const useCurrentLocation = async () => {
        try {
            setLoading(true);
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission denied', 'Location permission is required');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});
            const pretty = await reverseGeocode(loc.coords.latitude, loc.coords.longitude);
            const det: PlaceResolved = {
                description: `📍 ${pretty}`,
                lat: loc.coords.latitude,
                lng: loc.coords.longitude,
            };
            setSelected(det);
            setQuery(det.description);
            setSuggestions([]);
        } catch (e: any) {
            console.error(e);
            Alert.alert('Error', e.message || 'Failed to read current location');
        } finally {
            setLoading(false);
        }
    };

    const saveToFirestoreOptional = async (resolved: PlaceResolved) => {
        const user = auth.currentUser;
        if (!user) return;
        try {
            await addDoc(collection(db, 'saved_locations'), {
                userId: user.uid,
                description: resolved.description,
                lat: resolved.lat,
                lng: resolved.lng,
                createdAt: serverTimestamp(),
            });
        } catch (e) {
            // Don’t block the flow if saving favorites fails
            console.warn('Save location (optional) failed:', e);
        }
    };

    const saveAndReturn = async () => {
        if (!selected) {
            // If user typed but didn’t tap a suggestion, try to grab first suggestion
            if (suggestions[0]) {
                await pickSuggestion(suggestions[0]);
            } else {
                Alert.alert('Pick a place', 'Select a suggestion or use your current location.');
                return;
            }
        }
        const resolved = selected || (await placeDetails(suggestions[0].place_id));
        await saveToFirestoreOptional(resolved);

        // Return to Add/Edit Task with the picked location
        navigation.navigate('AddEditTask', {
            pickedLocation: {
                description: resolved.description,
                lat: resolved.lat,
                lng: resolved.lng,
            },
        });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.backButton}>← Back</Text></TouchableOpacity>
                <Text style={styles.headerTitle}>Choose Location</Text>
                <TouchableOpacity onPress={saveAndReturn}><Text style={styles.saveButton}>Save</Text></TouchableOpacity>
            </View>

            {/* Body */}
            <View style={styles.content}>
                <TextInput
                    style={styles.searchInput}
                    value={query}
                    onChangeText={onChangeQuery}
                    placeholder="Search a place, address, business…"
                    autoCapitalize="none"
                />

                <TouchableOpacity style={styles.currentLocationButton} onPress={useCurrentLocation}>
                    <Text style={styles.currentLocationText}>📍 Use Current Location</Text>
                </TouchableOpacity>

                {loading && <ActivityIndicator style={{ marginVertical: 8 }} />}

                <ScrollView keyboardShouldPersistTaps="handled">
                    {suggestions.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>Suggestions</Text>
                            {suggestions.map((s) => (
                                <TouchableOpacity
                                    key={s.place_id}
                                    style={[
                                        styles.locationItem,
                                        selected?.description === s.description && styles.selectedLocation,
                                    ]}
                                    onPress={() => pickSuggestion(s)}
                                >
                                    <Text style={styles.locationText}>{s.description}</Text>
                                </TouchableOpacity>
                            ))}
                        </>
                    )}

                    {/* Quick Actions (optional) */}
                    <Text style={styles.sectionTitle}>Quick</Text>
                    {['Home', 'Office', 'Grocery'].map((label) => (
                        <TouchableOpacity
                            key={label}
                            style={styles.locationItem}
                            onPress={() => onChangeQuery(label)}
                        >
                            <Text style={styles.locationText}>🔖 {label}</Text>
                        </TouchableOpacity>
                    ))}

                    {selected && (
                        <>
                            <Text style={styles.sectionTitle}>Selected</Text>
                            <View style={[styles.locationItem, styles.selectedLocation]}>
                                <Text style={styles.locationText}>{selected.description}</Text>
                                <Text style={{ color: '#666', marginTop: 6 }}>
                                    ({selected.lat.toFixed(6)}, {selected.lng.toFixed(6)})
                                </Text>
                            </View>
                        </>
                    )}
                </ScrollView>
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
    backButton: { color: '#007AFF', fontSize: 16 },
    saveButton: { color: '#007AFF', fontSize: 16, fontWeight: '600' },

    content: { padding: 16, flex: 1 },
    searchInput: {
        borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12,
        fontSize: 16, backgroundColor: '#fff', marginBottom: 16,
    },
    currentLocationButton: {
        padding: 14, backgroundColor: '#007AFF', borderRadius: 8,
        alignItems: 'center', marginBottom: 10,
    },
    currentLocationText: { color: '#fff', fontSize: 16, fontWeight: '600' },

    sectionTitle: { fontSize: 16, fontWeight: '700', marginTop: 16, marginBottom: 8, color: '#333' },
    locationItem: {
        padding: 14, backgroundColor: '#fff', borderRadius: 8, marginBottom: 8,
        borderWidth: 1, borderColor: '#ddd',
    },
    selectedLocation: { backgroundColor: '#eaf3ff', borderColor: '#007AFF' },
    locationText: { fontSize: 16, color: '#333' },
});