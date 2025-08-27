import React, { useEffect, useRef } from "react";
import { Animated, Image, ImageBackground, StyleSheet, Text, View } from "react-native";

interface SplashScreenProps {
    onFinish: () => void;
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
    const logo = require("@/assets/images/logo/logo.png"); // Fixed path
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const animation = Animated.timing(progress, {
            toValue: 100,
            duration: 4000,
            useNativeDriver: false,
        });

        animation.start(() => {
            onFinish();
        });

        // Cleanup on unmount
        return () => {
            animation.stop();
        };
    }, [onFinish]);

    return (
        <ImageBackground
            source={require('@/assets/images/background.jpg')} // <-- your image path
            resizeMode="cover"
            style={styles.container}
        >
            <Image source={logo} style={styles.logo} resizeMode="contain" />

            <View style={styles.textWrapper}>
                <Text style={styles.subtitle}>
                    Your to-do list, powered by your environment.
                </Text>
            </View>

            <View style={styles.progressContainer}>
                <Animated.View
                    style={[
                        styles.progressbar,
                        {
                            width: progress.interpolate({
                                inputRange: [0, 100],
                                outputRange: ['0%', '100%'],
                            }),
                        },
                    ]}
                />
            </View>
        </ImageBackground>

    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    logo: {
        width: 180,
        height: 180,
        marginBottom: 30,
    },
    textWrapper: {
        alignItems: "center",
        marginBottom: 40,
    },
    subtitle: {
        fontSize: 15,
        color: "#5555557e",
        textAlign: "center",
        maxWidth: 280,
    },
    progressContainer: {
        width: "80%",
        height: 6,
        backgroundColor: "#5555557e",
        borderRadius: 3,
        overflow: "hidden",
    },
    progressbar: {
        height: "100%",
        backgroundColor: "#000000ff",
        borderRadius: 3,
    },
});