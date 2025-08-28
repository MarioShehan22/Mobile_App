const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || "AIzaSyAbqLWPur_083K8u0emfyr3hny3JFLdmhg";

const BASE = 'https://maps.googleapis.com/maps/api';

export type Suggestion = { description: string; place_id: string };
export type PlaceResolved = { description: string; lat: number; lng: number };

function assertKey() {
    if (!API_KEY) {
        throw new Error(
            'Missing Google Maps key. Set EXPO_PUBLIC_GOOGLE_MAPS_KEY in .env'
        );
    }
}

// Autocomplete text -> suggestions (place_id)
export async function placesAutocomplete(
    input: string,
    opts?: { lat?: number; lng?: number; radiusMeters?: number }
): Promise<Suggestion[]> {
    assertKey();
    const params = new URLSearchParams({
        input,
        key: API_KEY!,
    });

    // Optional location bias
    if (opts?.lat && opts?.lng) {
        params.append('location', `${opts.lat},${opts.lng}`);
        params.append('radius', String(opts.radiusMeters ?? 20000)); // 20km
    }

    const url = `${BASE}/place/autocomplete/json?${params.toString()}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
        console.warn('Places autocomplete error:', json);
        throw new Error(json.error_message || json.status || 'Places error');
    }

    return (json.predictions || []).map((p: any) => ({
        description: p.description,
        place_id: p.place_id,
    }));
}

// Place details -> lat/lng
export async function placeDetails(place_id: string): Promise<PlaceResolved> {
    assertKey();
    const params = new URLSearchParams({
        place_id,
        key: API_KEY!,
        fields: 'formatted_address,geometry/location',
    });
    const url = `${BASE}/place/details/json?${params.toString()}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== 'OK') {
        console.warn('Place details error:', json);
        throw new Error(json.error_message || json.status || 'Place details error');
    }

    const addr = json.result.formatted_address || '';
    const loc = json.result.geometry?.location;
    return {
        description: addr,
        lat: loc?.lat ?? 0,
        lng: loc?.lng ?? 0,
    };
}

// Reverse geocode current lat/lng -> pretty address
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
    assertKey();
    const params = new URLSearchParams({
        latlng: `${lat},${lng}`,
        key: API_KEY!,
    });
    const url = `${BASE}/geocode/json?${params.toString()}`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') {
        console.warn('Geocode error:', json);
        throw new Error(json.error_message || json.status || 'Geocode error');
    }

    return json.results?.[0]?.formatted_address || `Lat ${lat}, Lng ${lng}`;
}
