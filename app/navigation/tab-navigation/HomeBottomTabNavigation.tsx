import {Image, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs/src";
import HomeGuideScreen from '@/components/ui/screen/home/HomeGuideScreen';
import HomePageScreen from '@/components/ui/screen/home/HomePageScreen';
import HomeTourScreen from '@/components/ui/screen/home/HomeTourScreen';
import HomeLocationScreen from '@/components/ui/screen/home/HomeLocationScreen';
import HomeBookingScreen from '@/components/ui/screen/home/HomeBookingScreen';
import {Ionicons} from '@expo/vector-icons';
import {Color} from '@/constants/Colors';
import React, {useEffect, useState} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

    const getTabBarIcon = (routeName: string, focused: boolean, color: string) => {
        const iconSize = 20;
        const icons: {[key: string]: string} = {
            Book: focused ? 'book' : 'book-outline',
            Location: focused ? 'location' : 'location-outline',
            Home: focused ? 'home' : 'home-outline',
            Tour: focused ? 'car' : 'car-outline',
            Guide: focused ? 'person' : 'person-outline',
        };
        // @ts-ignore
        return <Ionicons name={icons[routeName]} size={iconSize} color={color} />;
    };

    // @ts-ignore
    return (
        <Tab.Navigator
            initialRouteName="Home"
            screenOptions={({route}) => ({
                tabBarIcon: ({focused, color}) => getTabBarIcon(route.name, focused, color),
                tabBarActiveTintColor: Color.blue,
                tabBarInactiveTintColor: Color.darkGray,
            })}>
            {/* Tab Screens */}
            <Tab.Screen
                name="Book"
                component={HomeBookingScreen}
                options={{
                    headerLeft: () => (
                        <View style={styles.header}>
                            <Text style={styles.headerTitle}>My Bookings</Text>
                        </View>
                    ),
                    headerTitle: '',
                }}
            />
            <Tab.Screen name="Location" component={HomeLocationScreen} />
            <Tab.Screen
                name="Home"
                component={HomePageScreen}
                options={{
                    headerLeft: () => (
                        <View style={styles.headerLeftContainer}>
                            <Text style={styles.greetingText}>
                                Hi, <Text style={styles.userName}>David</Text>{' '}
                                <Text style={styles.waveEmoji}>👋</Text>
                            </Text>
                        </View>
                    ),
                    headerTitle: '',
                    headerRight: () => (
                        <View style={styles.headerRightContainer}>
                            <TouchableOpacity
                                style={styles.profileAvatarContainer}
                                onPress={() => navigation.navigate(token ? 'TouristProfile' : 'Login')}>
                                <Image
                                    source={require('../../../assets/images/avatar/image 1.png')}
                                    style={styles.profileAvatar}
                                />
                            </TouchableOpacity>
                        </View>
                    ),
                }}
            />
            <Tab.Screen name="Tour" component={HomeTourScreen} />
            <Tab.Screen name="Guide" component={HomeGuideScreen} />
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
})