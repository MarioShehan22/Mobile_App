import { useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { TextInput } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { Color } from "@/constants/Colors";
// @ts-ignore
import logo from "../../../../assets/images/logo/logo.png";
import { auth } from "@/constants/firebaseConfig";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

export default function SignUpScreen({ navigation }: any) {
    const [email, setEmail] = useState("");
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [password, setPassword] = useState("");
    const [displayName, setDisplayName] = useState("");

    const handleSignUp = async () => {
        if (!email || !password || !displayName) {
            alert("Please fill in all fields");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await updateProfile(user, { displayName });

            console.log("User created:", user);
            alert("Account created successfully!");
            navigation.navigate("Login");
        } catch (error: any) {
            console.error("Signup error:", error);
            alert(error.message);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
                <View style={styles.logoWrapper}>
                    <Image source={logo} style={styles.logo} resizeMode="contain" />
                    <Text style={styles.headerText}>Create Account</Text>
                    <Text style={styles.subText}>Join us and get started 🚀</Text>
                </View>

                <View style={styles.formGroup}>
                    <TextInput
                        label="Email"
                        left={<TextInput.Icon icon="email-outline" />}
                        mode="outlined"
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        value={email}
                        onChangeText={setEmail}
                    />
                </View>

                <View style={styles.formGroup}>
                    <TextInput
                        value={password}
                        onChangeText={setPassword}
                        label="Password"
                        left={<TextInput.Icon icon="lock-outline" />}
                        secureTextEntry={!passwordVisible}
                        mode="outlined"
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        right={
                            <TextInput.Icon
                                icon={passwordVisible ? "eye-off" : "eye"}
                                onPress={() => setPasswordVisible(!passwordVisible)}
                                color="#888"
                                size={20}
                            />
                        }
                    />
                </View>

                <View style={styles.formGroup}>
                    <TextInput
                        left={<TextInput.Icon icon="account-outline" />}
                        mode="outlined"
                        style={styles.input}
                        contentStyle={styles.inputContent}
                        label="Username"
                        value={displayName}
                        onChangeText={setDisplayName}
                    />
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity style={styles.signUpButton} onPress={handleSignUp}>
                    <LinearGradient colors={["#0066FF", "#4A90E2"]} style={styles.gradientButton}>
                        <Text style={styles.signUpText}>Sign Up</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <View style={styles.orWrapper}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.line} />
                </View>

                {/* Already have account */}
                <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate("Login")}>
                    <Text style={styles.secondaryText}>Already have an account? Log In</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Color.light,
    },
    scrollContent: {
        flexGrow: 1,
        justifyContent: "center",
        padding: 20,
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 24,
        elevation: 6,
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    logoWrapper: {
        alignItems: "center",
        marginBottom: 20,
    },
    logo: {
        width: 150,
        height: 50,
        marginBottom: 10,
    },
    headerText: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#222",
    },
    subText: {
        fontSize: 14,
        color: "#666",
        marginTop: 4,
        textAlign: "center",
    },
    formGroup: {
        marginBottom: 18,
    },
    input: {
        backgroundColor: "transparent",
    },
    inputContent: {
        paddingLeft: 0,
        paddingRight: 0,
    },
    signUpButton: {
        marginTop: 10,
        borderRadius: 10,
        overflow: "hidden",
    },
    gradientButton: {
        height: 50,
        justifyContent: "center",
        alignItems: "center",
    },
    signUpText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "600",
    },
    orWrapper: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 25,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: "#ddd",
    },
    orText: {
        marginHorizontal: 10,
        color: "#888",
        fontWeight: "500",
    },
    secondaryButton: {
        borderColor: "#0066FF",
        borderWidth: 1.5,
        borderRadius: 10,
        height: 50,
        justifyContent: "center",
        alignItems: "center",
    },
    secondaryText: {
        color: "#0066FF",
        fontSize: 15,
        fontWeight: "600",
    },
});
