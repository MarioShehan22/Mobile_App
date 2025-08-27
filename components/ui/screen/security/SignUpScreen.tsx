import { useState } from "react";
import {Image, ScrollView, StyleSheet, Text, TouchableOpacity, View }from "react-native";
import { Icon, TextInput } from "react-native-paper";
import { Color } from "@/constants/Colors";
// @ts-ignore
import logo from '../../../../assets/images/logo/logo.png';
import { auth } from "@/constants/firebaseConfig";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";

export default function SignUpScreen({ navigation }: any) {
    const [email, setEmail] = useState('');
    const [passwordVisible, setPasswordVisible] = useState(false);
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');

    const handleSignUp = async () => {
        if (!email || !password || !displayName) {
            alert("Please fill in all fields");
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await updateProfile(user, {
                displayName: displayName
            });

            console.log("User created:", user);
            alert("Account created successfully!");
            navigation.navigate('Login');
        } catch (error: any) {
            console.error("Signup error:", error);
            alert(error.message);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.logoWrapper}>
                <Text style={styles.headerText}>Sign Up</Text>
                <Image source={logo} style={styles.logo} resizeMode={'contain'} />
            </View>
            <View style={styles.inputOuter}>
                <View style={styles.formGroup}>
                    <TextInput
                        label="Email"
                        left={<TextInput.Icon icon="email-outline" />}
                        mode='outlined'
                        style={styles.input}
                        activeUnderlineColor="transparent"
                        underlineColor="transparent"
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
                        mode='outlined'
                        style={styles.input}
                        underlineColor="transparent"
                        activeUnderlineColor="transparent"
                        contentStyle={styles.inputContent}
                        right={
                            <TextInput.Icon
                                icon={passwordVisible ? 'eye-off' : 'eye'}
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
                        mode='outlined'
                        style={styles.input}
                        activeUnderlineColor="transparent"
                        underlineColor="transparent"
                        contentStyle={styles.inputContent}
                        label="User name"
                        value={displayName}
                        onChangeText={setDisplayName}
                    />
                </View>
                <TouchableOpacity
                    style={styles.loginButton}
                    onPress={handleSignUp}
                >
                    <Text style={styles.loginText}>
                        Sign Up
                    </Text>
                </TouchableOpacity>

                <Text style={styles.separateText}>OR</Text>

                {/*<View style={styles.socialLoginWrapper}>*/}
                {/*    <TouchableOpacity style={styles.iconOuter}>*/}
                {/*        <Icon size={20} source={'google'} />*/}
                {/*    </TouchableOpacity>*/}
                {/*    <TouchableOpacity style={styles.iconOuter}>*/}
                {/*        <Icon size={20} source={'facebook'} />*/}
                {/*    </TouchableOpacity>*/}
                {/*    <TouchableOpacity style={styles.iconOuter}>*/}
                {/*        <Icon size={20} source={'twitter'} />*/}
                {/*    </TouchableOpacity>*/}
                {/*    <TouchableOpacity style={styles.iconOuter}>*/}
                {/*        <Icon size={20} source={'instagram'} />*/}
                {/*    </TouchableOpacity>*/}
                {/*</View>*/}

                <TouchableOpacity
                    style={{ ...styles.loginButton, backgroundColor: Color.primary }}
                    onPress={() => navigation.navigate('Login')}
                >
                    <Text style={styles.loginText}>Already have an Account</Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    headerText: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 30,
        color: '#222'
    },
    loginText: {
        color: Color.light
    },
    loginButton: {
        backgroundColor: Color.blue,
        height: 50,
        marginTop: 30,
        borderRadius: 3,
        alignItems: 'center',
        justifyContent: 'center',
    },
    logo: {
        width: 200,
        height: 60
    },
    logoWrapper: {
        alignItems: "center",
        marginTop: 20
    },
    container: {
        flex: 1,
        padding: 10,
        backgroundColor: Color.light
    },
    formGroup: {
        marginBottom: 10,
    },
    inputOuter: {
        marginTop: 50,
    },
    input: {
        flex: 1,
        backgroundColor: 'transparent',
        height: 40,
        padding: 0,
        justifyContent: 'center',
    },
    inputContent: {
        paddingLeft: 0,
        paddingRight: 0,
    },
    iconOuter: {
        backgroundColor: Color.darkGray,
        width: 50,
        height: 50,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
    },
    socialLoginWrapper: {
        flexDirection: 'row',
        marginTop: 20,
        justifyContent: 'space-around',
    },
    separateText: {
        textAlign: 'center',
        marginTop: 20
    },
});
