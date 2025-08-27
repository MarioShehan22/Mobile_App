import {createStackNavigator} from "@react-navigation/stack";
import HomeBottomTabNavigation from "@/app/navigation/tab-navigation/HomeBottomTabNavigation";
import LoginScreen from "@/components/ui/screen/security/LoginScreen";
import SignUpScreen from "@/components/ui/screen/security/SignUpScreen";
import TourDetailsScreen from "@/components/ui/screen/TourDetailsScreen";
import LocationDetailsScreen from "@/components/ui/screen/LocationDetailsScreen";
import GuideDetailsScreen from "@/components/ui/screen/GuideDetailsScreen";
import GuideLoginScreen from "@/components/ui/screen/security/GuideLoginScreen";
import EditTouristProfile from "@/components/ui/screen/other/EditTouristProfile";
import GuideDashboard from "@/components/ui/screen/home/GuideHome/GuideDashboard";
import AvailabilityCalendarScreen from "@/components/ui/screen/share/AvailabilityCalendarScreen";
import GuideHomeBottomTabNavigation from "@/app/navigation/tab-navigation/GuideHomeBottomtabNavigation";

const Stack = createStackNavigator();

export default function StackNavigator(){
    return(
        <Stack.Navigator>
            <Stack.Screen
                name={'Process'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={HomeBottomTabNavigation}
            />
            <Stack.Screen
                name={'GuideProcess'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={GuideHomeBottomTabNavigation}
            />
            <Stack.Screen
                name={'Login'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={LoginScreen}
            />
            <Stack.Screen
                name={'SignUp'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={SignUpScreen}
            />
            <Stack.Screen
                name={'TourDetails'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={TourDetailsScreen}
            />
            <Stack.Screen
                name={'LocationDetails'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={LocationDetailsScreen}
            />
            <Stack.Screen
                name={'GuideDetails'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={GuideDetailsScreen}
            />
            <Stack.Screen
                name={'GuideLogin'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={GuideLoginScreen}
            />
            <Stack.Screen
                name={'TouristProfile'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={EditTouristProfile}
            />
            <Stack.Screen
                name={'GuideDashboard'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={GuideDashboard}
            />
            <Stack.Screen
                name={'AvailabilityCalendar'}
                options={{headerLeft:()=>null, headerShown:false}}
                component={AvailabilityCalendarScreen}
            />
        </Stack.Navigator>
    )
}