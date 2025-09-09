import { auth, db } from '@/constants/firebaseConfig';
import { placeDetails, PlaceResolved, placesAutocomplete, reverseGeocode, Suggestion } from '@/services/GooglePlaces';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { addDoc, collection, deleteDoc, doc, getDocs, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';

interface LocationPickerScreenProps { navigation: any; route?: any; }

interface SavedLocation extends PlaceResolved { id: string; }

export default function LocationPickerScreen({ navigation }: LocationPickerScreenProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
    const [selected, setSelected] = useState<PlaceResolved | null>(null);
    const [loading, setLoading] = useState(false);
    const debounceId = useRef<any>(null);

    // Optional: bias suggestions to current area (faster relevant results)
    const [nearby, setNearby] = useState<{ lat: number; lng: number } | null>(null);
    const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [renameValue, setRenameValue] = useState('');
    const [renameTarget, setRenameTarget] = useState<SavedLocation | null>(null);
    useEffect(() => {
        (async () => {
            try {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') return;
                const loc = await Location.getCurrentPositionAsync({});
                setNearby({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            } catch {}
            // Fetch saved locations from Firestore
            try {
                const user = auth.currentUser;
                if (!user) return;
                const qSaved = query(
                    collection(db, 'saved_locations'),
                    where('userId', '==', user.uid),
                    orderBy('createdAt', 'desc')
                );
                const snap = await getDocs(qSaved);
                const locs: SavedLocation[] = [];
                snap.forEach(docSnap => {
                    const d = docSnap.data() as { description: string; lat: number; lng: number };
                    locs.push({
                        id: docSnap.id,
                        description: d.description,
                        lat: d.lat,
                        lng: d.lng,
                    });
                });
                setSavedLocations(locs);
            } catch (e) {
                console.warn('Failed to fetch saved locations:', e);
            }
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
        setSearchQuery(text);
        setSelected(null);
        if (debounceId.current) clearTimeout(debounceId.current);
        debounceId.current = setTimeout(() => runSearch(text), 400);
    };

    const pickSuggestion = async (s: Suggestion) => {
        try {
            setLoading(true);
            const det = await placeDetails(s.place_id);
            setSelected(det);
            setSearchQuery(det.description);
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
            setSearchQuery(det.description);
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

    const handleDeleteLocation = async (locId: string) => {
        Alert.alert('Delete Location', 'Are you sure you want to delete this saved location?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'saved_locations', locId));
                        setSavedLocations((prev) => prev.filter((l) => l.id !== locId));
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete location.');
                    }
                }
            }
        ]);
    };
    const openRenameModal = (loc: SavedLocation) => {
        setRenameTarget(loc);
        setRenameValue(loc.description);
        setRenameModalVisible(true);
    };
    const handleRenameSave = async () => {
        if (!renameTarget || !renameValue.trim()) return;
        try {
            await updateDoc(doc(db, 'saved_locations', renameTarget.id), { description: renameValue.trim() });
            setSavedLocations((prev) => prev.map((l) => l.id === renameTarget.id ? { ...l, description: renameValue.trim() } : l));
            setRenameModalVisible(false);
            setRenameTarget(null);
            setRenameValue('');
        } catch (e) {
            Alert.alert('Error', 'Failed to rename location.');
        }
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
                    value={searchQuery}
                    onChangeText={onChangeQuery}
                    placeholder="Search a place, address, business…"
                    autoCapitalize="none"
                />
                <TouchableOpacity style={styles.currentLocationButton} onPress={useCurrentLocation}>
                    <Text style={styles.currentLocationText}>📍 Use Current Location</Text>
                </TouchableOpacity>
                {loading && <ActivityIndicator style={{ marginVertical: 8 }} />}
                <ScrollView keyboardShouldPersistTaps="handled">
                    {/* Saved Locations */}
                    {savedLocations.length > 0 && (
                        <View>
                            <Text style={styles.sectionTitle}>Saved Locations</Text>
                            {savedLocations.map((loc, idx) => (
                                <View key={loc.id} style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <TouchableOpacity
                                        style={[
                                            styles.locationItem,
                                            selected?.description === loc.description && styles.selectedLocation,
                                            { flex: 1 }
                                        ]}
                                        onPress={() => {
                                            setSelected(loc);
                                            setSearchQuery(loc.description);
                                            setSuggestions([]);
                                        }}
                                    >
                                        <Text style={styles.locationText}>{loc.description}</Text>
                                        <Text style={{ color: '#666', marginTop: 6 }}>
                                            ({loc.lat.toFixed(6)}, {loc.lng.toFixed(6)})
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => openRenameModal(loc)} style={{ marginLeft: 8 }}>
                                        <Ionicons name="pencil" size={20} color="#007AFF" />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => handleDeleteLocation(loc.id)} style={{ marginLeft: 8 }}>
                                        <Ionicons name="trash" size={20} color="#FF3B30" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                    {/* Suggestions */}
                    {suggestions.length > 0 && (
                        <View>
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
                        </View>
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
                        <View>
                            <Text style={styles.sectionTitle}>Selected</Text>
                            <View style={[styles.locationItem, styles.selectedLocation]}>
                                <Text style={styles.locationText}>{selected.description}</Text>
                                <Text style={{ color: '#666', marginTop: 6 }}>
                                    ({selected.lat.toFixed(6)}, {selected.lng.toFixed(6)})
                                </Text>
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>
            {/* Rename Modal */}
            <Modal
                visible={renameModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setRenameModalVisible(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                    <View style={{ backgroundColor: '#fff', padding: 24, borderRadius: 12, width: '80%' }}>
                        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Rename Location</Text>
                        <TextInput
                            value={renameValue}
                            onChangeText={setRenameValue}
                            style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 16, marginBottom: 16 }}
                            placeholder="Enter new name"
                            autoFocus
                        />
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <TouchableOpacity onPress={() => setRenameModalVisible(false)} style={{ marginRight: 16 }}>
                                <Text style={{ color: '#888', fontSize: 16 }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleRenameSave}>
                                <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: 'bold' }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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