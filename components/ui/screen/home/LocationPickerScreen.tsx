import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    ActivityIndicator,
} from 'react-native';
import axios from 'axios';
import * as Location from 'expo-location';

// Firebase
import { auth, db } from '@/constants/firebaseConfig';
import {
    addDoc,
    collection,
    deleteDoc,
    doc,
    getDocs,
    orderBy,
    query,
    serverTimestamp,
    where,
    updateDoc,
    limit as fsLimit,
} from 'firebase/firestore';

// (optional) expo-router support
let router: { back: () => void } | null = null;
try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    router = require('expo-router').router;
} catch (_) {
    router = null;
}

const OPENCAGE_API_KEY = '9f5f9b8d658d47baa73f90d79f09fcb1';

interface LocationPickerScreenProps {
    navigation: any;
}

type ResultItem = { description: string; lat: number; lng: number };
type SavedLocation = ResultItem & { id: string; label: string; createdAt?: any; lastUsedAt?: any };

export default function LocationPickerScreen({ navigation }: LocationPickerScreenProps) {
    const [searchText, setSearchText] = useState('');
    const [label, setLabel] = useState(''); // custom nickname to store
    const [selected, setSelected] = useState<ResultItem | null>(null);
    const [results, setResults] = useState<ResultItem[]>([]);
    const [typingTimeout, setTypingTimeout] = useState<number | null>(null);

    const [saved, setSaved] = useState<SavedLocation[]>([]);
    const [loadingSaved, setLoadingSaved] = useState(true);
    const [saving, setSaving] = useState(false);

    // Quick presets (no coordinates until the user sets/edits them)
    const quickPresets: ResultItem[] = [
        { description: '📍 Home', lat: 0, lng: 0 },
        { description: '🏢 Office', lat: 0, lng: 0 },
        { description: '🛒 Grocery Store', lat: 0, lng: 0 },
    ];

    const goBack = () => {
        if (router) router.back();
        else navigation?.goBack?.();
    };

    // ---- Firestore: load user's saved locations
    const loadSaved = async () => {
        const user = auth.currentUser;
        if (!user) {
            setSaved([]);
            setLoadingSaved(false);
            return;
        }
        setLoadingSaved(true);
        try {
            const q = query(
                collection(db, 'locations'),
                where('userId', '==', user.uid),
                orderBy('lastUsedAt', 'desc'),
                fsLimit(25)
            );
            const snap = await getDocs(q);
            const items: SavedLocation[] = [];
            snap.forEach((d) => {
                const data = d.data() as any;
                items.push({
                    id: d.id,
                    label: data.label,
                    description: data.description,
                    lat: data.lat,
                    lng: data.lng,
                    createdAt: data.createdAt,
                    lastUsedAt: data.lastUsedAt,
                });
            });
            setSaved(items);
        } catch (e) {
            console.error('Load saved locations failed:', e);
            Alert.alert('Error', 'Failed to load saved locations.');
        } finally {
            setLoadingSaved(false);
        }
    };

    useEffect(() => {
        loadSaved();
    }, []);

    // ---- OpenCage search (debounced)
    const handleSearchLocation = async (queryText: string) => {
        if (!queryText || queryText.trim().length < 3) {
            setResults([]);
            return;
        }
        try {
            const response = await axios.get(`https://api.opencagedata.com/geocode/v1/json`, {
                params: { q: queryText, key: OPENCAGE_API_KEY, limit: 6 },
            });
            const list: ResultItem[] = response.data.results.map((item: any) => ({
                description: item.formatted,
                lat: item.geometry.lat,
                lng: item.geometry.lng,
            }));
            setResults(list);
        } catch (error) {
            console.error('Geocoding error:', error);
            Alert.alert('Search Error', 'Failed to fetch location suggestions.');
        }
    };

    const onChangeSearch = (text: string) => {
        setSearchText(text);
        setSelected(null);
        if (typingTimeout) clearTimeout(typingTimeout as any);
        const tid = setTimeout(() => handleSearchLocation(text), 600) as any as number;
        setTypingTimeout(tid);
    };

    // ---- Use current device location
    const handleUseCurrent = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Location permission is required');
                return;
            }
            const loc = await Location.getCurrentPositionAsync({});
            const { latitude, longitude } = loc.coords;
            const addr = await Location.reverseGeocodeAsync({ latitude, longitude });

            const pretty = addr[0]
                ? `${addr[0].name || ''} ${addr[0].street || ''}, ${addr[0].city || ''}, ${addr[0].region || ''}`.trim()
                : `Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`;

            const item: ResultItem = { description: `📍 ${pretty}`, lat: latitude, lng: longitude };
            setSelected(item);
            setSearchText(item.description);
            setResults([]);
            if (!label) setLabel('Current location');
            Alert.alert('Location Selected', item.description);
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to get location');
        }
    };

    // ---- Save to Firestore and navigate back with pickedLocation
    const saveAndUse = async () => {
        const user = auth.currentUser;
        if (!user) {
            Alert.alert('Not signed in', 'You need to be signed in to save a location.');
            return;
        }
        const pick = selected || results.find((r) => r.description === searchText);
        if (!pick) {
            Alert.alert('Error', 'Please select or search for a location');
            return;
        }
        if (!pick.lat || !pick.lng) {
            Alert.alert('Missing coordinates', 'This location has no coordinates.');
            return;
        }
        if (!label.trim()) {
            Alert.alert('Missing label', 'Please enter a label for this location (e.g., Home, Office).');
            return;
        }

        try {
            setSaving(true);
            const docRef = await addDoc(collection(db, 'locations'), {
                userId: user.uid,
                label: label.trim(),
                description: pick.description,
                lat: pick.lat,
                lng: pick.lng,
                createdAt: serverTimestamp(),
                lastUsedAt: serverTimestamp(),
            });

            // navigate back to task screen with selected location
            navigation?.navigate?.('AddEditTask', {
                pickedLocation: { description: pick.description, lat: pick.lat, lng: pick.lng },
            });
            // or if using expo-router: router?.back()
            loadSaved(); // refresh saved list (best-effort)
        } catch (e: any) {
            console.error('Save location failed:', e);
            Alert.alert('Save failed', e?.message ?? 'Could not save location.');
        } finally {
            setSaving(false);
        }
    };

    // ---- Use selected WITHOUT saving
    const useWithoutSaving = () => {
        const pick = selected || results.find((r) => r.description === searchText);
        if (!pick) {
            Alert.alert('Error', 'Please select or search for a location');
            return;
        }
        navigation?.navigate?.('AddEditTask', {
            pickedLocation: { description: pick.description, lat: pick.lat, lng: pick.lng },
        });
    };

    // ---- Tap a saved item
    const selectSaved = async (item: SavedLocation) => {
        setSelected(item);
        setSearchText(item.description);
        setLabel(item.label);
        // bump lastUsedAt
        try {
            await updateDoc(doc(db, 'locations', item.id), { lastUsedAt: serverTimestamp() });
        } catch {}
    };

    // ---- Delete a saved item (long press)
    const deleteSaved = (item: SavedLocation) => {
        Alert.alert('Delete saved location', `Remove "${item.label}"?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'locations', item.id));
                        setSaved((s) => s.filter((i) => i.id !== item.id));
                    } catch (e) {
                        console.error('Delete saved failed:', e);
                        Alert.alert('Error', 'Could not delete saved location.');
                    }
                },
            },
        ]);
    };

    const filteredQuick = quickPresets.filter((loc) =>
        loc.description.toLowerCase().includes(searchText.toLowerCase())
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={goBack}>
                    <Text style={styles.backButton}>← Back</Text>
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Choose Location</Text>
                <View style={{ width: 60, alignItems: 'flex-end' }}>
                    {/* spacer for alignment */}
                </View>
            </View>

            <View style={styles.content}>
                {/* Search */}
                <TextInput
                    style={styles.searchInput}
                    value={searchText}
                    onChangeText={onChangeSearch}
                    placeholder="Search for a location (city, street, place)…"
                    returnKeyType="search"
                />

                {/* Label (nickname) */}
                <TextInput
                    style={[styles.searchInput, { marginTop: 8 }]}
                    value={label}
                    onChangeText={setLabel}
                    placeholder="Label (e.g., Home, Office, Client Site A)"
                    returnKeyType="done"
                />

                {/* Use current location */}
                <TouchableOpacity style={styles.currentLocationButton} onPress={handleUseCurrent}>
                    <Text style={styles.currentLocationText}>📍 Use Current Location</Text>
                </TouchableOpacity>

                <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
                    {/* Suggestions */}
                    {results.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>Suggestions</Text>
                            {results.map((r, i) => {
                                const isSel = selected?.description === r.description && selected.lat === r.lat && selected.lng === r.lng;
                                return (
                                    <TouchableOpacity
                                        key={`${r.description}-${i}`}
                                        style={[styles.locationItem, isSel && styles.selectedLocation]}
                                        onPress={() => {
                                            setSelected(r);
                                            setSearchText(r.description);
                                            if (!label) setLabel(r.description.replace(/^📍\s?/, ''));
                                            setResults([]);
                                        }}
                                    >
                                        <Text style={styles.locationText}>{r.description}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </>
                    )}

                    {/* Saved locations */}
                    <View style={{ marginTop: 6 }}>
                        <View style={styles.sectionHeaderRow}>
                            <Text style={styles.sectionTitle}>Saved</Text>
                            {loadingSaved && <ActivityIndicator size="small" color="#007AFF" />}
                        </View>
                        {saved.length === 0 && !loadingSaved ? (
                            <Text style={{ color: '#6b7280', marginBottom: 8 }}>No saved places yet.</Text>
                        ) : (
                            saved.map((r) => {
                                const isSel =
                                    selected?.lat === r.lat &&
                                    selected?.lng === r.lng &&
                                    selected?.description === r.description;
                                return (
                                    <TouchableOpacity
                                        key={r.id}
                                        style={[styles.locationItem, isSel && styles.selectedLocation]}
                                        onPress={() => selectSaved(r)}
                                        onLongPress={() => deleteSaved(r)}
                                    >
                                        <Text style={styles.locationText}>
                                            <Text style={{ fontWeight: '700' }}>{r.label}: </Text>
                                            {r.description}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </View>

                    {/* Quick locations (static examples) */}
                    <Text style={styles.sectionTitle}>Quick Locations</Text>
                    {filteredQuick.map((r, i) => {
                        const isSel = selected?.description === r.description && selected.lat === r.lat && selected.lng === r.lng;
                        return (
                            <TouchableOpacity
                                key={`${r.description}-${i}`}
                                style={[styles.locationItem, isSel && styles.selectedLocation]}
                                onPress={() => {
                                    setSelected(r);
                                    setSearchText(r.description);
                                    if (!label) setLabel(r.description.replace(/^📍\s?/, ''));
                                }}
                            >
                                <Text style={styles.locationText}>{r.description}</Text>
                                {r.lat === 0 && r.lng === 0 && (
                                    <Text style={{ color: '#9ca3af', marginTop: 4 }}>
                                        Tip: search and select the exact address, then label it “{r.description.replace(/^[^\s]+\s/, '')}”
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Action bar */}
                <View style={styles.actionRow}>
                    <TouchableOpacity style={[styles.actionBtn, styles.secondary]} onPress={useWithoutSaving}>
                        <Text style={[styles.actionText, styles.secondaryText]}>Use without saving</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionBtn, saving && { opacity: 0.6 }]} onPress={saveAndUse} disabled={saving}>
                        <Text style={styles.actionText}>{saving ? 'Saving…' : 'Save & use'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

// Styles tuned to your app's look (rounded cards, blue accent)
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
    backButton: { color: '#007AFF', fontSize: 16 },

    content: { padding: 16, flex: 1 },
    searchInput: {
        borderWidth: 1,
        borderColor: '#ddd',
        borderRadius: 10,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    currentLocationButton: {
        padding: 14,
        backgroundColor: '#007AFF',
        borderRadius: 10,
        alignItems: 'center',
        marginVertical: 16,
    },
    currentLocationText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 10, color: '#0f172a', marginTop: 6 },

    locationItem: {
        padding: 14,
        backgroundColor: '#fff',
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    selectedLocation: { backgroundColor: '#eaf3ff', borderColor: '#007AFF' },
    locationText: { fontSize: 15, color: '#111827' },

    actionRow: { flexDirection: 'row', gap: 10, marginTop: 10 },
    actionBtn: {
        flex: 1,
        backgroundColor: '#007AFF',
        borderRadius: 10,
        alignItems: 'center',
        paddingVertical: 14,
    },
    actionText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    secondary: { backgroundColor: '#eef3fb' },
    secondaryText: { color: '#0f172a' },
});