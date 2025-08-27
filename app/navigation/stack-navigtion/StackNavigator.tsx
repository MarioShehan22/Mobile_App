import { createStackNavigator } from "@react-navigation/stack";
import HomeBottomTabNavigation from "@/app/navigation/tab-navigation/HomeBottomTabNavigation";
import AddEditTaskScreen from "@/components/ui/screen/home/AddEditTaskScreen";
import LocationPickerScreen from "@/components/ui/screen/home/LocationPickerScreen";
import LoginScreen from "@/components/ui/screen/security/LoginScreen";
import SignUpScreen from "@/components/ui/screen/security/SignUpScreen";

const Stack = createStackNavigator();

export default function StackNavigator() {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Process"
                options={{ headerShown: false }}
                component={HomeBottomTabNavigation}
            />
            <Stack.Screen
                name="AddEditTask"
                options={{ headerShown: false }}
                component={AddEditTaskScreen}
            />
            <Stack.Screen
                name="LocationPicker"
                options={{ headerShown: false }}
                component={LocationPickerScreen}
            />
            <Stack.Screen
                name="Login"
                options={{ headerShown: false }}
                component={LoginScreen}
            />
            <Stack.Screen
                name="SignUp"
                options={{ headerShown: false }}
                component={SignUpScreen}
            />
        </Stack.Navigator>
    );
}