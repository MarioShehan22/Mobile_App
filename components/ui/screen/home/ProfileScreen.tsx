import React, { useState } from "react";
import {View, Text, TextInput, StyleSheet, TouchableOpacity, Image, Alert, ActivityIndicator} from "react-native";
import { auth } from "@/constants/firebaseConfig";
import { updateProfile, updatePassword, signOut } from "firebase/auth";
import { Color } from "@/constants/Colors";

export default function ProfileScreen({ navigation }: any) {
    const user = auth.currentUser;

    const [displayName, setDisplayName] = useState(user?.displayName || "");
    const [email, setEmail] = useState(user?.email || "");
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
            <View style={styles.avatarWrapper}>
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

            <View style={styles.inputGroup}>
                <Text style={styles.label}>Display Name</Text>
                <TextInput
                    style={styles.input}
                    value={displayName}
                    onChangeText={setDisplayName}
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

            <TouchableOpacity
                style={styles.updateButton}
                onPress={handleUpdate}
                disabled={loading}
            >
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.updateButtonText}>Update Profile</Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                <Text style={styles.logoutText}>Log Out</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 24, backgroundColor: "#f9f9f9" },
    avatarWrapper: {
        alignItems: "center",
        marginBottom: 30,
    },
    avatar: {
        width: 90,
        height: 90,
        borderRadius: 45,
        marginBottom: 10,
    },
    name: {
        fontSize: 20,
        fontWeight: "600",
        color: Color.primary || "#333",
    },
    email: {
        fontSize: 14,
        color: "#777",
        marginTop: 4,
    },
    inputGroup: {
        marginBottom: 24,
    },
    label: {
        fontSize: 14,
        color: "#444",
        marginBottom: 4,
        marginTop: 16,
    },
    input: {
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 6,
        padding: 10,
        fontSize: 16,
    },
    updateButton: {
        backgroundColor: Color.blue,
        paddingVertical: 14,
        borderRadius: 6,
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
    },
    logoutText: {
        color: "#e53935",
        fontSize: 15,
        fontWeight: "500",
    },
});
