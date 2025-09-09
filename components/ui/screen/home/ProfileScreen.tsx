import React, { useState } from "react";
import {
    View,
    Text,
    TextInput,
    StyleSheet,
    TouchableOpacity,
    Image,
    Alert,
    ActivityIndicator,
} from "react-native";
import { auth } from "@/constants/firebaseConfig";
import { updateProfile, updatePassword, signOut } from "firebase/auth";
import { LinearGradient } from "expo-linear-gradient";
import { Color } from "@/constants/Colors";

export default function ProfileScreen({ navigation }: any) {
    const user = auth.currentUser;

    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [email] = useState(user?.email || "");
    const [newPassword, setNewPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        if (!user) return;
        setLoading(true);

        try {
            if (displayName && displayName !== user.displayName) {
                await updateProfile(user, { displayName });
            }

            if (newPassword.length > 5) {
                await updatePassword(user, newPassword);
            }

            Alert.alert("Success", "Profile updated");
        } catch (error: any) {
            Alert.alert("Error", error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await signOut(auth);
        navigation.replace("Login");
    };

    return (
        <View style={styles.container}>
            {/* Profile Card */}
            <View style={styles.profileCard}>
                <Image
                    source={{
                        uri:
                            user?.photoURL ||
                            "https://icons.veryicon.com/png/o/miscellaneous/user-avatar/user-avatar-male-5.png",
                    }}
                    style={styles.avatar}
                />
                <Text style={styles.name}>{displayName || "User"}</Text>
                <Text style={styles.email}>{email}</Text>
            </View>

            {/* Inputs */}
            <View style={styles.formCard}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
                    placeholder="Enter your name"
                />

                <Text style={styles.label}>New Password</Text>
                <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    value={newPassword}
                    onChangeText={setNewPassword}
                    secureTextEntry
                />
            </View>

            {/* Update Button */}
            <TouchableOpacity
                style={styles.updateButton}
                onPress={handleUpdate}
                disabled={loading}
            >
                <LinearGradient
                    colors={["#0066FF", "#4A90E2"]}
                    style={styles.gradientButton}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.updateButtonText}>Update Profile</Text>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            {/* Logout */}
            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: "#f4f6fa" },

    profileCard: {
        backgroundColor: "#fff",
        borderRadius: 16,
        paddingVertical: 30,
        alignItems: "center",
        marginBottom: 25,
        elevation: 4,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    avatar: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 12,
    },
    name: {
        fontSize: 22,
        fontWeight: "700",
        color: "#222",
    },
    email: {
        fontSize: 14,
        color: "#777",
        marginTop: 4,
    },

    formCard: {
        backgroundColor: "#fff",
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        elevation: 3,
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
    },
    label: {
        fontSize: 14,
        color: "#444",
        marginBottom: 6,
        marginTop: 12,
    },
    input: {
        backgroundColor: "#f9f9f9",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },

    updateButton: {
        borderRadius: 10,
        overflow: "hidden",
    },
    gradientButton: {
        height: 50,
        justifyContent: "center",
        alignItems: "center",
    },
    updateButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },

    logoutButton: {
        marginTop: 20,
        alignItems: "center",
        borderColor: "#e53935",
        borderWidth: 1.5,
        borderRadius: 8,
        paddingVertical: 12,
    },
    logoutText: {
        color: "#e53935",
        fontSize: 15,
        fontWeight: "600",
    },
});
