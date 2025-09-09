import {LogBox, StyleSheet, View} from 'react-native';
import {useEffect, useState} from "react";
import SplashScreen from "@/components/ui/screen/SplashScreen";
import StackNavigator from "@/app/navigation/stack-navigtion/StackNavigator";
import { registerFcmToken } from '@/services/pushToken';

export default function HomeScreen() {
    const [isLoading, setIsLoading] = useState(true);
    LogBox.ignoreLogs([
        'Warning: Invalid prop `style` supplied to `React.Fragment`',
        'React.Fragment can only have `key` and `children` props',
        'expo-notifications: Android Push notifications',
        '`expo-notifications` functionality is not fully supported'
    ]);
    useEffect(() => {
        registerFcmToken().catch(console.warn);
    }, []);

    return (
        <View style={styles.container}>
            {isLoading ? (
                <SplashScreen onFinish={() => setIsLoading(false)} />
            ) : (
                <StackNavigator />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
});