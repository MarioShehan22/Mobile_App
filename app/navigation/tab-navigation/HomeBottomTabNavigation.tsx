import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import TaskListScreen from '@/components/ui/screen/home/TaskListScreen';
import {Ionicons} from '@expo/vector-icons';
import {Color} from '@/constants/Colors';
import React, {useEffect, useState} from 'react';
import CalendarTaskScreen from "@/components/ui/screen/home/CalendarTaskScreen";
import LocationPickerScreen from "@/components/ui/screen/home/LocationPickerScreen";
import ProfileScreen from "@/components/ui/screen/home/ProfileScreen";
import AsyncStorage from '@react-native-async-storage/async-storage';
import WeatherScreen from "@/components/ui/screen/home/WeatherScreen";

const Tab = createBottomTabNavigator();

export default function HomeBottomTabNavigation({navigation}: any) {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const loadToken = async () => {
            const storedToken = await AsyncStorage.getItem('token');
            setToken(storedToken);
        };
        loadToken();
    }, []);

    return (
        <Tab.Navigator
            initialRouteName="Tasks"
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color }) => {
                    let iconName = '';

                    switch (route.name) {
                        case 'Tasks':
                            iconName = focused ? 'checkmark-done' : 'list-outline';
                            break;
                        case 'Calendar':
                            iconName = focused ? 'calendar' : 'calendar-outline';
                            break;
                        case 'Weather':
                            iconName = focused ? 'cloudy' : 'rainy-outline';
                            break;
                        case 'Location':
                            iconName = focused ? 'navigate' : 'navigate-outline';
                            break;
                        case 'Profile':
                            iconName = focused ? 'person-circle' : 'person-circle-outline';
                            break;
                    }

                    return <Ionicons name={iconName as any} size={20} color={color} />;
                },
                tabBarActiveTintColor: Color.blue,
                tabBarInactiveTintColor: Color.darkGray,
            })}
        >
            <Tab.Screen
                name="Tasks"
                component={TaskListScreen}
                options={{
                    headerTitle: '',
                    headerShown: false
                }}
            />
            <Tab.Screen
                name="Calendar"
                component={CalendarTaskScreen}
                options={{
                    headerTitle: '',
                    headerShown: false
                }}
            />
            <Tab.Screen
                name="Weather"
                component={WeatherScreen}
                options={{
                    headerTitle: '',
                    headerShown: false
                }}
            />
            <Tab.Screen
                name="Location"
                component={LocationPickerScreen}
                options={{
                    headerTitle: '',
                    headerShown: false
                }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{
                    headerRight: () => (
                        <TouchableOpacity
                            style={styles.profileAvatarContainer}
                            onPress={() => navigation.navigate(token ? 'ProfileScreen' : 'Login')}
                        >
                            <Image
                                source={{ uri: 'https://icons.veryicon.com/png/o/miscellaneous/user-avatar/user-avatar-male-5.png' }}
                                style={styles.profileAvatar}
                            />
                        </TouchableOpacity>
                    ),
                }}
            />
        </Tab.Navigator>
    );
}

const styles = StyleSheet.create({
    HomeLogInBtn:{
        marginRight:10,
        width:120,
        backgroundColor:Color.blue,
        borderRadius:3,
        height:35,
        alignItems:'center',
        justifyContent:'center'
    },
    header: {
        backgroundColor: Color.light,
        padding: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    avatar: {
        marginLeft:10,
    },
    headerLeftContainer: {
        paddingLeft: 16,
    },
    greetingText: {
        fontSize: 18,
        fontWeight: '500',
        color: '#333',
    },
    userName: {
        fontWeight: '700',
        color: '#000',
    },
    waveEmoji: {
        fontSize: 20,
    },
    headerRightContainer: {
        paddingRight: 16,
    },
    profileAvatarContainer: {
        borderRadius: 20,
        overflow: 'hidden',
    },
    profileAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
    }
});