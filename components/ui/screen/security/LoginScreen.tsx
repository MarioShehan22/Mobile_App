import { View, StyleSheet, ScrollView, TouchableOpacity, Alert, Image } from 'react-native';
import { Text, TextInput } from 'react-native-paper';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Color } from '@/constants/Colors';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/constants/firebaseConfig';
// @ts-ignore
import logo from '../../../../assets/images/logo/logo.png';

export default function LoginScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);

    const handleLogin = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please enter both email and password');
            return;
        }
        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            Alert.alert('Success', `Welcome ${user.email}`);
            navigation.navigate('Process');
        } catch (error: any) {
            console.error(error);
            Alert.alert('Login Failed', error.message);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.card}>
                {/* Logo */}
                <View style={styles.logoWrapper}>
                    <Image source={logo} style={styles.logo} resizeMode="contain" />
                </View>

                {/* Header */}
                <Text style={styles.headerText}>Welcome Back 👋</Text>
                <Text style={styles.subText}>Log in to continue</Text>

                {/* Email */}
                <View style={styles.formGroup}>
                    <TextInput
                        label="Email"
                        left={<TextInput.Icon icon="email-outline" />}
                        value={email}
                        mode="outlined"
                        style={styles.input}
                        onChangeText={setEmail}
                        contentStyle={styles.inputContent}
                    />
                </View>

                {/* Password */}
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
                                icon={passwordVisible ? 'eye-off' : 'eye'}
                                onPress={() => setPasswordVisible(!passwordVisible)}
                                color="#888"
                            />
                        }
                    />
                </View>

                {/* Login Button */}
                <TouchableOpacity style={styles.loginButton} onPress={handleLogin}>
                    <LinearGradient colors={['#0066FF', '#4A90E2']} style={styles.gradientButton}>
                        <Text style={styles.loginButtonText}>Log in</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Divider */}
                <View style={styles.orWrapper}>
                    <View style={styles.line} />
                    <Text style={styles.orText}>OR</Text>
                    <View style={styles.line} />
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity style={styles.signUpButton} onPress={() => navigation.navigate('SignUp')}>
                    <Text style={styles.signButtonText}>Create New Account</Text>
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
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.08,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
    },
    logoWrapper: {
        alignItems: 'center',
        marginBottom: 15,
    },
    logo: {
        width: 150,
        height: 50,
    },
    headerText: {
        fontSize: 26,
        fontWeight: 'bold',
        color: '#222',
        textAlign: 'center',
    },
    subText: {
        fontSize: 14,
        color: '#666',
        textAlign: 'center',
        marginTop: 6,
        marginBottom: 24,
    },
    formGroup: {
        marginBottom: 18,
    },
    input: {
        backgroundColor: 'transparent',
    },
    inputContent: {
        paddingLeft: 0,
        paddingRight: 0,
    },
    loginButton: {
        marginTop: 10,
        borderRadius: 10,
        overflow: 'hidden',
    },
    gradientButton: {
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loginButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    orWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 25,
    },
    line: {
        flex: 1,
        height: 1,
        backgroundColor: '#ddd',
    },
    orText: {
        marginHorizontal: 10,
        color: '#888',
        fontWeight: '500',
    },
    signUpButton: {
        borderColor: '#0066FF',
        borderWidth: 1.5,
        borderRadius: 10,
        height: 50,
        justifyContent: 'center',
        alignItems: 'center',
    },
    signButtonText: {
        color: '#0066FF',
        fontSize: 15,
        fontWeight: '600',
    },
});
