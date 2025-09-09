import * as Notifications from 'expo-notifications';
import { doc, setDoc, serverTimestamp, arrayUnion, updateDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/constants/firebaseConfig';

export async function registerFcmToken() {
    const user = auth.currentUser;
    if (!user) return;

    // Request permission (Android 13+ and iOS)
    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted' && perm.canAskAgain) {
        await Notifications.requestPermissionsAsync();
    }

    // Get native device push token (FCM on Android, APNs on iOS)
    const { data: fcmToken } = await Notifications.getDevicePushTokenAsync();

    if (!fcmToken) return;

    const userRef = doc(db, 'users', user.uid);

    // upsert user record and store token in an array (handles multi-device)
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, {
            fcmTokens: [fcmToken],
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        });
    } else {
        await updateDoc(userRef, {
            fcmTokens: arrayUnion(fcmToken),
            updatedAt: serverTimestamp(),
        });
    }

    return fcmToken;
}
