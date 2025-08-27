# 📌 Task Management App

A **cross-platform (iOS/Android/Web)** task manager built with **Expo + React Native + Firebase**.  
It combines classic to-do features with **context-aware automation**.

---

## ✨ Features

- 📆 **Calendar-first UI** → tap any date to see that day’s tasks.
- ⏰ **Time reminders** → notifications at **T-24h, T-6h, T-1h**.
- 📍 **Location reminders** → geofence alerts when within ~1 km of task location.
- 🌧️ **Weather awareness** → rain forecast reminders (umbrella tips).
- 🔄 **Realtime sync** with Firestore (per-user).
- 🖥️ **Web compatibility** with graceful fallbacks.

---

## 🏗️ Architecture & Flow

### 🔑 Auth & Data
- Firebase Auth for user authentication.
- Firestore `tasks` collection per-user (`userId` based filtering).
- Optional `locations` collection for saved places.

### 📝 Task Creation / Edit
- Fields: `title`, `dueDate`, `dueTime`, `priority`.
- Toggles: **Location**, **Weather**.
- Location Picker: type-ahead (Geoapify / LocationIQ / OpenCage) or GPS + reverse geocode.

### ⚙️ Automations
- **Time notifications** → scheduled at 24h / 6h / 1h.
- **Geofence notifications** → background geofencing via `expo-task-manager`.
- **Weather tip** → pre-check with OpenWeather and schedule umbrella reminders.

### 📅 Calendar & Filters
- Uses `react-native-calendars`.
- Filters: **All**, **Today**, **Overdue** + date-specific lists.

### 🌐 Web Compatibility
- Native pickers replaced by text input (`YYYY-MM-DD` / `HH:mm`).
- Geofencing disabled on web (other logic intact).

---

## 🗄️ Data Model (Firestore)

### Tasks
```json
{
  "id": "string",
  "userId": "string",
  "title": "string",
  "dueDate": "YYYY-MM-DD",
  "dueTime": "HH:mm",
  "priority": "high|medium|low",
  "isCompleted": false,
  "hasLocation": true,
  "hasWeather": true,
  "location": { "description": "string", "lat": 0, "lng": 0, "radius": 1000 },
  "notificationIds": { "minus24": "id", "minus6": "id", "minus1": "id", "umbrella": "id" },
  "geofenceId": "string",
  "createdAt": "<Firestore Timestamp>"
}
```
### Locations
```json
{
  "userId": "string",
  "label": "string",
  "description": "string",
  "lat": 0,
  "lng": 0,
  "createdAt": "<Timestamp>",
  "lastUsedAt": "<Timestamp>"
}
```

## Technology

- **Framework**: Expo SDK 53, React Native, Expo Router

- **State & Realtime**: Firebase Firestore (web SDK), live queries (onSnapshot)

- **Auth**: Firebase Auth (Native: initializeAuth with AsyncStorage persistence, Web: getAuth)

- **Notifications**: expo-notifications (local scheduling)

- **Location & Geofencing**: expo-location, expo-task-manager

- **Calendar UI**: react-native-calendars

- **Date/Time Input**: @react-native-community/datetimepicker (native) + text fallback (web)

- **Weather**: OpenWeather (Current Weather / One Call as available)

- **Geocoding/Autocomplete**: Geoapify / LocationIQ / OpenCage (free tiers; pick one)

- **Styling**: React Native StyleSheet with a clean, modern, accessible layout

- **Testing**: Jest + Testing Library with mocks for Firebase and Expo modules (optional setup provided)
