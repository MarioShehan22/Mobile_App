import {Text, StyleSheet, Animated, View, Image} from "react-native";
import {useEffect, useRef} from "react";
import {Color} from "@/constants/Colors";
import appJson from '../../../app.json';

export default function SplashScreen({onFinish}:any){
    const logo = require('../../../assets/images/logo/logo.png');
    const progress = useRef(new Animated.Value(0)).current;
    useEffect(()=>{
        Animated.timing(progress,{
            toValue:100,
            duration:5000,
            useNativeDriver:false
        }).start(()=>{
            onFinish();
        });
    }, [onFinish]);

    return(
        <View style={styles.container}>
            {/* Background gradient simulation */}
            <View style={[styles.gradientLayer, {backgroundColor: '#0047ab'}]} />
            <View style={[styles.gradientLayer, {backgroundColor: '#0c5bb5', opacity: 0.9}]} />
            <View style={[styles.gradientLayer, {backgroundColor: '#186fc0', opacity: 0.8}]} />
            <View style={[styles.gradientLayer, {backgroundColor: '#2482ca', opacity: 0.7}]} />
            <View style={[styles.gradientLayer, {backgroundColor: '#1ca9c9', opacity: 0.6}]} />
            <View>
                <Image
                    style={styles.logo}
                    source={logo}
                    resizeMode={'contain'}/>
            </View>
            <Text>Find Your Dream</Text>
            <Text>Destination With Us</Text>
            <View style={styles.progressContainer}>
                <Animated.View
                    style={[
                        styles.progressbar,
                        {width: progress.interpolate({inputRange: [0, 100], outputRange: ['0%', '100%']})}
                    ]}
                >
                </Animated.View>
            </View>
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gradientLayer: {
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
    },
    progressContainer:{
        width:'80%',
        height:5,
        backgroundColor:Color.darkGray,
        overflow:'hidden',
        borderRadius:5,
        marginTop:30
    },
    progressbar: {
        backgroundColor: Color.blue,
        borderRadius: 5,
        height: '100%'
    },
    logo:{
        height:55,
    },
})