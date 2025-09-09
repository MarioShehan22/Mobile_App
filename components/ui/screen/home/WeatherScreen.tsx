import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const OPEN_WEATHER_API_KEY = '01e187216ba4a2dcc1712a4d95b70b56';

type Coords = { latitude: number; longitude: number };
type WeatherNow = {
    name?: string;
    condition: string;
    temperatureC: number;
    feelsLikeC: number;
    humidity: number;
    windSpeed: number; // m/s
    icon: string; // ow icon code
    sunrise?: number; // unix
    sunset?: number; // unix
};
type HourSlot = {
    ts: number;
    label: string; // '13:00'
    tempC: number;
    pop: number; // 0..1
    icon: string;
};
type DaySlot = {
    dateKey: string; // YYYY-MM-DD
    label: string;   // Mon, Tue...
    minC: number;
    maxC: number;
    popMax: number;
    icon: string;
};

interface WeatherScreenProps {
    navigation?: any;
    route?: { params?: { coords?: { lat: number; lon: number; description?: string } } };
}

export default function WeatherScreen({ route }: WeatherScreenProps) {
    const provided = route?.params?.coords;
    const [coords, setCoords] = useState<Coords | null>(provided ? { latitude: provided.lat, longitude: provided.lon } : null);
    const [placeLabel, setPlaceLabel] = useState<string | undefined>(provided?.description);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [units, setUnits] = useState<'C' | 'F'>('C');

    const [now, setNow] = useState<WeatherNow | null>(null);
    const [hourly, setHourly] = useState<HourSlot[]>([]);
    const [daily, setDaily] = useState<DaySlot[]>([]);
    const [updatedAt, setUpdatedAt] = useState<number | null>(null);

    // ==== helpers
    const CtoF = (c: number) => Math.round((c * 9) / 5 + 32);
    const speedMS2KPH = (m: number) => Math.round(m * 3.6);

    const displayTemp = useCallback(
        (c: number) => (units === 'C' ? `${Math.round(c)}°C` : `${CtoF(c)}°F`),
        [units]
    );

    const likelyUmbrella = useMemo(() => {
        // any next-24h slot with pop >= 0.4 or rainish icon
        const until = Date.now() + 24 * 3600 * 1000;
        return hourly.some(
            (h) =>
                h.ts * 1000 <= until &&
                (h.pop >= 0.4 || /09|10|11/.test(h.icon)) // drizzle/rain/thunderstorm icon groups
        );
    }, [hourly]);

    // ==== Location
    const getCurrentLocation = async (): Promise<Coords> => {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Location permission denied');
        }
        const loc = await Location.getCurrentPositionAsync({});
        return { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
    };

    // ==== OpenWeather calls (free-tier friendly)
    const getCurrentWeather = async (lat: number, lon: number): Promise<WeatherNow> => {
        const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_API_KEY}&units=metric`;
        const r = await fetch(url);
        if (!r.ok) {
            const t = await r.text();
            console.warn('[OW current] failed', r.status, t);
            throw new Error(`Weather: ${r.status}`);
        }
        const d = await r.json();
        const w: WeatherNow = {
            name: d.name,
            condition: d.weather?.[0]?.main ?? '—',
            temperatureC: d.main?.temp ?? 0,
            feelsLikeC: d.main?.feels_like ?? d.main?.temp ?? 0,
            humidity: d.main?.humidity ?? 0,
            windSpeed: d.wind?.speed ?? 0,
            icon: d.weather?.[0]?.icon ?? '01d',
            sunrise: d.sys?.sunrise,
            sunset: d.sys?.sunset,
        };
        return w;
    };

    const getForecast = async (lat: number, lon: number): Promise<{ hourly: HourSlot[]; daily: DaySlot[] }> => {
        // 5-day / 3-hour forecast
        const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${OPEN_WEATHER_API_KEY}&units=metric`;
        const r = await fetch(url);
        if (!r.ok) {
            const t = await r.text();
            console.warn('[OW forecast] failed', r.status, t);
            return { hourly: [], daily: [] };
        }
        const d = await r.json();
        const list = Array.isArray(d.list) ? d.list : [];

        // Next 8 slots (~24h)
        const next8: HourSlot[] = list.slice(0, 8).map((s: any) => {
            const ts = s.dt as number;
            const date = new Date(ts * 1000);
            const label = `${String(date.getHours()).padStart(2, '0')}:00`;
            return {
                ts,
                label,
                tempC: typeof s.main?.temp === 'number' ? s.main.temp : 0,
                pop: typeof s.pop === 'number' ? s.pop : 0,
                icon: s.weather?.[0]?.icon ?? '01d',
            };
        });

        // Group by date for min/max and max pop
        const byDay: Record<
            string,
            { temps: number[]; pops: number[]; icon: string; date: Date }
        > = {};

        list.forEach((s: any) => {
            const date = new Date((s.dt as number) * 1000);
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
                date.getDate()
            ).padStart(2, '0')}`;
            if (!byDay[key]) byDay[key] = { temps: [], pops: [], icon: s.weather?.[0]?.icon ?? '01d', date };
            if (typeof s.main?.temp === 'number') byDay[key].temps.push(s.main.temp);
            if (typeof s.pop === 'number') byDay[key].pops.push(s.pop);
            // prefer a rainy icon if present
            const icon = s.weather?.[0]?.icon;
            if (icon && /09|10|11/.test(icon)) byDay[key].icon = icon;
        });

        const days: DaySlot[] = Object.entries(byDay)
            .slice(0, 5)
            .map(([dateKey, agg]) => {
                const min = Math.min(...agg.temps);
                const max = Math.max(...agg.temps);
                const popMax = agg.pops.length ? Math.max(...agg.pops) : 0;
                const label = agg.date.toLocaleDateString(undefined, { weekday: 'short' });
                return { dateKey, label, minC: min, maxC: max, popMax, icon: agg.icon };
            });

        return { hourly: next8, daily: days };
    };

    const loadWeather = useCallback(async () => {
        try {
            setLoading(true);
            const c = coords ?? (await getCurrentLocation());
            setCoords(c);
            const [nowData, fc] = await Promise.all([getCurrentWeather(c.latitude, c.longitude), getForecast(c.latitude, c.longitude)]);
            setNow(nowData);
            setHourly(fc.hourly);
            setDaily(fc.daily);
            if (!placeLabel) setPlaceLabel(nowData.name);
            setUpdatedAt(Date.now());
        } catch (error: any) {
            console.error('Weather Error:', error);
            Alert.alert('Error', error?.message || 'Unable to fetch weather');
        } finally {
            setLoading(false);
        }
    }, [coords, placeLabel]);

    useEffect(() => {
        loadWeather();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadWeather();
        setRefreshing(false);
    }, [loadWeather]);

    // ==== UI
    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={{ padding: 16 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        >
            {/* Header Row */}
            <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.title}>Weather</Text>
                    <Text style={styles.subtitle}>{placeLabel || 'Current location'}</Text>
                </View>

                {/* Units toggle */}
                <View style={styles.unitToggle}>
                    <TouchableOpacity
                        style={[styles.unitPill, units === 'C' && styles.unitActive]}
                        onPress={() => setUnits('C')}
                    >
                        <Text style={[styles.unitText, units === 'C' && styles.unitTextActive]}>°C</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.unitPill, units === 'F' && styles.unitActive]}
                        onPress={() => setUnits('F')}
                    >
                        <Text style={[styles.unitText, units === 'F' && styles.unitTextActive]}>°F</Text>
                    </TouchableOpacity>
                </View>

                {/* Refresh */}
                <TouchableOpacity onPress={onRefresh} accessibilityRole="button" style={styles.refreshBtn}>
                    <Text style={styles.refreshText}>↻</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.loadingCard}>
                    <ActivityIndicator size="large" color="#007AFF" />
                    <Text style={{ marginTop: 8, color: '#6b7280' }}>Loading weather…</Text>
                </View>
            ) : now ? (
                <View>
                    {/* Current card */}
                    <View style={styles.currentCard}>
                        <View style={{ alignItems: 'center' }}>
                            <Image
                                source={{ uri: `https://openweathermap.org/img/wn/${now.icon}@4x.png` }}
                                style={styles.weatherIcon}
                            />
                            <Text style={styles.condition}>{now.condition}</Text>
                            <Text style={styles.tempMain}>{displayTemp(now.temperatureC)}</Text>
                            <Text style={styles.feelsLike}>Feels like {displayTemp(now.feelsLikeC)}</Text>
                            {updatedAt && (
                                <Text style={styles.updatedAt}>
                                    Updated {new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                            )}
                        </View>

                        {/* Stat chips */}
                        <View style={styles.statsRow}>
                            <View style={styles.statChip}>
                                <Text style={styles.statLabel}>Humidity</Text>
                                <Text style={styles.statValue}>{now.humidity}%</Text>
                            </View>
                            <View style={styles.statChip}>
                                <Text style={styles.statLabel}>Wind</Text>
                                <Text style={styles.statValue}>{speedMS2KPH(now.windSpeed)} km/h</Text>
                            </View>
                            <View style={styles.statChip}>
                                <Text style={styles.statLabel}>Rain (next)</Text>
                                <Text style={styles.statValue}>
                                    {hourly.length ? `${Math.round(Math.max(...hourly.map((h) => h.pop)) * 100)}%` : '—'}
                                </Text>
                            </View>
                        </View>

                        {/* Umbrella banner */}
                        {likelyUmbrella && (
                            <View style={styles.banner}>
                                <Text style={styles.bannerText}>🌧️ Rain likely today — consider taking an umbrella.</Text>
                            </View>
                        )}
                    </View>

                    {/* Next hours */}
                    {hourly.length > 0 && (
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>Next 24 hours</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hoursRow}>
                                {hourly.map((h) => (
                                    <View key={h.ts} style={styles.hourItem}>
                                        <Text style={styles.hourLabel}>{h.label}</Text>
                                        <Image
                                            source={{ uri: `https://openweathermap.org/img/wn/${h.icon}.png` }}
                                            style={{ width: 42, height: 42 }}
                                        />
                                        <Text style={styles.hourTemp}>{displayTemp(h.tempC)}</Text>
                                        <Text style={styles.hourPop}>{Math.round(h.pop * 100)}%</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        </View>
                    )}

                    {/* 5-day forecast */}
                    {daily.length > 0 && (
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>5-day forecast</Text>
                            {daily.map((d) => (
                                <View key={d.dateKey} style={styles.dayRow}>
                                    <Text style={styles.dayLabel}>{d.label}</Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                        <Image
                                            source={{ uri: `https://openweathermap.org/img/wn/${d.icon}.png` }}
                                            style={{ width: 28, height: 28 }}
                                        />
                                        <Text style={styles.dayTempRange}>
                                            {displayTemp(d.minC)} / {displayTemp(d.maxC)}
                                        </Text>
                                        <Text style={styles.dayPop}>{Math.round(d.popMax * 100)}%</Text>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ) : (
                <View style={styles.loadingCard}>
                    <Text style={{ color: '#6b7280' }}>No weather data</Text>
                </View>
            )}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f5faff' },

    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    title: { fontSize: 22, fontWeight: '800', color: '#0f172a' },
    subtitle: { fontSize: 13, color: '#6b7280', marginTop: 2 },

    unitToggle: {
        flexDirection: 'row',
        backgroundColor: '#eef3fb',
        borderRadius: 999,
        padding: 3,
        marginRight: 8,
    },
    unitPill: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 999,
    },
    unitActive: {
        backgroundColor: '#007AFF',
    },
    unitText: { fontSize: 13, color: '#334155', fontWeight: '700' },
    unitTextActive: { color: '#fff' },

    refreshBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    refreshText: { fontSize: 18, color: '#007AFF', fontWeight: '800' },

    loadingCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 4,
    },

    currentCard: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 18,
        marginTop: 12,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 4,
    },
    weatherIcon: { width: 110, height: 110 },
    condition: { fontSize: 18, fontWeight: '600', color: '#374151', marginTop: 8, textAlign: 'center' },
    tempMain: { fontSize: 46, fontWeight: '800', color: '#007AFF', marginTop: 4, textAlign: 'center' },
    feelsLike: { fontSize: 14, color: '#6b7280', marginTop: 2, textAlign: 'center' },
    updatedAt: { fontSize: 12, color: '#94a3b8', marginTop: 6, textAlign: 'center' },

    statsRow: {
        flexDirection: 'row',
        marginTop: 14,
        gap: 10,
    },
    statChip: {
        flex: 1,
        backgroundColor: '#f7faff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    statLabel: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
    statValue: { fontSize: 16, color: '#111827', fontWeight: '800', marginTop: 2 },

    banner: {
        marginTop: 12,
        backgroundColor: '#eaf3ff',
        borderColor: '#cfe3ff',
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
    },
    bannerText: { color: '#0f172a', fontWeight: '700' },

    card: {
        backgroundColor: '#ffffff',
        borderRadius: 14,
        padding: 16,
        marginTop: 12,
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 4,
    },
    sectionTitle: { fontSize: 16, fontWeight: '800', color: '#0f172a', marginBottom: 8 },

    hoursRow: { gap: 10 },
    hourItem: {
        width: 84,
        alignItems: 'center',
        backgroundColor: '#f8fbff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        paddingVertical: 10,
    },
    hourLabel: { fontSize: 12, color: '#6b7280', fontWeight: '700' },
    hourTemp: { fontSize: 16, fontWeight: '800', color: '#111827', marginTop: 4 },
    hourPop: { fontSize: 12, color: '#007AFF', fontWeight: '700', marginTop: 2 },

    dayRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    dayLabel: { fontSize: 14, color: '#374151', fontWeight: '700' },
    dayTempRange: { fontSize: 14, color: '#111827', fontWeight: '800' },
    dayPop: { fontSize: 13, color: '#007AFF', fontWeight: '700' },
});